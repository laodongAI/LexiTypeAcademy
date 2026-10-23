/**
 * 练习数据 Store
 * 管理练习统计、错误数据、复习队列等
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

interface TodayStats {
  practiceCount: number
  avgAccuracy: number
  totalMinutes: number
  streakDays: number
}

interface ReviewItem {
  id: string
  unitId: string
  title: string
  nextReviewTime: number
  priority: number
  isOverdue: boolean
}

export const usePracticeStore = defineStore('practice', () => {
  // 状态
  const reviewQueue = ref<ReviewItem[]>([])
  const reviewQueueItems = computed(() => reviewQueue.value)

  // 获取今日统计
  async function getTodayStats(): Promise<TodayStats> {
    try {
      // TODO: 连接真实数据库获取练习记录
      // const records = await db.practiceRecords
      //   .where('completedAt')
      //   .above(todayTimestamp)
      //   .toArray()

      const stats: TodayStats = {
        practiceCount: 0,
        avgAccuracy: 0,
        totalMinutes: 0,
        streakDays: 0,
      }

      // 临时返回示例数据
      return stats
    } catch (error) {
      console.error('获取统计数据失败:', error)
      return {
        practiceCount: 0,
        avgAccuracy: 0,
        totalMinutes: 0,
        streakDays: 0,
      }
    }
  }

  // 计算连续天数
  async function calculateStreakDays(): Promise<number> {
    try {
      // TODO: 从数据库计算连续天数
      return 0
    } catch (error) {
      console.error('计算连续天数失败:', error)
      return 0
    }
  }

  // 加载复习队列
  async function loadReviewQueue() {
    try {
      // TODO: 从数据库加载复习队列
      // 这里应该基于 SRS 算法生成队列
      reviewQueue.value = []
    } catch (error) {
      console.error('加载复习队列失败:', error)
    }
  }

  return {
    reviewQueue,
    reviewQueueItems,
    getTodayStats,
    calculateStreakDays,
    loadReviewQueue,
  }
})
