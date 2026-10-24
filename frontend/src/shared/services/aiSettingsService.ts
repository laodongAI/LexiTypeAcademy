/**
 * 大模型配置服务
 *
 * 职责：
 * - 读取后端维护的服务商目录（GET /api/ai/providers）
 * - 读取安全配置摘要（GET /api/ai/settings，不含密钥）
 * - 保存并应用配置（PUT /api/ai/settings）
 * - 使用草稿配置做连通性测试（POST /api/ai/test）
 *
 * 说明：
 * - 服务商目录唯一来源是后端 ai_providers.py，前端不做硬编码
 * - 密钥只写不读：界面只能拿到 keyTail 与 keyConfigured 状态
 */

import { apiGet, apiPost, apiPut } from './apiClient'

/** 服务商目录条目 */
export interface AIProviderInfo {
  /** 服务商标识 */
  provider: string
  /** 展示名 */
  displayName: string
  /** 一句话说明 */
  description: string
  /** 默认 Base URL；custom 为空 */
  baseUrl: string
  /** 预置模型列表 */
  models: string[]
  /** 是否必须填写密钥 */
  keyRequired: boolean
  /** 是否允许自定义 Base URL */
  allowCustomBaseUrl: boolean
  /** 官方文档链接 */
  docsUrl: string
  /** 模型输入提示 */
  modelHint: string
}

/** 已保存档案的安全摘要 */
export interface AIProfileSummary {
  /** 服务商标识 */
  provider: string
  /** 展示名 */
  displayName: string
  /** 已保存地址 */
  baseUrl: string
  /** 已保存模型 */
  model: string
  /** 采样温度 */
  temperature: number
  /** 最大输出 token */
  maxTokens: number
  /** 超时秒数 */
  timeoutSeconds: number
  /** 是否已配置密钥 */
  keyConfigured: boolean
  /** 密钥尾号（只读） */
  keyTail: string
}

/** 当前生效档案（表单回填用） */
export interface AIActiveProfile {
  provider: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeoutSeconds: number
}

/** 安全配置摘要 */
export interface AISafeSettings {
  activeProvider: string
  providerLabel: string
  configured: boolean
  keySource: 'file' | 'env' | 'none' | string
  keyTail: string
  model: string
  baseUrl: string
  timeoutSeconds: number
  maxTokens: number
  activeProfile: AIActiveProfile | null
  profiles: AIProfileSummary[]
  configFile: string
}

/** 保存请求：单个档案 */
export interface AIProfilePayload {
  provider: string
  baseUrl?: string
  model?: string
  temperature?: number
  maxTokens?: number
  timeoutSeconds?: number
  apiKey?: string
  clearApiKey?: boolean
}

/** 保存请求：整份配置 */
export interface AISavePayload {
  activeProvider?: string
  profiles: AIProfilePayload[]
}

/** 连通性测试草稿 */
export interface AITestDraft {
  provider?: string
  baseUrl?: string
  model?: string
  apiKey?: string
  timeoutSeconds?: number
  maxTokens?: number
}

/** 连通性测试结果 */
export interface AITestResult {
  ok: boolean
  model?: string
  latencyMs?: number
}

/**
 * 读取服务商目录
 * @returns 服务商列表
 */
export async function fetchAIProviders(): Promise<AIProviderInfo[]> {
  const data = await apiGet<{ providers: AIProviderInfo[] }>('/api/ai/providers')
  return data.providers || []
}

/**
 * 读取安全配置摘要
 * @returns 当前生效配置与已保存档案
 */
export function fetchAISettings(): Promise<AISafeSettings> {
  return apiGet<AISafeSettings>('/api/ai/settings')
}

/**
 * 保存大模型配置
 * @param payload 生效服务商与档案列表
 * @returns 保存后的安全摘要
 */
export function saveAISettings(payload: AISavePayload): Promise<AISafeSettings> {
  return apiPut<AISafeSettings>('/api/ai/settings', payload)
}

/**
 * 使用草稿配置测试连通性
 * @param draft 草稿配置；为空时测试当前生效配置
 * @returns 测试结果
 */
export function testAIConnection(draft: AITestDraft): Promise<AITestResult> {
  return apiPost<AITestResult>('/api/ai/test', draft)
}
