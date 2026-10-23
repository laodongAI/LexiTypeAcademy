/**
 * TTS选项
 */
export interface TTSOptions {
  /** 文本内容 */
  text: string;
  /** 语音名称 */
  voice?: string;
  /** 语速 (0.5-2.0) */
  rate?: number;
  /** 音调 (0.5-2.0) */
  pitch?: number;
  /** 音量 (0.0-1.0) */
  volume?: number;
  /** 语言代码 (如: en-US, zh-CN) */
  lang?: string;
}

/**
 * TTS生成结果
 */
export interface TTSResult {
  /** 音频Blob */
  audioBlob: Blob;
  /** 音频时长(秒) */
  duration: number;
  /** 是否来自缓存 */
  fromCache: boolean;
  /** 使用的提供者 */
  provider: string;
}

/**
 * TTS提供者接口
 */
export interface ITTSProvider {
  /** 提供者名称 */
  readonly name: string;

  /**
   * 生成TTS音频
   * @param options TTS选项
   * @returns TTS结果
   */
  generate(options: TTSOptions): Promise<TTSResult>;

  /**
   * 检查提供者是否可用
   */
  isAvailable(): Promise<boolean>;

  /**
   * 初始化提供者（可选）
   */
  initialize?(): Promise<void>;

  /**
   * 清理资源（可选）
   */
  dispose?(): Promise<void>;
}

/**
 * TTS提供者类型
 */
export enum TTSProviderType {
  /** Sherpa-ONNX本地TTS */
  SHERPA_ONNX = 'sherpa-onnx',
  /** 系统TTS */
  SYSTEM = 'system',
  /** Edge TTS */
  EDGE = 'edge',
  /** HTTP API TTS */
  HTTP = 'http',
}
