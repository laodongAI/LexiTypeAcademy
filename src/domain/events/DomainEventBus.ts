import type { DomainEvent } from './DomainEvent';

/**
 * 事件处理器类型
 */
type EventHandler<T extends DomainEvent> = (event: T) => void | Promise<void>;

/**
 * 领域事件总线（单例）
 * 负责领域事件的发布和订阅
 */
export class DomainEventBus {
  private static instance: DomainEventBus;
  private handlers: Map<string, Set<EventHandler<any>>> = new Map();

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): DomainEventBus {
    if (!DomainEventBus.instance) {
      DomainEventBus.instance = new DomainEventBus();
    }
    return DomainEventBus.instance;
  }

  /**
   * 订阅事件
   * @param eventName 事件名称（事件类的类名）
   * @param handler 事件处理器
   */
  subscribe<T extends DomainEvent>(
    eventName: string,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, new Set());
    }
    this.handlers.get(eventName)!.add(handler);

    // 返回取消订阅函数
    return () => {
      const handlers = this.handlers.get(eventName);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }

  /**
   * 发布单个事件
   * @param event 领域事件
   */
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventName = event.getEventName();
    const handlers = this.handlers.get(eventName);

    if (!handlers || handlers.size === 0) {
      return;
    }

    // 并行执行所有处理器
    const promises = Array.from(handlers).map((handler) =>
      Promise.resolve(handler(event)).catch((error) => {
        console.error(
          `Error handling event ${eventName}:`,
          error,
          'Event:',
          event
        );
      })
    );

    await Promise.all(promises);
  }

  /**
   * 发布多个事件
   * @param events 领域事件数组
   */
  async publishAll(events: DomainEvent[]): Promise<void> {
    // 串行发布事件，保证顺序
    for (const event of events) {
      await this.publish(event);
    }
  }

  /**
   * 清空所有订阅（测试用）
   */
  clearAllHandlers(): void {
    this.handlers.clear();
  }

  /**
   * 获取某个事件的订阅者数量（测试用）
   */
  getHandlerCount(eventName: string): number {
    return this.handlers.get(eventName)?.size ?? 0;
  }
}
