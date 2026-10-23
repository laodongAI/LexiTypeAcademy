/**
 * 完整性检查结果类型定义
 * 用于表示聚合根验证的结果，包括违规详情、严重级别等
 */

/**
 * 完整性违规信息
 * 表示聚合根的某个不变量被违反
 */
export interface IntegrityViolation {
  /** 违规代码，用于标识违规类型 (e.g. 'LESSON_COUNT_EXCEEDED') */
  code: string;
  
  /** 人类可读的违规消息 */
  message: string;
  
  /** 期望的值（可选，用于调试） */
  expectedValue?: any;
  
  /** 实际的值（可选，用于调试） */
  actualValue?: any;
  
  /** 修复建议（可选，帮助开发者了解如何修复） */
  remediation?: string;
}

/**
 * 完整性检查结果
 * 包含所有验证信息和修复建议
 */
export interface IntegrityCheckResult {
  /** 聚合根是否通过完整性检查 */
  isValid: boolean;
  
  /** 所有发现的违规（如果 isValid=true 则为空数组） */
  violations: IntegrityViolation[];
  
  /** 严重级别：CRITICAL (立即修复) | WARNING (需要注意) | INFO (仅通知) */
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  
  /** 检查时间戳 */
  checkedAt: Date;
  
  /** 被检查的聚合根 ID */
  aggregateId: string;
  
  /** 被检查的聚合根类型 (e.g. 'Course', 'Lesson') */
  aggregateType: string;
}

/**
 * 自我修复结果
 * 表示聚合根尝试修复自身时的结果
 */
export interface SelfHealingResult {
  /** 是否修复成功 */
  success: boolean;
  
  /** 修复的违规列表 */
  healed: string[];
  
  /** 无法修复的违规列表 */
  unhealed: string[];
  
  /** 修复操作的详细日志 */
  log: string;
  
  /** 修复时间戳 */
  healedAt: Date;
}
