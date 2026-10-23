/**
 * ASR (Automatic Speech Recognition) 服务模块导出
 */

export * from './types';
export * from './SherpaOnnxASRProvider';
export * from './ApiASRProvider';
export * from './HttpASRProvider';
export * from './StudentRecordingRepository';
export * from './ASRService';

import { ASRService } from './ASRService';
import { SherpaOnnxASRProvider } from './SherpaOnnxASRProvider';
import { HttpASRProvider } from './HttpASRProvider';
import { getAudioApiClient } from '../api';

/**
 * ASR服务单例
 */
let asrServiceInstance: ASRService | null = null;

/**
 * 是否使用HTTP API ASR
 * 设置为 true 时优先使用 HTTP API，否则使用本地 Sherpa-ONNX
 */
let useHttpASR = true;

/**
 * 设置是否使用HTTP API ASR
 */
export function setUseHttpASR(value: boolean): void {
  useHttpASR = value;
  // 重置服务实例以应用新配置
  asrServiceInstance = null;
}

/**
 * 获取ASR服务单例
 * 
 * 优先级:
 * 1. HTTP API ASR (如果启用且可用)
 * 2. SherpaOnnx 本地 ASR
 */
export function getASRService(): ASRService {
  if (!asrServiceInstance) {
    // 根据配置选择主提供者
    let primaryProvider;
    let fallbackProvider;

    if (useHttpASR) {
      // HTTP API 作为主提供者，Sherpa 作为备用
      primaryProvider = new HttpASRProvider({
        client: getAudioApiClient(),
        autoEnhance: false,
        longAudioThreshold: 60,
        defaultLanguage: 'zh-CN',
      });
      fallbackProvider = new SherpaOnnxASRProvider();
    } else {
      // Sherpa 作为主提供者，无备用
      primaryProvider = new SherpaOnnxASRProvider();
      fallbackProvider = undefined;
    }

    asrServiceInstance = new ASRService({
      primaryProvider,
      fallbackProvider,
      maxConcurrent: 3,
      maxRetries: 3,
      enableFallback: useHttpASR, // HTTP模式下启用降级到Sherpa
      autoPublishEvents: true,
    });
  }

  return asrServiceInstance;
}
