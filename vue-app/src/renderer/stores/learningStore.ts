/**
 * 学习列表 Store
 * 
 * 管理用户的学习列表、学习进度和统计
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { learningService } from '../../shared/services/learningService'
import type { LearningCourse, LearningStats } from '../../shared/types/learning'

export const useLearningStore = defineStore('learning', () => {
  // ========== 状态 ==========
  const learningCourses = ref<LearningCourse[]>([])
  const stats = ref<LearningStats>({
    inProgress: 0,
    completed: 0,
    totalHours: 0,
    reviewDue: 0,
  })
  const loading = ref(false)
  const error = ref<string | null>(null)
  
  // ========== 计算属性 ==========
  
  /** 学习中的课程 */
  const inProgressCourses = computed(() => 
    learningCourses.value.filter(c => c.learningStatus === 'in_progress')
  )
  
  /** 已完成的课程 */
  const completedCourses = computed(() => 
    learningCourses.value.filter(c => c.learningStatus === 'completed')
  )
  
  /** 待复习的课程 */
  const reviewDueCourses = computed(() => 
    learningCourses.value.filter(c => c.needsReview)
  )
  
  /** 未开始的课程 */
  const notStartedCourses = computed(() => 
    learningCourses.value.filter(c => c.learningStatus === 'not_started')
  )
  
  // ========== 方法 ==========
  
  /**
   * 加载学习列表
   */
  async function loadLearningCourses() {
    loading.value = true
    error.value = null
    
    try {
      const [courses, statistics] = await Promise.all([
        learningService.getLearningCourses(),
        learningService.getLearningStats(),
      ])
      
      learningCourses.value = courses
      stats.value = statistics
    } catch (err) {
      error.value = err instanceof Error ? err.message : '加载学习列表失败'
      console.error('加载学习列表失败:', err)
      throw err
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 添加课程到学习列表
   */
  async function addToLearningList(courseId: string) {
    try {
      await learningService.addToLearningList(courseId)
      await loadLearningCourses() // 重新加载列表
    } catch (err) {
      error.value = err instanceof Error ? err.message : '添加到学习列表失败'
      console.error('添加到学习列表失败:', err)
      throw err
    }
  }
  
  /**
   * 批量添加课程到学习列表
   */
  async function addMultipleToLearningList(courseIds: string[]): Promise<number> {
    try {
      const count = await learningService.addMultipleToLearningList(courseIds)
      await loadLearningCourses() // 重新加载列表
      return count
    } catch (err) {
      error.value = err instanceof Error ? err.message : '批量添加失败'
      console.error('批量添加失败:', err)
      throw err
    }
  }
  
  /**
   * 从学习列表移除课程
   */
  async function removeFromLearningList(courseId: string) {
    try {
      await learningService.removeFromLearningList(courseId)
      await loadLearningCourses() // 重新加载列表
    } catch (err) {
      error.value = err instanceof Error ? err.message : '移除课程失败'
      console.error('移除课程失败:', err)
      throw err
    }
  }
  
  /**
   * 检查课程是否在学习列表中
   */
  async function isInLearningList(courseId: string): Promise<boolean> {
    try {
      return await learningService.isInLearningList(courseId)
    } catch (err) {
      console.error('检查学习列表失败:', err)
      return false
    }
  }
  
  /**
   * 更新学习时长
   */
  async function updateStudyTime(courseId: string, durationMinutes: number) {
    try {
      await learningService.updateStudyTime(courseId, durationMinutes)
      await loadLearningCourses() // 重新加载以更新统计
    } catch (err) {
      error.value = err instanceof Error ? err.message : '更新学习时长失败'
      console.error('更新学习时长失败:', err)
      throw err
    }
  }
  
  /**
   * 刷新统计数据
   */
  async function refreshStats() {
    try {
      stats.value = await learningService.getLearningStats()
    } catch (err) {
      console.error('刷新统计失败:', err)
    }
  }
  
  return {
    // 状态
    learningCourses,
    stats,
    loading,
    error,
    
    // 计算属性
    inProgressCourses,
    completedCourses,
    reviewDueCourses,
    notStartedCourses,
    
    // 方法
    loadLearningCourses,
    addToLearningList,
    addMultipleToLearningList,
    removeFromLearningList,
    isInLearningList,
    updateStudyTime,
    refreshStats,
  }
})
