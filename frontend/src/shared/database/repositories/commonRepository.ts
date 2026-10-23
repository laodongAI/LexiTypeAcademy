/**
 * 通用数据仓库
 * 封装通用数据的数据库操作
 */

import { db } from '../index';
import type { TtsCacheItem, TypingRecord, LearningRecord, Achievement, AITaskLog } from '../../types/common';

/**
 * 通用仓库类
 */
export class CommonRepository {
  /**
   * TTS 缓存相关方法
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
    const existing = await this.getTtsCache(cache.text, cache.model)
    if (existing?.id) {
      return await db.ttsCacheItems.put({
        ...cache,
        id: existing.id,
      })
    }
    return await db.ttsCacheItems.add(cache)
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
    return await db.typingRecords.add(record);
  }
  
  /**
   * 获取打字记录（按时间范围）
   */
  async getTypingRecords(startDate: number, endDate: number, practiceType?: string): Promise<TypingRecord[]> {
    let query = db.typingRecords.where('date').between(startDate, endDate, true, true);
    
    if (practiceType) {
      const allRecords = await query.toArray();
      return allRecords.filter(record => record.practiceType === practiceType);
    }
    
    return await query.toArray();
  }
  
  /**
   * 获取最近的打字记录
   */
  async getRecentTypingRecords(limit: number = 10, practiceType?: string): Promise<TypingRecord[]> {
    let query = db.typingRecords.orderBy('date').reverse();
    
    if (practiceType) {
      const allRecords = await query.toArray();
      return allRecords.filter(record => record.practiceType === practiceType).slice(0, limit);
    }
    
    return await query.limit(limit).toArray();
  }
  
  /**
   * 学习记录相关方法
   */
  
  /**
   * 添加学习记录
   */
  async addLearningRecord(record: LearningRecord): Promise<number> {
    return await db.learningRecords.add(record);
  }
  
  /**
   * 获取学习记录（按时间范围）
   */
  async getLearningRecords(startDate: number, endDate: number): Promise<LearningRecord[]> {
    return await db.learningRecords
      .where('createdAt')
      .between(startDate, endDate, true, true)
      .toArray();
  }
  
  /**
   * 获取课程的学习记录
   */
  async getLearningRecordsByCourse(courseId: string, limit?: number): Promise<LearningRecord[]> {
    let query = db.learningRecords.where('courseId').equals(courseId);
    if (limit) {
      query = query.limit(limit);
    }
    return await query.reverse().sortBy('createdAt');
  }
  
  /**
   * 成就相关方法
   */
  
  /**
   * 添加成就
   */
  async addAchievement(achievement: Achievement): Promise<number> {
    return await db.achievements.add(achievement);
  }
  
  /**
   * 获取所有成就
   */
  async getAllAchievements(): Promise<Achievement[]> {
    return await db.achievements.orderBy('unlockedAt').reverse().toArray();
  }
  
  /**
   * 获取指定类型的成就
   */
  async getAchievementsByType(type: string): Promise<Achievement[]> {
    return await db.achievements.where('type').equals(type).toArray();
  }
  
  /**
   * AI 任务日志相关方法
   */
  
  /**
   * 创建 AI 任务日志
   */
  async createAITaskLog(log: AITaskLog): Promise<number> {
    return await db.aiTaskLogs.add(log);
  }
  
  /**
   * 更新 AI 任务日志
   */
  async updateAITaskLog(id: number, updates: Partial<AITaskLog>): Promise<void> {
    await db.aiTaskLogs.update(id, updates);
  }
  
  /**
   * 获取 AI 任务日志
   */
  async getAITaskLog(id: number): Promise<AITaskLog | undefined> {
    return await db.aiTaskLogs.get(id);
  }
  
  /**
   * 获取所有 AI 任务日志
   */
  async getAllAITaskLogs(limit?: number): Promise<AITaskLog[]> {
    let query = db.aiTaskLogs.orderBy('createdAt').reverse();
    if (limit) {
      return await query.limit(limit).toArray();
    }
    return await query.toArray();
  }
  
  /**
   * 获取指定类型的 AI 任务日志
   */
  async getAITaskLogsByType(type: string, limit?: number): Promise<AITaskLog[]> {
    let query = db.aiTaskLogs.where('type').equals(type).reverse();
    if (limit) {
      return await query.limit(limit).toArray();
    }
    return await query.toArray();
  }
  
  /**
   * 删除 AI 任务日志
   */
  async deleteAITaskLog(id: number): Promise<void> {
    await db.aiTaskLogs.delete(id);
  }
}

// 导出单例实例
export const commonRepository = new CommonRepository();
