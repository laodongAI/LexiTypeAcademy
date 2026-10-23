/**
 * AI 配置管理
 * 负责 AI 配置的存储、加载和验证
 */

import type { AIConfig, AIProvider } from './aiTypes';

const STORAGE_KEY = 'lexitype_ai_config';

/** 默认配置 */
const DEFAULT_CONFIG: AIConfig = {
  provider: 'qwen',
  apiKey: '',
  // 使用 OpenAI 兼容端点，便于统一解析
  endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  model: 'qwen-plus',
  customPrompts: {}
};

/**
 * 加载 AI 配置
 */
export function loadAIConfig(): AIConfig {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const conf: AIConfig = { ...DEFAULT_CONFIG, ...parsed };
      // 迁移：将旧的 DashScope 文本生成端点自动切到 OpenAI 兼容端点
      if (
        conf.provider === 'qwen' &&
        typeof conf.endpoint === 'string' &&
        conf.endpoint.includes('/api/v1/services/aigc/text-generation/generation')
      ) {
        conf.endpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
      }
      return conf;
    } catch (error) {
      console.error('Failed to parse AI config:', error);
    }
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存 AI 配置
 */
export function saveAIConfig(config: AIConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (error) {
    console.error('Failed to save AI config:', error);
    throw new Error('保存配置失败');
  }
}

/**
 * 验证 AI 配置
 */
export function validateAIConfig(config: AIConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!config.provider) {
    errors.push('提供商不能为空');
  }

  if (!config.apiKey || config.apiKey.trim() === '') {
    errors.push('API Key 不能为空');
  }

  if (!config.endpoint || config.endpoint.trim() === '') {
    errors.push('API 端点不能为空');
  }

  if (!config.model || config.model.trim() === '') {
    errors.push('模型名称不能为空');
  }

  // 验证 URL 格式
  if (config.endpoint) {
    try {
      new URL(config.endpoint);
    } catch {
      errors.push('API 端点格式不正确');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * 获取提供商的默认配置
 */
export function getDefaultConfig(provider: AIProvider): Partial<AIConfig> {
  const configs: Record<AIProvider, Partial<AIConfig>> = {
    qwen: {
      // OpenAI 兼容
      endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
      model: 'qwen-plus'
    },
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo'
    },
    volcengine: {
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      model: 'doubao-seed-1-6-251015'
    },
    deepseek: {
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat'
    },
    custom: {
      endpoint: '',
      model: ''
    }
  };

  return configs[provider] || {};
}

/**
 * 重置为默认配置
 */
export function resetAIConfig(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * 获取提供商显示名称
 */
export function getProviderName(provider: AIProvider): string {
  const names: Record<AIProvider, string> = {
    qwen: '通义千问',
    openai: 'OpenAI',
    volcengine: '火山引擎（豆包）',
    deepseek: 'DeepSeek',
    custom: '自定义'
  };
  return names[provider] || provider;
}

/**
 * 获取模型显示名称
 */
export function getModelName(model: string): string {
  const names: Record<string, string> = {
    'qwen-plus': 'Qwen Plus',
    'qwen-turbo': 'Qwen Turbo',
    'qwen-max': 'Qwen Max',
    'gpt-3.5-turbo': 'GPT-3.5 Turbo',
    'gpt-4': 'GPT-4',
    'gpt-4-turbo': 'GPT-4 Turbo',
    'doubao-seed-1-6-251015': '豆包种子',
    'deepseek-chat': 'DeepSeek Chat'
  };
  return names[model] || model;
}

/**
 * 获取支持的模型列表
 */
export function getSupportedModels(provider: AIProvider): Array<{ value: string; label: string }> {
  const models: Record<AIProvider, Array<{ value: string; label: string }>> = {
    qwen: [
      { value: 'qwen-plus', label: 'Qwen Plus（推荐）' },
      { value: 'qwen-turbo', label: 'Qwen Turbo（快速）' },
      { value: 'qwen-max', label: 'Qwen Max（高级）' }
    ],
    openai: [
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
      { value: 'gpt-4', label: 'GPT-4' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' }
    ],
    volcengine: [
      { value: 'doubao-seed-1-6-251015', label: '豆包种子' }
    ],
    deepseek: [
      { value: 'deepseek-chat', label: 'DeepSeek Chat' }
    ],
    custom: []
  };

  return models[provider] || [];
}
