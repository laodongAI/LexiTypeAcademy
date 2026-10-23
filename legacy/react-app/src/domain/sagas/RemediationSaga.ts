/**
 * 补偿 Saga 实现
 * Saga 用于协调多个聚合根的业务流程，支持分布式事务和补偿机制
 * 
 * 示例场景：课程学习流程
 * 1. 学生开始练习课程
 * 2. 如果练习不足，触发补偿课程生成
 * 3. 如果失败，回滚之前的操作
 */

import { ISaga } from '../interfaces/IEventSourced';

/**
 * Saga 执行步骤
 */
interface SagaStep {
  name: string;
  action: () => Promise<void>;
  compensation?: () => Promise<void>;
  status: 'pending' | 'completed' | 'failed' | 'compensated';
  error?: Error;
  timestamp: Date;
}

/**
 * Saga 状态
 */
interface SagaState {
  sagaId: string;
  status: 'pending' | 'in-progress' | 'completed' | 'compensating' | 'failed';
  steps: SagaStep[];
  startTime: Date;
  endTime?: Date;
  compensationReason?: string;
  completedSteps: string[];
  failedSteps: string[];
}

/**
 * 补偿 Saga 基类
 * 用于协调多个聚合根的业务流程
 */
export abstract class RemediationSaga implements ISaga {
  protected state: SagaState;
  protected steps: Map<string, SagaStep> = new Map();
  private isCompensating = false;

  constructor(sagaId: string = `saga-${Date.now()}`) {
    this.state = {
      sagaId,
      status: 'pending',
      steps: [],
      startTime: new Date(),
      completedSteps: [],
      failedSteps: [],
    };
  }

  /**
   * 启动 Saga
   * 执行 Saga 的第一步
   */
  async start(startEvent: any): Promise<void> {
    this.state.status = 'in-progress';
    
    try {
      console.log(`启动 Saga: ${this.state.sagaId}`, {
        eventType: startEvent.eventType,
        timestamp: new Date().toISOString(),
      });

      // 处理启动事件
      await this.onStart(startEvent);
    } catch (error) {
      this.state.status = 'failed';
      this.state.failedSteps.push('start');
      console.error(`Saga 启动失败: ${this.state.sagaId}`, error);
      throw error;
    }
  }

  /**
   * 处理 Saga 中间步骤的事件
   */
  async handle(event: any): Promise<void> {
    try {
      console.log(`处理 Saga 事件: ${this.state.sagaId}`, {
        eventType: event.eventType,
        timestamp: new Date().toISOString(),
      });

      await this.onEvent(event);
    } catch (error) {
      console.error(`处理事件失败: ${this.state.sagaId}`, error);
      
      // 触发补偿
      await this.compensate(`事件处理失败: ${error}`);
    }
  }

  /**
   * 完成 Saga
   */
  async complete(): Promise<void> {
    this.state.status = 'completed';
    this.state.endTime = new Date();
    
    console.log(`Saga 完成: ${this.state.sagaId}`, {
      duration: this.state.endTime.getTime() - this.state.startTime.getTime(),
      completedSteps: this.state.completedSteps.length,
    });

    await this.onComplete();
  }

  /**
   * 补偿 Saga（回滚所有已执行的步骤）
   */
  async compensate(reason: string): Promise<void> {
    if (this.isCompensating) {
      return; // 避免重复补偿
    }

    this.isCompensating = true;
    this.state.status = 'compensating';
    this.state.compensationReason = reason;

    console.log(`开始补偿 Saga: ${this.state.sagaId}`, {
      reason,
      completedSteps: this.state.completedSteps,
    });

    // 按逆序补偿已完成的步骤
    for (let i = this.state.completedSteps.length - 1; i >= 0; i--) {
      const stepName = this.state.completedSteps[i];
      const step = this.steps.get(stepName);

      if (step && step.compensation) {
        try {
          console.log(`执行补偿步骤: ${stepName}`);
          await step.compensation();
          step.status = 'compensated';
        } catch (error) {
          console.error(`补偿步骤失败: ${stepName}`, error);
          // 继续补偿其他步骤，即使某个补偿失败
        }
      }
    }

    this.state.status = 'failed';
    this.state.endTime = new Date();

    console.log(`补偿完成: ${this.state.sagaId}`);
  }

  /**
   * 获取 Saga 的当前状态
   */
  getState(): SagaState {
    return { ...this.state };
  }

  /**
   * 注册 Saga 步骤
   */
  protected registerStep(
    name: string,
    action: () => Promise<void>,
    compensation?: () => Promise<void>
  ): void {
    const step: SagaStep = {
      name,
      action,
      compensation,
      status: 'pending',
      timestamp: new Date(),
    };
    
    this.steps.set(name, step);
    this.state.steps.push(step);
  }

  /**
   * 执行已注册的步骤
   */
  protected async executeStep(name: string): Promise<void> {
    const step = this.steps.get(name);
    
    if (!step) {
      throw new Error(`未找到步骤: ${name}`);
    }

    if (step.status !== 'pending') {
      console.warn(`步骤已执行或失败: ${name}, 状态: ${step.status}`);
      return;
    }

    try {
      console.log(`执行步骤: ${name}`);
      await step.action();
      step.status = 'completed';
      this.state.completedSteps.push(name);
    } catch (error) {
      step.status = 'failed';
      step.error = error as Error;
      this.state.failedSteps.push(name);
      throw error;
    }
  }

  /**
   * 抽象方法：处理启动事件
   */
  protected abstract onStart(event: any): Promise<void>;

  /**
   * 抽象方法：处理中间事件
   */
  protected abstract onEvent(event: any): Promise<void>;

  /**
   * 抽象方法：处理完成
   */
  protected abstract onComplete(): Promise<void>;
}

/**
 * 课程学习补偿 Saga 示例
 * 当学生练习不足时，自动生成补偿课程
 */
export class CourseLearningRemediationSaga extends RemediationSaga {
  private courseId: string = '';
  private studentId: string = '';
  private deficiencyLevel: number = 0;
  private remediationCourseId: string = '';

  /**
   * 处理启动事件（练习不足）
   */
  protected async onStart(event: any): Promise<void> {
    // 提取事件数据
    this.courseId = event.payload?.courseId || '';
    this.studentId = event.payload?.studentId || '';
    this.deficiencyLevel = event.payload?.deficiencyLevel || 0;

    // 注册 Saga 步骤
    this.registerStep(
      'analyzeDeficiency',
      async () => {
        // 第1步：分析不足程度
        console.log(`分析学生 ${this.studentId} 的不足情况`, {
          courseId: this.courseId,
          deficiencyLevel: this.deficiencyLevel,
        });
        await this.analyzeDeficiency();
      },
      async () => {
        // 补偿：清除分析结果
        console.log('补偿：清除缺陷分析');
      }
    );

    this.registerStep(
      'createRemediationCourse',
      async () => {
        // 第2步：创建补偿课程
        console.log(`为学生 ${this.studentId} 创建补偿课程`);
        await this.createRemediationCourse();
      },
      async () => {
        // 补偿：删除补偿课程
        console.log(`删除补偿课程 ${this.remediationCourseId}`);
        await this.deleteRemediationCourse();
      }
    );

    this.registerStep(
      'assignRemediationCourse',
      async () => {
        // 第3步：分配补偿课程给学生
        console.log(`分配补偿课程 ${this.remediationCourseId} 给学生 ${this.studentId}`);
        await this.assignRemediationCourse();
      },
      async () => {
        // 补偿：取消分配
        console.log(`取消分配补偿课程给学生 ${this.studentId}`);
        await this.unassignRemediationCourse();
      }
    );

    this.registerStep(
      'notifyStudent',
      async () => {
        // 第4步：通知学生
        console.log(`通知学生 ${this.studentId} 完成补偿课程`);
        await this.notifyStudent();
      },
      async () => {
        // 补偿：撤销通知
        console.log(`撤销对学生 ${this.studentId} 的通知`);
      }
    );

    // 开始执行步骤
    try {
      await this.executeStep('analyzeDeficiency');
      await this.executeStep('createRemediationCourse');
      await this.executeStep('assignRemediationCourse');
      await this.executeStep('notifyStudent');
      await this.complete();
    } catch (error) {
      await this.compensate(`步骤执行失败: ${error}`);
    }
  }

  /**
   * 处理中间事件
   */
  protected async onEvent(event: any): Promise<void> {
    switch (event.eventType) {
      case 'StudentCompletedRemediationEvent':
        console.log(`学生 ${this.studentId} 完成了补偿课程`);
        await this.handleRemediationCompletion(event);
        break;
      case 'RemediationCourseFailedEvent':
        console.log(`学生 ${this.studentId} 的补偿课程失败`);
        await this.compensate('补偿课程失败');
        break;
      default:
        // 忽略其他事件
        break;
    }
  }

  /**
   * 处理完成
   */
  protected async onComplete(): Promise<void> {
    console.log(`课程学习补偿 Saga 完成`, {
      courseId: this.courseId,
      studentId: this.studentId,
      remediationCourseId: this.remediationCourseId,
    });
  }

  /**
   * 私有方法：具体的业务逻辑
   */

  private async analyzeDeficiency(): Promise<void> {
    // 模拟分析缺陷
    return new Promise(resolve => {
      setTimeout(() => {
        console.log('缺陷分析完成');
        resolve();
      }, 100);
    });
  }

  private async createRemediationCourse(): Promise<void> {
    // 模拟创建补偿课程
    this.remediationCourseId = `remedial-${this.courseId}-${this.studentId}-${Date.now()}`;
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`补偿课程创建完成: ${this.remediationCourseId}`);
        resolve();
      }, 100);
    });
  }

  private async assignRemediationCourse(): Promise<void> {
    // 模拟分配课程
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`课程分配完成`);
        resolve();
      }, 100);
    });
  }

  private async unassignRemediationCourse(): Promise<void> {
    // 模拟取消分配
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`课程取消分配完成`);
        resolve();
      }, 100);
    });
  }

  private async deleteRemediationCourse(): Promise<void> {
    // 模拟删除课程
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`补偿课程删除完成`);
        resolve();
      }, 100);
    });
  }

  private async notifyStudent(): Promise<void> {
    // 模拟通知学生
    return new Promise(resolve => {
      setTimeout(() => {
        console.log(`通知已发送`);
        resolve();
      }, 100);
    });
  }

  private async handleRemediationCompletion(event: any): Promise<void> {
    console.log(`处理补偿完成事件`, event);
    await this.complete();
  }
}

/**
 * Saga 管理器
 * 用于创建和管理多个 Saga 实例
 */
export class SagaManager {
  private sagas: Map<string, RemediationSaga> = new Map();

  /**
   * 启动新的 Saga
   */
  async startSaga(sagaType: string, event: any): Promise<string> {
    let saga: RemediationSaga;

    switch (sagaType) {
      case 'CourseLearningRemediation':
        saga = new CourseLearningRemediationSaga();
        break;
      default:
        throw new Error(`未知的 Saga 类型: ${sagaType}`);
    }

    const sagaId = saga.getState().sagaId;
    this.sagas.set(sagaId, saga);

    try {
      await saga.start(event);
    } catch (error) {
      console.error(`Saga 启动失败: ${sagaId}`, error);
      this.sagas.delete(sagaId);
      throw error;
    }

    return sagaId;
  }

  /**
   * 向 Saga 发送事件
   */
  async sendEventToSaga(sagaId: string, event: any): Promise<void> {
    const saga = this.sagas.get(sagaId);
    if (!saga) {
      throw new Error(`Saga 不存在: ${sagaId}`);
    }

    await saga.handle(event);

    // 如果 Saga 完成或失败，删除它
    const state = saga.getState();
    if (state.status === 'completed' || state.status === 'failed') {
      this.sagas.delete(sagaId);
    }
  }

  /**
   * 获取 Saga 状态
   */
  getSagaState(sagaId: string): SagaState | null {
    const saga = this.sagas.get(sagaId);
    return saga ? saga.getState() : null;
  }

  /**
   * 获取所有活跃的 Saga
   */
  getActiveSagas(): SagaState[] {
    return Array.from(this.sagas.values()).map(saga => saga.getState());
  }

  /**
   * 清空所有 Saga（仅用于测试）
   */
  clearAllSagas(): void {
    this.sagas.clear();
  }
}

// 导出单例
export const sagaManager = new SagaManager();
