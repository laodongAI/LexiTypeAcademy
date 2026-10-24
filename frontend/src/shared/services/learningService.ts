/**
 * 学习服务
 * 
 * 管理学习列表、学习进度和学习统计
 */

import { commonRepository } from '../database/repositories/commonRepository'
import { courseRepository } from '../database/repositories/courseRepository'
import type { LearningCourse, LearningStats, LearningStatus } from '../types/learning'
import type { CourseProgress } from '../types/course'

class LearningService {
  /**
   * 获取学习列表中的所有课程
   */
  async getLearningCourses(): Promise<LearningCourse[]> {
    try {
      // 从后端获取学习列表
      const learningList = await commonRepository.getLearningList()
      const courseIds = learningList.map(item => item.courseId)
      
      if (courseIds.length === 0) {
        return []
      }
      
      // 获取课程详情（一次请求批量取回）
      const courses = await courseRepository.getCoursesByIds(courseIds)
      
      // 获取进度信息：逐个读取，失败项按无进度处理
      const progressMap = new Map<string, CourseProgress>()
      const progressList = await Promise.all(
        courseIds.map(async courseId => {
          try {
            return await courseRepository.getCourseProgress(courseId)
          } catch (error) {
            console.error('读取课程进度失败:', courseId, error)
            return undefined
          }
        })
      )
      progressList.forEach(p => {
        if (p) progressMap.set(p.courseId, p)
      })
      
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
      // 不把接口故障伪装成“没有学习课程”，由调用方展示错误态。
      console.error('获取学习课程失败:', error)
      throw error
    }
  }
  
  /**
   * 添加课程到学习列表
   */
  async addToLearningList(courseId: string): Promise<void> {
    try {
      // 检查是否已存在
      const existing = await commonRepository.getLearningListItem(courseId)
      if (existing) {
        console.warn('课程已在学习列表中:', courseId)
        return
      }
      
      // 添加到学习列表
      await commonRepository.addLearningListItem({
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
      await commonRepository.removeLearningListItem(courseId)
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
      // 不把读取失败伪装成全零统计，避免首页/统计页误导用户。
      console.error('获取学习统计失败:', error)
      throw error
    }
  }
  
  /**
   * 检查课程是否在学习列表中
   */
  async isInLearningList(courseId: string): Promise<boolean> {
    try {
      const item = await commonRepository.getLearningListItem(courseId)
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
      const item = await commonRepository.getLearningListItem(courseId)
      if (item) {
        await commonRepository.updateLearningListItem(courseId, {
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
