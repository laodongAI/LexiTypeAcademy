<!--
  听写模式组件
  
  听音频，输入英文单词或句子
-->

<template>
  <el-card class="dictation-mode">
    <div class="practice-content">
      <!-- 音频播放区 -->
      <div class="audio-section">
        <el-button
          type="primary"
          circle
          size="large"
          :icon="isPlaying ? 'VideoPause' : 'VideoPlay'"
          @click="toggleAudio"
        />
        <p class="audio-hint">点击播放音频</p>
      </div>
      
      <!-- 输入区 -->
      <div class="input-section">
        <el-input
          v-model="userAnswer"
          type="textarea"
          :rows="4"
          placeholder="请输入你听到的内容..."
          :disabled="showAnswer"
          @keyup.enter.ctrl="handleSubmit"
        />
        
        <!-- 提示（教学引擎 Level） -->
        <div v-if="hintLevel > 0" class="hint-box">
          <el-icon><InfoFilled /></el-icon>
          <div class="hint-content">
            <div class="hint-title">{{ nextHint?.title }}</div>
            <div class="hint-text">{{ nextHint?.content }}</div>
          </div>
        </div>
      </div>
      
      <!-- 答案显示区 -->
      <div v-if="showAnswer" class="answer-section">
        <el-card>
          <div class="answer-details">
            <div class="answer-item">
              <span class="label">正确答案:</span>
              <span class="value correct">{{ item.english }}</span>
            </div>
            <div v-if="!isCorrect" class="answer-item">
              <span class="label">你的答案:</span>
              <span class="value incorrect">{{ userAnswer }}</span>
            </div>
            <div v-if="item.chinese" class="answer-item">
              <span class="label">中文翻译:</span>
              <span class="value">{{ item.chinese }}</span>
            </div>
            <div v-if="engineSimilarity !== null" class="answer-item">
              <span class="label">相似度:</span>
              <span class="value">{{ Math.round(engineSimilarity * 100) }}%</span>
            </div>
          </div>

          <el-divider />

          <TeachingFeedbackPanel
            :loading="feedbackLoading"
            :error="feedbackError"
            :feedback="teachingFeedback"
          />
        </el-card>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button @click="handleShowHint" :disabled="showAnswer">
          提示
        </el-button>
        <el-button @click="toggleAudio">
          重新播放
        </el-button>
        <el-button
          v-if="!showAnswer"
          type="primary"
          @click="handleSubmit"
          :disabled="!userAnswer.trim()"
        >
          提交答案
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
import { InfoFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import type { LessonItem, PracticeMode } from '../../../shared/types/course'
import { getAudioPlayService } from '../../../shared/services/audioPlayService'
import type { TeachingFeedbackResponse } from '../../../shared/services/ai'
import { evaluateDictation, type HintLevel, type TeachingHint } from '../../../shared/services/teaching'
import * as TeachingFeedbackPanelModule from './TeachingFeedbackPanel.vue'
import { useTeachingFeedback, teachingFeedbackKey } from '../../composables/useTeachingFeedback'
import { practiceAttemptContextKey } from '../../composables/practiceAttemptContext'
import { recordPracticeAttemptEvent } from '../../../shared/services/practiceAttemptEventService'

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

const audioPlayService = getAudioPlayService()

const userAnswer = ref('')
const showAnswer = ref(false)
const isCorrect = ref(false)
const isPlaying = ref(false)

const attemptCount = ref(0)
const hintLevel = ref<HintLevel>(0)
const nextHint = ref<TeachingHint | null>(null)
const engineSimilarity = ref<number | null>(null)

const injectedTeachingFeedback = inject(teachingFeedbackKey, null)
const localTeachingFeedback = useTeachingFeedback()
const { feedback: teachingFeedback, loading: feedbackLoading, error: feedbackError, reset: resetFeedback, generate: generateFeedback } =
  injectedTeachingFeedback ?? localTeachingFeedback

const practiceAttemptContext = inject(practiceAttemptContextKey, null)

// 监听题目变化，重置状态
watch(() => props.item, () => {
  audioPlayService.stop()
  userAnswer.value = ''
  showAnswer.value = false
  isCorrect.value = false
  isPlaying.value = false
  attemptCount.value = 0
  hintLevel.value = 0
  nextHint.value = null
  engineSimilarity.value = null
  resetFeedback()
})

// 播放/暂停音频
async function toggleAudio() {
  if (isPlaying.value) {
    audioPlayService.stop()
    isPlaying.value = false
    return
  }
  
  try {
    isPlaying.value = true
    await audioPlayService.play({
      type: 'tts',
      source: props.item.english,
      rate: 1,
    })
  } catch (error) {
    console.error('播放失败:', error)
    ElMessage.error('音频播放失败')
  } finally {
    isPlaying.value = false
  }
}

// 显示提示
function handleShowHint() {
  // Level 4 属于“用户明确请求拓展”场景：这里用重复点击触发（简单实现）
  hintLevel.value = (Math.min(4, hintLevel.value + 1) as HintLevel)
  const engine = evaluateDictation({
    targetText: props.item.english,
    userText: userAnswer.value,
    attemptCount: Math.max(1, attemptCount.value),
    chineseHint: props.item.chinese,
    previousHintLevel: hintLevel.value,
  })
  nextHint.value = engine.nextHint
}

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

  isCorrect.value = engine.correct
  engineSimilarity.value = engine.similarity
  nextHint.value = engine.nextHint
  // 自动提示升级：按尝试次数给到引擎建议 Level
  hintLevel.value = engine.nextHint.level

  showAnswer.value = true
  
  emit('answer', isCorrect.value, userAnswer.value)

  if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
    void recordPracticeAttemptEvent({
      courseId: practiceAttemptContext.courseId.value,
      lessonId: practiceAttemptContext.lessonId.value,
      unitId: props.item.id,
      mode: 'dictation' as PracticeMode,
      referenceText: props.item.english,
      chineseHint: props.item.chinese,
      userText: userAnswer.value,
      correct: engine.correct,
      attemptCount: attemptCount.value,
      hintLevelAtSubmit,
      nextHintLevel: engine.nextHint.level,
      similarity: engine.similarity,
    })
  }

  // AI 增强反馈（可选）
  await generateFeedback({
    mode: 'dictation',
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
.dictation-mode {
  .practice-content {
    padding: 24px;
  }
  
  .audio-section {
    text-align: center;
    padding: 40px 0;
    
    .audio-hint {
      margin-top: 16px;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }
  
  .input-section {
    margin: 32px 0;
    
    .hint-box {
      margin-top: 12px;
      padding: 12px;
      background-color: var(--el-color-warning-light-9);
      border-left: 3px solid var(--el-color-warning);
      border-radius: 4px;
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--el-color-warning);

      .hint-content {
        display: flex;
        flex-direction: column;
        gap: 4px;

        .hint-title {
          font-weight: 600;
          color: var(--el-text-color-primary);
        }

        .hint-text {
          color: var(--el-text-color-regular);
          white-space: pre-wrap;
        }
      }
    }
  }
  
  .answer-section {
    margin: 24px 0;
    
    .answer-details {
      margin-top: 4px;
      
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
            color: var(--el-color-danger);
            text-decoration: line-through;
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

