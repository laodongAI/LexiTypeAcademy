/**
 * 音频切片器
 * 
 * 功能:
 * 1. OfflineAudioContext音频解码
 * 2. 长音频分片 (>30秒自动分片)
 * 3. 边界检查 (Math.max/Math.min)
 * 4. 切片预加载
 * 
 * 优化:
 * - 避免大音频阻塞主线程
 * - 切片缓存复用
 * - 精确时间裁剪
 */

import { AudioSlice } from './types';

/**
 * 切片配置
 */
export interface SlicerConfig {
  /** 切片时长阈值 (秒, 超过此值将分片) */
  sliceThreshold?: number;
  
  /** 每片长度 (秒) */
  sliceLength?: number;
  
  /** 切片重叠时间 (秒, 避免边界问题) */
  overlapDuration?: number;
}

/**
 * 音频切片器
 */
export class AudioSlicer {
  private config: Required<SlicerConfig>;
  private sliceCache: Map<string, AudioSlice[]> = new Map();
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: Required<SlicerConfig> = {
    sliceThreshold: 30,    // 30秒
    sliceLength: 10,       // 每片10秒
    overlapDuration: 0.1,  // 100ms重叠
  };
  
  /**
   * 构造函数
   */
  constructor(config: SlicerConfig = {}) {
    this.config = {
      ...AudioSlicer.DEFAULT_CONFIG,
      ...config,
    };
  }
  
  /**
   * 切片音频
   */
  async slice(
    source: string | Blob | AudioBuffer,
    sourceId?: string
  ): Promise<AudioSlice[]> {
    // 检查缓存
    if (sourceId && this.sliceCache.has(sourceId)) {
      console.log(`[AudioSlicer] 缓存命中: ${sourceId}`);
      return this.sliceCache.get(sourceId)!;
    }
    
    // 获取AudioBuffer
    const buffer = await this.getAudioBuffer(source);
    
    // 检查是否需要切片
    const duration = buffer.duration;
    if (duration <= this.config.sliceThreshold) {
      console.log(`[AudioSlicer] 音频时长 ${duration.toFixed(2)}s <= ${this.config.sliceThreshold}s, 无需切片`);
      
      // 返回完整音频作为单个切片
      const slice: AudioSlice = {
        index: 0,
        startTime: 0,
        endTime: duration,
        buffer,
      };
      
      const slices = [slice];
      
      if (sourceId) {
        this.sliceCache.set(sourceId, slices);
      }
      
      return slices;
    }
    
    // 计算切片数量
    const sliceCount = Math.ceil(duration / this.config.sliceLength);
    console.log(`[AudioSlicer] 音频时长 ${duration.toFixed(2)}s, 将切分为 ${sliceCount} 片`);
    
    // 生成切片
    const slices: AudioSlice[] = [];
    
    for (let i = 0; i < sliceCount; i++) {
      // 计算切片时间范围 (边界检查)
      const startTime = Math.max(
        0,
        i * this.config.sliceLength - (i > 0 ? this.config.overlapDuration : 0)
      );
      const endTime = Math.min(
        duration,
        (i + 1) * this.config.sliceLength + this.config.overlapDuration
      );
      
      // 提取切片
      const sliceBuffer = await this.extractSlice(buffer, startTime, endTime);
      
      const slice: AudioSlice = {
        index: i,
        startTime,
        endTime,
        buffer: sliceBuffer,
      };
      
      slices.push(slice);
      
      console.log(`[AudioSlicer] 切片 ${i}: ${startTime.toFixed(2)}s - ${endTime.toFixed(2)}s`);
    }
    
    // 缓存切片
    if (sourceId) {
      this.sliceCache.set(sourceId, slices);
    }
    
    return slices;
  }
  
  /**
   * 获取AudioBuffer
   */
  private async getAudioBuffer(source: string | Blob | AudioBuffer): Promise<AudioBuffer> {
    if (source instanceof AudioBuffer) {
      return source;
    }
    
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
    
    // 使用OfflineAudioContext解码
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    await audioContext.close();
    
    return audioBuffer;
  }
  
  /**
   * 提取音频切片
   */
  private async extractSlice(
    buffer: AudioBuffer,
    startTime: number,
    endTime: number
  ): Promise<AudioBuffer> {
    const sampleRate = buffer.sampleRate;
    const numberOfChannels = buffer.numberOfChannels;
    
    // 计算样本位置 (边界检查)
    const startSample = Math.max(0, Math.floor(startTime * sampleRate));
    const endSample = Math.min(buffer.length, Math.ceil(endTime * sampleRate));
    const sliceLength = endSample - startSample;
    
    if (sliceLength <= 0) {
      throw new Error(`无效的切片范围: ${startTime}s - ${endTime}s`);
    }
    
    // 创建OfflineAudioContext
    const offlineContext = new OfflineAudioContext(
      numberOfChannels,
      sliceLength,
      sampleRate
    );
    
    // 创建源节点
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    
    // 连接到输出
    source.connect(offlineContext.destination);
    
    // 设置播放范围
    source.start(0, startTime, endTime - startTime);
    
    // 渲染
    const sliceBuffer = await offlineContext.startRendering();
    
    return sliceBuffer;
  }
  
  /**
   * 获取指定时间点的切片索引
   */
  getSliceIndexAtTime(slices: AudioSlice[], time: number): number {
    for (let i = 0; i < slices.length; i++) {
      const slice = slices[i];
      if (time >= slice.startTime && time < slice.endTime) {
        return i;
      }
    }
    
    // 超出范围返回最后一个切片
    return slices.length - 1;
  }
  
  /**
   * 获取切片
   */
  getSlice(sourceId: string, index: number): AudioSlice | null {
    const slices = this.sliceCache.get(sourceId);
    if (!slices) {
      console.warn(`[AudioSlicer] 未找到缓存: ${sourceId}`);
      return null;
    }
    
    if (index < 0 || index >= slices.length) {
      console.warn(`[AudioSlicer] 切片索引越界: ${index}`);
      return null;
    }
    
    return slices[index];
  }
  
  /**
   * 移除缓存
   */
  removeCache(sourceId: string): boolean {
    return this.sliceCache.delete(sourceId);
  }
  
  /**
   * 清空缓存
   */
  clearCache(): void {
    this.sliceCache.clear();
    console.log('[AudioSlicer] 缓存已清空');
  }
  
  /**
   * 获取统计信息
   */
  getStats(): {
    cachedSourceCount: number;
    totalSliceCount: number;
    averageSliceCount: number;
  } {
    let totalSliceCount = 0;
    
    for (const slices of this.sliceCache.values()) {
      totalSliceCount += slices.length;
    }
    
    const cachedSourceCount = this.sliceCache.size;
    const averageSliceCount = cachedSourceCount > 0 
      ? totalSliceCount / cachedSourceCount 
      : 0;
    
    return {
      cachedSourceCount,
      totalSliceCount,
      averageSliceCount,
    };
  }
}
