import {
  AudioGenerationStartedEvent,
  AudioGenerationCompletedEvent,
  AudioGenerationFailedEvent,
  type DomainEvent,
} from '../events/DomainEvent';
import { AudioNotFoundError } from '../errors/DomainError';

/**
 * 音频项状态
 */
export enum AudioItemStatus {
  /** 待生成 */
  PENDING = 'pending',
  /** 生成中 */
  GENERATING = 'generating',
  /** 已完成 */
  COMPLETED = 'completed',
  /** 失败 */
  FAILED = 'failed',
}

/**
 * 音频项（值对象）
 */
export interface AudioItem {
  /** 音频项ID */
  id: string;
  /** 文本内容 */
  text: string;
  /** 音频URL（生成后） */
  audioUrl?: string;
  /** 状态 */
  status: AudioItemStatus;
  /** 错误信息（失败时） */
  error?: Error;
  /** 创建时间 */
  createdAt: Date;
  /** 更新时间 */
  updatedAt: Date;
}

/**
 * 课程音频聚合根
 * 封装课程音频生成的一致性边界
 */
export class CourseAudioAggregate {
  /** 课程ID */
  private readonly courseId: string;

  /** 音频项列表 */
  private audioItems: Map<string, AudioItem> = new Map();

  /** 领域事件列表 */
  private domainEvents: DomainEvent[] = [];

  constructor(courseId: string) {
    this.courseId = courseId;
  }

  /**
   * 添加音频项
   * 业务规则：同一ID的音频项只能添加一次
   */
  addAudioItem(id: string, text: string): void {
    if (this.audioItems.has(id)) {
      throw new Error(`音频项已存在: ${id}`);
    }

    const audioItem: AudioItem = {
      id,
      text,
      status: AudioItemStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.audioItems.set(id, audioItem);
  }

  /**
   * 开始生成音频
   * 业务规则：只有PENDING状态的音频项才能开始生成
   */
  startGeneration(audioId: string): void {
    const item = this.audioItems.get(audioId);
    if (!item) {
      throw new AudioNotFoundError(audioId);
    }

    if (item.status !== AudioItemStatus.PENDING) {
      throw new Error(
        `音频项状态不正确，无法开始生成: ${audioId} (当前状态: ${item.status})`
      );
    }

    // 更新状态
    item.status = AudioItemStatus.GENERATING;
    item.updatedAt = new Date();

    // 记录领域事件
    this.domainEvents.push(
      new AudioGenerationStartedEvent(this.courseId, audioId, item.text)
    );
  }

  /**
   * 标记音频项为已完成
   * 业务规则：只有GENERATING状态的音频项才能标记为完成
   */
  markItemCompleted(audioId: string, audioUrl: string): void {
    const item = this.audioItems.get(audioId);
    if (!item) {
      throw new AudioNotFoundError(audioId);
    }

    if (item.status !== AudioItemStatus.GENERATING) {
      throw new Error(
        `音频项状态不正确，无法标记为完成: ${audioId} (当前状态: ${item.status})`
      );
    }

    // 更新状态
    item.status = AudioItemStatus.COMPLETED;
    item.audioUrl = audioUrl;
    item.updatedAt = new Date();

    // 记录领域事件
    this.domainEvents.push(
      new AudioGenerationCompletedEvent(this.courseId, audioId, audioUrl)
    );
  }

  /**
   * 标记音频项为失败
   * 业务规则：只有GENERATING状态的音频项才能标记为失败
   */
  markItemFailed(audioId: string, error: Error): void {
    const item = this.audioItems.get(audioId);
    if (!item) {
      throw new AudioNotFoundError(audioId);
    }

    if (item.status !== AudioItemStatus.GENERATING) {
      throw new Error(
        `音频项状态不正确，无法标记为失败: ${audioId} (当前状态: ${item.status})`
      );
    }

    // 更新状态
    item.status = AudioItemStatus.FAILED;
    item.error = error;
    item.updatedAt = new Date();

    // 记录领域事件
    this.domainEvents.push(
      new AudioGenerationFailedEvent(this.courseId, audioId, error)
    );
  }

  /**
   * 删除所有音频
   * 用于课程重新生成场景
   */
  deleteAllAudio(): void {
    this.audioItems.clear();
  }

  /**
   * 获取音频项
   */
  getAudioItem(audioId: string): AudioItem | undefined {
    return this.audioItems.get(audioId);
  }

  /**
   * 获取所有音频项
   */
  getAllAudioItems(): AudioItem[] {
    return Array.from(this.audioItems.values());
  }

  /**
   * 获取课程ID
   */
  getCourseId(): string {
    return this.courseId;
  }

  /**
   * 拉取领域事件（用于发布）
   * 注意：拉取后会清空事件列表
   */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this.domainEvents];
    this.domainEvents = [];
    return events;
  }

  /**
   * 获取聚合状态快照（用于持久化）
   */
  getSnapshot(): {
    courseId: string;
    audioItems: AudioItem[];
  } {
    return {
      courseId: this.courseId,
      audioItems: this.getAllAudioItems(),
    };
  }

  /**
   * 从快照恢复聚合（用于从持久化恢复）
   */
  static fromSnapshot(snapshot: {
    courseId: string;
    audioItems: AudioItem[];
  }): CourseAudioAggregate {
    const aggregate = new CourseAudioAggregate(snapshot.courseId);
    snapshot.audioItems.forEach((item) => {
      aggregate.audioItems.set(item.id, item);
    });
    return aggregate;
  }
}
