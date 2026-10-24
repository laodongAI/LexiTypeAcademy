"""大模型本地配置存储与生效配置解析。

职责：
- 把用户在设置页填写的服务商配置保存到 backend/data/ai-settings.json
- 解析“界面配置 > backend/.env > 内置默认”的生效配置
- 对外只提供安全摘要，绝不回显 API Key
- 校验自定义地址，降低 SSRF 与误配置风险

设计约束：
- 密钥只写入后端本地文件，不进入前端存储、URL、日志或接口响应
- 写入采用临时文件 + 原子替换，避免半成品文件
- 读取失败时保留损坏文件副本并回退 .env，保证服务可用
"""

from __future__ import annotations

import ipaddress
import json
import os
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from app.core.ai_providers import AIProviderSpec, get_provider
from app.core.config import Settings, get_settings
from app.core.logging import get_logger

# 模块级日志器
logger = get_logger(__name__)

# 配置文件名：固定放在 backend/data 下，已被 .gitignore 忽略
AI_SETTINGS_FILENAME = "ai-settings.json"

# 配置结构版本：后续字段变更时递增
AI_SETTINGS_SCHEMA_VERSION = 1

# 文件读写锁：单进程内串行化，避免并发保存互相覆盖
_SETTINGS_LOCK = threading.RLock()

# 温度与超时允许区间（与接口层保持一致）
MIN_TEMPERATURE = 0.0
MAX_TEMPERATURE = 2.0
MIN_TIMEOUT_SECONDS = 5
MAX_TIMEOUT_SECONDS = 600


def _settings_path() -> Path:
    """返回配置文件绝对路径，并确保父目录存在。"""

    # data_path 属性会自动创建目录
    return get_settings().data_path / AI_SETTINGS_FILENAME


def _mask_key(key: str) -> str:
    """返回密钥末四位提示。

    说明：
        只用于帮助用户识别“哪把密钥”，不得返回完整密钥。
        长度不足 8 位时完全隐藏，避免泄露短密钥。
    """

    # 去空白后判断长度
    value = (key or "").strip()
    if len(value) < 8:
        return ""
    return value[-4:]


def _default_profile(spec: AIProviderSpec, base: Settings) -> Dict[str, Any]:
    """为新服务商生成默认档案。"""

    # 预置模型优先取第一个，没有则留空等待用户输入
    default_model = spec.models[0] if spec.models else ""
    return {
        "baseUrl": spec.base_url,
        "model": default_model,
        "temperature": 0.7,
        "maxTokens": min(8000, base.ai_max_tokens),
        "timeoutSeconds": min(120, MAX_TIMEOUT_SECONDS),
        "apiKey": "",
        "keyCleared": False,
    }


def _read_raw() -> Dict[str, Any]:
    """读取配置文件。

    返回：
        配置字典；文件不存在、为空或损坏时返回空字典。

    说明：
        损坏文件会改名为 .corrupt-<时间戳>，避免下次继续读坏文件。
    """

    # 配置文件路径
    path = _settings_path()
    if not path.exists():
        return {}

    try:
        # 使用 utf-8 读取，兼容中文模型名
        raw_text = path.read_text(encoding="utf-8")
        if not raw_text.strip():
            return {}
        data = json.loads(raw_text)
        if not isinstance(data, dict):
            raise ValueError("配置根节点不是对象")
        return data
    except Exception as exc:  # noqa: BLE001
        # 备份损坏文件，便于人工排查
        backup = path.with_name(f"{path.name}.corrupt-{int(time.time())}")
        try:
            path.replace(backup)
        except OSError:
            logger.warning("AI 配置损坏且无法备份：%s", type(exc).__name__)
        logger.error("AI 配置读取失败，已回退 .env：%s", type(exc).__name__)
        return {}


def _write_raw(data: Dict[str, Any]) -> None:
    """原子写入配置文件。

    参数：
        data: 待写入的完整配置字典。
    """

    # 确保目录存在
    path = _settings_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    # 临时文件与目标文件同目录，保证 os.replace 原子性
    temp_path = path.with_name(f"{path.name}.tmp-{os.getpid()}")

    try:
        # 序列化时保留中文，便于人工查看
        temp_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        # Windows 下 os.replace 可覆盖已存在文件
        os.replace(temp_path, path)
        # 尽力收紧权限：Windows 上该调用通常无效，但不影响功能
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass
        logger.info("AI 配置已保存：active=%s", data.get("activeProvider"))
    finally:
        # 清理可能残留的临时文件
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


def validate_base_url(value: str, allow_http: bool = False) -> str:
    """校验并规范化上游地址。

    参数：
        value: 用户填写的 base 地址。
        allow_http: 是否允许 http（仅本地回环地址允许）。

    返回：
        去掉尾部斜杠的地址。

    异常：
        ValueError: 地址非法时抛出可读中文原因。
    """

    # 去空白
    url = (value or "").strip()
    if not url:
        raise ValueError("Base URL 不能为空")

    # 只接受 http/https，拒绝 file/ftp 等协议
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Base URL 仅支持 http 或 https")
    if not parsed.hostname:
        raise ValueError("Base URL 缺少主机名")
    if parsed.username or parsed.password:
        raise ValueError("Base URL 不能包含账号或密码")

    # 禁止访问云元数据地址，降低 SSRF 风险
    host = parsed.hostname.lower()
    if host in ("169.254.169.254", "metadata.google.internal"):
        raise ValueError("Base URL 不允许指向云元数据地址")

    # http 仅允许本机回环，其余必须使用 https
    if parsed.scheme == "http":
        is_loopback = host in ("localhost", "127.0.0.1", "::1")
        if not is_loopback and not allow_http:
            raise ValueError("非本机地址必须使用 https")
        if not is_loopback:
            raise ValueError("http 仅允许本机回环地址")

    # 拒绝链路本地地址（169.254.0.0/16）
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_link_local or ip.is_multicast or ip.is_unspecified:
            raise ValueError("Base URL 不允许使用链路本地或保留地址")
    except ValueError as exc:
        # 非 IP 字符串会进入这里，属于正常域名，直接忽略
        if "Base URL" in str(exc):
            raise

    return url.rstrip("/")


def _normalize_profile(
    provider_id: str,
    raw: Dict[str, Any],
    base: Settings,
    existing: Optional[Dict[str, Any]],
) -> Tuple[str, Dict[str, Any]]:
    """校验并规范化单个服务商档案。

    参数：
        provider_id: 服务商标识。
        raw: 前端提交的档案字段。
        base: 全局配置，用于读取上限。
        existing: 已保存档案，用于“空密钥保持不变”。

    返回：
        (provider_id, 规范化档案)。

    异常：
        ValueError: 任一字段非法时抛出。
    """

    # 查找目录，未知服务商仅允许 custom
    spec = get_provider(provider_id)
    if spec is None:
        raise ValueError(f"未知服务商：{provider_id}")

    # 返回的档案以既有值为底，避免未提交字段被清空
    profile = dict(existing or _default_profile(spec, base))

    # base 地址：预置服务商强制使用目录地址；自定义服务商允许用户填写
    if spec.allow_custom_base_url:
        profile["baseUrl"] = validate_base_url(
            str(raw.get("baseUrl") or profile.get("baseUrl") or ""),
            allow_http=True,
        )
    else:
        profile["baseUrl"] = spec.base_url

    # 模型：必填，允许自由输入
    model = str(raw.get("model") if raw.get("model") is not None else profile.get("model") or "").strip()
    if not model:
        raise ValueError("模型名称不能为空")
    profile["model"] = model

    # 温度：0-2
    temperature = raw.get("temperature", profile.get("temperature", 0.7))
    try:
        temperature = float(temperature)
    except (TypeError, ValueError) as exc:
        raise ValueError("温度必须是数字") from exc
    profile["temperature"] = min(max(temperature, MIN_TEMPERATURE), MAX_TEMPERATURE)

    # 最大输出：1..服务端上限
    max_tokens = raw.get("maxTokens", profile.get("maxTokens", 8000))
    try:
        max_tokens = int(max_tokens)
    except (TypeError, ValueError) as exc:
        raise ValueError("最大输出必须是整数") from exc
    profile["maxTokens"] = min(max(max_tokens, 1), base.ai_max_tokens)

    # 超时：5-600 秒
    timeout_seconds = raw.get("timeoutSeconds", profile.get("timeoutSeconds", 120))
    try:
        timeout_seconds = int(timeout_seconds)
    except (TypeError, ValueError) as exc:
        raise ValueError("超时必须是整数") from exc
    profile["timeoutSeconds"] = min(
        max(timeout_seconds, MIN_TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS
    )

    # 密钥：显式清除 > 新值 > 保持原值
    if bool(raw.get("clearApiKey")):
        profile["apiKey"] = ""
        profile["keyCleared"] = True
    else:
        new_key = str(raw.get("apiKey") or "").strip()
        if new_key:
            if len(new_key) > 4096:
                raise ValueError("API Key 长度异常")
            profile["apiKey"] = new_key
            profile["keyCleared"] = False
        else:
            profile.setdefault("apiKey", "")
            profile.setdefault("keyCleared", False)

    return provider_id, profile


def save_ai_settings(payload: Dict[str, Any]) -> Dict[str, Any]:
    """保存服务商档案与当前生效服务商。

    参数：
        payload: 含 activeProvider 与 profiles 列表的字典。

    返回：
        保存后的安全摘要（不含密钥）。

    异常：
        ValueError: 字段非法时抛出。
    """

    # 全局锁：读取-合并-写入必须原子
    with _SETTINGS_LOCK:
        base = get_settings()
        raw = _read_raw()
        profiles: Dict[str, Dict[str, Any]] = dict(raw.get("profiles") or {})

        # 逐个校验并合并提交的档案
        submitted: List[Dict[str, Any]] = list(payload.get("profiles") or [])
        for item in submitted:
            if not isinstance(item, dict):
                raise ValueError("profiles 项必须是对象")
            provider_id = str(item.get("provider") or "").strip()
            if not provider_id:
                raise ValueError("profiles 项缺少 provider")
            _, profile = _normalize_profile(
                provider_id, item, base, profiles.get(provider_id)
            )
            profiles[provider_id] = profile

        # 当前生效服务商：优先使用提交值，其次沿用旧值，最后取第一个档案
        active = str(payload.get("activeProvider") or raw.get("activeProvider") or "").strip()
        if active and active not in profiles:
            # 允许切换到目录内但尚未保存的服务商：自动生成默认档案
            spec = get_provider(active)
            if spec is None:
                raise ValueError(f"未知服务商：{active}")
            profiles[active] = _default_profile(spec, base)
        if not active:
            active = next(iter(profiles), "")

        # 写入完整结构
        data = {
            "schemaVersion": AI_SETTINGS_SCHEMA_VERSION,
            "activeProvider": active,
            "profiles": profiles,
        }
        _write_raw(data)

    # 返回安全摘要，永不包含密钥
    return get_safe_settings()


def _active_profile(
    raw: Dict[str, Any],
) -> Tuple[str, Optional[AIProviderSpec], Optional[Dict[str, Any]]]:
    """解析当前生效服务商及其档案。

    返回：
        (provider_id, spec, profile)；未配置时返回 ("", None, None)。
    """

    # 读取当前生效标识
    active = str(raw.get("activeProvider") or "").strip()
    if not active:
        return "", None, None

    spec = get_provider(active)
    if spec is None:
        logger.warning("AI 配置中的服务商未知：%s", active)
        return "", None, None

    profile = (raw.get("profiles") or {}).get(active)
    if not isinstance(profile, dict):
        return "", spec, None

    return active, spec, profile


def get_effective_settings() -> Settings:
    """返回叠加本地配置后的生效 Settings 副本。

    说明：
        优先级：ai-settings.json 的当前档案 > backend/.env > 内置默认。
        返回的是副本，不会修改全局 lru_cache 单例。
    """

    # 基础配置来自 .env
    base = get_settings()

    with _SETTINGS_LOCK:
        raw = _read_raw()

    active, spec, profile = _active_profile(raw)
    if not profile:
        # 没有本地档案时完全沿用 .env
        return base

    # 地址与模型：档案缺失时回退目录/环境值
    base_url = str(profile.get("baseUrl") or (spec.base_url if spec else "") or base.ai_base_url).strip()
    model = str(profile.get("model") or (spec.models[0] if spec and spec.models else "") or base.ai_model).strip()

    # 密钥来源：显式清除则不再回退 .env
    key = ""
    if bool(profile.get("keyCleared")):
        key = ""
    elif str(profile.get("apiKey") or "").strip():
        key = str(profile.get("apiKey")).strip()
    else:
        key = base.ai_api_key.strip()

    # 数值上限做一次兜底截断
    try:
        max_tokens = int(profile.get("maxTokens") or base.ai_max_tokens)
    except (TypeError, ValueError):
        max_tokens = base.ai_max_tokens
    try:
        timeout_seconds = int(profile.get("timeoutSeconds") or base.ai_timeout_seconds)
    except (TypeError, ValueError):
        timeout_seconds = base.ai_timeout_seconds

    # 生成副本，保留 Settings 的派生属性（ai_chat_url / ai_configured）
    return base.model_copy(
        update={
            "ai_provider": active,
            "ai_base_url": base_url,
            "ai_model": model,
            "ai_api_key": key,
            "ai_max_tokens": min(max(max_tokens, 1), base.ai_max_tokens),
            "ai_timeout_seconds": min(
                max(timeout_seconds, MIN_TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS
            ),
        }
    )


def get_safe_settings() -> Dict[str, Any]:
    """返回可安全暴露给前端的大模型配置摘要。

    返回：
        activeProvider / configured / keySource / profiles 等；不含密钥。
    """

    base = get_settings()
    effective = get_effective_settings()

    with _SETTINGS_LOCK:
        raw = _read_raw()

    active, spec, profile = _active_profile(raw)

    # 判断密钥来源，帮助用户理解“为什么可用/不可用”
    key_source = "none"
    if profile:
        if str(profile.get("apiKey") or "").strip():
            key_source = "file"
        elif bool(profile.get("keyCleared")):
            key_source = "none"
        elif base.ai_api_key.strip():
            key_source = "env"
    elif base.ai_api_key.strip():
        # 完全没有本地配置时，只可能来自 .env
        key_source = "env"

    # 逐个输出安全档案，避免密钥字段透传
    safe_profiles: List[Dict[str, Any]] = []
    for provider_id, item in (raw.get("profiles") or {}).items():
        item_spec = get_provider(provider_id)
        item_key = str(item.get("apiKey") or "").strip()
        if not item_key and not bool(item.get("keyCleared")):
            # 未在本地配置密钥时，可能由 .env 提供
            item_key = base.ai_api_key.strip()
        safe_profiles.append(
            {
                "provider": provider_id,
                "displayName": item_spec.display_name if item_spec else provider_id,
                "baseUrl": str(item.get("baseUrl") or ""),
                "model": str(item.get("model") or ""),
                "temperature": float(item.get("temperature", 0.7)),
                "maxTokens": int(item.get("maxTokens", base.ai_max_tokens)),
                "timeoutSeconds": int(item.get("timeoutSeconds", base.ai_timeout_seconds)),
                "keyConfigured": bool(item_key),
                "keyTail": _mask_key(item_key),
            }
        )

    # 当前生效的档案配置，供表单回填
    active_profile = None
    if profile:
        active_profile = {
            "provider": active,
            "baseUrl": str(profile.get("baseUrl") or ""),
            "model": str(profile.get("model") or ""),
            "temperature": float(profile.get("temperature", 0.7)),
            "maxTokens": int(profile.get("maxTokens", base.ai_max_tokens)),
            "timeoutSeconds": int(profile.get("timeoutSeconds", base.ai_timeout_seconds)),
        }

    # 当前生效服务商的展示名：本地档案优先，否则回退到 .env 中的服务商
    fallback_spec = get_provider(base.ai_provider)
    provider_label = spec.display_name if spec else (fallback_spec.display_name if fallback_spec else effective.ai_provider)

    # 可用性判定：免密钥服务商（如 Ollama / 自定义）只需地址与模型
    active_spec = spec or fallback_spec
    key_required = active_spec.key_required if active_spec else True
    has_key = bool(str(effective.ai_api_key or "").strip())
    configured = bool(
        str(effective.ai_base_url or "").strip()
        and str(effective.ai_model or "").strip()
        and (has_key or not key_required)
    )

    return {
        "activeProvider": active or base.ai_provider,
        "providerLabel": provider_label,
        "configured": configured,
        "keySource": key_source,
        "keyTail": _mask_key(effective.ai_api_key),
        "model": effective.ai_model,
        "baseUrl": effective.ai_base_url,
        "timeoutSeconds": effective.ai_timeout_seconds,
        "maxTokens": effective.ai_max_tokens,
        "activeProfile": active_profile,
        "profiles": safe_profiles,
        "configFile": AI_SETTINGS_FILENAME,
    }


def build_draft_settings(payload: Dict[str, Any]) -> Settings:
    """根据测试草稿构造临时 Settings。

    参数：
        payload: 可选字段 provider / baseUrl / model / apiKey / timeoutSeconds / maxTokens。

    返回：
        用于连通性测试的 Settings 副本。

    说明：
        密钥只用于本次请求，不写文件、不写日志、不回显。
    """

    base = get_effective_settings()

    # 服务商：优先草稿值，否则沿用当前生效值
    provider_id = str(payload.get("provider") or base.ai_provider).strip()
    spec = get_provider(provider_id)
    if spec is None:
        raise ValueError(f"未知服务商：{provider_id}")

    # 地址：预置服务商使用目录地址；custom 允许自定义
    if spec.allow_custom_base_url:
        base_url = validate_base_url(
            str(payload.get("baseUrl") or spec.base_url or ""), allow_http=True
        )
    else:
        base_url = spec.base_url

    # 模型：草稿值 > 当前值 > 目录默认
    model = str(payload.get("model") or base.ai_model or (spec.models[0] if spec.models else "")).strip()
    if not model:
        raise ValueError("模型名称不能为空")

    # 密钥：草稿值优先，为空时沿用当前生效密钥
    api_key = str(payload.get("apiKey") or "").strip() or base.ai_api_key

    # 超时与最大输出：草稿值做边界截断
    try:
        timeout_seconds = int(payload.get("timeoutSeconds") or base.ai_timeout_seconds)
    except (TypeError, ValueError):
        timeout_seconds = base.ai_timeout_seconds
    try:
        max_tokens = int(payload.get("maxTokens") or base.ai_max_tokens)
    except (TypeError, ValueError):
        max_tokens = base.ai_max_tokens

    return base.model_copy(
        update={
            "ai_provider": provider_id,
            "ai_base_url": base_url,
            "ai_model": model,
            "ai_api_key": api_key,
            "ai_timeout_seconds": min(max(timeout_seconds, MIN_TIMEOUT_SECONDS), MAX_TIMEOUT_SECONDS),
            "ai_max_tokens": min(max(max_tokens, 1), base.ai_max_tokens),
        }
    )
