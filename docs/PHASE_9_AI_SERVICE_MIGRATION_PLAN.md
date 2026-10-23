# Phase 9: AI 服务迁移实施计划

**开始日期**: 2026-01-06  
**预计工期**: 7-10 工作日  
**优先级**: P1（高）  
**负责人**: 前端团队

---

## 📋 目标

将旧框架中的 AI 服务完整迁移到新框架，确保所有 AILab 功能正常工作。

### 核心目标
1. ✅ 创建统一的 AI 服务层
2. ✅ 支持多个 AI 提供商（Qwen、OpenAI、Volcengine 等）
3. ✅ 实现课程生成、词汇增强、翻译等功能
4. ✅ 集成到 AILab 页面
5. ✅ 完善错误处理和用户体验

---

## 🗓️ 分阶段计划

### Day 1-2: AI 服务基础架构（2 天）

#### 任务清单
- [ ] 创建服务目录结构
- [ ] 定义接口和类型
- [ ] 实现配置管理
- [ ] 实现基础 HTTP 客户端

#### 文件创建

**1. 目录结构**
```
vue-app/src/shared/services/
├── ai/
│   ├── index.ts                    # 导出入口
│   ├── aiService.ts                # 核心 AI 服务
│   ├── aiTypes.ts                  # 类型定义
│   ├── aiConfig.ts                 # 配置管理
│   ├── aiLogger.ts                 # 日志记录
│   ├── providers/                  # AI 提供商
│   │   ├── baseProvider.ts         # 基础抽象类
│   │   ├── qwenProvider.ts         # Qwen（通义千问）
│   │   ├── openaiProvider.ts       # OpenAI
│   │   ├── volcengineProvider.ts   # Volcengine（豆包）
│   │   ├── deepseekProvider.ts     # DeepSeek
│   │   └── index.ts                # 提供商导出
│   └── prompts/                    # 提示词模板
│       ├── courseGeneration.ts
│       ├── vocabularyEnrich.ts
│       └── translation.ts
```

**2. aiTypes.ts**
```typescript
export type AIProvider = 'qwen' | 'openai' | 'volcengine' | 'deepseek' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  endpoint: string;
  model: string;
  customPrompts?: Record<string, string>;
}

export interface AIOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
  timeout?: number;
}

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CourseGenerationRequest {
  topic: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  lessonCount: number;
  wordsPerLesson: number;
  style?: string;
  notes?: string;
}

export interface WordEntry {
  word: string;
  meaning?: string;
  translation?: string;
  phonetic?: string;
  example?: string;
  exampleTranslation?: string;
  partOfSpeech?: string;
}

export interface AIResponse {
  content: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}
```

**3. baseProvider.ts**
```typescript
import type { AIConfig, AIOptions, AIResponse, AIMessage } from '../aiTypes';

export abstract class BaseAIProvider {
  protected config: AIConfig;
  
  constructor(config: AIConfig) {
    this.config = config;
  }
  
  abstract get name(): string;
  
  abstract callAPI(
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse>;
  
  abstract streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void>;
  
  protected async makeRequest(
    url: string,
    body: any,
    options?: RequestInit
  ): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        ...options?.headers
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(options?.timeout || 60000)
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.message || `API request failed: ${response.status}`);
    }
    
    return response;
  }
}
```

**4. aiConfig.ts**
```typescript
import type { AIConfig } from './aiTypes';

const STORAGE_KEY = 'lexitype_ai_config';

const DEFAULT_CONFIG: AIConfig = {
  provider: 'qwen',
  apiKey: '',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-plus',
  customPrompts: {}
};

export function loadAIConfig(): AIConfig {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    } catch (error) {
      console.error('Failed to parse AI config:', error);
    }
  }
  return DEFAULT_CONFIG;
}

export function saveAIConfig(config: AIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function getDefaultConfig(provider: string): Partial<AIConfig> {
  const configs: Record<string, Partial<AIConfig>> = {
    qwen: {
      endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
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
    }
  };
  
  return configs[provider] || {};
}
```

---

### Day 3-4: AI 提供商实现（2 天）

#### 任务清单
- [ ] 实现 QwenProvider
- [ ] 实现 OpenAIProvider
- [ ] 实现 VolcengineProvider
- [ ] 测试各提供商连接

#### Qwen Provider 完整实现

```typescript
// vue-app/src/shared/services/ai/providers/qwenProvider.ts

import { BaseAIProvider } from './baseProvider';
import type { AIMessage, AIOptions, AIResponse } from '../aiTypes';

export class QwenProvider extends BaseAIProvider {
  get name(): string {
    return 'qwen';
  }
  
  async callAPI(
    messages: AIMessage[],
    options?: AIOptions
  ): Promise<AIResponse> {
    const response = await this.makeRequest(
      this.config.endpoint,
      {
        model: this.config.model,
        input: { messages },
        parameters: {
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          result_format: 'message'
        }
      },
      { timeout: options?.timeout }
    );
    
    const data = await response.json();
    return {
      content: data.output.choices[0].message.content,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.total_tokens
      }
    };
  }
  
  async streamAPI(
    messages: AIMessage[],
    onChunk: (chunk: string) => void,
    options?: AIOptions
  ): Promise<void> {
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
        'X-DashScope-SSE': 'enable'
      },
      body: JSON.stringify({
        model: this.config.model,
        input: { messages },
        parameters: {
          temperature: options?.temperature || 0.7,
          max_tokens: options?.maxTokens || 2000,
          incremental_output: true,
          result_format: 'message'
        }
      })
    });
    
    if (!response.ok) {
      throw new Error(`Stream request failed: ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) throw new Error('Response body is null');
    
    const decoder = new TextDecoder();
    let buffer = '';
    
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          if (line.startsWith('data:')) {
            try {
              const data = JSON.parse(line.slice(5));
              const content = data.output?.choices?.[0]?.message?.content;
              if (content) {
                onChunk(content);
              }
            } catch (e) {
              console.warn('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}
```

---

### Day 5-6: 核心功能实现（2 天）

#### 任务清单
- [ ] 实现 AIService 核心类
- [ ] 实现课程生成功能
- [ ] 实现词汇增强功能
- [ ] 实现翻译功能
- [ ] 实现对话功能

#### AIService 完整实现

```typescript
// vue-app/src/shared/services/ai/aiService.ts

import { BaseAIProvider } from './providers/baseProvider';
import { QwenProvider } from './providers/qwenProvider';
import { OpenAIProvider } from './providers/openaiProvider';
import { VolcengineProvider } from './providers/volcengineProvider';
import { loadAIConfig, saveAIConfig } from './aiConfig';
import { logAITask } from './aiLogger';
import type {
  AIConfig,
  AIMessage,
  AIOptions,
  CourseGenerationRequest,
  WordEntry
} from './aiTypes';
import type { Course } from '../types/course';

export class AIService {
  private provider: BaseAIProvider;
  private config: AIConfig;
  
  constructor(config?: AIConfig) {
    this.config = config || loadAIConfig();
    this.provider = this.createProvider();
  }
  
  private createProvider(): BaseAIProvider {
    const providers: Record<string, typeof BaseAIProvider> = {
      qwen: QwenProvider,
      openai: OpenAIProvider,
      volcengine: VolcengineProvider
    };
    
    const ProviderClass = providers[this.config.provider];
    if (!ProviderClass) {
      throw new Error(`Unknown provider: ${this.config.provider}`);
    }
    
    return new ProviderClass(this.config);
  }
  
  /**
   * 通用 AI 调用
   */
  async call(
    prompt: string,
    systemPrompt?: string,
    options?: AIOptions
  ): Promise<string> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    const response = await this.provider.callAPI(messages, options);
    return response.content;
  }
  
  /**
   * 流式 AI 调用
   */
  async stream(
    prompt: string,
    onChunk: (chunk: string) => void,
    systemPrompt?: string,
    options?: AIOptions
  ): Promise<void> {
    const messages: AIMessage[] = [];
    
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    
    messages.push({ role: 'user', content: prompt });
    
    await this.provider.streamAPI(messages, onChunk, options);
  }
  
  /**
   * 生成课程
   */
  async generateCourse(request: CourseGenerationRequest): Promise<Course> {
    const taskId = await logAITask('course-generation', request);
    
    try {
      const prompt = this.buildCoursePrompt(request);
      const systemPrompt = 'You are an expert English teacher who creates engaging typing practice courses.';
      
      const response = await this.call(prompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 3000
      });
      
      const course = this.parseCourseResponse(response, request);
      await logAITask(taskId, 'completed', course);
      
      return course;
    } catch (error) {
      await logAITask(taskId, 'failed', null, error.message);
      throw error;
    }
  }
  
  /**
   * 词汇增强
   */
  async enrichVocabulary(words: WordEntry[]): Promise<WordEntry[]> {
    const taskId = await logAITask('vocabulary-enrich', { count: words.length });
    
    try {
      const prompt = this.buildVocabularyPrompt(words);
      const systemPrompt = 'You are an English linguist who provides accurate phonetics, examples, and translations.';
      
      const response = await this.call(prompt, systemPrompt, {
        temperature: 0.3,
        maxTokens: 2000
      });
      
      const enriched = this.parseVocabularyResponse(response, words);
      await logAITask(taskId, 'completed', enriched);
      
      return enriched;
    } catch (error) {
      await logAITask(taskId, 'failed', null, error.message);
      throw error;
    }
  }
  
  /**
   * 翻译
   */
  async translate(text: string, targetLang: string = 'zh'): Promise<string> {
    const prompt = `Translate the following text to ${targetLang === 'zh' ? 'Chinese' : 'English'}. Only return the translation, no explanations:\n\n${text}`;
    
    return await this.call(prompt, 'You are a precise translator.', {
      temperature: 0.2,
      maxTokens: 1000
    });
  }
  
  /**
   * 对话
   */
  async chat(messages: AIMessage[]): Promise<string> {
    const response = await this.provider.callAPI(messages, {
      temperature: 0.8,
      maxTokens: 1000
    });
    
    return response.content;
  }
  
  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.call('Say "Hello"', undefined, { maxTokens: 10 });
      return true;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }
  
  // Prompt 构建方法
  private buildCoursePrompt(request: CourseGenerationRequest): string {
    return `
Create a typing practice course with the following requirements:
- Topic: ${request.topic}
- Level: ${request.level}
- Number of lessons: ${request.lessonCount}
- Words per lesson: ${request.wordsPerLesson}
${request.style ? `- Style: ${request.style}` : ''}
${request.notes ? `- Additional notes: ${request.notes}` : ''}

Return ONLY a valid JSON object with this structure:
{
  "title": "Course Title",
  "description": "Brief description",
  "tags": ["topic", "level"],
  "lessons": [
    {
      "title": "Lesson Title",
      "content": "English text for typing (50-100 words)",
      "language": "en"
    }
  ]
}

Do not include markdown code blocks. Return raw JSON only.
`;
  }
  
  private buildVocabularyPrompt(words: WordEntry[]): string {
    const wordList = words.map(w => w.word).join(', ');
    return `
For each word (${wordList}), provide:
- phonetic: IPA pronunciation
- example: A natural English sentence
- exampleTranslation: Chinese translation
- translation: Chinese meaning

Return ONLY a JSON array:
[
  {
    "word": "example",
    "phonetic": "/ɪɡˈzɑːmpl/",
    "example": "This is an example sentence.",
    "exampleTranslation": "这是一个例句。",
    "translation": "例子"
  }
]

No markdown, just raw JSON array.
`;
  }
  
  private parseCourseResponse(response: string, request: CourseGenerationRequest): Course {
    // Remove markdown code blocks if present
    const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
    
    try {
      const data = JSON.parse(cleanResponse);
      
      // Convert to Course format
      return {
        id: `ai-${Date.now()}`,
        title: data.title || request.topic,
        description: data.description || '',
        tags: data.tags || [request.topic],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lessons: data.lessons.map((lesson: any, index: number) => ({
          id: `lesson-${index + 1}`,
          courseId: `ai-${Date.now()}`,
          title: lesson.title || `Lesson ${index + 1}`,
          order: index,
          content: lesson.content,
          language: lesson.language || 'en',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }))
      };
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error.message}`);
    }
  }
  
  private parseVocabularyResponse(response: string, originalWords: WordEntry[]): WordEntry[] {
    const cleanResponse = response.replace(/```json\n?|```/g, '').trim();
    
    try {
      const enriched = JSON.parse(cleanResponse);
      
      // Merge with original data
      return originalWords.map((word, index) => ({
        ...word,
        ...enriched[index]
      }));
    } catch (error) {
      throw new Error(`Failed to parse vocabulary response: ${error.message}`);
    }
  }
  
  /**
   * 更新配置
   */
  updateConfig(config: Partial<AIConfig>): void {
    this.config = { ...this.config, ...config };
    saveAIConfig(this.config);
    this.provider = this.createProvider();
  }
  
  /**
   * 获取当前配置
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }
}

// Singleton instance
let aiServiceInstance: AIService | null = null;

export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

export function resetAIService(): void {
  aiServiceInstance = null;
}
```

---

### Day 7-8: AILab 页面集成（2 天）

#### 任务清单
- [ ] 导入 AI 服务到 AILabPage.vue
- [ ] 实现课程生成功能
- [ ] 实现词汇增强功能
- [ ] 实现翻译功能
- [ ] 实现对话功能
- [ ] 添加错误处理和用户反馈

#### AILabPage 更新

参考 [SYSTEM_FEATURE_COMPLETION_CHECK.md](./SYSTEM_FEATURE_COMPLETION_CHECK.md) 中的集成示例。

---

### Day 9-10: 测试和文档（2 天）

#### 任务清单
- [ ] 单元测试
- [ ] 集成测试
- [ ] 用户测试
- [ ] 性能测试
- [ ] 编写使用文档
- [ ] 更新 README

---

## 📦 交付物

### 代码文件
1. ✅ AI 服务核心（5+ 文件）
2. ✅ AI 提供商（3+ 文件）
3. ✅ 提示词模板（3+ 文件）
4. ✅ 类型定义（1 文件）
5. ✅ 配置管理（1 文件）
6. ✅ 日志系统（1 文件）

### 文档
1. ✅ AI 服务使用指南
2. ✅ 提供商配置文档
3. ✅ API 参考文档
4. ✅ 故障排除指南

### 测试
1. ✅ 单元测试覆盖率 > 80%
2. ✅ 集成测试通过
3. ✅ 用户验收测试通过

---

## ✅ 验收标准

### 功能验收
- [ ] 课程生成功能正常
- [ ] 词汇增强功能正常
- [ ] 翻译功能正常
- [ ] 对话功能正常
- [ ] 所有 AI 提供商可切换
- [ ] 错误处理完善
- [ ] 用户体验流畅

### 代码质量
- [ ] 代码规范符合项目标准
- [ ] TypeScript 类型完整
- [ ] 无 ESLint 错误
- [ ] 注释完整清晰

### 性能指标
- [ ] API 响应时间 < 10s（常规请求）
- [ ] 流式响应延迟 < 1s
- [ ] 内存占用合理

---

**计划制定**: 2026-01-06  
**开始执行**: 立即  
**预计完成**: 2026-01-17
