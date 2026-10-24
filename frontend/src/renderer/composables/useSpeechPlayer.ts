/**
 * 课堂语音播放器（组合式函数）
 *
 * 设计要点：
 *   1. 全局单通道：同一时刻只允许一段音频播放，切换时先停止上一段；
 *   2. 取消机制：每次播放递增 token，异步返回后若 token 过期则丢弃；
 *   3. 统一走本地 TTS 服务，并复用其内存/IndexedDB 缓存；
 *   4. 支持单条播放与按顺序连播（整组听读、播放全文）。
 */

import { ref } from 'vue'
import { getTTSApiService } from '../../shared/services/ttsApiService'
import { useSettingsStore } from '../stores/settings'
import { createLogger } from '../../shared/utils/logger'

/** 模块级日志器：便于按 speech 过滤 */
const logger = createLogger('speech')

/** 当前正在播放的音频标识（组件可用于高亮） */
const playingKey = ref<string | null>(null)
/** 当前正在合成/加载的音频标识 */
const loadingKey = ref<string | null>(null)

/** 全局唯一的音频元素：保证不会出现双音轨 */
let audioElement: HTMLAudioElement | null = null
/** 播放令牌：用于取消过期的异步播放 */
let playToken = 0
/** 连播令牌：用于取消整组播放 */
let sequenceToken = 0

/**
 * 获取或创建音频元素
 * @returns HTMLAudioElement 实例
 */
function getAudioElement(): HTMLAudioElement {
  if (!audioElement) {
    audioElement = new Audio()
    // 音量保持默认，语速由 TTS 服务控制
    audioElement.preload = 'auto'
  }
  return audioElement
}

/**
 * 停止当前播放并释放令牌
 * @param reason 停止原因（仅用于日志）
 */
export function stopSpeech(reason = 'manual'): void {
  playToken += 1
  sequenceToken += 1
  loadingKey.value = null
  playingKey.value = null

  if (audioElement) {
    audioElement.pause()
    audioElement.removeAttribute('src')
    audioElement.load()
  }

  logger.debug('停止播放', { reason })
}

/**
 * 合成并播放一段文本
 * @param text 待朗读文本
 * @param key 业务标识（用于高亮与日志）
 * @param options 可选参数：语速、音色、引擎、语言；为空时读取设置页配置
 * @returns 播放是否成功启动
 */
export async function playSpeech(
  text: string,
  key: string,
  options: { rate?: number; voice?: string; engine?: string; language?: 'en' | 'zh' } = {},
): Promise<boolean> {
  // 单条播放：额外递增连播令牌，用于打断正在进行的整组连播
  return startPlayback(text, key, options, false)
}

/**
 * 兜底播放：先把音频下载为 Blob，再用 Blob URL 播放
 *
 * 说明：
 *   某些情况下媒体元素直接加载远端音频地址会失败（例如内容类型异常、
 *   服务端未按媒体请求处理），先 fetch 校验内容类型再播放可绕开该问题。
 *
 * @param audio 复用的音频元素
 * @param url 音频地址
 * @throws Error 当地址不可用或返回的不是音频内容时抛出
 */
async function playViaBlob(audio: HTMLAudioElement, url: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`音频地址返回 HTTP ${response.status}`)
  }

  const blob = await response.blob()
  const type = blob.type || response.headers.get('content-type') || ''
  if (!type.startsWith('audio/')) {
    throw new Error(`音频地址返回非音频内容：${type || 'unknown'}（${blob.size} 字节）`)
  }

  audio.src = URL.createObjectURL(blob)
  await audio.play()
}

/**
 * 内部播放实现（单条 / 连播共用）
 * @param text 待朗读文本
 * @param key 业务标识
 * @param options 可选参数：语速、音色、引擎、语言
 * @param fromSequence 是否由连播流程发起（连播时不得取消自身连播令牌）
 * @returns 播放是否成功启动
 */
async function startPlayback(
  text: string,
  key: string,
  options: { rate?: number; voice?: string; engine?: string; language?: 'en' | 'zh' },
  fromSequence: boolean,
): Promise<boolean> {
  const content = (text || '').trim()
  if (!content) return false

  // 读取设置页配置：未显式传入时使用统一存储的引擎/音色/语速/音量
  const settingsStore = useSettingsStore()
  let engine = options.engine || settingsStore.ttsEngine || 'melo'
  let voice = options.voice || settingsStore.ttsVoiceId || `${engine}:0`

  // 运行期兜底：openvoice 必须绑定真实克隆音色（clone:xxx）。
  // 历史设置或调用方误传 openvoice:0 时，后端会合成失败并返回空音频，表现为“有字幕没声音”。
  if (engine === 'openvoice' && !voice.startsWith('clone:')) {
    logger.warn('openvoice 未绑定克隆音色，自动回退默认音色', { engine, voice })
    engine = 'melo'
    voice = 'melo:0'
  }

  const rate = options.rate ?? settingsStore.ttsSpeed ?? 1
  // 老师引导等中文台词需显式传 zh；默认仍为英文，保持既有调用行为不变
  const language = options.language ?? 'en'
  const volume = Math.min(Math.max(settingsStore.ttsVolume ?? 1, 0), 1)

  // 抢占令牌：任何新播放都会让旧播放失效
  playToken += 1
  const token = playToken
  // 连播内部调用不能递增 sequenceToken，否则会误判为“连播被取消”
  if (!fromSequence) sequenceToken += 1

  const audio = getAudioElement()
  audio.pause()
  // 音量来自设置页，保证朗读与试听一致
  audio.volume = volume
  playingKey.value = null
  loadingKey.value = key

  logger.debug('开始合成', { key, chars: content.length, rate, engine, voice })

  // 最多尝试两次：首次失败通常来自本地缓存的损坏音频，第二次强制重新合成
  let lastUrl: string | null = null
  let lastError = ''

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const url = await getTTSApiService().getAudioUrl({
        text: content,
        language,
        engine,
        rate,
        voice,
        format: 'wav',
      }, { force: attempt > 1 })

      // 令牌过期或已被新播放取代：直接丢弃结果
      if (token !== playToken) {
        logger.debug('播放已被取代，丢弃结果', { key })
        return false
      }

      if (!url) {
        loadingKey.value = null
        logger.warn('语音合成失败或返回空地址', { key, attempt })
        return false
      }

      lastUrl = url
      audio.src = url
      loadingKey.value = null
      playingKey.value = key
      await audio.play()
      logger.info('开始播放', { key, attempt })
      return true
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)

      // 已被新播放取代时不再重试，避免抢占当前播放
      if (token !== playToken) {
        return false
      }

      if (attempt < 2) {
        // 首次失败：清空音源并强制重新合成，绕过可能损坏的本地缓存
        logger.warn('播放失败，强制重新合成后重试', { key, error: lastError })
        audio.removeAttribute('src')
        audio.load()
        loadingKey.value = key
      }
    }
  }

  // 两次直接播放均失败：下载为 Blob 再播放，绕开媒体元素的加载路径
  if (lastUrl) {
    try {
      await playViaBlob(audio, lastUrl)
      loadingKey.value = null
      playingKey.value = key
      logger.info('通过 Blob 兜底播放成功', { key })
      return true
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
  }

  loadingKey.value = null
  playingKey.value = null
  logger.warn('播放失败', { key, error: lastError, src: lastUrl })
  return false
}

/**
 * 按顺序连播多段文本
 * @param entries 播放条目（文本 + 业务标识 + 可选语言）
 * @param options 可选参数：语速、条目间隔
 * @returns 是否完整播放完成（被取消时返回 false）
 */
export async function playSpeechSequence(
  entries: Array<{ text: string; key: string; language?: 'en' | 'zh' }>,
  options: { rate?: number; gapMs?: number } = {},
): Promise<boolean> {
  const validEntries = entries.filter(entry => (entry.text || '').trim())
  if (validEntries.length === 0) return false

  sequenceToken += 1
  const token = sequenceToken
  const gapMs = options.gapMs ?? 180

  for (const entry of validEntries) {
    if (token !== sequenceToken) {
      logger.debug('连播已取消', { key: entry.key })
      return false
    }

    const started = await startPlayback(entry.text, entry.key, {
      rate: options.rate,
      language: entry.language,
    }, true)
    if (!started) continue

    // 等待当前音频播放结束，再进入下一条
    await waitForAudioEnd(token)
    if (token !== sequenceToken) return false

    if (gapMs > 0) {
      await new Promise(resolve => setTimeout(resolve, gapMs))
    }
  }

  // 连播结束后清理高亮
  if (token === sequenceToken) {
    playingKey.value = null
    logger.info('连播完成', { count: validEntries.length })
  }
  return token === sequenceToken
}

/**
 * 等待音频播放结束
 * @param token 连播令牌
 * @returns 播放结束或取消时 resolve
 */
function waitForAudioEnd(token: number): Promise<void> {
  return new Promise(resolve => {
    const audio = getAudioElement()

    /** 结束回调 */
    const handleEnded = () => {
      cleanup()
      resolve()
    }
    /** 出错回调：避免连播卡死 */
    const handleError = () => {
      cleanup()
      resolve()
    }
    /** 清理监听器 */
    const cleanup = () => {
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }

    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    // 令牌已失效时立即结束，防止悬挂
    if (token !== sequenceToken) {
      cleanup()
      resolve()
    }
  })
}

/**
 * 组合式函数入口
 * 说明：状态为模块级共享，任何调用方都能读到同一播放状态。
 */
export function useSpeechPlayer() {
  return {
    /** 当前播放标识 */
    playingKey,
    /** 当前加载标识 */
    loadingKey,
    /** 播放单条 */
    play: playSpeech,
    /** 按顺序连播 */
    playSequence: playSpeechSequence,
    /** 停止播放 */
    stop: stopSpeech,
  }
}
