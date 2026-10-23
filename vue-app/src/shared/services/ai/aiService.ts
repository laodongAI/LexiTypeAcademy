/**
 * AI 核心服务
 * 提供课程生成、词汇增强、翻译、对话等 AI 功能
 */

import { BaseAIProvider } from './providers/baseProvider';
import { QwenProvider } from './providers/qwenProvider';
import { loadAIConfig, saveAIConfig } from './aiConfig';
import { 
  buildCourseGenerationPrompt, 
  buildVocabularyCoursePrompt 
} from './prompts/courseGeneration';
import { buildVocabularyEnrichPrompt } from './prompts/vocabularyEnrich';
import { buildTranslationPrompt } from './prompts/translation';
import { buildTeachingFeedbackPrompt } from './prompts/teachingFeedback';
import {
  buildSeriesListPrompt,
  buildTextbookListPrompt,
  buildParseTextbookUnitsPrompt,
  buildGenerateTextbookWordsPrompt,
  buildGenerateTextbookSentencesPrompt,
  buildGenerateTextbookPhonicsPrompt,
  buildGenerateTextbookPassagePrompt,
  buildGenerateTextbookGrammarPrompt,
} from './prompts/textbookGuidance';
import type {
  AIConfig,
  AIMessage,
  AIOptions,
  AIResponse,
  CourseGenerationRequest,
  CourseGenerationResponse,
  WordEntry,
  VocabularyEnrichRequest,
  TranslationRequest,
  TeachingFeedbackRequest,
  TeachingFeedbackResponse
} from './aiTypes';
import { AIError, AIErrorCode } from './aiTypes';

/**
 * AI 服务类
 */
export class AIService {
  private provider: BaseAIProvider;
  private config: AIConfig;

  constructor(config?: AIConfig) {
    this.config = config || loadAIConfig();
    this.provider = this.createProvider();
  }

  /**
   * 创建 AI 提供商实例
   */
  private createProvider(): BaseAIProvider {
    const providers: Record<string, any> = {
      qwen: QwenProvider
      // 后续添加其他提供商
      // openai: OpenAIProvider,
      // volcengine: VolcengineProvider,
    };

    const ProviderClass = providers[this.config.provider];
    if (!ProviderClass) {
      throw new AIError(
        `不支持的提供商: ${this.config.provider}`,
        AIErrorCode.INVALID_CONFIG
      );
    }

    return new ProviderClass(this.config);
  }

  /**
   * 更新配置
   */
  updateConfig(config: AIConfig): void {
    this.config = config;
    this.provider = this.createProvider();
    saveAIConfig(config);
  }

  /**
   * 获取当前配置
   */
  getConfig(): AIConfig {
    return { ...this.config };
  }

  /**
   * 检查是否已配置
   */
  isConfigured(): boolean {
    return this.provider.isConfigured();
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.isConfigured()) {
        throw new AIError('请先配置 API Key', AIErrorCode.API_KEY_MISSING);
      }
      return await this.provider.testConnection();
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  /**
   * 通用 AI 调用
   */
  async call(
    prompt: string,
    systemPrompt?: string,
    options?: AIOptions
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new AIError(
        '请先配置 AI API Key。进入设置页面或在浏览器控制台配置。',
        AIErrorCode.API_KEY_MISSING
      );
    }

    const messages: AIMessage[] = [];

    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }

    messages.push({ role: 'user', content: prompt });

    const response = await this.provider.callAPI(messages, options);
    return response.content;
  }

  /**
   * 生成教学反馈（AI 教学引擎增强层）
   */
  async generateTeachingFeedback(request: TeachingFeedbackRequest): Promise<TeachingFeedbackResponse> {
    const prompt = buildTeachingFeedbackPrompt(request);
    const systemPrompt = 'You are an expert English teacher. Always respond with valid JSON only.';

    try {
      const content = await this.call(prompt, systemPrompt, {
        temperature: 0.4,
        maxTokens: 1200
      });

      const parsed = this.parseJSONResponse(content);
      return parsed as TeachingFeedbackResponse;
    } catch (error: any) {
      throw new AIError(
        `教学反馈生成失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
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
  async generateCourse(
    request: CourseGenerationRequest,
    onProgress?: (content: string) => void
  ): Promise<CourseGenerationResponse> {
    const prompt = buildCourseGenerationPrompt(request);
    const systemPrompt = 'You are an expert English teacher who creates engaging typing practice courses. Always respond with valid JSON only.';

    try {
      let content = '';

      if (onProgress) {
        // 流式生成
        await this.stream(
          prompt,
          (chunk) => {
            content = chunk;
            onProgress(chunk);
          },
          systemPrompt,
          { temperature: 0.7, maxTokens: 4000 }
        );
      } else {
        // 非流式生成
        content = await this.call(prompt, systemPrompt, {
          temperature: 0.7,
          maxTokens: 4000
        });
      }

      // 解析 JSON 响应
      const parsed = this.parseJSONResponse(content);
      return parsed as CourseGenerationResponse;
    } catch (error: any) {
      throw new AIError(
        `课程生成失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 从单词列表生成词汇课程
   */
  async generateVocabularyCourse(
    words: string[],
    level: string = 'intermediate'
  ): Promise<WordEntry[]> {
    const prompt = buildVocabularyCoursePrompt(words, level);
    const systemPrompt = 'You are an English linguist who provides accurate word information. Always respond with valid JSON only.';

    try {
      const content = await this.call(prompt, systemPrompt, {
        temperature: 0.3,
        maxTokens: 3000
      });

      const parsed = this.parseJSONResponse(content);
      return parsed.words as WordEntry[];
    } catch (error: any) {
      throw new AIError(
        `词汇课程生成失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 词汇增强
   */
  async enrichVocabulary(request: VocabularyEnrichRequest): Promise<WordEntry[]> {
    const { words } = request;
    const prompt = buildVocabularyEnrichPrompt(words);
    const systemPrompt = 'You are an English linguist who provides accurate phonetics, definitions, and examples. Always respond with valid JSON only.';

    try {
      const content = await this.call(prompt, systemPrompt, {
        temperature: 0.3,
        maxTokens: 3000
      });

      const parsed = this.parseJSONResponse(content);
      return parsed.words as WordEntry[];
    } catch (error: any) {
      throw new AIError(
        `词汇增强失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 翻译
   */
  async translate(request: TranslationRequest): Promise<string> {
    const { text, sourceLang = 'auto', targetLang = 'zh' } = request;
    const prompt = buildTranslationPrompt(text, sourceLang, targetLang);
    const systemPrompt = 'You are a precise translator. Always respond with valid JSON only.';

    try {
      const content = await this.call(prompt, systemPrompt, {
        temperature: 0.2,
        maxTokens: 2000
      });

      const parsed = this.parseJSONResponse(content);
      return parsed.translation as string;
    } catch (error: any) {
      throw new AIError(
        `翻译失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 对话
   */
  async chat(messages: AIMessage[], options?: AIOptions): Promise<string> {
    try {
      const response = await this.provider.callAPI(messages, {
        temperature: 0.8,
        maxTokens: 1000,
        ...options
      });

      return response.content;
    } catch (error: any) {
      throw new AIError(
        `对话失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 从音频转录生成课程
   */
  async generateCourseFromAudio(
    transcription: string,
    lessonCount: number = 5,
    wordsPerLesson: number = 10
  ): Promise<CourseGenerationResponse> {
    const prompt = `
Based on the following audio transcription, create an English typing practice course.

**Transcription:**
${transcription}

**Requirements:**
- Extract key vocabulary from the transcription
- Create ${lessonCount} lessons with ${wordsPerLesson} words each
- Provide complete word information (meaning, phonetic, example, translation)
- Organize words by theme or difficulty

Return the course in the same JSON format as the course generation API.
`.trim();

    const systemPrompt = 'You are an expert English teacher. Always respond with valid JSON only.';

    try {
      const content = await this.call(prompt, systemPrompt, {
        temperature: 0.7,
        maxTokens: 4000
      });

      const parsed = this.parseJSONResponse(content);
      return parsed as CourseGenerationResponse;
    } catch (error: any) {
      throw new AIError(
        `从音频生成课程失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 从教材文本生成课程
   */
  async generateCourseFromTextbook(
    content: string,
    extractWords: boolean = true
  ): Promise<CourseGenerationResponse | WordEntry[]> {
    const prompt = extractWords
      ? `
Extract English vocabulary from the following textbook content and provide detailed information for each word.

**Content:**
${content}

Return as JSON array of words with full details (word, meaning, translation, phonetic, example, exampleTranslation, partOfSpeech).
`.trim()
      : `
Create a typing practice course based on the following textbook content.

**Content:**
${content}

Organize the vocabulary into lessons with complete word information.
Return in the standard course JSON format.
`.trim();

    const systemPrompt = 'You are an expert English teacher. Always respond with valid JSON only.';

    try {
      const responseContent = await this.call(prompt, systemPrompt, {
        temperature: 0.5,
        maxTokens: 4000
      });

      const parsed = this.parseJSONResponse(responseContent);
      return extractWords ? (parsed as WordEntry[]) : (parsed as CourseGenerationResponse);
    } catch (error: any) {
      throw new AIError(
        `从教材生成课程失败: ${error.message}`,
        AIErrorCode.PROVIDER_ERROR,
        this.provider.name
      );
    }
  }

  /**
   * 教材引导：获取出版社下的教材系列列表
   */
  async fetchSeriesList(publisher: string): Promise<{ series: string[] }> {
    const prompt = buildSeriesListPrompt(publisher);
    const systemPrompt = 'You are an educational expert specializing in Chinese English textbook editions. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.2,
      maxTokens: 2000
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as { series: string[] };
  }

  /**
   * 教材引导：获取教材列表（按年级/学期）
   */
  async fetchTextbookList(
    publisher: string,
    series: string,
    grade?: string
  ): Promise<{ textbooks: Array<{ grade: string; semester: string; name: string }> }> {
    const prompt = buildTextbookListPrompt(publisher, series, grade);
    const systemPrompt = 'You are an educational expert. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.2,
      maxTokens: 2500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as { textbooks: Array<{ grade: string; semester: string; name: string }> };
  }

  /**
   * 教材引导：解析教材单元结构
   */
  async parseTextbookUnits(
    publisher: string,
    series: string,
    textbookName: string
  ): Promise<{ units: Array<{ unit_num: number; title: string; topics: string[] }> }> {
    const prompt = buildParseTextbookUnitsPrompt(publisher, series, textbookName);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.2,
      maxTokens: 3000
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as { units: Array<{ unit_num: number; title: string; topics: string[] }> };
  }

  /**
   * 教材引导：生成某个单元的词汇内容（核心/拓展词汇）
   */
  async generateTextbookWordsContent(
    textbookName: string,
    unitTitle: string,
    options: { coreCount?: number; extraCount?: number } = {}
  ): Promise<{
    core_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
    extra_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
  }> {
    const prompt = buildGenerateTextbookWordsPrompt(textbookName, unitTitle, options);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.4,
      maxTokens: 3500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as {
      core_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
      extra_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
    };
  }

  /**
   * 教材引导：生成课文/对话（按句子拆分）
   */
  async generateTextbookSentencesContent(
    textbookName: string,
    unitTitle: string
  ): Promise<{
    title?: string;
    sentences: Array<{ en: string; zh: string; keywords?: string[] }>;
  }> {
    const prompt = buildGenerateTextbookSentencesPrompt(textbookName, unitTitle);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 3500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as {
      title?: string;
      sentences: Array<{ en: string; zh: string; keywords?: string[] }>;
    };
  }

  /**
   * 教材引导：生成音标/发音练习（phonics）
   */
  async generateTextbookPhonicsContent(
    textbookName: string,
    unitTitle: string,
    options: { sampleWords?: string } = {}
  ): Promise<{
    phonics: Array<{
      target_sound: string;
      pronunciation: string;
      examples: Array<{ word: string; phonetic_breakdown: string }>;
      minimal_pairs?: Array<{ word1: string; word2: string; explanation?: string }>;
    }>;
  }> {
    const prompt = buildGenerateTextbookPhonicsPrompt(textbookName, unitTitle, options);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 3500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as {
      phonics: Array<{
        target_sound: string;
        pronunciation: string;
        examples: Array<{ word: string; phonetic_breakdown: string }>;
        minimal_pairs?: Array<{ word1: string; word2: string; explanation?: string }>;
      }>;
    };
  }

  /**
   * 教材引导：生成短文/阅读材料（按自然段拆分）
   */
  async generateTextbookPassageContent(
    textbookName: string,
    unitTitle: string
  ): Promise<{
    title?: string;
    paragraphs: Array<{ en: string; zh: string }>;
  }> {
    const prompt = buildGenerateTextbookPassagePrompt(textbookName, unitTitle);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 3500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as {
      title?: string;
      paragraphs: Array<{ en: string; zh: string }>;
    };
  }

  /**
   * 教材引导：生成语法点（解释 + 例句）
   */
  async generateTextbookGrammarContent(
    textbookName: string,
    unitTitle: string
  ): Promise<{
    points: Array<{
      name: string;
      explanation_zh: string;
      examples: Array<{ en: string; zh: string }>;
    }>;
  }> {
    const prompt = buildGenerateTextbookGrammarPrompt(textbookName, unitTitle);
    const systemPrompt = 'You are an educational expert specializing in ESL textbooks. Always respond with valid JSON only.';

    const content = await this.call(prompt, systemPrompt, {
      temperature: 0.3,
      maxTokens: 3500
    });

    const parsed = this.parseJSONResponse(content);
    return parsed as {
      points: Array<{
        name: string;
        explanation_zh: string;
        examples: Array<{ en: string; zh: string }>;
      }>;
    };
  }

  /**
   * 教材引导：对齐老版的统一入口（words/sentences/phonics）
   */
  async generateTextbookCourseContent(
    textbookName: string,
    unitTitle: string,
    type: 'words',
    options?: { coreCount?: number; extraCount?: number }
  ): Promise<{
    core_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
    extra_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
  }>;
  async generateTextbookCourseContent(
    textbookName: string,
    unitTitle: string,
    type: 'sentences'
  ): Promise<{
    title?: string;
    sentences: Array<{ en: string; zh: string; keywords?: string[] }>;
  }>;
  async generateTextbookCourseContent(
    textbookName: string,
    unitTitle: string,
    type: 'phonics',
    options?: { sampleWords?: string }
  ): Promise<{
    phonics: Array<{
      target_sound: string;
      pronunciation: string;
      examples: Array<{ word: string; phonetic_breakdown: string }>;
      minimal_pairs?: Array<{ word1: string; word2: string; explanation?: string }>;
    }>;
  }>;
  async generateTextbookCourseContent(
    textbookName: string,
    unitTitle: string,
    type: 'words' | 'sentences' | 'phonics',
    options: { coreCount?: number; extraCount?: number } | { sampleWords?: string } = {}
  ): Promise<
    | {
        core_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
        extra_words: Array<{ word: string; phonetic?: string; pos?: string; zh?: string; example?: string }>;
      }
    | { title?: string; sentences: Array<{ en: string; zh: string; keywords?: string[] }> }
    | {
        phonics: Array<{
          target_sound: string;
          pronunciation: string;
          examples: Array<{ word: string; phonetic_breakdown: string }>;
          minimal_pairs?: Array<{ word1: string; word2: string; explanation?: string }>;
        }>;
      }
  > {
    if (type === 'words') {
      return await this.generateTextbookWordsContent(textbookName, unitTitle, options as { coreCount?: number; extraCount?: number });
    }
    if (type === 'sentences') {
      return await this.generateTextbookSentencesContent(textbookName, unitTitle);
    }
    return await this.generateTextbookPhonicsContent(textbookName, unitTitle, options as { sampleWords?: string });
  }

  /**
   * 解析 JSON 响应（清理 markdown 代码块等）
   */
  private parseJSONResponse(content: string): any {
    try {
      // 移除可能的 markdown 代码块标记
      const cleaned = content
        .replace(/```json\s*/g, '')
        .replace(/```\s*/g, '')
        .trim();

      try {
        return JSON.parse(cleaned);
      } catch {
        // 兼容：尝试从文本中提取 JSON 对象/数组片段
        const objStart = cleaned.indexOf('{');
        const objEnd = cleaned.lastIndexOf('}');
        if (objStart !== -1 && objEnd !== -1 && objEnd > objStart) {
          const jsonStr = cleaned.substring(objStart, objEnd + 1);
          return JSON.parse(jsonStr);
        }

        const arrStart = cleaned.indexOf('[');
        const arrEnd = cleaned.lastIndexOf(']');
        if (arrStart !== -1 && arrEnd !== -1 && arrEnd > arrStart) {
          const jsonStr = cleaned.substring(arrStart, arrEnd + 1);
          return JSON.parse(jsonStr);
        }

        throw new Error('No JSON found');
      }
    } catch (error) {
      console.error('Failed to parse AI response:', content);
      throw new AIError(
        '无法解析 AI 响应',
        AIErrorCode.INVALID_RESPONSE
      );
    }
  }
}

/**
 * 单例实例
 */
let aiServiceInstance: AIService | null = null;

/**
 * 获取 AI 服务单例
 */
export function getAIService(): AIService {
  if (!aiServiceInstance) {
    aiServiceInstance = new AIService();
  }
  return aiServiceInstance;
}

/**
 * 重置 AI 服务单例（用于测试或重新配置）
 */
export function resetAIService(): void {
  aiServiceInstance = null;
}
