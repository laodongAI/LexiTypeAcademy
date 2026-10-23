import type { ITTSProvider, TTSOptions, TTSResult } from './types';
import { NetworkError } from '../../../domain/errors/DomainError';

/**
 * Edge TTS提供者（备选方案）
 * 使用Microsoft Edge的在线TTS服务
 * 注意：需要网络连接
 */
export class EdgeTTSProvider implements ITTSProvider {
  readonly name = 'edge';

  /** Edge TTS API端点 */
  private readonly API_ENDPOINT = 'https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1';

  /** 默认语音 */
  private readonly DEFAULT_VOICE = 'en-US-AriaNeural';

  /**
   * 生成TTS音频
   */
  async generate(options: TTSOptions): Promise<TTSResult> {
    const startTime = Date.now();

    try {
      // 构建SSML
      const ssml = this.buildSSML(options);

      // 发送请求
      const response = await fetch(this.API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-24khz-48kbitrate-mono-mp3',
        },
        body: ssml,
      });

      if (!response.ok) {
        throw new NetworkError(
          this.API_ENDPOINT,
          response.status,
          { responseText: await response.text() }
        );
      }

      // 获取音频数据
      const audioBlob = await response.blob();

      // 计算时长
      const duration = await this.calculateDuration(audioBlob);

      const elapsed = Date.now() - startTime;
      console.log(`[EdgeTTS] 生成完成: ${options.text.substring(0, 20)}... (${elapsed}ms)`);

      return {
        audioBlob,
        duration,
        fromCache: false,
        provider: this.name,
      };
    } catch (error) {
      console.error('[EdgeTTS] 生成失败:', error);
      throw error;
    }
  }

  /**
   * 构建SSML
   */
  private buildSSML(options: TTSOptions): string {
    const voice = options.voice || this.DEFAULT_VOICE;
    const rate = options.rate ? `${((options.rate - 1) * 100).toFixed(0)}%` : '0%';
    const pitch = options.pitch ? `${((options.pitch - 1) * 50).toFixed(0)}Hz` : '0Hz';

    return `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${options.lang || 'en-US'}">
        <voice name="${voice}">
          <prosody rate="${rate}" pitch="${pitch}">
            ${this.escapeXml(options.text)}
          </prosody>
        </voice>
      </speak>
    `.trim();
  }

  /**
   * 转义XML特殊字符
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * 检查提供者是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 检查网络连接
      if (!navigator.onLine) {
        return false;
      }

      // 简单的连接测试（使用HEAD请求）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(this.API_ENDPOINT, {
        method: 'HEAD',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch {
      return false;
    }
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
}
