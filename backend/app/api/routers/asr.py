"""ASR 路由。

职责：
- 暴露语音识别（整段）与分段识别接口，字段与前端多点契约一致
- 上传的音频统一落盘到语音临时目录，识别完成后由服务与路由共同清理
- 业务失败统一返回 HTTP 200 + {success: false, ...}，避免前端重试逻辑吞掉具体原因

说明：
    前端 multipart 字段：audio（文件）、language、referenceText?、enableScore?；
    分段接口额外使用 segmentMode 与 maxSegmentDuration?。
"""

from __future__ import annotations

import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, File, Form, UploadFile

from app.core.config import get_settings
from app.core.logging import get_logger
from app.services.voice import get_asr_service

# 模块级日志器
logger = get_logger(__name__)

# 路由前缀：与前端 baseURL + /api/asr/* 对齐
router = APIRouter(prefix="/asr", tags=["asr"])

# 上传音频大小上限：50 MB（本地单机录音通常远小于此值）
MAX_AUDIO_BYTES: int = 50 * 1024 * 1024


async def _save_upload(file: UploadFile) -> Optional[Path]:
    """将上传音频保存到语音临时目录。

    参数：
        file: FastAPI 上传文件对象。

    返回：
        落盘路径；文件为空或超限时返回 None。
    """
    settings = get_settings()
    # 读取全部内容（本地单机、体积受限，一次性读入内存更简单）
    content = await file.read()

    if not content:
        logger.warning("上传音频为空：filename=%s", file.filename)
        return None

    if len(content) > MAX_AUDIO_BYTES:
        logger.warning("上传音频超过上限：%s 字节", len(content))
        return None

    # 保留原始扩展名，便于 ffmpeg 识别封装格式
    suffix = Path(file.filename or "").suffix or ".webm"
    target = settings.voice_tmp_path / f"upload-{uuid.uuid4().hex}{suffix}"
    target.write_bytes(content)

    logger.info("音频已落盘：%s（%s 字节）", target.name, len(content))
    return target


@router.post("/recognize")
async def recognize(
    audio: UploadFile = File(..., description="音频文件（webm/wav/ogg 等）"),
    language: str = Form("en", description="语言标识"),
    referenceText: Optional[str] = Form(None, description="参考文本，用于评分"),
    enableScore: bool = Form(False, description="是否启用评分"),
) -> Dict[str, Any]:
    """整段语音识别。

    参数：
        audio: 上传音频。
        language: 语言标识。
        referenceText: 参考文本。
        enableScore: 是否返回评分。

    返回：
        识别文本、置信度、逐词信息，可选评分。
    """
    logger.info(
        "收到 ASR 识别请求：filename=%s，language=%s，enableScore=%s，refChars=%s",
        audio.filename,
        language,
        enableScore,
        len(referenceText or ""),
    )

    upload_path = await _save_upload(audio)
    if upload_path is None:
        return {
            "success": False,
            "error": "音频文件为空或超过 50 MB 限制",
            "code": "ASR_INVALID_AUDIO",
        }

    try:
        return get_asr_service().recognize(
            audio_path=upload_path,
            language=language,
            reference_text=referenceText,
            enable_score=enableScore,
        )
    finally:
        # 上传的原始文件用完即删（转码产物由服务内部清理）
        if upload_path.exists():
            upload_path.unlink()


@router.post("/segment")
async def segment(
    audio: UploadFile = File(..., description="音频文件（webm/wav/ogg 等）"),
    language: str = Form("en", description="语言标识"),
    segmentMode: str = Form("sentence", description="分段模式：sentence/paragraph/time"),
    maxSegmentDuration: Optional[float] = Form(None, description="自定义分段时长（秒）"),
) -> Dict[str, Any]:
    """分段识别长音频。

    参数：
        audio: 上传音频。
        language: 语言标识。
        segmentMode: 分段模式。
        maxSegmentDuration: 自定义分段时长。

    返回：
        分段文本数组与拼接后的完整文本。
    """
    logger.info(
        "收到 ASR 分段请求：filename=%s，mode=%s，maxDuration=%s",
        audio.filename,
        segmentMode,
        maxSegmentDuration,
    )

    upload_path = await _save_upload(audio)
    if upload_path is None:
        return {
            "success": False,
            "segments": [],
            "fullText": "",
            "error": "音频文件为空或超过 50 MB 限制",
            "code": "ASR_INVALID_AUDIO",
        }

    try:
        return get_asr_service().segment(
            audio_path=upload_path,
            language=language,
            segment_mode=segmentMode,
            max_segment_duration=maxSegmentDuration,
        )
    finally:
        # 清理上传原始文件
        if upload_path.exists():
            upload_path.unlink()


@router.get("/health")
def asr_health() -> Dict[str, Any]:
    """返回 ASR 服务健康状态。"""
    return get_asr_service().health()
