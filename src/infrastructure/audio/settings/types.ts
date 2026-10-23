/**
 * 音频设置配置类型定义
 * 
 * 职责:
 * - 定义TTS/ASR配置接口
 * - 定义设置存储接口
 * 
 * DDD分层: Infrastructure Layer - 配置类型定义
 * 
 * 版本: v0.1.0
 */

import { TTSProviderType } from '../tts/types';
import { ASRProviderType } from '../asr/types';

/**
 * TTS配置
 */
export interface TTSConfig {
  /** 默认提供者 */
  provider: TTSProviderType;
  
  /** Sherpa TTS 配置 */
  sherpa?: {
    /** 发音人ID */
    speakerId: number;
    /** 语速 (0.5-2.0) */
    speed: number;
  };
  
  /** System TTS 配置 */
  system?: {
    /** 语音名称 */
    voiceName: string;
    /** 语速 (0.5-2.0) */
    rate: number;
    /** 音调 (0.5-2.0) */
    pitch: number;
    /** 音量 (0.0-1.0) */
    volume: number;
  };
  
  /** Edge TTS 配置 */
  edge?: {
    /** 语音名称 */
    voiceName: string;
    /** 语速 */
    rate: string; // "+0%" 格式
    /** 音调 */
    pitch: string; // "+0Hz" 格式
  };
  
  /** HTTP API TTS 配置 */
  http?: {
    /** API 服务器地址 */
    baseUrl: string;
    /** 默认说话人 ID */
    speakerId: number;
    /** 语速 (0.5-2.0) */
    speed: number;
    /** 是否使用异步模式 */
    useAsync: boolean;
    /** 长文本阈值 (字符数) */
    longTextThreshold: number;
  };
}

/**
 * ASR配置
 */
export interface ASRConfig {
  /** 默认提供者 */
  provider: ASRProviderType;
  
  /** 默认语言 */
  language: string;
  
  /** 是否启用VAD */
  enableVAD: boolean;
  
  /** 是否启用音素对齐 */
  enableAlignment: boolean;
  
  /** Sherpa ASR 配置 */
  sherpa?: {
    /** 采样率 */
    sampleRate: number;
    /** 最大音频时长(秒) */
    maxDuration: number;
    /** 模型路径 (从public/sherpa/加载) */
    modelPath?: string;
  };
  
  /** HTTP API ASR 配置 */
  http?: {
    /** API 服务器地址 */
    baseUrl: string;
    /** 默认语言 */
    language: string;
    /** 是否自动启用音频增强 */
    autoEnhance: boolean;
    /** 是否使用异步模式 */
    useAsync: boolean;
    /** 长音频阈值 (秒) */
    longAudioThreshold: number;
  };
}

/**
 * 通用应用配置
 */
export interface GeneralConfig {
  /** 主题模式 */
  theme: 'light' | 'dark';
  
  /** 字体大小 (px) */
  fontSize: number;
  
  /** 字体系列 */
  fontFamily: 'system' | 'serif' | 'mono';
  
  /** 自动保存间隔 (秒, 0=禁用) */
  autoSaveInterval: number;
}

/**
 * 提示音配置
 */
export interface PromptSoundConfig {
  /** 是否启用 */
  enabled: boolean;
  
  /** 音量 (0-100) */
  volume: number;
}

/**
 * 完整的应用设置配置
 */
export interface AppSettings {
  /** 通用设置 */
  general: GeneralConfig;
  
  /** TTS设置 */
  tts: TTSConfig;
  
  /** ASR设置 */
  asr: ASRConfig;
  
  /** 提示音设置 */
  promptSound: PromptSoundConfig;
  
  /** 最后更新时间 */
  lastUpdated: number;
}

/**
 * 设置存储接口
 */
export interface ISettingsStorage {
  /**
   * 加载完整配置
   */
  load(): AppSettings;
  
  /**
   * 保存完整配置
   */
  save(settings: AppSettings): void;
  
  /**
   * 更新部分配置
   */
  update(partial: Partial<AppSettings>): void;
  
  /**
   * 重置为默认配置
   */
  reset(): void;
  
  /**
   * 获取默认配置
   */
  getDefaults(): AppSettings;
}

/**
 * 音频设置服务接口
 */
export interface IAudioSettingsService {
  /**
   * 获取当前TTS配置
   */
  getTTSConfig(): TTSConfig;
  
  /**
   * 更新TTS配置
   */
  updateTTSConfig(config: Partial<TTSConfig>): void;
  
  /**
   * 获取当前ASR配置
   */
  getASRConfig(): ASRConfig;
  
  /**
   * 更新ASR配置
   */
  updateASRConfig(config: Partial<ASRConfig>): void;
  
  /**
   * 获取通用配置
   */
  getGeneralConfig(): GeneralConfig;
  
  /**
   * 更新通用配置
   */
  updateGeneralConfig(config: Partial<GeneralConfig>): void;
  
  /**
   * 获取提示音配置
   */
  getPromptSoundConfig(): PromptSoundConfig;
  
  /**
   * 更新提示音配置
   */
  updatePromptSoundConfig(config: Partial<PromptSoundConfig>): void;
  
  /**
   * 重置所有配置
   */
  resetAll(): void;
  
  /**
   * 导出配置为JSON
   */
  exportConfig(): string;
  
  /**
   * 从JSON导入配置
   */
  importConfig(json: string): boolean;
}
