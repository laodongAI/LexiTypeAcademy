<!--
  设置页面
  
  应用设置管理
-->

<template>
  <div class="settings-page">
    <header class="page-header">
      <h2 class="page-title">设置</h2>
      <p class="page-subtitle">管理外观、语音、AI 与学习偏好。</p>
    </header>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">外观</h3>
      </div>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="主题色">
          <el-radio-group v-model="settings.theme" @change="handleThemeChange">
            <el-radio-button value="blue">
              <div class="theme-option">
                <span class="theme-dot blue" />
                蓝色主题
              </div>
            </el-radio-button>
            <el-radio-button value="light">
              <div class="theme-option">
                <span class="theme-dot light" />
                浅色主题
              </div>
            </el-radio-button>
            <el-radio-button value="dark">
              <div class="theme-option">
                <span class="theme-dot dark" />
                暗黑主题
              </div>
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="语言">
          <el-select v-model="settings.language">
            <el-option label="简体中文" value="zh-CN" />
            <el-option label="English" value="en-US" />
          </el-select>
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">语音合成</h3>
      </div>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="TTS 提供者">
          <el-select v-model="settings.ttsProvider">
            <el-option label="HTTP API" value="http" />
            <el-option label="浏览器内置" value="browser" />
            <el-option label="Sherpa ONNX" value="sherpa" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="settings.ttsProvider === 'http'" label="API 地址">
          <el-input v-model="settings.ttsHttpEndpoint" placeholder="http://127.0.0.1:8010" />
        </el-form-item>

        <el-form-item label="语音">
          <el-select v-model="settings.ttsVoice">
            <el-option label="默认" value="default" />
            <el-option label="女声" value="female" />
            <el-option label="男声" value="male" />
          </el-select>
        </el-form-item>

        <el-form-item label="语速">
          <el-slider v-model="settings.ttsSpeed" :min="0.5" :max="2" :step="0.1" show-input />
        </el-form-item>

        <el-form-item label="音量">
          <el-slider v-model="settings.ttsVolume" :min="0" :max="1" :step="0.1" show-input />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="ttsTesting" @click="testTTS">
            {{ ttsTesting ? '测试中…' : '测试 TTS' }}
          </el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">语音识别</h3>
      </div>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="ASR 提供者">
          <el-select v-model="settings.asrProvider">
            <el-option label="HTTP API" value="http" />
            <el-option label="浏览器内置" value="browser" />
            <el-option label="Sherpa ONNX" value="sherpa" />
          </el-select>
        </el-form-item>

        <el-form-item v-if="settings.asrProvider === 'http'" label="API 地址">
          <el-input v-model="settings.asrHttpEndpoint" placeholder="http://127.0.0.1:8010" />
        </el-form-item>

        <el-form-item label="识别语言">
          <el-select v-model="settings.asrLanguage">
            <el-option label="中文" value="zh-CN" />
            <el-option label="英文" value="en-US" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="asrTesting" @click="testASR">
            {{ asrTesting ? '检查中…' : '测试 ASR' }}
          </el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">打字练习</h3>
      </div>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="显示提示">
          <el-switch v-model="settings.typingShowHint" />
        </el-form-item>

        <el-form-item label="显示拼音">
          <el-switch v-model="settings.typingShowPinyin" />
        </el-form-item>

        <el-form-item label="按键音效">
          <el-switch v-model="settings.typingSoundEnabled" />
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">AI 模型</h3>
      </div>

      <el-alert type="info" :closable="false" show-icon class="ai-alert">
        <template #title>提示</template>
        配置 AI 模型后，可使用课程生成、写作助手等功能
      </el-alert>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="AI 提供商">
          <el-select v-model="settings.aiProvider" @change="handleProviderChange">
            <el-option label="通义千问" value="qwen" />
            <el-option label="OpenAI" value="openai" />
            <el-option label="火山引擎（豆包）" value="volcengine" />
            <el-option label="DeepSeek" value="deepseek" />
            <el-option label="自定义" value="custom" />
          </el-select>
        </el-form-item>

        <el-form-item label="API Key">
          <el-input v-model="settings.aiApiKey" type="password" show-password placeholder="输入你的 API Key" />
          <div class="hint hint-block">
            <span v-if="settings.aiProvider === 'qwen'">
              获取方式：<el-button text type="primary" @click="openLink('https://dashscope.aliyuncs.com/')">通义千问 API</el-button>
            </span>
            <span v-else-if="settings.aiProvider === 'openai'">
              获取方式：<el-button text type="primary" @click="openLink('https://platform.openai.com/api-keys')">OpenAI API</el-button>
            </span>
            <span v-else-if="settings.aiProvider === 'volcengine'">
              获取方式：<el-button text type="primary" @click="openLink('https://console.volcengine.com/')">火山引擎控制台</el-button>
            </span>
            <span v-else-if="settings.aiProvider === 'deepseek'">
              获取方式：<el-button text type="primary" @click="openLink('https://platform.deepseek.com/')">DeepSeek 控制台</el-button>
            </span>
          </div>
        </el-form-item>

        <el-form-item label="API 端点">
          <el-input v-model="settings.aiEndpoint" placeholder="API 端点 URL" />
          <div class="hint hint-block">自动填充，也可手动修改</div>
        </el-form-item>

        <el-form-item label="模型">
          <el-select v-model="settings.aiModel">
            <el-option v-for="model in availableModels" :key="model.value" :label="model.label" :value="model.value" />
          </el-select>
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="testAIConfig">测试配置</el-button>
          <el-button @click="resetAIConfig">重置配置</el-button>
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section">
      <div class="section-header">
        <h3 class="section-title">学习</h3>
      </div>

      <el-form label-position="top" label-width="auto" class="prototype-form">
        <el-form-item label="每日目标">
          <div class="inline-row">
            <el-input-number v-model="settings.dailyGoal" :min="5" :max="120" :step="5" />
            <span class="unit">分钟</span>
          </div>
        </el-form-item>

        <el-form-item label="自动播放">
          <div class="inline-row">
            <el-switch v-model="settings.autoPlayAudio" />
            <span class="hint">学习新词时自动播放发音</span>
          </div>
        </el-form-item>

        <el-form-item label="复习提醒">
          <div class="inline-row">
            <el-switch v-model="settings.reviewReminder" />
            <span class="hint">有待复习内容时发送提醒</span>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="settings-section settings-section-last">
      <div class="section-header">
        <h3 class="section-title">关于</h3>
      </div>

      <div class="about-info">
        <div class="app-logo">
          <img src="../assets/logo.svg" alt="LexiType" />
        </div>
        <div class="app-details">
          <h2>LexiType Academy</h2>
          <p class="version">版本: {{ appVersion }}</p>
          <p class="description">一款专为中文学习者设计的打字练习和语言学习应用</p>
        </div>
      </div>

      <div class="about-links">
        <el-button text @click="openLink('https://github.com')">
          <el-icon><Link /></el-icon> GitHub
        </el-button>
        <el-button text @click="openLink('https://lexitype.com')">
          <el-icon><Link /></el-icon> 官网
        </el-button>
      </div>

      <div class="actions">
        <el-button type="danger" @click="resetAllSettings">重置所有设置</el-button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, watch, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { showMessage } from '../plugins/messageDefaults'
import { Link } from '@element-plus/icons-vue'
import { useSettingsStore, ThemeType } from '../stores'
import { loadAIConfig, saveAIConfig, getDefaultConfig, getSupportedModels, resetAIConfig as resetAIConfigUtil } from '../../shared/services/ai/aiConfig'
import type { AIProvider } from '../../shared/services/ai/aiTypes'
import { getAIService, resetAIService } from '../../shared/services/ai'
// 语音服务客户端：用于设置页真实连通性测试
import { getTTSApiService } from '../../shared/services/ttsApiService'
import { getASRApiService } from '../../shared/services/asrApiService'

// 设置 store
const settingsStore = useSettingsStore()

// 加载 AI 配置
const aiConfig = loadAIConfig()

// 设置数据
const settings = reactive({
  theme: settingsStore.theme,
  language: settingsStore.language,
  ttsProvider: settingsStore.ttsProvider,
  ttsHttpEndpoint: settingsStore.ttsHttpEndpoint,
  ttsVoice: settingsStore.ttsVoice,
  ttsSpeed: settingsStore.ttsSpeed,
  ttsVolume: settingsStore.ttsVolume,
  asrProvider: settingsStore.asrProvider,
  asrHttpEndpoint: settingsStore.asrHttpEndpoint,
  asrLanguage: settingsStore.asrLanguage,
  typingShowHint: settingsStore.typingShowHint,
  typingShowPinyin: settingsStore.typingShowPinyin,
  typingSoundEnabled: settingsStore.typingSoundEnabled,
  dailyGoal: settingsStore.dailyGoal,
  autoPlayAudio: settingsStore.autoPlayAudio,
  reviewReminder: settingsStore.reviewReminder,
  // AI 配置
  aiProvider: aiConfig.provider as AIProvider,
  aiApiKey: aiConfig.apiKey,
  aiEndpoint: aiConfig.endpoint,
  aiModel: aiConfig.model,
})

// 应用版本
const appVersion = ref('0.1.0')

// 计算可用的模型列表
const availableModels = computed(() => {
  return getSupportedModels(settings.aiProvider as AIProvider)
})

// 监听设置变化并同步到 store
watch(settings, (newSettings) => {
  settingsStore.updateSettings(newSettings)
  
  // 同步 AI 配置到 localStorage
  const aiConfigToSave = {
    provider: newSettings.aiProvider as AIProvider,
    apiKey: newSettings.aiApiKey,
    endpoint: newSettings.aiEndpoint,
    model: newSettings.aiModel,
    customPrompts: {}
  }
  saveAIConfig(aiConfigToSave)
}, { deep: true })

// 处理主题变化
function handleThemeChange(val: string | number | boolean | undefined) {
  if (typeof val === 'string') {
    settingsStore.setTheme(val as ThemeType)
  }
}

// 处理提供商变化
function handleProviderChange(provider: string) {
  const defaultConfig = getDefaultConfig(provider as AIProvider)
  settings.aiEndpoint = defaultConfig.endpoint || ''
  settings.aiModel = defaultConfig.model || ''
}

// 语音测试中的状态：避免重复点击触发并发请求
const ttsTesting = ref(false)
const asrTesting = ref(false)

// 测试 TTS：真实请求后端 /api/tts/generate 并播放返回音频
async function testTTS() {
  if (ttsTesting.value) {
    return
  }

  ttsTesting.value = true

  try {
    const service = getTTSApiService()
    // 使用与学习链路一致的短句，覆盖中英混读能力
    const result = await service.generate({
      text: '语音合成测试，欢迎使用键语学苑。',
      language: 'zh',
      rate: settings.ttsSpeed,
    })

    // 后端业务失败：按契约返回 success=false，给出具体原因
    if (!result.success) {
      ElMessage.error(`TTS 测试失败：${result.error || '未知错误'}`)
      return
    }

    // 命中 IndexedDB 持久化缓存时只返回 blob URL，不返回 base64，两种形态都要支持
    let playableSource = result.url || ''
    if (result.audio) {
      // 根据实际输出格式选择 MIME，避免浏览器无法解码 data URL
      const mimeType =
        result.format === 'mp3'
          ? 'audio/mpeg'
          : result.format === 'ogg'
            ? 'audio/ogg'
            : 'audio/wav'
      playableSource = `data:${mimeType};base64,${result.audio}`
    }

    if (!playableSource) {
      ElMessage.error('TTS 测试失败：未返回可播放音频')
      return
    }

    // 播放合成结果；自动播放被浏览器拦截时不影响测试结论
    const audio = new Audio(playableSource)
    audio.volume = Math.min(Math.max(settings.ttsVolume, 0), 1)
    await audio.play().catch(() => undefined)

    ElMessage.success(
      result.duration
        ? `TTS 测试成功：${result.duration}s，引擎 ${result.engine || 'melo'}`
        : `TTS 测试成功：引擎 ${result.engine || 'melo'}`
    )
  } catch (error) {
    ElMessage.error(
      `TTS 服务不可达：${error instanceof Error ? error.message : '未知错误'}`
    )
  } finally {
    ttsTesting.value = false
  }
}

// 测试 ASR：检查本地后端识别模型是否就绪
async function testASR() {
  if (asrTesting.value) {
    return
  }

  asrTesting.value = true

  try {
    const health = await getASRApiService().health()

    // 模型加载失败或文件缺失时给出明确指引
    if (health.error) {
      ElMessage.error(`ASR 模型异常：${health.error}`)
      return
    }

    if (!health.modelReady) {
      ElMessage.error('ASR 模型文件未就绪，请检查 backend/models/asr/sensevoice')
      return
    }

    ElMessage.success(
      `ASR 服务正常：${health.engine || 'sensevoice'}，` +
        `${health.sampleRate || 16000}Hz${health.loaded ? '（已加载）' : '（首次识别时加载）'}`
    )
  } catch (error) {
    ElMessage.error(
      `ASR 服务不可达：${error instanceof Error ? error.message : '未知错误'}`
    )
  } finally {
    asrTesting.value = false
  }
}

// 测试 AI 配置
async function testAIConfig() {
  if (!settings.aiApiKey) {
    ElMessage.warning('请输入 API Key')
    return
  }
  
  let loadingId: any = null
  try {
    // 保存配置
    const aiConfigToSave = {
      provider: settings.aiProvider as AIProvider,
      apiKey: settings.aiApiKey,
      endpoint: settings.aiEndpoint,
      model: settings.aiModel,
      customPrompts: {}
    }
    saveAIConfig(aiConfigToSave)
    
    // 重新加载 AI 服务以读取新配置
    resetAIService()
    const aiService = getAIService()
    
    if (!aiService.isConfigured()) {
      ElMessage.error('AI 配置无效，请检查参数')
      return
    }
    
    // 发送测试请求
    loadingId = showMessage({
      type: 'info',
      // 遵循全局规则：默认 3 秒自动消失，并可手动关闭
      message: '正在测试 AI 配置...'
    })
    const response = await aiService.call(
      'Hello, can you respond with "OK"?',
      'You are a helpful assistant.',
      { temperature: 0.5, maxTokens: 100 }
    )
    
    // 移除加载提示
    loadingId?.close?.()
    if (response) {
      ElMessage.success('✅ AI 配置测试成功！')
    } else {
      ElMessage.error('❌ AI 响应为空')
    }
  } catch (error: any) {
    // 移除加载提示
    loadingId?.close?.()
    ElMessage.error('❌ AI 配置测试失败：' + (error.message || '未知错误'))
  }
}

// 重置 AI 配置
async function resetAIConfig() {
  try {
    await ElMessageBox.confirm(
      '确定要重置 AI 配置吗？所有 AI 相关功能将失效。',
      '重置 AI 配置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    resetAIConfigUtil()
    settings.aiProvider = 'qwen'
    settings.aiApiKey = ''
    settings.aiEndpoint = 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation'
    settings.aiModel = 'qwen-plus'
    
    resetAIService()
    ElMessage.success('AI 配置已重置')
  } catch {
    // 用户取消
  }
}

// 打开链接
function openLink(url: string) {
  window.open(url, '_blank')
}

// 重置所有设置
async function resetAllSettings() {
  try {
    await ElMessageBox.confirm(
      '确定要重置所有设置为默认值吗？此操作不可撤销。',
      '重置设置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    settingsStore.resetSettings()
    
    // 同步到本地状态
    Object.assign(settings, settingsStore.getSettings())
    
    ElMessage.success('设置已重置')
  } catch {
    // 用户取消
  }
}
</script>

<style lang="scss" scoped>
.settings-page {
  max-width: 800px;
}

.page-header {
  margin-bottom: 28px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 300;
  letter-spacing: -0.02em;
  color: var(--text-color);
}

.page-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 300;
  color: var(--text-color-secondary);
}

.settings-section {
  padding: 0 0 28px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 28px;
}

.settings-section-last {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-header {
  padding-bottom: 12px;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-color-secondary);
}

.ai-alert {
  margin-bottom: 16px;
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint-block {
  margin-top: 6px;
}

.theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .theme-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    
    &.blue {
      background-color: #409eff;
    }
    
    &.light {
      background-color: #6366f1;
    }
    
    &.dark {
      background-color: #1d1d1d;
      border: 1px solid #ccc;
    }
  }
}

.unit,
.hint {
  margin-left: 12px;
  color: var(--text-color-placeholder);
  font-size: 13px;
}

/* 原型风格：弱化默认边框，强调底边框（尽量不破坏 Element Plus 交互） */
.prototype-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color-secondary);
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    box-shadow: none !important;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background-color: transparent;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focus),
  :deep(.el-textarea__inner:focus) {
    border-bottom-color: var(--primary-color);
  }
}

.about-info {
  display: flex;
  align-items: center;
  gap: 24px;
  
  .app-logo {
    img {
      width: 80px;
      height: 80px;
    }
  }
  
  .app-details {
    h2 {
      margin: 0 0 8px 0;
      color: var(--text-color);
    }
    
    .version {
      margin: 0 0 8px 0;
      color: var(--primary-color);
    }
    
    .description {
      margin: 0;
      color: var(--text-color-secondary);
    }
  }
}

.about-links {
  display: flex;
  gap: 16px;
}

.actions {
  margin-top: 24px;
}
</style>
