/**
 * AI Lab 基础设施服务模块导出
 * 
 * 包含 Phase 10C 核心服务和 Phase 11 补充服务
 */

// ============================================================================
// Phase 10C 核心服务
// ============================================================================

export { RecommendationService } from './RecommendationService';
export { CourseGeneratorService } from './CourseGeneratorService';
export { PublisherQueryService } from './publisherQueryService';
export { WritingFeedbackService } from './WritingFeedbackService';

// ============================================================================
// Phase 11 补充服务（老系统迁移）
// ============================================================================

// AI 配置服务 - 多提供商管理、密钥加密、连接测试
export { 
  AIConfigService,
  getAIConfigService,
  type IAIConfigService,
  type AIProvider,
  type AIConfig,
  type ProviderPreset,
  type ConnectionTestResult
} from './AIConfigService';

// 任务中心 - 队列管理、优先级、重试、断点续传
export {
  AILabTaskCenter,
  getAILabTaskCenter,
  type IAILabTaskCenter,
  type AILabTask,
  type AILabTaskType,
  type TaskPriority,
  TaskStatus
} from './AILabTaskCenter';

// Prompt 模板服务 - 模板库、渲染、变量验证
export {
  PromptTemplateService,
  getPromptTemplateService,
  type IPromptTemplateService,
  type PromptTemplate,
  type PromptCategory,
  type TemplateVariable,
  type RenderOptions
} from './PromptTemplateService';

// 缓存管理器 - 多层缓存、TTL、LRU 淘汰
export {
  CacheManager,
  getCacheManager,
  type ICacheManager,
  type CacheOptions,
  type CacheStats,
  type CacheConfig
} from './CacheManager';

// 课程去重服务 - 指纹、相似度、合并建议
export {
  CourseDeduplicationService,
  getCourseDeduplicationService,
  type ICourseDeduplicationService,
  type CourseFingerprint,
  type SimilarityResult,
  type MergeSuggestion,
  type DeduplicationReport
} from './CourseDeduplicationService';
