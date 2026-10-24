/**
 * TTS 引擎与音色服务（renderer 设置页使用）
 *
 * 职责：
 * - 调用后端 /api/tts/engines 与 /api/tts/voices
 * - 在前端缓存一份引擎/音色目录，避免每次切换 Tab 都请求
 * - 把后端错误统一转换为可读中文错误
 *
 * 说明：
 * - 引擎与音色目录的唯一来源是后端 tts_engines.py，前端不硬编码任何音色
 * - 缓存只作用于本次页面会话，音色列表在切换引擎时按需拉取
 */

import { TTS_BASE_URL } from './ttsApiService'

/**
 * 重新导出基础地址，供克隆服务等模块复用
 * 说明：地址唯一来源是 ttsApiService，避免多处硬编码。
 */
export { TTS_BASE_URL }

/** 单个 TTS 引擎信息（后端 engine_to_dict 结构） */
export interface TtsEngineInfo {
  /** 引擎标识，如 melo / aishell3 / kokoro / matcha / openvoice */
  id: string
  /** 展示名称 */
  displayName: string
  /** 一句话说明 */
  description: string
  /** 引擎类型：vits / kokoro / matcha / openvoice */
  engineType: string
  /** 模型文件是否齐全 */
  available: boolean
  /** 不可用原因 */
  reason: string
  /** 许可证：界面必须展示 */
  license: string
  /** 支持语种 */
  languages: string[]
  /** 是否支持克隆音色 */
  supportsClone: boolean
  /** 默认音色标识 */
  defaultVoiceId: string | null
  /** 音色数量 */
  voiceCount: number
  /** 标称采样率 */
  sampleRate: number
  /** 当前是否已加载到内存 */
  loaded: boolean
}

/** 单个音色信息（后端 list_voices 结构） */
export interface TtsVoiceInfo {
  /** 音色标识：engineId:speakerId 或 clone:profileId */
  id: string
  /** 所属引擎 */
  engine: string
  /** 展示名称 */
  name: string
  /** 语种标识 */
  language: string
  /** 标签，如 clone */
  tags: string[]
  /** 试听文本 */
  previewText: string
  /** 克隆音色的参考音频时长 */
  durationSec?: number | null
  /** 克隆音色创建时间 */
  createdAt?: string | null
}

/** 后端引擎列表响应 */
interface TtsEnginesResponse {
  success: boolean
  engines: TtsEngineInfo[]
  error?: string
  code?: string
}

/** 后端音色列表响应 */
interface TtsVoicesResponse {
  success: boolean
  engine: string
  engineName: string
  numSpeakers: number
  voices: TtsVoiceInfo[]
  loaded: boolean
  supportsClone: boolean
  error?: string
  code?: string
}

// 引擎列表缓存：null 表示尚未加载
let engineCache: TtsEngineInfo[] | null = null
// 音色列表缓存：按引擎标识分组
const voiceCache = new Map<string, TtsVoiceInfo[]>()

/**
 * 读取后端 TTS 引擎目录
 * @param force 是否强制跳过缓存
 * @returns 引擎列表
 * @throws Error 后端不可达或返回业务失败
 */
export async function fetchTtsEngines(force = false): Promise<TtsEngineInfo[]> {
  if (!force && engineCache) return engineCache

  const response = await fetch(`${TTS_BASE_URL}/api/tts/engines`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    throw new Error(`读取 TTS 引擎失败：HTTP ${response.status}`)
  }

  const data = (await response.json()) as TtsEnginesResponse
  if (!data.success) {
    throw new Error(data.error || '读取 TTS 引擎失败')
  }

  engineCache = data.engines || []
  return engineCache
}

/**
 * 读取指定引擎的音色列表
 * @param engineId 引擎标识
 * @param force 是否强制跳过缓存
 * @returns 音色列表
 * @throws Error 后端不可达或返回业务失败
 */
export async function fetchTtsVoices(
  engineId: string,
  force = false,
): Promise<TtsVoiceInfo[]> {
  const cached = voiceCache.get(engineId)
  if (!force && cached) return cached

  const response = await fetch(
    `${TTS_BASE_URL}/api/tts/voices?engine=${encodeURIComponent(engineId)}`,
    { signal: AbortSignal.timeout(10000) },
  )
  if (!response.ok) {
    throw new Error(`读取音色失败：HTTP ${response.status}`)
  }

  const data = (await response.json()) as TtsVoicesResponse
  if (!data.success) {
    throw new Error(data.error || '读取音色失败')
  }

  const voices = data.voices || []
  voiceCache.set(engineId, voices)
  return voices
}

/**
 * 使音色缓存失效
 * 说明：上传/删除克隆音色后必须调用，避免列表陈旧。
 * @param engineId 可选：只清理指定引擎；不传则清理全部
 */
export function invalidateVoiceCache(engineId?: string): void {
  if (engineId) {
    voiceCache.delete(engineId)
  } else {
    voiceCache.clear()
  }
}

/**
 * 释放后端当前驻留的 TTS 引擎
 * @returns 是否成功
 */
export async function unloadTtsEngine(): Promise<boolean> {
  const response = await fetch(`${TTS_BASE_URL}/api/tts/unload`, {
    method: 'POST',
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) return false
  const data = (await response.json()) as { success?: boolean }
  // 引擎状态变化后引擎列表的 loaded 字段需要重新读取
  engineCache = null
  return Boolean(data.success)
}
