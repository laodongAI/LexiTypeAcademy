<!--
  课程页面
  
  展示所有课程列表，支持筛选和搜索
-->

<template>
  <div class="courses-page">
    <!-- 顶部操作栏 -->
    <div class="courses-toolbar">
      <div class="toolbar-left">
        <el-button type="primary" :icon="Plus" @click="router.push('/courses/new')">
          新建课程
        </el-button>
        <el-button :icon="Upload" @click="handleImportCourse">
          导入课程
        </el-button>
      </div>
    </div>
    
    <!-- 搜索和筛选 -->
    <div class="courses-header">
      <el-input
        v-model="searchQuery"
        placeholder="搜索课程..."
        prefix-icon="Search"
        clearable
        class="search-input"
      />
      <el-select v-model="categoryFilter" placeholder="课程分类" clearable>
        <el-option label="全部" value="" />
        <el-option label="基础" value="basic" />
        <el-option label="进阶" value="advanced" />
        <el-option label="专项" value="special" />
      </el-select>
    </div>
    
    <!-- 课程列表 -->
    <div class="courses-grid">
      <el-row :gutter="24">
        <el-col 
          v-for="course in filteredCourses" 
          :key="course.id" 
          :xs="24" 
          :sm="12" 
          :md="8" 
          :lg="6"
        >
          <el-card class="course-card" shadow="hover">
            <div class="course-content" @click="selectCourse(course)">
              <div class="course-icon">
                <el-icon :size="48">
                  <Reading />
                </el-icon>
              </div>
              <h3 class="course-title">{{ course.title }}</h3>
              <p class="course-description">{{ course.description }}</p>
              <div class="course-meta">
                <el-tag size="small" :type="getCategoryType(course.category)">
                  {{ getCategoryLabel(course.category) }}
                </el-tag>
                <span class="lesson-count">{{ course.lessonCount }} 课时</span>
              </div>
            </div>
            
            <!-- 课程操作按钮 -->
            <div class="course-actions">
              <el-button 
                size="small" 
                :icon="Download" 
                @click.stop="handleExportCourse(course.id, course.title)"
              >
                导出
              </el-button>
              <el-button 
                size="small" 
                type="danger" 
                :icon="Delete" 
                @click.stop="handleDeleteCourse(course)"
              >
                删除
              </el-button>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <!-- 空状态 -->
    <el-empty 
      v-if="!courseStore.loading && filteredCourses.length === 0" 
      description="没有找到匹配的课程"
    >
      <el-button type="primary" @click="router.push('/courses/new')">创建第一个课程</el-button>
    </el-empty>
    
    <!-- 加载状态 -->
    <div v-if="courseStore.loading" class="loading-container">
      <el-icon class="is-loading" :size="32"><Loading /></el-icon>
      <p>加载中...</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { Reading, Plus, Upload, Download, Delete } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import type { Course } from '../../shared/types/course'

const router = useRouter()
const courseStore = useCourseStore()

// 搜索和筛选
const searchQuery = ref('')
const categoryFilter = ref('')

// 加载课程
onMounted(async () => {
  await courseStore.loadCourses()
})

// 监听搜索和筛选条件变化
watch([searchQuery, categoryFilter], async () => {
  if (searchQuery.value || categoryFilter.value) {
    await courseStore.searchCourses(searchQuery.value, categoryFilter.value)
  } else {
    await courseStore.loadCourses()
  }
}, { deep: true })

// 筛选后的课程
const filteredCourses = computed(() => {
  return courseStore.courses
})

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

// 选择课程
function selectCourse(course: Course) {
  router.push(`/courses/${course.id}`)
}

// 导入课程
async function handleImportCourse() {
  try {
    // 创建文件输入元素
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      
      try {
        const text = await file.text()
        await courseStore.importCourse(text)
        ElMessage.success('课程导入成功')
      } catch (error) {
        ElMessage.error(error instanceof Error ? error.message : '导入失败')
      }
    }
    
    input.click()
  } catch (error) {
    ElMessage.error('导入课程失败')
  }
}

// 导出课程
async function handleExportCourse(courseId: string, courseTitle: string) {
  try {
    const jsonData = await courseStore.exportCourse(courseId)
    
    // 创建下载链接
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${courseTitle}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('课程导出成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  }
}

// 删除课程
async function handleDeleteCourse(course: Course) {
  try {
    await ElMessageBox.confirm(
      `确定要删除课程「${course.title}」吗？此操作不可恢复。`,
      '删除确认',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    await courseStore.deleteCourse(course.id)
    ElMessage.success('课程删除成功')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除课程失败')
    }
  }
}
</script>

<style lang="scss" scoped>
.courses-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
}

.courses-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .toolbar-left {
    display: flex;
    gap: 12px;
  }
}

.courses-header {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  
  .search-input {
    max-width: 300px;
  }
}

.courses-grid {
  margin-bottom: 24px;
}

.course-card {
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 24px;
  height: 100%;
  
  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
  
  .course-content {
    padding-bottom: 12px;
  }
  
  .course-icon {
    text-align: center;
    margin-bottom: 16px;
    color: var(--el-color-primary);
  }
  
  .course-title {
    margin: 0 0 8px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
  }
  
  .course-description {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 42px;
  }
  
  .course-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
    
    .lesson-count {
      font-size: 12px;
      color: var(--el-text-color-placeholder);
    }
  }
  
  .course-actions {
    display: flex;
    gap: 8px;
    padding-top: 12px;
    border-top: 1px solid var(--el-border-color-lighter);
  }
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
</style>
