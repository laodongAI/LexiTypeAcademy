/**
 * AI 教学引擎（Teaching Engine）类型定义
 *
 * 说明：该模块提供“规则引擎 + AI 增强”两层能力。
 * - 规则引擎：离线可用，保证核心判定与提示层级稳定。
 * - AI 增强：在配置了 AI 的情况下，给出更自然、可操作的教学反馈。
 */

import type { ScoreDetail } from '../asrApiService'

export type TeachingErrorType =
  | 'SPELLING'
  | 'VOCAB_MEANING'
  | 'GRAMMAR'
  | 'PRONUNCIATION'
  | 'LISTENING'
  | 'SEMANTIC_INAPPROPRIATE'
  | 'FLUENCY'

export type TeachingMode = 'dictation' | 'imitation' | 'follow' | 'translation'

export type HintLevel = 0 | 1 | 2 | 3 | 4

export interface TeachingHint {
  level: HintLevel
  title: string
  content: string
}

export interface DictationEvaluationInput {
  targetText: string
  userText: string
  attemptCount: number
  chineseHint?: string
  previousHintLevel?: HintLevel
}

export interface DictationEvaluationResult {
  correct: boolean
  normalizedTarget: string
  normalizedUser: string
  similarity: number // 0-1
  errorTypes: TeachingErrorType[]
  nextHint: TeachingHint
}

export interface PronunciationEvaluationInput {
  referenceText: string
  recognizedText?: string
  scoreDetail: ScoreDetail
  attemptCount: number
  previousHintLevel?: HintLevel
}

export interface PronunciationEvaluationResult {
  passed: boolean
  overallScore: number
  errorTypes: TeachingErrorType[]
  nextHint: TeachingHint
}

export interface TeachingFeedbackIssue {
  type: TeachingErrorType
  severity: 1 | 2 | 3
  message: string
  suggestion: string
}

export interface TeachingFeedback {
  title: string
  summary: string
  strengths: string[]
  issues: TeachingFeedbackIssue[]
  nextSteps: string[]
  recommendedHintLevel: HintLevel
}
