/**
 * LocalStorage设置存储实现
 * 
 * 职责:
 * - 使用LocalStorage持久化应用设置
 * - 提供加载/保存/更新/重置功能
 * - 处理存储异常和数据迁移
 * 
 * DDD分层: Infrastructure Layer - 持久化实现
 * 设计模式: Repository Pattern
 * 
 * 版本: v0.1.0
 */

import type { ISettingsStorage, AppSettings } from './types';
import { DEFAULT_SETTINGS, STORAGE_KEYS } from './defaults';

export class LocalStorageSettingsStorage implements ISettingsStorage {
  /**
   * 加载完整配置
   * 
   * @returns 应用设置（失败时返回默认值）
   */
  load(): AppSettings {
    try {
      const json = localStorage.getItem(STORAGE_KEYS.FULL_CONFIG);
      if (!json) {
        console.log('[SettingsStorage] 未找到已保存的配置,使用默认值');
        return this.getDefaults();
      }
      
      const loaded = JSON.parse(json) as AppSettings;
      
      // 合并默认值（防止新增字段缺失）
      const merged = this.mergeWithDefaults(loaded);
      
      console.log('[SettingsStorage] 配置加载成功');
      return merged;
    } catch (error) {
      console.error('[SettingsStorage] 配置加载失败:', error);
      return this.getDefaults();
    }
  }
  
  /**
   * 保存完整配置
   * 
   * @param settings 应用设置
   */
  save(settings: AppSettings): void {
    try {
      // 更新时间戳
      settings.lastUpdated = Date.now();
      
      const json = JSON.stringify(settings, null, 2);
      localStorage.setItem(STORAGE_KEYS.FULL_CONFIG, json);
      
      console.log('[SettingsStorage] 配置保存成功');
    } catch (error) {
      console.error('[SettingsStorage] 配置保存失败:', error);
      throw new Error('保存配置失败,请检查存储空间');
    }
  }
  
  /**
   * 更新部分配置
   * 
   * @param partial 部分配置
   */
  update(partial: Partial<AppSettings>): void {
    try {
      const current = this.load();
      const updated = this.deepMerge(current, partial);
      this.save(updated);
      
      console.log('[SettingsStorage] 配置更新成功');
    } catch (error) {
      console.error('[SettingsStorage] 配置更新失败:', error);
      throw error;
    }
  }
  
  /**
   * 重置为默认配置
   */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEYS.FULL_CONFIG);
      console.log('[SettingsStorage] 配置已重置为默认值');
    } catch (error) {
      console.error('[SettingsStorage] 重置配置失败:', error);
      throw new Error('重置配置失败');
    }
  }
  
  /**
   * 获取默认配置
   */
  getDefaults(): AppSettings {
    // 深拷贝默认值,避免意外修改
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
  
  /**
   * 合并配置与默认值
   * 
   * @param loaded 加载的配置
   * @returns 合并后的配置
   */
  private mergeWithDefaults(loaded: AppSettings): AppSettings {
    const defaults = this.getDefaults();
    return this.deepMerge(defaults, loaded);
  }
  
  /**
   * 深度合并两个对象
   * 
   * @param target 目标对象
   * @param source 源对象
   * @returns 合并后的对象
   */
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        
        if (
          sourceValue &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          // 递归合并对象
          result[key] = this.deepMerge(targetValue, sourceValue) as any;
        } else if (sourceValue !== undefined) {
          // 直接赋值
          result[key] = sourceValue as any;
        }
      }
    }
    
    return result;
  }
}
