"""大模型服务商目录（唯一维护来源）。

职责：
- 维护常用 OpenAI 兼容服务商的展示名称、默认地址、预置模型与文档链接
- 为设置页与大模型配置存储提供统一的目录数据
- 不包含任何密钥，不读取环境变量

说明：
    前端不得复制本目录内容；新增服务商时只修改本文件。
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True)
class AIProviderSpec:
    """单个服务商的静态描述。

    字段说明：
        provider_id: 前端与配置文件使用的稳定标识。
        display_name: 界面展示名称。
        description: 一句话说明，用于卡片副标题。
        base_url: 默认 OpenAI 兼容 base 地址（不含 /chat/completions）。
        models: 预置模型列表，允许用户自由输入其他模型。
        key_required: 是否必须配置 API Key。
        allow_custom_base_url: 是否允许用户修改 base 地址。
        docs_url: 密钥申请或文档链接。
        model_hint: 模型输入框的提示文案。
    """

    # 稳定标识，不可随意修改，否则已保存的配置会失配
    provider_id: str
    # 界面展示名称
    display_name: str
    # 卡片副标题
    description: str
    # 默认上游地址
    base_url: str
    # 预置模型（可编辑）
    models: Tuple[str, ...] = field(default_factory=tuple)
    # 是否必须密钥
    key_required: bool = True
    # 是否允许自定义地址
    allow_custom_base_url: bool = False
    # 文档或密钥申请链接
    docs_url: str = ""
    # 模型输入提示
    model_hint: str = "选择或输入模型名称"


# 服务商目录：顺序即界面展示顺序
_PROVIDERS: Tuple[AIProviderSpec, ...] = (
    AIProviderSpec(
        provider_id="deepseek",
        display_name="DeepSeek",
        description="深度求索，通用对话与推理",
        base_url="https://api.deepseek.com/v1",
        models=("deepseek-chat", "deepseek-reasoner"),
        docs_url="https://platform.deepseek.com/api_keys",
    ),
    AIProviderSpec(
        provider_id="qwen",
        display_name="通义千问",
        description="阿里云百炼 OpenAI 兼容模式",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        models=("qwen-plus", "qwen-turbo", "qwen-max", "qwen-long"),
        docs_url="https://help.aliyun.com/zh/model-studio/getting-started",
    ),
    AIProviderSpec(
        provider_id="zhipu",
        display_name="智谱 GLM",
        description="智谱 AI 开放平台",
        base_url="https://open.bigmodel.cn/api/paas/v4",
        models=("glm-4-plus", "glm-4-air", "glm-4-flash", "glm-4-long"),
        docs_url="https://open.bigmodel.cn/dev/api",
    ),
    AIProviderSpec(
        provider_id="moonshot",
        display_name="月之暗面 Kimi",
        description="Moonshot OpenAI 兼容接口",
        base_url="https://api.moonshot.cn/v1",
        models=("moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"),
        docs_url="https://platform.moonshot.cn/console/api-keys",
    ),
    AIProviderSpec(
        provider_id="openai",
        display_name="OpenAI",
        description="OpenAI 官方接口",
        base_url="https://api.openai.com/v1",
        models=("gpt-4o-mini", "gpt-4o"),
        docs_url="https://platform.openai.com/api-keys",
    ),
    AIProviderSpec(
        provider_id="siliconflow",
        display_name="硅基流动",
        description="聚合多家开源模型",
        base_url="https://api.siliconflow.cn/v1",
        models=(),
        docs_url="https://cloud.siliconflow.cn/account/ak",
        model_hint="输入模型 ID，如 Qwen/Qwen3-8B",
    ),
    AIProviderSpec(
        provider_id="volcengine",
        display_name="火山方舟（豆包）",
        description="字节跳动火山引擎方舟平台",
        base_url="https://ark.cn-beijing.volces.com/api/v3",
        models=(),
        docs_url="https://console.volcengine.com/ark",
        model_hint="输入推理接入点 ID（Endpoint ID）",
    ),
    AIProviderSpec(
        provider_id="ollama",
        display_name="本地 Ollama",
        description="本机运行的 OpenAI 兼容服务",
        base_url="http://127.0.0.1:11434/v1",
        models=(),
        key_required=False,
        allow_custom_base_url=False,
        docs_url="https://ollama.com/",
        model_hint="输入本地模型名，如 qwen2.5:7b",
    ),
    AIProviderSpec(
        provider_id="custom",
        display_name="自定义兼容服务",
        description="任意 OpenAI 兼容地址",
        base_url="",
        models=(),
        key_required=False,
        allow_custom_base_url=True,
        docs_url="",
        model_hint="输入模型名称",
    ),
)

# 以 ID 建立索引，避免每次线性查找
_PROVIDER_MAP: Dict[str, AIProviderSpec] = {
    item.provider_id: item for item in _PROVIDERS
}


def list_providers() -> List[AIProviderSpec]:
    """返回全部服务商描述（保持展示顺序）。"""

    # 直接返回元组转列表，调用方不应修改目录
    return list(_PROVIDERS)


def get_provider(provider_id: str) -> Optional[AIProviderSpec]:
    """按标识查找服务商。

    参数：
        provider_id: 服务商标识。

    返回：
        找到时返回描述对象，否则返回 None。
    """

    # 统一去空白，避免前端多传空格导致匹配失败
    return _PROVIDER_MAP.get((provider_id or "").strip())


def thinking_disable_params(provider_id: str, model: str) -> Dict[str, object]:
    """返回关闭“思考模式”所需的上游额外参数。

    背景：
        GLM-4.5+/GLM-5、Qwen3 等混合推理模型默认会先输出大段思考内容
        （reasoning_content）。在 JSON 结构化生成场景下，思考内容经常
        吃光 max_tokens，导致 finish_reason=length 且正文为空，前端表现为
        “AI 响应为空 / 无法解析 AI 响应”。

    参数：
        provider_id: 服务商标识（如 zhipu / qwen）。
        model: 具体模型名称（可能由用户自由输入）。

    返回：
        需要合并进上游请求体的参数字典；无适配时返回空字典。

    说明：
        仅对确认支持开关的模型返回参数，避免向不支持的服务商传未知字段
        导致上游 400。该函数是唯一维护入口，新增服务商时只改这里。
    """

    # 统一小写，兼容用户输入的大小写差异
    pid = (provider_id or "").strip().lower()
    name = (model or "").strip().lower()

    # 智谱：GLM-4.5 及之后的混合推理模型支持 thinking.type
    if pid == "zhipu" and name.startswith(("glm-4.5", "glm-4.6", "glm-5")):
        return {"thinking": {"type": "disabled"}}

    # 通义千问：Qwen3 系列通过 enable_thinking 控制
    if pid == "qwen" and name.startswith("qwen3"):
        return {"enable_thinking": False}

    # 其它服务商或纯对话模型：不附加任何参数
    return {}


def provider_to_dict(spec: AIProviderSpec) -> Dict[str, object]:
    """把服务商描述转换为接口响应结构。

    参数：
        spec: 服务商描述对象。

    返回：
        可直接 JSON 序列化的字典，字段名为前端约定的 camelCase。
    """

    # 只输出安全静态信息，不含任何密钥
    return {
        "provider": spec.provider_id,
        "displayName": spec.display_name,
        "description": spec.description,
        "baseUrl": spec.base_url,
        "models": list(spec.models),
        "keyRequired": spec.key_required,
        "allowCustomBaseUrl": spec.allow_custom_base_url,
        "docsUrl": spec.docs_url,
        "modelHint": spec.model_hint,
    }
