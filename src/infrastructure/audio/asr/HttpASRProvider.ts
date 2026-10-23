/**
 * HTTP API ASR Provider
 * 
 * 通过 HTTP API 调用后端 ASR 服务进行语音识别
 * 
 * @version 2026-01-05
 */

import { ASRProviderType, type ASROptions, type ASRResult, type IASRProvider, type WordAlignment, type PhonemeAlignment } from './types';
import { AudioApiClient, ApiError, getAudioApiClient } from '../api';
import type { ASRRecognizeResponse, ASRVadRecognizeResponse, ASRCapabilitiesResponse } from '../api';

/**
 * HTTP ASR Provider 配置
 */
export interface HttpASRProviderConfig {
  /** API 客户端实例 (可选，默认使用单例) */
  client?: AudioApiClient;
  /** 是否自动启用音频增强 */
  autoEnhance?: boolean;
  /** 是否使用异步模式 (长音频推荐) */
  useAsync?: boolean;
  /** 异步模式轮询间隔(ms) */
  asyncPollingInterval?: number;
  /** 长音频阈值(秒)，超过则自动使用异步模式 */
  longAudioThreshold?: number;
  /** 默认语言 */
  defaultLanguage?: string;
}

/**
 * HTTP API ASR Provider
 * 
 * 实现 IASRProvider 接口，通过 HTTP API 调用后端服务
 */
export class HttpASRProvider implements IASRProvider {
  readonly type = ASRProviderType.API;

  private readonly client: AudioApiClient;
  private readonly config: Required<Omit<HttpASRProviderConfig, 'client'>>;

  private capabilities: ASRCapabilitiesResponse | null = null;
  private initialized = false;

  constructor(config: HttpASRProviderConfig = {}) {
    this.client = config.client || getAudioApiClient();
    this.config = {
      autoEnhance: config.autoEnhance ?? false,
      useAsync: config.useAsync ?? false,
      asyncPollingInterval: config.asyncPollingInterval ?? 500,
      longAudioThreshold: config.longAudioThreshold ?? 60,
      defaultLanguage: config.defaultLanguage ?? 'zh-CN',
    };
  }

  /**
   * 初始化 Provider，加载能力信息
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      this.capabilities = await this.client.getASRCapabilities();
      this.initialized = true;
      console.log('[HttpASRProvider] 初始化成功，模型:', this.capabilities.modelKey);
      console.log('[HttpASRProvider] 能力:', this.capabilities.capabilities);
    } catch (error) {
      console.error('[HttpASRProvider] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.client.checkHealth();
      return health.status === 'ok' && health.asr.loaded;
    } catch (error) {
      console.warn('[HttpASRProvider] 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 语音识别
   */
  async recognize(options: ASROptions): Promise<ASRResult> {
    const startTime = Date.now();

    // 将音频转换为 Blob
    const audioBlob = await this.convertToBlob(options.audio, options.sampleRate);

    // 估算音频时长
    const estimatedDuration = await this.estimateAudioDuration(audioBlob, options.sampleRate);

    // 判断是否使用异步模式
    const useAsync = this.config.useAsync || 
      (estimatedDuration > this.config.longAudioThreshold);

    // 是否启用音频增强
    const enhance = this.config.autoEnhance;

    // 是否启用 VAD
    const useVAD = options.enableVAD ?? false;

    try {
      let apiResult: ASRRecognizeResponse | ASRVadRecognizeResponse;

      if (useAsync) {
        apiResult = await this.recognizeAsync(audioBlob, options.language, enhance);
      } else if (useVAD) {
        apiResult = await this.recognizeWithVAD(audioBlob, enhance);
      } else {
        apiResult = await this.recognizeSync(audioBlob, options.language, enhance);
      }

      // 转换为统一结果格式
      const result = this.convertToASRResult(apiResult, startTime, useVAD);

      console.log(
        `[HttpASRProvider] 识别完成: "${result.text.substring(0, 50)}${result.text.length > 50 ? '...' : ''}"`,
        `耗时: ${result.processingTime}ms`,
        `模式: ${useAsync ? '异步' : useVAD ? 'VAD' : '同步'}`
      );

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('[HttpASRProvider] API 错误:', error.message, error.status);
        throw new Error(`ASR 服务错误 (${error.status}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 同步识别
   */
  private async recognizeSync(
    audio: Blob,
    language?: string,
    enhance?: boolean
  ): Promise<ASRRecognizeResponse> {
    return this.client.recognize(audio, {
      language: language || this.config.defaultLanguage,
      enhance,
    });
  }

  /**
   * 带 VAD 的识别
   */
  private async recognizeWithVAD(
    audio: Blob,
    enhance?: boolean
  ): Promise<ASRVadRecognizeResponse> {
    return this.client.recognizeWithVad(audio, { enhance });
  }

  /**
   * 异步识别 (任务模式)
   */
  private async recognizeAsync(
    audio: Blob,
    language?: string,
    enhance?: boolean
  ): Promise<ASRRecognizeResponse> {
    // 创建异步任务
    const asyncResponse = await this.client.recognizeAsync(audio, {
      language: language || this.config.defaultLanguage,
      enhance,
    });

    // 等待任务完成
    const task = await this.client.waitForTask(asyncResponse.taskId, {
      pollingInterval: this.config.asyncPollingInterval,
      onProgress: (t) => {
        console.log(`[HttpASRProvider] 任务进度: ${t.progress}% - ${t.progressMessage}`);
      },
    });

    if (task.status === 'failed') {
      throw new Error(`ASR 任务失败: ${task.error || '未知错误'}`);
    }

    if (task.status === 'cancelled') {
      throw new Error('ASR 任务已取消');
    }

    // 从任务结果构建响应
    return {
      text: task.result?.text || '',
      duration: task.result?.duration || 0,
      elapsed: (task.completedAt! - task.startedAt!) / 1000,
      rtf: 0,
    };
  }

  /**
   * 将 AudioBuffer 或 Blob 转换为 Blob
   */
  private async convertToBlob(
    audio: AudioBuffer | Blob,
    sampleRate: number = 16000
  ): Promise<Blob> {
    if (audio instanceof Blob) {
      return audio;
    }

    // AudioBuffer 转换为 WAV Blob
    return this.audioBufferToWav(audio, sampleRate);
  }

  /**
   * AudioBuffer 转换为 WAV Blob
   */
  private audioBufferToWav(audioBuffer: AudioBuffer, targetSampleRate: number): Blob {
    // 获取单声道数据
    const channelData = audioBuffer.getChannelData(0);
    
    // 如果需要重采样
    let samples: Float32Array;
    if (audioBuffer.sampleRate !== targetSampleRate) {
      samples = this.resample(channelData, audioBuffer.sampleRate, targetSampleRate);
    } else {
      // 复制到新的 Float32Array 以确保类型兼容
      samples = new Float32Array(channelData);
    }

    // 创建 WAV 文件
    const wavBuffer = this.encodeWAV(samples, targetSampleRate);
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  /**
   * 简单重采样
   */
  private resample(
    samples: Float32Array,
    fromSampleRate: number,
    toSampleRate: number
  ): Float32Array {
    const ratio = fromSampleRate / toSampleRate;
    const newLength = Math.floor(samples.length / ratio);
    const result = new Float32Array(newLength);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i * ratio;
      const srcIndexFloor = Math.floor(srcIndex);
      const srcIndexCeil = Math.min(srcIndexFloor + 1, samples.length - 1);
      const t = srcIndex - srcIndexFloor;
      result[i] = samples[srcIndexFloor] * (1 - t) + samples[srcIndexCeil] * t;
    }

    return result;
  }

  /**
   * 编码 WAV 文件
   */
  private encodeWAV(samples: Float32Array, sampleRate: number): ArrayBuffer {
    const buffer = new ArrayBuffer(44 + samples.length * 2);
    const view = new DataView(buffer);

    // WAV 头
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + samples.length * 2, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (PCM)
    view.setUint16(22, 1, true); // num channels
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true); // byte rate
    view.setUint16(32, 2, true); // block align
    view.setUint16(34, 16, true); // bits per sample
    this.writeString(view, 36, 'data');
    view.setUint32(40, samples.length * 2, true);

    // 音频数据
    const offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }

    return buffer;
  }

  /**
   * 写入字符串到 DataView
   */
  private writeString(view: DataView, offset: number, str: string): void {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  /**
   * 估算音频时长
   */
  private async estimateAudioDuration(
    audio: Blob,
    sampleRate: number = 16000
  ): Promise<number> {
    // 尝试从 WAV 头解析
    try {
      const headerBuffer = await audio.slice(0, 44).arrayBuffer();
      const view = new DataView(headerBuffer);
      
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );

      if (riff === 'RIFF') {
        const wavSampleRate = view.getUint32(24, true);
        const bitsPerSample = view.getUint16(34, true);
        const numChannels = view.getUint16(22, true);
        const dataSize = audio.size - 44;

        const bytesPerSample = (bitsPerSample / 8) * numChannels;
        return dataSize / (wavSampleRate * bytesPerSample);
      }
    } catch {
      // 忽略解析错误
    }

    // 按 16-bit mono 估算
    return (audio.size - 44) / (sampleRate * 2);
  }

  /**
   * 转换 API 响应为统一的 ASRResult 格式
   */
  private convertToASRResult(
    apiResult: ASRRecognizeResponse | ASRVadRecognizeResponse,
    startTime: number,
    isVadResult: boolean
  ): ASRResult {
    const processingTime = Date.now() - startTime;

    // 基础结果
    const result: ASRResult = {
      text: apiResult.text,
      duration: apiResult.duration,
      confidence: 1.0, // API 暂不返回置信度，默认为 1.0
      provider: ASRProviderType.API,
      processingTime,
    };

    // VAD 结果包含分段信息
    if (isVadResult && 'segments' in apiResult) {
      const vadResult = apiResult as ASRVadRecognizeResponse;
      
      // 转换分段信息为语音段
      result.voiceSegments = vadResult.segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
      }));

      // 如果有分段，可以生成伪对齐信息
      if (vadResult.segments.length > 0) {
        result.alignments = this.convertSegmentsToAlignments(vadResult.segments);
      }
    }

    return result;
  }

  /**
   * 将 VAD 分段转换为对齐信息
   * 
   * 注意: 这是近似值，真正的对齐需要模型支持
   */
  private convertSegmentsToAlignments(
    segments: Array<{ index: number; start: number; end: number; duration: number; text: string }>
  ): WordAlignment[] {
    const alignments: WordAlignment[] = [];

    for (const segment of segments) {
      // 将文本分词（简单按空格和标点分）
      const words = segment.text.split(/[\s,，.。!！?？;；:：]+/).filter(Boolean);
      
      if (words.length === 0) continue;

      const wordDuration = segment.duration / words.length;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const startTime = segment.start + i * wordDuration;
        const endTime = startTime + wordDuration;

        // 生成伪音素信息（每个字符一个音素）
        const phonemes: PhonemeAlignment[] = [];
        const charDuration = wordDuration / word.length;
        
        for (let j = 0; j < word.length; j++) {
          phonemes.push({
            phoneme: word[j],
            startTime: startTime + j * charDuration,
            endTime: startTime + (j + 1) * charDuration,
            confidence: 0.8, // 估计值
          });
        }

        alignments.push({
          word,
          startTime,
          endTime,
          phonemes,
          confidence: 0.8, // 估计值
        });
      }
    }

    return alignments;
  }

  /**
   * 获取 ASR 能力信息
   */
  async getCapabilities(): Promise<ASRCapabilitiesResponse | null> {
    if (!this.capabilities) {
      try {
        this.capabilities = await this.client.getASRCapabilities();
      } catch (error) {
        console.warn('[HttpASRProvider] 获取能力信息失败:', error);
      }
    }
    return this.capabilities;
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.capabilities = null;
    this.initialized = false;
  }
}
