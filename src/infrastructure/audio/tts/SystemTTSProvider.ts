import type { ITTSProvider, TTSOptions, TTSResult } from './types';

/**
 * 系统TTS提供者
 * 使用浏览器内置的Web Speech API
 */
export class SystemTTSProvider implements ITTSProvider {
  readonly name = 'system';

  /** 是否支持Web Speech API */
  private isSupported = false;

  /** 可用的语音列表 */
  private voices: SpeechSynthesisVoice[] = [];

  /**
   * 初始化
   */
  async initialize(): Promise<void> {
    this.isSupported = 'speechSynthesis' in window;

    if (!this.isSupported) {
      console.warn('[SystemTTS] 浏览器不支持Web Speech API');
      return;
    }

    // 加载语音列表
    await this.loadVoices();
    console.log(`[SystemTTS] 初始化成功，可用语音: ${this.voices.length}个`);
  }

  /**
   * 加载语音列表
   */
  private async loadVoices(): Promise<void> {
    return new Promise((resolve) => {
      // 获取语音列表
      const getVoices = () => {
        this.voices = window.speechSynthesis.getVoices();
        if (this.voices.length > 0) {
          resolve();
        }
      };

      // 立即尝试获取
      getVoices();

      // 监听语音列表变化（某些浏览器需要）
      if (this.voices.length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          getVoices();
        };

        // 超时保护
        setTimeout(() => resolve(), 1000);
      }
    });
  }

  /**
   * 生成TTS音频
   */
  async generate(options: TTSOptions): Promise<TTSResult> {
    if (!this.isSupported) {
      throw new Error('浏览器不支持Web Speech API');
    }

    const startTime = Date.now();

    // 创建语音合成对象
    const utterance = new SpeechSynthesisUtterance(options.text);

    // 配置参数
    utterance.rate = options.rate || 1.0;
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    utterance.lang = options.lang || 'en-US';

    // 选择语音
    if (options.voice) {
      const voice = this.voices.find((v) => v.name === options.voice);
      if (voice) {
        utterance.voice = voice;
      }
    }

    // 录制音频
    const audioBlob = await this.recordSpeech(utterance);

    // 计算时长
    const duration = await this.calculateDuration(audioBlob);

    const elapsed = Date.now() - startTime;
    console.log(`[SystemTTS] 生成完成: ${options.text.substring(0, 20)}... (${elapsed}ms)`);

    return {
      audioBlob,
      duration,
      fromCache: false,
      provider: this.name,
    };
  }

  /**
   * 录制语音
   * 注意：Web Speech API不直接提供音频数据，需要通过AudioContext录制
   */
  private async recordSpeech(utterance: SpeechSynthesisUtterance): Promise<Blob> {
    return new Promise((resolve, reject) => {
      // 创建AudioContext
      const audioContext = new AudioContext();
      const destination = audioContext.createMediaStreamDestination();

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(destination.stream);
      const audioChunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunks.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioContext.close();
        resolve(audioBlob);
      };

      utterance.onstart = () => {
        mediaRecorder.start();
      };

      utterance.onend = () => {
        setTimeout(() => {
          mediaRecorder.stop();
        }, 100); // 延迟100ms确保音频完整
      };

      utterance.onerror = (event) => {
        mediaRecorder.stop();
        audioContext.close();
        reject(new Error(`TTS生成失败: ${event.error}`));
      };

      // 开始合成
      window.speechSynthesis.speak(utterance);
    });
  }

  /**
   * 检查提供者是否可用
   */
  async isAvailable(): Promise<boolean> {
    return 'speechSynthesis' in window;
  }

  /**
   * 计算音频时长
   */
  private async calculateDuration(audioBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      audio.src = URL.createObjectURL(audioBlob);

      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(audio.src);
        resolve(audio.duration);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audio.src);
        reject(new Error('无法加载音频元数据'));
      };
    });
  }

  /**
   * 获取可用语音列表
   */
  getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }
}
