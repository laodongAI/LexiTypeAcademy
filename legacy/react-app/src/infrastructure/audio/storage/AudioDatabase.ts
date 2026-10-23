/**
 * IndexedDB数据库定义
 * 统一管理所有音频相关的存储表
 */

/** 数据库名称 */
export const DB_NAME = 'lexitype-audio-db';

/** 数据库版本 */
export const DB_VERSION = 1;

/**
 * TTS缓存表
 */
export interface TTSCacheRecord {
  /** 主键：md5(text+voice+rate) */
  id: string;
  /** 原始文本 */
  text: string;
  /** 语音名称 */
  voice: string;
  /** 语速 */
  rate: number;
  /** 音频Blob */
  audioBlob: Blob;
  /** 音频时长(秒) */
  duration: number;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 (TTL: 7天) */
  expiresAt: number;
}

/**
 * 课程提示音表
 */
export interface PromptSoundRecord {
  /** 主键：课程ID */
  courseId: string;
  /** 音频Blob Map (key: promptId, value: Blob) */
  audioBlobs: Record<string, Blob>;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 (TTL: 永久，但可手动清理) */
  expiresAt?: number;
}

/**
 * 学生录音表（会话级，启动时清理）
 */
export interface StudentRecordingRecord {
  /** 主键：录音ID */
  id: string;
  /** 课程ID */
  courseId: string;
  /** 句子ID */
  sentenceId: string;
  /** 录音Blob */
  audioBlob: Blob;
  /** 录音时长(秒) */
  duration: number;
  /** 创建时间 */
  createdAt: number;
  /** 会话ID（用于启动时清理） */
  sessionId: string;
}

/**
 * 原始音频切片表
 */
export interface AudioSliceRecord {
  /** 主键：切片ID (courseId_lessonId_sentenceId) */
  id: string;
  /** 课程ID */
  courseId: string;
  /** 课时ID */
  lessonId: string;
  /** 句子ID */
  sentenceId: string;
  /** 音频Blob */
  audioBlob: Blob;
  /** 音频时长(秒) */
  duration: number;
  /** 创建时间 */
  createdAt: number;
  /** 过期时间 (TTL: 永久) */
  expiresAt?: number;
}

/**
 * 表名常量
 */
export const TABLES = {
  TTS_CACHE: 'tts-cache',
  PROMPT_SOUNDS: 'prompt-sounds',
  STUDENT_RECORDINGS: 'student-recordings',
  AUDIO_SLICES: 'audio-slices',
} as const;

/**
 * 初始化IndexedDB数据库
 */
export async function initAudioDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`打开数据库失败: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 创建TTS缓存表
      if (!db.objectStoreNames.contains(TABLES.TTS_CACHE)) {
        const ttsCacheStore = db.createObjectStore(TABLES.TTS_CACHE, {
          keyPath: 'id',
        });
        ttsCacheStore.createIndex('expiresAt', 'expiresAt', { unique: false });
      }

      // 创建提示音表
      if (!db.objectStoreNames.contains(TABLES.PROMPT_SOUNDS)) {
        db.createObjectStore(TABLES.PROMPT_SOUNDS, {
          keyPath: 'courseId',
        });
      }

      // 创建学生录音表
      if (!db.objectStoreNames.contains(TABLES.STUDENT_RECORDINGS)) {
        const recordingStore = db.createObjectStore(TABLES.STUDENT_RECORDINGS, {
          keyPath: 'id',
        });
        recordingStore.createIndex('sessionId', 'sessionId', { unique: false });
        recordingStore.createIndex('courseId', 'courseId', { unique: false });
      }

      // 创建音频切片表
      if (!db.objectStoreNames.contains(TABLES.AUDIO_SLICES)) {
        const sliceStore = db.createObjectStore(TABLES.AUDIO_SLICES, {
          keyPath: 'id',
        });
        sliceStore.createIndex('courseId', 'courseId', { unique: false });
      }
    };
  });
}

/**
 * 获取数据库存储大小（估算）
 */
export async function getStorageSize(): Promise<number> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return 0;
  }

  const estimate = await navigator.storage.estimate();
  return estimate.usage || 0;
}

/**
 * 获取存储配额
 */
export async function getStorageQuota(): Promise<number> {
  if (!navigator.storage || !navigator.storage.estimate) {
    return 0;
  }

  const estimate = await navigator.storage.estimate();
  return estimate.quota || 0;
}
