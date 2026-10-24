/**
 * 课程生成服务（renderer）
 *
 * 目的：
 * - 把“中文输入 → 翻译 → 课程生成 → CourseDraft 标准化”的流程抽离出组件
 * - 统一错误处理与调用方式，避免组件直接耦合 AIService 的具体 API 命名
 *
 * 注意：
 * - 不改变现有 UI/交互，仅提供复用的服务函数
 */

import { getAIService, type AIService } from '../../shared/services/ai'
import type { CourseDraft } from '../utils/aiCourseDraft'
import { courseDraftFromGenerationResponse } from '../utils/aiCourseDraft'
import { precacheTTSForCourseDraft } from './ttsPrecacheService'

export interface IGenerateCourseDraftFromChineseTextParams {
  courseName: string
  chineseText: string
  lessonCount: number
  wordsPerLesson: number
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  tags?: string[]
  /** 是否在生成后预缓存关键单元 TTS（默认 false） */
  precacheTTS?: boolean
  /** 预缓存上限（默认 30） */
  precacheLimit?: number
}

/**
 * 从中文内容生成 CourseDraft（中文→英文翻译→结构化课程生成→标准化）
 * @param params 生成参数
 * @param ai 可选注入（便于测试/复用），不传则使用单例
 */
export async function generateCourseDraftFromChineseText(
  params: IGenerateCourseDraftFromChineseTextParams,
  ai?: AIService
): Promise<CourseDraft> {
  const normalizedCourseName = params.courseName.trim()
  const normalizedChineseText = params.chineseText.trim()

  if (!normalizedCourseName) {
    throw new Error('请输入课程名称')
  }
  if (!normalizedChineseText) {
    throw new Error('请输入中文内容')
  }

  const service = ai ?? getAIService()

  const englishText = await service.translate({
    text: normalizedChineseText,
    sourceLang: 'zh',
    targetLang: 'en'
  })

  // 说明：历史原因这里复用 generateCourseFromAudio（其入参实际上是英文转写文本）
  const generated = await service.generateCourseFromAudio(
    englishText,
    params.lessonCount,
    params.wordsPerLesson
  )

  const draft = courseDraftFromGenerationResponse(generated, {
    title: normalizedCourseName || generated.courseName,
    difficulty: params.difficulty ?? 'intermediate',
    tags: (params.tags ?? []).filter(Boolean)
  })

  if (params.precacheTTS) {
    void precacheTTSForCourseDraft(draft, {
      limit: params.precacheLimit ?? 30,
      language: 'en',
      // 同时预缓存例句句子，保证“单词 + 句子”都能用所选音色直接播放
      includeExamples: true
    }).catch(() => {
      // 静默：预缓存不应影响主流程
    })
  }

  return draft
}
