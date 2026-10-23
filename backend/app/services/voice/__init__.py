"""语音服务包。

职责：
- 统一封装本地 TTS（sherpa-onnx OfflineTts）与 ASR（sherpa-onnx OfflineRecognizer）
- 对上层提供与前端契约一致的请求/响应结构
- 集中处理模型懒加载、并发锁、音频转码与缓存

说明：
    本包仅依赖本地模型与 ffmpeg，不访问外部网络，符合本地单机部署约束。
"""

from app.services.voice.asr_service import ASRService, get_asr_service
from app.services.voice.tts_service import TTSService, get_tts_service

# 显式导出，便于路由层统一引用
__all__ = [
    "ASRService",
    "TTSService",
    "get_asr_service",
    "get_tts_service",
]
