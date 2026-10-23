import type { ITTSProvider, TTSOptions, TTSResult } from './types';
import { TTSCacheRepository } from './TTSCacheRepository';
import { DomainEventBus, AudioGeneratedEvent } from '../../../domain/events';
import { ErrorHandlingService } from '../storage/ErrorHandlingService';
import { NetworkError } from '../../../domain/errors/DomainError';

/**
 * TTS任务
 */
interface TTSTask {
  id: string;
  options: TTSOptions;
  resolve: (result: TTSResult) => void;
  reject: (error: Error) => void;
  retryCount: number;
}

/**
 * TTS服务（Facade模式）
 * 统一管理多个TTS提供者，提供缓存、重试、降级等功能
 */
export class TTSService {
  /** 主TTS提供者 */
  private primaryProvider: ITTSProvider;

  /** 备用TTS提供者 */
  private fallbackProvider: ITTSProvider;

  /** 缓存仓储 */
  private cacheRepository: TTSCacheRepository;

  /** 事件总线 */
  private eventBus: DomainEventBus;

  /** 错误处理服务 */
  private errorHandler: ErrorHandlingService;

  /** 任务队列 */
  private taskQueue: TTSTask[] = [];

  /** 正在执行的任务数 */
  private runningTasks = 0;

  /** 最大并发数 */
  private readonly MAX_CONCURRENT = 5;

  /** 最大重试次数 */
  private readonly MAX_RETRIES = 3;

  /** 是否正在处理队列 */
  private isProcessingQueue = false;

  /** 是否已初始化 */
  private initialized = false;

  constructor(
    primaryProvider: ITTSProvider,
    fallbackProvider: ITTSProvider,
    cacheRepository: TTSCacheRepository,
    eventBus: DomainEventBus = DomainEventBus.getInstance(),
    errorHandler: ErrorHandlingService = new ErrorHandlingService()
  ) {
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
    this.cacheRepository = cacheRepository;
    this.eventBus = eventBus;
    this.errorHandler = errorHandler;
  }

  /**
   * 初始化TTS服务
   */
  async initialize(): Promise<void> {
    // 避免重复初始化
    if (this.initialized) {
      console.log('[TTSService] 已初始化,跳过');
      return;
    }

    console.log('[TTSService] 开始初始化...');

    // 初始化缓存仓储
    await this.cacheRepository.initialize();

    // 初始化主提供者
    if (this.primaryProvider.initialize) {
      await this.primaryProvider.initialize();
    }

    // 初始化备用提供者
    if (this.fallbackProvider.initialize) {
      await this.fallbackProvider.initialize();
    }

    this.initialized = true;
    console.log('[TTSService] 初始化完成');
  }

  /**
   * 生成TTS音频
   * @param options TTS选项
   * @param courseId 课程ID（用于事件发布）
   * @returns TTS结果
   */
  async generate(options: TTSOptions, courseId?: string): Promise<TTSResult> {
    // 1. 检查缓存
    const cached = await this.cacheRepository.get(options);
    if (cached) {
      console.log(`[TTSService] 缓存命中: ${options.text.substring(0, 20)}...`);
      
      // 计算时长
      const duration = await this.calculateDuration(cached);

      return {
        audioBlob: cached,
        duration,
        fromCache: true,
        provider: 'cache',
      };
    }

    // 2. 添加到任务队列
    return new Promise((resolve, reject) => {
      const task: TTSTask = {
        id: crypto.randomUUID(),
        options,
        resolve: async (result) => {
          // 缓存结果
          await this.cacheRepository.set(options, result.audioBlob, result.duration);

          // 发布领域事件
          if (courseId) {
            const audioId = `tts-${task.id}`;
            const event = new AudioGeneratedEvent(
              courseId,
              audioId,
              URL.createObjectURL(result.audioBlob),
              result.duration
            );
            await this.eventBus.publish(event);
          }

          resolve(result);
        },
        reject,
        retryCount: 0,
      };

      this.taskQueue.push(task);
      this.processQueue();
    });
  }

  /**
   * 批量生成TTS音频
   * @param optionsList TTS选项列表
   * @param courseId 课程ID
   * @returns TTS结果列表
   */
  async batchGenerate(
    optionsList: TTSOptions[],
    courseId?: string
  ): Promise<TTSResult[]> {
    console.log(`[TTSService] 批量生成 ${optionsList.length} 个音频`);

    const results = await Promise.all(
      optionsList.map((options) => this.generate(options, courseId))
    );

    console.log(`[TTSService] 批量生成完成`);
    return results;
  }

  /**
   * 处理任务队列
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.taskQueue.length > 0 && this.runningTasks < this.MAX_CONCURRENT) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.runningTasks++;
      this.executeTask(task).finally(() => {
        this.runningTasks--;
        this.processQueue(); // 继续处理队列
      });
    }

    this.isProcessingQueue = false;
  }

  /**
   * 执行TTS任务
   */
  private async executeTask(task: TTSTask): Promise<void> {
    try {
      console.log(`[TTSService] 执行任务: ${task.options.text.substring(0, 20)}...`);

      // 尝试使用主提供者
      let result: TTSResult;
      try {
        result = await this.primaryProvider.generate(task.options);
      } catch (primaryError) {
        console.warn('[TTSService] 主提供者失败，尝试降级到备用提供者:', primaryError);

        // 降级到备用提供者
        result = await this.fallbackProvider.generate(task.options);
      }

      task.resolve(result);
    } catch (error) {
      // 处理错误
      const handled = await this.errorHandler.handleDomainError(
        error as Error,
        async () => {
          // 重试逻辑
          if (task.retryCount < this.MAX_RETRIES) {
            task.retryCount++;
            console.log(`[TTSService] 重试任务 (${task.retryCount}/${this.MAX_RETRIES})`);
            await this.executeTask(task);
          } else {
            throw error;
          }
        },
        this.MAX_RETRIES
      );

      if (!handled) {
        task.reject(error as Error);
      }
    }
  }

  /**
   * 计算音频时长
   */
  private async calculateDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('无法加载音频元数据'));
      };
    });
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): {
    queueLength: number;
    runningTasks: number;
  } {
    return {
      queueLength: this.taskQueue.length,
      runningTasks: this.runningTasks,
    };
  }

  /**
   * 清空队列
   */
  clearQueue(): void {
    this.taskQueue.forEach((task) => {
      task.reject(new Error('任务队列已清空'));
    });
    this.taskQueue = [];
    console.log('[TTSService] 已清空任务队列');
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats() {
    return await this.cacheRepository.getCacheStats();
  }

  /**
   * 清理过期缓存
   */
  async cleanExpiredCache(): Promise<number> {
    return await this.cacheRepository.cleanExpired();
  }
}
