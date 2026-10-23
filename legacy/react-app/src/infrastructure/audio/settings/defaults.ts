/**
 * 默认配置常量
 * 
 * 职责:
 * - 定义所有设置的默认值
 * 
 * DDD分层: Infrastructure Layer - 配置常量
 * 
 * 版本: v0.1.0
 */

import { TTSProviderType } from '../tts/types';
import { ASRProviderType } from '../asr/types';
import type { AppSettings } from './types';
import { DEFAULT_SHERPA_ASR_MODEL } from './sherpaModels';

/**
 * 默认应用设置
 */
export const DEFAULT_SETTINGS: AppSettings = {
  // 通用设置
  general: {
    theme: 'light',
    fontSize: 16,
    fontFamily: 'system',
    autoSaveInterval: 30  // 30秒自动保存
  },
  
  // TTS设置 - 默认使用 HTTP API
  tts: {
    provider: TTSProviderType.HTTP,
    sherpa: {
      speakerId: 0, // 默认第一个发音人
      speed: 1.0    // 正常语速
    },
    system: {
      voiceName: '', // 将使用系统默认语音
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    },
    edge: {
      voiceName: 'zh-CN-XiaoxiaoNeural',
      rate: '+0%',
      pitch: '+0Hz'
    },
    http: {
      baseUrl: 'http://localhost:3000',
      speakerId: 0,
      speed: 1.0,
      useAsync: false,
      longTextThreshold: 500
    }
  },
  
  // ASR设置 - 默认使用 HTTP API
  asr: {
    provider: ASRProviderType.API,
    language: 'en-US',
    enableVAD: true,
    enableAlignment: true,
    sherpa: {
      sampleRate: 16000,
      maxDuration: 60,
      modelPath: DEFAULT_SHERPA_ASR_MODEL.modelPath // 默认推荐模型
    },
    http: {
      baseUrl: 'http://localhost:3000',
      language: 'en-US',
      autoEnhance: false,
      useAsync: false,
      longAudioThreshold: 60
    }
  },
  
  // 提示音设置
  promptSound: {
    enabled: true,
    volume: 50
  },
  
  // 时间戳
  lastUpdated: Date.now()
};

/**
 * LocalStorage键名常量
 */
export const STORAGE_KEYS = {
  // 完整配置键
  FULL_CONFIG: 'lexitype_settings_v1',
  
  // 分区配置键(备用)
  GENERAL: 'lexitype_general',
  TTS: 'lexitype_tts',
  ASR: 'lexitype_asr',
  PROMPT_SOUND: 'lexitype_prompt_sound'
} as const;

/**
 * Sherpa TTS可用的发音人列表
 */
export const SHERPA_TTS_SPEAKERS = [
  { id: 0, name: '发音人1 (默认)', language: 'en-US' },
  { id: 1, name: '发音人2', language: 'en-US' },
  { id: 2, name: '发音人3', language: 'zh-CN' }
];

/**
 * 字体系列映射
 */
export const FONT_FAMILIES = {
  system: {
    name: '系统默认',
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  },
  serif: {
    name: '衬线字体',
    value: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif'
  },
  mono: {
    name: '等宽字体',
    value: '"Courier New", Consolas, "Monaco", monospace'
  }
} as const;
