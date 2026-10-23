/**
 * 语言能力仓储接口
 * 
 * 职责：管理 LanguageAbilityAggregate 的持久化和查询
 * 实现者：使用 Dexie IndexedDB 或其他存储后端
 */

import { LanguageAbilityAggregate } from '../aggregates/LanguageAbilityAggregate';

export interface ILanguageAbilityRepository {
  /**
   * 保存或更新学生的语言能力记录
   */
  save(ability: LanguageAbilityAggregate): Promise<void>;

  /**
   * 按用户 ID 查询语言能力记录
   */
  findByUserId(userId: string): Promise<LanguageAbilityAggregate | null>;

  /**
   * 删除指定用户的语言能力记录
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * 查询所有用户的语言能力记录（用于统计或迁移）
   */
  findAll(): Promise<LanguageAbilityAggregate[]>;
}
