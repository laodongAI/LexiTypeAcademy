/**
 * 事件源相关的领域事件
 * 这些事件在事件溯源系统的各个生命周期触发
 */

/**
 * 事件被追加到事件流的事件
 * 在事件成功保存到事件存储时触发
 */
export interface EventAppendedEvent {
  eventType: 'EventAppendedEvent';
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  storedEventType: string;
  storedEventVersion: number;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    correlationId?: string;
  };
}

/**
 * 聚合根被重放的事件
 * 在使用事件重放恢复聚合根后触发
 */
export interface AggregateReplayedEvent {
  eventType: 'AggregateReplayedEvent';
  aggregateId: string;
  aggregateType: string;
  replayedVersion: number;
  eventCount: number;
  usedSnapshot: boolean;
  snapshotVersion?: number;
  duration: number; // 毫秒
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    correlationId?: string;
  };
}

/**
 * 快照被创建的事件
 * 在保存聚合根快照时触发
 */
export interface SnapshotCreatedEvent {
  eventType: 'SnapshotCreatedEvent';
  aggregateId: string;
  aggregateType: string;
  version: number;
  snapshotSize: number; // 快照数据大小（字节）
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    reason?: string; // 创建快照的原因（如 'periodic', 'manual', 'auto'）
  };
}

/**
 * 事件流检测到不一致的事件
 * 当重放事件与预期状态不符时触发
 */
export interface EventStreamInconsistencyDetectedEvent {
  eventType: 'EventStreamInconsistencyDetectedEvent';
  aggregateId: string;
  aggregateType: string;
  inconsistencyType: 'version_mismatch' | 'state_divergence' | 'missing_events' | 'duplicate_events';
  expectedVersion: number;
  actualVersion: number;
  description: string;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    severity: 'warning' | 'error' | 'critical';
  };
}

/**
 * 事件流被修复的事件
 * 当自动修复事件流不一致时触发
 */
export interface EventStreamRepairedEvent {
  eventType: 'EventStreamRepairedEvent';
  aggregateId: string;
  aggregateType: string;
  inconsistencyType: string;
  repairStrategy: 'rebuild' | 'rollback' | 'merge' | 'manual';
  repairedVersion: number;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    repairDetails?: any;
  };
}

/**
 * 事件流修复失败的事件
 * 当自动修复失败时触发
 */
export interface EventStreamRepairFailedEvent {
  eventType: 'EventStreamRepairFailedEvent';
  aggregateId: string;
  aggregateType: string;
  inconsistencyType: string;
  attemptedStrategy: string;
  errorReason: string;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    requiresManualIntervention: boolean;
  };
}

/**
 * 聚合根的所有事件被验证的事件
 * 当完成事件流的完整性验证时触发
 */
export interface EventStreamValidatedEvent {
  eventType: 'EventStreamValidatedEvent';
  aggregateId: string;
  aggregateType: string;
  totalEvents: number;
  validationVersion: number;
  isValid: boolean;
  invalidEvents?: Array<{
    version: number;
    reason: string;
  }>;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
  };
}

/**
 * 聚合根的事件流被重新分割的事件
 * 当由于大小或时间限制需要分割时触发
 */
export interface EventStreamPartitionedEvent {
  eventType: 'EventStreamPartitionedEvent';
  aggregateId: string;
  aggregateType: string;
  fromVersion: number;
  toVersion: number;
  partitionKey: string;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    reason: string;
  };
}

/**
 * 并发冲突被检测的事件
 * 当尝试追加事件时发生版本冲突时触发
 */
export interface ConcurrencyConflictDetectedEvent {
  eventType: 'ConcurrencyConflictDetectedEvent';
  aggregateId: string;
  aggregateType: string;
  expectedVersion: number;
  actualVersion: number;
  conflictingEventType: string;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    clientId?: string;
  };
}

/**
 * 聚合根快照被清理的事件
 * 当删除过期快照时触发
 */
export interface SnapshotPurgedEvent {
  eventType: 'SnapshotPurgedEvent';
  aggregateId: string;
  aggregateType: string;
  purgedVersion: number;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    reason: string; // 清理原因（如 'age', 'space_limit' 等）
  };
}

/**
 * 事件源系统性能指标的事件
 * 定期记录事件源系统的性能数据
 */
export interface EventSourcingPerformanceMetricsEvent {
  eventType: 'EventSourcingPerformanceMetricsEvent';
  metrics: {
    totalEventsStored: number;
    totalAggregatesRecovered: number;
    averageReplayDuration: number; // 毫秒
    averageAppendDuration: number; // 毫秒
    snapshotHitRate: number; // 0-1
    cacheHitRate: number; // 0-1
    eventStoreSize: number; // 字节
    snapshotStoreSize: number; // 字节
  };
  period: {
    from: Date;
    to: Date;
  };
  timestamp: Date;
  metadata: {
    source: string;
  };
}

/**
 * 聚合根从事件构建出来的事件
 * 这个事件标记了聚合根的生命周期开始
 */
export interface AggregateCreatedFromEventEvent {
  eventType: 'AggregateCreatedFromEventEvent';
  aggregateId: string;
  aggregateType: string;
  creationEventId: string;
  creationEventType: string;
  initialState: any;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    correlationId?: string;
  };
}

/**
 * 聚合根事件项用于构建其他聚合根的事件
 * 支持事件之间的链式关系（causation chain）
 */
export interface EventCausationChainEvent {
  eventType: 'EventCausationChainEvent';
  eventId: string;
  causationEventId: string;
  correlationId: string;
  aggregateId: string;
  aggregateType: string;
  causationEventType: string;
  timestamp: Date;
  metadata: {
    source: string;
    userId?: string;
    depth: number; // 因果链深度
  };
}

/**
 * 事件类型定义
 * 所有事件源相关事件的并集
 */
export type EventSourcingEvent =
  | EventAppendedEvent
  | AggregateReplayedEvent
  | SnapshotCreatedEvent
  | EventStreamInconsistencyDetectedEvent
  | EventStreamRepairedEvent
  | EventStreamRepairFailedEvent
  | EventStreamValidatedEvent
  | EventStreamPartitionedEvent
  | ConcurrencyConflictDetectedEvent
  | SnapshotPurgedEvent
  | EventSourcingPerformanceMetricsEvent
  | AggregateCreatedFromEventEvent
  | EventCausationChainEvent;

/**
 * 事件源事件工厂函数
 * 用于创建类型安全的事件对象
 */
export const EventSourcingEventFactory = {
  /**
   * 创建 EventAppendedEvent
   */
  eventAppended(
    eventId: string,
    aggregateId: string,
    aggregateType: string,
    storedEventType: string,
    storedEventVersion: number,
    source: string,
    userId?: string
  ): EventAppendedEvent {
    return {
      eventType: 'EventAppendedEvent',
      eventId,
      aggregateId,
      aggregateType,
      storedEventType,
      storedEventVersion,
      timestamp: new Date(),
      metadata: {
        source,
        userId,
        correlationId: `${aggregateId}-${Date.now()}`,
      },
    };
  },

  /**
   * 创建 AggregateReplayedEvent
   */
  aggregateReplayed(
    aggregateId: string,
    aggregateType: string,
    replayedVersion: number,
    eventCount: number,
    duration: number,
    source: string,
    usedSnapshot: boolean = false,
    snapshotVersion?: number
  ): AggregateReplayedEvent {
    return {
      eventType: 'AggregateReplayedEvent',
      aggregateId,
      aggregateType,
      replayedVersion,
      eventCount,
      usedSnapshot,
      snapshotVersion,
      duration,
      timestamp: new Date(),
      metadata: {
        source,
        correlationId: `${aggregateId}-${Date.now()}`,
      },
    };
  },

  /**
   * 创建 SnapshotCreatedEvent
   */
  snapshotCreated(
    aggregateId: string,
    aggregateType: string,
    version: number,
    snapshotSize: number,
    source: string,
    reason?: string
  ): SnapshotCreatedEvent {
    return {
      eventType: 'SnapshotCreatedEvent',
      aggregateId,
      aggregateType,
      version,
      snapshotSize,
      timestamp: new Date(),
      metadata: {
        source,
        reason,
      },
    };
  },

  /**
   * 创建 ConcurrencyConflictDetectedEvent
   */
  concurrencyConflict(
    aggregateId: string,
    aggregateType: string,
    expectedVersion: number,
    actualVersion: number,
    conflictingEventType: string,
    source: string
  ): ConcurrencyConflictDetectedEvent {
    return {
      eventType: 'ConcurrencyConflictDetectedEvent',
      aggregateId,
      aggregateType,
      expectedVersion,
      actualVersion,
      conflictingEventType,
      timestamp: new Date(),
      metadata: {
        source,
        clientId: `conflict-${aggregateId}-${Date.now()}`,
      },
    };
  },
};
