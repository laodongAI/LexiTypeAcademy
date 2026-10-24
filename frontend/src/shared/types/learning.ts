/**
 * 学习列表相关类型定义
 */

import type { Course } from './course'

/**
 * 学习课程（扩展课程信息，添加学习相关状态）
 */
export interface LearningCourse extends Course {
  /** 是否在学习列表中 */
  inLearningList: boolean;
  /** 加入学习列表的时间 */
  addedAt?: number;
  /** 最后学习时间 */
  lastStudiedAt?: number;
  /** 总学习时长（分钟） */
  totalStudyTime?: number;
  /** 完成的课时数 */
  completedLessons?: number;
  /** 完成百分比 */
  completionPercentage?: number;
  /** 是否需要复习 */
  needsReview?: boolean;
  /** 学习状态 */
  learningStatus?: LearningStatus;
}

/**
 * 学习状态
 */
export type LearningStatus = 'not_started' | 'in_progress' | 'completed' | 'paused'

/**
 * 学习统计
 */
export interface LearningStats {
  /** 学习中的课程数 */
  inProgress: number;
  /** 已完成的课程数 */
  completed: number;
  /** 学习列表累计时长（小时，来源为每门课程的 totalStudyTime 分钟汇总） */
  totalHours: number;
  /** 待复习的课程数 */
  reviewDue: number;
}

/**
 * 学习记录
 */
export interface LearningRecord {
  /** 课程ID */
  courseId: string;
  /** 开始时间 */
  startedAt: number;
  /** 结束时间 */
  endedAt?: number;
  /** 学习时长（分钟） */
  duration?: number;
  /** 完成的课时ID */
  completedLessonId?: string;
}
