/**
 * 可验证接口
 * 定义聚合根必须实现的验证能力
 * 这个接口是 DDD 中值对象/聚合根的扩展，用于运行时完整性保证
 */

import { IntegrityCheckResult, SelfHealingResult } from '../valueobjects/IntegrityCheckResult';

/**
 * IVerifiable 接口
 * 任何需要运行时验证的聚合根都应实现此接口
 */
export interface IVerifiable {
  /**
   * 验证聚合根的所有不变量
   * 此方法应该是"纯粹"的（无副作用），仅返回验证结果
   * 
   * @returns 包含所有违规详情的验证结果
   * 
   * @example
   * const result = courseAggregate.verifyIntegrity();
   * if (!result.isValid) {
   *   console.log(`检查到 ${result.violations.length} 个违规`);
   *   for (const violation of result.violations) {
   *     console.log(`${violation.code}: ${violation.message}`);
   *   }
   * }
   */
  verifyIntegrity(): IntegrityCheckResult;
  
  /**
   * 尝试自动修复聚合根的完整性问题
   * 此方法可能修改聚合根的状态（有副作用）
   * 
   * @returns 修复结果，包括成功/失败的违规列表
   * 
   * @remarks
   * - 某些违规可以自动修复（如重新计算统计数据）
   * - 某些违规无法自动修复，需要手动干预（如 CEFR 级别有效性）
   * - 修复后应发布相应的领域事件
   * 
   * @example
   * const healingResult = await courseAggregate.attemptSelfHealing();
   * if (healingResult.success) {
   *   console.log(`成功修复 ${healingResult.healed.length} 个违规`);
   * }
   */
  attemptSelfHealing(): Promise<SelfHealingResult>;
}
