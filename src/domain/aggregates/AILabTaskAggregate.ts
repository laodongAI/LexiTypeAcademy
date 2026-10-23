/**
 * AI Lab 任务聚合根
 * 
 * 职责：管理 AI Lab 任务的完整生命周期（创建、执行、监控、完成）
 * 不变量：
 *   - 任务状态只能按预定义的流转方向转变
 *   - 任务进度在 0-100 之间
 *   - 完成任务必须有结果数据
 * 
 * 设计文档：5.2 AILabTask 状态机
 */

import { DomainEvent } from '../events/DomainEvent';

/**
 * 任务类型枚举
 */
export enum TaskType {
  CourseGeneration = 'COURSE_GENERATION',
  VocabularyReview = 'VOCABULARY_REVIEW',
  FreeWriting = 'FREE_WRITING',
  PublisherImport = 'PUBLISHER_IMPORT'
}

/**
 * 任务状态枚举
 */
export enum TaskStatus {
  NotStarted = 'NOT_STARTED',
  InProgress = 'IN_PROGRESS',
  Completed = 'COMPLETED',
  Failed = 'FAILED',
  Archived = 'ARCHIVED'
}

/**
 * 任务结果值对象
 */
export class TaskResult {
  private successCount: number;
  private totalCount: number;
  private errorMessage: string | null;
  private outputUri: string | null; // 生成文件的 URI（可选）
  private metadata: Record<string, any>;

  private constructor() {
    this.successCount = 0;
    this.totalCount = 0;
    this.errorMessage = null;
    this.outputUri = null;
    this.metadata = {};
  }

  static createSuccess(
    successCount: number,
    totalCount: number,
    outputUri?: string,
    metadata?: Record<string, any>
  ): TaskResult {
    const result = new TaskResult();
    result.successCount = successCount;
    result.totalCount = totalCount;
    result.outputUri = outputUri || null;
    result.metadata = metadata || {};
    return result;
  }

  static createFailure(
    errorMessage: string,
    successCount: number = 0,
    totalCount: number = 0
  ): TaskResult {
    const result = new TaskResult();
    result.successCount = successCount;
    result.totalCount = totalCount;
    result.errorMessage = errorMessage;
    return result;
  }

  static restore(data: {
    successCount: number;
    totalCount: number;
    errorMessage: string | null;
    outputUri: string | null;
    metadata: Record<string, any>;
  }): TaskResult {
    const result = new TaskResult();
    result.successCount = data.successCount;
    result.totalCount = data.totalCount;
    result.errorMessage = data.errorMessage;
    result.outputUri = data.outputUri;
    result.metadata = data.metadata;
    return result;
  }

  isSuccess(): boolean {
    return this.errorMessage === null && this.successCount === this.totalCount;
  }

  isPartialSuccess(): boolean {
    return this.successCount > 0 && this.successCount < this.totalCount;
  }

  isFailure(): boolean {
    return this.errorMessage !== null;
  }

  getSuccessRate(): number {
    return this.totalCount === 0 ? 0 : (this.successCount / this.totalCount) * 100;
  }

  getErrorMessage(): string | null {
    return this.errorMessage;
  }

  getOutputUri(): string | null {
    return this.outputUri;
  }

  getMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  toJSON() {
    return {
      successCount: this.successCount,
      totalCount: this.totalCount,
      errorMessage: this.errorMessage,
      outputUri: this.outputUri,
      metadata: this.metadata,
      successRate: this.getSuccessRate()
    };
  }
}

/**
 * AI Lab 任务聚合根
 * 
 * 管理任务的完整生命周期：创建 → 执行 → 监控 → 完成/失败 → 归档
 */
export class AILabTaskAggregate {
  private taskId: string;
  private userId: string;
  private taskType: TaskType;
  private status: TaskStatus;
  private progress: number; // 0-100
  private title: string;
  private description: string;
  private createdAt: Date;
  private startedAt: Date | null;
  private completedAt: Date | null;
  private lastUpdatedAt: Date;
  private estimatedDuration: number; // 秒
  private result: TaskResult | null;
  private errorHistory: Array<{ timestamp: Date; message: string }>;
  private retryCount: number;
  private maxRetries: number;
  private metadata: Record<string, any>;
  private domainEvents: DomainEvent[] = [];

  private constructor() {
    this.taskId = '';
    this.userId = '';
    this.taskType = TaskType.CourseGeneration;
    this.status = TaskStatus.NotStarted;
    this.progress = 0;
    this.title = '';
    this.description = '';
    this.createdAt = new Date();
    this.startedAt = null;
    this.completedAt = null;
    this.lastUpdatedAt = new Date();
    this.estimatedDuration = 300;
    this.result = null;
    this.errorHistory = [];
    this.retryCount = 0;
    this.maxRetries = 3;
    this.metadata = {};
  }

  static create(
    taskId: string,
    userId: string,
    taskType: TaskType,
    title: string,
    description: string = '',
    estimatedDuration: number = 300,
    metadata: Record<string, any> = {}
  ): AILabTaskAggregate {
    const task = new AILabTaskAggregate();
    task.taskId = taskId;
    task.userId = userId;
    task.taskType = taskType;
    task.title = title;
    task.description = description;
    task.estimatedDuration = estimatedDuration;
    task.metadata = metadata;
    task.createdAt = new Date();
    task.lastUpdatedAt = new Date();
    return task;
  }

  static restore(data: {
    taskId: string;
    userId: string;
    taskType: TaskType;
    status: TaskStatus;
    progress: number;
    title: string;
    description: string;
    createdAt: string;
    startedAt: string | null;
    completedAt: string | null;
    lastUpdatedAt: string;
    estimatedDuration: number;
    result: any | null;
    errorHistory: Array<{ timestamp: string; message: string }>;
    retryCount: number;
    maxRetries: number;
    metadata: Record<string, any>;
  }): AILabTaskAggregate {
    const task = new AILabTaskAggregate();
    task.taskId = data.taskId;
    task.userId = data.userId;
    task.taskType = data.taskType;
    task.status = data.status;
    task.progress = data.progress;
    task.title = data.title;
    task.description = data.description;
    task.createdAt = new Date(data.createdAt);
    task.startedAt = data.startedAt ? new Date(data.startedAt) : null;
    task.completedAt = data.completedAt ? new Date(data.completedAt) : null;
    task.lastUpdatedAt = new Date(data.lastUpdatedAt);
    task.estimatedDuration = data.estimatedDuration;
    task.result = data.result ? TaskResult.restore(data.result) : null;
    task.errorHistory = data.errorHistory.map(e => ({
      timestamp: new Date(e.timestamp),
      message: e.message
    }));
    task.retryCount = data.retryCount;
    task.maxRetries = data.maxRetries;
    task.metadata = data.metadata;
    return task;
  }

  // ===== 业务方法 =====

  /**
   * 开始任务执行
   */
  start(): void {
    if (this.status !== TaskStatus.NotStarted) {
      throw new Error(`Cannot start task in ${this.status} status`);
    }
    this.status = TaskStatus.InProgress;
    this.startedAt = new Date();
    this.lastUpdatedAt = new Date();
    this.recordDomainEvent({
      eventType: 'AILabTaskStarted',
      taskId: this.taskId,
      userId: this.userId,
      timestamp: new Date()
    });
  }

  /**
   * 更新任务进度
   */
  updateProgress(progress: number): void {
    if (progress < 0 || progress > 100) {
      throw new Error('Progress must be between 0 and 100');
    }
    if (this.status !== TaskStatus.InProgress) {
      throw new Error('Can only update progress for in-progress tasks');
    }
    this.progress = progress;
    this.lastUpdatedAt = new Date();
  }

  /**
   * 任务成功完成
   */
  complete(result: TaskResult): void {
    if (this.status !== TaskStatus.InProgress) {
      throw new Error(`Cannot complete task in ${this.status} status`);
    }
    this.status = TaskStatus.Completed;
    this.progress = 100;
    this.result = result;
    this.completedAt = new Date();
    this.lastUpdatedAt = new Date();
    this.recordDomainEvent({
      eventType: 'AILabTaskCompleted',
      taskId: this.taskId,
      userId: this.userId,
      timestamp: new Date(),
      data: { result: result.toJSON() }
    });
  }

  /**
   * 任务失败
   */
  fail(errorMessage: string): void {
    if (this.status === TaskStatus.Completed || this.status === TaskStatus.Archived) {
      throw new Error(`Cannot fail completed or archived task`);
    }

    this.errorHistory.push({
      timestamp: new Date(),
      message: errorMessage
    });

    // 检查是否还有重试机会
    if (this.retryCount < this.maxRetries && this.status === TaskStatus.InProgress) {
      this.retryCount++;
      this.status = TaskStatus.NotStarted;
      this.progress = 0;
      this.recordDomainEvent({
        eventType: 'AILabTaskRetrying',
        taskId: this.taskId,
        userId: this.userId,
        timestamp: new Date(),
        data: { retryCount: this.retryCount, maxRetries: this.maxRetries }
      });
    } else {
      // 重试次数已用尽，标记为失败
      this.status = TaskStatus.Failed;
      this.completedAt = new Date();
      this.result = TaskResult.createFailure(errorMessage);
      this.recordDomainEvent({
        eventType: 'AILabTaskFailed',
        taskId: this.taskId,
        userId: this.userId,
        timestamp: new Date(),
        data: { errorMessage }
      });
    }

    this.lastUpdatedAt = new Date();
  }

  /**
   * 任务归档
   */
  archive(): void {
    if (this.status !== TaskStatus.Completed && this.status !== TaskStatus.Failed) {
      throw new Error('Can only archive completed or failed tasks');
    }
    this.status = TaskStatus.Archived;
    this.lastUpdatedAt = new Date();
    this.recordDomainEvent({
      eventType: 'AILabTaskArchived',
      taskId: this.taskId,
      userId: this.userId,
      timestamp: new Date()
    });
  }

  /**
   * 获取任务的实时状态概览
   */
  getStatusSummary() {
    const elapsedMs = this.startedAt ? new Date().getTime() - this.startedAt.getTime() : 0;
    const elapsedSeconds = Math.floor(elapsedMs / 1000);
    const estimatedRemainingSeconds = Math.max(
      0,
      Math.floor(this.estimatedDuration * (1 - this.progress / 100))
    );

    return {
      taskId: this.taskId,
      status: this.status,
      progress: this.progress,
      title: this.title,
      elapsedSeconds,
      estimatedRemainingSeconds,
      createdAt: this.createdAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      result: this.result?.toJSON() || null
    };
  }

  /**
   * 可以重试吗？
   */
  canRetry(): boolean {
    return (
      (this.status === TaskStatus.NotStarted || this.status === TaskStatus.Failed) &&
      this.retryCount < this.maxRetries
    );
  }

  /**
   * 重试次数用尽了吗？
   */
  isRetriesExhausted(): boolean {
    return this.retryCount >= this.maxRetries;
  }

  // ===== 访问器 =====

  getTaskId(): string {
    return this.taskId;
  }

  getUserId(): string {
    return this.userId;
  }

  getTaskType(): TaskType {
    return this.taskType;
  }

  getStatus(): TaskStatus {
    return this.status;
  }

  getProgress(): number {
    return this.progress;
  }

  getTitle(): string {
    return this.title;
  }

  getDescription(): string {
    return this.description;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getStartedAt(): Date | null {
    return this.startedAt;
  }

  getCompletedAt(): Date | null {
    return this.completedAt;
  }

  getResult(): TaskResult | null {
    return this.result;
  }

  getErrorHistory(): Array<{ timestamp: Date; message: string }> {
    return [...this.errorHistory];
  }

  getRetryCount(): number {
    return this.retryCount;
  }

  getMetadata(): Record<string, any> {
    return { ...this.metadata };
  }

  // ===== 事件管理 =====

  getDomainEvents(): DomainEvent[] {
    return this.domainEvents;
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  private recordDomainEvent(event: any): void {
    this.domainEvents.push(event as DomainEvent);
  }

  // ===== 序列化 =====

  toJSON() {
    return {
      taskId: this.taskId,
      userId: this.userId,
      taskType: this.taskType,
      status: this.status,
      progress: this.progress,
      title: this.title,
      description: this.description,
      createdAt: this.createdAt.toISOString(),
      startedAt: this.startedAt?.toISOString() || null,
      completedAt: this.completedAt?.toISOString() || null,
      lastUpdatedAt: this.lastUpdatedAt.toISOString(),
      estimatedDuration: this.estimatedDuration,
      result: this.result?.toJSON() || null,
      errorHistory: this.errorHistory.map(e => ({
        timestamp: e.timestamp.toISOString(),
        message: e.message
      })),
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
      metadata: this.metadata
    };
  }
}
