/**
 * 首页学习看板服务
 *
 * 统一消费课程进度、练习记录、复习掌握度和学习计划看板；
 * 首页只展示后端持久化数据，不在组件中重复计算业务口径。
 */
import { courseRepository } from '../database/repositories/courseRepository'
import { studyPlanRepository } from '../database/repositories/studyPlanRepository'
import { learningService } from './learningService'
import { reviewService } from './reviewService'
import type { LearningCourse } from '../types/learning'
import type { Lesson, CourseProgress, PracticeRecord } from '../types/course'
import type { PlanDashboard, StudyPlan } from '../types/studyPlan'
import type { DueWord, ReviewStats } from '../types/review'

export interface ResumeLearningTarget {
  courseId: string
  courseTitle: string
  lessonId: string
  lessonTitle: string
  completionPercentage: number
  lastStudiedAt?: number
}

export interface HomeLearningDashboard {
  resumeTarget: ResumeLearningTarget | null
  learningCourses: LearningCourse[]
  dueWords: DueWord[]
  reviewStats: ReviewStats | null
  todayPracticeCount: number | null
  activePlan: StudyPlan | null
  planDashboard: PlanDashboard | null
  warnings: string[]
}

/** 将单项数据读取失败与“真实空数据”区分开，允许首页部分降级。 */
export class LearningDashboardService {
  async load(): Promise<HomeLearningDashboard> {
    const warnings: string[] = []
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000 - 1)

    const [coursesResult, dueResult, reviewStatsResult, practiceResult, plansResult] =
      await Promise.allSettled([
        learningService.getLearningCourses(),
        reviewService.getDueWords(8),
        reviewService.getReviewStats(),
        courseRepository.getPracticeRecordsByRange(todayStart.getTime(), todayEnd.getTime()),
        studyPlanRepository.listPlans('active'),
      ])

    const learningCourses = this.valueOr(coursesResult, [], warnings, '学习课程')
    const dueWords = this.valueOr(dueResult, [], warnings, '到期复习')
    const reviewStats = reviewStatsResult.status === 'fulfilled'
      ? reviewStatsResult.value
      : (warnings.push('复习统计暂不可用'), null)
    const todayPracticeRecords = this.valueOr(practiceResult, [], warnings, '今日练习记录')
    const activePlans = this.valueOr(plansResult, [], warnings, '学习计划')

    const sortedCourses = [...learningCourses].sort(
      (a, b) => (b.lastStudiedAt ?? b.addedAt ?? 0) - (a.lastStudiedAt ?? a.addedAt ?? 0),
    )
    const resumeTarget = await this.resolveResumeTarget(sortedCourses, warnings)
    const activePlan = activePlans[0] ?? null
    let planDashboard: PlanDashboard | null = null
    if (activePlan) {
      try {
        planDashboard = await studyPlanRepository.getDashboard(activePlan.id)
      } catch {
        warnings.push('学习计划看板暂不可用')
      }
    }

    return {
      resumeTarget,
      learningCourses,
      dueWords,
      reviewStats,
      todayPracticeCount: todayPracticeRecords.length,
      activePlan,
      planDashboard,
      warnings,
    }
  }

  private async resolveResumeTarget(
    courses: LearningCourse[],
    warnings: string[],
  ): Promise<ResumeLearningTarget | null> {
    for (const course of courses) {
      try {
        const [progress, lessons] = await Promise.all([
          courseRepository.getCourseProgress(course.id),
          courseRepository.getLessonsByCourseId(course.id),
        ])
        const target = this.chooseLesson(course, progress, lessons)
        if (target) return target
      } catch {
        warnings.push(`课程“${course.title}”的学习位置暂不可用`)
      }
    }
    return null
  }

  private chooseLesson(
    course: LearningCourse,
    progress: CourseProgress | undefined,
    lessons: Lesson[],
  ): ResumeLearningTarget | null {
    if (lessons.length === 0) return null
    const completed = new Set(progress?.completedLessonIds ?? [])
    const current = progress?.currentLessonId
      ? lessons.find(lesson => lesson.id === progress.currentLessonId)
      : undefined
    const target = current && !completed.has(current.id)
      ? current
      : lessons.find(lesson => !completed.has(lesson.id))
    if (!target) return null
    return {
      courseId: course.id,
      courseTitle: course.title,
      lessonId: target.id,
      lessonTitle: target.title,
      completionPercentage: Math.max(0, Math.min(100, Math.round(progress?.completionPercentage ?? 0))),
      lastStudiedAt: progress?.lastStudiedAt,
    }
  }

  private valueOr<T>(
    result: PromiseSettledResult<T>,
    fallback: T,
    warnings: string[],
    label: string,
  ): T {
    if (result.status === 'fulfilled') return result.value
    warnings.push(`${label}暂不可用`)
    return fallback
  }
}

export const learningDashboardService = new LearningDashboardService()
