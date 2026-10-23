/**
 * ASR (Automatic Speech Recognition) 服务类型定义
 * 
 * 支持两种ASR提供者:
 * 1. SherpaOnnx: 本地WASM ASR引擎 (离线, VAD+ASR, 音素级对齐)
 * 2. API: 远程ASR服务 (在线, 任务队列, 重试机制)
 */

import type { AudioFile } from '@/infrastructure/audio/storage/types';

/**
 * ASR提供者类型枚举
 */
export enum ASRProviderType {
  SHERPA_ONNX = 'sherpa-onnx',  // 本地WASM ASR引擎
  API = 'api',                   // 远程API服务
}

/**
 * ASR配置选项
 */
export interface ASROptions {
  /** 音频数据 (AudioBuffer或Blob) */
  audio: AudioBuffer | Blob;
  
  /** 目标语言代码 (例如: 'en-US', 'zh-CN') */
  language: string;
  
  /** 是否启用VAD (Voice Activity Detection) */
  enableVAD?: boolean;
  
  /** 是否返回音素级对齐信息 */
  enableAlignment?: boolean;
  
  /** 采样率 (默认: 16000Hz) */
  sampleRate?: number;
  
  /** 最大音频时长 (秒, 默认: 60s) */
  maxDuration?: number;
}

/**
 * 音素级对齐信息
 */
export interface PhonemeAlignment {
  /** 音素符号 */
  phoneme: string;
  
  /** 开始时间 (秒) */
  startTime: number;
  
  /** 结束时间 (秒) */
  endTime: number;
  
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * 单词级对齐信息
 */
export interface WordAlignment {
  /** 单词文本 */
  word: string;
  
  /** 开始时间 (秒) */
  startTime: number;
  
  /** 结束时间 (秒) */
  endTime: number;
  
  /** 音素列表 */
  phonemes: PhonemeAlignment[];
  
  /** 置信度 (0-1) */
  confidence: number;
}

/**
 * ASR识别结果
 */
export interface ASRResult {
  /** 识别文本 */
  text: string;
  
  /** 音频时长 (秒) */
  duration: number;
  
  /** 整体置信度 (0-1) */
  confidence: number;
  
  /** 使用的提供者类型 */
  provider: ASRProviderType;
  
  /** 单词级对齐信息 (如果启用) */
  alignments?: WordAlignment[];
  
  /** VAD检测的语音段 (如果启用) */
  voiceSegments?: Array<{ start: number; end: number }>;
  
  /** 处理时间 (毫秒) */
  processingTime: number;
}

/**
 * ASR提供者接口
 * 
 * 所有ASR提供者必须实现此接口
 */
export interface IASRProvider {
  /** 提供者类型 */
  readonly type: ASRProviderType;
  
  /**
   * 识别音频内容
   * @param options - ASR配置选项
   * @returns 识别结果
   */
  recognize(options: ASROptions): Promise<ASRResult>;
  
  /**
   * 检查提供者是否可用
   * @returns true if available
   */
  isAvailable(): Promise<boolean>;
  
  /**
   * 初始化提供者 (加载模型, 建立连接等)
   */
  initialize?(): Promise<void>;
  
  /**
   * 清理资源
   */
  dispose?(): Promise<void>;
}

/**
 * 学生录音记录
 */
export interface StudentRecording {
  /** 唯一标识符 */
  id: string;
  
  /** 课程ID */
  courseId: string;
  
  /** 句子ID */
  sentenceId: string;
  
  /** 音频文件 */
  audioFile: AudioFile;
  
  /** ASR识别结果 */
  asrResult?: ASRResult;
  
  /** 录音时间戳 */
  recordedAt: number;
  
  /** 会话ID (用于批量清理) */
  sessionId: string;
}
