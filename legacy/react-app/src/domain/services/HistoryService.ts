/**
 * 历史记录领域服务
 * DDD设计：Domain层 - 领域服务
 * 
 * 职责：
 * - 管理打字练习历史记录的业务逻辑
 * - 提供数据聚合和统计分析功能
 * - 支持多维度筛选和排序
 * - 计算平均值、趋势分析等衍生指标
 * 
 * 设计原则：
 * - 业务逻辑集中在 Domain 层
 * - 依赖倒置：定义接口，不依赖具体实现
 * - 单一职责：只处理历史记录相关的业务
 */

import type { TypingRecord } from '@/infrastructure/persistence/database';

/**
 * 练习类型枚举
 * 用于筛选不同类型的练习记录
 */
export type PracticeType = 
  | 'fingerPractice'   // 指法练习
  | 'typingPractice'   // 拼音练习
  | 'course-word'      // 课程单词模式
  | 'course-text'      // 课程文本模式
  | 'review'           // 复习模式
  | 'game'             // 游戏模式
  | string;            // 其他自定义类型

/**
 * 历史记录筛选条件
 */
export interface HistoryFilter {
  /** 练习类型筛选 */
  practiceType?: PracticeType | 'all';
  
  /** 难度筛选 */
  difficulty?: string;
  
  /** 开始日期（时间戳） */
  startDate?: number;
  
  /** 结束日期（时间戳） */
  endDate?: number;
  
  /** 最小 WPM */
  minWpm?: number;
  
  /** 最小准确率 */
  minAccuracy?: number;
}

/**
 * 历史记录排序方式
 */
export type SortOrder = 'date-desc' | 'date-asc' | 'wpm-desc' | 'wpm-asc' | 'accuracy-desc' | 'accuracy-asc';

/**
 * 历史统计数据
 */
export interface HistoryStats {
  /** 总记录数 */
  totalRecords: number;
  
  /** 平均 WPM */
  avgWpm: number;
  
  /** 平均准确率 */
  avgAccuracy: number;
  
  /** 最高 WPM */
  maxWpm: number;
  
  /** 最高准确率 */
  maxAccuracy: number;
  
  /** 总练习时长（分钟） */
  totalPracticeTime: number;
  
  /** 按练习类型分组统计 */
  byPracticeType: Record<string, {
    count: number;
    avgWpm: number;
    avgAccuracy: number;
  }>;
  
  /** 按难度分组统计 */
  byDifficulty: Record<string, {
    count: number;
    avgWpm: number;
    avgAccuracy: number;
  }>;
}

/**
 * 时间序列数据点
 * 用于绘制趋势图
 */
export interface TimeSeriesData {
  /** 日期标签 */
  labels: string[];
  
  /** WPM 数据点 */
  wpmData: number[];
  
  /** 准确率数据点 */
  accuracyData: number[];
}

/**
 * 数据仓库接口
 * 遵循依赖倒置原则
 */
export interface IHistoryRepository {
  /** 获取所有历史记录 */
  getAllRecords(): Promise<TypingRecord[]>;
  
  /** 添加历史记录 */
  addRecord(record: TypingRecord): Promise<void>;
  
  /** 删除历史记录 */
  deleteRecord(id: number): Promise<void>;
  
  /** 清空所有历史记录 */
  clearAllRecords(): Promise<void>;
  
  /** 按时间范围查询 */
  getRecordsByDateRange(startDate: number, endDate: number): Promise<TypingRecord[]>;
}

/**
 * 历史记录领域服务类
 */
export class HistoryService {
  private repository: IHistoryRepository;
  
  constructor(repository: IHistoryRepository) {
    this.repository = repository;
  }
  
  /**
   * 获取筛选后的历史记录
   * 
   * @param filter 筛选条件
   * @param sortOrder 排序方式
   * @returns 筛选排序后的记录数组
   */
  async getFilteredRecords(
    filter: HistoryFilter = {},
    sortOrder: SortOrder = 'date-desc'
  ): Promise<TypingRecord[]> {
    // 1. 获取所有记录
    let records = await this.repository.getAllRecords();
    
    // 2. 应用筛选条件
    records = this.applyFilter(records, filter);
    
    // 3. 应用排序
    records = this.applySorting(records, sortOrder);
    
    return records;
  }
  
  /**
   * 应用筛选条件
   * 
   * @param records 原始记录数组
   * @param filter 筛选条件
   * @returns 筛选后的记录数组
   */
  private applyFilter(records: TypingRecord[], filter: HistoryFilter): TypingRecord[] {
    return records.filter(record => {
      // 练习类型筛选
      if (filter.practiceType && filter.practiceType !== 'all') {
        if (record.practiceType !== filter.practiceType) {
          return false;
        }
      }
      
      // 难度筛选
      if (filter.difficulty && record.difficulty !== filter.difficulty) {
        return false;
      }
      
      // 日期范围筛选
      if (filter.startDate && record.date < filter.startDate) {
        return false;
      }
      if (filter.endDate && record.date > filter.endDate) {
        return false;
      }
      
      // WPM 筛选
      if (filter.minWpm !== undefined && record.wpm < filter.minWpm) {
        return false;
      }
      
      // 准确率筛选
      if (filter.minAccuracy !== undefined && record.accuracy < filter.minAccuracy) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * 应用排序
   * 
   * @param records 待排序的记录数组
   * @param sortOrder 排序方式
   * @returns 排序后的记录数组
   */
  private applySorting(records: TypingRecord[], sortOrder: SortOrder): TypingRecord[] {
    const sorted = [...records];
    
    switch (sortOrder) {
      case 'date-desc':
        return sorted.sort((a, b) => b.date - a.date);
      case 'date-asc':
        return sorted.sort((a, b) => a.date - b.date);
      case 'wpm-desc':
        return sorted.sort((a, b) => b.wpm - a.wpm);
      case 'wpm-asc':
        return sorted.sort((a, b) => a.wpm - b.wpm);
      case 'accuracy-desc':
        return sorted.sort((a, b) => b.accuracy - a.accuracy);
      case 'accuracy-asc':
        return sorted.sort((a, b) => a.accuracy - b.accuracy);
      default:
        return sorted;
    }
  }
  
  /**
   * 计算历史统计数据
   * 聚合分析所有记录
   * 
   * @param filter 可选的筛选条件
   * @returns 统计数据对象
   */
  async getStats(filter: HistoryFilter = {}): Promise<HistoryStats> {
    const records = await this.getFilteredRecords(filter, 'date-desc');
    
    if (records.length === 0) {
      return this.getEmptyStats();
    }
    
    // 计算基础统计
    const totalWpm = records.reduce((sum, r) => sum + r.wpm, 0);
    const totalAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0);
    const maxWpm = Math.max(...records.map(r => r.wpm));
    const maxAccuracy = Math.max(...records.map(r => r.accuracy));
    
    // 按练习类型分组
    const byPracticeType = this.groupByField(records, 'practiceType');
    
    // 按难度分组
    const byDifficulty = this.groupByField(records, 'difficulty');
    
    // 估算总练习时长（假设每次练习平均5分钟）
    const totalPracticeTime = records.length * 5;
    
    return {
      totalRecords: records.length,
      avgWpm: Math.round(totalWpm / records.length),
      avgAccuracy: Math.round(totalAccuracy / records.length),
      maxWpm,
      maxAccuracy,
      totalPracticeTime,
      byPracticeType,
      byDifficulty
    };
  }
  
  /**
   * 按字段分组统计
   * 
   * @param records 记录数组
   * @param field 分组字段名
   * @returns 分组统计结果
   */
  private groupByField(
    records: TypingRecord[],
    field: keyof TypingRecord
  ): Record<string, { count: number; avgWpm: number; avgAccuracy: number }> {
    const groups: Record<string, TypingRecord[]> = {};
    
    // 分组
    records.forEach(record => {
      const key = String(record[field] || 'unknown');
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(record);
    });
    
    // 统计每组数据
    const result: Record<string, { count: number; avgWpm: number; avgAccuracy: number }> = {};
    
    Object.keys(groups).forEach(key => {
      const group = groups[key];
      const totalWpm = group.reduce((sum, r) => sum + r.wpm, 0);
      const totalAccuracy = group.reduce((sum, r) => sum + r.accuracy, 0);
      
      result[key] = {
        count: group.length,
        avgWpm: Math.round(totalWpm / group.length),
        avgAccuracy: Math.round(totalAccuracy / group.length)
      };
    });
    
    return result;
  }
  
  /**
   * 获取空统计数据
   */
  private getEmptyStats(): HistoryStats {
    return {
      totalRecords: 0,
      avgWpm: 0,
      avgAccuracy: 0,
      maxWpm: 0,
      maxAccuracy: 0,
      totalPracticeTime: 0,
      byPracticeType: {},
      byDifficulty: {}
    };
  }
  
  /**
   * 获取时间序列数据
   * 用于绘制趋势图
   * 
   * @param filter 筛选条件
   * @param maxPoints 最大数据点数量（用于降采样）
   * @returns 时间序列数据
   */
  async getTimeSeriesData(
    filter: HistoryFilter = {},
    maxPoints: number = 30
  ): Promise<TimeSeriesData> {
    const records = await this.getFilteredRecords(filter, 'date-asc');
    
    if (records.length === 0) {
      return { labels: [], wpmData: [], accuracyData: [] };
    }
    
    // 如果数据点过多，进行降采样
    const sampledRecords = this.sampleRecords(records, maxPoints);
    
    return {
      labels: sampledRecords.map(r => this.formatDate(r.date)),
      wpmData: sampledRecords.map(r => r.wpm),
      accuracyData: sampledRecords.map(r => r.accuracy)
    };
  }
  
  /**
   * 数据降采样
   * 当数据点过多时，均匀采样减少数据量
   * 
   * @param records 原始记录数组
   * @param maxPoints 最大点数
   * @returns 采样后的记录数组
   */
  private sampleRecords(records: TypingRecord[], maxPoints: number): TypingRecord[] {
    if (records.length <= maxPoints) {
      return records;
    }
    
    const step = Math.floor(records.length / maxPoints);
    const sampled: TypingRecord[] = [];
    
    for (let i = 0; i < records.length; i += step) {
      sampled.push(records[i]);
    }
    
    return sampled;
  }
  
  /**
   * 格式化日期
   * 
   * @param timestamp 时间戳
   * @returns 格式化的日期字符串
   */
  private formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  }
  
  /**
   * 添加历史记录
   * 
   * @param record 记录数据
   */
  async addRecord(record: Omit<TypingRecord, 'id'>): Promise<void> {
    await this.repository.addRecord(record as TypingRecord);
  }
  
  /**
   * 删除历史记录
   * 
   * @param id 记录ID
   */
  async deleteRecord(id: number): Promise<void> {
    await this.repository.deleteRecord(id);
  }
  
  /**
   * 清空所有历史记录
   * 危险操作，需要确认
   */
  async clearAllRecords(): Promise<void> {
    await this.repository.clearAllRecords();
  }
  
  /**
   * 导出历史数据为 JSON
   * 用于数据备份和迁移
   * 
   * @param filter 筛选条件
   * @returns JSON 字符串
   */
  async exportToJSON(filter: HistoryFilter = {}): Promise<string> {
    const records = await this.getFilteredRecords(filter, 'date-desc');
    const stats = await this.getStats(filter);
    
    const exportData = {
      exportDate: new Date().toISOString(),
      totalRecords: records.length,
      stats,
      records
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

/**
 * 创建历史服务实例的工厂函数
 * 
 * @param repository 数据仓库实现
 * @returns HistoryService 实例
 */
export function createHistoryService(repository: IHistoryRepository): HistoryService {
  return new HistoryService(repository);
}
