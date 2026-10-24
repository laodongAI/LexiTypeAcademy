/**
 * 复习服务
 * 提供复习系统的业务逻辑，使用 SM-2 算法
 */

import { reviewRepository } from '../database/repositories/reviewRepository';
import type { WordMastery, ReviewLog, DueWord, ReviewStats, ReviewSession } from '../types/review';
import { MasteryLevel } from '../types/review';
import { createNewMastery, updateMasteryWithSM2, accuracyToQuality } from './sm2Algorithm';

/**
 * 复习服务类
 */
export class ReviewService {
  /**
   * 获取所有来源（去重）
   */
  async getSources(): Promise<string[]> {
    return await reviewRepository.getSources();
  }

  /**
   * 获取需要复习的单词
   */
  async getDueWords(limit: number = 20, source?: string): Promise<DueWord[]> {
    return await reviewRepository.getDueWords(limit, source);
  }

  /**
   * 提交复习结果（使用 SM-2 质量分 0-5）
   */
  async submitReviewWithQuality(
    word: string,
    source: string,
    quality: number,
    responseTime?: number
  ): Promise<void> {
    // 获取或创建单词掌握度记录
    let mastery = await reviewRepository.getWordMastery(word, source);
    if (!mastery) {
      mastery = createNewMastery(word, source);
    }

    // 质量分数约束在 0-5
    const normalizedQuality = Math.max(0, Math.min(5, Math.round(quality)));

    // 使用 SM-2 算法更新掌握度
    const updatedMastery = updateMasteryWithSM2(mastery, normalizedQuality);

    // 保存更新后的掌握度
    await reviewRepository.saveWordMastery(updatedMastery);

    // 记录复习日志
    const correct = normalizedQuality >= 3;
    const log: ReviewLog = {
      word,
      source,
      reviewDate: Date.now(),
      quality: normalizedQuality,
      correct,
      responseTime,
      level: updatedMastery.level
    };
    await reviewRepository.addReviewLog(log)
    void learningEventService.record({
      eventType: 'review_submitted',
      occurredAt: log.reviewDate,
      activityId: `${source}:${word}`,
      result: { accuracy: correct ? 1 : 0, correctCount: correct ? 1 : 0, totalCount: 1 },
      metadata: { source, word, quality: normalizedQuality, responseTimeMs: responseTime },
    }).catch(error => console.warn('记录复习生命周期事件失败，不影响已保存的复习结果:', error))
  }
  
  /**
   * 提交复习结果
   */
  async submitReview(
    word: string,
    source: string,
    correct: boolean,
    responseTime?: number
  ): Promise<void> {
    const quality = accuracyToQuality(correct, responseTime);
    await this.submitReviewWithQuality(word, source, quality, responseTime);
  }
  
  /**
   * 批量提交复习结果
   */
  async batchSubmitReviews(
    reviews: Array<{ word: string; source: string; correct: boolean; responseTime?: number }>
  ): Promise<void> {
    const masteryUpdates: WordMastery[] = [];
    const logs: ReviewLog[] = [];
    
    for (const review of reviews) {
      let mastery = await reviewRepository.getWordMastery(review.word, review.source);
      if (!mastery) {
        mastery = createNewMastery(review.word, review.source);
      }
      
      const quality = accuracyToQuality(review.correct, review.responseTime);
      const updatedMastery = updateMasteryWithSM2(mastery, quality);
      
      masteryUpdates.push(updatedMastery);
      logs.push({
        word: review.word,
        source: review.source,
        reviewDate: Date.now(),
        quality,
        correct: review.correct,
        responseTime: review.responseTime,
        level: updatedMastery.level
      });
    }
    
    await reviewRepository.batchSaveWordMastery(masteryUpdates);
    await reviewRepository.batchAddReviewLogs(logs);
    // 批量复习写一条汇总事件，避免每个单词再触发一次日志查询和写入。
    void learningEventService.record({
      eventType: 'review_submitted',
      occurredAt: Date.now(),
      result: {
        correctCount: reviews.filter(item => item.correct).length,
        totalCount: reviews.length,
        accuracy: reviews.length ? reviews.filter(item => item.correct).length / reviews.length : 0,
      },
      metadata: { batch: true, count: reviews.length },
    }).catch(error => console.warn('记录批量复习生命周期事件失败，不影响已保存的复习结果:', error))
  }
  
  /**
   * 获取单词掌握度
   */
  async getWordMastery(word: string, source: string): Promise<WordMastery | null> {
    const mastery = await reviewRepository.getWordMastery(word, source);
    return mastery || null;
  }
  
  /**
   * 获取所有单词掌握度（按来源筛选）
   */
  async getAllMastery(source?: string): Promise<WordMastery[]> {
    return await reviewRepository.getAllMastery(source);
  }
  
  /**
   * 获取复习统计
   */
  async getReviewStats(source?: string): Promise<ReviewStats> {
    return await reviewRepository.getReviewStats(source);
  }
  
  /**
   * 获取单词的复习历史
   */
  async getWordReviewHistory(word: string, source: string, limit: number = 10): Promise<ReviewLog[]> {
    return await reviewRepository.getWordReviewHistory(word, source, limit);
  }
  
  /**
   * 获取复习日志（按时间范围）
   */
  async getReviewLogs(startDate: Date, endDate: Date, source?: string): Promise<ReviewLog[]> {
    return await reviewRepository.getReviewLogs(startDate.getTime(), endDate.getTime(), source);
  }
  
  /**
   * 添加新单词到复习系统
   */
  async addWordToReview(word: string, source: string): Promise<void> {
    const existing = await reviewRepository.getWordMastery(word, source);
    if (!existing) {
      const mastery = createNewMastery(word, source);
      await reviewRepository.saveWordMastery(mastery);
    }
  }
  
  /**
   * 批量添加单词到复习系统
   */
  async batchAddWordsToReview(words: string[], source: string): Promise<void> {
    const masteryList: WordMastery[] = [];
    
    for (const word of words) {
      const existing = await reviewRepository.getWordMastery(word, source);
      if (!existing) {
        masteryList.push(createNewMastery(word, source));
      }
    }
    
    if (masteryList.length > 0) {
      await reviewRepository.batchSaveWordMastery(masteryList);
    }
  }
  
  /**
   * 重置单词掌握度
   */
  async resetWordMastery(word: string, source: string): Promise<void> {
    await reviewRepository.resetWordMastery(word, source);
  }
  
  /**
   * 删除单词
   */
  async deleteWord(word: string, source: string): Promise<void> {
    await reviewRepository.deleteWordMastery(word, source);
  }
  
  /**
   * 删除来源的所有数据
   */
  async deleteBySource(source: string): Promise<void> {
    await reviewRepository.deleteBySource(source);
  }
  
  /**
   * 创建复习会话
   */
  createReviewSession(words: DueWord[]): ReviewSession {
    return {
      id: `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime: Date.now(),
      words: words.map(w => w.word),
      correctCount: 0,
      totalCount: words.length,
      accuracy: 0
    };
  }
  
  /**
   * 完成复习会话
   */
  completeReviewSession(session: ReviewSession, correctCount: number): ReviewSession {
    return {
      ...session,
      endTime: Date.now(),
      correctCount,
      accuracy: session.totalCount > 0 ? (correctCount / session.totalCount) * 100 : 0
    };
  }
  
  /**
   * 获取弱词列表（掌握度较低的单词）
   */
  async getWeakWords(source?: string, limit: number = 50): Promise<WordMastery[]> {
    const allMastery = await reviewRepository.getAllMastery(source);
    
    // 按掌握等级和复习次数排序，优先返回掌握度低的单词
    return allMastery
      .sort((a, b) => {
        // 首先按等级排序
        if (a.level !== b.level) {
          return a.level - b.level;
        }
        // 等级相同时，按连续正确次数排序
        return a.consecutiveCorrect - b.consecutiveCorrect;
      })
      .slice(0, limit);
  }
  
  /**
   * 从课程内容中提取单词并添加到复习系统
   */
  async addWordsFromLessonItems(
    items: Array<{ english: string }>,
    courseId: string
  ): Promise<void> {
    const words = items.map(item => item.english.toLowerCase().trim());
    const uniqueWords = Array.from(new Set(words));
    await this.batchAddWordsToReview(uniqueWords, courseId);
  }
}

// 导出单例实例
export const reviewService = new ReviewService();
