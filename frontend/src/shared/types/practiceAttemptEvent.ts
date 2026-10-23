/**
 * 练习尝试事件（PracticeAttemptEvent）
 *
 * 目标：以“事件流”的形式记录每一次练习提交结果，为后续复习队列/专项课程生成提供数据底座。
 * 约束：必须可结构化克隆（IndexedDB），不得包含 Vue Proxy / 函数 / Blob。
 */

import type { PracticeMode } from './course'
import type { ScoreDetail } from '../services/asrApiService'

export interface PracticeAttemptEvent {
  /** 自增主键 */
  id?: number

  /** 事件发生时间 */
  createdAt: number

  /** 课程/课时上下文 */
  courseId: string
  lessonId: string

  /** 练习单元 ID（通常为 LessonItem.id） */
  unitId: string

  /** 练习模式 */
  mode: PracticeMode

  /** 参考文本 */
  referenceText: string

  /** 中文提示（可选） */
  chineseHint?: string

  /** 用户输入文本（听写/翻译） */
  userText?: string

  /** ASR 识别文本（跟读/模仿） */
  recognizedText?: string

  /** 是否判定为正确/通过 */
  correct: boolean

  /** 本题第几次尝试（从 1 开始） */
  attemptCount: number

  /** 提交时的提示等级（用户已使用的 Level） */
  hintLevelAtSubmit?: number

  /** 引擎建议的下一提示等级（用于后续分析） */
  nextHintLevel?: number

  /** 相似度（0-1，听写/翻译） */
  similarity?: number

  /** 评分详情（跟读/模仿） */
  scoreDetail?: ScoreDetail

  /** 额外可扩展字段（保持为可结构化克隆对象） */
  extra?: Record<string, unknown>
}
