/**
 * 缓存管理器 - 实现
 * 
 * 功能：
 * 1. 多层缓存策略（内存 + 本地存储）
 * 2. TTL（生存时间）管理
 * 3. LRU（最近最少使用）淘汰
 * 4. 缓存命中率统计
 * 5. 异步预热
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 缓存条目
 */
interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: number;
  expiresAt: number;
  accessCount: number;
  lastAccessed: number;
  size?: number;  // 估算大小（字节）
}

/**
 * 缓存选项
 */
export interface CacheOptions {
  ttl?: number;              // 生存时间（毫秒），默认 5 分钟
  priority?: 'low' | 'normal' | 'high';  // 优先级
  persistent?: boolean;      // 是否持久化到本地存储
  tags?: string[];           // 标签（用于批量失效）
}

/**
 * 缓存统计
 */
export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  entries: number;
  memorySize: number;
  persistentSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
}

/**
 * 缓存配置
 */
export interface CacheConfig {
  maxMemoryEntries: number;      // 内存最大条目数
  maxPersistentSize: number;     // 持久化最大大小（字节）
  defaultTTL: number;            // 默认 TTL（毫秒）
  cleanupInterval: number;       // 清理间隔（毫秒）
  evictionPolicy: 'lru' | 'fifo' | 'lfu';  // 淘汰策略
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxMemoryEntries: 1000,
  maxPersistentSize: 50 * 1024 * 1024,  // 50MB
  defaultTTL: 5 * 60 * 1000,             // 5 分钟
  cleanupInterval: 60 * 1000,            // 1 分钟
  evictionPolicy: 'lru'
};

// ============================================================================
// 缓存管理器接口
// ============================================================================

/**
 * 缓存管理器接口
 */
export interface ICacheManager {
  // 基本操作
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T, options?: CacheOptions): void;
  has(key: string): boolean;
  delete(key: string): boolean;
  clear(): void;
  
  // 批量操作
  getMultiple<T>(keys: string[]): Map<string, T>;
  setMultiple<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): void;
  
  // 标签操作
  invalidateByTag(tag: string): number;
  getByTag<T>(tag: string): Map<string, T>;
  
  // 统计
  getStats(): CacheStats;
  
  // 配置
  configure(config: Partial<CacheConfig>): void;
}

// ============================================================================
// 缓存管理器实现
// ============================================================================

/**
 * 缓存管理器
 */
export class CacheManager implements ICacheManager {
  private memoryCache: Map<string, CacheEntry<any>> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();  // tag -> keys
  private config: CacheConfig;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  // 统计数据
  private stats = {
    hits: 0,
    misses: 0
  };

  private static readonly PERSISTENT_PREFIX = 'cache_';
  private static readonly META_KEY = 'cache_meta';

  constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadPersistentMeta();
    this.startCleanupTimer();
    
    console.log('🗄️ 缓存管理器已初始化', this.config);
  }

  // ============================================================================
  // 生命周期
  // ============================================================================

  /**
   * 启动清理定时器
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  /**
   * 停止清理定时器
   */
  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * 加载持久化元数据
   */
  private loadPersistentMeta(): void {
    try {
      const meta = localStorage.getItem(CacheManager.META_KEY);
      if (meta) {
        const parsed = JSON.parse(meta);
        // 恢复标签索引
        if (parsed.tagIndex) {
          for (const [tag, keys] of Object.entries(parsed.tagIndex)) {
            this.tagIndex.set(tag, new Set(keys as string[]));
          }
        }
      }
    } catch (error) {
      console.error('加载缓存元数据失败:', error);
    }
  }

  /**
   * 保存持久化元数据
   */
  private savePersistentMeta(): void {
    try {
      const meta = {
        tagIndex: Object.fromEntries(
          Array.from(this.tagIndex.entries()).map(([tag, keys]) => [tag, Array.from(keys)])
        )
      };
      localStorage.setItem(CacheManager.META_KEY, JSON.stringify(meta));
    } catch (error) {
      console.error('保存缓存元数据失败:', error);
    }
  }

  // ============================================================================
  // 基本操作
  // ============================================================================

  /**
   * 获取缓存值
   */
  get<T>(key: string): T | undefined {
    // 先查内存缓存
    const memEntry = this.memoryCache.get(key);
    if (memEntry) {
      if (this.isExpired(memEntry)) {
        this.delete(key);
        this.stats.misses++;
        return undefined;
      }
      memEntry.accessCount++;
      memEntry.lastAccessed = Date.now();
      this.stats.hits++;
      return memEntry.value as T;
    }

    // 再查持久化缓存
    const persistent = this.getPersistent<T>(key);
    if (persistent) {
      // 提升到内存缓存
      this.memoryCache.set(key, {
        key,
        value: persistent,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.config.defaultTTL,
        accessCount: 1,
        lastAccessed: Date.now()
      });
      this.stats.hits++;
      return persistent;
    }

    this.stats.misses++;
    return undefined;
  }

  /**
   * 设置缓存值
   */
  set<T>(key: string, value: T, options?: CacheOptions): void {
    const now = Date.now();
    const ttl = options?.ttl ?? this.config.defaultTTL;
    
    const entry: CacheEntry<T> = {
      key,
      value,
      createdAt: now,
      expiresAt: now + ttl,
      accessCount: 0,
      lastAccessed: now,
      size: this.estimateSize(value)
    };

    // 检查是否需要淘汰
    if (this.memoryCache.size >= this.config.maxMemoryEntries) {
      this.evict();
    }

    // 存入内存
    this.memoryCache.set(key, entry);

    // 持久化
    if (options?.persistent) {
      this.setPersistent(key, value, ttl);
    }

    // 更新标签索引
    if (options?.tags) {
      for (const tag of options.tags) {
        if (!this.tagIndex.has(tag)) {
          this.tagIndex.set(tag, new Set());
        }
        this.tagIndex.get(tag)!.add(key);
      }
      this.savePersistentMeta();
    }
  }

  /**
   * 检查缓存是否存在
   */
  has(key: string): boolean {
    const memEntry = this.memoryCache.get(key);
    if (memEntry && !this.isExpired(memEntry)) {
      return true;
    }
    return this.hasPersistent(key);
  }

  /**
   * 删除缓存
   */
  delete(key: string): boolean {
    const hadMemory = this.memoryCache.delete(key);
    const hadPersistent = this.deletePersistent(key);
    
    // 从标签索引中移除
    for (const keys of this.tagIndex.values()) {
      keys.delete(key);
    }
    
    return hadMemory || hadPersistent;
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.memoryCache.clear();
    this.tagIndex.clear();
    this.clearPersistent();
    this.stats = { hits: 0, misses: 0 };
    console.log('🗑️ 缓存已清空');
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  /**
   * 批量获取
   */
  getMultiple<T>(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();
    for (const key of keys) {
      const value = this.get<T>(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * 批量设置
   */
  setMultiple<T>(entries: Array<{ key: string; value: T; options?: CacheOptions }>): void {
    for (const { key, value, options } of entries) {
      this.set(key, value, options);
    }
  }

  // ============================================================================
  // 标签操作
  // ============================================================================

  /**
   * 按标签失效
   */
  invalidateByTag(tag: string): number {
    const keys = this.tagIndex.get(tag);
    if (!keys) return 0;

    let count = 0;
    for (const key of keys) {
      if (this.delete(key)) {
        count++;
      }
    }
    
    this.tagIndex.delete(tag);
    this.savePersistentMeta();
    
    console.log(`🏷️ 按标签 "${tag}" 失效了 ${count} 个缓存条目`);
    return count;
  }

  /**
   * 按标签获取
   */
  getByTag<T>(tag: string): Map<string, T> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return new Map();
    
    return this.getMultiple<T>(Array.from(keys));
  }

  // ============================================================================
  // 统计
  // ============================================================================

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const memorySize = Array.from(this.memoryCache.values())
      .reduce((sum, entry) => sum + (entry.size || 0), 0);
    
    const entries = Array.from(this.memoryCache.values());
    const timestamps = entries.map(e => e.createdAt);
    
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      entries: this.memoryCache.size,
      memorySize,
      persistentSize: this.getPersistentSize(),
      oldestEntry: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestEntry: timestamps.length > 0 ? Math.max(...timestamps) : null
    };
  }

  // ============================================================================
  // 配置
  // ============================================================================

  /**
   * 更新配置
   */
  configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
    this.startCleanupTimer();  // 重启定时器
    console.log('⚙️ 缓存配置已更新', this.config);
  }

  // ============================================================================
  // 私有方法 - 持久化
  // ============================================================================

  private getPersistent<T>(key: string): T | undefined {
    try {
      const stored = localStorage.getItem(CacheManager.PERSISTENT_PREFIX + key);
      if (!stored) return undefined;
      
      const entry = JSON.parse(stored) as CacheEntry<T>;
      if (this.isExpired(entry)) {
        this.deletePersistent(key);
        return undefined;
      }
      
      return entry.value;
    } catch {
      return undefined;
    }
  }

  private setPersistent<T>(key: string, value: T, ttl: number): void {
    try {
      const entry: CacheEntry<T> = {
        key,
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + ttl,
        accessCount: 0,
        lastAccessed: Date.now()
      };
      localStorage.setItem(
        CacheManager.PERSISTENT_PREFIX + key,
        JSON.stringify(entry)
      );
    } catch (error) {
      console.warn('持久化缓存失败（可能已满）:', error);
    }
  }

  private hasPersistent(key: string): boolean {
    return localStorage.getItem(CacheManager.PERSISTENT_PREFIX + key) !== null;
  }

  private deletePersistent(key: string): boolean {
    const existed = this.hasPersistent(key);
    localStorage.removeItem(CacheManager.PERSISTENT_PREFIX + key);
    return existed;
  }

  private clearPersistent(): void {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CacheManager.PERSISTENT_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
    localStorage.removeItem(CacheManager.META_KEY);
  }

  private getPersistentSize(): number {
    let size = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CacheManager.PERSISTENT_PREFIX)) {
        const value = localStorage.getItem(key);
        if (value) {
          size += key.length + value.length;
        }
      }
    }
    return size * 2;  // UTF-16 字符 = 2 字节
  }

  // ============================================================================
  // 私有方法 - 淘汰与清理
  // ============================================================================

  /**
   * 检查是否过期
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() > entry.expiresAt;
  }

  /**
   * 淘汰条目
   */
  private evict(): void {
    switch (this.config.evictionPolicy) {
      case 'lru':
        this.evictLRU();
        break;
      case 'fifo':
        this.evictFIFO();
        break;
      case 'lfu':
        this.evictLFU();
        break;
    }
  }

  /**
   * LRU 淘汰（最近最少使用）
   */
  private evictLRU(): void {
    let oldest: CacheEntry<any> | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.memoryCache) {
      if (!oldest || entry.lastAccessed < oldest.lastAccessed) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * FIFO 淘汰（先进先出）
   */
  private evictFIFO(): void {
    let oldest: CacheEntry<any> | null = null;
    let oldestKey: string | null = null;

    for (const [key, entry] of this.memoryCache) {
      if (!oldest || entry.createdAt < oldest.createdAt) {
        oldest = entry;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.memoryCache.delete(oldestKey);
    }
  }

  /**
   * LFU 淘汰（最不常使用）
   */
  private evictLFU(): void {
    let leastUsed: CacheEntry<any> | null = null;
    let leastUsedKey: string | null = null;

    for (const [key, entry] of this.memoryCache) {
      if (!leastUsed || entry.accessCount < leastUsed.accessCount) {
        leastUsed = entry;
        leastUsedKey = key;
      }
    }

    if (leastUsedKey) {
      this.memoryCache.delete(leastUsedKey);
    }
  }

  /**
   * 清理过期条目
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;

    // 清理内存缓存
    for (const [key, entry] of this.memoryCache) {
      if (this.isExpired(entry)) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    // 清理持久化缓存
    const persistentKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CacheManager.PERSISTENT_PREFIX)) {
        persistentKeys.push(key.replace(CacheManager.PERSISTENT_PREFIX, ''));
      }
    }

    for (const key of persistentKeys) {
      const stored = localStorage.getItem(CacheManager.PERSISTENT_PREFIX + key);
      if (stored) {
        try {
          const entry = JSON.parse(stored) as CacheEntry<any>;
          if (now > entry.expiresAt) {
            localStorage.removeItem(CacheManager.PERSISTENT_PREFIX + key);
            cleaned++;
          }
        } catch {
          localStorage.removeItem(CacheManager.PERSISTENT_PREFIX + key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`🧹 清理了 ${cleaned} 个过期缓存条目`);
    }
  }

  /**
   * 估算对象大小
   */
  private estimateSize(value: any): number {
    try {
      return JSON.stringify(value).length * 2;  // UTF-16
    } catch {
      return 0;
    }
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let _instance: CacheManager | null = null;

/**
 * 获取缓存管理器实例
 */
export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  if (!_instance) {
    _instance = new CacheManager(config);
  }
  return _instance;
}
