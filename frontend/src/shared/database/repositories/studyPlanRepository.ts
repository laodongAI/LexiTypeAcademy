/**
 * 学习计划数据仓库（HTTP 版）
 *
 * 职责：
 * - 封装学习计划、自定义任务、打卡、看板四组后端接口
 * - 统一生成字符串主键与时间戳，避免调用方重复实现
 *
 * 说明：
 * - 数据全部由后端 SQLite 持久化，前端不再读写 IndexedDB
 * - 今日任务、进度、提醒等派生口径只在后端看板接口计算，此处仅取数
 */

import { apiDelete, apiGet, apiPost, apiPut } from '../../services/apiClient'
import type {
  PlanDashboard,
  StudyPlan,
  StudyPlanCheckin,
  StudyPlanStatus,
  StudyPlanTask,
} from '../../types/studyPlan'

/** 后端列表响应结构：items + total */
interface ListResponse<T> {
  /** 数据条目 */
  items: T[]
  /** 命中总数 */
  total: number
}

/** 新建计划的入参（ID 与时间戳由仓库补齐） */
export interface CreatePlanInput {
  /** 计划标题 */
  title: string
  /** 计划描述 */
  description?: string | null
  /** 关联课程 ID 数组 */
  courseIds: string[]
  /** 每日学习时长目标（分钟） */
  dailyMinutes: number
  /** 计划开始时间（毫秒时间戳） */
  startAt: number
  /** 计划目标完成时间（毫秒时间戳，可空） */
  targetAt?: number | null
  /** 是否开启页面内提醒 */
  reminderEnabled?: boolean
}

/** 新建自定义任务的入参 */
export interface CreateTaskInput {
  /** 所属计划 ID */
  planId: string
  /** 任务标题 */
  title: string
  /** 执行日期（毫秒，可空表示每天重复） */
  dueDate?: number | null
}

/**
 * 生成字符串主键
 * @returns UUID 字符串；浏览器不支持 crypto.randomUUID 时退化为时间戳+随机数
 */
function generateId(): string {
  // 现代浏览器（Chromium 内核）均支持，优先使用标准实现
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

/**
 * 学习计划仓库类
 */
export class StudyPlanRepository {
  /**
   * 查询计划列表
   * @param status 状态过滤，可选
   */
  async listPlans(status?: StudyPlanStatus): Promise<StudyPlan[]> {
    const result = await apiGet<ListResponse<StudyPlan>>('/api/study-plans', { status })
    return result.items
  }

  /**
   * 新建计划
   * @param input 计划入参
   * @returns 创建后的计划
   */
  async createPlan(input: CreatePlanInput): Promise<StudyPlan> {
    const now: number = Date.now()
    return apiPost<StudyPlan>('/api/study-plans', {
      ...input,
      id: generateId(),
      status: 'active' as StudyPlanStatus,
      reminderEnabled: input.reminderEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * 更新计划（部分更新）
   * @param planId 计划 ID
   * @param updates 需要更新的字段
   */
  async updatePlan(
    planId: string,
    updates: Partial<Omit<StudyPlan, 'id' | 'createdAt'>>
  ): Promise<StudyPlan> {
    return apiPut<StudyPlan>(`/api/study-plans/${encodeURIComponent(planId)}`, {
      ...updates,
      updatedAt: Date.now(),
    })
  }

  /**
   * 删除计划（后端级联清理任务与打卡）
   * @param planId 计划 ID
   */
  async deletePlan(planId: string): Promise<void> {
    await apiDelete(`/api/study-plans/${encodeURIComponent(planId)}`)
  }

  /**
   * 读取计划看板（详情页唯一聚合入口）
   * @param planId 计划 ID
   */
  async getDashboard(planId: string): Promise<PlanDashboard> {
    return apiGet<PlanDashboard>(
      `/api/study-plans/${encodeURIComponent(planId)}/dashboard`
    )
  }

  /**
   * 查询计划下的自定义任务
   * @param planId 计划 ID
   * @param date 目标日期（毫秒），可选；提供时只返回当天生效的任务
   */
  async listTasks(planId: string, date?: number): Promise<StudyPlanTask[]> {
    const result = await apiGet<ListResponse<StudyPlanTask>>('/api/study-plan-tasks', {
      planId,
      date,
    })
    return result.items
  }

  /**
   * 新建自定义任务
   * @param input 任务入参
   */
  async createTask(input: CreateTaskInput): Promise<StudyPlanTask> {
    const now: number = Date.now()
    return apiPost<StudyPlanTask>('/api/study-plan-tasks', {
      ...input,
      id: generateId(),
      doneAt: null,
      createdAt: now,
      updatedAt: now,
    })
  }

  /**
   * 更新自定义任务（含标记完成/取消完成）
   * @param taskId 任务 ID
   * @param updates 需要更新的字段
   */
  async updateTask(
    taskId: string,
    updates: Partial<Pick<StudyPlanTask, 'title' | 'dueDate' | 'doneAt'>>
  ): Promise<StudyPlanTask> {
    return apiPut<StudyPlanTask>(
      `/api/study-plan-tasks/${encodeURIComponent(taskId)}`,
      { ...updates, updatedAt: Date.now() }
    )
  }

  /**
   * 删除自定义任务
   * @param taskId 任务 ID
   */
  async deleteTask(taskId: string): Promise<void> {
    await apiDelete(`/api/study-plan-tasks/${encodeURIComponent(taskId)}`)
  }

  /**
   * 查询打卡记录（按日期倒序）
   * @param planId 计划 ID
   * @param limit 返回条数
   */
  async listCheckins(planId: string, limit = 30): Promise<StudyPlanCheckin[]> {
    const result = await apiGet<ListResponse<StudyPlanCheckin>>(
      '/api/study-plan-checkins',
      { planId, limit }
    )
    return result.items
  }

  /**
   * 写入今日打卡快照（同一天重复打卡按覆盖处理）
   * @param planId 计划 ID
   * @param note 打卡备注，可选
   * @param overrides 可选的指标修正值（分钟/课时数等）
   */
  async checkin(
    planId: string,
    note?: string,
    overrides?: Partial<
      Pick<StudyPlanCheckin, 'minutes' | 'lessonCount' | 'customTaskCount' | 'reviewCount'>
    >
  ): Promise<StudyPlanCheckin> {
    return apiPost<StudyPlanCheckin>('/api/study-plan-checkins', {
      planId,
      checkinDate: Date.now(),
      note: note ?? null,
      ...overrides,
    })
  }
}

/** 导出单例实例 */
export const studyPlanRepository = new StudyPlanRepository()
