<template>
  <div class="teaching-feedback">
    <div class="feedback-header">
      <h4>{{ title }}</h4>
      <span v-if="loading" class="feedback-status">生成中...</span>
    </div>

    <div v-if="nextHint" class="next-hint">
      <div class="hint-title">{{ nextHint.title }}</div>
      <div class="hint-text">{{ nextHint.content }}</div>
    </div>

    <div v-if="error" class="feedback-error">{{ error }}</div>

    <div v-else-if="feedback">
      <div class="feedback-summary">{{ feedback.summary }}</div>
      <div v-if="feedback.strengths?.length" class="feedback-block">
        <div class="block-title">做得好的地方</div>
        <ul>
          <li v-for="(s, i) in feedback.strengths" :key="i">{{ s }}</li>
        </ul>
      </div>
      <div v-if="feedback.issues?.length" class="feedback-block">
        <div class="block-title">需要改进</div>
        <ul>
          <li v-for="(it, i) in feedback.issues" :key="i">
            {{ it.message }}（建议：{{ it.suggestion }}）
          </li>
        </ul>
      </div>
      <div v-if="feedback.nextSteps?.length" class="feedback-block">
        <div class="block-title">下一步</div>
        <ul>
          <li v-for="(n, i) in feedback.nextSteps" :key="i">{{ n }}</li>
        </ul>
      </div>
    </div>

    <div v-else class="feedback-placeholder">{{ placeholder }}</div>
  </div>
</template>

<script setup lang="ts">
import type { TeachingFeedbackResponse } from '../../../shared/services/ai'
import type { TeachingHint } from '../../../shared/services/teaching'

interface Props {
  title?: string
  loading: boolean
  error: string
  feedback: TeachingFeedbackResponse | null
  nextHint?: TeachingHint | null
  placeholder?: string
}

withDefaults(defineProps<Props>(), {
  title: 'AI 教学反馈',
  nextHint: null,
  placeholder: '未配置 AI 时将只显示基础提示。',
})
</script>

<style scoped lang="scss">
.teaching-feedback {
  .feedback-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;

    h4 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
    }

    .feedback-status {
      color: var(--el-text-color-secondary);
      font-size: 12px;
    }
  }

  .next-hint {
    margin-top: 10px;
    padding: 10px 12px;
    background-color: var(--el-fill-color-light);
    border-radius: 8px;

    .hint-title {
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 4px;
    }

    .hint-text {
      color: var(--el-text-color-regular);
      line-height: 1.5;
      word-break: break-word;
      white-space: pre-wrap;
    }
  }

  .feedback-error {
    margin-top: 8px;
    color: var(--el-color-danger);
    font-size: 12px;
  }

  .feedback-placeholder {
    margin-top: 8px;
    color: var(--el-text-color-secondary);
    font-size: 12px;
  }

  .feedback-summary {
    margin-top: 8px;
    color: var(--el-text-color-regular);
    line-height: 1.6;
  }

  .feedback-block {
    margin-top: 10px;

    .block-title {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-bottom: 6px;
    }

    ul {
      margin: 0;
      padding-left: 18px;
      color: var(--el-text-color-regular);
      line-height: 1.6;
    }
  }
}
</style>
