# PracticeAttemptEvent（事件化学习记录）最小落库设计

## 背景
现有学习记录/练习记录更偏“汇总型”（例如一组练习后的准确率、时长）。为了支撑后续：
- 复习队列（SM2 + 错误权重 + 遗忘曲线）
- 弱项专项课程生成
- 练习模式横向分析（同一单元在不同模式的表现）

需要一个更细粒度、可追加的“事件流”数据底座。

## 目标（MVP）
- 每次用户在练习模式点击“提交”后，写入一条事件到 IndexedDB。
- 不影响现有 UI 与练习流程：写入失败静默降级。
- 数据必须可结构化克隆（IndexedDB）：禁止写入 Blob/Proxy/函数。

## 数据模型
类型定义：
- vue-app/src/shared/types/practiceAttemptEvent.ts

核心字段：
- courseId / lessonId：练习上下文
- unitId：题目单元（通常为 LessonItem.id）
- mode：dictation / translation / follow / imitation
- correct / attemptCount：结果与次数
- hintLevelAtSubmit / nextHintLevel：提示使用与引擎建议
- similarity（听写/翻译，0-1）或 scoreDetail（跟读/模仿）

## 存储设计（Dexie）
数据库定义：
- vue-app/src/shared/database/index.ts

新增表：practiceAttemptEvents
- 主键：++id
- 索引：courseId, lessonId, unitId, mode, createdAt

版本：
- 从 version(1) 升级到 version(2)，新增表，无需迁移旧数据。

## 写入链路
- 服务：vue-app/src/shared/services/practiceAttemptEventService.ts
  - recordPracticeAttemptEvent(input)
  - 写入失败仅 console.warn，不阻塞 UI。

- 上下文注入：vue-app/src/renderer/composables/practiceAttemptContext.ts
  - LessonPracticePage provide(courseId, lessonId)
  - 各 Mode inject 后在提交点写入事件

## 非目标（本次不做）
- 事件消费：复习队列/专项课程生成的消费与聚合逻辑
- 与 LearningRecord / PracticeRecord 的替换或合并
- 数据上报/同步到服务端

## 已实现的最小消费（不改 UI）
为便于后续接入“复习队列”，目前实现了一个最小消费链路：
- 每次写入 PracticeAttemptEvent 后，会立即尝试消费该事件，更新 unitId+mode 维度的 SM2 参数。
- 新增两张表：
  - unitMasteryItems：按 [courseId+unitId+mode] 维护掌握度、nextReview、EF 等
  - unitReviewLogs：记录每次消费对应的 quality/correct/weakDimensions

相关实现：
- vue-app/src/shared/services/unitReviewService.ts
- vue-app/src/shared/database/repositories/unitReviewRepository.ts
- vue-app/src/shared/types/unitReview.ts
