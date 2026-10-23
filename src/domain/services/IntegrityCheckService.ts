/**
 * 完整性检查服务
 * 负责对聚合根进行定期完整性扫描、自动修复和监控告警
 * 这是应用层服务，协调领域层的验证逻辑和基础设施层的持久化
 */

import { IntegrityCheckResult, IntegrityViolation } from '../valueobjects/IntegrityCheckResult';
import { IVerifiable } from '../interfaces/IVerifiable';

/**
 * 完整性检查统计信息
 * 用于监控聚合根的整体健康状态
 */
export interface IntegrityCheckStats {
  /** 扫描的聚合根总数 */
  totalCount: number;
  
  /** 通过检查的聚合根数 */
  passedCount: number;
  
  /** 失败的聚合根数 */
  failedCount: number;
  
  /** 失败百分比 (0-100) */
  failureRate: number;
  
  /** 发现的总违规数 */
  violationCount: number;
  
  /** 严重违规数（CRITICAL 级别） */
  criticalCount: number;
  
  /** 警告级违规数（WARNING 级别） */
  warningCount: number;
  
  /** 信息级违规数（INFO 级别） */
  infoCount: number;
  
  /** 自动修复成功的聚合根数 */
  autoHealedCount: number;
  
  /** 需要手动干预的聚合根数 */
  manualInterventionCount: number;
  
  /** 扫描耗时（毫秒） */
  durationMs: number;
  
  /** 扫描时间戳 */
  scanTime: Date;
}

/**
 * 完整性检查选项
 */
export interface IntegrityCheckOptions {
  /** 是否尝试自动修复发现的问题 */
  autoHeal?: boolean;
  
  /** 日志级别 */
  logLevel?: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG';
  
  /** 仅扫描特定类型的聚合根 */
  aggregateTypeFilter?: string[];
  
  /** 是否跳过已检查过的聚合根（用于增量扫描） */
  incrementalScan?: boolean;
}

/**
 * 完整性检查服务
 * 
 * 职责：
 * 1. 对聚合根进行完整性验证
 * 2. 收集和分析验证结果
 * 3. 尝试自动修复问题
 * 4. 记录和上报违规信息
 * 5. 定期运行（通常通过 Cron 任务）
 */
export class IntegrityCheckService {
  /**
   * 日志消息缓冲，用于记录所有操作
   */
  private logBuffer: string[] = [];
  
  constructor(
    // 注意：这里我们使用依赖注入，具体的仓储实现在下一阶段添加
    // 目前展示的是接口契约
  ) {}
  
  /**
   * 记录日志消息
   */
  private log(message: string, level: 'ERROR' | 'WARNING' | 'INFO' | 'DEBUG' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [${level}] ${message}`;
    this.logBuffer.push(logLine);
    console.log(logLine);
  }
  
  /**
   * 验证单个聚合根
   * 
   * @param aggregate 要验证的聚合根（必须实现 IVerifiable 接口）
   * @returns 验证结果
   */
  async verifyAggregate(aggregate: IVerifiable & { id: string }): Promise<IntegrityCheckResult> {
    this.log(`验证聚合根: ${aggregate.id}`, 'DEBUG');
    
    try {
      const result = aggregate.verifyIntegrity();
      
      if (!result.isValid) {
        this.log(
          `聚合根 ${aggregate.id} 检查失败: ${result.violations.length} 个违规`,
          'WARNING'
        );
      }
      
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.log(
        `验证聚合根 ${aggregate.id} 时出错: ${message}`,
        'ERROR'
      );
      
      // 返回一个错误结果
      return {
        isValid: false,
        violations: [
          {
            code: 'VERIFICATION_ERROR',
            message: `验证过程出错: ${message}`,
            remediation: '请检查聚合根的实现'
          }
        ],
        severity: 'CRITICAL',
        checkedAt: new Date(),
        aggregateId: aggregate.id,
        aggregateType: 'Unknown'
      };
    }
  }
  
  /**
   * 尝试修复聚合根
   * 
   * @param aggregate 要修复的聚合根
   * @returns 是否修复成功
   */
  async attemptHealing(aggregate: IVerifiable & { id: string }): Promise<boolean> {
    try {
      this.log(`尝试修复聚合根: ${aggregate.id}`, 'INFO');
      
      const result = await aggregate.attemptSelfHealing();
      
      if (result.success) {
        this.log(
          `聚合根 ${aggregate.id} 修复成功，修复了 ${result.healed.length} 个违规`,
          'INFO'
        );
      } else {
        this.log(
          `聚合根 ${aggregate.id} 修复失败，无法修复的违规: ${result.unhealed.join(', ')}`,
          'WARNING'
        );
      }
      
      return result.success;
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误';
      this.log(
        `修复聚合根 ${aggregate.id} 时出错: ${message}`,
        'ERROR'
      );
      return false;
    }
  }
  
  /**
   * 分析验证结果并生成统计信息
   * 
   * @param results 所有验证结果
   * @returns 统计信息
   */
  analyzeResults(results: IntegrityCheckResult[]): IntegrityCheckStats {
    const failedResults = results.filter(r => !r.isValid);
    const allViolations = failedResults.flatMap(r => r.violations);
    const criticalViolations = allViolations.filter(v => 
      results.find(r => r.violations.includes(v))?.severity === 'CRITICAL'
    );
    const warningViolations = allViolations.filter(v => 
      results.find(r => r.violations.includes(v))?.severity === 'WARNING'
    );
    const infoViolations = allViolations.filter(v => 
      results.find(r => r.violations.includes(v))?.severity === 'INFO'
    );
    
    return {
      totalCount: results.length,
      passedCount: results.length - failedResults.length,
      failedCount: failedResults.length,
      failureRate: results.length > 0 
        ? Math.round((failedResults.length / results.length) * 10000) / 100 
        : 0,
      violationCount: allViolations.length,
      criticalCount: criticalViolations.length,
      warningCount: warningViolations.length,
      infoCount: infoViolations.length,
      autoHealedCount: 0, // 将在修复阶段更新
      manualInterventionCount: failedResults.length,
      durationMs: 0, // 将在扫描后更新
      scanTime: new Date()
    };
  }
  
  /**
   * 报告严重问题
   * 当失败率超过阈值时触发告警
   * 
   * @param stats 统计信息
   * @param thresholdPercent 告警阈值百分比（默认 5%）
   */
  reportIfCritical(stats: IntegrityCheckStats, thresholdPercent: number = 5): boolean {
    if (stats.failureRate > thresholdPercent) {
      this.log(
        `⚠️ 告警: 完整性检查失败率 ${stats.failureRate}% 超过阈值 ${thresholdPercent}%`,
        'ERROR'
      );
      this.log(
        `详情: ${stats.failedCount}/${stats.totalCount} 个聚合根失败，共 ${stats.violationCount} 个违规`,
        'ERROR'
      );
      return true;
    }
    return false;
  }
  
  /**
   * 获取日志缓冲
   */
  getLogBuffer(): string[] {
    return [...this.logBuffer];
  }
  
  /**
   * 清空日志缓冲
   */
  clearLogBuffer(): void {
    this.logBuffer = [];
  }
}
