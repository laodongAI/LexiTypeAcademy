"""复习系统路由（单词维度 + Unit 维度）。

职责：
- 单词掌握度读写、到期队列、复习日志、复习统计、来源列表
- Unit 掌握度读写、到期队列、Unit 复习日志

说明：
    SM-2 算法仍在前端 shared/services/sm2Algorithm.ts 中执行（纯函数、可测试），
    后端只负责持久化，保持“算法一处实现”，避免前后端双份算法分叉。
"""

from __future__ import annotations

import time
from datetime import datetime
from typing import Any, Iterable, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, select

from app.api.contracts import (
    extract_write_values,
    require_fields,
    serialize_record,
    serialize_records,
)
from app.core.logging import get_logger
from app.db.base import session_scope
from app.db.models import ReviewLog, UnitMasteryItem, UnitReviewLog, WordMasteryItem

# 模块级日志器
logger = get_logger(__name__)

# 复习路由：挂载在 /api/review
router = APIRouter(prefix="/review", tags=["review"])

# 掌握度等级常量：与前端 MasteryLevel 枚举保持一致
LEVEL_NEW: int = 0
LEVEL_LEARNING: int = 1
LEVEL_FAMILIAR: int = 2
LEVEL_PROFICIENT: int = 3
LEVEL_MASTERED: int = 4


# ---------------------------------------------------------------------------
# 单词维度
# ---------------------------------------------------------------------------


@router.get("/sources")
def list_sources() -> dict[str, Any]:
    """列出所有复习来源（去重）。

    返回：
        {"items": ["课程A", "课程B"]}

    说明：
        来源通常为课程 ID，前端用于来源筛选下拉框。
    """
    with session_scope() as session:
        # 按 source 去重并排序，保证前端展示顺序稳定
        rows: Iterable[str] = session.execute(
            select(WordMasteryItem.source).distinct().order_by(WordMasteryItem.source)
        ).scalars()
        sources: list[str] = [item for item in rows if item]

    return {"items": sources}


@router.get("/mastery")
def list_or_get_mastery(
    word: Optional[str] = Query(default=None, description="单词；提供时返回单条"),
    source: Optional[str] = Query(default=None, description="来源过滤/单条定位"),
    limit: int = Query(default=1000, ge=1, le=10000),
) -> Any:
    """查询单词掌握度。

    参数：
        word: 提供时按 (word, source) 查询单条；未提供时返回列表。
        source: 来源过滤，可选。
        limit: 列表模式下的返回上限。

    返回：
        单条模式：掌握度字典或 null；
        列表模式：{"items": [...], "total": n}。
    """
    with session_scope() as session:
        # 单条查询模式
        if word is not None:
            if not source:
                raise HTTPException(status_code=400, detail="单条查询必须同时提供 source")
            record: WordMasteryItem | None = session.get(WordMasteryItem, (word, source))
            if record is None:
                return None
            return serialize_record("wordMasteryItems", record)

        # 列表模式：可按来源过滤
        statement = select(WordMasteryItem).order_by(WordMasteryItem.next_review.asc())
        if source:
            statement = statement.where(WordMasteryItem.source == source)
        records: list[WordMasteryItem] = list(
            session.execute(statement.limit(limit)).scalars()
        )

    return {"items": serialize_records("wordMasteryItems", records), "total": len(records)}


@router.put("/mastery")
def upsert_mastery(payload: dict[str, Any]) -> dict[str, Any]:
    """写入（或覆盖）单条单词掌握度。

    参数：
        payload: 前端 WordMastery（camelCase，含 word 与 source）。

    返回：
        写入后的掌握度字典。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("wordMasteryItems", payload)
    require_fields("wordMasteryItems", values, ("word", "source", "next_review"))

    with session_scope() as session:
        existing: WordMasteryItem | None = session.get(
            WordMasteryItem, (values["word"], values["source"])
        )
        if existing is None:
            record = WordMasteryItem(**values)
            session.add(record)
        else:
            record = existing
            for column, value in values.items():
                setattr(record, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("wordMasteryItems", record)

    logger.debug("掌握度已保存：%s/%s", values["word"], values["source"])
    return result


@router.post("/mastery/batch")
def batch_upsert_mastery(payload: dict[str, Any]) -> dict[str, Any]:
    """批量写入单词掌握度。

    参数：
        payload: {"items": [WordMastery, ...]}

    返回：
        {"success": true, "saved": n}

    异常：
        HTTPException: 请求结构不合法时返回 400。
    """
    items: Any = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items 必须是数组")

    # 逐条转换，缺失关键字段直接拒绝，避免写入半条脏数据
    normalized: list[dict[str, Any]] = []
    for raw in items:
        values, _ = extract_write_values("wordMasteryItems", raw)
        require_fields("wordMasteryItems", values, ("word", "source", "next_review"))
        normalized.append(values)

    with session_scope() as session:
        for values in normalized:
            existing: WordMasteryItem | None = session.get(
                WordMasteryItem, (values["word"], values["source"])
            )
            if existing is None:
                session.add(WordMasteryItem(**values))
                continue
            for column, value in values.items():
                setattr(existing, column, value)

    logger.info("批量掌握度已保存：%s 条", len(normalized))
    return {"success": True, "saved": len(normalized)}


@router.delete("/mastery")
def delete_mastery(
    word: str = Query(description="单词"),
    source: str = Query(description="来源"),
) -> dict[str, Any]:
    """删除单条单词掌握度。

    参数：
        word: 单词。
        source: 来源。

    返回：
        {"success": true}

    异常：
        HTTPException: 记录不存在时返回 404。
    """
    with session_scope() as session:
        record: WordMasteryItem | None = session.get(WordMasteryItem, (word, source))
        if record is None:
            raise HTTPException(status_code=404, detail=f"掌握度记录不存在：{word}/{source}")
        session.delete(record)

    logger.info("掌握度已删除：%s/%s", word, source)
    return {"success": True}


@router.delete("/source")
def delete_by_source(source: str = Query(description="要清理的来源")) -> dict[str, Any]:
    """删除某来源下的全部掌握度与复习日志。

    参数：
        source: 来源（通常为课程 ID）。

    返回：
        {"success": true, "deleted_mastery": n, "deleted_logs": m}
    """
    with session_scope() as session:
        mastery_result = session.execute(
            delete(WordMasteryItem).where(WordMasteryItem.source == source)
        )
        log_result = session.execute(
            delete(ReviewLog).where(ReviewLog.source == source)
        )
        deleted_mastery: int = mastery_result.rowcount or 0
        deleted_logs: int = log_result.rowcount or 0

    logger.info("来源数据已清理：%s，掌握度 %s 条，日志 %s 条", source, deleted_mastery, deleted_logs)
    return {
        "success": True,
        "deleted_mastery": deleted_mastery,
        "deleted_logs": deleted_logs,
    }


@router.get("/due")
def list_due_words(
    limit: int = Query(default=20, ge=1, le=500),
    source: Optional[str] = Query(default=None, description="来源过滤，可选"),
) -> dict[str, Any]:
    """查询到期需要复习的单词。

    参数：
        limit: 返回条数上限。
        source: 来源过滤，可选。

    返回：
        {"items": [{word, source, level, nextReview, reviewCount}], "total": n}

    说明：
        到期定义：next_review <= 当前时间；按到期时间升序，最久未复习的优先。
    """
    # 当前毫秒时间戳，与前端 Date.now() 对齐
    now_ms: int = int(time.time() * 1000)

    conditions: list[Any] = [WordMasteryItem.next_review <= now_ms]
    if source:
        conditions.append(WordMasteryItem.source == source)

    with session_scope() as session:
        rows: list[WordMasteryItem] = list(
            session.execute(
                select(WordMasteryItem)
                .where(*conditions)
                .order_by(WordMasteryItem.next_review.asc())
                .limit(limit)
            ).scalars()
        )

    # 只返回复习队列需要的精简字段
    items: list[dict[str, Any]] = [
        {
            "word": row.word,
            "source": row.source,
            "level": row.level,
            "nextReview": row.next_review,
            "reviewCount": row.review_count,
        }
        for row in rows
    ]

    logger.debug("到期单词查询：来源=%s，返回=%s", source, len(items))
    return {"items": items, "total": len(items)}


@router.post("/logs", status_code=201)
def create_review_log(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条复习日志。

    参数：
        payload: 前端 ReviewLog（camelCase，id 可省略）。

    返回：
        已保存的日志（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("reviewLogs", payload)
    if values.get("id") is None:
        values.pop("id", None)

    require_fields("reviewLogs", values, ("word", "source", "review_date"))

    with session_scope() as session:
        log = ReviewLog(**values)
        session.add(log)
        session.flush()
        result: dict[str, Any] = serialize_record("reviewLogs", log)

    logger.debug("复习日志已写入：id=%s，%s", result.get("id"), values["word"])
    return result


@router.post("/logs/batch")
def batch_create_review_logs(payload: dict[str, Any]) -> dict[str, Any]:
    """批量新增复习日志。

    参数：
        payload: {"items": [ReviewLog, ...]}

    返回：
        {"success": true, "saved": n}
    """
    items: Any = payload.get("items")
    if not isinstance(items, list):
        raise HTTPException(status_code=400, detail="items 必须是数组")

    normalized: list[dict[str, Any]] = []
    for raw in items:
        values, _ = extract_write_values("reviewLogs", raw)
        if values.get("id") is None:
            values.pop("id", None)
        require_fields("reviewLogs", values, ("word", "source", "review_date"))
        normalized.append(values)

    with session_scope() as session:
        session.add_all([ReviewLog(**values) for values in normalized])

    logger.info("批量复习日志已写入：%s 条", len(normalized))
    return {"success": True, "saved": len(normalized)}


@router.get("/logs")
def list_review_logs(
    start: Optional[int] = Query(default=None, description="复习时间下界（毫秒，含）"),
    end: Optional[int] = Query(default=None, description="复习时间上界（毫秒，含）"),
    source: Optional[str] = Query(default=None),
    word: Optional[str] = Query(default=None),
    limit: int = Query(default=1000, ge=1, le=10000),
) -> dict[str, Any]:
    """查询复习日志（按复习时间倒序）。

    参数：
        start: 复习时间下界（含）。
        end: 复习时间上界（含）。
        source: 来源过滤。
        word: 单词过滤。
        limit: 返回上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if start is not None:
        conditions.append(ReviewLog.review_date >= start)
    if end is not None:
        conditions.append(ReviewLog.review_date <= end)
    if source:
        conditions.append(ReviewLog.source == source)
    if word:
        conditions.append(ReviewLog.word == word)

    with session_scope() as session:
        rows: list[ReviewLog] = list(
            session.execute(
                select(ReviewLog)
                .where(*conditions)
                .order_by(ReviewLog.review_date.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(session.execute(select(ReviewLog.id).where(*conditions)).scalars())
        )

    return {"items": serialize_records("reviewLogs", rows), "total": total}


@router.get("/stats")
def get_review_stats(
    source: Optional[str] = Query(default=None, description="来源过滤，可选"),
) -> dict[str, Any]:
    """计算复习统计指标。

    参数：
        source: 来源过滤，可选。

    返回：
        {totalWords, newWords, learningWords, masteredWords, dueToday, reviewedToday}

    说明：
        统计口径与前端 reviewRepository.getReviewStats 完全一致：
        等级 0 计为新词；1-2 计为学习中；3-4 计为已掌握。
    """
    now_ms: int = int(time.time() * 1000)
    # 今日零点（本地时区），与前端 new Date().setHours(0,0,0,0) 语义一致
    today_start_ms: int = int(
        datetime.now().replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
    )

    with session_scope() as session:
        # 掌握度记录集合
        mastery_statement = select(WordMasteryItem)
        if source:
            mastery_statement = mastery_statement.where(WordMasteryItem.source == source)
        mastery_rows: list[WordMasteryItem] = list(
            session.execute(mastery_statement).scalars()
        )

        # 今日复习日志（用于去重统计已复习单词数）
        log_statement = select(ReviewLog).where(
            ReviewLog.review_date >= today_start_ms,
            ReviewLog.review_date <= now_ms,
        )
        if source:
            log_statement = log_statement.where(ReviewLog.source == source)
        today_logs: list[ReviewLog] = list(session.execute(log_statement).scalars())

    # 分等级统计 + 到期统计
    new_words: int = 0
    learning_words: int = 0
    mastered_words: int = 0
    due_today: int = 0

    for item in mastery_rows:
        if item.level == LEVEL_NEW:
            new_words += 1
        elif item.level in (LEVEL_LEARNING, LEVEL_FAMILIAR):
            learning_words += 1
        elif item.level in (LEVEL_PROFICIENT, LEVEL_MASTERED):
            mastered_words += 1

        if item.next_review <= now_ms:
            due_today += 1

    # 今日已复习：按 word+source 去重
    reviewed_keys: set[str] = {f"{log.word}-{log.source}" for log in today_logs}

    stats: dict[str, Any] = {
        "totalWords": len(mastery_rows),
        "newWords": new_words,
        "learningWords": learning_words,
        "masteredWords": mastered_words,
        "dueToday": due_today,
        "reviewedToday": len(reviewed_keys),
    }

    logger.debug("复习统计：来源=%s，结果=%s", source, stats)
    return stats


# ---------------------------------------------------------------------------
# Unit 维度
# ---------------------------------------------------------------------------


@router.get("/unit-mastery")
def get_unit_mastery(
    course_id: str = Query(alias="courseId"),
    unit_id: str = Query(alias="unitId"),
    mode: str = Query(description="练习模式"),
) -> dict[str, Any] | None:
    """读取单个 Unit 掌握度。

    参数：
        course_id: 课程 ID。
        unit_id: 练习单元 ID。
        mode: 练习模式。

    返回：
        掌握度字典；不存在时返回 null。
    """
    with session_scope() as session:
        record: UnitMasteryItem | None = session.get(
            UnitMasteryItem, (course_id, unit_id, mode)
        )
        if record is None:
            return None
        return serialize_record("unitMasteryItems", record)


@router.put("/unit-mastery")
def upsert_unit_mastery(payload: dict[str, Any]) -> dict[str, Any]:
    """写入（或覆盖）Unit 掌握度。

    参数：
        payload: 前端 UnitMastery（camelCase）。

    返回：
        写入后的掌握度字典。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("unitMasteryItems", payload)
    require_fields(
        "unitMasteryItems",
        values,
        ("course_id", "unit_id", "mode", "next_review"),
    )

    with session_scope() as session:
        key: tuple[str, str, str] = (
            values["course_id"],
            values["unit_id"],
            values["mode"],
        )
        existing: UnitMasteryItem | None = session.get(UnitMasteryItem, key)
        if existing is None:
            record = UnitMasteryItem(**values)
            session.add(record)
        else:
            record = existing
            for column, value in values.items():
                setattr(record, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("unitMasteryItems", record)

    logger.debug("Unit 掌握度已保存：%s/%s/%s", *key)
    return result


@router.get("/unit-due")
def list_due_units(
    limit: int = Query(default=20, ge=1, le=500),
    course_id: Optional[str] = Query(default=None, alias="courseId"),
) -> dict[str, Any]:
    """查询到期需要复习的 Unit。

    参数：
        limit: 返回上限。
        course_id: 课程过滤，可选。

    返回：
        {"items": [{courseId, unitId, mode, lessonId, level, nextReview, reviewCount}], "total": n}
    """
    now_ms: int = int(time.time() * 1000)
    conditions: list[Any] = [UnitMasteryItem.next_review <= now_ms]
    if course_id:
        conditions.append(UnitMasteryItem.course_id == course_id)

    with session_scope() as session:
        rows: list[UnitMasteryItem] = list(
            session.execute(
                select(UnitMasteryItem)
                .where(*conditions)
                .order_by(UnitMasteryItem.next_review.asc())
                .limit(limit)
            ).scalars()
        )

    items: list[dict[str, Any]] = [
        {
            "courseId": row.course_id,
            "unitId": row.unit_id,
            "mode": row.mode,
            "lessonId": row.lesson_id,
            "level": row.level,
            "nextReview": row.next_review,
            "reviewCount": row.review_count,
        }
        for row in rows
    ]

    return {"items": items, "total": len(items)}


@router.post("/unit-logs", status_code=201)
def create_unit_review_log(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条 Unit 复习日志。

    参数：
        payload: 前端 UnitReviewLog（camelCase）。

    返回：
        已保存的日志（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("unitReviewLogs", payload)
    if values.get("id") is None:
        values.pop("id", None)

    require_fields(
        "unitReviewLogs",
        values,
        ("course_id", "unit_id", "mode", "review_date"),
    )

    with session_scope() as session:
        log = UnitReviewLog(**values)
        session.add(log)
        session.flush()
        result: dict[str, Any] = serialize_record("unitReviewLogs", log)

    logger.debug("Unit 复习日志已写入：id=%s", result.get("id"))
    return result
