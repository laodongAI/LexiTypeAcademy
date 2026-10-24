<!--
  课堂老师字幕气泡

  功能：
  - 展示老师当前台词（中文），像视频字幕一样固定在课堂底部；
  - 提供重播、静音开关；
  - 说话中显示声波动画，语音失败时仍保留文字。

  说明：
  - 容器整体 pointer-events: none，避免遮挡课堂输入区；
  - 只有气泡本体与按钮恢复 pointer-events，保证可点击。
-->

<template>
  <transition name="teacher-bubble">
    <div v-if="visible && text" class="teacher-bubble" role="status" aria-live="polite">
      <div class="teacher-avatar" :class="{ speaking }">
        <span>师</span>
        <i class="wave" aria-hidden="true"><b /><b /><b /></i>
      </div>

      <p class="teacher-text">{{ text }}</p>

      <div class="teacher-controls">
        <button
          type="button"
          class="control-btn"
          :title="muted ? '取消静音' : '静音'"
          :aria-label="muted ? '取消静音' : '静音'"
          @click="$emit('update:muted', !muted)"
        >
          <el-icon><Mute v-if="!muted" /><Microphone v-else /></el-icon>
        </button>
        <button
          type="button"
          class="control-btn"
          title="重播这一句"
          aria-label="重播这一句"
          :disabled="muted"
          @click="$emit('replay')"
        >
          <el-icon><RefreshRight /></el-icon>
        </button>
      </div>
    </div>
  </transition>
</template>

<script setup lang="ts">
import { RefreshRight, Mute, Microphone } from '@element-plus/icons-vue'

/**
 * 组件属性
 */
const props = defineProps<{
  /** 是否显示气泡 */
  visible: boolean
  /** 当前台词 */
  text: string
  /** 是否正在播放语音 */
  speaking: boolean
  /** 是否静音 */
  muted: boolean
}>()

/**
 * 组件事件
 */
defineEmits<{
  /** 点击重播 */
  (event: 'replay'): void
  /** 切换静音（v-model:muted 写法） */
  (event: 'update:muted', value: boolean): void
}>()
</script>

<style scoped>
.teacher-bubble {
  position: fixed;
  left: 50%;
  bottom: 76px;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 12px;
  width: min(720px, calc(100% - 48px));
  padding: 12px 16px;
  border: 1px solid var(--el-color-primary-light-7);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.16);
  backdrop-filter: blur(8px);
  transform: translateX(-50%);
  pointer-events: none;
}

.teacher-avatar {
  position: relative;
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(135deg, #6366f1, #0ea5e9);
}

.teacher-avatar.speaking {
  box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.18);
}

.wave {
  position: absolute;
  right: -14px;
  bottom: 4px;
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 12px;
}

.wave b {
  width: 2px;
  height: 4px;
  border-radius: 2px;
  background: #6366f1;
  animation: wave 0.9s ease-in-out infinite;
}

.wave b:nth-child(2) {
  animation-delay: 0.15s;
}

.wave b:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes wave {
  0%, 100% { height: 4px; opacity: 0.5; }
  50% { height: 10px; opacity: 1; }
}

.teacher-text {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 14.5px;
  line-height: 1.55;
  color: #1f2937;
}

.teacher-controls {
  flex: none;
  display: flex;
  align-items: center;
  gap: 4px;
  pointer-events: auto;
}

.control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 9px;
  color: #475569;
  background: #f1f5f9;
  cursor: pointer;
  transition: background-color 0.16s ease, color 0.16s ease;
}

.control-btn:hover:not(:disabled) {
  color: #4f46e5;
  background: #e0e7ff;
}

.control-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.teacher-bubble-enter-active,
.teacher-bubble-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.teacher-bubble-enter-from,
.teacher-bubble-leave-to {
  opacity: 0;
  transform: translate(-50%, 8px);
}

/* 深色模式：保持字幕可读 */
:global(.dark) .teacher-bubble {
  background: rgba(30, 41, 59, 0.96);
  border-color: rgba(148, 163, 184, 0.28);
}

:global(.dark) .teacher-text {
  color: #e2e8f0;
}

:global(.dark) .control-btn {
  color: #cbd5e1;
  background: rgba(148, 163, 184, 0.16);
}
</style>
