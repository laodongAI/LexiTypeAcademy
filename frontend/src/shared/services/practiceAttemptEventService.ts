/**
 * PracticeAttemptEvent 写入服务
 *
 * 目标：不影响现有 UI；写入失败时静默降级（仅 console.warn）。
 */

import { practiceAttemptEventRepository } from '../database/repositories/practiceAttemptEventRepository'
import type { PracticeAttemptEvent } from '../types/practiceAttemptEvent'
import { unitReviewService } from './unitReviewService'

export type PracticeAttemptEventInput = Omit<PracticeAttemptEvent, 'id' | 'createdAt'> & {
  createdAt?: number
}

export async function recordPracticeAttemptEvent(input: PracticeAttemptEventInput): Promise<void> {
  try {
    const event: PracticeAttemptEvent = {
      ...input,
      createdAt: input.createdAt ?? Date.now(),
    }

    const id = await practiceAttemptEventRepository.add(event)

    // 最小消费：写入成功后，同步更新 unit 维度复习条目
    if (typeof id === 'number') {
      void unitReviewService.consumePracticeAttemptEvent(event)
    }
  } catch (error) {
    // 不影响练习流程
    console.warn('recordPracticeAttemptEvent failed:', error)
  }
}
