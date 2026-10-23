/**
 * 事件源接口
 * 定义聚合根必须实现的事件溯源能力
 * 这个接口是 DDD 中聚合根的扩展，用于支持完整的事件溯源模式
 */

/**
 * 事件源接口
 * 实现此接口的聚合根可以支持完整的事件溯源能力
 */
export interface IEventSourced {
  /**
   * 获取聚合根的当前版本号
   * 版本号用于实现乐观锁，防止并发冲突
   * 
   * @returns 当前版本号（从 0 开始）
   */
  getVersion(): number;
  
  /**
   * 应用单个事件到聚合根
   * 用于事件重放时恢复聚合根状态
   * 
   * 重要：此方法应该是幂等的，即应用同一个事件多次应该得到相同的结果
   * 
   * @param event 要应用的事件对象
   * @throws 如果事件类型无法识别或应用失败时抛出异常
   */
  applyEvent(event: any): void;
  
  /**
   * 获取尚未保存到事件存储的事件列表
   * 这些事件待保存，称为"未提交事件"
   * 
   * @returns 未提交事件数组
   */
  getUncommittedEvents(): any[];
  
  /**
   * 清空未提交事件列表
   * 调用此方法后，getUncommittedEvents() 应返回空数组
   * 通常在成功保存事件到事件存储后调用
   */
  markEventsAsCommitted(): void;
  
  /**
   * 记录（追加）一个新的领域事件
   * 事件会被添加到未提交事件列表，等待后续保存
   * 
   * @param event 要记录的领域事件
   */
  recordEvent(event: any): void;
  
  /**
   * 生成聚合根的快照
   * 快照包含了聚合根的完整状态，用于优化事件重放
   * 
   * @returns 聚合根的快照对象
   */
  getSnapshot(): any;
  
  /**
   * 从快照恢复聚合根
   * 这是一个静态方法，但在接口中定义以说明实现者应该提供它
   * 
   * @param snapshot 快照对象
   * @returns 恢复后的聚合根实例
   */
  // static fromSnapshot(snapshot: any): this;
  
  /**
   * 从创建事件恢复聚合根
   * 创建事件是聚合根的起点，包含初始化数据
   * 
   * @param event 创建事件
   * @returns 新创建的聚合根实例
   */
  // static fromCreationEvent(event: any): this;
}

/**
 * 事件总线接口
 * 用于发布领域事件，支持事件驱动的应用逻辑
 */
export interface IEventBus {
  /**
   * 发布一个领域事件
   * 所有已注册的监听器都会被调用
   * 
   * @param event 要发布的事件
   */
  publish(event: any): Promise<void>;
  
  /**
   * 订阅特定类型的事件
   * 
   * @param eventType 事件类型（通常是事件类的名称）
   * @param handler 事件处理函数
   */
  subscribe(eventType: string, handler: (event: any) => Promise<void>): void;
  
  /**
   * 取消订阅
   * 
   * @param eventType 事件类型
   * @param handler 要移除的处理函数
   */
  unsubscribe(eventType: string, handler: (event: any) => Promise<void>): void;
}

/**
 * 事件应用器接口
 * 负责将领域事件应用到聚合根
 */
export interface IEventApplier {
  /**
   * 将事件应用到聚合根
   * 
   * @param aggregate 目标聚合根
   * @param event 要应用的事件
   */
  apply(aggregate: IEventSourced, event: any): void;
  
  /**
   * 检查是否可以应用指定的事件
   * 
   * @param event 要检查的事件
   * @returns 是否可以应用
   */
  canApply(event: any): boolean;
}

/**
 * 聚合根仓储接口（支持事件溯源）
 */
export interface IAggregateRepository {
  /**
   * 根据 ID 加载聚合根
   * 支持两种方式：从快照+增量重放，或完全从事件重放
   * 
   * @param aggregateId 聚合根 ID
   * @returns 加载的聚合根实例
   * @throws 如果聚合根不存在则抛出 AggregateNotFoundException
   */
  load(aggregateId: string): Promise<IEventSourced>;
  
  /**
   * 保存聚合根的未提交事件
   * 这是 Event Sourcing 的核心操作
   * 
   * @param aggregate 要保存的聚合根
   * @throws 如果版本冲突则抛出 ConcurrencyException
   */
  save(aggregate: IEventSourced): Promise<void>;
  
  /**
   * 检查聚合根是否存在
   * 
   * @param aggregateId 聚合根 ID
   * @returns 是否存在
   */
  exists(aggregateId: string): Promise<boolean>;
}

/**
 * Saga 接口
 * Saga 用于协调多个聚合根的业务流程，支持补偿机制
 */
export interface ISaga {
  /**
   * 启动 Saga
   * 
   * @param startEvent 触发 Saga 的事件
   */
  start(startEvent: any): Promise<void>;
  
  /**
   * 处理 Saga 中间步骤的结果
   * 
   * @param event 中间事件
   */
  handle(event: any): Promise<void>;
  
  /**
   * 完成 Saga
   */
  complete(): Promise<void>;
  
  /**
   * 补偿：回滚 Saga 中已执行的操作
   * 
   * @param reason 补偿原因
   */
  compensate(reason: string): Promise<void>;
  
  /**
   * 获取 Saga 的当前状态
   */
  getState(): any;
}
