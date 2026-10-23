"""旧 React 版 IndexedDB 数据适配器。

背景：
    - 旧 React 版应用使用的 IndexedDB 库名是 ``LexiTypeDB``，版本 v80；
    - 其复习日志用 ``result``（correct/incorrect）表示对错，
      而当前 LexiTypeAcademyDB schema 用 ``quality``（1-5）与 ``correct``（布尔）；
    - 其单词掌握度记录缺少 reviewCount 等字段，需要用 schema 默认值补齐。

职责：
    把旧版导出载荷转换为当前导入器可直接消费的载荷（保持库名真实，
    便于迁移报告中回溯数据来源），不做任何跨表推导。

设计原则：
    - 只在字段级做确定性映射，不猜测业务语义；
    - 所有补默认值的行为都记录在 ``legacy_source.field_mappings`` 中；
    - 与前端 ``shared/utils/dataMigration.ts`` 的映射保持一致，
      并修正其中 ``incorrect`` 未显式映射（会落到默认值 4）的缺陷。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from app.core.logging import get_logger
from app.db.models import TABLE_MODEL_MAP

# 模块级日志器
logger = get_logger(__name__)

# 旧版数据库名集合：命中即视为需要适配
LEGACY_DB_NAMES: set[str] = {"LexiTypeDB"}

# 旧版复习结果 → SM-2 质量分（1-5）
# 说明：incorrect 必须显式映射为 0，否则会落入默认值 4 造成“错题记为良好”
RESULT_TO_QUALITY: dict[str, int] = {
    "perfect": 5,
    "correct": 4,
    "hard": 3,
    "easy": 5,
    "wrong": 0,
    "incorrect": 0,
}

# 单词掌握度缺失字段的 schema 默认值
MASTERY_DEFAULTS: dict[str, Any] = {
    "reviewCount": 0,
    "consecutiveCorrect": 0,
    "lastReview": 0,
    "createdAt": 0,
    "easeFactor": 2.5,
}


def is_legacy_payload(payload: dict[str, Any]) -> bool:
    """判断载荷是否来自旧 React 版数据库。

    参数：
        payload: 导出 JSON 解析结果。

    返回：
        命中旧库名或使用 ``result`` 字段表示复习结果时返回 True。

    说明：
        双重判断是为了兼容旧版未写入 dbName 的手工导出文件。
    """
    # 库名命中
    db_name = str(payload.get("dbName", ""))
    if db_name in LEGACY_DB_NAMES:
        logger.info("检测到旧版数据库：%s", db_name)
        return True

    # 字段特征命中：reviewLogs 中存在 result 字段
    tables = payload.get("tables") or {}
    review_logs = tables.get("reviewLogs") or []
    if isinstance(review_logs, list) and review_logs:
        first = review_logs[0]
        if isinstance(first, dict) and "result" in first and "quality" not in first:
            logger.info("检测到旧版字段特征：reviewLogs.result")
            return True

    return False


def _convert_review_logs(rows: list[Any]) -> tuple[list[dict[str, Any]], int]:
    """转换旧版复习日志。

    参数：
        rows: 旧版 reviewLogs 原始行。

    返回：
        (转换后的行列表, 结果字符串未识别的条数)。

    映射规则：
        result(correct/incorrect) → quality(4/0) + correct(True/False)；
        旧版 intervalBefore/intervalAfter/easeFactor 不写入当前表（当前
        ReviewLog 无对应列），保留在原始导出文件中以便追溯。
    """
    converted: list[dict[str, Any]] = []
    unknown_results = 0

    for raw in rows:
        # 非对象行直接跳过，避免脏数据中断整批导入
        if not isinstance(raw, dict):
            logger.warning("复习日志存在非对象行，已跳过：%r", raw)
            continue

        result_text = str(raw.get("result", "")).lower()
        # 结果未在映射表中时按“正确”处理（与旧前端默认值一致），并计数告警
        if result_text not in RESULT_TO_QUALITY:
            unknown_results += 1
            logger.warning("复习结果无法识别，按正确处理：%r", raw.get("result"))

        converted.append(
            {
                "id": raw.get("id"),
                "word": raw.get("word"),
                "source": raw.get("source") or "unknown",
                "reviewDate": raw.get("reviewDate"),
                "quality": RESULT_TO_QUALITY.get(result_text, 4),
                "correct": result_text != "incorrect" and result_text != "wrong",
                "level": 0,
            }
        )

    return converted, unknown_results


def _convert_word_mastery(rows: list[Any]) -> list[dict[str, Any]]:
    """转换旧版单词掌握度。

    参数：
        rows: 旧版 wordMasteryItems 原始行。

    返回：
        补齐 schema 默认值后的行列表。

    说明：
        旧版只记录 word/source/level/nextReview/interval，
        其余字段使用 schema 默认值，避免导入校验因空值误判。
    """
    converted: list[dict[str, Any]] = []

    for raw in rows:
        if not isinstance(raw, dict):
            logger.warning("单词掌握度存在非对象行，已跳过：%r", raw)
            continue

        # 先复制已有字段，再补齐缺失默认值
        row: dict[str, Any] = {
            "word": raw.get("word"),
            "source": raw.get("source"),
            "level": raw.get("level", 0),
            "nextReview": raw.get("nextReview", 0),
            "interval": raw.get("interval", 0),
        }
        for field, default in MASTERY_DEFAULTS.items():
            row[field] = raw.get(field, default)

        converted.append(row)

    return converted


def convert_legacy_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """把旧 React 版导出载荷转换为当前导入器可消费的载荷。

    参数：
        payload: 旧版导出 JSON 解析结果。

    返回：
        新的载荷字典：保留真实来源信息，只保留当前已建模的集合。

    说明：
        未建模的集合（dictionaryEntries/meta/wordMastery/ttsCache 等）会被丢弃，
        并在 ``legacy_source.dropped_collections`` 中记录条数，保证可审计。
    """
    tables: dict[str, Any] = payload.get("tables") or {}

    # 只保留当前 ORM 已建模的集合
    kept: dict[str, list[dict[str, Any]]] = {}
    dropped: dict[str, int] = {}

    for collection, rows in tables.items():
        if collection not in TABLE_MODEL_MAP:
            dropped[collection] = len(rows) if isinstance(rows, list) else 0
            continue

        if collection == "reviewLogs":
            kept[collection], unknown_results = _convert_review_logs(rows)
        elif collection == "wordMasteryItems":
            kept[collection] = _convert_word_mastery(rows)
        else:
            # 其余集合字段与当前 schema 一致，直接透传
            kept[collection] = [row for row in rows if isinstance(row, dict)]

    # 记录转换元数据，供迁移报告回溯
    legacy_source: dict[str, Any] = {
        "adapter": "legacy-react-v80",
        "source_db_name": payload.get("dbName"),
        "source_db_version": payload.get("dbVersion"),
        "converted_at": datetime.now().isoformat(timespec="seconds"),
        "field_mappings": {
            "reviewLogs.result": "quality + correct",
            "reviewLogs.intervalBefore/intervalAfter/easeFactor": "未建列，保留在原始导出文件",
            "wordMasteryItems.missing_fields": "按 schema 默认值补齐",
        },
        "dropped_collections": dropped,
    }

    logger.info(
        "旧版数据转换完成：保留集合 %s，丢弃集合 %s",
        {name: len(rows) for name, rows in kept.items()},
        dropped,
    )

    # 组装新载荷：来源信息保持真实（dbName 不篡改）
    converted_payload: dict[str, Any] = {
        "schemaVersion": payload.get("schemaVersion", 1),
        "dbName": payload.get("dbName"),
        "origin": payload.get("origin"),
        "exportedAt": payload.get("exportedAt"),
        "legacySource": legacy_source,
        "tables": kept,
    }
    return converted_payload
