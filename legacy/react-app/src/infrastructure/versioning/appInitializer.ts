/**
 * 应用初始化器
 * 在应用启动时调用，负责：
 * 1. 初始化 Dexie 数据库
 * 2. 执行版本检查
 * 3. 如果需要，执行数据库迁移
 * 4. 准备应用运行环境
 */

import {
  initializeDatabase,
  getDB,
  closeDatabase,
  LexiTypeDB
} from './db';
import { VersionManager } from './VersionManager';
import { AppInitializationResult } from './types';

/**
 * 初始化应用
 * 返回初始化结果，调用者可根据结果决定是否继续启动应用
 */
export async function initializeApp(): Promise<AppInitializationResult> {
  console.log('🚀 [AppInitializer] 开始应用初始化...');
  
  try {
    // 第 1 步：初始化数据库
    console.log('1️⃣ [AppInitializer] 初始化数据库...');
    const db = await initializeDatabase();
    console.log('✅ [AppInitializer] 数据库初始化成功');
    
    // 第 2 步：创建版本管理器并检查版本
    console.log('2️⃣ [AppInitializer] 检查版本...');
    const versionManager = new VersionManager(db);
    const status = await versionManager.onAppStartup();
    
    // 第 3 步：根据版本检查结果做出相应处理
    console.log('3️⃣ [AppInitializer] 处理版本检查结果...');
    
    switch (status) {
      case 'ok':
        console.log('✅ [AppInitializer] 版本检查通过，应用可以启动');
        return {
          success: true,
          status: 'ok',
          message: '应用初始化完成'
        };
      
      case 'migration_required':
        console.log('⬆️ [AppInitializer] 检测到需要迁移');
        const migrationResult = await versionManager.performMigration('0.4.0', '0.4.1');
        
        if (migrationResult.success) {
          console.log(`✅ [AppInitializer] 迁移成功，影响 ${migrationResult.affectedRecords} 条记录`);
          return {
            success: true,
            status: 'ok',
            message: '数据库迁移完成',
            migrationResult
          };
        } else {
          console.error(`❌ [AppInitializer] 迁移失败: ${migrationResult.error}`);
          return {
            success: false,
            status: 'migration_required',
            message: `迁移失败: ${migrationResult.error}`,
            error: migrationResult.error
          };
        }
      
      case 'rollback_required':
        console.warn('⚠️ [AppInitializer] 检测到应用版本降级');
        console.warn('⚠️ [AppInitializer] 某些功能可能不可用，但应用仍将继续启动');
        return {
          success: true,
          status: 'rollback_required',
          message: '应用版本降级，某些功能可能不可用'
        };
      
      case 'error':
        console.error('❌ [AppInitializer] 版本检查出错');
        return {
          success: false,
          status: 'error',
          message: '版本检查失败',
          error: '无法检查应用版本'
        };
      
      default:
        const exhaustive: never = status;
        return exhaustive;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ [AppInitializer] 初始化失败: ${message}`);
    
    return {
      success: false,
      status: 'error',
      message: `初始化失败: ${message}`,
      error: message
    };
  }
}

/**
 * 关闭应用
 * 在应用卸载时调用，清理资源
 */
export async function cleanupApp(): Promise<void> {
  console.log('🛑 [AppInitializer] 应用清理中...');
  
  try {
    await closeDatabase();
    console.log('✅ [AppInitializer] 应用清理完成');
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error(`⚠️ [AppInitializer] 应用清理出错: ${message}`);
  }
}

/**
 * 在应用启动时立即调用 initializeApp
 * 使用 IIFE (立即执行函数表达式)
 *
 * 注意：这应该在应用的最顶级入口处调用
 * 例如在 main.tsx 或 index.tsx
 */
let appInitializationPromise: Promise<AppInitializationResult> | null = null;

export function getAppInitializationPromise(): Promise<AppInitializationResult> {
  if (!appInitializationPromise) {
    appInitializationPromise = initializeApp();
  }
  return appInitializationPromise;
}

/**
 * 等待应用初始化完成
 * 用于在渲染应用前等待初始化完成
 */
export async function waitForAppInitialization(): Promise<void> {
  const result = await getAppInitializationPromise();
  
  if (!result.success) {
    // 初始化失败，抛出错误
    throw new Error(result.message);
  }
  
  console.log('✅ [AppInitializer] 应用已完全初始化，可以渲染 UI');
}
