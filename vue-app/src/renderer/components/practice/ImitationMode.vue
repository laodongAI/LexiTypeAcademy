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
      
      <!-- 波形显示区 -->
      <div class="waveform-section">
        <div class="waveform-container">
          <div class="waveform standard">
            <div class="waveform-label">标准发音</div>
            <div class="waveform-visual">
              <div
                v-for="i in 50"
                :key="i"
                class="wave-bar"
                :style="{ height: `${Math.random() * 60 + 20}%` }"
              />
            </div>
          </div>
          
          <div v-if="hasRecording" class="waveform user">
            <div class="waveform-label">你的发音</div>
            <div class="waveform-visual">
              <div
                v-for="i in 50"
                :key="i"
                class="wave-bar user"
                :style="{ height: `${Math.random() * 60 + 20}%` }"
              />
            </div>
          </div>
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
        fluency: scoreDetail.fluency || 70,
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
      // 评分失败，使用降级方案
      ElMessage.warning('评分服务暂时不可用，使用简单评分')
      scores.value = { accuracy: 70, fluency: 70, completeness: 70 }
      showResult.value = true
      emit('answer', true)

      if (practiceAttemptContext?.courseId.value && practiceAttemptContext?.lessonId.value) {
        void recordPracticeAttemptEvent({
          courseId: practiceAttemptContext.courseId.value,
          lessonId: practiceAttemptContext.lessonId.value,
          unitId: props.item.id,
          mode: 'imitation' as PracticeMode,
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
  
  .waveform-section {
    padding: 24px 0;
    
    .waveform-container {
      display: flex;
      flex-direction: column;
      gap: 24px;
      
      .waveform {
        .waveform-label {
          font-size: 14px;
          color: var(--el-text-color-secondary);
          margin-bottom: 12px;
        }
        
        .waveform-visual {
          display: flex;
          align-items: flex-end;
          gap: 2px;
          height: 80px;
          padding: 8px;
          background-color: var(--el-fill-color-light);
          border-radius: 8px;
          
          .wave-bar {
            flex: 1;
            background: linear-gradient(to top, var(--el-color-primary), var(--el-color-primary-light-3));
            border-radius: 2px;
            transition: height 0.3s;
            
            &.user {
              background: linear-gradient(to top, var(--el-color-success), var(--el-color-success-light-3));
            }
          }
        }
      }
    }
  }
  
  .control-section {
    display: flex;
    justify-content: center;
    gap: 32px;
    padding: 24px 0;
    
    .control-group {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      
      .control-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
      }
    }
  }
  
  .result-section {
    margin: 24px 0;
    
    .result-content {
      h3 {
        text-align: center;
        margin: 0 0 24px 0;
        font-size: 18px;
      }
      
      .scores {
        .score-item {
          margin-bottom: 20px;
          
          .score-label {
            display: block;
            margin-bottom: 8px;
            font-size: 14px;
            color: var(--el-text-color-secondary);
          }
        }
        
        .overall-score {
          text-align: center;
          padding: 24px;
          margin-top: 24px;
          border-top: 2px solid var(--el-border-color);
          
          .score-label {
            display: block;
            margin-bottom: 12px;
            font-size: 16px;
            color: var(--el-text-color-secondary);
          }
          
          .score-value {
            font-size: 48px;
            font-weight: 600;
            color: var(--el-color-primary);
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
