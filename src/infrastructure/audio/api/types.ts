/**
 * TTS & ASR HTTP API 类型定义
 * 
 * 基于后端 API 文档 (Base URL: http://localhost:3000)
 * 
 * @version 2026-01-05
 */

// ===================== 通用类型 =====================

/**
 * API 错误响应
 */
export interface ApiErrorResponse {
  error: string;
  code?: string;
  retryAfter?: number;
}

/**
 * 健康检查响应
 */
export interface HealthResponse {
  status: 'ok' | 'error';
  tts: {
    loaded: boolean;
    model: string;
  };
  asr: {
    loaded: boolean;
    model: string;
  };
}

/**
 * 模型信息
 */
export interface ModelInfo {
  key: string;
  name: string;
  type: 'tts' | 'asr';
  streaming?: boolean;
}

/**
 * 模型列表响应
 */
export interface ModelsResponse {
  tts: {
    models: ModelInfo[];
    default: string;
    current: string;
  };
  asr: {
    models: ModelInfo[];
    default: string;
    current: string;
  };
}

// ===================== TTS 类型 =====================

/**
 * TTS 说话人信息
 */
export interface TTSSpeaker {
  sid: number;
  name: string;
  displayName: string;
  description: string;
}

/**
 * TTS 语音列表响应
 */
export interface TTSVoicesResponse {
  modelKey: string;
  modelName: string;
  numSpeakers: number;
  speakers: TTSSpeaker[];
  currentSpeaker: number;
}

/**
 * TTS 合成请求参数
 */
export interface TTSSynthesizeRequest {
  /** 要合成的文本 */
  text: string;
  /** 说话人ID (0 到 numSpeakers-1) */
  sid?: number;
  /** 语速 (0.5 ~ 2.0，默认 1.0) */
  speed?: number;
}

/**
 * TTS 切换模型请求
 */
export interface TTSSwitchModelRequest {
  model: string;
}

/**
 * TTS 切换模型响应
 */
export interface TTSSwitchModelResponse {
  success: boolean;
  key: string;
  name: string;
  numSpeakers: number;
  sampleRate: number;
  loaded: boolean;
  voice: number;
}

/**
 * TTS 异步任务创建响应
 */
export interface TTSAsyncResponse {
  taskId: string;
  status: 'pending';
  message: string;
}

// ===================== ASR 类型 =====================

/**
 * ASR 识别结果
 */
export interface ASRRecognizeResponse {
  /** 识别文本 */
  text: string;
  /** 原始模型输出 */
  rawText?: string;
  /** 是否启用了后处理 */
  postProcessed?: boolean;
  /** 分段结果 (长音频) */
  segments?: Array<{
    segment: number;
    text: string;
    duration: number;
  }>;
  /** 音频总时长 (秒) */
  duration: number;
  /** 识别耗时 (秒) */
  elapsed: number;
  /** 实时因子 */
  rtf: number;
  /** 性能信息 */
  performance?: {
    stages: Array<{ name: string; durationSec: number }>;
    bottlenecks?: Array<{ name: string; durationSec: number }>;
  };
}

/**
 * ASR VAD 分段识别结果
 */
export interface ASRVadRecognizeResponse {
  /** 完整识别文本 */
  text: string;
  /** 分段结果 */
  segments: Array<{
    index: number;
    start: number;
    end: number;
    duration: number;
    text: string;
  }>;
  /** 原始音频总时长 */
  duration: number;
  /** 总耗时 */
  elapsed: number;
  /** 实时因子 */
  rtf: number;
  /** 性能信息 */
  performance?: {
    vad: {
      segmentsFound: number;
      processingTime: number;
    };
    asr: {
      processingTime: number;
    };
    enhancement?: {
      enabled: boolean;
      processingTime: number;
      rtf: number;
    };
  };
  /** 未检测到语音时的消息 */
  message?: string;
}

/**
 * ASR 切换模型请求
 */
export interface ASRSwitchModelRequest {
  model: string;
}

/**
 * ASR 切换模型响应
 */
export interface ASRSwitchModelResponse {
  success: boolean;
  key: string;
  name: string;
  loaded: boolean;
}

/**
 * ASR 模型能力响应
 */
export interface ASRCapabilitiesResponse {
  modelKey: string;
  modelName: string;
  description: string;
  capabilities: {
    supportsEnhancement: boolean;
    supportsVad: boolean;
    recommendedForLongAudio: boolean;
    recommendedForNoisyAudio: boolean;
  };
  services: {
    vadAvailable: boolean;
    enhancementAvailable: boolean;
    streamingAvailable: boolean;
  };
  notes: string[];
  recommendations: {
    useVad: string;
    useEnhancement: string;
  };
}

/**
 * ASR 异步任务创建响应
 */
export interface ASRAsyncResponse {
  taskId: string;
  status: 'pending';
  message: string;
}

// ===================== 任务管理类型 =====================

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

/**
 * 任务类型
 */
export type TaskType = 'tts' | 'asr' | 'asr_vad' | 'enhance' | 'streaming';

/**
 * 任务详情响应
 */
export interface TaskResponse {
  id: string;
  type: TaskType;
  status: TaskStatus;
  progress: number;
  progressMessage: string;
  params?: Record<string, unknown>;
  result?: {
    audio?: ArrayBuffer;
    sampleRate?: number;
    duration?: number;
    text?: string;
    modelKey?: string;
  };
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  error?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * 任务列表响应
 */
export interface TaskListResponse {
  tasks: TaskResponse[];
  stats: {
    total: number;
    byStatus: Record<TaskStatus, number>;
    byType: Record<TaskType, number>;
    avgProcessingTime?: number;
  };
}

// ===================== 默认设置类型 =====================

/**
 * 默认设置响应
 */
export interface DefaultSettingsResponse {
  ttsModel: string;
  asrModel: string;
  streamingAsrModel: string;
  ttsVoice: number;
  ttsSpeed: number;
  availableTtsModels: string[];
  availableAsrModels: string[];
  availableStreamingAsrModels: string[];
}
