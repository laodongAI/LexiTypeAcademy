"""TTS 引擎目录与音色解析单元测试（批次G / G2）。

覆盖范围：
- 引擎目录顺序与已知标识
- 未知引擎返回 None
- voiceId 解析：普通音色、克隆音色、旧值归一化
- 说话人编号提取
"""

from __future__ import annotations

from app.core.config import get_settings
from app.services.voice.tts_engines import (
    get_engine,
    list_engines,
    resolve_voice,
    speaker_id_from_voice,
)


def test_engine_catalog_order() -> None:
    """引擎目录应包含 5 个常规引擎且顺序稳定。"""

    # 目录顺序即界面展示顺序，必须保持稳定
    ids = [item.engine_id for item in list_engines()]
    assert ids == ["melo", "aishell3", "kokoro", "matcha", "openvoice"]


def test_engine_lookup_and_spec_fields() -> None:
    """已知引擎可查到，未知引擎返回 None。"""

    assert get_engine("aishell3") is not None
    # 实验性引擎不注册时应返回 None
    assert get_engine("chattts") is None
    assert get_engine("  melo  ") is not None


def test_resolve_voice_with_engine_prefix() -> None:
    """voice 自带引擎前缀时按前缀归属引擎。"""

    engine_id, voice_id = resolve_voice(None, "aishell3:SSB0005")
    assert engine_id == "aishell3"
    assert voice_id == "aishell3:SSB0005"


def test_resolve_voice_for_clone_profile() -> None:
    """clone:<profileId> 固定归属 openvoice 引擎。"""

    engine_id, voice_id = resolve_voice(None, "clone:vc_12345678")
    assert engine_id == "openvoice"
    assert voice_id == "clone:vc_12345678"


def test_resolve_voice_legacy_value() -> None:
    """旧值 default/female/male 归一化为默认引擎默认音色。"""

    default_engine = get_settings().tts_engine or "melo"
    engine_id, voice_id = resolve_voice(None, "female")
    assert engine_id == default_engine
    # 默认音色由目录定义，不能是旧值本身
    assert voice_id != "female"


def test_speaker_id_from_voice() -> None:
    """speakerId 提取只按第一个冒号拆分。"""

    assert speaker_id_from_voice("kokoro:45") == "45"
    assert speaker_id_from_voice("clone:vc_abcdef12") == "vc_abcdef12"
    assert speaker_id_from_voice("plain") == "plain"
