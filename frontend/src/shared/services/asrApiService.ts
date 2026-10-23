/**
 * ASR API 客户端服务
 * 
 * 调用外部 ASR 服务进行语音识别和评分
 */

// API 配置
const ASR_API_CONFIG = {
  // 本地单机后端默认地址；可在 .env 中通过 VITE_ASR_API_URL 覆盖
  baseURL: import.meta.env.VITE_ASR_API_URL || 'http://127.0.0.1:8010',
  timeout: 60000,
  maxRetry: 2,
}

// 请求接口
export interface ASRRequest {
  /** 音频数据（Base64 或 Blob） */
  audio: string | Blob
  /** 语言 */
  language: 'en' | 'zh' | 'en-US' | 'zh-CN'
  /** 参考文本（用于评分） */
  referenceText?: string
  /** 是否启用评分 */
  enableScore?: boolean
}

// 评分详情
export interface ScoreDetail {
  /** 总分：0-100 */
  overall: number
  /** 准确度：0-100 */
  accuracy: number
  /** 流畅度：0-100 */
  fluency: number
  /** 完整度：0-100 */
  completeness: number
  /** 发音：0-100 */
  pronunciation: number
}

// 单词详情
export interface WordDetail {
  word: string
  startTime: number
  endTime: number
  confidence: number
  score?: number
}

// 响应接口
export interface ASRResponse {
  success: boolean
  /** 识别的文本 */
  text?: string
  /** 置信度：0-1 */
  confidence?: number
  /** 评分详情 */
  score?: ScoreDetail
  /** 单词详情 */
  words?: WordDetail[]
  /** 错误信息 */
  error?: string
  /** 错误码 */
  code?: string
}

// 分段识别请求
export interface SegmentASRRequest {
  audio: string | Blob
  language: 'en' | 'zh'
  segmentMode: 'sentence' | 'paragraph' | 'time'
  maxSegmentDuration?: number
}

// 分段识别响应
export interface SegmentASRResponse {
  success: boolean
  segments: Array<{
    id: string
    text: string
    startTime: number
    endTime: number
    confidence: number
  }>
  fullText: string
  error?: string
}

// 健康检查响应接口
export interface ASRHealthResponse {
  /** 引擎标识 */
  engine?: string
  /** 模型文件是否就绪 */
  modelReady?: boolean
  /** 模型是否已加载到内存 */
  loaded?: boolean
  /** 采样率 */
  sampleRate?: number
  /** 识别语言配置 */
  language?: string
  /** 加载错误信息 */
  error?: string | null
}

class ASRApiService {
  /**
   * 查询后端 ASR 健康状态
   *
   * 说明：
   *   仅访问本地后端 /api/asr/health，不触发模型加载，
   *   用于设置页“测试语音服务”按钮展示真实状态。
   */
  async health(): Promise<ASRHealthResponse> {
    const url = `${ASR_API_CONFIG.baseURL}/api/asr/health`

    const response = await fetch(url, {
      method: 'GET',
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    return (await response.json()) as ASRHealthResponse
  }

  /**
   * 识别语音
   */
  async recognize(request: ASRRequest): Promise<ASRResponse> {
    try {
      // 准备请求数据
      const formData = await this.prepareFormData(request)
      
      // 发起请求
      const response = await this.makeRequest('/api/asr/recognize', formData)
      
      return response
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'ASR_REQUEST_FAILED',
      }
    }
  }
  
  /**
   * 发音评分
   */
  async evaluatePronunciation(
    audio: string | Blob,
    referenceText: string,
    language: 'en' | 'zh' = 'en'
  ): Promise<ScoreDetail | null> {
    const response = await this.recognize({
      audio,
      language,
      referenceText,
      enableScore: true,
    })
    
    return response.success && response.score ? response.score : null
  }
  
  /**
   * 分段识别
   */
  async recognizeSegments(request: SegmentASRRequest): Promise<SegmentASRResponse> {
    try {
      const formData = await this.prepareFormData({
        audio: request.audio,
        language: request.language,
      })
      
      // 添加分段参数
      formData.append('segmentMode', request.segmentMode)
      if (request.maxSegmentDuration) {
        formData.append('maxSegmentDuration', request.maxSegmentDuration.toString())
      }
      
      const url = `${ASR_API_CONFIG.baseURL}/api/asr/segment`
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(ASR_API_CONFIG.timeout * 2), // 长音频需要更长时间
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return await response.json()
    } catch (error) {
      return {
        success: false,
        segments: [],
        fullText: '',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
  
  /**
   * 准备 FormData
   */
  private async prepareFormData(request: ASRRequest | { audio: string | Blob, language: string }): Promise<FormData> {
    const formData = new FormData()
    
    // 处理音频数据
    if (typeof request.audio === 'string') {
      // Base64 字符串
      const blob = this.base64ToBlob(request.audio)
      formData.append('audio', blob, 'recording.webm')
    } else {
      // Blob 对象
      formData.append('audio', request.audio, 'recording.webm')
    }
    
    // 添加其他参数
    formData.append('language', request.language)
    
    if ('referenceText' in request && request.referenceText) {
      formData.append('referenceText', request.referenceText)
    }
    
    if ('enableScore' in request && request.enableScore) {
      formData.append('enableScore', 'true')
    }
    
    return formData
  }
  
  /**
   * 发起 HTTP 请求
   */
  private async makeRequest(
    endpoint: string,
    formData: FormData,
    retryCount = 0
  ): Promise<ASRResponse> {
    try {
      const url = `${ASR_API_CONFIG.baseURL}${endpoint}`
      
      const response = await fetch(url, {
        method: 'POST',
        body: formData,
        signal: AbortSignal.timeout(ASR_API_CONFIG.timeout),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data: ASRResponse = await response.json()
      return data
    } catch (error) {
      // 重试逻辑
      if (retryCount < ASR_API_CONFIG.maxRetry) {
        await this.delay(2000 * (retryCount + 1))
        return this.makeRequest(endpoint, formData, retryCount + 1)
      }
      
      throw error
    }
  }
  
  /**
   * Base64 转 Blob
   */
  private base64ToBlob(base64: string): Blob {
    // 去掉 data URL 前缀
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64
    
    // 解码 Base64
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    
    // 创建 Blob
    return new Blob([bytes], { type: 'audio/webm' })
  }
  
  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

// 单例
let asrApiService: ASRApiService | null = null

export function getASRApiService(): ASRApiService {
  if (!asrApiService) {
    asrApiService = new ASRApiService()
  }
  return asrApiService
}

// 便捷函数
export async function recognizeSpeech(
  audio: string | Blob,
  language: 'en' | 'zh' = 'en'
): Promise<string | null> {
  const service = getASRApiService()
  const response = await service.recognize({ audio, language })
  return response.success && response.text ? response.text : null
}

export async function scorePronunciation(
  audio: string | Blob,
  referenceText: string,
  language: 'en' | 'zh' = 'en'
): Promise<ScoreDetail | null> {
  const service = getASRApiService()
  return service.evaluatePronunciation(audio, referenceText, language)
}
