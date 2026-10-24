/**
 * 教材引导相关提示词（从老版本迁移并适配）
 *
 * 目标：通过出版社/系列/教材名，生成可解析的 JSON（不带 Markdown code block）。
 */

export function buildSeriesListPrompt(publisher: string): string {
  return `请尽可能全面地列出${publisher}出版的所有英语教材系列（涵盖K12阶段、小学、初中、高中）。
请注意区分不同的版本或子系列（例如：人教版可能有“PEP人教版”、“新起点”、“精通版”、“Go for it!”、“新目标”等）。
请返回一个包含所有系列名称的JSON对象。

JSON格式示例：
{
  "series": ["PEP人教版 (三年级起点)", "人教版新起点 (一年级起点)", "人教版精通版 (三年级起点)", "人教版新目标 (Go for it!)", "人教版高中英语 (2019版)"]
}`.trim();
}

export function buildTextbookListPrompt(publisher: string, series: string, grade?: string): string {
  const gradePrompt = grade ? `仅列出年级/学段为“${grade}”的教材。` : '请覆盖该系列实际存在的全部年级/学段，按从低到高排列。';
  return `你是中国 K12 英语教材目录整理专家。请为“${publisher}”的“${series}”系列整理教材目录。

任务要求：
1. ${gradePrompt}
2. 只列出该出版社、该系列真实对应的教材，不要混入其他出版社或近似系列；不确定的版本不要伪造。
3. 每条教材都必须填写 grade、semester、name 三个非空字符串，禁止省略 grade。grade 应是可用于下拉筛选的稳定标签，例如“一年级”“二年级”“三年级”“七年级（初一）”“八年级（初二）”“九年级（初三）”“高一”“高二”“高三”；若该系列使用不同学段体系，则使用教材目录中的明确年级/学段名称。
4. semester 使用“上册”“下册”或教材实际使用的“全一册”“必修上册”“选择性必修一”等名称；不得自行推断不存在的册次。
5. 同一教材不得重复；按年级顺序、同一年级按教材册次顺序输出。
6. 只返回 JSON，不要 Markdown、解释文字或额外字段。若无法可靠确认目录，返回 {"textbooks": []}。

严格 JSON 结构：
{
  "textbooks": [
    {"grade": "三年级", "semester": "上册", "name": "英语（三年级起点）三年级上册"},
    {"grade": "三年级", "semester": "下册", "name": "英语（三年级起点）三年级下册"}
  ]
}`.trim();
}

export function buildParseTextbookUnitsPrompt(publisher: string, series: string, textbookName: string): string {
  return `请作为资深教材专家，智能解析${publisher}${series}《${textbookName}》的目录结构。

请按以下步骤思考（Chain of Thought）：
1. **精准定位教材**：
   - 分析出版社、系列和书名，锁定唯一的官方教材版本。
   - **智能纠错与推断**：如果书名与系列学段看似冲突（例如在“初中系列”中出现了“三年级”），请结合中国学制习惯进行推断（如“初中三年级”即“九年级”）。请优先尝试匹配最可能的真实教材，而不是直接报错。
   - **版本识别**：注意区分“人教版（老版JEFC）”、“人教版（新目标Go for it!）”等不同代际的教材。

2. **解析目录层级**：
   - 识别教材的实际组织方式（Unit / Module / Lesson）。
   - 如果是 Module 下包含 Unit，请以 Unit 为基础条目；如果是 Lesson 为主（如旧版教材），请按 Lesson 或逻辑单元归类。

3. **提取数据**：
   - 提取真实的单元序号、单元标题（Title）和核心话题（Topics）。

请返回标准JSON格式：
{
  "units": [
    {
      "unit_num": 1,
      "title": "单元标题（请保留教材原文标题）",
      "topics": ["核心话题1", "核心话题2"]
    }
  ]
}

准则：
- 必须基于**真实存在**的教材目录。
- 如果经过推断仍无法锁定任何真实教材，请返回 {"units": []}。`.trim();
}

export function buildGenerateTextbookWordsPrompt(
  textbookName: string,
  unitTitle: string,
  options: { coreCount?: number; extraCount?: number }
): string {
  const coreCount = options.coreCount || 8;
  const extraCount = options.extraCount || 5;

  return `基于《${textbookName}》${unitTitle}，生成：
1. 核心词汇表（${coreCount}词）：英文单词、国际音标、词性、中文释义
2. 拓展词汇表（${extraCount}词）：同主题关联词
3. 每词配1个教材例句
JSON格式：
{
  "core_words": [
    {
      "word": "单词",
      "phonetic": "音标",
      "pos": "词性",
      "zh": "中文",
      "example": "例句"
    }
  ],
  "extra_words": [
    {
      "word": "拓展词",
      "phonetic": "音标",
      "pos": "词性",
      "zh": "中文",
      "example": "例句"
    }
  ]
}`.trim();
}

export function buildGenerateTextbookSentencesPrompt(textbookName: string, unitTitle: string): string {
  return `请获取《${textbookName}》${unitTitle}的**主要课文或对话内容**。
1. 将课文按句子拆分。
2. 为每个句子提供中文翻译。
3. 提取该句中的1-2个核心关键词（keywords）。
JSON格式：
{
  "title": "课文标题",
  "sentences": [
    {
      "en": "英文原句",
      "zh": "中文翻译",
      "keywords": ["关键词1", "关键词2"]
    }
  ]
}`.trim();
}

export function buildGenerateTextbookPhonicsPrompt(
  textbookName: string,
  unitTitle: string,
  options: { sampleWords?: string }
): string {
  return `针对《${textbookName}》${unitTitle}中的单词（如${options.sampleWords || 'apple, cat'}），生成音标练习：
1. 目标音标（如/æ/）及发音要领
2. 3个例词及音标分解（如：a-pple /ˈæpəl/）
3. 1组最小对立对辨音练习（如：cat/kæt/ vs. cut/kʌt/）
JSON格式：
{
  "phonics": [
    {
      "target_sound": "目标音标",
      "pronunciation": "发音要领",
      "examples": [
        {
          "word": "例词",
          "phonetic_breakdown": "音标分解"
        }
      ],
      "minimal_pairs": [
        {
          "word1": "对比词1",
          "word2": "对比词2",
          "explanation": "辨音说明"
        }
      ]
    }
  ]
}`.trim();
}

export function buildGenerateTextbookPassagePrompt(textbookName: string, unitTitle: string): string {
  return `请基于《${textbookName}》${unitTitle}，生成一个与该单元主题一致的短文（适合课堂阅读/听力材料）：
1. 生成 1-3 个自然段（每段 1-3 句），英文为主。
2. 为每个自然段提供对应中文翻译。
3. 内容应尽量贴近中国 K12 英语教材常见语境（人物、场景、任务）。

JSON 格式：
{
  "title": "短文标题（可选）",
  "paragraphs": [
    {
      "en": "英文段落",
      "zh": "中文翻译"
    }
  ]
}`.trim();
}

export function buildGenerateTextbookGrammarPrompt(textbookName: string, unitTitle: string): string {
  return `请基于《${textbookName}》${unitTitle}，生成该单元最核心的语法点练习素材：
1. 列出 3-6 个语法点（name）。
2. 每个语法点提供中文解释（explanation_zh）。
3. 每个语法点提供 2-3 组例句（en/zh 对照）。

JSON 格式：
{
  "points": [
    {
      "name": "语法点名称",
      "explanation_zh": "中文解释",
      "examples": [
        {"en": "英文例句", "zh": "中文翻译"}
      ]
    }
  ]
}`.trim();
}
