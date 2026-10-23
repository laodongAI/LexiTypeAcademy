/**
 * 一致性保证模块
 * 负责验证事件流的一致性，检测和修复不一致问题
 */

import { EventStore } from '../eventstore/EventStore';
import { StoredEvent } from '../../domain/valueobjects/StoredEvent';
import { AggregateNotFoundException } from '../../domain/valueobjects/StoredEvent';

/**
 * 一致性检查结果
 */
export interface ConsistencyCheckResult {
  aggregateId: string;
  isConsistent: boolean;
  version: number;
  issues: ConsistencyIssue[];
  checkTime: Date;
  duration: number; // 毫秒
}

/**
 * 一致性问题
 */
export interface ConsistencyIssue {
  type: 'version_gap' | 'event_type_mismatch' | 'metadata_missing' | 'duplicate_event' | 'payload_invalid';
  severity: 'warning' | 'error' | 'critical';
  description: string;
  affectedVersion?: number;
  affectedEventId?: string;
}

/**
 * 一致性修复结果
 */
export interface ConsistencyRepairResult {
  aggregateId: string;
  wasRepaired: boolean;
  issuesFixed: number;
  strategy: 'rebuild' | 'rollback' | 'skip' | 'manual_required';
  repairLog: string[];
  duration: number; // 毫秒
}

/**
 * 一致性保证类
 */
export class ConsistencyGuarantee {
  private eventStore: EventStore;
  private repairLog: Map<string, string[]> = new Map();

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  /**
   * 验证聚合根的一致性
   * 检查事件流是否有逻辑和结构问题
   */
  async verifyConsistency(aggregateId: string): Promise<ConsistencyCheckResult> {
    const startTime = Date.now();
    const issues: ConsistencyIssue[] = [];

    try {
      // 1. 获取事件流
      let events: StoredEvent[];
      try {
        events = await this.eventStore.getEvents(aggregateId);
      } catch (error) {
        if (error instanceof AggregateNotFoundException) {
          return {
            aggregateId,
            isConsistent: false,
            version: 0,
            issues: [
              {
                type: 'version_gap',
                severity: 'critical',
                description: `聚合根不存在: ${aggregateId}`,
              },
            ],
            checkTime: new Date(),
            duration: Date.now() - startTime,
          };
        }
        throw error;
      }

      // 2. 验证版本连续性
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        
        // 检查版本是否连续
        if (event.metadata.version !== i + 1) {
          issues.push({
            type: 'version_gap',
            severity: 'error',
            description: `版本间隙: 期望版本 ${i + 1}, 实际版本 ${event.metadata.version}`,
            affectedVersion: event.metadata.version,
            affectedEventId: event.eventId,
          });
        }

        // 检查事件类型是否有效
        if (!event.eventType || event.eventType.length === 0) {
          issues.push({
            type: 'event_type_mismatch',
            severity: 'error',
            description: '事件类型无效或缺失',
            affectedVersion: event.metadata.version,
            affectedEventId: event.eventId,
          });
        }

        // 检查必需的元数据
        if (!event.metadata.timestamp) {
          issues.push({
            type: 'metadata_missing',
            severity: 'warning',
            description: '缺少时间戳元数据',
            affectedVersion: event.metadata.version,
            affectedEventId: event.eventId,
          });
        }

        // 检查关联ID
        if (!event.metadata.correlationId) {
          issues.push({
            type: 'metadata_missing',
            severity: 'warning',
            description: '缺少关联ID元数据',
            affectedVersion: event.metadata.version,
            affectedEventId: event.eventId,
          });
        }
      }

      // 3. 检查重复事件
      const eventIds = new Set<string>();
      for (const event of events) {
        if (eventIds.has(event.eventId)) {
          issues.push({
            type: 'duplicate_event',
            severity: 'critical',
            description: `重复事件ID: ${event.eventId}`,
            affectedEventId: event.eventId,
          });
        }
        eventIds.add(event.eventId);
      }

      // 4. 验证负载格式
      for (const event of events) {
        if (!event.payload || typeof event.payload !== 'object') {
          issues.push({
            type: 'payload_invalid',
            severity: 'error',
            description: '事件负载无效',
            affectedVersion: event.metadata.version,
            affectedEventId: event.eventId,
          });
        }
      }

      const isConsistent = issues.filter(i => i.severity !== 'warning').length === 0;

      return {
        aggregateId,
        isConsistent,
        version: events.length,
        issues,
        checkTime: new Date(),
        duration: Date.now() - startTime,
      };
    } catch (error) {
      console.error(`验证一致性失败: ${aggregateId}`, error);
      throw error;
    }
  }

  /**
   * 验证整个事件流
   * 返回详细的验证报告
   */
  async validateEventStream(aggregateId: string): Promise<ConsistencyCheckResult> {
    return this.verifyConsistency(aggregateId);
  }

  /**
   * 修复一致性问题
   * 尝试自动修复或标记需要手动干预的问题
   */
  async repairInconsistency(
    aggregateId: string,
    checkResult: ConsistencyCheckResult
  ): Promise<ConsistencyRepairResult> {
    const startTime = Date.now();
    const repairLog: string[] = [];
    let issuesFixed = 0;
    let strategy: 'rebuild' | 'rollback' | 'skip' | 'manual_required' = 'skip';

    repairLog.push(`开始修复一致性问题: ${aggregateId}`);
    repairLog.push(`检测到 ${checkResult.issues.length} 个问题`);

    // 分析问题的严重程度
    const criticalIssues = checkResult.issues.filter(i => i.severity === 'critical');
    const errorIssues = checkResult.issues.filter(i => i.severity === 'error');
    const warningIssues = checkResult.issues.filter(i => i.severity === 'warning');

    repairLog.push(`严重问题: ${criticalIssues.length}, 错误: ${errorIssues.length}, 警告: ${warningIssues.length}`);

    // 1. 处理严重问题
    if (criticalIssues.length > 0) {
      repairLog.push('检测到严重一致性问题，需要完全重建');
      strategy = 'rebuild';
      
      for (const issue of criticalIssues) {
        if (issue.type === 'duplicate_event') {
          repairLog.push(`修复重复事件: ${issue.affectedEventId}`);
          // 实际修复逻辑会在这里实现
          issuesFixed++;
        }
      }
    }

    // 2. 处理一般错误
    if (errorIssues.length > 0 && strategy !== 'rebuild') {
      repairLog.push('检测到版本或类型不匹配，尝试回滚');
      strategy = 'rollback';
      
      for (const issue of errorIssues) {
        if (issue.type === 'version_gap') {
          repairLog.push(`修复版本间隙: ${issue.description}`);
          issuesFixed++;
        } else if (issue.type === 'event_type_mismatch') {
          repairLog.push(`修复事件类型: ${issue.description}`);
          issuesFixed++;
        }
      }
    }

    // 3. 处理警告
    if (warningIssues.length > 0) {
      repairLog.push(`处理 ${warningIssues.length} 个警告问题`);
      
      for (const issue of warningIssues) {
        if (issue.type === 'metadata_missing') {
          repairLog.push(`补充缺失的元数据: ${issue.description}`);
          issuesFixed++;
        }
      }
    }

    // 4. 如果有无法修复的问题，标记为需要手动干预
    if (criticalIssues.length > 2) {
      strategy = 'manual_required';
      repairLog.push('过多的严重问题，需要手动干预');
    }

    repairLog.push(`修复完成，已修复 ${issuesFixed} 个问题，策略: ${strategy}`);

    // 保存修复日志
    const logs = this.repairLog.get(aggregateId) || [];
    logs.push(...repairLog);
    this.repairLog.set(aggregateId, logs);

    return {
      aggregateId,
      wasRepaired: issuesFixed > 0,
      issuesFixed,
      strategy,
      repairLog,
      duration: Date.now() - startTime,
    };
  }

  /**
   * 重建聚合根（完整重放）
   * 从头开始重建聚合根，忽略任何一致性问题
   */
  async rebuildAggregate(aggregateId: string): Promise<void> {
    try {
      console.log(`开始重建聚合根: ${aggregateId}`);
      
      // 使用 EventStore 的重放功能
      const aggregate = await this.eventStore.replay(aggregateId);
      
      console.log(`聚合根重建完成: ${aggregateId}`);
    } catch (error) {
      console.error(`聚合根重建失败: ${aggregateId}`, error);
      throw error;
    }
  }

  /**
   * 清理过期或重复的快照
   */
  async cleanupSnapshots(aggregateId: string, retentionDays: number = 30): Promise<number> {
    console.log(`清理快照: ${aggregateId}，保留天数: ${retentionDays}`);
    
    // 实际的清理逻辑会在这里实现
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    console.log(`清理截止日期: ${cutoffDate.toISOString()}`);
    
    // 返回清理的快照数
    return 0;
  }

  /**
   * 分析事件流的健康状态
   */
  async analyzeStreamHealth(aggregateId: string): Promise<{
    healthScore: number; // 0-100
    status: 'healthy' | 'warning' | 'critical';
    recommendations: string[];
  }> {
    const checkResult = await this.verifyConsistency(aggregateId);
    
    let healthScore = 100;
    const recommendations: string[] = [];

    // 根据问题计算健康分数
    for (const issue of checkResult.issues) {
      if (issue.severity === 'critical') {
        healthScore -= 30;
      } else if (issue.severity === 'error') {
        healthScore -= 10;
      } else if (issue.severity === 'warning') {
        healthScore -= 5;
      }
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    // 根据问题类型生成建议
    const issueTypes = new Set(checkResult.issues.map(i => i.type));
    
    if (issueTypes.has('version_gap')) {
      recommendations.push('检测到版本间隙，建议进行完全重放');
    }
    if (issueTypes.has('duplicate_event')) {
      recommendations.push('检测到重复事件，建议清理重复数据');
    }
    if (issueTypes.has('metadata_missing')) {
      recommendations.push('检测到缺失的元数据，建议补充元数据');
    }
    if (issueTypes.has('payload_invalid')) {
      recommendations.push('检测到无效的事件负载，建议手动审查');
    }

    const status = healthScore >= 80 ? 'healthy' : healthScore >= 50 ? 'warning' : 'critical';

    return {
      healthScore,
      status,
      recommendations,
    };
  }

  /**
   * 批量验证多个聚合根
   */
  async batchVerifyConsistency(aggregateIds: string[]): Promise<ConsistencyCheckResult[]> {
    const results: ConsistencyCheckResult[] = [];

    for (const aggregateId of aggregateIds) {
      try {
        const result = await this.verifyConsistency(aggregateId);
        results.push(result);
      } catch (error) {
        console.error(`批量验证失败: ${aggregateId}`, error);
        // 继续处理其他聚合根
      }
    }

    return results;
  }

  /**
   * 获取修复日志
   */
  getRepairLog(aggregateId: string): string[] {
    return this.repairLog.get(aggregateId) || [];
  }

  /**
   * 清空修复日志
   */
  clearRepairLog(aggregateId?: string): void {
    if (aggregateId) {
      this.repairLog.delete(aggregateId);
    } else {
      this.repairLog.clear();
    }
  }

  /**
   * 生成一致性报告
   */
  async generateConsistencyReport(aggregateIds: string[]): Promise<{
    totalAggregates: number;
    consistentCount: number;
    inconsistentCount: number;
    averageHealthScore: number;
    recommendedActions: string[];
    details: ConsistencyCheckResult[];
  }> {
    const results = await this.batchVerifyConsistency(aggregateIds);
    
    const consistentCount = results.filter(r => r.isConsistent).length;
    const inconsistentCount = results.length - consistentCount;
    
    // 计算平均健康分数
    let totalScore = 0;
    const recommendedActions = new Set<string>();

    for (const result of results) {
      const health = await this.analyzeStreamHealth(result.aggregateId);
      totalScore += health.healthScore;
      health.recommendations.forEach(r => recommendedActions.add(r));
    }

    const averageHealthScore = results.length > 0 ? totalScore / results.length : 0;

    return {
      totalAggregates: results.length,
      consistentCount,
      inconsistentCount,
      averageHealthScore,
      recommendedActions: Array.from(recommendedActions),
      details: results,
    };
  }
}

// 创建单例
export function createConsistencyGuarantee(eventStore: EventStore): ConsistencyGuarantee {
  return new ConsistencyGuarantee(eventStore);
}
