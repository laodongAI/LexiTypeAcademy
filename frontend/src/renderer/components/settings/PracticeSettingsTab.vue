<!--
  练习设置分页

  职责：
  - 打字练习的提示、拼音与按键音效开关
  说明：全部字段直接绑定 settings store，即改即存。
-->

<template>
  <section class="tab-panel">
    <div class="section-header">
      <h3 class="section-title">打字练习</h3>
      <p class="section-desc">调整练习页面的辅助信息与音效反馈。</p>
    </div>

    <el-form label-position="top" class="prototype-form">
      <el-form-item label="显示提示">
        <div class="inline-row">
          <el-switch v-model="typingShowHint" />
          <span class="hint">在练习中显示按键提示</span>
        </div>
      </el-form-item>

      <el-form-item label="显示拼音">
        <div class="inline-row">
          <el-switch v-model="typingShowPinyin" />
          <span class="hint">在英文文本上方显示拼音辅助</span>
        </div>
      </el-form-item>

      <el-form-item label="按键音效">
        <div class="inline-row">
          <el-switch v-model="typingSoundEnabled" />
          <span class="hint">敲击键盘时播放轻量音效</span>
        </div>
      </el-form-item>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../../stores/settings'

// 设置 store：字段直接双向绑定
const settingsStore = useSettingsStore()

// 打字练习相关字段
const { typingShowHint, typingShowPinyin, typingSoundEnabled } = storeToRefs(settingsStore)
</script>

<style lang="scss" scoped>
.tab-panel {
  max-width: 720px;
}

.section-header {
  margin-bottom: 20px;
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

.inline-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.hint {
  color: var(--text-color-placeholder);
  font-size: 13px;
}

.prototype-form {
  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color-secondary);
  }
}
</style>
