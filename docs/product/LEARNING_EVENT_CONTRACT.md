# 统一学习事件契约与统计口径

> 状态：契约已定义，第一批生命周期事件已接入；仍需类型检查、集成测试与真实数据核对。
> 当前存储策略：事件暂时写入 SQLite 中现有 `ai_task_logs` 的 JSON 字段（类型为 `learning_event`），避免未准备独立迁移时改动现有业务表。它是过渡实现，不是最终规范化事件表。

## 1. 核心原则

1. **事实数据与生命周期事件分开。** 课程进度、练习记录、复习日志、学习计划任务仍是各自业务事实的权威来源；生命周期事件只用于串联流程、恢复诊断与后续分析。
2. **不重复统计。** `learning_event` 不计入练习次数、复习词数、课程完成数或学习分钟；统计页继续使用原业务记录。
3. **时间单位明确。** 所有事件时间均为毫秒 Unix 时间戳；`durationMs` 仅表示该事件描述的活动耗时，不能与学习列表累计时长直接相加。
4. **明确完成边界。** 打开课时不等于完成课时；提交练习不自动代表课时完成；提交复习结果才算一次复习结果；结束对话不代表掌握度提高。
5. **AI 反馈不自动改变掌握度。** AI 教学/面试输出可作为建议或会话记录，只有用户明确完成的课程练习、复习等业务流程才更新对应业务记录。

## 2. 事件契约

```ts
type LearningEventType =
  | 'lesson_started'
  | 'practice_submitted'
  | 'lesson_completed'
  | 'lesson_abandoned'
  | 'review_submitted'
  | 'study_plan_task_completed'
  | 'conversation_completed'
  | 'conversation_abandoned'
  | 'conversation_feedback_saved'

interface LearningEvent {
  eventId: string
  eventType: LearningEventType
  occurredAt: number
  courseId?: string
  lessonId?: string
  activityId?: string
  durationMs?: number
  result?: {
    correctCount?: number
    totalCount?: number
    accuracy?: number
  }
  metadata?: Record<string, unknown>
}
```

## 3. 事件语义和触发点

| 事件 | 触发条件 | 权威业务记录 | 是否计入指标 |
|---|---|---|---|
| `lesson_started` | 课时内容成功加载，开始本次访问 | `courseProgress.currentLessonId` | 不直接计数 |
| `practice_submitted` | 练习记录已成功写入后端 | `practice_records` | 练习次数只统计练习记录 |
| `lesson_completed` | 课堂完成流程调用进度同步后 | `courseProgress.completedLessonIds` | 完成课时只统计进度集合 |
| `lesson_abandoned` | 离开课堂或切换课时，且本次访问未完成 | 当前课时进度仍保留，供恢复 | 不视为完成 |
| `review_submitted` | 单次复习日志或批量复习结果已保存 | `review_logs` / `unit_review_logs` | 复习数只统计复习日志 |
| `study_plan_task_completed` | 自定义计划任务完成状态保存成功 | `study_plan_tasks.done_at` | 任务完成数只统计计划看板 |
| `conversation_completed` | 用户明确结束 AI 对话 | `ai_task_logs` 中的会话记录 | 不直接增加学习分钟或掌握度 |
| `conversation_abandoned` | 用户将 AI 对话标记为放弃 | `ai_task_logs` 中的会话记录 | 不视为学习完成 |
| `conversation_feedback_saved` | 用户主动把面试反馈加入今日计划 | 学习计划中的持久化自定义任务 + 事件关联元数据 | 只计计划任务，不直接增加掌握度 |

## 4. 幂等与持久化

- 每条事件包含 `eventId`；课时访问、练习记录和计划任务优先使用与业务 ID 关联的确定性 ID。
- 当前实现会检查最近 500 条 `learning_event` 记录避免常规重试重复写入。
- **限制：** 该检查不是数据库唯一约束，无法保证并发下的强幂等，且只扫描最近 500 条。进入正式生产前，应增加独立 `learning_events` 表、`event_id` 唯一索引和 Alembic 迁移。
- 业务记录写入成功后，事件写入失败只记录警告，不回滚已保存的练习/复习/任务；事件日志不能成为阻断学习的单点。
- 当前会话记录复用现有 `ai_task_logs` JSON 输入字段保存场景、消息和状态；这减少了第一阶段的迁移风险，但未来应迁移为 `conversation_sessions` 与 `conversation_messages` 规范化表，支持消息分页、并发保护与会话索引。

## 5. 学习时长口径

- 学习列表字段 `totalStudyTime` 当前业务服务按**分钟**解释；后端模型注释曾标为毫秒，需以数据迁移/历史值核对结果决定是否进行单位换算。
- 课堂点评记录 `learning_records.duration` 为毫秒，属于活动耗时。
- 练习记录 `practice_records.duration` 为毫秒，属于练习耗时。
- 计划看板的 `today.minutes` 是后端聚合后的计划内学习分钟，不是可以与上述耗时直接相加的另一份独立事实。
- 在查清不同记录覆盖范围之前，不得把课堂点评耗时、练习耗时、学习列表累计分钟、计划打卡快照相加生成“总学习时长”。
- 建议最终统一使用事件时间线推导有效学习区间：相邻事件合并、空闲阈值、并行活动去重规则必须经产品确认后再实现。

## 6. 已接入的事件发布位置

- `courseRepository.addPracticeRecord`：练习记录保存后发布 `practice_submitted`。
- `ClassroomPage.vue`：进入课时、完成课时、离开未完成课时分别发布开始/完成/放弃事件。
- `reviewService.ts`：单次复习保存后发布事件；批量复习以一条汇总事件记录，避免 N 次额外请求。
- `HomePage.vue`：自定义计划任务保存为完成后发布事件。
- `ConversationPage.vue` / `conversationCoreService.ts`：会话持久化并由用户明确结束/放弃后发布对话生命周期事件。
- `ConversationPage.vue`：用户主动将英语面试反馈加入今日学习计划时，先持久化计划任务，再发布 `conversation_feedback_saved` 关联事件；不会自动把 AI 评分写成掌握度。

## 7. 验收清单

- [ ] 重试同一业务请求不会重复增加权威业务指标。
- [ ] 事件写入失败不影响已经保存的业务记录。
- [ ] 刷新/重启后会话与课时恢复位置可用。
- [ ] 未完成退出只产生放弃事件，不标记课时完成。
- [ ] 复习事件与复习日志条数的统计口径一致（批量事件为汇总，不作为单词数）。
- [ ] 学习分钟经过历史数据核对后统一单位。
- [ ] 正式化独立事件表后，通过唯一约束实现强幂等，并为旧事件制定迁移策略。
