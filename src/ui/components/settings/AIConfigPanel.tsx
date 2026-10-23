/**
 * AI 配置面板组件
 * 
 * 功能:
 * - AI 提供商选择和配置
 * - API 密钥管理
 * - 连接测试
 * - 模型选择
 * 
 * 集成服务: AIConfigService
 */

import React, { useState, useEffect } from 'react';
import { 
  getAIConfigService, 
  PROVIDER_PRESETS,
  type AIProvider,
  type AIConfig 
} from '@/infrastructure/services/AIConfigService';

/**
 * AI 配置面板组件属性
 */
interface AIConfigPanelProps {
  onSave?: () => void;
}

/**
 * AI 配置面板
 */
export const AIConfigPanel: React.FC<AIConfigPanelProps> = ({ onSave }) => {
  // ========== 状态管理 ==========
  const [provider, setProvider] = useState<AIProvider>('volcengine');
  const [apiKey, setApiKey] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [timeout, setTimeout] = useState(30000);
  const [maxRetries, setMaxRetries] = useState(3);
  
  // 连接测试状态
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    latency?: number;
  } | null>(null);
  
  // 保存状态
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  
  // 服务实例
  const configService = getAIConfigService();

  // ========== 生命周期 ==========
  useEffect(() => {
    loadConfig();
  }, []);

  // 当提供商变化时，更新预设值
  useEffect(() => {
    const preset = PROVIDER_PRESETS[provider];
    if (preset) {
      setEndpoint(preset.endpoint);
      setModel(preset.supportedModels[0] || preset.model);
    }
  }, [provider]);

  // ========== 配置加载与保存 ==========
  const loadConfig = async () => {
    try {
      const config = await configService.loadConfig();
      if (config) {
        setProvider(config.provider);
        setApiKey(config.apiKey || '');
        setEndpoint(config.endpoint);
        setModel(config.model);
        setTimeout(config.timeout || 30000);
        setMaxRetries(config.maxRetries || 3);
        setLastSaved(config.updatedAt);
      }
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const config: AIConfig = {
        provider,
        apiKey,
        endpoint,
        model,
        timeout,
        maxRetries,
        retryBackoff: 'exponential',
        version: 0,  // 服务会自动增加版本号
        createdAt: lastSaved || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      await configService.saveConfig(config);
      setLastSaved(new Date().toISOString());
      alert('配置已保存');
      onSave?.();
    } catch (error: any) {
      console.error('保存 AI 配置失败:', error);
      alert('保存失败: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  // ========== 连接测试 ==========
  const testConnection = async () => {
    if (!apiKey) {
      alert('请先输入 API 密钥');
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await configService.testConnection({
        provider,
        apiKey,
        endpoint,
        model,
        timeout,
        maxRetries,
        retryBackoff: 'exponential',
        version: 0,
        createdAt: '',
        updatedAt: ''
      });

      setTestResult({
        success: result.success,
        message: result.success 
          ? `连接成功! 延迟: ${result.latency}ms`
          : result.errorMessage || '连接失败',
        latency: result.latency
      });
    } catch (error: any) {
      setTestResult({
        success: false,
        message: error.message || '测试失败'
      });
    } finally {
      setTesting(false);
    }
  };

  // ========== 渲染 ==========
  const providers: { id: AIProvider; name: string; icon: string }[] = [
    { id: 'volcengine', name: '豆包 (VolcEngine)', icon: '🌋' },
    { id: 'openai', name: 'OpenAI', icon: '🤖' },
    { id: 'deepseek', name: 'DeepSeek', icon: '🔍' },
    { id: 'qwen', name: '通义千问 (Qwen)', icon: '🌙' },
    { id: 'ollama', name: 'Ollama (本地)', icon: '🦙' },
    { id: 'custom', name: '自定义', icon: '⚙️' }
  ];

  return React.createElement('div', { className: 'space-y-6' },
    // 提供商选择
    React.createElement('div', null,
      React.createElement('label', {
        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'
      }, 'AI 服务提供商'),
      React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-3 gap-3' },
        providers.map(p => 
          React.createElement('button', {
            key: p.id,
            type: 'button',
            onClick: () => setProvider(p.id),
            className: `
              flex items-center gap-3 p-4 rounded-lg border-2 transition-all
              ${provider === p.id 
                ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' 
                : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}
            `
          },
            React.createElement('span', { className: 'text-2xl' }, p.icon),
            React.createElement('span', { 
              className: 'font-medium text-gray-900 dark:text-white text-sm'
            }, p.name)
          )
        )
      )
    ),

    // API 密钥
    React.createElement('div', null,
      React.createElement('label', {
        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
      }, 'API 密钥'),
      React.createElement('div', { className: 'relative' },
        React.createElement('input', {
          type: 'password',
          value: apiKey,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setApiKey(e.target.value),
          placeholder: '输入您的 API 密钥...',
          className: 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 pr-10'
        }),
        React.createElement('span', {
          className: 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400'
        }, '🔐')
      ),
      React.createElement('p', {
        className: 'mt-1 text-xs text-gray-500 dark:text-gray-400'
      }, '密钥将使用 AES-256-GCM 加密存储')
    ),

    // 端点和模型（并排）
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      // 端点
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, 'API 端点'),
        React.createElement('input', {
          type: 'text',
          value: endpoint,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEndpoint(e.target.value),
          placeholder: 'https://api.example.com/v1/chat/completions',
          className: 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 text-sm'
        })
      ),
      
      // 模型选择
      React.createElement('div', null,
        React.createElement('label', {
          className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '模型'),
        React.createElement('select', {
          value: model,
          onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setModel(e.target.value),
          className: 'w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500'
        },
          PROVIDER_PRESETS[provider]?.supportedModels.map(m =>
            React.createElement('option', { key: m, value: m }, m)
          ) || React.createElement('option', { value: model }, model)
        )
      )
    ),

    // 高级设置（折叠面板）
    React.createElement('details', { className: 'bg-gray-50 dark:bg-gray-800/50 rounded-lg' },
      React.createElement('summary', {
        className: 'px-4 py-3 cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg'
      }, '⚙️ 高级设置'),
      React.createElement('div', { className: 'px-4 pb-4 space-y-4' },
        // 超时设置
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          }, `请求超时: ${timeout / 1000}秒`),
          React.createElement('input', {
            type: 'range',
            min: '5000',
            max: '120000',
            step: '5000',
            value: timeout,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTimeout(Number(e.target.value)),
            className: 'w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer'
          })
        ),
        
        // 重试次数
        React.createElement('div', null,
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          }, `最大重试次数: ${maxRetries}`),
          React.createElement('input', {
            type: 'range',
            min: '0',
            max: '5',
            step: '1',
            value: maxRetries,
            onChange: (e: React.ChangeEvent<HTMLInputElement>) => setMaxRetries(Number(e.target.value)),
            className: 'w-full h-2 bg-gray-300 rounded-lg appearance-none cursor-pointer'
          })
        )
      )
    ),

    // 连接测试结果
    testResult && React.createElement('div', {
      className: `p-4 rounded-lg border ${
        testResult.success 
          ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
          : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
      }`
    },
      React.createElement('div', { className: 'flex items-center gap-2' },
        React.createElement('span', { className: 'text-xl' }, 
          testResult.success ? '✅' : '❌'
        ),
        React.createElement('span', {
          className: testResult.success 
            ? 'text-green-800 dark:text-green-300'
            : 'text-red-800 dark:text-red-300'
        }, testResult.message)
      )
    ),

    // 操作按钮
    React.createElement('div', { className: 'flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700' },
      React.createElement('button', {
        onClick: testConnection,
        disabled: testing || !apiKey,
        className: `
          flex-1 px-4 py-2 border border-indigo-500 text-indigo-600 dark:text-indigo-400 
          rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors
          disabled:opacity-50 disabled:cursor-not-allowed
        `
      }, testing ? '测试中...' : '🔌 测试连接'),
      
      React.createElement('button', {
        onClick: saveConfig,
        disabled: saving,
        className: `
          flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg 
          hover:bg-indigo-700 transition-colors font-medium
          disabled:opacity-50 disabled:cursor-not-allowed
        `
      }, saving ? '保存中...' : '💾 保存配置')
    ),

    // 最后保存时间
    lastSaved && React.createElement('p', {
      className: 'text-xs text-gray-500 dark:text-gray-400 text-center'
    }, `上次保存: ${new Date(lastSaved).toLocaleString()}`)
  );
};

export default AIConfigPanel;
