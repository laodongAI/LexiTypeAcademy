/**
 * 音频存储类型定义
 * 
 * 支持两种存储方式:
 * 1. IndexedDB: 浏览器端存储 (小文件, <10MB)
 * 2. FileSystem: Electron文件系统 (大文件, >10MB)
 */

/**
 * 存储类型枚举
 */
export enum StorageType {
  INDEXEDDB = 'indexeddb',
  FILESYSTEM = 'filesystem',
}

/**
 * 音频文件记录接口
 * 用于在数据库中存储音频文件元数据
 */
export interface AudioFile {
  /** 文件路径 (唯一标识符) */
  path: string;
  
  /** 存储类型 */
  storageType: StorageType;
  
  /** 音频Blob (IndexedDB存储时使用) */
  blob?: Blob;
  
  /** 文件大小 (字节) */
  size: number;
  
  /** MIME类型 */
  mimeType: string;
  
  /** 创建时间戳 */
  createdAt: number;
  
  /** 元数据 */
  metadata?: {
    duration?: number;
    sampleRate?: number;
    channels?: number;
    [key: string]: any;
  };
}

/**
 * 缓存统计信息
 */
export interface CacheStats {
  /** 缓存项数量 */
  count: number;
  
  /** 总大小 (字节) */
  totalSize: number;
  
  /** 命中次数 */
  hits: number;
  
  /** 未命中次数 */
  misses: number;
  
  /** 命中率 (0-1) */
  hitRate: number;
}
