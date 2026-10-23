/**
 * 存储事件值对象
 * 表示被持久化的领域事件，包含完整的元数据信息
 * 用于事件溯源、审计追踪、灾难恢复等场景
 */

/**
 * 事件元数据
 * 记录事件的上下文信息，用于追踪和分析
 */
export interface EventMetadata {
  /** 事件发生的时间戳 */
  timestamp: Date;
  
  /** 聚合根的版本号（应用该事件后的版本） */
  version: number;
  
  /** 触发该事件的用户 ID（可选） */
  userId?: string;
  
  /** 相关业务流程的关联 ID（用于追踪相关事件） */
  correlationId?: string;
  
  /** 直接原因事件的 ID（用于构建事件因果链） */
  causationId?: string;
  
  /** 事件来源：USER（用户行为）| SYSTEM（系统生成）| MIGRATION（数据迁移） */
  source?: 'USER' | 'SYSTEM' | 'MIGRATION';
  
  /** 执行该事件的操作人/系统的标识 */
  executedBy?: string;
  
  /** 其他自定义元数据 */
  [key: string]: any;
}

/**
 * 存储事件
 * 表示被持久化到事件存储的领域事件
 */
export interface StoredEvent {
  /** 事件的唯一 ID */
  eventId: string;
  
  /** 事件的类型名称（用于反序列化） */
  eventType: string;
  
  /** 该事件关联的聚合根 ID */
  aggregateId: string;
  
  /** 聚合根的类型 (e.g., 'Course', 'Lesson') */
  aggregateType: string;
  
  /** 事件的实际内容（领域事件对象） */
  payload: any;
  
  /** 事件的元数据 */
  metadata: EventMetadata;
  
  /** 事件在数据库中的创建时间 */
  createdAt: Date;
}

/**
 * 事件查询过滤条件
 */
export interface EventQueryFilters {
  /** 事件类型过滤 */
  eventType?: string;
  
  /** 从某个时间开始（包含） */
  fromDate?: Date;
  
  /** 到某个时间结束（包含） */
  toDate?: Date;
  
  /** 事件来源过滤 */
  source?: 'USER' | 'SYSTEM' | 'MIGRATION';
  
  /** 用户 ID 过滤 */
  userId?: string;
  
  /** 聚合根版本范围 */
  fromVersion?: number;
  toVersion?: number;
}

/**
 * 快照
 * 用于优化事件重放性能，定期保存聚合根的状态
 */
export interface Snapshot {
  /** 快照对应的聚合根 ID */
  aggregateId: string;
  
  /** 聚合根的类型 */
  aggregateType: string;
  
  /** 快照捕获的聚合根状态 */
  state: any;
  
  /** 快照对应的事件版本号 */
  version: number;
  
  /** 快照创建时间 */
  createdAt: Date;
  
  /** 快照的元数据（可选） */
  metadata?: {
    reason?: string; // 创建快照的原因
    size?: number;   // 快照数据大小（字节）
    [key: string]: any;
  };
}

/**
 * 事件流统计信息
 * 用于分析和监控事件的分布和特性
 */
export interface EventStreamStats {
  /** 该聚合根的总事件数 */
  totalEvents: number;
  
  /** 聚合根的当前版本号 */
  currentVersion: number;
  
  /** 第一个事件的时间 */
  firstEventTime?: Date;
  
  /** 最后一个事件的时间 */
  lastEventTime?: Date;
  
  /** 事件类型分布 */
  eventTypeDistribution: Record<string, number>;
  
  /** 事件来源分布 */
  sourceDistribution: Record<string, number>;
  
  /** 是否存在快照 */
  hasSnapshot: boolean;
  
  /** 最新快照的版本号 */
  latestSnapshotVersion?: number;
}

/**
 * 并发异常
 * 当乐观锁检查失败时抛出
 */
export class ConcurrencyException extends Error {
  constructor(
    public readonly expectedVersion: number,
    public readonly actualVersion: number,
    message: string
  ) {
    super(message);
    this.name = 'ConcurrencyException';
  }
}

/**
 * 聚合根未找到异常
 */
export class AggregateNotFoundException extends Error {
  constructor(public readonly aggregateId: string, message: string) {
    super(message);
    this.name = 'AggregateNotFoundException';
  }
}

/**
 * 事件不存在异常
 */
export class EventNotFoundException extends Error {
  constructor(public readonly eventId: string, message: string) {
    super(message);
    this.name = 'EventNotFoundException';
  }
}
