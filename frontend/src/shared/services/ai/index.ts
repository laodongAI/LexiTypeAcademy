/**
 * AI 服务导出入口
 */

// 核心服务
export { AIService, getAIService, resetAIService } from './aiService';

// 类型定义
export type {
  AIProvider,
  AIConfig,
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

// 配置管理
export {
  loadAIConfig,
  saveAIConfig,
  validateAIConfig,
  getDefaultConfig,
  resetAIConfig,
  getProviderName,
  getModelName,
  getSupportedModels
} from './aiConfig';

// 提供商
export { BaseAIProvider } from './providers/baseProvider';
export { QwenProvider } from './providers/qwenProvider';

// 提示词模板（可选导出，供高级用户使用）
export { buildCourseGenerationPrompt } from './prompts/courseGeneration';
export { buildVocabularyEnrichPrompt } from './prompts/vocabularyEnrich';
export { buildTranslationPrompt } from './prompts/translation';
