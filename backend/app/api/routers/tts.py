"""TTS 路由。

职责：
- 暴露与前端契约一致的语音合成接口
- 提供音色列表与健康检查，便于前端做能力探测
- 挂载合成音频的静态访问路径（供 <audio> 直接播放）

说明：
    所有业务失败均以 HTTP 200 + {success: false, error, code} 返回，
    与前端 ttsApiService 的错误处理逻辑保持兼容。
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Union

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.services.voice import get_tts_service

# 模块级日志器
logger = get_logger(__name__)

# 路由前缀：与前端 baseURL + /api/tts/* 对齐
router = APIRouter(prefix="/tts", tags=["tts"])


class TTSGenerateRequest(BaseModel):
    """语音合成请求体。

    字段与前端 TTSRequest 保持一致，额外容忍 voice 为数字形态。
    """

    # 待合成文本（必填）
    text: str = Field(..., description="待合成文本")
    # 语言标识：en / zh / en-US / zh-CN
    language: str = Field(default="en", description="语言标识")
    # 音色：字符串或数字（说话人 ID）
    voice: Optional[Union[str, int]] = Field(default=None, description="音色 / 说话人 ID")
    # 语速倍数：0.5-2.0
    rate: Optional[float] = Field(default=1.0, description="语速倍数")
    # 音调倍数：当前引擎不支持，接收后忽略
    pitch: Optional[float] = Field(default=1.0, description="音调倍数（暂不支持）")
    # 输出格式：wav / mp3 / ogg
    format: Optional[str] = Field(default="wav", description="音频格式")


@router.post("/generate")
def generate_speech(payload: TTSGenerateRequest) -> Dict[str, Any]:
    """合成语音。

    参数：
        payload: 合成请求体。

    返回：
        成功时含 base64 音频、时长与播放 URL；失败时含错误码。
    """
    logger.info(
        "收到 TTS 请求：chars=%s，language=%s，voice=%s，rate=%s，format=%s",
        len(payload.text or ""),
        payload.language,
        payload.voice,
        payload.rate,
        payload.format,
    )

    # voice 可能是整数，统一转字符串交给服务层解析
    voice_value = str(payload.voice) if payload.voice is not None else None

    return get_tts_service().generate(
        text=payload.text,
        language=payload.language,
        voice=voice_value,
        rate=payload.rate,
        pitch=payload.pitch,
        fmt=payload.format,
    )


@router.get("/voices")
def list_voices() -> Dict[str, Any]:
    """返回可用音色列表。

    返回：
        含引擎信息与音色数组的字典。
    """
    return get_tts_service().list_voices()


@router.get("/health")
def tts_health() -> Dict[str, Any]:
    """返回 TTS 服务健康状态。

    返回：
        模型是否就绪、是否已加载、采样率等信息。
    """
    return get_tts_service().health()
