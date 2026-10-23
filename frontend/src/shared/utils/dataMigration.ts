/**
 * 数据迁移工具
 * 用于从旧版 React 应用导入数据到 Vue 版本
 */

import { db } from '../database';
import { courseService } from '../services/courseService';
import { reviewService } from '../services/reviewService';
import type { Course } from '../types/course';
import type { WordMastery, ReviewLog } from '../types/review';

/**
 * 旧版数据库接口（用于类型定义）
 */
interface OldCourse {
  id: string;
  title: string;
  description?: string;
  type?: string;
  difficulty?: string;
  tags?: string[];
  createdAt: number;
  [key: string]: any;
}

interface OldWordMastery {
  word: string;
  source: string;
  level: number;
  nextReview: number;
  interval: number;
  reviewCount: number;
  consecutiveCorrect: number;
  lastReview: number;
  createdAt: number;
  easeFactor: number;
}

interface OldReviewLog {
  id?: number;
  word: string;
  reviewDate: number;
  result: string;
  source?: string;
  [key: string]: any;
}

/**
 * 数据迁移类
 */
export class DataMigration {
  /**
   * 从 IndexedDB 中读取旧版数据
   */
  async readOldDatabase(dbName: string = 'LexiTypeDB'): Promise<{
    courses: OldCourse[];
    wordMastery: OldWordMastery[];
    reviewLogs: OldReviewLog[];
  }> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(dbName);
      
      request.onerror = () => reject(new Error('无法打开旧版数据库'));
      
      request.onsuccess = (event) => {
        const oldDb = (event.target as IDBOpenDBRequest).result;
        const data: {
          courses: OldCourse[];
          wordMastery: OldWordMastery[];
          reviewLogs: OldReviewLog[];
        } = {
          courses: [],
          wordMastery: [],
          reviewLogs: []
        };
        
        const promises: Promise<void>[] = [];
        
        // 读取课程数据
        if (oldDb.objectStoreNames.contains('courses')) {
          promises.push(
            new Promise((resolve, reject) => {
              const transaction = oldDb.transaction(['courses'], 'readonly');
              const store = transaction.objectStore('courses');
              const request = store.getAll();
              
              request.onsuccess = () => {
                data.courses = request.result;
                resolve();
              };
              request.onerror = () => reject(new Error('读取课程数据失败'));
            })
          );
        }
        
        // 读取单词掌握度数据
        if (oldDb.objectStoreNames.contains('wordMasteryItems')) {
          promises.push(
            new Promise((resolve, reject) => {
              const transaction = oldDb.transaction(['wordMasteryItems'], 'readonly');
              const store = transaction.objectStore('wordMasteryItems');
              const request = store.getAll();
              
              request.onsuccess = () => {
                data.wordMastery = request.result;
                resolve();
              };
              request.onerror = () => reject(new Error('读取单词掌握度数据失败'));
            })
          );
        }
        
        // 读取复习日志数据
        if (oldDb.objectStoreNames.contains('reviewLogs')) {
          promises.push(
            new Promise((resolve, reject) => {
              const transaction = oldDb.transaction(['reviewLogs'], 'readonly');
              const store = transaction.objectStore('reviewLogs');
              const request = store.getAll();
              
              request.onsuccess = () => {
                data.reviewLogs = request.result;
                resolve();
              };
              request.onerror = () => reject(new Error('读取复习日志数据失败'));
            })
          );
        }
        
        Promise.all(promises)
          .then(() => {
            oldDb.close();
            resolve(data);
          })
          .catch(reject);
      };
    });
  }
  
  /**
   * 转换课程数据格式
   */
  convertCourse(oldCourse: OldCourse): Course | null {
    try {
      // 基本字段映射
      const course: Course = {
        id: oldCourse.id,
        title: oldCourse.title,
        description: oldCourse.description || '',
        category: this.mapCategory(oldCourse.type),
        difficulty: this.mapDifficulty(oldCourse.difficulty),
        lessons: [], // 需要单独处理
        lessonCount: 0,
        createdAt: oldCourse.createdAt || Date.now(),
        updatedAt: Date.now(),
        tags: oldCourse.tags
      };
      
      return course;
    } catch (error) {
      console.error('转换课程数据失败:', error);
      return null;
    }
  }
  
  /**
   * 映射课程类型到分类
   */
  private mapCategory(type?: string): 'basic' | 'advanced' | 'special' {
    if (!type) return 'basic';
    const typeMap: Record<string, 'basic' | 'advanced' | 'special'> = {
      'basic': 'basic',
      'intermediate': 'advanced',
      'advanced': 'advanced',
      'special': 'special'
    };
    return typeMap[type] || 'basic';
  }
  
  /**
   * 映射难度
   */
  private mapDifficulty(difficulty?: string): 'beginner' | 'intermediate' | 'advanced' {
    if (!difficulty) return 'beginner';
    const difficultyMap: Record<string, 'beginner' | 'intermediate' | 'advanced'> = {
      'easy': 'beginner',
      'beginner': 'beginner',
      'medium': 'intermediate',
      'intermediate': 'intermediate',
      'hard': 'advanced',
      'advanced': 'advanced'
    };
    return difficultyMap[difficulty] || 'beginner';
  }
  
  /**
   * 转换单词掌握度数据
   */
  convertWordMastery(oldMastery: OldWordMastery): WordMastery {
    return {
      word: oldMastery.word,
      source: oldMastery.source,
      level: oldMastery.level,
      nextReview: oldMastery.nextReview,
      interval: oldMastery.interval,
      reviewCount: oldMastery.reviewCount,
      consecutiveCorrect: oldMastery.consecutiveCorrect,
      lastReview: oldMastery.lastReview,
      createdAt: oldMastery.createdAt,
      easeFactor: oldMastery.easeFactor
    };
  }
  
  /**
   * 转换复习日志数据
   */
  convertReviewLog(oldLog: OldReviewLog): ReviewLog {
    return {
      word: oldLog.word,
      source: oldLog.source || 'unknown',
      reviewDate: oldLog.reviewDate,
      quality: this.mapResultToQuality(oldLog.result),
      correct: oldLog.result === 'correct',
      level: 0 // 旧数据可能没有这个字段
    };
  }
  
  /**
   * 将旧的结果字符串映射到质量分数
   */
  private mapResultToQuality(result: string): number {
    const qualityMap: Record<string, number> = {
      'perfect': 5,
      'correct': 4,
      'hard': 3,
      'wrong': 0
    };
    return qualityMap[result] || 4;
  }
  
  /**
   * 执行完整迁移
   */
  async migrate(oldDbName: string = 'LexiTypeDB'): Promise<{
    success: boolean;
    coursesImported: number;
    wordsMigrated: number;
    logsMigrated: number;
    errors: string[];
  }> {
    const result = {
      success: false,
      coursesImported: 0,
      wordsMigrated: 0,
      logsMigrated: 0,
      errors: [] as string[]
    };
    
    try {
      // 读取旧版数据
      console.log('正在读取旧版数据...');
      const oldData = await this.readOldDatabase(oldDbName);
      
      // 迁移课程
      console.log(`找到 ${oldData.courses.length} 个课程`);
      for (const oldCourse of oldData.courses) {
        try {
          const course = this.convertCourse(oldCourse);
          if (course) {
            // 检查课程是否已存在
            const existing = await db.courses.get(course.id);
            if (!existing) {
              await db.courses.add(course);
              result.coursesImported++;
            }
          }
        } catch (error) {
          result.errors.push(`迁移课程 ${oldCourse.id} 失败: ${error}`);
        }
      }
      
      // 迁移单词掌握度
      console.log(`找到 ${oldData.wordMastery.length} 条单词掌握度记录`);
      const masteryBatch: WordMastery[] = [];
      for (const oldMastery of oldData.wordMastery) {
        try {
          const mastery = this.convertWordMastery(oldMastery);
          masteryBatch.push(mastery);
        } catch (error) {
          result.errors.push(`转换单词掌握度 ${oldMastery.word} 失败: ${error}`);
        }
      }
      
      if (masteryBatch.length > 0) {
        await db.wordMasteryItems.bulkPut(masteryBatch);
        result.wordsMigrated = masteryBatch.length;
      }
      
      // 迁移复习日志
      console.log(`找到 ${oldData.reviewLogs.length} 条复习日志`);
      const logsBatch: ReviewLog[] = [];
      for (const oldLog of oldData.reviewLogs) {
        try {
          const log = this.convertReviewLog(oldLog);
          logsBatch.push(log);
        } catch (error) {
          result.errors.push(`转换复习日志失败: ${error}`);
        }
      }
      
      if (logsBatch.length > 0) {
        await db.reviewLogs.bulkAdd(logsBatch);
        result.logsMigrated = logsBatch.length;
      }
      
      result.success = true;
      console.log('数据迁移完成！');
      
    } catch (error) {
      result.errors.push(`迁移失败: ${error}`);
      console.error('数据迁移失败:', error);
    }
    
    return result;
  }
  
  /**
   * 从 JSON 文件导入数据
   */
  async importFromJSON(jsonData: string): Promise<void> {
    try {
      const data = JSON.parse(jsonData);
      
      if (data.courses) {
        for (const course of data.courses) {
          await courseService.importCourse(JSON.stringify({ course }));
        }
      }
      
      if (data.wordMastery) {
        const mastery: WordMastery[] = data.wordMastery.map((m: any) => 
          this.convertWordMastery(m)
        );
        await db.wordMasteryItems.bulkPut(mastery);
      }
      
      if (data.reviewLogs) {
        const logs: ReviewLog[] = data.reviewLogs.map((l: any) => 
          this.convertReviewLog(l)
        );
        await db.reviewLogs.bulkAdd(logs);
      }
      
      console.log('JSON 数据导入成功');
    } catch (error) {
      console.error('JSON 数据导入失败:', error);
      throw error;
    }
  }
  
  /**
   * 导出数据为 JSON
   */
  async exportToJSON(): Promise<string> {
    const courses = await db.courses.toArray();
    const wordMastery = await db.wordMasteryItems.toArray();
    const reviewLogs = await db.reviewLogs.toArray();
    
    const exportData = {
      version: '1.0',
      exportedAt: Date.now(),
      courses,
      wordMastery,
      reviewLogs
    };
    
    return JSON.stringify(exportData, null, 2);
  }
}

// 导出单例实例
export const dataMigration = new DataMigration();
