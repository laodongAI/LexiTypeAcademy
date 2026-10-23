/**
 * 补救课程生成服务（领域服务）
 * 
 * 职责：
 * - 基于错误类型自动生成针对性补救课程
 * - 错误分析与分类
 * - 补救策略推荐
 * 
 * 基于需求文档：english-learning-requirements-v0.4.0.md
 * 第 3.3.4 节 - 错误处理与补救课程生成
 */

import type { Course, Lesson } from '@/infrastructure/persistence/database';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 发音错误（ASR置信度<60% 或音素编辑距离>2） */
  PRONUNCIATION = 'PRONUNCIATION',
  /** 流利度问题（发音时长>预期×1.5 或停顿>3s） */
  FLUENCY = 'FLUENCY',
  /** 语法错误（文本校验失败或句法树异常） */
  GRAMMAR = 'GRAMMAR',
  /** 词汇问题（单词在用户词汇表中标记为"不会"） */
  VOCABULARY = 'VOCABULARY',
  /** 完整度问题（完成度<80% 或跳过句子） */
  COMPLETENESS = 'COMPLETENESS'
}

/**
 * 错误记录接口
 */
export interface ErrorRecord {
  lessonId: string;
  courseId: string;
  errorType: ErrorType;
  suggestedRemedialType: string;
  timestamp: Date;
  details: {
    confidence?: number; // ASR 置信度
    editDistance?: number; // 音素编辑距离
    duration?: number; // 发音时长
    text?: string; // 错误文本
    expected?: string; // 期望文本
  };
}

/**
 * 补救策略接口
 */
interface RemediationStrategy {
  type: string;
  description: string;
  courseTemplate: {
    title: string;
    description: string;
    difficulty?: string;
    tags: string[];
  };
  lessonGenerator: (errors: ErrorRecord[]) => Promise<Lesson[]>;
}

/**
 * 补救课程生成服务类
 */
export class RemediationCourseService {
  /** 错误触发阈值（累计错误数） */
  private readonly errorThreshold = 5;
  
  /** 补救策略映射表 */
  private strategies: Map<ErrorType, RemediationStrategy> = new Map([
    [ErrorType.PRONUNCIATION, {
      type: 'phoneme_training',
      description: '音素/音标强化训练',
      courseTemplate: {
        title: '发音纠正专项课程',
        description: '针对常见发音错误的专项训练',
        difficulty: 'beginner',
        tags: ['发音', '音标', '纠错', '补救']
      },
      lessonGenerator: this.generatePhonemeTrainingLessons.bind(this)
    }],
    
    [ErrorType.FLUENCY, {
      type: 'fluency_training',
      description: '流畅度强化训练',
      courseTemplate: {
        title: '流畅度提升课程',
        description: '改善连读、节奏和语速',
        difficulty: 'intermediate',
        tags: ['流畅度', '连读', '节奏', '补救']
      },
      lessonGenerator: this.generateFluencyTrainingLessons.bind(this)
    }],
    
    [ErrorType.GRAMMAR, {
      type: 'grammar_training',
      description: '语法专项训练',
      courseTemplate: {
        title: '语法强化课程',
        description: '针对语法薄弱点的专项练习',
        difficulty: 'intermediate',
        tags: ['语法', '句法', '纠错', '补救']
      },
      lessonGenerator: this.generateGrammarTrainingLessons.bind(this)
    }],
    
    [ErrorType.VOCABULARY, {
      type: 'vocabulary_training',
      description: '词汇上下文学习',
      courseTemplate: {
        title: '词汇强化课程',
        description: '在上下文中学习和巩固词汇',
        difficulty: 'beginner',
        tags: ['词汇', '单词', '记忆', '补救']
      },
      lessonGenerator: this.generateVocabularyTrainingLessons.bind(this)
    }],
    
    [ErrorType.COMPLETENESS, {
      type: 'simplified_training',
      description: '简化版鼓励性训练',
      courseTemplate: {
        title: '轻松巩固课程',
        description: '降低难度，重建信心',
        difficulty: 'beginner',
        tags: ['简化', '鼓励', '基础', '补救']
      },
      lessonGenerator: this.generateSimplifiedTrainingLessons.bind(this)
    }]
  ]);

  /**
   * 分析错误并判断是否需要生成补救课程
   */
  shouldGenerateRemediation(errors: ErrorRecord[]): boolean {
    return errors.length >= this.errorThreshold;
  }

  /**
   * 生成补救课程
   */
  async generateRemediationCourse(
    errors: ErrorRecord[],
    userId: string
  ): Promise<Course> {
    if (errors.length === 0) {
      throw new Error('没有错误记录，无需生成补救课程');
    }

    // 按错误类型分组
    const errorsByType = this.groupErrorsByType(errors);
    
    // 选择主要错误类型（数量最多的）
    const primaryErrorType = this.getPrimaryErrorType(errorsByType);
    const strategy = this.strategies.get(primaryErrorType);
    
    if (!strategy) {
      throw new Error(`未找到错误类型 ${primaryErrorType} 的补救策略`);
    }

    // 生成课程ID
    const courseId = `remedial_${primaryErrorType}_${Date.now()}`;
    
    // 生成课程内容
    const lessons = await strategy.lessonGenerator(errors);
    
    // 构建课程对象
    const course: Course = {
      id: courseId,
      ...strategy.courseTemplate,
      type: 'mixed',
      source: 'Remedial',
      modesEnabled: ['follow', 'dictation', 'translation'],
      lessons,
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        difficulty: strategy.courseTemplate.difficulty || 'beginner',
        tags: strategy.courseTemplate.tags,
        sourceErrors: errors.map(e => e.lessonId),
        remedialType: primaryErrorType
      },
      stats: {
        totalItems: lessons.length,
        completedItems: 0,
        accuracy: 0
      }
    };

    console.log(`[RemediationCourseService] 生成补救课程: ${course.title}`, course);
    
    return course;
  }

  /**
   * 按错误类型分组
   */
  private groupErrorsByType(errors: ErrorRecord[]): Map<ErrorType, ErrorRecord[]> {
    const grouped = new Map<ErrorType, ErrorRecord[]>();
    
    for (const error of errors) {
      if (!grouped.has(error.errorType)) {
        grouped.set(error.errorType, []);
      }
      grouped.get(error.errorType)!.push(error);
    }
    
    return grouped;
  }

  /**
   * 获取主要错误类型（数量最多的）
   */
  private getPrimaryErrorType(errorsByType: Map<ErrorType, ErrorRecord[]>): ErrorType {
    let maxCount = 0;
    let primaryType = ErrorType.PRONUNCIATION;
    
    for (const [type, errors] of errorsByType) {
      if (errors.length > maxCount) {
        maxCount = errors.length;
        primaryType = type;
      }
    }
    
    return primaryType;
  }

  /**
   * 生成音素训练课程内容
   */
  private async generatePhonemeTrainingLessons(errors: ErrorRecord[]): Promise<Lesson[]> {
    // TODO: 调用AI生成针对性音素练习
    // 这里先返回模拟数据
    const lessons: Lesson[] = errors.slice(0, 10).map((error, index) => ({
      id: `phoneme_lesson_${index}`,
      courseId: '',
      fields: {
        text: `Practice phoneme: ${error.details.expected || 'unknown'}`,
        translation: `音素练习：${error.details.expected || '未知'}`,
        phonetic: `/θɪŋk/`, // 示例音标
      },
      audioMeta: undefined
    }));
    
    return lessons;
  }

  /**
   * 生成流畅度训练课程内容
   */
  private async generateFluencyTrainingLessons(errors: ErrorRecord[]): Promise<Lesson[]> {
    // TODO: 调用AI生成连读和节奏练习
    const lessons: Lesson[] = errors.slice(0, 10).map((error, index) => ({
      id: `fluency_lesson_${index}`,
      courseId: '',
      fields: {
        text: 'Practice smooth reading and natural rhythm',
        translation: '练习流畅朗读和自然节奏',
      },
      audioMeta: undefined
    }));
    
    return lessons;
  }

  /**
   * 生成语法训练课程内容
   */
  private async generateGrammarTrainingLessons(errors: ErrorRecord[]): Promise<Lesson[]> {
    // TODO: 调用AI生成语法专项练习
    const lessons: Lesson[] = errors.slice(0, 10).map((error, index) => ({
      id: `grammar_lesson_${index}`,
      courseId: '',
      fields: {
        text: 'Grammar practice sentence',
        translation: '语法练习句子',
      },
      audioMeta: undefined
    }));
    
    return lessons;
  }

  /**
   * 生成词汇训练课程内容
   */
  private async generateVocabularyTrainingLessons(errors: ErrorRecord[]): Promise<Lesson[]> {
    // TODO: 调用AI生成词汇上下文练习
    const lessons: Lesson[] = errors.slice(0, 10).map((error, index) => ({
      id: `vocab_lesson_${index}`,
      courseId: '',
      fields: {
        text: 'Vocabulary in context',
        translation: '词汇情境练习',
        word: error.details.text || 'unknown',
      },
      audioMeta: undefined
    }));
    
    return lessons;
  }

  /**
   * 生成简化训练课程内容
   */
  private async generateSimplifiedTrainingLessons(errors: ErrorRecord[]): Promise<Lesson[]> {
    // TODO: 生成降低难度的鼓励性练习
    const lessons: Lesson[] = errors.slice(0, 10).map((error, index) => ({
      id: `simplified_lesson_${index}`,
      courseId: '',
      fields: {
        text: 'Easy practice sentence',
        translation: '简单练习句子',
      },
      audioMeta: undefined
    }));
    
    return lessons;
  }

  /**
   * 获取错误类型的可读描述
   */
  getErrorTypeDescription(type: ErrorType): string {
    const strategy = this.strategies.get(type);
    return strategy?.description || '未知错误类型';
  }
}
