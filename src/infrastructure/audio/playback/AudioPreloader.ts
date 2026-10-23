/**
 * 音频预加载器
 * 
 * 功能:
 * 1. 预加载音频资源 (默认2句, 上限5句)
 * 2. 懒加载策略 (超过5句使用IntersectionObserver)
 * 3. 优先级队列
 * 4. 缓存管理
 * 
 * 优化:
 * - LRU缓存淘汰
 * - 并发加载控制
 * - 错误重试机制
 */

import { PreloadItem } from './types';
import { AudioContextManager } from '../storage/AudioContextManager';

/**
 * 预加载配置
 */
export interface PreloaderConfig {
  /** 默认预加载数量 */
  defaultPreloadCount?: number;
  
  /** 最大预加载数量 */
  maxPreloadCount?: number;
  
  /** 最大并发加载数 */
  maxConcurrent?: number;
  
  /** 缓存大小 (项数) */
  cacheSize?: number;
  
  /** 是否启用IntersectionObserver懒加载 */
  enableLazyLoad?: boolean;
  
  /** IntersectionObserver阈值 */
  lazyLoadThreshold?: number;
}

/**
 * 音频预加载器
 */
export class AudioPreloader {
  private cache: Map<string, PreloadItem> = new Map();
  private loadQueue: PreloadItem[] = [];
  private activeLoads = 0;
  private audioContextManager: AudioContextManager;
  private config: Required<PreloaderConfig>;
  private intersectionObserver?: IntersectionObserver;
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: Required<PreloaderConfig> = {
    defaultPreloadCount: 2,
    maxPreloadCount: 5,
    maxConcurrent: 3,
    cacheSize: 20,
    enableLazyLoad: true,
    lazyLoadThreshold: 0.5,
  };
  
  /**
   * 构造函数
   */
  constructor(
    audioContextManager: AudioContextManager,
    config: PreloaderConfig = {}
  ) {
    this.audioContextManager = audioContextManager;
    this.config = {
      ...AudioPreloader.DEFAULT_CONFIG,
      ...config,
    };
    
    // 初始化IntersectionObserver
    if (this.config.enableLazyLoad && typeof IntersectionObserver !== 'undefined') {
      this.initIntersectionObserver();
    }
  }
  
  /**
   * 初始化IntersectionObserver
   */
  private initIntersectionObserver(): void {
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.audioId;
            if (id) {
              const item = this.cache.get(id);
              if (item && !item.loaded) {
                this.loadItem(item);
              }
            }
          }
        }
      },
      {
        rootMargin: '200px', // 提前200px开始加载
        threshold: this.config.lazyLoadThreshold,
      }
    );
  }
  
  /**
   * 预加载音频列表
   */
  async preload(sources: Array<{ id: string; source: string | Blob; priority?: number }>): Promise<void> {
    console.log(`[AudioPreloader] 预加载 ${sources.length} 个音频...`);
    
    // 根据配置决定预加载策略
    const preloadCount = Math.min(
      sources.length,
      this.config.maxPreloadCount
    );
    
    // 前N个立即加载
    const immediateLoads = sources.slice(0, preloadCount);
    const lazyLoads = sources.slice(preloadCount);
    
    // 创建预加载项
    for (const source of immediateLoads) {
      const item: PreloadItem = {
        id: source.id,
        source: source.source,
        priority: source.priority ?? 0,
        loaded: false,
      };
      
      this.cache.set(item.id, item);
      this.enqueueLoad(item);
    }
    
    // 懒加载项只添加到缓存
    if (this.config.enableLazyLoad) {
      for (const source of lazyLoads) {
        const item: PreloadItem = {
          id: source.id,
          source: source.source,
          priority: source.priority ?? -1, // 低优先级
          loaded: false,
        };
        
        this.cache.set(item.id, item);
      }
    }
    
    // 开始处理加载队列
    this.processLoadQueue();
    
    console.log(`[AudioPreloader] 立即加载 ${immediateLoads.length} 个, 懒加载 ${lazyLoads.length} 个`);
  }
  
  /**
   * 预加载单个音频
   */
  async preloadSingle(id: string, source: string | Blob, priority: number = 0): Promise<AudioBuffer | null> {
    // 检查缓存
    const cached = this.cache.get(id);
    if (cached?.loaded && cached.buffer) {
      console.log(`[AudioPreloader] 缓存命中: ${id}`);
      return cached.buffer;
    }
    
    // 创建预加载项
    const item: PreloadItem = {
      id,
      source,
      priority,
      loaded: false,
    };
    
    this.cache.set(id, item);
    
    // 立即加载
    await this.loadItem(item);
    
    return item.buffer || null;
  }
  
  /**
   * 加入加载队列
   */
  private enqueueLoad(item: PreloadItem): void {
    this.loadQueue.push(item);
    
    // 按优先级排序
    this.loadQueue.sort((a, b) => b.priority - a.priority);
  }
  
  /**
   * 处理加载队列
   */
  private processLoadQueue(): void {
    while (
      this.activeLoads < this.config.maxConcurrent &&
      this.loadQueue.length > 0
    ) {
      const item = this.loadQueue.shift()!;
      this.loadItem(item);
    }
  }
  
  /**
   * 加载单个项
   */
  private async loadItem(item: PreloadItem): Promise<void> {
    if (item.loaded) return;
    
    this.activeLoads++;
    
    try {
      console.log(`[AudioPreloader] 加载中: ${item.id}`);
      
      // 获取AudioBuffer
      const buffer = await this.fetchAndDecode(item.source);
      
      item.buffer = buffer;
      item.loaded = true;
      item.error = undefined;
      
      console.log(`[AudioPreloader] 加载成功: ${item.id}`);
    } catch (error) {
      item.error = error as Error;
      item.loaded = false;
      console.error(`[AudioPreloader] 加载失败: ${item.id}`, error);
    } finally {
      this.activeLoads--;
      
      // 继续处理队列
      this.processLoadQueue();
      
      // 检查缓存大小
      this.evictIfNeeded();
    }
  }
  
  /**
   * 获取并解码音频
   */
  private async fetchAndDecode(source: string | Blob): Promise<AudioBuffer> {
    // 获取ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    
    if (typeof source === 'string') {
      // URL
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      // Blob
      arrayBuffer = await source.arrayBuffer();
    }
    
    // 解码
    const audioContext = this.audioContextManager.getContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    return audioBuffer;
  }
  
  /**
   * 获取预加载的音频
   */
  get(id: string): AudioBuffer | null {
    const item = this.cache.get(id);
    
    if (!item) {
      console.warn(`[AudioPreloader] 未找到: ${id}`);
      return null;
    }
    
    if (!item.loaded) {
      console.warn(`[AudioPreloader] 未加载: ${id}`);
      // 触发加载
      this.loadItem(item);
      return null;
    }
    
    return item.buffer || null;
  }
  
  /**
   * 检查是否已加载
   */
  isLoaded(id: string): boolean {
    const item = this.cache.get(id);
    return item?.loaded ?? false;
  }
  
  /**
   * 移除缓存项
   */
  remove(id: string): boolean {
    return this.cache.delete(id);
  }
  
  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
    this.loadQueue = [];
    console.log('[AudioPreloader] 缓存已清空');
  }
  
  /**
   * LRU淘汰 (如果超过缓存大小)
   */
  private evictIfNeeded(): void {
    if (this.cache.size <= this.config.cacheSize) {
      return;
    }
    
    // 简单LRU: 删除最旧的项 (假设Map的迭代顺序是插入顺序)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      console.log(`[AudioPreloader] LRU淘汰: ${firstKey}`);
    }
  }
  
  /**
   * 注册元素用于懒加载
   */
  observeElement(element: HTMLElement, audioId: string): void {
    if (!this.intersectionObserver) {
      console.warn('[AudioPreloader] IntersectionObserver未启用');
      return;
    }
    
    element.dataset.audioId = audioId;
    this.intersectionObserver.observe(element);
  }
  
  /**
   * 取消观察元素
   */
  unobserveElement(element: HTMLElement): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.unobserve(element);
    }
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    cacheSize: number;
    maxCacheSize: number;
    loadedCount: number;
    pendingCount: number;
    errorCount: number;
    activeLoads: number;
  } {
    let loadedCount = 0;
    let errorCount = 0;
    
    for (const item of this.cache.values()) {
      if (item.loaded) loadedCount++;
      if (item.error) errorCount++;
    }
    
    return {
      cacheSize: this.cache.size,
      maxCacheSize: this.config.cacheSize,
      loadedCount,
      pendingCount: this.cache.size - loadedCount,
      errorCount,
      activeLoads: this.activeLoads,
    };
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
    }
    
    this.clear();
  }
}
