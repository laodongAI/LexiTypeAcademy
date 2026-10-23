import { getStorageSize, initAudioDatabase, TABLES } from './AudioDatabase';

/**
 * 音频健康监控器
 * 负责监控IndexedDB存储大小并自动清理
 */
export class AudioHealthMonitor {
  /** 存储大小阈值（1.5GB） */
  private readonly STORAGE_THRESHOLD = 1.5 * 1024 * 1024 * 1024;

  /** 目标清理后大小（1GB） */
  private readonly TARGET_SIZE = 1 * 1024 * 1024 * 1024;

  /** 数据库实例 */
  private db: IDBDatabase | null = null;

  /** 是否正在清理 */
  private isCleaning = false;

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    this.db = await initAudioDatabase();
    console.log('[AudioHealthMonitor] 初始化成功');
  }

  /**
   * 执行健康检查
   * 返回是否触发了清理操作
   */
  async performHealthCheck(): Promise<boolean> {
    if (this.isCleaning) {
      console.log('[AudioHealthMonitor] 正在清理中，跳过本次检查');
      return false;
    }

    const currentSize = await getStorageSize();
    console.log(
      `[AudioHealthMonitor] 当前存储大小: ${(currentSize / 1024 / 1024).toFixed(2)}MB`
    );

    if (currentSize > this.STORAGE_THRESHOLD) {
      console.warn(
        `[AudioHealthMonitor] 存储大小超过阈值 (${(this.STORAGE_THRESHOLD / 1024 / 1024).toFixed(0)}MB)，开始清理`
      );
      await this.performCleanup();
      return true;
    }

    return false;
  }

  /**
   * 执行清理操作
   * 策略：
   * 1. 清理过期TTS缓存
   * 2. 清理旧提示音（保留最近30个课程）
   * 3. 如果仍超限，清理最旧的TTS缓存
   */
  private async performCleanup(): Promise<void> {
    this.isCleaning = true;

    try {
      // 1. 清理过期TTS缓存
      const expiredCount = await this.cleanExpiredTTSCache();
      console.log(`[AudioHealthMonitor] 清理了${expiredCount}个过期TTS缓存`);

      // 2. 清理旧提示音
      const promptCount = await this.cleanOldPromptSounds();
      console.log(`[AudioHealthMonitor] 清理了${promptCount}个旧提示音`);

      // 3. 检查是否仍超限
      const currentSize = await getStorageSize();
      if (currentSize > this.TARGET_SIZE) {
        const ttsCount = await this.cleanOldestTTSCache();
        console.log(`[AudioHealthMonitor] 清理了${ttsCount}个最旧的TTS缓存`);
      }

      const finalSize = await getStorageSize();
      console.log(
        `[AudioHealthMonitor] 清理完成，当前大小: ${(finalSize / 1024 / 1024).toFixed(2)}MB`
      );
    } finally {
      this.isCleaning = false;
    }
  }

  /**
   * 清理过期TTS缓存
   */
  private async cleanExpiredTTSCache(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readwrite');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const index = store.index('expiresAt');
      const now = Date.now();

      // 查询所有expiresAt < now的记录
      const request = index.openCursor(IDBKeyRange.upperBound(now));
      let deleteCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          deleteCount++;
          cursor.continue();
        } else {
          resolve(deleteCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清理旧提示音（保留最近30个课程）
   */
  private async cleanOldPromptSounds(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(
        [TABLES.PROMPT_SOUNDS],
        'readwrite'
      );
      const store = transaction.objectStore(TABLES.PROMPT_SOUNDS);
      const request = store.getAll();

      request.onsuccess = async () => {
        const records = request.result;
        
        // 按创建时间排序
        records.sort((a, b) => b.createdAt - a.createdAt);

        // 保留最近30个，删除其余
        const toDelete = records.slice(30);
        
        for (const record of toDelete) {
          await new Promise<void>((res, rej) => {
            const deleteRequest = store.delete(record.courseId);
            deleteRequest.onsuccess = () => res();
            deleteRequest.onerror = () => rej(deleteRequest.error);
          });
        }

        resolve(toDelete.length);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清理最旧的TTS缓存（直到达到目标大小）
   */
  private async cleanOldestTTSCache(): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([TABLES.TTS_CACHE], 'readwrite');
      const store = transaction.objectStore(TABLES.TTS_CACHE);
      const request = store.getAll();

      request.onsuccess = async () => {
        const records = request.result;
        
        // 按创建时间排序（最旧的在前）
        records.sort((a, b) => a.createdAt - b.createdAt);

        let deleteCount = 0;
        const targetDeleteCount = Math.ceil(records.length * 0.3); // 删除30%

        for (let i = 0; i < targetDeleteCount && i < records.length; i++) {
          await new Promise<void>((res, rej) => {
            const deleteRequest = store.delete(records[i].id);
            deleteRequest.onsuccess = () => res();
            deleteRequest.onerror = () => rej(deleteRequest.error);
          });
          deleteCount++;
        }

        resolve(deleteCount);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 手动触发清理
   */
  async manualCleanup(): Promise<void> {
    console.log('[AudioHealthMonitor] 手动触发清理');
    await this.performCleanup();
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<{
    totalSize: number;
    ttsCacheCount: number;
    promptSoundCount: number;
    recordingCount: number;
    sliceCount: number;
  }> {
    if (!this.db) {
      return {
        totalSize: 0,
        ttsCacheCount: 0,
        promptSoundCount: 0,
        recordingCount: 0,
        sliceCount: 0,
      };
    }

    const totalSize = await getStorageSize();

    const counts = await Promise.all([
      this.getTableCount(TABLES.TTS_CACHE),
      this.getTableCount(TABLES.PROMPT_SOUNDS),
      this.getTableCount(TABLES.STUDENT_RECORDINGS),
      this.getTableCount(TABLES.AUDIO_SLICES),
    ]);

    return {
      totalSize,
      ttsCacheCount: counts[0],
      promptSoundCount: counts[1],
      recordingCount: counts[2],
      sliceCount: counts[3],
    };
  }

  /**
   * 获取表记录数
   */
  private async getTableCount(tableName: string): Promise<number> {
    if (!this.db) {
      return 0;
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([tableName], 'readonly');
      const store = transaction.objectStore(tableName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
