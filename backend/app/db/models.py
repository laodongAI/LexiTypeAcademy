"""业务数据模型（17 张表）。

来源：
    由前端 Dexie（IndexedDB 库 LexiTypeAcademyDB）的 15 个 objectStore 1:1 映射而来，
    另新增 3 张学习计划表（study_plans / study_plan_tasks / study_plan_checkins），
    属于后端独有能力，不对应任何 Dexie 集合。
    按既定决策跳过 ttsCacheItems（音频 Blob 可重建，且换引擎后缓存键失效）。

约定：
    - 时间字段统一使用「毫秒时间戳整数」，与前端 Date.now() 语义一致
    - 数组/嵌套对象统一存为 JSON 列，保持与前端结构一致、迁移无损
    - 迁移期不设置外键约束：Dexie 本身无约束，强制外键会导致历史脏数据导入失败，
      数据一致性改由迁移校验报告保证（见 app/services/migration）
"""

from __future__ import annotations

from typing import Any, Optional

from sqlalchemy import JSON, Boolean, Float, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Course(Base):
    """课程表：对应 Dexie courses。"""

    # 表名与前端集合名采用统一小写风格
    __tablename__ = "courses"

    # 课程 ID（前端为字符串主键）
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 课程标题
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    # 课程描述
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 课程分类：basic / advanced / special
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 难度：beginner / intermediate / advanced
    difficulty: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # CEFR 等级（可选）
    cefr_level: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    # 课时数量（冗余字段，与前端一致）
    lesson_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 标签数组（JSON）
    tags: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 封面图（前端可能是本地路径或 dataURL）
    cover_image: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 创建时间（毫秒时间戳）
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 更新时间（毫秒时间戳）
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 是否预置课程
    is_preset: Mapped[Optional[bool]] = mapped_column(Boolean, nullable=True)
    # 作者
    author: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    # 课程内嵌课时快照：保留前端原始嵌套结构，避免迁移丢字段
    lessons_snapshot: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)


class Lesson(Base):
    """课时表：对应 Dexie lessons（含 courseId 外键字段）。"""

    __tablename__ = "lessons"

    # 课时 ID
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 所属课程 ID
    course_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 课时标题
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    # 课时描述
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 内容形态：word / phrase / sentence / passage / dialog
    content_shape: Mapped[str] = mapped_column(String(32), nullable=False)
    # 课时项目列表（JSON，保持嵌套结构）
    items: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 创建时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 更新时间
    updated_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class CourseProgress(Base):
    """课程进度表：对应 Dexie courseProgress（courseId 为主键）。"""

    __tablename__ = "course_progress"

    # 课程 ID（即主键）
    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 已完成课时 ID 数组
    completed_lesson_ids: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 当前学习课时 ID
    current_lesson_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 完成百分比（0-100）
    completion_percentage: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 最后学习时间（毫秒时间戳）
    last_studied_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class PracticeRecord(Base):
    """练习记录表：对应 Dexie practiceRecords（自增主键）。"""

    __tablename__ = "practice_records"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 课程 ID
    course_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 课时 ID
    lesson_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 练习模式
    mode: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 准确率（0-1 或 0-100，沿用前端原值不做换算）
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 耗时（毫秒）
    duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 完成时间（毫秒时间戳）
    completed_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 错误项目 ID 数组
    incorrect_item_ids: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 本次练习总题数（历史记录可能为空，表示未采集）
    total_items: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 本次练习答对题数（历史记录可能为空，表示未采集）
    correct_items: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 打字速度（词/分钟，按已输入字符数 / 5 / 分钟计算；语音类练习为空）
    wpm: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class LearningList(Base):
    """学习列表表：对应 Dexie learningList（courseId 为主键）。"""

    __tablename__ = "learning_list"

    # 课程 ID（主键）
    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 加入时间（毫秒时间戳）
    added_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 累计学习时长（分钟，与前端 LearningListItem 契约一致，可选）
    total_study_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class WordMasteryItem(Base):
    """单词掌握度表：对应 Dexie wordMasteryItems（复合主键 word+source）。"""

    __tablename__ = "word_mastery_items"

    # 单词（联合主键之一）
    word: Mapped[str] = mapped_column(String(256), primary_key=True)
    # 来源（联合主键之一，通常为课程 ID）
    source: Mapped[str] = mapped_column(String(128), primary_key=True)
    # 掌握等级 0-4
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    # 下次复习时间（毫秒时间戳）
    next_review: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 复习间隔（天）
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 复习次数
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 连续正确次数
    consecutive_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 上次复习时间
    last_review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 创建时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # SM-2 难度因子
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)


class ReviewLog(Base):
    """复习日志表：对应 Dexie reviewLogs（自增主键）。"""

    __tablename__ = "review_logs"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 单词
    word: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    # 来源
    source: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    # 复习时间（毫秒时间戳）
    review_date: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # SM-2 质量分 1-5
    quality: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 是否回答正确
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 反应时间（毫秒，可选）
    response_time: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 复习时的掌握等级
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class TypingRecord(Base):
    """打字记录表：对应 Dexie typingRecords（自增主键）。"""

    __tablename__ = "typing_records"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 打字速度（WPM）
    wpm: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 准确率
    accuracy: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 练习日期（毫秒时间戳）
    date: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 练习类型：typing / finger / pinyin / review
    practice_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 难度
    difficulty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    # 练习的单词（可选）
    word: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    # 来源（可选）
    source: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)


class LearningRecord(Base):
    """学习记录表：对应 Dexie learningRecords（自增主键）。"""

    __tablename__ = "learning_records"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 用户 ID（单用户体系下通常为空）
    user_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 课程 ID
    course_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    # 课时 ID
    lesson_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    # 活动类型：practice / review / game / typing
    activity_type: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 分数
    score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    # 准确率（可选）
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 耗时（毫秒）
    duration: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 创建时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 额外数据：数据库列名沿用前端字段名 metadata，属性名避开 SQLAlchemy 保留字
    extra_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(
        "metadata", JSON, nullable=True
    )


class Achievement(Base):
    """成就记录表：对应 Dexie achievements（自增主键）。"""

    __tablename__ = "achievements"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 成就类型
    type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 成就名称
    name: Mapped[str] = mapped_column(String(256), nullable=False)
    # 成就描述
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 获得时间（毫秒时间戳）
    unlocked_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 关联课程 ID（可选）
    course_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    # 关联课时 ID（可选）
    lesson_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)


class AiTaskLog(Base):
    """AI 任务日志表：对应 Dexie aiTaskLogs（自增主键）。"""

    __tablename__ = "ai_task_logs"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 任务类型
    type: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 任务状态：pending / running / completed / failed
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 输入参数（JSON）
    input: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # 输出结果（JSON）
    output: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # 错误信息
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 创建时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 完成时间（可选）
    completed_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)


class PracticeAttemptEvent(Base):
    """练习尝试事件表：对应 Dexie practiceAttemptEvents（自增主键）。"""

    __tablename__ = "practice_attempt_events"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 事件发生时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 课程 ID
    course_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 课时 ID
    lesson_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 练习单元 ID
    unit_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 练习模式
    mode: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 参考文本
    reference_text: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # 中文提示
    chinese_hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 用户输入文本
    user_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # ASR 识别文本
    recognized_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 是否判定正确
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 本题第几次尝试
    attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # 提交时的提示等级
    hint_level_at_submit: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 引擎建议的下一次提示等级
    next_hint_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 相似度（0-1）
    similarity: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 评分详情（JSON）
    score_detail: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    # 扩展字段（JSON）
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)


class UnitMasteryItem(Base):
    """Unit 掌握度表：对应 Dexie unitMasteryItems（复合主键 courseId+unitId+mode）。"""

    __tablename__ = "unit_mastery_items"

    # 课程 ID（联合主键）
    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 练习单元 ID（联合主键）
    unit_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 练习模式（联合主键）
    mode: Mapped[str] = mapped_column(String(32), primary_key=True)
    # 来源课时 ID（可选）
    lesson_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    # 掌握等级 0-4
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0, index=True)
    # 下次复习时间
    next_review: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 复习间隔（天）
    interval_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 复习次数
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 连续正确次数
    consecutive_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 上次复习时间
    last_review: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 创建时间
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # SM-2 难度因子
    ease_factor: Mapped[float] = mapped_column(Float, nullable=False, default=2.5)
    # 滚动准确率（0-1）
    rolling_accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    # 薄弱维度数组
    weak_dimensions: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 扩展字段
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)


class UnitReviewLog(Base):
    """Unit 复习日志表：对应 Dexie unitReviewLogs（自增主键）。"""

    __tablename__ = "unit_review_logs"

    # 自增主键
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # 课程 ID
    course_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 练习单元 ID
    unit_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 练习模式
    mode: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    # 来源课时 ID（可选）
    lesson_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    # 复习时间
    review_date: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # SM-2 质量分 0-5
    quality: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 是否回答正确
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # 复习时的掌握等级
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 薄弱维度数组
    weak_dimensions: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 扩展字段
    extra: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)


class StudyPlan(Base):
    """学习计划表（后端独有能力，无 Dexie 对应集合）。

    说明：
        一个计划可关联多个课程，并按每日时长目标安排学习；
        计划的「课时任务」不落库，由课程进度动态派生，避免出现第二事实源。
    """

    __tablename__ = "study_plans"

    # 计划 ID（字符串主键，由前端生成 UUID）
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 计划标题
    title: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    # 计划描述（可选）
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 关联课程 ID 数组（JSON，顺序即学习优先级）
    course_ids: Mapped[Optional[list[Any]]] = mapped_column(JSON, nullable=True)
    # 每日学习时长目标（分钟）
    daily_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    # 计划开始时间（毫秒时间戳）
    start_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 计划目标完成时间（毫秒时间戳，可选）
    target_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 计划状态：active（进行中）/ paused（已暂停）/ completed（已完成）
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="active", index=True
    )
    # 是否开启页面内提醒（今日学习时长未达标时展示横幅）
    reminder_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # 创建时间（毫秒时间戳）
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 更新时间（毫秒时间戳）
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class StudyPlanTask(Base):
    """学习计划自定义每日任务表。

    说明：
        只保存用户自建的额外任务；课时任务实时派生，不写入本表。
        due_date 为空表示「每天重复」，否则只在指定日期出现。
    """

    __tablename__ = "study_plan_tasks"

    # 任务 ID（字符串主键）
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 所属计划 ID（删除计划时级联清理）
    plan_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 任务标题
    title: Mapped[str] = mapped_column(String(512), nullable=False)
    # 计划执行日期（毫秒，当天 00:00；为空表示每天重复）
    due_date: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    # 完成时间（毫秒时间戳；为空表示未完成）
    done_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    # 创建时间（毫秒时间戳）
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 更新时间（毫秒时间戳）
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class StudyPlanCheckin(Base):
    """学习计划每日打卡快照表。

    说明：
        打卡时把当日学习结果固化为快照，历史回顾读取快照而不是实时重算，
        避免后续练习记录被删除导致历史数据失真。
        (plan_id, checkin_date) 唯一：同一天重复打卡按覆盖处理。
    """

    __tablename__ = "study_plan_checkins"

    # 打卡记录的约束：同计划同一天只能有一条
    __table_args__ = (
        UniqueConstraint("plan_id", "checkin_date", name="uq_study_plan_checkins_plan_date"),
    )

    # 打卡记录 ID（字符串主键）
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    # 所属计划 ID
    plan_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    # 打卡日期（毫秒，当天 00:00，用于唯一约束与倒推连续天数）
    checkin_date: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    # 当日学习时长快照（分钟）
    minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 当日完成课时数快照
    lesson_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 当日完成自定义任务数快照
    custom_task_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 当日复习单词数快照
    review_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    # 打卡备注（可选）
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    # 创建时间（毫秒时间戳）
    created_at: Mapped[int] = mapped_column(Integer, nullable=False, index=True)


class CourseCollection(Base):
    """课程集合节点：支持父子层级、排序和独立持久化。"""

    __tablename__ = "course_collections"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(256), nullable=False, index=True)
    parent_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)
    updated_at: Mapped[int] = mapped_column(Integer, nullable=False)


class CourseCollectionMembership(Base):
    """课程与集合的关系表；不改写课程 JSON/旧标签，便于平滑迁移。"""

    __tablename__ = "course_collection_memberships"
    __table_args__ = (UniqueConstraint("course_id", name="uq_course_collection_memberships_course"),)

    course_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    collection_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    created_at: Mapped[int] = mapped_column(Integer, nullable=False)


# 前端 Dexie 集合名 → ORM 模型 的映射表
# 说明：迁移导入按此映射逐表处理，新增表时必须同步维护
# 注意：学习计划三张表是后端独有能力，无 Dexie 来源，故不登记在此映射中
TABLE_MODEL_MAP: dict[str, type[Base]] = {
    "courses": Course,
    "lessons": Lesson,
    "courseProgress": CourseProgress,
    "practiceRecords": PracticeRecord,
    "learningList": LearningList,
    "wordMasteryItems": WordMasteryItem,
    "reviewLogs": ReviewLog,
    "typingRecords": TypingRecord,
    "learningRecords": LearningRecord,
    "achievements": Achievement,
    "aiTaskLogs": AiTaskLog,
    "practiceAttemptEvents": PracticeAttemptEvent,
    "unitMasteryItems": UnitMasteryItem,
    "unitReviewLogs": UnitReviewLog,
}

# 明确跳过的集合：音频 Blob 可重建，且换引擎后缓存键失效
SKIPPED_COLLECTIONS: tuple[str, ...] = ("ttsCacheItems",)
