# 课程结构详解

## 1. 课程生成方式概述

Lexitype Academy系统支持多种课程生成方式，每种方式生成的课程结构和声音来源有所不同。主要包括：

1. **音频导入生成课程**：从用户上传的音频文件生成完整课程
2. **AI实验室生成课程**：通过AI模型生成定制化课程内容
3. **PEP教材导入生成课程**：从PEP教材文本生成课程
4. **补救课程生成**：基于用户学习错误生成针对性复习课程

## 2. 音频导入生成课程

### 2.1 课程生成流程

音频导入生成课程的完整流程如下：

```
audio文件 → 音频元数据分析 → 语音识别（ASR）→ 分句处理 → 自动翻译 → 词汇提取 → 课程生成
```

### 2.2 核心流程说明

1. **音频元数据分析**：分析音频文件的时长、格式等基本信息
2. **语音识别（ASR）**：将音频转换为文本，并生成带时间戳的词级标记
3. **分句处理**：根据配置将文本分割为多个句子片段
4. **自动翻译**：调用AI服务将英文句子翻译成中文
5. **词汇提取**：从文本中提取核心词汇，并生成词汇卡片信息
6. **课程生成**：将所有处理结果组织成完整的课程结构

### 2.3 课程结构层次

#### 2.3.1 顶层课程结构（Course）

```typescript
interface Course {
  id: string;               // 课程ID
  title: string;            // 课程标题
  description?: string;     // 课程描述
  tags: string[];           // 课程标签（自动添加 ['audio', 'import']）
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom'; // 难度
  type: CourseType;         // 类型：'mixed'（含词汇）或 'audio'（纯音频）
  lessons: Lesson[];        // 包含的课时（音频课程通常只有1个课时）
  createdAt: string;        // 创建时间
  updatedAt: string;        // 更新时间
  stats?: CourseStats;      // 学习统计数据
  source?: string;          // 来源：'AudioCourseWizard'
}
```

#### 2.3.2 课时结构（Lesson）

```typescript
interface Lesson {
  id: string;               // 课时ID
  content: string;          // 完整转录文本（分段合并）
  contentTranslation?: string; // 完整中文翻译（分段合并）
  language: 'en' | 'zh';    // 课程语言
  length: number;           // 内容长度
  source: 'audio-import';   // 来源标识
  audio: AudioMeta;         // 音频元数据
  segments: SegmentItem[];  // 音频分段信息
  sentences: Sentence[];    // 句子级数据
  words: WordEntry[];       // 提取的核心词汇
  modesEnabled: PracticeMode[]; // 启用的练习模式
  fields: LessonFields;     // 字段配置（翻译、音标等）
}
```

#### 2.3.3 音频元数据（AudioMeta）

```typescript
interface AudioMeta {
  sourceType: 'uploaded';   // 音频来源类型
  originalFileName: string; // 原始文件名
  originalFileUrl: string;  // 保存后的音频URL
  durationMs: number;       // 音频时长（毫秒）
  transcriptionModel: string; // 转录模型
}
```

#### 2.3.4 音频分段（SegmentItem）

```typescript
interface SegmentItem {
  id: string;               // 分段ID
  text: string;             // 分段文本
  translation: string;      // 分段翻译
  startMs: number;          // 开始时间（毫秒）
  endMs: number;            // 结束时间（毫秒）
  conf?: number;            // 置信度
  audioUrl?: string;        // 分段独立音频URL
  source?: 'asr' | 'user_edited' | 'ai_refined'; // 来源
}
```

#### 2.3.5 句子结构（Sentence）

```typescript
interface Sentence {
  id: string | number;      // 句子ID
  en: string;               // 英文文本
  zh: string;               // 中文翻译
  keywords?: {              // 句子中的关键词
    word: string;           // 关键词
    phonetic?: string;      // 音标
    meaning?: string;       // 释义
  }[];
  audioUrl?: string;        // 句子音频URL
  startMs?: number;         // 开始时间（毫秒）
  endMs?: number;           // 结束时间（毫秒）
}
```

#### 2.3.6 词汇结构（WordEntry）

```typescript
interface WordEntry {
  id: string;               // 词汇ID
  word: string;             // 英文单词
  meaning?: string;         // 英文释义
  translation?: string;     // 中文翻译
  example?: string;         // 英文例句
  exampleTranslation?: string; // 例句中文翻译
  partOfSpeech?: string;    // 词性（如 'n.', 'v.', 'adj.'）
  phonetic?: string;        // 音标（如 '/həˈləʊ/'）
  mastery: number;          // 掌握程度（0-100）
}
```

### 2.4 音频导入生成的课程特点

#### 2.4.1 多维度数据整合

音频导入生成的课程整合了以下多维度数据：

| 数据类型 | 包含内容 | 用途 |
|---------|---------|------|
| 音频数据 | 原始音频文件、时长、URL | 播放、语音评估 |
| 文本数据 | 转录文本、翻译文本 | 展示、练习内容 |
| 时间数据 | 单词时间戳、句子时间戳 | 逐词高亮、分段播放 |
| 词汇数据 | 单词、音标、释义、例句 | 词汇学习、练习 |
| 元数据 | 来源、创建时间、难度 | 课程管理、推荐 |

#### 2.4.2 自动生成的学习内容

1. **自动翻译**：所有英文句子自动生成中文翻译
2. **词汇提取**：自动从文本中提取核心词汇，包含：
   - 单词拼写
   - 音标（IPA格式）
   - 中文释义
   - 英文例句及翻译
   - 词性
3. **练习模式**：默认启用听写（dictation）和跟读（follow）模式

### 2.5 声音来源

- **原始音频文件**：用户上传的完整音频文件，保存在 `data/audio/` 目录下
- **音频分段**：根据句子时间戳从原始音频中截取的片段，或通过TTS生成的独立音频文件
- **词汇音频**：通过TTS服务为提取的词汇生成的音频文件

## 3. AI实验室生成课程

### 3.1 课程生成流程

AI实验室生成课程的完整流程如下：

```
用户输入 → 构建AI提示词 → 调用AI模型 → 解析AI响应 → 生成课程结构 → 保存课程
```

### 3.2 核心流程说明

1. **用户输入**：用户提供主题、难度、风格等课程生成参数
2. **构建AI提示词**：根据用户输入构建AI模型的提示词
3. **调用AI模型**：向AI服务发送请求，获取生成的课程内容
4. **解析AI响应**：解析AI返回的JSON数据，提取课程信息
5. **生成课程结构**：将解析结果组织成标准的Course和Lesson对象
6. **保存课程**：将生成的课程保存到本地数据库

### 3.3 课程结构特点

1. **灵活的课程类型**：支持生成文本课程、词汇课程、混合课程
2. **定制化内容**：根据用户输入的主题、难度、风格生成个性化课程
3. **丰富的词汇信息**：自动生成单词的音标、释义、例句等
4. **多练习模式支持**：默认启用听写和跟读模式

### 3.4 课时结构

AI生成的课程课时结构如下：

```typescript
interface Lesson {
  id: string;               // 课时ID
  content: string;          // 完整文本内容
  contentTranslation?: string; // 完整中文翻译
  sentences: Sentence[];    // 句子级数据
  language: 'en' | 'zh';    // 课程语言
  length: number;           // 内容长度
  words: WordEntry[];       // 提取的核心词汇
  source: 'AI Generated';   // 来源标识
  modesEnabled: PracticeMode[]; // 启用的练习模式
}
```

### 3.5 声音来源

- **句子音频**：通过TTS服务为生成的句子生成音频文件
- **词汇音频**：通过TTS服务为生成的词汇生成音频文件

### 3.6 核心代码示例

```typescript
// AI生成课程保存逻辑
const newCourse: Course = {
  id: Date.now().toString(),
  title: courseTitle,
  description: courseDesc,
  tags: courseTags,
  difficulty: 'custom',
  type: courseType,
  lessons: (result.lessons || []).map((l: any, i: number) => ({
    id: `lesson-${Date.now()}-${i}`,
    content: l.content,
    contentTranslation: l.contentTranslation, // Pass through translation
    sentences: l.sentences, // Pass through sentences structure
    language: l.language || 'en',
    length: l.content.length,
    words: l.words, // Pass through words if present
    source: 'AI Generated'
  })),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  stats: {
    practiceCount: 0,
    avgAccuracy: 0,
    avgWpm: 0
  },
  source: 'AI Generated'
};
```

## 4. PEP教材导入生成课程

### 4.1 课程生成流程

PEP教材导入生成课程的完整流程如下：

```
PEP文本 → 教材解析 → 章节提取 → 内容处理 → 课程生成
```

### 4.2 课程结构特点

1. **结构化课程体系**：按照教材章节生成课程结构
2. **标准教材内容**：基于PEP教材的标准化学习内容
3. **丰富的词汇和句子**：自动从教材中提取词汇和句子

### 4.3 课时结构

PEP导入的课程课时结构与AI生成的课程类似，但包含更多教材特定的元数据。

### 4.4 声音来源

- **句子音频**：通过TTS服务为提取的句子生成音频文件
- **词汇音频**：通过TTS服务为提取的词汇生成音频文件

## 5. 补救课程生成

### 5.1 课程生成流程

补救课程生成的完整流程如下：

```
学习数据 → 错误分析 → 薄弱点识别 → 内容生成 → 课程构建
```

### 5.2 课程结构特点

1. **针对性内容**：基于用户学习错误生成的针对性复习内容
2. **聚焦薄弱点**：专注于用户掌握不佳的单词和句子
3. **个性化复习计划**：根据SM-2算法生成个性化复习安排

### 5.3 课时结构

补救课程的课时结构聚焦于薄弱知识点，内容更加精炼。

### 5.4 声音来源

- **句子音频**：通过TTS服务为生成的句子生成音频文件
- **词汇音频**：通过TTS服务为生成的词汇生成音频文件

## 6. 课程数据流向

### 6.1 通用数据流向

所有课程生成方式的最终数据流向一致：

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  输入源         │     │  处理中间数据   │     │  最终课程数据   │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│  - 音频文件     │     │  - 转录文本     │     │  - Course       │
│  - 用户输入     │ →   │  - 词级标记     │ →   │  - Lesson       │
│  - 教材文本     │     │  - 分段结果     │     │  - Sentence     │
│  - 学习数据     │     │  - 词汇草稿     │     │  - WordEntry    │
└─────────────────┘     └─────────────────┘     │  - AudioMeta    │
                                               │  - SegmentItem  │
                                               └─────────────────┘
```

### 6.2 核心数据关联

1. **Course → Lesson[]**：一个课程包含多个课时
2. **Lesson → Sentence[]**：一个课时包含多个句子
3. **Lesson → WordEntry[]**：一个课时包含多个核心词汇
4. **Lesson → AudioMeta**：音频课程的课时关联音频元数据
5. **Lesson → SegmentItem[]**：音频课程的课时包含多个音频分段
6. **SegmentItem ↔ Sentence**：音频分段与句子一一对应（仅音频课程）
7. **Sentence → keywords[]**：句子包含多个关键词

## 7. 各种课程生成方式对比

| 生成方式 | 课程类型 | 声音来源 | 课程特点 | 适用场景 |
|---------|---------|---------|---------|---------|
| 音频导入 | 音频课程 | 原始音频 + TTS | 保留原始音频完整性，生成丰富学习内容 | 处理已有音频资源 |
| AI生成 | 文本/词汇/混合 | TTS | 定制化内容，灵活多样 | 生成个性化学习内容 |
| PEP导入 | 文本/词汇/混合 | TTS | 标准化教材内容 | 学习PEP教材内容 |
| 补救课程 | 词汇/混合 | TTS | 针对性复习内容 | 强化薄弱知识点 |

## 8. 课程使用场景

### 8.1 通用学习流程

所有课程类型的学习流程基本一致：

1. **课程浏览**：用户在课程列表中查看可用课程
2. **课程学习**：
   - 浏览课程内容
   - 学习词汇（查看词汇卡片、学习音标和例句）
   - 听音频（完整播放或分段播放）
3. **练习模式**：
   - 听写练习：根据音频写出文本
   - 跟读练习：模仿音频进行朗读
   - 翻译练习：根据英文写出中文或反之
   - 模仿练习：根据音频进行模仿，获取发音评估

### 8.2 技术实现要点

1. **音频播放**：支持完整播放和分段播放
2. **逐词高亮**：根据时间戳实现音频与文本的同步高亮
3. **语音评估**：对用户跟读进行发音评估
4. **词汇管理**：记录词汇掌握程度，生成个性化复习计划
5. **TTS集成**：为生成的文本和词汇提供音频支持

## 9. 各生成方式核心代码示例

### 9.1 音频课程生成核心逻辑

```typescript
// 从音频草稿生成正式课程
async function persistAudioCourse(options: PersistCourseOptions): Promise<Course> {
  // 1. 生成课程和课时ID
  const courseId = randomId('course');
  const lessonId = randomId('lesson');
  
  // 2. 保存音频文件并获取URL
  const audioUrl = await persistAudioFile(file, courseId, lessonId);
  
  // 3. 构建音频元数据
  const audioMeta: AudioMeta = {
    sourceType: 'uploaded',
    originalFileName: draft.fileName,
    originalFileUrl: audioUrl,
    durationMs: draft.durationMs,
    transcriptionModel: 'sherpa-onnx',
  };

  // 4. 构建句子数据
  const sentences: Sentence[] = normalizedSegments.map((seg, idx) => ({
    id: seg.id || idx,
    en: seg.text,
    zh: seg.translation || '',
    audioUrl: seg.audioUrl,
  }));

  // 5. 构建课时对象
  const lesson: Lesson = {
    id: lessonId,
    content: normalizedSegments.map((seg) => seg.text).join('\n'),
    contentTranslation: normalizedSegments.map((seg) => seg.translation).filter(Boolean).join('\n'),
    language,
    length: content.length,
    source: 'audio-import',
    audio: audioMeta,
    segments: normalizedSegments,
    sentences,
    words,
    modesEnabled: ['dictation', 'follow'],
    fields: { translation: !!contentTranslation, phonetic: false, example: false },
  };

  // 6. 构建课程对象
  const course: Course = {
    id: courseId,
    title: title.trim() || draft.fileName.replace(/\.[^/.]+$/, ''),
    description: description?.trim() || '音频导入课程',
    tags: tags.length ? tags : ['audio', 'import'],
    difficulty,
    type: words.length > 0 ? 'mixed' : 'audio',
    lessons: [lesson],
    createdAt: now,
    updatedAt: now,
    stats: { practiceCount: 0, avgAccuracy: 0, avgWpm: 0 },
    source: 'AudioCourseWizard',
  };

  // 7. 保存课程到仓库
  await saveCourse(course);
  return course;
}
```

### 9.2 AI生成课程核心逻辑

```typescript
// AI生成课程主函数
export const generateAdvancedCourse = async (
  options: AdvancedCourseOptions,
  onProgress?: (chunk: string) => void
): Promise<any> => {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('请先在设置中配置 AI API Key。');
  }

  // 查找请求模式对应的插件
  const plugin = pluginRegistry.getAIPlugin(options.mode);
  if (!plugin) {
    throw new Error(`未找到 AI 模式 '${options.mode}'。`);
  }

  // 使用插件构建提示词
  let prompt = '';
  if (config.customPrompts && config.customPrompts[options.mode]) {
    prompt = fillTemplate(config.customPrompts[options.mode], options);
  } else {
    prompt = plugin.buildPrompt(options);
  }
  
  prompt += `\nDo not include markdown formatting like code blocks. Just the raw JSON.`;

  // 调用AI服务
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: 'You are a helpful assistant that generates typing practice content.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      stream: !!onProgress
    })
  });

  // 处理AI响应...
  // 返回生成的课程数据
};
```

## 10. 课程扩展可能性

### 10.1 现有扩展点

1. **自定义分句规则**：调整分句的长度和方式
2. **词汇提取配置**：调整提取的词汇数量和类型
3. **AI提示词定制**：自定义AI生成课程的提示词模板
4. **练习模式扩展**：添加更多练习类型
5. **TTS引擎配置**：更换或配置不同的TTS引擎

### 10.2 未来扩展方向

1. **多语言支持**：支持更多语言的课程生成
2. **主题识别**：自动识别课程主题，生成更精准的词汇和练习
3. **难度自适应**：根据文本复杂度自动调整课程难度
4. **知识点关联**：将课程与现有知识点体系关联
5. **协作课程编辑**：支持多人协作编辑课程
6. **课程共享功能**：支持导出和导入课程

## 11. 总结

Lexitype Academy系统支持多种课程生成方式，每种方式都生成符合标准结构的Course和Lesson对象。课程结构设计遵循了模块化原则，各部分数据既相互关联又相对独立，便于后续的扩展和优化。

- **音频导入课程**：保留原始音频完整性，通过AI处理生成丰富的学习辅助内容
- **AI生成课程**：根据用户输入生成定制化课程内容，支持多种课程类型
- **PEP教材导入课程**：从教材文本生成标准化课程内容
- **补救课程**：基于用户学习错误生成针对性复习课程

所有课程生成方式都支持丰富的练习模式和音频资源，为用户提供了全方位的语言学习体验。课程结构的设计既满足了当前的学习需求，又为未来的扩展预留了空间，使得系统能够持续适应新的学习场景和技术发展。