/**
 * Unit 维度复习系统类型（按 unitId + mode）
 *
 * 说明：复用 SM2 算法与 MasteryLevel 语义，但对象是“练习单元”而非单词。
 */

import type { PracticeMode } from './course'
import type { MasteryLevel } from './review'

export interface UnitMastery {
  /** 复合主键字段（由 Dexie 以 [courseId+unitId+mode] 作为 key） */
  courseId: string
  unitId: string
  mode: PracticeMode

  /** 可选：用于定位来源课时 */
  lessonId?: string

  /** 掌握等级 */
  level: MasteryLevel

  /** 下次复习时间 */
  nextReview: number

  /** 复习间隔（天） */
  interval: number

  /** 复习次数 */
  reviewCount: number

  /** 连续正确次数 */
  consecutiveCorrect: number

  /** 上次复习时间 */
  lastReview: number

  /** 创建时间 */
  createdAt: number

  /** SM-2 Easy Factor */
  easeFactor: number

  /** 最近 N 次事件滚动准确率（0-1，可选） */
  rollingAccuracy?: number

  /** 最近一次诊断出的薄弱维度（可选） */
  weakDimensions?: string[]

  /** 扩展字段（保持可结构化克隆对象） */
  extra?: Record<string, unknown>
}

export interface UnitReviewLog {
  id?: number
  courseId: string
  unitId: string
  mode: PracticeMode
  lessonId?: string

  reviewDate: number

  /** SM2 质量分 0-5 */
  quality: number

  correct: boolean
  level: MasteryLevel

  /** 方便后续分析 */
  weakDimensions?: string[]
  extra?: Record<string, unknown>
}

export interface DueUnit {
  courseId: string
  unitId: string
  mode: PracticeMode
  lessonId?: string

  level: MasteryLevel
  nextReview: number
  reviewCount: number
}
