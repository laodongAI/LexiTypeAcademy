/**
 * 出版社查询服务接口
 * 
 * 职责：查询出版社教材信息和生成教材课程
 * 实现者：使用 LLM API 实现
 */

export interface Publisher {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
}

export interface Curriculum {
  id: string;
  publisherId: string;
  name: string;
  description: string;
  gradeLevel: string;
  targetAudience: string;
}

export interface CourseUnit {
  id: string;
  curriculumId: string;
  title: string;
  description: string;
  keywords: string[];
  pageRange?: string;
}

export interface GenerateOptions {
  includeVocabulary?: boolean;
  includeSentences?: boolean;
  includeDialogue?: boolean;
  difficulty?: string;
}

export interface IPublisherQueryService {
  /**
   * 获取所有支持的出版社列表
   */
  getAvailablePublishers(): Promise<Publisher[]>;

  /**
   * 查询指定出版社的课程系列
   */
  queryCurricula(publisherId: string): Promise<Curriculum[]>;

  /**
   * 查询课程系列下的单元列表
   */
  queryUnits(publisherId: string, curriculumId: string): Promise<CourseUnit[]>;

  /**
   * 从教材单元生成完整课程
   * 流程：检索单元内容 → AI 分析 → 生成课程结构 → 生成音频 → 验证
   */
  generateCourseFromUnit(
    publisherId: string,
    curriculumId: string,
    unitId: string,
    options?: GenerateOptions
  ): Promise<{
    title: string;
    description: string;
    difficulty: string;
    lessons: any[];
    metadata: Record<string, any>;
  }>;

  /**
   * 获取单元的详细内容（用于预览）
   */
  getUnitPreview(
    publisherId: string,
    curriculumId: string,
    unitId: string
  ): Promise<{
    title: string;
    content: string;
    vocabulary: string[];
    estimatedDuration: number;
  }>;

  /**
   * 缓存管理：清除过期的出版社数据缓存
   */
  clearCache(): Promise<void>;
}
