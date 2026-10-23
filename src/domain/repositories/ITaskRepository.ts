/**
 * AI Lab 任务仓储接口
 * 
 * 职责：管理 AILabTaskAggregate 的持久化、查询和过滤
 * 实现者：使用 Dexie IndexedDB 或其他存储后端
 */

import { AILabTaskAggregate, TaskType, TaskStatus } from '../aggregates/AILabTaskAggregate';

export interface ITaskQuery {
  userId?: string;
  taskType?: TaskType;
  status?: TaskStatus;
  createdAfter?: Date;
  createdBefore?: Date;
  limit?: number;
  offset?: number;
}

export interface ITaskRepository {
  /**
   * 保存或更新任务
   */
  save(task: AILabTaskAggregate): Promise<void>;

  /**
   * 按任务 ID 查询任务
   */
  findById(taskId: string): Promise<AILabTaskAggregate | null>;

  /**
   * 按用户 ID 查询用户的所有任务
   */
  findByUserId(userId: string): Promise<AILabTaskAggregate[]>;

  /**
   * 按指定条件查询任务
   */
  query(criteria: ITaskQuery): Promise<AILabTaskAggregate[]>;

  /**
   * 查询用户的进行中的任务（用于恢复中断任务）
   */
  findInProgressTasks(userId: string): Promise<AILabTaskAggregate[]>;

  /**
   * 删除指定任务
   */
  deleteById(taskId: string): Promise<void>;

  /**
   * 删除用户的所有任务
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * 查询所有已归档任务（用于数据清理）
   */
  findArchivedTasks(beforeDate?: Date): Promise<AILabTaskAggregate[]>;
}
