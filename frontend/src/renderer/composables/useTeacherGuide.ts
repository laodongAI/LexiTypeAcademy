/**
 * 课堂老师语音引导（组合式函数）
 *
 * 设计目标：
 *   1. 用确定性中文模板把「进入课堂 / 切模式 / 报题 / 答对 / 答错 / 超时 / 完成」
 *      翻译成老师台词，并复用现有 TTS 播放器发声；
 *   2. 同一时刻只保留一句老师台词，新的高优先级事件会打断旧台词；
 *   3. 对重复事件做去重与最小间隔控制，避免课堂被语音打断得太碎；
 *   4. 可选在老师台词后自动播放示范音，实现「老师说什么 + 播放什么」的连贯引导。
 */

import { onBeforeUnmount, ref } from 'vue'
import { playSpeechSequence, stopSpeech } from './useSpeechPlayer'
import { createLogger } from '../../shared/utils/logger'

/** 日志器：按 classroom-teacher 过滤 */
const logger = createLogger('classroom-teacher')

/** 静音配置存储键：本机保存，避免每次进入课堂都要重新关闭 */
const MUTED_STORAGE_KEY = 'lexitype_teacher_voice_muted'

/** 台词优先级：数值越大越重要，高优先级可打断低优先级 */
export type TeacherPriority = 1 | 2 | 3

/** 单句老师台词参数 */
export interface TeacherSayOptions {
  /** 优先级：1=氛围提示，2=作答反馈，3=开场/总结等关键节点 */
  priority?: TeacherPriority
  /** 去重键：同一键在窗口期内只播一次 */
  dedupeKey?: string
  /** 去重窗口（毫秒），默认 8000 */
  dedupeWindowMs?: number
  /** 老师说完后自动播放的示范文本（英文），用于「先听一遍」 */
  demoText?: string
  /** 这一句播报结束后（或静音时立即）执行的回调，用于接续播放示范音 */
  onDone?: () => void
}

/**
 * 读取本机静音偏好
 * @returns 是否静音
 */
function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 老师语音引导入口
 */
export function useTeacherGuide() {
  /** 当前字幕文本 */
  const currentText = ref('')
  /** 字幕气泡是否可见 */
  const visible = ref(false)
  /** 是否正在播放老师语音 */
  const speaking = ref(false)
  /** 是否静音（仅关闭语音，字幕仍保留） */
  const muted = ref(readMuted())

  /** 当前台词优先级 */
  let activePriority = 0
  /** 上一次播报时间：用于最小间隔控制 */
  let lastSayAt = 0
  /** 播报令牌：用于丢弃过期的异步完成回调 */
  let talkToken = 0
  /** 去重键 → 最近一次播报时间 */
  const dedupeMap = new Map<string, number>()

  /**
   * 播报一句老师台词
   * @param text 台词内容（中文）
   * @param options 播报参数
   */
  function say(text: string, options: TeacherSayOptions = {}): void {
    const content = String(text || '').trim()
    if (!content) return

    const priority = options.priority ?? 2
    const now = Date.now()

    // 去重：同一教学节点短时间内不重复播报
    if (options.dedupeKey) {
      const last = dedupeMap.get(options.dedupeKey) ?? 0
      if (now - last < (options.dedupeWindowMs ?? 8000)) return
    }

    // 最小间隔：非关键台词在 1.2 秒内不重复抢占，避免刷屏式打断
    if (priority < 3 && now - lastSayAt < 1200) return
    // 低优先级台词不打断刚发生的高优先级反馈
    if (priority < activePriority && now - lastSayAt < 3000) return

    if (options.dedupeKey) dedupeMap.set(options.dedupeKey, now)
    activePriority = priority
    lastSayAt = now
    currentText.value = content
    visible.value = true

    // 静音时只更新字幕，不触发语音合成
    if (muted.value) {
      speaking.value = false
      logger.debug('老师台词已更新（静音）', { priority, chars: content.length })
      // 静音时仍需执行接续动作（例如播放示范音），否则课堂流程会断
      runOnDone(options.onDone, priority)
      return
    }

    // 新台词打断上一段：stopSpeech 会同时取消正在进行的连播
    stopSpeech('teacher-new-line')
    talkToken += 1
    const token = talkToken
    speaking.value = true

    /** 播放条目：老师中文台词 + 可选英文示范 */
    const entries: Array<{ text: string; key: string; language?: 'en' | 'zh' }> = [
      { text: content, key: `teacher:${priority}:${now}`, language: 'zh' },
    ]
    const demoText = String(options.demoText || '').trim()
    if (demoText) {
      entries.push({ text: demoText, key: `teacher-demo:${now}`, language: 'en' })
    }

    logger.debug('老师开始播报', {
      priority,
      chars: content.length,
      hasDemo: Boolean(demoText),
    })

    void playSpeechSequence(entries, { gapMs: 260 }).then((completed) => {
      // 台词已被更新台词取代时，不再修改播放状态
      if (token !== talkToken) return
      speaking.value = false
      logger.info('老师播报结束', { priority, completed })
      runOnDone(options.onDone, priority)
    })
  }

  /**
   * 安全执行接续回调
   * @param callback 回调函数
   * @param priority 触发优先级（仅用于日志）
   */
  function runOnDone(callback: (() => void) | undefined, priority: number): void {
    if (!callback) return
    try {
      callback()
    } catch (error) {
      logger.error('老师台词接续动作失败', { priority, error })
    }
  }

  /**
   * 重播当前字幕
   */
  function replay(): void {
    if (!currentText.value) return
    say(currentText.value, { priority: (activePriority || 2) as TeacherPriority, dedupeWindowMs: 0 })
  }

  /**
   * 设置静音开关
   * @param value 是否静音
   */
  function setMuted(value: boolean): void {
    muted.value = value
    try {
      localStorage.setItem(MUTED_STORAGE_KEY, value ? '1' : '0')
    } catch (error) {
      logger.warn('保存老师静音偏好失败', { error })
    }
    if (value) {
      stopSpeech('teacher-muted')
      speaking.value = false
    }
    logger.debug('老师语音静音状态更新', { muted: value })
  }

  /**
   * 停止当前播报
   */
  function stop(): void {
    talkToken += 1
    stopSpeech('teacher-manual')
    speaking.value = false
  }

  /** 离开课堂时务必停止语音，避免后台残留音轨 */
  onBeforeUnmount(() => {
    stop()
  })

  return {
    /** 当前字幕 */
    currentText,
    /** 气泡是否可见 */
    visible,
    /** 是否正在说话 */
    speaking,
    /** 是否静音 */
    muted,
    /** 播报台词 */
    say,
    /** 重播当前台词 */
    replay,
    /** 设置静音 */
    setMuted,
    /** 停止播报 */
    stop,
  }
}
