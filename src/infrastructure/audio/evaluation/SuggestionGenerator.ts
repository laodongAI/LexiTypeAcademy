/**
 * 建议生成器
 * 
 * 职责:
 * - 根据评分结果生成个性化学习建议
 * - 符合SRP（单一职责原则）
 * 
 * DDD分层: Infrastructure Layer - 评估建议生成
 * 
 * 版本: v0.1.4
 * - 从PronunciationScorer中分离（SRP原则）
 * - 新增准确性相关建议
 * - 优化建议优先级和可读性
 */

/**
 * 评分参数
 */
export interface SuggestionParams {
  /** 综合评分 */
  overallScore: number;
  
  /** 准确性评分 */
  accuracyScore: number;
  
  /** 流利度评分（可能为null） */
  fluencyScore: number | null;
  
  /** 完整性评分 */
  completenessScore: number;
  
  /** 目标单词列表 */
  targetWords: string[];
  
  /** 转录单词列表 */
  transcriptWords: string[];
  
  /** 缺失单词数 */
  missingWords: number;
  
  /** 多余单词数 */
  extraWords: number;
  
  /** 用户朗读时长（秒） */
  userDuration?: number;
  
  /** 语速（WPM） */
  wordsPerMinute?: number;
  
  /** 停顿占比 */
  pauseRatio?: number;
}

export class SuggestionGenerator {
  /**
   * 生成评估建议
   * 
   * v0.1.4增强: 添加准确性、语速、停顿的具体建议
   * 
   * @param params 评分参数
   * @returns 建议列表（按优先级排序）
   */
  generateSuggestions(params: SuggestionParams): string[] {
    const suggestions: string[] = [];
    
    // 1. 静音检测（最高优先级）
    if (this.isSilent(params)) {
      suggestions.push('未检测到有效语音，请检查麦克风');
      return suggestions; // 静音时直接返回
    }
    
    // 2. 准确性建议（v0.1.4新增，核心指标）
    if (params.accuracyScore < 60) {
      suggestions.push('发音准确度较低，请仔细对照音标练习每个音素');
    } else if (params.accuracyScore < 80) {
      suggestions.push('部分发音不够准确，建议重点练习低分音素');
    }
    
    // 3. 完整性建议
    if (params.completenessScore < 80) {
      suggestions.push('未完全覆盖目标文本，请尝试完整朗读句子');
    }
    
    // 4. 流利度建议（如果可用）
    if (params.fluencyScore !== null && params.fluencyScore !== undefined) {
      if (params.fluencyScore < 70) {
        suggestions.push('流利度偏低，请注意发音的连贯性和节奏');
      }
      
      // 语速建议（v0.1.4新增）
      if (params.wordsPerMinute !== undefined) {
        if (params.wordsPerMinute > 180) {
          suggestions.push('朗读速度过快，请放慢语速并注意发音清晰度');
        } else if (params.wordsPerMinute < 100) {
          suggestions.push('朗读速度较慢，请尝试更流畅地朗读');
        }
      }
      
      // 停顿建议（v0.1.4新增）
      if (params.pauseRatio !== undefined && params.pauseRatio > 0.3) {
        suggestions.push('停顿过多，请尝试一口气完整朗读');
      }
    }
    
    // 5. 漏读建议（v0.1.3保留）
    if (params.missingWords > params.targetWords.length * 0.3) {
      suggestions.push(`漏读了${params.missingWords}个单词，请完整朗读`);
    }
    
    // 6. 多余内容建议（v0.1.3保留）
    if (params.extraWords > params.targetWords.length * 0.2) {
      suggestions.push('检测到多余内容，请严格按照目标文本朗读');
    }
    
    // 7. 正面反馈（仅在无其他建议时）
    if (suggestions.length === 0) {
      if (params.overallScore >= 90) {
        suggestions.push('发音非常好！继续保持！');
      } else if (params.overallScore >= 80) {
        suggestions.push('发音不错，继续加油！');
      } else if (params.overallScore >= 70) {
        suggestions.push('发音合格，还有提升空间');
      }
    }
    
    return suggestions;
  }
  
  /**
   * 检查是否静音
   */
  private isSilent(params: SuggestionParams): boolean {
    return (
      (params.userDuration !== undefined && params.userDuration === 0) ||
      params.transcriptWords.length === 0
    );
  }
}
