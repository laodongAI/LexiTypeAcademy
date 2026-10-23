# Teaching Engine：练习页教学反馈 UI/交互规范（v0.1）

## 背景与目标
教学引擎（Teaching Engine）用于把练习后的“判定/评分”转化为可执行的教学反馈，形成稳定的学习闭环。

目标：
- **离线可用**：无 AI 配置时，仍能给出稳定一致的提示与下一步建议。
- **AI 可选增强**：AI 配置可用时，生成更自然、更具体的教学反馈（结构化 JSON，便于渲染）。
- **统一体验**：听写、跟读/模仿等模式的提示层级与反馈面板一致，减少每个 mode 的分叉实现。

非目标（v0.1）：
- 音素级诊断、词级强制对齐与可视化（后续版本）。
- 全局任务中心、错误画像落库（由后续需求驱动）。

## 触发时机与流程
### 1) 规则层（必选）
- 在“提交答案/提交录音并完成评分”后，调用 teachingEngine 的评估函数生成：
  - `correct/passed`、`errorTypes`、`nextHint`、`similarity(听写)` 等。
- 规则层结果必须**立即可渲染**，不依赖网络或 AI。

### 2) AI 增强层（可选）
- 满足以下条件时才触发 AI：
  - `getAIService().isConfigured() === true`
  - 练习结果面板已展示（避免提交前触发）
- AI 调用失败不影响规则层展示：仅显示错误提示 `feedbackError`，用户仍可继续练习。

## 面板结构（当前落地）
### A. 听写（DictationMode）
- 结果区展示：
  - 是否正确、相似度（百分比）、答案/用户输入（原组件既有/已改造）
- 提示（Hint）：
  - 通过提示按钮提升 Level（多次点击/多次错误递进），显示 `nextHint.title/content`
- AI 教学反馈：
  - 标题：AI 教学反馈
  - 状态：生成中 / 失败 / 未配置（占位）
  - 内容：summary + strengths + issues(message+suggestion) + nextSteps

### B. 模仿/跟读（ImitationMode）
- 结果区展示：
  - accuracy/fluency/completeness/overall
- 提示（Hint）：
  - 基于 `ScoreDetail` + 尝试次数生成 `nextHint`
  - 无 AI 时也展示该 `nextHint`
- AI 教学反馈：
  - 同 DictationMode

### C. 跟读（FollowMode）
- 结果区展示：
  - overall 分数 + 提示语
- 提示（Hint）：
  - 基于 `ScoreDetail` + 尝试次数生成 `nextHint`
- AI 教学反馈：
  - 同 DictationMode

### D. 翻译（TranslationMode）
- 结果区展示：
  - 参考答案/用户输入/相似度
- 提示（Hint）：
  - 使用规则层 `evaluateDictation()` 产出 `nextHint`（按尝试次数递进）
- AI 教学反馈：
  - 同 DictationMode

## 状态与交互细节
- `feedbackLoading`：展示“生成中...”状态；结束后隐藏。
- `feedbackError`：展示一行错误文本（不弹窗打断）。
- `feedbackPlaceholder`：AI 未配置时展示“未配置 AI 时将只显示基础提示。”

## 组件间职责划分（当前演进）
- `LessonPracticePage.vue`：提供容器级 `useTeachingFeedback()`（`provide/inject`），统一反馈状态与调用入口。
- 各 mode 组件：优先 `inject` 容器上下文；若无上下文则回退到本地 `useTeachingFeedback()`，保证组件可独立使用。

## 结构化数据契约（用于 UI 渲染）
- 规则层输出：
  - `TeachingHint { level, title, content }`
- AI 输出（TeachingFeedbackResponse）：
  - `summary: string`
  - `strengths: string[]`
  - `issues: Array<{ type, message, suggestion, severity }>`
  - `nextSteps: string[]`

## 与现有实现的对应关系
- 规则层（Teaching Engine）：
  - `vue-app/src/shared/services/teaching/teachingEngine.ts`
  - `vue-app/src/shared/services/teaching/teachingTypes.ts`
- AI 增强层：
  - `vue-app/src/shared/services/ai/prompts/teachingFeedback.ts`
  - `vue-app/src/shared/services/ai/aiService.ts` (`generateTeachingFeedback`)
- UI 落地：
  - `vue-app/src/renderer/components/practice/DictationMode.vue`
  - `vue-app/src/renderer/components/practice/ImitationMode.vue`
  - `vue-app/src/renderer/components/practice/TeachingFeedbackPanel.vue`（复用面板组件）

## 后续演进（下一阶段）
- 在 `LessonPracticePage.vue` 抽象通用的“教学反馈面板”容器，减少重复。
- 抽取 `useTeachingFeedback()` 以复用 AI 反馈状态与调用（避免各 mode 重复实现 loading/error/reset）。
- 统一尝试次数与提示 Level 的存储/重置策略（跨题目/跨 session）。
- 引入“错误记录事件”上报（为复习队列与专项课程生成提供数据基础）。
