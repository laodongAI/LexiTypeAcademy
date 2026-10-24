# 英语学习体系设计（v1）：词根扩展 · 燃尽法 · 悬停领读 · 资源库 · AI 场景

- 状态：待评审（本文件仅为设计与开发计划，不包含实现）
- 日期：2026-10-24
- 适用形态：本地单机、单用户、无登录
- 硬依赖：**批次D（AI 能力后端化）** 必须先完成，AI 场景生成与 AI 词根补全才具备实施条件
- 关联文档：`docs/design/ai-backend-proxy-v1.md`、`docs/design/course-and-ailab-ddd-design-v0.4.1.md`、`docs/requirements/english-learning-requirements-v2.md`

---

## 1. 需求理解与产品化拆解

### 1.1 用户原始诉求 → 产品能力映射

| 用户诉求 | 产品化能力 | 现状判断 |
| --- | --- | --- |
| 背单词按“词根扩展多个单词”，含音标、例句、讲解、配套声音 | **词根组学习**：一个词根聚合派生词，组内可展开词条详情并点读 | 现有 `LessonItem` 有 `phonetic/examples/audioPath`，无词根字段、无分组视图 |
| 学文章用“句子燃尽法”和“词的燃尽法” | **燃尽练习**：逐级移除提示直到可独立复现，错误自动回退 | 现有练习有提示等级能力（`hintLevelAtSubmit/nextHintLevel`），无燃尽策略与状态机 |
| 去 B 站 / YouTube 借鉴英语学习方法 | **方法调研任务**：产出可落地的方法清单并映射到功能 | 无系统化沉淀，仅有零散需求文档 |
| 找四六级、CEFR B1/B2、绘本、初小教材等标准资料转教学素材 | **资源库 + 分级教材体系**：来源类型、系列、等级体系、技能维度统一归类 | `Course` 有 `category/difficulty/cefrLevel/tags`，不足以表达“教材系列/册次/来源” |
| 借鉴“鼠标悬停自动领读”工具（句朗读、词卡弹出） | **悬停精读（Hover Reader）**：句级自动朗读、词级音标/中文/例句卡片 | 现有跟读组件为“点击按钮”式，无悬停驱动、无词卡 |
| 从 YouTube 获取资料并入资源库 | **字幕/文本导入**：SRT/VTT/TXT → 课程草稿 → 资源库 | `AILabPage` 仅有旧 mock 导入，未挂载 |
| “枚举数据描述资源并映射文件，关联中文、声音、音标” | **资源元数据 + 词条扩展字段**，文件以本地路径/相对路径引用 | 词条已有关联字段，缺资源元数据、缺统一枚举来源 |
| 选中教材后自动生成模拟对话场景（含语音与对话文本） | **AI 对话场景生成**：基于课程上下文生成角色对话，落为 `dialog` 课时 | 现有 AI 可生成课程，但无场景化对话、无角色音色、依赖前端直连密钥 |

### 1.2 用户真正要解决的问题

不是“再增加几个页面”，而是把现有“课程 → 课时 → 词条”的**单机学习闭环**升级为三件事：

1. **输入更省力**：资源可以批量进来并归类，不用手工建课。
2. **记忆更牢固**：词根成组记、文章用“燃尽”逼自己回忆，而不是只看一遍。
3. **阅读更顺滑**：像“鼠标划过就朗读、停在词上就看释义”的精读体验，降低查词与播放的操作成本。

---

## 2. 项目知识基线（事实与来源）

### 2.1 已确认事实

| 事实 | 来源 |
| --- | --- |
| 内容主模型为 `courses → lessons → items(JSON)`，`LessonItem` 含 `english/chinese/phonetic/partOfSpeech/examples/audioPath` | `frontend/src/shared/types/course.ts`、`backend/app/db/models.py` |
| 课程已含 `cefrLevel`、`category`、`difficulty`、`tags`、`coverImage`、`author` | `models.py`、`field_maps.py` |
| 课时形态枚举含 `word/phrase/sentence/passage/dialog` | `course.ts` 的 `ContentShape` |
| 练习尝试事件已持久化，且含提示等级与 `extra` JSON 扩展 | `models.py` 的 `PracticeAttemptEvent`、`practice.py` 的 `/api/attempt-events` |
| Unit 掌握度按 `courseId+unitId+mode` 记录，复习调度基于 SM-2 | `models.py` 的 `UnitMasteryItem`、`/api/unit-mastery-items` |
| 本地 TTS 已具备 `/api/tts/generate`（文本→音频，含音色/语速/格式），前端有音频 Blob 缓存 | `backend/app/api/routers/tts.py` |
| AI 能力现为前端直连供应商，批次D 已设计后端代理（`/api/ai/chat` + SSE） | `frontend/src/shared/services/ai/*`、`docs/design/ai-backend-proxy-v1.md` |
| 资源库现状为“课程仓库”页面，仅按课程基础字段展示 | `frontend/src/renderer/views/CourseRepositoryPage.vue` |
| 顶层导航已有：首页、我的学习、学习计划、课程仓库、练习中心、游戏中心、复习系统、AI 工具、学习数据、设置 | `frontend/src/renderer/layouts/MainLayout.vue` |

### 2.2 可复用资产（必须复用，禁止另建）

| 资产 | 复用方式 |
| --- | --- |
| `courses/lessons` 两表 + items JSON | 所有新内容（词根组、对话场景、导入文章）都落到该模型，**不新增内容表** |
| `PracticeAttemptEvent` 的 `hintLevelAtSubmit/nextHintLevel/extra` | 燃尽阶段与遮蔽词集合直接记录，**不新增燃尽表** |
| `UnitMasteryItem`（`unitId+mode`） | 燃尽/精读的掌握度沿用现有复习调度，**不新增掌握度模型** |
| `/api/tts/generate` + 前端 Blob 缓存 | 悬停领读、词卡发音、对话音频全部复用 |
| 批次D `/api/ai/chat` | AI 词根补全、AI 对话场景统一走该端点 |
| `practice_records`、`learning_records` | 阅读时长、燃尽练习统计复用现有记录表 |

### 2.3 明确缺口

1. 课程缺少“资源来源/教材系列/册次/等级体系”的结构化字段。
2. 词条缺少“词根/词根含义/讲解/派生关系”字段。
3. 无悬停朗读交互与词卡查询能力。
4. 无燃尽策略（提示等级存在，但无“逐级遮蔽—回退—完成”的状态机与 UI）。
5. 无字幕/文本解析导入器（现有为 mock）。
6. AI 仍为前端直连，密钥暴露且无法统一日志（批次D 解决）。

### 2.4 冲突与约束

- **禁止第二套内容模型**：不得为“资源/教材/词根/对话”新建平行表或平行 JSON 结构。
- **禁止重复入口**：资源库不新增顶层菜单，升级现有“课程仓库”；精读/燃尽/词根都在课时学习内部进入。
- **核心标识冻结**：不改 Dexie 库名、Electron appId、设置存储键。
- **本地单机无登录**：所有接口不做鉴权与多用户隔离；但必须限制监听 `127.0.0.1`。

---

## 3. 产品判断

### 3.1 目标用户与核心场景

单用户自学者（CET-4/6 或 CEFR A2–B2）的一日学习链路：

1. 从资源库挑一本教材/一组电影台词 → 进入课时。
2. 先用**悬停精读**通读一篇，查词不打断阅读。
3. 再用**句子燃尽**逐句回忆，错误立即回退补提示。
4. 生词沉淀到**词根组**，按词根成组记忆并点读。
5. 到期复习沿用现有 SM-2 队列；薄弱词进入 AI **对话场景**做输出练习。

### 3.2 成功指标（可观测，不做无数据承诺）

| 指标 | 定义 | 目标（首版验收后观察，非承诺） |
| --- | --- | --- |
| 精读完成率 | 进入精读的课时中，读到最后一句话的占比 | ≥ 60% |
| 燃尽达成率 | 句燃尽推进到“无提示复现”（k=N）的句子占比 | ≥ 50% |
| 查词不中断率 | 悬停词卡出现后继续阅读（未离开页面）的占比 | ≥ 85% |
| 词根组覆盖 | 词根课时中带 `rootGroupId` 的词条占比 | ≥ 90% |
| 资源归类完整率 | 新导入课程中 `resourceMeta` 必填项齐全的占比 | 100% |

### 3.3 范围与优先级

| 优先级 | 能力 | 理由 |
| --- | --- | --- |
| P0 | 悬停精读（F4） | 用户明确点赞的交互，直接降低阅读阻力，不依赖 AI |
| P0 | 句子/词燃尽（F3） | 用户明确点名的学习方法，复用现有提示等级与事件表 |
| P0 | 资源元数据与分类（F1） | 资源归类的底座；不做则后续导入无法分类 |
| P1 | 词根扩展（F2） | 价值高，但需要 AI 补全与教研校验，可分批 |
| P1 | 字幕/文本导入（F5） | 解决“资料进来”的问题，可先做单文件本地解析 |
| P2 | AI 对话场景（F6） | 依赖批次D，且成本与质量需真实密钥验证 |

### 3.4 明确不做（本期）

- 不做在线题库/考试报名/多人班级。
- 不做视频下载与视频内嵌播放（合规与依赖成本高）。
- 不做发音音素级专业评测（现有为文本相似度级，保持现状）。
- 不做资源版权分发；仅处理用户本地提供的材料并记录来源。

---

## 4. 总体方案：一个内容模型 + 四个能力层

```
Course（资源/教材单元）
 └─ Lesson（课时：word / phrase / sentence / passage / dialog）
     └─ items[]（LessonItem，JSON：英文/中文/音标/词性/例句/音频/词根/角色）
           ├─ 悬停精读：读取 items 与句子切分 → 朗读 + 词卡
           ├─ 燃尽练习：遮蔽策略作用于 items → 写入 attempt events
           ├─ 词根组：按 item.root 分组 → 组内派生词复习
           └─ AI 场景：生成 dialog 课时 → items 增加 speaker
```

四条设计原则：

1. **所有内容仍存于 `courses/lessons/items`**，新增能力只做“字段扩展 + 视图聚合 + 交互层”。
2. **枚举只有一个来源**：后端 `app/core/taxonomy.py` 为唯一权威，前端通过接口取值并只声明 TS 类型，不在前端复制枚举值。
3. **音频一律走 TTS 服务**，不预生成大文件；按需合成并复用前端 Blob 缓存。
4. **AI 只在“生成草稿”环节介入**，生成结果必须经过结构校验后落库，可人工修改。

---

## 5. 模块设计

### 5.1 资源库与分级教材体系

#### 5.1.1 分类维度（枚举唯一来源）

| 枚举 | 取值 | 说明 |
| --- | --- | --- |
| `sourceType` | `textbook` / `graded_reader` / `video` / `audio` / `exam` / `user` / `ai` | 教材、分级读物、影视、音频、考试真题、用户自建、AI 生成 |
| `levelSystem` | `CEFR` / `CET` / `IELTS` / `TOEFL` / `PRIMARY` / `CUSTOM` | 等级体系 |
| `levelValue` | 如 `A1..C2` / `CET4` / `CET6` / `IELTS-6.5` / `G3` | 体系内取值 |
| `skillFocus` | `listening` / `speaking` / `reading` / `writing` / `mixed` | 技能侧重 |
| `topic` | 开放标签（如 `daily`/`travel`/`business`/`science`） | 主题 |
| `sceneType`（AI 用） | `restaurant` / `interview` / `directions` / `shopping` / `airport` / `custom` | 对话场景 |

落地方式：

- `backend/app/core/taxonomy.py` 定义上述常量与 `TAXONOMY_VERSION`，并提供校验函数。
- `GET /api/courses/taxonomy` 返回全部枚举与版本；前端只保留 TS 类型（`ResourceSourceType` 等），选项渲染来自接口。
- 不在前端硬编码第二份枚举值，避免两处维护。

#### 5.1.2 数据扩展：`courses.resource_meta`（JSON，可空）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `sourceType` | enum | 是 | 来源类型 |
| `sourceName` | string | 否 | 来源平台/出版社，如 `YouTube`、`人教版` |
| `seriesName` | string | 否 | 系列/教材名，如 `新概念英语`、`RAZ` |
| `seriesOrder` | number | 否 | 册/级次，如第 2 册 |
| `unitNo` | string | 否 | 单元编号 |
| `levelSystem` | enum | 是 | 等级体系 |
| `levelValue` | string | 是 | 等级取值 |
| `skillFocus` | enum | 否 | 技能侧重 |
| `topic` | string | 否 | 主题 |
| `sourceUrl` | string | 否 | 原始链接（仅记录，不抓取） |
| `licenseNote` | string | 否 | 版权/使用说明 |
| `languageVariant` | enum | 否 | `en-US` / `en-GB` |
| `wordCount` | number | 否 | 词数（导入时自动统计） |
| `durationMinutes` | number | 否 | 预计学习时长 |
| `resourceKey` | string | 否 | 去重键：`sourceType:seriesName:unitNo:titleHash` |
| `importBatchId` | string | 否 | 导入批次标识 |
| `importedAt` | number | 否 | 导入时间（毫秒） |
| `aiGenerated` | boolean | 否 | 是否 AI 生成，便于筛选与清理 |

`resourceKey` 不做数据库唯一索引（历史数据与手建课程可能为空，强约束会导入失败）；去重在导入流程中按 `resourceKey` 查询并提示“已存在，是否覆盖/跳过”。

#### 5.1.3 分类树（资源库左栏）

```
来源类型
 ├─ 教材 textbook
 │   └─ 系列（新概念/人教版/牛津…）
 │        └─ 册次 → 单元 → 课时
 ├─ 分级读物 graded_reader（RAZ/牛津树…）
 ├─ 影视 video（电影/剧集 → 片段）
 ├─ 考试 exam（CET-4 / CET-6 / IELTS → 题型）
 ├─ 音频 audio（播客/听力材料）
 ├─ 用户自建 user
 └─ AI 生成 ai
```

分类树**由 `GET /api/courses/facets` 聚合得出**（各维度计数），不单独存树。

#### 5.1.4 页面策略

升级现有“课程仓库”为“资源库”视图（同一路由 `/course-repository`，同一页面文件），新增左侧分类树 + 顶部筛选 + 课程卡片上的来源/等级徽标。**不新增顶层菜单**。

---

### 5.2 词根扩展学习

#### 5.2.1 数据模型（扩展 `LessonItem`，无新表）

```ts
/** 词根组标识与词根信息（均为可选，历史数据缺省） */
interface LessonItem {
  // ... 现有字段：id / english / chinese / audioPath / phonetic / partOfSpeech / examples

  /** 词根或词缀，如 "spect"、"re-" */
  root?: string
  /** 词根含义，如 "看" */
  rootMeaning?: string
  /** 同组标识：同一课时内相同 root 自动归组；显式指定时优先级更高 */
  rootGroupId?: string
  /** 拆解讲解，如 "in(向内) + spect(看) → 向内看 → 检查" */
  explanation?: string
  /** 例句中文翻译，与 examples 等长 */
  exampleTranslations?: string[]
  /** 讲解音频路径（可选；无则按需 TTS 合成） */
  explanationAudioPath?: string
  /** 派生关系：`root`（本词为该组词根）/ `derived`（派生词） */
  rootRole?: 'root' | 'derived'
}
```

归组规则（唯一实现，放在 `shared/utils/wordRoot.ts`）：

1. 优先使用 `rootGroupId`；为空时使用 `root` 归一化（小写、去连字符）作为组键。
2. 无 `root` 的词条单独成组（降级展示，标记“未归类”），不隐藏。
3. 组内排序：`rootRole='root'` 优先，其余按 `examples` 数量与词长升序。

#### 5.2.2 学习交互

- 入口：课时学习页新增“词根模式”页签（不新增路由）。
- 左栏词根卡片（词根 + 含义 + 派生词数）；右栏派生词列表。
- 每个派生词展示：单词、音标、词性、中文、例句（中英）、讲解；点击喇叭按需 TTS。
- 组内操作：**整组听读**（依次朗读单词）→ **遮中文回忆**（先隐藏中文，逐词揭示）→ **整组自测**（看中文拼英文）。
- 自测结果写入 `PracticeAttemptEvent`（`mode='dictation'`，`extra.rootGroupId`），掌握度沿用 `UnitMasteryItem`。

#### 5.2.3 AI 生成（依赖批次D）

- Prompt：`shared/services/ai/prompts/wordRoot.ts`，输入 `{ topic, level, rootCount, wordsPerRoot }`。
- 输出 JSON schema：

```json
{
  "roots": [
    {
      "root": "spect",
      "rootMeaning": "看",
      "note": "拉丁词根",
      "words": [
        { "word": "inspect", "phonetic": "/ɪnˈspekt/", "partOfSpeech": "v.", "translation": "检查",
          "example": "The doctor inspected the wound.", "exampleTranslation": "医生检查了伤口。",
          "explanation": "in(向内) + spect(看) → 向内看 → 检查" }
      ]
    }
  ]
}
```

- 校验：每组 ≥3 词、每词必有 `word/phonetic/translation/example`、词根不得为空、同组不得重复词。
- 落库：生成“词根课程”（`category='special'`、`tags=['词根']`、`resourceMeta.sourceType='ai'`）与课时（`contentShape='word'`），词条按 5.2.1 字段写入。
- 降级：未配置 AI 时按钮置灰并提示“需先在设置页配置后端 AI 密钥”；不影响既有词根浏览。

---

### 5.3 燃尽法（句子燃尽 / 词燃尽）

#### 5.3.1 精确定义

**燃尽 = 逐级移除提示，直到学习者能独立复现。做出即升级，做错即回退一层。**

- **词燃尽（Word Burn-down）**：针对单词拼写，提示分为 5 级：

| 阶段 | 提示形态 | 判定输入 |
| --- | --- | --- |
| 0 | 完整单词 + 音标 + 中文 | 朗读或默读（不判定） |
| 1 | 保留首尾字母，中间字母遮蔽（`i_____t`） | 键盘补全 |
| 2 | 保留首字母 + 长度（`i_____`） | 键盘补全 |
| 3 | 仅显示中文与音标 | 键盘拼写 |
| 4 | 仅播放发音（无文字） | 键盘拼写 |

- **句子燃尽（Sentence Burn-down）**：针对整句复现，遮蔽词数 `k` 从 0 递增到 `N`（N=句中非标点 token 数）。

| 阶段 | 展示 | 判定输入 |
| --- | --- | --- |
| k=0 | 全句可见 + 可播放 | 无判定（预热） |
| 0<k<N | 句末起向前遮蔽 k 个词，其余可见 | 按顺序补全被遮蔽词 |
| k=N | 全句遮蔽，仅给中文提示（可选关闭） | 整句输入或跟读 |

遮蔽顺序规则（唯一实现）：**默认从句子末尾向前逐词遮蔽**（模拟“文字被烧掉”），标点不参与计数；可选“功能词优先”策略作为后续增强，首版不做。

#### 5.3.2 状态机

```
IDLE
  └─(开始)→ PREVIEW（播放示范音 / 全显）
        └─(用户确认/播放结束)→ ATTEMPT(stage)
              ├─(正确 且 连续正确≥1)→ stage+1 → 若 stage 达上限 → COMPLETE
              ├─(错误)→ stage-1（不低于0）→ 记录回退原因 → ATTEMPT(stage)
              └─(主动揭示提示)→ stage-1 → 记录 hintUsed=true
COMPLETE → 写入练习记录与掌握度 → 返回课时
```

- 正确判定：文本输入用归一化相似度（去标点、小写、合并空格）≥ 0.9；语音输入用现有 ASR 相似度 ≥ 80 分。
- 词燃尽升级条件：同一阶段连续 1 次正确即升级；句燃尽要求连续 2 次正确才升级（句子信息量大，避免偶然猜中）。
- 回退下限为 0；连续 3 次错误弹出“查看讲解/换一句”，避免挫败。
- 中断恢复：阶段按 `lessonId+unitId` 缓存在 `localStorage`（键名前缀 `lexitype_burn_`，与核心设置键隔离），重启后恢复；完成或切换课时清除。

#### 5.3.3 持久化（无新表）

| 数据 | 落点 |
| --- | --- |
| 每次提交 | `practice_attempt_events`：`mode` 沿用 `dictation`/`follow`，`hint_level_at_submit` = 燃尽阶段，`extra = { burnType:'sentence'|'word', hiddenTokens:string[], stageTotal:number }` |
| 单句/单词掌握度 | `unit_mastery_items`：`unit_id` = item.id，`mode` 沿用原练习模式 |
| 整课时汇总 | `practice_records`：`mode` 沿用原模式，`total_items` = 句数，`correct_items` = 一次通过句数 |

说明：燃尽只是“提示策略”，不是新的练习模式，避免 `PracticeMode` 膨胀导致复习队列分叉。

#### 5.3.4 边界规则

- 数字、缩写、连字符（`don't`、`well-known`、`2024`）按单 token 处理，不拆分。
- 中文提示默认开启（句燃尽），可在练习页顶部关闭；关闭后不降级阶段。
- 大小写与标点不计入错误；`a/an`、`the` 等虚词计入 token。
- 超长句（>25 token）自动拆分为两个判定段，仍算同一句。

---

### 5.4 悬停领读（Hover Reader）

#### 5.4.1 交互定义

| 层级 | 触发 | 行为 |
| --- | --- | --- |
| 句子 | 鼠标进入句子区域停留 ≥120ms | 停止当前音频，播放该句；高亮当前句 |
| 单词 | 鼠标在单词上停留 ≥180ms | 弹出词卡（音标/词性/中文/例句/发音按钮），**不打断**句子朗读 |
| 继续移动 | 进入另一句 | 立即切换朗读；上一句高亮取消 |
| 离开文章区 | 鼠标移出正文 ≥250ms | 停止朗读，词卡在 300ms 后关闭 |
| 键盘 | Tab 聚焦句子/词 + Enter/Space | 等价触发（可访问性） |
| 移动端 | 单击句子 / 长按单词 | 等价触发（悬停语义降级） |

必须提供**总开关**：“悬停朗读 开/关”，关闭后仅保留点击朗读，避免误触。

#### 5.4.2 事件与音频调度（唯一实现：`useHoverReader.ts`）

- 事件：`mouseenter`（句子/词容器，通过 `data-sentence-index`、`data-word-index` 标记）、`mouseleave`、`focusin`。
- 防抖：句 120ms、词 180ms；`AbortController` 取消上一定时器。
- 音频互斥：全局单通道，`stop()` 先于 `play()`；禁止两段音频叠加。
- 切换体验：句子切换时旧音频在 100ms 内淡出停止。
- 缓存：句级音频按 `hash(sentence + voice + rate)` 存 IndexedDB Blob（沿用现有 TTS 缓存）；命中直接播放，未命中调 `/api/tts/generate`。
- 预取：当前句播放时预取下一句（并发上限 1），减少停顿。
- 失败降级：TTS 失败时静默并显示一次轻提示，不阻塞阅读。

#### 5.4.3 词卡内容来源（优先级）

1. 当前课时 `items` 中 `english` 归一化后完全匹配的词条（含音标/中文/例句）。
2. 当前课程其余课时词条匹配。
3. 未命中：显示“暂无释义”，提供“AI 补全”（依赖批次D）与“加入生词本”（写入 `word_mastery_items`，`source=courseId`）。
4. 禁止前端内置词典文件（体积与维护成本高）。

#### 5.4.4 句子切分

- 前端 `shared/utils/sentenceSplit.ts` 唯一实现：按 `.!?` 及中文标点切分，保留缩写（`Mr.`、`e.g.`）与小数点（`3.14`）。
- `passage` 类型课时：每个 item 视为一段，段内再分句；`dialog` 类型：每个 item 一行，按角色渲染。
- 切分结果不落库，始终由内容实时计算，避免出现两份文本。

#### 5.4.5 阅读记录

- 进入精读记开始时间；离开或完成时写一条 `learning_records`：
  - `activityType='reading'`
  - `metadata = { courseId, lessonId, sentences, sentencesRead, lookupCount, durationMs, completed }`
- 单词查询次数按会话聚合，不逐次写事件（避免事件表膨胀）。

#### 5.4.6 性能与体验指标

| 指标 | 目标 |
| --- | --- |
| 首句开始播放（缓存命中） | ≤ 300ms |
| 首句开始播放（未命中，本地 TTS） | ≤ 1500ms |
| 句切换时旧音频停止 | ≤ 100ms |
| 词卡出现 | ≤ 200ms |
| 连续切换 100 次 | 无音频叠加、无内存持续增长 |

---

### 5.5 资源获取与导入（字幕 / 文本 / 教材）

#### 5.5.1 合规与范围

- **只处理用户本地提供的文件**（字幕、文本、自建教材目录）。
- 不内置 YouTube/B 站抓取与视频下载；`sourceUrl` 仅用于记录出处。
- 视频下载 + 本地 ASR 转录列为 P2 后续，需单独评审依赖与合规。

#### 5.5.2 单文件导入流程（首版，纯前端解析）

```
选择文件（.srt/.vtt/.txt/.md）
  → 前端解析（parseSubtitle.ts）→ 句子数组
  → 预览：标题、来源类型、系列、等级、技能、主题、句子数、去重提示
  → 生成课程草稿（1 课时 = 1 篇文章；长文按 20-30 句拆多课时）
  → 用户确认 → POST /api/courses（现有接口）
```

- 解析器唯一实现：`shared/utils/subtitleParser.ts`，支持 SRT 序号/时间轴、VTT `WEBVTT` 头、纯文本段落。
- 清洗规则：合并同句续行、去时间轴与样式标签、去空行、连续重复句去重。
- 去重：课程草稿带 `resourceKey`，导入前调用 `GET /api/courses?q=` 粗查同名/同系列提示。
- 词条生成：每句一个 `LessonItem`（`english`、`chinese` 留空待 AI/手工补全），保留原句顺序与时间戳到 `items[].startMs/endMs`（新增可选字段）。

#### 5.5.3 批量与教材目录（后续）

- 批量导入多文件：前端串行提交，逐条显示成功/失败；失败可重试。
- 教材目录（如“人教版七年级上册 Unit 1”）：首版用导入表单手工填写 `resourceMeta`；结构化目录解析列为 P2。

---

### 5.6 AI 对话场景生成（硬依赖批次D）

#### 5.6.1 前置条件

- 批次D 完成：`/api/ai/chat` 可用，密钥仅存 `backend/.env`，设置页只读。
- 未配置密钥时按钮置灰，提示明确，不影响其他功能。

#### 5.6.2 生成流程

```
课程/课时详情 → “生成对话场景”
  → 场景参数：sceneType、难度（沿用 cefrLevel）、角色数（2-3）、轮次（8-16 句）、目标词（默认取本课时词条）
  → POST /api/ai/chat（systemPrompt + 课程上下文）
  → 前端校验 → 预览可编辑
  → 保存为 dialog 课时（追加到当前课程）
  → 按需 TTS（角色音色映射）
```

#### 5.6.3 输出契约

```json
{
  "title": "At the Airport",
  "setting": "值机柜台，乘客与地勤",
  "cefrLevel": "B1",
  "roles": [
    { "name": "Agent", "voice": "en_female_1" },
    { "name": "Traveler", "voice": "en_male_1" }
  ],
  "lines": [
    { "speaker": "Agent", "english": "May I see your passport, please?", "chinese": "请出示您的护照。", "phonetic": "" },
    { "speaker": "Traveler", "english": "Here you are.", "chinese": "给您。", "phonetic": "" }
  ],
  "targetExpressions": ["may I see", "here you are"]
}
```

校验规则（前端 `validateDialogScene.ts` 唯一实现）：

1. `lines` 8–16 条，`speaker` 必须存在于 `roles`。
2. 每行 `english/chinese` 非空；英文去重后不得连续重复。
3. 目标表达覆盖率 ≥60%（按 `targetExpressions` 统计）。
4. CEFR 与课程等级偏差不超过 1 级（仅提示，不阻断）。

落库映射：

- 新建 `Lesson`：`contentShape='dialog'`，`items` = `lines`，每项增加 `speaker`（新增可选字段）。
- 课时 `description` 存 `setting`；课程 `tags` 追加 `AI对话`；课程 `resourceMeta.aiGenerated=true`。
- `roles.voice` 仅存元信息，TTS 时按角色选择音色；音色不存在则回退默认。

#### 5.6.4 角色扮演交互

- 选择扮演角色 → 对方台词自动朗读 → 轮到我方时录音（复用现有跟读/ASR）→ 评分与反馈（复用 `TeachingFeedbackPanel`）。
- 支持“只看中文说英文”“隐藏中文”“只看英文”三种难度。
- 完成整段对话后写入 `practice_records`（`mode='follow'`）与 `learning_records`。

#### 5.6.5 成本与失败控制

- 单次生成限制：`maxTokens` ≤ 4000，`timeoutMs` ≤ 60s（受批次D 服务端上限约束）。
- 失败不落库；保留上一次成功生成的草稿于 `sessionStorage`，防止丢失。
- 同一课程 24 小时内重复生成相同参数时提示“已存在相同场景”，避免重复消耗。

---

## 6. 接口草案

### 6.1 新增接口（少量，且均为只读或聚合）

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/courses/taxonomy` | 返回枚举与版本（唯一来源在 `app/core/taxonomy.py`） |
| GET | `/api/courses/facets` | 按来源/系列/等级体系/等级/技能/主题聚合计数 |
| GET | `/api/courses?sourceType=&seriesName=&levelSystem=&levelValue=&skillFocus=&topic=&q=` | 现有接口扩展筛选参数，不新建资源列表接口 |

`/api/courses/facets` 响应示例：

```json
{
  "taxonomyVersion": "1",
  "total": 12,
  "sourceType": [{ "value": "textbook", "count": 7 }],
  "seriesName": [{ "value": "新概念英语", "count": 4 }],
  "levelSystem": [{ "value": "CEFR", "count": 6 }],
  "levelValue": [{ "value": "B1", "count": 3 }],
  "topic": [{ "value": "daily", "count": 5 }]
}
```

### 6.2 复用接口（不重复实现）

| 能力 | 接口 |
| --- | --- |
| 课程/课时读写 | `GET/POST/PUT/DELETE /api/courses`、`/api/lessons` |
| 音频合成 | `POST /api/tts/generate` |
| 练习事件 | `GET/POST /api/attempt-events` |
| 单元掌握度 | `GET/PUT /api/unit-mastery-items` |
| 练习记录 | `POST /api/practice-records` |
| 学习记录 | `POST /api/learning-records` |
| AI 调用 | `POST /api/ai/chat`、`/api/ai/chat/stream`（批次D） |

### 6.3 明确不新增

- 不新增 `resources`、`roots`、`burn_sessions`、`dialogs` 表。
- 不新增 `/api/reader/*`：句子切分与词卡匹配在前端完成，避免内容二次存储。
- 不新增独立的资源搜索服务：使用现有课程查询扩展参数。

---

## 7. 数据与契约变更

| 变更 | 类型 | 迁移 | 兼容策略 |
| --- | --- | --- | --- |
| `courses.resource_meta` | 新列（JSON，可空） | Alembic 新增一版 | 旧数据为 `NULL`；前端按“未归类”展示，不阻断 |
| `LessonItem.root/rootMeaning/rootGroupId/explanation/exampleTranslations/explanationAudioPath/rootRole` | JSON 内字段 | 无需迁移 | 全部可选，旧数据缺省 |
| `LessonItem.speaker/startMs/endMs` | JSON 内字段 | 无需迁移 | 全部可选 |
| `field_maps.py` 增加 `resourceMeta` | 契约 | 无 | 序列化/反序列化统一 |
| `app/core/taxonomy.py` | 新模块 | 无 | 版本号随枚举变更递增 |

前端类型变更集中在 `shared/types/course.ts`，禁止在页面内重复声明同名接口。

---

## 8. 页面与导航（避免重复入口）

| 能力 | 路由 | 入口 | 说明 |
| --- | --- | --- | --- |
| 资源库 | `/course-repository`（现有） | 顶层“课程仓库” | 页面升级为分类树 + 筛选 + 来源徽标；不改路由 |
| 悬停精读 | `/reader/:lessonId`（新增） | 课时详情“精读”按钮、资源库卡片 | 不新增顶层菜单 |
| 词根模式 | `/lessons/:lessonId/practice`（现有页签） | 课时学习页签 | 不新增路由 |
| 燃尽练习 | `/lessons/:lessonId/practice`（现有页签/模式） | 课时学习页 | 与原练习共用页面 |
| 对话场景 | `/lessons/:lessonId/practice`（dialog 形态） | 生成后在课时内直接进入 | 不新增路由 |
| AI 生成入口 | 课程详情 / AILab | 按钮 | AILab 保留批量生成；单课前不重复放两处 |

导航原则：**顶层菜单不增加**；新增能力全部挂在现有“课程仓库 / 我的学习 / 课时学习”路径下。

---

## 9. 验收标准

### 9.1 功能验收

| 模块 | 验收项 |
| --- | --- |
| 资源库 | 按来源/系列/等级三维筛选结果与 `facets` 计数一致；未归类课程可见且可补填元数据；导入课程自动带 `resourceKey` |
| 词根 | 同一词根自动成组；组内每个派生词含音标/中文/例句；整组听读顺序正确；遮中文回忆可逐词揭示；AI 生成结果通过校验后落库 |
| 燃尽 | 句燃尽可从 k=0 推进到 k=N 并完成；错误回退 1 层；阶段与遮蔽词写入 `attempt_events.extra`；刷新页面可恢复阶段 |
| 悬停精读 | 鼠标在句间移动时只响一段；词卡显示音标/中文/例句；关闭总开关后不自动朗读；键盘可完成同样操作；阅读记录落库 |
| 导入 | SRT/VTT/TXT 均可解析；预览句数与解析结果一致；确认后课程出现在资源库并可精读；重复导入有提示 |
| AI 场景 | 生成 8–16 句、角色一致、目标词覆盖 ≥60%；保存为 dialog 课时；角色扮演可完成一轮；未配置密钥时按钮禁用并提示 |

### 9.2 非功能验收

| 项 | 标准 |
| --- | --- |
| 构建 | `frontend: npm run build` 通过；`backend: python -m compileall -q .\app` exit=0 |
| 后端测试 | 新增接口有单测或至少可复现的 curl 证据；无真实 AI 密钥时使用 Mock |
| 日志 | 新增后端逻辑输出 `info/debug/error` 分级日志，字段含 `course_id/lesson_id/action/latency_ms`，不含密钥与完整正文 |
| 数据安全 | 不提交 `.env`；不把密钥写入前端存储；日志不打印全文 |
| 回归 | 现有练习中心、复习系统、学习计划、统计页功能不退化 |

### 9.3 证据要求

每个切片完成后在 `project-control/TASKS.md` 记录：命令、关键输出、时间、数据清理情况；未执行项标注 `NOT_RUN`。

---

## 10. 开发计划（切片与依赖）

| 切片 | 内容 | 依赖 | 交付判定 |
| --- | --- | --- | --- |
| **F0 方法调研** | 调研 B 站 / YouTube 的英语学习方法，产出 `docs/research/english-learning-methods.md`（5–8 个方法、来源链接、可借鉴点、映射到本设计的功能） | 无 | 文档评审通过；至少有 3 个方法落到本设计条目 |
| **F1 资源元数据与分类** | `app/core/taxonomy.py`；`courses.resource_meta` + Alembic；`field_maps`/contracts；`GET /courses/taxonomy`、`/courses/facets`、列表筛选；资源库页升级（左栏分类树、筛选、徽标、未归类提示） | 无 | 枚举无前端副本；筛选与计数一致；旧数据不报错 |
| **F2 词根扩展** | `LessonItem` 扩展；`wordRoot.ts` 归组；课时“词根模式”；整组听读/遮中文/自测；事件落库；AI 生成 prompt + 校验（AI 部分依赖 D） | F1（资源元数据用于课程标记）、批次D（仅 AI 生成） | 非 AI 部分可独立验收；AI 部分在 D 完成后接入 |
| **F3 燃尽法** | 状态机与判定；词燃尽 0–4 级、句燃尽 0–N；回退与恢复；事件写入 `hint_level_at_submit/extra`；练习页入口与进度展示 | 无（复用现有 TTS/ASR/事件） | 阶段推进/回退/恢复三项实测通过；事件字段可查 |
| **F4 悬停精读** | `sentenceSplit.ts`、`useHoverReader.ts`、`WordCard.vue`、`/reader/:lessonId`、总开关、键盘与移动端降级、TTS 缓存与预取、阅读记录 | 无 | 音频不叠加；词卡来源优先级正确；性能指标达标 |
| **F5 字幕/文本导入** | `subtitleParser.ts`（SRT/VTT/TXT）；导入预览与草稿生成；去重提示；长文拆分课时；`resourceMeta` 自动填充 | F1 | 三种格式均可导入并精读；重复导入有提示 |
| **F6 AI 对话场景** | `dialogScene` prompt、`validateDialogScene.ts`、场景参数对话框、保存为 dialog 课时、角色扮演（复用跟读）、TTS 音色映射、成本限制 | **批次D 完成（硬依赖）**、F1 | 真实密钥下生成并通过校验；角色扮演完成一轮；失败不落库 |
| **F7 全链路验收与收尾** | 端到端：导入 → 资源库筛选 → 精读 → 燃尽 → 词根 → 复习 → 对话；日志与性能复核；文档与台账更新 | F1–F6 | 验收清单全通过；`build`/`compileall` 通过；提交推送 |

实施顺序建议：**F1 → F4 → F3 → F2 → F5 → F6 → F7**；F0 可与 F1 并行（纯文档）。

---

## 11. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 资源元数据破坏历史数据 | 旧课程打不开或保存失败 | 新列可空；契约只做透传；导入前备份 SQLite 并给出回滚脚本 |
| 词根质量不可控 | 错误拆解误导学习 | AI 生成必须人工可编辑；校验词根与派生词数量；标注来源 |
| 燃尽判定过严 | 用户受挫弃用 | 相似度阈值可配置（默认 0.9）；连续错误自动降级/跳过 |
| 悬停朗读误触 | 阅读被打断 | 默认仅句级悬停；总开关；词级 180ms 延迟 |
| TTS 合成延迟 | 朗读不连贯 | Blob 缓存 + 下一句预取 + 失败静默降级 |
| 字幕导入版权 | 合规风险 | 只处理用户本地文件；记录来源；不内置抓取 |
| AI 场景质量与成本 | 生成不可用或费用高 | 结构校验 + 预览编辑；单次 token 上限；同参数 24h 去重 |
| 与批次D 耦合 | F2/F6 阻塞 | F1/F3/F4/F5 完全独立先做；F2 的非 AI 部分先交付 |
| 枚举两处维护 | 分类漂移 | 后端唯一来源 + 前端仅类型；CI/评审检查前端不得出现枚举字面量清单 |

---

## 12. 假设与待确认问题

| # | 假设/问题 | 影响 | 默认方案（若未确认） |
| --- | --- | --- | --- |
| 1 | “句子燃尽”是否按“句末向前逐词遮蔽”理解？ | 交互与判定逻辑 | 采用句末向前遮蔽；提供“功能词优先”作为后续选项 |
| 2 | “词燃尽”是否指逐步遮蔽字母直到听音拼写？ | 阶段设计 | 采用 5 级（全显→首尾→首字母→仅中文→仅发音） |
| 3 | 资源库是否允许“一门课对应一个单元”，还是“一门课对应一整本教材”？ | 导入粒度与课程树深度 | 一门课 = 一个系列单元；整本教材拆多课程并用 `seriesName/seriesOrder` 关联 |
| 4 | 是否允许资源导入时自动调用 AI 补全中文翻译？ | 成本与质量 | 首版不自动补全；提供批量“AI 补全”按钮（依赖批次D） |
| 5 | AI 对话场景是否需要预生成全部音频？ | 存储与等待时长 | 不预生成；按需合成 + 缓存 |
| 6 | “鼠标悬停朗读”是否需要在整篇阅读时自动连读下一句？ | 体验 | 首版只读悬停句；连续播放由显式“播放全文”按钮提供 |

---

## 13. 附录

### 13.1 术语

| 术语 | 定义 |
| --- | --- |
| 燃尽（Burn-down） | 逐级移除提示直到可独立复现的学习机制；做对升级、做错回退 |
| 词根组（Root Group） | 同一词根/词缀下的派生词集合 |
| 悬停精读（Hover Reader） | 鼠标/键盘移动即朗读句子、停留即显示词卡的精读模式 |
| 资源元数据（Resource Meta） | 描述课程来源、系列、等级等属性的结构化 JSON |
| 资源键（Resource Key） | 用于导入去重的规范化字符串 |

### 13.2 状态机伪代码（实现参考，非最终代码）

```text
onEnter(item, mode):
  stage = loadPersistedStage(item.id) or 0
  playReferenceIfNeeded()
  render(stage)

onSubmit(text):
  ok = similarity(text, referenceAt(stage)) >= threshold
  logAttempt(stage, ok)
  if ok:
     streak += 1
     if mode == word or streak >= 2:
        stage += 1
        streak = 0
     if stage > maxStage:
        complete()
  else:
     streak = 0
     stage = max(stage - 1, 0)
     showHint()
  persistStage(item.id, stage)
```

### 13.3 与批次D 的关系（明确边界）

- 批次D 只负责“AI 请求通道与密钥安全”，**不包含**本文任何生成式功能。
- 本文 F2 的 AI 生成与 F6 的对话场景，均以 `/api/ai/chat` 为唯一调用入口，prompt 仍由前端 `shared/services/ai/prompts/*` 维护。
- 批次D 未完成前：F1/F3/F4/F5 可全部实施；F2 仅实施词根浏览、归组、点读与非 AI 自测。
