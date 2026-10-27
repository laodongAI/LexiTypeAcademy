<!--
  练习中心页面
  
  整合打字练习和拼音学习，提供快速练习入口和统计展示
-->

<template>
  <div class="practice-center-page">
    <!-- 快速练习入口 -->
    <el-row :gutter="20" class="quick-practice-section">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="practice-card" @click="startQuickPractice('typing', 'easy')">
          <div class="practice-card-content">
            <el-icon :size="40" color="#409EFF"><EditPen /></el-icon>
            <h3>基础打字</h3>
            <p>简单词汇练习</p>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="practice-card" @click="startQuickPractice('typing', 'medium')">
          <div class="practice-card-content">
            <el-icon :size="40" color="#67C23A"><Lightning /></el-icon>
            <h3>速度挑战</h3>
            <p>提升打字速度</p>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8">
        <el-card shadow="hover" class="practice-card" @click="startQuickPractice('pinyin', 'basic')">
          <div class="practice-card-content">
            <el-icon :size="40" color="#E6A23C"><School /></el-icon>
            <h3>拼音学习</h3>
            <p>声母韵母练习</p>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 练习统计 -->
    <el-row :gutter="20" class="stats-section">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <el-statistic title="今日练习" :value="todayStats.practiceCount" suffix="次">
            <template #prefix>
              <el-icon color="#409EFF"><TrendCharts /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <el-statistic title="平均准确率" :value="todayStats.avgAccuracy" suffix="%" :precision="1">
            <template #prefix>
              <el-icon color="#67C23A"><CircleCheck /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <el-statistic title="练习时长" :value="todayStats.totalMinutes" suffix="分钟">
            <template #prefix>
              <el-icon color="#E6A23C"><Timer /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card class="stat-card">
          <el-statistic title="连续练习" :value="todayStats.streakDays" suffix="天">
            <template #prefix>
              <el-icon color="#F56C6C"><Trophy /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="practice-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="打字练习" name="typing">
        <TypingPage />
      </el-tab-pane>
      <el-tab-pane label="拼音学习" name="pinyin">
        <PinyinPage />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  EditPen,
  Lightning,
  School,
  TrendCharts,
  CircleCheck,
  Timer,
  Trophy,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as TypingPageModule from './TypingPage.vue'
import * as PinyinPageModule from './PinyinPage.vue'
import { courseRepository } from '../../shared/database/repositories/courseRepository'

const TypingPage = (TypingPageModule as unknown as { default: Component }).default
const PinyinPage = (PinyinPageModule as unknown as { default: Component }).default

const route = useRoute()
const router = useRouter()
const activeTab = ref('typing')

// 今日统计数据
const todayStats = ref({
  practiceCount: 0,
  avgAccuracy: 0,
  totalMinutes: 0,
  streakDays: 0,
})

// 加载今日统计
async function loadTodayStats() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayTimestamp = today.getTime()
    
    // 获取今日练习记录（后端按时间范围过滤）
    const records = await courseRepository.getPracticeRecordsByRange(todayTimestamp, Date.now())
    
    if (records.length > 0) {
      todayStats.value.practiceCount = records.length
      todayStats.value.avgAccuracy = records.reduce((sum, r) => sum + r.accuracy, 0) / records.length
      todayStats.value.totalMinutes = Math.round(records.reduce((sum, r) => sum + r.duration, 0) / 60000)
    }
    
    // 计算连续练习天数（简化版）
    todayStats.value.streakDays = await calculateStreakDays()
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 计算连续练习天数
async function calculateStreakDays(): Promise<number> {
  try {
    const DAY_MS = 24 * 60 * 60 * 1000
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayStart = today.getTime()
    
    // 一次取回最近30天的练习记录，避免逐日查询造成 30 次请求
    const records = await courseRepository.getPracticeRecordsByRange(
      todayStart - 29 * DAY_MS,
      Date.now()
    )
    
    // 按“当天零点”归并，得到有练习的日期集合
    const practicedDays = new Set<number>()
    for (const record of records) {
      const day = new Date(record.completedAt)
      day.setHours(0, 0, 0, 0)
      practicedDays.add(day.getTime())
    }
    
    // 从今天向前连续统计，遇到空档即停止
    let streakDays = 0
    let checkDate = todayStart
    for (let i = 0; i < 30; i++) {
      if (!practicedDays.has(checkDate)) break
      streakDays++
      checkDate -= DAY_MS
    }
    
    return streakDays
  } catch (error) {
    console.error('计算连续天数失败:', error)
    return 0
  }
}

// 快速练习
function startQuickPractice(type: string, level: string) {
  switch (type) {
    case 'typing':
      activeTab.value = 'typing'
      ElMessage.success(`开始${level === 'easy' ? '基础' : '速度'}打字练习`)
      break
    case 'pinyin':
      activeTab.value = 'pinyin'
      ElMessage.success('开始拼音学习')
      break
  }
}

// 标签页切换
function handleTabChange(tabName: string | number) {
  // 更新 URL 参数
  router.push({
    path: route.path,
    query: { tab: tabName as string },
  })
}

onMounted(() => {
  // 从URL参数读取标签页
  const tab = route.query.tab as string
  if (tab && ['typing', 'pinyin'].includes(tab)) {
    activeTab.value = tab
  }
  
  // 加载统计数据
  loadTodayStats()
})
</script>

<style lang="scss" scoped>
.practice-center-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.quick-practice-section {
  margin-bottom: 24px;
  
  .practice-card {
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      transform: translateY(-4px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .practice-card-content {
      text-align: center;
      padding: 20px 0;
      
      h3 {
        margin: 12px 0 8px;
        font-size: 16px;
        font-weight: 600;
      }
      
      p {
        margin: 0;
        color: #909399;
        font-size: 14px;
      }
    }
  }
}

.stats-section {
  margin-bottom: 24px;
  
  .stat-card {
    :deep(.el-statistic__head) {
      font-size: 14px;
      color: #909399;
    }
    
    :deep(.el-statistic__content) {
      font-size: 24px;
      font-weight: 600;
    }
  }
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
