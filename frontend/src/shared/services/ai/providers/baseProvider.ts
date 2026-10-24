/**
 * AI 提供商基类（批次D）
 *
 * 职责：
 * - 定义所有提供商必须实现的统一接口（name / callAPI / streamAPI）
 * - 提供通用的消息构建、连通性测试与日志方法
 *
 * 变更说明：
 * - 密钥已由后端托管，基类不再做本地密钥校验
 * - 已移除 Electron 主进程代理分支与直连 fetch 逻辑，避免双通道分叉
 */

import type { AIConfig, AIOptions, AIResponse, AIMessage } from '../aiTypes'

export abstract class BaseAIProvider {
  /** 前端侧配置：批次D起仅用于 customPrompts 等非敏感配置 */
  protected config: AIConfig

  /**
   * 构造提供商。
   * @param config 前端侧 AI 配置
   */
  constructor(config: AIConfig) {
    this.config = config
  }

  /**
   * 提供商名称。
   */
  abstract get name(): string

  /**
   * 非流式调用。
   * @param messages 对话消息
   * @param options 采样参数与超时
   */
  abstract callAPI(
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse>

  /**
   * 流式调用。
   * @param messages 对话消息
   * @param onChunk 增量内容回调
   * @param options 采样参数与超时
   */
  abstract streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void>

  /**
   * 检查配置是否可用。
   *
   * 说明：
   *   后端代理模式下配置由后端判定，默认视为可用；
   *   具体提供商可覆盖此方法返回真实状态。
   */
  isConfigured(): boolean {
    return true
  }

  /**
   * 测试连接。
   * @returns 成功返回 true，失败返回 false
   */
  async testConnection(): Promise<boolean> {
    try {
      // 用最小请求验证可用性
      const response = await this.callAPI(
        [{ role: 'user', content: 'Hello' }],
        { maxTokens: 10, timeout: 10000 }
      )
      return !!response.content
    } catch (error) {
      console.error(`[${this.name}] 连通性测试失败`, error)
      return false
    }
  }

  /**
   * 构建消息列表（可选前置系统提示词）。
   * @param messages 原始消息
   * @param systemPrompt 系统提示词
   * @returns 合并后的消息列表
   */
  protected buildMessages(
    messages: AIMessage[],
    systemPrompt?: string
  ): AIMessage[] {
    // 有系统提示词时放在最前，符合 OpenAI 协议习惯
    return systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : [...messages]
  }

  /**
   * 输出分级日志。
   * @param level 日志级别
   * @param message 日志内容
   * @param data 附加数据
   */
  protected log(level: 'info' | 'warn' | 'error', message: string, data?: unknown): void {
    const prefix = `[${this.name}]`
    switch (level) {
      case 'info':
        console.info(prefix, message, data ?? '')
        break
      case 'warn':
        console.warn(prefix, message, data ?? '')
        break
      case 'error':
        console.error(prefix, message, data ?? '')
        break
    }
  }
}
