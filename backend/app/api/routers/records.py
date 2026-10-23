"""通用学习记录路由。

职责：
- 学习列表（learningList）增删查改
- 打字记录（typingRecords）写入与范围查询
- 学习记录（learningRecords）写入与查询
- 成就（achievements）写入与查询
- AI 任务日志（aiTaskLogs）增删查改

说明：
    这些集合原先由 commonRepository 直接读写 IndexedDB，
    批次B统一改为后端持久化，前端仅保留 TTS 音频 Blob 缓存（不可入库）。
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import select

from app.api.contracts import (
    extract_write_values,
    require_fields,
    serialize_record,
    serialize_records,
)
from app.core.logging import get_logger
from app.db.base import session_scope
from app.db.models import (
    Achievement,
    AiTaskLog,
    LearningList,
    LearningRecord,
    TypingRecord,
)

# 模块级日志器
logger = get_logger(__name__)

# 学习列表路由：挂载在 /api/learning-list
list_router = APIRouter(prefix="/learning-list", tags=["records"])

# 打字记录路由：挂载在 /api/typing-records
typing_router = APIRouter(prefix="/typing-records", tags=["records"])

# 学习记录路由：挂载在 /api/learning-records
learning_router = APIRouter(prefix="/learning-records", tags=["records"])

# 成就路由：挂载在 /api/achievements
achievement_router = APIRouter(prefix="/achievements", tags=["records"])

# AI 任务日志路由：挂载在 /api/ai-task-logs
ai_log_router = APIRouter(prefix="/ai-task-logs", tags=["records"])


# ---------------------------------------------------------------------------
# 学习列表
# ---------------------------------------------------------------------------


@list_router.get("")
def list_learning_courses() -> dict[str, Any]:
    """返回学习列表全部条目（按加入时间倒序）。

    返回：
        {"items": [{courseId, addedAt, totalStudyTime}], "total": n}
    """
    with session_scope() as session:
        rows: list[LearningList] = list(
            session.execute(
                select(LearningList).order_by(LearningList.added_at.desc())
            ).scalars()
        )

    return {"items": serialize_records("learningList", rows), "total": len(rows)}


@list_router.get("/{course_id}")
def get_learning_item(course_id: str) -> dict[str, Any] | None:
    """读取单条学习列表记录。

    参数：
        course_id: 课程 ID。

    返回：
        记录字典；不存在时返回 null。
    """
    with session_scope() as session:
        item: LearningList | None = session.get(LearningList, course_id)
        if item is None:
            return None
        return serialize_record("learningList", item)


@list_router.post("", status_code=201)
def add_learning_item(payload: dict[str, Any]) -> dict[str, Any]:
    """把课程加入学习列表（重复添加按覆盖处理）。

    参数：
        payload: {courseId, addedAt, totalStudyTime?}

    返回：
        写入后的记录。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("learningList", payload)
    require_fields("learningList", values, ("course_id", "added_at"))

    with session_scope() as session:
        item: LearningList | None = session.get(LearningList, values["course_id"])
        if item is None:
            item = LearningList(**values)
            session.add(item)
        else:
            for column, value in values.items():
                setattr(item, column, value)
        session.flush()
        result: dict[str, Any] = serialize_record("learningList", item)

    logger.info("学习列表已添加：%s", values["course_id"])
    return result


@list_router.patch("/{course_id}")
def update_learning_item(course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """更新学习列表记录（部分字段）。

    参数：
        course_id: 课程 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的记录。

    异常：
        HTTPException: 记录不存在时返回 404。
    """
    values, _ = extract_write_values("learningList", payload)
    values.pop("course_id", None)

    with session_scope() as session:
        item: LearningList | None = session.get(LearningList, course_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"学习列表记录不存在：{course_id}")
        for column, value in values.items():
            setattr(item, column, value)
        session.flush()
        result: dict[str, Any] = serialize_record("learningList", item)

    logger.debug("学习列表已更新：%s，字段=%s", course_id, ", ".join(values.keys()))
    return result


@list_router.delete("/{course_id}")
def remove_learning_item(course_id: str) -> dict[str, Any]:
    """从学习列表移除课程。

    参数：
        course_id: 课程 ID。

    返回：
        {"success": true}

    异常：
        HTTPException: 记录不存在时返回 404。
    """
    with session_scope() as session:
        item: LearningList | None = session.get(LearningList, course_id)
        if item is None:
            raise HTTPException(status_code=404, detail=f"学习列表记录不存在：{course_id}")
        session.delete(item)

    logger.info("学习列表已移除：%s", course_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# 打字记录
# ---------------------------------------------------------------------------


@typing_router.get("")
def list_typing_records(
    start: Optional[int] = Query(default=None, description="日期下界（毫秒，含）"),
    end: Optional[int] = Query(default=None, description="日期上界（毫秒，含）"),
    practice_type: Optional[str] = Query(default=None, alias="practiceType"),
    limit: int = Query(default=200, ge=1, le=2000),
) -> dict[str, Any]:
    """查询打字记录（按日期倒序）。

    参数：
        start: 日期下界（含）。
        end: 日期上界（含）。
        practice_type: 练习类型过滤。
        limit: 返回上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if start is not None:
        conditions.append(TypingRecord.date >= start)
    if end is not None:
        conditions.append(TypingRecord.date <= end)
    if practice_type:
        conditions.append(TypingRecord.practice_type == practice_type)

    with session_scope() as session:
        rows: list[TypingRecord] = list(
            session.execute(
                select(TypingRecord)
                .where(*conditions)
                .order_by(TypingRecord.date.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(session.execute(select(TypingRecord.id).where(*conditions)).scalars())
        )

    return {"items": serialize_records("typingRecords", rows), "total": total}


@typing_router.post("", status_code=201)
def create_typing_record(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条打字记录。

    参数：
        payload: 前端 TypingRecord（camelCase）。

    返回：
        已保存的记录（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("typingRecords", payload)
    if values.get("id") is None:
        values.pop("id", None)
    require_fields("typingRecords", values, ("date", "practice_type"))

    with session_scope() as session:
        record = TypingRecord(**values)
        session.add(record)
        session.flush()
        result: dict[str, Any] = serialize_record("typingRecords", record)

    logger.debug("打字记录已写入：id=%s", result.get("id"))
    return result


# ---------------------------------------------------------------------------
# 学习记录
# ---------------------------------------------------------------------------


@learning_router.get("")
def list_learning_records(
    course_id: Optional[str] = Query(default=None, alias="courseId"),
    start: Optional[int] = Query(default=None, description="创建时间下界（毫秒，含）"),
    end: Optional[int] = Query(default=None, description="创建时间上界（毫秒，含）"),
    limit: int = Query(default=200, ge=1, le=2000),
) -> dict[str, Any]:
    """查询学习记录（按创建时间倒序）。

    参数：
        course_id: 课程过滤。
        start: 创建时间下界（含）。
        end: 创建时间上界（含）。
        limit: 返回上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if course_id:
        conditions.append(LearningRecord.course_id == course_id)
    if start is not None:
        conditions.append(LearningRecord.created_at >= start)
    if end is not None:
        conditions.append(LearningRecord.created_at <= end)

    with session_scope() as session:
        rows: list[LearningRecord] = list(
            session.execute(
                select(LearningRecord)
                .where(*conditions)
                .order_by(LearningRecord.created_at.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(
                session.execute(select(LearningRecord.id).where(*conditions)).scalars()
            )
        )

    return {"items": serialize_records("learningRecords", rows), "total": total}


@learning_router.post("", status_code=201)
def create_learning_record(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条学习记录。

    参数：
        payload: 前端 LearningRecord（camelCase）。

    返回：
        已保存的记录（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("learningRecords", payload)
    if values.get("id") is None:
        values.pop("id", None)
    require_fields("learningRecords", values, ("activity_type", "created_at"))

    with session_scope() as session:
        record = LearningRecord(**values)
        session.add(record)
        session.flush()
        result: dict[str, Any] = serialize_record("learningRecords", record)

    logger.debug("学习记录已写入：id=%s", result.get("id"))
    return result


# ---------------------------------------------------------------------------
# 成就
# ---------------------------------------------------------------------------


@achievement_router.get("")
def list_achievements(
    type_filter: Optional[str] = Query(default=None, alias="type", description="成就类型过滤"),
    limit: int = Query(default=200, ge=1, le=2000),
) -> dict[str, Any]:
    """查询成就列表（按解锁时间倒序）。

    参数：
        type_filter: 成就类型过滤，可选。
        limit: 返回上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if type_filter:
        conditions.append(Achievement.type == type_filter)

    with session_scope() as session:
        rows: list[Achievement] = list(
            session.execute(
                select(Achievement)
                .where(*conditions)
                .order_by(Achievement.unlocked_at.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(session.execute(select(Achievement.id).where(*conditions)).scalars())
        )

    return {"items": serialize_records("achievements", rows), "total": total}


@achievement_router.post("", status_code=201)
def create_achievement(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条成就记录。

    参数：
        payload: 前端 Achievement（camelCase）。

    返回：
        已保存的成就（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("achievements", payload)
    if values.get("id") is None:
        values.pop("id", None)
    require_fields("achievements", values, ("type", "name", "unlocked_at"))

    with session_scope() as session:
        record = Achievement(**values)
        session.add(record)
        session.flush()
        result: dict[str, Any] = serialize_record("achievements", record)

    logger.info("成就已解锁：%s（%s）", values["name"], values["type"])
    return result


# ---------------------------------------------------------------------------
# AI 任务日志
# ---------------------------------------------------------------------------


@ai_log_router.get("")
def list_ai_task_logs(
    type_filter: Optional[str] = Query(default=None, alias="type"),
    limit: int = Query(default=50, ge=1, le=500),
) -> dict[str, Any]:
    """查询 AI 任务日志（按创建时间倒序）。

    参数：
        type_filter: 任务类型过滤。
        limit: 返回上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if type_filter:
        conditions.append(AiTaskLog.type == type_filter)

    with session_scope() as session:
        rows: list[AiTaskLog] = list(
            session.execute(
                select(AiTaskLog)
                .where(*conditions)
                .order_by(AiTaskLog.created_at.desc())
                .limit(limit)
            ).scalars()
        )
        total: int = len(
            list(session.execute(select(AiTaskLog.id).where(*conditions)).scalars())
        )

    return {"items": serialize_records("aiTaskLogs", rows), "total": total}


@ai_log_router.get("/{log_id}")
def get_ai_task_log(log_id: int) -> dict[str, Any]:
    """按 ID 读取单条 AI 任务日志。

    参数：
        log_id: 日志 ID。

    返回：
        日志字典。

    异常：
        HTTPException: 日志不存在时返回 404。
    """
    with session_scope() as session:
        record: AiTaskLog | None = session.get(AiTaskLog, log_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"AI 任务日志不存在：{log_id}")
        return serialize_record("aiTaskLogs", record)


@ai_log_router.post("", status_code=201)
def create_ai_task_log(payload: dict[str, Any]) -> dict[str, Any]:
    """新增一条 AI 任务日志。

    参数：
        payload: 前端 AITaskLog（camelCase）。

    返回：
        已保存的日志（含自增 id）。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("aiTaskLogs", payload)
    if values.get("id") is None:
        values.pop("id", None)
    require_fields("aiTaskLogs", values, ("type", "status", "created_at"))

    with session_scope() as session:
        record = AiTaskLog(**values)
        session.add(record)
        session.flush()
        result: dict[str, Any] = serialize_record("aiTaskLogs", record)

    logger.info("AI 任务日志已创建：%s，类型=%s", result.get("id"), values["type"])
    return result


@ai_log_router.patch("/{log_id}")
def update_ai_task_log(log_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    """更新 AI 任务日志（部分字段）。

    参数：
        log_id: 日志 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的日志。

    异常：
        HTTPException: 日志不存在时返回 404。
    """
    values, _ = extract_write_values("aiTaskLogs", payload)
    values.pop("id", None)

    with session_scope() as session:
        record: AiTaskLog | None = session.get(AiTaskLog, log_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"AI 任务日志不存在：{log_id}")
        for column, value in values.items():
            setattr(record, column, value)
        session.flush()
        result: dict[str, Any] = serialize_record("aiTaskLogs", record)

    logger.debug("AI 任务日志已更新：%s", log_id)
    return result


@ai_log_router.delete("/{log_id}")
def delete_ai_task_log(log_id: int) -> dict[str, Any]:
    """删除 AI 任务日志。

    参数：
        log_id: 日志 ID。

    返回：
        {"success": true}

    异常：
        HTTPException: 日志不存在时返回 404。
    """
    with session_scope() as session:
        record: AiTaskLog | None = session.get(AiTaskLog, log_id)
        if record is None:
            raise HTTPException(status_code=404, detail=f"AI 任务日志不存在：{log_id}")
        session.delete(record)

    logger.info("AI 任务日志已删除：%s", log_id)
    return {"success": True}
