<!--
  数据与关于分页

  职责：
  - 提供数据导入/导出入口（首版占位，归批次E）
  - 清理语音内存缓存
  - 展示版本与外部链接
  - 重置所有设置
-->

<template>
  <section class="tab-panel">
    <div class="section-header">
      <h3 class="section-title">数据</h3>
      <p class="section-desc">数据导入导出将在后续批次提供，当前仅保留入口。</p>
    </div>

    <div class="action-row">
      <el-button disabled>导入数据（即将支持）</el-button>
      <el-button disabled>导出数据（即将支持）</el-button>
      <el-button @click="clearTtsCache">清理语音缓存</el-button>
    </div>

    <div class="section-header section-header-spaced">
      <h3 class="section-title">关于</h3>
    </div>

    <div class="about-info">
      <div class="app-logo">
        <img src="../../assets/logo.svg" alt="LexiType" />
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
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Link } from '@element-plus/icons-vue'
import { useSettingsStore } from '../../stores/settings'
import { getTTSApiService } from '../../../shared/services/ttsApiService'

// 设置 store：用于重置
const settingsStore = useSettingsStore()

// 应用版本：与旧设置页保持一致
const appVersion = ref('0.1.0')

/**
 * 清理 TTS 内存缓存
 * 说明：仅清理前端进程内缓存，IndexedDB 持久化缓存保留，避免重复合成。
 */
function clearTtsCache(): void {
  getTTSApiService().clearCache()
  ElMessage.success('语音内存缓存已清理')
}

/**
 * 打开外部链接
 * @param url 目标地址
 */
function openLink(url: string): void {
  window.open(url, '_blank')
}

/**
 * 重置所有设置
 * 说明：二次确认后调用 store 重置，并立即落盘。
 */
async function resetAllSettings(): Promise<void> {
  try {
    await ElMessageBox.confirm(
      '确定要重置所有设置为默认值吗？此操作不可撤销。',
      '重置设置',
      { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' },
    )
    settingsStore.resetSettings()
    ElMessage.success('设置已重置')
  } catch {
    // 用户取消：无需处理
  }
}
</script>

<style lang="scss" scoped>
.tab-panel {
  max-width: 720px;
}

.section-header {
  margin-bottom: 16px;
}

.section-header-spaced {
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

.action-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.about-info {
  display: flex;
  align-items: center;
  gap: 24px;

  .app-logo img {
    width: 80px;
    height: 80px;
  }

  .app-details {
    h2 {
      margin: 0 0 8px;
      color: var(--text-color);
    }

    .version {
      margin: 0 0 8px;
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
  margin-top: 16px;
}

.actions {
  margin-top: 24px;
}
</style>
