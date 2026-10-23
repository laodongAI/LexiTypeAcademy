<!--
  学习计划页面

  功能：
  - 计划卡片列表：进度、今日目标、状态、剩余天数
  - 新建/编辑计划：标题、描述、多选课程、每日分钟、起止日期、页面内提醒
  - 计划详情：今日任务（课时任务 + 到期复习 + 自定义任务）、一键开始学习、打卡、历史回顾

  说明：
  - 所有派生数据（进度、今日分钟、课时任务、连续打卡）来自
    GET /api/study-plans/{id}/dashboard，前端不自行计算口径
  - 不引入任何假数据：无计划时展示空状态与创建入口
-->

<template>
  <div class="learning-plans-page">
    <!-- 页面头部：标题与新建入口 -->
    <header class="page-header">
      <div>
        <h2 class="page-title">学习计划</h2>
        <p class="page-subtitle">把课程组织成有目标的学习路径，并按每日任务逐步推进。</p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openCreateDialog">新建计划</el-button>
    </header>

    <!-- 状态筛选 -->
    <div v-if="plans.length > 0" class="filter-bar">
      <el-radio-group v-model="statusFilter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">进行中</el-radio-button>
        <el-radio-button value="paused">已暂停</el-radio-button>
        <el-radio-button value="completed">已完成</el-radio-button>
      </el-radio-group>
    </div>

    <!-- 加载态 -->
    <el-skeleton v-if="loading" :rows="6" animated />

    <!-- 空状态 -->
    <el-empty v-else-if="plans.length === 0" description="还没有学习计划，先创建第一个计划吧">
      <el-button type="primary" @click="openCreateDialog">新建计划</el-button>
    </el-empty>

    <!-- 主体：左侧计划列表，右侧选中计划详情 -->
    <div v-else class="plans-layout">
      <!-- 计划卡片列表 -->
      <section class="plan-list">
        <el-empty
          v-if="filteredPlans.length === 0"
          description="当前筛选条件下没有计划"
          :image-size="80"
        />

        <el-card
          v-for="plan in filteredPlans"
          :key="plan.id"
          class="plan-card"
          :class="{ 'plan-card-active': selectedPlanId === plan.id }"
          shadow="hover"
          @click="selectPlan(plan.id)"
        >
          <div class="plan-card-header">
            <h3 class="plan-card-title">{{ plan.title }}</h3>
            <el-tag :type="statusTagType(plan.status)" size="small" effect="plain">
              {{ statusText(plan.status) }}
            </el-tag>
          </div>

          <p v-if="plan.description" class="plan-card-desc">{{ plan.description }}</p>

          <!-- 进度：来自看板聚合 -->
          <template v-if="dashboards[plan.id]">
            <el-progress
              :percentage="dashboards[plan.id].progress.percentage"
              :stroke-width="8"
              :color="progressColor"
            />
            <div class="plan-card-meta">
              <span>
                课时 {{ dashboards[plan.id].progress.completedLessons }} /
                {{ dashboards[plan.id].progress.totalLessons }}
              </span>
              <span>
                今日 {{ dashboards[plan.id].today.minutes }} /
                {{ dashboards[plan.id].today.goalMinutes }} 分钟
              </span>
            </div>
          </template>
          <div v-else class="plan-card-meta">
            <span>暂无进度数据</span>
          </div>

          <div class="plan-card-footer">
            <span class="plan-card-courses">{{ courseNamesOf(plan) }}</span>
            <span v-if="dashboards[plan.id]?.plan.remainingDays !== null && dashboards[plan.id]?.plan.remainingDays !== undefined">
              剩余 {{ dashboards[plan.id].plan.remainingDays }} 天
            </span>
          </div>
        </el-card>
      </section>

      <!-- 选中计划详情 -->
      <section v-if="currentDashboard" class="plan-detail">
        <!-- 页面内提醒横幅 -->
        <el-alert
          v-if="currentDashboard.reminder"
          :title="currentDashboard.reminder.message"
          type="warning"
          :closable="false"
          show-icon
          class="reminder-alert"
        />

        <!-- 详情头部与操作 -->
        <el-card class="detail-card" shadow="never">
          <div class="detail-header">
            <div>
              <h3 class="detail-title">{{ currentDashboard.plan.title }}</h3>
              <p class="detail-subtitle">
                {{ courseNamesOf(currentDashboard.plan) }} ·
                每日目标 {{ currentDashboard.plan.dailyMinutes }} 分钟
              </p>
            </div>
            <el-space :size="8">
              <el-button size="small" @click="openEditDialog(currentDashboard.plan)">
                编辑
              </el-button>
              <el-button
                size="small"
                @click="togglePlanStatus(currentDashboard.plan)"
              >
                {{ currentDashboard.plan.status === 'paused' ? '恢复' : '暂停' }}
              </el-button>
              <el-button size="small" type="danger" plain @click="removePlan(currentDashboard.plan)">
                删除
              </el-button>
            </el-space>
          </div>

          <!-- 今日与长期指标 -->
          <div class="metric-grid">
            <div class="metric-item">
              <span class="metric-label">今日学习</span>
              <span class="metric-value">
                {{ currentDashboard.today.minutes }}
                <small>/ {{ currentDashboard.today.goalMinutes }} 分钟</small>
              </span>
              <el-progress
                :percentage="Math.min(currentDashboard.today.goalPercent, 100)"
                :show-text="false"
                :stroke-width="6"
                :color="progressColor"
              />
            </div>
            <div class="metric-item">
              <span class="metric-label">连续打卡</span>
              <span class="metric-value">{{ currentDashboard.streakDays }} <small>天</small></span>
            </div>
            <div class="metric-item">
              <span class="metric-label">近 7 天完成率</span>
              <span class="metric-value">
                {{ Math.round(currentDashboard.weekCompletionRate * 100) }} <small>%</small>
              </span>
            </div>
            <div class="metric-item">
              <span class="metric-label">到期复习</span>
              <span class="metric-value">{{ currentDashboard.dueReviewCount }} <small>词</small></span>
            </div>
          </div>
        </el-card>

        <!-- 课程进度 -->
        <el-card class="detail-card" shadow="never">
          <template #header>
            <div class="section-header">
              <span class="section-title">课程进度</span>
              <span class="section-hint">
                已完成 {{ currentDashboard.progress.completedLessons }} /
                {{ currentDashboard.progress.totalLessons }} 课时
              </span>
            </div>
          </template>

          <el-empty
            v-if="currentDashboard.progress.courses.length === 0"
            description="计划尚未关联课程"
            :image-size="64"
          >
            <el-button size="small" @click="openEditDialog(currentDashboard.plan)">
              关联课程
            </el-button>
          </el-empty>

          <div v-else class="course-progress-list">
            <div
              v-for="course in currentDashboard.progress.courses"
              :key="course.courseId"
              class="course-progress-item"
            >
              <div class="course-progress-head">
                <span class="course-progress-title">{{ course.title }}</span>
                <span class="course-progress-count">
                  {{ course.completedLessons }} / {{ course.totalLessons }}
                </span>
              </div>
              <el-progress
                :percentage="course.percentage"
                :stroke-width="6"
                :color="progressColor"
              />
            </div>
          </div>
        </el-card>

        <!-- 今日任务 -->
        <el-card class="detail-card" shadow="never">
          <template #header>
            <div class="section-header">
              <span class="section-title">今日任务</span>
              <span class="section-hint">{{ todayTaskSummary }}</span>
            </div>
          </template>

          <!-- 课时任务（派生） -->
          <div class="task-block">
            <h4 class="task-block-title">待学课时</h4>
            <el-empty
              v-if="currentDashboard.lessonTasks.length === 0"
              description="当前计划没有待学课时"
              :image-size="48"
            />
            <div v-else class="task-list">
              <div
                v-for="task in currentDashboard.lessonTasks"
                :key="task.lessonId"
                class="task-item"
              >
                <div class="task-main">
                  <span class="task-title">{{ task.lessonTitle }}</span>
                  <span class="task-sub">{{ task.courseTitle }}</span>
                </div>
                <el-button
                  type="primary"
                  size="small"
                  plain
                  :icon="VideoPlay"
                  @click="startLesson(task)"
                >
                  开始学习
                </el-button>
              </div>
            </div>
          </div>

          <!-- 到期复习入口 -->
          <div class="task-block">
            <h4 class="task-block-title">到期复习</h4>
            <div class="task-item">
              <div class="task-main">
                <span class="task-title">{{ currentDashboard.dueReviewCount }} 个单词待复习</span>
                <span class="task-sub">
                  今日已复习 {{ currentDashboard.today.reviewCount }} 个
                </span>
              </div>
              <el-button
                size="small"
                :icon="RefreshRight"
                :disabled="currentDashboard.dueReviewCount === 0"
                @click="goReview"
              >
                去复习
              </el-button>
            </div>
          </div>

          <!-- 自定义任务 -->
          <div class="task-block">
            <h4 class="task-block-title">自定义任务</h4>
            <el-empty
              v-if="currentDashboard.customTasks.length === 0"
              description="还没有自定义任务，可添加每天重复的小目标"
              :image-size="48"
            />
            <div v-else class="task-list">
              <div
                v-for="task in currentDashboard.customTasks"
                :key="task.id"
                class="task-item"
              >
                <el-checkbox
                  :model-value="task.doneToday"
                  class="task-checkbox"
                  @change="toggleTaskDone(task, Boolean($event))"
                >
                  <span :class="{ 'task-done': task.doneToday }">{{ task.title }}</span>
                </el-checkbox>
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="removeTask(task)"
                >
                  删除
                </el-button>
              </div>
            </div>

            <!-- 新增自定义任务 -->
            <div class="task-add-row">
              <el-input
                v-model="newTaskTitle"
                placeholder="例如：每天背 10 个新单词"
                maxlength="120"
                clearable
                @keyup.enter="addTask"
              />
              <el-button type="primary" plain :disabled="!newTaskTitle.trim()" @click="addTask">
                添加
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 打卡与历史回顾 -->
        <el-card class="detail-card" shadow="never">
          <template #header>
            <div class="section-header">
              <span class="section-title">打卡与回顾</span>
              <el-button
                type="success"
                size="small"
                :disabled="currentDashboard.today.checkedIn"
                @click="openCheckinDialog"
              >
                {{ currentDashboard.today.checkedIn ? '今日已打卡' : '今日打卡' }}
              </el-button>
            </div>
          </template>

          <el-empty
            v-if="currentDashboard.recentCheckins.length === 0"
            description="还没有打卡记录"
            :image-size="64"
          />

          <div v-else class="checkin-list">
            <div
              v-for="item in currentDashboard.recentCheckins"
              :key="item.id"
              class="checkin-item"
            >
              <div class="checkin-date">{{ formatDate(item.checkinDate) }}</div>
              <div class="checkin-metrics">
                <span>{{ item.minutes }} 分钟</span>
                <span>课时 {{ item.lessonCount }}</span>
                <span>任务 {{ item.customTaskCount }}</span>
                <span>复习 {{ item.reviewCount }}</span>
              </div>
              <div v-if="item.note" class="checkin-note">{{ item.note }}</div>
            </div>
          </div>
        </el-card>
      </section>
    </div>

    <!-- 新建/编辑计划对话框 -->
    <el-dialog
      v-model="planDialogVisible"
      :title="editingPlanId ? '编辑学习计划' : '新建学习计划'"
      width="560px"
      destroy-on-close
    >
      <el-form label-width="96px" label-position="right">
        <el-form-item label="计划标题" required>
          <el-input v-model="planForm.title" maxlength="120" placeholder="例如：30 天英语入门" />
        </el-form-item>
        <el-form-item label="计划描述">
          <el-input
            v-model="planForm.description"
            type="textarea"
            :rows="2"
            maxlength="300"
            placeholder="可选，说明计划目的"
          />
        </el-form-item>
        <el-form-item label="关联课程">
          <el-select
            v-model="planForm.courseIds"
            multiple
            filterable
            collapse-tags
            collapse-tags-tooltip
            placeholder="选择计划包含的课程（可多选）"
            :disabled="courses.length === 0"
            class="full-width"
          >
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="course.title"
              :value="course.id"
            />
          </el-select>
          <div v-if="courses.length === 0" class="form-hint">
            暂无课程，请先在“课程仓库”创建课程
          </div>
        </el-form-item>
        <el-form-item label="每日目标">
          <el-input-number
            v-model="planForm.dailyMinutes"
            :min="5"
            :max="600"
            :step="5"
            controls-position="right"
          />
          <span class="form-unit">分钟</span>
        </el-form-item>
        <el-form-item label="开始日期" required>
          <el-date-picker
            v-model="planForm.startAt"
            type="date"
            placeholder="选择开始日期"
            class="full-width"
          />
        </el-form-item>
        <el-form-item label="目标日期">
          <el-date-picker
            v-model="planForm.targetAt"
            type="date"
            placeholder="可选，计划希望完成的日期"
            class="full-width"
          />
        </el-form-item>
        <el-form-item label="页面内提醒">
          <el-switch v-model="planForm.reminderEnabled" />
          <span class="form-hint inline">今日未达标时在页面内提示</span>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="planDialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="savingPlan" @click="savePlan">
          {{ editingPlanId ? '保存修改' : '创建计划' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 打卡对话框 -->
    <el-dialog v-model="checkinDialogVisible" title="今日打卡" width="420px" destroy-on-close>
      <p class="checkin-tip">
        打卡会把今日学习时长、完成课时数、复习单词数与自定义任务数固化为快照，便于历史回顾。
      </p>
      <el-input
        v-model="checkinNote"
        type="textarea"
        :rows="3"
        maxlength="200"
        show-word-limit
        placeholder="可选：记录今天的学习感受"
      />
      <template #footer>
        <el-button @click="checkinDialogVisible = false">取消</el-button>
        <el-button type="success" :loading="checkingIn" @click="submitCheckin">确认打卡</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
/**
 * 学习计划页面逻辑
 *
 * 数据流：
 * 1. 加载课程（用于计划编辑）与计划列表
 * 2. 并行加载每个计划的看板，供卡片展示真实进度
 * 3. 选中计划后直接复用已加载的看板数据，避免重复请求
 */

import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, VideoPlay, RefreshRight } from '@element-plus/icons-vue'
import { courseRepository } from '../../shared/database/repositories/courseRepository'
import { studyPlanRepository } from '../../shared/database/repositories/studyPlanRepository'
import type { Course } from '../../shared/types/course'
import type {
  PlanDashboard,
  PlanCustomTask,
  PlanLessonTask,
  StudyPlan,
  StudyPlanStatus,
} from '../../shared/types/studyPlan'

const router = useRouter()

/** 计划列表 */
const plans = ref<StudyPlan[]>([])
/** 课程列表（计划编辑用） */
const courses = ref<Course[]>([])
/** 计划看板缓存：planId → 看板 */
const dashboards = ref<Record<string, PlanDashboard>>({})
/** 当前选中的计划 ID */
const selectedPlanId = ref<string>('')
/** 列表加载中 */
const loading = ref(true)
/** 状态筛选值 */
const statusFilter = ref<'all' | StudyPlanStatus>('all')
/** 新增自定义任务输入 */
const newTaskTitle = ref('')

/** 计划对话框可见性 */
const planDialogVisible = ref(false)
/** 正在编辑的计划 ID（为空表示新建） */
const editingPlanId = ref<string>('')
/** 保存中 */
const savingPlan = ref(false)

/** 计划表单模型 */
const planForm = ref({
  /** 标题 */
  title: '',
  /** 描述 */
  description: '',
  /** 关联课程 ID 数组 */
  courseIds: [] as string[],
  /** 每日目标分钟 */
  dailyMinutes: 30,
  /** 开始日期 */
  startAt: new Date() as Date | null,
  /** 目标日期 */
  targetAt: null as Date | null,
  /** 页面内提醒开关 */
  reminderEnabled: true,
})

/** 打卡对话框可见性 */
const checkinDialogVisible = ref(false)
/** 打卡备注 */
const checkinNote = ref('')
/** 打卡提交中 */
const checkingIn = ref(false)

/** 进度条颜色（统一为项目主色） */
const progressColor = '#409EFF'

/** 按状态筛选后的计划列表 */
const filteredPlans = computed<StudyPlan[]>(() => {
  if (statusFilter.value === 'all') return plans.value
  return plans.value.filter((plan) => plan.status === statusFilter.value)
})

/** 当前选中计划的看板 */
const currentDashboard = computed<PlanDashboard | undefined>(
  () => dashboards.value[selectedPlanId.value]
)

/** 今日任务摘要文案 */
const todayTaskSummary = computed<string>(() => {
  const dashboard = currentDashboard.value
  if (!dashboard) return ''
  return `课时 ${dashboard.lessonTasks.length} 个 · 复习 ${dashboard.dueReviewCount} 词 · 自定义 ${dashboard.today.customTaskDone}/${dashboard.today.customTaskTotal}`
})

/**
 * 状态 → 中文文案
 * @param status 计划状态
 */
function statusText(status: StudyPlanStatus): string {
  const map: Record<StudyPlanStatus, string> = {
    active: '进行中',
    paused: '已暂停',
    completed: '已完成',
  }
  return map[status] ?? status
}

/**
 * 状态 → 标签类型
 * @param status 计划状态
 */
function statusTagType(status: StudyPlanStatus): 'success' | 'info' | 'warning' {
  const map: Record<StudyPlanStatus, 'success' | 'info' | 'warning'> = {
    active: 'success',
    paused: 'warning',
    completed: 'info',
  }
  return map[status] ?? 'info'
}

/**
 * 拼接计划关联课程名称
 * @param plan 计划（或看板计划）
 */
function courseNamesOf(plan: StudyPlan): string {
  const ids: string[] = plan.courseIds ?? []
  if (ids.length === 0) return '未关联课程'
  const names: string[] = ids.map(
    (id) => courses.value.find((course) => course.id === id)?.title ?? id
  )
  return names.slice(0, 2).join('、') + (names.length > 2 ? ` 等 ${names.length} 门` : '')
}

/**
 * 毫秒时间戳 → YYYY-MM-DD
 * @param timestamp 毫秒时间戳
 */
function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/**
 * 把日期对象归一化为当天零点毫秒时间戳
 * @param date 日期对象
 */
function toDayStart(date: Date): number {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  return normalized.getTime()
}

/**
 * 加载课程列表（计划编辑用）
 */
async function loadCourses(): Promise<void> {
  try {
    courses.value = await courseRepository.getAllCourses()
  } catch (error) {
    console.error('[学习计划] 课程列表加载失败', error)
    ElMessage.error('课程列表加载失败，请确认后端服务已启动')
  }
}

/**
 * 加载计划列表与各计划看板
 */
async function loadPlans(): Promise<void> {
  loading.value = true
  try {
    const list: StudyPlan[] = await studyPlanRepository.listPlans()

    // 并行加载看板：单个失败不影响其它计划展示
    const results = await Promise.all(
      list.map(async (plan) => {
        try {
          return [plan.id, await studyPlanRepository.getDashboard(plan.id)] as const
        } catch (error) {
          console.error(`[学习计划] 看板加载失败：${plan.id}`, error)
          return [plan.id, null] as const
        }
      })
    )

    const map: Record<string, PlanDashboard> = {}
    for (const [planId, dashboard] of results) {
      if (dashboard) map[planId] = dashboard
    }
    dashboards.value = map
    plans.value = list

    // 保持选中项有效：优先保留原选择，否则选中第一个计划
    if (list.length > 0 && !list.some((plan) => plan.id === selectedPlanId.value)) {
      selectedPlanId.value = list[0].id
    }
    if (list.length === 0) selectedPlanId.value = ''
  } catch (error) {
    console.error('[学习计划] 列表加载失败', error)
    ElMessage.error('学习计划加载失败，请确认后端服务已启动')
  } finally {
    loading.value = false
  }
}

/**
 * 选中计划
 * @param planId 计划 ID
 */
function selectPlan(planId: string): void {
  selectedPlanId.value = planId
  newTaskTitle.value = ''
}

/**
 * 打开新建计划对话框
 */
function openCreateDialog(): void {
  editingPlanId.value = ''
  planForm.value = {
    title: '',
    description: '',
    courseIds: [],
    dailyMinutes: 30,
    startAt: new Date(),
    targetAt: null,
    reminderEnabled: true,
  }
  planDialogVisible.value = true
}

/**
 * 打开编辑计划对话框
 * @param plan 计划
 */
function openEditDialog(plan: StudyPlan): void {
  editingPlanId.value = plan.id
  planForm.value = {
    title: plan.title,
    description: plan.description ?? '',
    courseIds: [...plan.courseIds],
    dailyMinutes: plan.dailyMinutes,
    startAt: new Date(plan.startAt),
    targetAt: plan.targetAt ? new Date(plan.targetAt) : null,
    reminderEnabled: plan.reminderEnabled,
  }
  planDialogVisible.value = true
}

/**
 * 保存计划（新建或更新）
 */
async function savePlan(): Promise<void> {
  const title: string = planForm.value.title.trim()
  if (!title) {
    ElMessage.warning('请填写计划标题')
    return
  }
  if (!planForm.value.startAt) {
    ElMessage.warning('请选择开始日期')
    return
  }

  savingPlan.value = true
  try {
    const startAt: number = toDayStart(planForm.value.startAt)
    const targetAt: number | null = planForm.value.targetAt
      ? toDayStart(planForm.value.targetAt)
      : null

    if (editingPlanId.value) {
      await studyPlanRepository.updatePlan(editingPlanId.value, {
        title,
        description: planForm.value.description.trim() || null,
        courseIds: planForm.value.courseIds,
        dailyMinutes: planForm.value.dailyMinutes,
        startAt,
        targetAt,
        reminderEnabled: planForm.value.reminderEnabled,
      })
      ElMessage.success('计划已更新')
    } else {
      const created: StudyPlan = await studyPlanRepository.createPlan({
        title,
        description: planForm.value.description.trim() || null,
        courseIds: planForm.value.courseIds,
        dailyMinutes: planForm.value.dailyMinutes,
        startAt,
        targetAt,
        reminderEnabled: planForm.value.reminderEnabled,
      })
      selectedPlanId.value = created.id
      ElMessage.success('计划已创建')
    }

    planDialogVisible.value = false
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 保存失败', error)
    ElMessage.error('计划保存失败，请稍后重试')
  } finally {
    savingPlan.value = false
  }
}

/**
 * 暂停/恢复计划
 * @param plan 计划
 */
async function togglePlanStatus(plan: StudyPlan): Promise<void> {
  const nextStatus: StudyPlanStatus = plan.status === 'paused' ? 'active' : 'paused'
  try {
    await studyPlanRepository.updatePlan(plan.id, { status: nextStatus })
    ElMessage.success(nextStatus === 'paused' ? '计划已暂停' : '计划已恢复')
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 状态切换失败', error)
    ElMessage.error('状态切换失败')
  }
}

/**
 * 删除计划（含二次确认）
 * @param plan 计划
 */
async function removePlan(plan: StudyPlan): Promise<void> {
  try {
    await ElMessageBox.confirm(
      `删除“${plan.title}”后，其自定义任务与打卡记录会一并删除，学习记录不受影响。`,
      '删除学习计划',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' }
    )
  } catch {
    // 用户取消，无需处理
    return
  }

  try {
    await studyPlanRepository.deletePlan(plan.id)
    ElMessage.success('计划已删除')
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 删除失败', error)
    ElMessage.error('计划删除失败')
  }
}

/**
 * 新增自定义每日任务（每天重复）
 */
async function addTask(): Promise<void> {
  const title: string = newTaskTitle.value.trim()
  if (!title || !selectedPlanId.value) return

  try {
    await studyPlanRepository.createTask({
      planId: selectedPlanId.value,
      title,
      dueDate: null,
    })
    newTaskTitle.value = ''
    ElMessage.success('任务已添加')
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 任务添加失败', error)
    ElMessage.error('任务添加失败')
  }
}

/**
 * 切换自定义任务完成态
 * @param task 任务
 * @param done 是否完成
 */
async function toggleTaskDone(task: PlanCustomTask, done: boolean): Promise<void> {
  try {
    // doneAt 落在今日区间即视为今日完成，取消完成时置空
    await studyPlanRepository.updateTask(task.id, { doneAt: done ? Date.now() : null })
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 任务状态更新失败', error)
    ElMessage.error('任务状态更新失败')
  }
}

/**
 * 删除自定义任务
 * @param task 任务
 */
async function removeTask(task: PlanCustomTask): Promise<void> {
  try {
    await studyPlanRepository.deleteTask(task.id)
    ElMessage.success('任务已删除')
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 任务删除失败', error)
    ElMessage.error('任务删除失败')
  }
}

/**
 * 开始学习某个课时
 * @param task 课时任务
 */
function startLesson(task: PlanLessonTask): void {
  router.push({
    path: `/lessons/${encodeURIComponent(task.lessonId)}/practice`,
    query: { courseId: task.courseId },
  })
}

/**
 * 跳转到复习页
 */
function goReview(): void {
  router.push('/review')
}

/**
 * 打开打卡对话框
 */
function openCheckinDialog(): void {
  checkinNote.value = ''
  checkinDialogVisible.value = true
}

/**
 * 提交今日打卡（指标由后端按当日数据固化）
 */
async function submitCheckin(): Promise<void> {
  if (!selectedPlanId.value) return

  checkingIn.value = true
  try {
    await studyPlanRepository.checkin(selectedPlanId.value, checkinNote.value.trim() || undefined)
    checkinDialogVisible.value = false
    ElMessage.success('打卡成功')
    await loadPlans()
  } catch (error) {
    console.error('[学习计划] 打卡失败', error)
    ElMessage.error('打卡失败，请稍后重试')
  } finally {
    checkingIn.value = false
  }
}

// 页面挂载：并行加载课程与计划
onMounted(async () => {
  await Promise.all([loadCourses(), loadPlans()])
})
</script>

<style lang="scss" scoped>
.learning-plans-page {
  max-width: 1180px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 16px;
  margin-bottom: 16px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 32px;
  font-weight: 300;
  letter-spacing: -0.02em;
  color: var(--text-color);
}

.page-subtitle {
  margin: 0;
  font-size: 15px;
  font-weight: 300;
  color: var(--text-color-secondary);
}

.filter-bar {
  margin-bottom: 16px;
}

.plans-layout {
  display: grid;
  grid-template-columns: minmax(280px, 360px) 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 960px) {
  .plans-layout {
    grid-template-columns: 1fr;
  }
}

.plan-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plan-card {
  cursor: pointer;
  transition: border-color 0.2s ease;
  border: 1px solid var(--border-color-light);
}

.plan-card-active {
  border-color: var(--el-color-primary);
}

.plan-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.plan-card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color);
}

.plan-card-desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--text-color-secondary);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.plan-card-meta {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.plan-card-footer {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.plan-card-courses {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 70%;
}

.plan-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reminder-alert {
  border-radius: 8px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.detail-title {
  margin: 0 0 6px;
  font-size: 20px;
  font-weight: 500;
  color: var(--text-color);
}

.detail-subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-top: 16px;
}

@media (max-width: 720px) {
  .metric-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.metric-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.metric-label {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.metric-value {
  font-size: 20px;
  font-weight: 500;
  color: var(--text-color);
}

.metric-value small {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-color-secondary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
}

.section-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.course-progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.course-progress-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
  font-size: 13px;
  color: var(--text-color);
}

.course-progress-count {
  color: var(--text-color-secondary);
}

.task-block {
  margin-bottom: 18px;
}

.task-block:last-child {
  margin-bottom: 0;
}

.task-block-title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color-secondary);
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
}

.task-main {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.task-title {
  font-size: 14px;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.task-sub {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.task-done {
  text-decoration: line-through;
  color: var(--text-color-secondary);
}

.task-checkbox {
  min-width: 0;
}

.task-add-row {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.checkin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.checkin-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--el-fill-color-lighter);
  font-size: 13px;
}

.checkin-date {
  font-weight: 500;
  color: var(--text-color);
}

.checkin-metrics {
  display: flex;
  gap: 12px;
  color: var(--text-color-secondary);
}

.checkin-note {
  flex-basis: 100%;
  font-size: 12px;
  color: var(--text-color-secondary);
}

.checkin-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-color-secondary);
}

.full-width {
  width: 100%;
}

.form-hint {
  font-size: 12px;
  color: var(--text-color-secondary);
}

.form-hint.inline {
  margin-left: 8px;
}

.form-unit {
  margin-left: 8px;
  font-size: 13px;
  color: var(--text-color-secondary);
}
</style>
