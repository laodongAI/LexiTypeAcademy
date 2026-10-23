/**
 * 推荐服务接口
 * 
 * 职责：基于学生能力和学习历史，推荐最合适的课程和补救策略
 * 实现者：使用 AI Lab 服务实现
 */

import { LanguageAbilityAggregate } from '../aggregates/LanguageAbilityAggregate';

export interface RecommendedCourse {
  courseId: string;
  title: string;
  difficulty: string;
  estimatedDuration: number;
  reason: string; // 推荐原因
  relevanceScore: number; // 0-100
}

export interface RecommendationResult {
  userId: string;
  recommendedAt: Date;
  courses: RecommendedCourse[];
  nextRecommendationDate: Date;
}

export interface IRecommendationService {
  /**
   * 根据学生能力推荐课程
   */
  recommendCourses(
    ability: LanguageAbilityAggregate,
    limit?: number
  ): Promise<RecommendationResult>;

  /**
   * 基于错题历史推荐补救课程
   */
  recommendRemediationCourses(
    ability: LanguageAbilityAggregate,
    errorPatterns: Array<{ errorType: string; count: number }>
  ): Promise<RecommendationResult>;

  /**
   * 获取用户上次的推荐记录
   */
  getLastRecommendation(userId: string): Promise<RecommendationResult | null>;
}
