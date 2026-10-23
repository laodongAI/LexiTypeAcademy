/**
 * 课程迁移 Hook
 * 
 * 提供迁移功能的 React Hook，包括：
 * - 执行迁移
 * - 验证迁移
 * - 查看统计
 */

import { useState, useCallback } from 'react';
import {
  migrateCourses,
  validateMigration,
  getMigrationStats,
  type MigrationResult
} from '@/infrastructure/migration/courseMigration';

export interface MigrationState {
  isRunning: boolean;
  isComplete: boolean;
  result: MigrationResult | null;
  validation: { valid: boolean; issues: string[] } | null;
  stats: {
    total: number;
    bySource: Record<string, number>;
    byStatus: Record<string, number>;
    editable: number;
    readonly: number;
  } | null;
  error: string | null;
}

export function useMigration() {
  const [state, setState] = useState<MigrationState>({
    isRunning: false,
    isComplete: false,
    result: null,
    validation: null,
    stats: null,
    error: null
  });
  
  /**
   * 执行迁移
   */
  const runMigration = useCallback(async () => {
    setState(prev => ({
      ...prev,
      isRunning: true,
      error: null
    }));
    
    try {
      console.log('[useMigration] 开始迁移...');
      
      // 执行迁移
      const result = await migrateCourses();
      
      // 验证结果
      const validation = await validateMigration();
      
      // 获取统计
      const stats = await getMigrationStats();
      
      setState({
        isRunning: false,
        isComplete: true,
        result,
        validation,
        stats,
        error: null
      });
      
      console.log('[useMigration] 迁移完成');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error('[useMigration] 迁移失败:', errorMsg);
      
      setState(prev => ({
        ...prev,
        isRunning: false,
        error: errorMsg
      }));
    }
  }, []);
  
  /**
   * 刷新统计
   */
  const refreshStats = useCallback(async () => {
    try {
      const stats = await getMigrationStats();
      setState(prev => ({ ...prev, stats }));
    } catch (error) {
      console.error('[useMigration] 刷新统计失败:', error);
    }
  }, []);
  
  /**
   * 重置状态
   */
  const reset = useCallback(() => {
    setState({
      isRunning: false,
      isComplete: false,
      result: null,
      validation: null,
      stats: null,
      error: null
    });
  }, []);
  
  return {
    ...state,
    runMigration,
    refreshStats,
    reset
  };
}
