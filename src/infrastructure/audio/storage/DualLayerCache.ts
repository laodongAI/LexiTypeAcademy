import { LRUCache } from './LRUCache';
import {
  initAudioDatabase,
  TABLES,
  type TTSCacheRecord,
} from './AudioDatabase';

/**
 * 双层缓存管理器
 * 第一层：内存LRU缓存（50项）
 * 第二层：IndexedDB LRU缓存（500项）
 */
export class DualLayerCache {
  /** 内存LRU缓存（第一层，快速访问） */
  private memoryCache: LRUCache<string, Blob>;

  /** IndexedDB缓存（第二层，持久化） */
  private db: IDBDatabase | null = null;

  /** IndexedDB缓存容量 */
  private readonly indexedDBCapacity: number;

  /** 是否已初始化 */
  private isInitialized = false;

  constructor(
    memoryCapacity: number = 50,
    indexedDBCapacity: number = 500
  ) {
    this.memoryCache = new LRUCache<string, Blob>(memoryCapacity);
    this.indexedDBCapacity = indexedDBCapacity;
  }

  /**
   * 初始化双层缓存
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    this.db = await initAudioDatabase();
    this.isInitialized = true;
    console.log('[DualLayerCache] 初始化成功');
  }

  /**
   * 获取缓存项
   * 优先从内存缓存读取，未命中时从IndexedDB读取并更新内存缓存
   */
  async get(key: string): Promise<Blob | undefined> {
    // 第一层：内存缓存
    const memoryHit = this.memoryCache.get(key);
    if (memoryHit) {
      console.log(`[DualLayerCache] 内存缓存命中: ${key}`);
      return memoryHit;
    }

    // 第二层：IndexedDB缓存
    const dbHit = await this.getFromIndexedDB(key);
    if (dbHit) {
      console.log(`[DualLayerCache] IndexedDB缓存命中: ${key}`);
      // 更新内存缓存
      this.memoryCache.set(key, dbHit.audioBlob);
      return dbHit.audioBlob;
    }

    console.log(`[DualLayerCache] 缓存未命中: ${key}`);
    return undefined;
  }

  /**
   * 设置缓存项
   * 同时写入内存缓存和IndexedDB
   */
  async set(
    key: string,
    audioBlob: Blob,
    metadata: {
      text: string;
      voice: string;
      rate: number;
      duration: number;
    }
  ): Promise<void> {
    // 写入内存缓存
    this.memoryCache.set(key, audioBlob);

    // 写入IndexedDB
    await this.setToIndexedDB(key, audioBlob, metadata);

    // 检查IndexedDB容量，超过限制时清理最久未使用的项
    await this.ensureIndexedDBCapacity();
  }

  /**
   * 删除缓存项
   */
  async delete(key: string): Promise<void> {
    // 从内存缓存删除
    this.memoryCache.delete(key);

    // 从IndexedDB删除
    await this.deleteFromIndexedDB(key);
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    // 清空内存缓存
    this.memoryCache.clear();

    // 清空IndexedDB
    await this.clearIndexedDB();
  }

  /**
   * 获取内存缓存大小
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size();
  }

  /**
   * 获取IndexedDB缓存大小
   */
  async getIndexedDBCacheSize(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readonly');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const countRequest = store.count();

      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });
  }

  /**
   * 从IndexedDB读取
   */
  private async getFromIndexedDB(
    key: string
  ): Promise<TTSCacheRecord | undefined> {
    if (!this.db) {
      throw new Error('IndexedDB未初始化');
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readonly');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.get(key);

      request.onsuccess = () => {
        const record = request.result as TTSCacheRecord | undefined;
        
        // 检查是否过期
        if (record && record.expiresAt < Date.now()) {
          console.log(`[DualLayerCache] 缓存已过期: ${key}`);
          this.deleteFromIndexedDB(key); // 异步删除
          resolve(undefined);
          return;
        }

        resolve(record);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 写入IndexedDB
   */
  private async setToIndexedDB(
    key: string,
    audioBlob: Blob,
    metadata: {
      text: string;
      voice: string;
      rate: number;
      duration: number;
    }
  ): Promise<void> {
    if (!this.db) {
      throw new Error('IndexedDB未初始化');
    }

    const record: TTSCacheRecord = {
      id: key,
      text: metadata.text,
      voice: metadata.voice,
      rate: metadata.rate,
      audioBlob,
      duration: metadata.duration,
      createdAt: Date.now(),
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7天TTL
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readwrite');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 从IndexedDB删除
   */
  private async deleteFromIndexedDB(key: string): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readwrite');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空IndexedDB
   */
  private async clearIndexedDB(): Promise<void> {
    if (!this.db) {
      return;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readwrite');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 确保IndexedDB容量不超过限制
   * 超过时删除最久未使用的项（根据createdAt排序）
   */
  private async ensureIndexedDBCapacity(): Promise<void> {
    if (!this.db) {
      return;
    }

    const size = await this.getIndexedDBCacheSize();
    if (size <= this.indexedDBCapacity) {
      return;
    }

    // 计算需要删除的项数
    const deleteCount = size - this.indexedDBCapacity;
    console.log(`[DualLayerCache] IndexedDB超过容量，需要删除${deleteCount}项`);

    // 获取所有记录，按createdAt排序
    const records = await this.getAllRecords();
    records.sort((a, b) => a.createdAt - b.createdAt);

    // 删除最旧的记录
    const toDelete = records.slice(0, deleteCount);
    for (const record of toDelete) {
      await this.deleteFromIndexedDB(record.id);
    }

    console.log(`[DualLayerCache] 已删除${toDelete.length}项旧缓存`);
  }

  /**
   * 获取所有记录
   */
  private async getAllRecords(): Promise<TTSCacheRecord[]> {
    if (!this.db) {
      return [];
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readonly');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result as TTSCacheRecord[]);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清理过期缓存
   */
  async cleanExpired(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    const records = await this.getAllRecords();
    const now = Date.now();
    let cleanedCount = 0;

    for (const record of records) {
      if (record.expiresAt < now) {
        await this.deleteFromIndexedDB(record.id);
        this.memoryCache.delete(record.id);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`[DualLayerCache] 清理了${cleanedCount}项过期缓存`);
    }

    return cleanedCount;
  }
}
