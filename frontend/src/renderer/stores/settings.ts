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
  // 外观设置
  theme: ThemeType
  language: LanguageType
  
  // TTS 设置
  ttsProvider: TTSProviderType
  ttsHttpEndpoint: string
  ttsVoice: string
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

// 默认设置
const defaultSettings: Settings = {
  theme: 'blue',
  language: 'zh-CN',
  
  ttsProvider: 'http',
  ttsHttpEndpoint: 'http://localhost:3000',
  ttsVoice: 'default',
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

// localStorage key
const STORAGE_KEY = 'lexitype-settings'

/**
 * 从 localStorage 加载设置
 */
function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return { ...defaultSettings, ...parsed }
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
  const theme = ref<ThemeType>(initialSettings.theme)
  const language = ref<LanguageType>(initialSettings.language)
  
  const ttsProvider = ref<TTSProviderType>(initialSettings.ttsProvider)
  const ttsHttpEndpoint = ref(initialSettings.ttsHttpEndpoint)
  const ttsVoice = ref(initialSettings.ttsVoice)
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
      theme: theme.value,
      language: language.value,
      ttsProvider: ttsProvider.value,
      ttsHttpEndpoint: ttsHttpEndpoint.value,
      ttsVoice: ttsVoice.value,
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
    if (updates.theme !== undefined) theme.value = updates.theme
    if (updates.language !== undefined) language.value = updates.language
    if (updates.ttsProvider !== undefined) ttsProvider.value = updates.ttsProvider
    if (updates.ttsHttpEndpoint !== undefined) ttsHttpEndpoint.value = updates.ttsHttpEndpoint
    if (updates.ttsVoice !== undefined) ttsVoice.value = updates.ttsVoice
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
    language,
    ttsProvider, ttsHttpEndpoint, ttsVoice, ttsSpeed, ttsVolume,
    asrProvider, asrHttpEndpoint, asrLanguage,
    typingShowHint, typingShowPinyin, typingSoundEnabled,
    dailyGoal, autoPlayAudio, reviewReminder,
  ], () => {
    saveSettings(getSettings())
  })
  
  return {
    // 状态
    theme,
    language,
    ttsProvider,
    ttsHttpEndpoint,
    ttsVoice,
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
