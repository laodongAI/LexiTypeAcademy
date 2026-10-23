/**
 * AI 提供商基类
 * 所有 AI 提供商的抽象基类，定义通用接口
 */

import type { AIConfig, AIOptions, AIResponse, AIMessage } from '../aiTypes';
import { AIError, AIErrorCode } from '../aiTypes';

export abstract class BaseAIProvider {
  protected config: AIConfig;

  constructor(config: AIConfig) {
    this.config = config;
    // 延迟验证，在实际调用时才检查配置
  }

  /**
   * 提供商名称
   */
  abstract get name(): string;

  /**
   * 调用 API（非流式）
   */
  abstract callAPI(
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse>;

  /**
   * 调用 API（流式）
   */
  abstract streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void>;

  /**
   * 检查配置是否完整
   */
  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.endpoint && this.config.model);
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      this.validateConfig();
      const response = await this.callAPI(
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 10, timeout: 10000 }
      );
      return !!response.content;
    } catch (error) {
      console.error(`${this.name} connection test failed:`, error);
      return false;
    }
  }

  /**
   * 验证配置
   */
  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new AIError('API Key 不能为空', AIErrorCode.API_KEY_MISSING, this.name);
    }
    if (!this.config.endpoint) {
      throw new AIError('API 端点不能为空', AIErrorCode.INVALID_CONFIG, this.name);
    }
    if (!this.config.model) {
      throw new AIError('模型名称不能为空', AIErrorCode.INVALID_CONFIG, this.name);
    }
  }

  /**
   * 发起 HTTP 请求（通用方法）
   */
  protected async makeRequest(
    url: string,
    body: any,
    options?: RequestInit & { timeout?: number }
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = options?.timeout || 60000;

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    try {
      // 优先通过 Electron 主进程代理，规避浏览器 CORS
      const anyWindow: any = (typeof window !== 'undefined') ? window : undefined;
      const canProxy = anyWindow && anyWindow.electron && typeof anyWindow.electron.httpFetch === 'function';
      const reqHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...(options?.headers as any)
      } as Record<string, string>;

      if (canProxy) {
        const res = await anyWindow.electron.httpFetch({
          url,
          method: (options?.method as string) || 'POST',
          headers: reqHeaders,
          body,
          timeout
        });

        clearTimeout(timeoutId);

        const headers = new Headers();
        Object.entries(res.headers || {}).forEach(([k, v]) => headers.append(k, String(v)));
        const response = new Response(res.bodyText || '', { status: res.status || 0, statusText: res.statusText || '', headers });
        if (!res.ok) {
          await this.handleErrorResponse(response);
        }
        return response;
      }

      // 回退到浏览器 fetch（在允许跨域的环境或开发代理下）
      const response = await fetch(url, {
        method: 'POST',
        headers: reqHeaders,
        body: JSON.stringify(body),
        signal: controller.signal,
        ...options
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new AIError('请求超时', AIErrorCode.TIMEOUT, this.name);
      }

      throw new AIError(
        error.message || 'API 请求失败',
        AIErrorCode.REQUEST_FAILED,
        this.name
      );
    }
  }

  /**
   * 处理错误响应
   */
  protected async handleErrorResponse(response: Response): Promise<never> {
    let errorMessage = `API request failed: ${response.status}`;
    let errorCode = AIErrorCode.REQUEST_FAILED;

    try {
      const errorData = await response.json();
      errorMessage = errorData.error?.message || errorData.message || errorMessage;

      // 处理限流错误
      if (response.status === 429) {
        errorCode = AIErrorCode.RATE_LIMIT;
        errorMessage = '请求过于频繁，请稍后再试';
      }
    } catch {
      // 无法解析错误响应，使用默认消息
    }

    throw new AIError(errorMessage, errorCode, this.name);
  }

  /**
   * 构建消息列表（添加系统提示词）
   */
  protected buildMessages(
    messages: AIMessage[],
    systemPrompt?: string
  ): AIMessage[] {
    const result: AIMessage[] = [];

    // 添加系统提示词
    if (systemPrompt) {
      result.push({ role: 'system', content: systemPrompt });
    }

    // 添加用户消息
    result.push(...messages);

    return result;
  }

  /**
   * 记录日志
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: any): void {
    const prefix = `[${this.name}]`;
    switch (level) {
      case 'info':
        console.log(prefix, message, data || '');
        break;
      case 'warn':
        console.warn(prefix, message, data || '');
        break;
      case 'error':
        console.error(prefix, message, data || '');
        break;
    }
  }
}
