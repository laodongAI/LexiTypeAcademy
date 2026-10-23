/**
 * 课程数据模型扩展
 * 
 * 新增字段：
 * - source: 课程来源和创建信息
 * - permissions: 权限控制
 * - status: 课程状态
 * - visibility: 可见性
 * - metadata: 扩展元数据
 */

// ========== 类型定义 ==========

/**
 * 课程来源类型
 */
export type CourseSourceType =
  | 'system'           // 系统预设
  | 'ai_generated'     // AI生成
  | 'user_created'     // 用户创建
  | 'imported'         // 导入
  | 'audio_import'     // 音频导入
  | 'material_parsed'; // 教材解析

/**
 * 课程来源信息
 */
export interface CourseSource {
  /** 来源类型 */
  type: CourseSourceType;
  /** 创建者ID */
  creator?: string;
  /** AI任务ID（用于追溯） */
  generatorTask?: string;
  /** 导入来源文件名 */
  importedFrom?: string;
  /** 原始课程ID（用于复制/派生） */
  originalCourseId?: string;
  /** 额外描述 */
  description?: string;
}

/**
 * 课程权限
 */
export interface CoursePermissions {
  /** 是否可编辑 */
  editable: boolean;
  /** 是否可删除 */
  deletable: boolean;
  /** 是否可导出 */
  exportable: boolean;
  /** 是否可分享 */
  shareable: boolean;
}

/**
 * 课程状态
 */
export type CourseStatus = 'active' | 'archived' | 'draft';

/**
 * 课程可见性
 */
export type CourseVisibility = 'private' | 'public' | 'shared';

/**
 * 课程扩展元数据
 */
export interface CourseMetadata {
  /** 预估完成时间（分钟） */
  estimatedDuration?: number;
  /** 词汇量 */
  vocabularyCount?: number;
  /** 句子数 */
  sentenceCount?: number;
  /** 音频来源 */
  audioSource?: string;
  /** AI模型版本 */
  aiModel?: string;
  /** 课程版本号 */
  version?: number;
}

/**
 * 课程统计信息
 */
export interface CourseStats {
  /** 练习次数 */
  practiceCount?: number;
  /** 平均准确率 */
  avgAccuracy?: number;
  /** 平均WPM */
  avgWpm?: number;
  /** 已完成课时ID列表 */
  completedLessons?: string[];
  /** 最后练习时间 */
  lastPracticeAt?: string;
  /** 总学习时长（秒） */
  totalDuration?: number;
}

/**
 * 扩展的课程接口
 */
export interface EnhancedCourse {
  // 基础信息
  id: string;
  title: string;
  description?: string;
  
  // 分类信息
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  type: 'text' | 'words' | 'mixed';
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  tags: string[];
  
  // 来源与权限
  source: CourseSource;
  permissions: CoursePermissions;
  
  // 状态
  status: CourseStatus;
  visibility: CourseVisibility;
  
  // 课时数据
  lessons: any[]; // 保持原有Lesson类型
  stats?: CourseStats;
  
  // 时间戳
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  
  // 扩展信息
  metadata?: CourseMetadata;
}

// ========== 权限规则 ==========

/**
 * 权限规则定义
 */
export interface PermissionRule {
  editable: boolean;
  deletable: boolean;
  exportable: boolean;
  shareable: boolean;
  description: string;
}

/**
 * 课程来源权限规则矩阵
 */
export const PERMISSION_RULES: Record<CourseSourceType, PermissionRule> = {
  system: {
    editable: false,
    deletable: false,
    exportable: true,
    shareable: true,
    description: '系统预设课程，只读不可删除'
  },
  ai_generated: {
    editable: false,
    deletable: true,
    exportable: true,
    shareable: true,
    description: 'AI生成课程，可删除但不可编辑（保证AI内容完整性）'
  },
  user_created: {
    editable: true,
    deletable: true,
    exportable: true,
    shareable: true,
    description: '用户手动创建，拥有完全控制权'
  },
  imported: {
    editable: true,
    deletable: true,
    exportable: true,
    shareable: true,
    description: '导入课程，视为用户内容可完全编辑'
  },
  audio_import: {
    editable: false,
    deletable: true,
    exportable: true,
    shareable: true,
    description: '音频导入课程，不可编辑（保持音频同步）'
  },
  material_parsed: {
    editable: false,
    deletable: true,
    exportable: true,
    shareable: false,
    description: '教材解析课程，不可编辑（版权考虑）'
  }
};

/**
 * 获取课程权限
 */
export function getCoursePermissions(sourceType: CourseSourceType): CoursePermissions {
  const rule = PERMISSION_RULES[sourceType];
  return {
    editable: rule.editable,
    deletable: rule.deletable,
    exportable: rule.exportable,
    shareable: rule.shareable
  };
}

/**
 * 检查课程是否可编辑
 */
export function canEditCourse(course: { source?: CourseSource | string }): boolean {
  // 处理旧格式：source 为 string 或 undefined
  if (!course.source || typeof course.source === 'string') {
    return true; // 旧课程默认可编辑
  }
  
  // 新格式：source 为 CourseSource 对象
  return PERMISSION_RULES[course.source.type]?.editable ?? true;
}

/**
 * 检查课程是否可删除
 */
export function canDeleteCourse(course: { source?: CourseSource | string }): boolean {
  // 处理旧格式：source 为 string 或 undefined
  if (!course.source || typeof course.source === 'string') {
    return true; // 旧课程默认可删除
  }
  
  // 新格式：source 为 CourseSource 对象
  return PERMISSION_RULES[course.source.type]?.deletable ?? true;
}

/**
 * 检查课程是否可导出
 */
export function canExportCourse(course: { source?: CourseSource | string }): boolean {
  // 处理旧格式：source 为 string 或 undefined
  if (!course.source || typeof course.source === 'string') {
    return true; // 旧课程默认可导出
  }
  
  // 新格式：source 为 CourseSource 对象
  return PERMISSION_RULES[course.source.type]?.exportable ?? true;
}

/**
 * 检查课程是否可分享
 */
export function canShareCourse(course: { source?: CourseSource | string }): boolean {
  // 处理旧格式：source 为 string 或 undefined
  if (!course.source || typeof course.source === 'string') {
    return true; // 旧课程默认可分享
  }
  
  // 新格式：source 为 CourseSource 对象
  return PERMISSION_RULES[course.source.type]?.shareable ?? true;
}

/**
 * 获取权限规则描述
 */
export function getPermissionDescription(sourceType: CourseSourceType): string {
  return PERMISSION_RULES[sourceType].description;
}

// ========== 课程分类 ==========

/**
 * 课程分类定义
 */
export interface CourseCategory {
  id: string;
  name: string;
  icon: string;
  filter: (course: EnhancedCourse) => boolean;
  count?: number;
  children?: CourseCategory[];
}

/**
 * 预定义课程分类
 */
export const COURSE_CATEGORIES: CourseCategory[] = [
  {
    id: 'all',
    name: '全部课程',
    icon: '📚',
    filter: () => true
  },
  {
    id: 'my-courses',
    name: '我的创作',
    icon: '✍️',
    filter: (c) => c.source.type === 'user_created' || c.source.type === 'imported',
    children: [
      {
        id: 'my-created',
        name: '手动创建',
        icon: '📝',
        filter: (c) => c.source.type === 'user_created'
      },
      {
        id: 'my-imported',
        name: '导入课程',
        icon: '📥',
        filter: (c) => c.source.type === 'imported'
      }
    ]
  },
  {
    id: 'ai-generated',
    name: 'AI 生成',
    icon: '🤖',
    filter: (c) => 
      c.source.type === 'ai_generated' || 
      c.source.type === 'audio_import' || 
      c.source.type === 'material_parsed',
    children: [
      {
        id: 'ai-text',
        name: 'AI文本生成',
        icon: '✨',
        filter: (c) => c.source.type === 'ai_generated'
      },
      {
        id: 'audio-import',
        name: '音频导入',
        icon: '🎵',
        filter: (c) => c.source.type === 'audio_import'
      },
      {
        id: 'material',
        name: '教材解析',
        icon: '📖',
        filter: (c) => c.source.type === 'material_parsed'
      }
    ]
  },
  {
    id: 'system',
    name: '系统预设',
    icon: '⭐',
    filter: (c) => c.source.type === 'system'
  },
  {
    id: 'archived',
    name: '已归档',
    icon: '📦',
    filter: (c) => c.status === 'archived'
  }
];

/**
 * 获取分类的课程数量
 */
export function getCategoryCount(
  courses: EnhancedCourse[],
  categoryId: string
): number {
  const category = findCategory(COURSE_CATEGORIES, categoryId);
  if (!category) return 0;
  return courses.filter(category.filter).length;
}

/**
 * 查找分类
 */
function findCategory(
  categories: CourseCategory[],
  categoryId: string
): CourseCategory | null {
  for (const category of categories) {
    if (category.id === categoryId) return category;
    if (category.children) {
      const found = findCategory(category.children, categoryId);
      if (found) return found;
    }
  }
  return null;
}

// ========== 工具函数 ==========

/**
 * 推断课程来源类型（用于数据迁移）
 */
export function inferSourceType(course: any): CourseSourceType {
  const source = course.source;
  
  // 根据source字段推断
  if (typeof source === 'string') {
    if (source.includes('示例') || source.includes('预设')) return 'system';
    if (source.includes('AI') || source.includes('生成')) return 'ai_generated';
    if (source.includes('音频') || source.includes('导入')) return 'audio_import';
    if (source.includes('教材') || source.includes('解析')) return 'material_parsed';
    if (source.includes('导入')) return 'imported';
  }
  
  // 根据其他字段推断
  if (course.metadata?.aiModel) return 'ai_generated';
  if (course.metadata?.audioSource) return 'audio_import';
  
  // 默认为用户创建
  return 'user_created';
}

/**
 * 估算课程学习时长（分钟）
 */
export function estimateDuration(course: any): number {
  const lessonCount = course.lessons?.length || 0;
  const avgTimePerLesson = 3; // 每课时平均3分钟
  return lessonCount * avgTimePerLesson;
}

/**
 * 计算词汇量
 */
export function countVocabulary(course: any): number {
  if (!course.lessons) return 0;
  
  const uniqueWords = new Set<string>();
  
  for (const lesson of course.lessons) {
    if (lesson.words && Array.isArray(lesson.words)) {
      lesson.words.forEach((w: any) => {
        if (w.word) uniqueWords.add(w.word.toLowerCase());
      });
    }
    
    // 从句子中提取单词
    if (lesson.content && typeof lesson.content === 'string') {
      const words = lesson.content
        .toLowerCase()
        .match(/\b[a-z]+\b/g) || [];
      words.forEach((w: string) => uniqueWords.add(w));
    }
  }
  
  return uniqueWords.size;
}

/**
 * 创建默认课程来源
 */
export function createDefaultSource(
  type: CourseSourceType,
  options: Partial<CourseSource> = {}
): CourseSource {
  return {
    type,
    creator: 'system',
    ...options
  };
}

/**
 * 创建增强课程对象
 */
export function createEnhancedCourse(
  baseCourse: any,
  sourceType: CourseSourceType
): EnhancedCourse {
  return {
    ...baseCourse,
    source: createDefaultSource(sourceType, {
      description: baseCourse.source
    }),
    permissions: getCoursePermissions(sourceType),
    status: 'active' as CourseStatus,
    visibility: 'private' as CourseVisibility,
    tags: baseCourse.tags || [],
    metadata: {
      estimatedDuration: estimateDuration(baseCourse),
      vocabularyCount: countVocabulary(baseCourse),
      sentenceCount: baseCourse.lessons?.length || 0,
      version: 1
    }
  };
}

/**
 * 获取来源类型的中文标签
 */
export function getSourceTypeLabel(type: CourseSourceType): string {
  const labels: Record<CourseSourceType, string> = {
    system: '系统预设',
    ai_generated: 'AI生成',
    user_created: '用户创建',
    imported: '导入课程',
    audio_import: '音频导入',
    material_parsed: '教材解析'
  };
  return labels[type] || type;
}
