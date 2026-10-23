/**
 * 历史记录数据仓库实现
 * DDD设计：Infrastructure层 - 数据访问实现
 * 
 * 职责：
 * - 实现 IHistoryRepository 接口
 * - 封装 IndexedDB 的具体操作
 * - 提供高性能的查询和索引
 * 
 * 设计模式：
 * - Repository Pattern: 分离业务逻辑和数据访问
 * - Adapter Pattern: 适配 Dexie.js 到 Domain 接口
 */

import { db, type TypingRecord } from './database';
import type { IHistoryRepository } from '@/domain/services/HistoryService';

/**
 * 历史记录数据仓库实现类
 */
export class HistoryRepository implements IHistoryRepository {
  /**
   * 获取所有历史记录
   * 按日期倒序排列（最新的在前）
   * 
   * @returns 历史记录数组
   */
  async getAllRecords(): Promise<TypingRecord[]> {
    try {
      return await db.typingRecords
        .orderBy('date')
        .reverse()
        .toArray();
    } catch (error) {
      console.error('获取历史记录失败:', error);
      return [];
    }
  }
  
  /**
   * 添加历史记录
   * 
   * @param record 记录数据
   */
  async addRecord(record: TypingRecord): Promise<void> {
    try {
      // 确保有日期字段
      if (!record.date) {
        record.date = Date.now();
      }
      
      await db.typingRecords.add(record);
    } catch (error) {
      console.error('添加历史记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 删除历史记录
   * 
   * @param id 记录ID
   */
  async deleteRecord(id: number): Promise<void> {
    try {
      await db.typingRecords.delete(id);
    } catch (error) {
      console.error('删除历史记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 清空所有历史记录
   * 危险操作
   */
  async clearAllRecords(): Promise<void> {
    try {
      await db.typingRecords.clear();
    } catch (error) {
      console.error('清空历史记录失败:', error);
      throw error;
    }
  }
  
  /**
   * 按时间范围查询历史记录
   * 利用 Dexie 的索引优化查询性能
   * 
   * @param startDate 开始时间戳
   * @param endDate 结束时间戳
   * @returns 符合条件的记录数组
   */
  async getRecordsByDateRange(startDate: number, endDate: number): Promise<TypingRecord[]> {
    try {
      return await db.typingRecords
        .where('date')
        .between(startDate, endDate, true, true)
        .toArray();
    } catch (error) {
      console.error('按时间范围查询历史记录失败:', error);
      return [];
    }
  }
  
  /**
   * 按练习类型查询历史记录
   * 
   * @param practiceType 练习类型
   * @returns 符合条件的记录数组
   */
  async getRecordsByPracticeType(practiceType: string): Promise<TypingRecord[]> {
    try {
      return await db.typingRecords
        .where('practiceType')
        .equals(practiceType)
        .toArray();
    } catch (error) {
      console.error('按练习类型查询历史记录失败:', error);
      return [];
    }
  }
  
  /**
   * 获取最近 N 条记录
   * 
   * @param limit 记录数量
   * @returns 最近的记录数组
   */
  async getRecentRecords(limit: number = 10): Promise<TypingRecord[]> {
    try {
      return await db.typingRecords
        .orderBy('date')
        .reverse()
        .limit(limit)
        .toArray();
    } catch (error) {
      console.error('获取最近记录失败:', error);
      return [];
    }
  }
  
  /**
   * 获取记录总数
   * 
   * @returns 记录数量
   */
  async getRecordCount(): Promise<number> {
    try {
      return await db.typingRecords.count();
    } catch (error) {
      console.error('获取记录总数失败:', error);
      return 0;
    }
  }
}

/**
 * 创建历史记录仓库实例的工厂函数
 * 
 * @returns HistoryRepository 实例
 */
export function createHistoryRepository(): IHistoryRepository {
  return new HistoryRepository();
}
