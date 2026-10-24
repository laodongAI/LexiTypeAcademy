/**
 * 后端 API 客户端
 *
 * 职责：
 * - 统一拼接本地后端地址（默认 http://127.0.0.1:8010，可用 VITE_API_URL 覆盖）
 * - 统一处理 JSON 序列化、超时、错误响应与日志
 * - 为各数据仓库提供 apiGet/apiPost/apiPut/apiPatch/apiDelete 便捷函数
 *
 * 说明：
 * 批次B起前端业务数据统一走后端 REST，不再直接读写 IndexedDB。
 */

/**
 * 后端基础地址
 * 说明：本地单机部署，端口默认 8010，避免与其它项目占用的 8000 冲突。
 */
import { addDiagnosticLog } from './diagnosticLogService'

export const API_BASE_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) || 'http://127.0.0.1:8010'

/** 默认请求超时（毫秒）：本地接口正常情况下远低于该值 */
const DEFAULT_TIMEOUT_MS = 10000

/**
 * Share identical in-flight GET requests across components/stores.
 * This is request coalescing only (not a response cache), so mutations never leave stale data behind.
 */
const pendingGetRequests = new Map<string, Promise<unknown>>()

/**
 * API 错误类型
 * 携带 HTTP 状态码与后端返回的中文错误信息，便于上层提示用户。
 */
export class ApiError extends Error {
  /** HTTP 状态码；网络失败时为 0 */
  readonly status: number
  /** 后端返回的错误详情 */
  readonly detail: string

  /**
   * 构造 API 错误
   * @param status HTTP 状态码
   * @param detail 错误详情
   */
  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** 查询参数值类型：字符串、数字、布尔或空值 */
type QueryValue = string | number | boolean | null | undefined

/**
 * 把参数对象拼装为查询字符串
 * @param params 参数对象；值为 undefined/null 的键会被跳过
 * @returns 形如 `?a=1&b=2` 的字符串；无有效参数时返回空串
 */
export function buildQuery(params?: Record<string, QueryValue>): string {
  if (!params) return ''

  // 过滤空值并统一编码
  const parts: string[] = []
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
  }

  return parts.length ? `?${parts.join('&')}` : ''
}

/** 单次请求的可选配置 */
export interface ApiRequestOptions {
  /** 查询参数对象 */
  query?: Record<string, QueryValue>
  /** JSON 请求体 */
  body?: unknown
  /** 超时毫秒数，默认 10000 */
  timeout?: number
}

/**
 * 发送一次 API 请求
 * @param method HTTP 方法
 * @param path 以 / 开头的接口路径，例如 `/api/courses`
 * @param options 查询参数、请求体与超时配置
 * @returns 解析后的 JSON 数据；响应体为空时返回 null
 * @throws ApiError 网络失败、超时或后端返回非 2xx
 */
export async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  options: ApiRequestOptions = {}
): Promise<T> {
  // 拼接完整地址
  const url = `${API_BASE_URL}${path}${buildQuery(options.query)}`

  // 记录请求开始，debug 级别避免生产环境刷屏
  const startedAt = Date.now()
  addDiagnosticLog('debug', 'api', '请求开始：' + method + ' ' + path)

  let response: Response
  try {
    response = await fetch(url, {
      method,
      headers: options.body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(options.timeout ?? DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    // 网络层失败（后端未启动、超时、跨域被拒）
    const message = error instanceof Error ? error.message : String(error)
    addDiagnosticLog('error', 'api', '请求无法连接：' + method + ' ' + path, message)
    console.error(`[api] ${method} ${url} 请求失败：${message}`)
    throw new ApiError(0, `无法连接本地后端服务：${message}`)
  }

  // 读取文本响应，兼容空响应体
  const raw: string = await response.text()

  if (!response.ok) {
    // 尝试解析 FastAPI 的 {"detail": "..."} 错误结构
    let detail: string = raw
    try {
      const parsed = JSON.parse(raw) as { detail?: unknown }
      if (typeof parsed.detail === 'string') {
        detail = parsed.detail
      }
    } catch {
      // 非 JSON 错误体：保留原始文本
    }
    addDiagnosticLog('error', 'api', '请求失败：' + method + ' ' + path + ' (' + response.status + ')', detail)
    console.error(`[api] ${method} ${url} 返回 ${response.status}：${detail}`)
    throw new ApiError(response.status, detail)
  }

  // 空响应体（例如 204）返回 null
  if (!raw) {
    addDiagnosticLog('debug', 'api', '请求成功：' + method + ' ' + path + '，耗时 ' + (Date.now() - startedAt) + 'ms')
    return null as T
  }

  // 记录成功日志
  console.debug(`[api] ${method} ${url} 成功（${raw.length} 字节）`)
  try {
    const parsed = JSON.parse(raw) as T
    addDiagnosticLog('debug', 'api', '请求成功：' + method + ' ' + path + '，耗时 ' + (Date.now() - startedAt) + 'ms')
    return parsed
  } catch (error) {
    addDiagnosticLog('error', 'api', '响应不是有效 JSON：' + method + ' ' + path, error)
    throw new ApiError(response.status, '后端响应格式异常：返回内容不是有效 JSON')
  }
}

/**
 * 发送 GET 请求
 * @param path 接口路径
 * @param query 查询参数
 */
export function apiGet<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  const normalizedQuery = query
    ? Object.fromEntries(Object.entries(query).sort(([left], [right]) => left.localeCompare(right)))
    : undefined
  const key = path + buildQuery(normalizedQuery)
  const existing = pendingGetRequests.get(key)
  if (existing) return existing as Promise<T>
  const pending = apiRequest<T>('GET', path, { query: normalizedQuery }).finally(() => {
    pendingGetRequests.delete(key)
  })
  pendingGetRequests.set(key, pending)
  return pending
}

/**
 * 发送 POST 请求
 * @param path 接口路径
 * @param body 请求体
 */
export function apiPost<T>(
  path: string,
  body?: unknown,
  options: Omit<ApiRequestOptions, 'body' | 'query'> = {},
): Promise<T> {
  return apiRequest<T>('POST', path, { body, ...options })
}

/**
 * 发送 PUT 请求
 * @param path 接口路径
 * @param body 请求体
 */
export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>('PUT', path, { body })
}

/**
 * 发送 PATCH 请求
 * @param path 接口路径
 * @param body 请求体
 */
export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return apiRequest<T>('PATCH', path, { body })
}

/**
 * 发送 DELETE 请求
 * @param path 接口路径
 * @param query 查询参数
 */
export function apiDelete<T>(path: string, query?: Record<string, QueryValue>): Promise<T> {
  return apiRequest<T>('DELETE', path, { query })
}
