/**
 * HTTP API TTS Provider
 * 
 * 通过 HTTP API 调用后端 TTS 服务进行语音合成
 * 
 * @version 2026-01-05
 */

import type { TTSOptions, TTSResult, ITTSProvider } from './types';
import { AudioApiClient, ApiError, getAudioApiClient } from '../api';
import type { TTSVoicesResponse, TTSSpeaker } from '../api';

/**
 * HTTP TTS Provider 配置
 */
export interface HttpTTSProviderConfig {
  /** API 客户端实例 (可选，默认使用单例) */
  client?: AudioApiClient;
  /** 默认说话人 ID */
  defaultSpeakerId?: number;
  /** 默认语速 */
  defaultSpeed?: number;
  /** 是否使用异步模式 (长文本推荐) */
  useAsync?: boolean;
  /** 异步模式轮询间隔(ms) */
  asyncPollingInterval?: number;
  /** 长文本阈值(字符数)，超过则自动使用异步模式 */
  longTextThreshold?: number;
}

/**
 * HTTP API TTS Provider
 * 
 * 实现 ITTSProvider 接口，通过 HTTP API 调用后端服务
 */
export class HttpTTSProvider implements ITTSProvider {
  readonly name = 'http';

  private readonly client: AudioApiClient;
  private readonly config: Required<Omit<HttpTTSProviderConfig, 'client'>>;

  private voices: TTSSpeaker[] = [];
  private voicesLoaded = false;
  private initialized = false;

  constructor(config: HttpTTSProviderConfig = {}) {
    this.client = config.client || getAudioApiClient();
    this.config = {
      defaultSpeakerId: config.defaultSpeakerId ?? 0,
      defaultSpeed: config.defaultSpeed ?? 1.0,
      useAsync: config.useAsync ?? false,
      asyncPollingInterval: config.asyncPollingInterval ?? 500,
      longTextThreshold: config.longTextThreshold ?? 1000,
    };
  }

  /**
   * 初始化 Provider，加载语音列表
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      await this.loadVoices();
      this.initialized = true;
      console.log('[HttpTTSProvider] 初始化成功，加载了', this.voices.length, '个语音');
    } catch (error) {
      console.error('[HttpTTSProvider] 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 加载语音列表
   */
  private async loadVoices(): Promise<void> {
    try {
      const response: TTSVoicesResponse = await this.client.getTTSVoices();
      this.voices = response.speakers;
      this.voicesLoaded = true;
    } catch (error) {
      console.warn('[HttpTTSProvider] 加载语音列表失败:', error);
      // 使用默认空列表，不阻塞
      this.voices = [];
      this.voicesLoaded = true;
    }
  }

  /**
   * 检查服务是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      const health = await this.client.checkHealth();
      return health.status === 'ok' && health.tts.loaded;
    } catch (error) {
      console.warn('[HttpTTSProvider] 健康检查失败:', error);
      return false;
    }
  }

  /**
   * 生成 TTS 音频
   */
  async generate(options: TTSOptions): Promise<TTSResult> {
    if (!options.text?.trim()) {
      throw new Error('文本内容不能为空');
    }

    // 懒加载语音列表
    if (!this.voicesLoaded) {
      await this.loadVoices();
    }

    // 解析说话人 ID
    const speakerId = this.resolveSpeakerId(options.voice);
    
    // 解析语速 (TTSOptions.rate 范围 0.5-2.0, API.speed 范围 0.5-2.0, 兼容)
    const speed = options.rate ?? this.config.defaultSpeed;

    // 判断是否使用异步模式
    const useAsync = this.config.useAsync || 
      (options.text.length > this.config.longTextThreshold);

    const startTime = Date.now();

    try {
      let audioBlob: Blob;

      if (useAsync) {
        audioBlob = await this.generateAsync(options.text, speakerId, speed);
      } else {
        audioBlob = await this.generateSync(options.text, speakerId, speed);
      }

      // 计算音频时长 (从 Blob 解析或估算)
      const duration = await this.estimateAudioDuration(audioBlob, options.text);

      const result: TTSResult = {
        audioBlob,
        duration,
        fromCache: false,
        provider: this.name,
      };

      console.log(
        `[HttpTTSProvider] 合成完成: ${options.text.substring(0, 50)}${options.text.length > 50 ? '...' : ''}`,
        `耗时: ${Date.now() - startTime}ms`,
        `模式: ${useAsync ? '异步' : '同步'}`
      );

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        console.error('[HttpTTSProvider] API 错误:', error.message, error.status);
        throw new Error(`TTS 服务错误 (${error.status}): ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * 同步合成
   */
  private async generateSync(
    text: string,
    sid: number,
    speed: number
  ): Promise<Blob> {
    return this.client.synthesize({ text, sid, speed });
  }

  /**
   * 异步合成 (任务模式)
   */
  private async generateAsync(
    text: string,
    sid: number,
    speed: number
  ): Promise<Blob> {
    // 创建异步任务
    const asyncResponse = await this.client.synthesizeAsync({ text, sid, speed });
    
    // 等待任务完成
    const task = await this.client.waitForTask(asyncResponse.taskId, {
      pollingInterval: this.config.asyncPollingInterval,
      onProgress: (t) => {
        console.log(`[HttpTTSProvider] 任务进度: ${t.progress}% - ${t.progressMessage}`);
      },
    });

    if (task.status === 'failed') {
      throw new Error(`TTS 任务失败: ${task.error || '未知错误'}`);
    }

    if (task.status === 'cancelled') {
      throw new Error('TTS 任务已取消');
    }

    // 下载结果
    return this.client.downloadTaskResult(asyncResponse.taskId);
  }

  /**
   * 解析说话人 ID
   * 
   * @param voice 语音名称或 ID
   * @returns 说话人 ID
   */
  private resolveSpeakerId(voice?: string): number {
    if (voice === undefined) {
      return this.config.defaultSpeakerId;
    }

    // 如果是数字字符串，直接解析
    const numericId = parseInt(voice, 10);
    if (!isNaN(numericId)) {
      return numericId;
    }

    // 根据名称查找
    const speaker = this.voices.find(
      (s) => s.name === voice || s.displayName === voice
    );
    if (speaker) {
      return speaker.sid;
    }

    console.warn(`[HttpTTSProvider] 未找到语音 "${voice}"，使用默认语音`);
    return this.config.defaultSpeakerId;
  }

  /**
   * 估算音频时长
   * 
   * 优先从 WAV 头解析，否则按文本长度估算
   */
  private async estimateAudioDuration(
    audioBlob: Blob,
    text: string
  ): Promise<number> {
    try {
      // 尝试从 WAV 头解析
      const buffer = await audioBlob.slice(0, 44).arrayBuffer();
      const view = new DataView(buffer);

      // 验证是 RIFF WAV 格式
      const riff = String.fromCharCode(
        view.getUint8(0),
        view.getUint8(1),
        view.getUint8(2),
        view.getUint8(3)
      );

      if (riff === 'RIFF') {
        const sampleRate = view.getUint32(24, true);
        const bitsPerSample = view.getUint16(34, true);
        const numChannels = view.getUint16(22, true);
        const dataSize = audioBlob.size - 44; // 假设标准 WAV 头

        const bytesPerSample = (bitsPerSample / 8) * numChannels;
        const duration = dataSize / (sampleRate * bytesPerSample);

        return duration;
      }
    } catch {
      // 忽略解析错误
    }

    // 按文本长度估算 (中文约 4字/秒，英文约 3词/秒)
    const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
    const estimated = chineseChars / 4 + englishWords / 3;

    return Math.max(0.5, estimated);
  }

  /**
   * 获取可用语音列表
   */
  async getVoices(): Promise<TTSSpeaker[]> {
    if (!this.voicesLoaded) {
      await this.loadVoices();
    }
    return [...this.voices];
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    this.voices = [];
    this.voicesLoaded = false;
    this.initialized = false;
  }
}
