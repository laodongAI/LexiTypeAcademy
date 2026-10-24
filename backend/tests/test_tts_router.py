"""TTS 路由契约测试（批次G / G2）。

覆盖范围：
- 引擎与音色列表接口返回结构
- 克隆上传缺少授权时返回业务失败
- 删除不存在的克隆档案返回业务失败

说明：
    不触发真实模型加载，避免测试耗时与内存占用。
"""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

# 复用应用实例，避免重复启动
client = TestClient(app)


def test_engines_contract() -> None:
    """引擎列表应返回 success 与 engines 数组。"""

    response = client.get("/api/tts/engines")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert isinstance(data["engines"], list)
    assert {item["id"] for item in data["engines"]}.issuperset({"melo", "openvoice"})


def test_voices_contract() -> None:
    """音色列表应返回引擎信息与 voices 数组。"""

    response = client.get("/api/tts/voices", params={"engine": "aishell3"})
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["engine"] == "aishell3"
    assert isinstance(data["voices"], list)


def test_clone_requires_consent() -> None:
    """未勾选授权时上传必须被拒绝。"""

    response = client.post(
        "/api/tts/clone/refs",
        files={"file": ("ref.wav", b"RIFF0000WAVE", "audio/wav")},
        data={"name": "测试", "consent": "false"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data.get("code")


def test_delete_missing_clone_profile() -> None:
    """删除不存在的档案返回业务失败而不是 500。"""

    response = client.delete("/api/tts/clone/refs/vc_00000000")
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is False
    assert data.get("code")
