"""TTS 路由（多引擎 + OpenVoice v2 音色克隆）。

职责：
- 暴露与前端契约一致的语音合成接口（支持按引擎 + 音色合成）
- 提供引擎列表、音色列表、健康检查，便于前端做能力探测
- 提供克隆参考音频的上传、列表、删除接口
- 挂载合成音频的静态访问路径由 main.py 统一完成（/api/tts/audio/*）

说明：
    所有业务失败均以 HTTP 200 + {success: false, error, code} 返回，
    与前端 ttsApiService 的错误处理逻辑保持兼容，避免前端额外处理 4xx/5xx。
"""

from __future__ import annotations

from typing import Any, Dict, Optional, Union

from fastapi import APIRouter, File, Form, UploadFile
from pydantic import BaseModel, Field

from app.core.logging import get_logger
from app.services.voice import get_tts_service
from app.services.voice.voice_clone_service import VoiceCloneError, VoiceCloneStore

# 模块级日志器：记录请求规模、耗时与结果
logger = get_logger(__name__)

# 路由前缀：与前端 baseURL + /api/tts/* 对齐
router = APIRouter(prefix="/tts", tags=["tts"])

# 克隆档案存储：无状态，可安全复用单例
_clone_store = VoiceCloneStore()


class TTSGenerateRequest(BaseModel):
    """语音合成请求体。

    字段与前端 TTSRequest 保持一致，额外容忍 voice 为数字形态。
    """

    # 待合成文本（必填）
    text: str = Field(..., description="待合成文本")
    # 语言标识：en / zh / en-US / zh-CN
    language: str = Field(default="en", description="语言标识")
    # 音色：字符串或数字（说话人 ID / engineId:speakerId / clone:profileId）
    voice: Optional[Union[str, int]] = Field(default=None, description="音色 / 说话人 ID")
    # 显式引擎标识：为空时由 voice 前缀或后端默认配置推导
    engine: Optional[str] = Field(default=None, description="TTS 引擎标识")
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
        "收到 TTS 请求：chars=%s，engine=%s，language=%s，voice=%s，rate=%s，format=%s",
        len(payload.text or ""),
        payload.engine,
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
        engine=payload.engine,
        rate=payload.rate,
        pitch=payload.pitch,
        fmt=payload.format,
    )


@router.get("/engines")
def list_engines() -> Dict[str, Any]:
    """返回全部 TTS 引擎及其可用状态（不触发模型加载）。

    返回：
        {success: true, engines: [...]}；engines 含许可证、语种、音色数、supportsClone。
    """
    return get_tts_service().list_engines_payload()


@router.get("/voices")
def list_voices(engine: Optional[str] = None) -> Dict[str, Any]:
    """返回指定引擎的音色列表。

    参数：
        engine: 引擎标识；为空时使用后端默认引擎。

    返回：
        含引擎信息与音色数组的字典；克隆引擎返回档案列表。
    """
    return get_tts_service().list_voices(engine)


@router.post("/unload")
def unload_engine() -> Dict[str, Any]:
    """释放当前驻留引擎与克隆转换器，回收内存。

    返回：
        {success: true, message}。
    """
    return get_tts_service().unload()


@router.get("/clone/refs")
def list_clone_profiles() -> Dict[str, Any]:
    """列出克隆档案（不含本地路径与音频内容）。

    返回：
        {success: true, profiles: [...], max: 5, used: n}。
    """
    profiles = _clone_store.list_profiles()
    return {
        "success": True,
        "profiles": [_clone_store.to_public(item) for item in profiles],
        "used": len(profiles),
        "max": 5,
    }


@router.post("/clone/refs")
async def create_clone_profile(
    file: UploadFile = File(..., description="参考音频文件"),
    name: str = Form(default="我的克隆音色", description="音色名称"),
    consent: bool = Form(default=False, description="是否确认拥有声音使用权"),
) -> Dict[str, Any]:
    """上传参考音频并创建克隆档案。

    参数：
        file: multipart 上传的音频文件。
        name: 用户填写的音色名称。
        consent: 是否确认拥有该声音的使用权（必须为 true）。

    返回：
        成功：{success: true, profile: {...}}，profile 为安全元数据。
        失败：{success: false, error, code}。
    """
    logger.info("收到克隆上传请求：filename=%s，name=%s，consent=%s", file.filename, name, consent)

    try:
        # 一次性读入内存：文件上限 10MB，服务层会再次校验大小
        content = await file.read()
        meta = _clone_store.create(
            filename=file.filename or "upload.wav",
            content=content,
            name=name,
            consent=consent,
        )
    except VoiceCloneError as exc:
        # 业务失败统一返回 200 + 错误码，便于前端按 code 分支提示
        logger.warning("克隆上传失败：code=%s，message=%s", exc.code, exc.message)
        return {"success": False, "error": exc.message, "code": exc.code}
    except Exception as exc:  # noqa: BLE001
        logger.error("克隆上传异常：%s", exc, exc_info=True)
        return {"success": False, "error": f"克隆失败：{exc}", "code": "TTS_CLONE_FAILED"}

    return {"success": True, "profile": _clone_store.to_public(meta)}


@router.delete("/clone/refs/{profile_id}")
def delete_clone_profile(profile_id: str) -> Dict[str, Any]:
    """删除克隆档案及其参考音频与嵌入文件。

    参数：
        profile_id: 档案标识（形如 vc_xxxxxxxx）。

    返回：
        成功：{success: true}；失败：{success: false, error, code}。
    """
    try:
        _clone_store.delete(profile_id)
    except VoiceCloneError as exc:
        logger.warning("删除克隆档案失败：id=%s，code=%s", profile_id, exc.code)
        return {"success": False, "error": exc.message, "code": exc.code}
    except OSError as exc:
        logger.error("删除克隆档案出错：id=%s，error=%s", profile_id, exc)
        return {"success": False, "error": f"删除失败：{exc}", "code": "TTS_CLONE_DELETE_FAILED"}

    return {"success": True, "id": profile_id}


@router.get("/health")
def tts_health() -> Dict[str, Any]:
    """返回 TTS 服务健康状态。

    返回：
        当前已加载引擎、引擎总数、可用数量、采样率与克隆档案数等信息。
    """
    return get_tts_service().health()
