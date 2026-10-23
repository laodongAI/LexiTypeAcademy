/**
 * AI 配置服务 - 实现
 * 
 * 功能：
 * 1. 多 AI 提供商支持 (OpenAI, VolcEngine, DeepSeek, Qwen, Ollama, Custom)
 * 2. API 密钥安全存储
 * 3. 连接测试与健康检查
 * 4. 配置版本管理与审计
 * 5. Prompt 模板管理
 */

// ============================================================================
// AI 提供商定义
// ============================================================================

/**
 * AI 提供商类型
 */
export type AIProvider = 'openai' | 'volcengine' | 'deepseek' | 'qwen' | 'ollama' | 'custom';

/**
 * 提供商预设配置
 */
export interface ProviderPreset {
  endpoint: string;
  model: string;
  healthCheckPath: string;
  rateLimit: { rpm: number; tpm: number };
  supportedModels: string[];
}

/**
 * 提供商预设表
 */
export const PROVIDER_PRESETS: Record<AIProvider, ProviderPreset> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-3.5-turbo',
    healthCheckPath: '/v1/models',
    rateLimit: { rpm: 3500, tpm: 90000 },
    supportedModels: ['gpt-3.5-turbo', 'gpt-4', 'gpt-4-turbo', 'gpt-4o']
  },
  volcengine: {
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    model: 'doubao-seed-1-6-251015',
    healthCheckPath: '/api/v3/models',
    rateLimit: { rpm: 10000, tpm: 300000 },
    supportedModels: ['doubao-seed-1-6-251015', 'doubao-pro', 'doubao-lite']
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/chat/completions',
    model: 'deepseek-chat',
    healthCheckPath: '/v1/models',
    rateLimit: { rpm: 5000, tpm: 200000 },
    supportedModels: ['deepseek-chat', 'deepseek-coder']
  },
  qwen: {
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    model: 'qwen-plus',
    healthCheckPath: '/api/v1/utils/route',
    rateLimit: { rpm: 2000, tpm: 500000 },
    supportedModels: ['qwen-turbo', 'qwen-plus', 'qwen-max']
  },
  ollama: {
    endpoint: 'http://localhost:11434/v1/chat/completions',
    model: 'llama3',
    healthCheckPath: '/api/tags',
    rateLimit: { rpm: -1, tpm: -1 },
    supportedModels: ['llama3', 'mistral', 'neural-chat', 'qwen2.5']
  },
  custom: {
    endpoint: '',
    model: '',
    healthCheckPath: '/health',
    rateLimit: { rpm: -1, tpm: -1 },
    supportedModels: []
  }
};

// ============================================================================
// AI 配置接口
// ============================================================================

/**
 * AI 配置
 */
export interface AIConfig {
  // 基本信息
  provider: AIProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  
  // 配置元数据
  version: number;
  createdAt: string;
  updatedAt: string;
  lastTestedAt?: string;
  lastTestResult?: 'success' | 'failed' | 'timeout';
  
  // 高级配置
  timeout: number;
  maxRetries: number;
  retryBackoff: 'linear' | 'exponential';
  
  // 自定义 Prompt 模板
  customPrompts?: Record<string, string>;
}

/**
 * 加密元数据
 */
interface EncryptMeta {
  iv: string;
  salt: string;
  algorithm: string;
}

/**
 * 配置历史记录
 */
interface ConfigHistoryEntry {
  version: number;
  timestamp: string;
  provider: string;
  model: string;
  changes: Record<string, any>;
}

/**
 * 连接测试结果
 */
export interface ConnectionTestResult {
  success: boolean;
  provider: string;
  model: string;
  latency: number;
  errorMessage?: string;
}

// ============================================================================
// AI 配置服务接口
// ============================================================================

/**
 * AI 配置服务接口
 */
export interface IAIConfigService {
  // 配置管理
  saveConfig(config: AIConfig): Promise<void>;
  loadConfig(): Promise<AIConfig | null>;
  getDefaultConfig(provider: AIProvider): AIConfig;
  
  // 连接测试
  testConnection(config: AIConfig): Promise<ConnectionTestResult>;
  
  // 配置历史
  getConfigHistory(): ConfigHistoryEntry[];
  rollbackConfig(version: number): Promise<void>;
  
  // Prompt 模板
  getCustomPrompt(key: string): string | undefined;
  setCustomPrompt(key: string, template: string): Promise<void>;
}

// ============================================================================
// AI 配置服务实现
// ============================================================================

/**
 * AI 配置服务
 * 负责管理 AI 提供商配置、连接测试、Prompt 模板等
 */
export class AIConfigService implements IAIConfigService {
  private static readonly CONFIG_KEY = 'ai_config';
  private static readonly HISTORY_KEY = 'ai_config_history';
  private static readonly MAX_HISTORY = 10;
  
  // ============================================================================
  // 配置管理
  // ============================================================================

  /**
   * 保存 AI 配置
   * @param config AI 配置对象
   */
  async saveConfig(config: AIConfig): Promise<void> {
    // 1. 验证必填字段
    if (!config.provider || !config.endpoint || !config.model) {
      throw new Error('缺少必填字段：provider, endpoint, model');
    }

    // 2. 加载现有配置获取版本号
    const existingConfig = await this.loadConfig();
    const newVersion = (existingConfig?.version || 0) + 1;

    // 3. 编码 API 密钥 (简单 base64，生产环境应使用更安全的方式)
    const encodedKey = this.encodeApiKey(config.apiKey);

    // 4. 构建保存对象
    const configToSave = {
      ...config,
      version: newVersion,
      updatedAt: new Date().toISOString(),
      apiKey: encodedKey,
      _encoded: true
    };

    // 5. 保存配置历史
    this.saveConfigHistory({
      version: newVersion,
      timestamp: configToSave.updatedAt,
      provider: config.provider,
      model: config.model,
      changes: this.detectChanges(existingConfig, config)
    });

    // 6. 保存到 localStorage
    localStorage.setItem(AIConfigService.CONFIG_KEY, JSON.stringify(configToSave));
    
    console.log(`✅ AI 配置已保存 (版本 ${newVersion})`);
  }

  /**
   * 加载 AI 配置
   * @returns AI 配置对象，如果不存在则返回 null
   */
  async loadConfig(): Promise<AIConfig | null> {
    try {
      const saved = localStorage.getItem(AIConfigService.CONFIG_KEY);
      if (!saved) return null;

      const config = JSON.parse(saved);

      // 解码 API 密钥
      if (config._encoded) {
        config.apiKey = this.decodeApiKey(config.apiKey);
        delete config._encoded;
      }

      return config as AIConfig;
    } catch (error) {
      console.error('加载 AI 配置失败:', error);
      return null;
    }
  }

  /**
   * 获取默认配置
   * @param provider AI 提供商
   * @returns 默认配置对象
   */
  getDefaultConfig(provider: AIProvider): AIConfig {
    const preset = PROVIDER_PRESETS[provider];
    
    return {
      provider,
      apiKey: '',
      endpoint: preset.endpoint,
      model: preset.model,
      version: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      timeout: 30000,
      maxRetries: 3,
      retryBackoff: 'exponential'
    };
  }

  // ============================================================================
  // 连接测试
  // ============================================================================

  /**
   * 测试 AI 连接
   * @param config AI 配置
   * @returns 测试结果
   */
  async testConnection(config: AIConfig): Promise<ConnectionTestResult> {
    const startTime = Date.now();

    try {
      // 1. 验证配置
      if (!config.apiKey) {
        throw new Error('API 密钥不能为空');
      }

      // 2. 发送测试请求
      const response = await fetch(config.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: '回复 "ok"' }],
          max_tokens: 10,
          temperature: 0.7
        }),
        signal: AbortSignal.timeout(config.timeout || 30000)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API 响应错误 (${response.status}): ${errorText}`);
      }

      const latency = Date.now() - startTime;

      // 3. 更新测试结果
      await this.updateTestResult(config, 'success');

      return {
        success: true,
        provider: config.provider,
        model: config.model,
        latency
      };
    } catch (error: any) {
      const latency = Date.now() - startTime;
      
      // 更新测试结果
      await this.updateTestResult(config, 'failed');

      return {
        success: false,
        provider: config.provider,
        model: config.model,
        latency,
        errorMessage: error.message || '连接失败'
      };
    }
  }

  /**
   * 更新测试结果到配置
   */
  private async updateTestResult(
    config: AIConfig,
    result: 'success' | 'failed' | 'timeout'
  ): Promise<void> {
    const savedConfig = await this.loadConfig();
    if (savedConfig && savedConfig.provider === config.provider) {
      savedConfig.lastTestedAt = new Date().toISOString();
      savedConfig.lastTestResult = result;
      // 直接写入，不增加版本号
      localStorage.setItem(AIConfigService.CONFIG_KEY, JSON.stringify({
        ...savedConfig,
        apiKey: this.encodeApiKey(savedConfig.apiKey),
        _encoded: true
      }));
    }
  }

  // ============================================================================
  // 配置历史
  // ============================================================================

  /**
   * 获取配置历史
   */
  getConfigHistory(): ConfigHistoryEntry[] {
    try {
      const saved = localStorage.getItem(AIConfigService.HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存配置历史
   */
  private saveConfigHistory(entry: ConfigHistoryEntry): void {
    const history = this.getConfigHistory();
    history.push(entry);
    
    // 保留最近的历史记录
    const trimmed = history.slice(-AIConfigService.MAX_HISTORY);
    localStorage.setItem(AIConfigService.HISTORY_KEY, JSON.stringify(trimmed));
  }

  /**
   * 回滚到指定版本
   */
  async rollbackConfig(version: number): Promise<void> {
    // 暂不实现，需要完整的配置快照
    throw new Error('配置回滚功能尚未实现');
  }

  // ============================================================================
  // Prompt 模板管理
  // ============================================================================

  /**
   * 获取自定义 Prompt
   */
  getCustomPrompt(key: string): string | undefined {
    const config = this.loadConfigSync();
    return config?.customPrompts?.[key];
  }

  /**
   * 设置自定义 Prompt
   */
  async setCustomPrompt(key: string, template: string): Promise<void> {
    const config = await this.loadConfig();
    if (!config) {
      throw new Error('请先配置 AI 提供商');
    }

    config.customPrompts = config.customPrompts || {};
    config.customPrompts[key] = template;
    
    await this.saveConfig(config);
  }

  // ============================================================================
  // 辅助方法
  // ============================================================================

  /**
   * 同步加载配置 (内部使用)
   */
  private loadConfigSync(): AIConfig | null {
    try {
      const saved = localStorage.getItem(AIConfigService.CONFIG_KEY);
      if (!saved) return null;

      const config = JSON.parse(saved);
      if (config._encoded) {
        config.apiKey = this.decodeApiKey(config.apiKey);
        delete config._encoded;
      }

      return config;
    } catch {
      return null;
    }
  }

  /**
   * 编码 API 密钥 (简单 base64)
   * 注意：生产环境应使用更安全的加密方式
   */
  private encodeApiKey(apiKey: string): string {
    if (!apiKey) return '';
    try {
      return btoa(unescape(encodeURIComponent(apiKey)));
    } catch {
      return apiKey;
    }
  }

  /**
   * 解码 API 密钥
   */
  private decodeApiKey(encoded: string): string {
    if (!encoded) return '';
    try {
      return decodeURIComponent(escape(atob(encoded)));
    } catch {
      return encoded;
    }
  }

  /**
   * 检测配置变更
   */
  private detectChanges(
    oldConfig: AIConfig | null,
    newConfig: AIConfig
  ): Record<string, any> {
    if (!oldConfig) {
      return { type: 'create' };
    }

    const changes: Record<string, any> = {};

    if (oldConfig.provider !== newConfig.provider) {
      changes.provider = { from: oldConfig.provider, to: newConfig.provider };
    }
    if (oldConfig.model !== newConfig.model) {
      changes.model = { from: oldConfig.model, to: newConfig.model };
    }
    if (oldConfig.endpoint !== newConfig.endpoint) {
      changes.endpoint = { from: oldConfig.endpoint, to: newConfig.endpoint };
    }

    return Object.keys(changes).length > 0 ? changes : { type: 'no_changes' };
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let _instance: AIConfigService | null = null;

/**
 * 获取 AI 配置服务实例
 */
export function getAIConfigService(): AIConfigService {
  if (!_instance) {
    _instance = new AIConfigService();
  }
  return _instance;
}
