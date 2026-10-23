<!--
  自适应学习推荐组件
  
  根据用户的：
  - 错误数据（错误率、错误分类）
  - 掌握度数据
  - 学习历史
  
  动态生成个性化推荐
-->

<template>
  <el-card class="adaptive-recommendations">
    <template #header>
      <div class="card-header">
        <span class="title">🎯 智能学习建议</span>
        <el-button text size="small" @click="dismissRecommendations">
          关闭
        </el-button>
      </div>
    </template>

    <div v-if="recommendations.length === 0" class="empty-state">
      <el-icon :size="48" color="#909399"><CircleCheckFilled /></el-icon>
      <p>你很棒！没有需要改进的地方 🎉</p>
    </div>

    <div v-else class="recommendations-container">
      <div
        v-for="(rec, index) in recommendations"
        :key="index"
        class="recommendation-item"
        :class="`priority-${rec.priority}`"
      >
        <!-- 优先级指示器 -->
        <div class="priority-badge">
          <el-icon v-if="rec.priority === 'high'"><Warning /></el-icon>
          <el-icon v-else-if="rec.priority === 'medium'"><InfoFilled /></el-icon>
          <el-icon v-else><SuccessFilled /></el-icon>
        </div>

        <!-- 推荐内容 -->
        <div class="recommendation-content">
          <h4 class="recommendation-title">{{ rec.title }}</h4>
          <p class="recommendation-desc">{{ rec.description }}</p>
          
          <!-- 元数据 -->
          <div v-if="rec.count" class="recommendation-meta">
            <el-tag type="info">{{ rec.count }} 项待处理</el-tag>
          </div>
        </div>

        <!-- 行动按钮 -->
        <div class="recommendation-actions">
          <el-button
            type="primary"
            size="small"
            @click="handleAction(rec.action)"
          >
            {{ getActionLabel(rec.action) }}
          </el-button>
        </div>
      </div>
    </div>

    <!-- 推荐理由说明 -->
    <div class="recommendations-info">
      <el-alert
        title="💡 推荐如何生成？"
        type="info"
        :closable="false"
        show-icon
      >
        <template #default>
          <div class="info-content">
            <p>✓ 分析你的错误数据，识别薄弱项</p>
            <p>✓ 计算掌握度，推荐高价值内容</p>
            <p>✓ 基于 SRS 算法的最优复习时机</p>
          </div>
        </template>
      </el-alert>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import {
  CircleCheckFilled,
  Warning,
  InfoFilled,
  SuccessFilled,
} from '@element-plus/icons-vue'

interface Recommendation {
  type: 'remedy' | 'review' | 'course'
  title: string
  description: string
  priority: 'high' | 'medium' | 'low'
  action: string
  icon?: string
  count?: number
  courseId?: string
}

const props = defineProps<{
  recommendations: Recommendation[]
}>()

const emit = defineEmits<{
  'start-practice': [action: string]
}>()

// 获取行动按钮标签
function getActionLabel(action: string): string {
  const labels: Record<string, string> = {
    'remedy-listening': '开始听力训练',
    'remedy-speaking': '开始口语训练',
    'review-errors': '立即复习',
    'continue-course': '继续学习',
  }
  return labels[action] || '开始'
}

// 处理行动
function handleAction(action: string) {
  emit('start-practice', action)
}

// 关闭推荐
function dismissRecommendations() {
  // 可以存储用户偏好，暂时隐藏推荐
}
</script>

<style lang="scss" scoped>
.adaptive-recommendations {
  margin-bottom: 0;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0.02) 100%);
  border: 1px solid rgba(64, 158, 255, 0.1);

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 16px;
      font-weight: 600;
    }
  }
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #909399;

  p {
    margin-top: 12px;
    font-size: 14px;
  }
}

.recommendations-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.recommendation-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  background-color: rgba(255, 255, 255, 0.5);
  border: 1px solid rgba(64, 158, 255, 0.1);
  transition: all 0.3s ease;

  &:hover {
    background-color: rgba(64, 158, 255, 0.05);
    border-color: rgba(64, 158, 255, 0.2);
  }

  &.priority-high {
    background-color: rgba(245, 108, 108, 0.05);
    border-color: rgba(245, 108, 108, 0.2);
  }

  &.priority-medium {
    background-color: rgba(230, 162, 60, 0.05);
    border-color: rgba(230, 162, 60, 0.2);
  }
}

.priority-badge {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background-color: rgba(64, 158, 255, 0.1);
  font-size: 20px;

  .priority-high & {
    background-color: rgba(245, 108, 108, 0.1);
    color: #f56c6c;
  }

  .priority-medium & {
    background-color: rgba(230, 162, 60, 0.1);
    color: #e6a23c;
  }

  .priority-low & {
    background-color: rgba(103, 194, 58, 0.1);
    color: #67c23a;
  }
}

.recommendation-content {
  flex: 1;

  .recommendation-title {
    margin: 0 0 8px;
    font-size: 15px;
    font-weight: 600;
    color: var(--text-color);
  }

  .recommendation-desc {
    margin: 0 0 8px;
    font-size: 13px;
    color: #909399;
  }

  .recommendation-meta {
    display: flex;
    gap: 8px;
  }
}

.recommendation-actions {
  flex-shrink: 0;
}

.recommendations-info {
  margin-top: 16px;

  :deep(.el-alert) {
    background-color: transparent;
    border: 1px solid rgba(64, 158, 255, 0.1);

    .el-alert__title {
      font-weight: 600;
    }
  }

  .info-content {
    font-size: 13px;
    line-height: 1.8;

    p {
      margin: 4px 0;
      color: #606266;
    }
  }
}
</style>
