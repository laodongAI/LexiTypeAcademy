"""学习计划路由（计划、自定义任务、打卡、看板聚合）。

职责：
- 学习计划 CRUD（多课程、每日时长目标、状态、提醒开关）
- 自定义每日任务 CRUD（课时任务不落库，由课程进度动态派生）
- 每日打卡快照写入（同计划同一天按覆盖处理）
- 计划看板聚合：进度、今日任务、到期复习、连续打卡、历史回顾

设计约束：
- 学习计划为后端独有能力，无 Dexie 历史数据，字段映射见 app/db/field_maps.py
- 课时任务、今日学习时长、到期复习数均为「实时派生」，不另建存储，避免第二事实源
- 打卡表只保存当日快照，历史回顾读快照，避免练习记录被删除导致历史失真
"""

from __future__ import annotations

import math
import time
import uuid
from datetime import datetime, timedelta
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
from app.db.models import (
    Course,
    CourseProgress,
    Lesson,
    PracticeRecord,
    ReviewLog,
    StudyPlan,
    StudyPlanCheckin,
    StudyPlanTask,
    WordMasteryItem,
)

# 模块级日志器
logger = get_logger(__name__)

# 计划路由：挂载在 /api/study-plans
plan_router = APIRouter(prefix="/study-plans", tags=["study-plans"])

# 自定义任务路由：挂载在 /api/study-plan-tasks
task_router = APIRouter(prefix="/study-plan-tasks", tags=["study-plans"])

# 打卡路由：挂载在 /api/study-plan-checkins
checkin_router = APIRouter(prefix="/study-plan-checkins", tags=["study-plans"])

# 合法计划状态集合：与前端类型定义保持一致
VALID_PLAN_STATUS: tuple[str, ...] = ("active", "paused", "completed")

# 每计划最多派生的课时任务数量：避免任务清单过长造成压迫感
MAX_LESSON_TASKS: int = 3

# 历史回顾默认返回的打卡条数
DEFAULT_CHECKIN_LIMIT: int = 30

# 一周天数常量：用于周完成率计算
DAYS_PER_WEEK: int = 7


# ---------------------------------------------------------------------------
# 时间工具：统一使用本地时区的「毫秒时间戳 + 当天零点」
# ---------------------------------------------------------------------------


def _now_ms() -> int:
    """返回当前毫秒时间戳，与前端 Date.now() 语义一致。"""
    return int(time.time() * 1000)


def _day_start_ms(timestamp_ms: int) -> int:
    """把任意毫秒时间戳归一化为当天零点（本地时区）。

    参数：
        timestamp_ms: 毫秒时间戳。

    返回：
        当天 00:00:00 的毫秒时间戳。

    说明：
        打卡日期、任务执行日期都以该口径存储，保证「同一天」判定不受时刻影响。
    """
    moment: datetime = datetime.fromtimestamp(timestamp_ms / 1000)
    return int(
        moment.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
    )


def _today_start_ms() -> int:
    """返回今日零点的毫秒时间戳。"""
    return _day_start_ms(_now_ms())


def _shift_days(day_start_ms: int, delta_days: int) -> int:
    """把「当天零点」按自然日平移。

    参数：
        day_start_ms: 某天的零点毫秒时间戳。
        delta_days: 平移天数，负数向前。

    返回：
        平移后那一天的零点毫秒时间戳。

    说明：
        使用 datetime 做自然日运算，避免直接减 86400000 在时区/夏令时下的偏差。
    """
    moment: datetime = datetime.fromtimestamp(day_start_ms / 1000)
    shifted: datetime = moment + timedelta(days=delta_days)
    return int(
        shifted.replace(hour=0, minute=0, second=0, microsecond=0).timestamp() * 1000
    )


def _new_id() -> str:
    """生成字符串主键（UUID4 十六进制），与前端 crypto.randomUUID 风格一致。"""
    return uuid.uuid4().hex


# ---------------------------------------------------------------------------
# 计划序列化与读取工具
# ---------------------------------------------------------------------------


def _serialize_plan(plan: StudyPlan) -> dict[str, Any]:
    """把计划 ORM 对象序列化为前端契约结构。

    参数：
        plan: 计划 ORM 实例。

    返回：
        camelCase 字典；courseIds 统一为数组，避免前端判空分支。

    说明：
        字段映射唯一来源是 FIELD_MAPS["studyPlans"]。
    """
    result: dict[str, Any] = serialize_record("studyPlans", plan)
    # 历史数据可能为 NULL，统一归一化为数组
    if not isinstance(result.get("courseIds"), list):
        result["courseIds"] = []
    return result


def _get_plan_or_404(session: Session, plan_id: str) -> StudyPlan:
    """按 ID 读取计划，不存在时抛出 404。

    参数：
        session: 数据库会话。
        plan_id: 计划 ID。

    返回：
        计划 ORM 实例。

    异常：
        HTTPException: 计划不存在时返回 404。
    """
    plan: StudyPlan | None = session.get(StudyPlan, plan_id)
    if plan is None:
        logger.warning("学习计划不存在：%s", plan_id)
        raise HTTPException(status_code=404, detail=f"学习计划不存在：{plan_id}")
    return plan


def _plan_course_ids(plan: StudyPlan) -> list[str]:
    """提取计划关联的课程 ID 列表（过滤空值，保持顺序）。

    参数：
        plan: 计划 ORM 实例。

    返回：
        课程 ID 数组；无关联课程时返回空数组。
    """
    raw: Any = plan.course_ids or []
    if not isinstance(raw, list):
        return []
    return [str(item) for item in raw if item]


def _plan_task_applies_today(task: StudyPlanTask, today_start: int) -> bool:
    """判断自定义任务是否属于「今日任务」。

    参数：
        task: 自定义任务 ORM 实例。
        today_start: 今日零点毫秒时间戳。

    返回：
        due_date 为空（每天重复）或等于今日时返回 True。

    说明：
        已过期但未完成的日期任务不再进入今日清单，避免陈旧任务长期堆积。
    """
    return task.due_date is None or task.due_date == today_start


def _is_task_done_today(task: StudyPlanTask, today_start: int, today_end: int) -> bool:
    """判断自定义任务是否「今日已完成」。

    参数：
        task: 自定义任务 ORM 实例。
        today_start: 今日零点毫秒时间戳。
        today_end: 明日零点毫秒时间戳（不含）。

    返回：
        done_at 落在今日区间内时返回 True。

    说明：
        每日重复任务需要在次日重新完成，因此必须按 done_at 落在今日判定；
        单日任务同样复用该规则，口径一致。
    """
    return task.done_at is not None and today_start <= task.done_at < today_end


# ---------------------------------------------------------------------------
# 派生指标（课时任务、今日时长、到期复习）
# ---------------------------------------------------------------------------


def _load_course_progress(
    session: Session, course_ids: list[str]
) -> dict[str, CourseProgress]:
    """批量读取课程进度，返回 courseId → 进度 的字典。

    参数：
        session: 数据库会话。
        course_ids: 课程 ID 列表。

    返回：
        课程进度字典；未学习过的课程不在字典中。
    """
    if not course_ids:
        return {}
    rows: list[CourseProgress] = list(
        session.execute(
            select(CourseProgress).where(CourseProgress.course_id.in_(course_ids))
        ).scalars()
    )
    return {row.course_id: row for row in rows}


def _derive_course_progress(
    session: Session, plan: StudyPlan
) -> dict[str, Any]:
    """派生计划的课程进度与课时任务。

    参数：
        session: 数据库会话。
        plan: 计划 ORM 实例。

    返回：
        {
            "totalLessons": n, "completedLessons": n, "percentage": 0-100,
            "courses": [每课程明细],
            "lessonTasks": [最多 MAX_LESSON_TASKS 个未完成课时]
        }

    说明：
        课时任务完全由 lessons + course_progress 实时派生，不落库。
        进度按「已完成课时数 / 总课时数」计算，跨课程汇总。
    """
    course_ids: list[str] = _plan_course_ids(plan)

    # 无关联课程时返回空进度，前端据此展示引导
    if not course_ids:
        return {
            "totalLessons": 0,
            "completedLessons": 0,
            "percentage": 0.0,
            "courses": [],
            "lessonTasks": [],
        }

    # 课程标题映射：用于任务清单展示
    course_rows: list[Course] = list(
        session.execute(select(Course).where(Course.id.in_(course_ids))).scalars()
    )
    course_titles: dict[str, str] = {row.id: row.title for row in course_rows}

    # 一次取出所有课时，按课程分组并保持课程内创建顺序
    lesson_rows: list[Lesson] = list(
        session.execute(
            select(Lesson)
            .where(Lesson.course_id.in_(course_ids))
            .order_by(Lesson.created_at.asc())
        ).scalars()
    )
    lessons_by_course: dict[str, list[Lesson]] = {course_id: [] for course_id in course_ids}
    for lesson in lesson_rows:
        lessons_by_course.setdefault(lesson.course_id, []).append(lesson)

    # 进度映射
    progress_map: dict[str, CourseProgress] = _load_course_progress(session, course_ids)

    total_lessons: int = 0
    completed_lessons: int = 0
    courses_detail: list[dict[str, Any]] = []
    lesson_tasks: list[dict[str, Any]] = []

    # 按计划中的课程顺序派生，保证任务优先级稳定
    for course_id in course_ids:
        lessons: list[Lesson] = lessons_by_course.get(course_id, [])
        progress: Optional[CourseProgress] = progress_map.get(course_id)
        completed_ids: set[str] = set(progress.completed_lesson_ids or []) if progress else set()

        course_total: int = len(lessons)
        course_completed: int = len([lesson for lesson in lessons if lesson.id in completed_ids])
        total_lessons += course_total
        completed_lessons += course_completed

        # 该课程下一个待学课时：第一个未完成的课时
        next_lesson: Optional[Lesson] = next(
            (lesson for lesson in lessons if lesson.id not in completed_ids), None
        )

        courses_detail.append(
            {
                "courseId": course_id,
                "title": course_titles.get(course_id, course_id),
                "totalLessons": course_total,
                "completedLessons": course_completed,
                "percentage": round(course_completed / course_total * 100, 1)
                if course_total
                else 0.0,
                "nextLesson": (
                    {"lessonId": next_lesson.id, "lessonTitle": next_lesson.title}
                    if next_lesson
                    else None
                ),
            }
        )

        # 课时任务：跨课程累计，最多 MAX_LESSON_TASKS 个
        if len(lesson_tasks) < MAX_LESSON_TASKS:
            for lesson in lessons:
                if lesson.id in completed_ids:
                    continue
                lesson_tasks.append(
                    {
                        "courseId": course_id,
                        "courseTitle": course_titles.get(course_id, course_id),
                        "lessonId": lesson.id,
                        "lessonTitle": lesson.title,
                    }
                )
                if len(lesson_tasks) >= MAX_LESSON_TASKS:
                    break

    percentage: float = (
        round(completed_lessons / total_lessons * 100, 1) if total_lessons else 0.0
    )

    return {
        "totalLessons": total_lessons,
        "completedLessons": completed_lessons,
        "percentage": percentage,
        "courses": courses_detail,
        "lessonTasks": lesson_tasks,
    }


def _derive_daily_metrics(
    session: Session,
    plan: StudyPlan,
    day_start: int,
) -> dict[str, int]:
    """派生指定日期的学习指标（练习时长、完成课时数、复习数）。

    参数：
        session: 数据库会话。
        plan: 计划 ORM 实例。
        day_start: 目标日期的零点毫秒时间戳。

    返回：
        {"minutes": 分钟, "lessonCount": 课时数, "reviewCount": 复习单词数}

    说明：
        练习记录按计划关联课程过滤（计划未关联课程时统计全部），
        复习日志为全局数据（复习页不区分计划），两者口径与各自页面一致。
    """
    day_end: int = _shift_days(day_start, 1)
    course_ids: list[str] = _plan_course_ids(plan)

    # 当日练习记录
    practice_statement = select(PracticeRecord).where(
        PracticeRecord.completed_at >= day_start,
        PracticeRecord.completed_at < day_end,
    )
    if course_ids:
        practice_statement = practice_statement.where(
            PracticeRecord.course_id.in_(course_ids)
        )
    practice_rows: list[PracticeRecord] = list(
        session.execute(practice_statement).scalars()
    )

    # 毫秒时长汇总后四舍五入为分钟
    total_duration_ms: int = sum(row.duration or 0 for row in practice_rows)
    minutes: int = int(round(total_duration_ms / 60000))

    # 当日完成的不同课时数
    lesson_ids: set[str] = {row.lesson_id for row in practice_rows if row.lesson_id}

    # 当日复习日志：按 word+source 去重得到复习单词数
    log_rows: list[ReviewLog] = list(
        session.execute(
            select(ReviewLog).where(
                ReviewLog.review_date >= day_start,
                ReviewLog.review_date < day_end,
            )
        ).scalars()
    )
    review_keys: set[str] = {f"{row.word}-{row.source}" for row in log_rows}

    metrics: dict[str, int] = {
        "minutes": minutes,
        "lessonCount": len(lesson_ids),
        "reviewCount": len(review_keys),
    }
    logger.debug("派生每日指标：计划=%s，日期=%s，结果=%s", plan.id, day_start, metrics)
    return metrics


def _count_due_reviews(session: Session) -> int:
    """统计当前到期需要复习的单词数。

    参数：
        session: 数据库会话。

    返回：
        到期单词数量（next_review <= 当前时间）。

    说明：
        口径与 GET /api/review/stats 的 dueToday 完全一致。
    """
    now_ms: int = _now_ms()
    rows: list[str] = list(
        session.execute(
            select(WordMasteryItem.word).where(WordMasteryItem.next_review <= now_ms)
        ).scalars()
    )
    return len(rows)


def _count_streak_days(checkin_dates: set[int], today_start: int) -> int:
    """从打卡日期集合倒推连续打卡天数。

    参数：
        checkin_dates: 已打卡日期（当天零点毫秒时间戳）集合。
        today_start: 今日零点毫秒时间戳。

    返回：
        连续打卡天数。

    说明：
        今日尚未打卡时从昨日开始倒推，保证白天查看时连续天数不会归零；
        若昨日也未打卡则连续天数为 0。
    """
    # 确定倒推起点：今日有打卡从今日开始，否则从昨日开始
    cursor: int = today_start if today_start in checkin_dates else _shift_days(today_start, -1)
    if cursor not in checkin_dates:
        return 0

    streak: int = 0
    while cursor in checkin_dates:
        streak += 1
        cursor = _shift_days(cursor, -1)

        # 防御性上限：避免异常数据导致无限循环
        if streak > 3650:
            break

    return streak


# ---------------------------------------------------------------------------
# 学习计划 CRUD
# ---------------------------------------------------------------------------


@plan_router.get("")
def list_study_plans(
    status: Optional[str] = Query(default=None, description="状态过滤：active/paused/completed"),
) -> dict[str, Any]:
    """查询学习计划列表（按更新时间倒序）。

    参数：
        status: 状态过滤，可选。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = []
    if status:
        conditions.append(StudyPlan.status == status)

    with session_scope() as session:
        rows: list[StudyPlan] = list(
            session.execute(
                select(StudyPlan)
                .where(*conditions)
                .order_by(StudyPlan.updated_at.desc())
            ).scalars()
        )

    logger.debug("学习计划列表：状态=%s，返回=%s", status, len(rows))
    return {"items": [_serialize_plan(row) for row in rows], "total": len(rows)}


@plan_router.post("", status_code=201)
def create_study_plan(payload: dict[str, Any]) -> dict[str, Any]:
    """新建学习计划。

    参数：
        payload: 前端 StudyPlan（camelCase），id 可省略。

    返回：
        创建后的计划字典。

    异常：
        HTTPException: 缺少必填字段或状态非法时返回 400，ID 冲突返回 409。
    """
    values, _ = extract_write_values("studyPlans", payload)

    now_ms: int = _now_ms()
    # 主键缺失时由后端生成
    if not values.get("id"):
        values["id"] = _new_id()

    # 补齐默认值，保证前端只传最小字段也能创建
    values.setdefault("status", "active")
    values.setdefault("daily_minutes", 30)
    values.setdefault("reminder_enabled", True)
    values.setdefault("course_ids", [])
    values.setdefault("created_at", now_ms)
    values.setdefault("updated_at", now_ms)

    require_fields("studyPlans", values, ("id", "title", "start_at"))

    if values["status"] not in VALID_PLAN_STATUS:
        raise HTTPException(status_code=400, detail=f"计划状态非法：{values['status']}")

    with session_scope() as session:
        # 显式检查 ID 冲突，给出比主键异常更清晰的中文提示
        if session.get(StudyPlan, values["id"]) is not None:
            raise HTTPException(status_code=409, detail=f"学习计划已存在：{values['id']}")

        plan = StudyPlan(**values)
        session.add(plan)
        session.flush()

        result: dict[str, Any] = _serialize_plan(plan)

    logger.info("学习计划已创建：%s（%s）", result.get("id"), values["title"])
    return result


@plan_router.put("/{plan_id}")
def update_study_plan(plan_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """更新学习计划（部分更新）。

    参数：
        plan_id: 计划 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的计划字典。

    异常：
        HTTPException: 计划不存在返回 404，状态非法返回 400。
    """
    values, _ = extract_write_values("studyPlans", payload)

    # 主键不允许通过更新接口修改
    values.pop("id", None)
    # 未显式提供更新时间时由服务端补齐
    values.setdefault("updated_at", _now_ms())

    if "status" in values and values["status"] not in VALID_PLAN_STATUS:
        raise HTTPException(status_code=400, detail=f"计划状态非法：{values['status']}")

    with session_scope() as session:
        plan: StudyPlan = _get_plan_or_404(session, plan_id)

        for column, value in values.items():
            setattr(plan, column, value)
        session.flush()

        result: dict[str, Any] = _serialize_plan(plan)

    logger.info("学习计划已更新：%s，字段=%s", plan_id, ", ".join(values.keys()))
    return result


@plan_router.delete("/{plan_id}")
def delete_study_plan(plan_id: str) -> dict[str, Any]:
    """删除学习计划，并级联清理自定义任务与打卡记录。

    参数：
        plan_id: 计划 ID。

    返回：
        {"success": true, "deleted_tasks": n, "deleted_checkins": m}

    异常：
        HTTPException: 计划不存在时返回 404。

    说明：
        练习记录、复习日志属于全局学习数据，不随计划删除，避免误删历史学习成果。
    """
    with session_scope() as session:
        plan: StudyPlan = _get_plan_or_404(session, plan_id)

        task_result = session.execute(
            delete(StudyPlanTask).where(StudyPlanTask.plan_id == plan_id)
        )
        checkin_result = session.execute(
            delete(StudyPlanCheckin).where(StudyPlanCheckin.plan_id == plan_id)
        )
        session.delete(plan)

        deleted_tasks: int = task_result.rowcount or 0
        deleted_checkins: int = checkin_result.rowcount or 0

    logger.info(
        "学习计划已删除：%s，任务 %s 条，打卡 %s 条",
        plan_id,
        deleted_tasks,
        deleted_checkins,
    )
    return {
        "success": True,
        "deleted_tasks": deleted_tasks,
        "deleted_checkins": deleted_checkins,
    }


# ---------------------------------------------------------------------------
# 自定义每日任务 CRUD
# ---------------------------------------------------------------------------


@task_router.get("")
def list_study_plan_tasks(
    plan_id: str = Query(alias="planId", description="所属计划 ID"),
    date: Optional[int] = Query(
        default=None,
        description="筛选某天（毫秒，任意时刻）；提供时仅返回当天生效的任务",
    ),
) -> dict[str, Any]:
    """查询计划下的自定义任务。

    参数：
        plan_id: 所属计划 ID（必填）。
        date: 目标日期（毫秒），可选；提供时只返回 due_date 为空或等于该日的任务。

    返回：
        {"items": [...], "total": n}

    说明：
        due_date 为空的「每日任务」在任意日期都生效，按创建时间正序返回。
    """
    conditions: list[Any] = [StudyPlanTask.plan_id == plan_id]

    # 指定日期时按「当天生效」过滤
    if date is not None:
        day_start: int = _day_start_ms(date)
        conditions.append(
            (StudyPlanTask.due_date.is_(None)) | (StudyPlanTask.due_date == day_start)
        )

    with session_scope() as session:
        # 计划不存在时直接 404，避免返回空列表造成误解
        _get_plan_or_404(session, plan_id)
        rows: list[StudyPlanTask] = list(
            session.execute(
                select(StudyPlanTask)
                .where(*conditions)
                .order_by(StudyPlanTask.created_at.asc())
            ).scalars()
        )

    return {
        "items": serialize_records("studyPlanTasks", rows),
        "total": len(rows),
    }


@task_router.post("", status_code=201)
def create_study_plan_task(payload: dict[str, Any]) -> dict[str, Any]:
    """新增自定义每日任务。

    参数：
        payload: 前端 StudyPlanTask（camelCase），id 可省略。

    返回：
        创建后的任务字典。

    异常：
        HTTPException: 缺少必填字段返回 400；计划不存在返回 404；ID 冲突返回 409。
    """
    values, _ = extract_write_values("studyPlanTasks", payload)

    now_ms: int = _now_ms()
    if not values.get("id"):
        values["id"] = _new_id()

    # 只保留日期部分，保证同一天的任务可被稳定筛选
    if values.get("due_date") is not None:
        values["due_date"] = _day_start_ms(int(values["due_date"]))

    values.setdefault("created_at", now_ms)
    values.setdefault("updated_at", now_ms)

    require_fields("studyPlanTasks", values, ("id", "plan_id", "title"))

    with session_scope() as session:
        _get_plan_or_404(session, values["plan_id"])

        if session.get(StudyPlanTask, values["id"]) is not None:
            raise HTTPException(status_code=409, detail=f"任务已存在：{values['id']}")

        task = StudyPlanTask(**values)
        session.add(task)
        session.flush()

        result: dict[str, Any] = serialize_record("studyPlanTasks", task)

    logger.info("自定义任务已创建：%s（计划 %s）", result.get("id"), values["plan_id"])
    return result


@task_router.put("/{task_id}")
def update_study_plan_task(task_id: str, payload: dict[str, Any]) -> dict[str, Any]:
    """更新自定义任务（部分更新，含完成/取消完成）。

    参数：
        task_id: 任务 ID。
        payload: 需要更新的字段（camelCase）。

    返回：
        更新后的任务字典。

    异常：
        HTTPException: 任务不存在时返回 404。
    """
    values, _ = extract_write_values("studyPlanTasks", payload)

    # 主键与所属计划不允许修改
    values.pop("id", None)
    values.pop("plan_id", None)

    # 日期字段归一化为当天零点
    if values.get("due_date") is not None:
        values["due_date"] = _day_start_ms(int(values["due_date"]))

    values.setdefault("updated_at", _now_ms())

    with session_scope() as session:
        task: StudyPlanTask | None = session.get(StudyPlanTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"任务不存在：{task_id}")

        for column, value in values.items():
            setattr(task, column, value)
        session.flush()

        result: dict[str, Any] = serialize_record("studyPlanTasks", task)

    logger.info("自定义任务已更新：%s，字段=%s", task_id, ", ".join(values.keys()))
    return result


@task_router.delete("/{task_id}")
def delete_study_plan_task(task_id: str) -> dict[str, Any]:
    """删除自定义任务。

    参数：
        task_id: 任务 ID。

    返回：
        {"success": true}

    异常：
        HTTPException: 任务不存在时返回 404。
    """
    with session_scope() as session:
        task: StudyPlanTask | None = session.get(StudyPlanTask, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail=f"任务不存在：{task_id}")
        session.delete(task)

    logger.info("自定义任务已删除：%s", task_id)
    return {"success": True}


# ---------------------------------------------------------------------------
# 打卡
# ---------------------------------------------------------------------------


@checkin_router.get("")
def list_study_plan_checkins(
    plan_id: str = Query(alias="planId", description="所属计划 ID"),
    start: Optional[int] = Query(default=None, description="日期下界（毫秒，含）"),
    end: Optional[int] = Query(default=None, description="日期上界（毫秒，含）"),
    limit: int = Query(default=DEFAULT_CHECKIN_LIMIT, ge=1, le=365),
) -> dict[str, Any]:
    """查询打卡记录（按打卡日期倒序）。

    参数：
        plan_id: 所属计划 ID（必填）。
        start: 日期下界（毫秒），可选。
        end: 日期上界（毫秒），可选。
        limit: 返回条数上限。

    返回：
        {"items": [...], "total": n}
    """
    conditions: list[Any] = [StudyPlanCheckin.plan_id == plan_id]
    if start is not None:
        conditions.append(StudyPlanCheckin.checkin_date >= _day_start_ms(start))
    if end is not None:
        conditions.append(StudyPlanCheckin.checkin_date <= _day_start_ms(end))

    with session_scope() as session:
        _get_plan_or_404(session, plan_id)
        rows: list[StudyPlanCheckin] = list(
            session.execute(
                select(StudyPlanCheckin)
                .where(*conditions)
                .order_by(StudyPlanCheckin.checkin_date.desc())
                .limit(limit)
            ).scalars()
        )

    return {
        "items": serialize_records("studyPlanCheckins", rows),
        "total": len(rows),
    }


@checkin_router.post("", status_code=201)
def create_or_update_checkin(payload: dict[str, Any]) -> dict[str, Any]:
    """写入当日打卡快照（同计划同一天按覆盖处理）。

    参数：
        payload: 前端请求体，至少包含 planId；
                 checkinDate 缺省为今日，其余指标缺省时由后端实时派生后固化。

    返回：
        打卡记录字典（覆盖时包含原有的 createdAt）。

    异常：
        HTTPException: 缺少必填字段返回 400；计划不存在返回 404。

    说明：
        快照指标默认取「练习时长、完成课时数、复习单词数、已完成自定义任务数」，
        前端显式传入时以传入值为准，便于用户修正记录。
    """
    values, _ = extract_write_values("studyPlanCheckins", payload)

    now_ms: int = _now_ms()
    # 打卡日期统一归一化为当天零点
    checkin_date: int = _day_start_ms(int(values.get("checkin_date") or now_ms))
    values["checkin_date"] = checkin_date

    require_fields("studyPlanCheckins", values, ("plan_id",))

    plan_id: str = str(values["plan_id"])
    day_end: int = _shift_days(checkin_date, 1)

    with session_scope() as session:
        plan: StudyPlan = _get_plan_or_404(session, plan_id)

        # 后端派生默认值：只有前端未提供时才计算，避免覆盖用户修正
        if any(
            values.get(column) is None
            for column in ("minutes", "lesson_count", "review_count")
        ):
            metrics: dict[str, int] = _derive_daily_metrics(session, plan, checkin_date)
            values.setdefault("minutes", metrics["minutes"])
            values.setdefault("lesson_count", metrics["lessonCount"])
            values.setdefault("review_count", metrics["reviewCount"])

        # 已完成自定义任务数：按 done_at 落在当天判定
        if values.get("custom_task_count") is None:
            task_rows: list[StudyPlanTask] = list(
                session.execute(
                    select(StudyPlanTask).where(StudyPlanTask.plan_id == plan_id)
                ).scalars()
            )
            values["custom_task_count"] = len(
                [
                    task
                    for task in task_rows
                    if task.done_at is not None and checkin_date <= task.done_at < day_end
                ]
            )

        # 同一天重复打卡：覆盖指标，保留原主键与创建时间
        existing: StudyPlanCheckin | None = session.execute(
            select(StudyPlanCheckin).where(
                StudyPlanCheckin.plan_id == plan_id,
                StudyPlanCheckin.checkin_date == checkin_date,
            )
        ).scalars().first()

        if existing is None:
            values.setdefault("id", _new_id())
            values.setdefault("note", None)
            values.setdefault("created_at", now_ms)
            record = StudyPlanCheckin(**values)
            session.add(record)
        else:
            record = existing
            # 主键与日期不可变，其余字段覆盖
            for column in ("minutes", "lesson_count", "custom_task_count", "review_count", "note"):
                if column in values:
                    setattr(record, column, values[column])

        session.flush()
        result: dict[str, Any] = serialize_record("studyPlanCheckins", record)

    logger.info(
        "打卡已写入：计划=%s，日期=%s，分钟=%s，覆盖=%s",
        plan_id,
        checkin_date,
        result.get("minutes"),
        existing is not None,
    )
    return result


# ---------------------------------------------------------------------------
# 计划看板（一次请求返回详情页所需全部派生数据）
# ---------------------------------------------------------------------------


@plan_router.get("/{plan_id}/dashboard")
def get_plan_dashboard(plan_id: str) -> dict[str, Any]:
    """获取计划详情页看板数据。

    参数：
        plan_id: 计划 ID。

    返回：
        {
            "plan": 计划,
            "progress": 课程进度与课时任务,
            "today": 今日指标与目标达成,
            "lessonTasks": 待学课时任务,
            "customTasks": 今日自定义任务（含完成态）,
            "streakDays": 连续打卡天数,
            "weekCompletionRate": 近 7 天打卡完成率（0-1）,
            "recentCheckins": 最近打卡记录,
            "dueReviewCount": 到期复习单词数,
            "reminder": 页面内提醒文案（无需提醒时为 null）
        }

    异常：
        HTTPException: 计划不存在时返回 404。

    说明：
        该接口是「学习计划」唯一聚合入口，前端不再分别拼装多个接口，
        保证今日任务、进度、提醒的判定口径只存在一处。
    """
    today_start: int = _today_start_ms()
    today_end: int = _shift_days(today_start, 1)
    now_ms: int = _now_ms()

    with session_scope() as session:
        plan: StudyPlan = _get_plan_or_404(session, plan_id)

        # 课程进度与课时任务（派生）
        progress: dict[str, Any] = _derive_course_progress(session, plan)

        # 今日学习指标（派生）
        metrics: dict[str, int] = _derive_daily_metrics(session, plan, today_start)

        # 到期复习数
        due_review_count: int = _count_due_reviews(session)

        # 今日自定义任务
        task_rows: list[StudyPlanTask] = list(
            session.execute(
                select(StudyPlanTask)
                .where(StudyPlanTask.plan_id == plan_id)
                .order_by(StudyPlanTask.created_at.asc())
            ).scalars()
        )
        today_tasks: list[StudyPlanTask] = [
            task for task in task_rows if _plan_task_applies_today(task, today_start)
        ]
        custom_tasks: list[dict[str, Any]] = [
            {
                **serialize_record("studyPlanTasks", task),
                # 显式给出「今日是否已完成」，避免前端重复实现判定
                "doneToday": _is_task_done_today(task, today_start, today_end),
            }
            for task in today_tasks
        ]
        custom_done_count: int = len(
            [item for item in custom_tasks if item["doneToday"]]
        )

        # 打卡记录：用于连续天数、周完成率与历史回顾
        checkin_rows: list[StudyPlanCheckin] = list(
            session.execute(
                select(StudyPlanCheckin)
                .where(StudyPlanCheckin.plan_id == plan_id)
                .order_by(StudyPlanCheckin.checkin_date.desc())
            ).scalars()
        )

    checkin_dates: set[int] = {row.checkin_date for row in checkin_rows}
    streak_days: int = _count_streak_days(checkin_dates, today_start)

    # 近 7 天（含今日）打卡完成率
    window_start: int = _shift_days(today_start, -(DAYS_PER_WEEK - 1))
    week_checkins: int = len(
        [date for date in checkin_dates if window_start <= date <= today_start]
    )
    week_completion_rate: float = round(week_checkins / DAYS_PER_WEEK, 2)

    # 目标达成百分比：避免除零
    goal_minutes: int = plan.daily_minutes or 0
    goal_percent: float = (
        round(metrics["minutes"] / goal_minutes * 100, 1) if goal_minutes else 0.0
    )

    # 页面内提醒：仅在开启提醒、计划进行中、今日未达标时给出
    reminder: Optional[dict[str, str]] = None
    if (
        plan.reminder_enabled
        and plan.status == "active"
        and goal_minutes > 0
        and metrics["minutes"] < goal_minutes
    ):
        remaining: int = max(goal_minutes - metrics["minutes"], 0)
        reminder = {
            "message": f"今日还差 {remaining} 分钟达成目标，继续保持！",
        }

    # 计算计划剩余天数：无目标日期时为空
    remaining_days: Optional[int] = None
    if plan.target_at:
        remaining_ms: int = plan.target_at - now_ms
        remaining_days = max(math.ceil(remaining_ms / 86400000), 0)

    result: dict[str, Any] = {
        "plan": {**_serialize_plan(plan), "remainingDays": remaining_days},
        "progress": {
            "totalLessons": progress["totalLessons"],
            "completedLessons": progress["completedLessons"],
            "percentage": progress["percentage"],
            "courses": progress["courses"],
        },
        "today": {
            "minutes": metrics["minutes"],
            "goalMinutes": goal_minutes,
            "goalPercent": goal_percent,
            "lessonCount": metrics["lessonCount"],
            "reviewCount": metrics["reviewCount"],
            "customTaskTotal": len(custom_tasks),
            "customTaskDone": custom_done_count,
            "dueReviewCount": due_review_count,
            "checkedIn": today_start in checkin_dates,
        },
        "lessonTasks": progress["lessonTasks"],
        "customTasks": custom_tasks,
        "streakDays": streak_days,
        "weekCompletionRate": week_completion_rate,
        "recentCheckins": serialize_records(
            "studyPlanCheckins", checkin_rows[:DEFAULT_CHECKIN_LIMIT]
        ),
        "dueReviewCount": due_review_count,
        "reminder": reminder,
    }

    logger.debug(
        "计划看板：%s，今日分钟=%s，课时任务=%s，自定义任务=%s，连续打卡=%s",
        plan_id,
        metrics["minutes"],
        len(progress["lessonTasks"]),
        len(custom_tasks),
        streak_days,
    )
    return result
