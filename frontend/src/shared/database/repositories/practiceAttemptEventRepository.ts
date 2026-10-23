/**
 * PracticeAttemptEvent 数据仓库
 *
 * 说明：这里仅做最小落库能力，供练习页在提交点写入事件。
 */

import { db, databaseReady } from '../index'
import type { PracticeAttemptEvent } from '../../types/practiceAttemptEvent'

export class PracticeAttemptEventRepository {
  async add(event: PracticeAttemptEvent): Promise<number | undefined> {
    if (!databaseReady) return
    return await db.practiceAttemptEvents.add(event)
  }
}

export const practiceAttemptEventRepository = new PracticeAttemptEventRepository()
