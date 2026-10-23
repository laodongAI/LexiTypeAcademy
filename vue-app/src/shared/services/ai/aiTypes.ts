/**
 * AI 服务类型定义
 * 定义所有 AI 提供商的通用接口和类型
 */

// ========== 基础类型 ==========

/** AI 提供商类型 */
export type AIProvider = 'qwen' | 'openai' | 'volcengine' | 'deepseek' | 'custom';

/** AI 配置 */
export interface AIConfig {
  /** 提供商名称 */
  provider: AIProvider;
  /** API 密钥 */
  apiKey: string;
  /** API 端点 */
  endpoint: string;
  /** 模型名称 */
  model: string;
  /** 自定义提示词 */
  customPrompts?: Record<string, string>;
}

/** AI 请求选项 */
export interface AIOptions {
  /** 温度参数（0-1，控制随机性） */
  temperature?: number;
  /** 最大生成 token 数 */
  maxTokens?: number;
  /** 是否流式输出 */
  stream?: boolean;
  /** 请求超时时间（毫秒） */
  timeout?: number;
}

/** AI 消息 */
export interface AIMessage {
  /** 角色 */
  role: 'system' | 'user' | 'assistant';
  /** 消息内容 */
  content: string;
}

/** AI 响应 */
export interface AIResponse {
  /** 生成的内容 */
  content: string;
  /** Token 使用情况 */
  usage?: {
    /** 提示词 token 数 */
    promptTokens: number;
    /** 完成 token 数 */
    completionTokens: number;
    /** 总 token 数 */
    totalTokens: number;
  };
}

// ========== 课程生成相关 ==========

/** 课程生成请求 */
export interface CourseGenerationRequest {
  /** 课程主题 */
  topic: string;
  /** 难度级别 */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** 课时数量 */
  lessonCount: number;
  /** 每课单词数 */
  wordsPerLesson: number;
  /** 教学风格 */
  style?: string;
  /** 额外说明 */
  notes?: string;
}

/** 课程生成响应 */
export interface CourseGenerationResponse {
  /** 课程名称 */
  courseName: string;
  /** 课程描述 */
  description: string;
  /** 课时列表 */
  lessons: LessonData[];
}

/** 课时数据 */
export interface LessonData {
  /** 课时名称 */
  lessonName: string;
  /** 课时描述 */
  description: string;
  /** 单词列表 */
  words: WordEntry[];
}

// ========== 词汇相关 ==========

/** 词汇条目 */
export interface WordEntry {
  /** 单词 */
  word: string;
  /** 词义 */
  meaning?: string;
  /** 中文翻译 */
  translation?: string;
  /** 音标 */
  phonetic?: string;
  /** 例句 */
  example?: string;
  /** 例句翻译 */
  exampleTranslation?: string;
  /** 词性 */
  partOfSpeech?: string;
}

/** 词汇丰富请求 */
export interface VocabularyEnrichRequest {
  /** 单词列表 */
  words: string[];
  /** 是否包含例句 */
  includeExamples?: boolean;
  /** 是否包含音标 */
  includePhonetics?: boolean;
}

/** 词汇丰富响应 */
export interface VocabularyEnrichResponse {
  /** 丰富后的词汇列表 */
  words: WordEntry[];
}

// ========== 翻译相关 ==========

/** 翻译请求 */
export interface TranslationRequest {
  /** 待翻译文本 */
  text: string;
  /** 源语言 */
  sourceLang?: string;
  /** 目标语言 */
  targetLang?: string;
}

/** 翻译响应 */
export interface TranslationResponse {
  /** 翻译结果 */
  translation: string;
  /** 原文 */
  original: string;
}

// ========== 对话相关 ==========

/** 对话消息 */
export interface ConversationMessage {
  /** 角色 */
  role: 'user' | 'assistant';
  /** 消息内容 */
  content: string;
  /** 时间戳 */
  timestamp: number;
}

/** 对话上下文 */
export interface ConversationContext {
  /** 历史消息 */
  messages: ConversationMessage[];
  /** 系统提示词 */
  systemPrompt?: string;
}

// ========== 音频导入相关 ==========

/** 音频导入请求 */
export interface AudioImportRequest {
  /** 音频转录文本 */
  transcription: string;
  /** 生成课程选项 */
  courseOptions: {
    lessonCount: number;
    wordsPerLesson: number;
    level: 'beginner' | 'intermediate' | 'advanced';
  };
}

/** 教材导入请求 */
export interface TextbookImportRequest {
  /** 文本内容 */
  content: string;
  /** 导入选项 */
  options: {
    extractWords: boolean;
    generateExamples: boolean;
    lessonCount?: number;
  };
}

// ========== 写作助手相关 ==========

/** 写作检查请求 */
export interface WritingCheckRequest {
  /** 待检查文本 */
  text: string;
  /** 检查类型 */
  checkType: 'grammar' | 'spelling' | 'style' | 'all';
}

/** 写作检查响应 */
export interface WritingCheckResponse {
  /** 原文 */
  original: string;
  /** 修正后的文本 */
  corrected: string;
  /** 错误列表 */
  errors: WritingError[];
  /** 改进建议 */
  suggestions: string[];
}

/** 写作错误 */
export interface WritingError {
  /** 错误类型 */
  type: 'grammar' | 'spelling' | 'style';
  /** 错误位置 */
  position: { start: number; end: number };
  /** 错误内容 */
  text: string;
  /** 建议修正 */
  suggestion: string;
  /** 错误描述 */
  description: string;
}

// ========== 发音评估相关 ==========

/** 发音评估请求 */
export interface PronunciationTestRequest {
  /** 目标文本 */
  targetText: string;
  /** 用户音频（Base64 或 URL） */
  userAudio: string;
}

/** 发音评估响应 */
export interface PronunciationTestResponse {
  /** 总体评分（0-100） */
  overallScore: number;
  /** 详细评分 */
  scores: {
    accuracy: number;    // 准确度
    fluency: number;     // 流利度
    completeness: number; // 完整度
    pronunciation: number; // 发音
    prosody: number;     // 韵律
  };
  /** 单词级别反馈 */
  wordFeedback: Array<{
    word: string;
    score: number;
    issues: string[];
  }>;
  /** 改进建议 */
  suggestions: string[];
}

// ========== AI 教学引擎相关 ==========

export type TeachingErrorType =
  | 'SPELLING'
  | 'VOCAB_MEANING'
  | 'GRAMMAR'
  | 'PRONUNCIATION'
  | 'LISTENING'
  | 'SEMANTIC_INAPPROPRIATE'
  | 'FLUENCY'

export type TeachingMode = 'dictation' | 'imitation' | 'follow' | 'translation'

export type HintLevel = 0 | 1 | 2 | 3 | 4

export interface TeachingFeedbackRequest {
  mode: TeachingMode
  referenceText: string
  userText?: string
  chineseHint?: string
  attemptCount: number
  recognizedText?: string
  scoreDetail?: {
    overall: number
    accuracy: number
    fluency: number
    completeness: number
    pronunciation: number
  }
}

export interface TeachingFeedbackResponse {
  title: string
  summary: string
  strengths: string[]
  issues: Array<{
    type: TeachingErrorType
    severity: 1 | 2 | 3
    message: string
    suggestion: string
  }>
  nextSteps: string[]
  recommendedHintLevel: HintLevel
}

// ========== 词汇推荐相关 ==========

/** 词汇推荐请求 */
export interface VocabularyRecommendRequest {
  /** 用户级别 */
  userLevel: 'beginner' | 'intermediate' | 'advanced';
  /** 学习历史（已学单词） */
  learnedWords?: string[];
  /** 推荐数量 */
  count?: number;
  /** 主题偏好 */
  topics?: string[];
}

/** 词汇推荐响应 */
export interface VocabularyRecommendResponse {
  /** 推荐单词列表 */
  recommendations: Array<{
    word: string;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    relatedWords: string[];
  }>;
}

// ========== 错误处理 ==========

/** AI 错误 */
export class AIError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string
  ) {
    super(message);
    this.name = 'AIError';
  }
}

/** AI 错误代码 */
export enum AIErrorCode {
  INVALID_CONFIG = 'INVALID_CONFIG',
  API_KEY_MISSING = 'API_KEY_MISSING',
  REQUEST_FAILED = 'REQUEST_FAILED',
  TIMEOUT = 'TIMEOUT',
  RATE_LIMIT = 'RATE_LIMIT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
  PROVIDER_ERROR = 'PROVIDER_ERROR'
}
