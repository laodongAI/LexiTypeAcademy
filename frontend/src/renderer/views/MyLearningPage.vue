<!--
  我的学习页面
  
  显示正在学习的课程列表、学习进度和统计信息
-->

<template>
  <div class="my-learning-page">
    <el-alert
      class="learning-responsibility-note"
      type="info"
      show-icon
      :closable="false"
      title="这里记录你实际学了什么"
      description="这里查看真实学习进度、课程历史和待复习内容；学习目标、每日安排与打卡统一在本页的「目标与计划」中管理。"
    />
    <el-alert
      v-if="learningStore.error"
      class="load-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="'学习数据暂时无法读取：' + learningStore.error"
    >
      <template #default>
        <el-button size="small" @click="loadData">重新加载</el-button>
      </template>
    </el-alert>
    <!-- 学习统计只在数据成功读取后展示，避免故障时把默认零值当成真实统计 -->
    <el-row v-if="!learningStore.error && !loading" :gutter="20" class="stats-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="学习中课程" :value="stats.inProgress">
            <template #prefix>
              <el-icon color="#409EFF"><Reading /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="已完成课程" :value="stats.completed">
            <template #prefix>
              <el-icon color="#67C23A"><CircleCheck /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="课程累计时长" :value="stats.totalHours" suffix="小时">
            <template #prefix>
              <el-icon color="#E6A23C"><Clock /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="待复习" :value="stats.reviewDue">
            <template #prefix>
              <el-icon color="#F56C6C"><Warning /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 快速操作 -->
    <el-card class="quick-actions-card" shadow="hover">
      <template #header>
        <span>快速操作</span>
      </template>
      <el-space :size="20" wrap>
        <el-button type="primary" size="large" @click="continueLearning">
          <el-icon><VideoPlay /></el-icon>
          继续学习
        </el-button>
        <el-button type="success" size="large" @click="goToCourseRepository">
          <el-icon><Folder /></el-icon>
          浏览课程仓库
        </el-button>
        <el-button type="warning" size="large" @click="startReview">
          <el-icon><RefreshRight /></el-icon>
          开始复习
        </el-button>
        <el-button size="large" @click="goToPlans">
          <el-icon><Document /></el-icon>
          目标与计划
        </el-button>
      </el-space>
    </el-card>

    <!-- 学习课程列表 -->
    <el-card class="courses-card">
      <template #header>
        <div class="card-header">
          <span>学习课程</span>
          <el-radio-group v-model="filterStatus" size="small">
            <el-radio-button value="all">全部</el-radio-button>
            <el-radio-button value="in_progress">进行中</el-radio-button>
            <el-radio-button value="completed">已完成</el-radio-button>
            <el-radio-button value="review_due">待复习</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 数据加载与空状态必须区分 -->
      <el-skeleton v-if="loading" :rows="4" animated />
      <el-empty v-else-if="learningStore.error" description="学习列表读取失败，重新加载后再试" :image-size="80">
        <el-button type="primary" @click="loadData">重新加载</el-button>
      </el-empty>
      <el-empty v-else-if="filteredCourses.length === 0" description="还没有学习课程">
        <el-button type="primary" @click="goToCourseRepository">
          浏览课程仓库
        </el-button>
      </el-empty>

      <!-- 课程列表 -->
      <div v-else class="courses-grid">
        <el-card
          v-for="course in filteredCourses"
          :key="course.id"
          class="course-card"
          shadow="hover"
          @click="goToCourse(course)"
        >
          <div class="course-header">
            <h3 class="course-title">{{ course.title }}</h3>
            <el-tag :type="getStatusType(course.learningStatus)" size="small">
              {{ getStatusText(course.learningStatus) }}
            </el-tag>
          </div>
          
          <p class="course-description">{{ course.description }}</p>
          
          <div class="course-progress">
            <el-progress
              :percentage="course.completionPercentage || 0"
              :color="getProgressColor(course.completionPercentage || 0)"
            />
            <span class="progress-text">
              {{ course.completedLessons || 0 }} / {{ course.lessonCount }} 课时
            </span>
          </div>
          
          <div class="course-stats">
            <span><el-icon><Clock /></el-icon> {{ (course.totalStudyTime || 0) / 60 | 0 }}h</span>
            <span v-if="course.lastStudiedAt">
              最后学习: {{ new Date(course.lastStudiedAt).toLocaleDateString() }}
            </span>
          </div>
          
          <div class="course-actions">
            <el-button type="primary" size="small" @click.stop="continueCourse(course)">
              继续学习
            </el-button>
            <el-button size="small" @click.stop="reviewCourse(course)">
              复习
            </el-button>
            <el-button size="small" text @click.stop="removeCourse(course)">
              移除
            </el-button>
          </div>
        </el-card>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import {
  Reading,
  CircleCheck,
  Clock,
  Warning,
  VideoPlay,
  Folder,
  RefreshRight,
  Document,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useLearningStore } from '../stores/learningStore'
import type { LearningCourse } from '../../shared/types/learning'

// 路由
const router = useRouter()

// Store
const learningStore = useLearningStore()

// 从 store 获取数据
const learningCourses = computed(() => learningStore.learningCourses)
const stats = computed(() => learningStore.stats)
const loading = computed(() => learningStore.loading)

// 筛选状态
const filterStatus = ref<'all' | 'in_progress' | 'completed' | 'review_due'>('all')

// 筛选后的课程
const filteredCourses = computed(() => {
  if (filterStatus.value === 'all') {
    return learningCourses.value
  }
  
  switch (filterStatus.value) {
    case 'in_progress':
      return learningStore.inProgressCourses
    case 'completed':
      return learningStore.completedCourses
    case 'review_due':
      return learningStore.reviewDueCourses
    default:
      return learningCourses.value
  }
})

// 加载数据
async function loadData() {
  try {
    await learningStore.loadLearningCourses()
  } catch (error) {
    ElMessage.error('加载学习课程失败')
    console.error('加载学习课程失败:', error)
  }
}

// 继续学习
function continueLearning() {
  const inProgressCourses = learningStore.inProgressCourses
  if (inProgressCourses.length > 0) {
    // 找到最近学习的课程
    goToCourse(inProgressCourses[0])
  } else {
    ElMessage.info('暂无进行中的课程')
    goToCourseRepository()
  }
}

// 跳转到课程仓库
function goToCourseRepository() {
  router.push('/course-repository')
}

// 学习计划是学习总览中的目标管理入口，保留原独立路由以兼容旧链接。
function goToPlans() {
  router.push('/plans')
}

// 开始复习
function startReview() {
  const reviewCourses = learningStore.reviewDueCourses
  if (reviewCourses.length > 0) {
    goToCourse(reviewCourses[0])
  } else {
    ElMessage.info('暂无需要复习的课程')
  }
}

// 跳转到课程详情
function goToCourse(course: LearningCourse) {
  router.push(`/courses/${course.id}`)
}

// 继续学习课程
function continueCourse(course: LearningCourse) {
  // 暂时跳转到课程详情，避免进入不存在的路由导致空页面
  router.push(`/courses/${course.id}`)
}

// 复习课程
function reviewCourse(course: LearningCourse) {
  // 复习暂时也落到课程详情，后续可在详情内进入具体复习模式
  router.push(`/courses/${course.id}`)
}

// 移除课程
async function removeCourse(course: LearningCourse) {
  try {
    await ElMessageBox.confirm(
      `确定要从学习列表移除"${course.title}"吗？`,
      '确认移除',
      {
        type: 'warning',
      }
    )
    
    await learningStore.removeFromLearningList(course.id)
    ElMessage.success('已移除')
  } catch {
    // 取消移除
  }
}

// 获取状态类型
function getStatusType(status?: string) {
  if (!status) return 'info'
  
  const types: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    not_started: 'info',
    in_progress: '',
    completed: 'success',
    paused: 'warning',
  }
  return types[status] || 'info'
}

// 获取状态文本
function getStatusText(status?: string) {
  if (!status) return '未知'
  
  const texts: Record<string, string> = {
    not_started: '未开始',
    in_progress: '学习中',
    completed: '已完成',
    paused: '已暂停',
  }
  return texts[status] || status
}

// 获取进度颜色
function getProgressColor(progress: number) {
  if (progress >= 80) return '#67C23A'
  if (progress >= 50) return '#409EFF'
  if (progress >= 30) return '#E6A23C'
  return '#F56C6C'
}

// 挂载时加载数据
onMounted(() => {
  loadData()
})
</script>

<style lang="scss" scoped>
.load-alert { margin-bottom: 16px; }
.my-learning-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.stats-row {
  margin-bottom: 24px;
  
  .stat-card {
    margin-bottom: 16px;
  }
}

.quick-actions-card {
  margin-bottom: 24px;
}

.courses-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.course-card {
  cursor: pointer;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-4px);
  }
  
  .course-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
    
    .course-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      flex: 1;
      margin-right: 12px;
    }
  }
  
  .course-description {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    margin-bottom: 16px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .course-progress {
    margin-bottom: 12px;
    
    .progress-text {
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
      display: block;
    }
  }
  
  .course-stats {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    
    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
  
  .course-actions {
    display: flex;
    gap: 8px;
  }
}
</style>
