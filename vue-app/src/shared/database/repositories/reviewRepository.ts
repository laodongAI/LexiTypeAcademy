/**
 * 复习数据仓库
 * 封装复习系统相关的数据库操作
 */

import { db } from '../index';
import type { WordMastery, ReviewLog, DueWord, ReviewStats } from '../../types/review';
import { MasteryLevel } from '../../types/review';

/**
 * 复习仓库类
 */
export class ReviewRepository {
  /**
   * 获取所有来源（去重）
   */
  async getSources(): Promise<string[]> {
    // 依赖 wordMasteryItems 上的 source 索引
    const keys = await db.wordMasteryItems.orderBy('source').uniqueKeys();
    return keys
      .map(k => String(k))
      .filter(Boolean);
  }

  /**
   * 获取单词掌握度
   */
  async getWordMastery(word: string, source: string): Promise<WordMastery | undefined> {
    return await db.wordMasteryItems.get([word, source]);
  }
  
  /**
   * 保存/更新单词掌握度
   */
  async saveWordMastery(mastery: WordMastery): Promise<void> {
    await db.wordMasteryItems.put(mastery);
  }
  
  /**
   * 批量保存单词掌握度
   */
  async batchSaveWordMastery(masteryList: WordMastery[]): Promise<void> {
    await db.wordMasteryItems.bulkPut(masteryList);
  }
  
  /**
   * 获取到期需要复习的单词
   */
  async getDueWords(limit: number = 20, source?: string): Promise<DueWord[]> {
    const now = Date.now();
    let query = db.wordMasteryItems.where('nextReview').belowOrEqual(now);
    
    if (source) {
      const allDue = await query.toArray();
      const filtered = allDue.filter(item => item.source === source);
      return filtered.slice(0, limit).map(item => ({
        word: item.word,
        source: item.source,
        level: item.level,
        nextReview: item.nextReview,
        reviewCount: item.reviewCount
      }));
    }
    
    const dueWords = await query.limit(limit).toArray();
    return dueWords.map(item => ({
      word: item.word,
      source: item.source,
      level: item.level,
      nextReview: item.nextReview,
      reviewCount: item.reviewCount
    }));
  }
  
  /**
   * 获取所有掌握记录（按来源筛选）
   */
  async getAllMastery(source?: string): Promise<WordMastery[]> {
    if (source) {
      return await db.wordMasteryItems.where('source').equals(source).toArray();
    }
    return await db.wordMasteryItems.toArray();
  }
  
  /**
   * 添加复习日志
   */
  async addReviewLog(log: ReviewLog): Promise<number> {
    return await db.reviewLogs.add(log);
  }
  
  /**
   * 批量添加复习日志
   */
  async batchAddReviewLogs(logs: ReviewLog[]): Promise<void> {
    await db.reviewLogs.bulkAdd(logs);
  }
  
  /**
   * 获取复习日志（按时间范围）
   */
  async getReviewLogs(startDate: number, endDate: number, source?: string): Promise<ReviewLog[]> {
    let query = db.reviewLogs
      .where('reviewDate')
      .between(startDate, endDate, true, true);
    
    if (source) {
      const allLogs = await query.toArray();
      return allLogs.filter(log => log.source === source);
    }
    
    return await query.toArray();
  }
  
  /**
   * 获取单词的复习历史
   */
  async getWordReviewHistory(word: string, source: string, limit: number = 10): Promise<ReviewLog[]> {
    const allLogs = await db.reviewLogs
      .where('word')
      .equals(word)
      .reverse()
      .sortBy('reviewDate');
    
    return allLogs
      .filter(log => log.source === source)
      .slice(0, limit);
  }
  
  /**
   * 获取复习统计
   */
  async getReviewStats(source?: string): Promise<ReviewStats> {
    const allMastery = await this.getAllMastery(source);
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    const stats: ReviewStats = {
      totalWords: allMastery.length,
      newWords: 0,
      learningWords: 0,
      masteredWords: 0,
      dueToday: 0,
      reviewedToday: 0
    };
    
    for (const item of allMastery) {
      // 统计各等级单词数
      if (item.level === MasteryLevel.New) {
        stats.newWords++;
      } else if (item.level === MasteryLevel.Learning || item.level === MasteryLevel.Familiar) {
        stats.learningWords++;
      } else if (item.level === MasteryLevel.Proficient || item.level === MasteryLevel.Mastered) {
        stats.masteredWords++;
      }
      
      // 统计到期单词
      if (item.nextReview <= now) {
        stats.dueToday++;
      }
    }
    
    // 统计今日已复习数
    const todayLogs = await this.getReviewLogs(todayStart, now, source);
    const reviewedWords = new Set(todayLogs.map(log => `${log.word}-${log.source}`));
    stats.reviewedToday = reviewedWords.size;
    
    return stats;
  }
  
  /**
   * 删除单词掌握记录
   */
  async deleteWordMastery(word: string, source: string): Promise<void> {
    await db.wordMasteryItems.delete([word, source]);
  }
  
  /**
   * 删除来源的所有数据
   */
  async deleteBySource(source: string): Promise<void> {
    await db.transaction('rw', db.wordMasteryItems, db.reviewLogs, async () => {
      await db.wordMasteryItems.where('source').equals(source).delete();
      await db.reviewLogs.where('source').equals(source).delete();
    });
  }
  
  /**
   * 重置单词掌握度
   */
  async resetWordMastery(word: string, source: string): Promise<void> {
    const mastery = await this.getWordMastery(word, source);
    if (mastery) {
      await this.saveWordMastery({
        ...mastery,
        level: MasteryLevel.New,
        reviewCount: 0,
        consecutiveCorrect: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReview: Date.now(),
        lastReview: Date.now()
      });
    }
  }
}

// 导出单例实例
export const reviewRepository = new ReviewRepository();
