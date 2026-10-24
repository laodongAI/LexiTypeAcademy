<!--
  语音模型设置分页

  职责：
  - 选择 TTS 引擎（引擎卡片展示可用状态与许可证）
  - 选择音色、调整语速与音量，并支持试听
  - 管理克隆音色（VoiceClonePanel）
  - 配置语音识别与连接测试
  说明：
  - 引擎/音色目录全部来自后端，前端不硬编码音色编号
  - 引擎与音色即改即存；试听使用当前设置立即合成
-->

<template>
  <section class="tab-panel speech-panel">
    <div class="section-header">
      <h3 class="section-title">语音合成</h3>
      <p class="section-desc">选择朗读引擎与音色。引擎切换会触发本地模型加载。</p>
    </div>

    <div v-if="enginesLoading" class="engine-loading">
      <el-skeleton :rows="2" animated />
    </div>

    <el-alert
      v-else-if="enginesError"
      type="error"
      :closable="false"
      show-icon
      :title="enginesError"
    />

    <div v-else class="engine-grid">
      <button
        v-for="engine in engines"
        :key="engine.id"
        class="engine-card"
        :class="{ active: engine.id === ttsEngine, disabled: !engine.available }"
        :disabled="!engine.available"
        type="button"
        @click="selectEngine(engine)"
      >
        <div class="engine-card-top">
          <span class="engine-name">{{ engine.displayName }}</span>
          <span v-if="engine.loaded" class="loaded-dot" title="已加载到内存" />
        </div>
        <p class="engine-desc">{{ engine.description }}</p>
        <div class="engine-tags">
          <el-tag size="small" effect="plain" type="info">{{ engine.voiceCount }} 音色</el-tag>
          <el-tag v-if="engine.supportsClone" size="small" effect="plain" type="success">克隆</el-tag>
          <el-tag size="small" effect="plain">{{ engine.license }}</el-tag>
        </div>
        <p v-if="!engine.available" class="engine-reason">{{ engine.reason }}</p>
      </button>
    </div>

    <el-form label-position="top" class="prototype-form form-spaced">
      <el-form-item label="音色">
        <div class="voice-row">
          <el-select
            v-model="ttsVoiceId"
            filterable
            :loading="voicesLoading"
            :disabled="engineVoices.length === 0"
            placeholder="请选择音色"
            class="voice-select"
          >
            <el-option
              v-for="voice in engineVoices"
              :key="voice.id"
              :label="voiceLabel(voice)"
              :value="voice.id"
            />
          </el-select>
          <el-button :loading="previewing" @click="previewVoice">试听</el-button>
        </div>
        <p v-if="ttsEngine === 'openvoice' && engineVoices.length === 0" class="inline-hint">
          还没有克隆音色，请在下方上传一段参考音频。
        </p>
      </el-form-item>

      <el-form-item label="语速">
        <div class="slider-row">
          <el-slider v-model="ttsSpeed" :min="0.5" :max="2" :step="0.05" />
          <span class="slider-value">{{ ttsSpeed.toFixed(2) }}x</span>
        </div>
      </el-form-item>

      <el-form-item label="音量">
        <div class="slider-row">
          <el-slider v-model="ttsVolume" :min="0" :max="1" :step="0.05" />
          <span class="slider-value">{{ Math.round(ttsVolume * 100) }}%</span>
        </div>
      </el-form-item>

      <el-form-item label="引擎内存">
        <div class="inline-row">
          <el-button :loading="unloading" @click="releaseEngine">释放已加载引擎</el-button>
          <span class="inline-hint">切换引擎会自动释放旧引擎，手动释放可回收内存。</span>
        </div>
      </el-form-item>
    </el-form>

    <VoiceClonePanel />

    <div class="section-header section-spaced">
      <h3 class="section-title">语音识别</h3>
      <p class="section-desc">用于发音评分与录音转写，配置修改后立即生效。</p>
    </div>

    <el-form label-position="top" class="prototype-form">
      <el-form-item label="识别引擎">
        <el-select v-model="asrProvider">
          <el-option label="本地服务（sherpa）" value="sherpa" />
          <el-option label="HTTP 服务" value="http" />
          <el-option label="浏览器内置" value="browser" />
        </el-select>
      </el-form-item>

      <el-form-item v-if="asrProvider === 'http'" label="服务地址">
        <el-input v-model="asrHttpEndpoint" placeholder="http://localhost:3000" />
      </el-form-item>

      <el-form-item label="识别语言">
        <el-select v-model="asrLanguage">
          <el-option label="中文（zh-CN）" value="zh-CN" />
          <el-option label="English (en-US)" value="en-US" />
        </el-select>
      </el-form-item>

      <el-button :loading="asrTesting" @click="testAsr">测试识别服务</el-button>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useSettingsStore } from '../../stores/settings'
import { getTTSApiService } from '../../../shared/services/ttsApiService'
import { getASRApiService } from '../../../shared/services/asrApiService'
import {
  fetchTtsEngines,
  fetchTtsVoices,
  unloadTtsEngine,
  type TtsEngineInfo,
  type TtsVoiceInfo,
} from '../../../shared/services/ttsEngineService'
import VoiceClonePanel from './VoiceClonePanel.vue'

// 设置 store：引擎、音色、语速、音量、ASR 均直接持久化
const settingsStore = useSettingsStore()
const {
  ttsEngine,
  ttsVoiceId,
  ttsSpeed,
  ttsVolume,
  asrProvider,
  asrHttpEndpoint,
  asrLanguage,
} = storeToRefs(settingsStore)

// 引擎列表与加载状态
const engines = ref<TtsEngineInfo[]>([])
const enginesLoading = ref(false)
const enginesError = ref('')

// 当前引擎的音色列表与加载状态
const engineVoices = ref<TtsVoiceInfo[]>([])
const voicesLoading = ref(false)

// 试听与释放状态
const previewing = ref(false)
const unloading = ref(false)

// ASR 测试状态
const asrTesting = ref(false)

/**
 * 加载引擎目录
 */
async function loadEngines(): Promise<void> {
  enginesLoading.value = true
  enginesError.value = ''
  try {
    engines.value = await fetchTtsEngines()
    // 当前选中的引擎不存在或不可用时，回退到第一个可用引擎
    const current = engines.value.find((item) => item.id === ttsEngine.value)
    if (!current || !current.available) {
      const fallback = engines.value.find((item) => item.available)
      if (fallback) selectEngine(fallback)
    }
  } catch (error) {
    enginesError.value = (error as Error).message || '读取 TTS 引擎失败'
  } finally {
    enginesLoading.value = false
  }
}

/**
 * 加载当前引擎音色
 */
async function loadVoices(): Promise<void> {
  if (!ttsEngine.value) return
  voicesLoading.value = true
  try {
    engineVoices.value = await fetchTtsVoices(ttsEngine.value)
    // 音色失效（例如克隆档案被删除）时回退到默认音色
    const exists = engineVoices.value.some((voice) => voice.id === ttsVoiceId.value)
    if (!exists) {
      const fallback = engineVoices.value[0]?.id || ''
      if (fallback) ttsVoiceId.value = fallback
    }
  } catch (error) {
    engineVoices.value = []
    ElMessage.error((error as Error).message || '读取音色失败')
  } finally {
    voicesLoading.value = false
  }
}

/**
 * 切换引擎
 * @param engine 目标引擎
 */
function selectEngine(engine: TtsEngineInfo): void {
  if (!engine.available) return
  const nextVoice = engine.defaultVoiceId || engine.id + ':0'
  settingsStore.updateSettings({ ttsEngine: engine.id, ttsVoiceId: nextVoice })
  // 立即按新引擎刷新音色
  void loadVoices()
}

/**
 * 音色下拉展示名
 * @param voice 音色信息
 */
function voiceLabel(voice: TtsVoiceInfo): string {
  return voice.name
}

/**
 * 试听当前音色
 */
async function previewVoice(): Promise<void> {
  if (!ttsVoiceId.value) {
    ElMessage.warning('请先选择音色')
    return
  }
  previewing.value = true
  try {
    const voice = engineVoices.value.find((item) => item.id === ttsVoiceId.value)
    const text = voice?.previewText || '每天坚持朗读，会让发音越来越自然。'
    const url = await getTTSApiService().getAudioUrl({
      text,
      language: 'zh',
      engine: ttsEngine.value,
      voice: ttsVoiceId.value,
      rate: ttsSpeed.value,
      format: 'wav',
    })
    if (!url) {
      ElMessage.error('试听失败，请检查后端服务是否运行')
      return
    }
    const audio = new Audio(url)
    audio.volume = ttsVolume.value
    await audio.play()
  } catch (error) {
    ElMessage.error((error as Error).message || '试听失败')
  } finally {
    previewing.value = false
  }
}

/**
 * 释放后端已加载引擎
 */
async function releaseEngine(): Promise<void> {
  unloading.value = true
  try {
    const ok = await unloadTtsEngine()
    ElMessage[ok ? 'success' : 'warning'](ok ? '已释放引擎内存' : '释放失败，请稍后重试')
    // 重新拉取引擎列表以刷新 loaded 状态
    engines.value = await fetchTtsEngines(true)
  } catch (error) {
    ElMessage.error((error as Error).message || '释放失败')
  } finally {
    unloading.value = false
  }
}

/**
 * 测试 ASR 服务连通性
 */
async function testAsr(): Promise<void> {
  asrTesting.value = true
  try {
    const health = await getASRApiService().health()
    // 模型就绪或已加载即视为可用
    if (health && (health.modelReady || health.loaded)) {
      ElMessage.success('识别服务连接正常')
    } else {
      ElMessage.warning('识别服务暂不可用，请检查后端')
    }
  } catch (error) {
    ElMessage.error((error as Error).message || '识别服务连接失败')
  } finally {
    asrTesting.value = false
  }
}

// 引擎变化时刷新音色（切换引擎、深链进入都会触发）
watch(ttsEngine, () => {
  void loadVoices()
})

// 首次挂载：并行加载引擎与音色
onMounted(async () => {
  await loadEngines()
  await loadVoices()
})
</script>

<style lang="scss" scoped>
.speech-panel {
  max-width: 780px;
}

.section-header {
  margin-bottom: 16px;
}

.section-spaced {
  margin-top: 32px;
}

.section-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-color-secondary);
}

.section-desc {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-placeholder);
}

.engine-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

/* 引擎卡片：保持与整体原型风格一致的浅边框 */
.engine-card {
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover:not(.disabled) {
    border-color: var(--primary-color);
  }

  &.active {
    border-color: var(--primary-color);
    background: rgba(64, 158, 255, 0.06);
  }

  &.disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.engine-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.engine-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

/* 已加载指示：小圆点，避免卡片过于花哨 */
.loaded-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #67c23a;
}

.engine-desc {
  margin: 6px 0 8px;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.engine-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.engine-reason {
  margin: 8px 0 0;
  font-size: 12px;
  color: #e6a23c;
}

.form-spaced {
  margin-top: 20px;
}

.voice-row {
  display: flex;
  align-items: center;
  gap: 12px;
  /* 占满表单内容宽度：避免作为 flex 子项时被压缩成内容宽度 */
  flex: 1;
  min-width: 0;

  .voice-select {
    flex: 1;
    min-width: 0;
  }
}

.slider-row {
  display: flex;
  align-items: center;
  gap: 16px;
  /* 关键修复：占满 el-form-item 内容区，滑块才能获得可用宽度 */
  flex: 1;
  min-width: 0;

  :deep(.el-slider) {
    /* flex:1 + 合理最小宽度：窄屏下也不会塌缩为 0 */
    flex: 1;
    min-width: 160px;
  }
}

.slider-value {
  min-width: 52px;
  /* 数值右对齐，滑块末端与表单右边缘对齐 */
  text-align: right;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.inline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.inline-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.engine-loading {
  padding: 8px 0;
}

.prototype-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color-secondary);
  }

  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper) {
    box-shadow: none !important;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background-color: transparent;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focus) {
    border-bottom-color: var(--primary-color);
  }
}
</style>
