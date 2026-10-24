"""AI 代理路由单元测试（批次D）。

覆盖范围：
- 未配置密钥时的状态查询与 503 拒绝
- 非流式成功、上游 401、上游 429、上游超时
- 流式成功、流式中途断开
- 超限入参 400

实现方式：
    通过 httpx.MockTransport 模拟上游，不依赖真实密钥与网络。
"""

from __future__ import annotations

import json
from types import SimpleNamespace
from typing import Any, Dict, List

import httpx
import pytest
from fastapi.testclient import TestClient

from app.api.routers import ai as ai_router
from app.main import app

# 测试用上游地址：真实请求不会发出，全部由 MockTransport 拦截
TEST_BASE_URL = "http://upstream.test/v1"


def _make_settings(**overrides: Any) -> SimpleNamespace:
    """构造可注入的配置对象。

    参数：
        overrides: 需要覆盖的配置项，如 ai_api_key="test-key"。

    返回：
        具备 AI 路由所需字段的轻量配置对象。

    说明：
        使用 SimpleNamespace 而非真实 Settings，避免读取 .env 造成测试耦合。
    """
    # 基础配置：默认视为已配置
    values: Dict[str, Any] = {
        "ai_provider": "qwen",
        "ai_base_url": TEST_BASE_URL,
        "ai_api_key": "test-key",
        "ai_model": "qwen-plus",
        "ai_timeout_seconds": 120,
        "ai_max_tokens": 8000,
    }
    values.update(overrides)

    # 派生属性：与 Settings 中的同名属性保持一致
    values["ai_chat_url"] = values["ai_base_url"].rstrip("/") + "/chat/completions"
    values["ai_configured"] = bool(
        values["ai_api_key"] and values["ai_base_url"] and values["ai_model"]
    )
    return SimpleNamespace(**values)


def _install(monkeypatch: pytest.MonkeyPatch, settings: SimpleNamespace, handler) -> TestClient:
    """把配置与 Mock 上游注入路由，并返回测试客户端。

    参数：
        monkeypatch: pytest 的补丁工具。
        settings: 待注入的配置对象。
        handler: httpx.MockTransport 使用的请求处理函数。

    返回：
        TestClient 实例。
    """
    # 路由内部通过模块级 get_effective_settings 读取生效配置
    monkeypatch.setattr(ai_router, "get_effective_settings", lambda: settings, raising=False)
    # 兼容旧补丁点：部分用例仍按 get_settings 注入
    monkeypatch.setattr(ai_router, "get_settings", lambda: settings, raising=False)
    # 状态接口的安全摘要同样基于注入配置，避免读取真实本地配置
    monkeypatch.setattr(
        ai_router,
        "get_safe_settings",
        lambda: {
            "configured": bool(settings.ai_configured),
            "provider": settings.ai_provider,
            "model": settings.ai_model,
            "baseUrl": settings.ai_base_url,
            "timeoutSeconds": settings.ai_timeout_seconds,
            "maxTokens": settings.ai_max_tokens,
            "keySource": "env" if settings.ai_api_key else "none",
        },
        raising=False,
    )
    # 替换网络传输层，所有上游请求由 handler 返回
    monkeypatch.setattr(ai_router, "_HTTP_TRANSPORT", httpx.MockTransport(handler))
    return TestClient(app)


def _sse_lines(text: str) -> List[Dict[str, Any]]:
    """解析响应文本中的 SSE data 行。

    参数：
        text: 完整响应体文本。

    返回：
        事件字典列表；忽略空行与非 data 行。
    """
    events: List[Dict[str, Any]] = []
    for line in text.splitlines():
        if not line.startswith("data:"):
            continue
        events.append(json.loads(line[5:].strip()))
    return events


def test_config_and_missing_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """未配置密钥时：状态为 false，调用返回 503。"""
    # 密钥为空视为未配置
    settings = _make_settings(ai_api_key="")
    # 未配置时不应触达上游，handler 直接报错即可
    client = _install(
        monkeypatch,
        settings,
        lambda request: httpx.Response(500, json={"error": {"message": "should not call"}}),
    )

    # 状态接口返回 configured=false，且不含密钥字段
    config_resp = client.get("/api/ai/config")
    assert config_resp.status_code == 200
    config = config_resp.json()
    assert config["configured"] is False
    assert "apiKey" not in config

    # 调用接口应被 503 拒绝，并返回统一错误码
    chat_resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert chat_resp.status_code == 503
    assert chat_resp.json()["detail"]["code"] == "AI_CONFIG_MISSING"


def test_chat_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """非流式成功：内容、usage 与 requestId 映射正确。"""
    settings = _make_settings()
    captured: Dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        """模拟上游成功响应，并记录请求体用于断言。"""
        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content.decode("utf-8"))
        captured["auth"] = request.headers.get("Authorization")
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "OK"}}],
                "usage": {"prompt_tokens": 5, "completion_tokens": 2, "total_tokens": 7},
            },
        )

    client = _install(monkeypatch, settings, handler)

    resp = client.post(
        "/api/ai/chat",
        json={
            "messages": [{"role": "user", "content": "Hello"}],
            "temperature": 3,
            "maxTokens": 99999,
            "requestId": "req-001",
        },
    )

    assert resp.status_code == 200
    data = resp.json()
    assert data["content"] == "OK"
    assert data["usage"] == {"promptTokens": 5, "completionTokens": 2, "totalTokens": 7}
    assert data["requestId"] == "req-001"
    assert data["latencyMs"] >= 0

    # 上游地址由配置拼接，调用方无法指定，避免 SSRF
    assert captured["url"] == f"{TEST_BASE_URL}/chat/completions"
    # 温度截断到 2、maxTokens 截断到服务端上限
    assert captured["body"]["temperature"] == 2.0
    assert captured["body"]["max_tokens"] == 8000
    # 密钥只在请求头中出现，不出现在响应体
    assert captured["auth"] == "Bearer test-key"
    # 非思考模型不应携带思考模式开关参数
    assert "thinking" not in captured["body"]
    assert "enable_thinking" not in captured["body"]


def test_chat_disables_thinking_for_reasoning_models(monkeypatch: pytest.MonkeyPatch) -> None:
    """思考模型：自动关闭思考模式，避免正文被 reasoning 内容耗尽。"""
    settings = _make_settings(
        ai_provider="zhipu",
        ai_model="glm-5.3-flash",
        ai_base_url="https://open.bigmodel.cn/api/paas/v4",
    )
    captured: Dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        """记录上游请求体并返回成功响应。"""
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "OK"}}]})

    client = _install(monkeypatch, settings, handler)

    resp = client.post(
        "/api/ai/chat",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )

    assert resp.status_code == 200
    # 智谱 GLM-4.5+/GLM-5 通过 thinking.type=disabled 关闭思考
    assert captured["body"]["thinking"] == {"type": "disabled"}


def test_chat_upstream_401(monkeypatch: pytest.MonkeyPatch) -> None:
    """上游 401：映射为 502 AI_UPSTREAM_ERROR 并带回 upstreamStatus。"""
    client = _install(
        monkeypatch,
        _make_settings(),
        lambda request: httpx.Response(401, json={"error": {"message": "invalid key"}}),
    )

    resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail["code"] == "AI_UPSTREAM_ERROR"
    assert detail["upstreamStatus"] == 401


def test_chat_upstream_429(monkeypatch: pytest.MonkeyPatch) -> None:
    """上游 429：映射为 429 AI_RATE_LIMIT。"""
    client = _install(
        monkeypatch,
        _make_settings(),
        lambda request: httpx.Response(429, json={"error": {"message": "rate limited"}}),
    )

    resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert resp.status_code == 429
    assert resp.json()["detail"]["code"] == "AI_RATE_LIMIT"


def test_chat_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """上游超时：映射为 504 AI_TIMEOUT。"""

    def handler(request: httpx.Request) -> httpx.Response:
        """模拟读取超时。"""
        raise httpx.ReadTimeout("timeout", request=request)

    client = _install(monkeypatch, _make_settings(), handler)

    resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert resp.status_code == 504
    assert resp.json()["detail"]["code"] == "AI_TIMEOUT"


def test_stream_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """流式成功：事件序列为若干 delta + 一个 done。"""
    settings = _make_settings()

    def handler(request: httpx.Request) -> httpx.Response:
        """返回带有多段增量的 SSE 响应。"""
        payload = (
            'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'
            'data: {"choices":[{"delta":{"content":"lo"}}]}\n\n'
            'data: {"choices":[{"delta":{}}],"usage":{"prompt_tokens":2,"completion_tokens":2,"total_tokens":4}}\n\n'
            "data: [DONE]\n\n"
        )
        return httpx.Response(
            200,
            content=payload.encode("utf-8"),
            headers={"Content-Type": "text/event-stream"},
        )

    client = _install(monkeypatch, settings, handler)

    resp = client.post(
        "/api/ai/chat/stream",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert resp.status_code == 200

    events = _sse_lines(resp.text)
    assert [event["type"] for event in events] == ["delta", "delta", "done"]
    assert events[0]["content"] + events[1]["content"] == "Hello"
    assert events[-1]["usage"]["totalTokens"] == 4


def test_stream_broken_midway(monkeypatch: pytest.MonkeyPatch) -> None:
    """流式中途断开：以 error 事件收尾，不抛未捕获异常。"""

    async def broken_stream():
        """先返回一段正常增量，随后抛出读取错误。"""
        yield b'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'
        raise httpx.ReadError("connection reset")

    def handler(request: httpx.Request) -> httpx.Response:
        """用异步字节流模拟中途断开的上游。"""
        return httpx.Response(200, content=broken_stream())

    client = _install(monkeypatch, _make_settings(), handler)

    resp = client.post(
        "/api/ai/chat/stream",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert resp.status_code == 200

    events = _sse_lines(resp.text)
    # 最后一条必须是 error，且前面已收到部分增量
    assert events[0]["type"] == "delta"
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "AI_UPSTREAM_ERROR"


def test_bad_request(monkeypatch: pytest.MonkeyPatch) -> None:
    """超限入参：返回 400 AI_BAD_REQUEST。"""
    client = _install(
        monkeypatch,
        _make_settings(),
        lambda request: httpx.Response(200, json={"choices": [{"message": {"content": "x"}}]}),
    )

    # 空消息列表
    empty_resp = client.post("/api/ai/chat", json={"messages": []})
    assert empty_resp.status_code == 400
    assert empty_resp.json()["detail"]["code"] == "AI_BAD_REQUEST"

    # 超过 64 条消息
    too_many = [{"role": "user", "content": "hi"} for _ in range(65)]
    many_resp = client.post("/api/ai/chat", json={"messages": too_many})
    assert many_resp.status_code == 400
    assert many_resp.json()["detail"]["code"] == "AI_BAD_REQUEST"

    # 非法角色
    role_resp = client.post(
        "/api/ai/chat", json={"messages": [{"role": "tool", "content": "hi"}]}
    )
    assert role_resp.status_code == 400
    assert role_resp.json()["detail"]["code"] == "AI_BAD_REQUEST"


def test_test_endpoint(monkeypatch: pytest.MonkeyPatch) -> None:
    """连通性测试：返回 ok 与模型信息。"""
    captured: Dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        """记录测试请求体，返回最小成功响应。"""
        captured["body"] = json.loads(request.content.decode("utf-8"))
        return httpx.Response(200, json={"choices": [{"message": {"content": "OK"}}]})

    client = _install(monkeypatch, _make_settings(), handler)

    resp = client.post("/api/ai/test")
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["model"] == "qwen-plus"
    # 测试请求固定使用极小的输出上限
    assert captured["body"]["max_tokens"] == ai_router.TEST_MAX_TOKENS


def test_chat_empty_content_retries_with_larger_budget(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """思考模型耗尽上限导致正文为空时，自动扩大输出预算重试并成功。"""
    # 记录每次请求使用的 max_tokens，用于断言重试发生过
    attempts: List[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        """第一次返回空正文 + length，第二次返回正常正文。"""
        body = json.loads(request.content.decode("utf-8"))
        attempts.append(body["max_tokens"])
        if len(attempts) == 1:
            return httpx.Response(
                200,
                json={
                    "choices": [
                        {
                            "message": {"content": "", "reasoning_content": "长期思考"},
                            "finish_reason": "length",
                        }
                    ],
                    "usage": {"prompt_tokens": 10, "completion_tokens": 2000, "total_tokens": 2010},
                },
            )
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "OK"}, "finish_reason": "stop"}],
                "usage": {"prompt_tokens": 10, "completion_tokens": 3, "total_tokens": 13},
            },
        )

    client = _install(monkeypatch, _make_settings(), handler)

    resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert resp.status_code == 200
    assert resp.json()["content"] == "OK"
    # 默认 2000，重试翻倍到 4000
    assert attempts == [2000, 4000]


def test_chat_empty_content_persists(monkeypatch: pytest.MonkeyPatch) -> None:
    """重试后仍为空正文：返回可读的 502 错误，而不是 200 空字符串。"""
    attempts: List[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        """始终返回空正文 + length。"""
        body = json.loads(request.content.decode("utf-8"))
        attempts.append(body["max_tokens"])
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {"content": "", "reasoning_content": "思考中"},
                        "finish_reason": "length",
                    }
                ],
                "usage": {"prompt_tokens": 10, "completion_tokens": 4000, "total_tokens": 4010},
            },
        )

    # 服务端上限设为 4000，允许一次翻倍重试
    client = _install(monkeypatch, _make_settings(ai_max_tokens=4000), handler)

    resp = client.post("/api/ai/chat", json={"messages": [{"role": "user", "content": "Hi"}]})
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert detail["code"] == "AI_INVALID_RESPONSE"
    assert "最大输出" in detail["message"]
    assert attempts == [2000, 4000]


def test_stream_empty_content(monkeypatch: pytest.MonkeyPatch) -> None:
    """流式响应只有思考内容、没有正文：以 error 事件收尾。"""

    def handler(request: httpx.Request) -> httpx.Response:
        """返回仅含 reasoning_content 的 SSE。"""
        payload = (
            'data: {"choices":[{"delta":{"reasoning_content":"思考"}}]}\n\n'
            'data: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\n'
            "data: [DONE]\n\n"
        )
        return httpx.Response(
            200,
            content=payload.encode("utf-8"),
            headers={"Content-Type": "text/event-stream"},
        )

    client = _install(monkeypatch, _make_settings(), handler)

    resp = client.post(
        "/api/ai/chat/stream",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert resp.status_code == 200
    events = _sse_lines(resp.text)
    assert events[-1]["type"] == "error"
    assert events[-1]["code"] == "AI_INVALID_RESPONSE"
    assert "最大输出" in events[-1]["message"]
