/**
 * 通用类型定义
 */

/**
 * TTS 缓存项
 */
export interface TtsCacheItem {
  /** 缓存ID */
  id?: number;
  /** 文本内容 */
  text: string;
  /** TTS 模型名称 */
  model: string;
  /** 音频数据（Blob） */
  audioBlob: Blob;
  /** 创建时间 */
  createdAt: number;
}

/**
 * 打字记录
 */
export interface TypingRecord {
  /** 记录ID */
  id?: number;
  /** 打字速度（WPM） */
  wpm: number;
  /** 准确率 */
  accuracy: number;
  /** 练习日期 */
  date: number;
  /** 练习类型 */
  practiceType: 'typing' | 'finger' | 'pinyin' | 'review';
  /** 难度 */
  difficulty: string;
  /** 练习的单词（可选） */
  word?: string;
  /** 来源（可选） */
  source?: string;
}

/**
 * 学习记录
 */
export interface LearningRecord {
  /** 记录ID */
  id?: number;
  /** 用户ID */
  userId?: string;
  /** 课程ID */
  courseId?: string;
  /** 课时ID */
  lessonId?: string;
  /** 活动类型（lesson-feedback 为课堂完成点评记录） */
  activityType: 'practice' | 'review' | 'game' | 'typing' | 'lesson-feedback';
  /** 分数 */
  score: number;
  /** 准确率 */
  accuracy?: number;
  /** 耗时（毫秒） */
  duration: number;
  /** 创建时间 */
  createdAt: number;
  /** 额外数据 */
  metadata?: Record<string, any>;
}

/**
 * 成就记录
 */
export interface Achievement {
  /** 成就ID */
  id?: number;
  /** 成就类型 */
  type: string;
  /** 成就名称 */
  name: string;
  /** 成就描述 */
  description: string;
  /** 获得时间 */
  unlockedAt: number;
  /** 课程ID（可选） */
  courseId?: string;
  /** 课时ID（可选） */
  lessonId?: string;
}

/**
 * 用户设置
 */
export interface UserSettings {
  /** 语言 */
  language: 'zh-CN' | 'en-US';
  /** 主题 */
  theme: 'light' | 'dark' | 'auto';
  /** 字体大小 */
  fontSize: number;
  /** 音频音量 */
  audioVolume: number;
  /** 是否自动播放音频 */
  autoPlayAudio: boolean;
  /** TTS 语音 */
  ttsVoice: string;
  /** AI 配置 */
  aiConfig?: {
    apiKey: string;
    baseUrl: string;
    model: string;
  };
}

/**
 * AI 任务日志
 */
export interface AITaskLog {
  /** 任务ID */
  id?: number;
  /** 任务类型 */
  type: 'course_generation' | 'audio_import' | 'textbook_import' | 'weakword_remediation' | 'conversation_session' | 'learning_event';
  /** 任务状态 */
  status: 'pending' | 'running' | 'completed' | 'failed';
  /** 输入参数 */
  input: Record<string, any>;
  /** 输出结果 */
  output?: Record<string, any>;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;
  /** 完成时间 */
  completedAt?: number;
}
