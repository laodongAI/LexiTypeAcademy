/**
 * AudioContext管理器（单例）
 * 统一管理全局AudioContext实例
 */
export class AudioContextManager {
  private static instance: AudioContextManager;
  private audioContext: AudioContext | null = null;
  private isInitialized = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AudioContextManager {
    if (!AudioContextManager.instance) {
      AudioContextManager.instance = new AudioContextManager();
    }
    return AudioContextManager.instance;
  }

  /**
   * 初始化AudioContext
   * 注意：由于浏览器限制，必须在用户交互后初始化
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      // 创建AudioContext
      this.audioContext = new AudioContext();
      this.isInitialized = true;

      // 监听状态变化
      this.audioContext.onstatechange = () => {
        console.log(`[AudioContext] 状态变化: ${this.audioContext?.state}`);
      };

      console.log(`[AudioContext] 初始化成功, 采样率: ${this.audioContext.sampleRate}Hz`);
    } catch (error) {
      console.error(`[AudioContext] 初始化失败:`, error);
      throw error;
    }
  }

  /**
   * 获取AudioContext实例
   */
  getContext(): AudioContext {
    if (!this.audioContext) {
      throw new Error('AudioContext未初始化，请先调用initialize()');
    }
    return this.audioContext;
  }

  /**
   * 恢复AudioContext（用于处理浏览器自动暂停）
   */
  async resume(): Promise<void> {
    if (!this.audioContext) {
      throw new Error('AudioContext未初始化');
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
      console.log(`[AudioContext] 已恢复`);
    }
  }

  /**
   * 暂停AudioContext
   */
  async suspend(): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    if (this.audioContext.state === 'running') {
      await this.audioContext.suspend();
      console.log(`[AudioContext] 已暂停`);
    }
  }

  /**
   * 关闭AudioContext
   */
  async close(): Promise<void> {
    if (!this.audioContext) {
      return;
    }

    await this.audioContext.close();
    this.audioContext = null;
    this.isInitialized = false;
    console.log(`[AudioContext] 已关闭`);
  }

  /**
   * 检查是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized && this.audioContext !== null;
  }

  /**
   * 获取当前状态
   */
  getState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * 解码音频数据
   */
  async decodeAudioData(audioData: ArrayBuffer): Promise<AudioBuffer> {
    const context = this.getContext();
    return await context.decodeAudioData(audioData);
  }

  /**
   * 创建离线AudioContext（用于音频处理）
   */
  createOfflineContext(
    numberOfChannels: number,
    length: number,
    sampleRate: number
  ): OfflineAudioContext {
    return new OfflineAudioContext(numberOfChannels, length, sampleRate);
  }
}
