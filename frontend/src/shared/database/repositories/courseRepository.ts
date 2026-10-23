/**
 * 课程数据仓库（HTTP 版）
 *
 * 变更说明：
 * 批次B 起不再直接读写 IndexedDB，统一调用本地后端 REST 接口，
 * 方法签名与返回结构保持不变，上层 courseService 无需改动。
 */

import { apiDelete, apiGet, apiPost, apiPut, type ApiError } from '../../services/apiClient'
import type { Course, Lesson, PracticeRecord, CourseProgress } from '../../types/course'

/** 后端列表响应结构：items + total */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[]
  /** 命中总数 */
  total: number
}

/**
 * 判断是否为“资源不存在”错误
 * @param error 捕获到的异常
 * @returns 状态码为 404 时返回 true
 */
function isNotFound(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as ApiError).status === 404
}

/**
 * 补全课程对象的前端必需字段
 * @param raw 后端返回的课程数据
 * @returns 保证 lessons 为数组、lessonCount 为数字的课程对象
 */
function normalizeCourse(raw: Course): Course {
  return {
    ...raw,
    lessons: Array.isArray(raw.lessons) ? raw.lessons : [],
    lessonCount: typeof raw.lessonCount === 'number' ? raw.lessonCount : 0,
  }
}

/**
 * 去除课时里的 courseId 字段
 * 说明：前端 Lesson 类型不包含 courseId，保持与原实现一致的返回结构。
 * @param lesson 后端返回的课时（可能含 courseId）
 */
function normalizeLesson(lesson: Lesson & { courseId?: string }): Lesson {
  const { courseId: _courseId, ...rest } = lesson
  return rest as Lesson
}

/**
 * 课程仓库类
 */
export class CourseRepository {
  /**
   * 获取所有课程
   */
  async getAllCourses(): Promise<Course[]> {
    const result = await apiGet<ListResponse<Course>>('/api/courses', { limit: 1000 })
    return result.items.map(normalizeCourse)
  }

  /**
   * 按 ID 集合批量获取课程
   * @param ids 课程 ID 数组
   */
  async getCoursesByIds(ids: string[]): Promise<Course[]> {
    if (ids.length === 0) return []
    const result = await apiGet<ListResponse<Course>>('/api/courses', {
      ids: ids.join(','),
      limit: Math.max(ids.length, 1),
    })
    return result.items.map(normalizeCourse)
  }

  /**
   * 根据ID获取课程（含课时）
   */
  async getCourseById(id: string): Promise<Course | undefined> {
    try {
      const course = await apiGet<Course>(`/api/courses/${encodeURIComponent(id)}`)
      return normalizeCourse(course)
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
  }

  /**
   * 根据分类获取课程
   */
  async getCoursesByCategory(category: string): Promise<Course[]> {
    const result = await apiGet<ListResponse<Course>>('/api/courses', { category, limit: 1000 })
    return result.items.map(normalizeCourse)
  }

  /**
   * 搜索课程（标题/描述/标签）
   */
  async searchCourses(query: string): Promise<Course[]> {
    const result = await apiGet<ListResponse<Course>>('/api/courses', { q: query, limit: 1000 })
    return result.items.map(normalizeCourse)
  }

  /**
   * 创建课程
   */
  async createCourse(course: Course): Promise<string> {
    const created = await apiPost<Course>('/api/courses', course)
    return created.id
  }

  /**
   * 更新课程
   */
  async updateCourse(id: string, updates: Partial<Course>): Promise<void> {
    await apiPut<Course>(`/api/courses/${encodeURIComponent(id)}`, {
      ...updates,
      updatedAt: Date.now(),
    })
  }

  /**
   * 删除课程（后端级联删除课时、进度、练习记录）
   */
  async deleteCourse(id: string): Promise<void> {
    await apiDelete(`/api/courses/${encodeURIComponent(id)}`)
  }

  /**
   * 获取课程的所有课时
   */
  async getLessonsByCourseId(courseId: string): Promise<Lesson[]> {
    const result = await apiGet<ListResponse<Lesson & { courseId?: string }>>(
      `/api/courses/${encodeURIComponent(courseId)}/lessons`
    )
    return result.items.map(normalizeLesson)
  }

  /**
   * 获取单个课时
   */
  async getLessonById(lessonId: string): Promise<Lesson | undefined> {
    try {
      const lesson = await apiGet<Lesson & { courseId?: string }>(
        `/api/lessons/${encodeURIComponent(lessonId)}`
      )
      return normalizeLesson(lesson)
    } catch (error) {
      if (isNotFound(error)) return undefined
      throw error
    }
  }

  /**
   * 创建课时
   */
  async createLesson(courseId: string, lesson: Lesson): Promise<string> {
    const created = await apiPost<Lesson>(
      `/api/courses/${encodeURIComponent(courseId)}/lessons`,
      lesson
    )
    return created.id
  }

  /**
   * 更新课时
   */
  async updateLesson(lessonId: string, updates: Partial<Lesson>): Promise<void> {
    await apiPut<Lesson>(`/api/lessons/${encodeURIComponent(lessonId)}`, {
      ...updates,
      updatedAt: Date.now(),
    })
  }

  /**
   * 删除课时（后端同时清理该课时的练习记录）
   */
  async deleteLesson(lessonId: string): Promise<void> {
    await apiDelete(`/api/lessons/${encodeURIComponent(lessonId)}`)
  }

  /**
   * 获取课程进度
   */
  async getCourseProgress(courseId: string): Promise<CourseProgress | undefined> {
    const progress = await apiGet<CourseProgress | null>(
      `/api/course-progress/${encodeURIComponent(courseId)}`
    )
    return progress ?? undefined
  }

  /**
   * 更新课程进度（不存在时由后端创建）
   */
  async updateCourseProgress(progress: CourseProgress): Promise<void> {
    await apiPut<CourseProgress>(
      `/api/course-progress/${encodeURIComponent(progress.courseId)}`,
      progress
    )
  }

  /**
   * 添加练习记录
   */
  async addPracticeRecord(record: PracticeRecord): Promise<number> {
    const created = await apiPost<PracticeRecord>('/api/practice-records', record)
    return created.id ?? 0
  }

  /**
   * 获取课程的练习记录
   */
  async getPracticeRecordsByCourse(courseId: string, limit?: number): Promise<PracticeRecord[]> {
    const result = await apiGet<ListResponse<PracticeRecord>>('/api/practice-records', {
      courseId,
      limit: limit ?? 500,
    })
    return result.items
  }

  /**
   * 获取课时的练习记录
   */
  async getPracticeRecordsByLesson(lessonId: string): Promise<PracticeRecord[]> {
    const result = await apiGet<ListResponse<PracticeRecord>>('/api/practice-records', {
      lessonId,
      limit: 500,
    })
    return result.items
  }

  /**
   * 按完成时间范围获取练习记录
   * @param start 下界（毫秒，含）
   * @param end 上界（毫秒，含）
   */
  async getPracticeRecordsByRange(start: number, end: number): Promise<PracticeRecord[]> {
    const result = await apiGet<ListResponse<PracticeRecord>>('/api/practice-records', {
      start,
      end,
      limit: 5000,
    })
    return result.items
  }

  /**
   * 获取最近的练习记录（按完成时间倒序）
   * @param limit 返回条数
   */
  async getRecentPracticeRecords(limit = 30): Promise<PracticeRecord[]> {
    const result = await apiGet<ListResponse<PracticeRecord>>('/api/practice-records', { limit })
    return result.items
  }

  /**
   * 获取全部练习记录（统计页使用，受后端上限约束）
   */
  async getAllPracticeRecords(): Promise<PracticeRecord[]> {
    const result = await apiGet<ListResponse<PracticeRecord>>('/api/practice-records', {
      limit: 5000,
    })
    return result.items
  }

  /**
   * 导入课程（包括课时）
   */
  async importCourse(course: Course): Promise<void> {
    await apiPost<Course>('/api/courses', course)
  }

  /**
   * 导出课程（包括课时）
   */
  async exportCourse(courseId: string): Promise<Course | null> {
    const course = await this.getCourseById(courseId)
    return course ?? null
  }
}

// 导出单例实例
export const courseRepository = new CourseRepository()
