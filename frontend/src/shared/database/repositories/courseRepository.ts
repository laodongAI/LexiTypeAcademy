/**
 * 课程数据仓库
 * 封装课程相关的数据库操作
 */

import { db } from '../index';
import type { Course, Lesson, PracticeRecord, CourseProgress } from '../../types/course';

/**
 * 课程仓库类
 */
export class CourseRepository {
  /**
   * 获取所有课程
   */
  async getAllCourses(): Promise<Course[]> {
    return await db.courses.toArray();
  }
  
  /**
   * 根据ID获取课程
   */
  async getCourseById(id: string): Promise<Course | undefined> {
    return await db.courses.get(id);
  }
  
  /**
   * 根据分类获取课程
   */
  async getCoursesByCategory(category: string): Promise<Course[]> {
    return await db.courses.where('category').equals(category).toArray();
  }
  
  /**
   * 搜索课程
   */
  async searchCourses(query: string): Promise<Course[]> {
    const lowerQuery = query.toLowerCase();
    const allCourses = await db.courses.toArray();
    return allCourses.filter(course => 
      course.title.toLowerCase().includes(lowerQuery) ||
      course.description?.toLowerCase().includes(lowerQuery) ||
      course.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
    );
  }
  
  /**
   * 创建课程
   */
  async createCourse(course: Course): Promise<string> {
    await db.courses.add(course);
    return course.id;
  }
  
  /**
   * 更新课程
   */
  async updateCourse(id: string, updates: Partial<Course>): Promise<void> {
    await db.courses.update(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }
  
  /**
   * 删除课程
   */
  async deleteCourse(id: string): Promise<void> {
    await db.transaction('rw', db.courses, db.lessons, db.courseProgress, db.practiceRecords, async () => {
      // 删除课程
      await db.courses.delete(id);
      // 删除关联的课时
      await db.lessons.where('courseId').equals(id).delete();
      // 删除课程进度
      await db.courseProgress.delete(id);
      // 删除练习记录
      await db.practiceRecords.where('courseId').equals(id).delete();
    });
  }
  
  /**
   * 获取课程的所有课时
   */
  async getLessonsByCourseId(courseId: string): Promise<Lesson[]> {
    const lessons = await db.lessons.where('courseId').equals(courseId).toArray();
    return lessons.map(lesson => {
      const { courseId: _, ...lessonData } = lesson;
      return lessonData as Lesson;
    });
  }
  
  /**
   * 获取单个课时
   */
  async getLessonById(lessonId: string): Promise<Lesson | undefined> {
    const lesson = await db.lessons.get(lessonId);
    if (!lesson) return undefined;
    const { courseId: _, ...lessonData } = lesson;
    return lessonData as Lesson;
  }
  
  /**
   * 创建课时
   */
  async createLesson(courseId: string, lesson: Lesson): Promise<string> {
    await db.lessons.add({
      ...lesson,
      courseId
    });
    return lesson.id;
  }
  
  /**
   * 更新课时
   */
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
    await db.lessons.update(lessonId, {
      ...updates,
      updatedAt: Date.now()
    });
  }
  
  /**
   * 删除课时
   */
  async deleteLesson(lessonId: string): Promise<void> {
    await db.transaction('rw', db.lessons, db.practiceRecords, async () => {
      await db.lessons.delete(lessonId);
      await db.practiceRecords.where('lessonId').equals(lessonId).delete();
    });
  }
  
  /**
   * 获取课程进度
   */
  async getCourseProgress(courseId: string): Promise<CourseProgress | undefined> {
    return await db.courseProgress.get(courseId);
  }
  
  /**
   * 更新课程进度
   */
  async updateCourseProgress(progress: CourseProgress): Promise<void> {
    await db.courseProgress.put(progress);
  }
  
  /**
   * 添加练习记录
   */
  async addPracticeRecord(record: PracticeRecord): Promise<number> {
    return await db.practiceRecords.add(record);
  }
  
  /**
   * 获取课程的练习记录
   */
  async getPracticeRecordsByCourse(courseId: string, limit?: number): Promise<PracticeRecord[]> {
    let query = db.practiceRecords.where('courseId').equals(courseId);
    if (limit) {
      query = query.limit(limit);
    }
    return await query.reverse().sortBy('completedAt');
  }
  
  /**
   * 获取课时的练习记录
   */
  async getPracticeRecordsByLesson(lessonId: string): Promise<PracticeRecord[]> {
    return await db.practiceRecords
      .where('lessonId')
      .equals(lessonId)
      .reverse()
      .sortBy('completedAt');
  }
  
  /**
   * 导入课程（包括课时）
   */
  async importCourse(course: Course): Promise<void> {
    await db.transaction('rw', db.courses, db.lessons, async () => {
      // 保存课程基本信息
      const { lessons, ...courseData } = course;
      await db.courses.put({
        ...courseData,
        lessons: [],
      });
      
      // 保存所有课时
      for (const lesson of lessons) {
        await db.lessons.put({
          ...lesson,
          courseId: course.id
        });
      }
    });
  }
  
  /**
   * 导出课程（包括课时）
   */
  async exportCourse(courseId: string): Promise<Course | null> {
    const course = await db.courses.get(courseId);
    if (!course) return null;
    
    const lessons = await this.getLessonsByCourseId(courseId);
    return {
      ...course,
      lessons
    };
  }
}

// 导出单例实例
export const courseRepository = new CourseRepository();
