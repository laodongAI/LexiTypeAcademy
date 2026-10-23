/**
 * 音频设置服务
 * 
 * 职责:
 * - 管理TTS/ASR配置的读取和更新
 * - 提供配置导入导出功能
 * 
 * DDD分层: Infrastructure Layer - 应用服务
 * 设计模式: Facade Pattern
 * 
 * 版本: v0.1.0
 */

import type {
  IAudioSettingsService,
  TTSConfig,
  ASRConfig,
  GeneralConfig,
  PromptSoundConfig,
  ISettingsStorage
} from './types';
import { LocalStorageSettingsStorage } from './LocalStorageSettingsStorage';

export class AudioSettingsService implements IAudioSettingsService {
  private storage: ISettingsStorage;
  
  constructor(storage?: ISettingsStorage) {
    this.storage = storage || new LocalStorageSettingsStorage();
  }
  
  /**
   * 获取当前TTS配置
   */
  getTTSConfig(): TTSConfig {
    const settings = this.storage.load();
    return settings.tts;
  }
  
  /**
   * 更新TTS配置
   */
  updateTTSConfig(config: Partial<TTSConfig>): void {
    try {
      this.storage.update({
        tts: config as TTSConfig
      });
      
      console.log('[AudioSettings] TTS配置已更新', config);
    } catch (error) {
      console.error('[AudioSettings] TTS配置更新失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取当前ASR配置
   */
  getASRConfig(): ASRConfig {
    const settings = this.storage.load();
    return settings.asr;
  }
  
  /**
   * 更新ASR配置
   */
  updateASRConfig(config: Partial<ASRConfig>): void {
    try {
      this.storage.update({
        asr: config as ASRConfig
      });
      
      console.log('[AudioSettings] ASR配置已更新', config);
    } catch (error) {
      console.error('[AudioSettings] ASR配置更新失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取通用配置
   */
  getGeneralConfig(): GeneralConfig {
    const settings = this.storage.load();
    return settings.general;
  }
  
  /**
   * 更新通用配置
   */
  updateGeneralConfig(config: Partial<GeneralConfig>): void {
    try {
      this.storage.update({
        general: config as GeneralConfig
      });
      
      console.log('[AudioSettings] 通用配置已更新', config);
    } catch (error) {
      console.error('[AudioSettings] 通用配置更新失败:', error);
      throw error;
    }
  }
  
  /**
   * 获取提示音配置
   */
  getPromptSoundConfig(): PromptSoundConfig {
    const settings = this.storage.load();
    return settings.promptSound;
  }
  
  /**
   * 更新提示音配置
   */
  updatePromptSoundConfig(config: Partial<PromptSoundConfig>): void {
    try {
      this.storage.update({
        promptSound: config as PromptSoundConfig
      });
      
      console.log('[AudioSettings] 提示音配置已更新', config);
    } catch (error) {
      console.error('[AudioSettings] 提示音配置更新失败:', error);
      throw error;
    }
  }
  
  /**
   * 重置所有配置
   */
  resetAll(): void {
    try {
      this.storage.reset();
      console.log('[AudioSettings] 所有配置已重置');
    } catch (error) {
      console.error('[AudioSettings] 重置配置失败:', error);
      throw error;
    }
  }
  
  /**
   * 导出配置为JSON
   */
  exportConfig(): string {
    try {
      const settings = this.storage.load();
      return JSON.stringify(settings, null, 2);
    } catch (error) {
      console.error('[AudioSettings] 导出配置失败:', error);
      throw new Error('导出配置失败');
    }
  }
  
  /**
   * 从JSON导入配置
   * 
   * @param json JSON字符串
   * @returns 是否成功
   */
  importConfig(json: string): boolean {
    try {
      const settings = JSON.parse(json);
      
      // 基本验证
      if (!settings || typeof settings !== 'object') {
        throw new Error('无效的配置格式');
      }
      
      if (!settings.general || !settings.tts || !settings.asr) {
        throw new Error('配置数据不完整');
      }
      
      // 保存配置
      this.storage.save(settings);
      
      console.log('[AudioSettings] 配置导入成功');
      return true;
    } catch (error) {
      console.error('[AudioSettings] 配置导入失败:', error);
      return false;
    }
  }
}

/**
 * 全局单例实例
 */
let settingsServiceInstance: AudioSettingsService | null = null;

/**
 * 获取AudioSettingsService单例
 */
export function getAudioSettingsService(): AudioSettingsService {
  if (!settingsServiceInstance) {
    settingsServiceInstance = new AudioSettingsService();
  }
  return settingsServiceInstance;
}
