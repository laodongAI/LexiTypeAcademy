/**
 * publisherQueryService 实现
 * 职责：查询出版社教材库，支持四步导航（出版社 → 课程系列 → 单元 → 生成课程）
 */

import {
  IPublisherQueryService,
  Publisher,
  Curriculum,
  CourseUnit,
  GenerateOptions,
} from '../../domain/services/IPublisherQueryService';

/**
 * 出版社查询服务实现
 * 采用缓存策略减少 LLM API 调用
 */
export class PublisherQueryService implements IPublisherQueryService {
  private cache = new Map<string, { data: any; expiresAt: number }>();

  /**
   * 获取所有可用出版社
   */
  async getAvailablePublishers(): Promise<Publisher[]> {
    const cacheKey = 'publishers';

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    // 模拟出版社库
    const publishers: Publisher[] = [
      {
        id: 'pep',
        name: '人教版 (PEP)',
        description: '中国小学英语教材标准',
        logoUrl: 'https://example.com/pep.png',
      },
      {
        id: 'fltrp',
        name: '外研社 (FLTRP)',
        description: '中国外语教学与研究出版社',
        logoUrl: 'https://example.com/fltrp.png',
      },
      {
        id: 'cambridge',
        name: '剑桥英语',
        description: '国际英语教学标准',
        logoUrl: 'https://example.com/cambridge.png',
      },
      {
        id: 'new_concept',
        name: '新概念英语',
        description: '经典英语学习教材',
        logoUrl: 'https://example.com/new_concept.png',
      },
    ];

    // 缓存 30 天
    this.cache.set(cacheKey, {
      data: publishers,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
    });

    return publishers;
  }

  /**
   * 查询出版社下的课程系列
   */
  async queryCurricula(publisherId: string): Promise<Curriculum[]> {
    const cacheKey = `curricula_${publisherId}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    // 模拟课程系列
    let curricula: Curriculum[] = [];

    switch (publisherId) {
      case 'pep':
        curricula = [
          {
            id: 'pep_g3',
            publisherId,
            name: 'PEP 小学英语三年级',
            description: '人教版小学三年级英语',
            gradeLevel: 'Grade 3',
            targetAudience: '小学生',
          },
          {
            id: 'pep_g4',
            publisherId,
            name: 'PEP 小学英语四年级',
            description: '人教版小学四年级英语',
            gradeLevel: 'Grade 4',
            targetAudience: '小学生',
          },
          {
            id: 'pep_g5',
            publisherId,
            name: 'PEP 小学英语五年级',
            description: '人教版小学五年级英语',
            gradeLevel: 'Grade 5',
            targetAudience: '小学生',
          },
        ];
        break;

      case 'cambridge':
        curricula = [
          {
            id: 'cam_yle',
            publisherId,
            name: 'Cambridge Young Learners',
            description: '剑桥国际儿童英语',
            gradeLevel: 'A1-A2',
            targetAudience: '儿童',
          },
        ];
        break;

      case 'new_concept':
        curricula = [
          {
            id: 'nc_book1',
            publisherId,
            name: '新概念英语第一册',
            description: '英语基础入门',
            gradeLevel: 'A1',
            targetAudience: '初学者',
          },
          {
            id: 'nc_book2',
            publisherId,
            name: '新概念英语第二册',
            description: '英语初级应用',
            gradeLevel: 'A2-B1',
            targetAudience: '初级学习者',
          },
        ];
        break;

      default:
        curricula = [
          {
            id: `${publisherId}_default`,
            publisherId,
            name: '默认课程系列',
            description: '默认课程系列',
            gradeLevel: 'A1',
            targetAudience: '通用',
          },
        ];
    }

    // 缓存 7 天
    this.cache.set(cacheKey, {
      data: curricula,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });

    return curricula;
  }

  /**
   * 查询课程系列下的单元
   */
  async queryUnits(publisherId: string, curriculumId: string): Promise<CourseUnit[]> {
    const cacheKey = `units_${publisherId}_${curriculumId}`;

    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (Date.now() < cached.expiresAt) {
        return cached.data;
      }
    }

    // 模拟单元列表
    const units: CourseUnit[] = [
      {
        id: `${curriculumId}_unit1`,
        curriculumId,
        title: 'Unit 1: Greetings',
        description: '问候语和自我介绍',
        keywords: ['hello', 'hi', 'goodbye', 'thank you'],
        pageRange: '1-5',
      },
      {
        id: `${curriculumId}_unit2`,
        curriculumId,
        title: 'Unit 2: Numbers',
        description: '数字和计数',
        keywords: ['one', 'two', 'three', 'count'],
        pageRange: '6-10',
      },
      {
        id: `${curriculumId}_unit3`,
        curriculumId,
        title: 'Unit 3: Family',
        description: '家庭成员',
        keywords: ['mother', 'father', 'sister', 'brother'],
        pageRange: '11-15',
      },
    ];

    // 缓存 1 天
    this.cache.set(cacheKey, {
      data: units,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    });

    return units;
  }

  /**
   * 从教材单元生成课程
   */
  async generateCourseFromUnit(
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
  }> {
    // 获取单元信息
    const units = await this.queryUnits(publisherId, curriculumId);
    const unit = units.find((u) => u.id === unitId);

    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    // 生成课程（简化版）
    return {
      title: unit.title,
      description: unit.description,
      difficulty: 'A1',
      lessons: [
        {
          title: `${unit.title} - Lesson 1`,
          text: 'Hello everyone. Welcome!',
          translation: '大家好。欢迎！',
          vocabulary: unit.keywords.map((word) => ({
            word,
            pronunciation: `/${word}/`,
            meaning: `${word}的意思`,
            level: 'A1',
          })),
        },
      ],
      metadata: {
        publisherId,
        curriculumId,
        unitId,
        generatedAt: new Date(),
      },
    };
  }

  /**
   * 获取单元预览
   */
  async getUnitPreview(
    publisherId: string,
    curriculumId: string,
    unitId: string
  ): Promise<{
    title: string;
    content: string;
    vocabulary: string[];
    estimatedDuration: number;
  }> {
    const units = await this.queryUnits(publisherId, curriculumId);
    const unit = units.find((u) => u.id === unitId);

    if (!unit) {
      throw new Error(`Unit ${unitId} not found`);
    }

    return {
      title: unit.title,
      content: unit.description,
      vocabulary: unit.keywords,
      estimatedDuration: 45, // 分钟
    };
  }

  /**
   * 清除缓存
   */
  async clearCache(): Promise<void> {
    this.cache.clear();
    console.log('出版社查询服务缓存已清除');
  }
}

/**
 * 工厂方法
 */
export function createPublisherQueryService(): IPublisherQueryService {
  return new PublisherQueryService();
}
