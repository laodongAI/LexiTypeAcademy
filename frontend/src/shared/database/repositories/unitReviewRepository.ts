/**
 * Unit 维度复习仓库（HTTP 版）
 *
 * 变更说明：
 * 批次B 起 Unit 掌握度与 Unit 复习日志由后端持久化，
 * 方法签名保持不变，调用方无需调整。
 */

import { apiGet, apiPost, apiPut } from '../../services/apiClient'
import type { DueUnit, UnitMastery, UnitReviewLog } from '../../types/unitReview'

/** 后端列表响应结构 */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[]
  /** 命中总数 */
  total: number
}

/**
 * Unit 复习仓库类
 */
export class UnitReviewRepository {
  /**
   * 读取单个 Unit 掌握度
   * @param courseId 课程 ID
   * @param unitId 练习单元 ID
   * @param mode 练习模式
   */
  async getUnitMastery(courseId: string, unitId: string, mode: string): Promise<UnitMastery | undefined> {
    const mastery = await apiGet<UnitMastery | null>('/api/review/unit-mastery', {
      courseId,
      unitId,
      mode,
    })
    return mastery ?? undefined
  }

  /**
   * 保存（或覆盖）Unit 掌握度
   * @param mastery 掌握度对象
   */
  async saveUnitMastery(mastery: UnitMastery): Promise<void> {
    await apiPut<UnitMastery>('/api/review/unit-mastery', mastery)
  }

  /**
   * 新增 Unit 复习日志
   * @param log 日志对象
   * @returns 后端生成的自增 ID
   */
  async addUnitReviewLog(log: UnitReviewLog): Promise<number | undefined> {
    const created = await apiPost<UnitReviewLog>('/api/review/unit-logs', log)
    return created.id
  }

  /**
   * 获取到期需要复习的 Unit
   * @param limit 返回上限
   * @param courseId 课程过滤，可选
   */
  async getDueUnits(limit: number = 20, courseId?: string): Promise<DueUnit[]> {
    const result = await apiGet<ListResponse<DueUnit>>('/api/review/unit-due', {
      limit,
      courseId,
    })
    return result.items
  }
}

// 导出单例实例
export const unitReviewRepository = new UnitReviewRepository()
