export * from './types';
export * from './SherpaOnnxTTSProvider';
export * from './SystemTTSProvider';
export * from './EdgeTTSProvider';
export * from './HttpTTSProvider';
export * from './TTSCacheRepository';
export * from './TTSService';

import { TTSService } from './TTSService';
import { SherpaOnnxTTSProvider } from './SherpaOnnxTTSProvider';
import { SystemTTSProvider } from './SystemTTSProvider';
import { HttpTTSProvider } from './HttpTTSProvider';
import { TTSCacheRepository } from './TTSCacheRepository';
import { DomainEventBus } from '@/domain/events/DomainEventBus';
import { ErrorHandlingService } from '../storage/ErrorHandlingService';
import { DualLayerCache } from '../storage/DualLayerCache';
import { AudioFileManager } from '../storage/AudioFileManager';
import { getAudioApiClient } from '../api';

/**
 * TTS服务单例
 */
let ttsServiceInstance: TTSService | null = null;

/**
 * 是否使用HTTP API TTS
 * 设置为 true 时优先使用 HTTP API，否则使用本地 Sherpa-ONNX
 */
let useHttpTTS = true;

/**
 * 设置是否使用HTTP API TTS
 */
export function setUseHttpTTS(value: boolean): void {
  useHttpTTS = value;
  // 重置服务实例以应用新配置
  ttsServiceInstance = null;
}

/**
 * 获取TTS服务单例
 * 
 * 优先级:
 * 1. HTTP API TTS (如果启用且可用)
 * 2. SherpaOnnx 本地 TTS
 * 3. SystemTTS 作为备用
 */
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    // 根据配置选择主提供者
    let primaryProvider;
    let fallbackProvider;

    if (useHttpTTS) {
      // HTTP API 作为主提供者，Sherpa 作为备用
      primaryProvider = new HttpTTSProvider({
        client: getAudioApiClient(),
        defaultSpeed: 1.0,
        longTextThreshold: 500,
      });
      fallbackProvider = new SherpaOnnxTTSProvider();
    } else {
      // Sherpa 作为主提供者，System 作为备用
      primaryProvider = new SherpaOnnxTTSProvider();
      fallbackProvider = new SystemTTSProvider();
    }
    
    // 创建缓存和文件管理器实例
    const cache = new DualLayerCache();
    const fileManager = new AudioFileManager();
    const cacheRepository = new TTSCacheRepository(cache, fileManager);
    
    const eventBus = DomainEventBus.getInstance();
    const errorHandler = new ErrorHandlingService();

    ttsServiceInstance = new TTSService(
      primaryProvider,
      fallbackProvider,
      cacheRepository,
      eventBus,
      errorHandler
    );
  }

  return ttsServiceInstance;
}
