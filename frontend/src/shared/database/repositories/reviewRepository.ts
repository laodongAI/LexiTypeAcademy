/**
 * 复习数据仓库（HTTP 版）
 *
 * 变更说明：
 * 批次B 起单词掌握度与复习日志统一由后端持久化，
 * SM-2 算法仍在前端执行，后端只负责存取。
 */

import { apiDelete, apiGet, apiPost, apiPut } from '../../services/apiClient'
import type { WordMastery, ReviewLog, DueWord, ReviewStats } from '../../types/review'
import { MasteryLevel } from '../../types/review'

/** 后端列表响应结构 */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[]
  /** 命中总数 */
  total: number
}

/**
 * 复习仓库类
 */
export class ReviewRepository {
  /**
   * 获取所有来源（去重）
   */
  async getSources(): Promise<string[]> {
    const result = await apiGet<{ items: string[] }>('/api/review/sources')
    return result.items.filter(Boolean)
  }

  /**
   * 获取单词掌握度
   */
  async getWordMastery(word: string, source: string): Promise<WordMastery | undefined> {
    // 后端在不存在时返回 null，这里统一转为 undefined
    const mastery = await apiGet<WordMastery | null>('/api/review/mastery', { word, source })
    return mastery ?? undefined
  }

  /**
   * 保存/更新单词掌握度
   */
  async saveWordMastery(mastery: WordMastery): Promise<void> {
    await apiPut<WordMastery>('/api/review/mastery', mastery)
  }

  /**
   * 批量保存单词掌握度
   */
  async batchSaveWordMastery(masteryList: WordMastery[]): Promise<void> {
    if (masteryList.length === 0) return
    await apiPost<{ success: boolean; saved: number }>('/api/review/mastery/batch', {
      items: masteryList,
    })
  }

  /**
   * 获取到期需要复习的单词
   */
  async getDueWords(limit: number = 20, source?: string): Promise<DueWord[]> {
    const result = await apiGet<ListResponse<DueWord>>('/api/review/due', { limit, source })
    return result.items
  }

  /**
   * 获取所有掌握记录（按来源筛选）
   */
  async getAllMastery(source?: string): Promise<WordMastery[]> {
    const result = await apiGet<ListResponse<WordMastery>>('/api/review/mastery', {
      source,
      limit: 10000,
    })
    return result.items
  }

  /**
   * 添加复习日志
   */
  async addReviewLog(log: ReviewLog): Promise<number> {
    const created = await apiPost<ReviewLog>('/api/review/logs', log)
    return created.id ?? 0
  }

  /**
   * 批量添加复习日志
   */
  async batchAddReviewLogs(logs: ReviewLog[]): Promise<void> {
    if (logs.length === 0) return
    await apiPost<{ success: boolean; saved: number }>('/api/review/logs/batch', { items: logs })
  }

  /**
   * 获取复习日志（按时间范围）
   */
  async getReviewLogs(startDate: number, endDate: number, source?: string): Promise<ReviewLog[]> {
    const result = await apiGet<ListResponse<ReviewLog>>('/api/review/logs', {
      start: startDate,
      end: endDate,
      source,
      limit: 10000,
    })
    return result.items
  }

  /**
   * 获取单词的复习历史（按复习时间倒序）
   */
  async getWordReviewHistory(word: string, source: string, limit: number = 10): Promise<ReviewLog[]> {
    const result = await apiGet<ListResponse<ReviewLog>>('/api/review/logs', {
      word,
      source,
      limit,
    })
    return result.items
  }

  /**
   * 获取复习统计（后端统一计算，口径与原实现一致）
   */
  async getReviewStats(source?: string): Promise<ReviewStats> {
    return await apiGet<ReviewStats>('/api/review/stats', { source })
  }

  /**
   * 删除单词掌握记录
   */
  async deleteWordMastery(word: string, source: string): Promise<void> {
    await apiDelete('/api/review/mastery', { word, source })
  }

  /**
   * 删除来源的所有数据（掌握度 + 复习日志）
   */
  async deleteBySource(source: string): Promise<void> {
    await apiDelete('/api/review/source', { source })
  }

  /**
   * 重置单词掌握度
   * 说明：保留原有“读取后重写”的行为，不新增后端专用接口。
   */
  async resetWordMastery(word: string, source: string): Promise<void> {
    const mastery = await this.getWordMastery(word, source)
    if (!mastery) return

    const now: number = Date.now()
    await this.saveWordMastery({
      ...mastery,
      level: MasteryLevel.New,
      reviewCount: 0,
      consecutiveCorrect: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReview: now,
      lastReview: now,
    })
  }
}

// 导出单例实例
export const reviewRepository = new ReviewRepository()
