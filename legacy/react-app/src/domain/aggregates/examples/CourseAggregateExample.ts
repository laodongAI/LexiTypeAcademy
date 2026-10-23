/**
 * CourseAggregate 完整性检查实现示例
 * 展示了聚合根如何实现 IVerifiable 接口
 * 
 * 注意：这是一个示例文件，展示了设计文档中描述的实现模式
 */

import { IVerifiable } from '../../interfaces/IVerifiable';
import {
  IntegrityCheckResult,
  IntegrityViolation,
  SelfHealingResult
} from '../../valueobjects/IntegrityCheckResult';

/**
 * 课程聚合根完整性检查实现
 * 
 * 验证规则：
 * 1. 课时数限制：≤ 500
 * 2. CEFR 级别有效性：必须是 A1, A2, B1, B2, C1, C2 之一
 * 3. 所有课时的音频完整性
 * 4. 统计数据一致性：总时长 = 所有课时时长之和
 * 5. 资源文件完整性
 */
export class CourseAggregateExample implements IVerifiable {
  /** 有效的 CEFR 等级列表 */
  static readonly VALID_CERF_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  
  /** 课时数上限 */
  static readonly MAX_LESSONS = 500;
  
  // 聚合根属性
  public id: string = '';
  public title: string = '';
  public cefrLevel: string = 'A1';
  public lessons: any[] = [];
  public stats: { totalDuration: number } = { totalDuration: 0 };
  
  /**
   * 验证聚合根完整性
   * 实现 IVerifiable 接口
   */
  verifyIntegrity(): IntegrityCheckResult {
    const violations: IntegrityViolation[] = [];
    
    console.log(`🔍 [CourseAggregate] 验证课程 ${this.id} 的完整性...`);
    
    // 检查 1: 课时数上限
    if (this.lessons.length > CourseAggregateExample.MAX_LESSONS) {
      violations.push({
        code: 'LESSON_COUNT_EXCEEDED',
        message: `课程课时数 ${this.lessons.length} 超过上限 ${CourseAggregateExample.MAX_LESSONS}`,
        actualValue: this.lessons.length,
        expectedValue: CourseAggregateExample.MAX_LESSONS,
        remediation: '删除不必要的课时或拆分为多个课程'
      });
    }
    
    // 检查 2: CEFR 级别有效性
    if (!CourseAggregateExample.VALID_CERF_LEVELS.includes(this.cefrLevel)) {
      violations.push({
        code: 'INVALID_CEFR_LEVEL',
        message: `CEFR 级别 '${this.cefrLevel}' 无效`,
        actualValue: this.cefrLevel,
        expectedValue: CourseAggregateExample.VALID_CERF_LEVELS.join(', '),
        remediation: '重新设置为有效的 CEFR 级别'
      });
    }
    
    // 检查 3: 所有课时的音频完整性
    for (let i = 0; i < this.lessons.length; i++) {
      const lesson = this.lessons[i];
      
      // 检查音频边界
      if (lesson.audioMeta?.startMs < 0) {
        violations.push({
          code: `INVALID_AUDIO_START_LESSON_${i}`,
          message: `课时 ${i} 的音频起始时间不能为负: ${lesson.audioMeta.startMs}ms`,
          remediation: '将音频起始时间修正为 0'
        });
      }
      
      // 检查音频文件存在性（模拟）
      if (!lesson.audioMeta?.path) {
        violations.push({
          code: `MISSING_AUDIO_FILE_LESSON_${i}`,
          message: `课时 ${i} 缺少音频文件`,
          remediation: '上传或重新关联音频文件'
        });
      }
    }
    
    // 检查 4: 统计数据一致性
    const calculatedDuration = this.lessons.reduce((sum: number, l: any) => 
      sum + (l.duration || 0), 0
    );
    if (this.stats.totalDuration !== calculatedDuration) {
      violations.push({
        code: 'STAT_DURATION_MISMATCH',
        message: `总时长 ${this.stats.totalDuration}ms 与计算值 ${calculatedDuration}ms 不匹配`,
        actualValue: this.stats.totalDuration,
        expectedValue: calculatedDuration,
        remediation: '重新计算统计数据'
      });
    }
    
    const isValid = violations.length === 0;
    
    if (isValid) {
      console.log(`✅ [CourseAggregate] 课程 ${this.id} 完整性检查通过`);
    } else {
      console.log(`❌ [CourseAggregate] 课程 ${this.id} 检查失败，发现 ${violations.length} 个违规`);
    }
    
    return {
      isValid,
      violations,
      severity: violations.length === 0 
        ? 'INFO' 
        : violations.some(v => v.code.includes('CRITICAL')) 
          ? 'CRITICAL' 
          : 'WARNING',
      checkedAt: new Date(),
      aggregateId: this.id,
      aggregateType: 'Course'
    };
  }
  
  /**
   * 尝试自动修复聚合根的完整性问题
   * 实现 IVerifiable 接口
   */
  async attemptSelfHealing(): Promise<SelfHealingResult> {
    console.log(`🔧 [CourseAggregate] 尝试修复课程 ${this.id}...`);
    
    const check = this.verifyIntegrity();
    const healed: string[] = [];
    const unhealed: string[] = [];
    const logLines: string[] = [];
    
    if (check.isValid) {
      logLines.push('课程已通过完整性检查，无需修复');
      return {
        success: true,
        healed: [],
        unhealed: [],
        log: logLines.join('\n'),
        healedAt: new Date()
      };
    }
    
    // 尝试修复每个违规
    for (const violation of check.violations) {
      try {
        let fixed = false;
        
        switch (violation.code) {
          case 'STAT_DURATION_MISMATCH':
            // 自动重新计算统计数据
            this.stats.totalDuration = this.lessons.reduce((sum: number, l: any) => 
              sum + (l.duration || 0), 0
            );
            fixed = true;
            logLines.push(`已修复: 重新计算统计数据，总时长 = ${this.stats.totalDuration}ms`);
            break;
            
          case 'INVALID_CEFR_LEVEL':
            // 不可自动修复，需要手动干预
            logLines.push(`⚠️ 无法修复: CEFR 级别需要手动修改`);
            break;
            
          case 'LESSON_COUNT_EXCEEDED':
            // 仅记录警告，不自动删除课时
            logLines.push(`⚠️ 无法修复: 课时数超限，需要手动删除`);
            break;
            
          default:
            if (violation.code.includes('INVALID_AUDIO_START')) {
              // 修复音频起始时间
              const lessonIndexMatch = violation.code.match(/LESSON_(\d+)/);
              if (lessonIndexMatch) {
                const idx = parseInt(lessonIndexMatch[1]);
                if (this.lessons[idx]?.audioMeta) {
                  this.lessons[idx].audioMeta.startMs = 0;
                  fixed = true;
                  logLines.push(`已修复: 课时 ${idx} 的音频起始时间设置为 0`);
                }
              }
            }
        }
        
        if (fixed) {
          healed.push(violation.code);
        } else {
          unhealed.push(violation.code);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : '未知错误';
        logLines.push(`❌ 修复失败 (${violation.code}): ${message}`);
        unhealed.push(violation.code);
      }
    }
    
    const success = unhealed.length === 0;
    
    if (success) {
      console.log(`✅ [CourseAggregate] 课程 ${this.id} 已完全修复`);
    } else {
      console.log(`⚠️ [CourseAggregate] 课程 ${this.id} 部分修复，${unhealed.length} 个违规需手动处理`);
    }
    
    return {
      success,
      healed,
      unhealed,
      log: logLines.join('\n'),
      healedAt: new Date()
    };
  }
}

/**
 * 使用示例
 */
export function demonstrateIntegrityChecking(): void {
  console.log('\\n=== 聚合根完整性检查演示 ===\\n');
  
  // 创建一个有问题的课程
  const course = new CourseAggregateExample();
  course.id = 'course_001';
  course.title = '英语入门课程';
  course.cefrLevel = 'A1';
  course.lessons = [
    { 
      id: 'lesson_1', 
      duration: 120,
      audioMeta: { startMs: 0, endMs: 120, path: '/audio/lesson1.mp3' }
    },
    {
      id: 'lesson_2',
      duration: 150,
      audioMeta: { startMs: -10, endMs: 140, path: '/audio/lesson2.mp3' } // 错误：起始时间为负
    }
  ];
  course.stats.totalDuration = 250; // 错误：实际应为 270
  
  // 执行完整性检查
  const checkResult = course.verifyIntegrity();
  
  console.log('\\n验证结果:');
  console.log(`- 聚合根有效: ${checkResult.isValid}`);
  console.log(`- 严重级别: ${checkResult.severity}`);
  console.log(`- 违规数量: ${checkResult.violations.length}`);
  
  if (checkResult.violations.length > 0) {
    console.log('\\n发现的违规:');
    for (const violation of checkResult.violations) {
      console.log(`  • [${violation.code}] ${violation.message}`);
      if (violation.remediation) {
        console.log(`    修复建议: ${violation.remediation}`);
      }
    }
  }
  
  // 尝试自动修复
  course.attemptSelfHealing().then((healResult) => {
    console.log('\\n自动修复结果:');
    console.log(`- 修复成功: ${healResult.success}`);
    console.log(`- 已修复: ${healResult.healed.length} 个`);
    console.log(`- 未修复: ${healResult.unhealed.length} 个`);
    
    if (healResult.log) {
      console.log('\\n修复日志:');
      for (const line of healResult.log.split('\\n')) {
        console.log(`  ${line}`);
      }
    }
    
    // 再次验证
    console.log('\\n修复后重新验证:');
    const newCheckResult = course.verifyIntegrity();
    console.log(`- 聚合根有效: ${newCheckResult.isValid}`);
    console.log(`- 违规数量: ${newCheckResult.violations.length}`);
  });
}
