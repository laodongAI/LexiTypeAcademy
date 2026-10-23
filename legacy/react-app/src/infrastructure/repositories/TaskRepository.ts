/**
 * AI Lab 任务仓储实现
 * 
 * 基于 Dexie IndexedDB 存储 AILabTaskAggregate
 */

import {
  AILabTaskAggregate,
  TaskType,
  TaskStatus
} from '../../domain/aggregates/AILabTaskAggregate';
import { ITaskRepository, ITaskQuery } from '../../domain/repositories/ITaskRepository';
import { getDB } from '../versioning/db';

export class TaskRepository implements ITaskRepository {
  /**
   * 保存或更新任务
   */
  async save(task: AILabTaskAggregate): Promise<void> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const data = task.toJSON();
    await db.aiLabTasks.put({
      id: task.getTaskId(),
      ...data
    });
  }

  /**
   * 按任务 ID 查询任务
   */
  async findById(taskId: string): Promise<AILabTaskAggregate | null> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const record = await db.aiLabTasks.get(taskId);
    if (!record) {
      return null;
    }

    return AILabTaskAggregate.restore(record);
  }

  /**
   * 按用户 ID 查询用户的所有任务
   */
  async findByUserId(userId: string): Promise<AILabTaskAggregate[]> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const records = await db.aiLabTasks.where('userId').equals(userId).toArray();
    return records.map(record => AILabTaskAggregate.restore(record));
  }

  /**
   * 按指定条件查询任务
   */
  async query(criteria: ITaskQuery): Promise<AILabTaskAggregate[]> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    let query = db.aiLabTasks.toCollection();

    // 按用户 ID 过滤
    if (criteria.userId) {
      query = query.filter(task => task.userId === criteria.userId);
    }

    // 按任务类型过滤
    if (criteria.taskType) {
      query = query.filter(task => task.taskType === criteria.taskType);
    }

    // 按状态过滤
    if (criteria.status) {
      query = query.filter(task => task.status === criteria.status);
    }

    // 按时间范围过滤
    if (criteria.createdAfter) {
      query = query.filter(
        task => new Date(task.createdAt) >= criteria.createdAfter!
      );
    }

    if (criteria.createdBefore) {
      query = query.filter(
        task => new Date(task.createdAt) <= criteria.createdBefore!
      );
    }

    // 排序（最新的优先）
    query = query.reverse();

    // 分页
    if (criteria.offset) {
      query = query.offset(criteria.offset);
    }

    if (criteria.limit) {
      query = query.limit(criteria.limit);
    }

    const records = await query.toArray();
    return records.map(record => AILabTaskAggregate.restore(record));
  }

  /**
   * 查询用户的进行中的任务
   */
  async findInProgressTasks(userId: string): Promise<AILabTaskAggregate[]> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const records = await db.aiLabTasks
      .where('userId')
      .equals(userId)
      .filter(task => task.status === TaskStatus.InProgress)
      .toArray();

    return records.map(record => AILabTaskAggregate.restore(record));
  }

  /**
   * 删除指定任务
   */
  async deleteById(taskId: string): Promise<void> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    await db.aiLabTasks.delete(taskId);
  }

  /**
   * 删除用户的所有任务
   */
  async deleteByUserId(userId: string): Promise<void> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    await db.aiLabTasks.where('userId').equals(userId).delete();
  }

  /**
   * 查询所有已归档任务
   */
  async findArchivedTasks(beforeDate?: Date): Promise<AILabTaskAggregate[]> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    let query = db.aiLabTasks
      .filter(task => task.status === TaskStatus.Archived);

    if (beforeDate) {
      query = query.filter(task => new Date(task.createdAt) < beforeDate);
    }

    const records = await query.toArray();
    return records.map(record => AILabTaskAggregate.restore(record));
  }
}
