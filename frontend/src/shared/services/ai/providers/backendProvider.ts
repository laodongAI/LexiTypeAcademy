/**
 * 后端 AI 提供商（批次D）
 *
 * 职责：
 * - 所有 AI 请求统一走本地 FastAPI 代理，前端不再持有密钥
 * - 非流式调用 /api/ai/chat，流式调用 /api/ai/chat/stream
 * - 把后端统一错误码映射为前端 AIErrorCode，保持调用方错误处理口径不变
 * - 缓存后端配置状态 5 秒，避免频繁查询 /api/ai/config
 */

import { BaseAIProvider } from './baseProvider'
import type {
  AIMessage,
  AIOptions,
  AIResponse,
  AIBackendConfig,
  AIChatUsage
} from '../aiTypes'
import { AIError, AIErrorCode } from '../aiTypes'
import { API_BASE_URL } from '../../apiClient'
import { createLogger } from '../../../utils/logger'

/** 模块日志器：统一前缀便于调试筛选 */
const log = createLogger('ai/backend')

/** 后端状态缓存有效期（毫秒） */
const STATUS_CACHE_TTL_MS = 5000

/** 默认非流式超时（毫秒）：与后端 AI_TIMEOUT_SECONDS 默认值一致 */
const DEFAULT_CALL_TIMEOUT_MS = 120000

/** 默认流式超时（毫秒）：长文本生成需要更宽松的上限 */
const DEFAULT_STREAM_TIMEOUT_MS = 180000

/** 连通性测试超时（毫秒）：后端内部固定 15 秒，这里留出网络余量 */
const TEST_TIMEOUT_MS = 20000

/** 配置状态缓存项 */
interface StatusCacheEntry {
  /** 后端返回的只读配置状态 */
  config: AIBackendConfig
  /** 写入缓存的时间戳（毫秒） */
  cachedAt: number
}

/**
 * 把后端错误响应映射为前端 AIError。
 * @param status HTTP 状态码
 * @param bodyText 后端返回的原始文本
 * @returns 前端统一错误对象
 */
function mapHttpError(status: number, bodyText: string): AIError {
  // 默认文案直接带状态码，便于定位
  let message = `AI 服务请求失败（HTTP ${status}）`
  let code = AIErrorCode.PROVIDER_ERROR

  // 尝试解析后端统一错误体 {"detail":{"code","message","upstreamStatus"}}
  try {
    const parsed = JSON.parse(bodyText) as {
      detail?: { code?: string; message?: string }
    }
    if (parsed?.detail?.message) {
      message = parsed.detail.message
    }
    const serverCode = parsed?.detail?.code
    switch (serverCode) {
      case 'AI_CONFIG_MISSING':
        code = AIErrorCode.API_KEY_MISSING
        break
      case 'AI_BAD_REQUEST':
        code = AIErrorCode.INVALID_CONFIG
        break
      case 'AI_RATE_LIMIT':
        code = AIErrorCode.RATE_LIMIT
        break
      case 'AI_TIMEOUT':
        code = AIErrorCode.TIMEOUT
        break
      case 'AI_INVALID_RESPONSE':
        code = AIErrorCode.INVALID_RESPONSE
        break
      case 'AI_UPSTREAM_ERROR':
        code = AIErrorCode.PROVIDER_ERROR
        break
      default:
        break
    }
  } catch {
    // 非 JSON 错误体：保留原始文本作为兜底提示
    if (bodyText) message = bodyText
  }

  // 未带业务码时，根据状态码补充语义
  if (code === AIErrorCode.PROVIDER_ERROR) {
    if (status === 429) code = AIErrorCode.RATE_LIMIT
    else if (status === 504) code = AIErrorCode.TIMEOUT
    else if (status === 400) code = AIErrorCode.INVALID_CONFIG
  }

  return new AIError(message, code, 'BackendAI')
}

/**
 * 后端 AI 提供商实现。
 */
export class BackendAIProvider extends BaseAIProvider {
  /** 后端状态缓存：为空表示尚未查询 */
  private statusCache: StatusCacheEntry | null = null

  /** 进行中的状态查询：避免并发重复请求 */
  private statusPromise: Promise<AIBackendConfig | null> | null = null

  /** 提供商名称：用于错误与日志标识 */
  get name(): string {
    return 'BackendAI'
  }

  /**
   * 查询后端 AI 配置状态。
   * @param force 是否强制忽略缓存
   * @returns 后端配置状态；查询失败时返回 null
   */
  async refreshStatus(force = false): Promise<AIBackendConfig | null> {
    // 缓存有效且非强制刷新时直接复用
    if (
      !force &&
      this.statusCache &&
      Date.now() - this.statusCache.cachedAt < STATUS_CACHE_TTL_MS
    ) {
      return this.statusCache.config
    }

    // 已有进行中的查询则复用同一个 Promise
    if (this.statusPromise) {
      return this.statusPromise
    }

    // 发起状态查询
    this.statusPromise = (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/ai/config`, {
          method: 'GET',
          signal: AbortSignal.timeout(STATUS_CACHE_TTL_MS)
        })
        if (!response.ok) {
          log.warn('查询 AI 配置状态失败', response.status)
          return null
        }
        const config = (await response.json()) as AIBackendConfig
        this.statusCache = { config, cachedAt: Date.now() }
        log.debug('AI 配置状态已更新', config.configured, config.model)
        return config
      } catch (error) {
        log.warn('查询 AI 配置状态异常', error)
        return null
      } finally {
        this.statusPromise = null
      }
    })()

    return this.statusPromise
  }

  /**
   * 检查是否已配置。
   *
   * 说明：
   * - 有缓存时以缓存为准
   * - 无缓存时返回 true（乐观放行），实际请求若未配置会收到 503 并提示用户
   * - 同时异步刷新状态，供后续调用与设置页使用
   */
  isConfigured(): boolean {
    // 缓存有效：返回后端真实状态
    if (
      this.statusCache &&
      Date.now() - this.statusCache.cachedAt < STATUS_CACHE_TTL_MS
    ) {
      return this.statusCache.config.configured
    }

    // 无缓存：触发一次后台刷新，本次乐观放行
    void this.refreshStatus()
    return true
  }

  /**
   * 非流式调用后端代理。
   * @param messages 对话消息
   * @param options 采样参数与超时
   * @returns 模型输出与 usage
   */
  async callAPI(messages: AIMessage[], options?: AIOptions): Promise<AIResponse> {
    const timeoutMs = options?.timeout ?? DEFAULT_CALL_TIMEOUT_MS
    log.info('调用后端 AI 接口', { messageCount: messages.length, timeoutMs })

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          timeoutMs
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (error) {
      // 网络层失败或超时：区分超时语义
      const isAbort = error instanceof DOMException && error.name === 'TimeoutError'
      log.error('后端 AI 接口不可达', error)
      throw new AIError(
        isAbort ? 'AI 请求超时' : '无法连接本地后端 AI 服务',
        isAbort ? AIErrorCode.TIMEOUT : AIErrorCode.REQUEST_FAILED,
        this.name
      )
    }

    const bodyText = await response.text()
    if (!response.ok) {
      throw mapHttpError(response.status, bodyText)
    }

    // 解析后端成功响应
    try {
      const data = JSON.parse(bodyText) as {
        content?: string
        usage?: AIChatUsage
      }
      if (!data.content) {
        throw new AIError('AI 响应内容为空', AIErrorCode.INVALID_RESPONSE, this.name)
      }
      log.info('后端 AI 调用成功', { contentLength: data.content.length })
      return {
        content: data.content,
        usage: data.usage
      }
    } catch (error) {
      if (error instanceof AIError) throw error
      log.error('解析后端 AI 响应失败', error)
      throw new AIError('无法解析 AI 响应', AIErrorCode.INVALID_RESPONSE, this.name)
    }
  }

  /**
   * 流式调用后端代理。
   * @param messages 对话消息
   * @param onChunk 增量内容回调
   * @param options 采样参数与超时
   */
  async streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void> {
    const timeoutMs = options?.timeout ?? DEFAULT_STREAM_TIMEOUT_MS
    log.info('开始后端 AI 流式调用', { messageCount: messages.length, timeoutMs })

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages,
          temperature: options?.temperature,
          maxTokens: options?.maxTokens,
          timeoutMs
        }),
        signal: AbortSignal.timeout(timeoutMs)
      })
    } catch (error) {
      const isAbort = error instanceof DOMException && error.name === 'TimeoutError'
      log.error('后端 AI 流式接口不可达', error)
      throw new AIError(
        isAbort ? 'AI 流式请求超时' : '无法连接本地后端 AI 服务',
        isAbort ? AIErrorCode.TIMEOUT : AIErrorCode.REQUEST_FAILED,
        this.name
      )
    }

    if (!response.ok) {
      throw mapHttpError(response.status, await response.text())
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIError('AI 流式响应为空', AIErrorCode.INVALID_RESPONSE, this.name)
    }

    const decoder = new TextDecoder()
    /** 行缓冲：保留跨块未完成的行，避免片段丢失 */
    let buffer = ''
    /** 已收到的增量片段数量，用于日志 */
    let deltaCount = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line.startsWith('data:')) continue

          const payloadText = line.slice(5).trim()
          if (!payloadText) continue

          let event: {
            type?: string
            content?: string
            code?: string
            message?: string
          }
          try {
            event = JSON.parse(payloadText)
          } catch {
            log.warn('跳过无法解析的流式片段')
            continue
          }

          // 增量事件：交给调用方
          if (event.type === 'delta' && event.content) {
            deltaCount += 1
            onChunk(event.content)
            continue
          }

          // 结束事件：正常退出
          if (event.type === 'done') {
            log.info('后端 AI 流式调用完成', { deltaCount })
            return
          }

          // 错误事件：转换为前端统一错误
          if (event.type === 'error') {
            const code = event.code ?? 'AI_UPSTREAM_ERROR'
            log.error('后端 AI 流式调用失败', code, event.message)
            throw mapHttpError(
              code === 'AI_RATE_LIMIT' ? 429 : 502,
              JSON.stringify({ detail: { code, message: event.message } })
            )
          }
        }
      }
    } catch (error) {
      if (error instanceof AIError) throw error
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        log.error('后端 AI 流式读取超时')
        throw new AIError('AI 流式读取超时', AIErrorCode.TIMEOUT, this.name)
      }
      log.error('后端 AI 流式读取异常', error)
      throw new AIError('AI 流式读取中断', AIErrorCode.REQUEST_FAILED, this.name)
    } finally {
      reader.releaseLock()
    }

    // 上游未发送 done 就断开：按异常处理，避免调用方误判成功
    log.warn('后端 AI 流式响应提前结束', { deltaCount })
    throw new AIError('AI 流式响应异常结束', AIErrorCode.INVALID_RESPONSE, this.name)
  }

  /**
   * 测试后端与上游的连通性。
   * @returns 成功返回 true，失败返回 false
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/ai/test`, {
        method: 'POST',
        signal: AbortSignal.timeout(TEST_TIMEOUT_MS)
      })
      if (!response.ok) {
        log.warn('AI 连通性测试失败', response.status)
        return false
      }
      // 成功后刷新状态缓存，让设置页立即看到最新配置
      await this.refreshStatus(true)
      return true
    } catch (error) {
      log.warn('AI 连通性测试异常', error)
      return false
    }
  }
}
