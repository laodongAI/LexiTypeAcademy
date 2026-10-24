/**
 * 统一学习生命周期事件。
 *
 * 当前阶段复用 SQLite 持久化的 AI 任务日志 JSON 契约作为追加式事件存储，
 * 避免在未建立独立迁移链之前改动业务表。事件不参与学习分钟/练习次数统计；
 * 权威指标仍分别来自课程进度、练习记录和复习日志，避免双重计数。
 */
import { commonRepository } from '../database/repositories/commonRepository'
import type { AITaskLog } from '../types/common'

export type LearningEventType =
  | 'lesson_started'
  | 'practice_submitted'
  | 'lesson_completed'
  | 'lesson_abandoned'
  | 'review_submitted'
  | 'study_plan_task_completed'
  | 'conversation_completed'
  | 'conversation_abandoned'
  | 'conversation_feedback_saved'

export interface LearningEvent {
  eventId: string
  eventType: LearningEventType
  occurredAt: number
  courseId?: string
  lessonId?: string
  activityId?: string
  durationMs?: number
  result?: {
    correctCount?: number
    totalCount?: number
    accuracy?: number
  }
  metadata?: Record<string, unknown>
}

const EVENT_LOG_TYPE: AITaskLog['type'] = 'learning_event'

function createEventId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `learning-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export class LearningEventService {
  /**
   * 追加事件。通过 eventId 做应用层幂等检查，避免常规重试重复写入。
   * 该检查不是数据库唯一约束，不能保证并发写入时的强幂等。
   */
  async record(event: Omit<LearningEvent, 'eventId' | 'occurredAt'> & Partial<Pick<LearningEvent, 'eventId' | 'occurredAt'>>): Promise<void> {
    const normalized: LearningEvent = {
      ...event,
      eventId: event.eventId || createEventId(),
      occurredAt: event.occurredAt ?? Date.now(),
    }
    const recent = await commonRepository.getAITaskLogsByType(EVENT_LOG_TYPE, 500)
    const exists = recent.some(log => {
      const input = log.input as { eventId?: unknown } | undefined
      return input?.eventId === normalized.eventId
    })
    if (exists) return

    await commonRepository.createAITaskLog({
      type: EVENT_LOG_TYPE,
      status: 'completed',
      input: normalized as unknown as Record<string, unknown>,
      output: { accepted: true },
      createdAt: normalized.occurredAt,
      completedAt: normalized.occurredAt,
    })
  }

  async listRecent(limit = 100): Promise<LearningEvent[]> {
    const logs = await commonRepository.getAITaskLogsByType(EVENT_LOG_TYPE, Math.max(1, Math.min(limit, 500)))
    return logs
      .map(log => log.input as unknown as LearningEvent)
      .filter(event => Boolean(event?.eventId && event?.eventType && event?.occurredAt))
      .sort((a, b) => b.occurredAt - a.occurredAt)
  }
}

export const learningEventService = new LearningEventService()
