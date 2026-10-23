/**
 * TTS & ASR HTTP API 客户端
 * 
 * 提供与后端 TTS/ASR 服务通信的统一接口
 * Base URL: http://localhost:3000
 * 
 * @version 2026-01-05
 */

import type {
  HealthResponse,
  ModelsResponse,
  TTSVoicesResponse,
  TTSSynthesizeRequest,
  TTSSwitchModelResponse,
  TTSAsyncResponse,
  ASRRecognizeResponse,
  ASRVadRecognizeResponse,
  ASRSwitchModelResponse,
  ASRCapabilitiesResponse,
  ASRAsyncResponse,
  TaskResponse,
  TaskListResponse,
  DefaultSettingsResponse,
  ApiErrorResponse,
} from './types';

/**
 * API 客户端配置
 */
export interface ApiClientConfig {
  /** 服务器基础URL */
  baseUrl: string;
  /** 请求超时时间(ms) */
  timeout?: number;
  /** 重试次数 */
  maxRetries?: number;
  /** 重试延迟(ms) */
  retryDelay?: number;
}

/**
 * API 请求选项
 */
interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: FormData | string | object;
  headers?: Record<string, string>;
  timeout?: number;
  signal?: AbortSignal;
  responseType?: 'json' | 'blob' | 'arraybuffer';
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly retryAfter?: number
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** 是否为服务端错误 (5xx) */
  get isServerError(): boolean {
    return this.status >= 500;
  }

  /** 是否为客户端错误 (4xx) */
  get isClientError(): boolean {
    return this.status >= 400 && this.status < 500;
  }

  /** 是否可以重试 */
  get isRetryable(): boolean {
    return this.isServerError || this.status === 429;
  }
}

/**
 * TTS & ASR HTTP API 客户端
 */
export class AudioApiClient {
  private readonly config: Required<ApiClientConfig>;

  constructor(config: Partial<ApiClientConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl || 'http://localhost:3000',
      timeout: config.timeout || 30000,
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
    };
  }

  // ===================== 通用请求方法 =====================

  /**
   * 发送 HTTP 请求
   */
  private async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const url = `${this.config.baseUrl}${endpoint}`;
    const {
      method = 'GET',
      body,
      headers = {},
      timeout = this.config.timeout,
      signal,
      responseType = 'json',
    } = options;

    // 设置超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    const combinedSignal = signal
      ? this.combineSignals(signal, controller.signal)
      : controller.signal;

    try {
      // 构建请求选项
      const fetchOptions: RequestInit = {
        method,
        headers: { ...headers },
        signal: combinedSignal,
      };

      // 处理请求体
      if (body) {
        if (body instanceof FormData) {
          // FormData 不设置 Content-Type，让浏览器自动添加 boundary
          fetchOptions.body = body;
        } else if (typeof body === 'string') {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json',
          };
          fetchOptions.body = body;
        } else {
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/json',
          };
          fetchOptions.body = JSON.stringify(body);
        }
      }

      const response = await fetch(url, fetchOptions);

      // 处理错误响应
      if (!response.ok) {
        let errorData: ApiErrorResponse | null = null;
        try {
          errorData = await response.json();
        } catch {
          // 忽略解析错误
        }

        throw new ApiError(
          errorData?.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData?.code,
          errorData?.retryAfter
        );
      }

      // 解析响应
      switch (responseType) {
        case 'blob':
          return (await response.blob()) as unknown as T;
        case 'arraybuffer':
          return (await response.arrayBuffer()) as unknown as T;
        default:
          return (await response.json()) as T;
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * 带重试的请求
   */
  private async requestWithRetry<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await this.request<T>(endpoint, options);
      } catch (error) {
        lastError = error as Error;

        // 如果是 ApiError 且不可重试，直接抛出
        if (error instanceof ApiError && !error.isRetryable) {
          throw error;
        }

        // 如果是最后一次尝试，抛出错误
        if (attempt === this.config.maxRetries) {
          break;
        }

        // 计算重试延迟
        let delay = this.config.retryDelay * Math.pow(2, attempt);
        if (error instanceof ApiError && error.retryAfter) {
          delay = error.retryAfter * 1000;
        }

        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * 合并 AbortSignal
   */
  private combineSignals(
    signal1: AbortSignal,
    signal2: AbortSignal
  ): AbortSignal {
    const controller = new AbortController();

    const onAbort = () => controller.abort();
    signal1.addEventListener('abort', onAbort);
    signal2.addEventListener('abort', onAbort);

    return controller.signal;
  }

  /**
   * 延迟
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ===================== 健康检查 =====================

  /**
   * 检查服务健康状态
   */
  async checkHealth(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/api/health');
  }

  /**
   * 获取可用模型列表
   */
  async getModels(): Promise<ModelsResponse> {
    return this.request<ModelsResponse>('/api/models');
  }

  /**
   * 获取默认设置
   */
  async getDefaults(): Promise<DefaultSettingsResponse> {
    return this.request<DefaultSettingsResponse>('/api/defaults');
  }

  // ===================== TTS API =====================

  /**
   * 获取 TTS 语音列表
   */
  async getTTSVoices(): Promise<TTSVoicesResponse> {
    return this.request<TTSVoicesResponse>('/api/tts/voices');
  }

  /**
   * 同步 TTS 合成
   * @param params 合成参数
   * @returns 音频 Blob (audio/wav)
   */
  async synthesize(params: TTSSynthesizeRequest): Promise<Blob> {
    const formData = new FormData();
    formData.append('text', params.text);
    if (params.sid !== undefined) {
      formData.append('sid', params.sid.toString());
    }
    if (params.speed !== undefined) {
      formData.append('speed', params.speed.toString());
    }

    return this.requestWithRetry<Blob>('/api/tts/synthesize', {
      method: 'POST',
      body: formData,
      responseType: 'blob',
      timeout: 60000, // TTS 可能需要更长时间
    });
  }

  /**
   * 异步 TTS 合成 (创建任务)
   * @param params 合成参数
   * @returns 任务信息
   */
  async synthesizeAsync(params: TTSSynthesizeRequest): Promise<TTSAsyncResponse> {
    const formData = new FormData();
    formData.append('text', params.text);
    if (params.sid !== undefined) {
      formData.append('sid', params.sid.toString());
    }
    if (params.speed !== undefined) {
      formData.append('speed', params.speed.toString());
    }

    return this.request<TTSAsyncResponse>('/api/tts/async', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * 切换 TTS 模型
   * @param model 模型 key
   */
  async switchTTSModel(model: string): Promise<TTSSwitchModelResponse> {
    return this.request<TTSSwitchModelResponse>('/api/tts/switch-model', {
      method: 'POST',
      body: { model },
    });
  }

  // ===================== ASR API =====================

  /**
   * 获取 ASR 能力信息
   */
  async getASRCapabilities(): Promise<ASRCapabilitiesResponse> {
    return this.request<ASRCapabilitiesResponse>('/api/asr/capabilities');
  }

  /**
   * 同步 ASR 识别
   * @param audio 音频文件
   * @param options 识别选项
   * @returns 识别结果
   */
  async recognize(
    audio: Blob | File,
    options: { language?: string; enhance?: boolean } = {}
  ): Promise<ASRRecognizeResponse> {
    const formData = new FormData();
    formData.append('audio', audio, 'audio.wav');
    if (options.language) {
      formData.append('language', options.language);
    }
    if (options.enhance !== undefined) {
      formData.append('enhance', options.enhance.toString());
    }

    return this.requestWithRetry<ASRRecognizeResponse>('/api/asr/recognize', {
      method: 'POST',
      body: formData,
      timeout: 120000, // ASR 需要更长时间
    });
  }

  /**
   * 带 VAD 的 ASR 识别
   * @param audio 音频文件
   * @param options 识别选项
   * @returns 识别结果
   */
  async recognizeWithVad(
    audio: Blob | File,
    options: { enhance?: boolean } = {}
  ): Promise<ASRVadRecognizeResponse> {
    const formData = new FormData();
    formData.append('audio', audio, 'audio.wav');
    if (options.enhance !== undefined) {
      formData.append('enhance', options.enhance.toString());
    }

    return this.requestWithRetry<ASRVadRecognizeResponse>('/api/asr/recognize-with-vad', {
      method: 'POST',
      body: formData,
      timeout: 180000, // VAD+ASR 需要更长时间
    });
  }

  /**
   * 异步 ASR 识别 (创建任务)
   * @param audio 音频文件
   * @param options 识别选项
   * @returns 任务信息
   */
  async recognizeAsync(
    audio: Blob | File,
    options: { language?: string; enhance?: boolean } = {}
  ): Promise<ASRAsyncResponse> {
    const formData = new FormData();
    formData.append('audio', audio, 'audio.wav');
    if (options.language) {
      formData.append('language', options.language);
    }
    if (options.enhance !== undefined) {
      formData.append('enhance', options.enhance.toString());
    }

    return this.request<ASRAsyncResponse>('/api/asr/async', {
      method: 'POST',
      body: formData,
    });
  }

  /**
   * 切换 ASR 模型
   * @param model 模型 key
   */
  async switchASRModel(model: string): Promise<ASRSwitchModelResponse> {
    return this.request<ASRSwitchModelResponse>('/api/asr/switch-model', {
      method: 'POST',
      body: { model },
    });
  }

  /**
   * 音频增强
   * @param audio 音频文件
   * @returns 增强后的音频 Blob
   */
  async enhanceAudio(audio: Blob | File): Promise<Blob> {
    const formData = new FormData();
    formData.append('audio', audio, 'audio.wav');

    return this.requestWithRetry<Blob>('/api/audio/enhance', {
      method: 'POST',
      body: formData,
      responseType: 'blob',
      timeout: 120000,
    });
  }

  // ===================== 任务管理 API =====================

  /**
   * 获取任务详情
   * @param taskId 任务 ID
   */
  async getTask(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/api/tasks/${taskId}`);
  }

  /**
   * 获取任务列表
   * @param options 过滤选项
   */
  async getTasks(
    options: { status?: string; type?: string; limit?: number } = {}
  ): Promise<TaskListResponse> {
    const params = new URLSearchParams();
    if (options.status) params.append('status', options.status);
    if (options.type) params.append('type', options.type);
    if (options.limit) params.append('limit', options.limit.toString());

    const query = params.toString();
    return this.request<TaskListResponse>(`/api/tasks${query ? `?${query}` : ''}`);
  }

  /**
   * 下载任务结果
   * @param taskId 任务 ID
   * @returns 音频 Blob
   */
  async downloadTaskResult(taskId: string): Promise<Blob> {
    return this.request<Blob>(`/api/tasks/${taskId}/download`, {
      responseType: 'blob',
    });
  }

  /**
   * 取消任务
   * @param taskId 任务 ID
   */
  async cancelTask(taskId: string): Promise<TaskResponse> {
    return this.request<TaskResponse>(`/api/tasks/${taskId}/cancel`, {
      method: 'POST',
    });
  }

  /**
   * 删除任务
   * @param taskId 任务 ID
   */
  async deleteTask(taskId: string): Promise<{ success: boolean; id: string }> {
    return this.request(`/api/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  /**
   * 等待任务完成
   * @param taskId 任务 ID
   * @param options 轮询选项
   */
  async waitForTask(
    taskId: string,
    options: {
      pollingInterval?: number;
      timeout?: number;
      onProgress?: (task: TaskResponse) => void;
    } = {}
  ): Promise<TaskResponse> {
    const { pollingInterval = 500, timeout = 300000, onProgress } = options;
    const startTime = Date.now();

    while (true) {
      const task = await this.getTask(taskId);

      if (onProgress) {
        onProgress(task);
      }

      if (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') {
        return task;
      }

      if (Date.now() - startTime > timeout) {
        throw new ApiError('Task timeout', 408);
      }

      await this.sleep(pollingInterval);
    }
  }
}

// ===================== 单例实例 =====================

let apiClientInstance: AudioApiClient | null = null;

/**
 * 获取 API 客户端单例
 */
export function getAudioApiClient(config?: Partial<ApiClientConfig>): AudioApiClient {
  if (!apiClientInstance) {
    apiClientInstance = new AudioApiClient(config);
  }
  return apiClientInstance;
}

/**
 * 重置 API 客户端 (用于测试或重新配置)
 */
export function resetAudioApiClient(): void {
  apiClientInstance = null;
}
