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
  /** 例句中文翻译（可选，与 examples 等长） */
  exampleTranslations?: string[];
  /** 词根或词缀（可选，如 spect / re-） */
  root?: string;
  /** 词根含义（可选，如“看”） */
  rootMeaning?: string;
  /** 词根组标识（可选；显式指定时优先于 root 自动归组） */
  rootGroupId?: string;
  /** 词根角色（可选）：root=词根词，derived=派生词 */
  rootRole?: 'root' | 'derived';
  /** 拆解讲解（可选，如 in(向内)+spect(看)→检查） */
  explanation?: string;
  /** 讲解音频路径（可选；缺省时按需 TTS 合成） */
  explanationAudioPath?: string;
  /** 对话角色名（可选，仅 dialog 类型使用） */
  speaker?: string;
  /** 字幕起始时间（毫秒，可选，仅导入内容使用） */
  startMs?: number;
  /** 字幕结束时间（毫秒，可选，仅导入内容使用） */
  endMs?: number;
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
  /** 是否已加入我的学习列表（列表视图派生字段） */
  inLearningList?: boolean;
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
  /** 本次练习总题数（未采集时为空） */
  totalItems?: number;
  /** 本次练习答对题数（未采集时为空） */
  correctItems?: number;
  /** 打字速度（词/分钟，仅键盘输入类练习有值） */
  wpm?: number;
}

/**
 * 课程导入/导出格式
 */
export interface CourseExport {
  version: string;
  course: Course;
  exportedAt: number;
}
