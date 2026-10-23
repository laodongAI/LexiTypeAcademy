# REQ-TEACHING-ENGINE-001：对课程仓库与生成课程模块的需求

## 目标
为“Teaching Engine（教学引擎）”在练习闭环中提供稳定的数据基础：
- 练习题目必须携带足够的元信息（参考文本、中文提示、音频等）支撑规则层与 AI 增强层。
- 教学反馈（提示层级、错误类型、评分摘要）可被记录并用于复习队列/专项课程生成。

## 对课程仓库（Course Repository）的需求
### REQ-TEACHING-ENGINE-001-A：学习单元最小字段
课程仓库的学习单元（word/phrase/sentence/paragraph）至少应提供：
- `unitId`：稳定唯一标识（可用于错误记录与复习队列）。
- `unitType`：内容类型。
- `english`：参考文本（规则层与 AI 提示的核心）。
- `chinese`（可选）：中文提示（用于 Hint Level 1 与 AI 解释）。
- `audio`（可选）：标准音频（跟读/听写/Listen First 等模式复用）。
- `meta`（可选）：难度/CEFR、主题、来源（教材/AI 生成/用户导入）、可用于个性化策略。

### REQ-TEACHING-ENGINE-001-B：练习模式可用性标记
课程仓库需能表达某单元支持哪些练习模式，以避免运行时临时判断：
- `availablePracticeModes: TeachingMode[]`（如 dictation/imitation/translation 等）。

### REQ-TEACHING-ENGINE-001-C：事件化学习记录（为复习/专项课程准备）
仓库/学习系统应提供统一事件记录接口（可落 IndexedDB）：
- `PracticeAttemptEvent`（建议新增模型）：
  - `unitId, unitType, mode`
  - `attemptCount`（本次题目内的次数）
  - `result`: correct/passed
  - `metrics`: similarity(听写)/overallScore(跟读)/分项评分
  - `errorTypes: TeachingErrorType[]`
  - `hintLevelUsed: HintLevel`（本次展示/使用的最高提示级别）
  - `timestamp`
用途：复习队列权重、专项课程触发阈值统计、教学策略优化。

### REQ-TEACHING-ENGINE-001-D：教学反馈可选落库
为可回看与复盘（以及后续“学习报告”）：
- 可选存储 `TeachingFeedbackResponse`（AI 生成）
  - 需要标记 `provider/model` 与 `generatedAt`
  - 建议存“摘要+要点”，避免过大载荷

## 对生成课程模块（Course Generation）的需求
### REQ-TEACHING-ENGINE-001-E：生成结果必须携带教学引擎所需字段
无论来源（音频/中文/教材导入），生成课程时确保：
- 每个单元都具备 `english`，并尽可能提供 `chinese`。
- 对于句子/段落：优先生成更干净的参考文本（减少多余标点/格式），利于相似度评估。

### REQ-TEACHING-ENGINE-001-F：生成时输出“可教性元信息”（可选）
用于教学提示更具体且更可控：
- `keywords`（核心词汇/短语）
- `commonMistakes`（易错点：时态/介词/连读等，允许为空）
- `topic/scene`（场景标签，支撑语义化建议）

### REQ-TEACHING-ENGINE-001-G：音频生成与缓存策略对齐
Teaching Engine 依赖可重复播放与快速获取：
- 生成课程时的 TTS 音频应写入统一缓存（现有 tts-cache）并在单元上引用。
- 明确音频缺失时的降级策略（仍可做翻译/听写文本类练习）。

## 验收标准（v0.1）
- 课程仓库中的任意 sentence 单元可在听写/模仿模式下触发教学提示与（可选）AI 教学反馈。
- 生成课程的单元字段满足 Teaching Engine 的最小输入要求。
- 练习结束能产出可用于统计的 attempt 事件（即使暂未做复习队列消费）。
