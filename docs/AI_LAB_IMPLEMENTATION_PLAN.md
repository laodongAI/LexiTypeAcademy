# AI Lab 功能补全实施计划（AI Lab Feature Completion Implementation Plan）

## 快速参考表（Quick Reference）

### 当前状态快照

```
AI Lab 菜单: ✅ 显示 (enabled: true)
  ├─ AI 课程生成器: ❌ available: false (disabled)
  ├─ 弱词强化复习: ❌ available: false (disabled)
  ├─ 自由写作教练: ❌ available: false (disabled)
  ├─ 任务历史: ❌ available: false (disabled)
  └─ 教材文本导入: ❌ available: false (disabled)

设计文档规范：✅ 完整 (6,147 行)
  ├─ 5.1 课程生成工厂: ✅ 已定义
  ├─ 5.3 语言能力建模: ✅ 已定义
  └─ 5.7 补救效果验证: ✅ 已定义

代码实现：❌ 缺失
  ├─ DDD 聚合根: 0/4
  ├─ 值对象: 0/3
  ├─ 服务接口: 0/6
  └─ 仓储接口: 0/3
```

---

## 分阶段实施计划

### Phase 10A: 快速启用（1-2 天）
**目标**: 使5个功能菜单可点击，显示独立的占位页面

#### Task 10A-1: 启用所有AI Lab功能 (30分钟)
**文件**: `src/ui/pages/ailab/AILabPage.tsx`

```typescript
// 将所有 available: false 改为 true（或基于Phase完成度的条件）

// 暂定：全部改为 true
{
  id: 'generator',
  title: 'AI 课程生成器',
  available: true  // 改为 true
}
```

**验证**: 
- ✓ 5个卡片不再显示"开发中"标签
- ✓ 点击每个卡片都进入对应的页面（而不是共享占位页）

#### Task 10A-2: 创建独立的占位组件 (2小时)
**新增文件**:
- `src/ui/pages/ailab/CourseGeneratorPage.tsx` (占位)
- `src/ui/pages/ailab/WeakVocabularyReviewPage.tsx` (占位)
- `src/ui/pages/ailab/FreeWritingPage.tsx` (占位)
- `src/ui/pages/ailab/TaskHistoryPage.tsx` (占位)
- `src/ui/pages/ailab/PublisherImportPage.tsx` (占位)

**每个文件内容示例**:
```typescript
/**
 * AI 课程生成器页面（Phase 10B 实现）
 */
export const CourseGeneratorPage: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={onBack} className="p-2 rounded-full hover:bg-gray-100">←</button>
        <h1 className="text-2xl font-bold">AI 课程生成器</h1>
      </div>
      
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-8 text-center">
        <p className="text-blue-800 dark:text-blue-300 text-lg mb-4">
          🚧 功能开发中 - Phase 10B
        </p>
        <p className="text-blue-600 dark:text-blue-400 text-sm">
          计划实现音频建课、分句、转写、翻译、TTS生成等功能
        </p>
        
        {/* Phase 10B 将实现的UI框架 */}
        <div className="mt-8 space-y-4">
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
          <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    </div>
  );
};
```

#### Task 10A-3: 更新AILabPage的路由 (1小时)
**文件**: `src/ui/pages/ailab/AILabPage.tsx`

```typescript
import CourseGeneratorPage from './CourseGeneratorPage';
import WeakVocabularyReviewPage from './WeakVocabularyReviewPage';
import FreeWritingPage from './FreeWritingPage';
import TaskHistoryPage from './TaskHistoryPage';
import PublisherImportPage from './PublisherImportPage';

// 在 renderContent 中更新
const renderContent = () => {
  switch (subView) {
    case 'generator':
      return React.createElement(CourseGeneratorPage, { onBack: () => setSubView('menu') });
    case 'review':
      return React.createElement(WeakVocabularyReviewPage, { onBack: () => setSubView('menu') });
    case 'freewrite':
      return React.createElement(FreeWritingPage, { onBack: () => setSubView('menu') });
    case 'history':
      return React.createElement(TaskHistoryPage, { onBack: () => setSubView('menu') });
    case 'pep':
      return React.createElement(PublisherImportPage, { onBack: () => setSubView('menu') });
    // ...
  }
};
```

**验证**:
- ✓ 点击各卡片进入不同的占位页
- ✓ 返回按钮可以返回菜单

---

### Phase 10B: DDD核心实现（1-2 周）
**目标**: 实现必需的DDD聚合根和仓储

#### Task 10B-1: 创建 LanguageAbilityAggregate (3-4小时)
**文件**: `src/domain/aggregates/LanguageAbilityAggregate.ts`

**内容**: 从设计文档 5.3 直接转换
- 属性: userId, currentDifficulty, listeningLevel, speakingLevel, vocabularyMastery
- 方法: updateFromLessonPractice(), increaseDifficulty(), decreaseDifficulty(), recommendNextCourseDifficulty()
- 不变量检查

**行数**: ~200行

**验证**: 
- ✓ 编译通过 (npm run typecheck)
- ✓ 单元测试覆盖所有不变量

#### Task 10B-2: 创建 VocabularyMastery 值对象 (1-2小时)
**文件**: `src/domain/valueobjects/VocabularyMastery.ts`

**内容**: 从设计文档 5.3 直接转换
- 属性: masteredWords, targetCount
- 方法: addWord(), hasWord(), getMasteredCount(), getMasteryPercentage(), getLevel()

**行数**: ~80行

#### Task 10B-3: 创建 AILabTaskAggregate (3-4小时)
**文件**: `src/domain/aggregates/AILabTaskAggregate.ts`

**内容**: 
- 属性: id, userId, taskType (generator/review/freewrite), status, progress, input, output
- 方法: start(), updateProgress(), complete(), fail()
- 状态机: pending → executing → completed/failed

**行数**: ~180行

#### Task 10B-4: 创建 RemediationEffectivenessAggregate (4-5小时)
**文件**: `src/domain/aggregates/RemediationEffectivenessAggregate.ts`

**内容**: 从设计文档 5.7 直接转换
- 属性: remediationId, baselineAccuracy, postRemediationAccuracy, effectivenessScore
- 方法: recordLessonCompletion(), evaluateEffectiveness(), makeDecision()
- A/B 测试数据

**行数**: ~250行

#### Task 10B-5: 创建仓储接口 (2-3小时)
**新增文件**:
```
src/domain/repositories/ILanguageAbilityRepository.ts (50行)
src/domain/repositories/IAILabTaskRepository.ts (50行)
src/domain/repositories/IRemediationEffectivenessRepository.ts (50行)
```

#### Task 10B-6: 实现Dexie仓储 (4-5小时)
**新增文件**:
```
src/infrastructure/repositories/LanguageAbilityRepository.ts (100行)
src/infrastructure/repositories/AILabTaskRepository.ts (100行)
src/infrastructure/repositories/RemediationEffectivenessRepository.ts (100行)
```

**验证**:
- ✓ npm run typecheck: 0 errors
- ✓ npm run build: success
- ✓ 单元测试覆盖30%+

---

### Phase 10C: 服务层实现 (1-2 周)
**目标**: 实现业务逻辑服务

#### Task 10C-1: PublisherQueryService 接口 (2小时)
**文件**: `src/domain/services/IPublisherQueryService.ts`

```typescript
interface IPublisherQueryService {
  getAvailablePublishers(): Promise<Publisher[]>;
  queryPublisherCurricula(publisherId: string): Promise<Curriculum[]>;
  queryUnitsByCurriculum(publisherId: string, curriculumId: string): Promise<CourseUnit[]>;
  generateCourseFromUnit(...): Promise<Course>;
}
```

#### Task 10C-2: CourseGeneratorService (4-5小时)
**文件**: `src/domain/services/CourseGeneratorService.ts`

**功能**:
- 音频分句 (RMS检测)
- 原音切片
- ASR转写
- LLM翻译
- TTS生成
- 质量校验

**行数**: ~200行

#### Task 10C-3: RecommendationService (3-4小时)
**文件**: `src/domain/services/RecommendationService.ts`

**功能**:
- 基于能力推荐课程
- 推荐补救课程

**行数**: ~150行

#### Task 10C-4: RemediationABTestingService (2-3小时)
**文件**: `src/domain/services/RemediationABTestingService.ts`

**功能**:
- 实验组分配
- 数据收集
- 统计检验

**行数**: ~150行

**验证**:
- ✓ npm run typecheck: 0 errors
- ✓ 集成测试覆盖主要流程

---

### Phase 10D: UI 实现 (1-2 周)
**目标**: 完整的用户界面

#### Task 10D-1: CourseGeneratorPage 完整实现 (5-6小时)
**文件**: `src/ui/pages/ailab/CourseGeneratorPage.tsx`

**组件**:
- AudioUploadWizard (上传、显示进度)
- SentenceSplitter (分句预览、调整)
- TranslationEditor (编辑翻译、词汇)
- TTSGenerator (生成进度)
- CoursePreview (预览、保存)

**行数**: ~400行

#### Task 10D-2: TaskHistoryPage 完整实现 (4-5小时)
**文件**: `src/ui/pages/ailab/TaskHistoryPage.tsx`

**组件**:
- TaskList (筛选、搜索、分页)
- TaskDetail (详情、日志、重试)
- TaskStats (统计、图表)

**行数**: ~350行

#### Task 10D-3: 其他功能页面 (8-10小时)
- WeakVocabularyReviewPage (350行)
- FreeWritingPage (350行)
- PublisherImportPage (400行)

**验证**:
- ✓ npm run build: success
- ✓ 所有页面可访问
- ✓ 响应式设计测试

---

### Phase 10E: 数据流与集成 (3-5 天)
**目标**: 连接所有组件，形成完整的数据流

#### Task 10E-1: 事件发布 (2小时)
- CourseGeneratorPage → 发布 CourseGeneratedEvent
- TaskHistoryPage → 订阅 TaskProgressUpdatedEvent
- LanguageAbility → 订阅 LessonPracticedEvent

#### Task 10E-2: 状态管理 (2小时)
- 使用 React Context 管理 AILab 全局状态
- 集成 EventStore

#### Task 10E-3: 数据持久化 (2小时)
- 保存任务到 IAILabTaskRepository
- 保存学习能力到 ILanguageAbilityRepository

#### Task 10E-4: 集成测试 (2-3小时)
- 端到端测试：上传音频 → 分句 → 转写 → 保存课程
- 端到端测试：任务创建 → 执行 → 完成 → 历史记录

**验证**:
- ✓ npm run test: 通过 50+ 用例
- ✓ 手动验证所有5个功能的完整流程

---

## 时间线估算（Timeline Estimation）

| 阶段 | 任务 | 工作量 | 优先级 |
|------|------|--------|--------|
| **Phase 10A** | 快速启用菜单 | 4小时 | 🔴 P0 |
| **Phase 10B** | DDD核心实现 | 5-6天 | 🔴 P0 |
| **Phase 10C** | 服务层实现 | 4-5天 | 🔴 P0 |
| **Phase 10D** | UI实现 | 5-7天 | 🟡 P1 |
| **Phase 10E** | 集成与测试 | 2-3天 | 🟡 P1 |
| **合计** | 全部功能 | **3-4 周** | - |

### 快速启用路径 (Week 1)
```
Phase 10A (1-2 天) → Phase 10B-1-3 (3-4 天) → 可演示版本

效果: 5个菜单项可点击，有基本的业务逻辑和数据持久化
```

### 完整实现路径 (3-4 周)
```
Phase 10A → 10B → 10C → 10D → 10E → 完整功能
```

---

## 代码行数统计（Line Count Summary）

| 组件 | 类型 | 行数 | 新增文件 |
|------|------|------|---------|
| LanguageAbilityAggregate | 聚合根 | 200 | 1 |
| VocabularyMastery | 值对象 | 80 | 1 |
| AILabTaskAggregate | 聚合根 | 180 | 1 |
| RemediationEffectivenessAggregate | 聚合根 | 250 | 1 |
| 仓储接口 | 接口 | 150 | 3 |
| 仓储实现 | 实现 | 300 | 3 |
| CourseGeneratorService | 服务 | 200 | 1 |
| RecommendationService | 服务 | 150 | 1 |
| RemediationABTestingService | 服务 | 150 | 1 |
| PublisherQueryService | 接口/实现 | 200 | 2 |
| **UI 页面** | 组件 | **1,450** | **5** |
| **AILabPage更新** | 修改 | **100** | - |
| **总计** | - | **3,610** | **19** |

---

## 验收标准（Acceptance Criteria）

### Phase 10A 验收
- [ ] 5个功能卡片点击后进入独立页面
- [ ] 每个页面都显示"开发中"提示和规划说明
- [ ] 返回按钮可正常工作

### Phase 10B 验收
- [ ] npm run typecheck: 0 errors
- [ ] npm run build: success
- [ ] 所有聚合根单元测试通过
- [ ] 所有仓储单元测试通过

### Phase 10C 验收
- [ ] 所有服务接口定义完成
- [ ] CourseGeneratorService 集成测试通过
- [ ] RecommendationService 集成测试通过

### Phase 10D 验收
- [ ] 所有5个页面UI完整实现
- [ ] 响应式设计在 1440px, 1024px, 768px, 480px 宽度都能正确显示
- [ ] 所有交互按钮都有响应

### Phase 10E 验收
- [ ] 端到端测试：完整的课程生成流程
- [ ] 端到端测试：任务历史的完整生命周期
- [ ] 所有数据正确持久化到Dexie
- [ ] 所有事件正确发布到事件总线

### 最终验收 (Phase 10 完成)
- [ ] 5个功能全部可用 (available: true)
- [ ] 所有功能菜单在导航栏可见
- [ ] 用户可以通过菜单访问所有功能
- [ ] 所有功能可以验证（非占位）
- [ ] 代码覆盖率 ≥ 50%
- [ ] npm run build 成功 (0 errors)

---

## 文件清单 (File Checklist)

### 新增文件（19个）

**UI 层** (5个)
- [ ] `src/ui/pages/ailab/CourseGeneratorPage.tsx`
- [ ] `src/ui/pages/ailab/WeakVocabularyReviewPage.tsx`
- [ ] `src/ui/pages/ailab/FreeWritingPage.tsx`
- [ ] `src/ui/pages/ailab/TaskHistoryPage.tsx`
- [ ] `src/ui/pages/ailab/PublisherImportPage.tsx`

**聚合根** (4个)
- [ ] `src/domain/aggregates/LanguageAbilityAggregate.ts`
- [ ] `src/domain/aggregates/AILabTaskAggregate.ts`
- [ ] `src/domain/aggregates/RemediationEffectivenessAggregate.ts`
- [ ] `src/domain/aggregates/CourseGeneratorAggregate.ts` (可选)

**值对象** (1个)
- [ ] `src/domain/valueobjects/VocabularyMastery.ts`

**仓储接口** (3个)
- [ ] `src/domain/repositories/ILanguageAbilityRepository.ts`
- [ ] `src/domain/repositories/IAILabTaskRepository.ts`
- [ ] `src/domain/repositories/IRemediationEffectivenessRepository.ts`

**仓储实现** (3个)
- [ ] `src/infrastructure/repositories/LanguageAbilityRepository.ts`
- [ ] `src/infrastructure/repositories/AILabTaskRepository.ts`
- [ ] `src/infrastructure/repositories/RemediationEffectivenessRepository.ts`

**服务** (3个)
- [ ] `src/domain/services/CourseGeneratorService.ts`
- [ ] `src/domain/services/RecommendationService.ts`
- [ ] `src/domain/services/RemediationABTestingService.ts`

### 修改文件（2个）
- [ ] `src/ui/pages/ailab/AILabPage.tsx` (更新路由和功能开关)
- [ ] 可能需要 `src/domain/services/IPublisherQueryService.ts` (可选)

---

## 下一步 (Next Actions)

1. **今天**: 启用Phase 10A快速启用方案
2. **本周**: 完成Phase 10B DDD核心实现
3. **下周**: Phase 10C-10D UI和服务实现
4. **第三周**: Phase 10E集成和测试

---

**计划完成日期**: 2025年12月22日 (2周)  
**预期可演示版本**: 2025年12月15日 (1周，Phase 10A+10B)  
**最终完整版本**: 2025年12月22日 (2周+)
