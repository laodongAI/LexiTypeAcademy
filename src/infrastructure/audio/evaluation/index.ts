/**
 * 语音评估模块导出
 * 
 * 提供:
 * - 类型定义 (PhonemeEvaluationDetail, SpeechEvaluationResult, ISpeechEvaluationService)
 * - 评分算法 (PronunciationScorer)
 * - 建议生成 (SuggestionGenerator) - v0.1.4新增
 * - 评估服务 (SpeechEvaluationService)
 */

export * from './types';
export { PronunciationScorer } from './PronunciationScorer';
export { SuggestionGenerator } from './SuggestionGenerator';
export { SpeechEvaluationService } from './SpeechEvaluationService';
