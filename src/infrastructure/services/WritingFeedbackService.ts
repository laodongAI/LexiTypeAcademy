/**
 * WritingFeedbackService 实现
 * 职责：为自由写作提供 AI 驱动的反馈
 */

import {
  IWritingFeedbackService,
  WritingFeedback,
  GrammarError,
  VocabularySuggestion,
  ExpressionSuggestion,
} from '../../domain/services/IWritingFeedbackService';

/**
 * 写作反馈服务实现
 * 分析：语法、词汇、表达、难度
 */
export class WritingFeedbackService implements IWritingFeedbackService {
  /**
   * 分析写作文本
   */
  async analyzeWriting(text: string, userLanguageLevel?: string): Promise<WritingFeedback> {
    console.log(`分析写作文本，用户级别: ${userLanguageLevel || '未知'}`);

    // 步骤 1: 分句
    const sentences = this.segmentText(text);

    // 步骤 2: 语法检查
    const grammarErrors = this.checkGrammar(sentences);
    console.log(`[语法] 发现 ${grammarErrors.length} 个错误`);

    // 步骤 3: 词汇分析
    const vocabularySuggestions = this.analyzeVocabulary(text);
    console.log(`[词汇] 提出 ${vocabularySuggestions.length} 个建议`);

    // 步骤 4: 表达改进
    const expressionSuggestions = this.suggestExpressions(sentences);
    console.log(`[表达] 提出 ${expressionSuggestions.length} 个改进`);

    // 步骤 5: 计算得分
    const score = this.calculateScore(grammarErrors, vocabularySuggestions);

    // 步骤 6: 生成总体评论
    const overallComment = this.generateOverallComment(
      score,
      grammarErrors,
      vocabularySuggestions,
      expressionSuggestions
    );

    // 步骤 7: 生成改进建议
    const improvements = this.generateImprovementSuggestions(
      grammarErrors,
      vocabularySuggestions
    );

    return {
      score,
      grammarErrors,
      vocabularySuggestions,
      expressionSuggestions,
      overallComment,
      improvements,
      timestamp: new Date(),
    };
  }

  /**
   * 生成改进版本
   */
  async generateImprovedVersion(
    originalText: string,
    focusAreas?: string[]
  ): Promise<string> {
    const feedback = await this.analyzeWriting(originalText);

    let improved = originalText;

    // 应用语法修正
    feedback.grammarErrors.forEach((error) => {
      const start = error.position;
      const end = error.position + error.length;
      const before = improved.substring(start, end);
      improved = improved.replace(before, error.suggestion);
    });

    // 应用词汇替换
    feedback.vocabularySuggestions.forEach((suggestion) => {
      improved = improved.replace(
        new RegExp(`\\b${suggestion.originalWord}\\b`, 'gi'),
        suggestion.suggestedWord
      );
    });

    return improved;
  }

  /**
   * 获取错误解释
   */
  async getErrorExplanation(errorType: string): Promise<{
    definition: string;
    examples: Array<{ incorrect: string; correct: string }>;
    tips: string[];
  }> {
    const explanations: Record<
      string,
      {
        definition: string;
        examples: Array<{ incorrect: string; correct: string }>;
        tips: string[];
      }
    > = {
      tense: {
        definition: '时态错误：动词的时间形式不正确',
        examples: [
          {
            incorrect: 'I go to school yesterday.',
            correct: 'I went to school yesterday.',
          },
          {
            incorrect: 'She is study English now.',
            correct: 'She is studying English now.',
          },
        ],
        tips: [
          '过去的事件用过去时 (went, studied)',
          '现在进行用 is/are + -ing',
          '一般现在用基础动词形式',
        ],
      },
      subject_verb_agreement: {
        definition: '主谓搭配：主语和动词的数不一致',
        examples: [
          {
            incorrect: 'He are going to school.',
            correct: 'He is going to school.',
          },
          {
            incorrect: 'They is students.',
            correct: 'They are students.',
          },
        ],
        tips: [
          '单数主语用 is/am/has/does',
          '复数主语用 are/have/do',
          '第一人称单数用 am, I am',
        ],
      },
      article: {
        definition: '冠词错误：a/an/the 的使用不当',
        examples: [
          {
            incorrect: 'I saw a elephant in a zoo.',
            correct: 'I saw an elephant in a zoo.',
          },
          {
            incorrect: 'The cat is animal.',
            correct: 'The cat is an animal.',
          },
        ],
        tips: [
          '元音前用 an, 辅音前用 a',
          '特定事物前用 the, 第一次提及用 a/an',
          '元音字母：a, e, i, o, u',
        ],
      },
      word_order: {
        definition: '语序错误：单词顺序不符合英语语法',
        examples: [
          {
            incorrect: 'I like very much ice cream.',
            correct: 'I like ice cream very much.',
          },
          {
            incorrect: 'In the morning I go to school.',
            correct: 'I go to school in the morning.',
          },
        ],
        tips: [
          '英语基本语序：主语 + 动词 + 宾语',
          '时间状语通常在句尾或句首',
          '频率副词在动词前：always, usually, often',
        ],
      },
    };

    return explanations[errorType] || explanations['tense'];
  }

  /**
   * 分析词汇难度
   */
  async analyzeVocabularyDifficulty(text: string): Promise<{
    averageDifficulty: string;
    wordCount: number;
    difficultWords: Array<{ word: string; difficulty: string }>;
  }> {
    const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];

    // 简单的难度分类
    const difficultyMap: Record<string, string> = {
      hello: 'A1',
      world: 'A1',
      beautiful: 'B1',
      magnificent: 'B2',
      ubiquitous: 'C2',
      the: 'A1',
      is: 'A1',
    };

    const analyzed = words.map((word) => ({
      word,
      difficulty: difficultyMap[word] || 'A2',
    }));

    // 计算平均难度
    const difficultWords = Array.from(new Map(analyzed.map((item) => [item.word, item])).values())
      .filter((w) => w.difficulty !== 'A1' && w.difficulty !== 'A2');

    const avgDifficulty = difficultWords.length === 0 ? 'A1' : 'B1';

    return {
      averageDifficulty: avgDifficulty,
      wordCount: new Set(words).size,
      difficultWords: difficultWords.slice(0, 10),
    };
  }

  /**
   * 分句
   */
  private segmentText(text: string): string[] {
    return text
      .split(/[.!?]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  /**
   * 语法检查
   */
  private checkGrammar(sentences: string[]): GrammarError[] {
    const errors: GrammarError[] = [];

    sentences.forEach((sentence) => {
      // 检查：a 在元音前
      const aBeforeVowel = /\ba\s+[aeiou]/gi;
      const aMatches = sentence.match(aBeforeVowel);
      if (aMatches) {
        errors.push({
          position: sentence.indexOf(aMatches[0]),
          length: aMatches[0].length,
          errorType: 'article',
          suggestion: aMatches[0].replace('a ', 'an '),
          explanation: '在元音前使用 "an" 而不是 "a"',
        });
      }

      // 检查：he/she are
      if (/(he|she)\s+are/gi.test(sentence)) {
        const idx = sentence.search(/(he|she)\s+are/gi);
        errors.push({
          position: idx,
          length: 7,
          errorType: 'subject_verb_agreement',
          suggestion: 'is',
          explanation: '单数主语应该使用 "is" 而不是 "are"',
        });
      }

      // 检查：went go
      if (/went.*go/i.test(sentence)) {
        errors.push({
          position: 0,
          length: 4,
          errorType: 'tense',
          suggestion: 'went',
          explanation: '避免混用时态',
        });
      }
    });

    return errors;
  }

  /**
   * 词汇分析
   */
  private analyzeVocabulary(text: string): VocabularySuggestion[] {
    const suggestions: VocabularySuggestion[] = [];

    const replacements: Record<string, { word: string; reason: string }> = {
      good: { word: 'excellent', reason: '更精确的表达' },
      bad: { word: 'poor', reason: '更正式的用法' },
      nice: { word: 'pleasant', reason: '避免重复使用' },
      very: { word: 'extremely', reason: '更强烈的表达' },
    };

    for (const [original, suggestion] of Object.entries(replacements)) {
      if (text.toLowerCase().includes(original)) {
        suggestions.push({
          originalWord: original,
          suggestedWord: suggestion.word,
          reason: suggestion.reason,
          difficulty: 'B1',
        });
      }
    }

    return suggestions;
  }

  /**
   * 表达改进
   */
  private suggestExpressions(sentences: string[]): ExpressionSuggestion[] {
    const suggestions: ExpressionSuggestion[] = [];

    sentences.forEach((sentence) => {
      // 检查过长句子
      if (sentence.length > 100) {
        suggestions.push({
          originalPhrase: sentence,
          suggestedPhrase: '建议分为多个短句',
          reason: '句子过长，可以分为多个短句以提高清晰度',
          example:
            'I went to the store and bought some groceries and met my friend. → I went to the store. I bought groceries. Then, I met my friend.',
        });
      }

      // 检查被动语态
      if (/was\s+\w+ed|were\s+\w+ed/i.test(sentence)) {
        suggestions.push({
          originalPhrase: sentence,
          suggestedPhrase: '考虑改为主动语态',
          reason: '主动语态通常更清楚有力',
          example:
            'This book was written by John. → John wrote this book.',
        });
      }
    });

    return suggestions;
  }

  /**
   * 计算得分 (0-100)
   */
  private calculateScore(
    grammarErrors: GrammarError[],
    vocabularySuggestions: VocabularySuggestion[]
  ): number {
    const totalIssues = grammarErrors.length + vocabularySuggestions.length * 0.5;

    if (totalIssues === 0) return 95;
    if (totalIssues <= 2) return 85;
    if (totalIssues <= 5) return 75;
    return Math.max(50, 100 - totalIssues * 5);
  }

  /**
   * 生成总体评论
   */
  private generateOverallComment(
    score: number,
    grammarErrors: GrammarError[],
    vocabularySuggestions: VocabularySuggestion[],
    expressionSuggestions: ExpressionSuggestion[]
  ): string {
    if (score >= 90) {
      return '很好！你的写作几乎没有错误，继续保持！';
    } else if (score >= 80) {
      return '不错！只有少数错误。注意 ' +
        (grammarErrors.length > 0 ? '语法' : '') +
        ' ' +
        (vocabularySuggestions.length > 0 ? '词汇' : '') +
        ' 的改进。';
    } else if (score >= 70) {
      return '还可以，但有多处需要改进。建议重点关注语法和词汇的使用。';
    } else {
      return '需要更多练习。建议从基础语法开始复习。';
    }
  }

  /**
   * 生成改进建议
   */
  private generateImprovementSuggestions(
    grammarErrors: GrammarError[],
    vocabularySuggestions: VocabularySuggestion[]
  ): string[] {
    const suggestions: string[] = [];

    if (grammarErrors.length > 0) {
      suggestions.push(`修正 ${grammarErrors.length} 个语法错误`);
    }

    if (vocabularySuggestions.length > 0) {
      suggestions.push(`使用 ${vocabularySuggestions.length} 个更好的词汇选择`);
    }

    if (suggestions.length === 0) {
      suggestions.push('保持现有的写作水平');
    }

    return suggestions;
  }
}

/**
 * 工厂函数
 */
export function createWritingFeedbackService(): IWritingFeedbackService {
  return new WritingFeedbackService();
}
