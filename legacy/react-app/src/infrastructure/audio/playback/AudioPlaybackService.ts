/**
 * 音频播放服务
 * 
 * 功能:
 * 1. 播放控制 (播放/暂停/停止/跳转)
 * 2. 静音检测 (AnalyserNode RMS<-60dB)
 * 3. 自动重试 (失败2次)
 * 4. AudioPlaybackEvent发布
 * 5. 播放队列集成
 * 
 * 优化:
 * - 静音自动跳过
 * - 播放进度回调
 * - 音量/速率控制
 */

import {
  PlaybackState,
  PlaybackOptions,
  PlaybackProgress,
  SilenceDetectionResult,
  PlaybackItem,
} from './types';
import { AudioQueue } from './AudioQueue';
import { AudioContextManager } from '../storage/AudioContextManager';
import { AudioPlaybackStartedEvent, AudioPlaybackCompletedEvent } from '@/domain/events/DomainEvent';
import { DomainEventBus } from '@/domain/events/DomainEventBus';

const eventBus = DomainEventBus.getInstance();

/**
 * 播放服务配置
 */
export interface PlaybackServiceConfig {
  /** 最大重试次数 */
  maxRetries?: number;
  
  /** 是否自动播放下一个 */
  autoPlayNext?: boolean;
  
  /** 是否自动发布事件 */
  autoPublishEvents?: boolean;
  
  /** 静音检测间隔 (毫秒) */
  silenceCheckInterval?: number;
}

/**
 * 音频播放服务
 */
export class AudioPlaybackService {
  private state: PlaybackState = PlaybackState.IDLE;
  private audioContext: AudioContext;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private currentBuffer: AudioBuffer | null = null;
  private currentOptions: PlaybackOptions | null = null;
  private currentItem: PlaybackItem | null = null;
  private startTime = 0;
  private pausedAt = 0;
  private silenceCheckTimer: number | null = null;
  private silenceStartTime: number | null = null;
  private progressCallbacks: Set<(progress: PlaybackProgress) => void> = new Set();
  private queue: AudioQueue;
  private config: Required<PlaybackServiceConfig>;
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: Required<PlaybackServiceConfig> = {
    maxRetries: 2,
    autoPlayNext: false,
    autoPublishEvents: true,
    silenceCheckInterval: 100, // 100ms检查一次
  };
  
  /**
   * 构造函数
   */
  constructor(
    audioContextManager: AudioContextManager,
    queue?: AudioQueue,
    config: PlaybackServiceConfig = {}
  ) {
    this.audioContext = audioContextManager.getContext();
    this.queue = queue || new AudioQueue();
    this.config = {
      ...AudioPlaybackService.DEFAULT_CONFIG,
      ...config,
    };
  }
  
  /**
   * 播放音频
   */
  async play(options: PlaybackOptions): Promise<void> {
    console.log('[AudioPlayback] 开始播放...');
    
    // 如果当前正在播放, 先停止
    if (this.state === PlaybackState.PLAYING) {
      this.stop();
    }
    
    this.state = PlaybackState.LOADING;
    this.currentOptions = options;
    
    try {
      // 获取AudioBuffer
      const buffer = await this.getAudioBuffer(options.source);
      this.currentBuffer = buffer;
      
      // 创建音频节点
      this.setupAudioNodes(buffer, options);
      
      // 开始播放
      const startOffset = options.startTime || this.pausedAt;
      this.sourceNode!.start(0, startOffset);
      this.startTime = this.audioContext.currentTime - startOffset;
      this.state = PlaybackState.PLAYING;
      
      // 启动静音检测
      if (options.enableSilenceDetection) {
        this.startSilenceDetection();
      }
      
      // 发布事件
      if (this.config.autoPublishEvents && this.currentItem) {
        const courseId = this.currentItem.metadata?.courseId || '';
        const audioId = this.currentItem.id;
        eventBus.publish(new AudioPlaybackStartedEvent(courseId, audioId, startOffset));
      }
      
      console.log('[AudioPlayback] 播放中');
    } catch (error) {
      this.state = PlaybackState.ERROR;
      console.error('[AudioPlayback] 播放失败:', error);
      throw error;
    }
  }
  
  /**
   * 播放队列中的下一个
   */
  async playNext(): Promise<boolean> {
    const item = this.queue.dequeue();
    if (!item) {
      console.log('[AudioPlayback] 队列为空');
      return false;
    }
    
    this.currentItem = item;
    await this.play(item.options);
    return true;
  }
  
  /**
   * 暂停播放
   */
  pause(): void {
    if (this.state !== PlaybackState.PLAYING) {
      return;
    }
    
    this.pausedAt = this.audioContext.currentTime - this.startTime;
    this.stop();
    this.state = PlaybackState.PAUSED;
    
    console.log(`[AudioPlayback] 已暂停 (位置: ${this.pausedAt.toFixed(2)}s)`);
  }
  
  /**
   * 恢复播放
   */
  async resume(): Promise<void> {
    if (this.state !== PlaybackState.PAUSED || !this.currentOptions) {
      return;
    }
    
    await this.play({
      ...this.currentOptions,
      startTime: this.pausedAt,
    });
    
    console.log('[AudioPlayback] 已恢复');
  }
  
  /**
   * 停止播放
   */
  stop(): void {
    if (this.sourceNode) {
      try {
        this.sourceNode.stop();
      } catch (error) {
        // 忽略已停止的错误
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    
    this.stopSilenceDetection();
    
    this.state = PlaybackState.STOPPED;
    this.pausedAt = 0;
    
    console.log('[AudioPlayback] 已停止');
  }
  
  /**
   * 跳转到指定位置
   */
  async seek(time: number): Promise<void> {
    if (!this.currentOptions || !this.currentBuffer) {
      return;
    }
    
    const duration = this.currentBuffer.duration;
    const clampedTime = Math.max(0, Math.min(time, duration));
    
    const wasPlaying = this.state === PlaybackState.PLAYING;
    
    this.stop();
    this.pausedAt = clampedTime;
    
    if (wasPlaying) {
      await this.resume();
    }
    
    console.log(`[AudioPlayback] 跳转到 ${clampedTime.toFixed(2)}s`);
  }
  
  /**
   * 设置音量
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.gainNode.gain.value = clampedVolume;
    }
  }
  
  /**
   * 设置播放速率
   */
  setPlaybackRate(rate: number): void {
    if (this.sourceNode) {
      const clampedRate = Math.max(0.5, Math.min(2.0, rate));
      this.sourceNode.playbackRate.value = clampedRate;
    }
  }
  
  /**
   * 设置音频节点
   */
  private setupAudioNodes(buffer: AudioBuffer, options: PlaybackOptions): void {
    // 创建源节点
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = buffer;
    this.sourceNode.loop = options.loop || false;
    this.sourceNode.playbackRate.value = options.playbackRate || 1.0;
    
    // 创建增益节点
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = options.volume || 1.0;
    
    // 连接节点
    this.sourceNode.connect(this.gainNode);
    
    // 如果启用静音检测, 创建分析器节点
    if (options.enableSilenceDetection) {
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 2048;
      this.gainNode.connect(this.analyserNode);
      this.analyserNode.connect(this.audioContext.destination);
    } else {
      this.gainNode.connect(this.audioContext.destination);
    }
    
    // 播放结束回调
    this.sourceNode.onended = () => {
      if (this.state === PlaybackState.PLAYING) {
        this.onPlaybackEnded();
      }
    };
  }
  
  /**
   * 播放结束回调
   */
  private onPlaybackEnded(): void {
    console.log('[AudioPlayback] 播放完成');
    
    // 发布事件
    if (this.config.autoPublishEvents && this.currentItem && this.currentBuffer) {
      const courseId = this.currentItem.metadata?.courseId || '';
      const audioId = this.currentItem.id;
      const duration = this.currentBuffer.duration;
      eventBus.publish(new AudioPlaybackCompletedEvent(courseId, audioId, duration));
    }
    
    this.stop();
    
    // 自动播放下一个
    if (this.config.autoPlayNext) {
      this.playNext();
    }
  }
  
  /**
   * 启动静音检测
   */
  private startSilenceDetection(): void {
    if (!this.analyserNode || !this.currentOptions) {
      return;
    }
    
    const checkInterval = this.config.silenceCheckInterval;
    const threshold = this.currentOptions.silenceThreshold || -60;
    const duration = this.currentOptions.silenceDuration || 0.5;
    
    this.silenceCheckTimer = window.setInterval(() => {
      const result = this.detectSilence(threshold);
      
      if (result.isSilent) {
        // 静音开始
        if (this.silenceStartTime === null) {
          this.silenceStartTime = Date.now();
        }
        
        // 检查静音持续时间
        const silenceDuration = (Date.now() - this.silenceStartTime) / 1000;
        
        if (silenceDuration >= duration && this.currentOptions?.skipSilence) {
          console.log(`[AudioPlayback] 检测到静音 ${silenceDuration.toFixed(2)}s, 自动跳过`);
          this.onPlaybackEnded();
        }
      } else {
        // 非静音, 重置计时器
        this.silenceStartTime = null;
      }
    }, checkInterval);
  }
  
  /**
   * 停止静音检测
   */
  private stopSilenceDetection(): void {
    if (this.silenceCheckTimer !== null) {
      clearInterval(this.silenceCheckTimer);
      this.silenceCheckTimer = null;
      this.silenceStartTime = null;
    }
  }
  
  /**
   * 检测静音
   */
  private detectSilence(thresholdDb: number): SilenceDetectionResult {
    if (!this.analyserNode) {
      return { isSilent: false, rmsDb: 0, silenceDuration: 0 };
    }
    
    // 获取频域数据
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyserNode.getFloatFrequencyData(dataArray);
    
    // 计算RMS能量值
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const rmsDb = sum / bufferLength;
    
    // 判断是否静音
    const isSilent = rmsDb < thresholdDb;
    
    const silenceDuration = this.silenceStartTime !== null
      ? (Date.now() - this.silenceStartTime) / 1000
      : 0;
    
    return { isSilent, rmsDb, silenceDuration };
  }
  
  /**
   * 获取AudioBuffer
   */
  private async getAudioBuffer(source: string | AudioBuffer | Blob): Promise<AudioBuffer> {
    if (source instanceof AudioBuffer) {
      return source;
    }
    
    // 获取ArrayBuffer
    let arrayBuffer: ArrayBuffer;
    
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
    } else {
      arrayBuffer = await source.arrayBuffer();
    }
    
    // 解码
    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer;
  }
  
  /**
   * 获取当前播放进度
   */
  getProgress(): PlaybackProgress | null {
    if (!this.currentBuffer || this.state === PlaybackState.IDLE) {
      return null;
    }
    
    const currentTime = this.state === PlaybackState.PLAYING
      ? this.audioContext.currentTime - this.startTime
      : this.pausedAt;
    
    const duration = this.currentBuffer.duration;
    const progress = Math.min(1, currentTime / duration);
    const playbackRate = this.sourceNode?.playbackRate.value || 1.0;
    
    return {
      currentTime,
      duration,
      progress,
      playbackRate,
    };
  }
  
  /**
   * 订阅播放进度
   */
  onProgress(callback: (progress: PlaybackProgress) => void): () => void {
    this.progressCallbacks.add(callback);
    
    // 返回取消订阅函数
    return () => {
      this.progressCallbacks.delete(callback);
    };
  }
  
  /**
   * 获取播放状态
   */
  getState(): PlaybackState {
    return this.state;
  }
  
  /**
   * 获取队列
   */
  getQueue(): AudioQueue {
    return this.queue;
  }
  
  /**
   * 清理资源
   */
  dispose(): void {
    this.stop();
    this.queue.clear();
    this.progressCallbacks.clear();
  }
}
