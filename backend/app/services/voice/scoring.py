"""发音评分（简化实现）。

职责：
- 基于 ASR 识别文本与参考文本的相似度，给出 0-100 的综合评分
- 输出与前端契约一致的五项评分：overall / accuracy / fluency / completeness / pronunciation

说明（重要）：
    这是“文本相似度”级别的简化评分，不进行音素级强制对齐（forced alignment），
    也无法识别具体音素发音错误。分数反映的是“说得像不像参考文本”，
    不是专业发音评测。后续若接入声学置信度或音素模型，可替换本模块实现。
"""

from __future__ import annotations

import difflib
import re
from typing import Dict, List, Optional

from app.core.logging import get_logger

# 模块级日志器
logger = get_logger(__name__)

# 标点与空白：中英文常用标点，比较前统一剔除
_PUNCTUATION_PATTERN = re.compile(
    r"[\s,\.\?!;:'\"“”‘’、。，？！；：（）()\[\]【】《》…—\-~`]+"
)
# 中文字符范围（含扩展 A 区），用于判断是否按“字”切分
_CHINESE_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff]")

# 期望语速：英文按“词/秒”，中文按“字/秒”
EXPECTED_RATE_EN: float = 2.5
EXPECTED_RATE_ZH: float = 4.5


def normalize_text(text: str) -> str:
    """规范化文本：小写化并剔除标点与多余空白。

    参数：
        text: 原始文本（可能是识别结果或参考文本）。

    返回：
        仅保留字母、数字与汉字的紧凑文本。
    """
    # 先转小写，再剔除标点与空白，便于跨语言比较
    return _PUNCTUATION_PATTERN.sub("", (text or "").lower())


def tokenize(text: str, language: str) -> List[str]:
    """按语言切分比较单元。

    参数：
        text: 已规范化的文本。
        language: en / zh / auto 等语言标识。

    返回：
        英文返回单词列表；中文返回单字列表；混合文本英文按词、中文按字。

    说明：
        中英混读场景下按字符分类切分，避免整段中文被当成一个“词”。
    """
    # 英文：按空白分词（规范化后已无空白，改按连续字母数字切分）
    if language.startswith("en"):
        return re.findall(r"[a-z0-9']+", text)

    # 中文或自动：逐字符扫描，英文串合并为词，汉字逐字
    if language.startswith("zh") or language == "auto":
        tokens: List[str] = []
        # 当前累积的英文单词缓冲
        buffer: List[str] = []
        for char in text:
            if _CHINESE_PATTERN.match(char):
                # 遇到汉字先冲掉英文缓冲
                if buffer:
                    tokens.append("".join(buffer))
                    buffer.clear()
                tokens.append(char)
            else:
                buffer.append(char)
        # 收尾：剩余英文缓冲入列
        if buffer:
            tokens.append("".join(buffer))
        return [token for token in tokens if token]

    # 其他语言退化为按空白切分
    return [token for token in text.split() if token]


def _clamp_score(value: float, lower: float = 0.0, upper: float = 100.0) -> int:
    """将浮点评分裁剪到 [lower, upper] 并四舍五入为整数。"""
    # 先裁剪再取整，保证返回值永远落在契约范围内
    return int(round(min(max(value, lower), upper)))


def score_pronunciation(
    recognized: str,
    reference: str,
    language: str,
    confidence: Optional[float] = None,
    duration: Optional[float] = None,
) -> Dict[str, int]:
    """计算发音评分。

    参数：
        recognized: ASR 识别出的文本。
        reference: 参考文本（用户应读内容）。
        language: 语言标识，用于选择切分与语速基准。
        confidence: ASR 置信度 0-1，可为空。
        duration: 音频时长（秒），可为空。

    返回：
        含 overall / accuracy / fluency / completeness / pronunciation 的字典（0-100 整数）。
    """
    # 双方规范化后按语言切分为比较单元
    norm_rec = normalize_text(recognized)
    norm_ref = normalize_text(reference)
    rec_tokens = tokenize(norm_rec, language)
    ref_tokens = tokenize(norm_ref, language)

    # 参考文本为空时无法评分，返回全零并记录告警
    if not ref_tokens:
        logger.warning("参考文本为空，无法评分：language=%s", language)
        return {
            "overall": 0,
            "accuracy": 0,
            "fluency": 0,
            "completeness": 0,
            "pronunciation": 0,
        }

    # ---------- 准确度：序列相似度 ----------
    # SequenceMatcher 基于最长公共子序列，对漏读/多读都敏感
    matcher = difflib.SequenceMatcher(None, ref_tokens, rec_tokens)
    accuracy = matcher.ratio() * 100.0

    # ---------- 完整度：识别单元数与参考单元数之比 ----------
    # 多读不额外加分，超过 100% 按满分处理
    completeness = min(len(rec_tokens) / len(ref_tokens), 1.0) * 100.0

    # ---------- 流畅度：语速偏离度 ----------
    fluency = _score_fluency(norm_ref, language, duration)

    # ---------- 发音：准确度与置信度的加权 ----------
    # 置信度缺失时以 0.9 作为中性先验，避免因缺字段把分数压得过低
    confidence_value = confidence if confidence is not None else 0.9
    pronunciation = accuracy * 0.6 + confidence_value * 100.0 * 0.4

    # ---------- 综合分：四项加权 ----------
    overall = (
        accuracy * 0.40
        + fluency * 0.20
        + completeness * 0.20
        + pronunciation * 0.20
    )

    result = {
        "overall": _clamp_score(overall),
        "accuracy": _clamp_score(accuracy),
        "fluency": _clamp_score(fluency),
        "completeness": _clamp_score(completeness),
        "pronunciation": _clamp_score(pronunciation),
    }

    logger.debug(
        "发音评分完成：ref_tokens=%s，rec_tokens=%s，score=%s",
        len(ref_tokens),
        len(rec_tokens),
        result,
    )
    return result


def _score_fluency(
    normalized_reference: str, language: str, duration: Optional[float]
) -> float:
    """按语速偏离度估算流畅度。

    参数：
        normalized_reference: 已规范化的参考文本。
        language: 语言标识。
        duration: 音频时长（秒）。

    返回：
        0-100 的流畅度分数。

    说明：
        语速过快或过慢都会扣分：偏离 100% 时扣 60 分。
        缺少时长信息时返回中性分 85。
    """
    # 缺少时长或时长异常时不评判语速
    if not duration or duration <= 0.5:
        return 85.0

    # 统计参考文本的“有效发音单元”数量
    units = (
        len(re.findall(r"[a-z0-9']+", normalized_reference))
        if language.startswith("en")
        else len(_CHINESE_PATTERN.findall(normalized_reference))
    )

    # 没有可统计单元时返回中性分
    if units == 0:
        return 85.0

    # 实际语速（单元/秒）
    actual_rate = units / duration
    # 期望语速
    expected_rate = EXPECTED_RATE_EN if language.startswith("en") else EXPECTED_RATE_ZH
    # 相对偏离度
    deviation = abs(actual_rate - expected_rate) / expected_rate

    # 偏离 100% 扣 60 分，最低保留 40 分
    return max(100.0 - deviation * 60.0, 40.0)
