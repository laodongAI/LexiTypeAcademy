<!--
  自适应练习中心页面（优化版）
  
  功能：
  - 智能学习推荐（基于错误数据 + 掌握度）
  - 多维统计数据展示
  - 完整的练习模式支持
  - 学习路径整合
-->

<template>
  <div class="practice-center-optimized">
    <!-- 智能学习建议区 -->
    <AdaptiveRecommendations 
      v-if="showRecommendations"
      :recommendations="recommendations"
      @start-practice="startPracticeWithRecommendation"
    />
    
    <el-alert
      v-if="statsError"
      class="stats-error"
      type="error"
      show-icon
      :closable="false"
      :title="statsError"
    />

    <!-- 统计面板 -->
    <StatisticsPanel
      :stats="todayStats"
      :mastery-distribution="masteryDistribution"
      :error-distribution="errorDistribution"
    />
    
    <!-- 快速启动区 -->
    <QuickLaunchSection
      :courses="activeCourses"
      :practice-modes="supportedModes"
      :review-queue="reviewQueue"
      @launch-course="launchCoursePractice"
      @start-practice="startQuickPractice"
      @start-error-review="startErrorReview"
      @start-review-queue="startReviewQueue"
    />
    
    <!-- 练习模式标签页 -->
    <el-tabs v-model="activeTab" class="practice-tabs">
      <!-- 课程练习 -->
      <el-tab-pane label="📚 课程练习" name="course">
        <CoursePracticePanel
          :courses="courses"
          @select="selectCourse"
        />
      </el-tab-pane>
      
      <!-- 快速练习 -->
      <el-tab-pane label="⚡ 快速练习" name="quick">
        <QuickPracticePanel
          :practice-modes="supportedModes"
          @select="selectQuickPractice"
        />
      </el-tab-pane>
      
      <!-- 错题复习 -->
      <el-tab-pane label="🔍 错题复习" name="errors">
        <ErrorReviewPanel
          :error-items="errorReviewItems"
          @start-review="startErrorReview"
        />
      </el-tab-pane>
      
      <!-- 复习队列 -->
      <el-tab-pane label="↻ 复习队列" name="review">
        <ReviewQueuePanel
          :queue-items="reviewQueueItems"
          :queue-stats="queueStats"
          @start-review="startReviewQueue"
        />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import { useErrorStore } from '../stores/errorStore'
import { usePracticeStore } from '../stores/practiceStore'
import { courseRepository } from '../../shared/database/repositories/courseRepository'
import * as AdaptiveRecommendationsModule from '../components/practice/AdaptiveRecommendations.vue'
import * as StatisticsPanelModule from '../components/practice/StatisticsPanel.vue'
import * as QuickLaunchSectionModule from '../components/practice/QuickLaunchSection.vue'
import * as CoursePracticePanelModule from '../components/practice/CoursePracticePanel.vue'
import * as QuickPracticePanelModule from '../components/practice/QuickPracticePanel.vue'
import * as ErrorReviewPanelModule from '../components/practice/ErrorReviewPanel.vue'
import * as ReviewQueuePanelModule from '../components/practice/ReviewQueuePanel.vue'

const AdaptiveRecommendations = (AdaptiveRecommendationsModule as unknown as { default: Component }).default
const StatisticsPanel = (StatisticsPanelModule as unknown as { default: Component }).default
const QuickLaunchSection = (QuickLaunchSectionModule as unknown as { default: Component }).default
const CoursePracticePanel = (CoursePracticePanelModule as unknown as { default: Component }).default
const QuickPracticePanel = (QuickPracticePanelModule as unknown as { default: Component }).default
const ErrorReviewPanel = (ErrorReviewPanelModule as unknown as { default: Component }).default
const ReviewQueuePanel = (ReviewQueuePanelModule as unknown as { default: Component }).default

type PracticeModeKey = 'dictation' | 'follow' | 'translation' | 'imitation'

type Recommendation = {
  type: 'remedy' | 'review' | 'course'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  action: string
  icon?: string
  count?: number
  courseId?: string
}

const router = useRouter()
const courseStore = useCourseStore()
const errorStore = useErrorStore()
const practiceStore = usePracticeStore()

// 状态
const activeTab = ref('quick')
const showRecommendations = ref(true)

// 计算属性
const courses = computed(() => courseStore.courses)
const activeCourses = computed(() =>
  courses.value.slice(0, 3).map(course => ({
    id: course.id,
    title: course.title,
    progress: {
      currentLesson: 1,
      totalLessons: course.lessons?.length ?? course.lessonCount ?? 0,
    },
  }))
)
const reviewQueue = computed(() => practiceStore.reviewQueue)
const reviewQueueItems = computed(() => practiceStore.reviewQueueItems)

// 智能推荐
const recommendations = computed<Recommendation[]>(() => {
  const result: Recommendation[] = []
  
  // 1. 基于错误率的补救课程推荐
  const errorStats = errorStore.getDailyStats()
  if (errorStats.listeningErrorRate > 0.3) {
    result.push({
      type: 'remedy',
      title: '🔴 听力强化课程',
      description: `您的听力错误率超过 30%，建议进行听力补救学习`,
      priority: 'high',
      action: 'remedy-listening',
      icon: 'Headset'
    })
  }
  
  if (errorStats.speakingErrorRate > 0.25) {
    result.push({
      type: 'remedy',
      title: '🟡 口语跟读训练',
      description: `您的发音错误率超过 25%，建议加强跟读练习`,
      priority: 'high',
      action: 'remedy-speaking',
      icon: 'Microphone'
    })
  }
  
  // 2. 基于掌握度的复习推荐
  const masteryGaps = errorStore.getFrequentErrors()
  if (masteryGaps.length > 0) {
    result.push({
      type: 'review',
      title: `📍 优先复习 ${masteryGaps.length} 个高频错题`,
      description: `这些题目在历史练习中重复出错，建议优先复习`,
      priority: 'high',
      action: 'review-errors',
      icon: 'List',
      count: masteryGaps.length
    })
  }
  
  // 3. 新课程推荐
  if (activeCourses.value.length > 0) {
    const first = activeCourses.value[0]
    result.push({
      type: 'course',
      title: `🟢 继续课程：${first.title}`,
      description: `进度：第 ${first.progress.currentLesson}/${first.progress.totalLessons} 课时`,
      priority: 'medium',
      action: 'continue-course',
      icon: 'BookmarkFill',
      courseId: first.id,
    })
  }
  
  return result
})

// 统计数据
const todayStats = ref({
  practiceCount: 0,
  avgAccuracy: 0,
  totalMinutes: 0,
  streakDays: 0,
})
const statsError = ref('')

// 近 30 天练习模式准确率与错题数量；无记录的模式显示“暂无数据”
type AnalyticsMode = 'dictation' | 'follow' | 'translation' | 'imitation'
const analyticsModes: AnalyticsMode[] = ['dictation', 'follow', 'translation', 'imitation']
const masteryDistribution = ref<Record<AnalyticsMode, number | null>>({
  dictation: null,
  follow: null,
  translation: null,
  imitation: null,
})
const errorDistribution = ref<Record<AnalyticsMode, number>>({
  dictation: 0,
  follow: 0,
  translation: 0,
  imitation: 0,
})

async function loadPracticeAnalytics() {
  try {
    const now = Date.now()
    const records = await courseRepository.getPracticeRecordsByRange(now - 30 * 24 * 60 * 60 * 1000, now)
    for (const mode of analyticsModes) {
      const modeRecords = records.filter(record => String(record.mode) === mode)
      masteryDistribution.value[mode] = modeRecords.length > 0
        ? Math.round(modeRecords.reduce((sum, record) => sum + record.accuracy, 0) / modeRecords.length * 10) / 10
        : null
      errorDistribution.value[mode] = modeRecords.reduce(
        (sum, record) => sum + (record.incorrectItemIds?.length ?? 0),
        0,
      )
    }
  } catch (error) {
    console.error('加载练习模式分析失败:', error)
    masteryDistribution.value = { dictation: null, follow: null, translation: null, imitation: null }
    statsError.value = '练习分析数据加载失败，请检查后端服务后重试。'
  }
}

// 错题复习项
const errorReviewItems = computed(() => {
  return errorStore.getErrorItems().slice(0, 10)
})

// 复习队列统计
const queueStats = computed(() => {
  return {
    totalItems: reviewQueueItems.value.length,
    estimatedTime: Math.ceil(reviewQueueItems.value.length * 1.5), // 每项约1.5分钟
    nextReviewCount: reviewQueueItems.value.filter(item => item.isOverdue).length,
  }
})

// 支持的练习模式
const supportedModes: PracticeModeKey[] = [
  'dictation',
  'follow',
  'translation',
  'imitation',
]

// 加载今日统计
async function loadTodayStats() {
  try {
    const stats = await practiceStore.getTodayStats()
    todayStats.value = stats
    statsError.value = ''
  } catch (error) {
    console.error('加载统计数据失败:', error)
    statsError.value = '练习统计加载失败，请检查后端服务后点击刷新或重新进入页面。'
  }
}

// 处理推荐
function startPracticeWithRecommendation(action: string) {
  switch (action) {
    case 'remedy-listening':
      void startQuickPractice('dictation', 'medium')
      break
    case 'remedy-speaking':
      void startQuickPractice('follow', 'medium')
      break
    case 'review-errors':
      startErrorReview()
      break
    case 'continue-course': {
      const courseId = activeCourses.value[0]?.id
      if (courseId) launchCoursePractice(courseId)
      else {
        ElMessage.info('当前还没有可继续的课程，请先到课程仓库选择课程')
        void router.push({ name: 'CourseRepository' })
      }
      break
    }
  }
}

// 启动课程练习：从课程详情中选择第一个包含题目的课时
async function launchCoursePractice(courseId: string) {
  try {
    await courseStore.loadCourseById(courseId)
    const course = courseStore.currentCourse
    if (!course) {
      ElMessage.error('课程加载失败，请刷新后重试')
      return
    }
    const lesson = course.lessons.find(item => (item.items?.length ?? 0) > 0)
    if (!lesson) {
      ElMessage.warning('该课程暂时没有可练习的题目，请先补充课时内容')
      return
    }
    await router.push({
      name: 'LessonPractice',
      params: { lessonId: lesson.id },
      query: { courseId },
    })
  } catch (error) {
    console.error('启动课程练习失败:', error)
    ElMessage.error('启动课程练习失败，请检查课程数据后重试')
  }
}

// 启动快速练习：将入口动作真正路由到课时练习，而不是只切换标签页
async function startQuickPractice(type: string, _level: string) {
  const modeMap: Record<string, { mode: PracticeModeKey; label: string }> = {
    dictation: { mode: 'dictation', label: '听力/听写训练' },
    follow: { mode: 'follow', label: '口语跟读训练' },
    translation: { mode: 'translation', label: '翻译训练' },
    imitation: { mode: 'imitation', label: '发音模仿训练' },
  }
  const target = modeMap[type]
  if (!target) {
    activeTab.value = 'quick'
    ElMessage.info('该练习模式暂不支持直接启动，请从快速练习中选择')
    return
  }

  try {
    if (courseStore.courses.length === 0) await courseStore.loadCourses()
    if (courseStore.courses.length === 0) {
      ElMessage.warning('还没有可练习的课程。请先到课程仓库创建或导入包含练习内容的课程。')
      await router.push({ name: 'CourseRepository' })
      return
    }

    for (const candidate of courseStore.courses.filter(course => (course.lessons?.length ?? 0) > 0)) {
      await courseStore.loadCourseById(candidate.id)
      const loadedCourse = courseStore.currentCourse
      const lesson = loadedCourse?.lessons?.find(item => (item.items?.length ?? 0) > 0)
      if (!loadedCourse || !lesson) continue

      await router.push({
        name: 'LessonPractice',
        params: { lessonId: lesson.id },
        query: { courseId: loadedCourse.id, mode: target.mode, source: 'practice-center' },
      })
      return
    }

    ElMessage.warning('当前没有包含练习题目的课时，请先到课程仓库补充课程内容。')
    await router.push({ name: 'CourseRepository' })
  } catch (error) {
    console.error('启动快速练习失败:', error)
    ElMessage.error('启动练习失败，请检查课程数据或后端服务后重试')
  }
}

// 启动错题复习
function startErrorReview() {
  activeTab.value = 'errors'
}

// 启动复习队列
function startReviewQueue() {
  activeTab.value = 'review'
}

// 选择课程
function selectCourse(courseId: string) {
  launchCoursePractice(courseId)
}

// 选择快速练习
function selectQuickPractice(type: string) {
  startQuickPractice(type, 'medium')
}

onMounted(async () => {
  await Promise.all([loadTodayStats(), loadPracticeAnalytics(), courseStore.loadCourses(), practiceStore.loadReviewQueue(), errorStore.loadErrorData().catch(error => console.error('加载错题统计失败:', error))])
})
</script>

<style lang="scss" scoped>
.practice-center-optimized {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.practice-tabs {
  :deep(.el-tabs__content) {
    padding: 0;
  }

  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
}
</style>
