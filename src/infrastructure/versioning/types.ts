/**
 * 版本管理相关的类型定义
 * 用于追踪应用版本、Schema 版本、聚合根版本等
 */

/**
 * 备份数据结构
 * 存储在 IndexedDB 中，用于灾难恢复和回滚
 */
export interface BackupData {
  id: string;                        // 备份唯一标识：backup_version_timestamp
  fromVersion: string;               // 备份时的应用版本
  createdAt: Date;                   // 备份创建时间
  tables: Record<string, any[]>;     // 各表的完整数据快照
}

/**
 * 版本元数据
 * 追踪应用、数据库、聚合根的版本信息
 */
export interface VersionMetadata {
  id?: number;                       // 数据库主键（Dexie）
  
  // 应用版本（语义化）
  appVersion: string;                // 例：0.4.1
  appBuildNumber: number;            // 例：1042
  
  // 数据库 schema 版本
  schemaVersion: number;             // 例：4，递增整数，便于比较
  
  // 聚合根版本（用于向后兼容）
  aggregateVersions: Map<string, number>;  // { 'Course': 3, 'LearningRecord': 2, ... }
  
  // 迁移历史
  migrationHistory: MigrationRecord[];     // 所有迁移记录
  
  // 运行时更新
  lastMigrationAt: Date;
  lastMigrationBy: 'system' | 'user';
  
  // 数据完整性
  dataChecksum?: string;             // 整个数据库的 SHA-256 校验和
  isConsistent: boolean;             // 上次检查时是否一致
}

/**
 * 迁移记录
 * 记录每次数据库迁移的详细信息
 */
export interface MigrationRecord {
  id: string;                        // 迁移唯一标识
  fromVersion: string;
  toVersion: string;
  timestamp: Date;
  status: 'success' | 'failed' | 'rolled_back';
  affectedRecords: number;
  backupId?: string;
  errorMessage?: string;
  duration: number;                  // 迁移耗时（毫秒）
}

/**
 * 迁移脚本执行结果
 */
export interface ScriptResult {
  success: boolean;
  affectedRecords: number;
  error?: string;
}

/**
 * 迁移执行结果
 */
export interface MigrationResult {
  success: boolean;
  fromVersion?: string;
  toVersion?: string;
  backupId?: string;
  durationMs?: number;
  affectedRecords?: number;
  error?: string;
}

/**
 * 版本检查结果
 */
export type VersionCheckStatus = 'ok' | 'migration_required' | 'rollback_required' | 'error';

/**
 * 应用启动状态
 */
export interface AppInitializationResult {
  success: boolean;
  status: VersionCheckStatus;
  message: string;
  migrationResult?: MigrationResult;
  error?: string;
}
