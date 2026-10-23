/**
 * Prompt 模板管理服务 - 实现
 * 
 * 功能：
 * 1. 预设模板库（课程生成、翻译、写作分析等）
 * 2. 模板变量验证
 * 3. 模板渲染
 * 4. 自定义模板管理
 * 5. 模板版本控制
 */

// ============================================================================
// 模板类型定义
// ============================================================================

/**
 * 模板分类
 */
export type PromptCategory = 
  | 'course-generation'  // 课程生成
  | 'translation'        // 翻译
  | 'writing-analysis'   // 写作分析
  | 'vocabulary'         // 词汇
  | 'dialogue'           // 对话
  | 'custom';            // 自定义

/**
 * 模板变量定义
 */
export interface TemplateVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  description: string;
  required: boolean;
  default?: any;
}

/**
 * Prompt 模板
 */
export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  category: PromptCategory;
  version: number;
  
  // 模板内容
  template: string;
  variables: TemplateVariable[];
  
  // 使用统计
  usageCount?: number;
  successRate?: number;
  averageTokens?: number;
  
  // 元数据
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
  tags?: string[];
}

/**
 * 渲染选项
 */
export interface RenderOptions {
  strict?: boolean;  // 严格模式：缺少必需变量时抛错
  trim?: boolean;    // 是否去除首尾空白
}

// ============================================================================
// 预设模板库
// ============================================================================

/**
 * 预设模板定义
 */
const BUILT_IN_TEMPLATES: Omit<PromptTemplate, 'createdAt' | 'updatedAt'>[] = [
  // ============================================================================
  // 课程生成模板
  // ============================================================================
  {
    id: 'course-gen-words',
    name: '单词课程生成',
    description: '根据主题和难度生成单词打字练习课程',
    category: 'course-generation',
    version: 1,
    isBuiltIn: true,
    template: `你是一位专业的英语教育专家。请根据以下要求生成一份单词打字练习课程：

主题：{{topic}}
难度等级：{{difficulty}}
单词数量：{{wordCount}}
目标学习者：{{targetLearner}}

请生成以下格式的 JSON 响应：
{
  "title": "课程标题",
  "description": "课程描述",
  "words": [
    {
      "word": "单词",
      "phonetic": "音标",
      "meaning": "中文释义",
      "example": "例句",
      "difficulty": 1-5
    }
  ]
}

要求：
1. 单词难度要符合指定的 CEFR 等级
2. 每个单词都要有音标、释义和例句
3. 例句要简洁易懂，适合打字练习
4. 单词之间要有主题关联性`,
    variables: [
      { name: 'topic', type: 'string', description: '课程主题', required: true },
      { name: 'difficulty', type: 'string', description: 'CEFR 难度等级 (A1-C2)', required: true, default: 'A2' },
      { name: 'wordCount', type: 'number', description: '单词数量', required: false, default: 20 },
      { name: 'targetLearner', type: 'string', description: '目标学习者', required: false, default: '中学生' }
    ],
    tags: ['words', 'typing', 'vocabulary']
  },

  {
    id: 'course-gen-sentences',
    name: '句子课程生成',
    description: '根据语法点和主题生成句子打字练习课程',
    category: 'course-generation',
    version: 1,
    isBuiltIn: true,
    template: `你是一位专业的英语教育专家。请根据以下要求生成一份句子打字练习课程：

主题：{{topic}}
语法点：{{grammarPoint}}
难度等级：{{difficulty}}
句子数量：{{sentenceCount}}

请生成以下格式的 JSON 响应：
{
  "title": "课程标题",
  "description": "课程描述",
  "grammarExplanation": "语法点简要说明",
  "sentences": [
    {
      "content": "英文句子",
      "translation": "中文翻译",
      "keyPoint": "语法要点说明"
    }
  ]
}

要求：
1. 句子要自然、地道
2. 每个句子都要体现指定的语法点
3. 句子长度适中，适合打字练习
4. 翻译要准确通顺`,
    variables: [
      { name: 'topic', type: 'string', description: '课程主题', required: true },
      { name: 'grammarPoint', type: 'string', description: '语法点', required: true },
      { name: 'difficulty', type: 'string', description: 'CEFR 难度等级', required: false, default: 'A2' },
      { name: 'sentenceCount', type: 'number', description: '句子数量', required: false, default: 15 }
    ],
    tags: ['sentences', 'typing', 'grammar']
  },

  // ============================================================================
  // 写作分析模板
  // ============================================================================
  {
    id: 'writing-analysis',
    name: '写作分析',
    description: '分析英语写作并提供反馈',
    category: 'writing-analysis',
    version: 1,
    isBuiltIn: true,
    template: `你是一位专业的英语写作教师。请分析以下学生作文并提供详细反馈：

题目：{{title}}
学生作文：
{{content}}

请按以下格式提供分析：
{
  "overallScore": 1-100,
  "dimensions": {
    "grammar": { "score": 1-100, "comments": "语法评价" },
    "vocabulary": { "score": 1-100, "comments": "词汇评价" },
    "structure": { "score": 1-100, "comments": "结构评价" },
    "coherence": { "score": 1-100, "comments": "连贯性评价" }
  },
  "strengths": ["优点1", "优点2"],
  "improvements": ["改进建议1", "改进建议2"],
  "corrections": [
    {
      "original": "原文",
      "corrected": "修改后",
      "explanation": "说明"
    }
  ],
  "improvedVersion": "优化后的完整版本"
}`,
    variables: [
      { name: 'title', type: 'string', description: '作文题目', required: true },
      { name: 'content', type: 'string', description: '作文内容', required: true }
    ],
    tags: ['writing', 'feedback', 'analysis']
  },

  // ============================================================================
  // 词汇模板
  // ============================================================================
  {
    id: 'vocabulary-expansion',
    name: '词汇扩展',
    description: '根据单词生成相关词汇和用法',
    category: 'vocabulary',
    version: 1,
    isBuiltIn: true,
    template: `请为以下单词提供详细的词汇扩展信息：

单词：{{word}}

请按以下格式返回 JSON：
{
  "word": "{{word}}",
  "phonetic": "音标",
  "partOfSpeech": "词性",
  "definitions": [
    { "meaning": "释义", "example": "例句" }
  ],
  "synonyms": ["同义词"],
  "antonyms": ["反义词"],
  "wordFamily": ["词族相关词"],
  "collocations": ["常见搭配"],
  "idioms": ["相关习语"],
  "usageNotes": "使用注意事项"
}`,
    variables: [
      { name: 'word', type: 'string', description: '要扩展的单词', required: true }
    ],
    tags: ['vocabulary', 'expansion']
  },

  // ============================================================================
  // 对话生成模板
  // ============================================================================
  {
    id: 'dialogue-generation',
    name: '对话生成',
    description: '生成场景对话练习',
    category: 'dialogue',
    version: 1,
    isBuiltIn: true,
    template: `请根据以下场景生成一段英语对话：

场景：{{scenario}}
角色A：{{roleA}}
角色B：{{roleB}}
难度：{{difficulty}}
对话轮数：{{turns}}

请按以下格式返回 JSON：
{
  "title": "对话标题",
  "scenario": "场景描述",
  "dialogue": [
    { "speaker": "A/B", "text": "对话内容", "translation": "中文翻译" }
  ],
  "keyExpressions": [
    { "expression": "关键表达", "meaning": "含义", "usage": "用法说明" }
  ],
  "practiceQuestions": ["练习问题"]
}`,
    variables: [
      { name: 'scenario', type: 'string', description: '对话场景', required: true },
      { name: 'roleA', type: 'string', description: '角色A描述', required: false, default: '顾客' },
      { name: 'roleB', type: 'string', description: '角色B描述', required: false, default: '店员' },
      { name: 'difficulty', type: 'string', description: '难度等级', required: false, default: 'A2' },
      { name: 'turns', type: 'number', description: '对话轮数', required: false, default: 6 }
    ],
    tags: ['dialogue', 'conversation', 'speaking']
  },

  // ============================================================================
  // 翻译模板
  // ============================================================================
  {
    id: 'translation-en-to-zh',
    name: '英译中',
    description: '将英文翻译成中文',
    category: 'translation',
    version: 1,
    isBuiltIn: true,
    template: `请将以下英文翻译成中文，要求翻译准确、自然、通顺：

原文：
{{text}}

{{#if context}}
上下文说明：{{context}}
{{/if}}

请返回：
{
  "translation": "中文翻译",
  "alternativeTranslations": ["其他可能的翻译"],
  "notes": "翻译说明（如有特殊处理）"
}`,
    variables: [
      { name: 'text', type: 'string', description: '要翻译的英文', required: true },
      { name: 'context', type: 'string', description: '上下文说明', required: false }
    ],
    tags: ['translation', 'english', 'chinese']
  }
];

// ============================================================================
// Prompt 模板服务接口
// ============================================================================

/**
 * Prompt 模板服务接口
 */
export interface IPromptTemplateService {
  // 模板查询
  getTemplate(id: string): PromptTemplate | undefined;
  getTemplatesByCategory(category: PromptCategory): PromptTemplate[];
  getAllTemplates(): PromptTemplate[];
  searchTemplates(query: string): PromptTemplate[];
  
  // 模板渲染
  renderTemplate(id: string, variables: Record<string, any>, options?: RenderOptions): string;
  validateVariables(id: string, variables: Record<string, any>): { valid: boolean; errors: string[] };
  
  // 自定义模板管理
  saveCustomTemplate(template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>): PromptTemplate;
  deleteCustomTemplate(id: string): void;
  
  // 使用统计
  recordUsage(id: string, success: boolean, tokens?: number): void;
}

// ============================================================================
// Prompt 模板服务实现
// ============================================================================

/**
 * Prompt 模板服务
 */
export class PromptTemplateService implements IPromptTemplateService {
  private templates: Map<string, PromptTemplate> = new Map();
  private static readonly STORAGE_KEY = 'prompt_templates_custom';

  constructor() {
    this.loadBuiltInTemplates();
    this.loadCustomTemplates();
  }

  // ============================================================================
  // 初始化
  // ============================================================================

  /**
   * 加载预设模板
   */
  private loadBuiltInTemplates(): void {
    const now = new Date().toISOString();
    
    for (const template of BUILT_IN_TEMPLATES) {
      this.templates.set(template.id, {
        ...template,
        createdAt: now,
        updatedAt: now
      });
    }
    
    console.log(`📚 已加载 ${BUILT_IN_TEMPLATES.length} 个预设模板`);
  }

  /**
   * 加载自定义模板
   */
  private loadCustomTemplates(): void {
    try {
      const saved = localStorage.getItem(PromptTemplateService.STORAGE_KEY);
      if (saved) {
        const customTemplates: PromptTemplate[] = JSON.parse(saved);
        for (const template of customTemplates) {
          this.templates.set(template.id, template);
        }
        console.log(`📝 已加载 ${customTemplates.length} 个自定义模板`);
      }
    } catch (error) {
      console.error('加载自定义模板失败:', error);
    }
  }

  /**
   * 保存自定义模板到存储
   */
  private saveCustomTemplates(): void {
    const customTemplates = Array.from(this.templates.values())
      .filter(t => !t.isBuiltIn);
    localStorage.setItem(PromptTemplateService.STORAGE_KEY, JSON.stringify(customTemplates));
  }

  // ============================================================================
  // 模板查询
  // ============================================================================

  /**
   * 获取模板
   */
  getTemplate(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  /**
   * 按分类获取模板
   */
  getTemplatesByCategory(category: PromptCategory): PromptTemplate[] {
    return Array.from(this.templates.values())
      .filter(t => t.category === category);
  }

  /**
   * 获取所有模板
   */
  getAllTemplates(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * 搜索模板
   */
  searchTemplates(query: string): PromptTemplate[] {
    const lowerQuery = query.toLowerCase();
    return Array.from(this.templates.values())
      .filter(t => 
        t.name.toLowerCase().includes(lowerQuery) ||
        t.description.toLowerCase().includes(lowerQuery) ||
        t.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
  }

  // ============================================================================
  // 模板渲染
  // ============================================================================

  /**
   * 渲染模板
   */
  renderTemplate(
    id: string,
    variables: Record<string, any>,
    options: RenderOptions = {}
  ): string {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`模板不存在: ${id}`);
    }

    // 验证变量
    if (options.strict) {
      const validation = this.validateVariables(id, variables);
      if (!validation.valid) {
        throw new Error(`模板变量验证失败: ${validation.errors.join(', ')}`);
      }
    }

    // 合并默认值
    const mergedVars: Record<string, any> = {};
    for (const varDef of template.variables) {
      if (variables[varDef.name] !== undefined) {
        mergedVars[varDef.name] = variables[varDef.name];
      } else if (varDef.default !== undefined) {
        mergedVars[varDef.name] = varDef.default;
      }
    }

    // 渲染模板（简单的变量替换）
    let rendered = template.template;
    
    // 处理简单变量 {{variable}}
    rendered = rendered.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      if (mergedVars[varName] !== undefined) {
        return String(mergedVars[varName]);
      }
      return match;
    });

    // 处理条件块 {{#if variable}}...{{/if}}
    rendered = rendered.replace(
      /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g,
      (match, varName, content) => {
        if (mergedVars[varName]) {
          return content.replace(/\{\{(\w+)\}\}/g, (m: string, v: string) => 
            mergedVars[v] !== undefined ? String(mergedVars[v]) : m
          );
        }
        return '';
      }
    );

    if (options.trim) {
      rendered = rendered.trim();
    }

    return rendered;
  }

  /**
   * 验证变量
   */
  validateVariables(
    id: string,
    variables: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const template = this.templates.get(id);
    if (!template) {
      return { valid: false, errors: [`模板不存在: ${id}`] };
    }

    const errors: string[] = [];

    for (const varDef of template.variables) {
      const value = variables[varDef.name];

      // 检查必需变量
      if (varDef.required && value === undefined) {
        errors.push(`缺少必需变量: ${varDef.name}`);
        continue;
      }

      // 检查类型
      if (value !== undefined) {
        const actualType = Array.isArray(value) ? 'array' : typeof value;
        if (actualType !== varDef.type) {
          errors.push(`变量 ${varDef.name} 类型错误: 期望 ${varDef.type}, 实际 ${actualType}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  // ============================================================================
  // 自定义模板管理
  // ============================================================================

  /**
   * 保存自定义模板
   */
  saveCustomTemplate(
    template: Omit<PromptTemplate, 'id' | 'createdAt' | 'updatedAt' | 'isBuiltIn'>
  ): PromptTemplate {
    const now = new Date().toISOString();
    const newTemplate: PromptTemplate = {
      ...template,
      id: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      isBuiltIn: false,
      createdAt: now,
      updatedAt: now
    };

    this.templates.set(newTemplate.id, newTemplate);
    this.saveCustomTemplates();
    
    console.log(`💾 自定义模板已保存: ${newTemplate.name}`);
    return newTemplate;
  }

  /**
   * 删除自定义模板
   */
  deleteCustomTemplate(id: string): void {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`模板不存在: ${id}`);
    }
    if (template.isBuiltIn) {
      throw new Error('不能删除预设模板');
    }

    this.templates.delete(id);
    this.saveCustomTemplates();
    
    console.log(`🗑️ 自定义模板已删除: ${id}`);
  }

  // ============================================================================
  // 使用统计
  // ============================================================================

  /**
   * 记录模板使用
   */
  recordUsage(id: string, success: boolean, tokens?: number): void {
    const template = this.templates.get(id);
    if (!template) return;

    template.usageCount = (template.usageCount || 0) + 1;

    // 更新成功率
    if (template.successRate !== undefined) {
      const totalSuccess = template.successRate * (template.usageCount - 1);
      template.successRate = (totalSuccess + (success ? 1 : 0)) / template.usageCount;
    } else {
      template.successRate = success ? 1 : 0;
    }

    // 更新平均 token
    if (tokens !== undefined) {
      if (template.averageTokens !== undefined) {
        const totalTokens = template.averageTokens * (template.usageCount - 1);
        template.averageTokens = (totalTokens + tokens) / template.usageCount;
      } else {
        template.averageTokens = tokens;
      }
    }

    // 保存更新
    if (!template.isBuiltIn) {
      this.saveCustomTemplates();
    }
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let _instance: PromptTemplateService | null = null;

/**
 * 获取 Prompt 模板服务实例
 */
export function getPromptTemplateService(): PromptTemplateService {
  if (!_instance) {
    _instance = new PromptTemplateService();
  }
  return _instance;
}
