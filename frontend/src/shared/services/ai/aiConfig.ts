/**
 * AI 配置管理（批次D：密钥后端化）
 *
 * 职责：
 * - 保留历史存储键 lexitype_ai_config（核心标识冻结，不可修改）
 * - 仅持久化 customPrompts 等前端侧配置，不再保存 apiKey / endpoint / model
 * - 首次加载时清理历史明文密钥，并写入一次性迁移提示标记供设置页展示
 *
 * 说明：
 * - 真正的上游地址与模型由后端 backend/.env 决定
 * - 前端不再需要 validateAIConfig / getDefaultConfig / getSupportedModels 等方法
 */

import type { AIConfig, AIProvider } from './aiTypes'

/** 本地存储键：核心标识冻结，修改会导致用户配置丢失 */
const STORAGE_KEY = 'lexitype_ai_config'

/** 迁移提示标记键：使用 sessionStorage，仅在当前会话提示一次 */
const MIGRATION_NOTICE_KEY = 'lexitype_ai_migrated_notice'

/** 默认配置：密钥与端点留空，实际能力由后端提供 */
const DEFAULT_CONFIG: AIConfig = {
  provider: 'qwen',
  apiKey: '',
  endpoint: '',
  model: '',
  customPrompts: {}
}

/**
 * 加载 AI 前端配置。
 * @returns 合并默认值后的配置对象
 *
 * 说明：
 *   历史 localStorage 中可能残留明文密钥，这里会删除并回写净化后的配置。
 */
export function loadAIConfig(): AIConfig {
  // 读取原始存储值
  const saved = localStorage.getItem(STORAGE_KEY)
  if (!saved) {
    return { ...DEFAULT_CONFIG }
  }

  try {
    const parsed = JSON.parse(saved) as Partial<AIConfig>

    // 检测历史敏感字段：只要存在非空密钥或旧端点即视为需要迁移
    const hasLegacySecret = Boolean(
      (parsed.apiKey && parsed.apiKey.trim()) ||
        (parsed.endpoint && parsed.endpoint.trim()) ||
        (parsed.model && parsed.model.trim())
    )

    // 只保留前端仍需要的字段
    const config: AIConfig = {
      provider: (parsed.provider as AIProvider) ?? DEFAULT_CONFIG.provider,
      apiKey: '',
      endpoint: '',
      model: '',
      customPrompts: parsed.customPrompts ?? {}
    }

    if (hasLegacySecret) {
      // 清除历史密钥：立即回写，避免继续驻留浏览器存储
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      // 标记本次会话需要提示用户去后端配置
      sessionStorage.setItem(MIGRATION_NOTICE_KEY, '1')
      console.info('[ai/config] 已清理历史前端密钥，密钥统一由 backend/.env 管理')
    }

    return config
  } catch (error) {
    // 解析失败：返回默认配置，不阻塞页面
    console.error('[ai/config] 解析本地 AI 配置失败，已回退默认值', error)
    return { ...DEFAULT_CONFIG }
  }
}

/**
 * 保存 AI 前端配置。
 * @param config 待保存配置
 *
 * 说明：
 *   只持久化 provider 与 customPrompts，避免密钥再次落盘。
 */
export function saveAIConfig(config: AIConfig): void {
  try {
    const safeConfig: AIConfig = {
      provider: config.provider,
      apiKey: '',
      endpoint: '',
      model: '',
      customPrompts: config.customPrompts ?? {}
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeConfig))
  } catch (error) {
    console.error('[ai/config] 保存 AI 配置失败', error)
    throw new Error('保存配置失败')
  }
}

/**
 * 重置 AI 前端配置。
 *
 * 说明：
 *   仅清除前端侧配置；后端 .env 中的密钥不受影响。
 */
export function resetAIConfig(): void {
  localStorage.removeItem(STORAGE_KEY)
  console.info('[ai/config] 已重置前端 AI 配置')
}

/**
 * 消费一次性迁移提示。
 * @returns 若本会话发生过密钥迁移则返回 true，并清除标记
 */
export function consumeAIConfigMigrationNotice(): boolean {
  const flagged = sessionStorage.getItem(MIGRATION_NOTICE_KEY) === '1'
  if (flagged) {
    sessionStorage.removeItem(MIGRATION_NOTICE_KEY)
  }
  return flagged
}
