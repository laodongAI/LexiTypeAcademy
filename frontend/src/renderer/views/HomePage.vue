<!--
  首页：从真实持久化学习数据恢复学习，并汇总今日任务、复习建议与学习活动。
-->
<template>
  <div class="home-page">
    <el-card class="welcome-card" shadow="never">
      <div class="welcome-content">
        <div class="welcome-text">
          <h2>欢迎来到 LexiType Academy</h2>
          <p>从一个英语单词、一句表达或一次听说练习开始，稳步积累你的英语能力。</p>
        </div>
        <div class="welcome-actions">
          <el-button type="primary" size="large" @click="navigateTo('/course-repository')">
            <el-icon><Folder /></el-icon>
            浏览英语课程
          </el-button>
          <el-button size="large" @click="navigateTo('/conversation')">
            AI 教学 / 英语面试
          </el-button>
        </div>
      </div>
    </el-card>

    <el-alert
      v-if="loadError"
      class="load-alert"
      type="warning"
      show-icon
      :closable="false"
      title="部分学习数据暂时无法读取"
      :description="loadError"
    />
    <div v-if="loadError && !loading" class="retry-row">
      <el-button size="small" :loading="loading" @click="reloadDashboard">重新加载数据</el-button>
    </div>

    <el-skeleton v-if="loading" :rows="5" animated />

    <template v-else>
      <section class="dashboard-grid">
        <el-card class="resume-card" shadow="never">
          <template #header>
            <div class="card-heading">
              <span>继续学习</span>
              <el-tag v-if="dashboard?.resumeTarget" type="success" effect="plain">已恢复学习位置</el-tag>
            </div>
          </template>
          <template v-if="dashboard?.resumeTarget">
            <h3>{{ dashboard.resumeTarget.courseTitle }}</h3>
            <p class="muted">{{ dashboard.resumeTarget.lessonTitle }}</p>
            <el-progress
              :percentage="dashboard.resumeTarget.completionPercentage"
              :stroke-width="8"
              :show-text="true"
            />
            <p v-if="dashboard.resumeTarget.lastStudiedAt" class="muted last-studied">
              上次学习：{{ formatDate(dashboard.resumeTarget.lastStudiedAt) }}
            </p>
            <el-button type="primary" @click="resumeLearning">
              <el-icon><VideoPlay /></el-icon>
              从上次课时继续
            </el-button>
          </template>
          <el-empty
            v-else
            description="还没有可恢复的未完成课时"
            :image-size="76"
          >
            <el-button type="primary" @click="navigateTo('/course-repository')">选择一门课程</el-button>
          </el-empty>
        </el-card>

        <el-card class="today-card" shadow="never">
          <template #header>
            <div class="card-heading">
              <span>今日学习</span>
              <el-tag v-if="dashboard?.activePlan" effect="plain">{{ dashboard.activePlan.title }}</el-tag>
            </div>
          </template>
          <div class="today-metrics">
            <div class="metric">
              <strong>{{ dashboard?.todayPracticeCount ?? '—' }}</strong>
              <span>今日练习次数</span>
            </div>
            <div class="metric">
              <strong>{{ dashboard?.reviewStats?.reviewedToday ?? '—' }}</strong>
              <span>今日复习词数</span>
            </div>
            <div class="metric">
              <strong>{{ dashboard?.planDashboard?.today.minutes ?? '—' }}</strong>
              <span>计划内学习分钟</span>
            </div>
          </div>
          <p class="muted summary-note">
            统计仅展示已保存的练习、复习和计划记录；未接入的数据不会以估算值填充。
          </p>
          <el-button plain @click="navigateTo('/statistics')">查看学习总结</el-button>
        </el-card>
      </section>

      <section class="section-card">
        <div class="section-heading">
          <div>
            <h3>今天可以做什么</h3>
            <p>优先使用学习计划中真实的待学课时与复习数据。</p>
          </div>
          <el-button text @click="navigateTo('/plans')">管理学习计划 <el-icon><ArrowRight /></el-icon></el-button>
        </div>

        <el-card v-if="dashboard?.planDashboard" shadow="never" class="task-card">
          <div class="task-summary">
            <div>
              <strong>{{ dashboard.planDashboard.plan.title }}</strong>
              <p class="muted">
                今日已学习 {{ dashboard.planDashboard.today.minutes }} /
                {{ dashboard.planDashboard.today.goalMinutes }} 分钟
              </p>
            </div>
            <el-progress
              type="circle"
              :width="64"
              :percentage="Math.min(100, dashboard.planDashboard.today.goalPercent)"
            />
          </div>
          <el-divider />
          <div v-if="dashboard.planDashboard.lessonTasks.length" class="task-list">
            <div v-for="task in dashboard.planDashboard.lessonTasks" :key="task.lessonId" class="task-row">
              <div class="task-copy">
                <strong>{{ task.lessonTitle }}</strong>
                <span class="muted">{{ task.courseTitle }}</span>
              </div>
              <el-button size="small" type="primary" plain @click="openLesson(task.courseId, task.lessonId)">
                开始学习
              </el-button>
            </div>
          </div>
          <el-empty v-else description="计划暂无待学课时" :image-size="64" />
          <div v-if="dashboard.planDashboard.customTasks.length" class="custom-task-list">
            <div v-for="task in dashboard.planDashboard.customTasks" :key="task.id" class="task-row">
              <el-checkbox
                :model-value="task.doneToday"
                @change="toggleCustomTask(task, Boolean($event))"
              >
                <span :class="{ 'task-done': task.doneToday }">{{ task.title }}</span>
              </el-checkbox>
              <el-tag v-if="task.doneToday" size="small" type="success">已完成</el-tag>
            </div>
          </div>
          <div v-else class="custom-task-empty muted">
            还没有自定义今日任务，可在学习计划中添加。
            <el-button link @click="navigateTo('/plans')">添加任务</el-button>
          </div>
          <div class="task-row review-task">
            <div class="task-copy">
              <strong>{{ dashboard.planDashboard.dueReviewCount }} 个单词待复习</strong>
              <span class="muted">根据已保存的间隔复习记录计算</span>
            </div>
            <el-button size="small" :disabled="dashboard.planDashboard.dueReviewCount === 0" @click="navigateTo('/review')">
              去复习
            </el-button>
          </div>
        </el-card>

        <el-card v-else shadow="never" class="task-card">
          <el-empty
            :description="dashboard?.activePlan ? '学习计划看板暂时不可用' : '还没有进行中的学习计划'"
            :image-size="72"
          >
            <el-button type="primary" plain @click="navigateTo('/plans')">
              {{ dashboard?.activePlan ? '重新打开学习计划' : '创建学习计划' }}
            </el-button>
          </el-empty>
        </el-card>
      </section>

      <section class="section-card">
        <div class="section-heading">
          <div>
            <h3>复习建议</h3>
            <p>优先巩固已经加入间隔复习系统、且当前到期的词汇。</p>
          </div>
          <el-button text @click="navigateTo('/review')">进入复习系统 <el-icon><ArrowRight /></el-icon></el-button>
        </div>
        <el-card shadow="never" class="review-card">
          <template v-if="dashboard?.dueWords.length">
            <div class="word-list">
              <div v-for="word in dashboard.dueWords.slice(0, 6)" :key="`${word.source}:${word.word}`" class="word-item">
                <div>
                  <strong>{{ word.word }}</strong>
                  <span class="muted">{{ word.source }}</span>
                </div>
                <el-tag size="small" effect="plain">待复习</el-tag>
              </div>
            </div>
            <el-button type="primary" @click="navigateTo('/review')">开始复习（{{ dashboard.reviewStats?.dueToday ?? dashboard.dueWords.length }}）</el-button>
          </template>
          <el-empty
            v-else
            :description="dashboard?.reviewStats ? '当前没有到期复习词汇' : '复习数据暂不可用'"
            :image-size="64"
          >
            <el-button plain @click="navigateTo('/review')">查看复习系统</el-button>
          </el-empty>
        </el-card>
      </section>

      <section class="learning-start section-card">
        <div class="section-heading">
          <div>
            <h3>从这里开始</h3>
            <p>选择你现在最需要的学习方式。</p>
          </div>
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
            <el-card
              class="action-card"
              shadow="hover"
              role="button"
              tabindex="0"
              @click="navigateTo(action.path)"
              @keydown.enter.prevent="navigateTo(action.path)"
              @keydown.space.prevent="navigateTo(action.path)"
            >
              <el-icon class="action-icon" :size="28">
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
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  Edit,
  Folder,
  MagicStick,
  RefreshRight,
  Trophy,
  User,
  VideoPlay,
} from '@element-plus/icons-vue'
import { learningDashboardService } from '../../shared/services/learningDashboardService'
import { studyPlanRepository } from '../../shared/database/repositories/studyPlanRepository'
import type { PlanCustomTask } from '../../shared/types/studyPlan'
import type { HomeLearningDashboard } from '../../shared/services/learningDashboardService'

const router = useRouter()
const loading = ref(true)
const dashboard = ref<HomeLearningDashboard | null>(null)
const loadError = computed(() => dashboard.value?.warnings.join('；') ?? '')

const quickActions = [
  { path: '/my-learning', title: '我的学习', description: '查看已加入的课程与学习内容。', icon: User },
  { path: '/course-repository', title: '课程仓库', description: '发现课程并选择接下来要学的内容。', icon: Folder },
  { path: '/practice', title: '练习中心', description: '通过练习巩固词汇与语言能力。', icon: Edit },
  { path: '/review', title: '复习系统', description: '巩固已经学习并到期的词汇。', icon: RefreshRight },
  { path: '/ai-tools', title: 'AI 学习工具', description: '使用当前已提供的 AI 辅助能力。', icon: MagicStick },
  { path: '/games', title: '学习游戏', description: '通过互动方式练习英语。', icon: Trophy },
]

function navigateTo(path: string) {
  void router.push(path)
}

function resumeLearning() {
  const target = dashboard.value?.resumeTarget
  if (!target) return
  openLesson(target.courseId, target.lessonId)
}

function openLesson(courseId: string, lessonId: string) {
  void router.push({
    name: 'Classroom',
    params: { lessonId },
    query: { courseId, mode: 'reader' },
  })
}

async function toggleCustomTask(task: PlanCustomTask, done: boolean) {
  const planId = dashboard.value?.activePlan?.id
  if (!planId) return
  try {
    await studyPlanRepository.updateTask(task.id, { doneAt: done ? Date.now() : null })
    const updated = await studyPlanRepository.getDashboard(planId)
    if (dashboard.value) dashboard.value.planDashboard = updated
    ElMessage.success(done ? '今日任务已完成' : '已取消任务完成状态')
  } catch (error) {
    console.error('更新今日任务失败:', error)
    ElMessage.error('任务状态保存失败，请检查本地服务后重试')
  }
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

async function reloadDashboard() {
  loading.value = true
  try {
    dashboard.value = await learningDashboardService.load()
  } catch (error) {
    console.error('加载首页学习看板失败:', error)
    dashboard.value = {
      resumeTarget: null,
      learningCourses: [],
      dueWords: [],
      reviewStats: null,
      todayPracticeCount: null,
      activePlan: null,
      planDashboard: null,
      warnings: ['首页学习数据加载失败，请检查本地后端是否正常运行'],
    }
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void reloadDashboard()
})
</script>

<style lang="scss" scoped>
.home-page {
  width: 100%;
  max-width: 1200px;
  margin: 0 auto;
}
.welcome-card {
  margin-bottom: 24px;
  border: 0;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-color-dark));
  color: #fff;
  :deep(.el-card__body) { padding: 32px; }
}
.welcome-actions { display: flex; flex-wrap: wrap; gap: 10px; }
.welcome-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
}
.welcome-text {
  min-width: 0;
  h2 { margin: 0 0 10px; font-size: 26px; line-height: 1.35; }
  p { max-width: 680px; margin: 0; line-height: 1.7; opacity: 0.92; }
}
.load-alert { margin-bottom: 10px; }
.retry-row { display: flex; justify-content: flex-end; margin-bottom: 16px; }
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  margin-bottom: 28px;
}
.card-heading, .section-heading, .task-summary, .task-row, .word-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}
.card-heading { font-weight: 600; }
.resume-card h3 { margin: 4px 0 8px; font-size: 20px; }
.muted { color: var(--text-color-secondary); font-size: 13px; line-height: 1.6; }
.last-studied { margin: 12px 0; }
.today-metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
.metric { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.metric strong { font-size: 28px; line-height: 1.2; }
.metric span { color: var(--text-color-secondary); font-size: 12px; }
.summary-note { margin: 18px 0; }
.section-card { margin-bottom: 28px; }
.section-heading { margin-bottom: 14px; }
.section-heading h3 { margin: 0 0 6px; font-size: 19px; color: var(--text-color); }
.section-heading p { margin: 0; color: var(--text-color-secondary); font-size: 13px; }
.task-summary { align-items: flex-start; }
.task-summary strong { font-size: 16px; }
.task-summary p { margin: 6px 0 0; }
.task-list { display: flex; flex-direction: column; gap: 10px; }
.task-row { padding: 10px 0; border-bottom: 1px solid var(--border-color-light); }
.task-row:last-child { border-bottom: 0; }
.task-copy { display: flex; flex-direction: column; min-width: 0; gap: 3px; }
.task-copy strong { font-size: 14px; }
.review-task { margin-top: 10px; padding-top: 16px; border-top: 1px solid var(--border-color-light); }
.custom-task-list { display: flex; flex-direction: column; }
.custom-task-empty { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 12px 0; }
.task-done { color: var(--text-color-secondary); text-decoration: line-through; }
.word-list { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
.word-item { padding: 12px; border-radius: 8px; background: var(--el-fill-color-lighter); }
.word-item > div { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.word-item strong { overflow-wrap: anywhere; }
.action-card {
  height: calc(100% - 16px);
  margin-bottom: 16px;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease;
  &:hover { transform: translateY(-2px); }
  &:focus-within { outline: 2px solid var(--primary-color); outline-offset: 2px; }
  :deep(.el-card__body) { display: flex; align-items: flex-start; gap: 14px; min-height: 112px; padding: 20px; }
}
.action-icon { flex: 0 0 auto; color: var(--primary-color); }
.action-copy { flex: 1; min-width: 0; h4 { margin: 2px 0 7px; color: var(--text-color); font-size: 15px; } p { margin: 0; color: var(--text-color-secondary); font-size: 13px; line-height: 1.6; } }
.action-arrow { flex: 0 0 auto; margin-top: 4px; color: var(--text-color-secondary); }
@media (max-width: 760px) {
  .dashboard-grid { grid-template-columns: minmax(0, 1fr); }
  .welcome-card :deep(.el-card__body) { padding: 22px; }
  .welcome-content { align-items: flex-start; flex-direction: column; }
  .welcome-text h2 { font-size: 22px; }
  .today-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .metric strong { font-size: 23px; }
  .word-list { grid-template-columns: minmax(0, 1fr); }
  .section-heading { align-items: flex-start; }
}
</style>
