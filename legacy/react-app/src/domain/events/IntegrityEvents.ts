/**
 * 完整性相关的领域事件
 * 用于记录聚合根的完整性问题和修复操作
 */

import { IntegrityViolation } from '../valueobjects/IntegrityCheckResult';

/**
 * 聚合根完整性被违反事件
 * 当验证发现不变量被破坏时发布
 */
export class AggregateIntegrityViolatedEvent {
  readonly type = 'AggregateIntegrityViolated';
  
  constructor(
    /** 被违反的聚合根 ID */
    public readonly aggregateId: string,
    
    /** 聚合根类型 (e.g. 'Course', 'Lesson') */
    public readonly aggregateType: string,
    
    /** 发现的所有违规 */
    public readonly violations: IntegrityViolation[],
    
    /** 严重级别 */
    public readonly severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'WARNING'
  ) {}
  
  toString(): string {
    return `${this.aggregateType} ${this.aggregateId} 的完整性被违反: ` +
      `${this.violations.map(v => v.code).join(', ')}`;
  }
}

/**
 * 聚合根已修复事件
 * 当自动修复成功时发布
 */
export class AggregateHeledEvent {
  readonly type = 'AggregateHealed';
  
  constructor(
    /** 被修复的聚合根 ID */
    public readonly aggregateId: string,
    
    /** 修复的违规代码 */
    public readonly violationCode: string,
    
    /** 修复方法 ('AUTO' | 'MANUAL') */
    public readonly healingMethod: string = 'AUTO'
  ) {}
  
  toString(): string {
    return `聚合根 ${this.aggregateId} 已通过 ${this.healingMethod} 方式修复 ${this.violationCode}`;
  }
}

/**
 * 聚合根修复失败事件
 * 当无法自动修复时发布，表示需要手动干预
 */
export class AggregateHealingFailedEvent {
  readonly type = 'AggregateHealingFailed';
  
  constructor(
    /** 修复失败的聚合根 ID */
    public readonly aggregateId: string,
    
    /** 无法修复的违规代码列表 */
    public readonly unhealeableViolations: string[],
    
    /** 失败原因 */
    public readonly reason: string
  ) {}
  
  toString(): string {
    return `聚合根 ${this.aggregateId} 修复失败: ${this.reason}`;
  }
}

/**
 * 完整性检查完成事件
 * 当扫描完所有聚合根后发布，包含汇总信息
 */
export class IntegrityCheckCompletedEvent {
  readonly type = 'IntegrityCheckCompleted';
  
  constructor(
    /** 检查的聚合根总数 */
    public readonly totalCount: number,
    
    /** 通过检查的数量 */
    public readonly passedCount: number,
    
    /** 失败的数量 */
    public readonly failedCount: number,
    
    /** 发现的总违规数 */
    public readonly violationCount: number,
    
    /** 成功修复的违规数 */
    public readonly healedCount: number,
    
    /** 检查耗时（毫秒） */
    public readonly durationMs: number
  ) {}
  
  toString(): string {
    return `完整性检查完成: ${this.passedCount}/${this.totalCount} 通过, ` +
      `修复 ${this.healedCount}/${this.violationCount} 个违规`;
  }
}

/**
 * 完整性检查告警事件
 * 当发现严重问题（如失败率过高）时发布
 */
export class IntegrityCheckAlertEvent {
  readonly type = 'IntegrityCheckAlert';
  
  constructor(
    /** 告警类型 */
    public readonly alertType: 'FAILURE_RATE_HIGH' | 'CRITICAL_VIOLATIONS' | 'AUTO_HEAL_FAILURE',
    
    /** 告警信息 */
    public readonly message: string,
    
    /** 相关的统计数据 */
    public readonly metadata: Record<string, any> = {}
  ) {}
  
  toString(): string {
    return `[${this.alertType}] ${this.message}`;
  }
}
