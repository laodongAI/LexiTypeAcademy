/**
 * 应用数据库定义
 * DDD设计：Infrastructure层 - 数据持久化
 * 
 * 职责：
 * - 使用 Dexie.js 封装 IndexedDB 操作
 * - 提供类型安全的数据访问接口
 * - 管理数据库 schema 和版本迁移
 * 
 * 技术选型：
 * - Dexie.js: IndexedDB 的现代化封装库
 * - IndexedDB: 浏览器端的NoSQL数据库
 * 
 * 数据表说明：
 * - wordMasteryItems: 单词掌握度记录（复习系统）
 * - reviewLogs: 复习日志（用于分析）
 * - ttsCacheItems: TTS音频缓存
 * - courses: 课程数据
 * - typingRecords: 打字练习记录
 */

import Dexie, { Table } from 'dexie';
import type { WordMastery, ReviewLog } from '@/domain/models/ReviewModels';
import type { StudentRecording } from '@/infrastructure/audio/asr/types';
import type { AudioFile } from '@/infrastructure/audio/storage/types';

/**
 * 打字练习记录接口
 * 记录用户的打字练习历史
 */
export interface TypingRecord {
  /** 记录ID（自增主键） */
  id?: number;
  
  /** 打字速度（每分钟字数） */
  wpm: number;
  
  /** 准确率（百分比） */
  accuracy: number;
  
  /** 练习日期时间戳 */
  date: number;
  
  /** 练习类型：'typingPractice' | 'fingerPractice' | 'review' */
  practiceType: string;
  
  /** 难度等级 */
  difficulty: string;
  
  /** 练习的单词（可选，用于复习模式） */
  word?: string;
  
  /** 学习来源（可选） */
  source?: string;
}

/**
 * TTS缓存项接口
 * 缓存文本转语音的结果，避免重复生成
 */
export interface TtsCacheItem {
  /** 缓存ID（自增主键） */
  id?: number;
  
  /** 文本内容（索引键） */
  text: string;
  
  /** TTS模型名称 */
  model: string;
  
  /** 音频二进制数据 */
  audioBlob: Blob;
  
  /** 创建时间戳 */
  createdAt: number;
}

/**
 * 课程数据接口
 * 存储课程元数据
 */
export interface Course {
  /** 课程ID（主键） */
  id: string;
  
  /** 课程标题 */
  title: string;
  
  /** 课程描述 */
  description?: string;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 更新时间戳 */
  updatedAt: number;
  
  /** 其他课程数据 */
  [key: string]: any;
}

/**
 * LexiType Academy 数据库类
 * 继承自 Dexie，定义数据库 schema 和表
 */
export class LexiTypeDB extends Dexie {
  /** 单词掌握度表 */
  wordMasteryItems!: Table<WordMastery, [string, string]>;
  
  /** 复习日志表 */
  reviewLogs!: Table<ReviewLog, number>;
  
  /** TTS缓存表 */
  ttsCacheItems!: Table<TtsCacheItem, number>;
  
  /** 课程表 */
  courses!: Table<Course, string>;
  
  /** 打字记录表 */
  typingRecords!: Table<TypingRecord, number>;
  
  /** 学生录音表 */
  studentRecordings!: Table<StudentRecording, string>;
  
  /** 音频文件表 */
  audioFiles!: Table<AudioFile, string>;
  
  constructor() {
    super('LexiTypeAcademyDB');
    
    // 定义数据库版本和 schema
    this.version(1).stores({
      // 单词掌握度表
      // 索引：[word+source]（复合主键）、nextReview（用于查询到期单词）
      wordMasteryItems: '[word+source], nextReview',
      
      // 复习日志表
      // 索引：id（自增）、word、reviewDate（用于时间范围查询）
      reviewLogs: '++id, word, reviewDate, source',
      
      // TTS缓存表
      // 索引：id（自增）、text（用于查找缓存）
      ttsCacheItems: '++id, text',
      
      // 课程表
      // 索引：id（主键）
      courses: 'id',
      
      // 打字记录表
      // 索引：id（自增）、date（用于时间范围查询）、practiceType
      typingRecords: '++id, date, practiceType'
    });
    
    // 版本2: 添加音频相关表
    this.version(2).stores({
      // 保留所有v1的表
      wordMasteryItems: '[word+source], nextReview',
      reviewLogs: '++id, word, reviewDate, source',
      ttsCacheItems: '++id, text',
      courses: 'id',
      typingRecords: '++id, date, practiceType',
      
      // 学生录音表
      // 索引：id（主键）、sessionId（用于会话清理）、courseId、[courseId+sentenceId]、recordedAt
      studentRecordings: 'id, sessionId, courseId, [courseId+sentenceId], recordedAt',
      
      // 音频文件表
      // 索引：path（主键）、createdAt（用于过期清理）
      audioFiles: 'path, createdAt'
    });
  }
}

/**
 * 数据库单例实例
 * 全局共享，避免重复创建连接
 */
export const db = new LexiTypeDB();

/**
 * 数据库初始化函数
 * 在应用启动时调用，确保数据库就绪
 */
export async function initDatabase(): Promise<void> {
  try {
    await db.open();
    console.log('✅ 数据库初始化成功');
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    throw error;
  }
}
