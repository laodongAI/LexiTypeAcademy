/**
 * AI Lab 模块的依赖注入配置
 * 
 * 集中管理 AI Lab 模块的所有依赖，包括：
 * - 聚合根
 * - 仓储
 * - 服务（核心服务 + 补充服务）
 * - 用例
 * 
 * Phase 10C 核心服务：
 * - RecommendationService
 * - CourseGeneratorService
 * - PublisherQueryService
 * - WritingFeedbackService
 * 
 * Phase 11 补充服务（老系统迁移）：
 * - AIConfigService - AI 提供商配置管理
 * - AILabTaskCenter - 任务中心（队列、重试、断点续传）
 * - PromptTemplateService - Prompt 模板管理
 * - CacheManager - 多层缓存管理
 * - CourseDeduplicationService - 课程去重服务
 */

import { LanguageAbilityRepository } from '../repositories/LanguageAbilityRepository';
import { TaskRepository } from '../repositories/TaskRepository';
import { ILanguageAbilityRepository } from '../../domain/repositories/ILanguageAbilityRepository';
import { ITaskRepository } from '../../domain/repositories/ITaskRepository';
import { IRecommendationService } from '../../domain/services/IRecommendationService';
import { ICourseGeneratorService } from '../../domain/services/ICourseGeneratorService';
import { IPublisherQueryService } from '../../domain/services/IPublisherQueryService';
import { IWritingFeedbackService } from '../../domain/services/IWritingFeedbackService';
import { RecommendationService } from '../services/RecommendationService';
import { CourseGeneratorService } from '../services/CourseGeneratorService';
import { PublisherQueryService } from '../services/publisherQueryService';
import { WritingFeedbackService } from '../services/WritingFeedbackService';

// Phase 11 补充服务导入
import { AIConfigService, IAIConfigService } from '../services/AIConfigService';
import { AILabTaskCenter, IAILabTaskCenter } from '../services/AILabTaskCenter';
import { PromptTemplateService, IPromptTemplateService } from '../services/PromptTemplateService';
import { CacheManager, ICacheManager } from '../services/CacheManager';
import { CourseDeduplicationService, ICourseDeduplicationService } from '../services/CourseDeduplicationService';

/**
 * AI Lab 依赖注入容器
 */
export class AILabDependencyContainer {
  private static instance: AILabDependencyContainer;
  
  // Phase 10C 核心仓储
  private languageAbilityRepository: ILanguageAbilityRepository | null = null;
  private taskRepository: ITaskRepository | null = null;
  
  // Phase 10C 核心服务
  private recommendationService: IRecommendationService | null = null;
  private courseGeneratorService: ICourseGeneratorService | null = null;
  private publisherQueryService: IPublisherQueryService | null = null;
  private writingFeedbackService: IWritingFeedbackService | null = null;
  
  // Phase 11 补充服务
  private aiConfigService: IAIConfigService | null = null;
  private aiLabTaskCenter: IAILabTaskCenter | null = null;
  private promptTemplateService: IPromptTemplateService | null = null;
  private cacheManager: ICacheManager | null = null;
  private courseDeduplicationService: ICourseDeduplicationService | null = null;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AILabDependencyContainer {
    if (!AILabDependencyContainer.instance) {
      AILabDependencyContainer.instance = new AILabDependencyContainer();
    }
    return AILabDependencyContainer.instance;
  }

  /**
   * 初始化所有依赖
   * 应在应用启动时调用
   */
  async initialize(): Promise<void> {
    console.log('🚀 AI Lab 依赖容器初始化中...');
    
    // Phase 10C: 初始化核心仓储
    this.languageAbilityRepository = new LanguageAbilityRepository();
    this.taskRepository = new TaskRepository();

    // Phase 10C: 初始化核心服务
    this.recommendationService = new RecommendationService();
    this.courseGeneratorService = new CourseGeneratorService();
    this.publisherQueryService = new PublisherQueryService();
    this.writingFeedbackService = new WritingFeedbackService();
    
    // Phase 11: 初始化补充服务（老系统迁移）
    this.cacheManager = new CacheManager();
    this.promptTemplateService = new PromptTemplateService();
    this.aiConfigService = new AIConfigService();
    this.aiLabTaskCenter = new AILabTaskCenter();
    this.courseDeduplicationService = new CourseDeduplicationService();
    
    console.log('✅ AI Lab 依赖容器初始化完成');
    console.log('   - 仓储: 2 个');
    console.log('   - 核心服务: 4 个 (Phase 10C)');
    console.log('   - 补充服务: 5 个 (Phase 11)');
  }

  /**
   * 获取语言能力仓储
   */
  getLanguageAbilityRepository(): ILanguageAbilityRepository {
    if (!this.languageAbilityRepository) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.languageAbilityRepository;
  }

  /**
   * 获取任务仓储
   */
  getTaskRepository(): ITaskRepository {
    if (!this.taskRepository) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.taskRepository;
  }

  /**
   * 获取推荐服务
   */
  getRecommendationService(): IRecommendationService {
    if (!this.recommendationService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.recommendationService;
  }

  /**
   * 获取课程生成服务
   */
  getCourseGeneratorService(): ICourseGeneratorService {
    if (!this.courseGeneratorService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.courseGeneratorService;
  }

  /**
   * 获取出版社查询服务
   */
  getPublisherQueryService(): IPublisherQueryService {
    if (!this.publisherQueryService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.publisherQueryService;
  }

  /**
   * 获取写作反馈服务
   */
  getWritingFeedbackService(): IWritingFeedbackService {
    if (!this.writingFeedbackService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.writingFeedbackService;
  }

  // ============================================================================
  // Phase 11 补充服务 Getters
  // ============================================================================

  /**
   * 获取 AI 配置服务
   */
  getAIConfigService(): IAIConfigService {
    if (!this.aiConfigService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.aiConfigService;
  }

  /**
   * 获取任务中心
   */
  getAILabTaskCenter(): IAILabTaskCenter {
    if (!this.aiLabTaskCenter) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.aiLabTaskCenter;
  }

  /**
   * 获取 Prompt 模板服务
   */
  getPromptTemplateService(): IPromptTemplateService {
    if (!this.promptTemplateService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.promptTemplateService;
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): ICacheManager {
    if (!this.cacheManager) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.cacheManager;
  }

  /**
   * 获取课程去重服务
   */
  getCourseDeduplicationService(): ICourseDeduplicationService {
    if (!this.courseDeduplicationService) {
      throw new Error('AI Lab 依赖容器未初始化');
    }
    return this.courseDeduplicationService;
  }

  /**
   * 重置容器（用于测试）
   */
  reset(): void {
    // Phase 10C 核心
    this.languageAbilityRepository = null;
    this.taskRepository = null;
    this.recommendationService = null;
    this.courseGeneratorService = null;
    this.publisherQueryService = null;
    this.writingFeedbackService = null;
    
    // Phase 11 补充
    this.aiConfigService = null;
    this.aiLabTaskCenter = null;
    this.promptTemplateService = null;
    this.cacheManager = null;
    this.courseDeduplicationService = null;
    
    console.log('🔄 AI Lab 依赖容器已重置');
  }
}

/**
 * 便捷方法：获取依赖容器实例
 */
export function getAILabContainer(): AILabDependencyContainer {
  return AILabDependencyContainer.getInstance();
}
