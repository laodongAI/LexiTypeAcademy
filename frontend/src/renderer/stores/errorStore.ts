/**
 * 错误数据 Store
 * 从已保存的练习记录中汇总错误频率与今日各模式错误率。
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { courseRepository } from '../../shared/database/repositories/courseRepository'

interface ErrorItem {
  id: string
  unitId: string
  title: string
  errorType: string
  frequency: number
  severity: number
}

interface DailyStats {
  listeningErrorRate: number
  speakingErrorRate: number
  readingErrorRate: number
  writingErrorRate: number
}

const emptyDailyStats = (): DailyStats => ({
  listeningErrorRate: 0,
  speakingErrorRate: 0,
  readingErrorRate: 0,
  writingErrorRate: 0,
})

export const useErrorStore = defineStore('error', () => {
  const errorItems = ref<ErrorItem[]>([])
  const dailyStats = ref<DailyStats>(emptyDailyStats())

  function getDailyStats(): DailyStats {
    return { ...dailyStats.value }
  }

  // 目前没有逐题总作答次数，使用重复出现的错题作为高频错题，不伪造掌握度分数。
  function getFrequentErrors(): ErrorItem[] {
    return errorItems.value.filter(item => item.frequency >= 2)
  }

  function getErrorItems(): ErrorItem[] {
    return [...errorItems.value].sort((a, b) => b.frequency - a.frequency)
  }

  async function loadErrorData() {
    try {
      const records = await courseRepository.getAllPracticeRecords()
      const now = Date.now()
      const today = new Date(now)
      today.setHours(0, 0, 0, 0)
      const todayRecords = records.filter(record =>
        record.completedAt >= today.getTime() && record.completedAt <= now
      )

      const rateForModes = (modes: string[]) => {
        const subset = todayRecords.filter(record => modes.includes(String(record.mode)))
        if (subset.length === 0) return 0
        const averageAccuracy = subset.reduce((sum, record) => sum + record.accuracy, 0) / subset.length
        return Math.max(0, Math.min(1, 1 - averageAccuracy / 100))
      }

      dailyStats.value = {
        listeningErrorRate: rateForModes(['dictation']),
        speakingErrorRate: rateForModes(['follow', 'imitation']),
        // 当前练习模式没有独立阅读模式，不能从其他模式推断阅读错误率。
        readingErrorRate: 0,
        writingErrorRate: rateForModes(['translation']),
      }

      const aggregates = new Map<string, ErrorItem>()
      const modeLabels: Record<string, string> = {
        dictation: '听写',
        follow: '跟读',
        translation: '翻译',
        imitation: '模仿',
      }
      for (const record of records) {
        for (const itemId of record.incorrectItemIds ?? []) {
          const key = `${record.lessonId}:${itemId}`
          const current = aggregates.get(key)
          if (current) {
            current.frequency++
            current.severity = Math.min(5, current.frequency)
          } else {
            aggregates.set(key, {
              id: key,
              unitId: record.lessonId,
              title: `练习题目 ${itemId}`,
              errorType: modeLabels[String(record.mode)] ?? String(record.mode),
              frequency: 1,
              severity: 1,
            })
          }
        }
      }
      errorItems.value = [...aggregates.values()].sort((a, b) => b.frequency - a.frequency)
    } catch (error) {
      console.error('加载错误数据失败:', error)
      // 不以虚构统计替代真实数据；保留当前数据并让调用方记录错误。
      throw error
    }
  }

  return {
    errorItems,
    getDailyStats,
    getFrequentErrors,
    getErrorItems,
    loadErrorData,
  }
})
