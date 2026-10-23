/**
 * 学习服务
 * 
 * 管理学习列表、学习进度和学习统计
 */

import { db } from '../database/index'
import type { LearningCourse, LearningStats, LearningStatus } from '../types/learning'
import type { Course, CourseProgress } from '../types/course'

class LearningService {
  /**
   * 获取学习列表中的所有课程
   */
  async getLearningCourses(): Promise<LearningCourse[]> {
    try {
      // 从数据库获取学习列表
      const learningList = await db.learningList.toArray()
      const courseIds = learningList.map(item => item.courseId)
      
      if (courseIds.length === 0) {
        return []
      }
      
      // 获取课程详情
      const courses = await db.courses.where('id').anyOf(courseIds).toArray()
      
      // 获取进度信息
      const progressMap = new Map<string, CourseProgress>()
      const progressList = await db.courseProgress.where('courseId').anyOf(courseIds).toArray()
      progressList.forEach(p => progressMap.set(p.courseId, p))
      
      // 组装学习课程数据
      const learningCourses: LearningCourse[] = courses.map(course => {
        const learningInfo = learningList.find(item => item.courseId === course.id)
        const progress = progressMap.get(course.id)
        
        return {
          ...course,
          inLearningList: true,
          addedAt: learningInfo?.addedAt,
          lastStudiedAt: progress?.lastStudiedAt,
          totalStudyTime: learningInfo?.totalStudyTime || 0,
          completedLessons: progress?.completedLessonIds?.length || 0,
          completionPercentage: progress?.completionPercentage || 0,
          needsReview: this.checkNeedsReview(progress?.lastStudiedAt, progress?.completionPercentage),
          learningStatus: this.determineLearningStatus(progress),
        }
      })
      
      // 按最后学习时间排序
      return learningCourses.sort((a, b) => (b.lastStudiedAt || 0) - (a.lastStudiedAt || 0))
    } catch (error) {
      console.error('获取学习课程失败:', error)
      return []
    }
  }
  
  /**
   * 添加课程到学习列表
   */
  async addToLearningList(courseId: string): Promise<void> {
    try {
      // 检查是否已存在
      const existing = await db.learningList.get(courseId)
      if (existing) {
        console.warn('课程已在学习列表中:', courseId)
        return
      }
      
      // 添加到学习列表
      await db.learningList.add({
        courseId,
        addedAt: Date.now(),
        totalStudyTime: 0,
      })
    } catch (error) {
      console.error('添加到学习列表失败:', error)
      throw error
    }
  }
  
  /**
   * 批量添加课程到学习列表
   */
  async addMultipleToLearningList(courseIds: string[]): Promise<number> {
    let addedCount = 0
    
    for (const courseId of courseIds) {
      try {
        await this.addToLearningList(courseId)
        addedCount++
      } catch (error) {
        console.error('添加课程失败:', courseId, error)
      }
    }
    
    return addedCount
  }
  
  /**
   * 从学习列表移除课程
   */
  async removeFromLearningList(courseId: string): Promise<void> {
    try {
      await db.learningList.delete(courseId)
    } catch (error) {
      console.error('移除课程失败:', error)
      throw error
    }
  }
  
  /**
   * 获取学习统计
   */
  async getLearningStats(): Promise<LearningStats> {
    try {
      const learningCourses = await this.getLearningCourses()
      
      const inProgress = learningCourses.filter(
        c => c.learningStatus === 'in_progress'
      ).length
      
      const completed = learningCourses.filter(
        c => c.learningStatus === 'completed'
      ).length
      
      const totalMinutes = learningCourses.reduce(
        (sum, c) => sum + (c.totalStudyTime || 0),
        0
      )
      
      const reviewDue = learningCourses.filter(
        c => c.needsReview
      ).length
      
      return {
        inProgress,
        completed,
        totalHours: Math.round(totalMinutes / 60 * 10) / 10, // 保留1位小数
        reviewDue,
      }
    } catch (error) {
      console.error('获取学习统计失败:', error)
      return {
        inProgress: 0,
        completed: 0,
        totalHours: 0,
        reviewDue: 0,
      }
    }
  }
  
  /**
   * 检查课程是否在学习列表中
   */
  async isInLearningList(courseId: string): Promise<boolean> {
    try {
      const item = await db.learningList.get(courseId)
      return !!item
    } catch (error) {
      console.error('检查学习列表失败:', error)
      return false
    }
  }
  
  /**
   * 更新学习时长
   */
  async updateStudyTime(courseId: string, durationMinutes: number): Promise<void> {
    try {
      const item = await db.learningList.get(courseId)
      if (item) {
        await db.learningList.update(courseId, {
          totalStudyTime: (item.totalStudyTime || 0) + durationMinutes,
        })
      }
    } catch (error) {
      console.error('更新学习时长失败:', error)
      throw error
    }
  }
  
  /**
   * 判断是否需要复习
   * 如果超过3天未学习且完成度<100%，则需要复习
   */
  private checkNeedsReview(lastStudiedAt?: number, completionPercentage?: number): boolean {
    if (!lastStudiedAt || completionPercentage === 100) {
      return false
    }
    
    const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
    return lastStudiedAt < threeDaysAgo
  }
  
  /**
   * 判断学习状态
   */
  private determineLearningStatus(progress?: CourseProgress): LearningStatus {
    if (!progress) {
      return 'not_started'
    }
    
    if (progress.completionPercentage === 100) {
      return 'completed'
    }
    
    if (progress.completionPercentage > 0) {
      return 'in_progress'
    }
    
    return 'not_started'
  }
}

export const learningService = new LearningService()
