/**
 * 音频播放/录音服务类型定义
 * 
 * 包含:
 * 1. 播放控制接口
 * 2. 播放队列管理
 * 3. 录音控制接口
 * 4. 静音检测配置
 */

/**
 * 播放状态枚举
 */
export enum PlaybackState {
  IDLE = 'idle',           // 空闲
  LOADING = 'loading',     // 加载中
  PLAYING = 'playing',     // 播放中
  PAUSED = 'paused',       // 暂停
  STOPPED = 'stopped',     // 停止
  ERROR = 'error',         // 错误
}

/**
 * 录音状态枚举
 */
export enum RecordingState {
  IDLE = 'idle',           // 空闲
  RECORDING = 'recording', // 录音中
  PAUSED = 'paused',       // 暂停
  STOPPED = 'stopped',     // 停止
  ERROR = 'error',         // 错误
}

/**
 * 播放配置选项
 */
export interface PlaybackOptions {
  /** 音频源 (URL或AudioBuffer或Blob) */
  source: string | AudioBuffer | Blob;
  
  /** 播放速率 (0.5-2.0, 默认1.0) */
  playbackRate?: number;
  
  /** 音量 (0-1, 默认1.0) */
  volume?: number;
  
  /** 是否循环 */
  loop?: boolean;
  
  /** 开始位置 (秒) */
  startTime?: number;
  
  /** 是否启用静音检测 */
  enableSilenceDetection?: boolean;
  
  /** 静音阈值 (dB, 默认-60) */
  silenceThreshold?: number;
  
  /** 静音持续时间阈值 (秒, 默认0.5) */
  silenceDuration?: number;
  
  /** 是否自动跳过静音 */
  skipSilence?: boolean;
}

/**
 * 录音配置选项
 */
export interface RecordingOptions {
  /** 采样率 (Hz, 默认16000) */
  sampleRate?: number;
  
  /** 声道数 (1或2, 默认1) */
  channels?: number;
  
  /** 最大录音时长 (秒, 默认60) */
  maxDuration?: number;
  
  /** 是否启用降噪 */
  enableNoiseReduction?: boolean;
  
  /** 是否启用增益 */
  enableGain?: boolean;
  
  /** 增益值 (默认2.0) */
  gainValue?: number;
  
  /** 输出格式 */
  outputFormat?: 'wav' | 'webm' | 'mp3';
}

/**
 * 播放项
 */
export interface PlaybackItem {
  /** 唯一标识符 */
  id: string;
  
  /** 播放选项 */
  options: PlaybackOptions;
  
  /** 优先级 (数字越大优先级越高) */
  priority?: number;
  
  /** 元数据 */
  metadata?: {
    courseId?: string;
    sentenceId?: string;
    text?: string;
    [key: string]: any;
  };
}

/**
 * 播放进度信息
 */
export interface PlaybackProgress {
  /** 当前时间 (秒) */
  currentTime: number;
  
  /** 总时长 (秒) */
  duration: number;
  
  /** 播放进度 (0-1) */
  progress: number;
  
  /** 播放速率 */
  playbackRate: number;
}

/**
 * 静音检测结果
 */
export interface SilenceDetectionResult {
  /** 是否检测到静音 */
  isSilent: boolean;
  
  /** RMS能量值 (dB) */
  rmsDb: number;
  
  /** 静音持续时间 (秒) */
  silenceDuration: number;
}

/**
 * 音频切片
 */
export interface AudioSlice {
  /** 切片索引 */
  index: number;
  
  /** 开始时间 (秒) */
  startTime: number;
  
  /** 结束时间 (秒) */
  endTime: number;
  
  /** 音频数据 */
  buffer: AudioBuffer;
}

/**
 * 预加载项
 */
export interface PreloadItem {
  /** 唯一标识符 */
  id: string;
  
  /** 音频源 */
  source: string | Blob;
  
  /** 优先级 */
  priority: number;
  
  /** 是否已加载 */
  loaded: boolean;
  
  /** 音频缓冲区 */
  buffer?: AudioBuffer;
  
  /** 错误信息 */
  error?: Error;
}
