/**
 * AI 服务导出入口
 */

// 核心服务
export { AIService, getAIService, resetAIService } from './aiService';

// 类型定义
export type {
  AIProvider,
  AIConfig,
  AIBackendConfig,
  AIChatUsage,
  AIOptions,
  AIMessage,
  AIResponse,
  CourseGenerationRequest,
  CourseGenerationResponse,
  LessonData,
  WordEntry,
  VocabularyEnrichRequest,
  VocabularyEnrichResponse,
  TranslationRequest,
  TranslationResponse,
  ConversationMessage,
  ConversationContext,
  AudioImportRequest,
  TextbookImportRequest,
  WritingCheckRequest,
  WritingCheckResponse,
  WritingError,
  PronunciationTestRequest,
  PronunciationTestResponse,
  TeachingFeedbackRequest,
  TeachingFeedbackResponse,
  TeachingMode,
  TeachingErrorType,
  HintLevel,
  VocabularyRecommendRequest,
  VocabularyRecommendResponse
} from './aiTypes';

// 错误类
export { AIError, AIErrorCode } from './aiTypes';

// 配置管理（批次D：仅保留前端侧自定义提示词配置）
export {
  loadAIConfig,
  saveAIConfig,
  resetAIConfig,
  consumeAIConfigMigrationNotice
} from './aiConfig';

// 提供商（批次D：统一走后端代理）
export { BaseAIProvider } from './providers/baseProvider';
export { BackendAIProvider } from './providers/backendProvider';

// 提示词模板（可选导出，供高级用户使用）
export { buildCourseGenerationPrompt } from './prompts/courseGeneration';
export { buildVocabularyEnrichPrompt } from './prompts/vocabularyEnrich';
export { buildTranslationPrompt } from './prompts/translation';
