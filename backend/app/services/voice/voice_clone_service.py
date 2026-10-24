"""OpenVoice v2 音色克隆服务。

职责：
- 管理克隆档案（上传、列表、读取、删除）
- 校验并归一化参考音频为 22.05kHz 单声道 16bit WAV
- 提取并缓存目标音色 embedding
- 使用 tone_color.onnx 把 melo 基底音频转换为目标音色

说明：
    这里的“克隆”是音色迁移：复制音色特征，不复制参考音频的语气、节奏与内容。
    实现参考仓库内历史基准脚本 scripts/bench_openvoice.py 的 ONNX 推理路径。
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from app.core.config import get_settings
from app.core.logging import get_logger

# 模块日志器
logger = get_logger(__name__)

# OpenVoice 固定输出采样率
CLONE_SAMPLE_RATE = 22050

# 上传限制：10MB、1–30 秒
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MIN_DURATION_SECONDS = 1.0
MAX_DURATION_SECONDS = 30.0

# 档案上限：最多 5 个
MAX_PROFILES = 5

# 声音过小视为静音（RMS 阈值）
MIN_RMS = 0.005

# 合法档案 ID：防止路径穿越
_PROFILE_ID_RE = re.compile(r"^vc_[a-f0-9]{8,32}$")

# OpenVoice 频谱参数（与历史基准保持一致）
_N_FFT = 1024
_HOP = 256
_PAD = 384
_WIN = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(_N_FFT) / _N_FFT)).astype(np.float32)


class VoiceCloneError(Exception):
    """克隆业务异常。

    参数：
        message: 面向用户的中文原因。
        code: 稳定错误码，便于前端分支处理。
    """

    def __init__(self, message: str, code: str = "TTS_CLONE_BAD_REQUEST") -> None:
        super().__init__(message)
        self.message = message
        self.code = code


def _clone_root() -> Path:
    """返回克隆档案根目录，并确保存在。"""

    # 与 AI 配置共用 backend/data
    root = get_settings().data_path / "voice-clone"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _safe_profile_dir(profile_id: str) -> Path:
    """把档案 ID 转为安全的绝对目录。

    参数：
        profile_id: 档案标识。

    异常：
        VoiceCloneError: ID 非法时抛出。
    """

    # 严格校验 ID，避免 ../ 等路径穿越
    if not _PROFILE_ID_RE.match(profile_id or ""):
        raise VoiceCloneError("克隆音色 ID 非法", "TTS_CLONE_NOT_FOUND")

    root = _clone_root().resolve()
    target = (root / profile_id).resolve()

    # 二次确认目标仍在根目录内
    if root not in target.parents and target != root:
        raise VoiceCloneError("克隆音色路径非法", "TTS_CLONE_NOT_FOUND")

    return target


def _read_meta(profile_id: str) -> Optional[Dict[str, Any]]:
    """读取单个档案元数据。"""

    meta_path = _safe_profile_dir(profile_id) / "meta.json"
    if not meta_path.is_file():
        return None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except (OSError, ValueError):
        logger.warning("克隆档案元数据损坏：%s", profile_id)
        return None


def _write_meta(profile_dir: Path, meta: Dict[str, Any]) -> None:
    """原子写入档案元数据。"""

    temp_path = profile_dir / "meta.json.tmp"
    temp_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temp_path, profile_dir / "meta.json")


def _ffmpeg_available() -> bool:
    """检测 ffmpeg 是否可用。"""

    return shutil.which("ffmpeg") is not None


def _ffprobe_duration(path: Path) -> float:
    """读取音频时长（秒）。

    优先使用 ffprobe，缺失时回退 soundfile。
    """

    if shutil.which("ffprobe"):
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v",
                    "error",
                    "-show_entries",
                    "format=duration",
                    "-of",
                    "default=nw=1:nk=1",
                    str(path),
                ],
                capture_output=True,
                text=True,
                timeout=20,
                check=False,
            )
            if result.returncode == 0 and result.stdout.strip():
                return float(result.stdout.strip())
        except (OSError, ValueError, subprocess.SubprocessError):
            pass

    # 回退：soundfile 读取帧数
    try:
        import soundfile as sf  # 延迟导入，避免未安装时影响其他功能

        info = sf.info(str(path))
        return float(info.frames) / float(info.samplerate or 1)
    except Exception:  # noqa: BLE001
        return 0.0


def _normalize_audio(source: Path, target: Path) -> None:
    """把上传音频归一化为 22.05kHz 单声道 16bit WAV。"""

    if not _ffmpeg_available():
        # 无 ffmpeg 时只接受已合规的 WAV
        if source.suffix.lower() != ".wav":
            raise VoiceCloneError(
                "当前环境未安装 ffmpeg，仅支持上传 WAV 文件",
                "TTS_CLONE_FFMPEG_MISSING",
            )
        shutil.copyfile(source, target)
        return

    try:
        result = subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-i",
                str(source),
                "-ac",
                "1",
                "-ar",
                str(CLONE_SAMPLE_RATE),
                "-sample_fmt",
                "s16",
                str(target),
            ],
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        raise VoiceCloneError("音频转码失败，请更换文件后重试", "TTS_CLONE_DECODE_FAILED") from exc

    if result.returncode != 0 or not target.is_file():
        logger.warning("音频归一化失败：%s", result.stderr[:300])
        raise VoiceCloneError("音频解码失败，请确认是有效的人声音频", "TTS_CLONE_DECODE_FAILED")


def _load_wav(path: Path) -> Tuple[np.ndarray, int]:
    """读取 WAV 为单声道 float32。"""

    try:
        import soundfile as sf  # 延迟导入

        data, sr = sf.read(str(path), dtype="float32", always_2d=False)
    except Exception as exc:  # noqa: BLE001
        raise VoiceCloneError("参考音频读取失败", "TTS_CLONE_DECODE_FAILED") from exc

    if data.ndim > 1:
        data = data.mean(axis=1)
    return np.asarray(data, dtype=np.float32), int(sr)


def _resample_to_22050(data: np.ndarray, sr: int) -> np.ndarray:
    """把任意采样率音频转为 22.05kHz。

    说明：
        44.1kHz 使用 2:1 抽取；其他采样率使用线性插值。
    """

    if sr == CLONE_SAMPLE_RATE:
        return data.astype(np.float32)
    if sr == 44100:
        return ((data[0::2] + data[1::2]) * 0.5).astype(np.float32)

    # 线性插值，参考音频用途足够
    if len(data) == 0:
        return data.astype(np.float32)
    n_out = int(round(len(data) * CLONE_SAMPLE_RATE / sr))
    return np.interp(
        np.linspace(0, len(data) - 1, n_out), np.arange(len(data)), data
    ).astype(np.float32)


def _spectrogram(x: np.ndarray) -> np.ndarray:
    """计算 OpenVoice 约定的幅度谱，返回 [513, frames]。"""

    xp = np.pad(x, (_PAD, _PAD), mode="reflect")
    n_frames = 1 + (len(xp) - _N_FFT) // _HOP
    idx = np.arange(_N_FFT)[None, :] + _HOP * np.arange(n_frames)[:, None]
    frames = xp[idx] * _WIN[None, :]
    spec = np.fft.rfft(frames, axis=1)
    return np.sqrt(spec.real**2 + spec.imag**2 + 1e-6).astype(np.float32).T


class OpenVoiceConverter:
    """OpenVoice v2 音色转换器（懒加载 + 串行推理）。"""

    def __init__(self) -> None:
        # 两个 ONNX 会话延迟创建
        self._enc = None
        self._conv = None
        # 推理锁：避免同一进程内并发占用大量内存
        self._lock = threading.RLock()

    def _ensure_loaded(self) -> None:
        """按需加载 ONNX 会话。"""

        if self._enc is not None and self._conv is not None:
            return

        # 延迟导入，未使用克隆时不影响启动
        try:
            import onnxruntime as ort
        except ImportError as exc:
            raise VoiceCloneError(
                "克隆组件缺少 onnxruntime，请安装后端依赖",
                "TTS_CLONE_DEPS_MISSING",
            ) from exc

        assets = get_settings().models_path / "tts" / "openvoice-onnx-v2"
        required = ("tone_extract.onnx", "tone_color.onnx", "tone_config.json")
        missing = [name for name in required if not (assets / name).is_file()]
        if missing:
            raise VoiceCloneError(
                f"克隆组件不完整，缺少 {', '.join(missing)}",
                "TTS_CLONE_MODEL_MISSING",
            )

        started = time.time()
        self._enc = ort.InferenceSession(
            str(assets / "tone_extract.onnx"), providers=["CPUExecutionProvider"]
        )
        self._conv = ort.InferenceSession(
            str(assets / "tone_color.onnx"), providers=["CPUExecutionProvider"]
        )
        logger.info("OpenVoice 转换器加载完成，耗时 %.2fs", time.time() - started)

    def release(self) -> None:
        """释放会话，回收内存。"""

        with self._lock:
            self._enc = None
            self._conv = None
        logger.info("OpenVoice 转换器已释放")

    def embed(self, audio: np.ndarray, sr: int) -> np.ndarray:
        """从参考音频提取音色 embedding。"""

        with self._lock:
            self._ensure_loaded()
            mono = _resample_to_22050(np.asarray(audio, dtype=np.float32), sr)
            spec = _spectrogram(mono)
            result = self._enc.run(None, {"input": spec.T[None]})[0][0]
            return result.reshape(1, 256, 1).astype(np.float32)

    def embed_file(self, path: Path) -> np.ndarray:
        """从文件提取音色 embedding。"""

        data, sr = _load_wav(path)
        return self.embed(data, sr)

    def convert(self, audio: np.ndarray, sr: int, dest_tone: np.ndarray) -> np.ndarray:
        """把 melo 基底音频转换为目标音色。

        参数：
            audio: 基底音频采样。
            sr: 基底采样率。
            dest_tone: 目标音色 embedding。

        返回：
            22.05kHz 单声道 float32 音频。
        """

        with self._lock:
            self._ensure_loaded()

            # 基底重采样到 22.05kHz
            mono = _resample_to_22050(np.asarray(audio, dtype=np.float32), sr)
            spec = _spectrogram(mono)

            # 源音色 embedding（melo 基底，可视为固定）
            src_tone = self._enc.run(None, {"input": spec.T[None]})[0][0]
            src_tone = src_tone.reshape(1, 256, 1).astype(np.float32)

            # 音色转换
            output = self._conv.run(
                None,
                {
                    "audio": spec[None],
                    "audio_length": np.array([spec.shape[1]], np.int64),
                    "src_tone": src_tone,
                    "dest_tone": dest_tone,
                    "tau": np.array([0.3], np.float32),
                },
            )[0][0, 0]

            return np.asarray(output, dtype=np.float32)

    def preview_embedding(self) -> np.ndarray:
        """返回内置示例参考音频的 embedding（用于组件自检）。

        说明：
            如示例文件不存在，抛出业务异常；不参与正式合成。
        """

        sample = get_settings().models_path / "tts" / "openvoice-onnx-v2" / "sample_ref.wav"
        if not sample.is_file():
            raise VoiceCloneError("缺少示例参考音频", "TTS_CLONE_MODEL_MISSING")
        return self.embed_file(sample)


# 全局转换器：全进程共享，避免重复加载 160MB 模型
_CONVERTER = OpenVoiceConverter()


def get_converter() -> OpenVoiceConverter:
    """获取全局 OpenVoice 转换器。"""

    return _CONVERTER


class VoiceCloneStore:
    """克隆档案存储与生命周期管理。"""

    def list_profiles(self) -> List[Dict[str, Any]]:
        """列出全部档案，按创建时间倒序。"""

        profiles: List[Dict[str, Any]] = []
        for item in _clone_root().iterdir():
            if not item.is_dir() or not _PROFILE_ID_RE.match(item.name):
                continue
            meta = _read_meta(item.name)
            if meta:
                profiles.append(meta)
        profiles.sort(key=lambda item: str(item.get("createdAt") or ""), reverse=True)
        return profiles

    def count(self) -> int:
        """返回档案数量。"""

        return len(self.list_profiles())

    def get(self, profile_id: str) -> Dict[str, Any]:
        """读取单个档案，不存在时抛出业务异常。"""

        meta = _read_meta(profile_id)
        if not meta:
            raise VoiceCloneError("克隆音色不存在或已删除", "TTS_CLONE_NOT_FOUND")
        return meta

    def create(
        self,
        filename: str,
        content: bytes,
        name: str,
        consent: bool,
    ) -> Dict[str, Any]:
        """创建克隆档案。

        参数：
            filename: 原始文件名（仅用于判断扩展名）。
            content: 上传字节内容。
            name: 用户填写的音色名称。
            consent: 是否确认拥有声音使用权。

        返回：
            安全元数据（不含本地路径）。

        异常：
            VoiceCloneError: 校验或处理失败。
        """

        if not consent:
            raise VoiceCloneError("请先确认你拥有该声音的使用权", "TTS_CLONE_CONSENT_REQUIRED")
        if not content:
            raise VoiceCloneError("上传文件为空", "TTS_CLONE_EMPTY")
        if len(content) > MAX_UPLOAD_BYTES:
            raise VoiceCloneError("参考音频不能超过 10MB", "TTS_CLONE_TOO_LARGE")
        if self.count() >= MAX_PROFILES:
            raise VoiceCloneError(f"最多保存 {MAX_PROFILES} 个克隆音色", "TTS_CLONE_LIMIT")

        display_name = (name or "").strip()[:40] or "我的克隆音色"
        profile_id = f"vc_{uuid.uuid4().hex[:12]}"
        profile_dir = _safe_profile_dir(profile_id)
        profile_dir.mkdir(parents=True, exist_ok=False)

        # 原始文件放在临时目录，处理完成后删除
        suffix = Path(filename or "upload.wav").suffix.lower()
        if suffix not in (".wav", ".mp3", ".m4a", ".ogg", ".flac"):
            suffix = ".wav"

        temp_dir = Path(tempfile.mkdtemp(prefix="lexitype-clone-"))
        source_path = temp_dir / f"source{suffix}"
        target_path = profile_dir / "ref.wav"

        try:
            source_path.write_bytes(content)
            _normalize_audio(source_path, target_path)

            # 读取归一化后的音频
            data, sr = _load_wav(target_path)
            duration = len(data) / float(sr or 1)
            if duration < MIN_DURATION_SECONDS or duration > MAX_DURATION_SECONDS:
                raise VoiceCloneError(
                    "参考音频需在 1–30 秒之间",
                    "TTS_CLONE_DURATION",
                )

            # 静音检测，避免生成无效音色
            rms = float(np.sqrt(np.mean(np.square(data)))) if len(data) else 0.0
            if rms < MIN_RMS:
                raise VoiceCloneError("参考音频音量过低或为静音", "TTS_CLONE_SILENT")

            # 记录参考音频哈希，用于缓存隔离
            ref_hash = hashlib.sha256(target_path.read_bytes()).hexdigest()

            # 预提取音色 embedding；失败则不创建半成品
            embedding = _CONVERTER.embed(data, sr)
            np.save(profile_dir / "embedding.npy", embedding)

            meta: Dict[str, Any] = {
                "id": profile_id,
                "name": display_name,
                "createdAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "consentAt": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "durationSec": round(duration, 2),
                "sampleRate": sr,
                "refHash": ref_hash,
                "sizeBytes": target_path.stat().st_size,
                "embeddingCached": True,
                "status": "ready",
                "lastUsedAt": None,
            }
            _write_meta(profile_dir, meta)
            logger.info(
                "克隆档案已创建：id=%s duration=%.2fs size=%dB",
                profile_id,
                duration,
                meta["sizeBytes"],
            )
            return meta
        except Exception:
            # 任意失败都清理目录，避免留下半成品
            shutil.rmtree(profile_dir, ignore_errors=True)
            raise
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    def delete(self, profile_id: str) -> bool:
        """删除档案及其参考音频、嵌入。

        返回：
            True 表示删除成功；档案不存在时抛出业务异常。
        """

        profile_dir = _safe_profile_dir(profile_id)
        if not profile_dir.is_dir():
            raise VoiceCloneError("克隆音色不存在或已删除", "TTS_CLONE_NOT_FOUND")

        shutil.rmtree(profile_dir, ignore_errors=False)
        logger.info("克隆档案已删除：id=%s", profile_id)
        return True

    def get_embedding(self, profile_id: str) -> Tuple[np.ndarray, str]:
        """读取档案的音色 embedding 与参考音频哈希。"""

        meta = self.get(profile_id)
        profile_dir = _safe_profile_dir(profile_id)
        embedding_path = profile_dir / "embedding.npy"

        if embedding_path.is_file():
            try:
                embedding = np.load(embedding_path)
                return np.asarray(embedding, dtype=np.float32), str(meta.get("refHash") or "")
            except (OSError, ValueError):
                logger.warning("克隆 embedding 读取失败，尝试重新提取：%s", profile_id)

        # 回退：从参考音频重新提取
        ref_path = profile_dir / "ref.wav"
        if not ref_path.is_file():
            raise VoiceCloneError("参考音频已丢失，请重新上传", "TTS_CLONE_REF_MISSING")

        embedding = _CONVERTER.embed_file(ref_path)
        try:
            np.save(embedding_path, embedding)
        except OSError:
            pass
        return embedding, str(meta.get("refHash") or "")

    def mark_used(self, profile_id: str) -> None:
        """更新最近使用时间，失败时忽略。"""

        try:
            meta = self.get(profile_id)
            meta["lastUsedAt"] = time.strftime("%Y-%m-%dT%H:%M:%S%z")
            _write_meta(_safe_profile_dir(profile_id), meta)
        except Exception:  # noqa: BLE001
            logger.debug("更新克隆音色使用时间失败：%s", profile_id)

    def to_public(self, meta: Dict[str, Any]) -> Dict[str, Any]:
        """把档案转为前端安全结构。"""

        # 过滤内部路径字段，只保留展示所需信息
        return {
            "id": meta.get("id"),
            "name": meta.get("name"),
            "createdAt": meta.get("createdAt"),
            "durationSec": meta.get("durationSec"),
            "sampleRate": meta.get("sampleRate"),
            "status": meta.get("status"),
            "sizeBytes": meta.get("sizeBytes"),
            "lastUsedAt": meta.get("lastUsedAt"),
        }
