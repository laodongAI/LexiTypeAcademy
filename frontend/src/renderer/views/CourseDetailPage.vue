<!--
  课程详情页面
  
  展示课程的详细信息、课时列表和学习进度
-->

<template>
  <div class="course-detail-page">
    <!-- 加载状态 -->
    <div v-if="courseStore.loading" class="loading-container">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>
    
    <!-- 课程内容 -->
    <template v-else-if="courseStore.currentCourse">
      <!-- 课程头部 -->
      <div class="course-header">
        <el-page-header @back="router.back()">
          <template #content>
            <div class="header-content">
              <h1 class="course-title">{{ courseStore.currentCourse.title }}</h1>
              <div class="course-tags">
                <el-tag :type="getCategoryType(courseStore.currentCourse.category)">
                  {{ getCategoryLabel(courseStore.currentCourse.category) }}
                </el-tag>
                <el-tag type="info">{{ courseStore.currentCourse.difficulty }}</el-tag>
              </div>
            </div>
          </template>
          <template #extra>
            <el-space>
              <el-button :icon="Edit" @click="handleEditCourse">编辑</el-button>
              <el-button :icon="Download" @click="handleExportCourse">导出</el-button>
              <el-button type="danger" :icon="Delete" @click="handleDeleteCourse">删除</el-button>
            </el-space>
          </template>
        </el-page-header>
      </div>
      
      <!-- 课程信息卡片 -->
      <el-row :gutter="24" class="course-info-row">
        <el-col :xs="24" :sm="24" :md="16">
          <el-card class="info-card">
            <template #header>
              <div class="card-header">
                <span>课程介绍</span>
              </div>
            </template>
            <p class="course-description">{{ courseStore.currentCourse.description }}</p>
            <el-divider />
            <el-descriptions :column="2" border>
              <el-descriptions-item label="课时数量">
                {{ courseStore.currentCourse.lessonCount }}
              </el-descriptions-item>
              <el-descriptions-item label="难度等级">
                {{ courseStore.currentCourse.difficulty }}
              </el-descriptions-item>
              <el-descriptions-item label="创建时间" :span="2">
                {{ formatDate(courseStore.currentCourse.createdAt) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-card>
        </el-col>
        
        <el-col :xs="24" :sm="24" :md="8">
          <el-card class="progress-card">
            <template #header>
              <div class="card-header">
                <span>学习进度</span>
              </div>
            </template>
            <div class="progress-content">
              <el-progress
                type="circle"
                :percentage="courseProgress"
                :width="150"
              >
                <template #default="{ percentage }">
                  <span class="percentage-value">{{ percentage }}%</span>
                  <span class="percentage-label">已完成</span>
                </template>
              </el-progress>
              <div class="progress-stats">
                <div class="stat-item">
                  <span class="stat-label">已完成</span>
                  <span class="stat-value">{{ completedCount }}/{{ courseStore.currentCourse.lessonCount }}</span>
                </div>
                <div class="stat-item">
                  <span class="stat-label">最后学习</span>
                  <span class="stat-value">{{ lastStudiedText }}</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
      
      <!-- 课时列表 -->
      <el-card class="lessons-card">
        <template #header>
          <div class="card-header">
            <span>课时列表</span>
            <el-button type="primary" size="small" :icon="Plus" @click="handleAddLesson">
              添加课时
            </el-button>
          </div>
        </template>
        
        <el-table :data="courseStore.currentCourse.lessons" stripe style="width: 100%">
          <el-table-column type="index" label="#" width="60" />
          <el-table-column prop="title" label="课时名称" min-width="200" />
          <el-table-column prop="contentShape" label="内容类型" width="120">
            <template #default="{ row }">
              <el-tag size="small">{{ getContentShapeLabel(row.contentShape) }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="items" label="项目数" width="100">
            <template #default="{ row }">
              {{ row.items?.length || 0 }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-tag v-if="isLessonCompleted(row.id)" type="success" size="small">
                已完成
              </el-tag>
              <el-tag v-else-if="isCurrentLesson(row.id)" type="warning" size="small">
                学习中
              </el-tag>
              <el-tag v-else type="info" size="small">
                未开始
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                @click="handleStartPractice(row as Lesson)"
              >
                进入课堂
              </el-button>
              <el-button
                size="small"
                :icon="Edit"
                @click="handleEditLesson(row as Lesson)"
              />
              <el-button
                size="small"
                type="danger"
                :icon="Delete"
                @click="handleDeleteLesson(row as Lesson)"
              />
            </template>
          </el-table-column>
        </el-table>
        
        <el-empty v-if="!courseStore.currentCourse.lessons?.length" description="暂无课时" />
      </el-card>
    </template>
    
    <!-- 课程不存在 -->
    <el-empty v-else description="课程不存在">
      <el-button type="primary" @click="router.push('/courses')">返回课程列表</el-button>
    </el-empty>

    <!-- 课堂入口弹窗：进入学习前的模式选择 -->
    <ClassroomEntryDialog
      v-model="showEntryDialog"
      :lesson="selectedLesson"
      :course-title="courseStore.currentCourse?.title"
      @enter="handleClassroomEnter"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Edit, Delete, Download, Plus, Loading } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import type { Lesson } from '../../shared/types/course'
import ClassroomEntryDialog from '../components/classroom/ClassroomEntryDialog.vue'
import type { ClassroomMode, ClassroomOptions } from '../../shared/types/classroom'

const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()

/** 是否显示课堂入口弹窗 */
const showEntryDialog = ref(false)
/** 当前选中的课时 */
const selectedLesson = ref<Lesson | null>(null)

// 课程ID
const courseId = computed(() => route.params.courseId as string)

// 加载课程数据
onMounted(async () => {
  if (courseId.value) {
    await courseStore.loadCourseById(courseId.value)
  }
})

// 学习进度
const courseProgress = computed(() => {
  return courseStore.currentProgress?.completionPercentage || 0
})

const completedCount = computed(() => {
  return courseStore.currentProgress?.completedLessonIds.length || 0
})

const lastStudiedText = computed(() => {
  if (!courseStore.currentProgress?.lastStudiedAt) return '从未学习'
  const date = new Date(courseStore.currentProgress.lastStudiedAt)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  
  if (days === 0) return '今天'
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  return formatDate(courseStore.currentProgress.lastStudiedAt)
})

// 判断课时是否完成
function isLessonCompleted(lessonId: string): boolean {
  return courseStore.currentProgress?.completedLessonIds.includes(lessonId) || false
}

// 判断是否为当前学习的课时
function isCurrentLesson(lessonId: string): boolean {
  return courseStore.currentProgress?.currentLessonId === lessonId
}

// 获取分类标签类型
function getCategoryType(category: string) {
  const types: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    basic: '',
    advanced: 'success',
    special: 'warning',
  }
  return types[category] || 'info'
}

// 获取分类标签文本
function getCategoryLabel(category: string) {
  const labels: Record<string, string> = {
    basic: '基础',
    advanced: '进阶',
    special: '专项',
  }
  return labels[category] || category
}

// 获取内容类型标签
function getContentShapeLabel(shape: string) {
  const labels: Record<string, string> = {
    word: '单词',
    phrase: '短语',
    sentence: '句子',
    passage: '段落',
    dialog: '对话'
  }
  return labels[shape] || shape
}

// 格式化日期
function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
}

/**
 * 打开课堂入口弹窗
 * @param lesson 目标课时
 */
function handleStartPractice(lesson: Lesson) {
  selectedLesson.value = lesson
  showEntryDialog.value = true
}

/**
 * 处理课堂入口选择结果
 * @param mode 课堂模式
 * @param options 课堂偏好
 */
function handleClassroomEnter(mode: ClassroomMode, options: ClassroomOptions) {
  const lesson = selectedLesson.value
  if (!lesson) return

  // 原有练习页：保持旧入口可用，避免用户习惯中断
  if (mode === 'classic') {
    router.push({
      name: 'LessonPractice',
      params: { lessonId: lesson.id },
      query: { courseId: courseId.value, lessonId: lesson.id },
    })
    return
  }

  router.push({
    name: 'Classroom',
    params: { lessonId: lesson.id },
    query: {
      courseId: courseId.value,
      mode,
      hover: options.hoverEnabled ? '1' : '0',
      zh: options.showChinese ? '1' : '0',
    },
  })
}

// 编辑课程
function handleEditCourse() {
  router.push(`/courses/${courseId.value}/edit`)
}

// 导出课程
async function handleExportCourse() {
  try {
    const jsonData = await courseStore.exportCourse(courseId.value)
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${courseStore.currentCourse?.title || 'course'}.json`
    a.click()
    URL.revokeObjectURL(url)
    ElMessage.success('课程导出成功')
  } catch (error) {
    ElMessage.error('导出失败')
  }
}

// 删除课程
async function handleDeleteCourse() {
  try {
    await ElMessageBox.confirm(
      `确定要删除课程「${courseStore.currentCourse?.title}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await courseStore.deleteCourse(courseId.value)
    ElMessage.success('课程删除成功')
    router.push('/courses')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}

// 添加课时
function handleAddLesson() {
  router.push({
    path: `/courses/${courseId.value}/edit`,
    query: {
      addLesson: '1',
    },
  })
}

// 编辑课时
function handleEditLesson(lesson: Lesson) {
  router.push({
    path: `/courses/${courseId.value}/edit`,
    query: {
      lessonId: lesson.id,
    },
  })
}

// 删除课时
async function handleDeleteLesson(lesson: Lesson) {
  try {
    await ElMessageBox.confirm(
      `确定要删除课时「${lesson.title}」吗？`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await courseStore.updateCourse(courseId.value, {
      lessons: courseStore.currentCourse!.lessons.filter(l => l.id !== lesson.id)
    })
    ElMessage.success('课时删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
    }
  }
}
</script>

<style lang="scss" scoped>
.course-detail-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: var(--el-text-color-secondary);
  
  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.course-header {
  margin-bottom: 24px;
  
  .header-content {
    display: flex;
    align-items: center;
    gap: 16px;
    
    .course-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    
    .course-tags {
      display: flex;
      gap: 8px;
    }
  }
}

.course-info-row {
  margin-bottom: 24px;
}

.info-card {
  .course-description {
    line-height: 1.8;
    color: var(--el-text-color-regular);
    margin: 0 0 16px 0;
  }
}

.progress-card {
  .progress-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 24px;
    padding: 20px 0;
    
    .percentage-value {
      display: block;
      font-size: 24px;
      font-weight: 600;
      color: var(--el-color-primary);
    }
    
    .percentage-label {
      display: block;
      font-size: 12px;
      color: var(--el-text-color-secondary);
      margin-top: 4px;
    }
    
    .progress-stats {
      width: 100%;
      
      .stat-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--el-border-color-lighter);
        
        &:last-child {
          border-bottom: none;
        }
        
        .stat-label {
          color: var(--el-text-color-secondary);
          font-size: 14px;
        }
        
        .stat-value {
          color: var(--el-text-color-primary);
          font-weight: 500;
        }
      }
    }
  }
}

.lessons-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
