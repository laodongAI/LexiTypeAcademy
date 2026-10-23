/**
 * 复习状态管理
 * 使用 Pinia 管理复习系统相关的全局状态
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { reviewService } from '../../shared/services/reviewService';
import type { DueWord, ReviewStats, ReviewSession, WordMastery } from '../../shared/types/review';

export const useReviewStore = defineStore('review', () => {
  // 状态
  const dueWords = ref<DueWord[]>([]);
  const reviewStats = ref<ReviewStats | null>(null);
  const currentSession = ref<ReviewSession | null>(null);
  const sources = ref<string[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // 计算属性
  const dueCount = computed(() => dueWords.value.length);
  const hasdue = computed(() => dueWords.value.length > 0);
  
  // 操作方法
  
  /**
   * 加载到期单词
   */
  async function loadDueWords(limit: number = 20, source?: string) {
    loading.value = true;
    error.value = null;
    try {
      dueWords.value = await reviewService.getDueWords(limit, source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载到期单词失败';
      console.error('加载到期单词失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 加载复习统计
   */
  async function loadReviewStats(source?: string) {
    loading.value = true;
    error.value = null;
    try {
      reviewStats.value = await reviewService.getReviewStats(source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载复习统计失败';
      console.error('加载复习统计失败:', e);
    } finally {
      loading.value = false;
    }
  }

  /**
   * 加载来源列表
   */
  async function loadSources() {
    loading.value = true;
    error.value = null;
    try {
      sources.value = await reviewService.getSources();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载来源失败';
      console.error('加载来源失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 提交复习结果
   */
  async function submitReview(
    word: string,
    source: string,
    correct: boolean,
    responseTime?: number
  ) {
    try {
      await reviewService.submitReview(word, source, correct, responseTime);
      
      // 更新当前会话
      if (currentSession.value) {
        if (correct) {
          currentSession.value.correctCount++;
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '提交复习失败';
      console.error('提交复习失败:', e);
      throw e;
    }
  }

  /**
   * 提交复习结果（质量分 0-5）
   */
  async function submitReviewWithQuality(
    word: string,
    source: string,
    quality: number,
    responseTime?: number
  ) {
    try {
      await reviewService.submitReviewWithQuality(word, source, quality, responseTime);

      if (currentSession.value) {
        if (quality >= 3) {
          currentSession.value.correctCount++;
        }
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '提交复习失败';
      console.error('提交复习失败:', e);
      throw e;
    }
  }
  
  /**
   * 批量提交复习结果
   */
  async function batchSubmitReviews(
    reviews: Array<{ word: string; source: string; correct: boolean; responseTime?: number }>
  ) {
    loading.value = true;
    error.value = null;
    try {
      await reviewService.batchSubmitReviews(reviews);
      
      // 更新当前会话
      if (currentSession.value) {
        const correctCount = reviews.filter(r => r.correct).length;
        currentSession.value.correctCount += correctCount;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '批量提交复习失败';
      console.error('批量提交复习失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 开始复习会话
   */
  async function startReviewSession(limit: number = 20, source?: string) {
    loading.value = true;
    error.value = null;
    try {
      await loadDueWords(limit, source);
      if (dueWords.value.length > 0) {
        currentSession.value = reviewService.createReviewSession(dueWords.value);
      } else {
        error.value = '没有需要复习的单词';
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '开始复习失败';
      console.error('开始复习失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 完成复习会话
   */
  function completeReviewSession() {
    if (currentSession.value) {
      currentSession.value = reviewService.completeReviewSession(
        currentSession.value,
        currentSession.value.correctCount
      );
    }
  }
  
  /**
   * 结束复习会话
   */
  function endReviewSession() {
    completeReviewSession();
    currentSession.value = null;
    dueWords.value = [];
  }
  
  /**
   * 添加单词到复习系统
   */
  async function addWordToReview(word: string, source: string) {
    try {
      await reviewService.addWordToReview(word, source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '添加单词失败';
      console.error('添加单词失败:', e);
      throw e;
    }
  }
  
  /**
   * 批量添加单词到复习系统
   */
  async function batchAddWordsToReview(words: string[], source: string) {
    loading.value = true;
    error.value = null;
    try {
      await reviewService.batchAddWordsToReview(words, source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '批量添加单词失败';
      console.error('批量添加单词失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 获取弱词列表
   */
  async function loadWeakWords(source?: string, limit: number = 50): Promise<WordMastery[]> {
    loading.value = true;
    error.value = null;
    try {
      return await reviewService.getWeakWords(source, limit);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载弱词列表失败';
      console.error('加载弱词列表失败:', e);
      return [];
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 重置单词掌握度
   */
  async function resetWordMastery(word: string, source: string) {
    try {
      await reviewService.resetWordMastery(word, source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '重置单词失败';
      console.error('重置单词失败:', e);
      throw e;
    }
  }
  
  /**
   * 删除单词
   */
  async function deleteWord(word: string, source: string) {
    try {
      await reviewService.deleteWord(word, source);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除单词失败';
      console.error('删除单词失败:', e);
      throw e;
    }
  }
  
  /**
   * 清除错误
   */
  function clearError() {
    error.value = null;
  }
  
  return {
    // 状态
    dueWords,
    reviewStats,
    currentSession,
    sources,
    loading,
    error,
    
    // 计算属性
    dueCount,
    hasDue: hasdue,
    
    // 方法
    loadDueWords,
    loadReviewStats,
    loadSources,
    submitReview,
    submitReviewWithQuality,
    batchSubmitReviews,
    startReviewSession,
    completeReviewSession,
    endReviewSession,
    addWordToReview,
    batchAddWordsToReview,
    loadWeakWords,
    resetWordMastery,
    deleteWord,
    clearError
  };
});
