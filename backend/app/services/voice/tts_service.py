"""TTS 服务：本地离线语音合成（sherpa-onnx）。

职责：
- 懒加载 TTS 引擎（默认 MeloTTS 中英双语模型），进程内复用，避免重复加载
- 对并发请求串行化推理，规避 ONNX Runtime 会话的线程安全问题
- 按文本/音色/语速/格式生成文件级缓存，减少重复合成开销
- 输出与前端契约一致的结果：base64 音频、时长、可播放 URL、缓存键

说明：
    单机单用户场景下以“稳定优先”：任何失败都返回 success=false + 错误码，
    不让异常直接冒泡成 500，便于前端按契约展示错误。
"""

from __future__ import annotations

import base64
import hashlib
import json
import subprocess
import threading
import time
from pathlib import Path
from typing import Any, Dict, Optional

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.voice.audio import write_wav_file

# 模块级日志器
logger = get_logger(__name__)

# 支持的输出格式：扩展名与 ffmpeg 编码参数
SUPPORTED_FORMATS: Dict[str, str] = {
    "wav": "",  # 原生 WAV，无需转码
    "mp3": "libmp3lame",
    "ogg": "libvorbis",
}

# 语速合法范围：与前端 rate 字段约束一致
MIN_SPEED: float = 0.5
MAX_SPEED: float = 2.0

# 已支持的引擎标识：当前仅 MeloTTS（中英双语主引擎）
SUPPORTED_ENGINES: Dict[str, str] = {
    "melo": "MeloTTS 中英双语",
}


class TTSService:
    """TTS 合成服务（进程内单例）。

    属性：
        _engine: sherpa-onnx OfflineTts 实例，懒加载后缓存。
        _load_lock: 模型加载锁，保证并发首请求只加载一次。
        _generate_lock: 推理锁，序列化合成调用。
        _load_error: 最近一次加载失败原因，便于健康检查反馈。
    """

    def __init__(self) -> None:
        # 引擎实例：None 表示尚未加载
        self._engine: Optional[Any] = None
        # 模型加载互斥锁
        self._load_lock = threading.Lock()
        # 推理互斥锁（sherpa-onnx 会话非线程安全）
        self._generate_lock = threading.Lock()
        # 记录加载失败信息
        self._load_error: Optional[str] = None
        # 引擎采样率与说话人数：加载后填充
        self._sample_rate: int = 0
        self._num_speakers: int = 1

    # ------------------------------------------------------------------
    # 模型加载
    # ------------------------------------------------------------------
    def _ensure_loaded(self) -> None:
        """确保引擎已加载；未加载时执行一次懒加载。

        异常：
            RuntimeError: 模型文件缺失、依赖缺失或引擎初始化失败。
        """
        # 快路径：已加载则直接返回，避免每次请求都抢锁
        if self._engine is not None:
            return

        with self._load_lock:
            # 双重检查：等待锁期间可能已被其他线程加载完成
            if self._engine is not None:
                return

            settings = get_settings()
            model_dir: Path = settings.tts_model_path

            # 引擎标识校验：未知引擎直接报错，避免加载到错误模型
            if settings.tts_engine not in SUPPORTED_ENGINES:
                raise RuntimeError(
                    f"不支持的 TTS 引擎：{settings.tts_engine}，"
                    f"可选：{','.join(SUPPORTED_ENGINES)}"
                )

            # 必需文件校验：model / lexicon / tokens 缺一不可
            required_files = {
                "model": model_dir / "model.onnx",
                "lexicon": model_dir / "lexicon.txt",
                "tokens": model_dir / "tokens.txt",
            }
            missing = [name for name, path in required_files.items() if not path.is_file()]
            if missing:
                self._load_error = f"TTS 模型文件缺失：{','.join(missing)}（{model_dir}）"
                raise RuntimeError(self._load_error)

            # 延迟导入：未安装语音依赖时只影响语音功能，不影响其他接口
            try:
                import sherpa_onnx
            except ImportError as exc:
                self._load_error = f"缺少 sherpa-onnx 依赖：{exc}"
                raise RuntimeError(self._load_error) from exc

            # 可选规则 FST：数字、日期、电话号码、多音字，存在才启用
            rule_candidates = ["date.fst", "phone.fst", "number.fst", "new_heteronym.fst"]
            rule_paths = [
                str(model_dir / name)
                for name in rule_candidates
                if (model_dir / name).is_file()
            ]

            logger.info(
                "开始加载 TTS 引擎：engine=%s，dir=%s，threads=%s",
                settings.tts_engine,
                model_dir,
                settings.tts_num_threads,
            )

            try:
                # 构造 VITS 配置：MeloTTS 属于 VITS 架构
                config = sherpa_onnx.OfflineTtsConfig(
                    model=sherpa_onnx.OfflineTtsModelConfig(
                        vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                            model=str(required_files["model"]),
                            lexicon=str(required_files["lexicon"]),
                            tokens=str(required_files["tokens"]),
                        ),
                        num_threads=settings.tts_num_threads,
                        provider="cpu",
                    ),
                    rule_fsts=",".join(rule_paths),
                    max_num_sentences=1,
                )
                # 创建引擎实例
                engine = sherpa_onnx.OfflineTts(config)
            except Exception as exc:  # 引擎初始化可能抛各类原生异常
                self._load_error = f"TTS 引擎初始化失败：{exc}"
                logger.error(self._load_error)
                raise RuntimeError(self._load_error) from exc

            # 记录引擎元信息
            self._engine = engine
            self._sample_rate = int(engine.sample_rate)
            self._num_speakers = int(getattr(engine, "num_speakers", 1) or 1)
            self._load_error = None

            logger.info(
                "TTS 引擎加载完成：sampleRate=%s，numSpeakers=%s",
                self._sample_rate,
                self._num_speakers,
            )

    # ------------------------------------------------------------------
    # 对外能力
    # ------------------------------------------------------------------
    def health(self) -> Dict[str, Any]:
        """返回 TTS 健康状态（不触发模型加载，避免健康检查拖慢响应）。"""
        settings = get_settings()
        model_dir: Path = settings.tts_model_path

        # 仅做文件存在性检查，不加载模型
        model_ready = (model_dir / "model.onnx").is_file()

        return {
            "engine": settings.tts_engine,
            "engineName": SUPPORTED_ENGINES.get(settings.tts_engine, "unknown"),
            "modelDir": str(model_dir),
            "modelReady": model_ready,
            "loaded": self._engine is not None,
            "numSpeakers": self._num_speakers,
            "sampleRate": self._sample_rate,
            "maxChars": settings.tts_max_chars,
            "error": self._load_error,
        }

    def list_voices(self) -> Dict[str, Any]:
        """返回可用音色列表。

        说明：
            MeloTTS 为单说话人模型，音色列表只有一个默认音色；
            多说话人引擎（如 aishell3）后续接入时按 num_speakers 展开。
        """
        settings = get_settings()

        # 未加载时按单说话人给默认值，避免为了查询音色而触发 5 秒加载
        num_speakers = self._num_speakers if self._engine is not None else 1

        voices = [
            {
                "id": str(sid),
                "sid": sid,
                "name": f"Speaker {sid}",
                "displayName": "默认音色" if sid == 0 else f"音色 {sid}",
            }
            for sid in range(num_speakers)
        ]

        return {
            "success": True,
            "engine": settings.tts_engine,
            "engineName": SUPPORTED_ENGINES.get(settings.tts_engine, "unknown"),
            "numSpeakers": num_speakers,
            "voices": voices,
            "loaded": self._engine is not None,
        }

    def generate(
        self,
        text: str,
        language: str = "en",
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[float] = None,
        fmt: Optional[str] = None,
    ) -> Dict[str, Any]:
        """合成语音并返回前端契约结构。

        参数：
            text: 待合成文本，长度受 tts_max_chars 限制。
            language: 语言标识，仅用于日志（MeloTTS 自动处理中英混读）。
            voice: 说话人 ID（字符串或数字形态），默认 0。
            rate: 语速倍数 0.5-2.0，默认 1.0。
            pitch: 音调倍数；MeloTTS 不支持，接收但忽略。
            fmt: 输出格式 wav/mp3/ogg，默认 wav。

        返回：
            成功：{success, audio, duration, url, cacheKey, format, sampleRate}
            失败：{success: False, error, code}
        """
        settings = get_settings()

        # ---------- 入参校验 ----------
        normalized_text = (text or "").strip()
        if not normalized_text:
            return {"success": False, "error": "文本不能为空", "code": "TTS_EMPTY_TEXT"}

        if len(normalized_text) > settings.tts_max_chars:
            return {
                "success": False,
                "error": f"文本超长：{len(normalized_text)} > {settings.tts_max_chars}",
                "code": "TTS_TEXT_TOO_LONG",
            }

        # 说话人 ID 解析：非数字时回退到 0
        try:
            sid = int(voice) if voice not in (None, "") else 0
        except (TypeError, ValueError):
            logger.warning("无法解析音色参数：%r，回退到默认音色", voice)
            sid = 0

        # 语速：缺省 1.0，超界裁剪
        try:
            speed = float(rate) if rate is not None else 1.0
        except (TypeError, ValueError):
            speed = 1.0
        speed = min(max(speed, MIN_SPEED), MAX_SPEED)

        # 音调：当前引擎不支持，记录一次调试日志即可
        if pitch is not None and float(pitch) != 1.0:
            logger.debug("当前 TTS 引擎不支持音调调节，忽略 pitch=%s", pitch)

        # 输出格式：不支持时回退 wav
        output_format = (fmt or "wav").lower()
        if output_format not in SUPPORTED_FORMATS:
            logger.warning("不支持的输出格式：%s，回退到 wav", output_format)
            output_format = "wav"

        # ---------- 缓存命中检查 ----------
        cache_key = self._build_cache_key(normalized_text, sid, speed, output_format)
        cache_path = settings.tts_cache_path / f"{cache_key}.{output_format}"

        if cache_path.is_file() and cache_path.stat().st_size > 0:
            logger.info("TTS 命中文件缓存：%s", cache_path.name)
            # 缓存命中时优先读取元数据中的真实时长（非 WAV 格式无法从文件头推算）
            return self._build_success_result(
                cache_path,
                cache_key,
                output_format,
                self._read_cached_duration(cache_key),
            )

        # ---------- 模型加载 ----------
        try:
            self._ensure_loaded()
        except RuntimeError as exc:
            return {"success": False, "error": str(exc), "code": "TTS_MODEL_UNAVAILABLE"}

        # ---------- 推理（串行化） ----------
        logger.info(
            "开始 TTS 合成：chars=%s，sid=%s，speed=%s，format=%s",
            len(normalized_text),
            sid,
            speed,
            output_format,
        )

        with self._generate_lock:
            try:
                audio = self._engine.generate(normalized_text, sid=sid, speed=speed)
            except Exception as exc:  # 原生推理异常统一转为业务错误
                logger.error("TTS 合成失败：%s", exc, exc_info=True)
                return {
                    "success": False,
                    "error": f"语音合成失败：{exc}",
                    "code": "TTS_SYNTHESIS_FAILED",
                }

        # ---------- 落盘 ----------
        # 原生 WAV 先写临时文件，需要转码时再转
        wav_path = settings.tts_cache_path / f"{cache_key}.wav"
        try:
            write_wav_file(wav_path, audio.samples, int(audio.sample_rate))
        except Exception as exc:
            logger.error("TTS 音频写盘失败：%s", exc, exc_info=True)
            return {
                "success": False,
                "error": f"音频写盘失败：{exc}",
                "code": "TTS_WRITE_FAILED",
            }

        # 原始采样信息即真实时长，转码前后保持一致
        synthesized_duration = round(len(audio.samples) / int(audio.sample_rate), 2)

        # 非 WAV 格式：调用 ffmpeg 转码；失败则回退 WAV
        if output_format != "wav":
            try:
                self._transcode(wav_path, cache_path, output_format)
            except Exception as exc:
                logger.warning("音频转码失败，回退 WAV：%s", exc)
                output_format = "wav"
                cache_path = wav_path
                cache_key = cache_path.stem
            finally:
                # 转码成功后清理中间 WAV，避免缓存目录双份占用
                if output_format != "wav" and wav_path.exists():
                    wav_path.unlink()

        result = self._build_success_result(
            cache_path, cache_key, output_format, synthesized_duration
        )

        # 写入时长元数据，保证后续缓存命中时仍能返回准确时长
        self._write_cached_duration(cache_key, synthesized_duration)

        logger.info(
            "TTS 合成完成：duration=%.2fs，bytes=%s，format=%s",
            result["duration"],
            cache_path.stat().st_size,
            output_format,
        )
        return result

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------
    def _build_cache_key(
        self, text: str, sid: int, speed: float, output_format: str
    ) -> str:
        """构造缓存键：引擎 + 文本 + 音色 + 语速 + 格式的哈希。

        参数：
            text: 规范化后的文本。
            sid: 说话人 ID。
            speed: 语速倍数。
            output_format: 输出格式。

        返回：
            32 位十六进制字符串，可安全作为文件名。
        """
        settings = get_settings()
        # 语速保留两位小数，避免浮点尾差导致缓存碎片化
        raw = f"{settings.tts_engine}|{text}|{sid}|{speed:.2f}|{output_format}"
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    def _build_success_result(
        self,
        audio_path: Path,
        cache_key: str,
        output_format: str,
        known_duration: Optional[float] = None,
    ) -> Dict[str, Any]:
        """将已生成的音频文件组装为前端契约响应。

        参数：
            audio_path: 音频文件路径。
            cache_key: 缓存键（同时作为文件名主干）。
            output_format: 音频格式。
            known_duration: 已知时长（秒）；缓存命中时为 None，按文件估算。

        返回：
            含 base64 音频、时长、访问 URL 的字典。
        """
        settings = get_settings()
        # 读取音频并转 base64，供前端写入 IndexedDB 持久化缓存
        payload = audio_path.read_bytes()
        audio_base64 = base64.b64encode(payload).decode("ascii")

        # 时长：优先生成时的采样数换算值，其次按 WAV 头估算
        duration = (
            round(float(known_duration), 2)
            if known_duration is not None
            else self._estimate_duration(payload, output_format)
        )

        return {
            "success": True,
            "audio": audio_base64,
            "duration": duration,
            "url": f"/api/tts/audio/{audio_path.name}",
            "cacheKey": cache_key,
            "format": output_format,
            "sampleRate": self._sample_rate or 44100,
            "engine": settings.tts_engine,
        }

    def _read_cached_duration(self, cache_key: str) -> Optional[float]:
        """读取缓存音频的时长元数据。

        参数：
            cache_key: 缓存键。

        返回：
            时长秒数；元数据缺失或损坏时返回 None。
        """
        # 元数据与音频同名，扩展名为 .meta.json
        meta_path = get_settings().tts_cache_path / f"{cache_key}.meta.json"

        if not meta_path.is_file():
            return None

        try:
            with meta_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            value = data.get("duration")
            # 仅接受数值类型，避免脏数据导致类型错误
            return float(value) if isinstance(value, (int, float)) else None
        except (OSError, ValueError) as exc:
            logger.debug("读取 TTS 缓存元数据失败：%s（%s）", meta_path.name, exc)
            return None

    def _write_cached_duration(self, cache_key: str, duration: float) -> None:
        """写入缓存音频的时长元数据。

        参数：
            cache_key: 缓存键。
            duration: 时长（秒）。

        说明：
            元数据只用于缓存命中时回显准确时长，写入失败不影响主流程。
        """
        meta_path = get_settings().tts_cache_path / f"{cache_key}.meta.json"

        try:
            with meta_path.open("w", encoding="utf-8") as handle:
                # 记录时长与生成时间，便于后续排查与清理策略扩展
                json.dump(
                    {"duration": round(float(duration), 2), "createdAt": int(time.time())},
                    handle,
                    ensure_ascii=False,
                )
        except OSError as exc:
            logger.warning("写入 TTS 缓存元数据失败：%s（%s）", meta_path.name, exc)

    def _estimate_duration(self, payload: bytes, output_format: str) -> float:
        """估算音频时长（秒）。

        参数：
            payload: 音频文件字节内容。
            output_format: 音频格式。

        返回：
            时长秒数；无法计算时返回 0.0。
        """
        # WAV：数据区字节数 / (采样率 * 声道数 * 2)
        if output_format == "wav" and len(payload) > 44:
            sample_rate = self._sample_rate or 44100
            data_bytes = len(payload) - 44
            return round(data_bytes / (sample_rate * 2), 2)

        # 非 WAV 格式当前不解析帧信息，返回 0 由前端以实际播放为准
        return 0.0

    def _transcode(self, src: Path, dst: Path, output_format: str) -> None:
        """调用 ffmpeg 将 WAV 转为目标格式。

        参数：
            src: 源 WAV 路径。
            dst: 目标文件路径。
            output_format: mp3 / ogg。

        异常：
            RuntimeError: ffmpeg 不可用或返回非零退出码。
        """
        settings = get_settings()
        # 编码器按格式选择；码率固定 128k，兼顾体积与清晰度
        codec = SUPPORTED_FORMATS[output_format]
        ffmpeg = settings.resolve_ffmpeg()

        command = [
            ffmpeg,
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            str(src),
            "-acodec",
            codec,
            "-b:a",
            "128k",
            str(dst),
        ]
        logger.debug("执行音频转码：%s", " ".join(command))

        result = subprocess.run(
            command, capture_output=True, text=True, timeout=120, check=False
        )

        # 非零退出码或输出缺失视为失败，交由调用方回退
        if result.returncode != 0 or not dst.is_file() or dst.stat().st_size == 0:
            error_text = (result.stderr or "").strip()[:300]
            raise RuntimeError(f"ffmpeg 转码失败：{error_text}")


# 进程内单例：延迟创建，避免 import 阶段读配置
_tts_service: Optional[TTSService] = None
# 单例创建锁
_singleton_lock = threading.Lock()


def get_tts_service() -> TTSService:
    """获取 TTS 服务单例。

    返回：
        进程内唯一的 TTSService 实例。
    """
    global _tts_service

    # 快路径：已创建直接返回
    if _tts_service is not None:
        return _tts_service

    with _singleton_lock:
        # 双重检查，避免并发创建多个实例
        if _tts_service is None:
            _tts_service = TTSService()
            logger.debug("TTS 服务单例已创建")

    return _tts_service
