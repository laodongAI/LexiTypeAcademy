<!--
  学习数据页面
  
  展示学习历史、统计数据和数据可视化（使用 ECharts）
-->

<template>
  <div class="statistics-page">
    <el-alert
      v-if="loadError"
      class="load-alert"
      type="warning"
      show-icon
      :closable="false"
      :title="loadError"
    />
    <div v-if="loadError" class="retry-row">
      <el-button size="small" @click="loadStats">重新加载统计</el-button>
    </div>
    <!-- 数据概览 -->
    <el-row :gutter="20" class="overview-row">
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic v-if="stats.totalMinutes !== null" title="累计练习时长" :value="stats.totalMinutes" suffix="分钟" :precision="0">
            <template #prefix>
              <el-icon color="#409EFF"><Clock /></el-icon>
            </template>
          </el-statistic>
          <span v-else class="stat-unavailable">—</span>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic v-if="stats.totalPractice !== null" title="总练习次数" :value="stats.totalPractice">
            <template #prefix>
              <el-icon color="#67C23A"><Document /></el-icon>
            </template>
          </el-statistic>
          <span v-else class="stat-unavailable">—</span>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic v-if="stats.avgWpm !== null" title="平均WPM" :value="stats.avgWpm" :precision="0">
            <template #prefix>
              <el-icon color="#E6A23C"><Timer /></el-icon>
            </template>
          </el-statistic>
          <span v-else class="stat-unavailable">—</span>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="6">
        <el-card shadow="hover" class="stat-card">
          <el-statistic v-if="stats.avgAccuracy !== null" title="平均准确率" :value="stats.avgAccuracy" suffix="%" :precision="1">
            <template #prefix>
              <el-icon color="#F56C6C"><CircleCheck /></el-icon>
            </template>
          </el-statistic>
          <span v-else class="stat-unavailable">—</span>
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
                <el-option label="题量" value="totalItems" />
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
import { courseRepository } from '../../shared/database/repositories/courseRepository'

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
const stats = ref<{
  totalMinutes: number | null
  totalPractice: number | null
  avgWpm: number | null
  avgAccuracy: number | null
}>({
  totalMinutes: null,
  totalPractice: null,
  avgWpm: null,
  avgAccuracy: null,
})
const loadError = ref('')

// 图表参数
const trendPeriod = ref('7')
const progressMetric = ref('accuracy')
const dateRange = ref<[Date, Date]>()

// 加载统计数据
async function loadStats() {
  loadError.value = ''
  try {
    // 获取所有练习记录（后端按完成时间倒序返回）
    const allRecords = await courseRepository.getAllPracticeRecords()
    
    if (allRecords.length > 0) {
      stats.value.totalPractice = allRecords.length
      // 累计练习时长：只汇总练习记录的耗时字段（毫秒），不包含复习/课堂/计划时长（Element Plus 的小数位是截断显示，分钟更直观）
      stats.value.totalMinutes = Math.round(
        allRecords.reduce((sum, r) => sum + r.duration, 0) / 60000
      )
      // 平均准确率：沿用记录中的原始口径（0-100）
      stats.value.avgAccuracy = allRecords.reduce((sum, r) => sum + r.accuracy, 0) / allRecords.length

      // 平均 WPM：只统计真实采集到 WPM 的记录，历史空值不参与平均，避免被 0 拉低
      const wpmRecords = allRecords.filter(r => typeof r.wpm === 'number' && (r.wpm as number) > 0)
      stats.value.avgWpm = wpmRecords.length > 0
        ? wpmRecords.reduce((sum, r) => sum + (r.wpm as number), 0) / wpmRecords.length
        : 0
      console.debug(
        '[statistics] 概览聚合完成：记录=%d，有 WPM 的记录=%d，平均 WPM=%s',
        allRecords.length,
        wpmRecords.length,
        (stats.value.avgWpm ?? 0).toFixed(1)
      )
    } else {
      // 无记录时显式清零，避免残留上一次的统计值
      stats.value.totalPractice = 0
      stats.value.totalMinutes = 0
      stats.value.avgAccuracy = 0
      stats.value.avgWpm = 0
      console.debug('[statistics] 暂无练习记录，概览统计显示为 0')
    }
  } catch (error) {
    console.error('加载统计数据失败:', error)
    loadError.value = '统计数据暂时无法读取，请检查本地后端服务后重试。'
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
    const records = await courseRepository.getPracticeRecordsByRange(
      startDate.getTime(),
      endDate.getTime()
    )
    
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
    // 获取最近30次练习记录（后端返回倒序）
    const records = await courseRepository.getRecentPracticeRecords(30)
    
    records.reverse() // 按时间正序
    
    // 有效指标的记录与日期：只保留真实采集到对应字段的记录，避免空值被画成 0
    let chartDates: string[] = []
    let data: number[] = []
    let yAxisName = ''
    
    switch (progressMetric.value) {
      case 'accuracy':
        // 准确率：所有记录都有该字段
        chartDates = records.map(r => new Date(r.completedAt).toLocaleDateString())
        data = records.map(r => r.accuracy)
        yAxisName = '准确率 (%)'
        break
      case 'wpm': {
        // WPM：仅键盘输入类练习有值，语音类与历史记录为空
        const wpmRecords = records.filter(r => typeof r.wpm === 'number' && (r.wpm as number) > 0)
        chartDates = wpmRecords.map(r => new Date(r.completedAt).toLocaleDateString())
        data = wpmRecords.map(r => Math.round((r.wpm as number) * 10) / 10)
        yAxisName = 'WPM'
        console.debug('[statistics] WPM 进步曲线：有效记录=%d/%d', wpmRecords.length, records.length)
        break
      }
      case 'totalItems': {
        // 题量：仅新采集的记录有值
        const itemRecords = records.filter(r => typeof r.totalItems === 'number' && (r.totalItems as number) > 0)
        chartDates = itemRecords.map(r => new Date(r.completedAt).toLocaleDateString())
        data = itemRecords.map(r => r.totalItems as number)
        yAxisName = '题量'
        console.debug('[statistics] 题量进步曲线：有效记录=%d/%d', itemRecords.length, records.length)
        break
      }
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
        data: chartDates,
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
    const records = await courseRepository.getAllPracticeRecords()
    
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
    const records = await courseRepository.getAllPracticeRecords()
    
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
.load-alert { margin-bottom: 12px; }
.stat-unavailable { display: flex; align-items: center; justify-content: center; min-height: 48px; color: var(--text-color-secondary); font-size: 24px; }
.retry-row { display: flex; justify-content: flex-end; margin-bottom: 12px; }
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
