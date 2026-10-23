<!--
  快速启动区组件
  
  包含：
  - 继续课程
  - 待复习错题
  - 复习队列
  - 快速练习模式
-->

<template>
  <el-card class="quick-launch-section">
    <template #header>
      <div class="card-header">
        <span>🚀 快速启动</span>
      </div>
    </template>

    <el-row :gutter="16" class="launch-cards">
      <!-- 继续课程 -->
      <el-col v-if="courses.length > 0" :xs="24" :sm="12" :md="6" :lg="6">
        <div class="launch-card course-card" @click="handleLaunchCourse">
          <div class="card-icon">
            <el-icon :size="32">📚</el-icon>
          </div>
          <div class="card-content">
            <h4>继续课程</h4>
            <p>{{ courses[0]?.title || '选择课程' }}</p>
            <span class="card-meta">第 {{ courses[0]?.progress.currentLesson + 1 }} 课时</span>
          </div>
          <el-icon class="card-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>

      <!-- 待复习错题 -->
      <el-col :xs="24" :sm="12" :md="6" :lg="6">
        <div class="launch-card error-card" @click="handleReviewErrors">
          <div class="card-icon">
            <el-icon :size="32">🔍</el-icon>
          </div>
          <div class="card-content">
            <h4>待复习错题</h4>
            <p>{{ errorCount }} 个需要复习</p>
            <span class="card-meta">优先修复薄弱项</span>
          </div>
          <el-icon class="card-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>

      <!-- 复习队列 -->
      <el-col :xs="24" :sm="12" :md="6" :lg="6">
        <div class="launch-card queue-card" @click="handleReviewQueue">
          <div class="card-icon">
            <el-icon :size="32">↻</el-icon>
          </div>
          <div class="card-content">
            <h4>复习队列</h4>
            <p>{{ reviewQueue.length }} 个单元</p>
            <span class="card-meta">约 {{ estimatedTime }} 分钟</span>
          </div>
          <el-icon class="card-arrow"><ArrowRight /></el-icon>
        </div>
      </el-col>

      <!-- 快速练习 -->
      <el-col :xs="24" :sm="12" :md="6" :lg="6">
        <el-dropdown trigger="click" @command="handleQuickPractice">
          <div class="launch-card quick-card">
            <div class="card-icon">
              <el-icon :size="32">⚡</el-icon>
            </div>
            <div class="card-content">
              <h4>快速练习</h4>
              <p>选择练习模式</p>
              <span class="card-meta">{{ practiceModes.length }} 种模式</span>
            </div>
            <el-icon class="card-arrow"><ArrowDown /></el-icon>
          </div>

          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="dictation">
                <el-icon><Headset /></el-icon> 听写模式
              </el-dropdown-item>
              <el-dropdown-item command="follow">
                <el-icon><Microphone /></el-icon> 跟读模式
              </el-dropdown-item>
              <el-dropdown-item command="translation">
                <el-icon><DocumentCopy /></el-icon> 翻译模式
              </el-dropdown-item>
              <el-dropdown-item command="imitation">
                <el-icon><Film /></el-icon> 模仿模式
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </el-col>
    </el-row>

    <!-- 快速提示 -->
    <div class="quick-tips">
      <el-alert
        type="info"
        :closable="false"
        show-icon
      >
        <template #title>
          💡 TIP: 建议按顺序完成：继续课程 → 错题复习 → 复习队列
        </template>
      </el-alert>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import {
  ArrowRight,
  ArrowDown,
  Headset,
  Microphone,
  DocumentCopy,
  Film,
} from '@element-plus/icons-vue'

interface Course {
  id: string
  title: string
  progress: {
    currentLesson: number
    totalLessons: number
  }
}

interface ReviewItem {
  id: string
}

type PracticeMode = 'dictation' | 'follow' | 'translation' | 'imitation'

const props = defineProps<{
  courses: Course[]
  practiceModes: PracticeMode[]
  reviewQueue: ReviewItem[]
}>()

const emit = defineEmits<{
  'launch-course': [courseId: string]
  'start-practice': [type: string, level: string]
  'start-review': []
}>()

// 计算属性
const errorCount = computed(() => {
  // 这里应该从 store 获取
  return 5
})

const estimatedTime = computed(() => {
  return Math.ceil(props.reviewQueue.length * 1.5)
})

// 处理程序
function handleLaunchCourse() {
  if (props.courses.length > 0) {
    emit('launch-course', props.courses[0].id)
  }
}

function handleReviewErrors() {
  emit('start-review')
}

function handleReviewQueue() {
  emit('start-review')
}

function handleQuickPractice(mode: PracticeMode) {
  emit('start-practice', mode, 'medium')
}
</script>

<style lang="scss" scoped>
.quick-launch-section {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.03) 0%, rgba(64, 158, 255, 0.01) 100%);

  .card-header {
    font-weight: 600;
    font-size: 15px;
  }
}

.launch-cards {
  margin-bottom: 16px;
}

.launch-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.8);
  border: 1px solid #ebeef5;
  cursor: pointer;
  transition: all 0.3s ease;

  &:hover {
    background-color: #fff;
    border-color: #409eff;
    box-shadow: 0 2px 12px rgba(64, 158, 255, 0.1);
    transform: translateY(-2px);

    .card-arrow {
      color: #409eff;
      transform: translateX(4px);
    }
  }

  .card-icon {
    font-size: 32px;
    flex-shrink: 0;
  }

  .card-content {
    flex: 1;
    min-width: 0;

    h4 {
      margin: 0 0 4px;
      font-size: 15px;
      font-weight: 600;
      color: var(--text-color);
    }

    p {
      margin: 0;
      font-size: 13px;
      color: #909399;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .card-meta {
      display: block;
      font-size: 11px;
      color: #c0c4cc;
      margin-top: 4px;
    }
  }

  .card-arrow {
    font-size: 18px;
    color: #909399;
    transition: all 0.3s ease;
    flex-shrink: 0;
  }
}

.course-card {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0.02) 100%);
  border-color: rgba(64, 158, 255, 0.1);
}

.error-card {
  background: linear-gradient(135deg, rgba(245, 108, 108, 0.05) 0%, rgba(245, 108, 108, 0.02) 100%);
  border-color: rgba(245, 108, 108, 0.1);
}

.queue-card {
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.05) 0%, rgba(103, 194, 58, 0.02) 100%);
  border-color: rgba(103, 194, 58, 0.1);
}

.quick-card {
  background: linear-gradient(135deg, rgba(230, 162, 60, 0.05) 0%, rgba(230, 162, 60, 0.02) 100%);
  border-color: rgba(230, 162, 60, 0.1);
}

.quick-tips {
  margin-top: 16px;

  :deep(.el-alert) {
    padding: 12px 16px;
    background-color: rgba(64, 158, 255, 0.05);
    border-color: rgba(64, 158, 255, 0.1);

    .el-alert__title {
      font-size: 13px;
      font-weight: 500;
    }
  }
}
</style>
