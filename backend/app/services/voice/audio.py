"""音频处理工具。

职责：
- 读取/写入 PCM16 单声道或多声道 WAV
- 将 float32 采样序列编码为 WAV 字节（供 TTS 返回 base64）
- 调用 ffmpeg 将浏览器上传的 webm/ogg/mp4 等格式统一转成 16 kHz 单声道 WAV（供 ASR 使用）

说明：
    仅实现本阶段必要的最小能力，避免引入额外音频依赖（如 scipy/librosa）。
"""

from __future__ import annotations

import struct
import subprocess
import wave
from pathlib import Path
from typing import Sequence, Tuple

import numpy as np

from app.core.logging import get_logger

# 模块级日志器
logger = get_logger(__name__)

# WAV 头固定字节数：44 字节（RIFF 头 + fmt 块 + data 块头）
WAV_HEADER_SIZE: int = 44
# PCM16 位深
PCM_BIT_DEPTH: int = 16
# PCM16 的最大量化值，用于 float32 → int16 的归一化换算
PCM16_MAX: float = 32767.0
# 语音识别统一采样率
ASR_SAMPLE_RATE: int = 16000


def _build_wav_header(num_samples: int, sample_rate: int, channels: int) -> bytes:
    """构造标准 PCM16 WAV 文件头。

    参数：
        num_samples: 样本总数（单声道样本数，多声道时为每声道样本数）。
        sample_rate: 采样率（Hz）。
        channels: 声道数。

    返回：
        44 字节的 WAV 头字节串。
    """
    # 每个样本占用字节数：16 位 / 8 = 2 字节
    bytes_per_sample: int = PCM_BIT_DEPTH // 8
    # 数据区总字节数
    data_size: int = num_samples * channels * bytes_per_sample
    # 块对齐：一次采样（所有声道）占用的字节数
    block_align: int = channels * bytes_per_sample
    # 字节率：每秒占用的字节数
    byte_rate: int = sample_rate * block_align
    # 总文件大小 = 头 + 数据；RIFF 块大小不含前 8 字节
    riff_size: int = WAV_HEADER_SIZE - 8 + data_size

    return struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        riff_size,
        b"WAVE",
        b"fmt ",
        16,  # fmt 块长度（PCM 固定 16）
        1,  # 音频格式：1 = PCM
        channels,
        sample_rate,
        byte_rate,
        block_align,
        PCM_BIT_DEPTH,
        b"data",
        data_size,
    )


def samples_to_wav_bytes(
    samples: Sequence[float], sample_rate: int, channels: int = 1
) -> bytes:
    """将 float32 采样序列编码为 WAV 字节。

    参数：
        samples: 取值范围 [-1, 1] 的浮点采样序列。
        sample_rate: 采样率（Hz）。
        channels: 声道数，默认单声道。

    返回：
        完整的 WAV 文件字节内容。

    说明：
        超出 [-1, 1] 的采样会被裁剪，避免 int16 溢出产生爆音。
    """
    # 转为 float32 数组并裁剪到合法范围
    clipped = np.clip(np.asarray(samples, dtype=np.float32), -1.0, 1.0)
    # 量化到 int16
    pcm = (clipped * PCM16_MAX).astype(np.int16)
    # 计算每声道样本数（交错存放时用总样本数除以声道数）
    num_frames: int = pcm.size // channels
    # 组装头 + 数据
    return _build_wav_header(num_frames, sample_rate, channels) + pcm.tobytes()


def write_wav_file(
    path: Path, samples: Sequence[float], sample_rate: int, channels: int = 1
) -> int:
    """将采样序列写入 WAV 文件。

    参数：
        path: 目标文件路径，父目录需已存在。
        samples: 浮点采样序列。
        sample_rate: 采样率（Hz）。
        channels: 声道数。

    返回：
        写入文件的字节数。
    """
    # 一次性构造完整字节内容后落盘，避免多段写入造成文件不完整
    payload = samples_to_wav_bytes(samples, sample_rate, channels)
    path.write_bytes(payload)
    logger.debug("WAV 已写入：%s（%s 字节）", path, len(payload))
    return len(payload)


def read_wav_samples(path: Path) -> Tuple[np.ndarray, int]:
    """读取 PCM16 WAV 并转为单声道 float32 采样。

    参数：
        path: WAV 文件路径。

    返回：
        (采样数组, 采样率)。

    异常：
        ValueError: 非 PCM 编码或位深不是 16 位时抛出。
    """
    with wave.open(str(path), "rb") as handle:
        # 采样率与声道数
        sample_rate: int = handle.getframerate()
        channels: int = handle.getnchannels()
        # 位深（字节数 * 8）
        sample_width: int = handle.getsampwidth()
        # 原始帧数据
        raw: bytes = handle.readframes(handle.getnframes())

    # 当前仅支持 16 位 PCM，其他位深需先转码
    if sample_width != 2:
        raise ValueError(f"仅支持 16 位 PCM WAV，实际位深：{sample_width * 8}")

    # 按小端 int16 解析
    pcm = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / PCM16_MAX

    # 多声道取平均下混为单声道
    if channels > 1:
        pcm = pcm.reshape(-1, channels).mean(axis=1)

    return pcm, sample_rate


def convert_to_wav16k(src: Path, dst: Path, ffmpeg_path: str) -> None:
    """调用 ffmpeg 将任意音频转为 16 kHz 单声道 PCM16 WAV。

    参数：
        src: 源音频路径（webm/ogg/m4a/wav 等）。
        dst: 目标 WAV 路径。
        ffmpeg_path: ffmpeg 可执行文件路径。

    异常：
        RuntimeError: ffmpeg 执行失败或未生成目标文件。
    """
    # -y 覆盖输出；-ac 1 单声道；-ar 16000 统一采样率；-acodec pcm_s16le 16 位 PCM
    command = [
        ffmpeg_path,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        str(src),
        "-ac",
        "1",
        "-ar",
        str(ASR_SAMPLE_RATE),
        "-acodec",
        "pcm_s16le",
        str(dst),
    ]

    logger.debug("执行 ffmpeg 转码：%s", " ".join(command))

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        raise RuntimeError(f"ffmpeg 转码失败：{exc}") from exc

    # 非零退出码视为失败，保留 stderr 便于定位
    if result.returncode != 0:
        error_text = (result.stderr or "").strip()[:500]
        raise RuntimeError(f"ffmpeg 转码失败（{result.returncode}）：{error_text}")

    # 目标文件缺失或为空同样视为失败
    if not dst.exists() or dst.stat().st_size <= WAV_HEADER_SIZE:
        raise RuntimeError("ffmpeg 转码后未生成有效音频文件")
