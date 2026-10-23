/**
 * RecommendationService 实现
 * 职责：基于学生能力和学习历史推荐课程
 */

import {
  IRecommendationService,
  RecommendedCourse,
  RecommendationResult,
} from '../../domain/services/IRecommendationService';
import { LanguageAbilityAggregate } from '../../domain/aggregates/LanguageAbilityAggregate';

/**
 * 推荐服务实现
 * 算法：基于学生难度和准确率推荐合适的课程
 */
export class RecommendationService implements IRecommendationService {
  // 难度序列 (CEFR)
  private readonly levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

  // 模拟课程数据库
  private readonly courseDatabase = this.initializeCourseDatabase();

  /**
   * 根据学生能力推荐课程
   */
  async recommendCourses(
    ability: LanguageAbilityAggregate,
    limit: number = 5
  ): Promise<RecommendationResult> {
    const userId = ability.getUserId();
    const currentLevel = ability.getCurrentDifficulty();
    // 使用 getMetrics().getAverageAccuracy() 获取平均准确率
    const recentAccuracy = ability.getMetrics().getAverageAccuracy();

    // 计算推荐难度，将 Difficulty 对象转为字符串
    const suggestedLevel = this.calculateSuggestedLevel(currentLevel.toString(), recentAccuracy);

    // 获取匹配难度的课程
    const matchingCourses = this.courseDatabase.filter(
      (c) => c.difficulty === suggestedLevel
    );

    // 计算关联度评分并排序
    const scoredCourses = matchingCourses.map((course) => ({
      ...course,
      relevanceScore: this.calculateRelevance(ability, course),
    }));

    const sorted = scoredCourses.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const recommended = sorted.slice(0, limit);

    return {
      userId,
      recommendedAt: new Date(),
      courses: recommended as RecommendedCourse[],
      nextRecommendationDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 天后
    };
  }

  /**
   * 推荐补救课程
   */
  async recommendRemediationCourses(
    ability: LanguageAbilityAggregate,
    errorPatterns: Array<{ errorType: string; count: number }>
  ): Promise<RecommendationResult> {
    const userId = ability.getUserId();
    const currentLevel = ability.getCurrentDifficulty();

    // 获取主要错误类型
    const mainErrors = errorPatterns
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map((e) => e.errorType);

    // 查询补救课程
    const remediationCourses = this.courseDatabase.filter(
      (c) =>
        c.difficulty === currentLevel.toString() &&
        c.tags.some((t) => t.includes('补救') || mainErrors.some((e) => c.title.includes(e)))
    );

    const scored = remediationCourses.map((course) => ({
      ...course,
      relevanceScore: mainErrors.some((e) => course.title.includes(e)) ? 0.9 : 0.6,
    }));

    const sorted = scored.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const recommended = sorted.slice(0, 5);

    return {
      userId,
      recommendedAt: new Date(),
      courses: recommended as RecommendedCourse[],
      nextRecommendationDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 天
    };
  }

  /**
   * 获取上次推荐
   */
  async getLastRecommendation(userId: string): Promise<RecommendationResult | null> {
    // 在实际实现中应从缓存/数据库获取
    // 这里返回 null 表示没有缓存
    return null;
  }

  /**
   * 计算推荐难度
   * 规则：>85% 升 1 级，<70% 降 1 级
   */
  private calculateSuggestedLevel(currentLevel: string, accuracy: number): string {
    const idx = this.levels.indexOf(currentLevel as any);

    if (accuracy > 85 && idx < this.levels.length - 1) {
      return this.levels[idx + 1]; // 升级
    } else if (accuracy < 70 && idx > 0) {
      return this.levels[idx - 1]; // 降级
    }

    return currentLevel; // 保持
  }

  /**
   * 计算课程关联度 (0-1)
   * 考虑：难度匹配 (40%) + 主题相关 (30%) + 新鲜度 (30%)
   */
  private calculateRelevance(ability: LanguageAbilityAggregate, course: any): number {
    let score = 0;

    // 1. 难度匹配 (40%)
    const diffScore = ability.getCurrentDifficulty() === course.difficulty ? 1.0 : 0.5;
    score += diffScore * 0.4;

    // 2. 主题相关 (30%) - 简化：所有课程都相关
    score += 0.8 * 0.3;

    // 3. 新鲜度 (30%) - 简化：所有课程都新鲜
    score += 0.8 * 0.3;

    return score;
  }

  /**
   * 初始化课程数据库
   */
  private initializeCourseDatabase() {
    return [
      // A1 级课程
      {
        courseId: 'a1_greetings',
        title: 'A1 - Greetings and Introductions',
        difficulty: 'A1',
        estimatedDuration: 30,
        reason: '基础问候语学习',
        tags: ['基础', '日常交流'],
      },
      {
        courseId: 'a1_numbers',
        title: 'A1 - Numbers 0-100',
        difficulty: 'A1',
        estimatedDuration: 25,
        reason: '数字表达基础',
        tags: ['基础', '数字'],
      },
      {
        courseId: 'a1_family',
        title: 'A1 - Family Members',
        difficulty: 'A1',
        estimatedDuration: 35,
        reason: '家庭成员词汇',
        tags: ['基础', '词汇'],
      },
      {
        courseId: 'a1_colors',
        title: 'A1 - Colors',
        difficulty: 'A1',
        estimatedDuration: 20,
        reason: '颜色词汇学习',
        tags: ['基础', '颜色'],
      },

      // A2 级课程
      {
        courseId: 'a2_daily_life',
        title: 'A2 - Daily Life Activities',
        difficulty: 'A2',
        estimatedDuration: 40,
        reason: '日常生活表达',
        tags: ['初级', '日常'],
      },
      {
        courseId: 'a2_past_tense',
        title: 'A2 - Past Tense Basics',
        difficulty: 'A2',
        estimatedDuration: 45,
        reason: '过去时态入门',
        tags: ['初级', '语法', '补救'],
      },
      {
        courseId: 'a2_shopping',
        title: 'A2 - Shopping and Money',
        difficulty: 'A2',
        estimatedDuration: 35,
        reason: '购物实用表达',
        tags: ['初级', '实用'],
      },

      // B1 级课程
      {
        courseId: 'b1_travel',
        title: 'B1 - Travel and Tourism',
        difficulty: 'B1',
        estimatedDuration: 50,
        reason: '旅游话题深化',
        tags: ['中级', '旅游'],
      },
      {
        courseId: 'b1_conditionals',
        title: 'B1 - Conditional Sentences',
        difficulty: 'B1',
        estimatedDuration: 55,
        reason: '条件句复杂用法',
        tags: ['中级', '语法', '补救'],
      },
      {
        courseId: 'b1_work',
        title: 'B1 - Work and Employment',
        difficulty: 'B1',
        estimatedDuration: 45,
        reason: '职场沟通技能',
        tags: ['中级', '职场'],
      },

      // B2 级课程
      {
        courseId: 'b2_business',
        title: 'B2 - Business English',
        difficulty: 'B2',
        estimatedDuration: 60,
        reason: '商务英语专业表达',
        tags: ['高级', '商务'],
      },
      {
        courseId: 'b2_literature',
        title: 'B2 - Literature and Culture',
        difficulty: 'B2',
        estimatedDuration: 70,
        reason: '文学和文化欣赏',
        tags: ['高级', '文化'],
      },
    ];
  }
}

/**
 * 工厂函数
 */
export function createRecommendationService(): IRecommendationService {
  return new RecommendationService();
}
