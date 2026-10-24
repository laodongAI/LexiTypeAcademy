"""TTS 服务：本地离线语音合成（sherpa-onnx + OpenVoice 克隆）。

职责：
- 按引擎懒加载模型（melo / aishell3 / kokoro / matcha），进程内复用
- 对并发推理串行化，规避 ONNX Runtime 会话的线程安全问题
- 支持按引擎 + 音色合成，克隆音色走 melo 基底 + OpenVoice 音色迁移
- 按引擎/音色/文本/语速/格式/参考音频哈希生成文件级缓存
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
from typing import Any, Dict, List, Optional

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.voice.audio import write_wav_file
from app.services.voice.tts_engines import (
    engine_available,
    engine_to_dict,
    get_engine,
    list_engines,
    list_voices as list_engine_voices,
    resolve_voice,
    speaker_id_from_voice,
)
from app.services.voice.voice_clone_service import (
    CLONE_SAMPLE_RATE,
    VoiceCloneError,
    VoiceCloneStore,
    get_converter,
)

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

# 额外文件名（相对模型目录）
_AISHELL3_SPEAKERS = "speakers.txt"
_KOKORO_LEXICONS = ("lexicon-us-en.txt", "lexicon-zh.txt")
_MATCHA_VOCODER = Path("tts") / "vocos-22khz-univ.onnx"


class TTSService:
    """TTS 合成服务（进程内单例）。

    属性：
        _engine: 当前驻留的 sherpa-onnx OfflineTts 实例。
        _engine_id: 当前驻留引擎标识。
        _load_lock: 模型加载锁，保证并发首请求只加载一次。
        _generate_lock: 推理锁，序列化合成调用。
        _load_error: 最近一次加载失败原因，便于健康检查反馈。
    """

    def __init__(self) -> None:
        # 当前引擎实例：None 表示尚未加载
        self._engine: Optional[Any] = None
        # 当前引擎标识
        self._engine_id: Optional[str] = None
        # 模型加载互斥锁
        self._load_lock = threading.RLock()
        # 推理互斥锁（sherpa-onnx 会话非线程安全）
        self._generate_lock = threading.RLock()
        # 记录加载失败信息
        self._load_error: Optional[str] = None
        # 引擎采样率与说话人数：加载后填充
        self._sample_rate: int = 0
        self._num_speakers: int = 1
        # 克隆档案存储
        self._clone_store = VoiceCloneStore()
        # 克隆转换器是否处于激活状态（克隆合成复用 melo 引擎，需单独标记）
        self._clone_active: bool = False

    # ------------------------------------------------------------------
    # 模型加载
    # ------------------------------------------------------------------
    def _unload_locked(self) -> None:
        """释放当前引擎与克隆转换器（调用方需持有加载锁）。"""

        if self._engine is not None:
            logger.info("释放 TTS 引擎：%s", self._engine_id)
        # 置空引用，交由 Python 垃圾回收释放原生内存
        self._engine = None
        self._engine_id = None
        self._sample_rate = 0
        self._num_speakers = 1
        # 克隆标记同步复位，避免状态残留
        self._clone_active = False
        # 克隆转换器与引擎解耦，单独释放
        get_converter().release()

    def _ensure_loaded(self, engine_id: str) -> None:
        """确保指定引擎已加载。

        参数：
            engine_id: 目标引擎标识。

        异常：
            RuntimeError: 模型缺失、依赖缺失或初始化失败。
        """

        # 快路径：同一引擎已加载
        if self._engine is not None and self._engine_id == engine_id:
            return

        with self._load_lock:
            # 双重检查
            if self._engine is not None and self._engine_id == engine_id:
                return

            spec = get_engine(engine_id)
            if spec is None:
                raise RuntimeError(f"不支持的 TTS 引擎：{engine_id}")

            # 克隆引擎不创建 OfflineTts，由 melo 基底 + OpenVoice 转换器完成
            if spec.supports_clone:
                self._ensure_loaded("melo")
                # 标记克隆态：melo 引擎被复用，但“已加载”的语义应归属 openvoice
                self._clone_active = True
                return

            available, reason = engine_available(spec)
            if not available:
                self._load_error = f"{spec.display_name} 不可用：{reason}"
                raise RuntimeError(self._load_error)

            # 切换引擎前释放旧实例，控制内存峰值
            self._unload_locked()

            try:
                import sherpa_onnx
            except ImportError as exc:
                self._load_error = f"缺少 sherpa-onnx 依赖：{exc}"
                raise RuntimeError(self._load_error) from exc

            settings = get_settings()
            model_dir = settings.models_path / spec.model_dir
            logger.info(
                "开始加载 TTS 引擎：engine=%s，dir=%s，threads=%s",
                spec.engine_id,
                model_dir,
                settings.tts_num_threads,
            )

            try:
                config = self._build_config(sherpa_onnx, spec.engine_id, model_dir, settings.tts_num_threads)
                engine = sherpa_onnx.OfflineTts(config)
            except Exception as exc:  # 引擎初始化可能抛各类原生异常
                self._load_error = f"TTS 引擎初始化失败：{exc}"
                logger.error(self._load_error)
                raise RuntimeError(self._load_error) from exc

            # 记录引擎元信息
            self._engine = engine
            self._engine_id = spec.engine_id
            self._sample_rate = int(engine.sample_rate)
            self._num_speakers = int(getattr(engine, "num_speakers", 1) or 1)
            self._load_error = None

            logger.info(
                "TTS 引擎加载完成：engine=%s，sampleRate=%s，numSpeakers=%s",
                spec.engine_id,
                self._sample_rate,
                self._num_speakers,
            )

    def _build_config(
        self,
        sherpa_onnx: Any,
        engine_id: str,
        model_dir: Path,
        num_threads: int,
    ) -> Any:
        """按引擎类型构造 sherpa-onnx 配置。

        参数：
            sherpa_onnx: 已导入的 sherpa_onnx 模块。
            engine_id: 引擎标识。
            model_dir: 模型目录。
            num_threads: 推理线程数。
        """

        settings = get_settings()
        rule_paths = [
            str(model_dir / name)
            for name in ("date.fst", "phone.fst", "number.fst", "new_heteronym.fst")
            if (model_dir / name).is_file()
        ]

        if engine_id in ("melo", "aishell3"):
            # VITS：melo 与 aishell3 共用配置结构
            vits_kwargs: Dict[str, Any] = {
                "model": str(model_dir / "model.onnx"),
                "lexicon": str(model_dir / "lexicon.txt"),
                "tokens": str(model_dir / "tokens.txt"),
            }
            # melo 需要 dict 目录；aishell3 不需要
            dict_dir = model_dir / "dict"
            if dict_dir.is_dir():
                vits_kwargs["dict_dir"] = str(dict_dir)

            return sherpa_onnx.OfflineTtsConfig(
                model=sherpa_onnx.OfflineTtsModelConfig(
                    vits=sherpa_onnx.OfflineTtsVitsModelConfig(**vits_kwargs),
                    num_threads=num_threads,
                    provider="cpu",
                ),
                rule_fsts=",".join(rule_paths),
                max_num_sentences=1,
            )

        if engine_id == "kokoro":
            # Kokoro：需要 voices.bin、词典与 espeak 数据
            lexicon = " ".join(
                str(model_dir / name)
                for name in _KOKORO_LEXICONS
                if (model_dir / name).is_file()
            )
            return sherpa_onnx.OfflineTtsConfig(
                model=sherpa_onnx.OfflineTtsModelConfig(
                    kokoro=sherpa_onnx.OfflineTtsKokoroModelConfig(
                        model=str(model_dir / "model.int8.onnx"),
                        voices=str(model_dir / "voices.bin"),
                        tokens=str(model_dir / "tokens.txt"),
                        data_dir=str(model_dir / "espeak-ng-data"),
                        dict_dir=str(model_dir / "dict"),
                        lexicon=lexicon,
                    ),
                    num_threads=num_threads,
                    provider="cpu",
                ),
                max_num_sentences=1,
            )

        if engine_id == "matcha":
            # Matcha：声学模型 + 独立声码器
            return sherpa_onnx.OfflineTtsConfig(
                model=sherpa_onnx.OfflineTtsModelConfig(
                    matcha=sherpa_onnx.OfflineTtsMatchaModelConfig(
                        acoustic_model=str(model_dir / "model-steps-3.onnx"),
                        vocoder=str(settings.models_path / _MATCHA_VOCODER),
                        lexicon=str(model_dir / "lexicon.txt"),
                        tokens=str(model_dir / "tokens.txt"),
                    ),
                    num_threads=num_threads,
                    provider="cpu",
                ),
                rule_fsts=",".join(rule_paths),
                max_num_sentences=1,
            )

        raise RuntimeError(f"不支持的 TTS 引擎类型：{engine_id}")

    # ------------------------------------------------------------------
    # 对外能力
    # ------------------------------------------------------------------
    def health(self) -> Dict[str, Any]:
        """返回 TTS 健康状态（不触发模型加载）。"""

        settings = get_settings()
        engines = self.list_engines()
        current = get_engine(settings.tts_engine or "melo")
        default_available, default_reason = (
            engine_available(current) if current is not None else (False, "未知的默认 TTS 引擎")
        )

        # OpenVoice 依赖 Melo 基底模型；仅有克隆转换模型文件不足以完成合成。
        if current is not None and current.supports_clone:
            base_engine = get_engine("melo")
            base_available, base_reason = (
                engine_available(base_engine) if base_engine is not None else (False, "缺少 Melo 基底引擎定义")
            )
            if not base_available:
                default_available = False
                default_reason = f"OpenVoice 基底模型不可用：{base_reason}"

        return {
            "engine": self._engine_id or (settings.tts_engine or "melo"),
            "engineName": current.display_name if current else "unknown",
            # 健康状态必须反映配置的默认引擎，而不是任意一个可用引擎。
            "modelReady": default_available,
            "defaultEngineAvailable": default_available,
            "defaultEngineReason": default_reason or None,
            "loaded": self._engine is not None,
            "numSpeakers": self._num_speakers,
            "sampleRate": self._sample_rate,
            "maxChars": settings.tts_max_chars,
            "error": self._load_error,
            "engineCount": len(engines),
            "availableEngineCount": len([item for item in engines if item["available"]]),
            "cloneProfileCount": self._clone_store.count(),
        }

    def list_engines(self) -> List[Dict[str, Any]]:
        """返回引擎列表与可用状态（不加载模型）。"""

        result: List[Dict[str, Any]] = []
        for spec in list_engines():
            available, reason = engine_available(spec)
            if spec.supports_clone:
                voice_count = self._clone_store.count()
            else:
                voice_count = len(list_engine_voices(spec.engine_id))
            result.append(
                engine_to_dict(
                    spec,
                    available=available,
                    reason=reason,
                    loaded=(
                        self._clone_active if spec.supports_clone else self._engine_id == spec.engine_id
                    ),
                    voice_count=voice_count,
                )
            )
        return result

    def list_engines_payload(self) -> Dict[str, Any]:
        """返回接口友好的引擎列表结构。"""

        return {"success": True, "engines": self.list_engines()}

    def list_voices(self, engine_id: Optional[str] = None) -> Dict[str, Any]:
        """返回指定引擎的音色列表。

        参数：
            engine_id: 引擎标识；为空时使用配置默认引擎。
        """

        settings = get_settings()
        target_id = (engine_id or settings.tts_engine or "melo").strip()
        spec = get_engine(target_id)
        if spec is None:
            return {"success": False, "error": f"未知引擎：{target_id}", "code": "TTS_ENGINE_UNKNOWN"}

        # 克隆引擎从档案列表读取音色
        profiles = self._clone_store.list_profiles() if spec.supports_clone else None
        voices = list_engine_voices(target_id, profiles)

        return {
            "success": True,
            "engine": target_id,
            "engineName": spec.display_name,
            "numSpeakers": len(voices),
            "voices": voices,
            "loaded": self._clone_active if spec.supports_clone else (self._engine_id == target_id),
            "supportsClone": spec.supports_clone,
        }

    def unload(self) -> Dict[str, Any]:
        """释放当前引擎与克隆转换器。"""

        with self._load_lock:
            self._unload_locked()
        return {"success": True, "message": "TTS 引擎已释放"}

    def generate(
        self,
        text: str,
        language: str = "en",
        voice: Optional[str] = None,
        rate: Optional[float] = None,
        pitch: Optional[float] = None,
        fmt: Optional[str] = None,
        engine: Optional[str] = None,
    ) -> Dict[str, Any]:
        """合成语音并返回前端契约结构。

        参数：
            text: 待合成文本，长度受 tts_max_chars 限制。
            language: 语言标识，仅用于日志。
            voice: 音色标识（支持 engineId:speakerId 与 clone:profileId）。
            rate: 语速倍数 0.5-2.0，默认 1.0。
            pitch: 音调倍数；当前引擎不支持，接收但忽略。
            fmt: 输出格式 wav/mp3/ogg，默认 wav。
            engine: 显式引擎标识；为空时从 voice 或默认配置推导。

        返回：
            成功：{success, audio, duration, url, cacheKey, format, sampleRate, engine}
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

        # 引擎与音色解析
        engine_id, voice_id = resolve_voice(engine, voice)
        spec = get_engine(engine_id)
        if spec is None:
            return {"success": False, "error": f"未知引擎：{engine_id}", "code": "TTS_ENGINE_UNKNOWN"}

        # 语速：缺省 1.0，超界裁剪
        try:
            speed = float(rate) if rate is not None else 1.0
        except (TypeError, ValueError):
            speed = 1.0
        speed = min(max(speed, MIN_SPEED), MAX_SPEED)

        # 音调：当前引擎不支持
        if pitch is not None and float(pitch) != 1.0:
            logger.debug("当前 TTS 引擎不支持音调调节，忽略 pitch=%s", pitch)

        # 输出格式：不支持时回退 wav
        output_format = (fmt or "wav").lower()
        if output_format not in SUPPORTED_FORMATS:
            logger.warning("不支持的输出格式：%s，回退到 wav", output_format)
            output_format = "wav"

        # 克隆档案校验与参考音频哈希（用于缓存隔离）
        clone_profile_id: Optional[str] = None
        clone_ref_hash: str = ""
        clone_embedding = None
        if spec.supports_clone:
            clone_profile_id = speaker_id_from_voice(voice_id)
            try:
                # 只读取一次：优先命中档案内缓存的 embedding，避免重复推理
                clone_embedding, clone_ref_hash = self._clone_store.get_embedding(clone_profile_id)
            except VoiceCloneError as exc:
                return {"success": False, "error": exc.message, "code": exc.code}

        # ---------- 缓存命中检查 ----------
        cache_key = self._build_cache_key(
            engine_id,
            voice_id,
            normalized_text,
            speed,
            output_format,
            clone_ref_hash,
        )
        cache_path = settings.tts_cache_path / f"{cache_key}.{output_format}"

        if cache_path.is_file() and cache_path.stat().st_size > 0:
            logger.info("TTS 命中文件缓存：%s", cache_path.name)
            return self._build_success_result(
                cache_path,
                cache_key,
                output_format,
                self._read_cached_duration(cache_key),
                sample_rate=self._read_cached_sample_rate(cache_key),
                engine_id=engine_id,
            )

        # ---------- 模型加载 ----------
        try:
            self._ensure_loaded(engine_id)
        except RuntimeError as exc:
            return {"success": False, "error": str(exc), "code": "TTS_MODEL_UNAVAILABLE"}

        # 说话人 ID：多说话人引擎按音色解析
        sid = self._resolve_sid(spec.engine_id, voice_id)

        # ---------- 推理（串行化） ----------
        logger.info(
            "开始 TTS 合成：engine=%s，voice=%s，chars=%s，speed=%s，format=%s",
            engine_id,
            voice_id,
            len(normalized_text),
            speed,
            output_format,
        )

        with self._generate_lock:
            try:
                if spec.supports_clone:
                    # 克隆：melo 基底 + OpenVoice 音色迁移
                    audio = self._engine.generate(normalized_text, sid=0, speed=speed)
                    base_samples = list(audio.samples)
                    output_samples = get_converter().convert(
                        base_samples,
                        int(audio.sample_rate),
                        clone_embedding,
                    )
                    samples = output_samples.tolist()
                    sample_rate = CLONE_SAMPLE_RATE
                else:
                    audio = self._engine.generate(normalized_text, sid=sid, speed=speed)
                    samples = list(audio.samples)
                    sample_rate = int(audio.sample_rate)
            except VoiceCloneError as exc:
                logger.error("克隆音色合成失败：%s", exc.message)
                return {"success": False, "error": exc.message, "code": exc.code}
            except Exception as exc:  # 原生推理异常统一转为业务错误
                logger.error("TTS 合成失败：%s", exc, exc_info=True)
                return {
                    "success": False,
                    "error": f"语音合成失败：{exc}",
                    "code": "TTS_SYNTHESIS_FAILED",
                }

        # ---------- 落盘 ----------
        wav_path = settings.tts_cache_path / f"{cache_key}.wav"
        try:
            write_wav_file(wav_path, samples, sample_rate)
        except Exception as exc:
            logger.error("TTS 音频写盘失败：%s", exc, exc_info=True)
            return {
                "success": False,
                "error": f"音频写盘失败：{exc}",
                "code": "TTS_WRITE_FAILED",
            }

        # 原始采样信息即真实时长
        synthesized_duration = round(len(samples) / int(sample_rate), 2)

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
                if output_format != "wav" and wav_path.exists():
                    wav_path.unlink()

        result = self._build_success_result(
            cache_path,
            cache_key,
            output_format,
            synthesized_duration,
            sample_rate=sample_rate,
            engine_id=engine_id,
        )

        # 写入时长与采样率元数据，保证缓存命中时仍能返回准确值
        self._write_cached_meta(cache_key, synthesized_duration, sample_rate)

        # 克隆音色记录最近使用时间
        if clone_profile_id:
            self._clone_store.mark_used(clone_profile_id)

        logger.info(
            "TTS 合成完成：engine=%s，duration=%.2fs，bytes=%s，format=%s",
            engine_id,
            result["duration"],
            cache_path.stat().st_size,
            output_format,
        )
        return result

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------
    def _resolve_sid(self, engine_id: str, voice_id: str) -> int:
        """把 voiceId 解析为 sherpa-onnx 的说话人编号。

        参数：
            engine_id: 引擎标识。
            voice_id: 完整音色标识。
        """

        raw = speaker_id_from_voice(voice_id)

        if engine_id == "aishell3":
            # aishell3 的 voiceId 是 SSBxxxx，需要转换为行号
            speakers_path = get_settings().models_path / "tts" / "vits-icefall-zh-aishell3" / _AISHELL3_SPEAKERS
            try:
                speakers = [
                    line.strip()
                    for line in speakers_path.read_text(encoding="utf-8").splitlines()
                    if line.strip()
                ]
                if raw in speakers:
                    return speakers.index(raw)
            except OSError:
                pass
            return 0

        if engine_id == "kokoro":
            try:
                return int(raw)
            except (TypeError, ValueError):
                return 0

        return 0

    def _build_cache_key(
        self,
        engine_id: str,
        voice_id: str,
        text: str,
        speed: float,
        output_format: str,
        clone_ref_hash: str = "",
    ) -> str:
        """构造缓存键：引擎 + 音色 + 文本 + 语速 + 格式 + 参考音频哈希。"""

        # 语速保留两位小数，避免浮点尾差导致缓存碎片化
        raw = (
            f"{engine_id}|{voice_id}|{text}|{speed:.2f}|{output_format}|{clone_ref_hash}"
        )
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]

    def _build_success_result(
        self,
        audio_path: Path,
        cache_key: str,
        output_format: str,
        known_duration: Optional[float] = None,
        sample_rate: Optional[int] = None,
        engine_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """将已生成的音频文件组装为前端契约响应。"""

        # 读取音频并转 base64，供前端写入 IndexedDB 持久化缓存
        payload = audio_path.read_bytes()
        audio_base64 = base64.b64encode(payload).decode("ascii")

        actual_sample_rate = int(sample_rate or self._sample_rate or 44100)

        # 时长：优先生成时的采样数换算值，其次按 WAV 头估算
        duration = (
            round(float(known_duration), 2)
            if known_duration is not None
            else self._estimate_duration(payload, output_format, actual_sample_rate)
        )

        return {
            "success": True,
            "audio": audio_base64,
            "duration": duration,
            "url": f"/api/tts/audio/{audio_path.name}",
            "cacheKey": cache_key,
            "format": output_format,
            "sampleRate": actual_sample_rate,
            "engine": engine_id or self._engine_id or get_settings().tts_engine,
        }

    def _read_cached_duration(self, cache_key: str) -> Optional[float]:
        """读取缓存音频的时长元数据。"""

        meta_path = get_settings().tts_cache_path / f"{cache_key}.meta.json"
        if not meta_path.is_file():
            return None
        try:
            with meta_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            value = data.get("duration")
            return float(value) if isinstance(value, (int, float)) else None
        except (OSError, ValueError) as exc:
            logger.debug("读取 TTS 缓存元数据失败：%s（%s）", meta_path.name, exc)
            return None

    def _read_cached_sample_rate(self, cache_key: str) -> Optional[int]:
        """读取缓存音频的采样率元数据。"""

        meta_path = get_settings().tts_cache_path / f"{cache_key}.meta.json"
        if not meta_path.is_file():
            return None
        try:
            with meta_path.open("r", encoding="utf-8") as handle:
                data = json.load(handle)
            value = data.get("sampleRate")
            return int(value) if isinstance(value, (int, float)) else None
        except (OSError, ValueError):
            return None

    def _write_cached_meta(self, cache_key: str, duration: float, sample_rate: int) -> None:
        """写入缓存音频的时长与采样率元数据。"""

        meta_path = get_settings().tts_cache_path / f"{cache_key}.meta.json"
        try:
            with meta_path.open("w", encoding="utf-8") as handle:
                json.dump(
                    {
                        "duration": round(float(duration), 2),
                        "sampleRate": int(sample_rate),
                        "createdAt": int(time.time()),
                    },
                    handle,
                    ensure_ascii=False,
                )
        except OSError as exc:
            logger.warning("写入 TTS 缓存元数据失败：%s（%s）", meta_path.name, exc)

    def _estimate_duration(
        self, payload: bytes, output_format: str, sample_rate: int
    ) -> float:
        """估算音频时长（秒）。"""

        if output_format == "wav" and len(payload) > 44:
            data_bytes = len(payload) - 44
            return round(data_bytes / (sample_rate * 2), 2)
        return 0.0

    def _transcode(self, src: Path, dst: Path, output_format: str) -> None:
        """调用 ffmpeg 将 WAV 转为目标格式。"""

        settings = get_settings()
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

        if result.returncode != 0 or not dst.is_file() or dst.stat().st_size == 0:
            error_text = (result.stderr or "").strip()[:300]
            raise RuntimeError(f"ffmpeg 转码失败：{error_text}")


# 进程内单例：延迟创建，避免 import 阶段读配置
_tts_service: Optional[TTSService] = None
# 单例创建锁
_singleton_lock = threading.Lock()


def get_tts_service() -> TTSService:
    """获取 TTS 服务单例。"""

    global _tts_service

    if _tts_service is not None:
        return _tts_service

    with _singleton_lock:
        if _tts_service is None:
            _tts_service = TTSService()
            logger.debug("TTS 服务单例已创建")

    return _tts_service
