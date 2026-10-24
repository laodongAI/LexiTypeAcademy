/**
 * TTS API 客户端服务
 * 
 * 调用外部 TTS 服务生成语音
 */

import { hashStringToBase36 } from '../utils/hash'
import { commonRepository } from '../database/repositories/commonRepository'
import { databaseReady } from '../database'

/**
 * TTS 后端基础地址（唯一来源）
 * 说明：优先 TTS 专用变量，其次通用后端变量，最后回落到本地默认端口。
 *      其它 TTS 相关服务必须复用该常量，避免多处硬编码导致地址分叉。
 */
export const TTS_BASE_URL: string =
  (import.meta.env.VITE_TTS_API_URL as string | undefined) ||
  (import.meta.env.VITE_API_URL as string | undefined) ||
  'http://127.0.0.1:8010'

// API 配置
const TTS_API_CONFIG = {
  // 复用统一的基础地址
  baseURL: TTS_BASE_URL,
  timeout: 30000,
  maxRetry: 3,
}

// 请求接口
export interface TTSRequest {
  /** 要转换的文本 */
  text: string
  /** 语言 */
  language: 'en' | 'zh' | 'en-US' | 'zh-CN'
  /** 音色（可选）：engineId:speakerId 或 clone:profileId */
  voice?: string
  /** 引擎标识（可选）：为空时由后端按 voice 前缀或默认配置推导 */
  engine?: string
  /** 语速：0.5-2.0，默认 1.0 */
  rate?: number
  /** 音调：0.5-2.0，默认 1.0 */
  pitch?: number
  /** 音频格式 */
  format?: 'mp3' | 'wav' | 'ogg'
}

// 响应接口
export interface TTSResponse {
  success: boolean
  /** Base64 编码的音频数据 */
  audio?: string
  /** 音频文件 URL */
  url?: string
  /** 音频时长（秒） */
  duration?: number
  /** 错误信息 */
  error?: string
  /** 错误码 */
  code?: string
  /** 实际使用的引擎标识（后端返回） */
  engine?: string
  /** 实际输出格式（后端返回，如 wav/mp3/ogg） */
  format?: string
  /** 采样率（后端返回） */
  sampleRate?: number
  /** 后端缓存键（后端返回） */
  cacheKey?: string
}

// 健康检查响应接口
export interface TTSHealthResponse {
  /** 引擎标识 */
  engine?: string
  /** 引擎名称 */
  engineName?: string
  /** 配置的默认引擎及其依赖模型文件是否就绪 */
  modelReady?: boolean
  /** 配置的默认引擎是否可用 */
  defaultEngineAvailable?: boolean
  /** 默认引擎不可用的原因 */
  defaultEngineReason?: string | null
  /** 模型是否已加载到内存 */
  loaded?: boolean
  /** 采样率 */
  sampleRate?: number
  /** 单次合成字符上限 */
  maxChars?: number
  /** 加载错误信息 */
  error?: string | null
  /** 引擎总数（后端返回） */
  engineCount?: number
  /** 可用引擎数量（后端返回） */
  availableEngineCount?: number
  /** 克隆档案数量（后端返回） */
  cloneProfileCount?: number
  /** 当前引擎说话人数 */
  numSpeakers?: number
}

// 缓存接口
interface CacheItem {
  audio: string
  url?: string
  duration: number
  timestamp: number
}

class TTSApiService {
  private cache = new Map<string, CacheItem>()
  private pendingRequests = new Map<string, Promise<TTSResponse>>()
  
  /**
   * 生成语音
   * @param request 合成请求
   * @param options.force 为 true 时跳过内存与 IndexedDB 缓存，强制重新合成
   */
  async generate(
    request: TTSRequest,
    options: { force?: boolean } = {},
  ): Promise<TTSResponse> {
    const cacheKey = this.getCacheKey(request)
    const modelKey = this.getModelKey(request)

    // 先查内存缓存（强制刷新时跳过）
    if (!options.force) {
      const cached = this.getFromCache(cacheKey)
      if (cached) {
        return {
          success: true,
          audio: cached.audio,
          url: cached.url,
          duration: cached.duration,
        }
      }

      // 再查 IndexedDB 持久化缓存（内部会校验文件头，损坏时自动删除）
      const persistedBlob = await this.getFromPersistentCache(request.text, modelKey)
      if (persistedBlob) {
        const blobUrl = URL.createObjectURL(persistedBlob)
        this.saveToCache(cacheKey, {
          audio: '',
          url: blobUrl,
          duration: 0,
          timestamp: Date.now(),
        })
        return {
          success: true,
          url: blobUrl,
          duration: 0,
        }
      }
    }

    // 检查是否有相同请求正在进行
    const pending = this.pendingRequests.get(cacheKey)
    if (pending) {
      return pending
    }

    // 发起新请求
    const requestPromise = this.makeRequest(request, cacheKey)
    this.pendingRequests.set(cacheKey, requestPromise)
    
    try {
      const response = await requestPromise
      return response
    } finally {
      this.pendingRequests.delete(cacheKey)
    }
  }
  
  /**
   * 发起 HTTP 请求
   */
  private async makeRequest(
    request: TTSRequest,
    cacheKey: string,
    retryCount = 0
  ): Promise<TTSResponse> {
    try {
      const url = `${TTS_API_CONFIG.baseURL}/api/tts/generate`
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        // 克隆音色需要先合成基底再做音色迁移，耗时明显更长
        signal: AbortSignal.timeout(this.resolveTimeout(request)),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data: TTSResponse = await response.json()
      
      if (data.success && data.audio) {
        // 写入 IndexedDB 统一缓存（失败静默降级，不影响播放）
        void this.saveToPersistentCache({
          text: request.text,
          model: this.getModelKey(request),
          audioBase64: data.audio,
          format: request.format,
        })

        // 保存到内存缓存
        this.saveToCache(cacheKey, {
          audio: data.audio,
          url: data.url,
          duration: data.duration || 0,
          timestamp: Date.now(),
        })
      }
      
      return data
    } catch (error) {
      // 重试逻辑
      if (retryCount < TTS_API_CONFIG.maxRetry) {
        await this.delay(1000 * (retryCount + 1))
        return this.makeRequest(request, cacheKey, retryCount + 1)
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'TTS_REQUEST_FAILED',
      }
    }
  }
  
  /**
   * 批量生成语音
   */
  async batchGenerate(requests: TTSRequest[]): Promise<TTSResponse[]> {
    // 并发请求（限制并发数为 5）
    const results: TTSResponse[] = []
    const batchSize = 5
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize)
      const batchResults = await Promise.all(
        batch.map(req => this.generate(req))
      )
      results.push(...batchResults)
    }
    
    return results
  }
  
  /**
   * 获取音频 URL
   * @param request 合成请求
   * @param options.force 为 true 时跳过缓存强制重新合成（用于播放失败后的兜底重试）
   */
  async getAudioUrl(
    request: TTSRequest,
    options: { force?: boolean } = {},
  ): Promise<string | null> {
    const response = await this.generate(request, options)
    
    if (!response.success) {
      return null
    }
    
    if (response.url) {
      // 兼容服务端返回相对路径（例如 /audio/xxx.mp3）
      if (response.url.startsWith('http://') || response.url.startsWith('https://') || response.url.startsWith('blob:') || response.url.startsWith('data:')) {
        return response.url
      }
      if (response.url.startsWith('/')) {
        return `${TTS_API_CONFIG.baseURL}${response.url}`
      }
      return `${TTS_API_CONFIG.baseURL}/${response.url}`
    }
    
    if (response.audio) {
      return this.base64ToUrl(response.audio, request.format)
    }
    
    return null
  }

  /**
   * Base64 转 Blob URL
   */
  private base64ToUrl(base64: string, format?: TTSRequest['format']): string {
    const blob = this.base64ToBlob(base64, format)
    return URL.createObjectURL(blob)
  }

  /**
   * Base64 转 Blob（用于播放与 IndexedDB 缓存）
   */
  private base64ToBlob(base64: string, format?: TTSRequest['format']): Blob {
    const trimmed = base64.trim()

    // 如果服务端直接返回 data: URL，优先解析其 mime
    let mimeFromDataUrl: string | null = null
    if (trimmed.startsWith('data:')) {
      const match = trimmed.match(/^data:([^;]+);base64,/)?.[1]
      if (match) {
        mimeFromDataUrl = match
      }
    }

    // 去掉 data URL 前缀
    const base64Data = trimmed.includes(',') ? trimmed.split(',')[1] : trimmed

    const mime = mimeFromDataUrl || this.guessAudioMime(base64Data, format)

    // 解码 Base64
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    return new Blob([bytes], { type: mime })
  }

  private guessAudioMime(base64Data: string, format?: TTSRequest['format']): string {
    if (format === 'wav') return 'audio/wav'
    if (format === 'ogg') return 'audio/ogg'
    if (format === 'mp3') return 'audio/mpeg'

    // 通过文件头猜测（避免服务端不带 mime 时播放失败）
    // WAV: RIFF -> base64 常见前缀 UklGR
    if (base64Data.startsWith('UklGR')) return 'audio/wav'
    // OGG: OggS -> base64 常见前缀 T2dnUw
    if (base64Data.startsWith('T2dnUw')) return 'audio/ogg'
    // MP3: ID3 -> SUQz，或帧头 /+MYx 等
    if (base64Data.startsWith('SUQz') || base64Data.startsWith('/+MY')) return 'audio/mpeg'

    return 'audio/mpeg'
  }

  /**
   * 生成“模型配置”标识（用于 IndexedDB 缓存维度区分）
   * 说明：引擎与音色都属于音频内容维度，必须进入缓存键
   */
  private getModelKey(request: TTSRequest): string {
    const { language, engine = '', voice = '', rate = 1, pitch = 1, format = '' } = request
    return `tts|${engine}|${language}|${voice}|${rate}|${pitch}|${format}`
  }

  /**
   * 按请求类型解析超时毫秒数
   * @param request 合成请求
   * @returns 超时毫秒数
   */
  private resolveTimeout(request: TTSRequest): number {
    // 克隆音色（openvoice / clone: 前缀）走音色迁移，放宽到 3 分钟
    const isClone =
      request.engine === 'openvoice' || (request.voice || '').startsWith('clone:')
    return isClone ? 180000 : TTS_API_CONFIG.timeout
  }

  /**
   * 从 IndexedDB 获取缓存 Blob
   */
  private async getFromPersistentCache(text: string, model: string): Promise<Blob | null> {
    if (!databaseReady) return null
    try {
      const cached = await commonRepository.getTtsCache(text, model)
      if (!cached) return null

      const blob = cached.audioBlob

      // 空数据或非 Blob：缓存已损坏，删除后交给重新合成
      if (!(blob instanceof Blob) || blob.size < 64) {
        await commonRepository.deleteTtsCache(text, model)
        console.warn('[tts] 语音缓存无效（空数据），已删除并重新合成', { textLen: text.length })
        return null
      }

      // 校验音频文件头：避免把损坏/非音频数据交给 <audio> 导致 “no supported source”
      const head = new Uint8Array(await blob.slice(0, 12).arrayBuffer())
      const b0 = head[0] ?? 0
      const b1 = head[1] ?? 0
      const b2 = head[2] ?? 0
      const b3 = head[3] ?? 0
      const isWav = b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 // "RIFF"
      const isOgg = b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53 // "OggS"
      const isMp3 = b0 === 0x49 && b1 === 0x44 && b2 === 0x33 // "ID3"
      const isAac = b0 === 0xff && (b1 & 0xf6) === 0xf0 // ADTS 帧头
      if (!isWav && !isOgg && !isMp3 && !isAac) {
        await commonRepository.deleteTtsCache(text, model)
        console.warn('[tts] 语音缓存文件头异常，已删除并重新合成', { size: blob.size })
        return null
      }

      return blob
    } catch {
      return null
    }
  }

  /**
   * 写入 IndexedDB 缓存（仅用于可克隆的 Blob）
   */
  private async saveToPersistentCache(params: {
    text: string
    model: string
    audioBase64: string
    format?: TTSRequest['format']
  }): Promise<void> {
    if (!databaseReady) return
    try {
      const blob = this.base64ToBlob(params.audioBase64, params.format)
      await commonRepository.upsertTtsCache({
        text: params.text,
        model: params.model,
        audioBlob: blob,
        createdAt: Date.now(),
      })
    } catch {
      // 静默降级：不阻塞 TTS 生成/播放
    }
  }
  
  /**
   * 生成缓存键
   */
  private getCacheKey(request: TTSRequest): string {
    const { text, language, engine = '', voice = '', rate = 1, pitch = 1, format = '' } = request
    return `tts_${engine}_${language}_${voice}_${rate}_${pitch}_${format}_${hashStringToBase36(text)}`
  }
  
  /**
   * 字符串哈希
   */
  
  /**
   * 从缓存获取
   */
  private getFromCache(key: string): CacheItem | null {
    const item = this.cache.get(key)
    if (!item) return null
    
    // 缓存 24 小时过期
    const maxAge = 24 * 60 * 60 * 1000
    if (Date.now() - item.timestamp > maxAge) {
      this.cache.delete(key)
      return null
    }
    
    return item
  }
  
  /**
   * 保存到缓存
   */
  private saveToCache(key: string, item: CacheItem): void {
    this.cache.set(key, item)
    
    // 限制缓存大小（最多 100 个）
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
  }
  
  /**
   * 查询后端 TTS 健康状态
   *
   * 说明：
   *   仅访问本地后端 /api/tts/health，不触发模型加载，
   *   用于设置页“测试语音服务”按钮展示真实状态。
   */
  async health(): Promise<TTSHealthResponse> {
    const url = `${TTS_API_CONFIG.baseURL}/api/tts/health`

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return (await response.json()) as TTSHealthResponse
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear()
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 单例
let ttsApiService: TTSApiService | null = null

export function getTTSApiService(): TTSApiService {
  if (!ttsApiService) {
    ttsApiService = new TTSApiService()
  }
  return ttsApiService
}

// 便捷函数
/**
 * 生成一段语音并返回可播放地址
 * @param text 文本
 * @param language 语言（默认英文）
 * @param options 可选音色参数：引擎/音色/语速；不传则由后端使用默认音色
 * @returns 音频地址；失败返回 null
 */
export async function generateSpeech(
  text: string,
  language: 'en' | 'zh' = 'en',
  options: { engine?: string; voice?: string; rate?: number } = {},
): Promise<string | null> {
  const service = getTTSApiService()
  return service.getAudioUrl({
    text,
    language,
    engine: options.engine,
    voice: options.voice,
    rate: options.rate,
  })
}
