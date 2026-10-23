/**
 * 录音服务
 * 
 * 提供音频录制功能
 */

export interface RecordOptions {
  /** 音频格式 */
  mimeType?: string
  /** 采样率 */
  sampleRate?: number
  /** 声道数 */
  channelCount?: number
  /** 最大录音时长（毫秒） */
  maxDuration?: number
  /** 开始录音回调 */
  onStart?: () => void
  /** 停止录音回调 */
  onStop?: (audioBlob: Blob) => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

export interface AudioRecorder {
  /** 开始录音 */
  startRecording(options?: RecordOptions): Promise<void>
  /** 停止录音 */
  stopRecording(): Promise<Blob>
  /** 是否正在录音 */
  isRecording(): boolean
  /** 获取录音时长（毫秒） */
  getDuration(): number
}

class AudioRecordService implements AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null
  private audioChunks: Blob[] = []
  private recording = false
  private startTime = 0
  private currentOptions: RecordOptions | null = null
  private maxDurationTimer: number | null = null
  
  async startRecording(options: RecordOptions = {}): Promise<void> {
    if (this.recording) {
      throw new Error('Already recording')
    }
    
    this.currentOptions = options
    this.audioChunks = []
    
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: options.sampleRate || 44100,
          channelCount: options.channelCount || 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      })
      
      // 创建 MediaRecorder
      const mimeType = options.mimeType || this.getSupportedMimeType()
      this.mediaRecorder = new MediaRecorder(stream, { mimeType })
      
      // 监听数据
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data)
        }
      }
      
      // 监听停止
      this.mediaRecorder.onstop = () => {
        const audioBlob = new Blob(this.audioChunks, { type: mimeType })
        
        // 停止所有音轨
        stream.getTracks().forEach(track => track.stop())
        
        if (this.currentOptions?.onStop) {
          this.currentOptions.onStop(audioBlob)
        }
        
        this.recording = false
      }
      
      // 监听错误
      this.mediaRecorder.onerror = (event) => {
        const error = new Error(`Recording error: ${event}`)
        if (this.currentOptions?.onError) {
          this.currentOptions.onError(error)
        }
        this.recording = false
      }
      
      // 开始录音
      this.mediaRecorder.start()
      this.recording = true
      this.startTime = Date.now()
      
      if (options.onStart) {
        options.onStart()
      }
      
      // 设置最大录音时长
      if (options.maxDuration) {
        this.maxDurationTimer = window.setTimeout(() => {
          this.stopRecording()
        }, options.maxDuration)
      }
      
    } catch (error) {
      this.recording = false
      if (options.onError) {
        options.onError(error as Error)
      }
      throw error
    }
  }
  
  async stopRecording(): Promise<Blob> {
    if (!this.recording || !this.mediaRecorder) {
      throw new Error('Not recording')
    }
    
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('MediaRecorder not initialized'))
        return
      }

      const mediaRecorder = this.mediaRecorder
      
      // 清除最大时长定时器
      if (this.maxDurationTimer) {
        clearTimeout(this.maxDurationTimer)
        this.maxDurationTimer = null
      }
      
      // 监听停止事件
      const originalOnStop = mediaRecorder.onstop
      mediaRecorder.onstop = (event) => {
        if (originalOnStop) {
          originalOnStop.call(mediaRecorder, event)
        }
        
        const audioBlob = new Blob(this.audioChunks, {
          type: mediaRecorder.mimeType || 'audio/webm'
        })
        resolve(audioBlob)
      }
      
      mediaRecorder.stop()
    })
  }
  
  isRecording(): boolean {
    return this.recording
  }
  
  getDuration(): number {
    if (!this.recording) {
      return 0
    }
    return Date.now() - this.startTime
  }
  
  private getSupportedMimeType(): string {
    const types = [
      'audio/webm',
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type
      }
    }
    
    return 'audio/webm' // 默认
  }
}

// 单例模式
let audioRecordService: AudioRecordService | null = null

export function getAudioRecordService(): AudioRecorder {
  if (!audioRecordService) {
    audioRecordService = new AudioRecordService()
  }
  return audioRecordService
}

// 便捷函数
export async function startRecording(options?: RecordOptions): Promise<void> {
  const service = getAudioRecordService()
  return service.startRecording(options)
}

export async function stopRecording(): Promise<Blob> {
  const service = getAudioRecordService()
  return service.stopRecording()
}

export function isRecording(): boolean {
  const service = getAudioRecordService()
  return service.isRecording()
}

// 辅助函数：将 Blob 转换为 Base64
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.split(',')[1]) // 去掉 data:audio/webm;base64, 前缀
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 辅助函数：将 Blob 保存为文件
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
