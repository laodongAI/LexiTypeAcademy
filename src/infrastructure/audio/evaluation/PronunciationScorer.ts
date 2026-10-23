/**
 * 发音评分器
 * 
 * 职责:
 * - 实现精确模式评分算法（基于ASR音素对齐）
 * - 实现回退模式评分算法（基于文本匹配）
 * - 提供工具方法（文本归一化、分数限制、时长估算）
 * 
 * DDD分层: Infrastructure Layer - 评分算法实现
 * 设计模式: Strategy Pattern（双模式策略）
 * 
 * 版本: v0.1.4 (DDD深度优化版)
 * - 重新定义准确性评分: 从ASR置信度改为音素正确率 (Phone Accuracy)
 * - 增强流利度算法: 语速合理性(0.7权重) + 停顿控制(0.3权重)
 * - 修复单词匹配缺陷: 使用LCS处理重复词和顺序问题
 * - 更新评分公式: 精确模式 0.5×accuracy + 0.3×fluency + 0.2×completeness
 * - 拆分职责: 评分算法独立，建议生成交给SuggestionGenerator (SRP原则)
 * - 回退模式流利度可为null: 无音素数据时不强制估算
 */

import type { ASRResult, WordAlignment, PhonemeAlignment } from '../asr/types';
import type { PhonemeEvaluationDetail, SpeechEvaluationResult } from './types';
import { SuggestionGenerator, type SuggestionParams } from './SuggestionGenerator';

/**
 * 评分结果（内部使用）
 * v0.1.4扩展字段
 */
interface ScoringResult {
  overallScore: number;
  fluencyScore: number | null; // v0.1.4: 回退模式可为null
  completenessScore: number;
  accuracyScore: number;
  phonemes?: PhonemeEvaluationDetail[];
  suggestions: string[];
  evaluationMode: 'precision' | 'fallback';
  // v0.1.4新增字段
  wordsPerMinute?: number;
  pauseRatio?: number;
  missingWords?: number;
  extraWords?: number;
}

export class PronunciationScorer {
  private suggestionGenerator: SuggestionGenerator;
  
  constructor() {
    this.suggestionGenerator = new SuggestionGenerator();
  }
  /**
   * 从ASR结果评分（自动选择模式）
   * 
   * @param asrResult ASR识别结果
   * @param targetText 目标文本
   * @returns 评分结果
   */
  async score(asrResult: ASRResult, targetText: string, audioBlob?: Blob): Promise<ScoringResult> {
    // 精确模式：ASR结果包含单词级对齐数据
    if (asrResult.alignments && asrResult.alignments.length > 0) {
      return this.scoreFromPhonemes(asrResult, targetText);
    }
    
    // 回退模式：仅有文本转录
    return await this.scoreFromTranscript(asrResult, targetText, audioBlob);
  }
  
  /**
   * 精确模式评分（基于音素级对齐）
   * 
   * v0.1.4评分公式:
   * - 准确性 = 音素正确率 × 100 (confidence >= 0.7视为正确) (权重50%)
   * - 流利度 = 语速合理性×0.7 + 停顿控制×0.3 (权重30%)
   * - 完整性 = LCS匹配度 × 100 (权重20%)
   * - 综合评分 = 准确性×0.5 + 流利度×0.3 + 完整性×0.2
   * 
   * @param asrResult ASR识别结果（包含音素对齐）
   * @param targetText 目标文本
   * @returns 评分结果
   */
  private scoreFromPhonemes(asrResult: ASRResult, targetText: string): ScoringResult {
    // 1. 计算准确性评分（音素正确率）- v0.1.4核心改进
    const phonemeDetails: PhonemeEvaluationDetail[] = [];
    let correctPhonemes = 0;
    let totalPhonemes = 0;
    
    asrResult.alignments!.forEach((word: WordAlignment) => {
      word.phonemes?.forEach((p: PhonemeAlignment) => {
        totalPhonemes++;
        const isCorrect = p.confidence >= 0.7;
        if (isCorrect) {
          correctPhonemes++;
        }
        phonemeDetails.push({
          phoneme: p.phoneme,
          score: p.confidence,
          word: word.word
        });
      });
    });
    
    const accuracyScore = clamp(
      (correctPhonemes / Math.max(1, totalPhonemes)) * 100,
      0,
      100
    );
    
    // 2. 计算流利度评分（语速 + 停顿）- v0.1.4增强
    const wordCount = asrResult.alignments!.length;
    const duration = asrResult.duration || 1; // 防止除零
    
    // 2.1 语速合理性 (Speaking Rate)
    const wordsPerMinute = (wordCount / duration) * 60;
    const targetWPM = 150; // 英语正常语速
    const speedScore = clamp(
      (1 - Math.abs(wordsPerMinute - targetWPM) / targetWPM) * 100,
      0,
      100
    );
    
    // 2.2 停顿控制 (Pause Control)
    // 注: 需要VAD分段数据，如无则默认停顿为0
    const pauseDuration = this.calculatePauseDuration(asrResult);
    const pauseRatio = pauseDuration / duration;
    const pauseScore = clamp(
      ((0.2 - pauseRatio) / 0.2) * 100,
      0,
      100
    );
    
    const fluencyScore = speedScore * 0.7 + pauseScore * 0.3;
    
    // 3. 计算完整性评分（使用LCS）- v0.1.4修复
    const normalizedTarget = normalizeText(targetText);
    const normalizedTranscript = normalizeText(asrResult.text);
    const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);
    const transcriptWords = normalizedTranscript.split(/\s+/).filter(Boolean);
    
    // 使用LCS（最长公共子序列）计算匹配度
    const matchedWordsCount = longestCommonSubsequence(targetWords, transcriptWords);
    const completenessScore = clamp(
      (matchedWordsCount / Math.max(1, targetWords.length)) * 100,
      0,
      100
    );
    
    // 计算缺失和多余单词数
    const missingWords = targetWords.length - matchedWordsCount;
    const extraWords = Math.max(0, transcriptWords.length - matchedWordsCount);
    
    // 4. 计算综合评分 - v0.1.4调整权重
    const overallScore = clamp(
      accuracyScore * 0.5 + fluencyScore * 0.3 + completenessScore * 0.2,
      0,
      100
    );
    
    // 5. 生成评估建议（使用SuggestionGenerator）
    const suggestions = this.suggestionGenerator.generateSuggestions({
      overallScore,
      accuracyScore,
      fluencyScore,
      completenessScore,
      targetWords,
      transcriptWords,
      missingWords,
      extraWords,
      userDuration: duration,
      wordsPerMinute,
      pauseRatio
    });
    
    return {
      overallScore,
      fluencyScore,
      completenessScore,
      accuracyScore,
      phonemes: phonemeDetails,
      suggestions,
      evaluationMode: 'precision',
      wordsPerMinute,
      pauseRatio,
      missingWords,
      extraWords
    };
  }
  
  /**
   * 回退模式评分（基于文本匹配）
   * 
   * v0.1.4优化:
   * - 流利度可为null（无音频Blob时）
   * - 增强噪音惩罚：缺失词×10 + 多余词×5
   * 
   * @param asrResult ASR识别结果（仅文本转录）
   * @param targetText 目标文本
   * @param audioBlob 音频Blob（可选）
   * @returns 评分结果
   */
  private async scoreFromTranscript(asrResult: ASRResult, targetText: string, audioBlob?: Blob): Promise<ScoringResult> {
    // 1. 文本归一化
    const normalizedTarget = normalizeText(targetText);
    const normalizedTranscript = normalizeText(asrResult.text);
    const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);
    const transcriptWords = normalizedTranscript.split(/\s+/).filter(Boolean);
    
    // 2. 计算完整性评分（使用LCS）- v0.1.4修复
    const matchedWordsCount = longestCommonSubsequence(targetWords, transcriptWords);
    const completenessScore = clamp(
      (matchedWordsCount / Math.max(1, targetWords.length)) * 100,
      0,
      100
    );
    
    // 3. 计算流利度评分（v0.1.4优化：可为null）
    let userDuration = 0;
    let fluencyScore: number | null = null; // v0.1.4: 默认null
    let wordsPerMinute: number | undefined = undefined;
    
    if (audioBlob) {
      try {
        userDuration = await getBlobDuration(audioBlob);
        if (userDuration > 0) {
          // 简化版流利度：基于时长估算
          const expectedDuration = targetWords.length * 0.6;
          fluencyScore = clamp((expectedDuration / userDuration) * 100, 0, 100);
          wordsPerMinute = (targetWords.length / userDuration) * 60;
        }
      } catch (error) {
        console.warn('[PronunciationScorer] 时长获取失败:', error);
      }
    }
    
    // 4. 计算准确性评分（ASR置信度）
    const accuracyScore = clamp((asrResult.confidence || 0.8) * 100, 0, 100);
    
    // 5. 计算缺失和多余单词数
    const missingWords = targetWords.length - matchedWordsCount;
    const extraWords = Math.max(0, transcriptWords.length - matchedWordsCount);
    
    // 6. 计算噪音惩罚（v0.1.3保留）
    const noisePenalty = (missingWords * 10) + (extraWords * 5);
    
    // 7. 计算综合评分
    const overallScore = Math.max(0, completenessScore - noisePenalty);
    
    // 8. 生成评估建议（使用SuggestionGenerator）
    const suggestions = this.suggestionGenerator.generateSuggestions({
      overallScore: clamp(overallScore, 0, 100),
      accuracyScore,
      fluencyScore,
      completenessScore,
      targetWords,
      transcriptWords,
      missingWords,
      extraWords,
      userDuration,
      wordsPerMinute
    });
    
    return {
      overallScore: clamp(overallScore, 0, 100),
      fluencyScore,
      completenessScore,
      accuracyScore,
      suggestions,
      evaluationMode: 'fallback',
      wordsPerMinute,
      missingWords,
      extraWords
    };
  }
  
  /**
   * 计算停顿时长
   * 
   * v0.1.4新增: 从ASR的VAD分段数据计算停顿
   * 
   * @param asrResult ASR识别结果
   * @returns 停顿总时长（秒）
   */
  private calculatePauseDuration(asrResult: ASRResult): number {
    // 如果ASR没有提供voiceSegments，返回0
    if (!asrResult.voiceSegments || asrResult.voiceSegments.length === 0) {
      return 0;
    }
    
    let pauseDuration = 0;
    const segments = asrResult.voiceSegments;
    
    // 计算相邻语音段之间的间隔
    for (let i = 1; i < segments.length; i++) {
      const gap = segments[i].start - segments[i - 1].end;
      if (gap > 0) {
        pauseDuration += gap;
      }
    }
    
    return pauseDuration;
  }
}

/**
 * 最长公共子序列（LCS）算法
 * 
 * v0.1.4新增: 用于修复单词匹配缺陷，处理重复词和顺序问题
 * 
 * @param arr1 第一个数组
 * @param arr2 第二个数组
 * @returns 最长公共子序列的长度
 */
function longestCommonSubsequence(arr1: string[], arr2: string[]): number {
  const m = arr1.length;
  const n = arr2.length;
  
  // 创建DP表
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // 填充DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}

/**
 * 文本归一化
 * 
 * v0.1.3优化:
 * - 标点符号转为空格（避免连词如"hello,world"变成"helloworld"）
 * - 合并多余空格
 * 
 * @param text 原始文本
 * @returns 归一化后的文本
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // 标点转空格（v0.1.3优化）
    .replace(/\s+/g, ' ')      // 合并空格
    .trim();
}

/**
 * 限制分数在指定范围内
 * 
 * v0.1.3增强: 处理NaN和Infinity
 * 
 * @param value 原始值
 * @param min 最小值
 * @param max 最大值
 * @returns 限制后的值
 */
function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min; // v0.1.3新增: 处理NaN和Infinity
  return Math.max(min, Math.min(max, value));
}

/**
 * 精确获取音频时长
 * 
 * v0.1.3重构: 使用AudioContext替代固定比特率估算
 * 
 * @param audioBlob 音频Blob
 * @returns 时长（秒）
 */
async function getBlobDuration(audioBlob: Blob): Promise<number> {
  // v0.1.3: 使用AudioContext精确解码
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    console.warn('[getBlobDuration] AudioContext不可用，使用简化估算');
    return estimateDurationFromSize(audioBlob);
  }
  
  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.duration;
  } catch (error) {
    console.error('[getBlobDuration] 解码失败:', error);
    // 回退: 简化估算
    return estimateDurationFromSize(audioBlob);
  } finally {
    await audioContext.close();
  }
}

/**
 * 从文件大小估算时长（回退方案）
 * 
 * @param audioBlob 音频Blob
 * @returns 估算时长（秒）
 */
function estimateDurationFromSize(audioBlob: Blob): number {
  // 简化估算: 16kHz PCM单声道
  const fileSizeBytes = audioBlob.size;
  const headerSize = 44; // WAV header
  const dataSize = Math.max(0, fileSizeBytes - headerSize);
  const sampleRate = 16000;
  const bytesPerSample = 2; // 16-bit
  const channels = 1;
  
  return dataSize / (sampleRate * bytesPerSample * channels);
}
