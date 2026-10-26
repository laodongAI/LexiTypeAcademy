<!--
  课时练习页面
  
  支持多种练习模式：听写、跟读、翻译、模仿
-->

<template>
  <div class="lesson-practice-page">
    <!-- 顶部导航 -->
    <div class="practice-topbar">
      <div class="topbar-left">
        <el-button link @click="handleBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
      </div>

      <div class="topbar-center">
        <div class="lesson-title">{{ lessonTitle }}</div>
        <div v-if="practiceStarted" class="progress-row">
          <el-progress
            :percentage="progress"
            :stroke-width="8"
            :show-text="false"
            style="width: 240px"
          />
          <span class="progress-text">{{ currentIndex + 1 }} / {{ totalItems }}</span>
        </div>
      </div>

      <div class="topbar-right">
        <el-tag v-if="practiceStarted && currentMode" size="small">{{ getModeLabel(currentMode) }}</el-tag>
      </div>
    </div>
    
    <div class="practice-layout">
      <main class="practice-main">
        <!-- 模式选择 -->
        <el-card v-if="!practiceStarted" class="mode-selector">
          <template #header>
            <h3>选择练习模式</h3>
          </template>

          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="12" v-for="mode in practiceModeslist" :key="mode.value">
              <button
                type="button"
                class="mode-card"
                :class="{ active: currentMode === mode.value }"
                @click="currentMode = mode.value"
              >
                <div class="mode-card-left">
                  <el-icon :size="28"><component :is="mode.icon" /></el-icon>
                </div>
                <div class="mode-card-right">
                  <div class="mode-name">{{ mode.label }}</div>
                  <div class="mode-desc">{{ mode.description }}</div>
                </div>
              </button>
            </el-col>
          </el-row>

          <div class="start-button-container">
            <el-button
              type="primary"
              size="large"
              @click="startPractice"
              :disabled="!currentMode"
            >
              开始练习
            </el-button>
          </div>
        </el-card>

        <!-- 练习区域 -->
        <div v-else class="practice-area">
          <!-- 听写模式 -->
          <DictationMode
            v-if="currentMode === 'dictation'"
            :item="currentItem"
            @next="handleNext"
            @previous="handlePrevious"
            @answer="handleAnswer"
          />

          <!-- 跟读模式 -->
          <FollowMode
            v-else-if="currentMode === 'follow'"
            :item="currentItem"
            @next="handleNext"
            @answer="handleAnswer"
          />

          <!-- 翻译模式 -->
          <TranslationMode
            v-else-if="currentMode === 'translation'"
            :item="currentItem"
            @next="handleNext"
            @answer="handleAnswer"
          />

          <!-- 模仿模式 -->
          <ImitationMode
            v-else-if="currentMode === 'imitation'"
            :item="currentItem"
            @next="handleNext"
            @answer="handleAnswer"
          />
        </div>
      </main>

      <aside class="practice-side">
        <el-card class="coach-card">
          <TeachingFeedbackPanel
            title="学习助手"
            :loading="feedbackState.loading.value ?? false"
            :error="feedbackState.error.value ?? ''"
            :feedback="feedbackState.feedback.value ?? null"
            placeholder="提交答案后，这里会显示 AI 教学反馈与下一步建议。"
          />
        </el-card>
      </aside>
    </div>

    <!-- 练习结果 -->
    <el-dialog
      v-model="showResultDialog"
      title="练习完成"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="result-content">
        <el-result
          icon="success"
          title="恭喜完成练习！"
        >
          <template #sub-title>
            <div class="result-stats">
              <div class="stat-item">
                <span class="stat-label">总题数</span>
                <span class="stat-value">{{ totalItems }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">正确数</span>
                <span class="stat-value correct">{{ correctCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">错误数</span>
                <span class="stat-value incorrect">{{ incorrectCount }}</span>
              </div>
              <div class="stat-item">
                <span class="stat-label">准确率</span>
                <span class="stat-value">{{ accuracy }}%</span>
              </div>
            </div>
          </template>
          <template #extra>
            <el-space>
              <el-button @click="handleRetry">重新练习</el-button>
              <el-button type="primary" @click="handleFinish">完成</el-button>
            </el-space>
          </template>
        </el-result>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, defineAsyncComponent, provide } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Headset, Microphone, DocumentCopy, Film, ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import { PracticeMode, type LessonItem } from '../../shared/types/course'
import { useTeachingFeedback, teachingFeedbackKey } from '../composables/useTeachingFeedback'
import { practiceAttemptContextKey } from '../composables/practiceAttemptContext'
import { learningEventService } from '../../shared/services/learningEventService'
const DictationMode = defineAsyncComponent(() => import('../components/practice/DictationMode.vue'))
const FollowMode = defineAsyncComponent(() => import('../components/practice/FollowMode.vue'))
const TranslationMode = defineAsyncComponent(() => import('../components/practice/TranslationMode.vue'))
const ImitationMode = defineAsyncComponent(() => import('../components/practice/ImitationMode.vue'))
const TeachingFeedbackPanel = defineAsyncComponent(() => import('../components/practice/TeachingFeedbackPanel.vue'))

const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()

let practiceVisitKey = ''
let practiceVisitStartedAt = 0
let practiceVisitFinished = false

// 容器级教学反馈上下文：各 mode 通过 inject 复用（不改变 UI，仅收敛状态与调用）
const feedbackState = useTeachingFeedback()
provide(teachingFeedbackKey, feedbackState)

// 路由参数
const courseId = computed(() => route.query.courseId as string)
const lessonId = computed(() => (route.query.lessonId || route.params.lessonId) as string)

// 容器级练习事件上下文：各 mode 在提交点写入 PracticeAttemptEvent
provide(practiceAttemptContextKey, { courseId, lessonId })

// 状态
const practiceStarted = ref(false)
const validPracticeModes: PracticeMode[] = [PracticeMode.Dictation, PracticeMode.FollowRead, PracticeMode.Translation, PracticeMode.Imitation]
const requestedMode = route.query.mode
const currentMode = ref<PracticeMode | ''>(
  typeof requestedMode === 'string' && validPracticeModes.includes(requestedMode as PracticeMode)
    ? requestedMode as PracticeMode
    : ''
)
const currentIndex = ref(0)
const lessonItems = ref<LessonItem[]>([])
const lessonTitle = ref('')
const answers = ref<Array<{ itemId: string; correct: boolean; answer?: string }>>([])
const showResultDialog = ref(false)
// 本次练习开始时间（毫秒时间戳）：用于统计真实耗时与 WPM，未开始时为 0
const practiceStartedAt = ref(0)

// 练习模式列表
const practiceModeslist = [
  {
    value: 'dictation' as PracticeMode,
    label: '听写模式',
    description: '听音频，输入英文',
    icon: Headset
  },
  {
    value: 'follow' as PracticeMode,
    label: '跟读模式',
    description: '跟随音频朗读',
    icon: Microphone
  },
  {
    value: 'translation' as PracticeMode,
    label: '翻译模式',
    description: '看中文，写英文',
    icon: DocumentCopy
  },
  {
    value: 'imitation' as PracticeMode,
    label: '模仿模式',
    description: '模仿音频发音',
    icon: Film
  }
]

// 计算属性
const currentItem = computed(() => lessonItems.value[currentIndex.value])
const totalItems = computed(() => lessonItems.value.length)
const progress = computed(() => totalItems.value > 0 ? (currentIndex.value / totalItems.value) * 100 : 0)
const correctCount = computed(() => answers.value.filter(a => a.correct).length)
const incorrectCount = computed(() => answers.value.filter(a => !a.correct).length)
const accuracy = computed(() => {
  if (answers.value.length === 0) return 0
  return Math.round((correctCount.value / answers.value.length) * 100)
})

// 加载课时数据
onMounted(async () => {
  if (!courseId.value || !lessonId.value) {
    ElMessage.error('缺少课程或课时信息')
    router.back()
    return
  }
  
  // 加载课程数据
  await courseStore.loadCourseById(courseId.value)
  
  // 查找课时
  const lesson = courseStore.currentCourse?.lessons.find(l => l.id === lessonId.value)
  if (!lesson) {
    ElMessage.error('课时不存在')
    router.back()
    return
  }
  
  lessonTitle.value = lesson.title
  const requestedItemId = route.query.itemId
  const availableItems = lesson.items || []
  lessonItems.value = typeof requestedItemId === 'string'
    ? availableItems.filter(item => item.id === requestedItemId)
    : availableItems
  if (typeof requestedItemId === 'string' && lessonItems.value.length === 0) {
    ElMessage.warning('该错题已不在当前课时中，请返回错题列表重新选择')
    router.back()
    return
  }
  
  if (lessonItems.value.length === 0) {
    ElMessage.warning('该课时暂无练习内容')
  }
  
  // 标记开始学习并记录本次课时访问；事件不参与学习时长/完成数统计。
  await courseStore.startLesson(courseId.value, lessonId.value)
  practiceVisitStartedAt = Date.now()
  practiceVisitKey = `${courseId.value}:${lessonId.value}:${practiceVisitStartedAt}`
  practiceVisitFinished = false
  void learningEventService.record({
    eventId: `lesson-started-practice-${practiceVisitKey}`,
    eventType: 'lesson_started',
    occurredAt: practiceVisitStartedAt,
    courseId: courseId.value,
    lessonId: lessonId.value,
    metadata: { entry: 'lesson-practice' },
  }).catch(error => console.warn('记录课时开始事件失败:', error))

  // 练习中心可通过 mode 深链启动指定模式；普通进入仍保留手动选择流程
  if (currentMode.value) startPractice()
})

// 获取模式标签
function getModeLabel(mode: PracticeMode | '') {
  const modeObj = practiceModeslist.find(m => m.value === mode)
  return modeObj?.label || '未选择'
}

// 开始练习
function startPractice() {
  if (!currentMode.value) {
    ElMessage.warning('请先选择练习模式')
    return
  }
  
  if (lessonItems.value.length === 0) {
    ElMessage.warning('该课时暂无练习内容')
    return
  }
  
  feedbackState.reset()
  practiceStarted.value = true
  currentIndex.value = 0
  answers.value = []
  // 记录开始时刻：后续 finishPractice 用它计算真实耗时
  practiceStartedAt.value = Date.now()
  console.debug('[practice] 开始练习：课程=%s，课时=%s，模式=%s', courseId.value, lessonId.value, currentMode.value)
}

// 处理答案
function handleAnswer(correct: boolean, answer?: string) {
  answers.value.push({
    itemId: currentItem.value.id,
    correct,
    answer
  })
}

// 跟读时允许左箭头回看上一项；切换题目会重置该题的录音/评分状态并自动领读。
function handlePrevious() {
  if (currentIndex.value > 0) {
    currentIndex.value--
  }
}

// 下一题
function handleNext() {
  if (currentIndex.value < totalItems.value - 1) {
    currentIndex.value++
  } else {
    // 练习完成
    finishPractice()
  }
}

// 完成练习
async function finishPractice() {
  // 完成时刻：与开始时刻配合得到真实耗时
  const finishedAt = Date.now()
  // 真实耗时（毫秒）：开始时刻缺失时退化为 0，避免出现负数污染统计
  const duration = practiceStartedAt.value > 0
    ? Math.max(0, finishedAt - practiceStartedAt.value)
    : 0

  // 已输入文本的总字符数：仅听写/翻译等键盘输入模式会产生 answer 文本
  const typedCharacters = answers.value.reduce(
    (sum, item) => sum + (item.answer ? item.answer.length : 0),
    0
  )
  // 有效时长（分钟）：用于 WPM 换算
  const minutes = duration / 60000
  // WPM = 字符数 / 5 / 分钟；无输入文本或无有效耗时时不写入该字段
  const wpm = typedCharacters > 0 && minutes > 0
    ? Math.round((typedCharacters / 5 / minutes) * 10) / 10
    : undefined

  // 记录练习结果（含题量、正确数与打字速度）
  await courseStore.recordPractice({
    courseId: courseId.value,
    lessonId: lessonId.value,
    mode: currentMode.value as PracticeMode,
    accuracy: accuracy.value,
    duration,
    incorrectItemIds: answers.value.filter(a => !a.correct).map(a => a.itemId),
    totalItems: totalItems.value,
    correctItems: correctCount.value,
    wpm
  })
  console.info(
    '[practice] 练习已完成：题目=%s，正确=%s，耗时=%sms，WPM=%s',
    totalItems.value,
    correctCount.value,
    duration,
    wpm ?? '无'
  )
  
  // 如果准确率达到80%，标记课时完成
  if (accuracy.value >= 80) {
    await courseStore.completeLesson(courseId.value, lessonId.value)
    practiceVisitFinished = true
    void learningEventService.record({
      eventId: `lesson-completed-practice-${practiceVisitKey}`,
      eventType: 'lesson_completed',
      occurredAt: finishedAt,
      courseId: courseId.value,
      lessonId: lessonId.value,
      durationMs: duration,
      result: {
        accuracy: accuracy.value / 100,
        correctCount: correctCount.value,
        totalCount: totalItems.value,
      },
      metadata: { entry: 'lesson-practice', mode: currentMode.value },
    }).catch(error => console.warn('记录课时完成事件失败:', error))
  }

  showResultDialog.value = true
}

// 重新练习
function handleRetry() {
  showResultDialog.value = false
  feedbackState.reset()
  currentIndex.value = 0
  answers.value = []
  // 重置开始时刻：保证重练的耗时只统计本轮
  practiceStartedAt.value = Date.now()
}

// 完成并返回
function handleFinish() {
  router.back()
}

// 返回
function handleBack() {
  if (practiceStarted.value && answers.value.length > 0) {
    ElMessage.warning('练习尚未完成，请先完成或放弃')
    return
  }
  router.back()
}

onBeforeUnmount(() => {
  if (!practiceVisitKey || practiceVisitFinished) return
  void learningEventService.record({
    eventId: `lesson-abandoned-practice-${practiceVisitKey}`,
    eventType: 'lesson_abandoned',
    occurredAt: Date.now(),
    courseId: courseId.value,
    lessonId: lessonId.value,
    durationMs: Math.max(0, Date.now() - practiceVisitStartedAt),
    metadata: { entry: 'lesson-practice' },
  }).catch(error => console.warn('记录课时退出事件失败:', error))
})
</script>

<style lang="scss" scoped>
.lesson-practice-page {
  max-width: 1280px;
  margin: 0 auto;
  min-height: calc(100vh - 40px);
}

.practice-topbar {
  display: grid;
  grid-template-columns: 140px 1fr 140px;
  align-items: center;
  gap: 12px;
  padding: 12px 0 20px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 24px;
}

.topbar-left,
.topbar-right {
  display: flex;
  align-items: center;
}

.topbar-right {
  justify-content: flex-end;
}

.topbar-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.lesson-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  text-align: center;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-text {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.practice-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  gap: 24px;
  align-items: start;
}

.practice-main {
  min-width: 0;
}

.practice-side {
  min-width: 0;
}

.coach-card {
  border-radius: 16px;
  border: 1px solid var(--border-color-light);
}

.mode-selector {
  .start-button-container {
    text-align: center;
    margin-top: 32px;
  }
}

.mode-card {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border-radius: 16px;
  border: 1px solid var(--border-color-light);
  background: var(--card-bg);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s ease;
}

.mode-card:hover {
  border-color: var(--border-color);
}

.mode-card.active {
  border-color: var(--primary-color);
}

.mode-card-left {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: var(--el-fill-color-light);
}

.mode-card-right {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.mode-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.mode-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
}

.practice-area {
  min-height: 500px;
}

@media (max-width: 1024px) {
  .practice-layout {
    grid-template-columns: 1fr;
  }
}

.result-content {
  .result-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
    margin-top: 24px;
    
    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px;
      background-color: var(--el-fill-color-light);
      border-radius: 8px;
      
      .stat-label {
        font-size: 14px;
        color: var(--el-text-color-secondary);
        margin-bottom: 8px;
      }
      
      .stat-value {
        font-size: 24px;
        font-weight: 600;
        color: var(--el-text-color-primary);
        
        &.correct {
          color: var(--el-color-success);
        }
        
        &.incorrect {
          color: var(--el-color-danger);
        }
      }
    }
  }
}
</style>
