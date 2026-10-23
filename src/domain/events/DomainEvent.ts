/**
 * 领域事件基类
 * 所有领域事件都应该继承这个基类
 */
export abstract class DomainEvent {
  /**
   * 事件唯一标识
   */
  public readonly eventId: string;

  /**
   * 事件发生时间
   */
  public readonly occurredOn: Date;

  /**
   * 关联的聚合根ID
   */
  public readonly aggregateId: string;

  constructor(aggregateId: string) {
    this.eventId = crypto.randomUUID();
    this.occurredOn = new Date();
    this.aggregateId = aggregateId;
  }

  /**
   * 获取事件类型名称
   */
  getEventName(): string {
    return this.constructor.name;
  }
}

/**
 * 音频生成完成事件
 */
export class AudioGeneratedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly audioUrl: string,
    public readonly duration: number
  ) {
    super(courseId);
  }
}

/**
 * 音频播放开始事件
 */
export class AudioPlaybackStartedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly position: number
  ) {
    super(courseId);
  }
}

/**
 * 音频播放完成事件
 */
export class AudioPlaybackCompletedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly totalDuration: number
  ) {
    super(courseId);
  }
}

/**
 * 录音完成事件
 */
export class RecordingCompletedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly recordingId: string,
    public readonly audioBlob: Blob,
    public readonly duration: number
  ) {
    super(courseId);
  }
}

/**
 * 音频生成开始事件
 */
export class AudioGenerationStartedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly text: string
  ) {
    super(courseId);
  }
}

/**
 * 音频生成完成事件（聚合根内部使用）
 */
export class AudioGenerationCompletedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly audioUrl: string
  ) {
    super(courseId);
  }
}

/**
 * 音频生成失败事件
 */
export class AudioGenerationFailedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly audioId: string,
    public readonly error: Error
  ) {
    super(courseId);
  }
}
