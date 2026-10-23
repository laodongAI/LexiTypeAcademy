/**
 * 主题管理器
 * 负责将 GeneralConfig 中的配置应用到 DOM,包括主题、字体大小、字体家族
 */

import { GeneralConfig } from '../infrastructure/audio/settings/types';
import { FONT_FAMILIES } from '../infrastructure/audio/settings/defaults';

/**
 * 主题管理器类
 * 单例模式,通过 getThemeManager() 获取实例
 */
class ThemeManager {
  private static instance: ThemeManager;

  private constructor() {
    console.log('[ThemeManager] Instance created');
  }

  /**
   * 获取 ThemeManager 单例实例
   */
  static getInstance(): ThemeManager {
    if (!ThemeManager.instance) {
      ThemeManager.instance = new ThemeManager();
    }
    return ThemeManager.instance;
  }

  /**
   * 应用完整的通用配置
   * @param config 通用配置对象
   */
  applyGeneralSettings(config: GeneralConfig): void {
    this.applyTheme(config.theme);
    this.applyFontSize(config.fontSize);
    this.applyFontFamily(config.fontFamily);
    console.log('[ThemeManager] Applied general settings:', config);
  }

  /**
   * 应用主题
   * @param theme 主题类型 ('light' | 'dark')
   */
  applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    console.log('[ThemeManager] Applied theme:', theme);
  }

  /**
   * 应用字体大小
   * @param fontSize 字体大小 (12-24)
   */
  applyFontSize(fontSize: number): void {
    const root = document.documentElement;
    root.style.setProperty('--base-font-size', `${fontSize}px`);
    console.log('[ThemeManager] Applied font size:', fontSize);
  }

  /**
   * 应用字体家族
   * @param fontFamily 字体家族类型 ('system' | 'serif' | 'mono')
   */
  applyFontFamily(fontFamily: 'system' | 'serif' | 'mono'): void {
    const root = document.documentElement;
    const fontStack = FONT_FAMILIES[fontFamily].value;
    root.style.setProperty('--base-font-family', fontStack);
    console.log('[ThemeManager] Applied font family:', fontFamily, '→', fontStack);
  }

  /**
   * 获取当前应用的主题
   */
  getCurrentTheme(): 'light' | 'dark' {
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  }

  /**
   * 获取当前应用的字体大小
   */
  getCurrentFontSize(): number {
    const root = document.documentElement;
    const fontSize = root.style.getPropertyValue('--base-font-size');
    return fontSize ? parseInt(fontSize, 10) : 16;
  }

  /**
   * 获取当前应用的字体家族
   */
  getCurrentFontFamily(): string {
    const root = document.documentElement;
    return root.style.getPropertyValue('--base-font-family') || FONT_FAMILIES.system.value;
  }
}

/**
 * 获取 ThemeManager 单例实例
 */
export function getThemeManager(): ThemeManager {
  return ThemeManager.getInstance();
}

export default ThemeManager;
