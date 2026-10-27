# AI 教学与英语面试：共享对话内核设计路线

> 本文定义后续架构与验收基线。当前分支已存在课堂老师语音引导与 AI 内容生成能力，但尚未证明存在可复用、带持久化会话的统一对话内核；因此本阶段不另建孤立的“AI 老师”和“面试机器人”。

## 1. 产品原则

1. **先统一学习数据，再扩展对话体验。** AI 对话可以读取学习记录与复习薄弱点，但不能自行制造学习进度。
2. **一个对话内核，多种教学场景。** AI 教学、自由口语、英语面试、角色扮演共享会话生命周期、消息结构、模型适配、上下文裁剪、错误处理和记录持久化。
3. **场景配置与运行时分离。** “英语面试”是场景包，不应复制一份聊天 UI、请求逻辑和消息存储。
4. **AI 反馈可追溯。** 区分用户原话、ASR 转写、模型建议、评分和学习事件；不把模型自评等同于客观能力测量。
5. **本地优先、渐进增强。** AI Provider 不可用时，词汇、课程、复习、学习进度等基础功能仍可用。

## 2. 当前代码事实与边界

- `ClassroomPage.vue` 有沉浸式课堂，支持精读、句子燃尽、词燃尽、词根等模式。
- `useTeacherGuide` 负责确定性台词、TTS 播放、优先级打断和重复事件去重；这是课堂语音引导，不等同于具备多轮上下文的 LLM 对话引擎。
- `AIToolsOptimizedPage.vue` 主要围绕 AI 生成课程内容组织界面。
- 当前分支尚未完成“通用会话持久化 + 场景化策略 + 学习事件联动”的完整审计，不能据此宣称已有可直接复用的通用对话模块。

## 3. 建议架构

```text
AI Learning Experiences
├── AI Tutor Scenario
├── English Interview Scenario
└── Role-play / Free Conversation Scenario
            │
            ▼
Reusable Conversation Core
├── Session lifecycle (create/resume/end)
├── Message/turn model + transcript
├── Context builder (learner profile + recent learning evidence)
├── Prompt/scenario policy registry
├── Model/provider adapter
├── Streaming/cancel/retry/error handling
├── Evaluation & feedback pipeline
└── Persistence + learning-event publisher
            │
            ├── Existing AI backend proxy / provider settings
            ├── ASR/TTS services
            └── Unified learning data / SQLite
```

### 核心模块职责

| 模块 | 负责 | 不负责 |
|---|---|---|
| Conversation Core | 会话、轮次、消息、取消/重试、上下文、持久化、错误状态 | 写死某种场景的教学规则 |
| Scenario Registry | 场景 ID、角色、目标、系统指令、难度、可用工具、反馈策略 | 复制聊天 UI 和网络层 |
| Learner Context Builder | 只从已保存的课程、练习、复习事件提取学习上下文 | 将模型猜测当成用户事实 |
| Provider Adapter | 统一请求/流式响应/超时/取消/错误结构 | 保存业务学习进度 |
| Evaluation Pipeline | 维度评分、证据、纠错建议、置信度与限制 | 把模型生成的分数直接当成标准化考试分 |
| Learning Event Publisher | 对明确完成的学习活动发布事件 | 把每条聊天消息都算作一次学习完成 |

## 4. 最小数据契约（设计草案）

```ts
type ConversationScenarioId = 'ai-tutor' | 'english-interview' | 'role-play'

interface ConversationSession {
  id: string
  scenarioId: ConversationScenarioId
  title: string
  status: 'active' | 'completed' | 'abandoned'
  startedAt: number
  updatedAt: number
  endedAt?: number
  linkedCourseId?: string
  linkedLessonId?: string
  scenarioConfig: Record<string, unknown>
}

interface ConversationMessage {
  id: string
  sessionId: string
  turnIndex: number
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  createdAt: number
  inputMode?: 'text' | 'speech'
  transcriptStatus?: 'final' | 'partial'
  metadata?: Record<string, unknown>
}

interface ConversationEvaluation {
  id: string
  sessionId: string
  messageId?: string
  dimensions: Array<{
    key: string
    score?: number
    evidence: string[]
    feedback: string
    confidence?: number
  }>
  summary: string
  limitations: string[]
  createdAt: number
}
```

这是用于评审的草案，尚未实现。落库前应确认 SQLite schema、迁移版本、会话清理/导出、敏感内容保留策略，以及旧数据兼容。

## 5. 两个场景如何共享内核

### AI 教学

- 输入上下文：当前课程/课时、学习者选择的目标、最近练习错误、到期复习词、历史反馈。
- 交互：讲解 → 提问 → 学习者回答 → 纠错与示例 → 小练习 → 学习者确认完成。
- 输出：解释、例句、可选 TTS、下一步建议。
- 学习事件：仅在明确完成练习或课程活动时写入；普通问答只作为会话记录，不自动提升掌握度。

### 英语面试

- 输入上下文：岗位、行业、经验年限、面试语言/难度、目标问题类型。
- 交互：面试官逐题提问 → 用户文本或语音回答 → 追问 → 结束后反馈。
- 反馈维度：回答相关性、结构、语法、词汇准确性、表达清晰度、论证具体性；口音/发音只有在实际使用可验证的语音信号时才评价。
- 评分要求：展示具体原句证据、改写示例和下一轮练习建议；说明评分为 AI 辅助反馈，不冒充真实招聘方评价。
- 学习事件：保存面试练习次数、耗时、用户确认的薄弱项和练习建议；不能把面试评分直接覆盖课程掌握度或 SM-2 词汇掌握度。

## 6. 推荐实施顺序

1. 完成学习数据审计与首页恢复学习闭环。
2. 定义统一学习事件契约，核实重复记录和时间单位。
3. 盘点现有 AI Provider 代理、模型设置、流式返回、ASR/TTS 与日志能力。
4. 抽取 Conversation Core：先做纯文本会话、持久化、恢复、取消/错误状态。
5. 先接入 AI 教学场景，验证学习上下文与学习事件边界。
6. 复用同一内核接入英语面试场景，增加场景表单、逐题流程和结束评估。
7. 最后加入语音对话，处理录音授权、ASR 中间态、TTS 打断、播放失败与转写修正。

## 7. 验收要求

- [ ] AI 教学与英语面试使用同一消息/会话模型、Provider adapter 和持久化机制。
- [ ] 刷新或重启后可以恢复未结束会话；明确支持结束与放弃状态。
- [ ] 切换场景不会串用另一场景的系统指令、历史上下文或评估规则。
- [ ] 模型超时、无配置、网络错误、取消生成、空响应都有可恢复状态。
- [ ] 学习者上下文来自可追溯的已保存数据，允许用户查看/纠正关键输入。
- [ ] AI 评价带证据与局限性，不伪装成标准化考试或真实面试结果。
- [ ] 对话消息、复习记录、练习记录与课程完成状态有明确边界。
- [ ] 关键对话操作有单测/集成测试；语音流程还需实机验证。

## 8. 当前实现状态（2026-10-24）

- 架构方向：已定义。
- 共享前端对话内核：第一版已提交，统一调用现有 `/api/ai/chat` Provider 代理。
- 会话持久化：第一版已实现，复用 SQLite 中现有 `ai_task_logs` JSON 字段保存场景、消息、状态和关联课程；刷新后可读取历史会话。
- 场景：同一页面已接入 AI 英语教学与英语面试两种系统指令，不复制请求与消息层。
- 学习上下文：AI 教学新会话可读取首页学习看板中的当前课程、课时、完成比例和到期复习词；上下文来自已保存数据，读取失败时仍允许普通对话。
- 生命周期事件：用户明确结束/放弃会话后发布对应学习事件；对话本身不自动更新课程完成度或 SM-2 掌握度。
- 反馈闭环：英语面试场景可由用户主动将反馈转为今日学习计划任务；任务写入计划 API 后再记录关联事件。AI 分数不会自动覆盖词汇掌握度或课程进度。
- 尚未验证：前端类型检查/构建、后端实际 AI 配置、刷新恢复、超时/失败重试、长会话 token 管理、真实面试反馈质量。
- 架构限制：当前复用 JSON 日志存储是迁移友好的第一阶段方案，不是最终规范化模型。后续应引入 `conversation_sessions`、`conversation_messages` 表与迁移，并增加消息分页、并发保护、会话删除/导出和数据保留策略。


## 9. 语音交互实现进展（2026-10-27）

第一切片已在 `ConversationPage.vue` 接入现有语音服务：

- AI 回复提供按需 TTS 朗读入口，复用 `generateSpeech`。
- 用户可以授权麦克风后录音，通过 `MediaRecorder` 生成 Blob 并调用 `asrApiService.recognize`；识别文本只填入草稿，由用户确认后发送。
- 提供麦克风拒绝、能力不支持、空录音和 ASR 失败提示，并在组件卸载时清理录音轨道和音频播放。
- 本切片尚未实现自动收音、静音检测、AI 播放结束后自动接续，也未做实机验证。后续先确认 CI 与浏览器运行结果，再设计显式可暂停/可停止的语音状态机，避免误收音或错误自动发送。
- 状态：`IMPLEMENTED_UNVERIFIED`；浏览器、麦克风、ASR/TTS 端到端验收：`NOT_RUN`。
