/**
 * 首页下一步学习动作选择。
 *
 * 只根据已持久化、可确认的数据做确定性排序；不让模型猜测学习状态。
 */
export type NextLearningActionKind = 'resume' | 'review' | 'plan-lesson' | 'browse-courses'
export interface NextLearningAction {
  kind: NextLearningActionKind
  title: string
  description: string
  ctaLabel: string
  courseId?: string
  lessonId?: string
}
export interface NextLearningActionInput {
  resumeTarget: { courseId: string; courseTitle: string; lessonId: string; lessonTitle: string } | null
  /** true/false 表示已知；null 表示复习数据不可用，不能把它当成零。 */
  hasDueReview: boolean | null
  /** 仅在复习统计接口成功时提供精确数量。 */
  dueReviewCount: number | null
  nextPlanLesson: { courseId: string; lessonId: string; courseTitle: string; lessonTitle: string } | null
  planTitle: string | null
  hasDataWarnings: boolean
}
/** 按“恢复未完成学习 → 到期复习 → 今日计划 → 选择课程”排序。 */
export function chooseNextLearningAction(input: NextLearningActionInput): NextLearningAction {
  if (input.resumeTarget) {
    return {
      kind: 'resume',
      title: '继续上次学习',
      description: `接着学习「${input.resumeTarget.courseTitle}」中的「${input.resumeTarget.lessonTitle}」。`,
      ctaLabel: '继续学习',
      courseId: input.resumeTarget.courseId,
      lessonId: input.resumeTarget.lessonId,
    }
  }
  if (input.hasDueReview === true) {
    return {
      kind: 'review',
      title: '先巩固学过的内容',
      description: input.dueReviewCount !== null
        ? `有 ${input.dueReviewCount} 个单词已到复习时间，用几分钟巩固记忆。`
        : '有到期词汇需要复习，用几分钟巩固记忆。',
      ctaLabel: '开始复习',
    }
  }
  if (input.nextPlanLesson) {
    return {
      kind: 'plan-lesson',
      title: '开始今天的学习',
      description: `继续计划「${input.planTitle || '今日学习'}」中的「${input.nextPlanLesson.lessonTitle}」。`,
      ctaLabel: '开始学习',
      courseId: input.nextPlanLesson.courseId,
      lessonId: input.nextPlanLesson.lessonId,
    }
  }
  if (input.hasDataWarnings) {
    return {
      kind: 'browse-courses',
      title: '开始一段英语学习',
      description: '部分学习数据暂时无法读取。你可以重新加载数据，或先浏览课程；系统不会把读取失败当成没有学习记录。',
      ctaLabel: '浏览英语课程',
    }
  }
  return {
    kind: 'browse-courses',
    title: '从一份英语材料开始',
    description: '暂时没有可继续的学习任务，选择一门课程就可以开始。',
    ctaLabel: '浏览英语课程',
  }
}
