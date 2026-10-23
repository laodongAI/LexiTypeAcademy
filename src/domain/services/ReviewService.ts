/**
 * 复习服务（领域服务）
 * DDD设计：Domain层 - 领域服务
 * 
 * 职责：
 * - 实现间隔重复算法（Spaced Repetition - SM-2 简化版）
 * - 管理单词复习的业务逻辑
 * - 提供复习统计和分析功能
 * - 与数据访问层（Repository）解耦
 * 
 * 设计模式：
 * - 单例模式：确保全局只有一个服务实例
 * - 依赖注入：依赖于数据库接口，而非具体实现
 * 
 * 间隔重复算法说明（SM-2简化版）：
 * - 正确时：间隔逐渐增大（1天 → 3天 → 7.5天 → 18.75天...）
 * - 错误时：重置为今天，从头开始
 * - 最多5个掌握级别
 */

import type { 
  WordMastery, 
  ReviewLog, 
  ReviewStats, 
  DueWord, 
  RetentionDataPoint,
  LastReviewInfo,
  ReviewResult
} from '@/domain/models/ReviewModels';

/**
 * 数据库接口抽象
 * 遵循依赖倒置原则，Domain层定义接口，Infrastructure层实现
 */
export interface IReviewRepository {
  /** 获取单词掌握记录 */
  getWordMastery(word: string, source: string): Promise<WordMastery | undefined>;
  
  /** 保存或更新单词掌握记录 */
  putWordMastery(mastery: WordMastery): Promise<void>;
  
  /** 添加复习日志 */
  addReviewLog(log: ReviewLog): Promise<void>;
  
  /** 获取到期的单词列表 */
  getDueWords(limit: number, source?: string): Promise<DueWord[]>;
  
  /** 获取所有单词掌握记录 */
  getAllMastery(source?: string): Promise<WordMastery[]>;
  
  /** 获取复习日志 */
  getReviewLogs(word?: string, source?: string, since?: number): Promise<ReviewLog[]>;
}

/**
 * 复习服务类
 * 封装复习相关的核心业务逻辑
 */
export class ReviewService {
  /** 间隔重复算法参数 */
  private readonly INITIAL_INTERVAL = 1; // 首次正确后1天复习
  private readonly SECOND_INTERVAL = 3;  // 第二次正确后3天复习
  private readonly INTERVAL_MULTIPLIER = 2.5; // 后续间隔倍数
  private readonly MAX_LEVEL = 5; // 最大掌握级别
  private readonly MASTERED_THRESHOLD = 4; // 掌握阈值
  
  private repository: IReviewRepository;
  
  constructor(repository: IReviewRepository) {
    this.repository = repository;
  }
  
  /**
   * 记录单词复习结果
   * 核心业务逻辑：根据复习结果更新掌握程度和下次复习时间
   * 
   * @param word 单词文本
   * @param isCorrect 是否正确
   * @param source 学习来源
   * @returns 新的复习间隔和下次复习时间
   */
  async recordResult(
    word: string, 
    isCorrect: boolean, 
    source: string = 'english'
  ): Promise<{ interval: number; nextReview: number }> {
    // 1. 获取或创建单词掌握记录
    let mastery = await this.repository.getWordMastery(word, source);
    if (!mastery) {
      mastery = {
        word,
        source,
        nextReview: Date.now(),
        interval: 0,
        level: 0
      };
    }
    
    const intervalBefore = mastery.interval;
    
    // 2. 根据复习结果应用SM-2算法
    if (isCorrect) {
      // 正确时：增加间隔和级别
      mastery = this.calculateNextInterval(mastery);
    } else {
      // 错误时：重置学习进度
      mastery.level = 0;
      mastery.interval = 0;
    }
    
    // 3. 计算下次复习时间（毫秒）
    mastery.nextReview = Date.now() + (mastery.interval * 24 * 60 * 60 * 1000);
    
    // 4. 持久化更新后的掌握记录
    await this.repository.putWordMastery(mastery);
    
    // 5. 记录复习日志（用于后续分析）
    await this.repository.addReviewLog({
      word,
      source,
      reviewDate: Date.now(),
      result: isCorrect ? 'correct' : 'incorrect',
      intervalBefore,
      intervalAfter: mastery.interval,
      easeFactor: this.INTERVAL_MULTIPLIER
    });
    
    return {
      interval: mastery.interval,
      nextReview: mastery.nextReview
    };
  }
  
  /**
   * 计算下一次复习间隔
   * 实现简化的SM-2算法
   * 
   * @param mastery 当前掌握记录
   * @returns 更新后的掌握记录
   */
  private calculateNextInterval(mastery: WordMastery): WordMastery {
    if (mastery.level === 0) {
      // 首次正确：1天后复习
      mastery.interval = this.INITIAL_INTERVAL;
    } else if (mastery.level === 1) {
      // 第二次正确：3天后复习
      mastery.interval = this.SECOND_INTERVAL;
    } else {
      // 后续正确：间隔乘以2.5
      mastery.interval = Math.ceil(mastery.interval * this.INTERVAL_MULTIPLIER);
    }
    
    // 提升掌握级别（最多5级）
    mastery.level = Math.min(mastery.level + 1, this.MAX_LEVEL);
    
    return mastery;
  }
  
  /**
   * 获取到期需要复习的单词列表
   * 
   * @param limit 返回的最大单词数量
   * @param source 可选的来源筛选
   * @returns 到期单词数组
   */
  async getDueWords(limit: number = 20, source?: string): Promise<DueWord[]> {
    return this.repository.getDueWords(limit, source);
  }
  
  /**
   * 获取复习统计数据
   * 聚合分析用户的学习进度
   * 
   * @returns 统计数据对象
   */
  async getStats(): Promise<ReviewStats> {
    const all = await this.repository.getAllMastery();
    const now = Date.now();
    
    return {
      total: all.length,
      mastered: all.filter(w => w.level >= this.MASTERED_THRESHOLD).length,
      learning: all.filter(w => w.level < this.MASTERED_THRESHOLD).length,
      due: all.filter(w => w.nextReview <= now).length,
      bySource: this.groupBySource(all)
    };
  }
  
  /**
   * 按来源分组统计单词数量
   * 
   * @param words 单词掌握记录数组
   * @returns 按来源分组的计数对象
   */
  private groupBySource(words: WordMastery[]): Record<string, number> {
    return words.reduce((acc, curr) => {
      acc[curr.source] = (acc[curr.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
  
  /**
   * 获取遗忘曲线的保留率统计
   * 用于可视化学习效果
   * 
   * @returns 按间隔排序的保留率数据点数组
   */
  async getRetentionStats(): Promise<RetentionDataPoint[]> {
    const logs = await this.repository.getReviewLogs();
    
    // 按复习前间隔分组统计
    const stats: Record<number, { total: number; correct: number }> = {};
    
    logs.forEach(log => {
      const interval = log.intervalBefore;
      if (!stats[interval]) {
        stats[interval] = { total: 0, correct: 0 };
      }
      stats[interval].total++;
      if (log.result === 'correct') {
        stats[interval].correct++;
      }
    });
    
    // 转换为数据点数组并排序
    return Object.entries(stats)
      .map(([interval, data]) => ({
        interval: Number(interval),
        retentionRate: (data.correct / data.total) * 100,
        count: data.total
      }))
      .sort((a, b) => a.interval - b.interval);
  }
  
  /**
   * 获取特定单词的最后复习信息
   * 用于显示记忆曲线提示
   * 
   * @param word 单词
   * @param source 学习来源
   * @returns 最后复习信息，如果没有记录则返回null
   */
  async getLastReview(word: string, source: string = 'english'): Promise<LastReviewInfo | null> {
    try {
      // 获取该单词的复习日志（按日期倒序）
      const logs = await this.repository.getReviewLogs(word, source);
      if (!logs.length) return null;
      
      // 按日期排序，获取最新的日志
      const sortedLogs = logs.sort((a, b) => b.reviewDate - a.reviewDate);
      const lastLog = sortedLogs[0];
      
      // 获取当前掌握记录
      const mastery = await this.repository.getWordMastery(word, source);
      
      return {
        lastReviewDate: lastLog.reviewDate,
        lastResult: lastLog.result,
        nextReview: mastery?.nextReview,
        level: mastery?.level,
        interval: mastery?.interval
      };
    } catch (error) {
      console.error('获取最后复习信息失败:', error);
      return null;
    }
  }
  
  /**
   * 获取最近复习的单词集合
   * 用于过滤重复练习
   * 
   * @param days 天数，默认1天
   * @param source 学习来源
   * @returns 单词集合（Set，自动去重）
   */
  async getRecentlyReviewedSet(days: number = 1, source: string = 'english'): Promise<Set<string>> {
    const since = Date.now() - days * 86400000; // 毫秒转换
    const logs = await this.repository.getReviewLogs(undefined, source, since);
    
    // 使用Set自动去重
    const wordSet = new Set<string>();
    logs.forEach(log => {
      if (log.source === source) {
        wordSet.add(log.word.toLowerCase());
      }
    });
    
    return wordSet;
  }
}

/**
 * 创建复习服务实例的工厂函数
 * 便于依赖注入和测试
 * 
 * @param repository 数据仓库实现
 * @returns ReviewService实例
 */
export function createReviewService(repository: IReviewRepository): ReviewService {
  return new ReviewService(repository);
}
