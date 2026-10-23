/**
 * 写作反馈服务接口
 * 
 * 职责：为自由写作练习提供 AI 驱动的实时反馈
 * 实现者：使用 LLM API 实现语言分析
 */

export interface GrammarError {
  position: number;
  length: number;
  errorType: string;
  suggestion: string;
  explanation: string;
}

export interface VocabularySuggestion {
  originalWord: string;
  suggestedWord: string;
  reason: string;
  difficulty: string;
}

export interface ExpressionSuggestion {
  originalPhrase: string;
  suggestedPhrase: string;
  reason: string;
  example: string;
}

export interface WritingFeedback {
  score: number; // 0-100
  grammarErrors: GrammarError[];
  vocabularySuggestions: VocabularySuggestion[];
  expressionSuggestions: ExpressionSuggestion[];
  overallComment: string;
  improvements: string[];
  timestamp: Date;
}

export interface IWritingFeedbackService {
  /**
   * 分析自由写作文本并生成反馈
   */
  analyzeWriting(
    text: string,
    userLanguageLevel?: string
  ): Promise<WritingFeedback>;

  /**
   * 生成改进后的示例文本
   */
  generateImprovedVersion(
    originalText: string,
    focusAreas?: string[]
  ): Promise<string>;

  /**
   * 获取特定错误类型的详细解释和示例
   */
  getErrorExplanation(errorType: string): Promise<{
    definition: string;
    examples: Array<{ incorrect: string; correct: string }>;
    tips: string[];
  }>;

  /**
   * 检查文本的词汇难度分布
   */
  analyzeVocabularyDifficulty(text: string): Promise<{
    averageDifficulty: string; // A1-C2
    wordCount: number;
    difficultWords: Array<{ word: string; difficulty: string }>;
  }>;
}
