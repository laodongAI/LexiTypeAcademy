/**
 * 课程状态管理
 * 使用 Pinia 管理课程相关的全局状态
 */

import { defineStore } from 'pinia';
import { computed, isProxy, ref, toRaw } from 'vue';
import { courseService } from '../../shared/services/courseService';
import type { Course, CourseProgress, PracticeRecord } from '../../shared/types/course';

function toCloneable<T>(value: T): T {
  const raw = isProxy(value) ? (toRaw(value) as T) : value;

  if (typeof structuredClone === 'function') {
    return structuredClone(raw);
  }

  return JSON.parse(JSON.stringify(raw)) as T;
}

export const useCourseStore = defineStore('course', () => {
  // 状态
  const courses = ref<Course[]>([]);
  const currentCourse = ref<Course | null>(null);
  const currentProgress = ref<CourseProgress | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  
  // 计算属性
  const courseCount = computed(() => courses.value.length);
  
  const coursesByCategory = computed(() => {
    const grouped: Record<string, Course[]> = {};
    for (const course of courses.value) {
      if (!grouped[course.category]) {
        grouped[course.category] = [];
      }
      grouped[course.category].push(course);
    }
    return grouped;
  });
  
  // 操作方法
  
  /**
   * 加载所有课程
   */
  async function loadCourses() {
    loading.value = true;
    error.value = null;
    try {
      courses.value = await courseService.getAllCourses();
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载课程失败';
      console.error('加载课程失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 根据ID加载课程
   */
  async function loadCourseById(id: string) {
    loading.value = true;
    error.value = null;
    try {
      currentCourse.value = await courseService.getCourseById(id);
      if (currentCourse.value) {
        currentProgress.value = await courseService.getCourseProgress(id);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '加载课程失败';
      console.error('加载课程失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 搜索课程
   */
  async function searchCourses(query: string, category?: string) {
    loading.value = true;
    error.value = null;
    try {
      courses.value = await courseService.searchCourses(query, category);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '搜索课程失败';
      console.error('搜索课程失败:', e);
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 创建课程
   */
  async function createCourse(courseData: Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lessonCount'>) {
    loading.value = true;
    error.value = null;
    try {
      const id = await courseService.createCourse(toCloneable(courseData));
      await loadCourses(); // 重新加载课程列表
      return id;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '创建课程失败';
      console.error('创建课程失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 更新课程
   */
  async function updateCourse(id: string, updates: Partial<Course>) {
    loading.value = true;
    error.value = null;
    try {
      await courseService.updateCourse(id, toCloneable(updates));
      await loadCourses(); // 重新加载课程列表
      if (currentCourse.value?.id === id) {
        await loadCourseById(id); // 重新加载当前课程
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '更新课程失败';
      console.error('更新课程失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 删除课程
   */
  async function deleteCourse(id: string) {
    loading.value = true;
    error.value = null;
    try {
      await courseService.deleteCourse(id);
      await loadCourses(); // 重新加载课程列表
      if (currentCourse.value?.id === id) {
        currentCourse.value = null;
        currentProgress.value = null;
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '删除课程失败';
      console.error('删除课程失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 开始学习课时
   */
  async function startLesson(courseId: string, lessonId: string) {
    try {
      await courseService.startLesson(courseId, lessonId);
      if (currentCourse.value?.id === courseId) {
        currentProgress.value = await courseService.getCourseProgress(courseId);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '开始学习失败';
      console.error('开始学习失败:', e);
      throw e;
    }
  }
  
  /**
   * 完成课时
   */
  async function completeLesson(courseId: string, lessonId: string) {
    try {
      await courseService.completeLesson(courseId, lessonId);
      if (currentCourse.value?.id === courseId) {
        currentProgress.value = await courseService.getCourseProgress(courseId);
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : '完成课时失败';
      console.error('完成课时失败:', e);
      throw e;
    }
  }
  
  /**
   * 记录练习结果
   */
  async function recordPractice(record: Omit<PracticeRecord, 'id' | 'completedAt'>) {
    try {
      await courseService.recordPractice(record);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '记录练习失败';
      console.error('记录练习失败:', e);
      throw e;
    }
  }
  
  /**
   * 导入课程
   */
  async function importCourse(courseJson: string) {
    loading.value = true;
    error.value = null;
    try {
      const id = await courseService.importCourse(courseJson);
      await loadCourses(); // 重新加载课程列表
      return id;
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导入课程失败';
      console.error('导入课程失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 导出课程
   */
  async function exportCourse(courseId: string) {
    loading.value = true;
    error.value = null;
    try {
      return await courseService.exportCourse(courseId);
    } catch (e) {
      error.value = e instanceof Error ? e.message : '导出课程失败';
      console.error('导出课程失败:', e);
      throw e;
    } finally {
      loading.value = false;
    }
  }
  
  /**
   * 清除错误
   */
  function clearError() {
    error.value = null;
  }
  
  /**
   * 清除当前课程
   */
  function clearCurrentCourse() {
    currentCourse.value = null;
    currentProgress.value = null;
  }
  
  return {
    // 状态
    courses,
    currentCourse,
    currentProgress,
    loading,
    error,
    
    // 计算属性
    courseCount,
    coursesByCategory,
    
    // 方法
    loadCourses,
    loadCourseById,
    searchCourses,
    createCourse,
    updateCourse,
    deleteCourse,
    startLesson,
    completeLesson,
    recordPractice,
    importCourse,
    exportCourse,
    clearError,
    clearCurrentCourse
  };
});
