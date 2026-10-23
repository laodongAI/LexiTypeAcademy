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
  /** 音色（可选） */
  voice?: string
  /** 音频格式（可选） */
  format?: 'mp3' | 'wav' | 'ogg'
}

/**
 * 为 CourseDraft 预缓存 TTS 音频（仅缓存英文内容）
 * @param draft 课程草稿
 * @param options 预缓存选项
 */
export async function precacheTTSForCourseDraft(draft: CourseDraft, options: ITtsPrecacheOptions = {}): Promise<void> {
  const limit = options.limit ?? 30
  const concurrency = Math.max(1, Math.min(options.concurrency ?? 3, 8))

  const uniqueTexts: string[] = []
  const seen = new Set<string>()

  for (const lesson of draft.lessons || []) {
    for (const item of lesson.items || []) {
      const text = String(item.english || '').trim()
      if (!text) continue
      if (seen.has(text)) continue
      seen.add(text)
      uniqueTexts.push(text)
      if (uniqueTexts.length >= limit) break
    }
    if (uniqueTexts.length >= limit) break
  }

  if (uniqueTexts.length === 0) return

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
          voice: options.voice,
          rate: options.rate,
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
