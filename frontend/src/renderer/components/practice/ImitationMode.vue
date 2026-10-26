<!--
  模仿模式组件
  
  模仿音频发音并评分
-->

<template>
  <el-card class="imitation-mode">
    <div class="practice-content">
      <!-- 内容显示 -->
      <div class="content-section">
        <div class="english-text">{{ item.english }}</div>
        <div class="chinese-text">{{ item.chinese }}</div>
      </div>
      
      <!-- 真实音频波形尚未实现：使用明确的状态面板，避免随机装饰误导为真实波形 -->
      <div class="audio-status-section">
        <div class="audio-status-card">
          <strong>标准发音</strong>
          <span>{{ isPlayingStandard ? '正在播放老师示范' : '可播放标准发音进行对照' }}</span>
        </div>
        <div class="audio-status-card" :class="{ ready: hasRecording, recording: isRecording }">
          <strong>你的录音</strong>
          <span>{{ isRecording ? '正在录音…' : hasRecording ? '录音已完成，可播放或提交评价' : '尚未录音' }}</span>
        </div>
      </div>

      <!-- 控制区 -->
      <div class="control-section">
        <div class="control-group">
          <el-button
            type="primary"
            circle
            size="large"
            :icon="isPlayingStandard ? 'VideoPause' : 'VideoPlay'"
            @click="playStandard"
          />
          <span class="control-label">播放示范</span>
        </div>
        
        <div class="control-group">
          <el-button
            :type="isRecording ? 'danger' : 'success'"
            circle
            size="large"
            :icon="isRecording ? 'VideoPause' : 'Microphone'"
            @click="toggleRecording"
          />
          <span class="control-label">
            {{ isRecording ? '停止录音' : '开始录音' }}
          </span>
        </div>
        
        <div v-if="hasRecording" class="control-group">
          <el-button
            type="info"
            circle
            size="large"
            :icon="isPlayingUser ? 'VideoPause' : 'VideoPlay'"
            @click="playUserRecording"
          />
          <span class="control-label">播放录音</span>
        </div>
      </div>
      
      <!-- 评分结果 -->
      <div v-if="showResult" class="result-section">
        <el-card>
          <div class="result-content">
            <h3>评分结果</h3>
            <div class="scores">
              <div class="score-item">
                <span class="score-label">准确度</span>
                <el-progress
                  :percentage="scores.accuracy"
                  :stroke-width="12"
                />
              </div>
              <div class="score-item">
                <span class="score-label">流畅度</span>
                <el-progress
                  :percentage="scores.fluency"
                  :stroke-width="12"
                />
              </div>
              <div class="score-item">
                <span class="score-label">完整度</span>
                <el-progress
                  :percentage="scores.completeness"
                  :stroke-width="12"
                />
              </div>
              <div class="overall-score">
                <span class="score-label">总分</span>
                <span class="score-value">{{ overallScore }}</span>
              </div>
            </div>

            <el-divider />

            <TeachingFeedbackPanel
              :loading="feedbackLoading"
              :error="feedbackError"
              :feedback="teachingFeedback"
              :nextHint="nextHint"
            />
          </div>
        </el-card>
      </div>
      
      <!-- 操作按钮 -->
      <div class="action-buttons">
        <el-button
          v-if="!showResult"
          type="primary"
          @click="handleSubmit"
          :disabled="!hasRecording || isSubmitting"
          :loading="isSubmitting"
        >
          {{ isSubmitting ? '评分中...' : '提交评分' }}
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
import { ref, computed, watch, type Component, inject } from 'vue'
import { ElMessage } from 'element-plus'
import type { LessonItem, PracticeMode } from '../../../shared/types/course'
import { getAudioPlayService } from '../../../shared/services/audioPlayService'
import { getAudioRecordService } from '../../../shared/services/audioRecordService'
import { getASRApiService } from '../../../shared/services/asrApiService'
import type { TeachingFeedbackResponse } from '../../../shared/services/ai'
import { evaluatePronunciation, type HintLevel, type TeachingHint } from '../../../shared/services/teaching'
import * as TeachingFeedbackPanelModule from './TeachingFeedbackPanel.vue'
import { useTeachingFeedback, teachingFeedbackKey } from '../../composables/useTeachingFeedback'
import { practiceAttemptContextKey } from '../../composables/practiceAttemptContext'
import { recordPracticeAttemptEvent } from '../../../shared/services/practiceAttemptEventService'

interface Props {
  item: LessonItem
}

interface Emits {
  (e: 'next'): void
  (e: 'answer', correct: boolean): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const TeachingFeedbackPanel = (TeachingFeedbackPanelModule as unknown as { default: Component }).default

const audioPlayService = getAudioPlayService()
const audioRecordService = getAudioRecordService()
const asrApiService = getASRApiService()

const isPlayingStandard = ref(false)
const isPlayingUser = ref(false)
const isRecording = ref(false)
const hasRecording = ref(false)
const showResult = ref(false)
const isSubmitting = ref(false)
const recordedAudio = ref<Blob | null>(null)
const scores = ref({
  accuracy: 0,
  fluency: 0,
  completeness: 0
})

const attemptCount = ref(0)
const hintLevel = ref<HintLevel>(0)
const nextHint = ref<TeachingHint | null>(null)
const injectedTeachingFeedback = inject(teachingFeedbackKey, null)
const localTeachingFeedback = useTeachingFeedback()
const { feedback: teachingFeedback, loading: feedbackLoading, error: feedbackError, reset: resetFeedback, generate: generateFeedback } =
  injectedTeachingFeedback ?? localTeachingFeedback

const practiceAttemptContext = inject(practiceAttemptContextKey, null)

const overallScore = computed(() => {
  return Math.round(
    (scores.value.accuracy + scores.value.fluency + scores.value.completeness) / 3
  )
})

// 监听题目变化
watch(() => props.item, () => {
  stopAllAudio()
  isPlayingStandard.value = false
  isPlayingUser.value = false
  isRecording.value = false
  hasRecording.value = false
  showResult.value = false
  recordedAudio.value = null
  scores.value = { accuracy: 0, fluency: 0, completeness: 0 }
  attemptCount.value = 0
  hintLevel.value = 0
  nextHint.value = null
  resetFeedback()
})

// 停止所有音频
function stopAllAudio() {
  audioPlayService.stop()
  if (isRecording.value) {
    audioRecordService.stopRecording()
  }
}


// 播放标准音频
async function playStandard() {
  if (isPlayingStandard.value) {
    audioPlayService.stop()
    isPlayingStandard.value = false
    return
  }
  
  try {
    isPlayingStandard.value = true
    await audioPlayService.play({
      type: 'tts',
      source: props.item.english,
      rate: 1,
    })
  } catch (error) {
    console.error('播放失败:', error)
    ElMessage.error('音频播放失败')
  } finally {
    isPlayingStandard.value = false
  }
}

// 播放用户录音
async function playUserRecording() {
  if (!recordedAudio.value) return
  
  if (isPlayingUser.value) {
    audioPlayService.stop()
    isPlayingUser.value = false
    return
  }
  
  try {
    isPlayingUser.value = true
    const objectUrl = URL.createObjectURL(recordedAudio.value)
    await audioPlayService.play({
      type: 'file',
      source: objectUrl,
      onEnded: () => {
        URL.revokeObjectURL(objectUrl)
      },
      onError: () => {
        URL.revokeObjectURL(objectUrl)
      },
    })
  } catch (error) {
    console.error('播放录音失败:', error)
    ElMessage.error('播放失败')
  } finally {
    isPlayingUser.value = false
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

// 提交评分
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
      scores.value = {
        accuracy: scoreDetail.accuracy,
        fluency: scoreDetail.fluency,
        completeness: scoreDetail.completeness,
      }
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

      const isPassed = overallScore.value >= 60
      emit('answer', isPassed)

      if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
        void recordPracticeAttemptEvent({
          courseId: practiceAttemptContext.courseId.value,
          lessonId: practiceAttemptContext.lessonId.value,
          unitId: props.item.id,
          mode: 'imitation' as PracticeMode,
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
          extra: {
            overallScoreComputed: overallScore.value,
          },
        })
      }

      if (isPassed) {
        ElMessage.success(`评分完成！总分：${overallScore.value}分`)
      } else {
        ElMessage.warning(`需要继续努力！总分：${overallScore.value}分`)
      }

      // AI 增强反馈（可选）
      await generateFeedback({
        mode: 'imitation',
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
      // 评分服务不可用时不能伪造分数，也不能把未评价的录音记为答对。
      showResult.value = false
      ElMessage.warning('暂时无法获得发音评分。请检查网络或评分服务后重试；你的录音仍可回放。')
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
.imitation-mode {
  .practice-content {
    padding: 24px;
  }

  .content-section {
    text-align: center;
    padding: 32px 0;
    border-bottom: 1px solid var(--el-border-color);
    margin-bottom: 24px;

    .english-text {
      font-size: 28px;
      font-weight: 600;
      color: var(--el-text-color-primary);
      margin-bottom: 12px;
    }

    .chinese-text {
      font-size: 16px;
      color: var(--el-text-color-secondary);
    }
  }

  .audio-status-section {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    margin: 20px 0;
  }

  .audio-status-card {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 18px;
    border: 1px solid var(--el-border-color);
    border-radius: 12px;
    background: var(--el-fill-color-lighter);

    strong {
      color: var(--el-text-color-primary);
      font-size: 14px;
    }

    span {
      color: var(--el-text-color-secondary);
      font-size: 13px;
      line-height: 1.5;
    }

    &.ready {
      border-color: var(--el-color-success-light-5);
    }

    &.recording {
      border-color: var(--el-color-danger);
      background: var(--el-color-danger-light-9);
    }
  }

  .control-section {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 24px;
    margin: 24px 0;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  .control-label,
  .score-label {
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }

  .result-section {
    margin-top: 24px;
  }

  .result-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .scores {
    display: grid;
    gap: 16px;
  }

  .score-item {
    display: grid;
    gap: 8px;
  }

  .overall-score {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
  }

  .score-value {
    font-size: 24px;
    color: var(--el-color-primary);
  }
}

@media (max-width: 640px) {
  .imitation-mode {
    .practice-content {
      padding: 16px;
    }

    .audio-status-section {
      grid-template-columns: 1fr;
    }

    .content-section .english-text {
      font-size: 22px;
      overflow-wrap: anywhere;
    }

    .control-section {
      gap: 16px;
    }
  }
}
</style>