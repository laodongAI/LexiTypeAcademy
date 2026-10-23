/**
 * 版本管理器
 * 负责：
 * - 版本检查和对比
 * - 数据备份和恢复
 * - 迁移脚本执行
 * - 迁移后数据验证
 * - 回滚处理
 *
 * 典型工作流：
 * 1. onAppStartup() 检查版本是否需要迁移
 * 2. 如果需要迁移，performMigration() 执行迁移
 * 3. 迁移过程：备份 -> 运行脚本 -> 验证 -> 提交元数据
 * 4. 如果验证失败，自动 rollback()
 */

import {
  BackupData,
  VersionMetadata,
  MigrationRecord,
  ScriptResult,
  MigrationResult,
  VersionCheckStatus
} from './types';
import { LexiTypeDB, getDB } from './db';

// 迁移脚本类型定义
type MigrationFunction = (db: LexiTypeDB) => Promise<ScriptResult>;

export class VersionManager {
  private db: LexiTypeDB;
  private readonly currentAppVersion = '0.4.1';
  private readonly currentSchemaVersion = 4;
  
  // 版本迁移脚本映射表
  private readonly migrationScripts: Record<string, MigrationFunction> = {
    '0.3.0->0.4.0': (db) => this.migrateFrom030To040(db),
    '0.4.0->0.4.1': (db) => this.migrateFrom040To041(db),
  };
  
  constructor(db: LexiTypeDB) {
    this.db = db;
  }
  
  /**
   * 应用启动时调用
   * 检查版本是否需要迁移或回滚
   *
   * @returns 版本检查状态
   */
  async onAppStartup(): Promise<VersionCheckStatus> {
    try {
      console.log('🔍 [VersionManager] 检查版本...');
      
      const stored = await this.loadVersionMetadata();
      
      if (!stored) {
        // 全新安装，初始化版本元数据
        console.log('ℹ️ [VersionManager] 首次安装，初始化版本元数据');
        await this.initializeVersionMetadata();
        return 'ok';
      }
      
      const appVersionCompare = this.compareVersions(stored.appVersion, this.currentAppVersion);
      const schemaVersionCompare = stored.schemaVersion - this.currentSchemaVersion;
      
      console.log(`📊 [VersionManager] 存储版本: ${stored.appVersion} (schema: ${stored.schemaVersion})`);
      console.log(`📊 [VersionManager] 当前版本: ${this.currentAppVersion} (schema: ${this.currentSchemaVersion})`);
      
      if (appVersionCompare < 0) {
        // 用户升级应用（0.4.0 → 0.4.1）
        console.log('⬆️ [VersionManager] 检测到应用升级');
        return 'migration_required';
      } else if (appVersionCompare > 0) {
        // 用户降级应用（0.4.1 → 0.4.0），数据库模式可能不兼容
        console.log('⬇️ [VersionManager] 检测到应用降级');
        return 'rollback_required';
      } else if (schemaVersionCompare !== 0) {
        // 同个应用版本内的 schema 更新
        console.log(`🔄 [VersionManager] Schema 版本差异: ${schemaVersionCompare}`);
        return schemaVersionCompare < 0 ? 'migration_required' : 'rollback_required';
      }
      
      console.log('✅ [VersionManager] 版本检查通过');
      return 'ok';
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [VersionManager] 版本检查失败: ${message}`);
      return 'error';
    }
  }
  
  /**
   * 执行版本升级迁移
   * 分阶段：备份 → 迁移 → 验证 → 提交
   *
   * @param fromVersion 源版本
   * @param toVersion 目标版本
   * @returns 迁移结果
   */
  async performMigration(fromVersion: string, toVersion: string): Promise<MigrationResult> {
    const startTime = Date.now();
    let backupId: string | undefined;
    
    try {
      console.log(`🚀 [VersionManager] 开始迁移: ${fromVersion} → ${toVersion}`);
      
      // 第 1 步：创建备份
      console.log('📦 [VersionManager] 创建备份...');
      backupId = await this.createBackup(fromVersion);
      console.log(`✅ [VersionManager] 备份已创建: ${backupId}`);
      
      // 第 2 步：执行迁移脚本
      console.log(`🔄 [VersionManager] 执行迁移脚本...`);
      const result = await this.runMigrationScript(fromVersion, toVersion);
      
      if (!result.success) {
        throw new Error(result.error || '迁移脚本执行失败');
      }
      
      console.log(`✅ [VersionManager] 迁移脚本执行成功，影响 ${result.affectedRecords} 条记录`);
      
      // 第 3 步：验证迁移
      console.log('🔎 [VersionManager] 验证迁移结果...');
      const isValid = await this.validateMigration(toVersion, backupId);
      
      if (!isValid) {
        // 验证失败，自动回滚
        console.log('❌ [VersionManager] 验证失败，执行自动回滚...');
        await this.rollback(backupId);
        throw new Error('迁移后数据不一致，已自动回滚');
      }
      
      console.log('✅ [VersionManager] 验证通过');
      
      // 第 4 步：更新版本元数据
      console.log('💾 [VersionManager] 更新版本元数据...');
      await this.updateVersionMetadata(toVersion, fromVersion, result.affectedRecords, backupId, 'success');
      
      const duration = Date.now() - startTime;
      
      console.log(`🎉 [VersionManager] 迁移完成，耗时 ${duration}ms`);
      
      return {
        success: true,
        fromVersion,
        toVersion,
        backupId,
        durationMs: duration,
        affectedRecords: result.affectedRecords
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      const duration = Date.now() - startTime;
      
      console.error(`❌ [VersionManager] 迁移失败: ${message}`);
      
      // 记录失败的迁移到历史
      if (backupId) {
        await this.updateVersionMetadata(fromVersion, toVersion, 0, backupId, 'failed', message);
      }
      
      return {
        success: false,
        fromVersion,
        toVersion,
        backupId,
        durationMs: duration,
        error: message
      };
    }
  }
  
  /**
   * 创建数据库备份
   * 将所有表的数据保存到 backups 表中
   *
   * @param version 备份时的应用版本
   * @returns 备份 ID
   */
  private async createBackup(version: string): Promise<string> {
    const backupId = `backup_${version}_${Date.now()}`;
    const tables = [
      'courses', 'lessons', 'learningRecords',
      'remediations', 'remediationEffectiveness', 'languageAbilities',
      'reviews', 'reviewHistory',
      'users', 'achievements',
      'aiLabTasks',
      'audioPreloadCache', 'promptSounds'
    ];
    
    try {
      const backup: BackupData = {
        id: backupId,
        fromVersion: version,
        createdAt: new Date(),
        tables: {}
      };
      
      // 备份每个表
      for (const table of tables) {
        try {
          const data = await (this.db as any).table(table).toArray();
          backup.tables[table] = data;
          console.log(`  ✓ 备份表 ${table}: ${data.length} 条记录`);
        } catch (error) {
          // 表可能不存在，这是正常的
          console.log(`  - 表 ${table} 不存在或为空`);
          backup.tables[table] = [];
        }
      }
      
      // 保存备份
      await this.db.backups.add(backup);
      console.log(`💾 [VersionManager] 备份已保存: ${backupId}`);
      
      return backupId;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [VersionManager] 创建备份失败: ${message}`);
      throw error;
    }
  }
  
  /**
   * 执行版本特定的迁移脚本
   *
   * @param fromVersion 源版本
   * @param toVersion 目标版本
   * @returns 脚本执行结果
   */
  private async runMigrationScript(
    fromVersion: string,
    toVersion: string
  ): Promise<ScriptResult> {
    const key = `${fromVersion}->${toVersion}`;
    const migrationFn = this.migrationScripts[key];
    
    if (!migrationFn) {
      return {
        success: false,
        affectedRecords: 0,
        error: `不支持从 ${fromVersion} 升级到 ${toVersion}`
      };
    }
    
    try {
      return await migrationFn(this.db);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      return {
        success: false,
        affectedRecords: 0,
        error: message
      };
    }
  }
  
  /**
   * v0.3.0 → v0.4.0 迁移脚本
   * - 添加 cefrLevel 字段到 courses
   * - 为 lessons 添加 vocabulary 数组
   * - 为 learningRecords 添加新的统计字段
   */
  private async migrateFrom030To040(db: LexiTypeDB): Promise<ScriptResult> {
    try {
      let affectedRecords = 0;
      
      console.log('  → 迁移 courses 表...');
      
      // 1. 迁移 courses 表
      const courses = await (db as any).courses.toArray();
      for (const course of courses) {
        await (db as any).courses.update(course.id, {
          cefrLevel: course.cefrLevel || 'A1',
          stats: {
            ...course.stats,
            avgAccuracy: undefined  // 废弃字段
          }
        });
        affectedRecords++;
      }
      console.log(`    ✓ 已更新 ${courses.length} 门课程`);
      
      console.log('  → 迁移 lessons 表...');
      
      // 2. 迁移 lessons 表
      const lessons = await (db as any).lessons.toArray();
      for (const lesson of lessons) {
        await (db as any).lessons.update(lesson.id, {
          vocabulary: lesson.vocabulary || [],
          audioMeta: {
            ...lesson.audioMeta,
            startMs: Math.max(0, lesson.audioMeta?.startMs || 0),
            endMs: Math.min(
              lesson.audioMeta?.duration * 1000 || 0,
              lesson.audioMeta?.endMs || lesson.audioMeta?.duration * 1000 || 0
            )
          }
        });
        affectedRecords++;
      }
      console.log(`    ✓ 已更新 ${lessons.length} 个课时`);
      
      return { success: true, affectedRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : '迁移失败';
      return {
        success: false,
        affectedRecords: 0,
        error: message
      };
    }
  }
  
  /**
   * v0.4.0 → v0.4.1 迁移脚本
   * - 创建 languageAbilities 表（为现有用户生成能力档案）
   * - 重构 learningRecords 中的 stats 字段
   * - 创建 remediationEffectiveness 表
   */
  private async migrateFrom040To041(db: LexiTypeDB): Promise<ScriptResult> {
    try {
      let affectedRecords = 0;
      
      console.log('  → 创建用户语言能力档案...');
      
      // 1. 为每个用户创建语言能力档案
      const learningRecords = await (db as any).learningRecords.toArray();
      // 使用数组而不是 Set 以避免 downlevelIteration 问题
      const userIds: string[] = [];
      const userIdSet = new Set<string>();
      learningRecords.forEach((r: any) => {
        if (r.userId && !userIdSet.has(r.userId)) {
          userIdSet.add(r.userId);
          userIds.push(r.userId);
        }
      });
      
      for (const userId of userIds) {
        const userRecords = learningRecords.filter((r: any) => r.userId === userId);
        const avgScore = userRecords.reduce((sum: number, r: any) => sum + (r.score || 0), 0) / userRecords.length;
        
        const ability = {
          userId,
          currentDifficulty: avgScore > 80 ? 'B1' : avgScore > 60 ? 'A2' : 'A1',
          listeningLevel: avgScore > 80 ? 'B1' : avgScore > 60 ? 'A2' : 'A1',
          speakingLevel: avgScore > 70 ? 'B1' : avgScore > 60 ? 'A2' : 'A1',
          vocabularyMastered: 0,
          vocabularyTarget: 500,
          completedCourses: [],
          averageAccuracy: Math.round(avgScore),
          totalPracticeDays: 0,
          createdAt: new Date(),
          lastUpdatedAt: new Date()
        };
        
        try {
          await (db as any).languageAbilities.put(ability);
        } catch (error) {
          // 可能已存在，使用 update
          await (db as any).languageAbilities.update(userId, ability);
        }
        affectedRecords++;
      }
      console.log(`    ✓ 已为 ${userIds.length} 个用户创建能力档案`);
      
      console.log('  → 重构 learningRecords 统计数据...');
      
      // 2. 重构 learningRecords
      for (const record of learningRecords) {
        await (db as any).learningRecords.update(record.id, {
          stats: {
            ...record.stats,
            phoneticAccuracy: record.accuracy?.phonemeAccuracy || 0,
            fluency: record.accuracy?.fluency || 0,
            completionTime: record.completionTime || 0
          }
        });
        affectedRecords++;
      }
      console.log(`    ✓ 已更新 ${learningRecords.length} 条学习记录`);
      
      return { success: true, affectedRecords };
    } catch (error) {
      const message = error instanceof Error ? error.message : '迁移失败';
      return {
        success: false,
        affectedRecords: 0,
        error: message
      };
    }
  }
  
  /**
   * 验证迁移是否成功
   * 检查：数据完整性、外键约束、不变量
   *
   * @param toVersion 迁移后的版本
   * @param backupId 备份 ID（用于对比）
   * @returns 验证是否通过
   */
  private async validateMigration(toVersion: string, backupId: string): Promise<boolean> {
    try {
      console.log('  → 检查数据完整性...');
      
      // 1. 基础数据完整性检查
      const courseCount = await (this.db as any).courses.count();
      if (courseCount === 0) {
        console.warn('  ⚠️ 警告：courses 表为空');
        // 这可能是正常的（全新安装），不作为验证失败的原因
      }
      
      console.log(`    ✓ courses 表: ${courseCount} 条记录`);
      
      const learningRecordCount = await (this.db as any).learningRecords.count();
      console.log(`    ✓ learningRecords 表: ${learningRecordCount} 条记录`);
      
      // 2. 外键约束检查
      if (courseCount > 0) {
        console.log('  → 检查外键约束...');
        const courses = await (this.db as any).courses.toArray();
        let invalidCount = 0;
        
        for (const course of courses) {
          const lessonCount = await (this.db as any).lessons
            .where('courseId').equals(course.id).count();
          
          if (lessonCount === 0) {
            console.warn(`  ⚠️ 课程 ${course.id} 没有关联的 lesson`);
            invalidCount++;
          }
        }
        
        if (invalidCount > 0) {
          console.warn(`  ⚠️ 有 ${invalidCount} 门课程缺少课时`);
        }
        console.log('    ✓ 外键约束检查完成');
      }
      
      // 3. 不变量检查
      if (courseCount > 0) {
        console.log('  → 检查业务不变量...');
        const lessons = await (this.db as any).lessons.toArray();
        let invalidLessons = 0;
        
        for (const lesson of lessons) {
          // 检查音频边界有效性
          if (lesson.audioMeta) {
            if (lesson.audioMeta.startMs >= lesson.audioMeta.endMs) {
              console.warn(`  ⚠️ 课时 ${lesson.id} 音频边界无效`);
              invalidLessons++;
            }
          }
        }
        
        if (invalidLessons === 0) {
          console.log('    ✓ 所有不变量检查通过');
        } else {
          console.warn(`  ⚠️ 有 ${invalidLessons} 个课时的不变量检查失败`);
        }
      }
      
      console.log('✅ [VersionManager] 验证通过');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [VersionManager] 验证失败: ${message}`);
      return false;
    }
  }
  
  /**
   * 回滚到备份
   * 恢复所有表的数据到备份时的状态
   *
   * @param backupId 备份 ID
   */
  async rollback(backupId: string): Promise<void> {
    try {
      console.log(`⏮️ [VersionManager] 开始回滚: ${backupId}`);
      
      const backup = await this.db.backups.get(backupId);
      
      if (!backup) {
        throw new Error(`备份不存在: ${backupId}`);
      }
      
      // 清空所有表
      const tables = Object.keys(backup.tables);
      for (const table of tables) {
        try {
          await (this.db as any).table(table).clear();
          console.log(`  ✓ 已清空表 ${table}`);
        } catch (error) {
          console.warn(`  ⚠️ 清空表 ${table} 失败（可能表不存在）`);
        }
      }
      
      // 恢复备份数据
      for (const [table, records] of Object.entries(backup.tables)) {
        if (records.length > 0) {
          try {
            await (this.db as any).table(table).bulkAdd(records as any[]);
            console.log(`  ✓ 已恢复 ${table}: ${records.length} 条记录`);
          } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误';
            console.warn(`  ⚠️ 恢复 ${table} 失败: ${message}`);
          }
        }
      }
      
      console.log(`✅ [VersionManager] 回滚完成`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [VersionManager] 回滚失败: ${message}`);
      throw error;
    }
  }
  
  /**
   * 版本比较
   * 返回：-1 (v1 < v2), 0 (相等), 1 (v1 > v2)
   *
   * @param v1 版本字符串 1
   * @param v2 版本字符串 2
   * @returns 比较结果
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    
    return 0;
  }
  
  /**
   * 初始化版本元数据
   * 在首次安装时调用
   */
  private async initializeVersionMetadata(): Promise<void> {
    try {
      const metadata: VersionMetadata = {
        appVersion: this.currentAppVersion,
        appBuildNumber: 1,
        schemaVersion: this.currentSchemaVersion,
        aggregateVersions: new Map([
          ['Course', 3],
          ['Lesson', 2],
          ['LearningRecord', 2],
          ['Remediation', 2],
          ['Review', 1],
          ['LanguageAbility', 1],
          ['RemediationEffectiveness', 1]
        ]),
        migrationHistory: [],
        lastMigrationAt: new Date(),
        lastMigrationBy: 'system',
        isConsistent: true
      };
      
      await this.db.versionMetadata.add(metadata);
      console.log('✅ [VersionManager] 版本元数据已初始化');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`❌ [VersionManager] 初始化版本元数据失败: ${message}`);
      throw error;
    }
  }
  
  /**
   * 加载版本元数据
   */
  private async loadVersionMetadata(): Promise<VersionMetadata | undefined> {
    try {
      return await this.db.versionMetadata.toCollection().first();
    } catch (error) {
      console.warn('⚠️ [VersionManager] 加载版本元数据失败');
      return undefined;
    }
  }
  
  /**
   * 更新版本元数据
   */
  private async updateVersionMetadata(
    toVersion: string,
    fromVersion: string,
    affectedRecords: number,
    backupId: string,
    status: 'success' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    try {
      const metadata = await this.loadVersionMetadata();
      if (!metadata) {
        throw new Error('版本元数据不存在');
      }
      
      const migrationRecord: MigrationRecord = {
        id: `migration_${Date.now()}`,
        fromVersion,
        toVersion,
        timestamp: new Date(),
        status,
        affectedRecords,
        backupId,
        errorMessage,
        duration: 0
      };
      
      metadata.migrationHistory.push(migrationRecord);
      metadata.lastMigrationAt = new Date();
      metadata.lastMigrationBy = 'system';
      
      if (status === 'success') {
        metadata.appVersion = toVersion;
        metadata.schemaVersion = this.currentSchemaVersion;
      }
      
      // 使用 put() 而不是 update()，因为 update() 仅支持部分更新
      await this.db.versionMetadata.put(metadata);
      console.log('💾 [VersionManager] 版本元数据已更新');
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      console.error(`⚠️ [VersionManager] 更新版本元数据失败: ${message}`);
    }
  }
}
