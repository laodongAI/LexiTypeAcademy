# AI Lab 功能补全实施计划 (Phase 4-5)
**日期**：2025年12月8日  
**优先级**：🔴 HIGH  
**状态**：待批准  

---

## 核心发现总结

### 现状
✅ **已完成**：
- AI Lab菜单项在Navigation中正确显示
- AILabPage.tsx框架完成，包含5个功能卡片的UI
- Phase 3 事件溯源架构已完成（2,357行）

❌ **严重缺失**：
- **所有5个AI Lab子功能都是"开发中"状态**（无实际实现）
- **设计覆盖率仅60%** (5个功能中3个无设计规范)
- **DDD实现缺失9个聚合根、4个值对象、5个服务**

### 设计-实现缺口表

| 功能 | UI | 设计 | 后端服务 | 聚合根 | 优先级 |
|-----|---|------|--------|------|------|
| 课程生成器 | ✅ | ✅ | ❌ | ❌ | 🔴 |
| 教材导入 | ✅ | ✅ | ❌ | ❌ | 🔴 |
| 弱词复习 | ✅ | ❌ | ❌ | ❌ | 🟠 |
| 自由写作 | ✅ | ❌ | ❌ | ❌ | 🟠 |
| 任务历史 | ✅ | ❌ | ❌ | ❌ | 🟠 |

---

## 立即行动项 (Week 1)

### 1️⃣ 设计文档补全 (优先级最高)

**任务**：为"弱词复习"、"自由写作"、"任务历史"补充设计规范

**输出**：
- [ ] 补充课程-and-ailab-ddd-design-v0.4.1.md 中的 5.2, 5.4, 5.5, 5.6 章节
- [ ] 每个新章节包含：功能定义、聚合根、值对象、服务接口、事件、仓储
- [ ] 更新目录表

**预计工作量**：4-6h

### 2️⃣ 核心值对象实现 (启用所有AI Lab功能的基础)

**创建文件**：`src/domain/valueobjects/`

```typescript
// 需要实现的4个值对象：

1️⃣ Difficulty.ts (75行)
   - 枚举：A1, A2, B1, B2, C1, C2
   - getNumericLevel()：返回1-6
   - isHigherThan(other)
   - getVocabularyRange()
   - getEstimatedLearningHours()

2️⃣ Score.ts (60行)
   - 范围：0-100
   - isPassing(threshold=80)
   - isCritical()
   - getLevel()：A/B/C/D/F

3️⃣ Accuracy.ts (80行)
   - 多维度：phonemeAccuracy, fluency, completeness, prosody
   - calculateCompositeScore(weights)
   - 默认权重：[0.4, 0.3, 0.2, 0.1]

4️⃣ ReviewInterval.ts (70行)
   - SM-2算法实现
   - intervalDays: number
   - easeFactor: 1.3-2.5
   - fromScore(score, currentInterval, repetitionCount)
   - getNextReviewDate()
```

**预计工作量**：3-4h  
**优先级**：🔴 必需

### 3️⃣ AI Lab菜单状态决策 (用户确认)

**选项A**：禁用AI Lab菜单（推荐短期方案）
```typescript
// Navigation.tsx 中修改为：
{ 
  id: 'ai', 
  label: 'AI 实验室',
  enabled: false  // ← 禁用，等Phase 10完成再启用
}
```
**优点**：避免用户看到"开发中"，减少困惑  
**缺点**：功能不可见

**选项B**：替换AI Lab为"功能规划"占位页面
```typescript
// 显示：本功能将在Phase 4-5实现，包含课程生成、学生能力建模等
// 允许用户查看设计文档、提交反馈
```

**选项C**：保持现状，标记为"预发布"
```typescript
// 保留菜单和"开发中"卡片，用于早期反馈
```

**建议**：选项A（禁用） + 在Navigation中添加"🔜 即将上线"提示

---

## Phase 4 实施计划 (2-3周)

### Sprint 1: DDD基础架构 (Week 1-2)

#### Task 1.1: 实现核心值对象 (已在立即行动中)
- Difficulty ✅
- Score ✅
- Accuracy ✅
- ReviewInterval ✅

**验收**：所有值对象通过TypeScript编译，包含单元测试

#### Task 1.2: 实现LanguageAbilityAggregate
**文件**：`src/domain/aggregates/LanguageAbilityAggregate.ts`

```typescript
export class LanguageAbilityAggregate {
  // 核心属性 (来自设计5.3)
  userId: string;
  currentDifficulty: Difficulty;
  listeningLevel: Difficulty;
  speakingLevel: Difficulty;
  vocabularyMastery: VocabularyMastery;
  
  // 核心方法
  static create(userId: string): LanguageAbilityAggregate
  updateFromLessonPractice(lessonId, courseId, accuracy, score)
  recommendNextCourseDifficulty(): Difficulty
  getProgressReport(): ProgressReport
  
  // 内部方法
  private increaseDifficulty(reason)
  private decreaseDifficulty(reason)
  private calculateListeningLevel(accuracy)
  private calculateSpeakingLevel(accuracy)
}
```

**工作量**：6-8h  
**依赖**：Difficulty值对象

#### Task 1.3: 实现VocabularyMastery值对象
**文件**：`src/domain/valueobjects/VocabularyMastery.ts`

```typescript
export class VocabularyMastery {
  masteredWords: Set<string>;
  targetCount: number;
  
  getMasteredCount(): number
  getMasteryPercentage(): number
  getLevel(): Difficulty
  addWord(word: string): void
}
```

**工作量**：2-3h

#### Task 1.4: 实现IRecommendationService接口
**文件**：`src/domain/services/IRecommendationService.ts`

```typescript
export interface IRecommendationService {
  recommendCourses(ability: LanguageAbilityAggregate, limit?: number)
  recommendRemediationCourses(ability, errorHistory)
}
```

**工作量**：1h

### Sprint 2: AI Lab核心功能 (Week 3)

#### Task 2.1: 实现RemediationEffectivenessAggregate
**文件**：`src/domain/aggregates/RemediationEffectivenessAggregate.ts`

基于设计5.7，包含：
- 补救前后指标对比
- 效果评分算法（0-100分）
- 决策逻辑（毕业/继续/调整/上报）
- A/B测试框架

**工作量**：8-10h  
**依赖**：Accuracy, LearningMetrics等值对象

#### Task 2.2: 实现CourseGenerationAggregate (简化版)
**文件**：`src/domain/aggregates/CourseGenerationAggregate.ts`

基于设计5.1，包含：
- 任务状态管理（pending → processing → completed/failed）
- 音频建课流程编排
- 教材导入流程编排

**工作量**：6-8h

#### Task 2.3: 实现IPublisherQueryService接口
**文件**：`src/domain/services/IPublisherQueryService.ts`

```typescript
export interface IPublisherQueryService {
  getAvailablePublishers(): Promise<Publisher[]>
  queryPublisherCurricula(publisherId): Promise<Curriculum[]>
  queryUnitsByCurriculum(publisherId, curriculumId): Promise<CourseUnit[]>
  generateCourseFromUnit(publisherId, curriculumId, unitId, options?)
}
```

**工作量**：2h

### Sprint 3: 事件与仓储 (Week 4)

#### Task 3.1: 补充AI Lab相关事件
**文件**：`src/domain/events/AILabEvents.ts` (新增)

```typescript
// AI Lab任务事件
class TaskCreatedEvent extends DomainEvent
class TaskProgressUpdatedEvent extends DomainEvent
class TaskCompletedEvent extends DomainEvent
class TaskFailedEvent extends DomainEvent

// 能力相关事件
class LanguageAbilityUpdatedEvent extends DomainEvent
class DifficultyIncreasedEvent extends DomainEvent
class DifficultyDecreasedEvent extends DomainEvent

// 补救效果事件
class RemediationEvaluatedEvent extends DomainEvent
class RemediationEffectivenessScoreCalculatedEvent extends DomainEvent
```

**工作量**：3h

#### Task 3.2: 实现仓储接口
**文件**：`src/domain/repositories/`

```typescript
// 需要实现的仓储接口：
ILanguageAbilityRepository
IRemediationEffectivenessRepository
ICourseGenerationRepository
IPublisherQueryRepository
```

**工作量**：2-3h  
**注**：仓储实现放在Phase 5

---

## Phase 5 实施计划 (2-3周)

### 后端服务实现

#### Task 5.1: PublisherQueryService实现
- 教材出版社数据管理
- 课程系列查询
- 单元级联加载

**工作量**：8-12h  
**依赖**：LLM API集成

#### Task 5.2: AudioProcessingService实现
- 音频分句算法（RMS检测）
- 音频切片
- TTS批量生成
- 质量验证

**工作量**：10-15h  
**依赖**：Sherpa ASR、TTS服务

#### Task 5.3: RemediationABTestingService实现
- 用户分组算法
- 效果数据收集
- 统计显著性计算

**工作量**：5-7h

### 前端UI与服务连接

#### Task 5.4: 更新AILabPage.tsx
- 移除占位页面
- 连接各功能到后端服务
- 显示实时进度和结果

**工作量**：6-8h

---

## 完整实施时间表

```
立即行动 (Week 1)
├─ 设计文档补全 (4-6h)
├─ 值对象实现 (3-4h)
└─ AI Lab菜单决策 (0.5h)

Phase 4 (Week 2-4, 约30h)
├─ Sprint 1: DDD架构 (15-18h)
│  ├─ 值对象实现 ✅ (已在立即行动)
│  ├─ LanguageAbilityAggregate (6-8h)
│  ├─ VocabularyMastery (2-3h)
│  └─ IRecommendationService (1h)
│
├─ Sprint 2: AI Lab聚合根 (16-20h)
│  ├─ RemediationEffectivenessAggregate (8-10h)
│  ├─ CourseGenerationAggregate (6-8h)
│  └─ IPublisherQueryService (2h)
│
└─ Sprint 3: 事件与仓储 (5-6h)
   ├─ AILabEvents (3h)
   └─ 仓储接口 (2-3h)

Phase 5 (Week 5-7, 约40h)
├─ 后端服务实现 (23-34h)
│  ├─ PublisherQueryService (8-12h)
│  ├─ AudioProcessingService (10-15h)
│  └─ RemediationABTestingService (5-7h)
│
└─ 前端集成 (6-8h)
   └─ AILabPage更新与服务连接

总计：约70-80h (2个Phase，4-5周)
```

---

## 验收标准

### Phase 4 验收清单

- [ ] 所有值对象实现完成（Difficulty/Score/Accuracy/ReviewInterval）
- [ ] LanguageAbilityAggregate通过TypeScript编译，包含单元测试
- [ ] RemediationEffectivenessAggregate通过TypeScript编译，包含单元测试
- [ ] CourseGenerationAggregate框架完成
- [ ] 所有仓储接口定义完成
- [ ] 所有AI Lab相关事件定义完成
- [ ] 设计文档5.2/5.4/5.5/5.6补充完成

### Phase 5 验收清单

- [ ] PublisherQueryService正确查询教材数据
- [ ] AudioProcessingService能处理上传的音频文件
- [ ] RemediationABTestingService能分组和收集数据
- [ ] AILabPage的5个功能都显示真实数据（不是"开发中"）
- [ ] 用户能生成课程并查看学习建议
- [ ] 所有AI Lab功能通过集成测试

---

## 风险与缓解

| 风险 | 概率 | 影响 | 缓解方案 |
|------|------|------|--------|
| LLM API延迟高 | 中 | AI功能响应慢 | 实现本地缓存、异步处理、降级方案 |
| 音频处理库性能 | 低 | 建课超时 | 选择高性能库、批量处理、进度流 |
| 设计文档不完整 | 高 | 开发方向不明 | 与PM确认、早期反馈、迭代 |
| 功能范围膨胀 | 中 | 时间超期 | 严格MoSCoW优先级划分 |

---

## 后续行动

### 用户确认项（48h内回复）

1. **菜单决策**：选择A(禁用)/B(占位)/C(保持)中的哪个方案？
2. **设计补全**：是否需要补充5.2/5.4/5.5/5.6的完整设计？
3. **优先级**：5个AI Lab功能的实现优先级排序？

### Phase 4开始前准备

- [ ] 确认所有设计需求
- [ ] 建立Phase 4的Sprint规划
- [ ] 分配开发资源
- [ ] 准备LLM API密钥和配额

---

**审批者**：______  
**日期**：______  
**备注**：
