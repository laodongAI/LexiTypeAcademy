<!--
  学习历史页面
  
  查看学习记录和统计
-->

<template>
  <div class="history-page">
    <!-- 统计概览 -->
    <el-row :gutter="24" class="stats-overview">
      <el-col :span="6">
        <el-card class="stat-card primary">
          <el-statistic title="总学习时长" :value="totalHours" suffix="小时" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card success">
          <el-statistic title="已学词汇" :value="totalWords" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card warning">
          <el-statistic title="完成课程" :value="completedCourses" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card info">
          <el-statistic title="学习天数" :value="learningDays" suffix="天" />
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 学习日历 -->
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
            v-for="(day, index) in calendarDays" 
            :key="index"
            class="calendar-day"
            :class="{ 
              active: day.hasActivity,
              today: day.isToday,
              'other-month': !day.isCurrentMonth
            }"
          >
            <span class="day-number">{{ day.date }}</span>
            <span v-if="day.hasActivity" class="activity-dot" />
          </div>
        </div>
      </div>
    </el-card>
    
    <!-- 学习记录列表 -->
    <el-card class="records-card">
      <template #header>
        <div class="card-header">
          <span>学习记录</span>
          <el-select v-model="recordFilter" placeholder="筛选类型">
            <el-option label="全部" value="" />
            <el-option label="打字练习" value="typing" />
            <el-option label="拼音学习" value="pinyin" />
            <el-option label="复习" value="review" />
            <el-option label="游戏" value="game" />
          </el-select>
        </div>
      </template>
      
      <el-timeline>
        <el-timeline-item
          v-for="record in filteredRecords"
          :key="record.id"
          :timestamp="record.date"
          :type="getRecordType(record.type)"
          placement="top"
        >
          <el-card class="record-item">
            <div class="record-content">
              <h4>{{ record.title }}</h4>
              <p>{{ record.description }}</p>
              <div class="record-stats">
                <span v-if="record.duration">时长: {{ record.duration }}分钟</span>
                <span v-if="record.accuracy">正确率: {{ record.accuracy }}%</span>
                <span v-if="record.words">词汇: {{ record.words }}个</span>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      
      <el-empty v-if="filteredRecords.length === 0" description="暂无学习记录" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

// 统计数据
const totalHours = ref(48)
const totalWords = ref(256)
const completedCourses = ref(5)
const learningDays = ref(30)

// 日历
const selectedMonth = ref(new Date())
const weekDays = ['日', '一', '二', '三', '四', '五', '六']

// 日历数据（简化示例）
const calendarDays = computed(() => {
  const days = []
  for (let i = 1; i <= 35; i++) {
    days.push({
      date: i <= 30 ? i : i - 30,
      isCurrentMonth: i <= 30,
      isToday: i === new Date().getDate(),
      hasActivity: Math.random() > 0.5,
    })
  }
  return days
})

// 记录筛选
const recordFilter = ref('')

// 学习记录
interface Record {
  id: string
  type: string
  title: string
  description: string
  date: string
  duration?: number
  accuracy?: number
  words?: number
}

const records = ref<Record[]>([
  {
    id: '1',
    type: 'typing',
    title: '打字练习 - 基础汉字',
    description: '完成了基础汉字第一课的练习',
    date: '2024-01-15 14:30',
    duration: 25,
    accuracy: 92,
    words: 15,
  },
  {
    id: '2',
    type: 'pinyin',
    title: '拼音学习 - 声母练习',
    description: '学习了 b, p, m, f 四个声母',
    date: '2024-01-15 10:00',
    duration: 15,
  },
  {
    id: '3',
    type: 'review',
    title: '词汇复习',
    description: '复习了 20 个词汇',
    date: '2024-01-14 16:00',
    duration: 20,
    accuracy: 85,
    words: 20,
  },
  {
    id: '4',
    type: 'game',
    title: '汉字配对游戏',
    description: '获得了 1200 分的好成绩',
    date: '2024-01-14 11:00',
    duration: 10,
  },
])

// 筛选后的记录
const filteredRecords = computed(() => {
  if (!recordFilter.value) return records.value
  return records.value.filter(r => r.type === recordFilter.value)
})

// 获取记录类型颜色
function getRecordType(type: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  const types: { [key: string]: 'primary' | 'success' | 'warning' | 'danger' | 'info' } = {
    typing: 'primary',
    pinyin: 'success',
    review: 'warning',
    game: 'info',
  }
  return types[type] || 'info'
}
</script>

<style lang="scss" scoped>
.history-page {
  max-width: 1200px;
  margin: 0 auto;
}

.stats-overview {
  margin-bottom: 24px;
}

.stat-card {
  text-align: center;
  
  &.primary {
    border-top: 3px solid var(--primary-color);
  }
  
  &.success {
    border-top: 3px solid var(--el-color-success);
  }
  
  &.warning {
    border-top: 3px solid var(--el-color-warning);
  }
  
  &.info {
    border-top: 3px solid var(--el-color-info);
  }
  
  :deep(.el-statistic__content) {
    justify-content: center;
  }
}

.calendar-card {
  margin-bottom: 24px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.calendar-grid {
  .calendar-header {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
    margin-bottom: 8px;
    
    span {
      text-align: center;
      padding: 8px;
      font-weight: 500;
      color: var(--text-color-secondary);
    }
  }
  
  .calendar-body {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 4px;
  }
  
  .calendar-day {
    position: relative;
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    
    &:hover {
      background-color: var(--bg-color-hover);
    }
    
    &.active {
      background-color: var(--primary-color-lighter);
    }
    
    &.today {
      border: 2px solid var(--primary-color);
    }
    
    &.other-month {
      opacity: 0.4;
    }
    
    .day-number {
      font-size: 14px;
    }
    
    .activity-dot {
      position: absolute;
      bottom: 4px;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background-color: var(--el-color-success);
    }
  }
}

.records-card {
  .record-item {
    :deep(.el-card__body) {
      padding: 12px 16px;
    }
  }
  
  .record-content {
    h4 {
      margin: 0 0 8px 0;
      font-size: 15px;
      color: var(--text-color);
    }
    
    p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: var(--text-color-secondary);
    }
    
    .record-stats {
      display: flex;
      gap: 16px;
      font-size: 12px;
      color: var(--text-color-placeholder);
    }
  }
}
</style>
