/**
 * 通用数据仓库（混合版）
 *
 * 职责：
 * - 业务数据（打字记录、学习记录、成就、AI 任务日志、学习列表）走后端 HTTP
 * - TTS 音频缓存仍保留在 IndexedDB：缓存内容是 Blob，不适合写入业务库，
 *   且属于可重建的本地缓存，不属于业务数据双存储。
 */

import { db } from '../index';
import { apiDelete, apiGet, apiPatch, apiPost, type ApiError } from '../../services/apiClient';
import type { TtsCacheItem, TypingRecord, LearningRecord, Achievement, AITaskLog } from '../../types/common';

/** 后端列表响应结构 */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[];
  /** 命中总数 */
  total: number;
}

/** 学习列表条目结构（与后端 learningList 契约一致） */
export interface LearningListItem {
  /** 课程 ID */
  courseId: string;
  /** 加入学习列表的时间（毫秒） */
  addedAt: number;
  /** 累计学习时长（毫秒，可选） */
  totalStudyTime?: number;
}

/**
 * 判断是否为“资源不存在”错误
 * @param error 捕获到的异常
 */
function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 404;
}

/**
 * 通用仓库类
 */
export class CommonRepository {
  /**
   * TTS 缓存相关方法（仍使用 IndexedDB，见文件头说明）
   */

  /**
   * 获取 TTS 缓存
   */
  async getTtsCache(text: string, model: string): Promise<TtsCacheItem | undefined> {
    return await db.ttsCacheItems
      .where('text')
      .equals(text)
      .and(item => item.model === model)
      .first();
  }

  /**
   * 保存 TTS 缓存
   */
  async saveTtsCache(cache: TtsCacheItem): Promise<number> {
    return await db.ttsCacheItems.add(cache);
  }

  /**
   * 写入或更新 TTS 缓存（按 text+model 去重）
   */
  async upsertTtsCache(cache: TtsCacheItem): Promise<number> {
    const existing = await this.getTtsCache(cache.text, cache.model);
    if (existing?.id) {
      return await db.ttsCacheItems.put({
        ...cache,
        id: existing.id,
      });
    }
    return await db.ttsCacheItems.add(cache);
  }

  /**
   * 删除指定的 TTS 缓存（按 text + model 定位）
   * 说明：音频 Blob 损坏或无法解码时，先删除缓存再重新合成。
   */
  async deleteTtsCache(text: string, model: string): Promise<void> {
    const existing = await this.getTtsCache(text, model);
    if (!existing?.id) return;
    await db.ttsCacheItems.delete(existing.id);
  }

  /**
   * 清理过期的 TTS 缓存（超过30天）
   */
  async cleanupOldTtsCache(): Promise<number> {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    return await db.ttsCacheItems
      .where('createdAt')
      .below(thirtyDaysAgo)
      .delete();
  }

  /**
   * 打字记录相关方法
   */

  /**
   * 添加打字记录
   */
  async addTypingRecord(record: TypingRecord): Promise<number> {
    const created = await apiPost<TypingRecord>('/api/typing-records', record);
    return created.id ?? 0;
  }

  /**
   * 获取打字记录（按时间范围）
   */
  async getTypingRecords(startDate: number, endDate: number, practiceType?: string): Promise<TypingRecord[]> {
    const result = await apiGet<ListResponse<TypingRecord>>('/api/typing-records', {
      start: startDate,
      end: endDate,
      practiceType,
    });
    return result.items;
  }

  /**
   * 获取最近的打字记录
   */
  async getRecentTypingRecords(limit: number = 10, practiceType?: string): Promise<TypingRecord[]> {
    const result = await apiGet<ListResponse<TypingRecord>>('/api/typing-records', {
      limit,
      practiceType,
    });
    return result.items;
  }

  /**
   * 学习记录相关方法
   */

  /**
   * 添加学习记录
   */
  async addLearningRecord(record: LearningRecord): Promise<number> {
    const created = await apiPost<LearningRecord>('/api/learning-records', record);
    return created.id ?? 0;
  }

  /**
   * 获取学习记录（按时间范围）
   */
  async getLearningRecords(startDate: number, endDate: number): Promise<LearningRecord[]> {
    const result = await apiGet<ListResponse<LearningRecord>>('/api/learning-records', {
      start: startDate,
      end: endDate,
      limit: 2000,
    });
    return result.items;
  }

  /**
   * 获取课程的学习记录
   */
  async getLearningRecordsByCourse(courseId: string, limit?: number): Promise<LearningRecord[]> {
    const result = await apiGet<ListResponse<LearningRecord>>('/api/learning-records', {
      courseId,
      limit: limit ?? 2000,
    });
    return result.items;
  }

  /**
   * 成就相关方法
   */

  /**
   * 添加成就
   */
  async addAchievement(achievement: Achievement): Promise<number> {
    const created = await apiPost<Achievement>('/api/achievements', achievement);
    return created.id ?? 0;
  }

  /**
   * 获取所有成就
   */
  async getAllAchievements(): Promise<Achievement[]> {
    const result = await apiGet<ListResponse<Achievement>>('/api/achievements', { limit: 2000 });
    return result.items;
  }

  /**
   * 获取指定类型的成就
   */
  async getAchievementsByType(type: string): Promise<Achievement[]> {
    const result = await apiGet<ListResponse<Achievement>>('/api/achievements', { type, limit: 2000 });
    return result.items;
  }

  /**
   * AI 任务日志相关方法
   */

  /**
   * 创建 AI 任务日志
   */
  async createAITaskLog(log: AITaskLog): Promise<number> {
    const created = await apiPost<AITaskLog>('/api/ai-task-logs', log);
    return created.id ?? 0;
  }

  /**
   * 更新 AI 任务日志
   */
  async updateAITaskLog(id: number, updates: Partial<AITaskLog>): Promise<void> {
    await apiPatch<AITaskLog>(`/api/ai-task-logs/${id}`, updates);
  }

  /**
   * 获取 AI 任务日志
   */
  async getAITaskLog(id: number): Promise<AITaskLog | undefined> {
    try {
      return await apiGet<AITaskLog>(`/api/ai-task-logs/${id}`);
    } catch (error) {
      if (isNotFound(error)) return undefined;
      throw error;
    }
  }

  /**
   * 获取所有 AI 任务日志
   */
  async getAllAITaskLogs(limit?: number): Promise<AITaskLog[]> {
    const result = await apiGet<ListResponse<AITaskLog>>('/api/ai-task-logs', {
      limit: limit ?? 50,
    });
    return result.items;
  }

  /**
   * 获取指定类型的 AI 任务日志
   */
  async getAITaskLogsByType(type: string, limit?: number): Promise<AITaskLog[]> {
    const result = await apiGet<ListResponse<AITaskLog>>('/api/ai-task-logs', {
      type,
      limit: limit ?? 50,
    });
    return result.items;
  }

  /**
   * 删除 AI 任务日志
   */
  async deleteAITaskLog(id: number): Promise<void> {
    await apiDelete(`/api/ai-task-logs/${id}`);
  }

  /**
   * 学习列表相关方法
   */

  /**
   * 获取学习列表全部条目（按加入时间倒序）
   */
  async getLearningList(): Promise<LearningListItem[]> {
    const result = await apiGet<ListResponse<LearningListItem>>('/api/learning-list');
    return result.items;
  }

  /**
   * 读取单条学习列表记录
   */
  async getLearningListItem(courseId: string): Promise<LearningListItem | undefined> {
    const item = await apiGet<LearningListItem | null>(
      `/api/learning-list/${encodeURIComponent(courseId)}`
    );
    return item ?? undefined;
  }

  /**
   * 把课程加入学习列表
   */
  async addLearningListItem(item: LearningListItem): Promise<void> {
    await apiPost<LearningListItem>('/api/learning-list', item);
  }

  /**
   * 更新学习列表记录（例如累计学习时长）
   */
  async updateLearningListItem(
    courseId: string,
    updates: Partial<LearningListItem>
  ): Promise<void> {
    await apiPatch<LearningListItem>(`/api/learning-list/${encodeURIComponent(courseId)}`, updates);
  }

  /**
   * 从学习列表移除课程
   */
  async removeLearningListItem(courseId: string): Promise<void> {
    try {
      await apiDelete(`/api/learning-list/${encodeURIComponent(courseId)}`);
    } catch (error) {
      // 记录已不存在时按幂等成功处理，避免上层因重复移除而报错
      if (isNotFound(error)) return;
      throw error;
    }
  }
}

// 导出单例实例
export const commonRepository = new CommonRepository();
