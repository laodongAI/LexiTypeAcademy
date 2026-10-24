"""AI 能力后端代理路由（批次D）。

职责：
- 将前端 AI 请求统一转发到 OpenAI 兼容的上游模型服务
- 密钥只保存在后端本地配置或 backend/.env，接口从不回显密钥
- 统一入参校验、错误码、超时策略与分级日志
- 提供非流式（/chat）、流式（/chat/stream）、连通性测试（/test）与配置管理接口

设计约束（详见 docs/design/ai-backend-proxy-v1.md、settings-tabs-and-model-config-v1.md）：
- 预置服务商的上游地址来自后端目录；自定义地址必须通过安全校验，规避 SSRF
- 不在后端重写 prompt，前端仍负责提示词与结果解析
- 日志禁止记录密钥、完整 prompt 与模型输出内容
"""

from __future__ import annotations

import json
import time
import uuid
from typing import Any, AsyncGenerator, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.ai_providers import (
    get_provider,
    list_providers,
    provider_to_dict,
    thinking_disable_params,
)
from app.core.config import Settings
from app.core.logging import get_logger
from app.services.ai.ai_settings_store import (
    build_draft_settings,
    get_effective_settings,
    get_safe_settings,
    save_ai_settings,
)

# 模块级日志器：记录每次调用的规模、耗时、结果与上游状态
logger = get_logger(__name__)

# AI 路由：统一挂载在 /api 前缀下
router = APIRouter(tags=["ai"])

# ---------------------------------------------------------------------------
# 常量定义
# ---------------------------------------------------------------------------

# 单次请求允许的消息条数上限
MAX_MESSAGE_COUNT: int = 64
# 单次请求允许的文本总量上限（字符数）
MAX_PROMPT_CHARS: int = 200000
# 温度参数允许区间
MIN_TEMPERATURE: float = 0.0
MAX_TEMPERATURE: float = 2.0
# 超时毫秒数允许区间下限（避免调用方设置过短导致误判超时）
MIN_TIMEOUT_MS: int = 5000
# 连通性测试使用的极短超时与输出上限
TEST_TIMEOUT_MS: int = 15000
TEST_MAX_TOKENS: int = 8
# requestId 最大长度：仅用于日志串联，超长会被截断
MAX_REQUEST_ID_LEN: int = 64

# 允许的消息角色白名单
ALLOWED_ROLES = {"system", "user", "assistant"}

# 测试注入点：默认 None 表示使用真实网络；单测中替换为 httpx.MockTransport
_HTTP_TRANSPORT: Optional[httpx.AsyncBaseTransport] = None

# 统一错误码常量：与前端 AIErrorCode 一一映射
ERR_CONFIG_MISSING = "AI_CONFIG_MISSING"
ERR_BAD_REQUEST = "AI_BAD_REQUEST"
ERR_RATE_LIMIT = "AI_RATE_LIMIT"
ERR_TIMEOUT = "AI_TIMEOUT"
ERR_UPSTREAM = "AI_UPSTREAM_ERROR"
ERR_INVALID_RESPONSE = "AI_INVALID_RESPONSE"


# ---------------------------------------------------------------------------
# 请求模型
# ---------------------------------------------------------------------------


class ChatMessage(BaseModel):
    """单条对话消息。

    说明：
        role 与 content 使用宽松类型，具体合法性在 _normalize_payload 中校验，
        以便统一返回 400 AI_BAD_REQUEST 而不是 FastAPI 默认的 422。
    """

    # 消息角色：system / user / assistant
    role: str = "user"
    # 消息文本内容
    content: str = ""


class ChatRequest(BaseModel):
    """AI 对话请求体。

    字段名与前端保持一致（camelCase），避免额外的序列化转换。
    """

    # 消息列表：至少 1 条、最多 64 条
    messages: List[ChatMessage] = []
    # 采样温度：为空时使用默认 0.7，超出范围会被截断
    temperature: Optional[float] = None
    # 最大输出 token：为空时使用默认值，超出服务端上限会被截断
    maxTokens: Optional[int] = None
    # 调用方期望的超时毫秒数：会被截断到允许区间
    timeoutMs: Optional[int] = None
    # 调用方传入的请求标识：用于日志串联，可为空
    requestId: Optional[str] = None


class AIProfilePayload(BaseModel):
    """单个服务商配置的保存请求。

    说明：
        apiKey 为空表示保持原有密钥不变；clearApiKey=true 表示显式清除。
    """

    # 服务商标识
    provider: str
    # 自定义服务商的可编辑地址
    baseUrl: Optional[str] = None
    # 模型名称
    model: Optional[str] = None
    # 采样温度
    temperature: Optional[float] = None
    # 最大输出 token
    maxTokens: Optional[int] = None
    # 超时秒数
    timeoutSeconds: Optional[int] = None
    # 新密钥：只写不读
    apiKey: Optional[str] = None
    # 是否清除已保存密钥
    clearApiKey: bool = False


class AISettingsPayload(BaseModel):
    """整份大模型配置的保存请求。"""

    # 当前生效服务商
    activeProvider: Optional[str] = None
    # 需要保存的档案列表
    profiles: List[AIProfilePayload] = []


class AITestPayload(BaseModel):
    """连通性测试草稿。

    说明：
        所有字段可选；缺省时使用当前生效配置。
    """

    # 草稿服务商
    provider: Optional[str] = None
    # 草稿地址（仅自定义服务商生效）
    baseUrl: Optional[str] = None
    # 草稿模型
    model: Optional[str] = None
    # 草稿密钥：为空时沿用已保存密钥
    apiKey: Optional[str] = None
    # 草稿超时秒数
    timeoutSeconds: Optional[int] = None
    # 草稿最大输出
    maxTokens: Optional[int] = None


# ---------------------------------------------------------------------------
# 通用工具
# ---------------------------------------------------------------------------


def _build_error(
    status_code: int,
    code: str,
    message: str,
    upstream_status: Optional[int] = None,
) -> HTTPException:
    """构造统一结构的 HTTP 异常。

    参数：
        status_code: HTTP 状态码。
        code: 业务错误码（如 AI_TIMEOUT）。
        message: 面向用户的中文错误说明。
        upstream_status: 上游返回的状态码，无上游调用时为 None。

    返回：
        HTTPException 实例，detail 为 {"code","message","upstreamStatus"}。
    """
    # 统一错误体：前端只需解析 detail 下的三个字段
    return HTTPException(
        status_code=status_code,
        detail={
            "code": code,
            "message": message,
            "upstreamStatus": upstream_status,
        },
    )


def _ensure_configured(settings: Settings) -> None:
    """校验 AI 配置是否具备最小可用条件。

    参数：
        settings: 全局配置对象。

    异常：
        HTTPException: 503 AI_CONFIG_MISSING，提示用户在 backend/.env 配置密钥。
    """
    # 未配置时直接拒绝，避免把空密钥发往上游造成无意义的 401
    # 免密钥服务商（Ollama / 自定义）只要求地址与模型可用
    spec = get_provider(settings.ai_provider)
    key_required = spec.key_required if spec else True
    has_key = bool(str(settings.ai_api_key or "").strip())
    has_base = bool(str(settings.ai_base_url or "").strip())
    has_model = bool(str(settings.ai_model or "").strip())
    if not (has_base and has_model and (has_key or not key_required)):
        logger.warning(
            "AI 调用被拒绝：配置缺失 provider=%s model=%s base_url=%s",
            settings.ai_provider,
            settings.ai_model,
            settings.ai_base_url,
        )
        raise _build_error(
            503,
            ERR_CONFIG_MISSING,
            "AI 密钥未配置。请在设置页“大模型”中填写 API Key，或在 backend/.env 中配置 AI_API_KEY。",
        )


def _build_client(timeout_seconds: float) -> httpx.AsyncClient:
    """创建带超时配置的异步 HTTP 客户端。

    参数：
        timeout_seconds: 本次请求允许的总超时（秒）。

    返回：
        httpx.AsyncClient 实例；单测中会挂载 MockTransport。
    """
    # 统一超时：连接、读取、写入均受同一个上限约束
    timeout = httpx.Timeout(timeout_seconds)
    # transport 为 None 时 httpx 使用默认网络传输
    return httpx.AsyncClient(timeout=timeout, transport=_HTTP_TRANSPORT)


def _request_headers(settings: Settings) -> Dict[str, str]:
    """构造上游请求头。

    说明：
        返回值包含密钥，仅用于本次请求，禁止写入日志或响应体。
    """
    # Bearer 认证 + JSON 内容类型为 OpenAI 兼容协议的固定要求
    return {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.ai_api_key}",
    }


def _normalize_payload(
    payload: ChatRequest,
    settings: Settings,
) -> Tuple[List[Dict[str, str]], float, int, int, str]:
    """校验并规范化请求参数。

    参数：
        payload: 原始请求体。
        settings: 全局配置对象，用于读取服务端上限。

    返回：
        元组 (messages, temperature, max_tokens, timeout_ms, request_id)。

    异常：
        HTTPException: 400 AI_BAD_REQUEST，参数非法时抛出。
    """
    # 1) 消息条数校验
    if not payload.messages or len(payload.messages) > MAX_MESSAGE_COUNT:
        raise _build_error(
            400,
            ERR_BAD_REQUEST,
            f"messages 条数必须在 1-{MAX_MESSAGE_COUNT} 之间",
        )

    # 2) 逐条校验角色与内容，并累计文本总量
    normalized: List[Dict[str, str]] = []
    total_chars = 0
    for index, item in enumerate(payload.messages):
        role = (item.role or "").strip().lower()
        content = item.content or ""
        if role not in ALLOWED_ROLES:
            raise _build_error(
                400,
                ERR_BAD_REQUEST,
                f"messages[{index}].role 非法，仅支持 system/user/assistant",
            )
        if not content.strip():
            raise _build_error(
                400,
                ERR_BAD_REQUEST,
                f"messages[{index}].content 不能为空",
            )
        total_chars += len(content)
        normalized.append({"role": role, "content": content})

    if total_chars > MAX_PROMPT_CHARS:
        raise _build_error(
            400,
            ERR_BAD_REQUEST,
            f"文本总量超出上限（{total_chars}/{MAX_PROMPT_CHARS} 字符）",
        )

    # 3) 温度截断到 0-2
    temperature = 0.7 if payload.temperature is None else float(payload.temperature)
    temperature = min(max(temperature, MIN_TEMPERATURE), MAX_TEMPERATURE)

    # 4) 输出 token 截断到 1..服务端上限
    default_tokens = min(2000, settings.ai_max_tokens)
    max_tokens = default_tokens if payload.maxTokens is None else int(payload.maxTokens)
    max_tokens = min(max(max_tokens, 1), settings.ai_max_tokens)

    # 5) 超时截断到 5000..配置上限（秒转毫秒）
    server_max_timeout_ms = max(settings.ai_timeout_seconds * 1000, MIN_TIMEOUT_MS)
    timeout_ms = server_max_timeout_ms if payload.timeoutMs is None else int(payload.timeoutMs)
    timeout_ms = min(max(timeout_ms, MIN_TIMEOUT_MS), server_max_timeout_ms)

    # 6) requestId：优先使用调用方值，缺失时生成短 uuid 便于日志串联
    request_id = (payload.requestId or "").strip() or uuid.uuid4().hex[:12]
    request_id = request_id[:MAX_REQUEST_ID_LEN]

    return normalized, temperature, max_tokens, timeout_ms, request_id


def _map_usage(raw_usage: Any) -> Dict[str, int]:
    """把上游 usage 字段映射为前端约定的驼峰结构。

    参数：
        raw_usage: 上游返回的 usage 字典，可能为空。

    返回：
        {"promptTokens","completionTokens","totalTokens"}；缺失字段填 0。
    """
    # 上游字段为下划线风格，这里统一转换为前端驼峰风格
    if not isinstance(raw_usage, dict):
        return {"promptTokens": 0, "completionTokens": 0, "totalTokens": 0}
    return {
        "promptTokens": int(raw_usage.get("prompt_tokens") or 0),
        "completionTokens": int(raw_usage.get("completion_tokens") or 0),
        "totalTokens": int(raw_usage.get("total_tokens") or 0),
    }


def _map_upstream_status(status_code: int) -> Tuple[str, int, str]:
    """把上游 HTTP 状态码映射为业务错误码与提示。

    参数：
        status_code: 上游返回的 HTTP 状态码。

    返回：
        元组 (错误码, 对外 HTTP 状态码, 中文提示)。
    """
    # 限流：保留 429 语义，便于前端提示“稍后再试”
    if status_code == 429:
        return ERR_RATE_LIMIT, 429, "上游模型服务限流，请稍后再试"
    # 401/403：密钥无效或权限不足，对外统一为上游错误，避免泄露细节
    if status_code in (401, 403):
        return ERR_UPSTREAM, 502, "上游模型服务鉴权失败，请检查设置页中的 API Key"
    # 其它 4xx/5xx：统一视为上游错误
    return ERR_UPSTREAM, 502, f"上游模型服务返回异常状态：{status_code}"


def _apply_thinking_control(
    body: Dict[str, Any],
    settings: Settings,
    request_id: str,
) -> None:
    """为支持开关的模型显式关闭思考模式。

    参数：
        body: 待发送给上游的请求体，会被原地修改。
        settings: 生效配置，提供当前服务商与模型。
        request_id: 请求标识，仅用于日志。

    说明：
        思考模型在结构化 JSON 生成时极易把输出预算耗尽，导致正文为空。
        关闭思考后输出预算全部用于正文，既提升成功率也显著降低耗时。
        服务商差异集中在 ai_providers.thinking_disable_params 中维护。
    """

    # 查询该服务商/模型是否需要关闭思考模式
    extra = thinking_disable_params(settings.ai_provider, settings.ai_model)
    if not extra:
        # 非思考模型或未适配服务商：保持原请求体不变
        return

    # 合并额外参数（如 zhipu 的 thinking、qwen 的 enable_thinking）
    body.update(extra)
    logger.debug(
        "已关闭思考模式 request_id=%s provider=%s model=%s",
        request_id,
        settings.ai_provider,
        settings.ai_model,
    )


def _log_call_start(
    request_id: str,
    settings: Settings,
    message_count: int,
    prompt_chars: int,
    stream: bool,
    timeout_ms: int,
) -> None:
    """输出调用开始的日志。

    说明：
        字段用于排查失败率与规模，禁止包含密钥与内容。
    """
    # info 级别：每次 AI 调用都属于关键业务事件
    logger.info(
        "AI 调用开始 request_id=%s provider=%s model=%s message_count=%s prompt_chars=%s stream=%s timeout_ms=%s",
        request_id,
        settings.ai_provider,
        settings.ai_model,
        message_count,
        prompt_chars,
        stream,
        timeout_ms,
    )


def _log_call_end(
    request_id: str,
    settings: Settings,
    stream: bool,
    status: str,
    latency_ms: int,
    usage: Optional[Dict[str, int]] = None,
    upstream_status: Optional[int] = None,
    error_code: Optional[str] = None,
    content_chars: Optional[int] = None,
    reasoning_chars: Optional[int] = None,
    finish_reason: Optional[str] = None,
) -> None:
    """输出调用结束（成功或失败）的日志。

    参数：
        request_id: 请求标识。
        settings: 配置对象，用于记录 provider/model。
        stream: 是否流式调用。
        status: 结果标识，ok / error。
        latency_ms: 端到端耗时（毫秒）。
        usage: token 用量，流式可能为空。
        upstream_status: 上游状态码。
        error_code: 失败时的业务错误码。
        content_chars: 正文输出字符数（只记长度，不记内容）。
        reasoning_chars: 思考内容字符数（只记长度，不记内容）。
        finish_reason: 上游结束原因（stop / length / content_filter 等）。

    说明：
        content_chars=0 且 finish_reason=length 是“思考模型耗尽输出上限”的典型特征，
        记录这三个字段可以在不回显内容的前提下快速定位空响应问题。
    """
    # 失败用 warning，成功用 info，便于按级别筛选
    log_method = logger.info if status == "ok" else logger.warning
    log_method(
        "AI 调用结束 request_id=%s provider=%s model=%s stream=%s status=%s upstream_status=%s latency_ms=%s usage_total=%s "
        "content_chars=%s reasoning_chars=%s finish_reason=%s error_code=%s",
        request_id,
        settings.ai_provider,
        settings.ai_model,
        stream,
        status,
        upstream_status,
        latency_ms,
        (usage or {}).get("totalTokens"),
        content_chars,
        reasoning_chars,
        finish_reason,
        error_code,
    )


def _sse(payload: Dict[str, Any]) -> str:
    """把事件字典编码为一行 SSE 数据。

    参数：
        payload: 事件内容，type 字段决定事件类型。

    返回：
        形如 ``data: {...}\n\n`` 的字符串。
    """
    # ensure_ascii=False 保证中文提示在流中可读
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_chat_result(data: Dict[str, Any]) -> Tuple[str, Optional[str], int]:
    """从上游非流式响应中提取正文、结束原因与思考内容长度。

    参数：
        data: 上游返回的 JSON 字典。

    返回：
        元组 (正文, finish_reason, 思考内容字符数)。

    异常：
        ValueError: 响应结构不符合 OpenAI 兼容协议。
    """
    choices = data.get("choices") or []
    if not choices or not isinstance(choices[0], dict):
        raise ValueError("choices 为空")

    choice = choices[0]
    message = choice.get("message")
    if not isinstance(message, dict):
        raise ValueError("message 结构非法")

    content = message.get("content")
    # 部分供应商对空正文返回 null，这里统一为空字符串
    if content is None:
        content = ""
    if not isinstance(content, str):
        raise ValueError("content 类型非字符串")

    # 思考内容只统计长度，不记录内容
    reasoning = message.get("reasoning_content")
    reasoning_chars = len(reasoning) if isinstance(reasoning, str) else 0

    return content, choice.get("finish_reason"), reasoning_chars


def _empty_content_message(finish_reason: Optional[str], reasoning_chars: int) -> str:
    """生成“模型未生成正文”的可操作提示。

    参数：
        finish_reason: 上游结束原因。
        reasoning_chars: 思考内容字符数。

    返回：
        面向用户的中文说明，避免暴露内部细节。
    """
    # 思考模型把输出预算全部用于 reasoning 时，正文会为空且结束原因为 length
    if finish_reason == "length":
        return (
            "模型未生成正文：思考过程占用了全部输出上限"
            f"（finish_reason=length，思考内容 {reasoning_chars} 字符）。"
            "请在大模型设置中提高该服务商的最大输出 token，或改用非思考模型。"
        )
    return (
        f"模型返回空内容（finish_reason={finish_reason or 'unknown'}），"
        "请重试，或在大模型设置中更换模型。"
    )


async def _post_chat_once(
    settings: Settings,
    body: Dict[str, Any],
    timeout_ms: int,
    request_id: str,
) -> httpx.Response:
    """发起一次非流式上游请求，统一处理超时与网络错误。

    参数：
        settings: 生效配置。
        body: 上游请求体。
        timeout_ms: 超时毫秒数。
        request_id: 请求标识，用于日志。

    返回：
        上游 HTTP 响应。

    异常：
        HTTPException: 504 AI_TIMEOUT 或 502 AI_UPSTREAM_ERROR。
    """
    started_at = time.perf_counter()
    try:
        async with _build_client(timeout_ms / 1000) as client:
            return await client.post(
                settings.ai_chat_url,
                headers=_request_headers(settings),
                json=body,
            )
    except httpx.TimeoutException:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log_call_end(
            request_id, settings, False, "error", latency_ms, error_code=ERR_TIMEOUT
        )
        raise _build_error(504, ERR_TIMEOUT, "上游模型服务响应超时，请稍后重试")
    except httpx.HTTPError as exc:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log_call_end(
            request_id, settings, False, "error", latency_ms, error_code=ERR_UPSTREAM
        )
        logger.error("AI 上游网络错误 request_id=%s error=%s", request_id, type(exc).__name__)
        raise _build_error(502, ERR_UPSTREAM, "无法连接上游模型服务，请检查网络与 AI_BASE_URL")


async def _request_chat(
    settings: Settings,
    body: Dict[str, Any],
    timeout_ms: int,
    request_id: str,
) -> Tuple[Dict[str, Any], httpx.Response, int]:
    """请求上游并完成状态码映射与 JSON 解析。

    参数：
        settings: 生效配置。
        body: 上游请求体。
        timeout_ms: 超时毫秒数。
        request_id: 请求标识。

    返回：
        元组 (响应 JSON, 上游响应对象, 本次耗时毫秒)。

    异常：
        HTTPException: 上游状态异常或响应体无法解析。
    """
    # 记录本次请求耗时：从发起请求到拿到响应
    started_at = time.perf_counter()
    response = await _post_chat_once(settings, body, timeout_ms, request_id)
    latency_ms = int((time.perf_counter() - started_at) * 1000)

    # 上游非 2xx：按状态码映射错误
    if response.status_code != 200:
        code, http_status, message = _map_upstream_status(response.status_code)
        _log_call_end(
            request_id,
            settings,
            False,
            "error",
            latency_ms,
            upstream_status=response.status_code,
            error_code=code,
        )
        raise _build_error(http_status, code, message, response.status_code)

    # 解析响应体
    try:
        data = response.json()
    except Exception:
        _log_call_end(
            request_id,
            settings,
            False,
            "error",
            latency_ms,
            upstream_status=response.status_code,
            error_code=ERR_INVALID_RESPONSE,
        )
        raise _build_error(502, ERR_INVALID_RESPONSE, "上游返回格式无法解析")

    return data, response, latency_ms


# ---------------------------------------------------------------------------
# 接口实现
# ---------------------------------------------------------------------------


@router.get("/ai/providers")
def get_ai_providers() -> Dict[str, Any]:
    """返回大模型服务商目录。

    返回：
        providers 列表，仅含展示与默认配置，不含密钥。
    """

    # 目录唯一维护在 app/core/ai_providers.py，前端只渲染
    return {"providers": [provider_to_dict(item) for item in list_providers()]}


@router.get("/ai/settings")
def get_ai_settings() -> Dict[str, Any]:
    """返回大模型配置的安全摘要（不含密钥）。"""

    # 包含当前生效配置、密钥来源、已保存档案，全部为安全字段
    return get_safe_settings()


@router.put("/ai/settings")
def put_ai_settings(payload: AISettingsPayload) -> Dict[str, Any]:
    """保存大模型配置并立即生效。

    参数：
        payload: 服务商档案与当前生效服务商。

    返回：
        保存后的安全摘要。

    异常：
        HTTPException: 400 AI_BAD_REQUEST，字段非法时返回可读原因。
    """

    try:
        # 保存后直接返回安全摘要，避免前端再次请求
        return save_ai_settings(payload.model_dump())
    except ValueError as exc:
        # 业务校验失败统一转为 400，不暴露堆栈
        logger.warning("AI 配置保存失败：%s", str(exc))
        raise _build_error(400, ERR_BAD_REQUEST, str(exc))


@router.get("/ai/config")
def get_ai_config() -> Dict[str, Any]:
    """返回后端 AI 配置的只读状态（不含密钥）。

    返回：
        configured / provider / model / baseUrl / timeoutSeconds / maxTokens / keySource。
    """
    # 读取叠加本地配置后的生效配置
    settings = get_effective_settings()

    # 明确声明输出字段，杜绝密钥意外回显
    return {
        "configured": settings.ai_configured,
        "provider": settings.ai_provider,
        "model": settings.ai_model,
        "baseUrl": settings.ai_base_url,
        "timeoutSeconds": settings.ai_timeout_seconds,
        "maxTokens": settings.ai_max_tokens,
        "keySource": get_safe_settings().get("keySource", "none"),
    }


@router.post("/ai/chat")
async def chat(payload: ChatRequest) -> Dict[str, Any]:
    """执行一次非流式 AI 对话。

    参数：
        payload: 对话请求体。

    返回：
        requestId / content / usage / provider / model / latencyMs。
    """
    # 读取配置并校验可用性
    settings = get_effective_settings()
    _ensure_configured(settings)

    # 参数校验与规范化
    messages, temperature, max_tokens, timeout_ms, request_id = _normalize_payload(
        payload, settings
    )

    # 统计 prompt 字符数用于日志
    prompt_chars = sum(len(item["content"]) for item in messages)
    _log_call_start(request_id, settings, len(messages), prompt_chars, False, timeout_ms)

    # 组装上游请求体：显式关闭流式
    body = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": False,
    }

    # 思考模型：显式关闭思考，避免输出预算被 reasoning 耗尽
    _apply_thinking_control(body, settings, request_id)

    # 第一次请求：状态码映射、超时与 JSON 解析均由 _request_chat 统一处理
    data, response, latency_ms = await _request_chat(
        settings, body, timeout_ms, request_id
    )

    # 提取正文与结束原因
    try:
        content, finish_reason, reasoning_chars = _extract_chat_result(data)
    except Exception:
        _log_call_end(
            request_id,
            settings,
            False,
            "error",
            latency_ms,
            upstream_status=response.status_code,
            error_code=ERR_INVALID_RESPONSE,
        )
        raise _build_error(502, ERR_INVALID_RESPONSE, "上游返回格式无法解析")

    # 思考模型把输出预算全部用于 reasoning：自动扩大一次输出上限后重试
    if not content.strip() and finish_reason == "length":
        retry_tokens = min(max_tokens * 2, settings.ai_max_tokens)
        if retry_tokens > max_tokens:
            logger.warning(
                "AI 正文为空且被长度截断，扩大输出上限后重试 request_id=%s from=%s to=%s reasoning_chars=%s",
                request_id,
                max_tokens,
                retry_tokens,
                reasoning_chars,
            )
            max_tokens = retry_tokens
            body["max_tokens"] = retry_tokens
            data, response, latency_ms = await _request_chat(
                settings, body, timeout_ms, request_id
            )
            try:
                content, finish_reason, reasoning_chars = _extract_chat_result(data)
            except Exception:
                _log_call_end(
                    request_id,
                    settings,
                    False,
                    "error",
                    latency_ms,
                    upstream_status=response.status_code,
                    error_code=ERR_INVALID_RESPONSE,
                )
                raise _build_error(502, ERR_INVALID_RESPONSE, "上游返回格式无法解析")

    # 仍未生成正文：明确返回错误，避免把 200 + 空字符串传给前端
    if not content.strip():
        message = _empty_content_message(finish_reason, reasoning_chars)
        _log_call_end(
            request_id,
            settings,
            False,
            "error",
            latency_ms,
            upstream_status=response.status_code,
            error_code=ERR_INVALID_RESPONSE,
            content_chars=0,
            reasoning_chars=reasoning_chars,
            finish_reason=finish_reason,
        )
        logger.error(
            "AI 正文为空 request_id=%s finish_reason=%s reasoning_chars=%s usage_total=%s",
            request_id,
            finish_reason,
            reasoning_chars,
            _map_usage(data.get("usage")).get("totalTokens"),
        )
        raise _build_error(
            502, ERR_INVALID_RESPONSE, message, response.status_code
        )

    # 记录成功日志与耗时（只记正文长度，不记内容）
    usage = _map_usage(data.get("usage"))
    _log_call_end(
        request_id,
        settings,
        False,
        "ok",
        latency_ms,
        usage=usage,
        upstream_status=response.status_code,
        content_chars=len(content),
        reasoning_chars=reasoning_chars,
        finish_reason=finish_reason,
    )

    return {
        "requestId": request_id,
        "content": content,
        "usage": usage,
        "provider": settings.ai_provider,
        "model": settings.ai_model,
        "latencyMs": latency_ms,
    }


@router.post("/ai/chat/stream")
async def chat_stream(payload: ChatRequest) -> StreamingResponse:
    """执行一次流式 AI 对话（SSE）。

    参数：
        payload: 对话请求体，字段与非流式一致。

    返回：
        text/event-stream 响应；事件类型为 delta / done / error。
    """
    # 读取配置并校验可用性（流开始前失败仍返回标准 HTTP 错误）
    settings = get_effective_settings()
    _ensure_configured(settings)

    # 参数校验与规范化
    messages, temperature, max_tokens, timeout_ms, request_id = _normalize_payload(
        payload, settings
    )

    # 组装上游请求体：显式开启流式
    body = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "stream": True,
    }

    # 思考模型：显式关闭思考，避免流式场景下长时间无正文输出
    _apply_thinking_control(body, settings, request_id)

    # 统计 prompt 字符数用于日志
    prompt_chars = sum(len(item["content"]) for item in messages)
    _log_call_start(request_id, settings, len(messages), prompt_chars, True, timeout_ms)

    async def event_generator() -> AsyncGenerator[str, None]:
        """逐块读取上游 SSE 并改写为自有事件。"""
        started_at = time.perf_counter()

        try:
            async with _build_client(timeout_ms / 1000) as client:
                async with client.stream(
                    "POST",
                    settings.ai_chat_url,
                    headers=_request_headers(settings),
                    json=body,
                ) as response:
                    # 流开始前上游就返回非 200：用 error 事件收尾
                    if response.status_code != 200:
                        await response.aread()
                        code, _, message = _map_upstream_status(response.status_code)
                        latency_ms = int((time.perf_counter() - started_at) * 1000)
                        _log_call_end(
                            request_id,
                            settings,
                            True,
                            "error",
                            latency_ms,
                            upstream_status=response.status_code,
                            error_code=code,
                        )
                        yield _sse(
                            {
                                "type": "error",
                                "code": code,
                                "message": message,
                                "upstreamStatus": response.status_code,
                            }
                        )
                        return

                    # 逐行解析上游 SSE：只处理 data: 前缀
                    usage: Optional[Dict[str, int]] = None
                    # 正文累计字符数：为 0 说明模型没有生成可用正文
                    content_chars = 0
                    # 思考内容累计字符数：只统计长度，不记录内容
                    reasoning_chars = 0
                    # 上游结束原因：用于区分 length（预算耗尽）与 stop
                    finish_reason: Optional[str] = None
                    async for raw_line in response.aiter_lines():
                        line = raw_line.strip()
                        if not line or not line.startswith("data:"):
                            continue

                        data_str = line[5:].strip()
                        # 上游结束标记
                        if data_str == "[DONE]":
                            break

                        try:
                            chunk = json.loads(data_str)
                        except json.JSONDecodeError:
                            # 单条异常不影响整体流，跳过并记录 debug
                            logger.debug("跳过无法解析的 SSE 片段 request_id=%s", request_id)
                            continue

                        # 部分供应商会在最后一个 chunk 带回 usage
                        if isinstance(chunk.get("usage"), dict):
                            usage = _map_usage(chunk.get("usage"))

                        # 提取增量内容：choices[0].delta.content
                        choices = chunk.get("choices") or []
                        if choices and isinstance(choices[0], dict):
                            finish_reason = choices[0].get("finish_reason") or finish_reason
                            delta = choices[0].get("delta") or {}
                            if isinstance(delta, dict):
                                reasoning = delta.get("reasoning_content")
                                if isinstance(reasoning, str):
                                    reasoning_chars += len(reasoning)
                                content = delta.get("content")
                                if content:
                                    content_chars += len(content)
                                    yield _sse({"type": "delta", "content": content})

                    # 没有正文：思考模型可能把预算全部用于 reasoning
                    if content_chars == 0:
                        message = _empty_content_message(finish_reason, reasoning_chars)
                        latency_ms = int((time.perf_counter() - started_at) * 1000)
                        _log_call_end(
                            request_id,
                            settings,
                            True,
                            "error",
                            latency_ms,
                            usage=usage,
                            upstream_status=200,
                            error_code=ERR_INVALID_RESPONSE,
                            content_chars=0,
                            reasoning_chars=reasoning_chars,
                            finish_reason=finish_reason,
                        )
                        logger.error(
                            "AI 流式正文为空 request_id=%s finish_reason=%s reasoning_chars=%s",
                            request_id,
                            finish_reason,
                            reasoning_chars,
                        )
                        yield _sse(
                            {
                                "type": "error",
                                "code": ERR_INVALID_RESPONSE,
                                "message": message,
                            }
                        )
                        return

                    # 正常结束：发送 done 事件
                    latency_ms = int((time.perf_counter() - started_at) * 1000)
                    final_usage = usage or {
                        "promptTokens": 0,
                        "completionTokens": 0,
                        "totalTokens": 0,
                    }
                    _log_call_end(
                        request_id,
                        settings,
                        True,
                        "ok",
                        latency_ms,
                        usage=final_usage,
                        upstream_status=200,
                        content_chars=content_chars,
                        reasoning_chars=reasoning_chars,
                        finish_reason=finish_reason,
                    )
                    yield _sse(
                        {
                            "type": "done",
                            "usage": final_usage,
                            "latencyMs": latency_ms,
                            "model": settings.ai_model,
                        }
                    )
        except httpx.TimeoutException:
            # 流式读取过程中超时
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            _log_call_end(
                request_id, settings, True, "error", latency_ms, error_code=ERR_TIMEOUT
            )
            yield _sse(
                {"type": "error", "code": ERR_TIMEOUT, "message": "上游模型服务响应超时"}
            )
        except httpx.HTTPError as exc:
            # 流式读取过程中网络中断
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            _log_call_end(
                request_id, settings, True, "error", latency_ms, error_code=ERR_UPSTREAM
            )
            logger.error(
                "AI 流式网络中断 request_id=%s error=%s", request_id, type(exc).__name__
            )
            yield _sse(
                {
                    "type": "error",
                    "code": ERR_UPSTREAM,
                    "message": "上游连接中断，请稍后重试",
                }
            )
        except Exception as exc:  # noqa: BLE001
            # 兜底：任何未预期异常都以 error 事件收尾，避免客户端挂起
            latency_ms = int((time.perf_counter() - started_at) * 1000)
            _log_call_end(
                request_id, settings, True, "error", latency_ms, error_code=ERR_UPSTREAM
            )
            logger.error(
                "AI 流式处理异常 request_id=%s error=%s", request_id, type(exc).__name__
            )
            yield _sse(
                {
                    "type": "error",
                    "code": ERR_UPSTREAM,
                    "message": "AI 流式处理异常，请稍后重试",
                }
            )

    # 关闭代理缓冲，保证逐块推送到达浏览器
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/ai/test")
async def test_connection(payload: Optional[AITestPayload] = None) -> Dict[str, Any]:
    """用最小请求验证上游连通性。

    参数：
        payload: 可选草稿配置；为空时测试当前生效配置。

    返回：
        ok / model / latencyMs；失败时按统一错误体返回。
    """
    # 草稿测试允许保存前验证；密钥只在本次请求内存中使用
    try:
        if payload is None:
            settings = get_effective_settings()
        else:
            settings = build_draft_settings(payload.model_dump(exclude_none=True))
    except ValueError as exc:
        raise _build_error(400, ERR_BAD_REQUEST, str(exc))

    # 读取配置并校验可用性
    _ensure_configured(settings)

    # 使用固定的最小输出与短超时，降低测试成本
    request_id = uuid.uuid4().hex[:12]
    messages = [{"role": "user", "content": "Hello"}]
    _log_call_start(request_id, settings, 1, len(messages[0]["content"]), False, TEST_TIMEOUT_MS)

    body = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": 0.0,
        "max_tokens": TEST_MAX_TOKENS,
        "stream": False,
    }

    started_at = time.perf_counter()
    try:
        async with _build_client(TEST_TIMEOUT_MS / 1000) as client:
            response = await client.post(
                settings.ai_chat_url,
                headers=_request_headers(settings),
                json=body,
            )
    except httpx.TimeoutException:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log_call_end(
            request_id, settings, False, "error", latency_ms, error_code=ERR_TIMEOUT
        )
        raise _build_error(504, ERR_TIMEOUT, "连通性测试超时，请检查网络或 AI_BASE_URL")
    except httpx.HTTPError as exc:
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log_call_end(
            request_id, settings, False, "error", latency_ms, error_code=ERR_UPSTREAM
        )
        logger.error("AI 连通性测试网络错误 error=%s", type(exc).__name__)
        raise _build_error(502, ERR_UPSTREAM, "无法连接上游模型服务")

    if response.status_code != 200:
        code, http_status, message = _map_upstream_status(response.status_code)
        latency_ms = int((time.perf_counter() - started_at) * 1000)
        _log_call_end(
            request_id,
            settings,
            False,
            "error",
            latency_ms,
            upstream_status=response.status_code,
            error_code=code,
        )
        raise _build_error(http_status, code, message, response.status_code)

    latency_ms = int((time.perf_counter() - started_at) * 1000)
    _log_call_end(
        request_id,
        settings,
        False,
        "ok",
        latency_ms,
        upstream_status=response.status_code,
    )

    return {"ok": True, "model": settings.ai_model, "latencyMs": latency_ms}
