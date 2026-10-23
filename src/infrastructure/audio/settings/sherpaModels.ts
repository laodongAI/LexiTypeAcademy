/**
 * Sherpa 模型配置
 * 集中管理所有 ASR/TTS/VAD 模型元数据
 * 
 * @author GitHub Copilot
 * @date 2024
 */

/**
 * Sherpa ASR 模型预设
 */
export interface SherpaAsrModelPreset {
  /** 模型唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** public 目录下的子路径 */
  modelPath: string;
  /** 适配语言 */
  language: 'en' | 'zh' | 'multi';
  /** 模型描述 */
  description: string;
  /** 是否为推荐模型 */
  recommended?: boolean;
}

/**
 * Sherpa TTS 模型预设
 */
export interface SherpaTtsModelPreset {
  /** 模型唯一标识 */
  id: string;
  /** 显示标签 */
  label: string;
  /** public 目录下的子路径 */
  modelPath: string;
  /** 模型描述 */
  description: string;
  /** 默认说话人ID */
  defaultSpeakerId: number;
}

/**
 * ASR 模型列表
 * 从 public/sherpa/ 目录扫描得出
 * 注意: modelPath 为相对路径(相对于 sherpaModelsDir),运行时由 PathManager 解析
 */
export const SHERPA_ASR_MODELS: SherpaAsrModelPreset[] = [
  {
    id: 'zipformer',
    label: 'Zipformer (GigaSpeech, EN)',
    modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech',
    language: 'en',
    description: '质量和速度平衡的 Zipformer 英文模型，适合大多数练习场景。',
    recommended: true,
  },
  {
    id: 'moonshine_tiny',
    label: 'Moonshine Tiny (EN)',
    modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-moonshine_tiny',
    language: 'en',
    description: '体积极小的 Moonshine Tiny，启动更快，适合资源紧张设备。',
  },
  {
    id: 'whisper_tiny',
    label: 'Whisper Tiny (EN)',
    modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-whisper_tiny',
    language: 'en',
    description: 'Whisper Tiny 版本，字幕需求场景下的稳健选择。',
  },
];

/**
 * 默认 ASR 模型（推荐模型）
 */
export const DEFAULT_SHERPA_ASR_MODEL =
  SHERPA_ASR_MODELS.find((m) => m.recommended) || SHERPA_ASR_MODELS[0];

/**
 * TTS 模型列表
 * 注意: modelPath 为相对路径(相对于 sherpaModelsDir),运行时由 PathManager 解析
 */
export const SHERPA_TTS_MODELS: SherpaTtsModelPreset[] = [
  {
    id: 'en_tts_v1_12_18',
    label: 'Sherpa Offline TTS (EN)',
    modelPath: 'sherpa-onnx-wasm-simd-v1.12.18-en-tts',
    description: '官方 en-tts 离线模型，内置多个英语音色。',
    defaultSpeakerId: 0,
  },
];

/**
 * 默认 TTS 模型
 */
export const DEFAULT_SHERPA_TTS_MODEL = SHERPA_TTS_MODELS[0];

/**
 * VAD 模型路径（用于语音活动检测）
 * 注意: 相对路径(相对于 sherpaModelsDir),运行时由 PathManager 解析
 */
export const SHERPA_VAD_MODEL_PATH = 'sherpa-onnx-wasm-simd-v1.12.18-vad';

/**
 * 根据路径查找 ASR 模型
 * @param path 模型路径
 * @returns 匹配的模型预设，未找到则返回 undefined
 */
export function getSherpaAsrModelByPath(
  path?: string
): SherpaAsrModelPreset | undefined {
  if (!path) return undefined;
  return SHERPA_ASR_MODELS.find(
    (m) => normalizePath(m.modelPath) === normalizePath(path)
  );
}

/**
 * 根据路径查找 TTS 模型
 * @param path 模型路径
 * @returns 匹配的模型预设，未找到则返回 undefined
 */
export function getSherpaTtsModelByPath(
  path?: string
): SherpaTtsModelPreset | undefined {
  if (!path) return undefined;
  return SHERPA_TTS_MODELS.find(
    (m) => normalizePath(m.modelPath) === normalizePath(path)
  );
}

/**
 * 路径标准化（统一斜杠方向、去重复、去尾部斜杠）
 * @param path 原始路径
 * @returns 标准化后的路径
 */
export function normalizePath(path?: string): string {
  if (!path) return '';
  let normalized = path.replace(/\\+/g, '/');
  normalized = normalized.replace(/\/+/g, '/');
  normalized = normalized.replace(/\/+$/, '');
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  return normalized;
}
