<!--
  课堂点评卡（小老师的课后反馈）

  职责：
  - 展示星级、关键数据与三段式点评
  - 支持"听小老师说"语音朗读
  - 支持关闭与再练一次
  说明：
  - 纯展示组件，星级与文案由 shared/utils/lessonFeedback.ts 计算
  - 朗读失败只提示，不影响关闭或再练
-->

<template>
  <el-dialog
    :model-value="modelValue"
    width="520px"
    class="feedback-dialog"
    :close-on-click-modal="false"
    @closed="stopSpeech"
    @update:model-value="(value: boolean) => emit('update:modelValue', value)"
  >
    <template #header>
      <div class="feedback-header">
        <div class="teacher-avatar">师</div>
        <div>
          <div class="teacher-name">学习小老师</div>
          <div class="teacher-sub">{{ lessonTitle }} · {{ modeLabel }}</div>
        </div>
      </div>
    </template>

    <div v-if="result" class="feedback-body">
      <!-- 星级：使用只读 el-rate，保持与全站视觉一致 -->
      <div class="stars-block">
        <el-rate :model-value="result.stars" :max="5" disabled size="large" />
        <span class="stars-text">{{ result.stars }} / 5 星</span>
      </div>

      <div class="metric-row">
        <div class="metric-item">
          <span class="metric-value">{{ Math.round(result.completionRate * 100) }}%</span>
          <span class="metric-label">完成度</span>
        </div>
        <div v-if="firstTryPercent !== null" class="metric-item">
          <span class="metric-value">{{ firstTryPercent }}%</span>
          <span class="metric-label">首答正确</span>
        </div>
        <div class="metric-item">
          <span class="metric-value">{{ durationText }}</span>
          <span class="metric-label">本次用时</span>
        </div>
      </div>

      <div class="speech-bubble">
        <p class="speech-line praise">{{ result.praise }}</p>
        <p class="speech-line">{{ result.observation }}</p>
        <p class="speech-line next">{{ result.nextAction }}</p>
      </div>

      <div v-if="result.strengths.length > 0" class="tag-row">
        <el-tag v-for="item in result.strengths" :key="item" type="success" effect="plain">
          {{ item }}
        </el-tag>
        <el-tag v-for="item in result.issues" :key="item" type="warning" effect="plain">
          {{ item }}
        </el-tag>
      </div>
    </div>

    <template #footer>
      <div class="feedback-footer">
        <el-button :loading="speaking" @click="speakFeedback">
          {{ speaking ? '正在朗读…' : '听小老师说' }}
        </el-button>
        <div class="footer-right">
          <el-button @click="emit('update:modelValue', false)">关闭</el-button>
          <el-button type="primary" @click="emit('retry')">再练一次</el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { playSpeech, stopSpeech } from '../../composables/useSpeechPlayer'
import type { LessonFeedbackResult } from '../../../shared/utils/lessonFeedback'

// 组件属性
const props = defineProps<{
  /** 是否显示 */
  modelValue: boolean
  /** 点评结果 */
  result: LessonFeedbackResult | null
  /** 课时标题 */
  lessonTitle: string
  /** 模式展示名 */
  modeLabel: string
  /** 课堂用时（毫秒） */
  durationMs: number
  /** 用于语音缓存的业务键 */
  lessonId: string
}>()

// 组件事件
const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'retry'): void
}>()

// 朗读进行状态
const speaking = ref(false)

// 首答正确率：仅燃尽模式展示
const firstTryPercent = computed(() => {
  if (!props.result || props.result.firstTryRate <= 0) return null
  return Math.round(props.result.firstTryRate * 100)
})

// 用时展示：超过 1 分钟显示分秒
const durationText = computed(() => {
  const seconds = Math.max(0, Math.round(props.durationMs / 1000))
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return `${minutes} 分 ${seconds % 60} 秒`
})

/**
 * 朗读完整点评
 * 说明：复用当前设置中的引擎与音色，失败只提示不阻塞。
 */
async function speakFeedback(): Promise<void> {
  if (!props.result) return
  speaking.value = true
  try {
    const ok = await playSpeech(props.result.fullText, `feedback-${props.lessonId}`)
    if (!ok) ElMessage.warning('朗读未开始，请检查语音服务')
  } catch (error) {
    ElMessage.error((error as Error).message || '朗读失败')
  } finally {
    speaking.value = false
  }
}

// 关闭弹窗时停止朗读（由 el-dialog 的 closed 事件触发）
</script>

<style lang="scss" scoped>
.feedback-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 教师头像：纯色圆形 + 单字，避免引入额外图片资源 */
.teacher-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--primary-color);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.teacher-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-color);
}

.teacher-sub {
  margin-top: 2px;
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.stars-block {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.stars-text {
  font-size: 14px;
  color: #e6a23c;
  font-weight: 600;
}

.metric-row {
  display: flex;
  gap: 28px;
  padding: 12px 0 16px;
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.metric-label {
  font-size: 12px;
  color: var(--text-color-placeholder);
}

/* 对话气泡：让点评更像"老师说话" */
.speech-bubble {
  position: relative;
  padding: 14px 16px;
  background: var(--bg-color-secondary, #f7f8fa);
  border-radius: 0 12px 12px 12px;
}

.speech-line {
  margin: 0 0 8px;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-color);

  &:last-child {
    margin-bottom: 0;
  }

  &.praise {
    font-weight: 600;
  }

  &.next {
    color: var(--primary-color);
  }
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.feedback-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.footer-right {
  display: flex;
  gap: 8px;
}
</style>
