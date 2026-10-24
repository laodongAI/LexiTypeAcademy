<!--
  首页
  以英语学习为中心提供明确的开始入口；仅展示已接入真实数据的学习进度。
-->
<template>
  <div class="home-page">
    <el-card class="welcome-card" shadow="never">
      <div class="welcome-content">
        <div class="welcome-text">
          <h2>欢迎来到 LexiType Academy</h2>
          <p>从一个英语单词、一句表达或一次听说练习开始，稳步积累你的英语能力。</p>
        </div>
        <el-button type="primary" size="large" @click="navigateTo('/course-repository')">
          <el-icon><Folder /></el-icon>
          浏览英语课程
        </el-button>
      </div>
    </el-card>

    <section class="learning-start">
      <div class="section-heading">
        <h3>从这里开始</h3>
        <p>选择你现在最需要的学习方式。</p>
      </div>
      <el-row :gutter="16">
        <el-col
          v-for="action in quickActions"
          :key="action.path"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <el-card class="action-card" shadow="hover" @click="navigateTo(action.path)">
            <el-icon class="action-icon" :size="30">
              <component :is="action.icon" />
            </el-icon>
            <div class="action-copy">
              <h4>{{ action.title }}</h4>
              <p>{{ action.description }}</p>
            </div>
            <el-icon class="action-arrow"><ArrowRight /></el-icon>
          </el-card>
        </el-col>
      </el-row>
    </section>

    <section class="learning-state">
      <el-card shadow="never">
        <el-empty description="首页学习进度正在接入真实学习记录">
          <template #image>
            <el-icon :size="48" class="empty-icon"><Reading /></el-icon>
          </template>
          <p class="empty-help">
            当前不展示虚构的学习天数、词汇数量或课程进度。你可以先进入课程仓库选择内容；
            后续将根据实际学习记录展示继续学习、今日任务和待复习内容。
          </p>
          <el-button type="primary" @click="navigateTo('/course-repository')">
            选择一门课程
          </el-button>
        </el-empty>
      </el-card>
    </section>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Edit,
  Folder,
  MagicStick,
  RefreshRight,
  Reading,
  Trophy,
  User,
} from '@element-plus/icons-vue'

const router = useRouter()

const quickActions = [
  {
    path: '/my-learning',
    title: '我的学习',
    description: '查看已加入的课程与学习内容。',
    icon: User,
  },
  {
    path: '/course-repository',
    title: '课程仓库',
    description: '发现课程并选择接下来要学的内容。',
    icon: Folder,
  },
  {
    path: '/practice',
    title: '练习中心',
    description: '通过练习巩固词汇与语言能力。',
    icon: Edit,
  },
  {
    path: '/review',
    title: '复习系统',
    description: '进入复习流程，巩固已学内容。',
    icon: RefreshRight,
  },
  {
    path: '/ai-tools',
    title: 'AI 学习工具',
    description: '使用当前已提供的 AI 辅助能力。',
    icon: MagicStick,
  },
  {
    path: '/games',
    title: '学习游戏',
    description: '通过互动方式练习英语。',
    icon: Trophy,
  },
]

function navigateTo(path: string) {
  void router.push(path)
}
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  margin-bottom: 28px;
  border: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
  color: #fff;

  :deep(.el-card__body) {
    padding: 32px;
  }
}

.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}

.welcome-text {
  min-width: 0;

  h2 {
    margin: 0 0 10px;
    font-size: 26px;
    line-height: 1.35;
  }

  p {
    max-width: 680px;
    margin: 0;
    line-height: 1.7;
    opacity: 0.92;
  }
}

.learning-start,
.learning-state {
  margin-bottom: 28px;
}

.section-heading {
  margin-bottom: 16px;

  h3 {
    margin: 0 0 6px;
    font-size: 19px;
    color: var(--text-color);
  }

  p {
    margin: 0;
    color: var(--text-color-secondary);
    font-size: 14px;
  }
}

.action-card {
  height: calc(100% - 16px);
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;

  &:hover {
    transform: translateY(-2px);
  }

  &:focus-within {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  :deep(.el-card__body) {
    display: flex;
    align-items: flex-start;
    gap: 14px;
    min-height: 112px;
    padding: 20px;
  }
}

.action-icon {
  flex: 0 0 auto;
  color: var(--primary-color);
}

.action-copy {
  flex: 1;
  min-width: 0;

  h4 {
    margin: 2px 0 7px;
    color: var(--text-color);
    font-size: 15px;
  }

  p {
    margin: 0;
    color: var(--text-color-secondary);
    font-size: 13px;
    line-height: 1.6;
  }
}

.action-arrow {
  flex: 0 0 auto;
  margin-top: 4px;
  color: var(--text-color-secondary);
}

.empty-icon {
  color: var(--text-color-secondary);
}

.empty-help {
  max-width: 560px;
  margin: 0 auto 16px;
  color: var(--text-color-secondary);
  font-size: 14px;
  line-height: 1.8;
  text-align: center;
}

@media (max-width: 640px) {
  .welcome-card {
    :deep(.el-card__body) {
      padding: 22px;
    }
  }

  .welcome-content {
    align-items: flex-start;
    flex-direction: column;
  }

  .welcome-text h2 {
    font-size: 22px;
  }
}
</style>
