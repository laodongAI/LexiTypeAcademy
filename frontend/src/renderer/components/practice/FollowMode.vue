<!--
  跟读模式组件
  
  跟随音频朗读，录音并评分
-->

<template>
  <el-card class="follow-mode">
    <div class="practice-content">
      <!-- 内容显示区 -->
      <div class="content-section">
        <div class="english-text">{{ item.english }}</div>
        <div class="chinese-text">{{ item.chinese }}</div>
      </div>
      
      <!-- 音频播放区 -->
      <div class="audio-section">
        <el-button
          type="primary"
          circle
          size="large"
          :icon="isPlaying ? 'VideoPause' : 'VideoPlay'"
          @click="toggleAudio"
        />
        <p class="audio-hint">{{ isPlaying ? '老师正在领读…' : '老师已示范，可再次聆听' }}</p>
      </div>
      
      <!-- 录音区 -->
      <div class="recording-section">
        <el-button
          :type="isRecording ? 'danger' : 'success'"
          circle
          size="large"
          :icon="isRecording ? 'VideoPause' : 'Microphone'"
          @click="toggleRecording"
        />
        <p class="recording-hint">
          {{ isRecording ? '录音中...' : '点击开始跟读' }}
        </p>
      </div>
      
      <!-- 评分结果 -->
      <div v-if="showResult" class="result-section">
        <el-alert
          title="跟读完成"
          type="success"
          :closable="false"
        >
          <template #default>
            <div class="score-display">
              <el-progress
                type="circle"
                :percentage="score"
                :width="120"
              >
                <template #default="{ percentage }">
                  <span class="percentage-value">{{ percentage }}</span>
                  <span class="percentage-label">分</span>
                </template>
              </el-progress>
              <p class="score-hint">{{ getScoreHint(score) }}</p>

              <el-divider />
              <TeachingFeedbackPanel
                :loading="feedbackLoading"
                :error="feedbackError"
                :feedback="teachingFeedback"
                :nextHint="nextHint"
              />
            </div>
          </template>
        </el-alert>
      </div>
      
      <!-- 操作按钮 -->
      <div class="keyboard-hint">使用 ← 返回上一项；本题完成后按 → 进入下一项</div>
      <div class="action-buttons">
        <el-button @click="toggleAudio">
          重听示范
        </el-button>
        <el-button
          v-if="!showResult"
          type="primary"
          @click="handleSubmit"
          :disabled="!hasRecording || isSubmitting"
          :loading="isSubmitting"
        >
          {{ isSubmitting ? '评分中...' : '提交录音' }}
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
import { ref, watch, onMounted, onBeforeUnmount, type Component, inject } from 'vue'
import { ElMessage } from 'element-plus'
import type { LessonItem, PracticeMode } from '../../../shared/types/course'
import { getAudioPlayService } from '../../../shared/services/audioPlayService'
import { getAudioRecordService } from '../../../shared/services/audioRecordService'
import { getASRApiService } from '../../../shared/services/asrApiService'
import { evaluatePronunciation, type HintLevel, type TeachingHint } from '../../../shared/services/teaching'
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
  (e: 'previous'): void
  (e: 'answer', correct: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const TeachingFeedbackPanel = (TeachingFeedbackPanelModule as unknown as { default: Component }).default

const audioPlayService = getAudioPlayService()
const audioRecordService = getAudioRecordService()
const asrApiService = getASRApiService()

const isPlaying = ref(false)
const isRecording = ref(false)
const hasRecording = ref(false)
const showResult = ref(false)
const score = ref(0)
const isSubmitting = ref(false)
const recordedAudio = ref<Blob | null>(null)

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
  stopAudioAndRecording()
  isPlaying.value = false
  isRecording.value = false
  hasRecording.value = false
  showResult.value = false
  score.value = 0
  recordedAudio.value = null
  attemptCount.value = 0
  hintLevel.value = 0
  nextHint.value = null
  resetFeedback()
  void playReferenceAudio()
})

// 停止所有音频和录音
function stopAudioAndRecording() {
  audioPlayService.stop()
  if (isRecording.value) {
    audioRecordService.stopRecording()
  }
}

// 进入题目或切换题目时由老师自动领读；用户仍可主动重听。
onMounted(() => {
  void playReferenceAudio()
  window.addEventListener('keydown', handleFollowKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleFollowKeydown)
})

function handleFollowKeydown(event: KeyboardEvent): void {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  const target = event.target
  if (target instanceof HTMLElement && (
    target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName)
  )) return
  if (event.key === 'ArrowLeft') {
    event.preventDefault()
    emit('previous')
  } else if (event.key === 'ArrowRight' && showResult.value) {
    event.preventDefault()
    emit('next')
  }
}

async function playReferenceAudio(): Promise<void> {
  try {
    audioPlayService.stop()
    isPlaying.value = true
    await audioPlayService.play({
      type: 'tts',
      source: props.item.english,
      rate: 0.92,
    })
  } catch (error) {
    console.error('老师领读失败:', error)
    ElMessage.warning('自动领读失败，请点击“重听示范”')
  } finally {
    isPlaying.value = false
  }
}

// 播放音频
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

// 录音
async function toggleRecording() {
  if (isRecording.value) {
    // 停止录音
    try {
      const blob = await audioRecordService.stopRecording()
      if (blob) {
        recordedAudio.value = blob
        hasRecording.value = true
        ElMessage.success('录音完成')
      }
    } catch (error) {
      console.error('停止录音失败:', error)
      ElMessage.error('录音失败')
    } finally {
      isRecording.value = false
    }
  } else {
    // 开始录音
    try {
      await audioRecordService.startRecording()
      isRecording.value = true
      ElMessage.info('开始录音...')
    } catch (error) {
      console.error('启动录音失败:', error)
      ElMessage.error('无法启动录音，请检查麦克风权限')
    }
  }
}

// 获取评分提示
function getScoreHint(score: number): string {
  if (score >= 90) return '优秀！发音非常标准'
  if (score >= 80) return '很好！继续保持'
  if (score >= 70) return '良好，还可以更好'
  if (score >= 60) return '及格，需要多练习'
  return '需要改进，建议多听多练'
}

// 提交
async function handleSubmit() {
  if (!hasRecording.value || !recordedAudio.value) return
  
  try {
    isSubmitting.value = true
    attemptCount.value += 1
    const hintLevelAtSubmit = hintLevel.value
    ElMessage.info('正在评分中...')
    
    // 调用 ASR API：同时拿到识别文本与评分
    const response = await asrApiService.recognize({
      audio: recordedAudio.value,
      language: 'en',
      referenceText: props.item.english,
      enableScore: true,
    })

    const scoreDetail = response.success ? response.score : null

    if (scoreDetail) {
      score.value = scoreDetail.overall
      showResult.value = true

      const engine = evaluatePronunciation({
        referenceText: props.item.english,
        recognizedText: response.text,
        scoreDetail,
        attemptCount: attemptCount.value,
        previousHintLevel: hintLevel.value,
      })
      nextHint.value = engine.nextHint
      hintLevel.value = engine.nextHint.level

      const isPassed = score.value >= 60
      emit('answer', isPassed)

      if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
        void recordPracticeAttemptEvent({
          courseId: practiceAttemptContext.courseId.value,
          lessonId: practiceAttemptContext.lessonId.value,
          unitId: props.item.id,
          mode: 'follow' as PracticeMode,
          referenceText: props.item.english,
          chineseHint: props.item.chinese,
          recognizedText: response.text,
          correct: isPassed,
          attemptCount: attemptCount.value,
          hintLevelAtSubmit,
          nextHintLevel: engine.nextHint.level,
          scoreDetail: {
            overall: scoreDetail.overall,
            accuracy: scoreDetail.accuracy,
            fluency: scoreDetail.fluency,
            completeness: scoreDetail.completeness,
            pronunciation: scoreDetail.pronunciation,
          },
        })
      }

      if (isPassed) {
        ElMessage.success(`评分完成！得分：${score.value}分`)
      } else {
        ElMessage.warning(`需要继续努力！得分：${score.value}分`)
      }

      await generateFeedback({
        mode: 'follow',
        referenceText: props.item.english,
        chineseHint: props.item.chinese,
        attemptCount: attemptCount.value,
        recognizedText: response.text,
        scoreDetail: {
          overall: scoreDetail.overall,
          accuracy: scoreDetail.accuracy,
          fluency: scoreDetail.fluency,
          completeness: scoreDetail.completeness,
          pronunciation: scoreDetail.pronunciation,
        },
      })
    } else {
      // 评分失败，使用降级方案
      ElMessage.warning('评分服务暂时不可用，使用简单评分')
      score.value = 70 // 默认及格分
      showResult.value = true
      emit('answer', true)

      if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
        void recordPracticeAttemptEvent({
          courseId: practiceAttemptContext.courseId.value,
          lessonId: practiceAttemptContext.lessonId.value,
          unitId: props.item.id,
          mode: 'follow' as PracticeMode,
          referenceText: props.item.english,
          chineseHint: props.item.chinese,
          recognizedText: response.text,
          correct: true,
          attemptCount: attemptCount.value,
          hintLevelAtSubmit: hintLevel.value,
          extra: { degraded: true },
        })
      }
    }
  } catch (error) {
    console.error('评分失败:', error)
    ElMessage.error('评分失败，请重试')
  } finally {
    isSubmitting.value = false
  }
}

// 下一题
function handleNext() {
  emit('next')
}
</script>

<style lang="scss" scoped>
.follow-mode {
  .practice-content {
    padding: 24px;
  }
  
  .content-section {
    text-align: center;
    padding: 32px 0;
    border-bottom: 1px solid var(--el-border-color);
    margin-bottom: 24px;
    
    .english-text {
      font-size: 32px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 16px;
    }
    
    .chinese-text {
      font-size: 18px;
      color: var(--el-text-color-secondary);
    }
  }
  
  .audio-section,
  .recording-section {
    text-align: center;
    padding: 24px 0;
    
    .audio-hint,
    .recording-hint {
      margin-top: 12px;
      color: var(--el-text-color-secondary);
      font-size: 14px;
    }
  }
  
  .result-section {
    margin: 24px 0;
    
    .score-display {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 0;
      
      .percentage-value {
        display: block;
        font-size: 32px;
        font-weight: 600;
        color: var(--el-color-success);
      }
      
      .percentage-label {
        display: block;
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
      
      .score-hint {
        margin-top: 16px;
        font-size: 16px;
        color: var(--el-text-color-regular);
      }
    }
  }
  
  .keyboard-hint {\n  margin-top: 12px;\n  color: var(--el-text-color-secondary);\n  font-size: 13px;\n  text-align: center;\n}\n\n.action-buttons {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 32px;
  }
}
</style>
