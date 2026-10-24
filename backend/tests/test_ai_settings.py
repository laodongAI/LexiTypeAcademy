"""大模型服务商目录与本地配置存储单元测试（批次G / G4）。

覆盖范围：
- 服务商目录包含常用服务商与免密钥服务商
- Base URL 安全校验（云元数据、非回环 http、https 正常）
- 保存后安全摘要不含密钥、密钥尾号可用于识别

说明：
    所有写盘操作都重定向到 pytest 的临时目录，不触碰真实 backend/data。
"""

from __future__ import annotations

import pytest

from app.core.ai_providers import get_provider, list_providers
from app.services.ai import ai_settings_store


def test_provider_catalog_contains_common_providers() -> None:
    """目录应包含用户要求的 DeepSeek、千问、智谱，以及本地 Ollama。"""

    ids = {item.provider_id for item in list_providers()}
    assert {"deepseek", "qwen", "zhipu", "ollama", "custom"}.issubset(ids)


def test_ollama_does_not_require_key() -> None:
    """Ollama 本地服务免密钥。"""

    spec = get_provider("ollama")
    assert spec is not None
    assert spec.key_required is False


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data",
        "http://metadata.google.internal/v1",
        "http://example.com/v1",
        "ftp://example.com/v1",
    ],
)
def test_validate_base_url_rejects_unsafe(url: str) -> None:
    """不允许云元数据地址、非回环 http 与非 http(s) 协议。"""

    with pytest.raises(ValueError):
        ai_settings_store.validate_base_url(url)


def test_validate_base_url_allows_https_and_loopback() -> None:
    """https 任意域名与本机回环 http 应通过。"""

    assert ai_settings_store.validate_base_url("https://api.deepseek.com/v1/") == (
        "https://api.deepseek.com/v1"
    )
    assert ai_settings_store.validate_base_url("http://127.0.0.1:11434/v1") == (
        "http://127.0.0.1:11434/v1"
    )


def test_save_settings_returns_safe_summary(monkeypatch: pytest.MonkeyPatch, tmp_path) -> None:
    """保存配置后摘要不含密钥，但能显示密钥尾号与已配置状态。"""

    # 重定向配置文件到临时目录，避免污染真实数据
    config_path = tmp_path / "ai-settings.json"
    monkeypatch.setattr(ai_settings_store, "_settings_path", lambda: config_path)

    summary = ai_settings_store.save_ai_settings(
        {
            "activeProvider": "deepseek",
            "profiles": [
                {
                    "provider": "deepseek",
                    "model": "deepseek-chat",
                    "apiKey": "sk-test-12345678",
                }
            ],
        }
    )

    assert summary["activeProvider"] == "deepseek"
    assert summary["configured"] is True
    assert summary["keyTail"] == "5678"
    # 摘要中严禁出现完整密钥
    assert "apiKey" not in summary
    assert all("apiKey" not in item for item in summary["profiles"])
    assert config_path.is_file()
