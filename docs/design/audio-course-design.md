# 音频建课功能设计文档

## 1. 背景 & 目标
### 背景
当前课程体系来源：手工建课 / JSON 导入 / AI 建课（文本驱动）/ TTS 生成句子音频。用户新增需求：通过“音频建课”直接上传一段或多段语音，自动生成课程：提取字幕(ASR)、分句、翻译、词汇与音标、并支持现有的“听写模式”和“听力练习”。
特别强调：本方案“原音导入”严格复用上传的原始音频，不使用 TTS 作为主播放源；仅在个别场景下可选用 TTS（例如缺失短片段的临时补齐），但默认与推荐均为“原音 + 时间戳定位播放”。

### 目标
- 一键从本地音频文件生成课程基础内容（句子+时间戳）。
- 支持按标点和最长时长自动分句，并可交互调整。
- 生成中文翻译，并可重试/局部更新。
- AI 自动提取核心词汇，生成音标和中文释义，支持混合型课程结构（句子 + 单词）。
- 播放与练习模块复用现有 Shadowing/Playlist 组件，不破坏现有逻辑。
- 音频片段不再逐句单独文件保存，使用“单文件 + 时间片段”模式，提高存储与缓存效率（播放严格使用原音频按时间戳定位播放，不替换为 TTS）。

### 范围
- 前端：新增“音频建课”按钮与向导（Wizard）。
- ASR：基于现有 `public/sherpa` WASM 资源，调用本地模型。无需后端服务。
- AI：使用现有调用（与 AI 建课/翻译同样的客户端逻辑）统一处理翻译与词汇提取。

### 不做事项
- 不实现高级波形编辑（只做基础分句预览与合并/拆分）。
- 不支持同时上传多个音频批量处理（第一阶段单文件）。
- 不做服务端集中存储（仍在本地 IndexedDB / 文件系统）。

## 2. 用户角色 & 典型流程
1. 用户点击“音频建课”按钮。
2. 弹出向导：上传 `.mp3/.wav` → 选择语言 & 模型 → 开始识别。
3. ASR 完成后展示初步的句子列表（带时间戳）。
4. 用户设置分句参数（最大句子字符数、最大持续时间 ms；自动重新分割）。
5. 用户手动微调：合并选中相邻句子 / 拆分（按光标处）/ 删除无效片段。
6. 用户执行“翻译全部”或对单句重新翻译。
7. 用户点击“生成词汇”，AI 返回词汇列表（音标/释义），可勾选保存。
8. 用户填写课程元信息（标题默认=音频文件名，tags、difficulty）。
9. 点击“保存课程” → 持久化为一门课程，lesson 指向该音频 + 句子列表 + 词汇。
10. 回到课程列表，可对该课程使用“听写模式”“听力练习”。

## 3. 数据模型调整
### 现有结构 (完整)
```ts
// 核心词汇条目
export interface WordEntry {
  id: string;
  word: string;
  meaning?: string;           // English definition
  translation?: string;       // Chinese definition
  example?: string;
  exampleTranslation?: string; // Chinese example translation
  partOfSpeech?: string;      // e.g., 'n.', 'v.', 'adj.'
  phonetic?: string;          // e.g., '/həˈləʊ/'
  mastery: number;            // 0-100
  lastReviewed?: string;
  nextReview?: string;
  audioUrl?: string;
}

// 练习模式
export type PracticeMode = 'dictation' | 'follow' | 'translation' | 'imitation';

// 句子结构
export interface Sentence {
  id?: number | string;
  en: string;
  zh: string;
  keywords?: {
    word: string;
    phonetic?: string;
    meaning?: string;
  }[];
  audioUrl?: string;
  labels?: string[]; // e.g., ['重点句','难点句','范文句']
  notes?: string;    // 教学备注
  // 兼容旧数据：旧版本可能使用布尔 map
  modes?: { dictation?: boolean; followRead?: boolean; translation?: boolean; imitation?: boolean };
}

// 课时可用字段能力标记
export interface LessonFields {
  phonetic?: boolean;     // 是否包含音标
  example?: boolean;      // 是否包含例句或扩展示例
  translation?: boolean;  // 是否包含整段或句子翻译
}

// 课时结构
export interface Lesson {
  id: string;
  content: string;             // 原始文本或词汇串
  contentTranslation?: string; // 中文对照文本
  words?: WordEntry[];         // 若为词汇型课程
  sentences?: Sentence[];      // 句子级结构
  language: 'zh' | 'en';
  length: number;              // content length
  source?: string;
  // 新版模式列表（优先）
  modesEnabled?: PracticeMode[];
  // 旧版兼容（仅读取不再写入）
  modesEnabledLegacy?: { dictation?: boolean; followRead?: boolean; translation?: boolean; imitation?: boolean };
  // 可用字段标记（渲染/生成解耦）
  fields?: LessonFields;
}

// 课程统计
export interface CourseStats {
  practiceCount: number;
  avgAccuracy: number;
  avgWpm: number;
  lastPracticed?: string;
  progress?: number;           // 0-100
  completedLessons?: string[]; // 已完成课时 ID 列表
  lastLessonId?: string;       // 最近练习课时 ID
  // 可选：句子层级成就
  sentencesPerfect?: number;
  sentencesHigh?: number;
  sentencesNeedsReview?: number;
}

// 课程结构
export interface Course {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  type: 'text' | 'words' | 'mixed';
  lessons: Lesson[];
  createdAt: string;
  updatedAt: string;
  stats?: CourseStats;
  source?: string;
}

// 导入结果
export interface ImportResult {
  ok: boolean;
  errors: string[];
  course?: Course;
}
```

### 新增结构
```ts
interface AudioMeta {
  sourceType: 'uploaded'; // 未来可扩展 'recorded' 等
  originalFileName: string;
  originalFileUrl: string;  // 本地存储路径或 Blob URL 持久化引用
  durationMs: number;
  waveformCache?: number[]; // 可选：抽样后的波形数据（压缩）
  transcriptionModel: string; // 所用 ASR 模型标识
  // 预留多轨/多语言音轨（可选）
  tracks?: {
    language: string;
    offsetMs?: number; // 该轨相对主轨的偏移
  }[];
}

interface SegmentItem {
  id: string;
  text: string;        // 英文原文
  translation?: string; // 中文翻译
  startMs: number;
  endMs: number;
  conf?: number;       // ASR 置信度
  audioUrl?: string;   // 可选：若生成了独立切片缓存
  generated?: boolean; // 兼容旧语义：是否为后续拆分/合并生成
  // 新增：来源标记，便于仅重跑 ASR 或保留用户编辑
  source?: 'asr' | 'user_edited' | 'ai_refined';
}
```

### 课程类型扩展
现有 `course.type: 'text' | 'words' | 'mixed'`。
- 建议新增 `'audio'`：专指“原音导入/时间戳播放”的课程类型；同时保留 `'mixed'` 兼容历史。
- 上传音频后默认设置为 `'audio'`；如用户同时选择并保存词汇，可转为 `'mixed'`。
- 若用户只保留句子不选词汇且无词汇卡片，可保存为 `'audio'`（或按需降级为 `'text'`，以产品策略为准）。

## 4. 模块划分
| 模块 | 说明 | 新建/复用 |
| ---- | ---- | -------- |
| AudioCourseWizard | UI向导组件（多步骤） | 新建 |
| asrService.ts | 封装 Sherpa WASM 调用、返回字幕结果 | 新建 |
| segmentation.ts | 分句算法（按标点 / 时长 / 字数） | 新建 |
| translationService.ts | 复用现有翻译逻辑（批量 + 单句） | 复用/轻改 |
| vocabularyExtractor.ts | 使用 AI prompt 提取词汇与音标 | 新建 |
| audioPlayback.ts | 基于原音频 + start/end 的时间戳定位播放控制（Web Audio 封装） | 新建 |
| audioSource.ts | 定义统一音频源接口并提供实现（TTS/原音） | 新建 |
| courseStore.ts | 保存新增字段（Lesson.audio, Lesson.segments） | 轻改 |
| ShadowingModal / PlaylistPlayer | 判断若 item 无独立 audioUrl，则按时间戳定位播放 | 轻改 |
| taskManager.ts / audioCourseJob | 后台异步任务调度（队列、进度、取消、恢复） | 新建 |

## 5. 关键流程设计
### 5.1 上传与存储
- 使用 `<input type="file" accept="audio/*">` 获取文件。
- 读取 duration (`AudioContext.decodeAudioData` 或 `<audio>` metadata)。
- 保存原文件：
  - Electron 环境：写入 `data/audio/<courseId>/<lessonId>.ext`。
  - 浏览器纯前端：IndexedDB + Blob URL（本项目似为 Electron + 前端，可优先采用文件系统 API）。
 - 设计约束：后续所有播放/朗读均基于该“原音频”按时间戳定位播放；不将其替换为 TTS 文件。
 - 导入限制：文件大小 < 70MB，时长 < 60 分钟；上传界面明确提示并在选择文件后进行校验，不符合则阻止继续。

### 5.2 ASR 字幕提取
- 使用 `public/sherpa` 中 WASM 资源加载模型（选择 tiny 或更大）。
- 处理：
  1. 初始化模型（异步单例）。
  2. 逐块（chunk）解码音频 PCM（利用现有 `pcm-processor.js`）。
  3. 获得词级或短句级结果（Sherpa 原始输出 → 标准化中间格式）。

- 标准化中间格式（与具体 ASR 引擎解耦）：
```ts
// asrService 负责适配 Sherpa/Whisper 等原始结构为该格式
interface NormalizedToken {
  word: string;
  start: number; // ms
  end: number;   // ms
  conf?: number;
}
```

### 5.3 初步分句
- 输入：顺序 token 列表（text + 时间戳）。
- 算法：
```pseudo
currentSegment = []
startTime = token.start
for token in tokens:
  append token
  if token.text endsWith 标点 OR len(segmentText) > maxChars OR (token.end - startTime) > maxDuration:
      finalize segment(startTime, token.end)
      reset
最后若有残余则 finalize
合并过短 (< minChars 或 < minDuration) 的段与下一段
```
- 标点集合：`.?!。？！；，,`（逗号是否切分可配置）。
- 提供重新分句：用户调整参数重新运行上面算法，保留已经手工编辑的标记（手工编辑段标记为 `generated=false`，重新分句时不覆盖手工修改除非用户选择“全部重置”）。
- 语义边界增强（可选）：
  - 引入“软边界/强制合并”标记（如引号未闭合、连接词 however/but 触发合并）。
  - UI 支持“禁止在此处切分”的手工标记（保存在 SegmentItem.source='user_edited' 并带边界锁）。
  - 默认：逗号不切分（`splitOnComma=false`），可在设置中开启。

### 5.4 翻译
- 批量：传所有 `text` 列表到翻译服务，返回数组对应 `translation`。
- 单句重试：仅传该句，再覆盖对应字段。
- 缓存策略：基于请求指纹与本地缓存避免重复调用。
  - Key：`sha256(text + modelVersion + lang)`；存储 `result, timestamp, modelVersion`。
  - 存储：IndexedDB；TTL 默认 30 天；容量达到阈值时按 LRU 淘汰。
  - 幂等性：失败自动重试（指数退避），超出次数仅标注失败不阻塞保存。

### 5.5 词汇提取与音标生成
#### Prompt 设计（英文示例）：
```
You are an English teaching assistant. Given the following sentences:
[1] ...
[2] ...
Return a JSON array of objects: {"word": "...", "phonetic": "...", "meaning_zh": "..."}.
Rules:
- Extract medium-frequency useful words (exclude very common words: a, the, is, to, and, of).
- Include proper nouns if educational.
- Deduplicate.
- Phonetic in IPA.
- Limit total to <= N words (configurable, e.g. 60).
```
- 返回后清洗：去重、补 ID、建立 `fromSentences`（通过包含判断）。
- 存入 `lesson.words`。
- 提升提取质量（可选）：
  - Prompt 加入“跨句出现频次优先”“按主题聚类后选代表词”。
  - 后处理结合 TF-IDF/频次统计进行排序，再截断至 N 个。

### 5.6 保存课程
- 创建 `Course`：`title = audioFileName`（去扩展名），默认 `difficulty='custom'`，`type='mixed'`。
- Lesson：
  - `audio`: 元信息。
  - `segments`: 分句结果。
  - `words`: 可选词汇。
  - `content`: 可存合并全文（segments 拼接）作为全文检索索引；`length`=全文长度。

## 6. 播放实现策略
### 6.0 播放抽象（AudioSource Provider）
为提高内聚性与可测试性，播放组件通过统一的音频源接口获取可播放对象：
```ts
export interface AudioSource {
  // 返回可播放对象：推荐返回 AudioBuffer 或自定义句段句柄
  getForSegment(seg: SegmentItem): Promise<AudioBuffer | string>;
  // 课程级预加载：可解码原音频、建立索引等
  preload(courseId: string, lessonId: string): Promise<void>;
  // 生命周期：释放缓存/解码后的 buffer
  dispose?(): void;
}

// 实现
// 1) TtsAudioSource：复用既有每句文件
// 2) OriginalAudioSource：基于单一原音频 + 时间戳定位
```
注：优先返回 `AudioBuffer` 以避免 Blob URL 生命周期管理问题；如保留 URL，需要在组件层统一 `revokeObjectURL` 与缓存策略。
### 6.1 原音播放与组件适配（与 TTS 的差异）
现有实现通常依赖每句 `audioUrl`（多为 TTS 生成）。在新架构中：
- 播放组件依赖 `AudioSource` 注入进行解耦；课程为 `'audio'` 或 `segment.audioUrl` 为空时，默认注入 `OriginalAudioSource`；否则注入 `TtsAudioSource`。
- 若 `segment.audioUrl` 为空，运行时加载课程对应的“原始音频”文件，并按该段的 `startMs/endMs` 时间戳进行播放定位与控制；不对音频做物理切割或生成句子级别文件（必要时可使用内存中的播放窗口或虚拟 URL，仍指向同一源文件）。
- 新增 `audioPlayback.ts` 提供基于时间戳的播放控制接口，封装 Web Audio/HTMLAudioElement，确保精确到毫秒级。
- 跟原 TTS 差异：
  - TTS：每句独立文件，加载与缓存以“文件”为主。
  - 原音：单文件按时间范围定位播放，加载与缓存以“解码后的大 buffer + 段索引”为主。
  - 优势：减少存储碎片、提升一致性；劣势：大文件初次解码耗时较长，需要懒加载与缓存策略。

### 6.2 听力练习 PlaylistPlayer
构建 playlistItems 时映射（优先使用原音按时间戳定位播放）：
```ts
segments.map(seg => ({
  text: seg.text,
  translation: seg.translation,
  audioUrl: seg.audioUrl || lazyResolver(courseId, lessonId, seg) // 原音按时间戳定位播放
}))
```
`lazyResolver` 在播放开始时确保生成 URL。
（在提供 `AudioBuffer` 的实现中，`lazyResolver` 可改为调用 `AudioSource.getForSegment` 返回 `AudioBuffer` 并由播放器直接调度。）

### 6.3 听写模式逻辑适配
- 与原“听写”逻辑一致，输入框比对 `text`；播放源改为“原音按时间戳定位播放”。
- 若某段定位精度受限（如模型时间戳不准），可提供“容差 ms”与“回放偏移校准”参数。
- 可选启用自动暂停（当前段播放结束后等待用户输入完成再继续）。

### 6.4 朗读/辅助播放与 TTS 的关系
- 设计目标：朗读使用“原音”；TTS 仅作为辅助（例如教学环节需要慢速/清晰发音时，用户显式点击“生成 TTS 辅助音频”）。
- UI 上将“辅助 TTS”标识为非默认选项，避免混淆：默认所有播放均为原音。

## 7. 错误与边界处理
| 场景 | 处理策略 |
| ---- | -------- |
| ASR 初始化失败 | 显示错误并允许重试或更换模型 |
| 音频过长 (> 60min) | 提示分段处理（未来迭代），当前硬性限制上传时拒绝 |
| 分句结果为空 | 提示重新调整参数（减小 maxChars / maxDuration）或更换模型 |
| 翻译失败单句 | 允许局部重试，不阻塞保存 |
| 词汇提取返回格式异常 | 回退解析，显示原 JSON 供用户手动编辑/忽略 |
| 播放定位失败 | 回退整段播放（直接从原音频的 startMs 到 endMs 播放，不生成任何新文件） |
| Blob URL 未释放造成内存增长 | 统一封装 URL 创建与销毁，或改为使用 AudioBuffer |

## 8. 性能策略
- ASR & 分句异步 + 进度条（处理块数 / 总块数）。
- 缓存：
  - 已解码 AudioBuffer（限 1 个并在窗口关闭释放）。
  - 翻译结果 Map。
  - 词汇提取 prompt 结果本地存储（可复用）。
- 延迟准备片段播放上下文（不生成新文件）：仅在用户首次播放该句时创建时间窗口或缓冲指针，避免一次性大量处理。
- 大文件（>10min）建议分步：处理前 5min 预览，其余后台继续。
- 流式 ASR + 渐进式分句：将音频按 30s 分块，块内解码→ASR→标准化→分句后即渲染，UI 显示“已处理 X/Y 分钟”。
- 预加载策略：当前段±1 段高优；其余懒加载。支持在 `preload()` 中预先解码主音频与建立段索引。

## 9. 安全与鲁棒性
- 文件类型白名单：`audio/mpeg`, `audio/wav`, `audio/x-wav`, `audio/mp4`。
- 最大文件大小：≤ 70MB。
- 最大时长：≤ 60 分钟。
- 取消操作：用户可在 ASR 过程中点击“取消”，释放 AudioContext 与 Worker。
- 存储清理：未完成的向导不保存文件，关闭时清理临时文件夹。
- MIME 二次校验：读取文件头 magic bytes 校验（MP3: `FF FB`/`FF F3`/`FF F2`，WAV: `RIFF....WAVE`，MP4/M4A: `ftyp` box），拒绝不匹配的伪装文件。
- 向导状态持久化：每步完成后暂存到 IndexedDB/localStorage（含文件引用句柄、ASR 中间结果）；重启时提供“继续未完成建课”。

## 10. 实施阶段计划
| 阶段 | 里程碑 | 验证 |
| ---- | ------ | ---- |
| P1 | 上传 + ASR + 基础分句 + 保存课程（无翻译/词汇） | 课程列表出现新课程，播放正常 |
| P2 | 分句参数 UI + 合并/拆分操作 | 分句刷新不丢失手工编辑 |
| P3 | 翻译集成 + 单句重试 | 翻译字段写入 segments |
| P4 | 词汇提取 + 课程混合类型 | words 面板展示正确词汇 |
| P5 | 听写模式 & 播放优化（延迟播放准备 + AudioSource 抽象） | 播放性能稳定，无明显卡顿 |
| P6 | 性能与错误覆盖（长音频、失败重试） | 测试用例通过（≥5 类异常） |
| P7 | 流式 ASR + 渐进式渲染 | >10min 音频体验可用，进度可视化 |

## 11. 与现有代码的改动点
- `CourseManager.tsx`：新增“音频建课”按钮，打开 `AudioCourseWizard`。
- `services/courseStore.ts`：允许保存 `audio` 与 `segments` 字段。
- `ShadowingModal.tsx`：检测 `segment.startMs` / `endMs` 时调用新播放逻辑（按时间戳定位播放）。
- 新增：`services/asrService.ts`, `utils/segmentation.ts`, `services/vocabularyExtractor.ts`, `services/audio/audioPlayback.ts`。

## 16. 与“原来 TTS 驱动课程”的具体差异对比
| 维度 | 原 TTS 驱动 | 原音导入方案 |
| --- | --- | --- |
| 音频来源 | 每句 TTS 文件 | 单一原音频 + 时间片段 |
| 存储结构 | 句子级文件 URL | Lesson.audio + segments[start/endMs] |
| 加载策略 | 多文件并发下载 | 单文件解码 + 时间戳定位（延迟准备/缓存） |
| 分句依据 | 文本句子 | ASR + 标点 +最长时长（可重分句） |
| 朗读/播放 | TTS 可控语速音色 | 原音真实语速与韵律（更贴近真实听力） |
| 错误容忍 | 文件缺失可重 TTS | 时间戳不准需校准（偏移与容差） |
| 听写支持 | 直接逐句文件播放 | 原音按时间戳定位播放，输入比对同原逻辑 |
| 维护成本 | 存储碎片多 | 存储集中，需优化解码与内存 |

## 12. 后续扩展可能
- 多文件批量 → 单课程多课时（每个文件一个 lesson）。
- 波形+拖拽微调句子边界。
- 背景批量 TTS 生成音标朗读，与原 TTS 系统融合。
- 增加自动错词高亮（词汇与句子对齐）。

## 13. Prompt 示例（词汇）
```text
You are an assistant helping Chinese learners of English.
Extract important vocabulary from the sentences below.
Return JSON ONLY: [{"word":"","phonetic":"","meaning_zh":"","sourceSentenceIds":["..."]}]
Exclude articles, auxiliary verbs, extremely common words.
Limit to 50 items.
Sentences:
1. "..."
2. "..."
```

## 14. 关键接口草案
```ts
// ASR
asrService.transcribe(fileOrUrl: string, opts: { model: string }): Promise<RawToken[]>;
// 分句
segmentTokens(tokens: RawToken[], config: { maxChars: number; maxDurationMs: number; splitOnComma: boolean }): SegmentItem[];
// 翻译
translateBatch(texts: string[]): Promise<string[]>;
// 词汇
extractVocabulary(sentences: SegmentItem[], limit: number): Promise<WordItem[]>;
// 播放（时间戳定位）
// 兼容：保留 URL 方案，但推荐返回 AudioBuffer 以避免 URL 生命周期问题
getSegmentAudioUrl(originalAudioUrl: string, startMs: number, endMs: number): Promise<string>;
getSegmentAudioBuffer(originalAudioUrl: string, startMs: number, endMs: number): Promise<AudioBuffer>;

// AudioSource 抽象
export interface AudioSource {
  getForSegment(seg: SegmentItem): Promise<AudioBuffer | string>;
  preload(courseId: string, lessonId: string): Promise<void>;
  dispose?(): void;
}
```

## 15. 验收标准 (Definition of Done)
- 能上传 ≤10min 标准语音并生成课程，播放流畅。
- 分句界面：参数调整后可重新生成，手工合并/拆分可行。
- 全量翻译成功率 >95%，失败可重试。
- 词汇提取结果去重，含音标和中文释义，数量在配置范围内。
- 听写模式与听力练习对新生成课程无崩溃；延迟播放准备成功率 >98%。
- 不影响现有课程的加载与练习功能。

---
如需立即进入 P1 实现，可继续提出需求，我将拆分任务并开始编码。

## 17. 任务管理系统设计（补充）
音频建课涉及耗时的多阶段处理（解码、ASR、分句、翻译、词汇提取、持久化），需要可靠的后台任务管理以避免阻塞 UI、支持进度可视化、允许中途取消/恢复。

### 17.1 任务生命周期与状态机
任务类型：`audio-course-import`。

状态枚举（`JobState`）：
1. `queued` 排队等待（达到并发上限时）
2. `preparing` 读取文件头/校验大小/建立临时存储目录
3. `probing` 轻量探测（可解析性 + 获取时长）
4. `asr_init` 加载模型与 WASM（Sherpa 初始化）
5. `asr_running` 流式识别（可分块处理，每个块 30s）
6. `segmentation` 初步分句与参数应用（maxChars/maxDurationMs/splitOnComma）
7. `translation_pending` （用户触发后进入）批量翻译中
8. `vocabulary_pending` （用户触发后进入）词汇提取中
9. `persisting` 写入 Course/Lesson/Segments/AudioMeta 数据
10. `completed` 成功结束（包含生成课程 ID）
11. `failed` 终止（存储 errorList）
12. `cancelled` 用户取消（清理临时资源）

子阶段进度：`progress` 使用 0~1 浮点；在 `asr_running` 按“已处理毫秒 / 总时长毫秒”实时更新；其他阶段按权重或完成即跃迁。

### 17.2 数据模型
```ts
interface TaskStep {
  name: string;            // 与状态对应或更细粒度: chunk-1, chunk-2
  state: 'pending'|'running'|'done'|'error'|'skipped';
  progress?: number;       // 0-1（可选）
  startedAt?: string;
  endedAt?: string;
  error?: string;
}

interface AudioCourseJobConfig {
  language: 'en'|'zh';
  segmentation: { maxChars: number; maxDurationMs: number; splitOnComma: boolean };
  modelVariant?: 'tiny'|'small'|'medium';  // 未来扩展
}

interface AudioCourseJobResult {
  courseId?: string;
  lessonId?: string;
  segmentsCount?: number;
  durationMs?: number;
}

interface AudioCourseJobRecord {
  id: string;
  type: 'audio-course-import';
  fileName: string;
  fileSize: number;
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
  state: JobState;          // 上述枚举
  progress: number;         // 总体进度（聚合）
  steps: TaskStep[];        // 分块 & 阶段
  config: AudioCourseJobConfig;
  result?: AudioCourseJobResult;
  errorList: string[];
  cancelRequested?: boolean; // 取消意图标志
  log: { ts: string; level: 'info'|'warn'|'error'; msg: string }[]; // 环路日志
}
```

持久化：IndexedDB (`jobs` store)。定期清理已完成且超过 N 天（默认 7 天）。失败/取消保留最近 M 条（默认 10）。

### 17.3 API 接口
```ts
// 创建任务
createAudioCourseJob(opts: { file: File; language: 'en'|'zh'; segmentation: { maxChars: number; maxDurationMs: number; splitOnComma: boolean } }): AudioCourseJobRecord;

// 订阅进度
subscribe(jobId: string, cb: (job: AudioCourseJobRecord) => void): () => void; // 返回取消订阅

// 查询单个/全部
getJob(jobId: string): AudioCourseJobRecord | undefined;
listJobs(filter?: { state?: JobState[] }): AudioCourseJobRecord[];

// 取消任务（软取消：标记 + 在安全点释放资源）
cancelJob(jobId: string): void;

// 更新分句参数（允许在 segmentation 状态重新计算）
updateSegmentation(jobId: string, params: { maxChars?: number; maxDurationMs?: number; splitOnComma?: boolean }): void;

// 重试失败的后续阶段（翻译 / 词汇）
retryStep(jobId: string, stepName: string): void;

// 应用启动时恢复未完成任务（probing/asr_running/segmentation 等）
resumeOrphanJobs(): Promise<void>;
```

### 17.4 并发与资源控制
- 最大并发：`ASR` 阶段仅允许运行 1 个重任务（防止内存/CPU 抖动）。其余任务排队 `queued`。
- 轻量阶段（translation/vocabulary）可并发（<=2），并有速率限制避免频繁调用外部 AI。
- 内存监控：若 `performance.memory` 可用，超过阈值暂停排队任务启动。
- 模型复用：Sherpa 模型单例加载；多个任务串行共享，避免重复初始化。

### 17.5 取消策略
`cancelRequested` 标志设置后：
1. 若在 `queued` / `preparing`：立即标记为 `cancelled`。
2. 若在 `asr_running`：停止后续块处理，释放 AudioContext、关闭文件流、等待当前块安全点后标记。
3. 清理临时目录（未完成课程不落盘）。
4. UI 订阅者接收最终状态并停止刷新。

### 17.6 进度计算
总体 `progress` = 各阶段权重求和：
| 阶段 | 权重 | 计算方式 |
|------|------|----------|
| preparing + probing | 0.05 | 完成即达到 0.05 |
| asr_init | 0.05 | 完成即加 0.05 |
| asr_running | 0.55 | 已处理毫秒 / 总毫秒 * 0.55 |
| segmentation | 0.10 | 完成即加 0.10 |
| translation_pending* | 0.15 | 已翻译句数 / 总句数 * 0.15 |
| vocabulary_pending* | 0.05 | 已处理词汇 / 目标词汇 * 0.05 |
| persisting | 0.05 | 完成即加 0.05 |
（* 未触发则权重归 0，最终进度不满 1 但进入 completed）

### 17.7 错误与重试策略
- 允许对 `translation_pending` / `vocabulary_pending` 单步重试，不影响已完成 ASR 与分句。
- ASR 块级错误：记录块号与错误，若可继续则跳过该块并在结果中标记 `segment.source='asr_error'`。
- 超过连续失败阈值（默认 3）整体标记 `failed`。

### 17.8 日志与审计
`log` 列表供调试面板展示：
```
[12:01:02.123] preparing: file size 23.4MB
[12:01:03.004] probing: duration=601234ms
[12:01:04.555] asr_init: model=tiny
[12:01:06.000] asr_running: chunk 1/20 done (45s)
... 
```
支持导出纯文本（用户反馈问题时使用）。

### 17.9 UI 集成
- “任务中心”中每个任务卡片显示：标题（文件名）、当前状态、进度条、已识别时长、剩余估算、取消按钮。
- 点击展开显示步骤表（状态、耗时、错误）。
- 如果在 `segmentation` 状态，允许调参数→调用 `updateSegmentation`。

### 17.10 恢复逻辑
`resumeOrphanJobs()`：
1. 读取 IndexedDB 中 state ∈ { queued, preparing, probing, asr_init, asr_running, segmentation } 的记录。
2. 若文件引用/临时目录仍存在，则从最后一个已完成块继续；否则标记 `failed`（文件丢失）。
3. Sherpa 模型若未加载则先执行 `asr_init` 再进入 `asr_running`。

### 17.11 安全点 (Safe Points)
ASR 分块循环中：每处理完一个块检查 `cancelRequested` 或内存/CPU 负载（可选）；在安全点执行中断与资源释放。

### 17.12 与现有代码差异总结
当前实现（`AudioCourseWizard.tsx`）仅：创建任务并返回 `jobId`；缺少：
- 明确的分阶段状态机与权重进度。
- 订阅/取消/重试 API。
- IndexedDB 持久化与恢复策略。
- 并发/资源控制与模型复用策略。
- 细粒度日志与步骤记载。
本补充设计解决上述空白，为后续扩展（流式渐进、批量、多模型）打基础。

### 17.13 DoD 增补
新增验收点：
- 任务状态切换完整、无卡死；取消后资源清理（AudioContext/WASM）确认。
- 重启应用后未完成任务自动恢复或标记失败。
- 翻译/词汇阶段失败可单独重试且不影响已生成的段。
- 日志与进度在 UI 实时刷新（≤500ms 延迟）。
- 并发限制生效：第二个大文件上传时进入 queued。

