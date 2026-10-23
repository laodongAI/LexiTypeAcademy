"""课程与课时业务路由。

职责：
- 课程列表/详情/新建/更新/删除（删除时级联清理课时、进度、练习记录）
- 课时列表/单个查询/新建/更新/删除
- 课程学习进度的读取与写入

说明：
    本路由是前端仓储层（shared/database/repositories/courseRepository.ts）
    的唯一数据来源，字段契约由 app/api/contracts.py 与迁移模块共用，
    不再让前端直接读写 IndexedDB，消除双存储。
"""

from __future__ import annotations

import time
from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.api.contracts import (
    extract_write_values,
    require_fields,
    serialize_record,
    serialize_records,
)
from app.core.logging import get_logger
from app.db.base import session_scope
from app.db.models import Course, CourseProgress, Lesson, PracticeRecord

# 模块级日志器
logger = get_logger(__name__)

# 课程路由：挂载在 /api/courses
router = APIRouter(prefix="/courses", tags=["courses"])

# 课时单条路由：挂载在 /api/lessons
lesson_router = APIRouter(prefix="/lessons", tags=["courses"])

# 课程进度路由：挂载在 /api/course-progress
progress_router = APIRouter(prefix="/course-progress", tags=["courses"])


def _current_timestamp_ms() -> int:
    """返回当前毫秒时间戳，与前端 Date.now() 语义保持一致。"""
    return int(time.time() * 1000)


@router.get("")
def list_courses(
    category: Optional[str] = Query(default=None, description="课程分类过滤"),
    difficulty: Optional[str] = Query(default=None, description="难度过滤"),
    q: Optional[str] = Query(default=None, description="标题/描述/标签关键字"),
    ids: Optional[str] = Query(default=None, description="逗号分隔的课程 ID 列表"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
) -> dict[str, Any]:
    """查询课程列表。

    参数：
        category: 课程分类（basic/advanced/special），可选。
        difficulty: 难度标识，可选。
        q: 搜索关键字，匹配标题、描述或标签，可选。
        ids: 指定课程 ID 集合（逗号分隔），用于学习列表批量取课程。
        limit: 返回条数上限。
        offset: 偏移量，用于分页。

    返回：
        {"items": [...], "total": 命中总数}。

    说明：
        关键字搜索中的标签匹配在内存完成（标签为 JSON 数组），
        本地单机数据量小，避免依赖 SQLite JSON1 扩展。
    """
    # 收集 SQL 过滤条件
    conditions: list[Any] = []
    if category:
        conditions.append(Course.category == category)
    if difficulty:
        conditions.append(Course.difficulty == difficulty)
    if ids:
        # 过滤空串，避免 IN () 语法错误
        id_list: list[str] = [item.strip() for item in ids.split(",") if item.strip()]
        if id_list:
            conditions.append(Course.id.in_(id_list))

    with session_scope() as session:
        # 有关键字时先取出候选集，再在内存做标签与模糊匹配
        if q:
            keyword: str = q.strip().lower()
            statement = select(Course).where(*conditions).order_by(Course.updated_at.desc())
            candidates: list[Course] = list(session.execute(statement).scalars())

            # 标题、描述、标签任一命中即保留
            matched: list[Course] = []
            for course in candidates:
                tags_text: str = ",".join(str(tag) for tag in (course.tags or [])).lower()
                if (
                    keyword in (course.title or "").lower()
                    or keyword in (course.description or "").lower()
                    or keyword in tags_text
                ):
                    matched.append(course)

            total: int = len(matched)
            # 内存分页
            page: list[Course] = matched[offset : offset + limit]
            logger.debug("课程搜索：关键字=%s，命中=%s，返回=%s", q, total, len(page))
            return {"items": serialize_records("courses", page), "total": total}

        # 无关键字：直接 SQL 分页
        statement = (
            select(Course)
            .where(*conditions)
            .order_by(Course.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
        rows: list[Course] = list(session.execute(statement).scalars())

        # 总数：使用同一过滤条件统计
        count_statement = select(Course.id).where(*conditions)
        total = len(list(session.execute(count_statement).scalars()))

    logger.debug("课程列表：总数=%s，返回=%s", total, len(rows))
    return {"items": serialize_records("courses", rows), "total": total}


@router.get("/{course_id}")
def get_course(course_id: str) -> dict[str, Any]:
    """读取单个课程详情，并附带其课时列表。

    参数：
        course_id: 课程 ID。

    返回：
        课程字典，`lessons` 为课时表中的真实课时数组。

    异常：
        HTTPException: 课程不存在时返回 404。
    """
    with session_scope() as session:
        course: Course | None = session.get(Course, course_id)
        if course is None:
            logger.warning("课程不存在：%s", course_id)
            raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")

        # 课时按创建时间正序，保持课程内学习顺序稳定
        lesson_rows: list[Lesson] = list(
            session.execute(
                select(Lesson)
                .where(Lesson.course_id == course_id)
                .order_by(Lesson.created_at.asc())
            ).scalars()
        )

        # 组装响应：courses 契约字段 + 真实课时数组
        result: dict[str, Any] = serialize_record("courses", course)
        result["lessons"] = serialize_records("lessons", lesson_rows)

    return result


@router.post("", status_code=201)
def create_course(payload: dict[str, Any]) -> dict[str, Any]:
    """新建课程（可携带课时，整体事务写入）。

    参数：
        payload: 前端 Course 结构（camelCase），可含 lessons 数组。

    返回：
        创建后的课程字典（含课时）。

    异常：
        HTTPException: 缺少必填字段时返回 400。

    说明：
        与 Dexie 的 put 语义一致：ID 已存在则覆盖，便于课程导入复用此接口。
        课程表内嵌 lessons 字段按前端历史行为固定保存空数组，
        真实课时保存在 lessons 表中，避免两份数据不一致。
    """
    # 转换课程字段；lessons 由课时表单独处理，不能写入快照列
    values, _ = extract_write_values("courses", payload, skip_fields=("lessons",))
    require_fields(
        "courses",
        values,
        ("id", "title", "category", "difficulty", "created_at", "updated_at"),
    )

    # 课程内嵌课时快照固定为空数组，与前端 put({...courseData, lessons: []}) 一致
    values["lessons_snapshot"] = []

    # 课时原始数组
    raw_lessons: list[Any] = payload.get("lessons") or []
    if not isinstance(raw_lessons, list):
        raise HTTPException(status_code=400, detail="lessons 必须是数组")

    with session_scope() as session:
        existing: Course | None = session.get(Course, values["id"])
        if existing is None:
            course = Course(**values)
            session.add(course)
        else:
            # ID 冲突时覆盖，保持与索引库 put 一致的行为
            course = existing
            for column, value in values.items():
                setattr(course, column, value)

        # 逐个写入课时（同样采用覆盖语义）
        for raw_lesson in raw_lessons:
            _upsert_lesson(session, values["id"], raw_lesson)

        # 刷新后读取课时，保证响应包含落库结果
        session.flush()
        lesson_rows: list[Lesson] = list(
            session.execute(
                select(Lesson)
                .where(Lesson.course_id == values["id"])
                .order_by(Lesson.created_at.asc())
            ).scalars()
        )

        result: dict[str, Any] = serialize_record("courses", course)
        result["lessons"] = serialize_records("lessons", lesson_rows)

    logger.info("课程已保存：%s，课时 %s 个", values["id"], len(lesson_rows))
    return result


def _upsert_lesson(session: Session, course_id: str, raw_lesson: Any) -> Lesson:
    """把单条课时请求体写入 lessons 表。

    参数：
        session: 数据库会话。
        course_id: 所属课程 ID，以此覆盖请求体中的 courseId。
        raw_lesson: 前端课时对象（camelCase）。

    返回：
        已保存的课时 ORM 对象。

    异常：
        HTTPException: 课时字段不合法。
    """
    # 转换课时字段
    lesson_values, _ = extract_write_values("lessons", raw_lesson)
    require_fields(
        "lessons",
        lesson_values,
        ("id", "title", "content_shape", "created_at"),
    )

    # 所属课程以路径/父级为准，避免请求体伪造跨课程写入
    lesson_values["course_id"] = course_id

    existing: Lesson | None = session.get(Lesson, lesson_values["id"])
    if existing is None:
        lesson = Lesson(**lesson_values)
        session.add(lesson)
        return lesson

    for column, value in lesson_values.items():
        setattr(existing, column, value)
    return existing


@router.put("/{course_id}")
def update_course(course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """更新课程字段（部分更新）。

    参数：
        course_id: 课程 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的课程字典。

    异常：
        HTTPException: 课程不存在时返回 404。
    """
    values, _ = extract_write_values("courses", payload, skip_fields=("lessons",))

    # 允许路径 ID 与请求体 ID 同时存在，以路径为准
    values.pop("id", None)
    # 未显式提供更新时间时由服务端补齐
    values.setdefault("updated_at", _current_timestamp_ms())

    with session_scope() as session:
        course: Course | None = session.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")

        for column, value in values.items():
            setattr(course, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("courses", course)

    logger.info("课程已更新：%s，字段=%s", course_id, ", ".join(values.keys()))
    return result


@router.delete("/{course_id}")
def delete_course(course_id: str) -> dict[str, Any]:
    """删除课程，并级联清理关联数据。

    参数：
        course_id: 课程 ID。

    返回：
        {"success": true, "deleted_lessons": n, "deleted_practice_records": m}

    异常：
        HTTPException: 课程不存在时返回 404。

    说明：
        级联范围与前端 Dexie 事务保持一致：课时、课程进度、练习记录。
    """
    with session_scope() as session:
        course: Course | None = session.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")

        # 先删子表，再删主表，避免遗留悬挂数据
        lesson_result = session.execute(
            delete(Lesson).where(Lesson.course_id == course_id)
        )
        session.execute(delete(CourseProgress).where(CourseProgress.course_id == course_id))
        practice_result = session.execute(
            delete(PracticeRecord).where(PracticeRecord.course_id == course_id)
        )
        session.delete(course)

        deleted_lessons: int = lesson_result.rowcount or 0
        deleted_records: int = practice_result.rowcount or 0

    logger.info(
        "课程已删除：%s，课时 %s 个，练习记录 %s 条",
        course_id,
        deleted_lessons,
        deleted_records,
    )
    return {
        "success": True,
        "deleted_lessons": deleted_lessons,
        "deleted_practice_records": deleted_records,
    }


@router.get("/{course_id}/lessons")
def list_lessons(course_id: str) -> dict[str, Any]:
    """查询课程下的全部课时。

    参数：
        course_id: 课程 ID。

    返回：
        {"items": [...], "total": n}
    """
    with session_scope() as session:
        rows: list[Lesson] = list(
            session.execute(
                select(Lesson)
                .where(Lesson.course_id == course_id)
                .order_by(Lesson.created_at.asc())
            ).scalars()
        )

    return {"items": serialize_records("lessons", rows), "total": len(rows)}


@router.post("/{course_id}/lessons", status_code=201)
def create_lesson(course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """在指定课程下新建/覆盖课时。

    参数：
        course_id: 课程 ID。
        payload: 前端课时对象（camelCase）。

    返回：
        保存后的课时字典。

    异常：
        HTTPException: 课程不存在或字段缺失。
    """
    with session_scope() as session:
        course: Course | None = session.get(Course, course_id)
        if course is None:
            raise HTTPException(status_code=404, detail=f"课程不存在：{course_id}")

        lesson: Lesson = _upsert_lesson(session, course_id, payload)
        session.flush()

        result: dict[str, Any] = serialize_record("lessons", lesson)

    logger.info("课时已保存：%s（课程 %s）", result.get("id"), course_id)
    return result


def _apply_lesson_updates(
    lesson_id: str,
    payload: dict[str, Any],
    course_id: Optional[str] = None,
) -> dict[str, Any]:
    """更新课时字段的共用实现。

    参数：
        lesson_id: 课时 ID。
        payload: 需要更新的字段（camelCase）。
        course_id: 提供时校验课时归属，避免跨课程修改。

    返回：
        更新后的课时字典。

    异常：
        HTTPException: 课时不存在或归属不匹配时返回 404。
    """
    values, _ = extract_write_values("lessons", payload)

    # 主键与所属课程不允许通过更新接口修改
    values.pop("id", None)
    values.pop("course_id", None)
    # 未提供更新时间时由服务端补齐
    values.setdefault("updated_at", _current_timestamp_ms())

    with session_scope() as session:
        lesson: Lesson | None = session.get(Lesson, lesson_id)
        if lesson is None or (course_id is not None and lesson.course_id != course_id):
            detail: str = (
                f"课时不存在或不属于课程：{lesson_id}"
                if course_id is not None
                else f"课时不存在：{lesson_id}"
            )
            raise HTTPException(status_code=404, detail=detail)

        for column, value in values.items():
            setattr(lesson, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("lessons", lesson)

    logger.info("课时已更新：%s，字段=%s", lesson_id, ", ".join(values.keys()))
    return result


def _delete_lesson_with_records(lesson_id: str, course_id: Optional[str] = None) -> dict[str, Any]:
    """删除课时并清理练习记录的共用实现。

    参数：
        lesson_id: 课时 ID。
        course_id: 提供时校验课时归属，避免跨课程删除。

    返回：
        {"success": true, "deleted_practice_records": n}

    异常：
        HTTPException: 课时不存在或归属不匹配时返回 404。
    """
    with session_scope() as session:
        lesson: Lesson | None = session.get(Lesson, lesson_id)
        if lesson is None or (course_id is not None and lesson.course_id != course_id):
            detail: str = (
                f"课时不存在或不属于课程：{lesson_id}"
                if course_id is not None
                else f"课时不存在：{lesson_id}"
            )
            raise HTTPException(status_code=404, detail=detail)

        practice_result = session.execute(
            delete(PracticeRecord).where(PracticeRecord.lesson_id == lesson_id)
        )
        session.delete(lesson)
        deleted_records: int = practice_result.rowcount or 0

    logger.info("课时已删除：%s，练习记录 %s 条", lesson_id, deleted_records)
    return {"success": True, "deleted_practice_records": deleted_records}


@router.put("/{course_id}/lessons/{lesson_id}")
def update_lesson(course_id: str, lesson_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """更新课时字段（校验课时归属）。

    参数：
        course_id: 所属课程 ID。
        lesson_id: 课时 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的课时字典。
    """
    return _apply_lesson_updates(lesson_id, payload, course_id=course_id)


@router.delete("/{course_id}/lessons/{lesson_id}")
def delete_lesson(course_id: str, lesson_id: str) -> dict[str, Any]:
    """删除课时并清理练习记录（校验课时归属）。

    参数：
        course_id: 所属课程 ID。
        lesson_id: 课时 ID。

    返回：
        {"success": true, "deleted_practice_records": n}
    """
    return _delete_lesson_with_records(lesson_id, course_id=course_id)


@lesson_router.get("/{lesson_id}")
def get_lesson(lesson_id: str) -> dict[str, Any]:
    """按 ID 读取单个课时。

    参数：
        lesson_id: 课时 ID。

    返回：
        课时字典。

    异常：
        HTTPException: 课时不存在时返回 404。
    """
    with session_scope() as session:
        lesson: Lesson | None = session.get(Lesson, lesson_id)
        if lesson is None:
            raise HTTPException(status_code=404, detail=f"课时不存在：{lesson_id}")
        return serialize_record("lessons", lesson)


@lesson_router.put("/{lesson_id}")
def update_lesson_by_id(lesson_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """按课时 ID 更新课时（不要求提供课程 ID）。

    参数：
        lesson_id: 课时 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的课时字典。

    异常：
        HTTPException: 课时不存在时返回 404。

    说明：
        供前端 updateLesson(lessonId, updates) 使用，与带课程路径的版本共用同一实现。
    """
    return _apply_lesson_updates(lesson_id, payload)


@lesson_router.delete("/{lesson_id}")
def delete_lesson_by_id(lesson_id: str) -> dict[str, Any]:
    """按课时 ID 删除课时（不要求提供课程 ID）。

    参数：
        lesson_id: 课时 ID。

    返回：
        {"success": true, "deleted_practice_records": n}

    异常：
        HTTPException: 课时不存在时返回 404。

    说明：
        供前端 deleteLesson(lessonId) 使用；带课程路径的版本额外校验归属。
    """
    return _delete_lesson_with_records(lesson_id)


@progress_router.get("/{course_id}")
def get_course_progress(course_id: str) -> dict[str, Any] | None:
    """读取课程学习进度。

    参数：
        course_id: 课程 ID。

    返回：
        进度字典；不存在时返回 null（前端按未开始处理）。
    """
    with session_scope() as session:
        progress: CourseProgress | None = session.get(CourseProgress, course_id)
        if progress is None:
            return None
        return serialize_record("courseProgress", progress)


@progress_router.put("/{course_id}")
def upsert_course_progress(course_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """写入（或覆盖）课程学习进度。

    参数：
        course_id: 课程 ID。
        payload: 前端 CourseProgress 字段（camelCase）。

    返回：
        写入后的进度字典。

    异常：
        HTTPException: 缺少必填字段时返回 400。
    """
    values, _ = extract_write_values("courseProgress", payload)

    # 主键由路径决定，忽略请求体中的 courseId
    values.pop("course_id", None)
    require_fields(
        "courseProgress",
        values,
        ("completion_percentage", "last_studied_at"),
    )
    values["course_id"] = course_id

    with session_scope() as session:
        progress: CourseProgress | None = session.get(CourseProgress, course_id)
        if progress is None:
            progress = CourseProgress(**values)
            session.add(progress)
        else:
            for column, value in values.items():
                setattr(progress, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("courseProgress", progress)

    logger.debug(
        "课程进度已更新：%s，完成度=%s",
        course_id,
        result.get("completionPercentage"),
    )
    return result
