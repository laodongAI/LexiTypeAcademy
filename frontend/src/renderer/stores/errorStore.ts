/**
 * 错误数据 Store
 * 管理错误统计、错误分类、自适应推荐等
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ErrorItem {
  id: string
  unitId: string
  title: string
  errorType: string
  frequency: number
  severity: number
  masteryScore: number
}

interface DailyStats {
  listeningErrorRate: number
  speakingErrorRate: number
  readingErrorRate: number
  writingErrorRate: number
}

export const useErrorStore = defineStore('error', () => {
  // 状态
  const errorItems = ref<ErrorItem[]>([])

  // 获取今日错误统计
  function getDailyStats(): DailyStats {
    // TODO: 从数据库计算
    return {
      listeningErrorRate: 0.35,
      speakingErrorRate: 0.28,
      readingErrorRate: 0.15,
      writingErrorRate: 0.42,
    }
  }

  // 获取掌握度差的项目
  function getMasteryGaps(): ErrorItem[] {
    // TODO: 从数据库查询掌握度 < 50% 的项目
    return errorItems.value.filter((item) => item.masteryScore < 50)
  }

  // 获取错误项目
  function getErrorItems(): ErrorItem[] {
    return errorItems.value.sort(
      (a, b) => b.frequency - a.frequency
    )
  }

  // 加载错误数据
  async function loadErrorData() {
    try {
      // TODO: 从数据库加载错误数据
      errorItems.value = []
    } catch (error) {
      console.error('加载错误数据失败:', error)
    }
  }

  return {
    errorItems,
    getDailyStats,
    getMasteryGaps,
    getErrorItems,
    loadErrorData,
  }
})
