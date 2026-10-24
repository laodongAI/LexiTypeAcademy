<!--
  通用设置分页

  职责：
  - 主题色与界面语言的即时保存
  - 全部字段直接绑定 settings store，修改后由 store 的 watch 自动落盘
  说明：不使用本地草稿，符合“本地偏好即改即存”的设计。
-->

<template>
  <section class="tab-panel">
    <el-form label-position="top" class="prototype-form">
      <el-form-item label="学习昵称">
        <el-input v-model="nickname" maxlength="12" show-word-limit placeholder="小老师会这样称呼你" />
        <p class="field-hint">可留空。设置后课堂点评会用这个名字称呼你，仅保存在本机。</p>
      </el-form-item>
    </el-form>

    <div class="section-header section-spaced">
      <h3 class="section-title">外观</h3>
      <p class="section-desc">主题与语言会立即生效，并保存在本机浏览器中。</p>
    </div>

    <el-form label-position="top" class="prototype-form">
      <el-form-item label="主题色">
        <el-radio-group v-model="theme">
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

      <el-form-item label="界面语言">
        <el-select v-model="language">
          <el-option label="简体中文" value="zh-CN" />
          <el-option label="English" value="en-US" />
        </el-select>
      </el-form-item>
    </el-form>
  </section>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useSettingsStore } from '../../stores/settings'

// 设置 store：直接读写响应式字段，watch 会自动持久化
const settingsStore = useSettingsStore()

// 主题、语言与昵称：双向绑定到 store 的 ref
const { theme, language, nickname } = storeToRefs(settingsStore)
</script>

<style lang="scss" scoped>
.tab-panel {
  max-width: 720px;
}

.section-header {
  margin-bottom: 20px;
}

.section-spaced {
  margin-top: 32px;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--text-color-placeholder);
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

/* 主题选项：小圆点直观展示主色 */
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

/* 原型风格表单：弱化边框，保持与旧设置页一致 */
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
