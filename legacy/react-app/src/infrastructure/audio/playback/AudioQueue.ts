/**
 * 音频播放队列
 * 
 * 功能:
 * 1. FIFO队列管理
 * 2. 优先级排序
 * 3. 队列操作 (入队/出队/清空)
 * 4. 队列状态查询
 * 
 * 优化:
 * - 高优先级优先播放
 * - 队列长度限制
 * - 自动去重
 */

import { PlaybackItem } from './types';

/**
 * 音频队列配置
 */
export interface AudioQueueConfig {
  /** 最大队列长度 */
  maxLength?: number;
  
  /** 是否自动去重 */
  autoDeduplicate?: boolean;
}

/**
 * 音频播放队列
 */
export class AudioQueue {
  private queue: PlaybackItem[] = [];
  private config: Required<AudioQueueConfig>;
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: Required<AudioQueueConfig> = {
    maxLength: 100,
    autoDeduplicate: true,
  };
  
  /**
   * 构造函数
   */
  constructor(config: AudioQueueConfig = {}) {
    this.config = {
      ...AudioQueue.DEFAULT_CONFIG,
      ...config,
    };
  }
  
  /**
   * 入队
   */
  enqueue(item: PlaybackItem): boolean {
    // 检查队列是否已满
    if (this.queue.length >= this.config.maxLength) {
      console.warn('[AudioQueue] 队列已满，无法添加');
      return false;
    }
    
    // 自动去重
    if (this.config.autoDeduplicate) {
      const existingIndex = this.queue.findIndex(i => i.id === item.id);
      if (existingIndex !== -1) {
        console.log(`[AudioQueue] 项目 ${item.id} 已存在，跳过`);
        return false;
      }
    }
    
    // 添加到队列
    this.queue.push(item);
    
    // 按优先级排序 (高优先级在前)
    this.sortByPriority();
    
    console.log(`[AudioQueue] 已添加: ${item.id} (队列长度: ${this.queue.length})`);
    return true;
  }
  
  /**
   * 批量入队
   */
  enqueueMultiple(items: PlaybackItem[]): number {
    let successCount = 0;
    for (const item of items) {
      if (this.enqueue(item)) {
        successCount++;
      }
    }
    return successCount;
  }
  
  /**
   * 出队 (返回并移除队首)
   */
  dequeue(): PlaybackItem | null {
    if (this.queue.length === 0) {
      return null;
    }
    
    const item = this.queue.shift()!;
    console.log(`[AudioQueue] 已出队: ${item.id} (剩余: ${this.queue.length})`);
    return item;
  }
  
  /**
   * 查看队首 (不移除)
   */
  peek(): PlaybackItem | null {
    return this.queue.length > 0 ? this.queue[0] : null;
  }
  
  /**
   * 移除指定项
   */
  remove(id: string): boolean {
    const index = this.queue.findIndex(item => item.id === id);
    if (index === -1) {
      return false;
    }
    
    this.queue.splice(index, 1);
    console.log(`[AudioQueue] 已移除: ${id}`);
    return true;
  }
  
  /**
   * 清空队列
   */
  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    console.log(`[AudioQueue] 已清空 ${count} 个项目`);
  }
  
  /**
   * 按优先级排序
   */
  private sortByPriority(): void {
    this.queue.sort((a, b) => {
      const priorityA = a.priority ?? 0;
      const priorityB = b.priority ?? 0;
      return priorityB - priorityA; // 降序排列
    });
  }
  
  /**
   * 查找项
   */
  find(id: string): PlaybackItem | null {
    return this.queue.find(item => item.id === id) || null;
  }
  
  /**
   * 获取队列长度
   */
  get length(): number {
    return this.queue.length;
  }
  
  /**
   * 检查队列是否为空
   */
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
  
  /**
   * 检查队列是否已满
   */
  get isFull(): boolean {
    return this.queue.length >= this.config.maxLength;
  }
  
  /**
   * 获取所有项 (只读)
   */
  getAll(): ReadonlyArray<PlaybackItem> {
    return [...this.queue];
  }
  
  /**
   * 获取队列统计信息
   */
  getStats(): {
    length: number;
    maxLength: number;
    isEmpty: boolean;
    isFull: boolean;
    priorityDistribution: Map<number, number>;
  } {
    // 统计优先级分布
    const priorityDistribution = new Map<number, number>();
    for (const item of this.queue) {
      const priority = item.priority ?? 0;
      priorityDistribution.set(priority, (priorityDistribution.get(priority) || 0) + 1);
    }
    
    return {
      length: this.queue.length,
      maxLength: this.config.maxLength,
      isEmpty: this.isEmpty,
      isFull: this.isFull,
      priorityDistribution,
    };
  }
}
