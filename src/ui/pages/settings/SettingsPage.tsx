/**
 * 设置页面 - 集成AudioSettingsService
 * Phase 9: Settings 页面迁移 + Phase 10.5.11: 设置模块集成
 * 
 * 架构说明:
 * - 左侧 Tabs 导航,切换不同设置分区
 * - 右侧内容区展示当前选中的设置组
 * - 7个设置分区: general/ai-config/ai-prompts/tts/asr/storage/prompt-sounds
 * - TTS/ASR设置已集成AudioSettingsService,支持本地Sherpa模型配置
 * - 集成真实TTS/ASR服务,测试按钮可调用Sherpa模型
 * 
 * 注: 遵循 React.createElement API,所有注释使用中文
 */

import React, { useState, useEffect } from 'react';
import { getAudioSettingsService } from '@/infrastructure/audio/settings';
import { getThemeManager } from '@/app/ThemeManager';
import type { TTSConfig, ASRConfig } from '@/infrastructure/audio/settings/types';
import { getTTSService, setUseHttpTTS } from '@/infrastructure/audio/tts';
import { getASRService, setUseHttpASR } from '@/infrastructure/audio/asr';
import { 
  SHERPA_ASR_MODELS, 
  getSherpaAsrModelByPath 
} from '@/infrastructure/audio/settings/sherpaModels';

// Phase 11: AI 配置组件
import { AIConfigPanel } from '@/ui/components/settings/AIConfigPanel';
import { AIPromptsPanel } from '@/ui/components/settings/AIPromptsPanel';

/**
 * SettingsPage 组件属性接口
 */
interface SettingsPageProps {
  /** 返回上一页回调 */
  onBack: () => void;
}

/**
 * 设置分区类型
 */
type SettingSection = 
  | 'general'           // 通用设置: 语言/主题/自动保存
  | 'ai-config'         // AI配置: 模型选择/API key
  | 'ai-prompts'        // AI提示词: 系统提示词编辑
  | 'tts'               // TTS设置: 语音引擎/音色/语速
  | 'asr'               // ASR设置: 识别引擎/语言/灵敏度
  | 'storage'           // 存储设置: 缓存管理/数据导入导出
  | 'prompt-sounds';    // 提示音设置: 提示音开关/音量

/**
 * 设置分区配置接口
 */
interface SectionConfig {
  id: SettingSection;
  label: string;
  icon: string; // SVG path
  available: boolean; // 是否可用(Phase 10-11后启用)
}

/**
 * 设置页面主组件
 */
const SettingsPage: React.FC<SettingsPageProps> = ({ onBack }) => {
  // ===== State管理 =====
  
  /** 当前选中的设置分区 */
  const [activeSection, setActiveSection] = useState<SettingSection>('general');

  /** 通用设置状态 */
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState<number>(16);
  const [fontFamily, setFontFamily] = useState<'system' | 'serif' | 'mono'>('system');
  const [autoSaveInterval, setAutoSaveInterval] = useState<number>(30);

  /** TTS配置状态 */
  const [ttsConfig, setTTSConfig] = useState<TTSConfig | null>(null);

  /** ASR配置状态 */
  const [asrConfig, setASRConfig] = useState<ASRConfig | null>(null);

  /** 存储设置: 数据目录路径 */
  const [dataPath, setDataPath] = useState<string>(
    (window as any).electron?.getDataPath?.() || ''
  );

  /** 设置服务实例 */
  const settingsService = getAudioSettingsService();

  // ===== 设置分区配置 =====
  
  const sections: SectionConfig[] = [
    {
      id: 'general',
      label: '通用设置',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      available: true
    },
    {
      id: 'ai-config',
      label: 'AI 配置',
      icon: 'M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z',
      available: true // Phase 11 已启用
    },
    {
      id: 'ai-prompts',
      label: 'AI 提示词',
      icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
      available: true // Phase 11 已启用
    },
    {
      id: 'tts',
      label: '语音合成 (TTS)',
      icon: 'M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z',
      available: true // v0.1.7启用
    },
    {
      id: 'asr',
      label: '语音识别 (ASR)',
      icon: 'M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z',
      available: true // v0.1.7启用
    },
    {
      id: 'storage',
      label: '存储管理',
      icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4',
      available: true
    },
    {
      id: 'prompt-sounds',
      label: '提示音',
      icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
      available: true
    }
  ];

  // ===== 生命周期 =====

  useEffect(() => {
    // 从 localStorage 加载通用设置
    loadSettings();
    // 从 AudioSettingsService 加载TTS/ASR配置
    loadAudioSettings();
  }, []);

  // ===== 设置持久化函数 =====

  /** 从 AudioSettingsService 加载通用设置 */
  const loadSettings = () => {
    try {
      const generalConfig = settingsService.getGeneralConfig();
      setTheme(generalConfig.theme);
      setFontSize(generalConfig.fontSize);
      setFontFamily(generalConfig.fontFamily);
      setAutoSaveInterval(generalConfig.autoSaveInterval);
      console.log('[Settings] General settings loaded:', generalConfig);
    } catch (e) {
      console.error('[Settings] Failed to load general settings:', e);
    }
  };

  /** 从 AudioSettingsService 加载TTS/ASR配置 */
  const loadAudioSettings = () => {
    try {
      const tts = settingsService.getTTSConfig();
      const asr = settingsService.getASRConfig();
      setTTSConfig(tts);
      setASRConfig(asr);
      console.log('[Settings] Audio settings loaded:', { tts, asr });
    } catch (e) {
      console.error('[Settings] Failed to load audio settings:', e);
    }
  };

  /** 保存通用设置到 AudioSettingsService */
  const saveSettings = () => {
    try {
      const newConfig = {
        theme,
        fontSize,
        fontFamily,
        autoSaveInterval
      };
      
      settingsService.updateGeneralConfig(newConfig);
      
      // 立即应用主题设置到 DOM
      const themeManager = getThemeManager();
      themeManager.applyGeneralSettings(newConfig);
      
      alert('设置已保存');
      console.log('[Settings] General settings saved and applied:', newConfig);
    } catch (e) {
      console.error('[Settings] Failed to save general settings:', e);
      alert('保存失败,请重试');
    }
  };

  /** 重置所有设置到默认值 */
  const resetSettings = () => {
    if (window.confirm('确定要重置所有设置吗?这将恢复默认值。')) {
      try {
        settingsService.resetAll();
        // 重新加载所有设置
        loadSettings();
        loadAudioSettings();
        alert('设置已重置为默认值');
        console.log('[Settings] All settings reset to defaults');
      } catch (e) {
        console.error('[Settings] Failed to reset settings:', e);
        alert('重置失败,请重试');
      }
    }
  };

  // ===== 渲染函数 =====

  /** 渲染左侧导航 Tabs */
  const renderSidebar = () => {
    return React.createElement('div', {
      className: 'w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 overflow-y-auto'
    },
      // Tabs 标题
      React.createElement('div', {
        className: 'p-4 border-b border-gray-200 dark:border-gray-700'
      },
        React.createElement('h2', {
          className: 'text-lg font-semibold text-gray-800 dark:text-white'
        }, '设置分区')
      ),

      // Tabs 列表
      React.createElement('div', {
        className: 'p-2 space-y-1'
      },
        sections.map(section => 
          React.createElement('button', {
            key: section.id,
            onClick: () => setActiveSection(section.id),
            disabled: !section.available,
            className: `
              w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all
              ${activeSection === section.id 
                ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 font-medium' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'}
              ${!section.available ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
            `
          },
            // 图标
            React.createElement('svg', {
              className: 'w-5 h-5 flex-shrink-0',
              fill: 'none',
              stroke: 'currentColor',
              viewBox: '0 0 24 24'
            },
              React.createElement('path', {
                strokeLinecap: 'round',
                strokeLinejoin: 'round',
                strokeWidth: 2,
                d: section.icon
              })
            ),

            // 标签和徽章容器
            React.createElement('div', {
              className: 'flex-1 flex items-center justify-between'
            },
              React.createElement('span', null, section.label),
              
              // "开发中"徽章
              !section.available && React.createElement('span', {
                className: 'text-xs px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full'
              }, '开发中')
            )
          )
        )
      )
    );
  };

  /** 渲染通用设置内容 */
  const renderGeneralSettings = () => {
    return React.createElement('div', {
      className: 'space-y-6'
    },
      // 主题设置
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '主题外观'),
        React.createElement('div', {
          className: 'flex gap-3'
        },
          // 亮色主题按钮
          React.createElement('button', {
            onClick: () => setTheme('light'),
            className: `
              flex-1 p-4 border-2 rounded-lg transition-all
              ${theme === 'light' 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-300'}
            `
          },
            React.createElement('div', {
              className: 'text-center'
            },
              React.createElement('div', {
                className: 'text-2xl mb-1'
              }, '☀️'),
              React.createElement('div', {
                className: 'text-sm font-medium'
              }, '亮色模式')
            )
          ),

          // 暗色主题按钮
          React.createElement('button', {
            onClick: () => setTheme('dark'),
            className: `
              flex-1 p-4 border-2 rounded-lg transition-all
              ${theme === 'dark' 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-gray-300 dark:border-gray-600 hover:border-indigo-300'}
            `
          },
            React.createElement('div', {
              className: 'text-center'
            },
              React.createElement('div', {
                className: 'text-2xl mb-1'
              }, '🌙'),
              React.createElement('div', {
                className: 'text-sm font-medium'
              }, '暗色模式')
            )
          )
        )
      ),

      // 字体大小设置
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, `字体大小: ${fontSize}px`),
        React.createElement('input', {
          type: 'range',
          min: '12',
          max: '24',
          step: '1',
          value: fontSize,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFontSize(Number(e.target.value)),
          className: 'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600'
        }),
        React.createElement('div', {
          className: 'flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'
        },
          React.createElement('span', null, '12px'),
          React.createElement('span', null, '18px'),
          React.createElement('span', null, '24px')
        ),
        React.createElement('p', {
          className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
        }, '调整应用界面的基础字体大小')
      ),

      // 字体家族设置
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '字体家族'),
        React.createElement('select', {
          value: fontFamily,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFontFamily(e.target.value as 'system' | 'serif' | 'mono'),
          className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
        },
          React.createElement('option', { value: 'system' }, '系统默认 (Sans-serif)'),
          React.createElement('option', { value: 'serif' }, '衬线字体 (Serif)'),
          React.createElement('option', { value: 'mono' }, '等宽字体 (Monospace)')
        ),
        React.createElement('p', {
          className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
        }, '选择应用界面的字体风格')
      ),

      // 自动保存间隔设置
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, `自动保存间隔: ${autoSaveInterval}秒`),
        React.createElement('input', {
          type: 'range',
          min: '10',
          max: '300',
          step: '10',
          value: autoSaveInterval,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setAutoSaveInterval(Number(e.target.value)),
          className: 'w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-600'
        }),
        React.createElement('div', {
          className: 'flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1'
        },
          React.createElement('span', null, '10秒'),
          React.createElement('span', null, '1分钟'),
          React.createElement('span', null, '5分钟')
        ),
        React.createElement('p', {
          className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
        }, '设置练习进度自动保存的时间间隔')
      ),

      // 操作按钮组
      React.createElement('div', {
        className: 'flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700'
      },
        React.createElement('button', {
          onClick: saveSettings,
          className: 'flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium'
        }, '保存设置'),
        
        React.createElement('button', {
          onClick: resetSettings,
          className: 'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
        }, '重置')
      )
    );
  };

  /** 渲染TTS设置内容 */
  const renderTTSSettings = () => {
    if (!ttsConfig) {
      return React.createElement('div', { className: 'text-center py-10 text-gray-500' }, '加载中...');
    }

    return React.createElement('div', { className: 'space-y-6' },
      // TTS提供者选择
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, 'TTS 提供者'),
        React.createElement('select', {
          value: ttsConfig.provider,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newProvider = e.target.value as TTSConfig['provider'];
            settingsService.updateTTSConfig({ provider: newProvider });
            setTTSConfig({ ...ttsConfig, provider: newProvider });
            // 根据 provider 类型切换 TTS 实现
            setUseHttpTTS(newProvider === 'http');
          },
          className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500'
        },
          React.createElement('option', { value: 'http' }, 'HTTP API (推荐)'),
          React.createElement('option', { value: 'sherpa-onnx' }, 'Sherpa-ONNX (本地)'),
          React.createElement('option', { value: 'edge' }, 'Edge TTS (在线)'),
          React.createElement('option', { value: 'system' }, '系统TTS')
        ),
        React.createElement('p', { className: 'mt-1 text-xs text-gray-500' }, 
          '选择语音合成引擎,推荐使用 HTTP API 后端服务')
      ),

      // Sherpa配置
      ttsConfig.provider === 'sherpa-onnx' && ttsConfig.sherpa && React.createElement('div', { className: 'space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, 'Sherpa-ONNX 配置'),
        
        // 说话人ID
        React.createElement('div', null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2' },
            `说话人ID: ${ttsConfig.sherpa.speakerId}`),
          React.createElement('input', {
            type: 'range',
            min: 0,
            max: 100,
            value: ttsConfig.sherpa.speakerId,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const newSpeakerId = parseInt(e.target.value);
              settingsService.updateTTSConfig({ sherpa: { speakerId: newSpeakerId, speed: ttsConfig.sherpa!.speed } });
              setTTSConfig({ ...ttsConfig, sherpa: { speakerId: newSpeakerId, speed: ttsConfig.sherpa!.speed } });
            },
            className: 'w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer'
          }),
          React.createElement('p', { className: 'mt-1 text-xs text-gray-500' }, '调整说话人音色 (0-100)')
        ),

        // 语速
        React.createElement('div', null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2' },
            `语速: ${ttsConfig.sherpa.speed.toFixed(1)}x`),
          React.createElement('input', {
            type: 'range',
            min: 0.5,
            max: 2.0,
            step: 0.1,
            value: ttsConfig.sherpa.speed,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
              const newSpeed = parseFloat(e.target.value);
              settingsService.updateTTSConfig({ sherpa: { speakerId: ttsConfig.sherpa!.speakerId, speed: newSpeed } });
              setTTSConfig({ ...ttsConfig, sherpa: { speakerId: ttsConfig.sherpa!.speakerId, speed: newSpeed } });
            },
            className: 'w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer'
          }),
          React.createElement('p', { className: 'mt-1 text-xs text-gray-500' }, '调整语音播放速度')
        )
      ),

      // Edge TTS配置
      ttsConfig.provider === 'edge' && ttsConfig.edge && React.createElement('div', { className: 'space-y-4 p-4 bg-green-50 dark:bg-green-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, 'Edge TTS 配置'),
        
        React.createElement('div', null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2' }, '语音'),
          React.createElement('select', {
            value: ttsConfig.edge.voiceName,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              settingsService.updateTTSConfig({ edge: { voiceName: e.target.value, rate: ttsConfig.edge!.rate, pitch: ttsConfig.edge!.pitch } });
              setTTSConfig({ ...ttsConfig, edge: { voiceName: e.target.value, rate: ttsConfig.edge!.rate, pitch: ttsConfig.edge!.pitch } });
            },
            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg'
          },
            React.createElement('option', { value: 'en-US-JennyNeural' }, 'Jenny (美国女声)'),
            React.createElement('option', { value: 'en-US-GuyNeural' }, 'Guy (美国男声)'),
            React.createElement('option', { value: 'zh-CN-XiaoxiaoNeural' }, '晓晓 (中国女声)')
          )
        )
      ),

      // HTTP API TTS 配置
      ttsConfig.provider === 'http' && React.createElement('div', { className: 'space-y-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, 'HTTP API TTS 配置'),
        React.createElement('p', { className: 'text-sm text-gray-600 dark:text-gray-400 mb-3' }, 
          '连接到本地 TTS 后端服务 (http://localhost:3000)'),
        React.createElement('div', { className: 'flex items-center gap-2 text-sm' },
          React.createElement('span', { className: 'inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse' }),
          React.createElement('span', { className: 'text-gray-600 dark:text-gray-400' }, '服务就绪后将自动连接')
        )
      ),

      // System TTS配置
      ttsConfig.provider === 'system' && React.createElement('div', { className: 'space-y-4 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, '系统TTS 配置'),
        React.createElement('p', { className: 'text-sm text-gray-600' }, '使用操作系统内置语音合成')
      ),

      // 测试按钮
      React.createElement('div', { className: 'pt-4 border-t' },
        React.createElement('button', {
          onClick: async () => {
            try {
              const ttsService = getTTSService();
              await ttsService.initialize();
              
              const result = await ttsService.generate({
                text: 'This is a test of text to speech functionality.',
                voice: 'en-US-libritts',
                rate: 1.0,
                pitch: 1.0,
                volume: 1.0
              });

              // 播放生成的音频
              const audioUrl = URL.createObjectURL(result.audioBlob);
              const audio = new Audio(audioUrl);
              audio.play();
              
              console.log('[TTS Test] Success:', result);
              alert(`TTS测试成功!\n时长: ${result.duration.toFixed(2)}秒\n来源: ${result.fromCache ? '缓存' : result.provider}`);
            } catch (error: any) {
              console.error('[TTS Test] Error:', error);
              alert(`TTS测试失败: ${error.message}`);
            }
          },
          className: 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
        }, '测试语音合成')
      )
    );
  };

  /** 渲染ASR设置内容 */
  const renderASRSettings = () => {
    if (!asrConfig) {
      return React.createElement('div', { className: 'text-center py-10 text-gray-500' }, '加载中...');
    }

    return React.createElement('div', { className: 'space-y-6' },
      // ASR提供者选择
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, 'ASR 提供者'),
        React.createElement('select', {
          value: asrConfig.provider,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
            const newProvider = e.target.value as ASRConfig['provider'];
            settingsService.updateASRConfig({ provider: newProvider });
            setASRConfig({ ...asrConfig, provider: newProvider });
            // 根据 provider 类型切换 ASR 实现
            setUseHttpASR(newProvider === 'api');
          },
          className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500'
        },
          React.createElement('option', { value: 'api' }, 'HTTP API (推荐)'),
          React.createElement('option', { value: 'sherpa-onnx' }, 'Sherpa-ONNX (本地)')
        ),
        React.createElement('p', { className: 'mt-1 text-xs text-gray-500' }, 
          '选择语音识别引擎,推荐使用 HTTP API 后端服务')
      ),

      // Sherpa配置
      asrConfig.provider === 'sherpa-onnx' && asrConfig.sherpa && React.createElement('div', { className: 'space-y-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, 'Sherpa-ONNX 配置'),
        
        // 模型选择下拉菜单
        React.createElement('div', null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2' }, '识别模型'),
          React.createElement('select', {
            value: asrConfig.sherpa.modelPath || SHERPA_ASR_MODELS[0].modelPath,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              const newModelPath = e.target.value;
              const selectedModel = getSherpaAsrModelByPath(newModelPath);
              
              settingsService.updateASRConfig({ 
                sherpa: { 
                  sampleRate: asrConfig.sherpa!.sampleRate,
                  maxDuration: asrConfig.sherpa!.maxDuration,
                  modelPath: newModelPath 
                } 
              });
              
              setASRConfig({ 
                ...asrConfig, 
                sherpa: { 
                  sampleRate: asrConfig.sherpa!.sampleRate,
                  maxDuration: asrConfig.sherpa!.maxDuration,
                  modelPath: newModelPath 
                } 
              });
              
              console.log('[ASR Settings] Model changed:', selectedModel);
            },
            className: 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white'
          },
            SHERPA_ASR_MODELS.map(model => 
              React.createElement('option', { 
                key: model.id, 
                value: model.modelPath 
              }, 
                model.label + (model.recommended ? ' (推荐)' : '')
              )
            )
          ),
          React.createElement('p', { className: 'mt-1 text-xs text-gray-500' }, 
            (() => {
              const currentModel = getSherpaAsrModelByPath(asrConfig.sherpa.modelPath);
              return currentModel?.description || '选择适合的ASR模型';
            })()
          )
        ),
        
        // 现有配置显示
        React.createElement('div', { className: 'text-sm text-gray-600 space-y-1 pt-3 border-t' },
          React.createElement('p', null, `采样率: ${asrConfig.sherpa.sampleRate} Hz`),
          React.createElement('p', null, `最大时长: ${asrConfig.sherpa.maxDuration}秒`),
          React.createElement('p', { className: 'text-xs text-gray-400 mt-2' }, 
            `模型路径: ${asrConfig.sherpa.modelPath || '未设置'}`
          )
        )
      ),

      // HTTP API ASR 配置
      asrConfig.provider === 'api' && React.createElement('div', { className: 'space-y-4 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg' },
        React.createElement('h4', { className: 'font-medium text-gray-800 dark:text-white mb-3' }, 'HTTP API ASR 配置'),
        React.createElement('p', { className: 'text-sm text-gray-600 dark:text-gray-400 mb-3' }, 
          '连接到本地 ASR 后端服务 (http://localhost:3000)'),
        
        React.createElement('div', null,
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2' }, '识别语言'),
          React.createElement('select', {
            value: asrConfig.language,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              settingsService.updateASRConfig({ language: e.target.value });
              setASRConfig({ ...asrConfig, language: e.target.value });
            },
            className: 'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800'
          },
            React.createElement('option', { value: 'en-US' }, 'English (US)'),
            React.createElement('option', { value: 'zh-CN' }, '中文 (简体)')
          )
        ),
        
        React.createElement('div', { className: 'flex items-center gap-2 text-sm mt-3' },
          React.createElement('span', { className: 'inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse' }),
          React.createElement('span', { className: 'text-gray-600 dark:text-gray-400' }, '服务就绪后将自动连接')
        )
      ),

      // 测试按钮
      React.createElement('div', { className: 'pt-4 border-t' },
        React.createElement('button', {
          onClick: async () => {
            try {
              const asrService = getASRService();
              
              // 请求麦克风权限
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              const mediaRecorder = new MediaRecorder(stream);
              const audioChunks: Blob[] = [];

              mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
              mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                
                try {
                  const result = await asrService.recognize({
                    audio: audioBlob,
                    language: asrConfig?.language || 'en-US',
                  });

                  console.log('[ASR Test] Success:', result);
                  alert(`ASR测试成功!\n识别文本: ${result.text}\n置信度: ${(result.confidence * 100).toFixed(1)}%`);
                } catch (error: any) {
                  console.error('[ASR Test] Recognition error:', error);
                  alert(`ASR识别失败: ${error.message}`);
                }

                // 停止所有音轨
                stream.getTracks().forEach(track => track.stop());
              };

              // 录音3秒
              alert('开始录音,请说话...');
              mediaRecorder.start();
              setTimeout(() => mediaRecorder.stop(), 3000);
            } catch (error: any) {
              console.error('[ASR Test] Error:', error);
              alert(`ASR测试失败: ${error.message}`);
            }
          },
          className: 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
        }, '测试语音识别 (录音3秒)')
      )
    );
  };

  /** 渲染占位内容(未实现的设置分区) */
  const renderPlaceholder = (sectionLabel: string) => {
    return React.createElement('div', {
      className: 'flex flex-col items-center justify-center py-20 text-center'
    },
      // 开发中图标
      React.createElement('div', {
        className: 'w-20 h-20 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-4'
      },
        React.createElement('svg', {
          className: 'w-10 h-10 text-amber-600 dark:text-amber-400',
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2,
            d: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4'
          })
        )
      ),

      // 标题
      React.createElement('h3', {
        className: 'text-xl font-semibold text-gray-800 dark:text-white mb-2'
      }, `${sectionLabel} - 开发中`),

      // 说明文本
      React.createElement('p', {
        className: 'text-gray-600 dark:text-gray-400 max-w-md mb-6'
      }, '此设置分区依赖 Phase 10-11 的服务层实现,完成后将提供完整功能。'),

      // 提示信息框
      React.createElement('div', {
        className: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 max-w-lg'
      },
        React.createElement('div', {
          className: 'flex gap-3'
        },
          React.createElement('svg', {
            className: 'w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5',
            fill: 'currentColor',
            viewBox: '0 0 20 20'
          },
            React.createElement('path', {
              fillRule: 'evenodd',
              d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
              clipRule: 'evenodd'
            })
          ),
          React.createElement('div', {
            className: 'text-sm text-blue-800 dark:text-blue-300'
          },
            React.createElement('p', {
              className: 'font-medium mb-1'
            }, '迁移进度说明'),
            React.createElement('p', null, 'Phase 10: 音频服务迁移 (TTS/ASR)'),
            React.createElement('p', null, 'Phase 11: AI 服务迁移 (模型调用/提示词管理)')
          )
        )
      )
    );
  };

  /** 渲染存储管理设置 */
  /** 渲染存储设置内容 */
  const renderStorageSettings = () => {
    const handleDataPathChange = (value: string) => {
      if (value && (window as any).electron?.setDataPath) {
        (window as any).electron.setDataPath(value);
        setDataPath(value);
      }
    };

    const handleResetDataPath = () => {
      if ((window as any).electron?.setDataPath) {
        (window as any).electron.setDataPath('');
        const newPath = (window as any).electron?.getDataPath?.() || '';
        setDataPath(newPath);
      }
    };

    return React.createElement('div', {
      className: 'space-y-6'
    },
      // 数据存储目录配置
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '数据存储目录'),
        React.createElement('div', { className: 'flex gap-2' },
          React.createElement('input', {
            type: 'text',
            value: dataPath,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDataPath(e.target.value),
            onBlur: (e: React.FocusEvent<HTMLInputElement>) => handleDataPathChange(e.target.value.trim()),
            placeholder: '默认: [安装路径]/data',
            className: 'flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent'
          }),
          React.createElement('button', {
            onClick: handleResetDataPath,
            className: 'px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
          }, '重置')
        ),
        React.createElement('p', {
          className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
        }, '设置课程音频、TTS 缓存等数据文件的存储位置。留空则使用默认路径。')
      ),

      // 缓存统计卡片
      React.createElement('div', {
        className: 'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4'
      },
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-800 dark:text-white mb-4'
        }, '缓存统计'),
        
        React.createElement('div', {
          className: 'space-y-3 text-sm'
        },
          React.createElement('div', {
            className: 'flex justify-between'
          },
            React.createElement('span', {
              className: 'text-gray-600 dark:text-gray-400'
            }, 'TTS 音频缓存:'),
            React.createElement('span', {
              className: 'font-medium text-gray-900 dark:text-white'
            }, '计算中...')
          ),
          React.createElement('div', {
            className: 'flex justify-between'
          },
            React.createElement('span', {
              className: 'text-gray-600 dark:text-gray-400'
            }, '历史记录:'),
            React.createElement('span', {
              className: 'font-medium text-gray-900 dark:text-white'
            }, '计算中...')
          ),
          React.createElement('div', {
            className: 'flex justify-between'
          },
            React.createElement('span', {
              className: 'text-gray-600 dark:text-gray-400'
            }, '数据库大小:'),
            React.createElement('span', {
              className: 'font-medium text-gray-900 dark:text-white'
            }, 'IndexedDB (浏览器管理)')
          )
        )
      ),

      // 缓存管理操作
      React.createElement('div', null,
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-800 dark:text-white mb-3'
        }, '缓存管理'),
        
        React.createElement('div', {
          className: 'space-y-3'
        },
          React.createElement('button', {
            onClick: () => alert('清除 TTS 缓存功能将在 Phase 10 实现'),
            className: 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left'
          }, '清除 TTS 音频缓存'),
          
          React.createElement('button', {
            onClick: () => alert('清除历史记录功能开发中'),
            className: 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left'
          }, '清除学习历史记录'),
          
          React.createElement('button', {
            onClick: () => {
              if (window.confirm('警告: 这将清除所有应用数据,包括课程、进度、设置等。确定继续吗?')) {
                alert('重置所有数据功能开发中');
              }
            },
            className: 'w-full px-4 py-2 border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left font-medium'
          }, '⚠️ 重置所有数据')
        )
      ),

      // 数据导入导出
      React.createElement('div', null,
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-800 dark:text-white mb-3'
        }, '数据导入/导出'),
        
        React.createElement('div', {
          className: 'flex gap-3'
        },
          React.createElement('button', {
            onClick: () => alert('导出数据功能开发中'),
            className: 'flex-1 px-4 py-2 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors'
          }, '导出数据'),
          
          React.createElement('button', {
            onClick: () => alert('导入数据功能开发中'),
            className: 'flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors'
          }, '导入数据')
        )
      )
    );
  };

  /** 渲染提示音设置 */
  const renderPromptSoundsSettings = () => {
    return React.createElement('div', {
      className: 'space-y-6'
    },
      // 提示音开关
      React.createElement('div', null,
        React.createElement('div', {
          className: 'flex items-center justify-between mb-2'
        },
          React.createElement('div', null,
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 dark:text-gray-300'
            }, '启用提示音'),
            React.createElement('p', {
              className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
            }, '打字正确/错误时播放音效反馈')
          ),
          
          React.createElement('button', {
            onClick: () => alert('提示音设置功能开发中'),
            className: 'relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 dark:bg-gray-600'
          },
            React.createElement('span', {
              className: 'inline-block h-4 w-4 transform rounded-full bg-white translate-x-1'
            })
          )
        )
      ),

      // 音量控制
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '提示音音量'),
        React.createElement('input', {
          type: 'range',
          min: 0,
          max: 100,
          defaultValue: 50,
          disabled: true,
          className: 'w-full opacity-50 cursor-not-allowed'
        }),
        React.createElement('p', {
          className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
        }, '功能开发中')
      ),

      // 测试按钮
      React.createElement('div', null,
        React.createElement('button', {
          onClick: () => alert('提示音测试功能开发中'),
          className: 'px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
        }, '🔊 测试提示音')
      )
    );
  };

  /** 渲染右侧内容区 */
  const renderContent = () => {
    // 查找当前分区配置
    const currentSection = sections.find(s => s.id === activeSection);
    
    return React.createElement('div', {
      className: 'flex-1 overflow-y-auto'
    },
      React.createElement('div', {
        className: 'max-w-3xl mx-auto p-6'
      },
        // 内容区标题
        React.createElement('div', {
          className: 'mb-6'
        },
          React.createElement('h1', {
            className: 'text-2xl font-bold text-gray-800 dark:text-white mb-2'
          }, currentSection?.label || '设置'),
          
          React.createElement('div', {
            className: 'h-1 w-20 bg-indigo-600 rounded-full'
          })
        ),

        // 根据当前分区渲染对应内容
        React.createElement('div', null,
          (() => {
            switch (activeSection) {
              case 'general':
                return renderGeneralSettings();
              case 'tts':
                return renderTTSSettings();
              case 'asr':
                return renderASRSettings();
              case 'storage':
                return renderStorageSettings();
              case 'prompt-sounds':
                return renderPromptSoundsSettings();
              case 'ai-config':
                return React.createElement(AIConfigPanel, null);
              case 'ai-prompts':
                return React.createElement(AIPromptsPanel, null);
              default:
                return null;
            }
          })()
        )
      )
    );
  };

  // ===== 主渲染 =====

  return React.createElement('div', {
    className: 'flex flex-col h-screen bg-gray-50 dark:bg-gray-900'
  },
    // 顶部导航栏
    React.createElement('div', {
      className: 'bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4'
    },
      React.createElement('div', {
        className: 'flex items-center gap-4'
      },
        // 返回按钮
        React.createElement('button', {
          onClick: onBack,
          className: 'flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors'
        },
          React.createElement('svg', {
            className: 'w-5 h-5',
            fill: 'none',
            stroke: 'currentColor',
            viewBox: '0 0 24 24'
          },
            React.createElement('path', {
              strokeLinecap: 'round',
              strokeLinejoin: 'round',
              strokeWidth: 2,
              d: 'M10 19l-7-7m0 0l7-7m-7 7h18'
            })
          ),
          React.createElement('span', null, '返回')
        ),

        // 页面标题
        React.createElement('h1', {
          className: 'text-xl font-bold text-gray-800 dark:text-white'
        }, '应用设置')
      )
    ),

    // 主体内容: 左侧边栏 + 右侧内容
    React.createElement('div', {
      className: 'flex flex-1 overflow-hidden'
    },
      renderSidebar(),
      renderContent()
    )
  );
};

export default SettingsPage;
