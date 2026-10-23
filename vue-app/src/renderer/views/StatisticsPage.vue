<!--
  学习数据页面
  
  展示学习历史、统计数据和数据可视化（使用 ECharts）
-->

<template>
  <div class="statistics-page">
    <!-- 数据概览 -->
    <el-row :gutter="20" class="overview-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="总学习时长" :value="stats.totalHours" suffix="小时" :precision="1">
            <template #prefix>
              <el-icon color="#409EFF"><Clock /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="总练习次数" :value="stats.totalPractice">
            <template #prefix>
              <el-icon color="#67C23A"><Document /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="平均WPM" :value="stats.avgWpm" :precision="0">
            <template #prefix>
              <el-icon color="#E6A23C"><Timer /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic title="平均准确率" :value="stats.avgAccuracy" suffix="%" :precision="1">
            <template #prefix>
              <el-icon color="#F56C6C"><CircleCheck /></el-icon>
            </template>
          </el-statistic>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图表区域 -->
    <el-row :gutter="20">
      <el-col :xs="24" :md="12">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header">
              <span>学习趋势</span>
              <el-radio-group v-model="trendPeriod" size="small" @change="loadTrendChart">
                <el-radio-button value="7">近7天</el-radio-button>
                <el-radio-button value="30">近30天</el-radio-button>
                <el-radio-button value="90">近90天</el-radio-button>
              </el-radio-group>
            </div>
          </template>
          <div ref="trendChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card class="chart-card">
          <template #header>
            <div class="chart-header">
              <span>进步曲线</span>
              <el-select v-model="progressMetric" size="small" @change="loadProgressChart">
                <el-option label="准确率" value="accuracy" />
                <el-option label="WPM" value="wpm" />
                <el-option label="完成度" value="completion" />
              </el-select>
            </div>
          </template>
          <div ref="progressChartRef" class="chart-container"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 练习模式分布 -->
    <el-row :gutter="20">
      <el-col :xs="24" :md="12">
        <el-card class="chart-card">
          <template #header>
            <span>练习模式分布</span>
          </template>
          <div ref="modeChartRef" class="chart-container chart-small"></div>
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card class="chart-card">
          <template #header>
            <span>学习时段分布</span>
          </template>
          <div ref="timeChartRef" class="chart-container chart-small"></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 历史记录 -->
    <el-card class="history-card">
      <template #header>
        <div class="card-header">
          <span>学习历史</span>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            size="small"
            @change="loadHistory"
          />
        </div>
      </template>

      <HistoryPage />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, type Component } from 'vue'
import {
  Clock,
  Document,
  Timer,
  CircleCheck,
} from '@element-plus/icons-vue'
import * as echarts from 'echarts'
import type { ECharts } from 'echarts'
import * as HistoryPageModule from './HistoryPage.vue'
import { db } from '../../shared/database/index'

const HistoryPage = (HistoryPageModule as unknown as { default: Component }).default

// 图表实例
const trendChartRef = ref<HTMLElement>()
const progressChartRef = ref<HTMLElement>()
const modeChartRef = ref<HTMLElement>()
const timeChartRef = ref<HTMLElement>()

let trendChart: ECharts | null = null
let progressChart: ECharts | null = null
let modeChart: ECharts | null = null
let timeChart: ECharts | null = null

// 统计数据
const stats = ref({
  totalHours: 0,
  totalPractice: 0,
  avgWpm: 0,
  avgAccuracy: 0,
})

// 图表参数
const trendPeriod = ref('7')
const progressMetric = ref('accuracy')
const dateRange = ref<[Date, Date]>()

// 加载统计数据
async function loadStats() {
  try {
    // 获取所有练习记录
    const allRecords = await db.practiceRecords.toArray()
    
    if (allRecords.length > 0) {
      stats.value.totalPractice = allRecords.length
      stats.value.totalHours = allRecords.reduce((sum, r) => sum + r.duration, 0) / 3600000 // 毫秒转小时
      stats.value.avgAccuracy = allRecords.reduce((sum, r) => sum + r.accuracy, 0) / allRecords.length
      
      // 计算平均 WPM（假设有 WPM 数据）
      // TODO: 需要扩展 PracticeRecord 类型包含 WPM
      stats.value.avgWpm = 0
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
  }
}

// 加载学习趋势图表
async function loadTrendChart() {
  if (!trendChartRef.value) return
  
  try {
    // 计算日期范围
    const days = parseInt(trendPeriod.value)
    const endDate = new Date()
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
    
    // 获取日期范围内的练习记录
    const records = await db.practiceRecords
      .where('completedAt')
      .between(startDate.getTime(), endDate.getTime())
      .toArray()
    
    // 按日期聚合数据
    const dailyData = new Map<string, { count: number; duration: number }>()
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000)
      const dateStr = date.toLocaleDateString()
      dailyData.set(dateStr, { count: 0, duration: 0 })
    }
    
    records.forEach(record => {
      const dateStr = new Date(record.completedAt).toLocaleDateString()
      const data = dailyData.get(dateStr)
      if (data) {
        data.count++
        data.duration += record.duration
      }
    })
    
    const dates = Array.from(dailyData.keys())
    const counts = Array.from(dailyData.values()).map(d => d.count)
    const durations = Array.from(dailyData.values()).map(d => Math.round(d.duration / 60000)) // 转为分钟
    
    // 初始化或更新图表
    if (!trendChart) {
      trendChart = echarts.init(trendChartRef.value)
    }
    
    trendChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      legend: {
        data: ['练习次数', '学习时长(分钟)'],
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
      },
      yAxis: [
        {
          type: 'value',
          name: '练习次数',
          position: 'left',
        },
        {
          type: 'value',
          name: '学习时长(分钟)',
          position: 'right',
        },
      ],
      series: [
        {
          name: '练习次数',
          type: 'line',
          smooth: true,
          data: counts,
          itemStyle: { color: '#409EFF' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(64, 158, 255, 0.3)' },
              { offset: 1, color: 'rgba(64, 158, 255, 0.1)' },
            ]),
          },
        },
        {
          name: '学习时长(分钟)',
          type: 'line',
          smooth: true,
          yAxisIndex: 1,
          data: durations,
          itemStyle: { color: '#67C23A' },
        },
      ],
    })
  } catch (error) {
    console.error('加载学习趋势图表失败:', error)
  }
}

// 加载进步曲线图表
async function loadProgressChart() {
  if (!progressChartRef.value) return
  
  try {
    // 获取最近30次练习记录
    const records = await db.practiceRecords
      .orderBy('completedAt')
      .reverse()
      .limit(30)
      .toArray()
    
    records.reverse() // 按时间正序
    
    const dates = records.map(r => new Date(r.completedAt).toLocaleDateString())
    let data: number[] = []
    let yAxisName = ''
    
    switch (progressMetric.value) {
      case 'accuracy':
        data = records.map(r => r.accuracy)
        yAxisName = '准确率 (%)'
        break
      case 'wpm':
        // TODO: 需要 WPM 数据
        data = records.map(() => Math.random() * 100 + 50) // 模拟数据
        yAxisName = 'WPM'
        break
      case 'completion':
        // TODO: 需要完成度数据
        data = records.map(() => Math.random() * 100) // 模拟数据
        yAxisName = '完成度 (%)'
        break
    }
    
    if (!progressChart) {
      progressChart = echarts.init(progressChartRef.value)
    }
    
    progressChart.setOption({
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: dates,
      },
      yAxis: {
        type: 'value',
        name: yAxisName,
      },
      series: [
        {
          type: 'line',
          smooth: true,
          data: data,
          itemStyle: { color: '#E6A23C' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(230, 162, 60, 0.3)' },
              { offset: 1, color: 'rgba(230, 162, 60, 0.1)' },
            ]),
          },
          markLine: {
            data: [{ type: 'average', name: '平均值' }],
          },
        },
      ],
    })
  } catch (error) {
    console.error('加载进步曲线图表失败:', error)
  }
}

// 加载练习模式分布图表
async function loadModeChart() {
  if (!modeChartRef.value) return
  
  try {
    const records = await db.practiceRecords.toArray()
    
    // 统计各模式练习次数
    const modeCount = new Map<string, number>()
    records.forEach(r => {
      const count = modeCount.get(r.mode) || 0
      modeCount.set(r.mode, count + 1)
    })
    
    const data = Array.from(modeCount.entries()).map(([name, value]) => ({
      name: getModeLabel(name),
      value,
    }))
    
    if (!modeChart) {
      modeChart = echarts.init(modeChartRef.value)
    }
    
    modeChart.setOption({
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: {
        orient: 'vertical',
        left: 'left',
      },
      series: [
        {
          type: 'pie',
          radius: '60%',
          data: data,
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
        },
      ],
    })
  } catch (error) {
    console.error('加载练习模式分布图表失败:', error)
  }
}

// 加载学习时段分布图表
async function loadTimeChart() {
  if (!timeChartRef.value) return
  
  try {
    const records = await db.practiceRecords.toArray()
    
    // 统计各时段练习次数（0-6时, 6-12时, 12-18时, 18-24时）
    const timeSlots = ['凌晨(0-6)', '上午(6-12)', '下午(12-18)', '晚上(18-24)']
    const timeCounts = [0, 0, 0, 0]
    
    records.forEach(r => {
      const hour = new Date(r.completedAt).getHours()
      if (hour < 6) timeCounts[0]++
      else if (hour < 12) timeCounts[1]++
      else if (hour < 18) timeCounts[2]++
      else timeCounts[3]++
    })
    
    if (!timeChart) {
      timeChart = echarts.init(timeChartRef.value)
    }
    
    timeChart.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: timeSlots,
      },
      yAxis: {
        type: 'value',
        name: '练习次数',
      },
      series: [
        {
          type: 'bar',
          data: timeCounts,
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#83bff6' },
              { offset: 1, color: '#188df0' },
            ]),
          },
          barWidth: '60%',
        },
      ],
    })
  } catch (error) {
    console.error('加载学习时段分布图表失败:', error)
  }
}

// 获取模式标签
function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    dictation: '听写',
    followRead: '跟读',
    translation: '翻译',
    imitation: '模仿',
  }
  return labels[mode] || mode
}

// 加载历史记录
async function loadHistory() {
  // 由 HistoryPage 组件处理
}

// 响应窗口大小变化
function handleResize() {
  trendChart?.resize()
  progressChart?.resize()
  modeChart?.resize()
  timeChart?.resize()
}

onMounted(async () => {
  await loadStats()
  
  // 等待 DOM 更新
  await nextTick()
  
  // 初始化图表
  loadTrendChart()
  loadProgressChart()
  loadModeChart()
  loadTimeChart()
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  // 销毁图表实例
  trendChart?.dispose()
  progressChart?.dispose()
  modeChart?.dispose()
  timeChart?.dispose()
  
  // 移除事件监听
  window.removeEventListener('resize', handleResize)
})
</script>

<style lang="scss" scoped>
.statistics-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.overview-row {
  margin-bottom: 24px;
  
  .stat-card {
    margin-bottom: 16px;
  }
}

.chart-card {
  margin-bottom: 24px;
  
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .chart-container {
    height: 350px;
    
    &.chart-small {
      height: 300px;
    }
  }
}

.history-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
