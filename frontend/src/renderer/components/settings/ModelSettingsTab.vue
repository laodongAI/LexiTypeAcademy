<!--
  大模型设置分页

  职责：
  - 选择服务商（目录由后端提供）
  - 编辑模型、Base URL、温度、最大输出、超时
  - 密钥只写不读：输入新密钥、显示已保存尾号、支持清除
  - 测试连接、仅保存、保存并应用
  说明：
  - 表单变更会向父组件同步 dirty 状态，用于切换分页前拦截
  - 保存成功后才算完成，失败时保留草稿便于修正
-->

<template>
  <section class="tab-panel model-panel">
    <div class="section-header">
      <h3 class="section-title">大模型</h3>
      <p class="section-desc">
        密钥只保存在本机后端（{{ configFile || 'ai-settings.json' }}），界面不会回显完整密钥。
      </p>
    </div>

    <el-alert
      v-if="statusText"
      :type="summary?.configured ? 'success' : 'warning'"
      :closable="false"
      show-icon
      :title="statusText"
      class="status-alert"
    />

    <div class="provider-grid">
      <button
        v-for="provider in providers"
        :key="provider.provider"
        class="provider-card"
        :class="{ active: provider.provider === form.provider }"
        type="button"
        @click="selectProvider(provider)"
      >
        <span class="provider-name">{{ provider.displayName }}</span>
        <span v-if="provider.keyRequired" class="provider-badge">需密钥</span>
        <span v-else class="provider-badge local">免密钥</span>
        <p class="provider-desc">{{ provider.description }}</p>
      </button>
    </div>

    <el-form label-position="top" class="prototype-form form-spaced">
      <el-form-item label="Base URL">
        <el-input
          v-model="form.baseUrl"
          :disabled="!activeProviderInfo?.allowCustomBaseUrl"
          :placeholder="activeProviderInfo?.baseUrl || 'https://example.com/v1'"
        />
        <p v-if="!activeProviderInfo?.allowCustomBaseUrl" class="inline-hint">
          预置服务商地址由后端统一维护，自定义服务商可自行填写。
        </p>
      </el-form-item>

      <el-form-item label="模型">
        <el-select
          v-model="form.model"
          filterable
          allow-create
          default-first-option
          :placeholder="activeProviderInfo?.modelHint || '选择或输入模型名称'"
          class="full-width"
        >
          <el-option
            v-for="model in activeProviderInfo?.models || []"
            :key="model"
            :label="model"
            :value="model"
          />
        </el-select>
      </el-form-item>

      <div class="form-row">
        <el-form-item label="温度">
          <el-input-number v-model="form.temperature" :min="0" :max="2" :step="0.1" />
        </el-form-item>
        <el-form-item label="最大输出 token">
          <el-input-number v-model="form.maxTokens" :min="256" :max="128000" :step="256" />
        </el-form-item>
        <el-form-item label="超时（秒）">
          <el-input-number v-model="form.timeoutSeconds" :min="5" :max="600" :step="5" />
        </el-form-item>
      </div>

      <el-form-item label="API Key">
        <el-input
          v-model="form.apiKey"
          type="password"
          show-password
          :placeholder="keyPlaceholder"
          autocomplete="off"
        />
        <div class="key-row">
          <el-checkbox v-if="savedProfile?.keyConfigured" v-model="form.clearApiKey">
            清除已保存密钥
          </el-checkbox>
          <span class="inline-hint">
            密钥仅写入后端本地文件，不进入浏览器存储与日志。
          </span>
        </div>
      </el-form-item>
    </el-form>

    <div class="action-row">
      <el-button :loading="testing" @click="handleTest">测试连接</el-button>
      <el-button :loading="saving" @click="handleSave(false)">仅保存</el-button>
      <el-button type="primary" :loading="saving" @click="handleSave(true)">保存并应用</el-button>
    </div>

    <div v-if="savedProfiles.length > 0" class="saved-block">
      <h4>已保存的服务商</h4>
      <div class="saved-list">
        <button
          v-for="item in savedProfiles"
          :key="item.provider"
          class="saved-item"
          :class="{ active: item.provider === summary?.activeProvider }"
          type="button"
          @click="editSavedProfile(item)"
        >
          <span class="saved-name">{{ item.displayName }}</span>
          <span class="saved-model">{{ item.model || '未设置模型' }}</span>
          <el-tag v-if="item.keyConfigured" size="small" effect="plain" type="success">
            密钥 ·{{ item.keyTail }}
          </el-tag>
          <el-tag v-else size="small" effect="plain" type="info">无密钥</el-tag>
          <el-tag v-if="item.provider === summary?.activeProvider" size="small">生效中</el-tag>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ApiError } from '../../../shared/services/apiClient'
import {
  fetchAIProviders,
  fetchAISettings,
  saveAISettings,
  testAIConnection,
  type AIProviderInfo,
  type AIProfileSummary,
  type AISafeSettings,
} from '../../../shared/services/aiSettingsService'

/** 组件事件：dirty 用于父级分页拦截 */
const emit = defineEmits<{
  (event: 'dirty', value: boolean): void
}>()

/** 表单模型 */
interface ModelForm {
  provider: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  timeoutSeconds: number
  apiKey: string
  clearApiKey: boolean
}

// 服务商目录
const providers = ref<AIProviderInfo[]>([])
// 后端安全摘要
const summary = ref<AISafeSettings | null>(null)
// 配置文件名称（用于提示）
const configFile = computed(() => summary.value?.configFile || '')
// 已保存档案
const savedProfiles = computed<AIProfileSummary[]>(() => summary.value?.profiles || [])

// 表单状态
const form = reactive<ModelForm>({
  provider: '',
  baseUrl: '',
  model: '',
  temperature: 0.7,
  maxTokens: 8000,
  timeoutSeconds: 120,
  apiKey: '',
  clearApiKey: false,
})

// 加载与操作状态
const loading = ref(false)
const testing = ref(false)
const saving = ref(false)

// 上次保存/加载时的表单快照，用于判断是否有未保存修改
const snapshot = ref('')

// 当前服务商目录信息
const activeProviderInfo = computed(() =>
  providers.value.find((item) => item.provider === form.provider),
)

// 当前服务商已保存的档案
const savedProfile = computed(() =>
  savedProfiles.value.find((item) => item.provider === form.provider),
)

// 密钥输入提示：已配置时只显示尾号
const keyPlaceholder = computed(() => {
  const saved = savedProfile.value
  if (saved?.keyConfigured) {
    return `已配置（尾号 ${saved.keyTail}），留空保持不变`
  }
  return activeProviderInfo.value?.keyRequired ? '请输入 API Key' : '本地服务可留空'
})

// 状态提示文案
const statusText = computed(() => {
  if (!summary.value) return ''
  if (!summary.value.configured) {
    return '当前配置尚不可用，请补全模型与密钥后保存。'
  }
  const sourceText =
    summary.value.keySource === 'file'
      ? '密钥来自本地配置'
      : summary.value.keySource === 'env'
        ? '密钥来自 backend/.env'
        : '免密钥服务'
  return `当前生效：${summary.value.providerLabel} · ${summary.value.model}（${sourceText}）`
})

/**
 * 计算表单快照
 * @returns 序列化字符串
 */
function currentSnapshot(): string {
  return JSON.stringify({
    provider: form.provider,
    baseUrl: form.baseUrl,
    model: form.model,
    temperature: form.temperature,
    maxTokens: form.maxTokens,
    timeoutSeconds: form.timeoutSeconds,
    apiKey: form.apiKey,
    clearApiKey: form.clearApiKey,
  })
}

/**
 * 按服务商目录与已保存档案回填表单
 * @param providerId 服务商标识
 * @param useSaved 是否优先使用已保存档案
 */
function fillForm(providerId: string, useSaved = true): void {
  const info = providers.value.find((item) => item.provider === providerId)
  const saved = summary.value?.profiles?.find((item) => item.provider === providerId)

  form.provider = providerId
  if (useSaved && saved) {
    form.baseUrl = saved.baseUrl || info?.baseUrl || ''
    form.model = saved.model || info?.models?.[0] || ''
    form.temperature = saved.temperature ?? 0.7
    form.maxTokens = saved.maxTokens ?? summary.value?.maxTokens ?? 8000
    form.timeoutSeconds = saved.timeoutSeconds ?? summary.value?.timeoutSeconds ?? 120
  } else {
    form.baseUrl = info?.baseUrl || ''
    form.model = info?.models?.[0] || ''
    form.temperature = 0.7
    form.maxTokens = summary.value?.maxTokens ?? 8000
    form.timeoutSeconds = summary.value?.timeoutSeconds ?? 120
  }

  // 密钥字段永远从空开始，避免误以为能读到旧密钥
  form.apiKey = ''
  form.clearApiKey = false
  // 回填后刷新快照，避免误报 dirty
  snapshot.value = currentSnapshot()
  emit('dirty', false)
}

/**
 * 切换服务商
 * @param provider 目录条目
 */
function selectProvider(provider: AIProviderInfo): void {
  fillForm(provider.provider)
}

/**
 * 点击已保存档案进行编辑
 * @param item 档案摘要
 */
function editSavedProfile(item: AIProfileSummary): void {
  fillForm(item.provider)
}

/**
 * 加载目录与摘要
 */
async function loadData(): Promise<void> {
  loading.value = true
  try {
    const [providerList, settings] = await Promise.all([fetchAIProviders(), fetchAISettings()])
    providers.value = providerList
    summary.value = settings

    // 优先回填当前生效服务商
    const initial =
      settings.activeProvider || providerList[0]?.provider || ''
    if (initial) {
      const saved = settings.profiles?.find((item) => item.provider === initial)
      if (saved) {
        fillForm(initial)
        if (settings.activeProfile) {
          form.baseUrl = settings.activeProfile.baseUrl
          form.model = settings.activeProfile.model
          form.temperature = settings.activeProfile.temperature
          form.maxTokens = settings.activeProfile.maxTokens
          form.timeoutSeconds = settings.activeProfile.timeoutSeconds
          snapshot.value = currentSnapshot()
          emit('dirty', false)
        }
      } else if (settings.activeProfile) {
        fillForm(initial, false)
        form.baseUrl = settings.activeProfile.baseUrl
        form.model = settings.activeProfile.model
        form.temperature = settings.activeProfile.temperature
        form.maxTokens = settings.activeProfile.maxTokens
        form.timeoutSeconds = settings.activeProfile.timeoutSeconds
        snapshot.value = currentSnapshot()
        emit('dirty', false)
      } else {
        fillForm(initial, false)
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.detail : (error as Error).message)
  } finally {
    loading.value = false
  }
}

/**
 * 构造测试草稿
 */
function buildDraft() {
  return {
    provider: form.provider,
    baseUrl: form.baseUrl || undefined,
    model: form.model || undefined,
    // 只有用户输入了新密钥才覆盖，否则沿用已保存密钥
    apiKey: form.apiKey || undefined,
    timeoutSeconds: form.timeoutSeconds,
    maxTokens: form.maxTokens,
  }
}

/**
 * 测试连接
 */
async function handleTest(): Promise<void> {
  if (!form.provider || !form.model) {
    ElMessage.warning('请先选择服务商并填写模型')
    return
  }
  testing.value = true
  try {
    const result = await testAIConnection(buildDraft())
    ElMessage.success(`连接成功（${result.model || form.model}，${result.latencyMs ?? 0}ms）`)
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.detail : (error as Error).message)
  } finally {
    testing.value = false
  }
}

/**
 * 保存配置
 * @param apply 是否同时设为当前生效服务商
 */
async function handleSave(apply: boolean): Promise<void> {
  if (!form.provider || !form.model) {
    ElMessage.warning('请先选择服务商并填写模型')
    return
  }
  saving.value = true
  try {
    const result = await saveAISettings({
      activeProvider: apply ? form.provider : undefined,
      profiles: [
        {
          provider: form.provider,
          baseUrl: form.baseUrl,
          model: form.model,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          timeoutSeconds: form.timeoutSeconds,
          // 空字符串表示沿用旧密钥
          apiKey: form.apiKey || undefined,
          clearApiKey: form.clearApiKey,
        },
      ],
    })
    summary.value = result
    // 保存后清空密钥输入与清除标记，回到“只显示尾号”状态
    form.apiKey = ''
    form.clearApiKey = false
    snapshot.value = currentSnapshot()
    emit('dirty', false)
    ElMessage.success(apply ? '已保存并应用' : '已保存')
  } catch (error) {
    ElMessage.error(error instanceof ApiError ? error.detail : (error as Error).message)
  } finally {
    saving.value = false
  }
}

// 表单变化时同步 dirty 状态
watch(
  () => currentSnapshot(),
  (value) => {
    emit('dirty', Boolean(snapshot.value) && value !== snapshot.value)
  },
)

// 首次加载
onMounted(loadData)
</script>

<style lang="scss" scoped>
.model-panel {
  max-width: 820px;
}

.section-header {
  margin-bottom: 16px;
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

.status-alert {
  margin-bottom: 16px;
}

.provider-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
}

/* 服务商卡片：与语音页保持一致的交互样式 */
.provider-card {
  position: relative;
  padding: 12px 14px;
  text-align: left;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 8px;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;

  &:hover {
    border-color: var(--primary-color);
  }

  &.active {
    border-color: var(--primary-color);
    background: rgba(64, 158, 255, 0.06);
  }
}

.provider-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.provider-badge {
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 999px;
  color: #e6a23c;
  background: rgba(230, 162, 60, 0.12);

  &.local {
    color: #67c23a;
    background: rgba(103, 194, 58, 0.12);
  }
}

.provider-desc {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.form-spaced {
  margin-top: 20px;
}

.form-row {
  display: flex;
  gap: 24px;

  :deep(.el-form-item) {
    flex: 1;
  }
}

.full-width {
  width: 100%;
}

.key-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 8px;
}

.inline-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.action-row {
  display: flex;
  gap: 12px;
  margin-top: 20px;
}

.saved-block {
  margin-top: 28px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);

  h4 {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--text-color);
  }
}

.saved-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.saved-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  text-align: left;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  cursor: pointer;

  &.active {
    border-color: var(--primary-color);
  }
}

.saved-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
}

.saved-model {
  flex: 1;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.prototype-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color-secondary);
  }
}
</style>
