<!--
  学习设置分页

  职责：
  - 每日目标分钟数
  - 新词自动播放开关
  - 复习提醒开关
  说明：全部字段直接绑定 settings store，即改即存。
-->

<template>
  <section class="tab-panel">
    <div class="section-header">
      <h3 class="section-title">学习</h3>
      <p class="section-desc">控制每日学习目标与朗读、复习行为。</p>
    </div>

    <el-form label-position="top" class="prototype-form">
      <el-form-item label="每日目标">
        <div class="inline-row">
          <el-input-number v-model="dailyGoal" :min="5" :max="120" :step="5" />
          <span class="unit">分钟</span>
        </div>
      </el-form-item>

      <el-form-item label="自动播放">
        <div class="inline-row">
          <el-switch v-model="autoPlayAudio" />
          <span class="hint">学习新词时自动播放发音</span>
        </div>
      </el-form-item>

      <el-form-item label="复习提醒">
        <div class="inline-row">
          <el-switch v-model="reviewReminder" />
          <span class="hint">有待复习内容时发送提醒</span>
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

// 学习相关字段
const { dailyGoal, autoPlayAudio, reviewReminder } = storeToRefs(settingsStore)
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

.unit,
.hint {
  margin-left: 4px;
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
