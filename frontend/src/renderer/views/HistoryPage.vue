<!-- 学习历史：仅展示已持久化的练习、复习、打字与课堂记录。 -->
<template>
  <div class="history-page">
    <el-alert
      v-if="loadWarning"
      type="warning"
      show-icon
      :closable="false"
      :title="loadWarning"
      class="load-warning"
    />
    <div v-if="loadWarning && !loading" class="retry-row">
      <el-button size="small" :loading="loading" @click="loadHistory">重新加载</el-button>
    </div>

    <el-skeleton v-if="loading" :rows="5" animated />

    <template v-else>
      <el-row :gutter="16" class="stats-overview">
        <el-col :xs="12" :sm="12" :md="6">
          <el-card class="stat-card primary">
            <el-statistic title="累计练习时长" :value="stats.practiceMinutes === null ? '—' : Math.round(stats.practiceMinutes / 60 * 10) / 10" suffix="小时" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card class="stat-card success">
            <el-statistic title="已纳入复习词汇" :value="stats.reviewWords ?? '—'" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card class="stat-card warning">
            <el-statistic title="已完成课程" :value="stats.completedCourses ?? '—'" />
          </el-card>
        </el-col>
        <el-col :xs="12" :sm="12" :md="6">
          <el-card class="stat-card info">
            <el-statistic title="有记录的学习天数" :value="stats.learningDays ?? '—'" suffix="天" />
          </el-card>
        </el-col>
      </el-row>

      <el-card class="calendar-card">
        <template #header>
          <div class="card-header">
            <span>学习日历</span>
            <el-date-picker
              v-model="selectedMonth"
              type="month"
              placeholder="选择月份"
              format="YYYY年MM月"
            />
          </div>
        </template>
        <div class="calendar-grid">
          <div class="calendar-header">
            <span v-for="day in weekDays" :key="day">{{ day }}</span>
          </div>
          <div class="calendar-body">
            <div
              v-for="day in calendarDays"
              :key="day.key"
              class="calendar-day"
              :class="{
                active: day.hasActivity,
                today: day.isToday,
                'other-month': !day.isCurrentMonth,
              }"
              :title="day.hasActivity ? '当天有已保存的学习记录' : ''"
            >
              <span class="day-number">{{ day.date }}</span>
              <span v-if="day.hasActivity" class="activity-dot" />
            </div>
          </div>
        </div>
      </el-card>

      <el-card class="records-card">
        <template #header>
          <div class="card-header">
            <span>学习记录（{{ filteredRecords.length }}）</span>
            <el-select v-model="recordFilter" placeholder="筛选类型" clearable>
              <el-option label="全部" value="" />
              <el-option label="课时练习" value="practice" />
              <el-option label="词汇复习" value="review" />
              <el-option label="打字练习" value="typing" />
              <el-option label="游戏" value="game" />
              <el-option label="课堂点评" value="lesson-feedback" />
            </el-select>
          </div>
        </template>

        <el-timeline v-if="filteredRecords.length">
          <el-timeline-item
            v-for="record in filteredRecords"
            :key="record.id"
            :timestamp="formatDateTime(record.occurredAt)"
            :type="getRecordType(record.type)"
            placement="top"
          >
            <el-card class="record-item" shadow="never">
              <div class="record-content">
                <h4>{{ record.title }}</h4>
                <p>{{ record.description }}</p>
                <div class="record-stats">
                  <span v-if="record.durationMinutes !== undefined">时长：{{ record.durationMinutes }} 分钟</span>
                  <span v-if="record.accuracy !== undefined">正确率：{{ record.accuracy }}%</span>
                  <span v-if="record.words !== undefined">词汇：{{ record.words }} 个</span>
                  <span v-if="record.wpm !== undefined">速度：{{ record.wpm }} WPM</span>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>
        <el-empty v-else description="当前筛选范围内没有已保存的学习记录" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { courseRepository } from '../../shared/database/repositories/courseRepository'
import { commonRepository } from '../../shared/database/repositories/commonRepository'
import { learningService } from '../../shared/services/learningService'
import { reviewService } from '../../shared/services/reviewService'
import type { Course, PracticeRecord } from '../../shared/types/course'
import type { LearningRecord, TypingRecord } from '../../shared/types/common'
import type { ReviewLog } from '../../shared/types/review'

type HistoryRecordType = 'practice' | 'review' | 'typing' | 'game' | 'lesson-feedback'

interface HistoryRecord {
  id: string
  type: HistoryRecordType
  title: string
  description: string
  occurredAt: number
  durationMinutes?: number
  accuracy?: number
  words?: number
  wpm?: number
}

interface CalendarDay {
  key: string
  date: number
  isCurrentMonth: boolean
  isToday: boolean
  hasActivity: boolean
}

const loading = ref(true)
const loadWarning = ref('')
const selectedMonth = ref(new Date())
const recordFilter = ref('')
const records = ref<HistoryRecord[]>([])
const allHistoryRecords = ref<HistoryRecord[]>([])
const stats = ref<{
  practiceMinutes: number | null
  reviewWords: number | null
  completedCourses: number | null
  learningDays: number | null
}>({
  practiceMinutes: null,
  reviewWords: null,
  completedCourses: null,
  learningDays: null,
})

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
const filteredRecords = computed(() =>
  recordFilter.value ? records.value.filter(record => record.type === recordFilter.value) : records.value,
)

function dateKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const calendarDays = computed<CalendarDay[]>(() => {
  const month = selectedMonth.value instanceof Date ? selectedMonth.value : new Date()
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(firstDay)
  gridStart.setDate(firstDay.getDate() - firstDay.getDay())
  const activityDays = new Set(allHistoryRecords.value.map(record => dateKey(record.occurredAt)))
  const todayKey = dateKey(Date.now())
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const key = dateKey(date.getTime())
    return {
      key,
      date: date.getDate(),
      isCurrentMonth: date.getMonth() === month.getMonth(),
      isToday: key === todayKey,
      hasActivity: activityDays.has(key),
    }
  })
})

function formatDateTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).format(new Date(timestamp))
}

function getRecordType(type: HistoryRecordType): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const types: Record<HistoryRecordType, 'primary' | 'success' | 'warning' | 'danger' | 'info'> = {
    practice: 'primary',
    review: 'warning',
    typing: 'success',
    game: 'info',
    'lesson-feedback': 'success',
  }
  return types[type]
}

function modeLabel(mode: string): string {
  const labels: Record<string, string> = {
    dictation: '听写', follow: '跟读', translation: '翻译', imitation: '模仿',
  }
  return labels[mode] ?? mode
}

async function loadHistory() {
  loading.value = true
  loadWarning.value = ''
  const now = Date.now()
  const results = await Promise.allSettled([
    courseRepository.getAllPracticeRecords(),
    reviewService.getReviewLogs(new Date(0), new Date(now)),
    reviewService.getAllMastery(),
    commonRepository.getTypingRecords(0, now),
    commonRepository.getLearningRecords(0, now),
    learningService.getLearningCourses(),
    courseRepository.getAllCourses(),
  ] as const)

  const labels = ['练习记录', '复习日志', '复习词汇', '打字记录', '课堂记录', '课程进度', '课程目录']
  const warnings = results.flatMap((result, index) => result.status === 'rejected' ? [labels[index]] : [])
  if (warnings.length) loadWarning.value = `${warnings.join('、')}读取失败；页面仅显示成功读取的数据，未读取的数据不会显示为零。`

  function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
    return result.status === 'fulfilled' ? result.value : null
  }

  const practiceRecords = fulfilled(results[0])
  const reviewLogs = fulfilled(results[1])
  const mastery = fulfilled(results[2])
  const typingRecords = fulfilled(results[3])
  const learningRecords = fulfilled(results[4])
  const learningCourses = fulfilled(results[5])
  const courses = fulfilled(results[6])

  const courseMap = new Map<string, Course>((courses ?? []).map(course => [course.id, course] as const))
  const courseIds = [...new Set([
    ...(practiceRecords ?? []).slice(0, 300).map(record => record.courseId),
    ...(learningRecords ?? []).filter(record => record.courseId).slice(0, 300).map(record => record.courseId as string),
  ])]
  const lessonTitleMap = new Map<string, string>()
  await Promise.all(courseIds.map(async courseId => {
    try {
      const lessons = await courseRepository.getLessonsByCourseId(courseId)
      for (const lesson of lessons) lessonTitleMap.set(lesson.id, lesson.title)
    } catch (error) {
      console.warn('读取历史课时标题失败:', courseId, error)
    }
  }))

  const history: HistoryRecord[] = []
  for (const record of practiceRecords ?? []) {
    const courseTitle = courseMap.get(record.courseId)?.title ?? '课程'
    const lessonTitle = lessonTitleMap.get(record.lessonId) ?? '课时'
    history.push({
      id: `practice-${record.id ?? `${record.courseId}-${record.lessonId}-${record.completedAt}`}`,
      type: 'practice',
      title: `课时练习 · ${modeLabel(String(record.mode))}`,
      description: `${courseTitle} / ${lessonTitle} · ${record.correctItems ?? '—'} / ${record.totalItems ?? '—'} 题正确`,
      occurredAt: record.completedAt,
      durationMinutes: Math.round(record.duration / 60000),
      accuracy: record.accuracy,
    })
  }

  for (const log of reviewLogs ?? []) {
    history.push({
      id: `review-${log.id ?? `${log.source}-${log.word}-${log.reviewDate}`}`,
      type: 'review',
      title: `词汇复习 · ${log.word}`,
      description: `来源：${log.source} · SM-2 质量 ${log.quality}/5`,
      occurredAt: log.reviewDate,
      accuracy: log.correct ? 100 : 0,
      words: 1,
    })
  }

  for (const record of typingRecords ?? []) {
    history.push({
      id: `typing-${record.id ?? record.date}`,
      type: 'typing',
      title: `打字练习 · ${record.practiceType}`,
      description: `难度：${record.difficulty || '未记录'}`,
      occurredAt: record.date,
      accuracy: record.accuracy,
      wpm: record.wpm,
    })
  }

  for (const record of learningRecords ?? []) {
    // practice/review/typing 的权威记录来自各自专用表；这里仅展示课堂点评与游戏，避免重复列出同一活动。
    if (record.activityType !== 'lesson-feedback' && record.activityType !== 'game') continue
    const courseTitle = record.courseId ? courseMap.get(record.courseId)?.title : undefined
    const lessonTitle = record.lessonId ? lessonTitleMap.get(record.lessonId) : undefined
    const metadata = record.metadata ?? {}
    history.push({
      id: `learning-${record.id ?? record.createdAt}`,
      type: record.activityType,
      title: record.activityType === 'lesson-feedback' ? '课堂点评' : '游戏活动',
      description: [courseTitle, lessonTitle, metadata.mode ? `模式：${String(metadata.mode)}` : ''].filter(Boolean).join(' / ') || '已保存的学习活动记录',
      occurredAt: record.createdAt,
      durationMinutes: Math.round(record.duration / 60000),
      accuracy: record.accuracy === undefined ? undefined : Math.round(record.accuracy),
    })
  }

  allHistoryRecords.value = history.sort((a, b) => b.occurredAt - a.occurredAt)
  records.value = allHistoryRecords.value.slice(0, 2000)
  stats.value.practiceMinutes = practiceRecords
    ? Math.round(practiceRecords.reduce((sum, record) => sum + record.duration, 0) / 60000)
    : null
  stats.value.reviewWords = mastery
    ? new Set(mastery.map(item => item.word.trim().toLowerCase()).filter(Boolean)).size
    : null
  stats.value.completedCourses = learningCourses
    ? learningCourses.filter(course => (course.completionPercentage ?? 0) >= 100).length
    : null
  const timestampSources: number[][] = []
  if (practiceRecords) timestampSources.push(practiceRecords.map(record => record.completedAt))
  if (reviewLogs) timestampSources.push(reviewLogs.map(log => log.reviewDate))
  if (typingRecords) timestampSources.push(typingRecords.map(record => record.date))
  if (learningRecords) timestampSources.push(
    learningRecords.filter(record => record.activityType === 'lesson-feedback' || record.activityType === 'game').map(record => record.createdAt),
  )
  const activitySourcesAvailable = [0, 1, 3, 4].every(index => results[index].status === 'fulfilled')
  stats.value.learningDays = activitySourcesAvailable && timestampSources.length
    ? new Set(timestampSources.flat().map(dateKey)).size
    : null
  loading.value = false
}

onMounted(() => { void loadHistory() })
</script>

<style lang="scss" scoped>
.history-page { max-width: 1200px; margin: 0 auto; }
.load-warning { margin-bottom: 12px; }
.retry-row { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.stats-overview { margin-bottom: 24px; }
.stat-card { text-align: center; }
.stat-card.primary { border-top: 3px solid var(--primary-color); }
.stat-card.success { border-top: 3px solid var(--el-color-success); }
.stat-card.warning { border-top: 3px solid var(--el-color-warning); }
.stat-card.info { border-top: 3px solid var(--el-color-info); }
.calendar-card { margin-bottom: 24px; }
.card-header { display: flex; justify-content: space-between; align-items: center; gap: 12px; }
.calendar-grid .calendar-header { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 8px; }
.calendar-grid .calendar-header span { text-align: center; padding: 8px; font-weight: 500; color: var(--text-color-secondary); }
.calendar-body { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
.calendar-day { position: relative; aspect-ratio: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 8px; transition: background-color .2s; }
.calendar-day.active { background-color: var(--primary-color-lighter); }
.calendar-day.today { border: 2px solid var(--primary-color); }
.calendar-day.other-month { opacity: .4; }
.day-number { font-size: 14px; }
.activity-dot { position: absolute; bottom: 4px; width: 6px; height: 6px; border-radius: 50%; background-color: var(--el-color-success); }
.record-item :deep(.el-card__body) { padding: 12px 16px; }
.record-content h4 { margin: 0 0 8px; font-size: 15px; color: var(--text-color); }
.record-content p { margin: 0 0 8px; font-size: 13px; color: var(--text-color-secondary); }
.record-stats { display: flex; flex-wrap: wrap; gap: 12px; font-size: 12px; color: var(--text-color-placeholder); }
@media (max-width: 640px) {
  .card-header { align-items: flex-start; flex-direction: column; }
}
</style>
