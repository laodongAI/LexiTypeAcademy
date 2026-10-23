"""练习数据路由。

职责：
- 练习记录（practiceRecords）：按课程/课时/时间范围查询、写入、删除
- 练习尝试事件（practiceAttemptEvents）：事件写入与按单元聚合查询

说明：
    这两个集合是学习闭环的核心数据来源：
    练习记录供统计页与练习中心聚合；尝试事件供 Unit 维度复习（SM-2）消费。
"""

from __future__ import annotations

from typing import Any, Optional

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
from app.db.models import PracticeAttemptEvent, PracticeRecord

# 模块级日志器
logger = get_logger(__name__)

# 练习记录路由：挂载在 /api/practice-records
record_router = APIRouter(prefix="/practice-records", tags=["practice"])

# 练习尝试事件路由：挂载在 /api/practice-attempt-events
attempt_router = APIRouter(prefix="/practice-attempt-events", tags=["practice"])


@record_router.get("")
def list_practice_records(
    course_id: Optional[str] = Query(default=None, alias="courseId"),
    lesson_id: Optional[str] = Query(default=None, alias="lessonId"),
    start: Optional[int] = Query(default=None, description="完成时间下界（毫秒，含）"),
    end: Optional[int] = Query(default=None, description="完成时间上界（毫秒，含）"),
    limit: int = Query(default=500, ge=1, le=5000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """查询练习记录（按完成时间倒序）。

    参数：
        course_id: 课程 ID 过滤，可选。
        lesson_id: 课时 ID 过滤，可选。
        start: 完成时间下界（毫秒，含边界），可选。
        end: 完成时间上界（毫秒，含边界），可选。
        limit: 返回条数上限。
        offset: 偏移量。

    返回：
        {"items": [...], "total": n}

    说明：
        统计页与练习中心都用该接口取数，避免前端各自拼查询。
    """
    # 组合过滤条件
    conditions: list[Any] = []
    if course_id:
        conditions.append(PracticeRecord.course_id == course_id)
    if lesson_id:
        conditions.append(PracticeRecord.lesson_id == lesson_id)
    if start is not None:
        conditions.append(PracticeRecord.completed_at >= start)
    if end is not None:
        conditions.append(PracticeRecord.completed_at <= end)

    with session_scope() as session:
        # 按完成时间倒序：最新练习在前
        rows: list[PracticeRecord] = list(
            session.execute(
                select(PracticeRecord)
                .where(*conditions)
                .order_by(PracticeRecord.completed_at.desc())
                .offset(offset)
                .limit(limit)
            ).scalars()
        )

        # 总数统计（与列表同条件，不受分页影响）
        total: int = len(
            list(session.execute(select(PracticeRecord.id).where(*conditions)).scalars())
        )

    logger.debug("练习记录查询：课程=%s，课时=%s，总数=%s", course_id, lesson_id, total)
    return {"items": serialize_records("practiceRecords", rows), "total": total}


@record_router.post("", status_code=201)
def create_practice_record(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条练习记录。

    参数：
        payload: 前端 PracticeRecord（camelCase，id 可省略）。

    返回：
        已保存的记录（含数据库生成的自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("practiceRecords", payload)

    # 自增主键为 None 时交给数据库生成
    if values.get("id") is None:
        values.pop("id", None)

    require_fields(
        "practiceRecords",
        values,
        ("course_id", "lesson_id", "mode", "completed_at"),
    )

    with session_scope() as session:
        record = PracticeRecord(**values)
        session.add(record)
        session.flush()
        # 刷新后读取自增主键
        result: dict[str, Any] = serialize_record("practiceRecords", record)

    logger.info(
        "练习记录已写入：id=%s，课程=%s，课时=%s",
        result.get("id"),
        values["course_id"],
        values["lesson_id"],
    )
    return result


@record_router.delete("/{record_id}")
def delete_practice_record(record_id: int) -> dict[str, Any]:
    """删除指定练习记录。

    参数：
        record_id: 练习记录自增 ID。

    返回：
        {"success": true}

    异常：
        HTTPException: 记录不存在时返回 404。
    """
    with session_scope() as session:
        record: PracticeRecord | None = session.get(PracticeRecord, record_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"练习记录不存在：{record_id}")
        session.delete(record)

    logger.info("练习记录已删除：%s", record_id)
    return {"success": True}


@attempt_router.get("")
def list_attempt_events(
    course_id: Optional[str] = Query(default=None, alias="courseId"),
    unit_id: Optional[str] = Query(default=None, alias="unitId"),
    mode: Optional[str] = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
) -> dict[str, Any]:
    """查询练习尝试事件（按发生时间倒序）。

    参数：
        course_id: 课程 ID，可选。
        unit_id: 练习单元 ID，可选。
        mode: 练习模式，可选。
        limit: 返回条数上限。

    返回：
        {"items": [...], "total": n}

    说明：
        Unit 维度滚动准确率只看最近若干条，调用方可传较小的 limit。
    """
    conditions: list[Any] = []
    if course_id:
        conditions.append(PracticeAttemptEvent.course_id == course_id)
    if unit_id:
        conditions.append(PracticeAttemptEvent.unit_id == unit_id)
    if mode:
        conditions.append(PracticeAttemptEvent.mode == mode)

    with session_scope() as session:
        rows: list[PracticeAttemptEvent] = list(
            session.execute(
                select(PracticeAttemptEvent)
                .where(*conditions)
                .order_by(PracticeAttemptEvent.created_at.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(
                session.execute(
                    select(PracticeAttemptEvent.id).where(*conditions)
                ).scalars()
            )
        )

    return {"items": serialize_records("practiceAttemptEvents", rows), "total": total}


@attempt_router.post("", status_code=201)
def create_attempt_event(payload: dict[str, Any]) -> dict[str, Any]:
    """写入一条练习尝试事件。

    参数：
        payload: 前端 PracticeAttemptEvent（camelCase，id 可省略）。

    返回：
        已保存的事件（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("practiceAttemptEvents", payload)

    # 自增主键为空时交给数据库生成
    if values.get("id") is None:
        values.pop("id", None)

    require_fields(
        "practiceAttemptEvents",
        values,
        ("created_at", "course_id", "lesson_id", "unit_id", "mode", "reference_text"),
    )

    with session_scope() as session:
        event = PracticeAttemptEvent(**values)
        session.add(event)
        session.flush()
        result: dict[str, Any] = serialize_record("practiceAttemptEvents", event)

    logger.info(
        "练习事件已写入：id=%s，单元=%s，模式=%s，正确=%s",
        result.get("id"),
        values["unit_id"],
        values["mode"],
        values.get("correct"),
    )
    return result


@attempt_router.delete("")
def delete_attempt_events(
    course_id: str = Query(alias="courseId", description="要清理的课程 ID"),
) -> dict[str, Any]:
    """按课程清空练习尝试事件。

    参数：
        course_id: 课程 ID。

    返回：
        {"success": true, "deleted": n}

    说明：
        课程删除后清理事件流，避免统计与复习队列读取到孤儿数据。
    """
    with session_scope() as session:
        result = session.execute(
            delete(PracticeAttemptEvent).where(
                PracticeAttemptEvent.course_id == course_id
            )
        )
        deleted: int = result.rowcount or 0

    logger.info("练习事件已按课程清理：%s，删除 %s 条", course_id, deleted)
    return {"success": True, "deleted": deleted}
