/**
 * 版本管理模块导出
 */

export { LexiTypeDB, getDB, initializeDatabase, resetDatabase, closeDatabase } from './db';
export { VersionManager } from './VersionManager';
export {
  initializeApp,
  cleanupApp,
  getAppInitializationPromise,
  waitForAppInitialization
} from './appInitializer';
export type {
  BackupData,
  VersionMetadata,
  MigrationRecord,
  ScriptResult,
  MigrationResult,
  VersionCheckStatus,
  AppInitializationResult
} from './types';
