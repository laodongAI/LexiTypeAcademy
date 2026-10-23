/**
 * Qwen (通义千问) AI 提供商
 * 支持阿里云百炼平台的通义千问模型
 */

import { BaseAIProvider } from './baseProvider';
import type { AIMessage, AIOptions, AIResponse } from '../aiTypes';
import { AIError, AIErrorCode } from '../aiTypes';

export class QwenProvider extends BaseAIProvider {
  get name(): string {
    return 'Qwen';
  }

  /** 判断是否使用 OpenAI 兼容模式 */
  private isOpenAICompatible(): boolean {
    const ep = (this as any).config?.endpoint as string
    if (!ep) return false
    return ep.includes('/compatible-mode/') || ep.endsWith('/chat/completions')
  }

  /**
   * 非流式 API 调用
   */
  async callAPI(
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse> {
    this.log('info', 'Calling Qwen API', { model: this.config.model, messageCount: messages.length });

    try {
      const useOpenAI = this.isOpenAICompatible()
      const body = useOpenAI
        ? {
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2000
          }
        : {
            model: this.config.model,
            input: { messages },
            parameters: {
              temperature: options?.temperature ?? 0.7,
              max_tokens: options?.maxTokens ?? 2000,
              result_format: 'message'
            }
          }

      const response = await this.makeRequest(
        this.config.endpoint,
        body,
        { timeout: options?.timeout }
      );

      const data = await response.json();

      let result: AIResponse
      if (useOpenAI) {
        const content = data?.choices?.[0]?.message?.content
        if (!content) {
          throw new AIError('Invalid response format from Qwen (OpenAI compatible)', AIErrorCode.INVALID_RESPONSE, this.name)
        }
        result = {
          content,
          usage: data.usage
            ? {
                promptTokens: data.usage.prompt_tokens || 0,
                completionTokens: data.usage.completion_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
              }
            : undefined
        }
      } else {
        // DashScope 协议
        if (!data.output?.choices?.[0]?.message?.content) {
          throw new AIError(
            'Invalid response format from Qwen API',
            AIErrorCode.INVALID_RESPONSE,
            this.name
          );
        }
        result = {
          content: data.output.choices[0].message.content,
          usage: data.usage
            ? {
                promptTokens: data.usage.input_tokens || 0,
                completionTokens: data.usage.output_tokens || 0,
                totalTokens: data.usage.total_tokens || 0
              }
            : undefined
        }
      }

      this.log('info', 'Qwen API call successful', {
        contentLength: result.content.length,
        tokens: result.usage?.totalTokens
      });

      return result;
    } catch (error: any) {
      this.log('error', 'Qwen API call failed', error);
      throw error;
    }
  }

  /**
   * 流式 API 调用
   */
  async streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void> {
    this.log('info', 'Starting Qwen stream', { model: this.config.model });

    try {
      const useOpenAI = this.isOpenAICompatible()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      }
      if (!useOpenAI) {
        headers['X-DashScope-SSE'] = 'enable'
      }

      const body = useOpenAI
        ? {
            model: this.config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.maxTokens ?? 2000,
            stream: true
          }
        : {
            model: this.config.model,
            input: { messages },
            parameters: {
              temperature: options?.temperature ?? 0.7,
              max_tokens: options?.maxTokens ?? 2000,
              incremental_output: true,
              result_format: 'message'
            }
          }

      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        await this.handleErrorResponse(response);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new AIError('Response body is null', AIErrorCode.INVALID_RESPONSE, this.name);
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let chunkCount = 0;

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) {
            this.log('info', 'Qwen stream completed', { chunkCount });
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data:')) continue
            try {
              const jsonStr = line.slice(5).trim()
              if (jsonStr === '[DONE]') {
                continue
              }
              const data = JSON.parse(jsonStr)
              let content: string | undefined
              if (useOpenAI) {
                content = data?.choices?.[0]?.delta?.content
              } else {
                content = data?.output?.choices?.[0]?.message?.content
              }
              if (content) {
                onChunk(content)
                chunkCount++
              }
            } catch (e) {
              this.log('warn', 'Failed to parse SSE chunk', e)
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error: any) {
      this.log('error', 'Qwen stream failed', error);
      throw error;
    }
  }

  /**
   * 覆盖基类的请求方法，添加 Qwen 特定的头部
   */
  protected async makeRequest(
    url: string,
    body: any,
    options?: RequestInit & { timeout?: number }
  ): Promise<Response> {
    // 添加 Qwen 特定的请求头
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...options?.headers
    };

    return super.makeRequest(url, body, { ...options, headers });
  }
}
