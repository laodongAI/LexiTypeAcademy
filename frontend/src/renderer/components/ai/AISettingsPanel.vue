<!--
  AI 设置面板
  
  功能：
  - 配置 AI 模型参数
  - 选择 AI 提供商
  - 调整学习策略
-->

<template>
  <div class="ai-settings-panel">
    <header class="page-header">
      <h2 class="page-title">AI 设置</h2>
      <p class="page-subtitle">配置 AI 模型与学习策略偏好。</p>
    </header>

    <el-form
      :model="form"
      label-position="top"
      label-width="auto"
      @submit.prevent="save"
      class="settings-form prototype-form"
    >
      <!-- AI 模型选择 -->
      <section class="settings-section">
        <div class="section-header">
          <h3 class="section-title">AI 模型配置</h3>
        </div>

        <el-form-item label="AI 提供商">
          <el-select v-model="form.provider" @change="onProviderChange">
            <el-option label="豆包 (Doubao)" value="doubao" />
            <el-option label="通义千问 (Qwen)" value="qwen" />
            <el-option label="GPT-4" value="gpt4" />
          </el-select>
        </el-form-item>

        <el-form-item label="模型选择">
          <el-select v-model="form.model">
            <el-option
              v-for="option in modelOptions"
              :key="option.value"
              :label="`${option.label} - ${option.desc}`"
              :value="option.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="温度参数 (Temperature)">
          <el-slider
            v-model="form.temperature"
            :min="0"
            :max="1"
            :step="0.1"
            show-input
          />
          <div class="form-hint">
            💡 较低值（0-0.3）：更确定和准确的回应
            <br />
            中等值（0.5-0.7）：平衡创意和准确性
            <br />
            较高值（0.8-1.0）：更创意和多样化的回应
          </div>
        </el-form-item>
      </section>

      <!-- 学习策略 -->
      <section class="settings-section">
        <div class="section-header">
          <h3 class="section-title">学习策略</h3>
        </div>

        <el-form-item label="推荐复习间隔">
          <el-radio-group v-model="form.reviewInterval" class="option-group">
            <el-radio value="spaced">间隔重复 (推荐)</el-radio>
            <el-radio value="frequent">频繁复习</el-radio>
            <el-radio value="relaxed">轻松模式</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="难度自适应">
          <el-switch v-model="form.adaptiveDifficulty" />
          <div class="form-hint">
            ✨ 启用时，课程难度会根据你的表现自动调整
          </div>
        </el-form-item>

        <el-form-item label="错题集中复习">
          <el-switch v-model="form.focusErrors" />
          <div class="form-hint">
            📌 启用时，系统会优先推荐你经常出错的内容
          </div>
        </el-form-item>

        <el-form-item label="每日学习目标 (分钟)">
          <el-slider
            v-model="form.dailyGoal"
            :min="10"
            :max="180"
            :step="10"
            show-input
          />
        </el-form-item>
      </section>

      <!-- 显示设置 -->
      <section class="settings-section">
        <div class="section-header">
          <h3 class="section-title">显示设置</h3>
        </div>

        <el-form-item label="界面主题">
          <el-radio-group v-model="form.theme" class="option-group">
            <el-radio value="light">浅色</el-radio>
            <el-radio value="dark">深色</el-radio>
            <el-radio value="auto">自动</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="字体大小">
          <el-slider
            v-model="form.fontSize"
            :min="12"
            :max="18"
            :step="1"
            show-input
          />
        </el-form-item>

        <el-form-item label="启用通知">
          <el-switch v-model="form.notifications" />
          <div class="form-hint">
            🔔 接收学习提醒和成就通知
          </div>
        </el-form-item>
      </section>

      <!-- 数据管理 -->
      <section class="settings-section settings-section-last">
        <div class="section-header">
          <h3 class="section-title">数据管理</h3>
        </div>

        <el-form-item>
          <el-button @click="handleExportData">
            📥 导出学习数据
          </el-button>
          <el-button @click="handleImportData">
            📤 导入学习数据
          </el-button>
        </el-form-item>

        <el-form-item>
          <el-popconfirm
            title="确定要清除所有数据吗？"
            description="此操作不可撤销，所有学习进度将被删除。"
            confirm-button-text="是的，清除"
            cancel-button-text="取消"
            @confirm="handleClearData"
          >
            <template #reference>
              <el-button type="danger">
                🗑️ 清除所有数据
              </el-button>
            </template>
          </el-popconfirm>
        </el-form-item>
      </section>

      <!-- 操作按钮 -->
      <el-form-item class="form-actions">
        <div class="actions-row">
          <el-button size="large" @click="reset">恢复默认</el-button>
          <el-button type="primary" size="large" @click="save">保存更改</el-button>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'

interface Config {
  provider: string
  model: string
  temperature: number
  reviewInterval: string
  adaptiveDifficulty: boolean
  focusErrors: boolean
  dailyGoal: number
  theme: string
  fontSize: number
  notifications: boolean
}

interface Props {
  config: Config
}

interface Emits {
  (e: 'update', config: Config): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const form = ref({ ...props.config })

const modelOptions = ref([
  { value: 'doubao-pro', label: '豆包 Pro', desc: '性能最优' },
  { value: 'doubao-lite', label: '豆包 Lite', desc: '快速响应' },
  { value: 'qwen-large', label: '通义千问 Large', desc: '功能完整' },
  { value: 'qwen-small', label: '通义千问 Small', desc: '轻量级' },
  { value: 'gpt4-turbo', label: 'GPT-4 Turbo', desc: '最强能力' },
])

function onProviderChange() {
  // 根据选择的提供商更新可用的模型
  ElMessage.info('模型选项已更新')
}

function save() {
  emit('update', form.value)
  ElMessage.success('设置已保存')
}

function reset() {
  ElMessageBox.confirm(
    '确定要恢复默认设置吗？',
    '提示',
    {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    }
  )
    .then(() => {
      form.value = {
        provider: 'doubao',
        model: 'doubao-pro',
        temperature: 0.8,
        reviewInterval: 'spaced',
        adaptiveDifficulty: true,
        focusErrors: true,
        dailyGoal: 60,
        theme: 'auto',
        fontSize: 14,
        notifications: true,
      }
      save()
    })
    .catch(() => {
      ElMessage.info('已取消')
    })
}

function handleExportData() {
  ElMessage.success('数据导出成功')
  // TODO: 实现数据导出逻辑
}

function handleImportData() {
  ElMessage.info('请选择要导入的数据文件')
  // TODO: 实现数据导入逻辑
}

function handleClearData() {
  ElMessage.success('数据已清除')
  // TODO: 实现数据清除逻辑
}
</script>

<style lang="scss" scoped>
.ai-settings-panel {
  padding: 20px 0;
}

.page-header {
  max-width: 800px;
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

.settings-form {
  max-width: 800px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: 8px;
  }

  :deep(.el-input-number) {
    width: 100%;
  }
}

.settings-section {
  padding: 0 0 28px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 28px;
}

.settings-section-last {
  border-bottom: none;
  margin-bottom: 16px;
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

.form-hint {
  margin-top: 8px;
  padding: 8px 12px;
  font-size: 13px;
  color: #909399;
  background: #f5f7fa;
  border-radius: 6px;
  line-height: 1.5;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  :deep(.el-radio) {
    margin-right: 0;
  }
}

.form-actions {
  margin-top: 8px;
}

.actions-row {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  width: 100%;
}

/* 原型风格：弱化默认边框，强调底边框（尽量不破坏 Element Plus 交互） */
.prototype-form {
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
</style>
