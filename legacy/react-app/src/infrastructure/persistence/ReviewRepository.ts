/**
 * 复习数据仓库实现
 * DDD设计：Infrastructure层 - 数据访问实现
 * 
 * 职责：
 * - 实现 IReviewRepository 接口
 * - 封装 IndexedDB 的具体操作
 * - 提供数据访问的适配器模式
 * 
 * 设计模式：
 * - Repository Pattern: 分离业务逻辑和数据访问
 * - Adapter Pattern: 适配 Dexie.js 到 Domain 接口
 */

import { db } from './database';
import type { IReviewRepository } from '@/domain/services/ReviewService';
import type { WordMastery, ReviewLog, DueWord } from '@/domain/models/ReviewModels';

/**
 * 复习数据仓库实现类
 * 将 Domain 层的接口映射到 Dexie.js 的具体操作
 */
export class ReviewRepository implements IReviewRepository {
  /**
   * 获取单词掌握记录
   * 
   * @param word 单词
   * @param source 学习来源
   * @returns 掌握记录或 undefined
   */
  async getWordMastery(word: string, source: string): Promise<WordMastery | undefined> {
    try {
      // Dexie 使用复合主键查询
      return await db.wordMasteryItems.get({ word, source });
    } catch (error) {
      console.error('获取单词掌握记录失败:', error);
      return undefined;
    }
  }
  
  /**
   * 保存或更新单词掌握记录
   * 
   * @param mastery 掌握记录
   */
  async putWordMastery(mastery: WordMastery): Promise<void> {
    try {
      await db.wordMasteryItems.put(mastery);
    } catch (error) {
      console.error('保存单词掌握记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 添加复习日志
   * 
   * @param log 复习日志
   */
  async addReviewLog(log: ReviewLog): Promise<void> {
    try {
      await db.reviewLogs.add(log);
    } catch (error) {
      console.error('添加复习日志失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取到期需要复习的单词列表
   * 
   * @param limit 返回的最大单词数量
   * @param source 可选的来源筛选
   * @returns 到期单词数组
   */
  async getDueWords(limit: number, source?: string): Promise<DueWord[]> {
    try {
      const now = Date.now();
      
      // 查询 nextReview <= now 的单词
      let collection = db.wordMasteryItems.where('nextReview').belowOrEqual(now);
      
      // 如果指定了来源，进行过滤
      if (source) {
        collection = collection.filter(item => item.source === source);
      }
      
      // 获取指定数量的结果
      const entries = await collection.limit(limit).toArray();
      
      // 转换为 DueWord 格式
      return entries.map(e => ({
        word: e.word,
        source: e.source
      }));
    } catch (error) {
      console.error('获取到期单词失败:', error);
      return [];
    }
  }
  
  /**
   * 获取所有单词掌握记录
   * 
   * @param source 可选的来源筛选
   * @returns 掌握记录数组
   */
  async getAllMastery(source?: string): Promise<WordMastery[]> {
    try {
      if (source) {
        // 按来源筛选
        return await db.wordMasteryItems.where('source').equals(source).toArray();
      }
      
      // 返回所有记录
      return await db.wordMasteryItems.toArray();
    } catch (error) {
      console.error('获取所有掌握记录失败:', error);
      return [];
    }
  }
  
  /**
   * 获取复习日志
   * 
   * @param word 可选的单词筛选
   * @param source 可选的来源筛选
   * @param since 可选的时间范围（时间戳）
   * @returns 复习日志数组
   */
  async getReviewLogs(
    word?: string, 
    source?: string, 
    since?: number
  ): Promise<ReviewLog[]> {
    try {
      let collection = db.reviewLogs.toCollection();
      
      // 按单词筛选
      if (word) {
        collection = db.reviewLogs.where('word').equals(word);
      }
      
      // 按时间范围筛选
      if (since !== undefined) {
        collection = db.reviewLogs.where('reviewDate').aboveOrEqual(since);
      }
      
      // 获取所有结果
      let logs = await collection.toArray();
      
      // 按来源筛选（Dexie 不支持多条件索引，需要在内存中过滤）
      if (source) {
        logs = logs.filter(log => log.source === source);
      }
      
      return logs;
    } catch (error) {
      console.error('获取复习日志失败:', error);
      return [];
    }
  }
}

/**
 * 创建复习数据仓库实例的工厂函数
 * 
 * @returns ReviewRepository 实例
 */
export function createReviewRepository(): IReviewRepository {
  return new ReviewRepository();
}
