/**
 * 课程服务
 * 提供课程管理的业务逻辑
 */

import { courseRepository } from '../database/repositories/courseRepository';
import type { Course, Lesson, PracticeRecord, CourseProgress, PracticeMode } from '../types/course';
import { ContentShape } from '../types/course';

/**
 * 课程服务类
 */
export class CourseService {
  /**
   * 获取所有课程
   */
  async getAllCourses(): Promise<Course[]> {
    return await courseRepository.getAllCourses();
  }
  
  /**
   * 根据ID获取课程
   */
  async getCourseById(id: string): Promise<Course | null> {
    const course = await courseRepository.getCourseById(id);
    if (!course) return null;
    
    // 加载课程的课时
    const lessons = await courseRepository.getLessonsByCourseId(id);
    return {
      ...course,
      lessons
    };
  }
  
  /**
   * 搜索课程
   */
  async searchCourses(query: string, category?: string): Promise<Course[]> {
    let courses: Course[];
    
    if (query) {
      courses = await courseRepository.searchCourses(query);
    } else if (category) {
      courses = await courseRepository.getCoursesByCategory(category);
    } else {
      courses = await courseRepository.getAllCourses();
    }
    
    // 如果有分类筛选，进一步过滤
    if (category && query) {
      courses = courses.filter(c => c.category === category);
    }
    
    return courses;
  }
  
  /**
   * 创建课程
   */
  async createCourse(courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lessonCount'>): Promise<string> {
    const now = Date.now();
    const courseId = `course_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    const course: Course = {
      ...courseData,
      id: courseId,
      lessonCount: courseData.lessons.length,
      createdAt: now,
      updatedAt: now
    };
    
    await courseRepository.importCourse(course);
    return courseId;
  }
  
  /**
   * 更新课程
   */
  async updateCourse(id: string, updates: Partial<Course>): Promise<void> {
    // 如果更新了课时，需要重新计算课时数量
    if (updates.lessons) {
      updates.lessonCount = updates.lessons.length;
      
      // 更新课时
      const existingLessons = await courseRepository.getLessonsByCourseId(id);
      const existingLessonIds = new Set(existingLessons.map(l => l.id));
      
      for (const lesson of updates.lessons) {
        if (existingLessonIds.has(lesson.id)) {
          await courseRepository.updateLesson(lesson.id, lesson);
        } else {
          await courseRepository.createLesson(id, lesson);
        }
      }
      
      // 删除不再存在的课时
      const newLessonIds = new Set(updates.lessons.map(l => l.id));
      for (const lesson of existingLessons) {
        if (!newLessonIds.has(lesson.id)) {
          await courseRepository.deleteLesson(lesson.id);
        }
      }
      
      // 从 updates 中移除 lessons，避免保存到 courses 表
      const { lessons, ...courseUpdates } = updates;
      await courseRepository.updateCourse(id, courseUpdates);
    } else {
      await courseRepository.updateCourse(id, updates);
    }
  }
  
  /**
   * 删除课程
   */
  async deleteCourse(id: string): Promise<void> {
    await courseRepository.deleteCourse(id);
  }
  
  /**
   * 获取课程的所有课时
   */
  async getLessonsByCourse(courseId: string): Promise<Lesson[]> {
    return await courseRepository.getLessonsByCourseId(courseId);
  }
  
  /**
   * 获取单个课时
   */
  async getLessonById(lessonId: string): Promise<Lesson | null> {
    const lesson = await courseRepository.getLessonById(lessonId);
    return lesson || null;
  }
  
  /**
   * 创建课时
   */
  async createLesson(courseId: string, lessonData: Omit<Lesson, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    const now = Date.now();
    const lessonId = `lesson_${now}_${Math.random().toString(36).substr(2, 9)}`;
    
    const lesson: Lesson = {
      ...lessonData,
      id: lessonId,
      createdAt: now,
      updatedAt: now
    };
    
    await courseRepository.createLesson(courseId, lesson);
    
    // 更新课程的课时数量
    const course = await courseRepository.getCourseById(courseId);
    if (course) {
      const lessons = await courseRepository.getLessonsByCourseId(courseId);
      await courseRepository.updateCourse(courseId, { lessonCount: lessons.length });
    }
    
    return lessonId;
  }
  
  /**
   * 更新课时
   */
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
    await courseRepository.updateLesson(lessonId, updates);
  }
  
  /**
   * 删除课时
   */
  async deleteLesson(courseId: string, lessonId: string): Promise<void> {
    await courseRepository.deleteLesson(lessonId);
    
    // 更新课程的课时数量
    const lessons = await courseRepository.getLessonsByCourseId(courseId);
    await courseRepository.updateCourse(courseId, { lessonCount: lessons.length });
  }
  
  /**
   * 获取课程进度
   */
  async getCourseProgress(courseId: string): Promise<CourseProgress | null> {
    const progress = await courseRepository.getCourseProgress(courseId);
    return progress || null;
  }
  
  /**
   * 开始学习课时
   */
  async startLesson(courseId: string, lessonId: string): Promise<void> {
    const progress = await courseRepository.getCourseProgress(courseId);
    
    if (progress) {
      await courseRepository.updateCourseProgress({
        ...progress,
        currentLessonId: lessonId,
        lastStudiedAt: Date.now()
      });
    } else {
      await courseRepository.updateCourseProgress({
        courseId,
        completedLessonIds: [],
        currentLessonId: lessonId,
        completionPercentage: 0,
        lastStudiedAt: Date.now()
      });
    }
  }
  
  /**
   * 完成课时
   */
  async completeLesson(courseId: string, lessonId: string): Promise<void> {
    const progress = await courseRepository.getCourseProgress(courseId);
    const course = await courseRepository.getCourseById(courseId);
    
    if (!course) return;
    
    const completedIds = progress?.completedLessonIds || [];
    if (!completedIds.includes(lessonId)) {
      completedIds.push(lessonId);
    }
    
    const completionPercentage = (completedIds.length / course.lessonCount) * 100;
    
    await courseRepository.updateCourseProgress({
      courseId,
      completedLessonIds: completedIds,
      currentLessonId: progress?.currentLessonId,
      completionPercentage,
      lastStudiedAt: Date.now()
    });
  }
  
  /**
   * 记录练习结果
   */
  async recordPractice(record: Omit<PracticeRecord, 'id' | 'completedAt'>): Promise<void> {
    await courseRepository.addPracticeRecord({
      ...record,
      completedAt: Date.now()
    });
  }
  
  /**
   * 获取课程的练习历史
   */
  async getPracticeHistory(courseId: string, limit?: number): Promise<PracticeRecord[]> {
    return await courseRepository.getPracticeRecordsByCourse(courseId, limit);
  }
  
  /**
   * 导入课程
   */
  async importCourse(courseJson: string): Promise<string> {
    try {
      const courseData = JSON.parse(courseJson);
      
      // 验证课程数据
      if (!courseData.course || !courseData.course.lessons) {
        throw new Error('无效的课程数据格式');
      }
      
      const course = courseData.course as Course;
      
      // 生成新的ID（避免冲突）
      const now = Date.now();
      course.id = `course_${now}_${Math.random().toString(36).substr(2, 9)}`;
      course.createdAt = now;
      course.updatedAt = now;
      
      // 重新生成所有课时的ID
      for (const lesson of course.lessons) {
        lesson.id = `lesson_${now}_${Math.random().toString(36).substr(2, 9)}`;
        lesson.createdAt = now;
        lesson.updatedAt = now;
      }
      
      await courseRepository.importCourse(course);
      return course.id;
    } catch (error) {
      console.error('导入课程失败:', error);
      throw new Error('导入课程失败，请检查文件格式');
    }
  }
  
  /**
   * 导出课程
   */
  async exportCourse(courseId: string): Promise<string> {
    const course = await courseRepository.exportCourse(courseId);
    
    if (!course) {
      throw new Error('课程不存在');
    }
    
    const exportData = {
      version: '1.0',
      course,
      exportedAt: Date.now()
    };
    
    return JSON.stringify(exportData, null, 2);
  }
  
  /**
   * 验证内容形态
   */
  validateContentShape(lesson: Lesson): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    for (const item of lesson.items) {
      switch (lesson.contentShape) {
        case ContentShape.Word:
          if (item.english.split(' ').length > 1) {
            errors.push(`单词内容不应包含空格: ${item.english}`);
          }
          break;
        case ContentShape.Phrase:
          if (item.english.split(' ').length > 5) {
            errors.push(`短语不应超过5个单词: ${item.english}`);
          }
          break;
        case ContentShape.Sentence:
          if (!item.english.match(/[.!?]$/)) {
            errors.push(`句子应以标点结尾: ${item.english}`);
          }
          break;
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}

// 导出单例实例
export const courseService = new CourseService();
