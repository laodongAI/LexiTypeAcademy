/**
 * PracticeAttemptEvent 数据仓库（HTTP 版）
 *
 * 说明：
 * 练习页在每次提交时写入事件；Unit 维度复习据此计算近期准确率。
 * 批次B 起改为后端持久化，并补充按单元读取能力。
 */

import { apiGet, apiPost } from '../../services/apiClient'
import type { PracticeAttemptEvent } from '../../types/practiceAttemptEvent'

/** 后端列表响应结构 */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[]
  /** 命中总数 */
  total: number
}

/**
 * 练习尝试事件仓库类
 */
export class PracticeAttemptEventRepository {
  /**
   * 写入一条练习尝试事件
   * @param event 事件对象（id 可省略）
   * @returns 后端生成的自增 ID
   */
  async add(event: PracticeAttemptEvent): Promise<number | undefined> {
    const created = await apiPost<PracticeAttemptEvent>('/api/practice-attempt-events', event)
    return created.id
  }

  /**
   * 查询指定单元的练习尝试事件（按发生时间倒序）
   * @param courseId 课程 ID
   * @param unitId 练习单元 ID
   * @param mode 练习模式
   * @param limit 返回条数（滚动准确率只看最近若干条）
   */
  async listRecent(
    courseId: string,
    unitId: string,
    mode: string,
    limit: number = 10
  ): Promise<PracticeAttemptEvent[]> {
    const result = await apiGet<ListResponse<PracticeAttemptEvent>>(
      '/api/practice-attempt-events',
      { courseId, unitId, mode, limit }
    )
    return result.items
  }
}

// 导出单例实例
export const practiceAttemptEventRepository = new PracticeAttemptEventRepository()
