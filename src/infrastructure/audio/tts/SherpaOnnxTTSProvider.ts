import type { ITTSProvider, TTSOptions, TTSResult } from './types';
import { WasmLoadError } from '../../../domain/errors/DomainError';
import { getPathManager } from '@/app/PathManager';

/**
 * Sherpa-ONNX TTS提供者
 * 使用WASM实现的本地TTS引擎
 */
export class SherpaOnnxTTSProvider implements ITTSProvider {
  readonly name = 'sherpa-onnx';

  /** WASM模块实例 */
  private wasmModule: any = null;

  /** TTS引擎实例 */
  private ttsEngine: any = null;

  /** 是否已初始化 */
  private isInitialized = false;

  /** 初始化重试次数 */
  private readonly MAX_INIT_RETRIES = 3;

  /** 默认语音 */
  private readonly DEFAULT_VOICE = 'en-US-libritts';

  /**
   * 初始化WASM模块
   * 包含自动重试机制
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.MAX_INIT_RETRIES; attempt++) {
      try {
        console.log(`[SherpaOnnxTTS] 初始化WASM模块 (尝试 ${attempt}/${this.MAX_INIT_RETRIES})`);

        // 加载WASM模块
        this.wasmModule = await this.loadWasmModule();

        // 创建TTS引擎
        this.ttsEngine = await this.createTTSEngine();

        this.isInitialized = true;
        console.log('[SherpaOnnxTTS] 初始化成功');
        return;
      } catch (error) {
        lastError = error as Error;
        console.error(`[SherpaOnnxTTS] 初始化失败 (尝试 ${attempt}/${this.MAX_INIT_RETRIES}):`, error);

        if (attempt < this.MAX_INIT_RETRIES) {
          // 指数退避延迟
          const delay = 1000 * Math.pow(2, attempt - 1);
          console.log(`[SherpaOnnxTTS] 等待 ${delay}ms 后重试...`);
          await this.sleep(delay);
        }
      }
    }

    // 所有重试都失败
    throw new WasmLoadError('sherpa-onnx-tts', {
      attempts: this.MAX_INIT_RETRIES,
      lastError: lastError?.message,
    });
  }

  /**
   * 加载WASM模块
   */
  private async loadWasmModule(): Promise<any> {
    // 1. 检查全局对象是否已存在
    if ((window as any).createOfflineTts) {
      console.log('[SherpaOnnxTTS] 检测到已加载的 WASM 模块,直接使用');
      return (window as any).createOfflineTts;
    }

    // 2. 检查脚本是否已添加到 DOM
    const existingScript = document.querySelector('script[data-sherpa-tts]');
    if (existingScript) {
      console.log('[SherpaOnnxTTS] 检测到已加载的脚本,等待初始化...');
      // 等待脚本加载完成
      await this.sleep(500);
      if ((window as any).createOfflineTts) {
        return (window as any).createOfflineTts;
      }
    }

    // 3. 动态加载WASM脚本
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/sherpa/sherpa-onnx-wasm-simd-v1.12.18-en-tts/sherpa-onnx-tts.js';
      script.async = true;
      script.setAttribute('data-sherpa-tts', 'true'); // 标记脚本

      script.onload = () => {
        // 等待全局对象初始化 (WASM 脚本可能需要时间)
        setTimeout(() => {
          const module = (window as any).createOfflineTts;
          if (module) {
            console.log('[SherpaOnnxTTS] WASM 模块加载成功');
            resolve(module);
          } else {
            // 移除失败的脚本
            script.remove();
            reject(new Error('WASM模块加载成功但未找到 createOfflineTts 函数'));
          }
        }, 100); // 给一点时间让 WASM 初始化
      };

      script.onerror = () => {
        script.remove();
        reject(new Error('WASM脚本加载失败'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 创建TTS引擎
   */
  private async createTTSEngine(): Promise<any> {
    if (!this.wasmModule) {
      throw new Error('WASM模块未加载');
    }

    // 使用 PathManager 解析TTS模型路径
    const pathManager = getPathManager();
    const ttsModelPath = pathManager.resolveSherpaModel('models/en-US-libritts');

    // 配置TTS引擎 (使用 Sherpa-ONNX TTS WASM API)
    const config = {
      model: {
        vits: {
          model: `${ttsModelPath}/model.onnx`,
          lexicon: `${ttsModelPath}/lexicon.txt`,
          tokens: `${ttsModelPath}/tokens.txt`,
        },
        numThreads: 1,
        debug: false,
      },
      maxNumSentences: 1,
    };

    console.log('[SherpaOnnxTTS] 创建TTS引擎, 模型路径:', ttsModelPath);
    
    try {
      // 调用 WASM 模块的 createOfflineTts 函数
      const tts = await this.wasmModule(config);
      console.log('[SherpaOnnxTTS] TTS引擎创建成功');
      return tts;
    } catch (error) {
      console.error('[SherpaOnnxTTS] TTS引擎创建失败:', error);
      throw new Error(`TTS引擎创建失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * 生成TTS音频
   */
  async generate(options: TTSOptions): Promise<TTSResult> {
    if (!this.isInitialized || !this.ttsEngine) {
      throw new Error('Sherpa-ONNX TTS未初始化');
    }

    const startTime = Date.now();

    try {
      // 生成音频
      const audioData = await this.ttsEngine.generate({
        text: options.text,
        voice: options.voice || this.DEFAULT_VOICE,
        rate: options.rate || 1.0,
        pitch: options.pitch || 1.0,
      });

      // 转换为Blob
      const audioBlob = new Blob([audioData], { type: 'audio/wav' });

      // 计算时长
      const duration = await this.calculateDuration(audioBlob);

      const elapsed = Date.now() - startTime;
      console.log(`[SherpaOnnxTTS] 生成完成: ${options.text.substring(0, 20)}... (${elapsed}ms)`);

      return {
        audioBlob,
        duration,
        fromCache: false,
        provider: this.name,
      };
    } catch (error) {
      console.error('[SherpaOnnxTTS] 生成失败:', error);
      throw error;
    }
  }

  /**
   * 检查提供者是否可用
   */
  async isAvailable(): Promise<boolean> {
    try {
      // 检查WASM支持
      if (typeof WebAssembly === 'undefined') {
        return false;
      }

      // 检查模型文件是否存在
      const response = await fetch('/sherpa/sherpa-onnx-wasm-simd-v1.12.18-en-tts/sherpa-onnx-tts.js', { method: 'HEAD' });
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * 清理资源
   */
  async dispose(): Promise<void> {
    if (this.ttsEngine) {
      try {
        await this.ttsEngine.dispose();
      } catch (error) {
        console.error('[SherpaOnnxTTS] 清理资源失败:', error);
      }
      this.ttsEngine = null;
    }

    this.wasmModule = null;
    this.isInitialized = false;
    console.log('[SherpaOnnxTTS] 已清理资源');
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
   * 延迟执行
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
