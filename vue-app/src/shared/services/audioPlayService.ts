/**
 * 音频播放服务
 * 
 * 提供音频播放功能，支持本地音频文件和 TTS 合成音频
 */

import { getTTSApiService } from './ttsApiService'

export interface AudioPlayOptions {
  /** 音频源（文件路径或 TTS 文本） */
  source: string
  /** 音频类型 */
  type: 'file' | 'tts'
  /** 音量 (0-1) */
  volume?: number
  /** 播放速度 (0.5-2) */
  rate?: number
  /** 完成回调 */
  onEnded?: () => void
  /** 错误回调 */
  onError?: (error: Error) => void
}

export interface AudioPlayer {
  /** 播放音频 */
  play(options: AudioPlayOptions): Promise<void>
  /** 暂停播放 */
  pause(): void
  /** 停止播放 */
  stop(): void
  /** 是否正在播放 */
  isPlaying(): boolean
  /** 获取播放进度 (0-1) */
  getProgress(): number
  /** 设置播放进度 (0-1) */
  setProgress(progress: number): void
}

class AudioPlayService implements AudioPlayer {
  private audio: HTMLAudioElement | null = null
  private currentOptions: AudioPlayOptions | null = null
  private playing = false
  
  async play(options: AudioPlayOptions): Promise<void> {
    // 停止当前播放
    this.stop()
    
    this.currentOptions = options
    this.playing = true
    
    try {
      if (options.type === 'file') {
        await this.playFile(options)
      } else if (options.type === 'tts') {
        await this.playTTS(options)
      }
    } catch (error) {
      this.playing = false
      if (options.onError) {
        options.onError(error as Error)
      }
      throw error
    }
  }
  
  private async playFile(options: AudioPlayOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      this.audio = new Audio(options.source)
      
      if (options.volume !== undefined) {
        this.audio.volume = options.volume
      }
      
      if (options.rate !== undefined) {
        this.audio.playbackRate = options.rate
      }
      
      this.audio.onended = () => {
        this.playing = false
        if (options.onEnded) {
          options.onEnded()
        }
        resolve()
      }
      
      this.audio.onerror = () => {
        this.playing = false
        const error = new Error('Audio playback failed')
        if (options.onError) {
          options.onError(error)
        }
        reject(error)
      }
      
      this.audio.play().catch(reject)
    })
  }
  
  private async playTTS(options: AudioPlayOptions): Promise<void> {
    // 使用 TTS API 服务
    const ttsService = getTTSApiService()
    
    try {
      // 调用 API 生成音频
      const audioUrl = await ttsService.getAudioUrl({
        text: options.source,
        language: 'en', // TODO: 从 options 中获取语言
        rate: options.rate,
      })
      
      if (!audioUrl) {
        throw new Error('Failed to generate TTS audio')
      }
      
      // 播放生成的音频
      return this.playFile({
        ...options,
        source: audioUrl,
      })
    } catch (error) {
      // 如果 API 失败，降级到 Web Speech API
      if ('speechSynthesis' in window) {
        return this.playWebSpeech(options)
      }
      throw error
    }
  }
  
  /**
   * 使用 Web Speech API 播放（降级方案）
   */
  private async playWebSpeech(options: AudioPlayOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(options.source)
      
      if (options.volume !== undefined) {
        utterance.volume = options.volume
      }
      
      if (options.rate !== undefined) {
        utterance.rate = options.rate
      }
      
      utterance.onend = () => {
        this.playing = false
        if (options.onEnded) {
          options.onEnded()
        }
        resolve()
      }
      
      utterance.onerror = (event) => {
        this.playing = false
        const error = new Error(`TTS error: ${event.error}`)
        if (options.onError) {
          options.onError(error)
        }
        reject(error)
      }
      
      window.speechSynthesis.speak(utterance)
    })
  }
  
  pause(): void {
    if (this.audio && this.playing) {
      this.audio.pause()
      this.playing = false
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      this.playing = false
    }
  }
  
  stop(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.currentTime = 0
      this.audio = null
    }
    
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
    
    this.playing = false
    this.currentOptions = null
  }
  
  stopAll(): void {
    this.stop()
    window.speechSynthesis.cancel()
  }

  isPlaying(): boolean {
    return this.playing
  }
  
  getProgress(): number {
    if (this.audio) {
      return this.audio.currentTime / this.audio.duration || 0
    }
    return 0
  }
  
  setProgress(progress: number): void {
    if (this.audio && this.audio.duration) {
      this.audio.currentTime = progress * this.audio.duration
    }
  }
}

// 单例模式
let audioPlayService: AudioPlayService | null = null

export function getAudioPlayService(): AudioPlayer {
  if (!audioPlayService) {
    audioPlayService = new AudioPlayService()
  }
  return audioPlayService
}

// 便捷函数
export async function playAudio(source: string, type: 'file' | 'tts' = 'file'): Promise<void> {
  const service = getAudioPlayService()
  return service.play({ source, type })
}

export async function playTTS(text: string): Promise<void> {
  const service = getAudioPlayService()
  return service.play({ source: text, type: 'tts' })
}

export function stopAudio(): void {
  const service = getAudioPlayService()
  service.stop()
}

