/**
 * Vue-App 数据库定义
 * 使用 Dexie.js 封装 IndexedDB
 * 
 * 功能：
 * - 课程数据持久化
 * - 复习系统数据管理
 * - 练习记录存储
 * - TTS 缓存
 */

import Dexie, { Table } from 'dexie';
import type { Course, Lesson, PracticeRecord, CourseProgress } from '../types/course';
import type { WordMastery, ReviewLog } from '../types/review';
import type { TtsCacheItem, TypingRecord, LearningRecord, Achievement, AITaskLog } from '../types/common';
import type { PracticeAttemptEvent } from '../types/practiceAttemptEvent';
import type { UnitMastery, UnitReviewLog } from '../types/unitReview';

/**
 * LexiType Academy 数据库类
 */
export class LexiTypeDB extends Dexie {
  // 课程相关表
  courses!: Table<Course, string>;
  lessons!: Table<Lesson & { courseId: string }, string>;
  courseProgress!: Table<CourseProgress, string>;
  practiceRecords!: Table<PracticeRecord, number>;
  
  // 学习列表表
  learningList!: Table<{
    courseId: string;
    addedAt: number;
    totalStudyTime?: number;
  }, string>;
  
  // 复习系统表
  wordMasteryItems!: Table<WordMastery, [string, string]>;
  reviewLogs!: Table<ReviewLog, number>;
  
  // 通用表
  ttsCacheItems!: Table<TtsCacheItem, number>;
  typingRecords!: Table<TypingRecord, number>;
  learningRecords!: Table<LearningRecord, number>;
  achievements!: Table<Achievement, number>;
  aiTaskLogs!: Table<AITaskLog, number>;
  practiceAttemptEvents!: Table<PracticeAttemptEvent, number>;

  // Unit 维度复习表（按 unitId+mode）
  unitMasteryItems!: Table<UnitMastery, [string, string, string]>;
  unitReviewLogs!: Table<UnitReviewLog, number>;
  
  constructor() {
    super('LexiTypeAcademyDB');
    
    // 版本 1: 基础表结构
    this.version(1).stores({
      // 课程表: 主键 id
      courses: 'id, title, category, difficulty, createdAt, updatedAt',
      
      // 课时表: 主键 id，索引 courseId
      lessons: 'id, courseId, title, contentShape, createdAt',
      
      // 课程进度表: 主键 courseId
      courseProgress: 'courseId, lastStudiedAt',
      
      // 练习记录表: 自增主键 id，索引 courseId, lessonId, completedAt
      practiceRecords: '++id, courseId, lessonId, mode, completedAt',
      
      // 学习列表表: 主键 courseId，索引 addedAt
      learningList: 'courseId, addedAt',
      
      // 单词掌握度表: 复合主键 [word+source]，索引 nextReview
      wordMasteryItems: '[word+source], nextReview, level, source',
      
      // 复习日志表: 自增主键 id，索引 word, reviewDate, source
      reviewLogs: '++id, word, reviewDate, source, correct',
      
      // TTS 缓存表: 自增主键 id，索引 text
      ttsCacheItems: '++id, text, model, createdAt',
      
      // 打字记录表: 自增主键 id，索引 date, practiceType
      typingRecords: '++id, date, practiceType, difficulty',
      
      // 学习记录表: 自增主键 id，索引 courseId, lessonId, activityType, createdAt
      learningRecords: '++id, courseId, lessonId, activityType, createdAt',
      
      // 成就记录表: 自增主键 id，索引 type, unlockedAt
      achievements: '++id, type, unlockedAt, courseId',
      
      // AI 任务日志表: 自增主键 id，索引 type, status, createdAt
      aiTaskLogs: '++id, type, status, createdAt, completedAt'
    });

    // 版本 2: 新增事件化练习记录（PracticeAttemptEvent）
    this.version(2).stores({
      // 课程表: 主键 id
      courses: 'id, title, category, difficulty, createdAt, updatedAt',

      // 课时表: 主键 id，索引 courseId
      lessons: 'id, courseId, title, contentShape, createdAt',

      // 课程进度表: 主键 courseId
      courseProgress: 'courseId, lastStudiedAt',

      // 练习记录表: 自增主键 id，索引 courseId, lessonId, completedAt
      practiceRecords: '++id, courseId, lessonId, mode, completedAt',

      // 学习列表表: 主键 courseId，索引 addedAt
      learningList: 'courseId, addedAt',

      // 单词掌握度表: 复合主键 [word+source]，索引 nextReview
      wordMasteryItems: '[word+source], nextReview, level, source',

      // 复习日志表: 自增主键 id，索引 word, reviewDate, source
      reviewLogs: '++id, word, reviewDate, source, correct',

      // TTS 缓存表: 自增主键 id，索引 text
      ttsCacheItems: '++id, text, model, createdAt',

      // 打字记录表: 自增主键 id，索引 date, practiceType
      typingRecords: '++id, date, practiceType, difficulty',

      // 学习记录表: 自增主键 id，索引 courseId, lessonId, activityType, createdAt
      learningRecords: '++id, courseId, lessonId, activityType, createdAt',

      // 成就记录表: 自增主键 id，索引 type, unlockedAt
      achievements: '++id, type, unlockedAt, courseId',

      // AI 任务日志表: 自增主键 id，索引 type, status, createdAt
      aiTaskLogs: '++id, type, status, createdAt, completedAt',

      // 练习尝试事件表: 自增主键 id，索引 courseId, lessonId, unitId, mode, createdAt
      practiceAttemptEvents: '++id, courseId, lessonId, unitId, mode, createdAt',
    })

    // 版本 3: 新增 unitId + mode 维度的复习系统
    this.version(3).stores({
      // 课程表: 主键 id
      courses: 'id, title, category, difficulty, createdAt, updatedAt',

      // 课时表: 主键 id，索引 courseId
      lessons: 'id, courseId, title, contentShape, createdAt',

      // 课程进度表: 主键 courseId
      courseProgress: 'courseId, lastStudiedAt',

      // 练习记录表: 自增主键 id，索引 courseId, lessonId, completedAt
      practiceRecords: '++id, courseId, lessonId, mode, completedAt',

      // 学习列表表: 主键 courseId，索引 addedAt
      learningList: 'courseId, addedAt',

      // 单词掌握度表: 复合主键 [word+source]，索引 nextReview
      wordMasteryItems: '[word+source], nextReview, level, source',

      // 复习日志表: 自增主键 id，索引 word, reviewDate, source
      reviewLogs: '++id, word, reviewDate, source, correct',

      // TTS 缓存表: 自增主键 id，索引 text
      ttsCacheItems: '++id, text, model, createdAt',

      // 打字记录表: 自增主键 id，索引 date, practiceType
      typingRecords: '++id, date, practiceType, difficulty',

      // 学习记录表: 自增主键 id，索引 courseId, lessonId, activityType, createdAt
      learningRecords: '++id, courseId, lessonId, activityType, createdAt',

      // 成就记录表: 自增主键 id，索引 type, unlockedAt
      achievements: '++id, type, unlockedAt, courseId',

      // AI 任务日志表: 自增主键 id，索引 type, status, createdAt
      aiTaskLogs: '++id, type, status, createdAt, completedAt',

      // 练习尝试事件表: 自增主键 id，索引 courseId, lessonId, unitId, mode, createdAt
      practiceAttemptEvents: '++id, courseId, lessonId, unitId, mode, createdAt',

      // Unit 掌握度表: 复合主键 [courseId+unitId+mode]，索引 nextReview
      unitMasteryItems: '[courseId+unitId+mode], courseId, lessonId, unitId, mode, nextReview, level, lastReview',

      // Unit 复习日志表: 自增主键 id，索引 courseId, unitId, mode, reviewDate
      unitReviewLogs: '++id, courseId, unitId, mode, reviewDate, correct, quality, level',
    })
  }
}

/**
 * 数据库单例实例
 */
export const db = new LexiTypeDB();

// 数据库是否可用（open 或重建成功才为 true）
export let databaseReady = false

function isRecoverableDexieOpenError(error: unknown): boolean {
  const anyErr = error as any
  const name = String(anyErr?.name || '')
  const message = String(anyErr?.message || '')

  // Electron/Chromium 下 IndexedDB 可能因 profile/cachedir 权限或数据损坏抛出这类错误
  if (name.includes('UnknownError')) return true
  if (name.includes('InvalidStateError')) return true
  if (name.includes('QuotaExceededError')) return true
  if (message.toLowerCase().includes('internal error')) return true
  return false
}

/**
 * 初始化数据库
 */
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    databaseReady = true
    console.log('✅ 数据库初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    databaseReady = false

    // 自动恢复：删除损坏的 DB 后重试一次
    if (isRecoverableDexieOpenError(error)) {
      try {
        console.warn('⚠️ 检测到可恢复的数据库打开错误，尝试重建数据库...')
        db.close()
        await db.delete()
        await db.open()
        databaseReady = true
        console.log('✅ 数据库已重建并重新初始化成功')
        return
      } catch (recoveryError) {
        console.error('❌ 数据库重建失败，将以无数据库模式继续启动:', recoveryError)
        databaseReady = false
        // 不中断应用启动：让 UI 先起来，避免整站白屏
        return
      }
    }

    // 非可恢复错误：同样不中断启动，避免影响开发调试
    console.error('❌ 数据库初始化不可恢复，将以无数据库模式继续启动')
    databaseReady = false
    return
  }
}

/**
 * 关闭数据库
 */
export async function closeDatabase(): Promise<void> {
  try {
    db.close();
    console.log('✅ 数据库已关闭');
  } catch (error) {
    console.error('❌ 数据库关闭失败:', error);
  }
}

/**
 * 清空所有数据（谨慎使用）
 */
export async function clearAllData(): Promise<void> {
  try {
    await db.delete();
    console.log('✅ 所有数据已清空');
    // 重新打开数据库
    await initDatabase();
  } catch (error) {
    console.error('❌ 清空数据失败:', error);
    throw error;
  }
}

// 导出类型
export type { Course, Lesson, PracticeRecord, CourseProgress };
export type { WordMastery, ReviewLog };
export type { TtsCacheItem, TypingRecord, LearningRecord, Achievement, AITaskLog };
export type { PracticeAttemptEvent };
