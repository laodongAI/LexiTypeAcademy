/**
 * API ASR提供者实现
 * 
 * 功能:
 * 1. 远程API调用 (支持多种ASR服务)
 * 2. 任务队列 (p-queue限流)
 * 3. 重试机制 (3次, 指数退避)
 * 4. 超时控制 (30s)
 * 
 * 支持的API服务:
 * - Azure Speech Service
 * - Google Cloud Speech-to-Text
 * - 自定义ASR API
 */

import { 
  IASRProvider, 
  ASRProviderType, 
  ASROptions, 
  ASRResult 
} from './types';
import { NetworkError } from '@/domain/errors/DomainError';

/**
 * API配置
 */
export interface ApiASRConfig {
  /** API端点URL */
  endpoint: string;
  
  /** API密钥 */
  apiKey: string;
  
  /** API服务类型 */
  serviceType: 'azure' | 'google' | 'custom';
  
  /** 最大并发请求数 */
  maxConcurrent?: number;
  
  /** 请求超时 (毫秒) */
  timeout?: number;
  
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * API ASR提供者
 */
export class ApiASRProvider implements IASRProvider {
  readonly type = ASRProviderType.API;
  
  private config: Required<ApiASRConfig>;
  private requestQueue: Array<() => Promise<any>> = [];
  private activeRequests = 0;
  
  // 默认配置
  private static readonly DEFAULT_CONFIG: Partial<ApiASRConfig> = {
    maxConcurrent: 3,
    timeout: 30000, // 30秒
    maxRetries: 3,
  };
  
  // 重试延迟 (指数退避)
  private static readonly RETRY_DELAYS = [1000, 2000, 4000]; // 1s, 2s, 4s
  
  /**
   * 构造函数
   */
  constructor(config: ApiASRConfig) {
    this.config = {
      ...ApiASRProvider.DEFAULT_CONFIG,
      ...config,
    } as Required<ApiASRConfig>;
  }
  
  /**
   * 识别音频
   */
  async recognize(options: ASROptions): Promise<ASRResult> {
    const startTime = performance.now();
    
    // 验证输入
    this.validateOptions(options);
    
    // 转换音频为Blob (如果是AudioBuffer)
    const audioBlob = await this.convertToBlob(options.audio);
    
    // 带重试的API调用
    const apiResult = await this.recognizeWithRetry(audioBlob, options);
    
    const endTime = performance.now();
    
    return {
      text: apiResult.text,
      duration: apiResult.duration,
      confidence: apiResult.confidence,
      provider: this.type,
      alignments: apiResult.alignments,
      processingTime: endTime - startTime,
    };
  }
  
  /**
   * 带重试的识别
   */
  private async recognizeWithRetry(
    audioBlob: Blob, 
    options: ASROptions
  ): Promise<any> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // 限流控制
        await this.waitForAvailableSlot();
        
        // 执行API调用
        const result = await this.callAPI(audioBlob, options);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const isLastAttempt = attempt === this.config.maxRetries;
        
        console.error(
          `[ApiASR] 识别失败 (尝试 ${attempt}/${this.config.maxRetries}):`, 
          error
        );
        
        if (isLastAttempt) {
          break;
        }
        
        // 等待后重试
        const delay = ApiASRProvider.RETRY_DELAYS[attempt - 1];
        console.log(`[ApiASR] ${delay}ms后重试...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new NetworkError(
      `API ASR识别失败 (${this.config.maxRetries}次尝试后): ${lastError?.message || '未知错误'}`
    );
  }
  
  /**
   * 等待可用槽位
   */
  private async waitForAvailableSlot(): Promise<void> {
    while (this.activeRequests >= this.config.maxConcurrent) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    this.activeRequests++;
  }
  
  /**
   * 调用API
   */
  private async callAPI(audioBlob: Blob, options: ASROptions): Promise<any> {
    try {
      // 根据服务类型构造请求
      const request = this.buildRequest(audioBlob, options);
      
      // 发送请求 (带超时)
      const response = await this.fetchWithTimeout(
        request.url,
        request.init,
        this.config.timeout
      );
      
      // 解析响应
      const result = await this.parseResponse(response, options);
      
      return result;
    } finally {
      this.activeRequests--;
    }
  }
  
  /**
   * 构造请求
   */
  private buildRequest(audioBlob: Blob, options: ASROptions): {
    url: string;
    init: RequestInit;
  } {
    switch (this.config.serviceType) {
      case 'azure':
        return this.buildAzureRequest(audioBlob, options);
      case 'google':
        return this.buildGoogleRequest(audioBlob, options);
      case 'custom':
        return this.buildCustomRequest(audioBlob, options);
      default:
        throw new Error(`不支持的服务类型: ${this.config.serviceType}`);
    }
  }
  
  /**
   * 构造Azure请求
   */
  private buildAzureRequest(audioBlob: Blob, options: ASROptions): {
    url: string;
    init: RequestInit;
  } {
    const url = `${this.config.endpoint}/speechtotext/v3.0/transcriptions`;
    
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': this.config.apiKey,
        'Content-Type': 'audio/wav',
      },
      body: audioBlob,
    };
    
    return { url, init };
  }
  
  /**
   * 构造Google请求
   */
  private buildGoogleRequest(audioBlob: Blob, options: ASROptions): {
    url: string;
    init: RequestInit;
  } {
    const url = `${this.config.endpoint}/v1/speech:recognize?key=${this.config.apiKey}`;
    
    // Google需要base64编码
    const reader = new FileReader();
    reader.readAsDataURL(audioBlob);
    
    return new Promise((resolve) => {
      reader.onloadend = () => {
        const base64Audio = (reader.result as string).split(',')[1];
        
        const init: RequestInit = {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            config: {
              encoding: 'LINEAR16',
              sampleRateHertz: options.sampleRate || 16000,
              languageCode: options.language,
            },
            audio: {
              content: base64Audio,
            },
          }),
        };
        
        resolve({ url, init });
      };
    }) as any;
  }
  
  /**
   * 构造自定义请求
   */
  private buildCustomRequest(audioBlob: Blob, options: ASROptions): {
    url: string;
    init: RequestInit;
  } {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    formData.append('language', options.language);
    formData.append('enableAlignment', String(options.enableAlignment || false));
    
    const init: RequestInit = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: formData,
    };
    
    return { url: this.config.endpoint, init };
  }
  
  /**
   * 带超时的fetch
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit,
    timeout: number
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`请求超时 (${timeout}ms)`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * 解析响应
   */
  private async parseResponse(response: Response, options: ASROptions): Promise<any> {
    const data = await response.json();
    
    switch (this.config.serviceType) {
      case 'azure':
        return this.parseAzureResponse(data);
      case 'google':
        return this.parseGoogleResponse(data);
      case 'custom':
        return this.parseCustomResponse(data);
      default:
        throw new Error(`不支持的服务类型: ${this.config.serviceType}`);
    }
  }
  
  /**
   * 解析Azure响应
   */
  private parseAzureResponse(data: any): any {
    return {
      text: data.DisplayText || '',
      duration: data.Duration / 10000000, // 转换为秒
      confidence: data.NBest?.[0]?.Confidence || 0,
      alignments: data.NBest?.[0]?.Words?.map((w: any) => ({
        word: w.Word,
        startTime: w.Offset / 10000000,
        endTime: (w.Offset + w.Duration) / 10000000,
        phonemes: [],
        confidence: w.Confidence,
      })),
    };
  }
  
  /**
   * 解析Google响应
   */
  private parseGoogleResponse(data: any): any {
    const result = data.results?.[0];
    const alternative = result?.alternatives?.[0];
    
    return {
      text: alternative?.transcript || '',
      duration: 0, // Google不返回时长
      confidence: alternative?.confidence || 0,
      alignments: alternative?.words?.map((w: any) => ({
        word: w.word,
        startTime: parseFloat(w.startTime?.replace('s', '') || '0'),
        endTime: parseFloat(w.endTime?.replace('s', '') || '0'),
        phonemes: [],
        confidence: w.confidence || 0,
      })),
    };
  }
  
  /**
   * 解析自定义响应
   */
  private parseCustomResponse(data: any): any {
    return {
      text: data.text || '',
      duration: data.duration || 0,
      confidence: data.confidence || 0,
      alignments: data.alignments,
    };
  }
  
  /**
   * 验证选项
   */
  private validateOptions(options: ASROptions): void {
    if (!options.audio) {
      throw new Error('音频数据不能为空');
    }
    
    if (!options.language) {
      throw new Error('必须指定语言代码');
    }
  }
  
  /**
   * 转换为Blob
   */
  private async convertToBlob(audio: AudioBuffer | Blob): Promise<Blob> {
    if (audio instanceof Blob) {
      return audio;
    }
    
    // AudioBuffer -> WAV Blob
    const wavBlob = await this.audioBufferToWav(audio);
    return wavBlob;
  }
  
  /**
   * AudioBuffer转WAV
   */
  private async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = new Float32Array(buffer.length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i];
      }
    }
    
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // PCM data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  
  /**
   * 写入字符串到DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * 检查是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 检查网络连接
      if (!navigator.onLine) {
        console.warn('[ApiASR] 网络离线');
        return false;
      }
      
      // 简单健康检查 (HEAD请求)
      const response = await fetch(this.config.endpoint, { 
        method: 'HEAD',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
      });
      
      return response.ok || response.status === 405; // 有些API不支持HEAD
    } catch (error) {
      console.error('[ApiASR] 可用性检查失败:', error);
      return false;
    }
  }
  
  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    console.log('[ApiASR] 清理资源...');
    this.requestQueue = [];
    this.activeRequests = 0;
  }
}
