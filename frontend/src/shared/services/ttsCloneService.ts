/**
 * 克隆音色服务（OpenVoice v2）
 *
 * 职责：
 * - 上传参考音频创建克隆档案
 * - 查询与删除克隆档案
 * - 统一把后端业务错误转换为可读中文信息
 *
 * 说明：
 * - 参考音频只上传到本机后端，前端不做任何持久化
 * - 上传使用 multipart/form-data，不能复用 apiClient 的 JSON 封装
 */

import { TTS_BASE_URL } from './ttsEngineService'

/** 克隆档案的安全元数据（不含本地路径） */
export interface CloneProfile {
  /** 档案标识：vc_xxxxxxxx */
  id: string
  /** 用户填写的音色名称 */
  name: string
  /** 创建时间（ISO 字符串） */
  createdAt: string | null
  /** 参考音频时长（秒） */
  durationSec: number | null
  /** 归一化后的采样率 */
  sampleRate: number | null
  /** 状态：ready 表示可用 */
  status: string | null
  /** 参考音频字节数 */
  sizeBytes: number | null
  /** 最近使用时间 */
  lastUsedAt: string | null
}

/** 档案列表响应 */
export interface CloneListResult {
  success: boolean
  profiles: CloneProfile[]
  used: number
  max: number
  error?: string
  code?: string
}

/** 上传响应 */
export interface CloneUploadResult {
  success: boolean
  profile?: CloneProfile
  error?: string
  code?: string
}

/**
 * 查询全部克隆档案
 * @returns 档案列表与容量信息
 * @throws Error 后端不可达
 */
export async function listCloneProfiles(): Promise<CloneListResult> {
  const response = await fetch(`${TTS_BASE_URL}/api/tts/clone/refs`, {
    signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) {
    throw new Error(`读取克隆音色失败：HTTP ${response.status}`)
  }
  return (await response.json()) as CloneListResult
}

/**
 * 上传参考音频并创建克隆档案
 * @param file 参考音频文件（1–30 秒，≤10MB）
 * @param name 音色名称
 * @param consent 是否确认拥有声音使用权
 * @returns 上传结果；业务失败时 success=false
 * @throws Error 后端不可达
 */
export async function uploadCloneProfile(
  file: File,
  name: string,
  consent: boolean,
): Promise<CloneUploadResult> {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  form.append('consent', String(consent))

  // 克隆需要提取 embedding，耗时明显高于普通合成，单独放大超时
  const response = await fetch(`${TTS_BASE_URL}/api/tts/clone/refs`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(180000),
  })
  if (!response.ok) {
    throw new Error(`上传克隆音色失败：HTTP ${response.status}`)
  }
  return (await response.json()) as CloneUploadResult
}

/**
 * 删除克隆档案
 * @param profileId 档案标识
 * @returns 是否删除成功
 * @throws Error 后端不可达
 */
export async function deleteCloneProfile(
  profileId: string,
): Promise<{ success: boolean; error?: string; code?: string }> {
  const response = await fetch(
    `${TTS_BASE_URL}/api/tts/clone/refs/${encodeURIComponent(profileId)}`,
    { method: 'DELETE', signal: AbortSignal.timeout(15000) },
  )
  if (!response.ok) {
    throw new Error(`删除克隆音色失败：HTTP ${response.status}`)
  }
  return (await response.json()) as { success: boolean; error?: string; code?: string }
}
