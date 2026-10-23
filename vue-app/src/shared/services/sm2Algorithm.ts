/**
 * SM-2 算法实现
 * Spaced Repetition System - SuperMemo 2 算法
 * 
 * 用于计算单词复习的间隔时间
 */

import type { WordMastery } from '../types/review';
import { MasteryLevel } from '../types/review';

/**
 * SM-2 算法参数
 */
interface SM2Params {
  /** 复习质量（0-5） */
  quality: number;
  /** 当前间隔（天） */
  interval: number;
  /** 连续正确次数 */
  consecutiveCorrect: number;
  /** 易度因子（Easy Factor） */
  easeFactor: number;
}

/**
 * SM-2 算法结果
 */
interface SM2Result {
  /** 新的间隔（天） */
  interval: number;
  /** 新的连续正确次数 */
  consecutiveCorrect: number;
  /** 新的易度因子 */
  easeFactor: number;
}

/**
 * SM-2 算法核心函数
 * 
 * @param params SM-2 参数
 * @returns SM-2 结果
 */
export function calculateSM2(params: SM2Params): SM2Result {
  const { quality, interval, consecutiveCorrect, easeFactor } = params;
  
  let newInterval: number;
  let newConsecutiveCorrect: number;
  let newEaseFactor: number;
  
  // 计算新的易度因子
  newEaseFactor = easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  
  // 确保易度因子不低于 1.3
  if (newEaseFactor < 1.3) {
    newEaseFactor = 1.3;
  }
  
  // 根据质量计算新的间隔
  if (quality < 3) {
    // 回答错误，重新开始
    newConsecutiveCorrect = 0;
    newInterval = 1;
  } else {
    // 回答正确
    newConsecutiveCorrect = consecutiveCorrect + 1;
    
    if (newConsecutiveCorrect === 1) {
      newInterval = 1;
    } else if (newConsecutiveCorrect === 2) {
      newInterval = 6;
    } else {
      newInterval = Math.round(interval * newEaseFactor);
    }
  }
  
  return {
    interval: newInterval,
    consecutiveCorrect: newConsecutiveCorrect,
    easeFactor: newEaseFactor
  };
}

/**
 * 更新单词掌握度（使用 SM-2 算法）
 * 
 * @param mastery 当前掌握度
 * @param quality 复习质量（0-5）
 * @returns 更新后的掌握度
 */
export function updateMasteryWithSM2(mastery: WordMastery, quality: number): WordMastery {
  const sm2Result = calculateSM2({
    quality,
    interval: mastery.interval,
    consecutiveCorrect: mastery.consecutiveCorrect,
    easeFactor: mastery.easeFactor
  });
  
  const now = Date.now();
  const nextReview = now + sm2Result.interval * 24 * 60 * 60 * 1000;
  
  // 根据复习表现更新掌握等级
  let newLevel = mastery.level;
  if (quality >= 4) {
    // 回答优秀
    if (sm2Result.consecutiveCorrect >= 3 && newLevel < MasteryLevel.Familiar) {
      newLevel = MasteryLevel.Familiar;
    }
    if (sm2Result.consecutiveCorrect >= 6 && newLevel < MasteryLevel.Proficient) {
      newLevel = MasteryLevel.Proficient;
    }
    if (sm2Result.consecutiveCorrect >= 10 && newLevel < MasteryLevel.Mastered) {
      newLevel = MasteryLevel.Mastered;
    }
  } else if (quality < 3) {
    // 回答错误，降级
    if (newLevel > MasteryLevel.Learning) {
      newLevel = MasteryLevel.Learning;
    }
  } else if (mastery.level === MasteryLevel.New) {
    // 第一次正确回答，进入学习状态
    newLevel = MasteryLevel.Learning;
  }
  
  return {
    ...mastery,
    level: newLevel,
    interval: sm2Result.interval,
    consecutiveCorrect: sm2Result.consecutiveCorrect,
    easeFactor: sm2Result.easeFactor,
    nextReview,
    lastReview: now,
    reviewCount: mastery.reviewCount + 1
  };
}

/**
 * 创建新的单词掌握度记录
 * 
 * @param word 单词
 * @param source 来源
 * @returns 新的掌握度记录
 */
export function createNewMastery(word: string, source: string): WordMastery {
  const now = Date.now();
  return {
    word,
    source,
    level: MasteryLevel.New,
    interval: 0,
    consecutiveCorrect: 0,
    reviewCount: 0,
    nextReview: now,
    lastReview: now,
    createdAt: now,
    easeFactor: 2.5
  };
}

/**
 * 将复习结果（0-1的准确度）转换为 SM-2 质量分数（0-5）
 * 
 * @param correct 是否正确
 * @param responseTime 反应时间（毫秒，可选）
 * @returns SM-2 质量分数
 */
export function accuracyToQuality(correct: boolean, responseTime?: number): number {
  if (!correct) {
    return 0; // 完全错误
  }
  
  // 根据反应时间调整质量分数
  if (responseTime) {
    if (responseTime < 2000) {
      return 5; // 非常快速且正确
    } else if (responseTime < 5000) {
      return 4; // 正常速度且正确
    } else {
      return 3; // 较慢但正确
    }
  }
  
  return 4; // 默认正确但无时间信息
}

/**
 * 将 UI 评分（1-4）转换为 SM-2 质量分数（0-5）
 *
 * 约定：
 * - 1（忘记了）-> 0
 * - 2（有点难）-> 3（正确但困难）
 * - 3（记住了）-> 4（正确）
 * - 4（很简单）-> 5（非常轻松）
 */
export function ratingToQuality(rating: number): number {
  switch (rating) {
    case 1:
      return 0
    case 2:
      return 3
    case 3:
      return 4
    case 4:
      return 5
    default:
      // 兜底：保持在 0-5 范围内
      if (Number.isFinite(rating)) {
        return Math.max(0, Math.min(5, Math.round(rating)))
      }
      return 0
  }
}
