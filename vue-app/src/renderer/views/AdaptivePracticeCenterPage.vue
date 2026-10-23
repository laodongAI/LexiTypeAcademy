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
      @start-review="startReviewQueue"
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
import { useCourseStore } from '../stores/courseStore'
import { useErrorStore } from '../stores/errorStore'
import { usePracticeStore } from '../stores/practiceStore'
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
  const masteryGaps = errorStore.getMasteryGaps()
  if (masteryGaps.length > 0) {
    result.push({
      type: 'review',
      title: `📍 优先复习 ${masteryGaps.length} 个错题`,
      description: `这些内容的掌握度较低，需要加强复习`,
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

// 掌握度分布
const masteryDistribution = computed(() => {
  return {
    listening: 60,
    speaking: 50,
    reading: 75,
    writing: 40,
  }
})

// 错误分布
const errorDistribution = computed(() => {
  return {
    spelling: 15,
    grammar: 20,
    pronunciation: 25,
    vocabulary: 18,
    listening: 22,
  }
})

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
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 处理推荐
function startPracticeWithRecommendation(action: string) {
  switch (action) {
    case 'remedy-listening':
      // 启动听力补救课程
      startQuickPractice('dictation', 'medium')
      break
    case 'remedy-speaking':
      // 启动口语训练
      startQuickPractice('follow', 'medium')
      break
    case 'review-errors':
      // 启动错题复习
      startErrorReview()
      break
    case 'continue-course':
      // 继续课程
      const courseId = activeCourses.value[0]?.id
      if (courseId) {
        launchCoursePractice(courseId)
      }
      break
  }
}

// 启动课程练习
function launchCoursePractice(courseId: string) {
  const course = courses.value.find(c => c.id === courseId)
  if (course) {
    const lessonId = course.lessons[0]?.id
    if (!lessonId) return
    router.push({
      name: 'LessonPractice',
      params: { lessonId },
      query: {
        courseId,
      },
    })
  }
}

// 启动快速练习
function startQuickPractice(type: string, level: string) {
  activeTab.value = 'quick'
  // 预留：后续可将 type/level 写入 query 或 store 触发对应模式
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

onMounted(() => {
  loadTodayStats()
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
