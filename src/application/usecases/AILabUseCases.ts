/**
 * AI Lab 使用场景
 * 
 * 包含高级业务操作，例如：
 * - 创建和启动任务
 * - 更新学生能力
 * - 推荐课程
 */

import { AILabTaskAggregate, TaskType, TaskStatus } from '../../domain/aggregates/AILabTaskAggregate';
import { LanguageAbilityAggregate } from '../../domain/aggregates/LanguageAbilityAggregate';
import { Accuracy } from '../../shared/value-objects';
import { getAILabContainer } from '../../infrastructure/di/AILabDependencyContainer';
import { generateId } from '../../shared/utils/idUtils';

/**
 * 创建新的 AI Lab 任务
 */
export async function createAILabTask(
  userId: string,
  taskType: TaskType,
  title: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<AILabTaskAggregate> {
  const taskId = generateId();
  const task = AILabTaskAggregate.create(
    taskId,
    userId,
    taskType,
    title,
    description,
    300,
    metadata
  );

  const taskRepository = getAILabContainer().getTaskRepository();
  await taskRepository.save(task);

  return task;
}

/**
 * 启动并执行任务
 */
export async function startAILabTask(
  taskId: string
): Promise<AILabTaskAggregate> {
  const taskRepository = getAILabContainer().getTaskRepository();
  const task = await taskRepository.findById(taskId);

  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  task.start();
  await taskRepository.save(task);

  return task;
}

/**
 * 更新任务进度
 */
export async function updateTaskProgress(
  taskId: string,
  progress: number
): Promise<void> {
  const taskRepository = getAILabContainer().getTaskRepository();
  const task = await taskRepository.findById(taskId);

  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  task.updateProgress(progress);
  await taskRepository.save(task);
}

/**
 * 完成任务
 */
export async function completeAILabTask(
  taskId: string,
  successCount: number,
  totalCount: number,
  outputUri?: string,
  metadata?: Record<string, any>
): Promise<void> {
  const taskRepository = getAILabContainer().getTaskRepository();
  const task = await taskRepository.findById(taskId);

  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  const { TaskResult } = await import('../../domain/aggregates/AILabTaskAggregate');
  const result = TaskResult.createSuccess(successCount, totalCount, outputUri, metadata);
  task.complete(result);
  await taskRepository.save(task);
}

/**
 * 任务失败
 */
export async function failAILabTask(
  taskId: string,
  errorMessage: string
): Promise<void> {
  const taskRepository = getAILabContainer().getTaskRepository();
  const task = await taskRepository.findById(taskId);

  if (!task) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  task.fail(errorMessage);
  await taskRepository.save(task);
}

/**
 * 获取或创建学生语言能力记录
 */
export async function getOrCreateLanguageAbility(
  userId: string
): Promise<LanguageAbilityAggregate> {
  const abilityRepository = getAILabContainer().getLanguageAbilityRepository();
  let ability = await abilityRepository.findByUserId(userId);

  if (!ability) {
    ability = LanguageAbilityAggregate.create(userId);
    await abilityRepository.save(ability);
  }

  return ability;
}

/**
 * 更新学生的学习记录后，自动更新语言能力
 */
export async function updateLanguageAbilityAfterLessonPractice(
  userId: string,
  accuracy: Accuracy,
  completedCourseId?: string
): Promise<LanguageAbilityAggregate> {
  const abilityRepository = getAILabContainer().getLanguageAbilityRepository();
  let ability = await abilityRepository.findByUserId(userId);

  if (!ability) {
    ability = LanguageAbilityAggregate.create(userId);
  }

  ability.updateFromLessonPractice(accuracy, completedCourseId);
  await abilityRepository.save(ability);

  return ability;
}

/**
 * 查询用户的所有进行中的任务
 */
export async function getUserInProgressTasks(
  userId: string
): Promise<AILabTaskAggregate[]> {
  const taskRepository = getAILabContainer().getTaskRepository();
  return await taskRepository.findInProgressTasks(userId);
}

/**
 * 查询用户的任务历史
 */
export async function getUserTaskHistory(
  userId: string,
  limit: number = 20
): Promise<AILabTaskAggregate[]> {
  const taskRepository = getAILabContainer().getTaskRepository();
  return await taskRepository.findByUserId(userId);
}

/**
 * 获取用户语言能力进度报告
 */
export async function getLanguageAbilityProgressReport(
  userId: string
): Promise<any | null> {
  const ability = await getOrCreateLanguageAbility(userId);
  return ability.getProgressReport();
}
