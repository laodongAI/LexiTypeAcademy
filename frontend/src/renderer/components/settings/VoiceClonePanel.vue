<!--
  克隆音色管理面板（OpenVoice v2）

  职责：
  - 上传参考音频并创建克隆档案（1–30 秒，≤10MB，必须勾选授权）
  - 展示档案列表，支持试听、设为当前音色、删除
  说明：
  - 参考音频只保存在本机后端，前端不留存
  - 合成耗时较长，试听按钮会展示进行中状态
-->

<template>
  <div class="clone-panel">
    <div class="panel-header">
      <div>
        <h4>克隆音色</h4>
        <p class="panel-desc">上传一小段清晰人声（1–30 秒），即可用该音色朗读。</p>
      </div>
      <el-tag type="info" effect="plain">{{ used }} / {{ max }}</el-tag>
    </div>

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="请确认你拥有该声音的使用权，克隆音色仅保存在本机。"
      class="consent-alert"
    />

    <div class="upload-block">
      <el-form label-position="top" class="prototype-form">
        <el-form-item label="音色名称">
          <el-input v-model="profileName" maxlength="24" placeholder="例如：我的声音" />
        </el-form-item>

        <el-form-item label="参考音频">
          <div class="file-row">
            <input
              ref="fileInputRef"
              type="file"
              accept="audio/*,.wav,.mp3,.m4a,.ogg,.flac"
              class="file-input"
              @change="handleFileChange"
            />
            <el-button :disabled="uploading" @click="triggerFilePick">选择音频</el-button>
            <span class="file-name">{{ selectedFile?.name || '未选择文件（≤10MB）' }}</span>
          </div>
        </el-form-item>

        <el-form-item label="使用授权">
          <el-checkbox v-model="consent">
            我确认拥有该声音的使用权，并同意仅在本机使用
          </el-checkbox>
        </el-form-item>

        <el-button
          type="primary"
          :loading="uploading"
          :disabled="!canUpload"
          @click="handleUpload"
        >
          上传并创建克隆音色
        </el-button>
      </el-form>
    </div>

    <div class="profile-list">
      <el-empty v-if="!loading && profiles.length === 0" description="还没有克隆音色" :image-size="72" />

      <div v-for="profile in profiles" :key="profile.id" class="profile-item">
        <div class="profile-main">
          <div class="profile-name">{{ profile.name }}</div>
          <div class="profile-meta">
            {{ formatDuration(profile.durationSec) }} · {{ formatDate(profile.createdAt) }}
          </div>
        </div>
        <div class="profile-actions">
          <el-button size="small" :loading="previewingId === profile.id" @click="preview(profile)">
            试听
          </el-button>
          <el-button
            size="small"
            type="primary"
            plain
            :disabled="currentVoiceId === `clone:${profile.id}`"
            @click="applyProfile(profile)"
          >
            {{ currentVoiceId === `clone:${profile.id}` ? '当前音色' : '设为当前' }}
          </el-button>
          <el-button size="small" type="danger" plain @click="removeProfile(profile)">
            删除
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSettingsStore } from '../../stores/settings'
import { getTTSApiService } from '../../../shared/services/ttsApiService'
import {
  deleteCloneProfile,
  listCloneProfiles,
  uploadCloneProfile,
  type CloneProfile,
} from '../../../shared/services/ttsCloneService'
import { invalidateVoiceCache } from '../../../shared/services/ttsEngineService'

// 设置 store：用于写入当前音色
const settingsStore = useSettingsStore()

// 当前已选音色：用于按钮态
const currentVoiceId = computed(() => settingsStore.ttsVoiceId)

// 档案列表与容量
const profiles = ref<CloneProfile[]>([])
const used = ref(0)
const max = ref(5)
const loading = ref(false)

// 上传表单状态
const profileName = ref('我的克隆音色')
const consent = ref(false)
const selectedFile = ref<File | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const uploading = ref(false)

// 正在试听的档案标识
const previewingId = ref<string | null>(null)

// 是否允许上传：文件、授权、名称、容量都要满足
const canUpload = computed(
  () =>
    Boolean(selectedFile.value) &&
    consent.value &&
    profileName.value.trim().length > 0 &&
    used.value < max.value,
)

/**
 * 加载克隆档案列表
 */
async function loadProfiles(): Promise<void> {
  loading.value = true
  try {
    const result = await listCloneProfiles()
    profiles.value = result.profiles || []
    used.value = result.used ?? profiles.value.length
    max.value = result.max ?? 5
  } catch (error) {
    ElMessage.error((error as Error).message || '读取克隆音色失败')
  } finally {
    loading.value = false
  }
}

/**
 * 触发隐藏的文件选择框
 */
function triggerFilePick(): void {
  fileInputRef.value?.click()
}

/**
 * 文件选择回调
 * @param event input change 事件
 */
function handleFileChange(event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0] || null
  if (file && file.size > 10 * 1024 * 1024) {
    ElMessage.warning('音频文件不能超过 10MB')
    selectedFile.value = null
    target.value = ''
    return
  }
  selectedFile.value = file
}

/**
 * 上传并创建克隆档案
 */
async function handleUpload(): Promise<void> {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    const result = await uploadCloneProfile(
      selectedFile.value,
      profileName.value.trim(),
      consent.value,
    )
    if (!result.success) {
      ElMessage.error(result.error || '上传失败')
      return
    }
    ElMessage.success('克隆音色创建成功')
    // 重置表单
    selectedFile.value = null
    consent.value = false
    if (fileInputRef.value) fileInputRef.value.value = ''
    // 音色列表已变化，清缓存后重新加载
    invalidateVoiceCache('openvoice')
    await loadProfiles()
  } catch (error) {
    ElMessage.error((error as Error).message || '上传失败')
  } finally {
    uploading.value = false
  }
}

/**
 * 试听克隆音色
 * @param profile 目标档案
 */
async function preview(profile: CloneProfile): Promise<void> {
  previewingId.value = profile.id
  try {
    const url = await getTTSApiService().getAudioUrl({
      text: '你好，这是克隆音色的试听效果。',
      language: 'zh',
      engine: 'openvoice',
      voice: `clone:${profile.id}`,
      rate: settingsStore.ttsSpeed,
      format: 'wav',
    })
    if (!url) {
      ElMessage.error('试听失败，请检查后端服务')
      return
    }
    const audio = new Audio(url)
    audio.volume = settingsStore.ttsVolume
    await audio.play()
  } catch (error) {
    ElMessage.error((error as Error).message || '试听失败')
  } finally {
    previewingId.value = null
  }
}

/**
 * 把档案设为当前音色
 * @param profile 目标档案
 */
function applyProfile(profile: CloneProfile): void {
  settingsStore.updateSettings({
    ttsEngine: 'openvoice',
    ttsVoiceId: `clone:${profile.id}`,
  })
  ElMessage.success(`已切换到「${profile.name}」`)
}

/**
 * 删除档案（二次确认）
 * @param profile 目标档案
 */
async function removeProfile(profile: CloneProfile): Promise<void> {
  try {
    await ElMessageBox.confirm(`确定删除「${profile.name}」吗？参考音频会一并删除。`, '删除克隆音色', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return
  }

  try {
    const result = await deleteCloneProfile(profile.id)
    if (!result.success) {
      ElMessage.error(result.error || '删除失败')
      return
    }
    // 若删除的是当前音色，回退到主引擎默认音色
    if (settingsStore.ttsVoiceId === `clone:${profile.id}`) {
      settingsStore.updateSettings({ ttsEngine: 'melo', ttsVoiceId: 'melo:0' })
    }
    invalidateVoiceCache('openvoice')
    await loadProfiles()
    ElMessage.success('已删除')
  } catch (error) {
    ElMessage.error((error as Error).message || '删除失败')
  }
}

/**
 * 秒数转可读文本
 * @param seconds 秒
 */
function formatDuration(seconds: number | null): string {
  if (!seconds) return '时长未知'
  return `${seconds.toFixed(1)} 秒`
}

/**
 * ISO 时间转本地日期
 * @param value ISO 字符串
 */
function formatDate(value: string | null): string {
  if (!value) return '创建时间未知'
  const date = new Date(value)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`
}

// 首次挂载即加载档案
onMounted(loadProfiles)
</script>

<style lang="scss" scoped>
.clone-panel {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px dashed var(--border-color);
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;

  h4 {
    margin: 0 0 4px;
    font-size: 14px;
    color: var(--text-color);
  }
}

.panel-desc {
  margin: 0;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.consent-alert {
  margin-bottom: 16px;
}

.file-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 隐藏原生文件输入，仅通过按钮触发 */
.file-input {
  display: none;
}

.file-name {
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.profile-list {
  margin-top: 16px;
}

.profile-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.profile-name {
  font-size: 14px;
  color: var(--text-color);
}

.profile-meta {
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.profile-actions {
  display: flex;
  gap: 8px;
}

.prototype-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color-secondary);
  }
}
</style>
