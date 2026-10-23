/**
 * 学习计划相关类型定义
 *
 * 说明：
 * - 字段与后端 /api/study-plans 系列接口的 camelCase 契约一一对应
 * - 课时任务、今日时长等派生数据只由后端看板接口计算，前端不重复实现口径
 */

/** 计划状态：进行中 / 已暂停 / 已完成 */
export type StudyPlanStatus = 'active' | 'paused' | 'completed'

/** 学习计划 */
export interface StudyPlan {
  /** 计划 ID */
  id: string
  /** 计划标题 */
  title: string
  /** 计划描述（可空） */
  description?: string | null
  /** 关联课程 ID 数组（顺序即学习优先级） */
  courseIds: string[]
  /** 每日学习时长目标（分钟） */
  dailyMinutes: number
  /** 计划开始时间（毫秒时间戳） */
  startAt: number
  /** 计划目标完成时间（毫秒时间戳，可空） */
  targetAt?: number | null
  /** 计划状态 */
  status: StudyPlanStatus
  /** 是否开启页面内提醒 */
  reminderEnabled: boolean
  /** 创建时间（毫秒时间戳） */
  createdAt: number
  /** 更新时间（毫秒时间戳） */
  updatedAt: number
}

/** 自定义每日任务 */
export interface StudyPlanTask {
  /** 任务 ID */
  id: string
  /** 所属计划 ID */
  planId: string
  /** 任务标题 */
  title: string
  /** 执行日期（毫秒，当天 00:00；为空表示每天重复） */
  dueDate?: number | null
  /** 完成时间（毫秒时间戳；为空表示未完成） */
  doneAt?: number | null
  /** 创建时间 */
  createdAt: number
  /** 更新时间 */
  updatedAt: number
}

/** 打卡快照 */
export interface StudyPlanCheckin {
  /** 打卡记录 ID */
  id: string
  /** 所属计划 ID */
  planId: string
  /** 打卡日期（毫秒，当天 00:00） */
  checkinDate: number
  /** 当日学习时长快照（分钟） */
  minutes: number
  /** 当日完成课时数快照 */
  lessonCount: number
  /** 当日完成自定义任务数快照 */
  customTaskCount: number
  /** 当日复习单词数快照 */
  reviewCount: number
  /** 打卡备注（可空） */
  note?: string | null
  /** 创建时间 */
  createdAt: number
}

/** 看板中的单课程进度 */
export interface PlanCourseProgress {
  /** 课程 ID */
  courseId: string
  /** 课程标题 */
  title: string
  /** 课时总数 */
  totalLessons: number
  /** 已完成课时数 */
  completedLessons: number
  /** 完成百分比（0-100） */
  percentage: number
  /** 下一个待学课时（无剩余课时时为 null） */
  nextLesson: { lessonId: string; lessonTitle: string } | null
}

/** 看板中的课时任务（由课程进度派生，不落库） */
export interface PlanLessonTask {
  /** 课程 ID */
  courseId: string
  /** 课程标题 */
  courseTitle: string
  /** 课时 ID */
  lessonId: string
  /** 课时标题 */
  lessonTitle: string
}

/** 看板中的今日自定义任务（附加今日完成态） */
export interface PlanCustomTask extends StudyPlanTask {
  /** 今日是否已完成（后端按 doneAt 是否落在今日判定） */
  doneToday: boolean
}

/** 计划看板数据（GET /api/study-plans/{id}/dashboard） */
export interface PlanDashboard {
  /** 计划主体（附加剩余天数） */
  plan: StudyPlan & { remainingDays: number | null }
  /** 课程进度汇总与明细 */
  progress: {
    totalLessons: number
    completedLessons: number
    percentage: number
    courses: PlanCourseProgress[]
  }
  /** 今日指标 */
  today: {
    minutes: number
    goalMinutes: number
    goalPercent: number
    lessonCount: number
    reviewCount: number
    customTaskTotal: number
    customTaskDone: number
    dueReviewCount: number
    checkedIn: boolean
  }
  /** 待学课时任务（最多 3 个） */
  lessonTasks: PlanLessonTask[]
  /** 今日自定义任务 */
  customTasks: PlanCustomTask[]
  /** 连续打卡天数 */
  streakDays: number
  /** 近 7 天打卡完成率（0-1） */
  weekCompletionRate: number
  /** 最近打卡记录 */
  recentCheckins: StudyPlanCheckin[]
  /** 到期复习单词数 */
  dueReviewCount: number
  /** 页面内提醒（无需提醒时为 null） */
  reminder: { message: string } | null
}

/** 新建/更新计划的请求体 */
export type StudyPlanInput = Omit<StudyPlan, 'createdAt' | 'updatedAt'> &
  Partial<Pick<StudyPlan, 'createdAt' | 'updatedAt'>>
