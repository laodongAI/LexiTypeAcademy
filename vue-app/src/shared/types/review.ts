/**
 * 复习系统相关类型定义
 */

/**
 * 单词掌握度等级
 */
export enum MasteryLevel {
  /** 新单词 */
  New = 0,
  /** 学习中 */
  Learning = 1,
  /** 熟悉 */
  Familiar = 2,
  /** 熟练 */
  Proficient = 3,
  /** 精通 */
  Mastered = 4
}

/**
 * 单词掌握度记录
 */
export interface WordMastery {
  /** 单词 */
  word: string;
  /** 来源（课程ID或其他标识） */
  source: string;
  /** 掌握等级 */
  level: MasteryLevel;
  /** 下次复习时间 */
  nextReview: number;
  /** 复习间隔（天） */
  interval: number;
  /** 复习次数 */
  reviewCount: number;
  /** 连续正确次数 */
  consecutiveCorrect: number;
  /** 上次复习时间 */
  lastReview: number;
  /** 创建时间 */
  createdAt: number;
  /** SM-2 算法的 EF 值（Easy Factor） */
  easeFactor: number;
}

/**
 * 复习日志
 */
export interface ReviewLog {
  /** 日志ID */
  id?: number;
  /** 单词 */
  word: string;
  /** 来源 */
  source: string;
  /** 复习时间 */
  reviewDate: number;
  /** 复习结果（1-5，5最好） */
  quality: number;
  /** 是否回答正确 */
  correct: boolean;
  /** 反应时间（毫秒） */
  responseTime?: number;
  /** 掌握等级（复习时的等级） */
  level: MasteryLevel;
}

/**
 * 到期复习单词
 */
export interface DueWord {
  /** 单词 */
  word: string;
  /** 来源 */
  source: string;
  /** 掌握等级 */
  level: MasteryLevel;
  /** 下次复习时间 */
  nextReview: number;
  /** 复习次数 */
  reviewCount: number;
}

/**
 * 复习统计
 */
export interface ReviewStats {
  /** 总单词数 */
  totalWords: number;
  /** 新单词数 */
  newWords: number;
  /** 学习中单词数 */
  learningWords: number;
  /** 已掌握单词数 */
  masteredWords: number;
  /** 今日到期数 */
  dueToday: number;
  /** 今日已复习数 */
  reviewedToday: number;
}

/**
 * 复习会话
 */
export interface ReviewSession {
  /** 会话ID */
  id: string;
  /** 开始时间 */
  startTime: number;
  /** 结束时间 */
  endTime?: number;
  /** 复习的单词列表 */
  words: string[];
  /** 正确数量 */
  correctCount: number;
  /** 总数量 */
  totalCount: number;
  /** 准确率 */
  accuracy: number;
}
