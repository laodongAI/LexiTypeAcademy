/**
 * 事件存储实现
 * 负责事件的持久化、重放、快照管理和审计追踪
 * 这是 Event Sourcing 架构的核心组件
 */

import Dexie from 'dexie';
import { StoredEvent, EventQueryFilters, Snapshot, EventStreamStats } from '../../domain/valueobjects/StoredEvent';
import { ConcurrencyException, AggregateNotFoundException, EventNotFoundException } from '../../domain/valueobjects/StoredEvent';
import { IEventSourced } from '../../domain/interfaces/IEventSourced';

/**
 * 事件存储表定义
 */
interface StoredEventRecord {
  id?: number;
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  payload: any;
  metadata: any;
  createdAt: Date;
  _indexed?: Date;
}

interface SnapshotRecord {
  id?: number;
  aggregateId: string;
  aggregateType: string;
  version: number;
  state: any;
  metadata: any;
  createdAt: Date;
}

/**
 * 事件存储数据库
 */
class EventStoreDB extends Dexie {
  events!: Dexie.Table<StoredEventRecord, number>;
  snapshots!: Dexie.Table<SnapshotRecord, number>;
  eventSnapshots!: Dexie.Table<any, number>;
  eventProjections!: Dexie.Table<any, number>;

  constructor() {
    super('EventStoreDB');
    this.version(1).stores({
      // 事件表：支持按聚合根ID、事件类型、创建时间查询
      events: '++id, aggregateId, [aggregateId+version], eventType, createdAt',
      // 快照表：支持按聚合根ID查询最新快照
      snapshots: '++id, [aggregateId+version], aggregateId',
      // 事件-快照关联表：用于查询快照后的事件
      eventSnapshots: '++id, aggregateId, snapshotVersion',
      // 事件投影表：用于读模型的快照
      eventProjections: '++id, aggregateId, projectionType',
    });
  }
}

/**
 * 事件存储类
 * 提供完整的 Event Sourcing 支持
 */
export class EventStore {
  private db: EventStoreDB;
  private aggregateRegistry: Map<string, new () => IEventSourced> = new Map();
  private eventHandlers: Map<string, ((event: any) => void)[]> = new Map();
  
  constructor() {
    this.db = new EventStoreDB();
  }

  /**
   * 初始化事件存储
   */
  async initialize(): Promise<void> {
    try {
      await this.db.open();
    } catch (error) {
      console.error('事件存储初始化失败:', error);
      throw error;
    }
  }

  /**
   * 关闭事件存储连接
   */
  async close(): Promise<void> {
    await this.db.close();
  }

  /**
   * 注册聚合根类型
   * 用于在事件重放时创建正确的聚合根实例
   * 
   * @param aggregateType 聚合根类型名称
   * @param aggregateClass 聚合根类
   */
  registerAggregateType(aggregateType: string, aggregateClass: new () => IEventSourced): void {
    this.aggregateRegistry.set(aggregateType, aggregateClass);
  }

  /**
   * 追加事件到事件流
   * 支持批量追加和乐观锁并发控制
   * 
   * @param aggregateId 聚合根ID
   * @param events 要追加的事件数组
   * @param expectedVersion 期望的版本号（用于乐观锁）
   * @throws ConcurrencyException 如果版本冲突
   */
  async append(
    aggregateId: string,
    events: Omit<StoredEvent, 'eventId' | 'createdAt'>[],
    expectedVersion: number
  ): Promise<void> {
    // 1. 获取当前版本
    const currentVersion = await this.getCurrentVersion(aggregateId);
    
    // 2. 乐观锁检查
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyException(
        expectedVersion,
        currentVersion,
        `并发冲突: 期望版本 ${expectedVersion}, 实际版本 ${currentVersion}`
      );
    }

    // 3. 原子性保存事件
    try {
      await this.db.transaction('readwrite', this.db.events, async () => {
        let newVersion = currentVersion;
        
        for (const event of events) {
          newVersion++;
          
          const storedEvent: StoredEventRecord = {
            eventId: this.generateEventId(),
            eventType: event.eventType,
            aggregateId: event.aggregateId,
            aggregateType: event.aggregateType,
            version: newVersion,
            payload: event.payload,
            metadata: {
              ...event.metadata,
              appended: new Date(),
            },
            createdAt: new Date(),
          };
          
          await this.db.events.add(storedEvent);
        }
      });
      
      // 4. 触发事件处理器
      for (const event of events) {
        await this.triggerHandlers(event.eventType, event);
      }
    } catch (error) {
      if (error instanceof ConcurrencyException) {
        throw error;
      }
      console.error('追加事件失败:', error);
      throw error;
    }
  }

  /**
   * 获取聚合根的所有事件
   * 支持按版本范围过滤
   * 
   * @param aggregateId 聚合根ID
   * @param fromVersion 起始版本（包含）
   * @param toVersion 结束版本（包含）
   * @returns 事件数组
   * @throws AggregateNotFoundException 如果聚合根不存在
   */
  async getEvents(
    aggregateId: string,
    fromVersion: number = 0,
    toVersion?: number
  ): Promise<StoredEvent[]> {
    const events = await this.db.events
      .where('[aggregateId+version]')
      .between([aggregateId, fromVersion], [aggregateId, toVersion ?? Infinity])
      .toArray();

    if (events.length === 0) {
      throw new AggregateNotFoundException(
        `未找到聚合根: ${aggregateId}`,
        aggregateId
      );
    }

    return events.map(this.mapToStoredEvent);
  }

  /**
   * 重放聚合根（完整重建）
   * 从起始事件开始，逐个应用所有事件，完整重建聚合根
   * 
   * @param aggregateId 聚合根ID
   * @param toVersion 重放到指定版本（可选）
   * @returns 重放后的聚合根实例
   * @throws AggregateNotFoundException 如果找不到聚合根
   */
  async replay(
    aggregateId: string,
    toVersion?: number
  ): Promise<IEventSourced> {
    const events = await this.getEvents(aggregateId, 0, toVersion);
    
    if (events.length === 0) {
      throw new AggregateNotFoundException(
        `找不到可用于重放的事件: ${aggregateId}`,
        aggregateId
      );
    }

    // 获取聚合根类型
    const aggregateType = events[0].aggregateType;
    const AggregateClass = this.aggregateRegistry.get(aggregateType);
    
    if (!AggregateClass) {
      throw new Error(`未注册的聚合根类型: ${aggregateType}`);
    }

    // 创建新实例
    const aggregate = new AggregateClass();

    // 应用所有事件
    for (const event of events) {
      if (toVersion && event.metadata.version > toVersion) {
        break;
      }
      aggregate.applyEvent(event);
    }

    return aggregate;
  }

  /**
   * 使用快照重放（性能优化版本）
   * 先加载最新快照，然后应用快照之后的增量事件
   * 
   * @param aggregateId 聚合根ID
   * @param toVersion 重放到指定版本（可选）
   * @returns 重放后的聚合根实例
   */
  async replayWithSnapshot(
    aggregateId: string,
    toVersion?: number
  ): Promise<IEventSourced> {
    // 1. 尝试加载快照
    const snapshot = await this.getLatestSnapshot(aggregateId);

    let aggregate: IEventSourced;
    let fromVersion = 0;

    if (snapshot) {
      // 2. 从快照恢复
      const AggregateClass = this.aggregateRegistry.get(snapshot.aggregateType);
      if (!AggregateClass) {
        throw new Error(`未注册的聚合根类型: ${snapshot.aggregateType}`);
      }

      aggregate = new AggregateClass();
      // 应用快照状态（假设聚合根实现了快照恢复逻辑）
      aggregate.applyEvent({
        eventType: '__snapshot__',
        payload: snapshot.state,
        metadata: snapshot.metadata,
      });

      fromVersion = snapshot.version;
    } else {
      // 3. 如果没有快照，执行完整重放
      return this.replay(aggregateId, toVersion);
    }

    // 4. 应用快照之后的增量事件
    try {
      const incrementalEvents = await this.db.events
        .where('[aggregateId+version]')
        .between(
          [aggregateId, fromVersion + 1],
          [aggregateId, toVersion ?? Infinity]
        )
        .toArray();

      for (const event of incrementalEvents) {
        aggregate.applyEvent(this.mapToStoredEvent(event));
      }
    } catch {
      // 如果获取增量事件失败，尝试完整重放
      return this.replay(aggregateId, toVersion);
    }

    return aggregate;
  }

  /**
   * 保存快照
   * 快照包含聚合根的完整状态，用于加速后续的重放
   * 
   * @param aggregateId 聚合根ID
   * @param aggregate 聚合根实例
   * @param version 聚合根的当前版本
   */
  async saveSnapshot(
    aggregateId: string,
    aggregate: IEventSourced,
    version: number
  ): Promise<void> {
    const snapshot = aggregate.getSnapshot();
    
    const snapshotRecord: SnapshotRecord = {
      aggregateId,
      aggregateType: (aggregate as any).aggregateType || 'Unknown',
      version,
      state: snapshot,
      metadata: {
        savedAt: new Date(),
        aggregateVersion: version,
      },
      createdAt: new Date(),
    };

    try {
      await this.db.snapshots.add(snapshotRecord);
    } catch (error) {
      console.error('保存快照失败:', error);
      throw error;
    }
  }

  /**
   * 获取审计追踪
   * 用于合规性审计和事件追踪
   * 
   * @param aggregateId 聚合根ID
   * @param filters 过滤条件
   * @returns 符合条件的事件列表
   */
  async getAuditTrail(
    aggregateId: string,
    filters?: EventQueryFilters
  ): Promise<StoredEvent[]> {
    let query = this.db.events.where('aggregateId').equals(aggregateId);

    if (filters?.eventType) {
      query = this.db.events.where('eventType').equals(filters.eventType);
    }

    let results = await query.toArray();

    // 应用版本范围过滤
    if (filters?.fromVersion !== undefined || filters?.toVersion !== undefined) {
      results = results.filter(e => {
        const version = e.version;
        const from = filters.fromVersion ?? 0;
        const to = filters.toVersion ?? Infinity;
        return version >= from && version <= to;
      });
    }

    // 应用日期范围过滤
    if (filters?.fromDate || filters?.toDate) {
      results = results.filter(e => {
        const date = new Date(e.createdAt);
        const from = filters.fromDate ? new Date(filters.fromDate) : new Date(0);
        const to = filters.toDate ? new Date(filters.toDate) : new Date();
        return date >= from && date <= to;
      });
    }

    // 应用源过滤
    if (filters?.source) {
      results = results.filter(e => e.metadata.source === filters.source);
    }

    // 应用用户过滤
    if (filters?.userId) {
      results = results.filter(e => e.metadata.userId === filters.userId);
    }

    return results.map(this.mapToStoredEvent);
  }

  /**
   * 获取事件流统计
   * 
   * @param aggregateId 聚合根ID
   * @returns 统计信息
   */
  async getStreamStats(aggregateId: string): Promise<EventStreamStats> {
    const events = await this.db.events
      .where('aggregateId')
      .equals(aggregateId)
      .toArray();

    if (events.length === 0) {
      throw new AggregateNotFoundException(
        `找不到事件流: ${aggregateId}`,
        aggregateId
      );
    }

    // 计算统计信息
    const eventTypeDistribution: Record<string, number> = {};
    const sourceDistribution: Record<string, number> = {};
    const versions = events.map(e => e.version);

    for (const event of events) {
      eventTypeDistribution[event.eventType] = (eventTypeDistribution[event.eventType] ?? 0) + 1;
      sourceDistribution[event.metadata.source || 'unknown'] =
        (sourceDistribution[event.metadata.source || 'unknown'] ?? 0) + 1;
    }

    const latestSnapshot = await this.getLatestSnapshot(aggregateId);
    const sortedDates = events.map(e => new Date(e.createdAt).getTime()).sort((a, b) => a - b);

    return {
      totalEvents: events.length,
      currentVersion: Math.max(...versions),
      firstEventTime: sortedDates.length > 0 ? new Date(sortedDates[0]) : undefined,
      lastEventTime: sortedDates.length > 0 ? new Date(sortedDates[sortedDates.length - 1]) : undefined,
      eventTypeDistribution,
      sourceDistribution,
      hasSnapshot: !!latestSnapshot,
      latestSnapshotVersion: latestSnapshot?.version,
    };
  }

  /**
   * 清空所有事件（仅用于测试）
   */
  async clearAllEvents(): Promise<void> {
    await this.db.events.clear();
    await this.db.snapshots.clear();
  }

  /**
   * 私有方法
   */

  /**
   * 获取聚合根的当前版本号
   */
  private async getCurrentVersion(aggregateId: string): Promise<number> {
    const lastEvent = await this.db.events
      .where('aggregateId')
      .equals(aggregateId)
      .last();

    return lastEvent ? lastEvent.version : 0;
  }

  /**
   * 获取最新快照
   */
  private async getLatestSnapshot(aggregateId: string): Promise<SnapshotRecord | undefined> {
    return this.db.snapshots
      .where('aggregateId')
      .equals(aggregateId)
      .last();
  }

  /**
   * 转换数据库记录为 StoredEvent
   */
  private mapToStoredEvent(record: StoredEventRecord): StoredEvent {
    return {
      eventId: record.eventId,
      eventType: record.eventType,
      aggregateId: record.aggregateId,
      aggregateType: record.aggregateType,
      payload: record.payload,
      metadata: record.metadata,
      createdAt: record.createdAt,
    };
  }

  /**
   * 生成唯一的事件ID
   */
  private generateEventId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 注册事件处理器
   */
  private registerEventHandler(
    eventType: string,
    handler: (event: any) => void
  ): void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    this.eventHandlers.get(eventType)!.push(handler);
  }

  /**
   * 触发事件处理器
   */
  private async triggerHandlers(eventType: string, event: any): Promise<void> {
    const handlers = this.eventHandlers.get(eventType);
    if (!handlers) return;

    for (const handler of handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error(`处理事件 ${eventType} 失败:`, error);
      }
    }
  }
}

// 导出单例
export const eventStore = new EventStore();
