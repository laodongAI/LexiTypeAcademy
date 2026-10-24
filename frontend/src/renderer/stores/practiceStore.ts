/**
 * 练习数据 Store
 * 管理真实练习统计与待复习队列。
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { courseRepository } from '../../shared/database/repositories/courseRepository'

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

const DAY_MS = 24 * 60 * 60 * 1000

export const usePracticeStore = defineStore('practice', () => {
  const reviewQueue = ref<ReviewItem[]>([])
  const reviewQueueItems = computed(() => reviewQueue.value)

  // 统计使用后端持久化的练习记录，不用示例值替代真实数据。
  async function getTodayStats(): Promise<TodayStats> {
    const now = Date.now()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    const records = await courseRepository.getPracticeRecordsByRange(todayStart - 29 * DAY_MS, now)
    const todayRecords = records.filter(record => record.completedAt >= todayStart && record.completedAt <= now)
    const avgAccuracy = todayRecords.length > 0
      ? todayRecords.reduce((sum, record) => sum + record.accuracy, 0) / todayRecords.length
      : 0
    const practicedDays = new Set<number>()
    for (const record of records) {
      const day = new Date(record.completedAt)
      day.setHours(0, 0, 0, 0)
      practicedDays.add(day.getTime())
    }

    let streakDays = 0
    for (let day = todayStart, i = 0; i < 30 && practicedDays.has(day); i++, day -= DAY_MS) {
      streakDays++
    }

    return {
      practiceCount: todayRecords.length,
      avgAccuracy,
      totalMinutes: Math.round(todayRecords.reduce((sum, record) => sum + record.duration, 0) / 60000),
      streakDays,
    }
  }

  async function calculateStreakDays(): Promise<number> {
    return (await getTodayStats()).streakDays
  }

  // 当前练习队列尚未接入独立的课程间隔复习数据源；明确为空，不伪造队列项目。
  async function loadReviewQueue() {
    reviewQueue.value = []
  }

  return {
    reviewQueue,
    reviewQueueItems,
    getTodayStats,
    calculateStreakDays,
    loadReviewQueue,
  }
})
