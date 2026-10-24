<!--
  统计面板组件
  
  展示：
  - 今日统计（练习次数、准确率、时长、连续天数）
  - 掌握度分布（听说读写）
  - 错误分布
  - 周/月趋势
-->

<template>
  <div class="statistics-panel">
    <!-- 今日统计 -->
    <div class="stats-row">
      <el-card class="stat-card">
        <el-statistic
          title="今日练习"
          :value="stats.practiceCount"
          suffix="次"
        >
          <template #prefix>
            <el-icon color="#409EFF"><TrendCharts /></el-icon>
          </template>
        </el-statistic>
      </el-card>

      <el-card class="stat-card">
        <el-statistic
          title="平均准确率"
          :value="stats.avgAccuracy"
          suffix="%"
          :precision="1"
        >
          <template #prefix>
            <el-icon color="#67C23A"><CircleCheck /></el-icon>
          </template>
        </el-statistic>
      </el-card>

      <el-card class="stat-card">
        <el-statistic
          title="练习时长"
          :value="stats.totalMinutes"
          suffix="分钟"
        >
          <template #prefix>
            <el-icon color="#E6A23C"><Timer /></el-icon>
          </template>
        </el-statistic>
      </el-card>

      <el-card class="stat-card">
        <el-statistic
          title="连续练习"
          :value="stats.streakDays"
          suffix="天"
        >
          <template #prefix>
            <el-icon color="#F56C6C"><Trophy /></el-icon>
          </template>
        </el-statistic>
      </el-card>
    </div>

    <!-- 能力分布 -->
    <el-card class="ability-distribution-card">
      <template #header>
        <div class="card-header">
          <span>📊 练习模式准确率</span>
          <span class="stats-caption">近 30 天</span>
        </div>
      </template>

      <div class="ability-grid">
        <div
          v-for="(value, key) in masteryDistribution"
          :key="key"
          class="ability-item"
        >
          <div class="ability-label">{{ getAbilityLabel(key) }}</div>
          <div class="ability-bar">
            <div v-if="value !== null" class="ability-fill" :style="{ width: value + '%' }"></div>
          </div>
          <div class="ability-value">{{ value === null ? '—' : value + '%' }}</div>
        </div>
      </div>

    </el-card>

    <!-- 错误分析 -->
    <el-card class="error-analysis-card">
      <template #header>
        <div class="card-header">
          <span>🔍 错误分析</span>
          <el-button text size="small" @click="openDetailedReport">详细报告 →</el-button>
        </div>
      </template>

      <div class="error-distribution">
        <div
          v-for="(count, type) in errorDistribution"
          :key="type"
          class="error-item"
        >
          <div class="error-label">
            <span>{{ getErrorLabel(type) }}</span>
            <el-tag type="info" size="small">{{ count }}</el-tag>
          </div>
          <el-progress
            :percentage="getErrorPercentage(type, errorDistribution)"
            :color="getErrorColor(type)"
            :show-text="false"
          />
        </div>
      </div>

      <!-- 改进建议 -->
      <div class="improvement-tips">
        <h4>💡 改进建议</h4>
        <ul>
          <li>{{ getImprovementTip(errorDistribution) }}</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import {
  TrendCharts,
  CircleCheck,
  Timer,
  Trophy,
} from '@element-plus/icons-vue'

interface Stats {
  practiceCount: number
  avgAccuracy: number
  totalMinutes: number
  streakDays: number
}

interface MasteryDistribution {
  dictation: number | null
  follow: number | null
  translation: number | null
  imitation: number | null
  [key: string]: number | null
}

interface ErrorDistribution {
  dictation: number
  follow: number
  translation: number
  imitation: number
  [key: string]: number
}

const router = useRouter()

const props = defineProps<{
  stats: Stats
  masteryDistribution: MasteryDistribution
  errorDistribution: ErrorDistribution
}>()

// 获取能力标签
function getAbilityLabel(key: string | number): string {
  const keyStr = String(key)
  const labels: Record<string, string> = {
    dictation: '🎧 听写',
    follow: '🗣️ 跟读',
    translation: '✍️ 翻译',
    imitation: '🎙️ 模仿',
  }
  return labels[keyStr] || keyStr
}

// 获取错误标签
function getErrorLabel(type: string | number): string {
  const typeStr = String(type)
  const labels: Record<string, string> = {
    dictation: '听写错题',
    follow: '跟读错题',
    translation: '翻译错题',
    imitation: '模仿错题',
  }
  return labels[typeStr] || typeStr
}

// 计算错误百分比
function getErrorPercentage(type: string | number, distribution: ErrorDistribution): number {
  const typeStr = String(type)
  const total = Object.values(distribution).reduce((a, b) => a + b, 0)
  return total > 0 ? Math.round((distribution[typeStr] / total) * 100) : 0
}

// 获取错误颜色
function getErrorColor(type: string | number): string {
  const typeStr = String(type)
  const colors: Record<string, string> = {
    dictation: '#AD7BF5',
    follow: '#409EFF',
    translation: '#E6A23C',
    imitation: '#67C23A',
  }
  return colors[typeStr] || '#909399'
}

// 获取改进建议
function openDetailedReport() {
  void router.push({ name: 'Statistics' })
}

function getImprovementTip(distribution: ErrorDistribution): string {
  const total = Object.values(distribution).reduce((sum, value) => sum + value, 0)
  if (total === 0) return '完成练习并提交答案后，这里会显示近 30 天的错题分布。'
  const maxType = Object.entries(distribution).reduce((a, b) =>
    b[1] > a[1] ? b : a
  )[0]
  const tips: Record<string, string> = {
    dictation: '建议先完整听一遍，再按短句听写并对照原文。',
    follow: '建议先听标准示范，再录音回听并针对不清晰的部分重练。',
    translation: '建议先独立完成翻译，再比较标准表达并记录差异。',
    imitation: '建议分句模仿语音节奏，录音回听后再进行一次练习。',
  }
  return tips[maxType] || '继续保持练习，逐步提升能力'
}
</script>

<style lang="scss" scoped>
.statistics-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 16px;

  .stat-card {
    :deep(.el-statistic__head) {
      font-size: 13px;
      color: #909399;
    }

    :deep(.el-statistic__content) {
      font-size: 28px;
      font-weight: 600;
      color: var(--text-color);
    }
  }
}

.ability-distribution-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    span {
      font-weight: 600;
    }
  }
}

.ability-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.ability-item {
  .ability-label {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 8px;
    color: var(--text-color);
  }

  .ability-bar {
    height: 24px;
    background-color: #f5f7fa;
    border-radius: 12px;
    overflow: hidden;
    margin-bottom: 8px;

    .ability-fill {
      height: 100%;
      background: linear-gradient(90deg, #409eff 0%, #66b1ff 100%);
      border-radius: 12px;
      transition: width 0.3s ease;
    }
  }

  .ability-value {
    font-size: 12px;
    color: #909399;
    text-align: right;
  }
}

.level-note {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: #909399;
}

.error-analysis-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;

    span {
      font-weight: 600;
    }
  }
}

.error-distribution {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.error-item {
  .error-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    font-size: 13px;
  }
}

.improvement-tips {
  margin-top: 16px;
  padding: 12px;
  background-color: rgba(64, 158, 255, 0.05);
  border-radius: 8px;
  border-left: 4px solid #409eff;

  h4 {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
  }

  ul {
    margin: 0;
    padding-left: 20px;

    li {
      font-size: 12px;
      color: #606266;
      line-height: 1.6;
    }
  }
}
</style>
