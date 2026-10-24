/**
 * AI 核心服务
 * 提供课程生成、词汇增强、翻译、对话等 AI 功能
 */

import { BaseAIProvider } from './providers/baseProvider';
import { BackendAIProvider } from './providers/backendProvider';
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
 * 单次调用可安全承载的单词数量上限
 * 说明：超过该数量时，模型输出会因 maxTokens 限制被截断，导致 JSON 无法解析，
 *       因此必须拆分为“课程大纲 + 分批单词”的多次调用。
 */
const COURSE_SINGLE_CALL_MAX_WORDS = 40;

/**
 * 分批生成时每批请求的单词数量
 * 说明：20 个单词（含释义、音标、例句）约占 1500 输出 token，配合 4000 上限较安全。
 */
const COURSE_WORDS_PER_BATCH = 20;

/**
 * 课程生成所需的 JSON 结构说明（供提示词复用，避免多处各写一份）
 */
const COURSE_JSON_SCHEMA_HINT = `{
  "courseName": "Course name",
  "description": "Brief course description",
  "lessons": [
    {
      "lessonName": "Lesson 1 name",
      "description": "Lesson description",
      "words": [
        {
          "word": "example",
          "meaning": "a thing characteristic of its kind",
          "translation": "例子",
          "phonetic": "/ɪɡˈzæmpl/",
          "example": "This is an example sentence.",
          "exampleTranslation": "这是一个例句。",
          "partOfSpeech": "noun"
        }
      ]
    }
  ]
}`;

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
   *
   * 说明：
   *   批次D起固定使用后端代理提供商，上游供应商由 backend/.env 决定，
   *   前端不再根据 provider 字段选择不同直连实现。
   */
  private createProvider(): BaseAIProvider {
    return new BackendAIProvider(this.config);
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
   *
   * 说明：
   *   由后端代理提供商根据 /api/ai/config 的缓存状态判断；
   *   首次调用时状态未知，会乐观放行并在后台刷新。
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
        throw new AIError(
          'AI 密钥未配置。请在 backend/.env 中设置 AI_API_KEY 后重启后端服务。',
          AIErrorCode.API_KEY_MISSING
        );
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
        'AI 密钥未配置。请在 backend/.env 中设置 AI_API_KEY 后重启后端服务。',
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
   *
   * 说明：
   *   小规模课程走单次调用（有进度回调时使用流式）；规模较大时拆分为
   *   “课程大纲 + 分批单词”，避免单次输出被 maxTokens 截断导致 JSON 解析失败。
   */
  async generateCourse(
    request: CourseGenerationRequest,
    onProgress?: (content: string) => void
  ): Promise<CourseGenerationResponse> {
    const prompt = buildCourseGenerationPrompt(request);
    const systemPrompt = 'You are an expert English teacher who creates engaging typing practice courses. Always respond with valid JSON only.';
    const totalWords = request.lessonCount * request.wordsPerLesson;

    try {
      // 大规模课程：分批生成，彻底避开输出截断
      if (totalWords > COURSE_SINGLE_CALL_MAX_WORDS) {
        return await this.generateCourseInBatches(
          request,
          onProgress,
        );
      }

      let content = '';

      if (onProgress) {
        // 流式生成：逐段累加，确保最终 content 是完整模型输出
        await this.stream(
          prompt,
          (chunk) => {
            content += chunk;
            onProgress(content);
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
   * 大批量课程生成（主题驱动）
   *
   * 说明：
   *   把主题/难度/补充说明拼成“源素材”，复用统一的分批生成流程。
   */
  private async generateCourseInBatches(
    request: CourseGenerationRequest,
    onProgress?: (content: string) => void
  ): Promise<CourseGenerationResponse> {
    // 组装源素材文本：主题、难度与补充要求都是模型需要的上下文
    const sourceLines: string[] = [
      `Topic: ${request.topic}`,
      `Difficulty level: ${request.level}`,
    ];
    if (request.style) sourceLines.push(`Teaching style: ${request.style}`);
    if (request.notes) sourceLines.push(`Additional notes: ${request.notes}`);

    return await this.generateCourseFromSource(
      sourceLines.join('\n'),
      request.lessonCount,
      request.wordsPerLesson,
      request.topic,
      onProgress
    );
  }

  /**
   * 基于任意源文本分批生成课程
   *
   * 流程：
   *   1) 先请求“课程大纲”，只返回课程名、简介与每课标题/说明；
   *   2) 再按课、按批请求单词，每批不超过 COURSE_WORDS_PER_BATCH 个；
   *   3) 合并为完整的 CourseGenerationResponse。
   *
   * @param sourceText 源素材（主题描述、音频转写或翻译后的英文）
   * @param lessonCount 课程数量
   * @param wordsPerLesson 每课单词数
   * @param fallbackCourseName 大纲未返回课程名时使用的兜底名称
   * @param onProgress 进度回调：每次合并后回传当前已生成内容的 JSON 字符串
   */
  private async generateCourseFromSource(
    sourceText: string,
    lessonCount: number,
    wordsPerLesson: number,
    fallbackCourseName: string,
    onProgress?: (content: string) => void,
    focus: 'word' | 'phrase' = 'word'
  ): Promise<CourseGenerationResponse> {
    const systemPrompt = 'You are an expert English teacher. Always respond with valid JSON only.';
    const contentLabel = focus === 'phrase' ? 'English phrases and collocations' : 'English vocabulary words';
    const contentExample = focus === 'phrase' ? 'check in' : 'reservation';
    const contentMeaning = focus === 'phrase' ? 'to register at a hotel or airport' : 'an arrangement to keep something for someone';

    // 源素材过长时截断：批次请求会重复携带，避免请求体膨胀
    const trimmedSource = sourceText.length > 6000 ? `${sourceText.slice(0, 6000)}\n...(truncated)` : sourceText;

    // 1) 课程大纲：只要求课程名、简介与每课标题，输出量小且稳定
    const outlinePrompt = `
You are designing an English typing practice course focused on ${contentLabel}. Do not switch to another content type.

**Source material:**
${trimmedSource}

**Plan requirements:**
- Create exactly ${lessonCount} lessons
- Lesson names must be short, specific and ordered by difficulty

Return JSON only with this schema (no words in this step):
{
  "courseName": "Course name",
  "description": "Brief course description",
  "lessons": [
    { "lessonName": "Lesson 1 name", "description": "Lesson description" }
  ]
}
`.trim();

    const outlineRaw = await this.call(outlinePrompt, systemPrompt, {
      temperature: 0.5,
      maxTokens: 1500
    });
    const outline = this.parseJSONResponse(outlineRaw) as {
      courseName?: string;
      description?: string;
      lessons?: Array<{ lessonName?: string; description?: string }>;
    };

    // 大纲异常时兜底：按序号生成课程标题，保证后续仍可继续
    const outlineLessons = Array.isArray(outline.lessons) && outline.lessons.length
      ? outline.lessons.slice(0, lessonCount)
      : Array.from({ length: lessonCount }, (_, index) => ({
          lessonName: `Lesson ${index + 1}`,
          description: '',
        }));

    const courseName = String(outline.courseName || fallbackCourseName || 'AI 生成课程').trim();
    const lessons: CourseGenerationResponse['lessons'] = [];

    // 2) 逐课、逐批生成单词：每批输出量可控，不会触发截断
    for (let lessonIndex = 0; lessonIndex < outlineLessons.length; lessonIndex += 1) {
      const lessonMeta = outlineLessons[lessonIndex];
      const lessonName = String(lessonMeta.lessonName || `Lesson ${lessonIndex + 1}`).trim();
      const lessonDescription = String(lessonMeta.description || '').trim();
      const words: WordEntry[] = [];
      let remaining = wordsPerLesson;

      while (remaining > 0) {
        // 本批实际请求数量：不超过批次上限
        const batchCount = Math.min(remaining, COURSE_WORDS_PER_BATCH);

        const wordsPrompt = `
You are writing ONE lesson of an English typing practice course.

**Source material:**
${trimmedSource}

**Course:** ${courseName}
**Lesson:** ${lessonName} — ${lessonDescription}

**Task:** Provide exactly ${batchCount} ${contentLabel} for this lesson. Each item must be a natural ${focus === 'phrase' ? 'multi-word expression or collocation; put the complete phrase in the word field' : 'single vocabulary word'}.
Items must be relevant to the source material and ordered from easier to harder.
Skip words that are already generated for this lesson.

Return JSON only:
{
  "words": [
    {
      "word": "${contentExample}",
      "meaning": "${contentMeaning}",
      "translation": "例子",
      "phonetic": "/ɪɡˈzæmpl/",
      "example": "This is an example sentence.",
      "exampleTranslation": "这是一个例句。",
      "partOfSpeech": "noun"
    }
  ]
}
`.trim();

        const wordsRaw = await this.call(wordsPrompt, systemPrompt, {
          temperature: 0.6,
          maxTokens: 4000
        });
        const parsed = this.parseJSONResponse(wordsRaw) as { words?: WordEntry[] };
        const batchWords = Array.isArray(parsed.words) ? parsed.words : [];

        // 过滤空词与重复词，避免同一课出现重复条目
        for (const word of batchWords) {
          const normalized = String(word?.word || '').trim();
          if (!normalized) continue
          const duplicated = words.some(
            (existing) => String(existing.word || '').trim().toLowerCase() === normalized.toLowerCase()
          )
          if (!duplicated) words.push(word)
        }

        remaining -= batchCount;

        // 模型返回数量不足时提前退出，避免死循环
        if (batchWords.length === 0) break;
      }

      lessons.push({
        lessonName,
        description: lessonDescription,
        words: words.slice(0, wordsPerLesson),
      });

      // 回传当前进度：调用方仅用于展示/日志，不参与解析
      if (onProgress) onProgress(JSON.stringify({ courseName, description: outline.description || '', lessons }));
    }

    // 3) 合并结果
    return {
      courseName,
      description: String(outline.description || 'AI 生成课程').trim(),
      lessons,
    };
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
        maxTokens: 4000
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
   *
   * 说明：
   *   - 小规模课程直接单次生成，提示词内置完整 JSON 结构，避免模型自造字段；
   *   - 大规模课程走分批生成，避免输出被截断。
   */
  async generateCourseFromAudio(
    transcription: string,
    lessonCount: number = 5,
    wordsPerLesson: number = 10,
    focus: 'word' | 'phrase' = 'word'
  ): Promise<CourseGenerationResponse> {
    const systemPrompt = 'You are an expert English teacher. Always respond with valid JSON only.';
    const totalWords = lessonCount * wordsPerLesson;

    try {
      // 大规模课程：分批生成
      if (totalWords > COURSE_SINGLE_CALL_MAX_WORDS) {
        return await this.generateCourseFromSource(
          transcription,
          lessonCount,
          wordsPerLesson,
          'AI 生成课程',
          undefined,
          focus
        );
      }

      // 小规模课程：单次生成，显式给出 JSON 结构
      const prompt = `
Based on the following source text, create an English typing practice course focused on ${focus === 'phrase' ? 'natural multi-word phrases and collocations' : 'single vocabulary words'}. Do not return full sentences or unrelated content.

**Transcription:**
${transcription}

**Requirements:**
- Extract ${focus === 'phrase' ? 'natural phrases and collocations (not isolated words)' : 'key single vocabulary words'} from the source text
- For phrase focus, put the complete multi-word phrase in the schema word field, such as check in; never return a single word
- Create exactly ${lessonCount} lessons with exactly ${wordsPerLesson} ${focus === 'phrase' ? 'phrases' : 'words'} each
- Provide complete word information (meaning, phonetic, example, translation)
- Organize words by theme or difficulty

Return JSON only with this schema:
${COURSE_JSON_SCHEMA_HINT}
`.trim();

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
      maxTokens: 5000
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
