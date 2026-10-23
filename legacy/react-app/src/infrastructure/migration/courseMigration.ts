/**
 * 课程数据迁移工具
 * 
 * 功能：
 * 1. 为现有课程添加新字段（source, permissions, status等）
 * 2. 推断课程来源类型
 * 3. 设置权限规则
 * 4. 计算元数据
 */

import { LexiTypeDB } from '@/infrastructure/persistence/database';
import {
  type EnhancedCourse,
  type CourseSourceType,
  inferSourceType,
  getCoursePermissions,
  estimateDuration,
  countVocabulary,
  createDefaultSource
} from '@/domain/models/CourseModel';

/**
 * 迁移结果
 */
export interface MigrationResult {
  success: number;
  failed: number;
  skipped: number;
  errors: string[];
}

/**
 * 迁移课程数据到新模型
 */
export async function migrateCourses(): Promise<MigrationResult> {
  const db = new LexiTypeDB();
  const result: MigrationResult = {
    success: 0,
    failed: 0,
    skipped: 0,
    errors: []
  };
  
  try {
    console.log('[Migration] 开始迁移课程数据...');
    
    // 获取所有课程
    const courses = await db.courses.toArray();
    console.log(`[Migration] 找到 ${courses.length} 门课程`);
    
    if (courses.length === 0) {
      console.log('[Migration] 没有课程需要迁移');
      return result;
    }
    
    // 迁移每门课程
    const migratedCourses: EnhancedCourse[] = [];
    
    for (const course of courses) {
      try {
        // 检查是否已经迁移
        if (isAlreadyMigrated(course)) {
          result.skipped++;
          migratedCourses.push(course as unknown as EnhancedCourse);
          continue;
        }
        
        // 推断来源类型
        const sourceType = inferSourceType(course);
        
        // 创建增强课程
        const enhancedCourse: EnhancedCourse = {
          ...course,
          
          // 补充基础字段
          tags: course.tags || [],
          difficulty: course.difficulty || 'beginner',
          type: course.type || 'text',
          lessons: course.lessons || [], // 确保 lessons 存在
          
          // 新增字段：来源
          source: createDefaultSource(sourceType, {
            description: typeof course.source === 'string' ? course.source : undefined
          }),
          
          // 新增字段：权限
          permissions: getCoursePermissions(sourceType),
          
          // 新增字段：状态
          status: 'active',
          visibility: 'private',
          
          // 新增字段：元数据
          metadata: {
            estimatedDuration: estimateDuration(course),
            vocabularyCount: countVocabulary(course),
            sentenceCount: course.lessons?.length || 0,
            version: 1,
            ...(course.metadata || {})
          },
          
          // 统计信息
          stats: course.stats || {
            practiceCount: 0,
            avgAccuracy: 0,
            avgWpm: 0,
            completedLessons: []
          },
          
          // 时间戳
          createdAt: typeof course.createdAt === 'string' ? course.createdAt : new Date().toISOString(),
          updatedAt: typeof course.updatedAt === 'string' ? course.updatedAt : new Date().toISOString()
        };
        
        migratedCourses.push(enhancedCourse);
        result.success++;
        
        console.log(`[Migration] ✓ 迁移课程: ${course.title} (${sourceType})`);
        
      } catch (error) {
        result.failed++;
        const errorMsg = `迁移课程失败: ${course.title} - ${error}`;
        result.errors.push(errorMsg);
        console.error(`[Migration] ✗ ${errorMsg}`);
      }
    }
    
    // 批量更新数据库
    if (migratedCourses.length > 0) {
      await db.courses.bulkPut(migratedCourses as any);
      console.log(`[Migration] 已更新 ${migratedCourses.length} 门课程到数据库`);
    }
    
    console.log('[Migration] 迁移完成！');
    console.log(`[Migration] 成功: ${result.success}, 跳过: ${result.skipped}, 失败: ${result.failed}`);
    
    return result;
    
  } catch (error) {
    console.error('[Migration] 迁移过程发生错误:', error);
    throw error;
  }
}

/**
 * 检查课程是否已经迁移
 */
function isAlreadyMigrated(course: any): boolean {
  return !!(
    course.source?.type &&
    course.permissions &&
    course.status &&
    course.visibility
  );
}

/**
 * 回滚迁移（仅用于测试）
 */
export async function rollbackMigration(): Promise<void> {
  const db = new LexiTypeDB();
  const courses = await db.courses.toArray();
  
  console.log('[Rollback] 开始回滚迁移...');
  
  const rolledBackCourses = courses.map(course => {
    const { source, permissions, status, visibility, metadata, ...oldCourse } = course as any;
    return {
      ...oldCourse,
      source: typeof source === 'object' ? source.description : source
    };
  });
  
  await db.courses.bulkPut(rolledBackCourses);
  console.log(`[Rollback] 已回滚 ${rolledBackCourses.length} 门课程`);
}

/**
 * 验证迁移结果
 */
export async function validateMigration(): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const db = new LexiTypeDB();
  const courses = await db.courses.toArray();
  const issues: string[] = [];
  
  console.log('[Validation] 开始验证迁移结果...');
  
  for (const course of courses) {
    const c = course as any;
    
    // 检查必需字段
    if (!c.source?.type) {
      issues.push(`课程 ${c.title} 缺少 source.type`);
    }
    
    if (!c.permissions) {
      issues.push(`课程 ${c.title} 缺少 permissions`);
    }
    
    if (!c.status) {
      issues.push(`课程 ${c.title} 缺少 status`);
    }
    
    if (!c.visibility) {
      issues.push(`课程 ${c.title} 缺少 visibility`);
    }
    
    // 检查权限规则一致性
    if (c.source?.type && c.permissions) {
      const expectedPerms = getCoursePermissions(c.source.type);
      if (c.permissions.editable !== expectedPerms.editable) {
        issues.push(`课程 ${c.title} 权限不一致: editable`);
      }
    }
  }
  
  const valid = issues.length === 0;
  
  if (valid) {
    console.log('[Validation] ✓ 验证通过，所有课程数据完整');
  } else {
    console.log(`[Validation] ✗ 发现 ${issues.length} 个问题`);
    issues.forEach(issue => console.log(`  - ${issue}`));
  }
  
  return { valid, issues };
}

/**
 * 获取迁移统计信息
 */
export async function getMigrationStats(): Promise<{
  total: number;
  bySource: Record<string, number>;
  byStatus: Record<string, number>;
  editable: number;
  readonly: number;
}> {
  const db = new LexiTypeDB();
  const courses = await db.courses.toArray() as unknown as EnhancedCourse[];
  
  const stats = {
    total: courses.length,
    bySource: {} as Record<string, number>,
    byStatus: {} as Record<string, number>,
    editable: 0,
    readonly: 0
  };
  
  for (const course of courses) {
    // 按来源统计
    const sourceType = course.source?.type || 'unknown';
    stats.bySource[sourceType] = (stats.bySource[sourceType] || 0) + 1;
    
    // 按状态统计
    const status = course.status || 'unknown';
    stats.byStatus[status] = (stats.byStatus[status] || 0) + 1;
    
    // 可编辑/只读统计
    if (course.permissions?.editable) {
      stats.editable++;
    } else {
      stats.readonly++;
    }
  }
  
  return stats;
}

/**
 * 打印迁移统计报告
 */
export async function printMigrationReport(): Promise<void> {
  const stats = await getMigrationStats();
  
  console.log('\n========== 课程迁移统计报告 ==========');
  console.log(`总课程数: ${stats.total}`);
  console.log('\n按来源分类:');
  Object.entries(stats.bySource).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });
  console.log('\n按状态分类:');
  Object.entries(stats.byStatus).forEach(([status, count]) => {
    console.log(`  ${status}: ${count}`);
  });
  console.log(`\n可编辑: ${stats.editable}`);
  console.log(`只读: ${stats.readonly}`);
  console.log('=====================================\n');
}

// 导出便捷函数
export async function runFullMigration(): Promise<void> {
  console.log('========== 开始完整迁移流程 ==========\n');
  
  // 1. 执行迁移
  const result = await migrateCourses();
  
  // 2. 验证结果
  const validation = await validateMigration();
  
  // 3. 打印报告
  await printMigrationReport();
  
  // 4. 总结
  console.log('========== 迁移流程完成 ==========');
  console.log(`成功: ${result.success} | 跳过: ${result.skipped} | 失败: ${result.failed}`);
  console.log(`验证: ${validation.valid ? '✓ 通过' : '✗ 失败'}`);
  
  if (result.errors.length > 0) {
    console.log('\n错误列表:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  if (!validation.valid) {
    console.log('\n验证问题:');
    validation.issues.forEach(issue => console.log(`  - ${issue}`));
  }
}
