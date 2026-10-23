/**
 * 语音评估类型定义
 * 
 * 职责:
 * - 定义音素评估详情接口
 * - 定义语音评估结果接口
 * - 定义语音评估服务接口
 * 
 * DDD分层: Infrastructure Layer - 基础设施层类型定义
 */

import type { ASRResult } from '../asr/types';

/**
 * 音素评估详情
 */
export interface PhonemeEvaluationDetail {
  /** 音素符号 */
  phoneme: string;
  
  /** 评分 (0-1) */
  score: number;
  
  /** 所属单词 */
  word?: string;
}

/**
 * 语音评估结果
 * 
 * 版本: v0.1.4
 * - 添加语速和停顿相关字段
 * - 流利度评分可为null（回退模式）
 */
export interface SpeechEvaluationResult {
  /** 综合评分 (0-100) */
  overallScore: number;
  
  /** 流利度评分 (0-100, 回退模式可为null) - v0.1.4调整 */
  fluencyScore: number | null;
  
  /** 完整性评分 (0-100) */
  completenessScore: number;
  
  /** 准确性评分 (0-100) - v0.1.4重新定义为音素正确率 */
  accuracyScore: number;
  
  /** 音素详情 */
  phonemes?: PhonemeEvaluationDetail[];
  
  /** 评估建议 */
  suggestions: string[];
  
  /** 原始 ASR 结果 */
  asrResult?: ASRResult;
  
  /** 原始音频 */
  audioBlob?: Blob;
  
  /** 评估模式 */
  evaluationMode: 'precision' | 'fallback';
  
  /** 评估耗时 (毫秒) */
  evaluationTimeMs?: number;
  
  // ===== v0.1.4新增字段 =====
  
  /** 语速 (WPM - Words Per Minute) - v0.1.4新增 */
  wordsPerMinute?: number;
  
  /** 停顿占比 (0-1) - v0.1.4新增 */
  pauseRatio?: number;
  
  /** 缺失单词数 - v0.1.4新增 */
  missingWords?: number;
  
  /** 多余单词数 - v0.1.4新增 */
  extraWords?: number;
}

/**
 * 评估选项
 */
export interface EvaluationOptions {
  /** 语言 */
  language?: 'en' | 'zh';
  
  /** 是否缓存结果 */
  enableCache?: boolean;
  
  /** 最大重试次数 */
  maxRetries?: number;
}

/**
 * 语音评估服务接口
 */
export interface ISpeechEvaluationService {
  /** 
   * 评估发音
   * 
   * @param audioBlob 音频Blob
   * @param targetText 目标文本
   * @param options 评估选项
   * @returns 语音评估结果
   */
  evaluatePronunciation(
    audioBlob: Blob,
    targetText: string,
    options?: EvaluationOptions
  ): Promise<SpeechEvaluationResult>;
  
  /** 
   * 从 ASR 结果评估
   * 
   * @param asrResult ASR识别结果
   * @param targetText 目标文本
   * @param audioBlob 原始音频（可选）
   * @returns 语音评估结果
   */
  evaluateFromASR(
    asrResult: ASRResult,
    targetText: string,
    audioBlob?: Blob
  ): Promise<SpeechEvaluationResult>;
  
  /**
   * 清空评估缓存
   */
  clearCache(): void;
  
  /**
   * 获取缓存统计
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
  };
}
