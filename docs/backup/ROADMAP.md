# 项目路线与功能任务清单

新项目名称（新版候选，突出英语学习与词汇记忆）:
英文候选:
1. LexiType Academy

中文候选:
1. 键语学苑

推荐组合（更聚焦“词汇 + 训练 + 教学”定位）:
英文: LexiType Academy
中文: 英语键航学院
理由: “Lexi” 直接联想词汇 (lexicon)；“Academy” 强调系统化训练；中文“键航”与既定飞机/航线游戏模式呼应，同时体现用键盘启程学习英语。

## 总体目标
将现有纯打字练习扩展为: 自定义课程 + 游戏化互动场景 + AI 驱动的自适应与语言学习（英文词汇与句子记忆）。

## 阶段划分
| 阶段 | 主题 | 目标 | 产出 | 优先级 |
|------|------|------|------|--------|
| P0 | 基线稳定 | 桌面版稳定运行 | 当前版本 | 已完成 |
| P1 | 自定义课程系统 | 用户可导入/管理练习文本与词汇 | 课程数据结构 + 导入界面 | 已完成 |
| P2 | 课程选择/筛选 UI | 高级模式中按分类 / 标签 / 难度选择文本 | 课程列表视图 + 搜索与标签 | 已完成 |
| P3 | 游戏场景扩展 | 新增地牢、农场、赛车、音游模式 | 7 种游戏模式 | 已完成 |
| P4 | AI 个性化与生成 | AI 生成多维词汇卡片（音标/释义/例句）；TTS 发音 | AI 接口 + 富文本卡片 | 已完成 |
| P5 | 学习/记忆机制 | 间隔重复 (Spaced Repetition) 与遗忘曲线权重 | 词条调度算法 + 复习队列 | 已完成 |
| P6 | 数据分析与统计图表 | WPM/准确率/词汇掌握度趋势图 | 图表页面 + 导出 CSV | 已完成 |
| P7 | 国际化与多语言 | 中/英界面 + 英文学习扩展 | i18n 资源 + 语言切换 | 已完成 |
| P8 | 插件与扩展架构 | 可增量添加新游戏模式/AI 模块 | 插件协议/加载机制 | 已完成 |
| P9 | 分发与性能优化 | 存储层升级(IndexedDB) / 资源缓存 / 懒加载 | 高性能存储 + 资源管理 | 已完成 |
| P10 | 英语情景教学与文章练习功能升级 | 新增句子级别的英语学习课程与多种练习模式 | 升级的课程数据结构与多样化练习模式 | 已完成 |

## 详细任务分解
### P1 自定义课程系统
1. 数据模型设计: `Course`, `Lesson`, `WordEntry`, `Tag`。
2. 存储层: electron-store 或 SQLite (若数据量增长)。
3. 导入格式支持: JSON / CSV；字段校验与错误报告。
4. 导入向导 UI: 拖拽文件 → 预览 → 去重与清洗 → 写入存储。
5. 文本分段策略: 自动分句、字数/长度阈值拆分。
6. 词汇列表模式: 单词 + 释义 + 例句；标记熟练度。
7. 安全与校验: 防 XSS（显示时转义）、最大文件大小限制、编码检测（UTF-8 / GBK）。

### P2 课程选择与高级练习
1. 过滤条件: 难度、标签、类型（词汇/句子/混合）。
2. 搜索: 关键字高亮匹配课程标题或文本片段。
3. 排序: 最近添加、练习次数、平均准确率、AI 推荐权重。
4. 快速预览: 悬浮卡片显示前 200 字或词汇统计。
5. 选择队列: 支持批量选择生成“今日任务”。
6. 进度标记: 完成率 + 上次练习时间。

### P3 游戏场景
1. 飞机航线模式: 字幕动态流式呈现 → 超时未输入扣“燃料”；正确提高“速度”。
2. Combo 键连击: 系统生成按键序列（如 ASDF-JKL;）→ 稳定无误差提高连击等级。
3. 单词挑战模式: 倒计时输入词汇；正确+时间奖励；错误记录入复习池。
4. 地牢勇士 (Dungeon Typer): [已完成] RPG 回合制战斗，拼写单词发动魔法攻击击败怪物。
5. 单词农场 (Word Farm): [已完成] 模拟经营，通过拼写单词进行播种、浇水和收割。
6. 极速赛车 (Typing Racer): [已完成] 竞速模式，输入单词加速和超车。
7. 指尖音符 (Rhythm Key): [已完成] 音乐节奏模式，跟随节拍输入单词。
8. 场景抽象接口: `GameMode` → `init`, `start`, `stop`, `renderOverlay`, `evaluateInput`。
9. 可扩展: 后续添加“陨石防御”模式（输入单词摧毁陨石）。
10. 声音与动画预留: 使用 WebAudio + CSS 动画；可关闭。

### P4 AI 个性化与生成
1. AI 抽象层: [已完成] 统一 `AIProvider` 接口（model, generateText, generateWordList, analyzeProgress）。
2. Prompt 模板: [已完成] 根据用户水平生成适合长度与词频的文本。
3. 富文本词汇生成: [已完成] AI 生成包含音标、中文释义、英文例句及翻译的完整词汇卡片。
4. 语音合成 (TTS): [已完成] 集成浏览器 SpeechSynthesis API，支持单词与例句朗读。
5. 错误分析: [已完成] 提取常错单词 → 生成复习集。
6. 英文例句生成: [已完成] 指定词汇列表 → 生成短句（CEFR B1/B2 控制）。
6. 安全策略: 请求去重缓存、响应长度限制、失败重试。
7. AI Lab v2 优化: [进行中]
  - 界面轻量化（减少边距、响应式栅格布局）。[已完成]
  - 统一高级生成面板：模式、难度(CEFR)、词数/课时、字段开关（音标/翻译/例句）。[已完成]
  - 支持多生成类型：词汇(Vocabulary) / 句子(Sentences) / 故事(Story) / 对话(Dialog) / 混合(Mixed)。[已完成]
  - 自适应提示：根据选择动态构造 Prompt，减少用户输入成本。[已完成]
  - 复习加速选项：自动混入“最近错误词”权重生成巩固课。[已完成]
  - 主题模板与风格选择（童话 / 科普 / 日常会话）。[已完成]

### P4+ AI 体验增强 (AI Experience Enhancement)
1. 流式反馈 UI: 优化长文本生成的等待体验，提供实时进度条或流式文本预览。
2. 多模型适配层: 兼容 OpenAI 格式接口，支持 Ollama 本地模型与 DeepSeek 等高性价比模型。
3. 交互式纠错: 引入“自由写作”模式，AI 对用户的自由输入进行语法纠错和润色。
4. 键位专项生成: 基于 N-gram 错误统计生成针对性字母组合训练词汇。

### P5 记忆与复习
1. Spaced Repetition 算法: 基于 SM-2/自定义权重（错误次数、间隔天数、掌握度）。
2. 复习调度队列: 每次启动生成今日复习任务列表。
3. 掌握度更新规则: 正确 +1、错误 -2（下限 0），AI 推荐可增加额外加权。
4. 遗忘曲线统计: 存储每次答题时间与结果 → 生成遗忘速度估计。
5. 复习反馈界面: 即时显示下次复习间隔。

### P6 数据分析与导出
1. 图表库选择: `chart.js` 或 `echarts`。
2. 指标: 日均 WPM、准确率、总练习时长、已掌握词数、复习完成率。
3. 趋势图: 7/30 天滑动窗口平滑曲线。
4. 导出: CSV（列：日期、WPM、Accuracy、WordsMastered、Errors）。
5. 数据加密（可选）: 用户选择加密本地数据库。

### P7 国际化
1. i18n 架构: 资源文件 `locales/en.json`, `locales/zh.json`。
2. 动态切换: 菜单或设置面板语言选择后刷新文案。
3. 文案抽取脚本: 扫描 TSX 提取硬编码字符串 → 生成 key 占位。
4. 英文学习增强: 显示单词词性、发音（可调用在线 API）。

### P8 插件与扩展
1. 插件目录结构: `plugins/<name>/manifest.json`。
2. 可扩展点: 新 GameMode、AIProvider、统计面板。
3. 沙箱执行（可选）: 限制插件访问仅暴露 API。

### P9 分发与性能优化
1. 存储层升级: [进行中] 引入 IndexedDB (Dexie.js) 替代 localStorage，支持海量词汇与课程存储。
2. 资源管理: 音频/TTS 缓存机制，避免重复请求。
3. 懒加载: 路由组件懒加载，减少首屏体积。
4. 虚拟列表: 针对长单词列表/课程列表实现虚拟滚动。
5. 体积优化: 评估迁移至 Tauri 或优化 Electron 构建体积。

### P10 英语情景教学与文章练习功能升级 (English Contextual Teaching & Article Practice)
1. 核心数据结构升级 (Core Data Structure):
   - [x] 升级 `Course` / `Lesson` 数据结构，支持句子级 (Sentence-based) 存储。
   - [x] 新增字段：`sentences` 数组，包含 `en` (英文), `zh` (中文翻译), `keywords` (关键词对象数组: word, phonetic, meaning)。
   - [x] 兼容性处理：保留对旧版纯文本课程的支持。

2. 教学模式组合 (Pedagogical Modes):
   - [x] **标准模式 (Standard)**: 显示原文、译文、关键词。
   - [x] **视译练习模式 (Sight Translation)**: 仅显示中文翻译 -> 用户输入英文 -> 校验并显示原文。训练中英思维转换。
   - [x] **听写模式 (Dictation)**: 隐藏原文和译文，仅播放音频（依赖 TTS），训练听力。
   - [x] **精抄模式 (Intensive Copying)**: 显示原文，隐藏译文，专注于拼写和输入精度。

3. 功能界面设计 (UI/UX Design):
   - [x] **视图设置面板 (View Settings)**:
     - [x] 布局切换：列表模式 (List View) vs 专注模式 (Focus Mode, 单句显示)。
     - [x] 预设切换：一键切换上述四种练习模式。
   - [x] **交互增强**:
     - [x] 关键词高亮显示（橙色）。
     - [x] 句子级 TTS 播放控制。

4. AI 提示词工程 (Prompt Engineering):
   - [x] 更新 `aiPlugins.ts` 中的 `text` (文章), `dialogue` (对话), `story` (故事) 插件 Prompt。
   - [x] 要求 AI 返回结构化 JSON 数据：包含句子列表、对应中文翻译、提取难点关键词（含音标释义）。

## 数据结构草案
```ts
interface Course { id: string; title: string; description?: string; tags: string[]; difficulty: 'beginner'|'intermediate'|'advanced'|'custom'; type: 'text'|'words'|'mixed'; lessons: LessonRef[]; createdAt: string; updatedAt: string; stats?: CourseStats; }
interface LessonRef { id: string; order: number; }
interface Lesson { id: string; content: string; words?: WordEntry[]; language: 'zh'|'en'; length: number; source?: string; }
interface WordEntry { id: string; word: string; meaning?: string; example?: string; mastery: number; lastReviewed?: string; nextReview?: string; }
interface CourseStats { practiceCount: number; avgAccuracy: number; avgWpm: number; lastPracticed?: string; }
```

## AI Prompt 策略与示例 (已实现)
基于当前插件架构，我们采用了结构化 Prompt 工程，强制 AI 返回严格的 JSON 格式以供前端解析。

### 1. 词汇生成 (Vocabulary Generator)
**目标**: 生成包含音标、释义、例句的富文本词汇卡片。
**Prompt 模板**:
```text
Create a vocabulary typing course about "{topic}".
Target CEFR level: {difficulty}. Target word count: {wordCount}. Style: {style}.
Blend these priority vocabulary words naturally: {priorityWords}.
Include fields: phonetic, translation, example, exampleTranslation.

Return ONLY a valid JSON object with this structure:
{
  "title": "Vocabulary: {topic}",
  "description": "Essential vocabulary for {topic}",
  "tags": ["{topic}", "Vocabulary", "AI"],
  "type": "words",
  "lessons": [
    {
      "content": "Lesson 1",
      "language": "en",
      "words": [
        {
          "word": "example",
          "meaning": "an instance serving to illustrate a rule",
          "translation": "例子",
          "partOfSpeech": "n.",
          "phonetic": "/ɪɡˈzɑːmpl/",
          "example": "This is a good example.",
          "exampleTranslation": "这是一个很好的例子。"
        }
      ]
    }
  ]
}
```

### 2. 文本/故事生成 (Text/Story Generator)
**目标**: 生成连贯的短文或故事，用于段落练习。
**Prompt 模板**:
```text
Create a {style} story about "{topic}".
Target CEFR level: {difficulty}.
Return ONLY a valid JSON object with this structure:
{
  "title": "{topic} Story",
  "description": "A {style} story generated by AI",
  "tags": ["{topic}", "Story", "AI"],
  "lessons": [
    {
      "title": "Chapter 1",
      "content": "The actual story content...",
      "language": "en"
    }
  ]
}
```

### 3. 纠错与复习 (Review & Correction)
**目标**: 针对用户错误词汇生成针对性练习。
**Prompt 模板**:
```text
Create a review course based on these error words: {weakWords}.
Generate 5 sentences. Each sentence must include at least one error word.
Highlight the error word in the sentence context.
Return JSON format compatible with 'sentences' mode.
```

## AI Prompt 优化方向 (Future)
1. **Few-Shot Learning (少样本提示)**: 在 Prompt 中预置 1-2 个高质量的 JSON 示例，提高 AI 生成格式的稳定性。
2. **Persona (角色设定)**: "You are an expert IELTS/TOEFL tutor..." 以获得更专业的词汇解释。
3. **Chain of Thought (思维链)**: 让 AI 先分析用户当前的弱点（如“用户经常混淆元音”），再生成针对性内容（需配合流式解析）。
4. **动态难度调整**: 将用户的 WPM 和准确率传入 Prompt，让 AI 自动调整生成句子的长度和复杂度（"User WPM is 30, keep sentences under 10 words"）。
5. **文化背景增强**: 请求 AI 在生成语言内容时附带相关的文化背景小贴士（Cultural Note）。

## 风险与缓解
| 风险 | 描述 | 缓解 |
|------|------|------|
| 数据膨胀 | 大量自定义课程导致 electron-store 性能下降 | 提前抽象存储接口，可切换 SQLite |
| AI 成本 | 高频调用生成内容成本过高 | 缓存结果 + 批量生成 + 限频 |
| 难度失衡 | 自适应调整不准确导致挫败 | 设最小/最大边界 + 手动覆盖选项 |
| 游戏复杂度 | 初期场景过多拖慢交付 | 先实现 1-2 核心场景 MVP |
| 用户数据丢失 | 文件写入失败或手动删除 | 定期自动备份导出 JSON |

## 优先级执行顺序 (推荐)
1. P1 自定义课程系统 (核心数据基座)
2. P2 课程选择/高级模式 UI
3. P3 游戏场景 MVP (飞机航线 + 单词挑战)
4. P5 记忆与复习机制（与词汇联动）
5. P4 AI 集成（在有稳定数据后更有价值）
6. P6 数据分析与导出
7. P7 国际化 + 英语学习增强
8. P8 插件架构（视社区或扩展需求而定）
9. P9 性能与分发优化

## 验收标准示例 (部分)
- 自定义课程导入: 选择文件后显示预览并至少校验必填字段，无崩溃；导入后可搜索。
- 飞机航线模式: 字幕流至少 30 秒，正确率实时显示，燃料降至 0 结束。
- 单词挑战模式: 倒计时与得分动态更新，错误词进入复习队列；复习队列出现下一轮练习。
- AI 生成句子: 用户输入词列表后 3 秒内返回 5 条句子；无敏感或不当内容。
- 间隔重复: 单词熟练度提升后下次复习间隔增长（例如 1d → 3d）。
- 导出 CSV: 生成文件含表头并可被 Excel 正常打开。

## 后续命名与品牌延展
- LOGO: 以“键盘 + 航线路径”元素体现 Odyssey。
- 子模块命名: Flight Mode, Combo Lab, Word Arena, AI Coach。

---
此路线图将随迭代更新；每阶段完成后应在此文件追加 “Progress” 小节与实际产出链接。

## 最近更新 (Progress Log)
- **2025-11-20**:
  - **Bug修复**: 修复历史记录页面 (HistoryPage) 导致的白屏崩溃问题。
  - **新游戏上线**: 完成 "地牢勇士", "单词农场", "极速赛车", "节奏键盘" 四款新游戏及玩法说明。
  - **AI 升级**: 升级 AI 生成逻辑，支持生成包含音标、翻译、例句的富文本词汇课程。
  - **体验优化**: 在单词练习模式中增加 TTS 发音功能 (单词+例句)。
  - **语言切换改进**: 设置中修改中/英文后自动刷新界面，确保全部文案即时应用。
  - **复习输入焦点修复**: 修复记忆复习回车后输入框失焦问题，保持连续输入体验。
- **2025-11-20**: P9 性能优化完成。
  - 实施路由组件与游戏插件的懒加载 (Lazy Loading)，优化首屏加载速度。
  - 升级构建配置 (Vite)，分离 vendor/charts/utils 代码块，优化包体积。
  - 确认存储层已迁移至 IndexedDB (Dexie.js)。
  - 确认 TTS 使用本地 SpeechSynthesis API，无需网络缓存。
- **2025-11-20**: P5 记忆机制可视化。
  - 实现 `reviewService.getRetentionStats` 聚合复习日志。
  - 在 `HistoryCharts` 中新增遗忘曲线（保留率）柱状图。
  - 完善图表页面的暗色模式适配。
- **2025-11-20**: P8 插件架构深化 - AI 模块插件化。
  - 定义 `AIPlugin` 接口。
  - 扩展 `PluginRegistry` 支持 AI 插件。
  - 将现有 6 种 AI 生成模式（词汇、文本、句子、故事、对话、混合）重构为插件。
  - 优化 `AILab` 组件，动态加载 AI 模式。
- **2025-11-20**: P8 插件架构初步实现。
  - 定义 `GamePlugin` 接口与 `PluginRegistry`。
  - 重构 `GameCenter` 与 `App` 使用插件注册表动态加载游戏。
  - 将现有 7 款游戏迁移至插件系统。
- **2023-10-27**: P4 AI 实验室功能完善。
  - 修复了 IndexedDB 异步调用导致的崩溃问题。
  - 优化了课程列表的分页显示。
  - 优化了打字练习的 Enter 键支持。
  - 启动 P5 记忆机制深化开发。
- **2023-10-26**: P4 AI 实验室基础功能完成。
  - 完成 AIProvider 接口统一与初步测试。
  - 实现基于用户水平的 Prompt 模板动态生成。
  - AI 生成富文本词汇卡片，包含音标、释义、例句。
  - 集成 TTS 语音合成功能。
  - 完成错误分析与复习集生成逻辑。
  - 英文例句生成优化，支持短句控制。
  - AI Lab v2 界面优化与功能整合。
- **2025-11-21**: P10 英语情景教学与文章练习功能升级完成。
  - **核心升级**: 实现句子级课程数据结构 (Sentence-based Course Structure)，支持中英对照与关键词解析。
  - **新视图**: 新增 "专注模式" (Focus Mode) 练习视图，提供沉浸式句子练习体验。
  - **多模式**: 实现 "视译" (Sight Translation)、"听写" (Dictation)、"精抄" (Intensive Copying) 等多种练习预设。
  - **AI 增强**: 优化 AI Prompt，支持生成包含句子拆分和关键词分析的结构化课程。
  - **Bug修复**: 修复 TTS 朗读人选设置问题；修复 TypingGame 输入溢出崩溃问题；修复 AI Prompt 设置空白问题。