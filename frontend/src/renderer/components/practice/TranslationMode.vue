<!--
  翻译模式组件
  
  看中文，写英文
-->

<template>
  <el-card class="translation-mode">
    <div class="practice-content">
      <!-- 中文提示 -->
      <div class="chinese-section">
        <h3>请翻译以下内容：</h3>
        <div class="chinese-text">{{ item.chinese }}</div>
      </div>
      
      <!-- 输入区 -->
      <div class="input-section">
        <el-input
          v-model="userAnswer"
          type="textarea"
          :rows="4"
          placeholder="请输入英文翻译..."
          :disabled="showAnswer"
          @keyup.enter.ctrl="handleSubmit"
        />
      </div>
      
      <!-- 答案显示区 -->
      <div v-if="showAnswer" class="answer-section">
        <el-alert
          :title="isCorrect ? '翻译正确！' : '有些差异'"
          :type="isCorrect ? 'success' : 'warning'"
          :closable="false"
        >
          <template #default>
            <div class="answer-details">
              <div class="answer-item">
                <span class="label">参考答案:</span>
                <span class="value correct">{{ item.english }}</span>
              </div>
              <div class="answer-item">
                <span class="label">你的翻译:</span>
                <span class="value" :class="{ incorrect: !isCorrect }">{{ userAnswer }}</span>
              </div>
              <div v-if="similarity < 100" class="answer-item">
                <span class="label">相似度:</span>
                <span class="value">{{ similarity }}%</span>
              </div>
            </div>

            <el-divider />

            <TeachingFeedbackPanel
              :loading="feedbackLoading"
              :error="feedbackError"
              :feedback="teachingFeedback"
              :nextHint="nextHint"
            />
          </template>
        </el-alert>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button
          v-if="!showAnswer"
          type="primary"
          @click="handleSubmit"
          :disabled="!userAnswer.trim()"
        >
          提交翻译
        </el-button>
        <el-button
          v-else
          type="primary"
          @click="handleNext"
        >
          下一题
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch, type Component, inject } from 'vue'
import type { LessonItem, PracticeMode } from '../../../shared/types/course'
import { evaluateDictation, type HintLevel, type TeachingHint } from '../../../shared/services/teaching'
import type { TeachingFeedbackResponse } from '../../../shared/services/ai'
import { useTeachingFeedback, teachingFeedbackKey } from '../../composables/useTeachingFeedback'
import { practiceAttemptContextKey } from '../../composables/practiceAttemptContext'
import { recordPracticeAttemptEvent } from '../../../shared/services/practiceAttemptEventService'
import * as TeachingFeedbackPanelModule from './TeachingFeedbackPanel.vue'

interface Props {
  item: LessonItem
}

interface Emits {
  (e: 'next'): void
  (e: 'answer', correct: boolean, answer: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const TeachingFeedbackPanel = (TeachingFeedbackPanelModule as unknown as { default: Component }).default

const userAnswer = ref('')
const showAnswer = ref(false)
const isCorrect = ref(false)
const similarity = ref(0)

const attemptCount = ref(0)
const hintLevel = ref<HintLevel>(0)
const nextHint = ref<TeachingHint | null>(null)

const injectedTeachingFeedback = inject(teachingFeedbackKey, null)
const localTeachingFeedback = useTeachingFeedback()
const {
  feedback: teachingFeedback,
  loading: feedbackLoading,
  error: feedbackError,
  reset: resetFeedback,
  generate: generateFeedback,
} = injectedTeachingFeedback ?? localTeachingFeedback

const practiceAttemptContext = inject(practiceAttemptContextKey, null)

// 监听题目变化
watch(() => props.item, () => {
  userAnswer.value = ''
  showAnswer.value = false
  isCorrect.value = false
  similarity.value = 0
  attemptCount.value = 0
  hintLevel.value = 0
  nextHint.value = null
  resetFeedback()
})

// 提交答案
async function handleSubmit() {
  if (!userAnswer.value.trim()) return

  attemptCount.value += 1

  const hintLevelAtSubmit = hintLevel.value

  const engine = evaluateDictation({
    targetText: props.item.english,
    userText: userAnswer.value,
    attemptCount: attemptCount.value,
    chineseHint: props.item.chinese,
    previousHintLevel: hintLevel.value,
  })
  
  similarity.value = Math.round(engine.similarity * 100)
  // 翻译允许表达差异：沿用原先“>=80% 视为正确”的宽松策略
  isCorrect.value = similarity.value >= 80
  nextHint.value = engine.nextHint
  hintLevel.value = engine.nextHint.level
  showAnswer.value = true
  
  emit('answer', isCorrect.value, userAnswer.value)

  if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
    void recordPracticeAttemptEvent({
      courseId: practiceAttemptContext.courseId.value,
      lessonId: practiceAttemptContext.lessonId.value,
      unitId: props.item.id,
      mode: 'translation' as PracticeMode,
      referenceText: props.item.english,
      chineseHint: props.item.chinese,
      userText: userAnswer.value,
      correct: isCorrect.value,
      attemptCount: attemptCount.value,
      hintLevelAtSubmit,
      nextHintLevel: engine.nextHint.level,
      similarity: engine.similarity,
      extra: {
        similarityPercent: similarity.value,
      },
    })
  }

  await generateFeedback({
    mode: 'translation',
    referenceText: props.item.english,
    userText: userAnswer.value,
    chineseHint: props.item.chinese,
    attemptCount: attemptCount.value,
  })
}

// 下一题
function handleNext() {
  emit('next')
}
</script>

<style lang="scss" scoped>
.translation-mode {
  .practice-content {
    padding: 24px;
  }
  
  .chinese-section {
    text-align: center;
    padding: 40px 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    color: white;
    margin-bottom: 32px;
    
    h3 {
      margin: 0 0 20px 0;
      font-size: 18px;
      font-weight: 500;
      opacity: 0.9;
    }
    
    .chinese-text {
      font-size: 28px;
      font-weight: 600;
      line-height: 1.6;
    }
  }
  
  .input-section {
    margin: 32px 0;
  }
  
  .answer-section {
    margin: 24px 0;
    
    .answer-details {
      margin-top: 12px;
      
      .answer-item {
        margin: 8px 0;
        display: flex;
        gap: 12px;
        
        .label {
          font-weight: 600;
          color: var(--el-text-color-secondary);
          min-width: 80px;
        }
        
        .value {
          flex: 1;
          
          &.correct {
            color: var(--el-color-success);
            font-weight: 500;
          }
          
          &.incorrect {
            color: var(--el-color-warning);
          }
        }
      }
    }
  }
  
  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 32px;
  }
}
</style>
