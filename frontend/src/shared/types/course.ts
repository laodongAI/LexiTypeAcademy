/**
 * 课程相关类型定义
 */

/**
 * 内容形态枚举
 * 定义学习内容的不同类型
 */
export enum ContentShape {
  /** 单词 */
  Word = 'word',
  /** 短语 */
  Phrase = 'phrase',
  /** 句子 */
  Sentence = 'sentence',
  /** 段落 */
  Passage = 'passage',
  /** 对话 */
  Dialog = 'dialog'
}

/**
 * CEFR 等级
 */
export enum CEFRLevel {
  A1 = 'A1',
  A2 = 'A2',
  B1 = 'B1',
  B2 = 'B2',
  C1 = 'C1',
  C2 = 'C2'
}

/**
 * 课程难度
 */
export type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

/**
 * 课程分类
 */
export type CourseCategory = 'basic' | 'advanced' | 'special';

/**
 * 练习模式
 */
export enum PracticeMode {
  /** 听写模式 */
  Dictation = 'dictation',
  /** 跟读模式 */
  FollowRead = 'follow',
  /** 翻译模式 */
  Translation = 'translation',
  /** 模仿模式 */
  Imitation = 'imitation'
}

/**
 * 课时项目接口
 */
export interface LessonItem {
  /** 项目ID */
  id: string;
  /** 英文内容 */
  english: string;
  /** 中文翻译 */
  chinese: string;
  /** 音频路径（可选） */
  audioPath?: string;
  /** 音标（可选） */
  phonetic?: string;
  /** 词性（可选） */
  partOfSpeech?: string;
  /** 例句（可选） */
  examples?: string[];
}

/**
 * 课时接口
 */
export interface Lesson {
  /** 课时ID */
  id: string;
  /** 课时标题 */
  title: string;
  /** 课时描述 */
  description?: string;
  /** 内容形态 */
  contentShape: ContentShape;
  /** 课时项目列表 */
  items: LessonItem[];
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 课程接口
 */
export interface Course {
  /** 课程ID */
  id: string;
  /** 课程标题 */
  title: string;
  /** 课程描述 */
  description: string;
  /** 课程分类 */
  category: CourseCategory;
  /** 难度等级 */
  difficulty: CourseDifficulty;
  /** CEFR 等级 */
  cefrLevel?: CEFRLevel;
  /** 课时列表 */
  lessons: Lesson[];
  /** 课时数量 */
  lessonCount: number;
  /** 标签 */
  tags?: string[];
  /** 封面图片 */
  coverImage?: string;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
  /** 是否为预置课程 */
  isPreset?: boolean;
  /** 作者 */
  author?: string;
}

/**
 * 课程元数据（列表显示用）
 */
export interface CourseMetadata {
  id: string;
  title: string;
  description: string;
  category: CourseCategory;
  difficulty: CourseDifficulty;
  lessonCount: number;
  tags?: string[];
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * 课程进度
 */
export interface CourseProgress {
  /** 课程ID */
  courseId: string;
  /** 已完成的课时ID列表 */
  completedLessonIds: string[];
  /** 当前学习的课时ID */
  currentLessonId?: string;
  /** 完成百分比 */
  completionPercentage: number;
  /** 最后学习时间 */
  lastStudiedAt: number;
}

/**
 * 练习记录
 */
export interface PracticeRecord {
  /** 记录ID */
  id?: number;
  /** 课程ID */
  courseId: string;
  /** 课时ID */
  lessonId: string;
  /** 练习模式 */
  mode: PracticeMode;
  /** 准确率 */
  accuracy: number;
  /** 耗时（毫秒） */
  duration: number;
  /** 完成时间 */
  completedAt: number;
  /** 错误的项目ID列表 */
  incorrectItemIds?: string[];
}

/**
 * 课程导入/导出格式
 */
export interface CourseExport {
  version: string;
  course: Course;
  exportedAt: number;
}
