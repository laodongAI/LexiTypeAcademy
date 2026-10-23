import { DualLayerCache } from '../storage/DualLayerCache';
import { AudioFileManager } from '../storage/AudioFileManager';
import type { TTSOptions } from './types';

/**
 * TTS缓存仓储
 * 负责TTS音频的缓存管理（使用双层缓存）
 */
export class TTSCacheRepository {
  /** 双层缓存 */
  private cache: DualLayerCache;

  /** 文件管理器 */
  private fileManager: AudioFileManager;

  constructor(cache: DualLayerCache, fileManager: AudioFileManager) {
    this.cache = cache;
    this.fileManager = fileManager;
  }

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    await this.cache.initialize();
    console.log('[TTSCacheRepository] 初始化成功');
  }

  /**
   * 获取缓存的TTS音频
   * @param options TTS选项
   * @returns 音频Blob，未找到返回undefined
   */
  async get(options: TTSOptions): Promise<Blob | undefined> {
    const key = this.generateCacheKey(options);
    return await this.cache.get(key);
  }

  /**
   * 存储TTS音频到缓存
   * @param options TTS选项
   * @param audioBlob 音频Blob
   * @param duration 音频时长(秒)
   */
  async set(
    options: TTSOptions,
    audioBlob: Blob,
    duration: number
  ): Promise<void> {
    const key = this.generateCacheKey(options);

    await this.cache.set(key, audioBlob, {
      text: options.text,
      voice: options.voice || 'default',
      rate: options.rate || 1.0,
      duration,
    });

    console.log(`[TTSCacheRepository] 已缓存: ${key}`);
  }

  /**
   * 删除缓存项
   */
  async delete(options: TTSOptions): Promise<void> {
    const key = this.generateCacheKey(options);
    await this.cache.delete(key);
    console.log(`[TTSCacheRepository] 已删除缓存: ${key}`);
  }

  /**
   * 检查缓存是否存在
   */
  async has(options: TTSOptions): Promise<boolean> {
    const cached = await this.get(options);
    return cached !== undefined;
  }

  /**
   * 清理过期缓存
   * @returns 清理的缓存数量
   */
  async cleanExpired(): Promise<number> {
    const count = await this.cache.cleanExpired();
    console.log(`[TTSCacheRepository] 清理了${count}个过期缓存`);
    return count;
  }

  /**
   * 获取缓存统计信息
   */
  async getCacheStats(): Promise<{
    memorySize: number;
    indexedDBSize: number;
  }> {
    return {
      memorySize: this.cache.getMemoryCacheSize(),
      indexedDBSize: await this.cache.getIndexedDBCacheSize(),
    };
  }

  /**
   * 清空所有缓存
   */
  async clear(): Promise<void> {
    await this.cache.clear();
    console.log('[TTSCacheRepository] 已清空所有缓存');
  }

  /**
   * 生成缓存键
   * 使用语义hash生成唯一标识
   */
  private generateCacheKey(options: TTSOptions): string {
    return this.fileManager.getTTSAudioPath(
      options.text,
      options.voice || 'default',
      options.rate || 1.0
    );
  }

  /**
   * 批量预缓存TTS音频
   * 用于课程音频预加载场景
   */
  async prefetch(optionsList: TTSOptions[]): Promise<void> {
    console.log(`[TTSCacheRepository] 开始预缓存 ${optionsList.length} 项`);

    // 检查哪些项需要缓存
    const needFetch = await Promise.all(
      optionsList.map(async (options) => ({
        options,
        needCache: !(await this.has(options)),
      }))
    );

    const toCacheCount = needFetch.filter((item) => item.needCache).length;
    console.log(`[TTSCacheRepository] 需要缓存 ${toCacheCount} 项`);
  }
}
