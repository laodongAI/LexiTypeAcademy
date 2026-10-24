"""健康检查与诊断日志接口契约测试。"""

from __future__ import annotations

from pathlib import Path
from types import SimpleNamespace

from fastapi.testclient import TestClient

from app.api.routers import health
from app.main import app

client = TestClient(app)


def test_health_contract() -> None:
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert "version" in data
    assert "paths" in data


def test_backend_log_tail_is_bounded_and_redacted(tmp_path: Path, monkeypatch) -> None:
    log_file = tmp_path / "app.log"
    log_file.write_text(
        "line-1\napi_key=top-secret\nAuthorization: Bearer abc.def.ghi\nline-4\n",
        encoding="utf-8",
    )
    fake_settings = SimpleNamespace(log_path=tmp_path, log_file="app.log")
    monkeypatch.setattr(health, "get_settings", lambda: fake_settings)

    response = client.get("/api/diagnostics/backend-logs", params={"limit": 3})
    assert response.status_code == 200
    data = response.json()
    assert data["available"] is True
    assert len(data["lines"]) == 3
    assert "top-secret" not in "\n".join(data["lines"])
    assert "abc.def.ghi" not in "\n".join(data["lines"])
    assert "[REDACTED]" in "\n".join(data["lines"])


def test_backend_log_limit_is_validated() -> None:
    response = client.get("/api/diagnostics/backend-logs", params={"limit": 501})
    assert response.status_code == 422


def test_backend_log_missing_file_returns_unavailable(tmp_path: Path, monkeypatch) -> None:
    fake_settings = SimpleNamespace(log_path=tmp_path, log_file="missing.log")
    monkeypatch.setattr(health, "get_settings", lambda: fake_settings)

    response = client.get("/api/diagnostics/backend-logs")
    assert response.status_code == 200
    assert response.json()["available"] is False
    assert response.json()["lines"] == []
