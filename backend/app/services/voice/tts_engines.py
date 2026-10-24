"""TTS 引擎与音色目录（唯一维护来源）。

职责：
- 描述本机可用的 TTS 引擎、模型文件、许可证、语种与音色来源
- 在未加载模型时也能返回引擎可用状态与音色列表
- 为音频接口提供 voiceId（engineId:speakerId）解析

设计约束：
- 前端不得复制本目录；新增引擎只修改本文件
- 引擎是否可用由必需文件实际检测决定，不凭配置猜测
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from app.core.config import get_settings


@dataclass(frozen=True)
class TTSEngineSpec:
    """单个 TTS 引擎的静态描述。

    字段说明：
        engine_id: 稳定标识，如 melo / aishell3 / kokoro / matcha / openvoice。
        display_name: 界面展示名称。
        description: 一句话说明。
        engine_type: vits / kokoro / matcha / openvoice。
        model_dir: 相对 backend/models 的目录。
        required_files: 判定可用性的必需文件（相对 model_dir）。
        required_dirs: 判定可用性的必需目录（相对 model_dir）。
        extra_files: 额外必需文件（相对 backend/models）。
        license: 许可证，界面必须展示。
        languages: 支持语种。
        experimental: 是否实验性（默认隐藏）。
        supports_clone: 是否支持上传参考音频克隆音色。
        num_speakers: 音色数量；0 表示从文件读取。
        sample_rate: 输出采样率（加载后以实际值为准）。
        default_voice_id: 默认 voiceId。
        preview_text: 试听文本（按语种）。
    """

    # 稳定标识
    engine_id: str
    # 展示名称
    display_name: str
    # 说明
    description: str
    # 引擎类型
    engine_type: str
    # 模型目录（相对 models）
    model_dir: str
    # 必需文件
    required_files: Tuple[str, ...]
    # 必需目录
    required_dirs: Tuple[str, ...] = ()
    # 相对 models 根目录的额外文件
    extra_files: Tuple[str, ...] = ()
    # 许可证
    license: str = ""
    # 支持语种
    languages: Tuple[str, ...] = ("zh",)
    # 是否实验性
    experimental: bool = False
    # 是否支持克隆
    supports_clone: bool = False
    # 音色数量
    num_speakers: int = 1
    # 采样率
    sample_rate: int = 22050
    # 默认音色
    default_voice_id: str = ""
    # 试听文本
    preview_text: str = "每天坚持朗读，会让发音越来越自然。"


# 引擎目录：顺序即界面展示顺序
_ENGINES: Tuple[TTSEngineSpec, ...] = (
    TTSEngineSpec(
        engine_id="melo",
        display_name="MeloTTS 中英双语",
        description="主引擎，中英混读，音质优先",
        engine_type="vits",
        model_dir="tts/vits-melo-tts-zh_en",
        required_files=("model.onnx", "tokens.txt", "lexicon.txt"),
        required_dirs=("dict",),
        license="MIT",
        languages=("zh", "en"),
        num_speakers=1,
        sample_rate=44100,
        default_voice_id="melo:0",
        preview_text="Reading every day makes a difference.",
    ),
    TTSEngineSpec(
        engine_id="aishell3",
        display_name="AISHELL-3 中文多音色",
        description="174 个中文说话人，音色选择丰富",
        engine_type="vits",
        model_dir="tts/vits-icefall-zh-aishell3",
        required_files=("model.onnx", "tokens.txt", "lexicon.txt", "speakers.txt"),
        license="Apache-2.0",
        languages=("zh",),
        num_speakers=174,
        sample_rate=8000,
        default_voice_id="aishell3:SSB0005",
    ),
    TTSEngineSpec(
        engine_id="kokoro",
        display_name="Kokoro 多语种",
        description="多语种音色，适合英文与拓展语种",
        engine_type="kokoro",
        model_dir="tts/kokoro-int8-multi-lang-v1_1",
        required_files=("model.int8.onnx", "voices.bin", "tokens.txt"),
        required_dirs=("dict", "espeak-ng-data"),
        license="Apache-2.0",
        languages=("zh", "en", "ja"),
        num_speakers=103,
        sample_rate=24000,
        default_voice_id="kokoro:0",
        preview_text="Reading every day makes a difference.",
    ),
    TTSEngineSpec(
        engine_id="matcha",
        display_name="Matcha 中文（非商用）",
        description="低延迟备选，DataBaker-NC 授权",
        engine_type="matcha",
        model_dir="tts/matcha-icefall-zh-baker",
        required_files=("model-steps-3.onnx", "tokens.txt", "lexicon.txt"),
        extra_files=("tts/vocos-22khz-univ.onnx",),
        license="DataBaker-NC",
        languages=("zh",),
        num_speakers=1,
        sample_rate=22050,
        default_voice_id="matcha:0",
    ),
    TTSEngineSpec(
        engine_id="openvoice",
        display_name="OpenVoice v2 音色克隆",
        description="上传参考音频，进行音色迁移（不是完整复刻）",
        engine_type="openvoice",
        model_dir="tts/openvoice-onnx-v2",
        required_files=("tone_extract.onnx", "tone_color.onnx", "tone_config.json"),
        license="MIT",
        languages=("zh", "en"),
        supports_clone=True,
        num_speakers=0,
        sample_rate=22050,
        default_voice_id="",
        preview_text="Reading every day makes a difference.",
    ),
)

# 以 ID 建立索引，避免每次线性查找
_ENGINE_MAP: Dict[str, TTSEngineSpec] = {
    item.engine_id: item for item in _ENGINES
}


def list_engines(include_experimental: bool = False) -> List[TTSEngineSpec]:
    """返回引擎列表。

    参数：
        include_experimental: 是否包含实验性引擎（Q3 决策默认隐藏）。
    """

    # 过滤实验引擎，保持目录顺序
    return [item for item in _ENGINES if include_experimental or not item.experimental]


def get_engine(engine_id: str) -> Optional[TTSEngineSpec]:
    """按标识查找引擎。"""

    # 去空白，兼容前端传入的空格
    return _ENGINE_MAP.get((engine_id or "").strip())


def models_root() -> Path:
    """返回模型根目录绝对路径。"""

    # 统一从配置读取，避免各处硬编码
    return get_settings().models_path


def engine_available(spec: TTSEngineSpec) -> Tuple[bool, str]:
    """检测引擎必需文件是否齐全。

    参数：
        spec: 引擎描述。

    返回：
        (是否可用, 缺失原因)。
    """

    root = models_root()
    model_dir = root / spec.model_dir

    # 目录不存在时直接返回可读原因
    if not model_dir.is_dir():
        return False, f"缺少模型目录 {spec.model_dir}"

    # 逐个检查必需文件
    for name in spec.required_files:
        if not (model_dir / name).is_file():
            return False, f"缺少文件 {name}"
    for name in spec.required_dirs:
        if not (model_dir / name).is_dir():
            return False, f"缺少目录 {name}"
    for name in spec.extra_files:
        if not (root / name).is_file():
            return False, f"缺少文件 {name}"

    return True, ""


def _read_aishell3_speakers(spec: TTSEngineSpec) -> List[str]:
    """读取 aishell3 说话人列表。"""

    speakers_path = models_root() / spec.model_dir / "speakers.txt"
    try:
        # 每行一个 speaker id，忽略空行
        return [line.strip() for line in speakers_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    except OSError:
        return []


def list_voices(engine_id: str, clone_profiles: Optional[List[Dict[str, object]]] = None) -> List[Dict[str, object]]:
    """返回指定引擎的音色列表。

    参数：
        engine_id: 引擎标识。
        clone_profiles: 克隆档案列表；仅 openvoice 使用。

    返回：
        音色字典列表；引擎不存在时为空列表。
    """

    spec = get_engine(engine_id)
    if spec is None:
        return []

    # 克隆引擎的音色来自后端档案
    if spec.supports_clone:
        voices: List[Dict[str, object]] = []
        for item in clone_profiles or []:
            profile_id = str(item.get("id") or "")
            voices.append(
                {
                    "id": f"clone:{profile_id}",
                    "engine": spec.engine_id,
                    "name": str(item.get("name") or "我的克隆音色"),
                    "language": "multi",
                    "tags": ["clone"],
                    "previewText": spec.preview_text,
                    "durationSec": item.get("durationSec"),
                    "createdAt": item.get("createdAt"),
                }
            )
        return voices

    # aishell3 从 speakers.txt 读取真实 ID
    if spec.engine_id == "aishell3":
        speakers = _read_aishell3_speakers(spec)
        return [
            {
                "id": f"aishell3:{speaker}",
                "engine": spec.engine_id,
                "name": f"音色 {index + 1}（{speaker}）",
                "language": "zh",
                "tags": [],
                "previewText": spec.preview_text,
            }
            for index, speaker in enumerate(speakers)
        ]

    # 其余引擎按数量生成中性编号，不推断性别
    count = max(spec.num_speakers, 1)
    voices = []
    for index in range(count):
        if spec.engine_id == "melo":
            name = "默认中英双语"
            voice_id = "melo:0"
            language = "zh/en"
        elif spec.engine_id == "kokoro":
            name = f"Kokoro 音色 {index + 1}"
            voice_id = f"kokoro:{index}"
            language = "multi"
        elif spec.engine_id == "matcha":
            name = "默认中文"
            voice_id = "matcha:0"
            language = "zh"
        else:
            name = f"音色 {index + 1}"
            voice_id = f"{spec.engine_id}:{index}"
            language = "zh"
        voices.append(
            {
                "id": voice_id,
                "engine": spec.engine_id,
                "name": name,
                "language": language,
                "tags": [],
                "previewText": spec.preview_text,
            }
        )
    return voices


def resolve_voice(engine: Optional[str], voice: Optional[str]) -> Tuple[str, str]:
    """解析请求中的引擎与音色。

    参数：
        engine: 请求显式指定的引擎，可为空。
        voice: 请求音色，支持 "engineId:speakerId" 或旧值。

    返回：
        (engine_id, voice_id)。

    说明：
        - 显式 engine 优先
        - voice 前缀等于已知引擎时，以其为准
        - 都没有时使用配置中的默认引擎
    """

    settings = get_settings()
    voice_value = (voice or "").strip()

    # voice 前缀解析
    voice_engine = ""
    if voice_value.startswith("clone:"):
        # 克隆音色固定归属 openvoice
        voice_engine = "openvoice"
    elif ":" in voice_value:
        prefix = voice_value.split(":", 1)[0]
        if get_engine(prefix):
            voice_engine = prefix

    engine_id = (engine or "").strip() or voice_engine or (settings.tts_engine or "melo").strip()
    spec = get_engine(engine_id)
    if spec is None:
        # 未知引擎回退默认，保证旧客户端仍可用
        engine_id = "melo"
        spec = get_engine("melo")

    # 旧值/空值归一化
    if not voice_value or voice_value in ("default", "female", "male"):
        voice_id = spec.default_voice_id or f"{engine_id}:0"
    elif ":" in voice_value and voice_engine:
        voice_id = voice_value
    else:
        voice_id = f"{engine_id}:{voice_value}"

    # 克隆音色必须带 profile 前缀
    if engine_id == "openvoice" and not voice_id.startswith("clone:"):
        if voice_value.startswith("clone:"):
            voice_id = voice_value
        else:
            voice_id = f"clone:{voice_value}"

    return engine_id, voice_id


def speaker_id_from_voice(voice_id: str) -> str:
    """从 voiceId 中提取 speakerId。

    参数：
        voice_id: 形如 "aishell3:SSB0066" 或 "clone:vc_x"。

    返回：
        冒号后的部分；没有冒号时原样返回。
    """

    # 仅拆分一次，避免 speakerId 内含冒号时被误切
    return voice_id.split(":", 1)[1] if ":" in voice_id else voice_id


def engine_to_dict(
    spec: TTSEngineSpec,
    available: bool,
    reason: str,
    loaded: bool,
    voice_count: int,
) -> Dict[str, object]:
    """把引擎描述转换为接口结构。

    参数：
        spec: 引擎描述。
        available: 文件是否齐全。
        reason: 不可用原因。
        loaded: 当前是否已加载。
        voice_count: 音色数量。
    """

    # 只输出界面需要的安全字段，不暴露绝对路径
    return {
        "id": spec.engine_id,
        "displayName": spec.display_name,
        "description": spec.description,
        "engineType": spec.engine_type,
        "available": available,
        "reason": reason,
        "license": spec.license,
        "languages": list(spec.languages),
        "supportsClone": spec.supports_clone,
        "experimental": spec.experimental,
        "defaultVoiceId": spec.default_voice_id or None,
        "voiceCount": voice_count,
        "sampleRate": spec.sample_rate,
        "loaded": loaded,
    }
