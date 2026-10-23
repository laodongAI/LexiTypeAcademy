# 英语学习功能需求文档 (LexiType Academy)

版本: 0.1.0  
最后更新: 2025-11-23  
作者: 产品需求初稿 (由 AI 协助)  
状态: Draft

---
## 1. 背景与愿景
LexiType Academy 目前已具备基础的英语学习功能 (单词/句子/文章练习) 与打字训练能力，并引入 TTS 技术实现离线高质量语音合成。下一阶段希望打造一个覆盖“听、说、读、写”四大能力、可持续迭代的 AI 辅助英语学习与复习体系，支持个性化学习路径、精准错误跟踪与智能内容生成，帮助不同水平学习者稳定提升语言综合能力。

目标愿景:
- 构建一个以学员错误数据驱动、动态生成学习内容的自适应平台。
- 让“内容类型 × 学习方式”形成网状组合，任意交叉，避免单一模式疲劳。
- 引入 ASR、语音评分、语法纠错、语义理解等多种 AI 能力，降低人工教研成本。
- 提供可量化、阶段性成长曲线与掌握度图谱 (词汇 / 短语 / 语法结构)。

---
## 2. 当前现状 (Baseline)
| 维度 | 已有 | 不足 |
|------|------|------|
| 内容类型 | 单词 (Word), 句子 (Sentence), 文章 (Article) | 短语/固定搭配、功能语块、话题段落缺失 |
| 学习方式 | 读 (打字+阅读), 听 (TTS 播放) | 说 (口语输出)、写作智能反馈不足 |
| 错误跟踪 | 仅部分记录打字错误或回答情况 | 未区分“词汇错误/发音错误/语法错误/用法错误”分类维度 |
| 复习机制 | 基础重复或简单记忆曲线 | 缺少自适应间隔 (基于错误权重与掌握度模型) |
| 内容生成 | 基础 AI 生成课程 (需手工筛选) | 生成质量与可控性、难度分层与 CEFR 标记缺失 |
| 反馈 | 简单正确/错误 | 未给出针对性讲解、例句拓展、语法/发音建议 |

---
## 3. 总体目标 (SMART)
1. 90 天内上线“听说读写”四能力互通练习链路 (至少 2 种组合模式)。
2. 120 天内实现错误分类与自适应复习，引入词汇、短语、句型、语法结构掌握度评分模型。
3. 180 天内实现 ASR + 发音评分 + 语音跟读对齐 (word-level/phoneme-level)。
4. 180 天内课程内容支持 CEFR 分级 (A1–C1) 与个性化难度推荐 (根据历史正确率与掌握度)。
5. 用户连续 30 天留存提升 15%，错题再次错误率降低 25%。

---
## 4. 用户角色 & 典型使用场景
| 角色 | 需求场景 | 关键痛点 |
|------|----------|----------|
| 新手 (A1–A2) | 建立基础词汇 + 简单句型听说读写 | 记忆遗忘快，发音不标准 |
| 进阶 (B1–B2) | 扩展话题表达、强化语法结构运用 | 内容难度跳跃，缺少针对性复习 |
| 高阶 (C1) | 精准表达 + 写作润色 + 语音自然度提升 | 缺少高级语料与细致反馈 |
| 自学考证 | 针对考试题型训练 + 错题回顾 | 练习分散，错题定位难 |
| 教师/家长 | 查看学生进度与薄弱点 | 缺少可视化报告与预测 |

---
## 5. 术语定义
- "学习单元"：最小内容实体 (词汇、短语、句子、段落)。
- "掌握度"：系统为某单元动态计算的评分 (0–100)。
- "错误分类"：按类型拆分 (拼写、语义、语法、发音、听力识别、使用场景)。
- "复习队列"：基于间隔算法和错误权重生成的下一批练习单元列表。

---
## 6. 功能需求详述
### 6.1 内容类型扩展
- 新增“短语 / 功能语块 (functional chunks)”与“主题段落 (topic paragraph)”。
- 支持多源加载：内置教材库 + AI 生成 + 用户自定义导入 (CSV / 填写)。
- 每个单元附带元数据：CEFR等级、词性、语义标签、话题域 (旅游/商务/日常)、使用频率 (基于语料统计)。

### 6.2 学习方式组合矩阵
| 内容 \ 方式 | 听 | 说 | 读 | 写 |
|-------------|----|----|----|----|
| 单词 | TTS+拼写听写 | 朗读+发音评分 | 打字拼写 | 造句/联想写词组 |
| 短语 | TTS 跟读 | 口语模仿/角色扮演 | 语块替换练习 | 语法重组或改写 |
| 句子 | 听写填空 | 复述/连贯组织 | 跟打+语法标注 | 改错/续写 |
| 段落 | 主旨抓取/听力理解 | 口述总结 | 精读标注/关键词抽取 | 摘要写作/观点扩展 |

### 6.3 错误捕获与分类
- 前端交互层统一错误上报接口: `reportError({ unitId, type, detail, context })`。
- 分类枚举: `SPELLING`, `VOCAB_MEANING`, `GRAMMAR`, `PRONUNCIATION`, `LISTENING`, `SEMANTIC_INAPPROPRIATE`, `FLUENCY`。
- 保存结构 (IndexedDB + 持久化 store):
```ts
interface ErrorRecord {
  id: string;
  unitType: 'word' | 'phrase' | 'sentence' | 'paragraph';
  unitContent: string;
  errorType: ErrorType;
  detail: string; // 描述或 AI 解释
  timestamp: number;
  attemptContext?: { mode: 'listen'|'speak'|'read'|'write'; sourceExerciseId?: string };
  severity: 1|2|3; // 影响程度 (用于加权复习)
}
```
- 服务器端(后期可扩展)用于聚合统计与分布分析。

### 6.4 自适应复习 (Spaced + Weighted Hybrid)
- 基础算法: SM2 改良 + 错误权重 (severity) + 遗忘曲线 (基于时间间隔衰减)。
- 调度公式 (概念):
  - 下一复习时间 = 当前时间 + f(历史正确率, 错误次数, 严重程度, 内容等级)。
  - `复习优先级 = w1*错误率 + w2*时间衰减 + w3*(1-掌握度)`。
- 复习队列生成策略: 保证 70% 弱项 + 30% 新输入 (防止过度重复)。

### 6.5 动态内容再生成
## 17. 交互与 UI 设计建议 (Listening / Speaking / Reading / Writing)

本章节针对“先播放/循环播放/提示播放/听打/跟读/边听边写”等学习场景，提出统一交互模式、组件结构与可配置参数，确保不同内容类型复用一致的 UI 框架。

### 17.1 核心交互模式矩阵

| 模式 | 触发顺序 | 适用内容 | 目标能力 | 关键交互 | 补充特性 |
|------|-----------|----------|----------|----------|----------|
| Listen First | 播放 → 展示文本(可延迟) → 操作 | 单词/短语/句子/段落 | 听力识别 | 自动/手动首播、延迟揭示 | 可配置首播次数 n |
| Type While Listen | 循环播放 → 用户实时打字 → 匹配 | 单词/句子 | 听写 + 拼写 | 播放循环、光标校验 | 错误高亮 + 部分提示 |
| Shadowing Loop | 播放原音 → 倒计时 → 用户跟读录音 → 对齐反馈 | 句子/段落 | 发音/流利 | 自动多轮循环(原音 ↔ 用户) | 每轮评分曲线 |
| Gradual Reveal | 播放 → 显示首字母/下划线 → 用户猜测 → 完整显示 | 单词/短语 | 词形回忆 | 阶梯式提示按钮 | 错误扣分策略 |
| Hint Tiered Playback | 用户失败次数 k → 播放慢速 → 播放分词 → 播放拼写朗读 | 单词/短语 | 精准识别 | 多级 Hint 组件 | 计入 hint 使用率统计 |
| Speak Then Check | 用户先说 → ASR 文本 → 与目标比对 → 播放标准语音 | 句子/段落 | 口语组织 | 录音按钮 + 实时转写 | 语义相似度评分 |
| Write Then Voice | 用户写句子 → TTS 播放其句子 → AI 建议改写 → 朗读改写 | 句子/段落 | 写作 + 听辨 | 原文/改写双声道切换 | 改写差异对比高亮 |
| Batch Review Carousel | 按复习队列水平滑动 → 每个单元支持快速播/跟读/打字 | 任意 | 综合 | 快捷手势/热键 | 统计批次完成率 |

### 17.2 关键 UI 组件结构

| 组件 | 说明 | 主要 Props | 事件 | 性能/可访问性要点 |
|------|------|-----------|------|------------------|
| `AudioPlayer` | 统一播放/循环/速率/AB段 | `src`, `loop`, `rate`, `autoPlay`, `segment` | `onEnd`, `onError` | 提供 aria-label；键盘空格控制 |
| `PlaybackController` | 播放控制条 | `modes=['normal','slow','segment','spell']` | `onModeChange` | 使用 icon+文本双标识 |
| `HintPanel` | 多级提示 | `levels` (数组), `currentLevel` | `onRequestNext`, `onReveal` | 记录 hint 使用次数 |
| `TypingInput` | 听写/拼写输入框 | `expected`, `maskStrategy`, `autoFocus` | `onMatch`, `onMistake` | 实时 diff 高亮；IME 安全 |
| `ShadowingRecorder` | 跟读录音 + 倒计时 | `countdown`, `maxDuration` | `onRecordStart`, `onRecordEnd` | 录音权限检测；显示电平 |
| `PronunciationResultView` | 发音评分展示 | `result` (words[]) | `onSelectWord` | 小屏自动折叠详情 |
| `AdaptiveReviewCarousel` | 批量复习滑动 | `items[]`, `modeFilters` | `onCompleteItem`, `onExit` | 虚拟列表减少重渲染 |
| `ErrorBadge` | 显示错误分类/次数 | `typesCount` | `onClickType` | 统一颜色体系 (语法=紫, 发音=橙) |
| `ProgressBarSession` | 当前 session 完成率 | `total`, `done`, `accuracy` | - | 加入动画节奏减缓疲劳 |
| `HotkeyGuidePopover` | 热键提示 | `shortcuts[]` | `onClose` | ESC 关闭；首次进入自动显示 |

### 17.3 交互流程示例详解

#### A. Listen First + Gradual Reveal (单词学习)

1. 进入单词卡片 → 自动播放标准语音 (可配置 `autoPlayFirst=true`).
2. 初始显示: 下划线或首字母 (e.g. "_pple").
3. 用户尝试输入 → 错误 1 次：可点击“提示 1”显示词性 + 中文释义。
4. 错误 2 次：自动慢速重播 + 显示剩余首字母。
5. 完成后：显示例句生成按钮。
6. 记录：错误次数、hint 层级、完成时间、掌握度更新。

#### B. Shadowing Loop (句子跟读)

1. 播放标准语音 → 倒计时 3s → 开始录音。
2. 录音结束自动调用 ASR → 与原文比对→ 标出错位/漏读单词。
3. 提供“再次跟读”循环按钮 (可设置循环次数上限 n=3)。
4. 每轮评分曲线折线图实时更新。
5. 支持勾选 "自动下一句" 跳转下一内容。

#### C. Type While Listen (听写拼写)

1. 循环播放单词 (默认循环 3 次或直到正确)。
2. 用户输入框实时比对：正确字母绿色，错误红色下划线。
3. 超时或错误 2 次 → 提供慢速 + 分音节播放 (Spell Mode)。
4. 最终正确 → 提示熟练度提升 + 下一个单词预加载。

#### D. Speak Then Check (口语组织)

1. 显示主题提示 (e.g. "Describe your morning routine")。
2. 用户录音 → ASR 转写 → 语义匹配对比目标关键词表。
3. 展示：关键词命中率、语法建议、发音平均分。
4. 支持“重新组织”按钮 → AI 给出更地道版本 + TTS 播放。

### 17.4 提示(Hint)层级设计

| 层级 | 内容示例 | 触发条件 | 掌握度影响 |
|------|----------|----------|------------|
| Level 0 | 无提示 | 默认 | +正常分值 |
| Level 1 | 词性 + 中文释义 | 错误≥1 或手动触发 | -5% 当次提升 |
| Level 2 | 首字母或音标 | 错误≥2 或手动触发 | -10% |
| Level 3 | 完整拼写显示 (需再输入确认) | 错误≥3 | -20% |
| Level 4 | 例句直接展示 | 用户请求拓展 | 不再提升掌握度，仅加体验分 |

掌握度更新建议: `Δscore = baseGain * (1 - hintPenaltyRatio)`。例如 baseGain=8, hintPenaltyRatio(Level2)=0.1 → +7.2。

### 17.5 播放控制策略

- 默认首播: 单词/短语进入自动播放一次；句子/段落需用户点击(避免长文本打扰)。
- 循环播放: 听写/跟读模式允许勾选“循环播放直到正确/完成录音”。
- 模式切换: 普通 → 慢速(0.85x) → 分词/拼读 → AB分段(句子分子句)。
- 声音层叠: 同时展示“我的录音 vs 标准音”对比波形/能量条。
- 快捷键: Space 播放/暂停, Enter 确认, Tab 跳下一单元, Shift+R 重播本轮。

### 17.6 状态与反馈设计

| 状态 | UI 表现 | 记录事件 |
|------|---------|---------|
| 待播放 | 播放按钮高亮 | `session_state=idle` |
| 播放中 | 进度条 + 动态波形 | `audio_play_start` |
| 录音准备 | 倒计时圆环 | `record_countdown` |
| 录音中 | 红色电平条 | `record_start` |
| 比对中 | Loading + Diff 占位 | `asr_processing` |
| 得分展示 | 评分卡片 + 可折叠详情 | `score_display` |
| 提示使用 | HintBadge 标记次数 | `hint_used[level]` |
| 完成 | 绿勾 + 下一项按钮闪烁 | `unit_complete` |

### 17.7 可访问性 (A11y) 与多端适配

- 所有按钮提供 aria-label 与角色属性。
- 高对比度主题: 评分与错误高亮颜色替换为对比度 ≥ 4.5:1。
- 键盘操作全覆盖: Tab 顺序= 播放控件 → 输入区 → 提示 → 下一项。
- 移动端: Shadowing 模式采用全屏底部双大按钮 (重播 / 录音)。

### 17.8 性能与稳定性考量

- 预加载下一单元音频 (低优先级) 减少等待。
- 将录音与 ASR 请求排队，避免并发导致崩溃。
- 大批量复习使用虚拟滚动避免主线程阻塞。
- 组件粒度拆分：播放、录音、评分结果分离，减少重渲染。

### 17.9 事件埋点建议

| 事件 | 字段 | 说明 |
|------|------|------|
| `audio_play_start` | unitId, mode | 播放开始 |
| `audio_play_end` | unitId, duration | 播放结束 |
| `hint_used` | unitId, level | 使用某级提示 |
| `record_start` | unitId | 跟读开始 |
| `record_end` | unitId, duration | 跟读结束 |
| `asr_result` | unitId, accuracy, fluency | ASR 识别输出核心指标 |
| `unit_complete` | unitId, attempts, hintLevelsUsed | 单元完成 |
| `carousel_exit` | completedCount, accuracyAvg | 批量复习退出 |

### 17.10 原型示例 (简化 JSX 草图)

```tsx
<LearningCard unit={unit} mode="listen-first">
  <AudioPlayer src={unit.audio} autoPlay loop={false} />
  <HintPanel levels={hintLevels} currentLevel={current} onRequestNext={nextHint} />
  <TypingInput expected={unit.content} onMatch={handleMatch} />
  <PlaybackController modes={["normal","slow","segment","spell"]} />
  <ProgressBarSession total={sessionTotal} done={done} accuracy={acc} />
</LearningCard>
```

### 17.11 实施优先级 (交互部分)

| 优先级 | 交付 | 理由 |
|--------|------|------|
| P0 | AudioPlayer + TypingInput + HintPanel | 构成最小听写/拼写闭环 |
| P0 | ShadowingRecorder + PronunciationResultView | 搭建口语跟读核心体验 |
| P1 | PlaybackController 模式扩展 (慢速/分词) | 增强可控性与可理解度 |
| P1 | AdaptiveReviewCarousel | 支持批量高效复习 |
| P2 | Write-Then-Voice 流程 | 写作 + 听力联动提升深度 |
| P2 | 语义复述评估集成 | 高阶口语/写作场景 |
| P3 | 情绪/信心检测与智能提醒 | 长期留存与学习节奏调优 |

---
## 18. 后续行动 (交互部分)

1. 组件原型绘制 (Figma) 与命名确认。
2. 定义埋点 schema 与日志字段格式。
3. 选择首批要支持的 Hint 层级与权重参数。
4. 建立 ASR 服务接口规范 (若先云端: 认证/速率限制/降级策略)。
5. 编写最小闭环 Demo (单词听写 + 句子跟读)。
6. A/B 试验计划：Listen First vs Type While Listen 的初学者完成率对比。
本需求文档为英语学习模块的结构化第一版蓝图，后续可根据实现复杂度与真实用户反馈迭代。请相关团队评审：
1. 是否认可阶段目标与 AI 能力优先级。  
2. 数据模型与错误分类是否满足分析需求。  
3. 复习算法与生成策略的最小可行版本 (MVP) 定义是否需要再简化。  

> 下一步: 评审后拆分为具体开发任务 (前端、模型服务、评估算法) 并建立追踪工单。

---
## 17. 交互与 UI 设计建议 (Listening / Speaking / Reading / Writing)
本章节针对“先播放/循环播放/提示播放/听打/跟读/边听边写”等学习场景，提出统一交互模式、组件结构与可配置参数，确保不同内容类型复用一致的 UI 框架。

### 17.1 核心交互模式矩阵
| 模式 | 触发顺序 | 适用内容 | 目标能力 | 关键交互 | 补充特性 |
|------|-----------|----------|----------|----------|----------|
| Listen First | 播放 → 展示文本(可延迟) → 操作 | 单词/短语/句子/段落 | 听力识别 | 自动/手动首播、延迟揭示 | 可配置首播次数 n |
| Type While Listen | 循环播放 → 用户实时打字 → 匹配 | 单词/句子 | 听写 + 拼写 | 播放循环、光标校验 | 错误高亮 + 部分提示 |
| Shadowing Loop | 播放原音 → 倒计时 → 用户跟读录音 → 对齐反馈 | 句子/段落 | 发音/流利 | 自动多轮循环(原音 ↔ 用户) | 每轮评分曲线 |
| Gradual Reveal | 播放 → 显示首字母/下划线 → 用户猜测 → 完整显示 | 单词/短语 | 词形回忆 | 阶梯式提示按钮 | 错误扣分策略 |
| Hint Tiered Playback | 用户失败次数 k → 播放慢速 → 播放分词 → 播放拼写朗读 | 单词/短语 | 精准识别 | 多级 Hint 组件 | 计入 hint 使用率统计 |
| Speak Then Check | 用户先说 → ASR 文本 → 与目标比对 → 播放标准语音 | 句子/段落 | 口语组织 | 录音按钮 + 实时转写 | 语义相似度评分 |
| Write Then Voice | 用户写句子 → TTS 播放其句子 → AI 建议改写 → 朗读改写 | 句子/段落 | 写作 + 听辨 | 原文/改写双声道切换 | 改写差异对比高亮 |
| Batch Review Carousel | 按复习队列水平滑动 → 每个单元支持快速播/跟读/打字 | 任意 | 综合 | 快捷手势/热键 | 统计批次完成率 |

### 17.2 关键 UI 组件结构
| 组件 | 说明 | 主要 Props | 事件 | 性能/可访问性要点 |
|------|------|-----------|------|------------------|
| `AudioPlayer` | 统一播放/循环/速率/AB段 | `src`, `loop`, `rate`, `autoPlay`, `segment` | `onEnd`, `onError` | 提供 aria-label；键盘空格控制 |
| `PlaybackController` | 播放控制条 | `modes=['normal','slow','segment','spell']` | `onModeChange` | 使用 icon+文本双标识 |
| `HintPanel` | 多级提示 | `levels` (数组), `currentLevel` | `onRequestNext`, `onReveal` | 记录 hint 使用次数 |
| `TypingInput` | 听写/拼写输入框 | `expected`, `maskStrategy`, `autoFocus` | `onMatch`, `onMistake` | 实时 diff 高亮；IME 安全 |
| `ShadowingRecorder` | 跟读录音 + 倒计时 | `countdown`, `maxDuration` | `onRecordStart`, `onRecordEnd` | 录音权限检测；显示电平 |
| `PronunciationResultView` | 发音评分展示 | `result` (words[]) | `onSelectWord` | 小屏自动折叠详情 |
| `AdaptiveReviewCarousel` | 批量复习滑动 | `items[]`, `modeFilters` | `onCompleteItem`, `onExit` | 虚拟列表减少重渲染 |
| `ErrorBadge` | 显示错误分类/次数 | `typesCount` | `onClickType` | 统一颜色体系 (语法=紫, 发音=橙) |
| `ProgressBarSession` | 当前 session 完成率 | `total`, `done`, `accuracy` | - | 加入动画节奏减缓疲劳 |
| `HotkeyGuidePopover` | 热键提示 | `shortcuts[]` | `onClose` | ESC 关闭；首次进入自动显示 |

### 17.3 交互流程示例详解
#### A. Listen First + Gradual Reveal (单词学习)
1. 进入单词卡片 → 自动播放标准语音 (可配置 `autoPlayFirst=true`).  
2. 初始显示: 下划线或首字母 (e.g. "_pple")。  
3. 用户尝试输入 → 错误 1 次：可点击“提示 1”显示词性 + 中文释义。  
4. 错误 2 次：自动慢速重播 + 显示剩余首字母。  
5. 完成后：显示例句生成按钮。  
6. 记录：错误次数、hint 层级、完成时间、掌握度更新。  

#### B. Shadowing Loop (句子跟读)
1. 播放标准语音 → 倒计时 3s → 开始录音。  
2. 录音结束自动调用 ASR → 与原文比对→ 标出错位/漏读单词。  
3. 提供“再次跟读”循环按钮 (可设置循环次数上限 n=3)。  
4. 每轮评分曲线折线图实时更新。  
5. 支持勾选 "自动下一句" 跳转下一内容。  

#### C. Type While Listen (听写拼写)
1. 循环播放单词 (默认循环 3 次或直到正确)。  
2. 用户输入框实时比对：正确字母绿色，错误红色下划线。  
3. 超时或错误 2 次 → 提供慢速 + 分音节播放 (Spell Mode)。  
4. 最终正确 → 提示熟练度提升 + 下一个单词预加载。  

#### D. Speak Then Check (口语组织)
1. 显示主题提示 (e.g. "Describe your morning routine")。  
2. 用户录音 → ASR 转写 → 语义匹配对比目标关键词表。  
3. 展示：关键词命中率、语法建议、发音平均分。  
4. 支持“重新组织”按钮 → AI 给出更地道版本 + TTS 播放。  

### 17.4 提示(Hint)层级设计
| 层级 | 内容示例 | 触发条件 | 掌握度影响 |
|------|----------|----------|------------|
| Level 0 | 无提示 | 默认 | +正常分值 |
| Level 1 | 词性 + 中文释义 | 错误≥1 或手动触发 | -5% 当次提升 |
| Level 2 | 首字母或音标 | 错误≥2 或手动触发 | -10% |
| Level 3 | 完整拼写显示 (需再输入确认) | 错误≥3 | -20% |
| Level 4 | 例句直接展示 | 用户请求拓展 | 不再提升掌握度，仅加体验分 |

掌握度更新建议: `Δscore = baseGain * (1 - hintPenaltyRatio)`。例如 baseGain=8, hintPenaltyRatio(Level2)=0.1 → +7.2。

### 17.5 播放控制策略
- 默认首播: 单词/短语进入自动播放一次；句子/段落需用户点击(避免长文本打扰)。  
- 循环播放: 听写/跟读模式允许勾选“循环播放直到正确/完成录音”。  
- 模式切换: 普通 → 慢速(0.85x) → 分词/拼读 → AB分段(句子分子句)。  
- 声音层叠: 同时展示“我的录音 vs 标准音”对比波形/能量条。  
- 快捷键: Space 播放/暂停, Enter 确认, Tab 跳下一单元, Shift+R 重播本轮。  

### 17.6 状态与反馈设计
| 状态 | UI 表现 | 记录事件 |
|------|---------|---------|
| 待播放 | 播放按钮高亮 | `session_state=idle` |
| 播放中 | 进度条 + 动态波形 | `audio_play_start` |
| 录音准备 | 倒计时圆环 | `record_countdown` |
| 录音中 | 红色电平条 | `record_start` |
| 比对中 | Loading + Diff 占位 | `asr_processing` |
| 得分展示 | 评分卡片 + 可折叠详情 | `score_display` |
| 提示使用 | HintBadge 标记次数 | `hint_used[level]` |
| 完成 | 绿勾 + 下一项按钮闪烁 | `unit_complete` |

### 17.7 可访问性 (A11y) 与多端适配
- 所有按钮提供 aria-label 与角色属性。  
- 高对比度主题: 评分与错误高亮颜色替换为对比度 ≥ 4.5:1。  
- 键盘操作全覆盖: Tab 顺序= 播放控件 → 输入区 → 提示 → 下一项。  
- 移动端: Shadowing 模式采用全屏底部双大按钮 (重播 / 录音)。  

### 17.8 性能与稳定性考量
- 预加载下一单元音频 (低优先级) 减少等待。  
- 将录音与 ASR 请求排队，避免并发导致崩溃。  
- 大批量复习使用虚拟滚动避免主线程阻塞。  
- 组件粒度拆分：播放、录音、评分结果分离，减少重渲染。  

### 17.9 事件埋点建议
| 事件 | 字段 | 说明 |
|------|------|------|
| `audio_play_start` | unitId, mode | 播放开始 |
| `audio_play_end` | unitId, duration | 播放结束 |
| `hint_used` | unitId, level | 使用某级提示 |
| `record_start` | unitId | 跟读开始 |
| `record_end` | unitId, duration | 跟读结束 |
| `asr_result` | unitId, accuracy, fluency | ASR 识别输出核心指标 |
| `unit_complete` | unitId, attempts, hintLevelsUsed | 单元完成 |
| `carousel_exit` | completedCount, accuracyAvg | 批量复习退出 |

### 17.10 原型示例 (简化 JSX 草图)
```tsx
<LearningCard unit={unit} mode="listen-first">
  <AudioPlayer src={unit.audio} autoPlay loop={false} />
  <HintPanel levels={hintLevels} currentLevel={current} onRequestNext={nextHint} />
  <TypingInput expected={unit.content} onMatch={handleMatch} />
  <PlaybackController modes={["normal","slow","segment","spell"]} />
  <ProgressBarSession total={sessionTotal} done={done} accuracy={acc} />
</LearningCard>
```

### 17.11 实施优先级 (交互部分)
| 优先级 | 交付 | 理由 |
|--------|------|------|
| P0 | AudioPlayer + TypingInput + HintPanel | 构成最小听写/拼写闭环 |
| P0 | ShadowingRecorder + PronunciationResultView | 搭建口语跟读核心体验 |
| P1 | PlaybackController 模式扩展 (慢速/分词) | 增强可控性与可理解度 |
| P1 | AdaptiveReviewCarousel | 支持批量高效复习 |
| P2 | Write-Then-Voice 流程 | 写作 + 听力联动提升深度 |
| P2 | 语义复述评估集成 | 高阶口语/写作场景 |
| P3 | 情绪/信心检测与智能提醒 | 长期留存与学习节奏调优 |

---
## 18. 后续行动 (交互部分)
1. 组件原型绘制 (Figma) 与命名确认。  
2. 定义埋点 schema 与日志字段格式。  
3. 选择首批要支持的 Hint 层级与权重参数。  
4. 建立 ASR 服务接口规范 (若先云端: 认证/速率限制/降级策略)。  
5. 编写最小闭环 Demo (单词听写 + 句子跟读)。  
6. A/B 试验计划：Listen First vs Type While Listen 的初学者完成率对比。  

