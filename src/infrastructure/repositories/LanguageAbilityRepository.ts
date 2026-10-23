/**
 * 语言能力仓储实现
 * 
 * 基于 Dexie IndexedDB 存储 LanguageAbilityAggregate
 */

import { LanguageAbilityAggregate } from '../../domain/aggregates/LanguageAbilityAggregate';
import { ILanguageAbilityRepository } from '../../domain/repositories/ILanguageAbilityRepository';
import { getDB } from '../versioning/db';

export class LanguageAbilityRepository implements ILanguageAbilityRepository {
  /**
   * 保存或更新学生的语言能力记录
   */
  async save(ability: LanguageAbilityAggregate): Promise<void> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const data = ability.toJSON();
    await db.languageAbilities.put(data);
  }

  /**
   * 按用户 ID 查询语言能力记录
   */
  async findByUserId(userId: string): Promise<LanguageAbilityAggregate | null> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const record = await db.languageAbilities.get(userId);
    if (!record) {
      return null;
    }

    return LanguageAbilityAggregate.restore(record);
  }

  /**
   * 删除指定用户的语言能力记录
   */
  async deleteByUserId(userId: string): Promise<void> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    await db.languageAbilities.delete(userId);
  }

  /**
   * 查询所有用户的语言能力记录
   */
  async findAll(): Promise<LanguageAbilityAggregate[]> {
    const db = getDB();
    if (!db) {
      throw new Error('数据库未初始化');
    }

    const records = await db.languageAbilities.toArray();
    return records.map(record => LanguageAbilityAggregate.restore(record));
  }
}
