/**
 * AI Lab 任务中心 - 实现
 * 
 * 功能：
 * 1. 任务队列管理（优先级排序）
 * 2. 并发控制
 * 3. 错误重试（指数退避）
 * 4. 任务暂停/恢复
 * 5. 断点恢复支持
 * 6. 实时进度跟踪
 */

// ============================================================================
// 任务类型定义
// ============================================================================

/**
 * AI Lab 任务类型
 */
export type AILabTaskType = 
  | 'COURSE_GENERATION'   // 课程生成
  | 'AUDIO_TO_COURSE'     // 音频转课程
  | 'TEXTBOOK_IMPORT'     // 教材导入
  | 'WRITING_ANALYSIS';   // 写作分析

/**
 * 任务优先级
 */
export type TaskPriority = 'low' | 'normal' | 'high' | 'critical';

/**
 * 任务状态
 */
export enum TaskStatus {
  QUEUED = 'QUEUED',           // 等待中
  IN_PROGRESS = 'IN_PROGRESS', // 进行中
  PAUSED = 'PAUSED',           // 暂停
  COMPLETED = 'COMPLETED',     // 完成
  FAILED = 'FAILED',           // 失败
  CANCELLED = 'CANCELLED'      // 已取消
}

/**
 * 任务错误信息
 */
export interface TaskError {
  code: string;
  message: string;
  retryCount: number;
  nextRetryAt?: string;
}

/**
 * 任务断点信息
 */
export interface TaskCheckpoint {
  step: number;
  totalSteps: number;
  state: Record<string, any>;
}

/**
 * AI Lab 任务
 */
export interface AILabTask {
  id: string;
  userId: string;
  
  // 任务类型和优先级
  taskType: AILabTaskType;
  priority: TaskPriority;
  
  // 状态管理
  status: TaskStatus;
  progress: number;  // 0-100
  
  // 输入和输出
  input: Record<string, any>;
  output?: Record<string, any>;
  
  // 时间管理
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  
  // 错误处理
  error?: TaskError;
  
  // 断点恢复
  checkpoint?: TaskCheckpoint;
}

/**
 * 任务执行器函数类型
 */
export type TaskExecutor = (
  task: AILabTask,
  onProgress: (progress: number) => void
) => Promise<Record<string, any>>;

/**
 * 任务监听器
 */
export type TaskListener = (task: AILabTask) => void;

// ============================================================================
// 任务中心接口
// ============================================================================

/**
 * 任务中心接口
 */
export interface IAILabTaskCenter {
  // 任务管理
  createTask(
    userId: string,
    taskType: AILabTaskType,
    input: Record<string, any>,
    priority?: TaskPriority
  ): Promise<AILabTask>;
  
  getTask(taskId: string): AILabTask | undefined;
  getAllTasks(userId?: string): AILabTask[];
  
  // 任务控制
  pauseTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;
  cancelTask(taskId: string): Promise<void>;
  
  // 任务执行器注册
  registerExecutor(taskType: AILabTaskType, executor: TaskExecutor): void;
  
  // 事件监听
  addListener(event: 'taskUpdate', listener: TaskListener): void;
  removeListener(event: 'taskUpdate', listener: TaskListener): void;
}

// ============================================================================
// 任务中心实现
// ============================================================================

/**
 * AI Lab 任务中心
 * 管理所有 AI Lab 相关的后台任务
 */
export class AILabTaskCenter implements IAILabTaskCenter {
  private tasks: Map<string, AILabTask> = new Map();
  private queue: string[] = [];
  private activeTaskCount: number = 0;
  private maxConcurrentTasks: number = 3;
  
  private executors: Map<AILabTaskType, TaskExecutor> = new Map();
  private listeners: Set<TaskListener> = new Set();
  
  private static readonly PRIORITY_VALUES: Record<TaskPriority, number> = {
    critical: 0,
    high: 1,
    normal: 2,
    low: 3
  };

  // ============================================================================
  // 任务创建与管理
  // ============================================================================

  /**
   * 创建任务
   */
  async createTask(
    userId: string,
    taskType: AILabTaskType,
    input: Record<string, any>,
    priority: TaskPriority = 'normal'
  ): Promise<AILabTask> {
    const task: AILabTask = {
      id: this.generateTaskId(),
      userId,
      taskType,
      priority,
      status: TaskStatus.QUEUED,
      progress: 0,
      input,
      createdAt: new Date().toISOString()
    };

    this.tasks.set(task.id, task);
    this.enqueueTask(task.id, priority);
    
    console.log(`📋 任务已创建: ${task.id} (${taskType}, ${priority})`);
    this.notifyListeners(task);

    // 尝试启动任务处理
    this.processNextTask();

    return task;
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): AILabTask | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 获取所有任务
   */
  getAllTasks(userId?: string): AILabTask[] {
    const allTasks = Array.from(this.tasks.values());
    if (userId) {
      return allTasks.filter(t => t.userId === userId);
    }
    return allTasks;
  }

  // ============================================================================
  // 任务排队
  // ============================================================================

  /**
   * 将任务加入队列（按优先级排序）
   */
  private enqueueTask(taskId: string, priority: TaskPriority): void {
    const priorityValue = AILabTaskCenter.PRIORITY_VALUES[priority];

    const insertIndex = this.queue.findIndex(id => {
      const existingTask = this.tasks.get(id);
      if (!existingTask) return false;
      return priorityValue < AILabTaskCenter.PRIORITY_VALUES[existingTask.priority];
    });

    if (insertIndex === -1) {
      this.queue.push(taskId);
    } else {
      this.queue.splice(insertIndex, 0, taskId);
    }
  }

  // ============================================================================
  // 任务处理
  // ============================================================================

  /**
   * 处理下一个任务
   */
  private async processNextTask(): Promise<void> {
    // 检查并发限制
    if (this.activeTaskCount >= this.maxConcurrentTasks) {
      return;
    }

    // 检查队列
    if (this.queue.length === 0) {
      return;
    }

    // 获取下一个任务
    const taskId = this.queue.shift();
    if (!taskId) return;

    const task = this.tasks.get(taskId);
    if (!task) return;

    // 检查是否有执行器
    const executor = this.executors.get(task.taskType);
    if (!executor) {
      console.error(`❌ 未找到任务执行器: ${task.taskType}`);
      task.status = TaskStatus.FAILED;
      task.error = {
        code: 'NO_EXECUTOR',
        message: `未找到任务类型 ${task.taskType} 的执行器`,
        retryCount: 0
      };
      this.notifyListeners(task);
      return;
    }

    // 开始执行任务
    this.activeTaskCount++;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date().toISOString();
    this.notifyListeners(task);

    console.log(`▶️ 任务开始执行: ${task.id}`);

    try {
      // 执行任务
      task.output = await executor(task, (progress) => {
        task.progress = progress;
        this.notifyListeners(task);
      });

      // 任务完成
      task.status = TaskStatus.COMPLETED;
      task.progress = 100;
      task.completedAt = new Date().toISOString();
      
      console.log(`✅ 任务完成: ${task.id}`);
    } catch (error: any) {
      // 错误处理
      await this.handleTaskError(task, error);
    } finally {
      this.activeTaskCount--;
      this.notifyListeners(task);
      
      // 继续处理下一个任务
      this.processNextTask();
    }
  }

  /**
   * 处理任务错误（带重试）
   */
  private async handleTaskError(task: AILabTask, error: Error): Promise<void> {
    const retryCount = (task.error?.retryCount || 0) + 1;
    const maxRetries = 3;

    console.error(`❌ 任务执行失败: ${task.id}`, error.message);

    if (retryCount <= maxRetries) {
      // 指数退避重试
      const backoffMs = Math.pow(2, retryCount) * 1000;
      
      task.error = {
        code: 'RETRY',
        message: error.message,
        retryCount,
        nextRetryAt: new Date(Date.now() + backoffMs).toISOString()
      };

      task.status = TaskStatus.QUEUED;
      
      console.log(`🔄 任务将在 ${backoffMs}ms 后重试 (${retryCount}/${maxRetries}): ${task.id}`);

      // 延迟后重新加入队列
      setTimeout(() => {
        this.enqueueTask(task.id, task.priority);
        this.processNextTask();
      }, backoffMs);
    } else {
      // 达到最大重试次数
      task.status = TaskStatus.FAILED;
      task.error = {
        code: 'MAX_RETRIES_EXCEEDED',
        message: `任务失败，已重试 ${maxRetries} 次: ${error.message}`,
        retryCount: maxRetries
      };
      task.completedAt = new Date().toISOString();
      
      console.error(`💀 任务最终失败: ${task.id}`);
    }
  }

  // ============================================================================
  // 任务控制
  // ============================================================================

  /**
   * 暂停任务
   */
  async pauseTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status === TaskStatus.IN_PROGRESS) {
      task.status = TaskStatus.PAUSED;
      this.notifyListeners(task);
      console.log(`⏸️ 任务已暂停: ${taskId}`);
    }
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if (task.status === TaskStatus.PAUSED) {
      task.status = TaskStatus.QUEUED;
      this.enqueueTask(taskId, task.priority);
      this.notifyListeners(task);
      this.processNextTask();
      console.log(`▶️ 任务已恢复: ${taskId}`);
    }
  }

  /**
   * 取消任务
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`);
    }

    if ([TaskStatus.QUEUED, TaskStatus.PAUSED].includes(task.status)) {
      task.status = TaskStatus.CANCELLED;
      task.completedAt = new Date().toISOString();
      
      // 从队列中移除
      const index = this.queue.indexOf(taskId);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      
      this.notifyListeners(task);
      console.log(`🚫 任务已取消: ${taskId}`);
    }
  }

  // ============================================================================
  // 执行器注册
  // ============================================================================

  /**
   * 注册任务执行器
   */
  registerExecutor(taskType: AILabTaskType, executor: TaskExecutor): void {
    this.executors.set(taskType, executor);
    console.log(`📝 任务执行器已注册: ${taskType}`);
  }

  // ============================================================================
  // 事件监听
  // ============================================================================

  /**
   * 添加监听器
   */
  addListener(event: 'taskUpdate', listener: TaskListener): void {
    if (event === 'taskUpdate') {
      this.listeners.add(listener);
    }
  }

  /**
   * 移除监听器
   */
  removeListener(event: 'taskUpdate', listener: TaskListener): void {
    if (event === 'taskUpdate') {
      this.listeners.delete(listener);
    }
  }

  /**
   * 通知所有监听器
   */
  private notifyListeners(task: AILabTask): void {
    this.listeners.forEach(listener => {
      try {
        listener(task);
      } catch (error) {
        console.error('任务监听器执行错误:', error);
      }
    });
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 生成任务 ID
   */
  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 设置最大并发数
   */
  setMaxConcurrentTasks(max: number): void {
    this.maxConcurrentTasks = Math.max(1, max);
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    activeCount: number;
    maxConcurrent: number;
  } {
    return {
      queueLength: this.queue.length,
      activeCount: this.activeTaskCount,
      maxConcurrent: this.maxConcurrentTasks
    };
  }

  /**
   * 清理已完成的任务
   */
  clearCompletedTasks(): void {
    for (const [id, task] of this.tasks.entries()) {
      if ([TaskStatus.COMPLETED, TaskStatus.FAILED, TaskStatus.CANCELLED].includes(task.status)) {
        this.tasks.delete(id);
      }
    }
    console.log('🧹 已清理完成的任务');
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let _instance: AILabTaskCenter | null = null;

/**
 * 获取任务中心实例
 */
export function getAILabTaskCenter(): AILabTaskCenter {
  if (!_instance) {
    _instance = new AILabTaskCenter();
  }
  return _instance;
}
