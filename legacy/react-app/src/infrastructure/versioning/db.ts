/**
 * Dexie 数据库配置与初始化
 * 包含所有表的 schema 定义、版本管理、备份表
 *
 * 关键约束：
 * - 版本号只能递增，不能回退
 * - 每次 Dexie.version() 调用都会创建一个新的 schema 版本
 * - 旧版本的表定义不会自动删除，需要明确处理
 */

import Dexie, { Table } from 'dexie';
import {
  BackupData,
  VersionMetadata,
  MigrationRecord
} from './types';

/**
 * LexiType Academy 数据库定义
 * 使用 Dexie ORM 管理 IndexedDB
 */
export class LexiTypeDB extends Dexie {
  // 学习中心模块
  courses!: Table<any>;              // 课程表
  lessons!: Table<any>;              // 课时表
  learningRecords!: Table<any>;       // 学习记录表
  
  // 补救模块
  remediations!: Table<any>;          // 补救课程表
  remediationEffectiveness!: Table<any>;  // 补救效果评估表
  languageAbilities!: Table<any>;     // 学生语言能力档案表
  
  // 复习模块
  reviews!: Table<any>;               // 复习计划表
  reviewHistory!: Table<any>;         // 复习历史表
  
  // 社交与设置
  users!: Table<any>;                 // 用户表
  achievements!: Table<any>;          // 成就表
  
  // AI Lab
  aiLabTasks!: Table<any>;            // AI Lab 任务表
  
  // 版本管理与备份
  versionMetadata!: Table<VersionMetadata>;  // 版本元数据表
  migrationHistory!: Table<MigrationRecord>; // 迁移历史表
  backups!: Table<BackupData>;        // 备份表（存储备份数据）
  
  // 缓存表
  audioPreloadCache!: Table<any>;     // 音频预加载缓存
  promptSounds!: Table<any>;          // 提示音表
  
  constructor() {
    super('LexiTypeAcademyDB');
    this.version(1).stores({
      // 学习中心模块
      courses: 'id, createdAt',
      lessons: 'id, courseId, createdAt',
      learningRecords: 'id, userId, lessonId, createdAt',
      
      // 社交与设置
      users: 'id, email, createdAt',
      achievements: 'id, userId, unlockedAt',
      
      // 缓存
      audioPreloadCache: 'id, courseId, lastAccessedAt',
      promptSounds: 'id, createdAt'
    });
    
    this.version(2).stores({
      // 补救模块
      remediations: 'id, userId, createdAt',
      reviews: 'id, userId, dueDate',
      reviewHistory: 'id, userId, reviewDate'
    });
    
    this.version(3).stores({
      // AI Lab
      aiLabTasks: 'id, userId, createdAt'
    });
    
    this.version(4).stores({
      // 版本管理与备份
      versionMetadata: '++id',
      migrationHistory: 'id, timestamp',
      backups: 'id, createdAt',
      
      // 补救效果评估和语言能力
      remediationEffectiveness: 'id, userId, createdAt',
      languageAbilities: 'userId'
    });
    
    // Dexie 自动处理打开事件，无需额外监听
  }
}

/**
 * 全局数据库实例
 * 应在应用启动时通过 initializeDatabase() 初始化
 */
let dbInstance: LexiTypeDB | null = null;

/**
 * 获取数据库实例
 * 如果未初始化，返回 null
 */
export function getDB(): LexiTypeDB | null {
  return dbInstance;
}

/**
 * 初始化数据库
 * 在应用启动时调用，确保数据库已正确打开
 *
 * @throws {Error} 如果数据库打开失败
 */
export async function initializeDatabase(): Promise<LexiTypeDB> {
  try {
    if (!dbInstance) {
      dbInstance = new LexiTypeDB();
      // 尝试打开数据库（会触发版本迁移逻辑）
      await dbInstance.open();
      console.log('✅ [DB] 数据库初始化成功');
    }
    return dbInstance;
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('❌ [DB] 数据库初始化失败:', message);
    throw new Error(`数据库初始化失败: ${message}`);
  }
}

/**
 * 重置数据库（开发和测试用）
 * 清空所有数据
 */
export async function resetDatabase(): Promise<void> {
  if (!dbInstance) {
    throw new Error('数据库未初始化');
  }
  
  try {
    await dbInstance.delete();
    dbInstance = null;
    console.log('⚠️ [DB] 数据库已重置');
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error('❌ [DB] 数据库重置失败:', message);
    throw error;
  }
}

/**
 * 关闭数据库
 * 应在应用卸载时调用
 */
export async function closeDatabase(): Promise<void> {
  if (dbInstance) {
    try {
      await dbInstance.close();
      dbInstance = null;
      console.log('✅ [DB] 数据库已关闭');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error('❌ [DB] 数据库关闭失败:', message);
    }
  }
}
