/**
 * 设置状态管理
 * 
 * 管理应用的全局设置，包括：
 * - 主题设置（蓝色/浅色/暗黑）
 * - 语言设置
 * - TTS/ASR 设置
 * - 其他用户偏好设置
 * 
 * 设置会自动持久化到 localStorage
 */

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// 主题类型
export type ThemeType = 'blue' | 'light' | 'dark'

// 语言类型
export type LanguageType = 'zh-CN' | 'en-US'

// TTS 提供者类型
export type TTSProviderType = 'http' | 'browser' | 'sherpa'

// ASR 提供者类型
export type ASRProviderType = 'http' | 'browser' | 'sherpa'

// 设置接口
export interface Settings {
  // 设置结构版本：用于旧数据迁移（2 = 引入引擎/音色两级模型）
  settingsVersion?: number

  // 学习身份
  /** 学习昵称：小老师点评时的称呼，为空表示未设置 */
  nickname: string

  // 外观设置
  theme: ThemeType
  language: LanguageType
  
  // TTS 设置
  ttsProvider: TTSProviderType
  ttsHttpEndpoint: string
  /** 旧字段：仅保留一个版本用于兼容历史数据，新代码只读 ttsVoiceId */
  ttsVoice: string
  /** 当前 TTS 引擎标识，如 melo / aishell3 / kokoro / matcha / openvoice */
  ttsEngine: string
  /** 当前音色标识，形如 melo:0 / aishell3:SSB0005 / clone:vc_xxx */
  ttsVoiceId: string
  ttsSpeed: number
  ttsVolume: number
  
  // ASR 设置
  asrProvider: ASRProviderType
  asrHttpEndpoint: string
  asrLanguage: string
  
  // 打字设置
  typingShowHint: boolean
  typingShowPinyin: boolean
  typingSoundEnabled: boolean
  
  // 学习设置
  dailyGoal: number
  autoPlayAudio: boolean
  reviewReminder: boolean
}

// 当前设置结构版本：递增时需在 migrateSettings 中补齐迁移逻辑
const SETTINGS_VERSION = 2

// 默认设置
const defaultSettings: Settings = {
  settingsVersion: SETTINGS_VERSION,
  nickname: '',
  theme: 'blue',
  language: 'zh-CN',
  
  ttsProvider: 'http',
  ttsHttpEndpoint: 'http://localhost:3000',
  ttsVoice: 'default',
  ttsEngine: 'melo',
  ttsVoiceId: 'melo:0',
  ttsSpeed: 1.0,
  ttsVolume: 1.0,
  
  asrProvider: 'http',
  asrHttpEndpoint: 'http://localhost:3000',
  asrLanguage: 'zh-CN',
  
  typingShowHint: true,
  typingShowPinyin: true,
  typingSoundEnabled: true,
  
  dailyGoal: 30,
  autoPlayAudio: true,
  reviewReminder: true,
}

/**
 * 迁移历史设置到当前结构版本
 * @param stored 从 localStorage 读出的原始设置对象
 * @returns 补齐默认值与新字段后的设置
 */
function migrateSettings(stored: Partial<Settings>): Settings {
  // 合并默认值，保证缺失字段可用
  const merged: Settings = { ...defaultSettings, ...stored }
  const version = Number(stored.settingsVersion || 1)

  // v1 -> v2：旧的 default/female/male 无法映射真实说话人，统一回退主引擎默认音色
  if (version < 2) {
    merged.ttsEngine = 'melo'
    merged.ttsVoiceId = 'melo:0'
    // 旧字段保留原值，避免其他模块读取时报错
    merged.ttsVoice = stored.ttsVoice || 'default'
    merged.settingsVersion = SETTINGS_VERSION
  }

  // 兜底：新字段缺失或为空时回退默认引擎
  if (!merged.ttsEngine) merged.ttsEngine = 'melo'
  if (!merged.ttsVoiceId) merged.ttsVoiceId = `${merged.ttsEngine}:0`

  // 音色必须与引擎匹配：openvoice 仅支持真实克隆音色（clone:xxx）。
  // 历史设置残留的 openvoice:0 会让后端找不到克隆档案，合成返回失败但 HTTP 仍是 200，
  // 前端表现为“有字幕、没声音”，因此这里统一回退到 melo 默认音色。
  if (merged.ttsEngine === 'openvoice' && !merged.ttsVoiceId.startsWith('clone:')) {
    merged.ttsEngine = 'melo'
    merged.ttsVoiceId = 'melo:0'
  } else if (
    merged.ttsEngine !== 'openvoice'
    && !merged.ttsVoiceId.startsWith(`${merged.ttsEngine}:`)
  ) {
    // 其他引擎的音色也必须带正确引擎前缀，例如 melo:0 / aishell3:1
    merged.ttsVoiceId = `${merged.ttsEngine}:0`
  }

  // 昵称必须是字符串，历史数据可能缺失或为 null
  if (typeof merged.nickname !== 'string') merged.nickname = ''

  return merged
}

// localStorage key
const STORAGE_KEY = 'lexitype-settings'

/**
 * 从 localStorage 加载设置
 */
function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<Settings>
      // 统一走迁移，保证旧版本数据可用
      return migrateSettings(parsed)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
  }
  return { ...defaultSettings }
}

/**
 * 保存设置到 localStorage
 */
function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch (error) {
    console.error('保存设置失败:', error)
  }
}

/**
 * 应用主题到 document
 */
function applyTheme(theme: ThemeType): void {
  const html = document.documentElement
  
  // 移除所有主题类
  html.classList.remove('theme-blue', 'theme-light', 'theme-dark', 'dark')
  
  // 添加新主题类
  html.classList.add(`theme-${theme}`)
  
  // 暗黑模式需要额外添加 'dark' 类以兼容 Tailwind
  if (theme === 'dark') {
    html.classList.add('dark')
  }
}

/**
 * 设置 Store
 */
export const useSettingsStore = defineStore('settings', () => {
  // 加载初始设置
  const initialSettings = loadSettings()
  
  // 响应式状态
  // 学习昵称：小老师点评称呼
  const nickname = ref(initialSettings.nickname)
  const theme = ref<ThemeType>(initialSettings.theme)
  const language = ref<LanguageType>(initialSettings.language)
  
  const ttsProvider = ref<TTSProviderType>(initialSettings.ttsProvider)
  const ttsHttpEndpoint = ref(initialSettings.ttsHttpEndpoint)
  const ttsVoice = ref(initialSettings.ttsVoice)
  // 新增：引擎与音色两级模型，实际播放链路只使用这两个字段
  const ttsEngine = ref(initialSettings.ttsEngine)
  const ttsVoiceId = ref(initialSettings.ttsVoiceId)
  const ttsSpeed = ref(initialSettings.ttsSpeed)
  const ttsVolume = ref(initialSettings.ttsVolume)
  
  const asrProvider = ref<ASRProviderType>(initialSettings.asrProvider)
  const asrHttpEndpoint = ref(initialSettings.asrHttpEndpoint)
  const asrLanguage = ref(initialSettings.asrLanguage)
  
  const typingShowHint = ref(initialSettings.typingShowHint)
  const typingShowPinyin = ref(initialSettings.typingShowPinyin)
  const typingSoundEnabled = ref(initialSettings.typingSoundEnabled)
  
  const dailyGoal = ref(initialSettings.dailyGoal)
  const autoPlayAudio = ref(initialSettings.autoPlayAudio)
  const reviewReminder = ref(initialSettings.reviewReminder)
  
  // 获取所有设置
  function getSettings(): Settings {
    return {
      settingsVersion: SETTINGS_VERSION,
      nickname: nickname.value,
      theme: theme.value,
      language: language.value,
      ttsProvider: ttsProvider.value,
      ttsHttpEndpoint: ttsHttpEndpoint.value,
      ttsVoice: ttsVoice.value,
      ttsEngine: ttsEngine.value,
      ttsVoiceId: ttsVoiceId.value,
      ttsSpeed: ttsSpeed.value,
      ttsVolume: ttsVolume.value,
      asrProvider: asrProvider.value,
      asrHttpEndpoint: asrHttpEndpoint.value,
      asrLanguage: asrLanguage.value,
      typingShowHint: typingShowHint.value,
      typingShowPinyin: typingShowPinyin.value,
      typingSoundEnabled: typingSoundEnabled.value,
      dailyGoal: dailyGoal.value,
      autoPlayAudio: autoPlayAudio.value,
      reviewReminder: reviewReminder.value,
    }
  }
  
  // 更新设置
  function updateSettings(updates: Partial<Settings>): void {
    if (updates.nickname !== undefined) nickname.value = updates.nickname
    if (updates.theme !== undefined) theme.value = updates.theme
    if (updates.language !== undefined) language.value = updates.language
    if (updates.ttsProvider !== undefined) ttsProvider.value = updates.ttsProvider
    if (updates.ttsHttpEndpoint !== undefined) ttsHttpEndpoint.value = updates.ttsHttpEndpoint
    if (updates.ttsVoice !== undefined) ttsVoice.value = updates.ttsVoice
    if (updates.ttsEngine !== undefined) ttsEngine.value = updates.ttsEngine
    if (updates.ttsVoiceId !== undefined) ttsVoiceId.value = updates.ttsVoiceId
    if (updates.ttsSpeed !== undefined) ttsSpeed.value = updates.ttsSpeed
    if (updates.ttsVolume !== undefined) ttsVolume.value = updates.ttsVolume
    if (updates.asrProvider !== undefined) asrProvider.value = updates.asrProvider
    if (updates.asrHttpEndpoint !== undefined) asrHttpEndpoint.value = updates.asrHttpEndpoint
    if (updates.asrLanguage !== undefined) asrLanguage.value = updates.asrLanguage
    if (updates.typingShowHint !== undefined) typingShowHint.value = updates.typingShowHint
    if (updates.typingShowPinyin !== undefined) typingShowPinyin.value = updates.typingShowPinyin
    if (updates.typingSoundEnabled !== undefined) typingSoundEnabled.value = updates.typingSoundEnabled
    if (updates.dailyGoal !== undefined) dailyGoal.value = updates.dailyGoal
    if (updates.autoPlayAudio !== undefined) autoPlayAudio.value = updates.autoPlayAudio
    if (updates.reviewReminder !== undefined) reviewReminder.value = updates.reviewReminder
  }
  
  // 重置设置
  function resetSettings(): void {
    updateSettings(defaultSettings)
  }
  
  // 切换主题
  function setTheme(newTheme: ThemeType): void {
    theme.value = newTheme
  }
  
  // 监听主题变化并应用
  watch(theme, (newTheme) => {
    applyTheme(newTheme)
    saveSettings(getSettings())
  }, { immediate: true })
  
  // 监听所有设置变化并保存
  watch([
    nickname,
    language,
    ttsProvider, ttsHttpEndpoint, ttsVoice, ttsEngine, ttsVoiceId, ttsSpeed, ttsVolume,
    asrProvider, asrHttpEndpoint, asrLanguage,
    typingShowHint, typingShowPinyin, typingSoundEnabled,
    dailyGoal, autoPlayAudio, reviewReminder,
  ], () => {
    saveSettings(getSettings())
  })
  
  return {
    // 状态
    nickname,
    theme,
    language,
    ttsProvider,
    ttsHttpEndpoint,
    ttsVoice,
    // 引擎与音色：播放链路与设置页共用
    ttsEngine,
    ttsVoiceId,
    ttsSpeed,
    ttsVolume,
    asrProvider,
    asrHttpEndpoint,
    asrLanguage,
    typingShowHint,
    typingShowPinyin,
    typingSoundEnabled,
    dailyGoal,
    autoPlayAudio,
    reviewReminder,
    
    // 方法
    getSettings,
    updateSettings,
    resetSettings,
    setTheme,
  }
})
