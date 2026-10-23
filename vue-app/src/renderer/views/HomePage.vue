<!--
  首页
  
  展示学习概览、今日任务、学习进度等
-->

<template>
  <div class="home-page">
    <!-- 欢迎区域 -->
    <el-card class="welcome-card">
      <div class="welcome-content">
        <div class="welcome-text">
          <h2>欢迎回来！</h2>
          <p>今天是学习中文的好日子，让我们开始吧！</p>
        </div>
        <div class="welcome-stats">
          <div class="stat-item">
            <span class="stat-value">{{ stats.daysLearned }}</span>
            <span class="stat-label">学习天数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.wordsLearned }}</span>
            <span class="stat-label">已学词汇</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ stats.accuracy }}%</span>
            <span class="stat-label">准确率</span>
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 快捷操作 -->
    <div class="quick-actions">
      <h3>快捷开始</h3>
      <el-row :gutter="16">
        <el-col :span="6" v-for="action in quickActions" :key="action.path">
          <el-card 
            class="action-card" 
            shadow="hover"
            @click="navigateTo(action.path)"
          >
            <el-icon class="action-icon" :size="32">
              <component :is="action.icon" />
            </el-icon>
            <span class="action-title">{{ action.title }}</span>
          </el-card>
        </el-col>
      </el-row>
    </div>
    
    <!-- 今日任务 -->
    <div class="today-tasks">
      <h3>今日任务</h3>
      <el-card>
        <el-progress 
          :percentage="taskProgress" 
          :stroke-width="20"
          :format="formatProgress"
        />
        <div class="task-list">
          <div 
            v-for="task in todayTasks" 
            :key="task.id" 
            class="task-item"
            :class="{ completed: task.completed }"
          >
            <el-checkbox v-model="task.completed" />
            <span class="task-name">{{ task.name }}</span>
          </div>
        </div>
      </el-card>
    </div>
    
    <!-- 最近课程 -->
    <div class="recent-courses">
      <h3>最近学习</h3>
      <el-empty v-if="recentCourses.length === 0" description="暂无学习记录" />
      <el-row v-else :gutter="16">
        <el-col :span="8" v-for="course in recentCourses" :key="course.id">
          <el-card class="course-card" shadow="hover">
            <h4>{{ course.title }}</h4>
            <p>{{ course.description }}</p>
            <el-progress :percentage="course.progress" />
            <el-button type="primary" text @click="continueCourse(course.id)">
              继续学习
            </el-button>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  User,
  Folder,
  Edit,
  Trophy,
  MagicStick,
  RefreshRight,
} from '@element-plus/icons-vue'

const router = useRouter()

// 学习统计
const stats = ref({
  daysLearned: 15,
  wordsLearned: 128,
  accuracy: 85,
})

// 快捷操作
const quickActions = [
  { path: '/my-learning', title: '我的学习', icon: User },
  { path: '/course-repository', title: '课程仓库', icon: Folder },
  { path: '/practice', title: '练习中心', icon: Edit },
  { path: '/games', title: '游戏中心', icon: Trophy },
  { path: '/ai-tools', title: 'AI 工具', icon: MagicStick },
  { path: '/review', title: '复习系统', icon: RefreshRight },
]

// 今日任务
const todayTasks = ref([
  { id: 1, name: '完成 10 分钟打字练习', completed: true },
  { id: 2, name: '学习 5 个新词汇', completed: false },
  { id: 3, name: '复习昨日生词', completed: false },
])

// 任务进度
const taskProgress = computed(() => {
  const completed = todayTasks.value.filter(t => t.completed).length
  return Math.round((completed / todayTasks.value.length) * 100)
})

// 格式化进度
function formatProgress(percentage: number) {
  return `${percentage}% 完成`
}

// 最近课程
const recentCourses = ref([
  { id: 1, title: '基础汉字', description: '学习常用汉字', progress: 60 },
  { id: 2, title: '日常对话', description: '日常生活用语', progress: 30 },
])

// 导航到指定页面
function navigateTo(path: string) {
  router.push(path)
}

// 继续课程
function continueCourse(courseId: number) {
  router.push(`/courses?id=${courseId}`)
}
</script>

<style lang="scss" scoped>
.home-page {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  margin-bottom: 24px;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
  color: #fff;
  
  :deep(.el-card__body) {
    padding: 32px;
  }
}

.welcome-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  .welcome-text {
    h2 {
      margin: 0 0 8px 0;
      font-size: 28px;
    }
    
    p {
      margin: 0;
      opacity: 0.9;
    }
  }
  
  .welcome-stats {
    display: flex;
    gap: 48px;
    
    .stat-item {
      text-align: center;
      
      .stat-value {
        display: block;
        font-size: 32px;
        font-weight: 700;
      }
      
      .stat-label {
        font-size: 14px;
        opacity: 0.8;
      }
    }
  }
}

.quick-actions,
.today-tasks,
.recent-courses {
  margin-bottom: 24px;
  
  h3 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: var(--text-color);
  }
}

.action-card {
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s;
  
  &:hover {
    transform: translateY(-4px);
  }
  
  :deep(.el-card__body) {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 24px;
    gap: 12px;
  }
  
  .action-icon {
    color: var(--primary-color);
  }
  
  .action-title {
    font-size: 14px;
    color: var(--text-color);
  }
}

.task-list {
  margin-top: 16px;
  
  .task-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color-light);
    
    &:last-child {
      border-bottom: none;
    }
    
    &.completed .task-name {
      text-decoration: line-through;
      color: var(--text-color-placeholder);
    }
  }
}

.course-card {
  cursor: pointer;
  
  h4 {
    margin: 0 0 8px 0;
    color: var(--text-color);
  }
  
  p {
    margin: 0 0 12px 0;
    color: var(--text-color-secondary);
    font-size: 14px;
  }
  
  .el-progress {
    margin-bottom: 12px;
  }
}
</style>
