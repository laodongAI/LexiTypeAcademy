"""ASR 服务：本地离线语音识别（sherpa-onnx SenseVoice）。

职责：
- 懒加载 SenseVoice 识别器（多语种，中英日韩粤）
- 将浏览器上传的 webm/ogg 等格式统一转 16 kHz 单声道 WAV 后识别
- 提供整段识别、分段识别与基于参考文本的简化评分
- 全部失败以 success=false + 错误码返回，符合前端契约

说明：
    SenseVoice 的 Python 绑定未暴露逐词置信度（ys_log_probs 为空），
    因此置信度采用基于识别结果长度的启发式估算，模块内已显式标注。
"""

from __future__ import annotations

import re
import threading
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.voice.audio import ASR_SAMPLE_RATE, convert_to_wav16k, read_wav_samples
from app.services.voice.scoring import score_pronunciation

# 模块级日志器
logger = get_logger(__name__)

# SenseVoice 输出中的语种/情感/事件标记，如 <|en|>、<|NEUTRAL|>，展示前需剔除
_TAG_PATTERN = re.compile(r"<\|[^|]*\|>")

# 分段窗口默认时长（秒）：句子模式较短、段落模式较长
SEGMENT_SECONDS_BY_MODE: Dict[str, float] = {
    "sentence": 12.0,
    "paragraph": 30.0,
    "time": 30.0,
}

# 判定“有效文本”的正则：至少包含一个字母/数字/汉字，纯标点不算有效内容
_MEANINGFUL_PATTERN = re.compile(r"[A-Za-z0-9\u3400-\u4dbf\u4e00-\u9fff]")


class ASRService:
    """语音识别服务（进程内单例）。

    属性：
        _recognizer: sherpa-onnx OfflineRecognizer 实例，懒加载后缓存。
        _load_lock: 加载互斥锁。
        _decode_lock: 解码互斥锁，保证同一时刻只有一个会话在推理。
    """

    def __init__(self) -> None:
        # 识别器实例：None 表示尚未加载
        self._recognizer: Optional[Any] = None
        # 加载锁
        self._load_lock = threading.Lock()
        # 解码锁
        self._decode_lock = threading.Lock()
        # 最近一次加载失败原因
        self._load_error: Optional[str] = None
        # 采样率与特征维度（SenseVoice 固定 16k / 80 维）
        self._sample_rate: int = ASR_SAMPLE_RATE

    # ------------------------------------------------------------------
    # 模型加载
    # ------------------------------------------------------------------
    def _ensure_loaded(self) -> None:
        """确保识别器已加载。

        异常：
            RuntimeError: 依赖缺失、模型文件缺失或初始化失败。
        """
        # 快路径：已加载直接返回
        if self._recognizer is not None:
            return

        with self._load_lock:
            # 双重检查，避免并发重复加载大模型
            if self._recognizer is not None:
                return

            settings = get_settings()
            model_dir: Path = settings.asr_model_path

            # 必需文件：int8 量化模型与词表
            model_path = model_dir / "model.int8.onnx"
            tokens_path = model_dir / "tokens.txt"

            if not model_path.is_file() or not tokens_path.is_file():
                self._load_error = f"ASR 模型文件缺失：{model_dir}"
                raise RuntimeError(self._load_error)

            # 延迟导入，避免未安装语音依赖时影响其他接口
            try:
                import sherpa_onnx
            except ImportError as exc:
                self._load_error = f"缺少 sherpa-onnx 依赖：{exc}"
                raise RuntimeError(self._load_error) from exc

            logger.info(
                "开始加载 ASR 引擎：dir=%s，threads=%s，language=%s",
                model_dir,
                settings.asr_num_threads,
                settings.asr_language,
            )

            try:
                recognizer = sherpa_onnx.OfflineRecognizer.from_sense_voice(
                    model=str(model_path),
                    tokens=str(tokens_path),
                    num_threads=settings.asr_num_threads,
                    use_itn=settings.asr_use_itn,
                    language=settings.asr_language,
                    debug=False,
                )
            except Exception as exc:  # 原生初始化异常统一转业务错误
                self._load_error = f"ASR 引擎初始化失败：{exc}"
                logger.error(self._load_error, exc_info=True)
                raise RuntimeError(self._load_error) from exc

            self._recognizer = recognizer
            self._load_error = None

            logger.info("ASR 引擎加载完成：sampleRate=%s", self._sample_rate)

    # ------------------------------------------------------------------
    # 对外能力
    # ------------------------------------------------------------------
    def health(self) -> Dict[str, Any]:
        """返回 ASR 健康状态（不触发模型加载）。"""
        settings = get_settings()
        model_dir: Path = settings.asr_model_path

        return {
            "engine": "sensevoice",
            "modelDir": str(model_dir),
            "modelReady": (model_dir / "model.int8.onnx").is_file(),
            "loaded": self._recognizer is not None,
            "sampleRate": self._sample_rate,
            "language": settings.asr_language,
            "error": self._load_error,
        }

    def recognize(
        self,
        audio_path: Path,
        language: str = "en",
        reference_text: Optional[str] = None,
        enable_score: bool = False,
    ) -> Dict[str, Any]:
        """识别单段音频。

        参数：
            audio_path: 已落盘的上传音频路径。
            language: 语言标识（仅用于评分切词，识别语言由模型自动判定）。
            reference_text: 参考文本，评分时必填。
            enable_score: 是否返回评分。

        返回：
            成功：{success, text, confidence, duration, words?, score?}
            失败：{success: False, error, code}
        """
        # 上传文件校验
        if not audio_path.is_file() or audio_path.stat().st_size == 0:
            return {"success": False, "error": "音频文件为空", "code": "ASR_EMPTY_AUDIO"}

        # 转码为 16k 单声道 WAV；临时文件在 finally 中清理
        wav_path = self._make_temp_wav_path()
        settings = get_settings()

        try:
            convert_to_wav16k(audio_path, wav_path, settings.resolve_ffmpeg())
        except Exception as exc:
            logger.error("音频转码失败：%s", exc)
            return {
                "success": False,
                "error": f"音频转码失败：{exc}",
                "code": "ASR_AUDIO_CONVERT_FAILED",
            }

        try:
            # 读取采样
            samples, sample_rate = read_wav_samples(wav_path)
            duration = len(samples) / sample_rate if sample_rate else 0.0

            logger.info(
                "开始 ASR 识别：duration=%.2fs，samples=%s，enableScore=%s",
                duration,
                len(samples),
                enable_score,
            )

            # 模型加载
            try:
                self._ensure_loaded()
            except RuntimeError as exc:
                return {
                    "success": False,
                    "error": str(exc),
                    "code": "ASR_MODEL_UNAVAILABLE",
                }

            # 解码
            result = self._decode(samples, sample_rate)
            text = self._clean_text(result.text)

            # 置信度：SenseVoice 未提供逐词 logprob，按文本有效性给启发式值
            confidence = self._heuristic_confidence(text)

            response: Dict[str, Any] = {
                "success": True,
                "text": text,
                "confidence": confidence,
                "duration": round(duration, 2),
                "words": self._build_words(result, text, duration),
            }

            # 评分：仅在显式启用且提供参考文本时计算
            if enable_score and reference_text and reference_text.strip():
                response["score"] = score_pronunciation(
                    recognized=text,
                    reference=reference_text,
                    language=language,
                    confidence=confidence,
                    duration=duration,
                )
                logger.info(
                    "ASR 评分完成：overall=%s，accuracy=%s",
                    response["score"]["overall"],
                    response["score"]["accuracy"],
                )

            logger.info("ASR 识别完成：chars=%s，confidence=%.2f", len(text), confidence)
            return response
        finally:
            # 临时 WAV 用完即删，避免磁盘堆积
            if wav_path.exists():
                wav_path.unlink()

    def segment(
        self,
        audio_path: Path,
        language: str = "en",
        segment_mode: str = "sentence",
        max_segment_duration: Optional[float] = None,
    ) -> Dict[str, Any]:
        """分段识别长音频。

        参数：
            audio_path: 上传音频路径。
            language: 语言标识（用于日志与评分切词）。
            segment_mode: sentence / paragraph / time。
            max_segment_duration: 自定义分段时长（秒），优先于模式默认值。

        返回：
            成功：{success, segments, fullText, duration}
            失败：{success: False, segments: [], fullText: "", error, code}

        说明：
            当前为“定长窗口切分”，不是基于停顿（VAD）的语义分段；
            句末标点可能被切断，后续可接入 silero_vad 改进。
        """
        # 空音频保护
        if not audio_path.is_file() or audio_path.stat().st_size == 0:
            return {
                "success": False,
                "segments": [],
                "fullText": "",
                "error": "音频文件为空",
                "code": "ASR_EMPTY_AUDIO",
            }

        settings = get_settings()
        wav_path = self._make_temp_wav_path()

        try:
            convert_to_wav16k(audio_path, wav_path, settings.resolve_ffmpeg())
        except Exception as exc:
            logger.error("分段识别转码失败：%s", exc)
            return {
                "success": False,
                "segments": [],
                "fullText": "",
                "error": f"音频转码失败：{exc}",
                "code": "ASR_AUDIO_CONVERT_FAILED",
            }

        try:
            samples, sample_rate = read_wav_samples(wav_path)
            total_duration = len(samples) / sample_rate if sample_rate else 0.0

            try:
                self._ensure_loaded()
            except RuntimeError as exc:
                return {
                    "success": False,
                    "segments": [],
                    "fullText": "",
                    "error": str(exc),
                    "code": "ASR_MODEL_UNAVAILABLE",
                }

            # 分段时长：优先使用请求值，其次使用模式默认值
            window = max_segment_duration or SEGMENT_SECONDS_BY_MODE.get(
                segment_mode, 30.0
            )
            # 保护性下限，避免窗口过小产生大量碎片
            window = max(float(window), 1.0)

            window_samples = int(window * sample_rate)
            segments: List[Dict[str, Any]] = []
            texts: List[str] = []

            logger.info(
                "开始分段识别：mode=%s，window=%.1fs，total=%.2fs",
                segment_mode,
                window,
                total_duration,
            )

            # 逐窗口切分并识别
            for index, start in enumerate(range(0, len(samples), window_samples)):
                chunk = samples[start : start + window_samples]
                if chunk.size == 0:
                    continue

                result = self._decode(chunk, sample_rate)
                text = self._clean_text(result.text)
                # 纯标点或无内容的分段直接跳过，避免返回大量空行
                if not self._has_meaningful_text(text):
                    continue

                start_time = round(start / sample_rate, 2)
                end_time = round(min((start + chunk.size) / sample_rate, total_duration), 2)

                segments.append(
                    {
                        "id": f"s{index + 1}",
                        "text": text,
                        "startTime": start_time,
                        "endTime": end_time,
                        "confidence": self._heuristic_confidence(text),
                    }
                )
                texts.append(text)

            full_text = " ".join(texts).strip()
            logger.info("分段识别完成：segments=%s", len(segments))

            return {
                "success": True,
                "segments": segments,
                "fullText": full_text,
                "duration": round(total_duration, 2),
                "language": language,
            }
        finally:
            if wav_path.exists():
                wav_path.unlink()

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------
    def _make_temp_wav_path(self) -> Path:
        """生成唯一的临时 WAV 路径（位于语音临时目录）。"""
        settings = get_settings()
        # 使用 uuid 避免并发请求互相覆盖
        return settings.voice_tmp_path / f"asr-{uuid.uuid4().hex}.wav"

    def _clean_text(self, raw_text: Optional[str]) -> str:
        """清洗识别文本：剔除 SenseVoice 标记并合并多余空白。

        参数：
            raw_text: 识别器返回的原始文本。

        返回：
            可直接展示的文本。
        """
        # 先剔除 <|en|>、<|NEUTRAL|> 之类的控制标记
        cleaned = _TAG_PATTERN.sub("", raw_text or "")
        # 合并连续空白并去除首尾空白
        return re.sub(r"\s+", " ", cleaned).strip()

    def _has_meaningful_text(self, text: str) -> bool:
        """判断文本是否包含有效内容（字母/数字/汉字）。

        参数：
            text: 待判断文本。

        返回：
            至少含一个有效字符时返回 True。
        """
        return bool(_MEANINGFUL_PATTERN.search(text or ""))

    def _decode(self, samples: np.ndarray, sample_rate: int) -> Any:
        """对一段采样执行识别，返回原始结果对象。

        参数：
            samples: float32 单声道采样。
            sample_rate: 采样率。

        返回：
            sherpa-onnx 识别结果对象（含 text / tokens / timestamps 等）。
        """
        # 推理串行化：同一个 recognizer 不支持多会话并发
        with self._decode_lock:
            stream = self._recognizer.create_stream()
            stream.accept_waveform(sample_rate=sample_rate, waveform=samples)
            self._recognizer.decode_stream(stream)
            return stream.result

    def _heuristic_confidence(self, text: str) -> float:
        """基于识别文本有效性估算置信度。

        参数：
            text: 识别文本。

        返回：
            0-1 的置信度估值。

        说明：
            SenseVoice Python 绑定未提供可用 logprob，这里用长度做粗略判断：
            空文本 0.0，1 字符 0.6，2-3 字符 0.8，更长 0.92。
            该值仅用于前端展示与评分的先验，不代表真实声学概率。
        """
        length = len((text or "").strip())

        if length == 0:
            return 0.0
        if length == 1:
            return 0.6
        if length <= 3:
            return 0.8
        return 0.92

    def _build_words(
        self, result: Any, text: str, duration: float
    ) -> Optional[List[Dict[str, Any]]]:
        """根据识别结果的 tokens 与时间戳构造逐词信息。

        参数：
            result: 识别结果对象。
            text: 已清洗的完整文本。
            duration: 音频总时长（秒）。

        返回：
            词条列表；无可用 token 时返回 None。

        说明：
            SenseVoice 的 result.words 为空，这里用 tokens + timestamps 拼装；
            endTime 取下一个 token 的起始时间，最后一个 token 取音频总时长。
        """
        # 无文本或无可对齐 token 时直接返回空
        if not text or not getattr(result, "tokens", None):
            return None

        tokens = list(result.tokens)
        timestamps = list(result.timestamps)

        words: List[Dict[str, Any]] = []
        for index, token in enumerate(tokens):
            # 去除首尾空白；纯空白或纯标点 token 不输出为单词
            word = str(token).strip()
            if not word or not self._has_meaningful_text(word):
                continue

            start_time = float(timestamps[index]) if index < len(timestamps) else 0.0
            # 结束时间：优先下一个 token 起点，否则用音频总时长
            if index + 1 < len(timestamps):
                end_time = float(timestamps[index + 1])
            else:
                end_time = duration

            words.append(
                {
                    "word": word,
                    "startTime": round(start_time, 2),
                    "endTime": round(max(end_time, start_time), 2),
                    "confidence": self._heuristic_confidence(word),
                }
            )

        return words or None


# 进程内单例
_asr_service: Optional[ASRService] = None
# 单例创建锁
_singleton_lock = threading.Lock()


def get_asr_service() -> ASRService:
    """获取 ASR 服务单例。

    返回：
        进程内唯一的 ASRService 实例。
    """
    global _asr_service

    # 快路径
    if _asr_service is not None:
        return _asr_service

    with _singleton_lock:
        # 双重检查，避免并发创建
        if _asr_service is None:
            _asr_service = ASRService()
            logger.debug("ASR 服务单例已创建")

    return _asr_service
