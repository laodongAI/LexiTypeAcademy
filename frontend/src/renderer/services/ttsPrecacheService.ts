/**
 * TTS 预缓存服务（renderer）
 *
 * 目的：
 * - 在“生成课程”后可选地预生成/预缓存关键单元音频
 * - 依赖 shared/services/ttsApiService 的 IndexedDB 写入能力，实现统一缓存策略
 *
 * 设计取舍：
 * - 默认不启用，由调用方显式开启（避免影响生成速度）
 * - 控制并发与数量上限，避免短时间触发大量网络请求
 */

import type { CourseDraft } from '../utils/aiCourseDraft'
import { getTTSApiService } from '../../shared/services/ttsApiService'
import { useSettingsStore } from '../stores/settings'
import { createLogger } from '../../shared/utils/logger'

/** 日志器 */
const logger = createLogger('tts-precache')

export interface ITtsPrecacheOptions {
  /** 最大预缓存单元数（去重后） */
  limit?: number
  /** 并发数（建议 2~5） */
  concurrency?: number
  /** 语言（默认 en） */
  language?: 'en' | 'zh' | 'en-US' | 'zh-CN'
  /** 语速 */
  rate?: number
  /** 音调 */
  pitch?: number
  /** 音色（可选）；为空时读取设置页当前音色 */
  voice?: string
  /** 引擎（可选）；为空时读取设置页当前引擎 */
  engine?: string
  /** 音频格式（可选） */
  format?: 'mp3' | 'wav' | 'ogg'
  /** 是否把例句句子也纳入预缓存（默认 false，先保证词条本身） */
  includeExamples?: boolean
}

/**
 * 为 CourseDraft 预缓存 TTS 音频（仅缓存英文内容）
 * @param draft 课程草稿
 * @param options 预缓存选项
 */
export async function precacheTTSForCourseDraft(draft: CourseDraft, options: ITtsPrecacheOptions = {}): Promise<void> {
  const settingsStore = useSettingsStore()
  // 引擎与音色：显式参数优先，否则读取设置页当前选择
  const engine = options.engine || settingsStore.ttsEngine || 'melo'
  const voice = options.voice || settingsStore.ttsVoiceId || `${engine}:0`
  const rate = options.rate ?? settingsStore.ttsSpeed ?? 1

  // 克隆音色会额外占用大量内存，必须串行预生成
  const isClone = engine === 'openvoice' || voice.startsWith('clone:')
  const limit = options.limit ?? 30
  const concurrency = isClone
    ? 1
    : Math.max(1, Math.min(options.concurrency ?? 3, 8))

  const uniqueTexts: string[] = []
  const seen = new Set<string>()

  /** 收集文本：去重并受 limit 限制 */
  function collect(text: string): void {
    if (uniqueTexts.length >= limit) return
    const content = String(text || '').trim()
    if (!content || seen.has(content)) return
    seen.add(content)
    uniqueTexts.push(content)
  }

  // 第一轮：词条/句子本身（句子型课程的 english 就是句子）
  for (const lesson of draft.lessons || []) {
    for (const item of lesson.items || []) {
      collect(item.english)
      if (uniqueTexts.length >= limit) break
    }
    if (uniqueTexts.length >= limit) break
  }

  // 第二轮：可选例句。放在词条之后，避免例句挤占核心词条的缓存名额
  if (options.includeExamples && uniqueTexts.length < limit) {
    for (const lesson of draft.lessons || []) {
      for (const item of lesson.items || []) {
        for (const example of item.examples ?? []) {
          collect(example)
          if (uniqueTexts.length >= limit) break
        }
        if (uniqueTexts.length >= limit) break
      }
      if (uniqueTexts.length >= limit) break
    }
  }

  if (uniqueTexts.length === 0) return

  logger.info('开始预缓存 TTS', {
    count: uniqueTexts.length,
    engine,
    voice,
    rate,
    includeExamples: Boolean(options.includeExamples),
  })

  const tts = getTTSApiService()

  let index = 0
  const workers = Array.from({ length: concurrency }, async () => {
    while (index < uniqueTexts.length) {
      const current = uniqueTexts[index]
      index += 1

      try {
        // 说明：调用 generate 会触发 IndexedDB 写入（失败静默降级）
        await tts.generate({
          text: current,
          language: options.language ?? 'en',
          engine,
          voice,
          rate,
          pitch: options.pitch,
          format: options.format,
        })
      } catch {
        // 静默：预缓存不应影响主流程
      }
    }
  })

  await Promise.all(workers)
}
