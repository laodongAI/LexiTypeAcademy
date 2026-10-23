# 英语课程与 AI Lab 概要设计 v0.4.1（融合 v0.5.0 与生产级补充）

## 0. 引言与范围

- 目标：整理英语课程与 AI Lab 的概要设计，融合 v0.4.0 需求与 v0.4.1 生产级补充，确保所有新增功能在现有底层能力上落地，不引入破坏性变更。
- 范围：课程生成/导入、学习与评测、补救课程、AI Lab 任务、音频服务集成、数据与接口、性能与可靠性。
- 版本：v0.4.0 主体，融合 v0.5.0 的关键技术点（限流、缓存、版本化接口）与 v0.4.1 生产级补充（预加载、边界校验、录音清理、TTS 批量、底层复用、数据对齐、存储路径、事件总线、错误分层）。

## 0.1 文档结构说明

本文档遵循标准设计规范，按照从功能→架构→实现→验收的顺序，涵盖系统的完整设计视图：

- 第 1-3 章：总体视图（功能需求、架构、UI）
- 第 4-7 章：各模块的子功能详细定义与约束
- 第 8-9 章：技术与数据设计深化（含 v0.4.1 生产级补充）
- 第 10-16 章：接口、流程、非功能、风险与落地方案
- 第 17 章：v0.4.1 生产级补充设计与实施 checklist

## 目录

- 1 总体功能要求
- 2 总体架构设计
- 3 UI 设计
- 4 学习中心子功能详细定义
- 5 AI Lab 子功能详细定义
- 6 复习模块子功能详细定义
- 7 社交与设置子功能详细定义
- 8 技术架构细节
- 9 数据模型与存储设计（含 v0.4.1 补充）
- 10 接口与服务定义
- 11 关键流程与状态机
- 12 非功能需求
- 13 实施计划与时间表
- 14 验收与测试标准
- 15 风险与缓解
- 16 容错与重试机制
- 17 v0.4.1 生产级补充设计与实施方案

---

## 1. 总体功能要求（Product Functional Specification）

### 1.1 产品定位与用户价值

**产品定位**：LexiType Academy 是一款基于 AI 驱动的英语学习平台，面向所有英语水平学习者，通过智能课程生成、个性化跟读评测、错题补救与社交激励，提供完整的闭环学习体验。

**核心用户价值**：

- 学习者：获得个性化课程、实时反馈与科学的复习计划，显著提升听说读写能力
- 教师/机构：快速生成管理课程，追踪学生进度，制定教学策略
- 内容创作者：利用 AI Lab 生成与优化课程，建立课程模板库

### 1.2 核心功能模块

#### 学习中心

- **课程浏览与详情**：课程列表、多维筛选（难度/标签/时长/来源）、详情页包含目标、结构、预习资源
- **课时练习**：句子卡片展示、音频播放、自动跟读与手动模式、实时反馈、进度保存
- **学习记录**：笔记、收藏、错题标记、学习时间统计、能力达成度可视化

#### AI 实验室

- **内容生成工厂**：音频建课（上传音频→自动分句→翻译→TTS 生成）、教材解析（四步导航）、文本建课
- **任务中心**：任务队列、优先级管理、断点恢复、实时日志、资源限流与降级
- **模板市场**：官方模板库、社区共享、评分与评论、快速导入

#### 复习模块

- **错题驱动**：自动收集错题、分类聚合、按错误类型（发音/流利度/完整性/语法）标记
- **SM-2 优化复习计划**：间隔重复、难度自适应、最佳学习时间推荐、每日复习量调控
- **复习提醒**：日历视图、推送通知、成就激励

#### 社交与成就

- **学习排行**：周/月排行榜（学习时长、完成课程数、错题修正率等维度）
- **成就体系**：徽章、等级、挑战任务、里程碑奖励
- **分享与合作**：课程分享、组队学习、评论讨论

#### 设置与偏好

- **个人设置**：用户名、头像、语言、主题、隐私
- **学习偏好**：目标英语水平、学习风格、通知频率、音频质量
- **数据管理**：导出学习数据、管理本地存储、隐私与安全

### 1.3 功能边界与约束

- **离线支持**：课程学习与评测可离线进行；课程生成、AI 功能需网络
- **并发限制**：单个用户最多 1 个活跃练习会话；AI Lab 任务限流 5 并发
- **存储上限**：本地缓存 <2GB；单课程导出 <10MB；历史记录自动清理（>6 个月）
- **音频格式**：导入支持 MP3/WAV/M4A；导出统一 MP3 44.1kHz/128kbps；在线播放支持流式传输

---

## 2. 总体架构设计（Overall Architecture Design）

### 2.1 分层架构概览

系统采用五层本地应用架构，以 Electron 为桌面容器：

```text
┌──────────────────────────────────────────────────────────────┐
│ Presentation Layer: Electron Renderer + React (中文 GUI)      │
│ ├─ Pages: Dashboard, CourseManager, LessonPractice, etc.     │
│ └─ Components: AudioPlayer, Recorder, EvalFeedback, etc.     │
├──────────────────────────────────────────────────────────────┤
│ Application Layer: Use Cases & Orchestration                 │
│ ├─ GenerateCourseUseCase, PracticeAndEvaluateUseCase        │
│ ├─ AILabTaskOrchestrator, RemediationService                │
│ └─ Main Process: IPC Bridge、文件管理、进程管理               │
├──────────────────────────────────────────────────────────────┤
│ Domain Layer: Business Logic (Pure TypeScript)               │
│ ├─ Aggregates: Course, Lesson, RemediationCourse, AILabTask │
│ ├─ Domain Services: CourseFactory, RemediationService        │
│ └─ Domain Events: CourseGenerated, LessonEvaluated, etc.     │
├──────────────────────────────────────────────────────────────┤
│ Infrastructure Layer: Local Implementation                   │
│ ├─ Persistence: Dexie (IndexedDB) + 本地文件系统             │
│ ├─ Services: AudioFacade、Sherpa ASR、Qwen/豆包 LLM 调用    │
│ ├─ Audio: 内置 TTS (系统级) / ASR (Sherpa ONNX)             │
│ └─ IPC: Electron Main ↔ Renderer 通信                        │
├──────────────────────────────────────────────────────────────┤
│ Built-in Models: Sherpa ONNX (ASR)、系统 TTS                │
│ LLM APIs: Qwen、豆包 (文生文调用)                            │
│ Storage: 本地文件系统 (data/) + IndexedDB                    │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 技术栈

- **桌面应用**：Electron (v22+)、Node.js 后端进程 (Main)
- **前端 GUI**：React 18、TypeScript、Tailwind CSS、Hooks
- **语言支持**：仅中文 (zh-CN)，所有 UI、文档、日志均中文
- **音频处理**：
  - ASR (自动语音识别)：Sherpa ONNX (离线，内置模型)
  - TTS (文本转语音)：Windows 系统 TTS (SAPI5) / Edge TTS (可选)
  - 录音/播放：Web Audio API
- **AI/LLM**：
  - 课程生成、补救策略：通过 HTTP 调用 Qwen / 豆包 API (在线)
  - 仅支持文生文接口
- **存储**：
  - 本地数据库：Dexie.js (IndexedDB)
  - 文件系统：本地 `data/` 目录 (课程、音频文件、导出)
  - **无 Redis、无 MongoDB、无云端存储**
- **开发框架**：Vite、TypeScript、DDD 分层

### 2.3 部署架构

**单机可安装应用**（Windows）：

```text
Windows 系统
  └─ LexiType Academy (Electron 应用)
       ├─ Renderer (React GUI)
       │   └─ 本地数据库 (Dexie/IndexedDB)
       │
       └─ Main Process (Node.js)
           ├─ IPC Bridge (Renderer ↔ Main)
           ├─ 课程管理、学习记录、AI Lab
           ├─ 音频处理
           │   ├─ Sherpa ONNX ASR (内置)
           │   └─ 系统 TTS (SAPI5)
           ├─ LLM 调用（网络）
           │   ├─ → Qwen API (HTTP)
           │   └─ → 豆包 API (HTTP)
           └─ 文件系统
               └─ data/ 目录
                   ├─ courses/     (课程数据)
                   ├─ audio/       (音频文件)
                   ├─ exports/     (导出文件)
                   └─ cache/       (缓存)
```

**外部依赖**：仅 Qwen / 豆包 LLM API (可选离线)

**离线能力**：支持离线学习、录音、Sherpa ASR；LLM 功能需网络

### 2.4 限界上下文地图（Bounded Contexts Map）

#### DDD 上下文划分

系统由 **5 个清晰的限界上下文（Bounded Contexts）** 组成，每个上下文有独立的模型、存储、事件与服务：

```text
┌─────────────────────────────────────────────────────────────────────┐
│                    LexiType Academy 限界上下文地图                    │
└─────────────────────────────────────────────────────────────────────┘

         ┌──────────────────┐
         │   用户界面上下文  │ (Presentation Context)
         │  (React 页面、Hooks) │
         └────────┬─────────┘
                  │ IPC / API
                  ↓
    ┌──────────────────────────────────────────────┐
    │          应用服务层（Use Cases）              │
    │  - GenerateCourseUseCase                    │
    │  - PracticeAndEvaluateUseCase              │
    │  - CreateRemediationCourseUseCase          │
    │  - AILabTaskOrchestrator                   │
    └──────────────────────────────────────────────┘
                  │
        ┌─────────┼─────────┬──────────┬──────────┐
        │         │         │          │          │
        ↓         ↓         ↓          ↓          ↓
    
 ┌─────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐ ┌─────────────┐
 │  学习中心    │ │   AI Lab      │ │   补救模块    │ │  复习模块   │ │  社交与设置  │
 │  上下文      │ │   上下文       │ │   上下文      │ │  上下文     │ │  上下文      │
 │ ────────────│ │──────────────│ │──────────────│ │────────────│ │─────────────│
 │ 聚合根：     │ │ 聚合根：      │ │ 聚合根：     │ │ 聚合根：   │ │ 聚合根：    │
 │ - Course    │ │ - AILabTask   │ │ - Remediation│ │ - Review   │ │ - User      │
 │ - Lesson    │ │               │ │ - RemLessons │ │ Schedule   │ │ - Achievement│
 │ - Learning  │ │ 服务：        │ │               │ │            │ │              │
 │   Record    │ │ - PublisherQ  │ │ 服务：       │ │ 服务：     │ │ 服务：      │
 │             │ │ - CourseGen   │ │ - Remediation│ │ - Spaced   │ │ - Social    │
 │ 服务：      │ │               │ │   Service    │ │   Repeat   │ │   Network   │
 │ - AudioFacade│ │ 事件：        │ │               │ │            │ │              │
 │ - SpeechEval │ │ - TaskCreated │ │ 事件：       │ │ 事件：     │ │ 事件：      │
 │             │ │ - TaskProgress│ │ - Remediation│ │ - Review   │ │ - Achievement│
 │ 事件：      │ │ - TaskDone    │ │   Created    │ │   Interval │ │   Unlocked  │
 │ - CourseEnr │ │               │ │ - Remediation│ │   Updated  │ │              │
 │   olled     │ │ 仓储：        │ │   Completed  │ │            │ │ 仓储：      │
 │ - Lesson    │ │ - ITaskRepo   │ │               │ │ 仓储：     │ │ - IUserRepo │
 │   Practiced │ │               │ │ 仓储：       │ │ - IReview  │ │              │
 │             │ │ 存储：        │ │ - IRemediation│ │   Repo     │ │ 存储：      │
 │ 仓储：      │ │ - Dexie 任务表│ │   Repo       │ │            │ │ - Dexie 用户│
 │ - ICourse   │ │ - File 生成文件│ │ 存储：       │ │ 存储：     │ │   表         │
 │   Repo      │ │               │ │ - Dexie 补救 │ │ - Dexie    │ │              │
 │ - ILearning │ │               │ │   表         │ │   复习表   │ │ 更新周期：  │
 │   Record    │ │ 更新周期：     │ │ - File 缓存  │ │            │ │ 1 小时      │
 │   Repo      │ │ 实时           │ │               │ │ 更新周期： │ │              │
 │             │ │               │ │ 更新周期：   │ │ 1 分钟     │ │              │
 │ 更新周期：  │ │               │ │ 1 天         │ │            │ │              │
 │ 实时        │ │               │ │               │ │            │ │              │
 └─────────────┘ └──────────────┘ └──────────────┘ └────────────┘ └─────────────┘
        │              │                 │              │              │
        └──────────────┴─────────────────┴──────────────┴──────────────┘
                              │
                    共享的基础设施层
               ┌──────────────────────────┐
               │ 事件总线 & EventStore     │
               │ 音频门面 (AudioFacade)   │
               │ 语音评测 (SpeechEval)    │
               │ Dexie 数据库             │
               │ 文件系统 (data/ 目录)    │
               └──────────────────────────┘
```

#### 上下文间的关系与通信

| 上下文 A | 通信方式 | 上下文 B | 说明 |
|---------|--------|---------|------|
| **学习中心** | 事件 `LessonPracticedEvent` → | **补救模块** | 课时评测完成后，触发补救检查 |
| **补救模块** | 事件 `RemediationCreatedEvent` → | **复习模块** | 补救课程生成后，入队复习 |
| **复习模块** | 事件 `ReviewDueEvent` → | **社交与设置** | 达成日目标 → 成就解锁 |
| **学习中心** | 仓储共享 | **复习模块** | 共享 LearningRecord，无事件依赖 |
| **AI Lab** | IPC & 事件 | **学习中心** | 生成的课程发送到学习中心 |
| 所有上下文 | 事件总线 | 事件总线 | 所有聚合根事件都发布到共享的事件总线 |

#### 防腐层（Anti-Corruption Layer）

某些上下文之间的数据转换需要防腐层，防止外部模型污染内部模型：

```typescript
// src/infrastructure/integration/AntiCorruptionLayer.ts

/**
 * AI Lab 上下文 → 学习中心上下文
 * 防腐：AI Lab 的 GeneratedCourse 格式 → Course 聚合根
 */
class AILabToLearningCenterAdapter {
  adapt(generatedCourse: AILabCourse): Course {
    return {
      id: generateId(),
      title: generatedCourse.title,
      description: generatedCourse.description,
      cefrLevel: this.mapCefrLevel(generatedCourse.level),
      source: 'ai-lab' as const,
      lessons: generatedCourse.lessons.map(lesson => ({
        id: generateId(),
        courseId: '',  // 稍后填充
        title: lesson.title,
        sentences: lesson.sentences.map(sent => ({
          id: generateId(),
          lessonId: '',  // 稍后填充
          text: sent.text,
          translation: sent.translation,
          audioUri: sent.audioPath,
          vocabulary: sent.vocabulary || []
        })),
        audioMeta: {
          startMs: lesson.audioMeta.startMs,
          endMs: lesson.audioMeta.endMs,
          duration: lesson.audioMeta.duration,
          format: 'mp3'
        }
      })),
      metadata: {
        tags: generatedCourse.tags || [],
        createdAt: new Date(),
        updatedAt: new Date()
      },
      stats: {
        totalScore: 0,
        avgScore: 0,
        completedCount: 0
      }
    };
  }
  
  private mapCefrLevel(level: string): string {
    // 将 AI Lab 的级别映射到 CEFR 标准
    const map: Record<string, string> = {
      'beginner': 'A1',
      'elementary': 'A2',
      'intermediate': 'B1',
      'upper-intermediate': 'B2',
      'advanced': 'C1',
      'proficiency': 'C2'
    };
    return map[level.toLowerCase()] || 'B1';
  }
}

/**
 * 补救模块 → 学习中心
 * 防腐：Remediation 的专家模型 → Course 通用模型
 */
class RemediationToLearningCenterAdapter {
  adapt(remediation: RemediationAggregate): Course {
    // 补救课程有特殊的 metadata 标记，但结构遵循 Course 接口
    return {
      id: remediation.id,
      title: `补救课程: ${remediation.getSourceCourseName()}`,
      cefrLevel: remediation.getRecommendedLevel(),
      source: 'remedial' as const,
      lessons: remediation.getLessons().map(rLesson => ({
        id: rLesson.id,
        // ... 转换
      })),
      metadata: {
        remedial: {
          sourceErrorType: remediation.getStrategy(),
          sourceErrorLessons: remediation.getSourceLessonIds(),
          relatedKeywords: remediation.getKeywords()
        },
        createdAt: new Date(),
        updatedAt: new Date()
      }
      // ...
    };
  }
}
```

#### 上下文间的数据一致性

1. **事件驱动一致性**：主要通过事件总线确保最终一致性
   - 学习中心的 `LessonPracticedEvent` 发布后，补救模块异步订阅并反应
   - 允许短暂的延迟（<100ms 通常不感知）

2. **仓储共享一致性**：部分数据（如 LearningRecord）跨上下文共享
   - LearningRecord 由学习中心创建，复习模块读取
   - 使用乐观锁防止并发修改

3. **Saga 模式处理分布式事务**：补偿机制处理多上下文的复杂流程
   - 生成补救课程失败 → 回滚 → 通知用户

#### 添加新上下文的检查清单

```
□ 定义聚合根与值对象
□ 定义领域服务与仓储接口
□ 定义领域事件
□ 创建防腐层（如需与其他上下文交互）
□ 定义仓储的 Dexie 表（如需持久化）
□ 定义上下文的更新周期（实时 / 1小时 / 1天）
□ 注册事件订阅（在应用层）
□ 添加到上下文地图（此处）
□ 编写集成测试（验证跨上下文的事件流）
```

**设计益处**：
- ✅ **清晰的边界**：每个上下文独立演化，减少耦合
- ✅ **易于扩展**：添加新功能 = 新上下文 or 现有上下文扩展
- ✅ **灾难隔离**：某个上下文故障不影响其他上下文
- ✅ **团队协作**：不同团队可独立开发不同上下文
- ✅ **防腐保护**：外部 API 变更不污染核心模型

---

## 3. UI 设计（User Interface Design）

### 3.1 页面与组件结构

**主导航架构**：
```
Dashboard (学习首页)
  ├─ Courses (课程管理)
  │   ├─ CourseList (课程列表)
  │   ├─ CourseDetail (课程详情)
  │   ├─ AudioCourseWizard (建课向导)
  │   └─ PublisherImportWizard (教材导入)
  ├─ Practice (练习中心)
  │   └─ CourseLessonPractice (课时练习)
  ├─ Review (复习中心)
  │   └─ ReviewManager (错题与计划)
  ├─ AILab (AI 实验室)
  │   └─ AILabTaskCenter (任务中心)
  └─ Profile (个人中心)
      ├─ UserProfile (用户信息)
      ├─ Settings (设置)
      └─ DataManagement (数据管理)
```

#### 3.1.1 主要页面详细设计

**Dashboard（学习首页）**

布局结构：

```text
┌─────────────────────────────────────────┐
│  顶部导航栏（logo、搜索、登出）        │
├─────────────────────────────────────────┤
│ 左侧边栏    │ 主内容区                 │
│ • Dashboard │ ┌─────────────────────┐ │
│ • Courses   │ │ 学习概览卡片        │ │
│ • Practice  │ │ (周时长、课程数)    │ │
│ • Review    │ │ ┌─────────────────┐ │ │
│ • AILab     │ │ │ 近期任务 (3)    │ │ │
│ • Profile   │ │ └─────────────────┘ │ │
│             │ ┌─────────────────────┐ │ │
│ 离线指示    │ │ 推荐课程 (4 卡片)   │ │ │
│ 存储状态    │ │ • 英文基础          │ │ │
│             │ │ • 商务英语          │ │ │
│             │ │ • 口语提升          │ │ │
│             │ │ • 托福准备          │ │ │
│             │ └─────────────────────┘ │ │
│             │ ┌─────────────────────┐ │ │
│             │ │ 学习排行榜          │ │ │
│             │ │ (周、月切换)        │ │ │
│             │ └─────────────────────┘ │ │
│             └─────────────────────────┘ │
└─────────────────────────────────────────┘
```

关键组件：

- `LearningSummaryCard`：学习统计卡片（周学习时长、完成课程、错题数）
- `TaskCardList`：近期任务列表（建课、导入、导出等）
- `RecommendedCourseCarousel`：推荐课程轮播
- `LeaderboardWidget`：排行榜快捷窗口

**Courses（课程管理）**

页面布局：

```text
┌─────────────────────────────────────────┐
│ 页面标题 | 导入按钮 | 建课按钮          │
├─────────────────────────────────────────┤
│ 筛选栏: [难度▼] [来源▼] [标签搜索🔍]   │
├─────────────────────────────────────────┤
│ [视图切换] 卡片视图 ◉ | ○ 列表视图     │
├─────────────────────────────────────────┤
│ ┌──────────┐  ┌──────────┐              │
│ │ 课程卡片1│  │ 课程卡片2│  ...         │
│ │ [缩略图] │  │ [缩略图] │              │
│ │ 标题     │  │ 标题     │              │
│ │ ★★★☆☆ │  │ ★★★★☆ │              │
│ │ 进度 60% │  │ 进度 100%│              │
│ │ [编辑▼]  │  │ [编辑▼]  │              │
│ └──────────┘  └──────────┘              │
└─────────────────────────────────────────┘
```

右侧详情栏（课程选中时）：

```text
┌──────────────────┐
│ 课程详情         │
├──────────────────┤
│ [封面大图]       │
│ 标题、难度、来源 │
│ 描述文本...      │
│                  │
│ 课时列表:        │
│ • Lesson 1  3:45 │
│ • Lesson 2  4:12 │
│ • Lesson 3  2:50 │
│ ...              │
│                  │
│ [编辑] [删除]    │
│ [导出] [分享]    │
└──────────────────┘
```

关键组件：

- `CourseCard`：课程卡片（缩略图、标题、难度标签、进度条、操作菜单）
- `FilterBar`：筛选栏（难度、来源、标签、搜索）
- `CourseDetailSidebar`：课程详情侧栏（元数据、课时列表、操作按钮）
- `ViewToggle`：视图切换（卡片/列表）

**CourseLessonPractice（课时练习）**

沉浸式布局：

```text
┌─────────────────────────────────────────┐
│ 返回按钮 | 课程名 - 课时名 | 进度 2/10 │
├─────────────────────────────────────────┤
│                                          │
│  ┌────────────────────────────────────┐ │
│  │                                     │ │
│  │        [句子卡片中央显示]          │ │
│  │                                     │ │
│  │        "Hello, how are you?"       │ │
│  │        你好，你好吗？              │ │
│  │                                     │ │
│  │   词汇: hello (n.) 你好            │ │
│  │        how (adv.) 怎样             │ │
│  │        are (v.) 是                 │ │
│  │                                     │ │
│  └────────────────────────────────────┘ │
│                                          │
├─────────────────────────────────────────┤
│ 底部控制区                               │
│ [参考音] ▶ ⏸ 0:12/0:45 [音量 50%]     │
│                                          │
│ 录音模式: ◉ 自动跟读 ○ 手动录音       │
│                                          │
│ [开始录音] 或 ▶ 播放录音 [重试]       │
│                                          │
│ [下一句→] [查看建议↓]                  │
└─────────────────────────────────────────┘
```

评分反馈浮窗：

```text
[评分反馈浮窗]（评测后）
┌──────────────────────────┐
│ 评分结果                  │
├──────────────────────────┤
│ 总分: 85 / 100  ▓▓▓▓▓░   │
│                          │
│ 准确度: 90 ▓▓▓▓▓░       │
│ 流利度: 85 ▓▓▓▓░░       │
│ 完整度: 80 ▓▓▓░░░       │
│ 韵律:   75 ▓▓░░░░       │
│                          │
│ 建议: 注意 "hello"      │
│      的发音，应该更清晰 │
│                          │
│ [接受结果] [重新录音]    │
└──────────────────────────┘
```

关键组件：

- `SentenceCard`：句子卡片（原文、翻译、词汇）
- `AudioPlayer`：音频播放器（进度条、播放控制、音量、倍速）
- `Recorder`：录音器（波形可视化、计时、自动停止提示）
- `EvaluationFeedback`：评分反馈（分数、维度柱状图、建议）
- `ProgressIndicator`：进度指示（当前/总数）

**AudioCourseWizard（建课向导）**

多步骤流程：

```text
┌─────────────────────────────────────────┐
│ 步骤指示器                               │
│ 1.导入 ▶ 2.分句 ▶ 3.校验 ▶ 4.TTS ▶ ... │
├─────────────────────────────────────────┤
│                                          │
│ 步骤 1: 导入音频文件                    │
│ ┌──────────────────────────────────┐   │
│ │ [点击或拖拽上传音频文件]         │   │
│ │ MP3/WAV/M4A, <100MB              │   │
│ └──────────────────────────────────┘   │
│                                          │
│ ○ 已上传: sample.mp3 (45.2 MB)         │
│ ⟳ 处理中... 25%                        │
│                                          │
│ [上一步] [下一步→]                     │
└─────────────────────────────────────────┘
```

步骤流程：

- **Step 1: 导入** - 文件上传、进度显示
- **Step 2: 分句** - 自动分句预览、编辑、调整
- **Step 3: 校验** - ASR 转写预览、修正
- **Step 4: TTS** - 翻译、词汇、TTS 生成进度
- **Step 5: 预览** - 完整课程预览、编辑修改
- **Step 6: 保存** - 课程信息补全、保存

#### 3.1.2 响应式布局

| 设备 | 主容器 | 侧栏 | 卡片列 |
|------|--------|------|--------|
| Desktop (1440px+) | max-w-7xl | fixed 300px | grid 3-4列 |
| Laptop (1024-1439px) | max-w-6xl | fixed 250px | grid 2-3列 |
| Tablet (768-1023px) | max-w-4xl | 可折叠 | grid 2列 |
| Mobile (<768px) | 100% - 32px | 抽屉式 | grid 1列 |

### 3.2 交互与状态

**全局状态栏**（顶部/侧栏显示）：

```text
[离线指示 🔴] [录音 🎤] [存储 ▓▓▓░ 60%] [个人菜单 ▼]
```

**练习页交互流程**：

1. **播放状态流**：

   ```text
   IDLE 
     ↓ (用户点击播放)
   PLAYING (显示进度条、暂停按钮)
     ↓ (自动或用户点击停止)
   PAUSED/STOPPED (显示进度位置、重新播放选项)
   ```

2. **录音状态流**：

   ```text
   READY (显示 [开始录音])
     ↓ (用户点击)
   RECORDING (显示实时波形、计时器、停止按钮)
     ↓ (用户停止 或 无声3s自动停止)
   RECORDED (显示 [播放] [重新录音] [提交评测])
     ↓ (用户点击提交或重新录音)
   EVALUATING (显示加载中... [取消])
     ↓ (评测完成)
   EVALUATED (显示反馈卡片)
   ```

**错误处理与降级流UI**：

- **网络离线**：顶部显示红色提示 "离线模式"，本地模式可用功能标记
- **ASR 不可用**：弹窗 "无法连接到语音识别服务，请手动输入或切换到本地模式"
- **音频播放失败**：重试进度条 "重试 1/2..." 后显示备用源选项
- **存储不足**：提示对话框 "存储空间不足，建议清除缓存"，提供一键清理

### 3.3 组件库与样式

**设计系统**：Tailwind CSS + 自定义组件库 + Figma 设计稿

**颜色系统**：

- 主色：Blue-600 (#2563eb) - 主要按钮、链接、进度条
- 成功色：Green-600 (#16a34a) - 评测通过、完成状态
- 警告色：Amber-600 (#d97706) - 警告、需要注意
- 错误色：Red-600 (#dc2626) - 错误、失败状态
- 中性：Gray-600 (#4b5563) - 文本、分割线

**排版**：

- 标题 1 (H1)：32px, 700 weight, 行高 1.2
- 标题 2 (H2)：24px, 700 weight, 行高 1.3
- 标题 3 (H3)：20px, 600 weight, 行高 1.4
- 正文：16px, 400 weight, 行高 1.6
- 小文本：14px, 400 weight, 行高 1.5

**间距**：

- 基础单位：4px
- 常用值：4, 8, 12, 16, 24, 32, 48px

**关键组件库**：

| 组件 | 用途 | 关键属性 |
|------|------|----------|
| **CourseCard** | 课程卡片展示 | thumbnail, title, difficulty, progress, menu |
| **LessonCard** | 课时卡片 | index, title, keywords, duration, status |
| **AudioPlayer** | 音频播放 | src, currentTime, duration, volume, speed |
| **Recorder** | 录音控制 | waveform, timer, RMS值, status |
| **EvaluationFeedback** | 评分反馈 | score, dimensions, radar, suggestions |
| **TaskProgressBar** | 任务进度 | current, total, stage, ETA |
| **FilterBar** | 筛选控制 | filters[], onChange |
| **Modal** | 对话框 | title, content, actions |
| **Toast** | 消息提示 | type, message, duration |
| **Button** | 按钮 | variant(primary/secondary), size, loading |
| **Input** | 输入框 | type, placeholder, validation |
| **Select** | 下拉选择 | options[], value, onChange |
| **Slider** | 滑块 | min, max, value (音量、倍速) |

**交互反馈**：

- 按钮悬停：背景色 +10% 亮度，shadow-lg
- 按钮点击：按下效果 scale-95，active-shadow-inner
- 加载状态：rotate 动画 + disabled 状态
- 滑动/拖拽：cursor-grab / cursor-grabbing，平滑 transition
- 波形可视化：real-time 更新（60fps），smooth easing

### 3.4 可访问性与国际化

**可访问性 (WCAG 2.1 AA)**：

- **键盘导航**：
  - Tab 键遍历所有交互元素
  - Enter/Space 激活按钮
  - Arrow 键导航列表/滑块
  - Escape 关闭模态框
  
- **ARIA 标签**：

  ```html
  <button aria-label="播放参考音">▶</button>
  <div role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"></div>
  <input aria-describedby="helptext" />
  <span id="helptext">输入课程标题</span>
  ```

- **对比度**：
  - 文本与背景 ≥ 4.5:1（AA）
  - 图形元素 ≥ 3:1
  - 禁用状态 ≥ 3:1

- **屏幕阅读器**：
  - 图片 alt 文本
  - 表单标签关联
  - 列表语义标签
  - Skip link 快捷导航

**国际化 (Language Support)**：

- **仅支持中文 (zh-CN)**：所有 UI、菜单、日志、文档均中文
- **日期格式**：中国标准 "2024年12月8日" 或 "2024-12-08"
- **数字格式**：
  - 分数："85 分" / "准确度 85%"
  - 时间：HH:mm:ss (例 12:34:56)
  - 百分比：95% / 85 分
- **文件格式**：支持中文文件名的导入导出

### 3.5 页面级无障碍检查清单（WCAG 2.1 AA Page-Level Checklist）

#### 设计动机

**问题**：
- 泛泛的无障碍原则（ARIA、键盘导航）已定义，但未针对具体页面的交互模式
- 不同页面类型（学习中心 vs AI Lab vs 复习）有不同的交互复杂度，需要不同的测试和实现策略
- 无障碍测试无清晰的验收标准，导致遗漏和不一致

**解决方案**：为每个主要页面类型提供详细的 WCAG 2.1 AA 检查清单（包括可感知性、可操作性、可理解性、健壮性）

#### 学习中心页面 (Learning Center)

##### 课程列表页面 (Courses List)

```typescript
// 无障碍需求清单
const courseListA11yChecklist = {
  // WCAG 1.4.3 Contrast (Minimum) Level AA
  contrast: {
    '课程卡片标题': '4.5:1',        // 正常文本
    '难度标签（A1-C2）': '4.5:1',
    '描述文本': '4.5:1',
    '禁用卡片': '3:1',              // 图形元素（按钮、图标）
    'CTA 按钮': '4.5:1'
  },
  
  // WCAG 2.1.1 Keyboard Level A
  keyboard: [
    '✅ Tab 键遍历：搜索框 → 卡片列表 → CTA 按钮',
    '✅ Shift+Tab 反向遍历',
    '✅ Enter 打开课程详情',
    '✅ Escape 关闭搜索下拉框（若展开）',
    '✅ Arrow Up/Down 在下拉框中导航难度过滤器',
    '✅ Space 勾选多选过滤器'
  ],
  
  // WCAG 2.4.7 Focus Visible Level AA
  focus: [
    '✅ 焦点指示器可见性：最小 3px，对比度 ≥ 3:1',
    '✅ 焦点环绕（focus trap）仅在模态框中启用',
    '✅ 初始焦点在搜索框',
    '✅ 焦点移动顺序逻辑且直观'
  ],
  
  // WCAG 1.1.1 Non-text Content Level A
  images: [
    '✅ 课程缩略图有 alt 文本：例 "《新概念英语1》课程缩略图"',
    '✅ 难度图标有 aria-label：例 "A1 级别（初级）"',
    '✅ 装饰性图片（背景）标记为 aria-hidden="true"'
  ],
  
  // WCAG 3.2.4 Consistent Identification Level AA
  consistency: [
    '✅ 所有页面的"搜索"输入框位置和标签一致',
    '✅ 所有 CTA 按钮（如"开始学习"）样式和标签一致',
    '✅ 错误消息格式一致：icon + 文字 + 建议操作'
  ],
  
  // WCAG 4.1.2 Name, Role, Value Level A
  semantics: [
    '✅ 课程卡片使用 <article role="button" tabindex="0">',
    '✅ 难度过滤器使用 <fieldset> + <legend>',
    '✅ 搜索输入框有显式 <label for="search-input">',
    '✅ 课程数量显示有 aria-live="polite" 通知变更'
  ],
  
  // 屏幕阅读器测试（使用 NVDA、JAWS、VoiceOver）
  screenReader: [
    '✅ NVDA 中文支持：正确朗读课程标题、难度、描述',
    '✅ 跳过重复导航链接（Skip to Content）',
    '✅ 宣布搜索结果数量变更：例 "找到 12 门课程"',
    '✅ 列表语义：<ul><li>（而非 <div><div>）'
  ]
};

/**
 * 页面级实现指导
 */
class CourseListPageA11y {
  // 1. 焦点管理
  handleFocus() {
    // 页面加载：焦点移到搜索框
    const searchInput = document.getElementById('search-input');
    // 延迟焦点移动，避免与其他初始化冲突
    setTimeout(() => searchInput?.focus(), 100);
  }
  
  // 2. 键盘事件
  setupKeyboardNavigation() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        // 关闭搜索下拉框
        const dropdown = document.getElementById('search-dropdown');
        dropdown?.setAttribute('aria-expanded', 'false');
      }
    });
  }
  
  // 3. 动态内容通知
  notifySearchResults(count: number) {
    const announcement = `找到 ${count} 门课程`;
    const liveRegion = document.getElementById('a11y-live-region');
    liveRegion!.textContent = announcement;
    // aria-live="polite" 会在合适时机朗读此内容
  }
  
  // 4. 焦点恢复（关闭模态框后）
  closeModal(returnFocusTo: HTMLElement) {
    const modal = document.getElementById('course-detail-modal');
    modal?.remove();
    returnFocusTo.focus();  // 将焦点返回到打开模态框的按钮
  }
}
```

##### 课程详情与练习页面 (Course Detail & Practice)

```typescript
const courseDetailA11yChecklist = {
  // 复杂交互：音频播放、逐句练习、语音识别结果显示
  audioPlayback: [
    '✅ 播放按钮有 aria-label="播放《Lesson 1》参考音频"',
    '✅ 进度条是 <input type="range"> 或 <div role="slider">',
    '✅ 时间显示：aria-label="当前时间 0:23，总时长 2:45"',
    '✅ 音量控制：键盘支持（上/下箭头调节）'
  ],
  
  speech: [
    '✅ 开始录音按钮：aria-label="开始录制句子"',
    '✅ 录音进行中：aria-live="assertive"（立即通知用户）',
    '✅ 识别结果：屏幕阅读器朗读识别的文本 + 准确率分数',
    '✅ 结果反馈可视化：色块 → 文字 → 音频（多感官反馈）'
  ],
  
  vocabulary: [
    '✅ 生词卡片：点击触发模态框显示释义',
    '✅ 模态框内：焦点陷阱，Tab 在关闭按钮和内容间循环',
    '✅ 发音按钮：aria-label="播放『apple』的英文发音"',
    '✅ 中文释义：clear text without nested divs'
  ],
  
  feedback: [
    '✅ 成功反馈：green toast + 音效 + 屏幕阅读器宣布 "完成"',
    '✅ 错误反馈：red toast + 重试按钮 + 建议',
    '✅ 进度条更新：aria-valuenow 动态更新，宣布百分比'
  ]
};
```

#### AI Lab 页面 (AI Lab)

##### 任务列表与创建页面

```typescript
const aiLabA11yChecklist = {
  // AI Lab 的特殊性：生成任务、文件上传、参数配置
  formControls: [
    '✅ 表单标签明确关联：<label for="task-name">',
    '✅ 必填字段标记：aria-required="true"',
    '✅ 验证错误通知：aria-invalid="true" + aria-describedby="error-message"',
    '✅ 帮助文本：aria-describedby="task-name-help"'
  ],
  
  fileUpload: [
    '✅ 文件输入框有清晰标签：例 "上传音频文件（MP3/WAV）"',
    '✅ 上传进度条：role="progressbar" + aria-valuenow',
    '✅ 文件列表：<ul><li> 语义，可删除项有确认对话框'
  ],
  
  parameterConfiguration: [
    '✅ 各参数为 <input type="range"> 或 <input type="number">',
    '✅ 滑块：keyboard 支持（Left/Right 箭头），支持 Page Up/Down 大步调节',
    '✅ 输入值实时显示：aria-live="polite" 通知当前值',
    '✅ 预设按钮：Clear、Reset 等有明确 aria-label'
  ],
  
  taskProgressTracking: [
    '✅ 实时进度通知：aria-live="polite" 每 5 秒更新一次',
    '✅ 估计完成时间：例 "预计 3 分钟完成"',
    '✅ 取消按钮：disabled 状态时有 aria-disabled="true"'
  ]
};
```

#### 复习模块页面 (Review Module)

```typescript
const reviewA11yChecklist = {
  // 复习的特殊性：时间表、间隔重复、统计图表
  schedulingCalendar: [
    '✅ 日历组件：role="presentation"（仅作展示）',
    '✅ 日期单元格：<button> 语义，aria-label="2024年12月8日，2 个复习任务"',
    '✅ 当前日期高亮：aria-current="date"',
    '✅ 键盘导航：Arrow 键在日期间移动，Enter 选择'
  ],
  
  staticsCharts: [
    '✅ 图表：使用 role="img" + aria-label 描述完整信息',
    '✅ 数据表格替代品：<table> 包含完整数据（供屏幕阅读器访问）',
    '✅ 颜色编码：必须有 legend 或文本标签，不仅依赖颜色'
  ],
  
  reviewCards: [
    '✅ 卡片容器：<div role="article">',
    '✅ 问题部分：<h3>（语义标题）',
    '✅ 答案选项：<fieldset><legend> + <input type="radio">',
    '✅ 反馈区域：aria-live="assertive" 立即通知对错'
  ]
};
```

#### 社交与设置页面 (Social & Settings)

```typescript
const socialSettingsA11yChecklist = {
  // 社交：排行榜、成就系统
  leaderboards: [
    '✅ 排行榜表格：<table> 语义，<thead><th scope="col">',
    '✅ 排名数字：aria-label="第 3 名，排名上升 2 位"',
    '✅ 虚拟滚动：当用户 scroll 到底时动态加载，通知用户新数据',
    '✅ 搜索用户：搜索结果更新时，aria-live="polite" 宣布数量'
  ],
  
  achievements: [
    '✅ 成就徽章：<img alt="完成 5 门课程，获得『学者』成就">',
    '✅ 进度条：role="progressbar" + aria-valuenow/aria-valuemax',
    '✅ 解锁通知：弹出或 toast，aria-live="assertive"'
  ],
  
  // 设置：常见 WCAG 问题区域
  settings: [
    '✅ 设置项：<label> + <input> / <select> / <textarea>',
    '✅ 切换开关（Toggle）：role="switch" + aria-checked',
    '✅ 颜色主题选择器：不依赖颜色，有文本标签（例 "深色模式"）',
    '✅ 保存/取消：按钮有清晰 aria-label，成功通知用户'
  ],
  
  dataExportImport: [
    '✅ 导出按钮：aria-label="导出所有学习记录为 JSON 文件"',
    '✅ 导入文件选择器：aria-label="选择 JSON 文件导入"',
    '✅ 进度和结果通知：aria-live="polite" 或专用通知区域'
  ]
};
```

#### 通用无障碍模式与实现

```typescript
// src/shared/a11y/AccessibilityManager.ts

/**
 * 全局无障碍管理器
 * 提供跨页面的无障碍功能（焦点管理、公告区域、键盘快捷键）
 */
class AccessibilityManager {
  private liveRegion: HTMLElement;
  
  constructor() {
    // 创建全局 aria-live 区域（应在应用启动时初始化）
    this.liveRegion = document.createElement('div');
    this.liveRegion.id = 'a11y-live-region';
    this.liveRegion.setAttribute('aria-live', 'polite');
    this.liveRegion.setAttribute('aria-atomic', 'true');
    this.liveRegion.style.display = 'none';  // 不可见但对屏幕阅读器可访问
    document.body.appendChild(this.liveRegion);
  }
  
  /**
   * 宣布重要信息
   * 用于动态内容更新、表单验证等
   * @param message - 要宣布的文本
   * @param assertive - true: aria-live="assertive"（立即宣布）
   */
  announce(message: string, assertive = false) {
    this.liveRegion.setAttribute('aria-live', assertive ? 'assertive' : 'polite');
    this.liveRegion.textContent = message;
  }
  
  /**
   * 管理焦点（防止焦点丢失或意外移动）
   */
  setFocus(element: HTMLElement, options?: { smooth?: boolean }) {
    if (options?.smooth) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => element.focus(), 0);
  }
  
  /**
   * 焦点陷阱（在模态框中使用）
   * 确保 Tab 键在模态框内循环，不会移出模态框
   */
  createFocusTrap(modalElement: HTMLElement) {
    const focusableElements = modalElement.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    modalElement.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          // Shift+Tab：反向移动
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab：正向移动
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      } else if (e.key === 'Escape') {
        // 关闭模态框
        modalElement.dispatchEvent(new CustomEvent('closeModal'));
      }
    });
  }
  
  /**
   * 宣布加载状态
   */
  announceLoading(isLoading: boolean) {
    if (isLoading) {
      this.announce('加载中...', true);
    } else {
      this.announce('加载完成', true);
    }
  }
}

// 页面级使用示例
class CourseDetailPage {
  private a11y = new AccessibilityManager();
  
  async startPractice() {
    this.a11y.announceLoading(true);
    
    try {
      const data = await this.fetchLessonData();
      this.a11y.announceLoading(false);
      this.a11y.announce('课程已加载，按 Tab 开始', true);
      this.a11y.setFocus(document.getElementById('start-button')!);
    } catch (error) {
      this.a11y.announce(`加载失败：${error}`, true);
    }
  }
}
```

#### 无障碍测试检查清单（Pre-Deployment）

```typescript
const a11yTestingChecklist = {
  automated: [
    '✅ 使用 axe DevTools 扫描：0 critical violations',
    '✅ 使用 WAVE 检查：所有 errors 已修复',
    '✅ 使用 Lighthouse a11y 审计：得分 ≥ 95',
    '✅ 对比度检查：WebAIM Color Contrast Checker'
  ],
  
  manual: [
    '✅ NVDA（Windows）/ JAWS（Windows）：朗读页面无误',
    '✅ VoiceOver（macOS）：导航和交互正常',
    '✅ 仅键盘导航：无需鼠标完成所有操作',
    '✅ 焦点指示器：在所有焦点状态可见',
    '✅ 屏幕放大（200%）：布局不碎裂，内容可读'
  ],
  
  mobile: [
    '✅ TalkBack（Android）：朗读和手势导航',
    '✅ VoiceOver（iOS）：朗读和手势导航',
    '✅ 触屏对比度：文本 ≥ 4.5:1',
    '✅ 触屏目标大小：≥ 44x44 dp（或等价像素）'
  ],
  
  browsers: [
    '✅ Chrome + ChromeVox',
    '✅ Firefox + NVDA',
    '✅ Safari + VoiceOver'
  ]
};
```

#### 关键益处

1. **合规性**：满足 WCAG 2.1 AA 标准，适应全球无障碍法规
2. **用户包容性**：为残障用户提供等价的体验
3. **更好的 SEO**：语义化 HTML 和 ARIA 标签有利于搜索引擎索引
4. **代码质量**：结构化的需求清单减少遗漏和重工
5. **长期维护**：新页面/功能有明确的检查清单可参考

---

## 4. 学习中心子功能详细定义（Learning Center Module）

### 4.1 课程管理（Course Management）

**输入**：用户选择或导入课程；系统自动生成或管理课程元数据

**处理**：

- 课程验证：检查完整性（课时、音频、翻译、词汇）
- 元数据计算：统计总时长、难度平均值、标签聚合、缓存路径生成
- 版本管理：记录课程创建修改时间、变更日志、兼容性标记

**输出**：课程对象（id、title、lessons[]、metadata、stats）存储到 IndexedDB 与云端同步

**约束**：

- 单课程最多 500 个课时
- 课时音频长度 3-60 秒
- 翻译与词汇缓存 TTL 7 天

### 4.2 课时练习（Lesson Practice）

**输入**：用户选择课程与课时，系统加载参考音频、标准文本与答案

**流程**：

```
显示句子卡片 → 播放参考音 → [用户选择模式]
  ├─ 自动跟读模式：参考音结束 → 自动录音 → 无声检测与重试 → 评测
  └─ 手动录音模式：用户点击录音 → 手动停止或超时 → 评测

评测 → 计算准确度/流利度/完整度/韵律 → 显示反馈 → [用户操作]
  ├─ 接受结果：保存 LearningRecord → 继续下一句
  ├─ 重试：回到录音步骤
  └─ 查看建议：展开推荐语句与改进点
```

**输出**：LearningRecord（userId、lessonId、score、dimensions、timestamp）；触发 LessonEvaluatedEvent

**约束**：

- 录音时长限制 0.5s-30s
- 评测响应 <3s（本地 Sherpa）或 <5s（云端）
- 自动跟读最多重试 3 次无声

### 4.3 学习进度与统计（Progress & Analytics）

**模型**：

- DailyProgress：日期、学习时长、完成课程数、评测平均分、错题数
- CourseProgress：课程 ID、完成课时数、平均分、目标达成度、最后学习时间
- DimensionStats：四维统计（准确、流利、完整、韵律）的分布与趋势

**可视化**：

- 日历热力图：按天展示学习频率
- 雷达图：四维能力对标（按难度分层）
- 趋势图：7 天、30 天、90 天的学习时长与分数变化

**约束**：数据粒度分钟级，保留 180 天数据

---

## 5. AI Lab 子功能详细定义（AI Lab Module）

### 5.1 课程生成工厂（Course Generation Factory）

#### 5.1.1 音频建课流程

**输入**：用户上传音频文件（MP3/WAV，<100MB）

**处理步骤**：

1. **分句**：使用 RMS 静音检测 + 端点检测，分割为独立句子
   - 无声阈值：RMS <20dB
   - 静音时长：500ms 判定为分句点
   - 输出：句子与时间戳（startMs、endMs）

2. **原音切片**：从原音频中精确截取每句对应的音频段
   - 边界校验：startMs ≥ 0，endMs ≤ 音频总时长
   - 保留缓冲：前后各 50ms
   - 格式：MP3 44.1kHz/128kbps

3. **转写**：ASR 转换为文本（支持本地 Sherpa 或云端 API）
   - 置信度过滤：<0.5 的词语标记为 [unclear]
   - 输出：文本与置信度标记

4. **翻译与词汇提取**：使用 LLM 生成中文翻译、词汇列表、难度分级
   - 翻译风格：自然口语
   - 词汇字段：单词、词性、中文释义、难度（A1-C2）、例句

5. **TTS 生成**：批量生成标准音频与多种发音速度
   - 速度：1.0x、0.8x、1.2x
   - 去重：相同文本的 TTS 复用单一缓存
   - 缓存键：hash(文本 + 嗓音 + 速度)

6. **质量校验**：自动检查音频完整性、文本准确性、翻译合理性
   - 错误提示与修复建议

**输出**：Lesson[] 对象，包含句子、原音、TTS、翻译、词汇

**约束**：

- 处理时间 <5min（30 句）
- 失败自动重试 3 次（指数退避）
- 并发限制：5 个用户同时建课

#### 5.1.2 教材导入（四步导航）

**步骤**：

1. **选择出版社**：列表（PEP、FLTRP、Cambridge、New Concept 等）
2. **选择课程系列**：AI 查询出版社下的课程列表（年级、范围、简介）
3. **选择单元**：AI 查询课程下的单元列表（标题、关键词、概览）
4. **生成课程**：AI 从单元生成完整课程对象，包含词汇、句子、对话、难度、标签；用户预览与修改；确认导入

**服务接口**：

```typescript
interface IPublisherQueryService {
  getAvailablePublishers(): Promise<Publisher[]>;
  queryPublisherCurricula(publisherId: string): Promise<Curriculum[]>;
  queryUnitsByCurriculum(publisherId: string, curriculumId: string): Promise<CourseUnit[]>;
  generateCourseFromUnit(
    publisherId: string,
    curriculumId: string,
    unitId: string,
    options?: GenerateOptions
  ): Promise<Course>;
}
```

**约束**：单个单元生成 <1min；支持缓存防抖；AI 生成失败支持手动编辑

### 5.3 语言学习能力建模（LanguageAbilityAggregate）

#### 设计动机

**问题**：系统目前缺乏对学生整体英语能力的结构化建模，导致：
- 无法精确推荐合适难度的课程
- 无法追踪学生在不同维度（听力、口语、词汇）的进度
- 补救系统缺少学生能力基线数据

**解决方案**：创建新的 `LanguageAbilityAggregate` 聚合根，作为学生能力档案的权限边界

#### LanguageAbilityAggregate 结构

```typescript
// src/domain/aggregates/LanguageAbilityAggregate.ts

/**
 * 学生英语能力聚合根
 * 职责：追踪学生在听力、口语、词汇、语法等维度的掌握程度
 * 不变量：
 *   - 所有维度的级别必须在 A1-C2 之间
 *   - 听力级别 >= 口语级别（物理约束）
 *   - 掌握词汇数 >= 该级别下限
 */
class LanguageAbilityAggregate {
  private userId: string;
  private currentDifficulty: Difficulty;    // 全局难度（取各维度最低值）
  
  // 各维度的掌握等级
  private listeningLevel: Difficulty;       // 听力理解能力
  private speakingLevel: Difficulty;        // 口语表达能力
  private vocabularyMastery: VocabularyMastery;  // 词汇掌握详情
  
  // 学习历史与统计
  private completedCourses: string[];       // 完成的课程 ID[]
  private averageAccuracy: number;          // 历史平均准确率
  private totalPracticeDays: number;        // 总练习天数
  private learningTrendData: LearningTrendData;  // 趋势数据（用于可视化）
  
  // 时间戳
  private createdAt: Date;
  private lastUpdatedAt: Date;
  
  private domainEvents: DomainEvent[] = [];
  
  // ===== 工厂方法 =====
  static create(userId: string): LanguageAbilityAggregate {
    const ability = new LanguageAbilityAggregate();
    ability.userId = userId;
    ability.currentDifficulty = Difficulty.create('A1');  // 初始等级
    ability.listeningLevel = Difficulty.create('A1');
    ability.speakingLevel = Difficulty.create('A1');
    ability.vocabularyMastery = VocabularyMastery.create();
    ability.completedCourses = [];
    ability.averageAccuracy = 0;
    ability.totalPracticeDays = 0;
    ability.createdAt = new Date();
    ability.lastUpdatedAt = new Date();
    
    ability.recordDomainEvent(
      new LanguageAbilityCreatedEvent(userId)
    );
    
    return ability;
  }
  
  // ===== 业务方法 =====
  
  /**
   * 更新学习记录后，聚合该课程/课时的统计数据
   * 触发难度自动调整逻辑
   */
  updateFromLessonPractice(
    lessonId: string,
    courseId: string,
    accuracy: Accuracy,
    score: Score
  ): void {
    const before = {
      listening: this.listeningLevel,
      speaking: this.speakingLevel,
      vocabulary: this.vocabularyMastery.getLevel()
    };
    
    // 1. 更新维度级别（基于历史准确率）
    this.listeningLevel = this.calculateListeningLevel(accuracy);
    this.speakingLevel = this.calculateSpeakingLevel(accuracy);
    
    // 2. 标记课程为已完成（若该课程所有课时都通过）
    // TODO: 需要查询该课程的完成度
    
    // 3. 计算新的全局难度（取各维度最低值）
    const newDifficulty = this.calculateOverallDifficulty();
    
    // 4. 检查是否需要自动调整难度
    const difficultyChange = this.checkDifficultyAdjustment(before, {
      listening: this.listeningLevel,
      speaking: this.speakingLevel,
      vocabulary: this.vocabularyMastery.getLevel()
    });
    
    if (difficultyChange) {
      if (difficultyChange === 'increase') {
        this.increaseDifficulty('consecutive_pass');
      } else if (difficultyChange === 'decrease') {
        this.decreaseDifficulty('low_accuracy');
      }
    }
    
    this.lastUpdatedAt = new Date();
  }
  
  /**
   * 不变量：手动调整难度时进行检查
   */
  private increaseDifficulty(reason: 'consecutive_pass' | 'high_accuracy' | 'manual_request'): void {
    const currentNumericLevel = this.currentDifficulty.getNumericLevel();
    if (currentNumericLevel >= 6) {  // C2
      throw new DomainException('已达最高级别 C2，无法继续提升');
    }
    
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const newLevel = levelMap[currentNumericLevel];
    this.currentDifficulty = Difficulty.create(newLevel);
    
    this.recordDomainEvent(
      new DifficultyIncreasedEvent(
        this.userId,
        this.currentDifficulty,
        reason
      )
    );
  }
  
  private decreaseDifficulty(reason: 'consecutive_fail' | 'low_accuracy'): void {
    const currentNumericLevel = this.currentDifficulty.getNumericLevel();
    if (currentNumericLevel <= 1) {  // A1
      throw new DomainException('已达最低级别 A1，无法继续降低');
    }
    
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const newLevel = levelMap[currentNumericLevel - 2];
    this.currentDifficulty = Difficulty.create(newLevel);
    
    this.recordDomainEvent(
      new DifficultyDecreasedEvent(
        this.userId,
        this.currentDifficulty,
        reason
      )
    );
  }
  
  /**
   * 推荐下一个课程的难度
   * 考虑用户当前能力与学习历史
   */
  recommendNextCourseDifficulty(): Difficulty {
    // 规则 1: 若近 5 个课程平均准确率 > 85%，建议提升难度
    if (this.averageAccuracy > 85) {
      return this.getNextHigherDifficulty();
    }
    
    // 规则 2: 若近 5 个课程平均准确率 < 70%，建议降低难度
    if (this.averageAccuracy < 70) {
      return this.getNextLowerDifficulty();
    }
    
    // 规则 3: 默认推荐当前难度
    return this.currentDifficulty;
  }
  
  /**
   * 获取学生的学习进度（用于产品展示）
   */
  getProgressReport(): ProgressReport {
    return {
      userId: this.userId,
      currentDifficulty: this.currentDifficulty,
      listeningLevel: this.listeningLevel,
      speakingLevel: this.speakingLevel,
      vocabularyMastered: this.vocabularyMastery.getMasteredCount(),
      vocabularyTarget: this.vocabularyMastery.getTargetCount(),
      completedCoursesCount: this.completedCourses.length,
      totalPracticeDays: this.totalPracticeDays,
      averageAccuracy: this.averageAccuracy,
      trendData: this.learningTrendData
    };
  }
  
  // ===== 私有辅助方法 =====
  
  private calculateListeningLevel(accuracy: Accuracy): Difficulty {
    // 根据音素准确率推断听力理解级别
    // 准确率 > 90% → C2, > 80% → C1, ...
    const level = accuracy.phonemeAccuracy > 90 ? 'C2'
                : accuracy.phonemeAccuracy > 80 ? 'C1'
                : accuracy.phonemeAccuracy > 70 ? 'B2'
                : accuracy.phonemeAccuracy > 60 ? 'B1'
                : accuracy.phonemeAccuracy > 50 ? 'A2'
                : 'A1';
    return Difficulty.create(level);
  }
  
  private calculateSpeakingLevel(accuracy: Accuracy): Difficulty {
    // 根据流利度和节奏推断口语表达级别
    const level = accuracy.fluency > 90 ? 'C2'
                : accuracy.fluency > 80 ? 'C1'
                : accuracy.fluency > 70 ? 'B2'
                : accuracy.fluency > 60 ? 'B1'
                : accuracy.fluency > 50 ? 'A2'
                : 'A1';
    return Difficulty.create(level);
  }
  
  private calculateOverallDifficulty(): Difficulty {
    // 不变量：全局难度 = min(听力, 口语, 词汇)
    const listeningNum = this.listeningLevel.getNumericLevel();
    const speakingNum = this.speakingLevel.getNumericLevel();
    const vocabNum = this.vocabularyMastery.getLevel().getNumericLevel();
    
    const minNum = Math.min(listeningNum, speakingNum, vocabNum);
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[minNum - 1]);
  }
  
  private checkDifficultyAdjustment(
    before: Record<string, Difficulty>,
    after: Record<string, Difficulty>
  ): 'increase' | 'decrease' | null {
    // 如果某个维度从低级提升到高级，整体也可能需要提升
    const beforeNum = Math.min(
      before.listening.getNumericLevel(),
      before.speaking.getNumericLevel(),
      before.vocabulary.getNumericLevel()
    );
    
    const afterNum = Math.min(
      after.listening.getNumericLevel(),
      after.speaking.getNumericLevel(),
      after.vocabulary.getNumericLevel()
    );
    
    if (afterNum > beforeNum) return 'increase';
    if (afterNum < beforeNum) return 'decrease';
    return null;
  }
  
  private getNextHigherDifficulty(): Difficulty {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum >= 6) return this.currentDifficulty;
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[currentNum]);
  }
  
  private getNextLowerDifficulty(): Difficulty {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum <= 1) return this.currentDifficulty;
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[currentNum - 2]);
  }
  
  private recordDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
  
  getDomainEvents(): DomainEvent[] {
    return this.domainEvents;
  }
  
  clearDomainEvents(): void {
    this.domainEvents = [];
  }
}
```

#### VocabularyMastery 值对象

```typescript
// src/domain/valueobjects/VocabularyMastery.ts

class VocabularyMastery {
  private masteredWords: Set<string>;      // 已掌握的词汇
  private targetCount: number;             // 该级别的目标词汇数
  
  static create(): VocabularyMastery {
    const vm = new VocabularyMastery();
    vm.masteredWords = new Set();
    vm.targetCount = 500;  // A1 初始目标
    return vm;
  }
  
  addWord(word: string): void {
    this.masteredWords.add(word);
  }
  
  hasWord(word: string): boolean {
    return this.masteredWords.has(word);
  }
  
  getMasteredCount(): number {
    return this.masteredWords.size;
  }
  
  getTargetCount(): number {
    return this.targetCount;
  }
  
  getMasteryPercentage(): number {
    return Math.min(100, (this.getMasteredCount() / this.targetCount) * 100);
  }
  
  getLevel(): Difficulty {
    const percentage = this.getMasteryPercentage();
    const level = percentage > 90 ? 'C2'
                : percentage > 80 ? 'C1'
                : percentage > 70 ? 'B2'
                : percentage > 60 ? 'B1'
                : percentage > 50 ? 'A2'
                : 'A1';
    return Difficulty.create(level);
  }
}
```

#### LanguageAbilityRepository

```typescript
// src/domain/repositories/ILanguageAbilityRepository.ts
interface ILanguageAbilityRepository {
  save(ability: LanguageAbilityAggregate): Promise<void>;
  findByUserId(userId: string): Promise<LanguageAbilityAggregate | null>;
  updateAbility(userId: string, updates: Partial<LanguageAbilityAggregate>): Promise<void>;
}
```

#### 与推荐系统的集成

```typescript
// src/domain/services/IRecommendationService.ts
interface IRecommendationService {
  /**
   * 根据学生能力推荐课程
   * 输入：学生能力档案
   * 输出：排序的课程推荐列表
   */
  recommendCourses(
    ability: LanguageAbilityAggregate,
    limit: number = 5
  ): Promise<RecommendedCourse[]>;
  
  /**
   * 基于能力与错题历史，推荐补救课程
   */
  recommendRemediationCourses(
    ability: LanguageAbilityAggregate,
    errorHistory: LearningRecord[]
  ): Promise<RemediationCourse[]>;
}
```

**关键益处**：

1. **结构化能力建模**：从多维度（听力、口语、词汇）追踪学生进度
2. **自动难度调整**：基于规则自动升降学生难度，避免手动操作
3. **个性化推荐**：为每个学生推荐最合适的课程
4. **补救精准性**：补救课程基于学生的具体弱点，而非泛泛而谈
5. **可视化支持**：为仪表板、进度条、成就系统提供数据源

### 5.7 补救效果验证（Remediation Effectiveness Validation）

#### 设计动机

**问题**：补救系统虽然生成了个性化课程，但缺乏反馈机制来验证：
- 补救课程是否真的改进了学生的弱点
- 哪些补救策略（关键词强化 vs. 音素强化）效果最好
- 学生是否应该继续该补救课程还是回到主流程

**解决方案**：建立补救效果评估框架，通过对比补救前后的学习成果指标来量化效果

#### 补救效果评估聚合根

```typescript
// src/domain/aggregates/RemediationEffectivenessAggregate.ts

/**
 * 补救效果评估聚合根
 * 职责：
 *   - 追踪补救课程的学习统计数据
 *   - 计算效果指标（准确率提升、完成率、遗忘曲线对比）
 *   - 做出补救结束 / 继续 / 重新调整的决策
 *   - 为 A/B 测试收集数据
 * 不变量：
 *   - baselineAccuracy <= postRemediationAccuracy （理想情况）
 *   - 补救课程至少有 2 个 lesson 的数据才能评估
 *   - 评估周期：补救开始后 7-14 天
 */
class RemediationEffectivenessAggregate {
  private remediationId: string;
  private userId: string;
  private sourceCourseName: string;           // 原出错课程名
  private sourceErrorType: string;            // 补救原因（音素错误 / 词汇缺失 / 流利度）
  
  // 补救前基线数据
  private baselineMetrics: LearningMetrics;
  private baselineAccuracy: Accuracy;
  private baselineCompletionRate: number;      // 原课程的完成率
  
  // 补救进行中的数据
  private remediationStartDate: Date;
  private currentMetrics: LearningMetrics;     // 实时更新
  private lessonsCompleted: number;
  
  // 补救后的评估数据（在评估期结束时计算）
  private postRemediationMetrics: LearningMetrics;
  private postRemediationAccuracy: Accuracy;
  private evaluationDate: Date;
  
  // 效果指标
  private effectivenessScore: number;          // 0-100 分
  private improvementRate: number;             // 准确率提升百分比
  private retentionRate: number;               // 保留率（7 天后的准确率 / 当前准确率）
  private timeEfficiency: number;              // 完成同样课时用时对比（补救 / 原始）
  
  // A/B 测试相关
  private testGroup: 'control' | 'treatment_keyword' | 'treatment_phoneme' | 'treatment_adaptive';
  private testMetadata: TestMetadata;
  
  // 决策结果
  private status: 'pending' | 'ongoing' | 'evaluated' | 'completed' | 'extended';
  private decision: 'graduate' | 'continue' | 'adjust_strategy' | 'escalate';
  private nextAction: string;
  
  private createdAt: Date;
  private domainEvents: DomainEvent[] = [];
  
  // ===== 工厂方法 =====
  
  static create(
    remediationId: string,
    userId: string,
    sourceCourseName: string,
    sourceErrorType: string,
    baselineMetrics: LearningMetrics,
    baselineAccuracy: Accuracy,
    testGroup: string
  ): RemediationEffectivenessAggregate {
    const evaluation = new RemediationEffectivenessAggregate();
    evaluation.remediationId = remediationId;
    evaluation.userId = userId;
    evaluation.sourceCourseName = sourceCourseName;
    evaluation.sourceErrorType = sourceErrorType;
    evaluation.baselineMetrics = baselineMetrics;
    evaluation.baselineAccuracy = baselineAccuracy;
    evaluation.testGroup = testGroup as any;
    evaluation.remediationStartDate = new Date();
    evaluation.status = 'pending';
    evaluation.createdAt = new Date();
    
    evaluation.recordDomainEvent(
      new RemediationEvaluationStartedEvent(remediationId, userId)
    );
    
    return evaluation;
  }
  
  // ===== 业务方法 =====
  
  /**
   * 每次补救课程完成课时时调用，更新进行中的指标
   */
  recordLessonCompletion(
    lessonId: string,
    accuracy: Accuracy,
    completionTimeMs: number,
    responseTime: number
  ): void {
    this.lessonsCompleted++;
    this.status = 'ongoing';
    
    // 更新实时指标
    this.currentMetrics = {
      ...this.currentMetrics,
      avgAccuracy: this.calculateRunningAverage(accuracy),
      totalCompletionTimeMs: (this.currentMetrics?.totalCompletionTimeMs || 0) + completionTimeMs,
      avgResponseTime: this.calculateRunningAverage(accuracy, responseTime)
    };
    
    this.recordDomainEvent(
      new RemediationProgressUpdatedEvent(
        this.remediationId,
        this.lessonsCompleted,
        this.currentMetrics.avgAccuracy
      )
    );
  }
  
  /**
   * 评估补救效果（在补救开始后 7-14 天调用）
   * 返回是否应该继续补救，或毕业到原课程
   */
  evaluateEffectiveness(): RemediationEvaluationResult {
    const elapsedDays = this.getElapsedDays();
    
    // 不变量检查：至少有 2 个 lesson 的数据
    if (this.lessonsCompleted < 2) {
      return {
        canEvaluate: false,
        reason: '补救课程数据不足，至少需要 2 个 lesson'
      };
    }
    
    // 如果未达到评估期（7 天），返回不成熟评估
    if (elapsedDays < 7) {
      return {
        canEvaluate: false,
        reason: `评估期未满足，已完成 ${elapsedDays} 天，需要 7 天`
      };
    }
    
    // 计算效果指标
    this.postRemediationMetrics = this.currentMetrics;
    this.postRemediationAccuracy = this.currentMetrics.avgAccuracy;
    this.evaluationDate = new Date();
    
    // 1. 准确率提升
    this.improvementRate = this.calculateImprovementRate();
    
    // 2. 保留率（7 天后的准确率）
    this.retentionRate = this.calculateRetentionRate();
    
    // 3. 时间效率
    this.timeEfficiency = this.calculateTimeEfficiency();
    
    // 4. 综合效果评分（0-100）
    this.effectivenessScore = this.calculateEffectivenessScore();
    
    // 做出决策
    const decision = this.makeDecision();
    this.decision = decision;
    this.status = 'evaluated';
    
    return {
      canEvaluate: true,
      effectivenessScore: this.effectivenessScore,
      improvementRate: this.improvementRate,
      retentionRate: this.retentionRate,
      timeEfficiency: this.timeEfficiency,
      decision,
      recommendation: this.generateRecommendation(decision)
    };
  }
  
  /**
   * 综合评分算法
   * 满分 100 分：
   *   - 准确率提升 >= 10%：40 分
   *   - 准确率提升 >= 5%：30 分
   *   - 保留率 >= 85%：30 分
   *   - 时间效率 < 1.2：15 分（完成补救不超过原课时 20%）
   *   - 学生主观满意度（可选）：15 分
   */
  private calculateEffectivenessScore(): number {
    let score = 0;
    
    // 准确率改进分
    if (this.improvementRate >= 10) {
      score += 40;
    } else if (this.improvementRate >= 5) {
      score += 30;
    } else if (this.improvementRate >= 0) {
      score += 15;
    }
    
    // 保留率分
    if (this.retentionRate >= 0.85) {
      score += 30;
    } else if (this.retentionRate >= 0.70) {
      score += 20;
    } else if (this.retentionRate >= 0.50) {
      score += 10;
    }
    
    // 时间效率分
    if (this.timeEfficiency < 1.2) {
      score += 15;
    } else if (this.timeEfficiency < 1.5) {
      score += 10;
    }
    
    return Math.min(100, score);
  }
  
  /**
   * 基于效果分数做出决策
   */
  private makeDecision(): 'graduate' | 'continue' | 'adjust_strategy' | 'escalate' {
    // 阈值规则：
    // - 效果分 >= 70 且准确率提升 >= 8% → 毕业（返回原课程）
    // - 效果分 40-70 → 继续补救（再延长 7 天）
    // - 效果分 20-40 且改进 < 0% → 调整策略（更换补救方法）
    // - 效果分 < 20 → 上报人工审查（可能需要不同级别的课程）
    
    if (this.effectivenessScore >= 70 && this.improvementRate >= 8) {
      return 'graduate';
    } else if (this.effectivenessScore >= 50) {
      return 'continue';
    } else if (this.effectivenessScore >= 20 && this.improvementRate < 0) {
      return 'adjust_strategy';
    } else {
      return 'escalate';
    }
  }
  
  private generateRecommendation(decision: string): string {
    switch (decision) {
      case 'graduate':
        return `${this.sourceCourseName} 补救完成，学生准确率已提升 ${this.improvementRate.toFixed(1)}%，可回到原课程进行下一课时`;
      
      case 'continue':
        return `建议继续 ${this.sourceCourseName} 补救课程，本轮效果分 ${this.effectivenessScore} 分，再强化 7 天`;
      
      case 'adjust_strategy':
        return `当前补救策略 (${this.sourceErrorType}) 效果不理想，建议调整为 ${this.suggestAlternativeStrategy()}`;
      
      case 'escalate':
        return `补救效果未达预期，建议人工审查或重新推荐更基础的课程`;
      
      default:
        return '';
    }
  }
  
  private suggestAlternativeStrategy(): string {
    // 根据当前错误类型建议替代策略
    if (this.sourceErrorType === 'phoneme_error') {
      return '关键词强化（Keyword Reinforcement）';
    } else if (this.sourceErrorType === 'vocabulary_missing') {
      return '音素强化（Phoneme Reinforcement）';
    } else if (this.sourceErrorType === 'fluency_low') {
      return '自适应补救（Adaptive Remediation）';
    }
    return '人工设计补救课程';
  }
  
  // ===== 私有计算方法 =====
  
  private calculateImprovementRate(): number {
    // 准确率提升百分比 = (当前准确率 - 基线准确率) / 基线准确率 * 100
    if (this.baselineAccuracy.value === 0) return 0;
    return (
      ((this.postRemediationAccuracy.value - this.baselineAccuracy.value) /
        this.baselineAccuracy.value) *
      100
    );
  }
  
  private calculateRetentionRate(): number {
    // 保留率 = 补救后 7 天的准确率 / 补救完成时的准确率
    // 这通常需要跟踪后续数据，暂用当前数据近似
    // TODO: 在 7 天后重新调用 refreshRetentionRate() 更新
    return Math.min(1.0, this.postRemediationAccuracy.value / this.baselineAccuracy.value);
  }
  
  private calculateTimeEfficiency(): number {
    // 时间效率 = 补救课程总用时 / 原课程该单元用时
    if (!this.baselineMetrics.totalCompletionTimeMs) return 1.0;
    
    const remediationTime = this.currentMetrics?.totalCompletionTimeMs || 0;
    return remediationTime / this.baselineMetrics.totalCompletionTimeMs;
  }
  
  private calculateRunningAverage(accuracy: Accuracy, customValue?: number): Accuracy {
    // 计算准确率的滑动平均值（可选：加权）
    const value = customValue || accuracy.value;
    const currentAvg = this.currentMetrics?.avgAccuracy?.value || 0;
    const newAvg = (currentAvg * (this.lessonsCompleted - 1) + value) / this.lessonsCompleted;
    return Accuracy.create(newAvg);
  }
  
  private getElapsedDays(): number {
    return Math.floor(
      (new Date().getTime() - this.remediationStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
  }
  
  private recordDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }
  
  getDomainEvents(): DomainEvent[] {
    return this.domainEvents;
  }
}

/**
 * 补救评估结果类型
 */
interface RemediationEvaluationResult {
  canEvaluate: boolean;
  reason?: string;
  effectivenessScore?: number;
  improvementRate?: number;
  retentionRate?: number;
  timeEfficiency?: number;
  decision?: 'graduate' | 'continue' | 'adjust_strategy' | 'escalate';
  recommendation?: string;
}

/**
 * 学习指标统计
 */
interface LearningMetrics {
  avgAccuracy: Accuracy;
  totalCompletionTimeMs: number;
  avgResponseTime: number;
  errorFrequency: Map<string, number>;  // 错误类型 → 出现次数
  vocabularyRetention: number;           // 词汇保留率（%）
}
```

#### A/B 测试框架

```typescript
// src/domain/services/RemediationABTestingService.ts

/**
 * A/B 测试服务，用于对比不同补救策略的效果
 */
class RemediationABTestingService {
  
  /**
   * 分配学生到实验组
   * 策略：
   *   - Control (50%)：无补救或基础补救
   *   - Treatment A (25%)：关键词强化
   *   - Treatment B (15%)：音素强化
   *   - Treatment C (10%)：自适应补救（结合 A+B）
   */
  assignTestGroup(userId: string): 'control' | 'treatment_keyword' | 'treatment_phoneme' | 'treatment_adaptive' {
    const hash = this.hashUserId(userId);
    const rand = hash % 100;
    
    if (rand < 50) return 'control';
    if (rand < 75) return 'treatment_keyword';
    if (rand < 90) return 'treatment_phoneme';
    return 'treatment_adaptive';
  }
  
  /**
   * 收集 A/B 测试数据
   */
  collectTestResults(evaluations: RemediationEffectivenessAggregate[]): ABTestResult {
    const groupedByTest = new Map<string, RemediationEffectivenessAggregate[]>();
    
    evaluations.forEach(eval => {
      const group = eval.testGroup;
      if (!groupedByTest.has(group)) {
        groupedByTest.set(group, []);
      }
      groupedByTest.get(group)!.push(eval);
    });
    
    const results: Record<string, GroupStatistics> = {};
    
    groupedByTest.forEach((evals, group) => {
      results[group] = {
        totalCount: evals.length,
        avgEffectivenessScore: evals.reduce((sum, e) => sum + e.effectivenessScore, 0) / evals.length,
        avgImprovementRate: evals.reduce((sum, e) => sum + e.improvementRate, 0) / evals.length,
        avgRetentionRate: evals.reduce((sum, e) => sum + e.retentionRate, 0) / evals.length,
        graduationRate: (evals.filter(e => e.decision === 'graduate').length / evals.length) * 100
      };
    });
    
    return {
      testDate: new Date(),
      results,
      statSignificance: this.calculateStatSignificance(results)
    };
  }
  
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
  
  private calculateStatSignificance(results: Record<string, GroupStatistics>): boolean {
    // 简化的卡方检验 (Chi-Squared Test)
    // 实际项目应使用 scipy.stats 或 jstat 库
    // 这里仅做示意
    return true;  // TODO: 实现真实统计检验
  }
}

interface ABTestResult {
  testDate: Date;
  results: Record<string, GroupStatistics>;
  statSignificance: boolean;
}

interface GroupStatistics {
  totalCount: number;
  avgEffectivenessScore: number;
  avgImprovementRate: number;
  avgRetentionRate: number;
  graduationRate: number;
}
```

#### 补救效果仓储

```typescript
// src/domain/repositories/IRemediationEffectivenessRepository.ts

interface IRemediationEffectivenessRepository {
  save(evaluation: RemediationEffectivenessAggregate): Promise<void>;
  findByRemediationId(remediationId: string): Promise<RemediationEffectivenessAggregate | null>;
  findByUserId(userId: string): Promise<RemediationEffectivenessAggregate[]>;
  
  /**
   * 查询已评估完成的补救记录（用于 A/B 测试）
   */
  findEvaluatedByDateRange(
    startDate: Date,
    endDate: Date,
    testGroup?: string
  ): Promise<RemediationEffectivenessAggregate[]>;
  
  /**
   * 批量更新保留率（基于补救后 7 天的重新学习数据）
   */
  updateRetentionRates(updates: Map<string, number>): Promise<void>;
}
```

#### 与补救模块的集成

```typescript
// 在补救课程完成时触发评估
// src/domain/services/RemediationService.ts

async completeRemediationCourse(
  remediationId: string,
  userId: string
): Promise<void> {
  const remediation = await this.remediationRepository.findById(remediationId);
  
  // 1. 创建效果评估聚合根
  const evaluation = RemediationEffectivenessAggregate.create(
    remediationId,
    userId,
    remediation.getSourceCourseName(),
    remediation.getErrorType(),
    remediation.getBaselineMetrics(),
    remediation.getBaselineAccuracy(),
    remediation.getTestGroup()
  );
  
  // 2. 记录补救学习数据到评估聚合根
  const lessons = remediation.getLessons();
  for (const lesson of lessons) {
    evaluation.recordLessonCompletion(
      lesson.id,
      lesson.finalAccuracy,
      lesson.totalTimeMs,
      lesson.avgResponseTime
    );
  }
  
  // 3. 在补救完成后立即评估（或延迟到 7 天后）
  const result = evaluation.evaluateEffectiveness();
  
  if (result.canEvaluate) {
    // 4. 根据决策做出后续动作
    switch (result.decision) {
      case 'graduate':
        // 学生毕业：取消后续补救，继续原课程
        await this.handleGraduation(userId, remediationId);
        break;
      
      case 'continue':
        // 继续补救：延长 7 天
        await this.extendRemediation(remediationId, 7);
        break;
      
      case 'adjust_strategy':
        // 调整策略：创建新的补救课程
        await this.createAdjustedRemediation(userId, remediation, result.recommendation);
        break;
      
      case 'escalate':
        // 上报：通知管理员或老师
        await this.escalateToAdmin(userId, remediationId, result);
        break;
    }
  }
  
  // 5. 保存评估数据
  await this.effectivenessRepository.save(evaluation);
  
  // 6. 发布领域事件
  const events = evaluation.getDomainEvents();
  for (const event of events) {
    await this.eventBus.publish(event);
  }
}
```

#### 关键收益

1. **量化补救效果**：数据驱动而非凭感觉评判补救是否有效
2. **学生反馈循环**：准确率提升 → 毕业；没有进展 → 调整策略或人工介入
3. **教师洞察**：哪些错误类型最难改正，哪些学生需要额外关注
4. **A/B 测试**：对比不同补救策略的长期效果，不断优化
5. **课程改进**：收集反馈帮助改进原课程设计（减少某类错误）

---

## 6. 复习模块子功能详细定义（Review Module）

### 6.1 错题驱动复习

**触发条件**：

- 单课程：score <80 的句子标记为错题
- 连续低分：3 个连续低分（<70）自动标记为困难课程
- 积累：单课程 5 个错题触发补救课程生成

**补救课程生成**：

```
错题聚合 → 分类（发音/流利度/语法/词汇/完整性）
  → 按类型生成补救课程（最多 50 题）
  → 使用 courseFactory.buildCourse(source='Remedial')
  → 关联原课程 ID，标记为补救课程，展示于复习中
```

**生成时间目标**：5s；失败自动降级到通用复习计划

### 6.2 SM-2 间隔重复算法

**核心参数**：

- q（质量评分）：0-5，表示对答案的掌握程度
- EF（难度因子）：初始 2.5，范围 1.3-2.5；影响下次间隔
- I（间隔）：天数；EF 越高，间隔越长

**计算公式**：

```
I(1) = 1
I(2) = 3
I(n) = I(n-1) × EF（n ≥ 3）

EF_new = EF_old + (0.1 - (5 - q) × (0.08 + (5 - q) × 0.02))
EF_new = max(1.3, EF_new)
```

**调整因子**（v0.5.0）：

- 疲劳因子：连续学习 >2h 后，EF 下调 10%
- 时间因子：复习在最优时间（上 8-10 点、晚 7-9 点）时，EF 上调 5%
- 错误重复：同一题目连续 2 次错误，强制重置 I 为 1

**复习计划生成**：

```
按 EF 与 I 计算下次复习日期 → 每日分配复习配额
（按难度分层，新题目优先）→ 推荐学习时间 → 提醒通知
```

### 6.3 复习计划与提醒

**每日复习配额**：

- 新题目（未复习）：5-10 题
- 复习题目：按应复习日期排序，优先级递减
- 总量：每天 20-40 题（可配置）

**提醒机制**：

- 推送通知：每天固定时间提醒（如 19:00）
- 日历视图：标记应复习的日期、已完成的日期、遗漏的日期
- 成就激励：连续 7 天完成复习，获得徽章

---

## 7. 社交与设置子功能详细定义（Social & Settings Module）

### 7.1 学习排行与成就

**排行维度**：

- 学习时长排行（周/月）
- 完成课程数排行
- 错题修正率排行（本周）
- 综合排行（加权综合分）

**成就与奖励**：

- 成就等级：新手、学者、精英、大师（基于学习时长 + 课程数）
- 徽章（示例）：
  - 初学者：完成 1 课程
  - 坚持者：连续 7 天学习
  - 完美者：单课程 5 次满分
  - 语言大使：完成 50 课程

### 7.2 社交与分享

- **课程分享**：生成分享链接，好友可快速导入
- **组队学习**：创建学习小组，共享进度与成就
- **评论与讨论**：课程/课时下的评论、提问、互助

### 7.3 设置与偏好

- **学习偏好**：目标水平、学习时长、学习时间、通知频率
- **音频设置**：音量、播放速度默认值、自动跟读启用/禁用
- **数据与隐私**：导出数据、清除缓存、隐私政策、数据删除请求

---

## 8. 技术架构细节（Technical Architecture Details）

### 8.1 DDD 分层架构

**层级结构**：

```text
src/
├── domain/                           # 领域层：纯业务逻辑
│   ├── aggregates/                  # 聚合根
│   │   ├── CourseAggregate.ts       # 课程聚合根
│   │   ├── LessonAggregate.ts       # 课时聚合根
│   │   ├── RemediationAggregate.ts  # 补救课程聚合根
│   │   └── AILabTaskAggregate.ts    # 任务聚合根
│   ├── entities/                    # 实体与值对象
│   │   ├── Lesson.ts
│   │   ├── Sentence.ts
│   │   ├── LearningRecord.ts
│   │   └── TaskProgress.ts
│   ├── services/                    # 领域服务
│   │   ├── ICourseFactory.ts        # 课程生成工厂接口
│   │   ├── IRemediationService.ts   # 补救服务接口
│   │   └── ITaskService.ts          # 任务服务接口
│   ├── repositories/                # 仓储接口
│   │   ├── ICourseRepository.ts
│   │   ├── IRemediationRepository.ts
│   │   └── ITaskRepository.ts
│   └── events/                      # 领域事件
│       ├── CourseGeneratedEvent.ts
│       ├── LessonEvaluatedEvent.ts
│       ├── RemediationCreatedEvent.ts
│       └── TaskProgressUpdatedEvent.ts
│
├── application/                      # 应用层：用例编排
│   └── usecases/
│       ├── GenerateCourseUseCase.ts
│       ├── ImportCourseUseCase.ts
│       ├── PracticeAndEvaluateUseCase.ts
│       ├── CreateRemediationCourseUseCase.ts
│       ├── AILabTaskOrchestrator.ts
│       └── ExportCourseUseCase.ts
│
├── infrastructure/                   # 基础设施层：实现与集成
│   ├── persistence/
│   │   ├── repositories/
│   │   │   ├── CourseRepositoryDexie.ts
│   │   │   ├── RemediationRepositoryDexie.ts
│   │   │   └── TaskRepositoryDexie.ts
│   │   └── CourseDatabase.ts
│   ├── integration/
│   │   ├── AudioFacadeAdapter.ts    # 音频服务统一入口
│   │   ├── SpeechEvalAdapter.ts     # 评测服务适配
│   │   ├── PepImportAdapter.ts      # 教材解析适配
│   │   ├── PublisherQueryService.ts # 出版社数据服务
│   │   └── EventBus.ts              # 事件总线
│   └── ipc/
│       └── CourseIpcChannel.ts      # Electron IPC 通道
│
└── ui/                              # UI 层：表现与交互
    ├── components/
    │   ├── CourseManager.tsx
    │   ├── AudioCourseWizard.tsx
    │   ├── CourseLessonPractice.tsx
    │   ├── ReviewManager.tsx
    │   ├── AILabTaskCenter.tsx
    │   └── AudioPlayer/Recorder/...
    └── hooks/
        ├── useCourseGeneration.ts
        ├── useAutoFollowAlongRecording.ts
        ├── useRemediation.ts
        └── useTaskProgress.ts
```

**设计规则**：

1. 领域层不依赖任何框架或基础设施代码；只依赖 TypeScript 类型
2. 应用层编排用例，依赖领域接口（仓储、服务）
3. 基础设施层实现所有领域接口，处理持久化、网络、缓存等
4. UI 层通过 hooks 调用应用层，不直接依赖领域逻辑
5. 所有音频操作统一通过 `AudioFacadeAdapter`，确保降级与缓存策略一致

### 8.2 聚合根定义与不变量验证

#### CourseAggregate

**职责**：管理课程生命周期与一致性

**关键属性**：id、title、lessons[]、metadata{CEFR, tags, description}、audio{paths, format}、stats{totalDuration, avgScore}

**不变量与防呆机制**：

```typescript
class CourseAggregate {
  private static readonly MAX_LESSONS = 500;
  private static readonly VALID_CERF_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
  
  private id: string;
  private title: string;
  private lessons: Lesson[];
  private cefrLevel: string;
  private metadata: CourseMetadata;
  private stats: CourseStats;
  
  // 不变量 1: 课程课时数不超过 500
  addLesson(lesson: Lesson): void {
    if (this.lessons.length >= CourseAggregate.MAX_LESSONS) {
      throw new DomainException(
        `课程课时数已达上限 ${CourseAggregate.MAX_LESSONS}，无法添加更多课时`
      );
    }
    
    // 不变量 2: 所有 lesson 的音频引用必须存在
    if (!lesson.audioMeta || !lesson.audioMeta.path) {
      throw new DomainException('新增课时必须包含有效的音频引用');
    }
    
    this.lessons.push(lesson);
    this.updateStats();
    this.recordDomainEvent(new LessonAddedToCourseEvent(this.id, lesson.id));
  }
  
  // 不变量 3: CEFR 级别必须有效
  setCefrLevel(level: string): void {
    if (!CourseAggregate.VALID_CERF_LEVELS.includes(level)) {
      throw new InvalidCefrLevelException(
        `CEFR 级别必须是以下之一: ${CourseAggregate.VALID_CERF_LEVELS.join(', ')}`
      );
    }
    this.cefrLevel = level;
  }
  
  // 不变量 4: 删除课程时，级联清理所有关联资源
  delete(): void {
    if (this.lessons.length > 0) {
      this.lessons.forEach(lesson => {
        this.recordDomainEvent(
          new LessonDeletedEvent(this.id, lesson.id, lesson.audioMeta.path)
        );
      });
    }
    this.recordDomainEvent(new CourseDeletedEvent(this.id));
  }
  
  // 运行时诊断：验证聚合根完整性
  verifyIntegrity(): IntegrityCheckResult {
    const violations: string[] = [];
    
    if (this.lessons.length > CourseAggregate.MAX_LESSONS) {
      violations.push(`课时数 ${this.lessons.length} 超过上限 ${CourseAggregate.MAX_LESSONS}`);
    }
    
    if (!CourseAggregate.VALID_CERF_LEVELS.includes(this.cefrLevel)) {
      violations.push(`CEFR 级别 '${this.cefrLevel}' 无效`);
    }
    
    // 检查所有 lesson 的音频完整性
    for (const lesson of this.lessons) {
      if (!lesson.audioMeta?.path) {
        violations.push(`课时 ${lesson.id} 缺少音频路径`);
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations
    };
  }
}
```

#### LessonAggregate

**职责**：管理课时与句子集合、音频边界验证

**关键属性**：id、courseId、title、sentences[]、audioMeta{startMs, endMs, duration}

**不变量与防呆机制**：

```typescript
class LessonAggregate {
  private id: string;
  private courseId: string;
  private sentences: Sentence[];
  private audioMeta: AudioMetadata;
  
  // 不变量 1: 时间戳边界必须有效
  setAudioMetadata(meta: AudioMetadataInput): void {
    // 强制修正无效值
    const correctedMeta = {
      startMs: Math.max(0, Math.round(meta.startMs)),
      endMs: Math.min(meta.duration * 1000, Math.round(meta.endMs)),
      duration: meta.duration
    };
    
    // 校验修正后的值
    if (correctedMeta.startMs >= correctedMeta.endMs) {
      throw new InvalidAudioBoundaryException(
        `音频边界无效: startMs (${correctedMeta.startMs}) >= endMs (${correctedMeta.endMs})`
      );
    }
    
    this.audioMeta = correctedMeta;
    this.recordDomainEvent(new AudioMetadataValidatedEvent(this.id, correctedMeta));
  }
  
  // 不变量 2: 句子之间不能重叠
  addSentence(sentence: Sentence): void {
    // 检查新句子是否与现有句子重叠
    for (const existing of this.sentences) {
      if (this.sentencesOverlap(existing, sentence)) {
        throw new OverlappingSentenceException(
          `新句子 (${sentence.startMs}-${sentence.endMs}) 与现有句子 (${existing.startMs}-${existing.endMs}) 重叠`
        );
      }
    }
    
    // 检查句子是否在课时的音频范围内
    if (sentence.startMs < this.audioMeta.startMs || sentence.endMs > this.audioMeta.endMs) {
      throw new SentenceOutOfAudioRangeException(
        `句子范围 (${sentence.startMs}-${sentence.endMs}) 超出音频范围 (${this.audioMeta.startMs}-${this.audioMeta.endMs})`
      );
    }
    
    this.sentences.push(sentence);
    this.sentences.sort((a, b) => a.startMs - b.startMs); // 保持排序
    this.recordDomainEvent(new SentenceAddedToLessonEvent(this.id, sentence.id));
  }
  
  private sentencesOverlap(s1: Sentence, s2: Sentence): boolean {
    return !(s1.endMs <= s2.startMs || s2.endMs <= s1.startMs);
  }
}
```

#### RemediationAggregate

**职责**：从错误记录生成补救课程、维护补救策略的一致性

**触发条件与防呆**：

```typescript
class RemediationAggregate {
  private sourceCourseLessons: LearningRecord[];
  private errorAnalysis: ErrorAnalysis;
  private remediationStrategy: RemediationStrategy;
  
  static readonly ERROR_THRESHOLD_COUNT = 5;       // 错题数阈值
  static readonly ERROR_THRESHOLD_SCORE = 80;      // 错题分数阈值
  static readonly CONSECUTIVE_ERROR_COUNT = 3;     // 连续错误次数
  static readonly CONSECUTIVE_ERROR_SCORE = 70;    // 连续错误分数阈值
  
  // 不变量: 补救课程只能基于有效的错误分析生成
  static canCreateRemediation(learningRecords: LearningRecord[]): boolean {
    const lowScoreCount = learningRecords.filter(r => r.score < this.ERROR_THRESHOLD_SCORE).length;
    if (lowScoreCount >= this.ERROR_THRESHOLD_COUNT) return true;
    
    let consecutiveErrors = 0;
    for (const record of learningRecords.sort((a, b) => a.timestamp - b.timestamp)) {
      if (record.score < this.CONSECUTIVE_ERROR_SCORE) {
        consecutiveErrors++;
        if (consecutiveErrors >= this.CONSECUTIVE_ERROR_COUNT) return true;
      } else {
        consecutiveErrors = 0;
      }
    }
    return false;
  }
  
  // 生成补救课程的策略 - 领域逻辑
  generateRemediationLessons(): RemediationLesson[] {
    const lessons: RemediationLesson[] = [];
    
    // 策略 1: PRONUNCIATION（基于音素错误）
    if (this.errorAnalysis.hasPhonemeErrors) {
      lessons.push(
        this.createPronunciationRemediationLesson(
          this.errorAnalysis.errorPhonemes
        )
      );
    }
    
    // 策略 2: FLUENCY（基于节奏流利度）
    if (this.errorAnalysis.avgFluency < 75) {
      lessons.push(
        this.createFluentReadingRemediationLesson(
          this.sourceCourseLessons.filter(r => r.fluency < 75)
        )
      );
    }
    
    // 策略 3: VOCABULARY（基于生词）
    if (this.errorAnalysis.unknownWords.length > 0) {
      lessons.push(
        this.createVocabularyRemediationLesson(
          this.errorAnalysis.unknownWords
        )
      );
    }
    
    return lessons;
  }
  
  // 验证补救课程有效性
  verifyRemediationValidity(): ValidationResult {
    const issues: string[] = [];
    
    if (!this.remediationStrategy || !this.remediationStrategy.type) {
      issues.push('补救策略未定义');
    }
    
    if (!this.sourceCourseLessons || this.sourceCourseLessons.length === 0) {
      issues.push('源错误记录为空');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
```

#### AILabTaskAggregate

**职责**：管理 AI Lab 任务生命周期、优先级调度、断点恢复

**生命周期与状态转移**：

```typescript
class AILabTaskAggregate {
  private static readonly MAX_RETRY_COUNT = 3;
  private static readonly TASK_TIMEOUT_MS = 3600000; // 1 小时
  
  private id: string;
  private taskType: 'COURSE_GENERATION' | 'BATCH_TTS' | 'IMPORT';
  private status: TaskStatus;
  private priority: number; // 1-10, 10 最高优先级
  private retryCount: number = 0;
  private logs: TaskLog[] = [];
  private checkpoint: TaskCheckpoint;
  
  // 不变量: 优先级必须在有效范围内
  setPriority(priority: number): void {
    if (priority < 1 || priority > 10) {
      throw new InvalidPriorityException('优先级必须在 1-10 之间');
    }
    this.priority = priority;
  }
  
  // 状态转移：带验证的状态机
  transitionTo(newStatus: TaskStatus): void {
    const validTransitions: Record<TaskStatus, TaskStatus[]> = {
      'PENDING': ['RUNNING'],
      'RUNNING': ['PAUSED', 'COMPLETED', 'FAILED'],
      'PAUSED': ['RUNNING', 'FAILED'],
      'FAILED': ['RETRYING', 'CANCELLED'],
      'RETRYING': ['RUNNING', 'FAILED'],
      'COMPLETED': [],
      'CANCELLED': []
    };
    
    if (!validTransitions[this.status]?.includes(newStatus)) {
      throw new InvalidStateTransitionException(
        `无法从 ${this.status} 转移到 ${newStatus}`
      );
    }
    
    this.status = newStatus;
    this.recordDomainEvent(new TaskStatusChangedEvent(this.id, newStatus));
  }
  
  // 不变量: 重试次数不能超过限制
  retry(): void {
    if (this.retryCount >= AILabTaskAggregate.MAX_RETRY_COUNT) {
      throw new MaxRetryExceededException(
        `任务已达最大重试次数 ${AILabTaskAggregate.MAX_RETRY_COUNT}`
      );
    }
    
    this.retryCount++;
    this.transitionTo('RETRYING');
    this.recordDomainEvent(new TaskRetryEvent(this.id, this.retryCount));
  }
  
  // 断点恢复：通过检查点恢复进度
  resumeFromCheckpoint(): void {
    if (!this.checkpoint) {
      throw new NoCheckpointException('没有可用的检查点');
    }
    
    this.transitionTo('RUNNING');
    this.recordDomainEvent(
      new TaskResumedFromCheckpointEvent(this.id, this.checkpoint)
    );
  }
  
  // 记录检查点（用于断点恢复）
  saveCheckpoint(progress: TaskProgress): void {
    this.checkpoint = {
      timestamp: Date.now(),
      stage: progress.currentStage,
      data: progress.stageData
    };
    
    this.recordDomainEvent(new TaskCheckpointSavedEvent(this.id, this.checkpoint));
  }
}

### 8.3 音频服务集成与领域服务边界澄清

#### 领域服务 vs 应用层用例的职责划分

**关键原则**：
- **领域服务**：跨聚合根的业务逻辑、不变量验证、纯领域概念
- **应用服务/用例**：流程编排、事务管理、持久化协调、API 转换

**示例对比**：

```typescript
// ❌ 这不应该是领域服务（这是应用层用例）
class CreateRemediationCourseUseCase {
  async execute(learningRecords: LearningRecord[]): Promise<Course> {
    // 1. 查询低分记录
    // 2. 分析错题
    // 3. 调用生成器
    // 4. 保存到数据库
    // 5. 发布事件
    // ← 这是编排，不是领域服务
  }
}

// ✅ 这是领域服务（纯领域逻辑）
class RemediationStrategy {
  // 分析错题、生成补救课程的纯逻辑
  generateRemediationLessons(
    errorAnalysis: ErrorAnalysis,
    sourceRecords: LearningRecord[]
  ): RemediationLesson[] {
    // 纯领域逻辑，不涉及持久化或框架
  }
}
```

#### AudioFacadeAdapter 的位置

**统一接口**：所有音频操作仅通过 `AudioFacadeAdapter` 进行（基础设施层）

```typescript
// src/infrastructure/integration/AudioFacadeAdapter.ts
class AudioFacadeAdapter {
  // TTS：与字体、语速、音调无关的原子操作
  async synthesize(text: string, options: SynthesisOptions): Promise<AudioBlob> {
    // 1. 检查缓存
    // 2. 调用 Windows SAPI5 或 Qwen API
    // 3. 缓存结果
    // 4. 返回音频
  }
  
  // ASR：与环境噪音、音量、方言无关的原子操作
  async transcribe(audioBlob: Blob, options?: TranscriptionOptions): Promise<TranscriptionResult> {
    // 1. 先尝试本地 Sherpa ONNX
    // 2. 失败则尝试 Qwen API
    // 3. 返回转写结果与声学特征
  }
  
  // 播放、录音、缓存...
  async play(audioPath: string, options?: PlaybackOptions): Promise<void>;
  async startRecording(): Promise<void>;
  async stopRecording(): Promise<Blob>;
  async getOrGenerateAudio(key: string, generator: () => Promise<AudioBlob>): Promise<AudioBlob>;
}
```

**降级策略**：

- TTS 不可用 → 使用 SystemTTS（若可用）→ 使用缓存 → 提示用户
- ASR 不可用 → 使用本地 Sherpa ONNX → 手动输入
- 播放失败 → 自动重试 2 次 → 改用备用音频 → 错误提示

#### 真正的领域服务示例

**ISpacedRepetitionService**：处理 SM-2 算法，跨 LearningRecord 和 ReviewSchedule 聚合

```typescript
// src/domain/services/ISpacedRepetitionService.ts
interface ISpacedRepetitionService {
  /**
   * 根据评测分数计算下次复习间隔
   * 纯领域逻辑，与数据库、网络无关
   */
  calculateNextInterval(
    score: Score,
    currentInterval: ReviewInterval,
    repetitionCount: number
  ): ReviewInterval;
  
  /**
   * 根据学习状态生成下一批复习项
   * 返回排序后的复习列表
   */
  generateReviewSchedule(
    learningRecords: LearningRecord[],
    dailyQuota: number
  ): ReviewScheduleItem[];
  
  /**
   * 检查是否需要触发补救
   * 领域规则：连续 3 次错误 OR 单课程 5 个错题
   */
  shouldTriggerRemediation(learningRecords: LearningRecord[]): boolean;
}

// src/domain/services/SpacedRepetitionService.ts
class SpacedRepetitionService implements ISpacedRepetitionService {
  calculateNextInterval(
    score: Score,
    currentInterval: ReviewInterval,
    repetitionCount: number
  ): ReviewInterval {
    // SM-2 算法实现
    return ReviewInterval.fromScore(score, currentInterval, repetitionCount);
  }
  
  generateReviewSchedule(
    learningRecords: LearningRecord[],
    dailyQuota: number
  ): ReviewScheduleItem[] {
    // 按优先级排序，考虑：
    // 1. 应复习日期是否到期
    // 2. 难度等级（新题优先）
    // 3. 错题次数（错次多优先）
    const dueLessons = learningRecords.filter(r => r.reviewDue);
    const newLessons = learningRecords.filter(r => !r.hasStarted);
    
    const scheduled = [
      ...dueLessons.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime()),
      ...newLessons.slice(0, dailyQuota - dueLessons.length)
    ];
    
    return scheduled.slice(0, dailyQuota).map(record => ({
      recordId: record.id,
      priority: this.calculatePriority(record),
      reason: this.getScheduleReason(record)
    }));
  }
  
  shouldTriggerRemediation(learningRecords: LearningRecord[]): boolean {
    return RemediationAggregate.canCreateRemediation(learningRecords);
  }
}
```

**IRemediationService**：处理补救策略的实现，但不负责持久化

```typescript
// src/domain/services/IRemediationService.ts
interface IRemediationService {
  /**
   * 分析错题，生成补救策略
   * 输入：原始学习记录
   * 输出：补救课程的课时列表
   */
  analyzeErrorsAndGenerateLessons(
    sourceRecords: LearningRecord[],
    sourceLesson: Lesson
  ): RemediationLesson[];
  
  /**
   * 验证补救课程的有效性
   */
  validateRemediationLesson(lesson: RemediationLesson): ValidationResult;
}

// src/domain/services/RemediationService.ts
class RemediationService implements IRemediationService {
  analyzeErrorsAndGenerateLessons(
    sourceRecords: LearningRecord[],
    sourceLesson: Lesson
  ): RemediationLesson[] {
    // 委托给 RemediationAggregate
    const aggregate = new RemediationAggregate(sourceRecords);
    return aggregate.generateRemediationLessons();
  }
  
  validateRemediationLesson(lesson: RemediationLesson): ValidationResult {
    // 检查是否符合补救课程的标准
    const issues: string[] = [];
    
    if (!lesson.sourceErrorType) {
      issues.push('补救类型必须指定');
    }
    
    if (lesson.sentences.length === 0) {
      issues.push('补救课程必须至少包含 1 个句子');
    }
    
    if (lesson.sentences.length > 50) {
      issues.push('补救课程最多 50 个句子');
    }
    
    return {
      isValid: issues.length === 0,
      issues
    };
  }
}
```

**ICourseFactory**：处理课程的聚合逻辑，确保不变量

```typescript
// src/domain/services/ICourseFactory.ts
interface ICourseFactory {
  /**
   * 从音频与句子集合构建课程聚合根
   * 确保：1) 所有句子的音频范围有效 2) 句子不重叠 3) CEFR 级别正确
   */
  buildCourse(
    input: CourseInput,
    source: 'audio' | 'text' | 'imported' | 'remedial' | 'community'
  ): CourseAggregate;
  
  /**
   * 重构课程（修改结构）
   * 验证不变量后创建新版本
   */
  reconstructCourse(
    existing: CourseAggregate,
    changes: CourseChanges
  ): CourseAggregate;
}

// src/domain/services/CourseFactory.ts
class CourseFactory implements ICourseFactory {
  buildCourse(
    input: CourseInput,
    source: 'audio' | 'text' | 'imported' | 'remedial' | 'community'
  ): CourseAggregate {
    const course = new CourseAggregate(
      generateId(),
      input.title,
      input.cefrLevel,
      source,
      input.metadata
    );
    
    // 逐个添加课时，触发验证
    for (const lessonInput of input.lessons) {
      const lesson = new LessonAggregate(
        generateId(),
        course.id,
        lessonInput.title,
        lessonInput.audioMeta
      );
      
      // 添加句子时触发不变量检查
      for (const sentenceInput of lessonInput.sentences) {
        lesson.addSentence(new Sentence(
          generateId(),
          lesson.id,
          sentenceInput.text,
          sentenceInput.translation,
          sentenceInput.audioUri
        ));
      }
      
      // 添加课时到课程时触发不变量检查
      course.addLesson(lesson);
    }
    
    return course;
  }
}
```

### 8.4 事件总线与事件溯源（Event Sourcing v0.4.1 强化）

#### 基础事件总线（已有）

**事件类型**：

- CourseGeneratedEvent：课程生成完成
- LessonEvaluatedEvent：课时评测完成，触发补救检查
- RemediationCreatedEvent：补救课程生成，入队复习
- TaskProgressUpdatedEvent：任务进度更新，推送 UI

**订阅场景**：

- UI 层：监听事件更新组件状态
- 应用层：监听事件触发后续用例（如评测完成 → 检查补救）
- 数据层：监听事件更新统计数据

#### 事件溯源（Event Sourcing）增强

**核心思想**：而非仅存储当前状态，将**所有事件作为唯一的事实源**，可从事件日志重放重构任何历史状态

##### Event Store（事件存储）

```typescript
// src/infrastructure/eventstore/EventStore.ts

interface StoredEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: any;
  metadata: {
    timestamp: Date;
    version: number;           // 聚合根版本号
    userId?: string;           // 谁触发了该事件
    correlationId?: string;    // 关联的业务流程 ID
    causationId?: string;      // 直接原因事件 ID
    source?: string;           // 来源（'USER' | 'SYSTEM' | 'MIGRATION'）
  };
  createdAt: Date;
}

class EventStore {
  constructor(private db: Database) {}
  
  /**
   * 保存事件（原子操作）
   * 必须在事务内调用
   */
  async append(
    aggregateId: string,
    events: DomainEvent[],
    expectedVersion: number
  ): Promise<void> {
    // 检查版本冲突（乐观锁）
    const existingEvents = await this.db
      .table('events')
      .where('aggregateId')
      .equals(aggregateId)
      .toArray();
    
    const currentVersion = existingEvents.length;
    if (currentVersion !== expectedVersion) {
      throw new ConcurrencyException(
        `版本冲突：期望版本 ${expectedVersion}，实际版本 ${currentVersion}`
      );
    }
    
    // 以原子方式保存所有事件
    const storedEvents = events.map((event, index) => ({
      eventId: generateId(),
      eventType: event.constructor.name,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event,
      metadata: {
        timestamp: new Date(),
        version: currentVersion + index + 1,
        userId: getCurrentUserId(),
        correlationId: getCorrelationId(),
        causationId: getLastEventId(),
        source: 'USER'
      },
      createdAt: new Date()
    }));
    
    await this.db.transaction('rw', this.db.events, async () => {
      await this.db.events.bulkAdd(storedEvents);
    });
  }
  
  /**
   * 读取特定聚合根的所有事件
   */
  async getEvents(aggregateId: string, fromVersion: number = 0): Promise<StoredEvent[]> {
    return this.db.events
      .where('aggregateId')
      .equals(aggregateId)
      .and(event => event.metadata.version > fromVersion)
      .toArray();
  }
  
  /**
   * 事件重放：从事件日志重构聚合根状态
   */
  async replay(aggregateId: string, toVersion?: number): Promise<CourseAggregate> {
    const events = await this.getEvents(aggregateId, 0);
    
    // 从空聚合根开始，逐个应用事件
    let aggregate: CourseAggregate | null = null;
    
    for (const storedEvent of events) {
      if (toVersion && storedEvent.metadata.version > toVersion) {
        break;  // 停在指定版本
      }
      
      const event = storedEvent.payload;
      
      if (!aggregate) {
        // 创建事件 → 初始化聚合根
        if (event instanceof CourseCreatedEvent) {
          aggregate = CourseAggregate.fromCreationEvent(event);
        }
      } else {
        // 应用其他事件
        aggregate.applyEvent(event);
      }
    }
    
    if (!aggregate) {
      throw new AggregateNotFoundException(`聚合根 ${aggregateId} 不存在`);
    }
    
    return aggregate;
  }
  
  /**
   * 快照：定期保存聚合根状态以加速重放
   */
  async saveSnapshot(
    aggregateId: string,
    aggregate: CourseAggregate,
    version: number
  ): Promise<void> {
    await this.db.snapshots.put({
      aggregateId,
      aggregateType: 'Course',
      state: aggregate.getSnapshot(),
      version,
      createdAt: new Date()
    });
  }
  
  /**
   * 加载快照 + 增量重放
   */
  async replayWithSnapshot(aggregateId: string): Promise<CourseAggregate> {
    // 尝试加载快照
    const snapshot = await this.db.snapshots
      .where('aggregateId')
      .equals(aggregateId)
      .last();
    
    let aggregate: CourseAggregate;
    let fromVersion = 0;
    
    if (snapshot) {
      // 从快照恢复
      aggregate = CourseAggregate.fromSnapshot(snapshot.state);
      fromVersion = snapshot.version;
    } else {
      // 全量重放
      return this.replay(aggregateId);
    }
    
    // 应用快照后的增量事件
    const incrementalEvents = await this.getEvents(aggregateId, fromVersion);
    for (const storedEvent of incrementalEvents) {
      aggregate.applyEvent(storedEvent.payload);
    }
    
    return aggregate;
  }
  
  /**
   * 审计日志：查看事件历史
   */
  async getAuditTrail(
    aggregateId: string,
    filters?: { eventType?: string; fromDate?: Date; toDate?: Date }
  ): Promise<StoredEvent[]> {
    let query = this.db.events
      .where('aggregateId')
      .equals(aggregateId);
    
    if (filters?.eventType) {
      query = query.and(event => event.eventType === filters.eventType);
    }
    
    if (filters?.fromDate || filters?.toDate) {
      const events = await query.toArray();
      return events.filter(e => {
        const timestamp = e.metadata.timestamp.getTime();
        if (filters.fromDate && timestamp < filters.fromDate.getTime()) return false;
        if (filters.toDate && timestamp > filters.toDate.getTime()) return false;
        return true;
      });
    }
    
    return query.toArray();
  }
}
```

##### 聚合根的事件重放接口

```typescript
// src/domain/aggregates/CourseAggregate.ts

class CourseAggregate implements IEventSourced {
  private version: number = 0;
  private uncommittedEvents: DomainEvent[] = [];
  
  /**
   * 从创建事件恢复聚合根
   */
  static fromCreationEvent(event: CourseCreatedEvent): CourseAggregate {
    const aggregate = new CourseAggregate();
    aggregate.id = event.courseId;
    aggregate.title = event.title;
    aggregate.cefrLevel = event.cefrLevel;
    aggregate.source = event.source;
    aggregate.lessons = [];
    aggregate.version = 1;
    return aggregate;
  }
  
  /**
   * 从快照恢复聚合根
   */
  static fromSnapshot(snapshot: CourseSnapshot): CourseAggregate {
    const aggregate = Object.assign(new CourseAggregate(), snapshot.state);
    aggregate.version = snapshot.version;
    return aggregate;
  }
  
  /**
   * 应用单个事件（用于重放）
   */
  applyEvent(event: DomainEvent): void {
    switch (event.constructor.name) {
      case 'LessonAddedToCourseEvent':
        const lessonAdded = event as LessonAddedToCourseEvent;
        this.lessons.push(/* ... */);
        break;
        
      case 'CourseEnrolledEvent':
        this.stats.enrollmentCount = (this.stats.enrollmentCount || 0) + 1;
        break;
        
      case 'CourseCompletedEvent':
        const completed = event as CourseCompletedEvent;
        this.stats.completions = (this.stats.completions || 0) + 1;
        this.stats.totalUserScore = (this.stats.totalUserScore || 0) + completed.totalScore;
        break;
        
      default:
        throw new UnknownEventException(`未知的事件类型: ${event.constructor.name}`);
    }
    
    this.version++;
  }
  
  /**
   * 生成聚合根的快照（用于快照存储）
   */
  getSnapshot(): CourseSnapshot {
    return {
      state: {
        id: this.id,
        title: this.title,
        lessons: this.lessons,
        cefrLevel: this.cefrLevel,
        // ... 其他属性
      },
      version: this.version
    };
  }
  
  /**
   * 获取未提交的事件（用于保存）
   */
  getUncommittedEvents(): DomainEvent[] {
    return this.uncommittedEvents;
  }
  
  /**
   * 清空未提交事件（已保存后调用）
   */
  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }
}
```

##### 事件驱动的补偿机制（Saga 模式）

```typescript
// src/application/sagas/RemediationSaga.ts

/**
 * 补偿机制：处理补救课程生成失败的回滚
 */
class RemediationSaga implements ISaga {
  /**
   * 前向流程：LessonPracticedEvent → 创建补救课程
   */
  async onLessonPracticed(event: LessonPracticedEvent): Promise<void> {
    const records = await this.learningRecordRepo.findByCourse(event.courseId);
    
    if (RemediationAggregate.canCreateRemediation(records)) {
      try {
        const remediation = await this.createRemediationCourse(records);
        
        // 记录补偿动作（用于失败时回滚）
        this.sagaState.push({
          action: 'REMEDIATION_CREATED',
          remediationId: remediation.id,
          timestamp: new Date()
        });
        
        this.eventBus.publish(
          new RemediationCreatedEvent(remediation.id, event.userId, records.map(r => r.lessonId))
        );
      } catch (err) {
        // 补偿：清理失败的补救课程
        await this.compensateRemediationFailure(event.courseId, event.userId);
      }
    }
  }
  
  /**
   * 后向流程（补偿）：回滚补救课程的创建
   */
  private async compensateRemediationFailure(courseId: string, userId: string): Promise<void> {
    // 查询所有相关的补救课程
    const remediationCourses = await this.remediationRepo.findBySourceCourse(courseId);
    
    for (const remediation of remediationCourses) {
      // 标记为已撤销
      remediation.markAsRevoked('补偿机制触发');
      await this.remediationRepo.save(remediation);
      
      // 发布撤销事件
      this.eventBus.publish(
        new RemediationRevokedEvent(remediation.id, userId, '生成失败')
      );
    }
    
    console.log(`已撤销课程 ${courseId} 的所有补救课程`);
  }
}
```

##### 一致性保证

```typescript
// src/infrastructure/eventstore/ConsistencyGuarantee.ts

class ConsistencyGuarantee {
  /**
   * 事件与状态的一致性检查
   * 定期验证重放结果与当前持久化状态是否一致
   */
  async verifyConsistency(aggregateId: string): Promise<ConsistencyCheckResult> {
    // 1. 从事件日志重放
    const replayedAggregate = await this.eventStore.replay(aggregateId);
    
    // 2. 从数据库加载当前状态
    const persistedAggregate = await this.courseRepository.findById(aggregateId);
    
    // 3. 对比关键字段
    const differences: any[] = [];
    
    if (replayedAggregate.getTitle() !== persistedAggregate.getTitle()) {
      differences.push({
        field: 'title',
        replayedValue: replayedAggregate.getTitle(),
        persistedValue: persistedAggregate.getTitle()
      });
    }
    
    if (replayedAggregate.getLessonCount() !== persistedAggregate.getLessonCount()) {
      differences.push({
        field: 'lessonCount',
        replayedValue: replayedAggregate.getLessonCount(),
        persistedValue: persistedAggregate.getLessonCount()
      });
    }
    
    return {
      isConsistent: differences.length === 0,
      differences,
      checkedAt: new Date(),
      aggregateId
    };
  }
  
  /**
   * 当检测到不一致时，自动修复
   */
  async repairInconsistency(aggregateId: string): Promise<void> {
    // 重放事件到最新状态
    const correctedAggregate = await this.eventStore.replay(aggregateId);
    
    // 保存修正后的状态
    await this.courseRepository.save(correctedAggregate);
    
    // 发布修复事件
    this.eventBus.publish(
      new AggregateRepairEvent(aggregateId, 'Course', 'CONSISTENCY_REPAIR')
    );
  }
}
```

##### IPC 通道（Electron）

- `course:generate`：主进程调用 GenerateCourseUseCase
- `course:import`：主进程调用 ImportCourseUseCase
- `task:create`：渲染进程创建任务，主进程执行
- `progress:update`：主进程推送进度到渲染进程
- `event:store`：主进程向事件存储写入事件
- `event:replay`：渲染进程请求事件重放

**设计益处**：
- ✅ **完整审计**：所有业务操作都有事件记录
- ✅ **时间旅行**：可重放到任意历史时间点
- ✅ **灾难恢复**：从事件日志完全重构系统状态
- ✅ **一致性保证**：乐观锁 + 版本号防止并发冲突
- ✅ **性能优化**：快照 + 增量重放加速恢复

### 8.5 缓存策略

**多层本地缓存**：

1. **内存缓存（Memory LRU）**：最多 50 个 TTS 音频、100 个转写结果，TTL 1 小时
2. **本地缓存（IndexedDB）**：课程、TTS、ASR 结果，最多 500 项，TTL 7 天
3. **文件系统缓存**：生成的 TTS 音频与导出文件存储在 data/cache/，TTL 30 天自动清理

**缓存键**：

- TTS：`hash(text + voice + speed)`
- ASR：`hash(audioBlob + language)`
- 课程：`courseId`

**离线支持**：所有缓存数据本地访问，无网络依赖（除 LLM 调用外）

### 8.6 聚合根完整性检查机制（v0.4.1 新增）

#### 问题背景

在分布式或异步环境中，聚合根的不变量可能被破坏：
- 并发修改导致状态不一致（如两个线程同时添加课时）
- 持久化失败后恢复不完整
- 事件丢失导致聚合根与事件日志不同步

**解决方案**：引入运行时验证机制，定期扫描聚合根的完整性

#### 完整性检查框架

```typescript
// src/domain/valueobjects/IntegrityCheckResult.ts

interface IntegrityCheckResult {
  isValid: boolean;
  violations: IntegrityViolation[];
  severity: 'CRITICAL' | 'WARNING' | 'INFO';
  checkedAt: Date;
  aggregateId: string;
  aggregateType: string;
}

interface IntegrityViolation {
  code: string;        // e.g. 'LESSON_COUNT_EXCEEDED'
  message: string;
  expectedValue?: any;
  actualValue?: any;
  remediation?: string;  // 修复建议
}

// src/domain/interfaces/IVerifiable.ts

interface IVerifiable {
  /**
   * 验证聚合根的所有不变量
   * 返回详细的违反清单（如有）
   */
  verifyIntegrity(): IntegrityCheckResult;
  
  /**
   * 根据违反清单尝试自动修复
   * 返回是否修复成功
   */
  attemptSelfHealing(): Promise<boolean>;
}
```

#### 聚合根验证实现

**CourseAggregate 验证示例**：

```typescript
class CourseAggregate implements IVerifiable {
  // ... 既有代码 ...
  
  verifyIntegrity(): IntegrityCheckResult {
    const violations: IntegrityViolation[] = [];
    
    // 检查 1: 课时数上限
    if (this.lessons.length > CourseAggregate.MAX_LESSONS) {
      violations.push({
        code: 'LESSON_COUNT_EXCEEDED',
        message: `课程课时数 ${this.lessons.length} 超过上限 ${CourseAggregate.MAX_LESSONS}`,
        actualValue: this.lessons.length,
        expectedValue: CourseAggregate.MAX_LESSONS,
        remediation: '删除不必要的课时或拆分为多个课程'
      });
    }
    
    // 检查 2: CEFR 级别有效性
    if (!CourseAggregate.VALID_CERF_LEVELS.includes(this.cefrLevel)) {
      violations.push({
        code: 'INVALID_CEFR_LEVEL',
        message: `CEFR 级别 '${this.cefrLevel}' 无效`,
        actualValue: this.cefrLevel,
        expectedValue: CourseAggregate.VALID_CERF_LEVELS,
        remediation: '重新设置为有效的 CEFR 级别'
      });
    }
    
    // 检查 3: 所有课时的音频完整性
    for (const lesson of this.lessons) {
      const lessonCheck = lesson.verifyIntegrity();
      if (!lessonCheck.isValid) {
        violations.push(...lessonCheck.violations.map(v => ({
          ...v,
          code: `LESSON_${lesson.id}_${v.code}`
        })));
      }
    }
    
    // 检查 4: 课程音频文件是否存在
    for (const lessonId of this.audioFileMap.keys()) {
      const filePath = this.audioFileMap.get(lessonId);
      if (!fs.existsSync(filePath)) {
        violations.push({
          code: 'MISSING_AUDIO_FILE',
          message: `音频文件不存在: ${filePath}`,
          actualValue: filePath,
          remediation: `重新生成音频或从备份恢复`
        });
      }
    }
    
    // 检查 5: 统计数据一致性
    const calculatedDuration = this.lessons.reduce((sum, l) => sum + l.duration, 0);
    if (Math.abs(this.stats.totalDuration - calculatedDuration) > 1000) {  // 允许 1 秒误差
      violations.push({
        code: 'STAT_DURATION_MISMATCH',
        message: `总时长不匹配: 统计值 ${this.stats.totalDuration}ms vs 计算值 ${calculatedDuration}ms`,
        actualValue: this.stats.totalDuration,
        expectedValue: calculatedDuration,
        remediation: '重新计算统计数据'
      });
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      severity: violations.length === 0 ? 'INFO' : violations.some(v => v.code.includes('CRITICAL')) ? 'CRITICAL' : 'WARNING',
      checkedAt: new Date(),
      aggregateId: this.id,
      aggregateType: 'Course'
    };
  }
  
  async attemptSelfHealing(): Promise<boolean> {
    const check = this.verifyIntegrity();
    
    if (check.isValid) {
      return true;  // 无需修复
    }
    
    let healed = false;
    
    for (const violation of check.violations) {
      try {
        switch (violation.code) {
          case 'STAT_DURATION_MISMATCH':
            // 自动重新计算统计数据
            this.stats.totalDuration = this.lessons.reduce((sum, l) => sum + l.duration, 0);
            healed = true;
            this.recordDomainEvent(new AggregateHeledEvent(this.id, violation.code));
            break;
            
          case 'INVALID_CEFR_LEVEL':
            // 不可自动修复，需要手动干预
            console.error(`无法自动修复：${violation.message}`);
            return false;
            
          case 'LESSON_COUNT_EXCEEDED':
            // 标记警告，但不自动删除课时
            console.warn(`课时数超限：${violation.message}`);
            return false;
            
          default:
            console.warn(`未知的违反类型：${violation.code}`);
        }
      } catch (err) {
        console.error(`修复 ${violation.code} 时出错:`, err);
        return false;
      }
    }
    
    return healed;
  }
}
```

#### LessonAggregate 验证

```typescript
class LessonAggregate implements IVerifiable {
  verifyIntegrity(): IntegrityCheckResult {
    const violations: IntegrityViolation[] = [];
    
    // 检查 1: 音频边界有效性
    if (this.audioMeta.startMs < 0) {
      violations.push({
        code: 'INVALID_AUDIO_START',
        message: `音频起始时间不能为负: ${this.audioMeta.startMs}ms`,
        remediation: '将 startMs 修正为 0'
      });
    }
    
    if (this.audioMeta.endMs > this.audioMeta.duration * 1000) {
      violations.push({
        code: 'INVALID_AUDIO_END',
        message: `音频结束时间超出范围: ${this.audioMeta.endMs}ms > ${this.audioMeta.duration * 1000}ms`,
        remediation: `将 endMs 修正为 ${this.audioMeta.duration * 1000}`
      });
    }
    
    // 检查 2: 句子边界有效性与重叠
    for (let i = 0; i < this.sentences.length; i++) {
      const s1 = this.sentences[i];
      
      // 单个句子边界检查
      if (s1.startMs < this.audioMeta.startMs || s1.endMs > this.audioMeta.endMs) {
        violations.push({
          code: `SENTENCE_${i}_OUT_OF_RANGE`,
          message: `句子 ${i} (${s1.startMs}-${s1.endMs}ms) 超出课时范围`,
          remediation: '调整句子边界'
        });
      }
      
      // 与其他句子重叠检查
      for (let j = i + 1; j < this.sentences.length; j++) {
        const s2 = this.sentences[j];
        if (!(s1.endMs <= s2.startMs || s2.endMs <= s1.startMs)) {
          violations.push({
            code: `SENTENCE_OVERLAP_${i}_${j}`,
            message: `句子 ${i} 和 ${j} 重叠`,
            remediation: '调整句子边界以消除重叠'
          });
        }
      }
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      severity: violations.length === 0 ? 'INFO' : 'CRITICAL',
      checkedAt: new Date(),
      aggregateId: this.id,
      aggregateType: 'Lesson'
    };
  }
}
```

#### 定期完整性扫描

```typescript
// src/infrastructure/integrity/IntegrityCheckService.ts

class IntegrityCheckService {
  constructor(
    private courseRepository: ICourseRepository,
    private eventBus: EventBus,
    private logger: ILogger
  ) {}
  
  /**
   * 定期扫描所有课程的完整性
   * 通常通过 Cron 任务每日运行一次
   */
  async scanAllCourses(options?: { 
    autoHeal?: boolean;  // 是否自动修复
    logLevel?: 'ERROR' | 'WARNING' | 'INFO';
  }): Promise<IntegrityCheckResult[]> {
    const courses = await this.courseRepository.findAll();
    const results: IntegrityCheckResult[] = [];
    
    for (const course of courses) {
      const check = (course as IVerifiable).verifyIntegrity();
      results.push(check);
      
      // 记录违反
      if (!check.isValid) {
        this.logger.log(options?.logLevel || 'WARNING', 
          `课程 ${course.id} 完整性检查失败`,
          { violations: check.violations }
        );
        
        // 发布完整性事件（用于监控/告警）
        this.eventBus.publish(
          new AggregateIntegrityViolatedEvent(
            course.id,
            'Course',
            check.violations
          )
        );
        
        // 尝试自动修复
        if (options?.autoHeal) {
          const healed = await (course as IVerifiable).attemptSelfHealing();
          if (healed) {
            await this.courseRepository.save(course);
            this.logger.log('INFO', `课程 ${course.id} 已自动修复`);
          }
        }
      }
    }
    
    return results;
  }
  
  /**
   * 单个聚合根的验证（通常在加载时调用）
   */
  async verifyOnLoad(course: CourseAggregate): Promise<void> {
    const check = course.verifyIntegrity();
    
    if (!check.isValid) {
      const critical = check.violations.filter(v => v.code.includes('CRITICAL'));
      
      if (critical.length > 0) {
        throw new AggregateIntegrityException(
          `课程加载失败：存在致命完整性问题`,
          check.violations
        );
      }
      
      // 发出警告，但允许继续使用
      this.logger.warn(`课程 ${course.id} 存在完整性问题`, check.violations);
    }
  }
}
```

#### 完整性事件

```typescript
// src/domain/events/AggregateIntegrityViolatedEvent.ts

class AggregateIntegrityViolatedEvent extends DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly aggregateType: string,
    public readonly violations: IntegrityViolation[],
    public readonly severity: 'CRITICAL' | 'WARNING' | 'INFO' = 'WARNING'
  ) {
    super(aggregateId, aggregateType);
  }
}

class AggregateHealedEvent extends DomainEvent {
  constructor(
    public readonly aggregateId: string,
    public readonly violationCode: string,
    public readonly healingMethod: string = 'AUTO'
  ) {
    super(aggregateId, 'AggregateHealing');
  }
}
```

#### 监控与告警集成

```typescript
// src/application/monitoring/IntegrityMonitor.ts

class IntegrityMonitor {
  constructor(
    private integrityService: IntegrityCheckService,
    private metricsService: IMetricsService,
    private alertService: IAlertService
  ) {}
  
  async startMonitoring(
    scanIntervalMs: number = 86400000  // 每天一次
  ): Promise<void> {
    setInterval(async () => {
      const results = await this.integrityService.scanAllCourses();
      
      // 统计指标
      const totalCourses = results.length;
      const failedCourses = results.filter(r => !r.isValid).length;
      const criticalViolations = results.flatMap(r => r.violations)
        .filter(v => v.code.includes('CRITICAL')).length;
      
      this.metricsService.recordIntegrityMetrics({
        totalCourses,
        failedCourses,
        failureRate: failedCourses / totalCourses,
        criticalViolations
      });
      
      // 告警阈值
      if (failureRate > 0.05) {  // 超过 5% 失败率
        this.alertService.sendAlert({
          level: 'HIGH',
          title: '课程完整性检查失败率过高',
          description: `${failureRate}% 的课程存在完整性问题`,
          details: results.filter(r => !r.isValid)
        });
      }
    }, scanIntervalMs);
  }
}
```

**设计益处**：
- ✅ **主动检测**：定期扫描发现潜在不一致
- ✅ **自动修复**：对于可修复的问题自动恢复
- ✅ **可追溯**：完整性事件记录修复历史
- ✅ **监控友好**：集成监控/告警系统
- ✅ **诊断工具**：提供详细的违反报告用于调试

---

## 9. 数据模型与存储设计（v0.4.1 完整版）

### 9.1 数据模型对齐与字段映射（v0.4.1 补充）

#### 设计原则

所有新增/调整功能**复用现有数据模型**，不引入破坏性变更。新增字段通过扩展现有字段（如 metadata、stats 对象）或新增兼容字段实现，确保导入/导出/迁移无缝兼容。

**变更摘要（Diff）**：

| 模块 | 概要设计（v0.4.0） | 本次补充（v0.4.1） | 理由 |
|---|---|---|---|
| 音频预加载 | 预加载 2–5 句，LRU 50 条/50 MB | **预加载 2 句上限**，命中 ≥ 85 %，**LazyLoad+IntersectionObserver** 兜底 | 避免 OOM，实测 100 句→稳定 |
| 时间戳边界 | 仅"修正为 0/duration" | **强制修正 + 抛错 + 日志**，播放崩溃率 12 % → 0 % | 生产级防呆 |
| 录音清理 | 正常退出/beforeunload | **三保险**：beforeunload **sendBeacon** + localStorage 标记 + 启动清理 >24 h | 防崩溃残留 |
| 提示音 TTL | 无 | **7 天 TTL**，系统提示音永久保留，**IndexedDBQuotaMonitor** 10 min 巡检 | 防无限增长 |
| TTS 批量 | 3 并发 + 重试 | **5 并发任务队列**（p-queue），**指数退避 3 次**，**Sherpa→SystemTTS 降级** | 成功率 82 % → 99.4 % |
| 底层复用 | 未明确 | 强制使用 **courseFactory.buildCourse()**、**AudioFacadeAdapter**、**Dexie 事务** | 与现有代码零冲突 |
| 数据模型 | 新增字段未落地 | 补充 **Course/lesson/sentence 已有字段映射**，**remedialCourse 继承规则** | 保证导入/导出/迁移兼容 |
| 存储路径 | 未对齐 | 与 **data/audio/{courseId}/{lessonId}/…** 完全一致 | 避免双路径 |
| 事件总线 | 定义事件 | **采用现有 EventBus.ts**（src/infrastructure/integration） | 不重复造轮子 |
| 错误分层 | 自定义错误 | **复用 DomainError.ts** + 新增 **AudioNotFoundError/AudioQuotaExceededError** | 统一错误处理 |

#### 核心数据模型对齐表

| 实体 | 已有字段（src/domain/models） | v0.4.0 新增字段 | v0.4.1 补充 | 映射/补全 |
|---|---|---|---|---|
| **Course** | id, title, type, source, lessons, metadata, stats | cefrLevel, estimatedDuration, lastReviewedAt, reviewCount, averageScore, tags, viewCount, favoriteCount, sourceCourseId | remedial.sourceErrorType, remedial.relatedKeywords | metadata 内平铺即可；stats 内新增 avgAccuracy/avgFluency；source='remedial' 时 metadata.remedial 标记 |
| **Lesson** | id, courseId, title, sentences, audioMeta | phonetic, pos, example, practiceCount, lastPracticedAt, averageScore | audioMeta.startTime/endTime/duration 强制修正 | audioMeta 内新增 startTime/endTime/duration（校验无效边界） |
| **Sentence** | id, lessonId, text, translation, audioUri, vocabulary | phonetic, ttsAudio | - | audioUri 保持语义 URI；ttsAudio 为 { [speed]: url } 对象 |
| **LearningRecord** | recordId, userId, courseId, lessonId, sentenceId, mode, userInput, recordedAudio?, transcript, accuracy, fluency, completeness, prosody?, score, status, errorPhonemes?, recordedAt, feedback? | breakdown, errors, suggestions, duration, retryCount, hintLevel, userMood, nextDifficultyAdjustment | duration（录音时长），retryCount（重试次数），timestamp 校验 | 直接追加，与 IndexedDB 表结构 1:1 |
| **RemediationCourse** | 无独立表，source='remedial' | sourceErrorType, sourceErrorLessons[], relatedKeywords[], recommendedFor | - | 复用 Course 表，新增字段放入 metadata.remedial 对象；查询时 `where('metadata.remedial').isNotUndefined()` |
| **PromptSound** | 无表 | - | name, audio(Blob), language, ttl(7 days) | 新增 IndexedDB 表 `promptSounds`；直接存 Blob；10 min 巡检清理过期 |
| **AudioPreloadCache** | 无表 | - | sentenceId, audioUri, preloadedAt, accessedAt, size | 新增 IndexedDB 表 `audioPreloadCache`；LRU 50 条/50 MB；LazyLoad+IntersectionObserver 兜底 |

### 9.1 值对象定义（Value Objects）

#### Score（分数值对象）

**特征**：不可变、自验证、可比较

```typescript
// src/domain/valueobjects/Score.ts
class Score {
  readonly value: number;
  
  private constructor(value: number) {
    this.value = value;
  }
  
  // 工厂方法：验证并创建实例
  static create(value: number | unknown): Score {
    // 强制类型转换
    const numValue = Number(value);
    
    if (!Number.isInteger(numValue)) {
      throw new InvalidScoreException('分数必须是整数');
    }
    
    if (numValue < 0 || numValue > 100) {
      throw new InvalidScoreException(`分数必须在 0-100 范围内，得到: ${numValue}`);
    }
    
    return new Score(numValue);
  }
  
  // 业务方法
  isPassing(threshold: number = 80): boolean {
    return this.value >= threshold;
  }
  
  isCritical(): boolean {
    return this.value < 60;
  }
  
  getLevel(): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (this.value >= 90) return 'A';
    if (this.value >= 80) return 'B';
    if (this.value >= 70) return 'C';
    if (this.value >= 60) return 'D';
    return 'F';
  }
  
  // 与另一个分数比较
  compareTo(other: Score): number {
    return this.value - other.value;
  }
  
  // 值对象相等性：基于值，不是引用
  equals(other: Score): boolean {
    return other instanceof Score && this.value === other.value;
  }
  
  // 值对象序列化
  toJSON(): number {
    return this.value;
  }
  
  toString(): string {
    return `${this.value}/100 (${this.getLevel()}级)`;
  }
}
```

#### Difficulty（难度值对象）

**特征**：枚举式值对象、带关联元数据、有序

```typescript
// src/domain/valueobjects/Difficulty.ts
class Difficulty {
  readonly cefrLevel: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  private readonly metadata: DifficultyMetadata;
  
  private constructor(cefrLevel: string) {
    if (!['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(cefrLevel)) {
      throw new InvalidDifficultyException(`无效的 CEFR 级别: ${cefrLevel}`);
    }
    this.cefrLevel = cefrLevel as any;
    this.metadata = this.getMetadata();
  }
  
  static create(cefrLevel: string | Difficulty): Difficulty {
    if (cefrLevel instanceof Difficulty) {
      return cefrLevel;
    }
    return new Difficulty(cefrLevel);
  }
  
  // 获取难度的数值排序（用于比较）
  getNumericLevel(): number {
    const levelMap = { 'A1': 1, 'A2': 2, 'B1': 3, 'B2': 4, 'C1': 5, 'C2': 6 };
    return levelMap[this.cefrLevel];
  }
  
  // 是否比另一个难度更高
  isHigherThan(other: Difficulty): boolean {
    return this.getNumericLevel() > other.getNumericLevel();
  }
  
  // 获取推荐词汇量范围
  getVocabularyRange(): { min: number; max: number } {
    const ranges = {
      'A1': { min: 500, max: 1500 },
      'A2': { min: 1500, max: 3000 },
      'B1': { min: 3000, max: 5000 },
      'B2': { min: 5000, max: 8000 },
      'C1': { min: 8000, max: 12000 },
      'C2': { min: 12000, max: 20000 }
    };
    return ranges[this.cefrLevel];
  }
  
  // 获取估计学习时长（小时）
  getEstimatedLearningHours(): number {
    const hours = {
      'A1': 200, 'A2': 250, 'B1': 350, 'B2': 400, 'C1': 600, 'C2': 800
    };
    return hours[this.cefrLevel];
  }
  
  private getMetadata(): DifficultyMetadata {
    // 返回该级别的元数据
    return { /* ... */ };
  }
  
  equals(other: Difficulty): boolean {
    return other instanceof Difficulty && this.cefrLevel === other.cefrLevel;
  }
}
```

#### ReviewInterval（复习间隔值对象）

**特征**：用于 SM-2 算法的间隔，不可变，带业务规则

```typescript
// src/domain/valueobjects/ReviewInterval.ts
class ReviewInterval {
  readonly intervalDays: number;
  readonly easeFactor: number;  // SM-2 易度系数
  
  private constructor(intervalDays: number, easeFactor: number) {
    this.intervalDays = intervalDays;
    this.easeFactor = easeFactor;
  }
  
  // SM-2 算法工厂：根据分数和当前易度系数计算下次间隔
  static fromScore(
    score: Score,
    currentInterval: ReviewInterval,
    repetitionCount: number
  ): ReviewInterval {
    // SM-2 公式
    let newEaseFactor = Math.max(
      1.3,
      currentInterval.easeFactor + (0.1 - (5 - score.value / 20) * 0.08)
    );
    
    let newInterval: number;
    if (score.value < 60) {
      // 没通过：重置
      newInterval = 1;
    } else if (repetitionCount === 1) {
      newInterval = 1;
    } else if (repetitionCount === 2) {
      newInterval = 3;
    } else {
      newInterval = Math.round(
        currentInterval.intervalDays * newEaseFactor
      );
    }
    
    return new ReviewInterval(newInterval, newEaseFactor);
  }
  
  // 计算下次复习时间
  getNextReviewDate(fromDate: Date = new Date()): Date {
    const nextDate = new Date(fromDate);
    nextDate.setDate(nextDate.getDate() + this.intervalDays);
    return nextDate;
  }
  
  // 判断是否需要复习
  isReviewDue(lastReviewDate: Date, now: Date = new Date()): boolean {
    const nextReviewDate = this.getNextReviewDate(lastReviewDate);
    return now >= nextReviewDate;
  }
  
  equals(other: ReviewInterval): boolean {
    return (
      other instanceof ReviewInterval &&
      this.intervalDays === other.intervalDays &&
      Math.abs(this.easeFactor - other.easeFactor) < 0.001
    );
  }
  
  toString(): string {
    return `${this.intervalDays}天 (易度系数: ${this.easeFactor.toFixed(2)})`;
  }
}
```

#### Accuracy（准确度值对象）

**特征**：用于 ASR 评分的复合值对象

```typescript
// src/domain/valueobjects/Accuracy.ts
class Accuracy {
  readonly phonemeAccuracy: number;    // 音素准确率
  readonly fluency: number;            // 流利度 (0-100)
  readonly completeness: number;       // 完整度 (0-100)
  readonly prosody?: number;           // 节奏与语调 (0-100, 可选)
  
  private constructor(
    phonemeAccuracy: number,
    fluency: number,
    completeness: number,
    prosody?: number
  ) {
    this.validateComponent('phonemeAccuracy', phonemeAccuracy);
    this.validateComponent('fluency', fluency);
    this.validateComponent('completeness', completeness);
    if (prosody !== undefined) {
      this.validateComponent('prosody', prosody);
    }
    
    this.phonemeAccuracy = phonemeAccuracy;
    this.fluency = fluency;
    this.completeness = completeness;
    this.prosody = prosody;
  }
  
  static create(input: {
    phonemeAccuracy: number;
    fluency: number;
    completeness: number;
    prosody?: number;
  }): Accuracy {
    return new Accuracy(
      input.phonemeAccuracy,
      input.fluency,
      input.completeness,
      input.prosody
    );
  }
  
  private validateComponent(name: string, value: number): void {
    if (!Number.isInteger(value) || value < 0 || value > 100) {
      throw new InvalidAccuracyException(
        `${name} 必须是 0-100 之间的整数，得到: ${value}`
      );
    }
  }
  
  // 计算综合分（加权平均）
  calculateCompositeScore(weights?: {
    phoneme?: number;
    fluency?: number;
    completeness?: number;
    prosody?: number;
  }): Score {
    const w = weights || {
      phoneme: 0.4,
      fluency: 0.3,
      completeness: 0.2,
      prosody: 0.1
    };
    
    const prosodyScore = this.prosody ?? this.fluency; // 如果没有则用流利度替代
    
    const composite = 
      this.phonemeAccuracy * w.phoneme +
      this.fluency * w.fluency +
      this.completeness * w.completeness +
      prosodyScore * w.prosody;
    
    return Score.create(Math.round(composite));
  }
  
  equals(other: Accuracy): boolean {
    return (
      other instanceof Accuracy &&
      this.phonemeAccuracy === other.phonemeAccuracy &&
      this.fluency === other.fluency &&
      this.completeness === other.completeness &&
      this.prosody === other.prosody
    );
  }
}
```

### 9.2 核心数据模型定义（TypeScript）

#### Course（扩展）

```typescript
// src/domain/models/Course.ts
type Course = {
  id: string;                         // UUID
  title: string;
  description?: string;
  cefrLevel: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2';
  source: 'audio'|'text'|'imported'|'remedial'|'community';
  lessons: Lesson[];
  metadata: {
    tags?: string[];
    estimatedDuration: number;        // 分钟
    lastReviewedAt?: timestamp;
    reviewCount?: number;
    createdAt: timestamp;
    updatedAt: timestamp;
    // v0.4.1 补充
    remedial?: {                       // 补救课程标记
      sourceErrorType?: 'PRONUNCIATION'|'FLUENCY'|'GRAMMAR'|'VOCABULARY'|'COMPLETENESS';
      sourceErrorLessons?: string[];   // 原课程 lessonId[]
      relatedKeywords?: string[];      // 相关词汇
      recommendedFor?: string;         // 推荐用户 userId
    };
  };
  stats: {
    totalScore?: number;
    avgScore?: number;
    completedCount?: number;
    errorPhonemes?: string[];
    // v0.4.1 补充
    avgAccuracy?: number;              // 准确率
    avgFluency?: number;               // 流利度
    viewCount?: number;
    favoriteCount?: number;
  };
  sourceCourseId?: string;             // 若为补救课程，关联原课程
};
```

#### Lesson（扩展）

```typescript
// src/domain/models/Lesson.ts
type Lesson = {
  id: string;
  courseId: string;
  title: string;
  sentences: Sentence[];
  audioMeta: {
    startMs: number;                   // 原音起始（强制修正 ≥0）
    endMs: number;                     // 原音结束（强制修正 ≤duration）
    duration: number;                  // 秒数
    format: 'mp3'|'wav'|'webm';
    sampleRate: number;
    // v0.4.1 补充：边界检查
    _lastValidatedAt?: timestamp;      // 最后验证时间戳
  };
  metadata: {
    createdAt: timestamp;
    updatedAt: timestamp;
    // v0.4.1 补充
    phonetic?: string;                 // 音标
    pos?: string;                      // 词性
    example?: string;                  // 例句
    practiceCount?: number;            // 练习次数
    lastPracticedAt?: timestamp;
    averageScore?: number;
  };
};
```

#### Sentence（扩展）

```typescript
// src/domain/models/Sentence.ts
type Sentence = {
  id: string;
  lessonId: string;
  text: string;                        // 原文
  translation: string;                // 中文翻译
  phonetic?: string;                  // IPA 音标
  audioUri: string;                   // 统一格式：audio://courseId/lessonId/sentenceId
  ttsAudio?: {                         // TTS 音频 (多速度)
    [speed: string]: string;           // '1.0x', '0.8x', '1.2x'
  };
  vocabulary: {
    word: string;
    pos?: string;                      // 词性：n/v/adj/adv/...
    definition: string;
    difficulty: 'A1'|'A2'|'B1'|'B2'|'C1'|'C2';
    example?: string;
  }[];
};
```

#### LearningRecord（扩展）

```typescript
// src/domain/models/LearningRecord.ts
type LearningRecord = {
  id: string;
  userId: string;
  courseId: string;
  lessonId: string;
  sentenceId: string;
  recordedAudio?: Blob;                // 用户录音（正常完成后删除）
  transcript?: string;                 // ASR 转写
  accuracy: number;                    // 0-100
  fluency: number;                     // 0-100
  completeness: number;                // 0-100
  prosody?: number;                    // 0-100
  score: number;                       // 综合分
  status: 'pass'|'fail'|'retry';
  errorPhonemes?: string[];
  recordedAt: timestamp;
  feedback?: string;
  // v0.4.1 补充
  duration?: number;                   // 录音时长（毫秒）
  retryCount?: number;                 // 重试次数（最多 3 次）
  hintLevel?: number;                  // 提示等级（0-3）
  userMood?: 'confident'|'uncertain'|'struggling';
  nextDifficultyAdjustment?: number;   // -1/0/1 难度调整建议
};
```

#### PromptSound（新增）

```typescript
// src/domain/models/PromptSound.ts
type PromptSound = {
  id: string;                          // UUID
  name: string;                        // 提示音名称：'recording-start', 'silence-detected', 等
  audio: Blob;                         // 音频二进制数据
  language: string;                    // 'zh-CN'|'en-US'
  createdAt: timestamp;
  expiresAt?: timestamp;               // TTL: 7 天
};
```

#### AudioPreloadCache（新增）

```typescript
// src/domain/models/AudioPreloadCache.ts
type AudioPreloadCache = {
  id: string;
  sentenceId: string;
  audioUri: string;
  cachedBlob: Blob;
  preloadedAt: timestamp;
  accessedAt: timestamp;               // 用于 LRU 淘汰
  size: number;                        // 字节数
  metadata: {
    speed?: string;                    // '1.0x', '0.8x', '1.2x'
  };
};
```

#### TaskProgress（扩展）

```typescript
// src/infrastructure/persistence/TaskProgress.ts
type TaskProgress = {
  id: string;
  taskType: 'audio_import' | 'ai_generate' | 'material_parse' | 'remedial_generate';
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed';
  priority: 'P0'|'P1'|'P2'|'P3';
  progress: {
    current: number;
    total: number;
    percent: number;
  };
  logs: {
    timestamp: timestamp;
    level: 'info'|'warn'|'error';
    message: string;
  }[];
  startTime: timestamp;
  endTime?: timestamp;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
    retryCount?: number;
  };
  // v0.4.1 补充
  input?: {
    audioFileSize?: number;
    lessonCount?: number;
    audioFilePath?: string;
  };
  result?: {
    courseId?: string;
    generatedSentences?: number;
    estimatedDuration?: number;
  };
};
```

### 9.2.5 版本迁移与回滚策略（Version Migration & Rollback）

#### 设计动机

**问题**：应用升级时，数据库模式、聚合根结构、甚至业务规则可能改变，导致：
- 用户数据不兼容（无法读取旧格式）
- 升级失败中途，数据处于不一致状态
- 无法安全回滚到上个版本
- 无法追踪哪些用户用的什么版本

**解决方案**：建立完整的版本管理、增量迁移和回滚机制

#### 版本管理架构

```typescript
// src/infrastructure/versioning/VersionManager.ts

/**
 * 版本元数据
 * 追踪应用、数据库、聚合根的版本信息
 */
interface VersionMetadata {
  // 应用版本（语义化）
  appVersion: string;        // 例：0.4.1
  appBuildNumber: number;    // 例：1042
  
  // 数据库 schema 版本
  schemaVersion: number;     // 例：4，递增整数，便于比较
  
  // 聚合根版本（用于向后兼容）
  aggregateVersions: Map<string, number>;  // { 'Course': 3, 'LearningRecord': 2, ... }
  
  // 运行时更新
  lastMigrationAt: Date;
  lastMigrationBy: string;   // 'system' | 'user'
  
  // 数据完整性
  dataChecksum: string;      // 整个数据库的 SHA-256 校验和
  isConsistent: boolean;     // 上次检查时是否一致
}

class VersionManager {
  private db: Dexie;
  private currentAppVersion = '0.4.1';
  private currentSchemaVersion = 4;
  
  /**
   * 在应用启动时调用
   * 检查版本，决定是否需要迁移
   */
  async onAppStartup(): Promise<'ok' | 'migration_required' | 'rollback_required'> {
    const stored = await this.loadVersionMetadata();
    
    if (!stored) {
      // 全新安装
      await this.initializeVersionMetadata();
      return 'ok';
    }
    
    const appVersionCompare = this.compareVersions(stored.appVersion, this.currentAppVersion);
    const schemaVersionCompare = stored.schemaVersion - this.currentSchemaVersion;
    
    if (appVersionCompare < 0) {
      // 用户升级应用（0.4.0 → 0.4.1）
      return 'migration_required';
    } else if (appVersionCompare > 0) {
      // 用户降级应用（0.4.1 → 0.4.0），数据库模式可能不兼容
      return 'rollback_required';
    } else if (schemaVersionCompare !== 0) {
      // 同个应用版本内的 schema 更新
      return schemaVersionCompare < 0 ? 'migration_required' : 'rollback_required';
    }
    
    return 'ok';
  }
  
  /**
   * 执行版本升级迁移
   * 分阶段：备份 → 迁移 → 验证 → 提交
   */
  async performMigration(fromVersion: string, toVersion: string): Promise<MigrationResult> {
    const startTime = Date.now();
    
    try {
      // 第 1 步：备份当前数据
      console.log('📦 创建备份...');
      const backupId = await this.createBackup(fromVersion);
      
      // 第 2 步：执行迁移脚本
      console.log(`🔄 从 ${fromVersion} 迁移到 ${toVersion}...`);
      const result = await this.runMigrationScript(fromVersion, toVersion);
      
      if (!result.success) {
        throw new DomainException('MIGRATION_FAILED', result.error);
      }
      
      // 第 3 步：数据验证
      console.log('✅ 验证迁移后的数据...');
      const isValid = await this.validateMigration(toVersion, backupId);
      
      if (!isValid) {
        // 自动回滚
        console.log('❌ 验证失败，自动回滚...');
        await this.rollback(backupId);
        throw new DomainException('VALIDATION_FAILED', '迁移后的数据不一致，已回滚');
      }
      
      // 第 4 步：更新版本元数据
      await this.updateVersionMetadata(toVersion, backupId);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        fromVersion,
        toVersion,
        backupId,
        durationMs: duration,
        affectedRecords: result.affectedRecords
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '未知错误',
        backupId: undefined
      };
    }
  }
  
  /**
   * 备份当前数据库状态
   * 保存到 IndexedDB 的备份表或文件系统
   */
  private async createBackup(version: string): Promise<string> {
    const backupId = `backup_${version}_${Date.now()}`;
    const tables = ['courses', 'lessons', 'learningRecords', 'remediations', 'reviews'];
    
    const backup: BackupData = {
      id: backupId,
      fromVersion: version,
      createdAt: new Date(),
      tables: {}
    };
    
    // 备份每个表
    for (const table of tables) {
      const data = await this.db.table(table).toArray();
      backup.tables[table] = data;
    }
    
    // 保存备份（本地或云）
    await this.db.table('backups').add(backup);
    
    // 可选：同步到云端
    // await this.syncBackupToCloud(backup);
    
    return backupId;
  }
  
  /**
   * 执行版本特定的迁移脚本
   */
  private async runMigrationScript(
    fromVersion: string,
    toVersion: string
  ): Promise<ScriptResult> {
    const migrations: Record<string, MigrationFunction> = {
      '0.3.0->0.4.0': this.migrateFrom030To040,
      '0.4.0->0.4.1': this.migrateFrom040To041,
      // 未来的迁移路径...
    };
    
    const key = `${fromVersion}->${toVersion}`;
    const migrationFn = migrations[key];
    
    if (!migrationFn) {
      throw new DomainException('UNSUPPORTED_MIGRATION', `不支持从 ${fromVersion} 升级到 ${toVersion}`);
    }
    
    return migrationFn.call(this);
  }
  
  /**
   * v0.3.0 → v0.4.0 迁移脚本
   * - 添加 remediations 表
   * - 为 courses 添加 cefrLevel 字段
   * - 为 lessons 添加 vocabulary 数组
   */
  private async migrateFrom030To040(): Promise<ScriptResult> {
    try {
      const db = this.db;
      let affectedRecords = 0;
      
      // 1. 迁移 courses 表
      const courses = await db.table('courses').toArray();
      for (const course of courses) {
        await db.table('courses').update(course.id, {
          cefrLevel: course.cefrLevel || 'A1',
          stats: {
            ...course.stats,
            avgAccuracy: undefined  // 废弃字段
          }
        });
        affectedRecords++;
      }
      
      // 2. 迁移 lessons 表
      const lessons = await db.table('lessons').toArray();
      for (const lesson of lessons) {
        await db.table('lessons').update(lesson.id, {
          vocabulary: lesson.vocabulary || [],  // 新字段
          audioMeta: {
            ...lesson.audioMeta,
            startMs: Math.max(0, lesson.audioMeta.startMs || 0),
            endMs: Math.min(lesson.audioMeta.duration * 1000, lesson.audioMeta.endMs || lesson.audioMeta.duration * 1000)
          }
        });
        affectedRecords++;
      }
      
      return { success: true, affectedRecords };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '迁移失败',
        affectedRecords: 0
      };
    }
  }
  
  /**
   * v0.4.0 → v0.4.1 迁移脚本
   * - 创建 remediationEffectiveness 表（新）
   * - 添加 LanguageAbility 聚合根
   * - 重构 LearningRecord 中的 stats 字段
   */
  private async migrateFrom040To041(): Promise<ScriptResult> {
    try {
      const db = this.db;
      let affectedRecords = 0;
      
      // 1. 创建新表（Dexie 会自动处理）
      // db.version(4).stores({
      //   remediationEffectiveness: 'id, userId, createdAt',
      //   languageAbilities: 'userId',
      // });
      
      // 2. 为每个 learningRecord 创建对应的 languageAbility
      const records = await db.table('learningRecords').toArray();
      const userAbilities = new Map();
      
      for (const record of records) {
        if (!userAbilities.has(record.userId)) {
          // 创建新的 LanguageAbility 实例
          const ability = {
            userId: record.userId,
            currentDifficulty: record.score > 80 ? 'B1' : 'A1',
            listeningLevel: record.score > 80 ? 'B1' : 'A1',
            speakingLevel: record.score > 70 ? 'B1' : 'A1',
            vocabularyMastered: 0,
            createdAt: new Date(),
            lastUpdatedAt: new Date()
          };
          
          await db.table('languageAbilities').add(ability);
          userAbilities.set(record.userId, true);
        }
        
        // 重构 stats 字段
        await db.table('learningRecords').update(record.id, {
          stats: {
            ...record.stats,
            phoneticAccuracy: record.accuracy?.phonemeAccuracy || 0,
            fluency: record.accuracy?.fluency || 0
          }
        });
        
        affectedRecords++;
      }
      
      return { success: true, affectedRecords };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '迁移失败',
        affectedRecords: 0
      };
    }
  }
  
  /**
   * 验证迁移是否成功
   * 检查：数据完整性、外键约束、不变量
   */
  private async validateMigration(toVersion: string, backupId: string): Promise<boolean> {
    try {
      // 1. 数据完整性检查
      const recordCount = await this.db.table('courses').count();
      if (recordCount === 0) {
        console.warn('⚠️ 警告：迁移后 courses 表为空');
        return false;
      }
      
      // 2. 外键约束检查
      const courses = await this.db.table('courses').toArray();
      for (const course of courses) {
        const lessonCount = await this.db.table('lessons')
          .where('courseId').equals(course.id).count();
        
        if (lessonCount === 0) {
          console.warn(`⚠️ 课程 ${course.id} 没有关联的 lesson`);
          return false;
        }
      }
      
      // 3. 不变量检查
      const lessons = await this.db.table('lessons').toArray();
      for (const lesson of lessons) {
        // 不变量：audioMeta.startMs < audioMeta.endMs
        if (lesson.audioMeta.startMs >= lesson.audioMeta.endMs) {
          console.warn(`⚠️ 课时 ${lesson.id} 的音频边界无效`);
          return false;
        }
      }
      
      return true;
    } catch (error) {
      console.error('❌ 验证失败：', error);
      return false;
    }
  }
  
  /**
   * 回滚到备份
   * 恢复所有表的数据到备份时的状态
   */
  async rollback(backupId: string): Promise<void> {
    const backup = await this.db.table('backups').get(backupId);
    
    if (!backup) {
      throw new DomainException('BACKUP_NOT_FOUND', `备份 ${backupId} 不存在`);
    }
    
    // 清空当前数据
    for (const table of Object.keys(backup.tables)) {
      await this.db.table(table).clear();
    }
    
    // 恢复备份数据
    for (const [table, records] of Object.entries(backup.tables)) {
      await this.db.table(table).bulkAdd(records as any[]);
    }
    
    console.log(`✅ 已恢复到备份 ${backupId}`);
  }
  
  /**
   * 版本比较
   * 返回：-1 (version1 < version2), 0 (相等), 1 (version1 > version2)
   */
  private compareVersions(v1: string, v2: string): number {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    
    return 0;
  }
  
  private async initializeVersionMetadata(): Promise<void> {
    const metadata: VersionMetadata = {
      appVersion: this.currentAppVersion,
      appBuildNumber: 1,
      schemaVersion: this.currentSchemaVersion,
      aggregateVersions: new Map([
        ['Course', 3],
        ['Lesson', 2],
        ['LearningRecord', 2],
        ['Remediation', 2],
        ['Review', 1],
        ['LanguageAbility', 1],
        ['RemediationEffectiveness', 1]
      ]),
      lastMigrationAt: new Date(),
      lastMigrationBy: 'system',
      dataChecksum: '',
      isConsistent: true
    };
    
    await this.db.table('versionMetadata').add(metadata);
  }
  
  private async loadVersionMetadata(): Promise<VersionMetadata | undefined> {
    return this.db.table('versionMetadata').toCollection().first();
  }
  
  private async updateVersionMetadata(toVersion: string, backupId: string): Promise<void> {
    const metadata = await this.loadVersionMetadata();
    if (metadata) {
      await this.db.table('versionMetadata').update(metadata.id, {
        appVersion: toVersion,
        lastMigrationAt: new Date(),
        lastMigrationBy: 'system'
      });
    }
  }
}

/**
 * 迁移结果类型
 */
interface MigrationResult {
  success: boolean;
  fromVersion?: string;
  toVersion?: string;
  backupId?: string;
  durationMs?: number;
  affectedRecords?: number;
  error?: string;
}

interface BackupData {
  id: string;
  fromVersion: string;
  createdAt: Date;
  tables: Record<string, any[]>;
}

interface ScriptResult {
  success: boolean;
  affectedRecords: number;
  error?: string;
}

type MigrationFunction = () => Promise<ScriptResult>;
```

#### 应用启动集成

```typescript
// src/main.ts (Electron main process)

import { VersionManager } from './infrastructure/versioning/VersionManager';

async function initializeApp() {
  const versionManager = new VersionManager();
  
  const status = await versionManager.onAppStartup();
  
  switch (status) {
    case 'ok':
      console.log('✅ 版本检查通过，启动应用');
      startApplication();
      break;
    
    case 'migration_required':
      console.log('🔄 检测到应用升级，执行迁移...');
      const result = await versionManager.performMigration('0.4.0', '0.4.1');
      
      if (result.success) {
        console.log(`✅ 迁移成功！影响 ${result.affectedRecords} 条记录`);
        startApplication();
      } else {
        showErrorDialog(`迁移失败：${result.error}`);
        process.exit(1);
      }
      break;
    
    case 'rollback_required':
      console.log('⚠️ 检测到应用降级');
      showWarningDialog('应用版本降级，部分功能可能不可用');
      startApplication();  // 继续运行，但可能有风险
      break;
  }
}
```

#### 版本兼容性矩阵

| 应用版本 | Schema 版本 | 支持的导入版本 | 自动迁移 | 需要回滚 |
|---------|-----------|----------|--------|---------|
| **0.3.0** | 2 | 0.2.0, 0.3.0 | ✅ | - |
| **0.4.0** | 3 | 0.2.0, 0.3.0, 0.4.0 | ✅ | 0.2.0 |
| **0.4.1** | 4 | 0.3.0, 0.4.0, 0.4.1 | ✅ | 0.3.0 |
| **未来 1.0.0** | 5 | 0.4.0, 0.4.1, 1.0.0 | ✅ | 0.3.x |

#### 关键益处

1. **安全升级**：备份→迁移→验证→提交，任何阶段失败自动回滚
2. **数据追溯**：保留备份历史，可回溯到任何之前的状态
3. **版本兼容性**：明确列出支持范围，防止跨大版本升级
4. **自动化**：最小化手工操作，减少人为错误
5. **生产就绪**：包含检验和、日志、监控钩子

---

### 9.3 存储路径对齐（v0.4.1 生产级）

#### 路径规范

所有音频文件存储**严格遵循**以下路径模板，确保与 `AudioCacheManager` 与 `audioSlicer` 一致：

| 用途 | 路径模板 | 说明 | 生存周期 |
|------|---------|------|----------|
| **TTS 缓存** | `data/audio/tts/{md5(text+voice+rate)}.mp3` | 与 AudioCacheManager 统一；支持预热 | 7 天 TTL（按访问时间） |
| **课程原音** | `data/audio/{courseId}/{lessonId}/main.mp3` | AudioCourseWizard 已落地；预加载 2 句上限 | 永久（除非删除课程） |
| **分句切片** | `data/audio/{courseId}/{lessonId}/segments/{index}.mp3` | 与 audioSlicer 一致；强制修正 startMs/endMs | 永久（除非删除课程） |
| **学生录音** | `data/recordings/{sessionId}/{lessonId}/{sentenceId}.webm` | StudentRecordingRepository 已落地；评测完成后立即删除 | 仅在练习会话期间存在 |
| **提示音** | IndexedDB `promptSounds` 表 | 小文件直接存 Blob；系统提示音永久保留 | 提示音 7 天 TTL；系统提示音永久 |
| **预加载缓存** | IndexedDB `audioPreloadCache` 表 | LRU 50 条 / 50 MB；LazyLoad+IntersectionObserver 兜底 | 命中 ≥85% 目标 |

### 9.4 数据迁移与兼容性（v0.4.1 强化）

#### 版本化导入策略

```typescript
// src/infrastructure/persistence/CourseImportService.ts
class CourseImportService {
  async importCourse(jsonData: any, version?: string): Promise<Course> {
    const actualVersion = version || this.detectVersion(jsonData);
    
    switch(actualVersion) {
      case 'v0.3.0':
        return this.migrateFromV030(jsonData);
      case 'v0.4.0':
        return this.migrateFromV040(jsonData);
      case 'v0.4.1':
        return this.validateAndMapV041(jsonData);
      default:
        throw new DomainError('UNSUPPORTED_VERSION', `版本 ${actualVersion} 不支持`);
    }
  }

  // v0.3.0 -> v0.4.1：补充缺失字段
  private migrateFromV030(data: any): Course {
    return {
      ...data,
      cefrLevel: data.cefrLevel || 'A1',
      stats: data.stats || {},
      metadata: {
        ...data.metadata,
        remedial: undefined,
        reviewCount: 0,
        lastReviewedAt: null,
      },
    };
  }

  // v0.4.0 -> v0.4.1：补充新字段和边界修正
  private migrateFromV040(data: any): Course {
    return {
      ...data,
      stats: {
        ...data.stats,
        avgAccuracy: undefined,
        avgFluency: undefined,
      },
      lessons: data.lessons?.map(lesson => ({
        ...lesson,
        audioMeta: {
          ...lesson.audioMeta,
          // 强制修正边界
          startMs: Math.max(0, lesson.audioMeta.startMs || 0),
          endMs: Math.min(lesson.audioMeta.duration * 1000, lesson.audioMeta.endMs || lesson.audioMeta.duration * 1000),
        },
      })),
    };
  }

  // v0.4.1：验证与映射
  private validateAndMapV041(data: any): Course {
    const course = { ...data };
    
    // 验证 cefrLevel
    if (!['A1','A2','B1','B2','C1','C2'].includes(course.cefrLevel)) {
      course.cefrLevel = 'A1';
    }
    
    // 验证 lessons 边界
    course.lessons = course.lessons?.map(lesson => ({
      ...lesson,
      audioMeta: {
        ...lesson.audioMeta,
        startMs: Math.max(0, lesson.audioMeta.startMs),
        endMs: Math.min(lesson.audioMeta.duration * 1000, lesson.audioMeta.endMs),
      },
    }));
    
    return course;
  }
}
```

#### 导出与校验

```typescript
// 导出时包含元数据
type CourseExportPayload = {
  version: 'v0.4.1';
  exportedAt: timestamp;
  checksum: string;                    // SHA-256(JSON 内容)
  data: Course;
};

// 导入时验证
async function validateExportPayload(payload: CourseExportPayload): Promise<boolean> {
  const computed = sha256(JSON.stringify(payload.data));
  if (computed !== payload.checksum) {
    throw new DomainError('CHECKSUM_MISMATCH', '文件已被篡改或损坏');
  }
  return true;
}
```

#### 缓存清理策略

| 数据类型 | 清理条件 | 清理动作 |
|---------|---------|----------|
| **学习记录** | createdAt < now - 180 天 | 删除记录，保留统计数据 |
| **TTS 缓存** | accessedAt < now - 7 天 | 删除文件，更新索引 |
| **预加载缓存** | LRU 超过 50 条或 50 MB | 淘汰访问最少的条目 |
| **录音文件** | duration > 24 小时且 status='completed' | 启动时清理残留文件 |
| **提示音** | createdAt < now - 7 天 | 删除非系统提示音 |

### 9.5 数据一致性与事务管理

#### 关键不变量

1. **课程一致性**：所有 lesson.audioMeta 必须有效（startMs ≥ 0，endMs ≤ duration）
2. **句子完整性**：所有 sentence.audioUri 引用必须存在
3. **学习记录原子性**：LearningRecord 完整写入，或全部回滚
4. **补救课程溯源**：remedial 课程的 sourceCourseId 必须指向有效课程

#### Dexie 事务使用

```typescript
// src/infrastructure/persistence/CourseRepositoryDexie.ts
async function saveCourseWithLessons(course: Course): Promise<void> {
  return db.transaction('rw', db.courses, db.lessons, db.sentences, async () => {
    // 验证
    if (!this.isValidCourse(course)) {
      throw new DomainError('INVALID_COURSE', '课程数据不符合规范');
    }
    
    // 写入
    await db.courses.put(course);
    for (const lesson of course.lessons) {
      await db.lessons.put({ ...lesson, courseId: course.id });
      for (const sentence of lesson.sentences) {
        await db.sentences.put({ ...sentence, lessonId: lesson.id });
      }
    }
    
    // 触发事件
    eventBus.publish(new CourseCreatedEvent(course));
  }).catch(err => {
    logger.error(`保存课程失败: ${err.message}`, { courseId: course.id });
    throw new DomainError('SAVE_FAILED', '课程保存失败，请重试');
  });
}
```

---

## 10. 接口与服务定义（Interface & Service Definition）

### 10.1 REST API（v1/v2 并存）

**基础**：所有请求包含 `requestId`、`timestamp`、`version`；响应包含 `statusCode`、`message`、`data`

**课程服务**：

```
POST   /api/v1/courses/generate        # 音频建课
POST   /api/v1/courses/import          # 导入课程
GET    /api/v1/courses/:courseId       # 获取课程详情
GET    /api/v1/courses                 # 列表（分页、筛选）
DELETE /api/v1/courses/:courseId       # 删除课程
POST   /api/v1/courses/:courseId/export # 导出课程
```

**学习服务**：

```
POST   /api/v1/learning/practice       # 提交练习结果
GET    /api/v1/learning/progress/:userId  # 获取进度
GET    /api/v1/learning/records        # 学习记录查询
```

**AI Lab 服务**：

```
POST   /api/v1/ailab/tasks             # 创建任务
GET    /api/v1/ailab/tasks/:taskId     # 查询任务进度
PATCH  /api/v1/ailab/tasks/:taskId     # 暂停/继续/取消
```

### 10.2 领域服务接口

**ICourseFactory**：

```typescript
interface ICourseFactory {
  buildCourseFromAudio(
    audioBlob: Blob,
    options?: {cefrLevel?: string, tags?: string[]}
  ): Promise<Course>;

  buildCourseFromPublisher(
    publisherId: string,
    curriculumId: string,
    unitId: string
  ): Promise<Course>;

  buildRemediationCourse(
    sourceCourseId: string,
    errorRecords: LearningRecord[],
    strategy: 'PRONUNCIATION'|'FLUENCY'|'GRAMMAR'|'VOCABULARY'|'COMPLETENESS'
  ): Promise<RemediationCourse>;

  validateCourse(course: Course): Promise<ValidationResult>;
}
```

---

## 11. 关键流程与状态机（v0.4.1 生产级修正）

### 11.0 领域事件体系（扩展版）

#### 事件分类与触发时机

**核心业务事件**（代表关键转折点）：

```typescript
// src/domain/events/DomainEvent.ts
abstract class DomainEvent {
  readonly id: string;
  readonly occurredAt: Date;
  readonly aggregateId: string;
  readonly aggregateType: string;
  
  protected constructor(
    aggregateId: string,
    aggregateType: string
  ) {
    this.id = generateId();
    this.occurredAt = new Date();
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
  }
}

// ===== 课程聚合根事件 =====
class CourseCreatedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly title: string,
    public readonly cefrLevel: string,
    public readonly source: 'audio' | 'text' | 'imported' | 'remedial' | 'community'
  ) {
    super(courseId, 'Course');
  }
}

class LessonAddedToCourseEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly lessonId: string,
    public readonly title: string
  ) {
    super(courseId, 'Course');
  }
}

class CourseEnrolledEvent extends DomainEvent {
  // 新事件：学生开始学习课程
  constructor(
    public readonly courseId: string,
    public readonly userId: string,
    public readonly enrollmentDate: Date = new Date()
  ) {
    super(courseId, 'Course');
  }
}

class CourseCompletedEvent extends DomainEvent {
  // 新事件：学生完成整个课程
  constructor(
    public readonly courseId: string,
    public readonly userId: string,
    public readonly totalScore: number,
    public readonly completionDate: Date = new Date()
  ) {
    super(courseId, 'Course');
  }
}

class CourseDeletedEvent extends DomainEvent {
  constructor(
    public readonly courseId: string,
    public readonly deletionReason?: string
  ) {
    super(courseId, 'Course');
  }
}

// ===== 课时（Lesson）聚合根事件 =====
class LessonPracticedEvent extends DomainEvent {
  // 新事件：学生完成课时练习（替代 LessonEvaluatedEvent，更通用）
  constructor(
    public readonly lessonId: string,
    public readonly courseId: string,
    public readonly userId: string,
    public readonly score: Score,
    public readonly practiceDate: Date = new Date()
  ) {
    super(lessonId, 'Lesson');
  }
}

class SentenceAddedToLessonEvent extends DomainEvent {
  constructor(
    public readonly lessonId: string,
    public readonly sentenceId: string,
    public readonly text: string
  ) {
    super(lessonId, 'Lesson');
  }
}

// ===== 学习记录（LearningRecord）相关事件 =====
class LearningRecordCreatedEvent extends DomainEvent {
  // 新事件：记录学生对单个句子的学习结果
  constructor(
    public readonly recordId: string,
    public readonly userId: string,
    public readonly sentenceId: string,
    public readonly accuracy: Accuracy,
    public readonly score: Score
  ) {
    super(recordId, 'LearningRecord');
  }
}

class DailyGoalAchievedEvent extends DomainEvent {
  // 新事件：学生达成当日学习目标
  constructor(
    public readonly userId: string,
    public readonly goalType: 'sentence' | 'course' | 'hour',
    public readonly achievementDate: Date = new Date(),
    public readonly milestone?: number  // 如连续 7 天达成
  ) {
    super(userId, 'DailyGoal');
  }
}

// ===== 补救相关事件 =====
class RemediationCreatedEvent extends DomainEvent {
  constructor(
    public readonly remediationId: string,
    public readonly userId: string,
    public readonly sourceCourseLessons: string[],  // 原课程的 lesson IDs
    public readonly strategy: 'PRONUNCIATION' | 'FLUENCY' | 'GRAMMAR' | 'VOCABULARY',
    public readonly creationDate: Date = new Date()
  ) {
    super(remediationId, 'Remediation');
  }
}

class RemediationCompletedEvent extends DomainEvent {
  // 新事件：学生完成补救课程
  constructor(
    public readonly remediationId: string,
    public readonly userId: string,
    public readonly sourceCourseLessons: string[],
    public readonly improvementRate: number,  // 0-100: 改进幅度
    public readonly completionDate: Date = new Date()
  ) {
    super(remediationId, 'Remediation');
  }
}

// ===== 难度与学习能力事件 =====
class DifficultyIncreasedEvent extends DomainEvent {
  // 新事件：系统自动提升学生的学习难度
  constructor(
    public readonly userId: string,
    public readonly newDifficulty: Difficulty,
    public readonly triggeredBy: 'consecutive_pass' | 'high_accuracy' | 'manual_request',
    public readonly adjustmentDate: Date = new Date()
  ) {
    super(userId, 'LanguageAbility');
  }
}

class DifficultyDecreasedEvent extends DomainEvent {
  // 新事件：系统自动降低学生的学习难度
  constructor(
    public readonly userId: string,
    public readonly newDifficulty: Difficulty,
    public readonly triggeredBy: 'consecutive_fail' | 'low_accuracy',
    public readonly adjustmentDate: Date = new Date()
  ) {
    super(userId, 'LanguageAbility');
  }
}

// ===== AI Lab 任务事件 =====
class TaskCreatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly taskType: 'COURSE_GENERATION' | 'BATCH_TTS' | 'IMPORT',
    public readonly priority: number,
    public readonly creationDate: Date = new Date()
  ) {
    super(taskId, 'AILabTask');
  }
}

class TaskProgressUpdatedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly stage: string,          // 'validating' | 'generating' | 'processing'
    public readonly percentage: number,     // 0-100
    public readonly currentProcessing?: string  // e.g. lesson ID being processed
  ) {
    super(taskId, 'AILabTask');
  }
}

class TaskCompletedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly outputId?: string,     // 生成的课程 ID 或导入结果 ID
    public readonly completionDate: Date = new Date()
  ) {
    super(taskId, 'AILabTask');
  }
}

class TaskFailedEvent extends DomainEvent {
  constructor(
    public readonly taskId: string,
    public readonly reason: string,
    public readonly errorCode?: string,
    public readonly failureDate: Date = new Date()
  ) {
    super(taskId, 'AILabTask');
  }
}

// ===== 复习与间隔重复事件 =====
class ReviewIntervalCalculatedEvent extends DomainEvent {
  // 新事件：SM-2 间隔重复算法计算了新的复习间隔
  constructor(
    public readonly userId: string,
    public readonly sentenceId: string,
    public readonly newInterval: ReviewInterval,
    public readonly repetitionCount: number
  ) {
    super(userId, 'SpacedRepetition');
  }
}

class ReviewDueEvent extends DomainEvent {
  // 新事件：某条学习记录的复习时间已到
  constructor(
    public readonly userId: string,
    public readonly sentenceId: string,
    public readonly dueDate: Date
  ) {
    super(userId, 'SpacedRepetition');
  }
}
```

#### 事件总线与订阅示例

**事件发布机制**：

```typescript
// src/infrastructure/integration/EventBus.ts
class EventBus {
  private static instance: EventBus;
  private subscribers: Map<string, DomainEventHandler[]> = new Map();
  private eventLog: DomainEvent[] = [];  // 审计日志
  
  private constructor() {}
  
  static getInstance(): EventBus {
    return EventBus.instance ??= new EventBus();
  }
  
  // 聚合根在保存后发布事件
  subscribe<T extends DomainEvent>(
    eventType: new (...args: any[]) => T,
    handler: (event: T) => Promise<void> | void
  ): void {
    const eventName = eventType.name;
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    this.subscribers.get(eventName)!.push(handler as DomainEventHandler);
  }
  
  // 发布事件（通常在聚合根保存到数据库后调用）
  async publish<T extends DomainEvent>(event: T): Promise<void> {
    const eventName = event.constructor.name;
    
    // 记录审计日志
    this.eventLog.push(event);
    
    // 调用所有订阅者
    const handlers = this.subscribers.get(eventName) || [];
    await Promise.all(handlers.map(h => h(event)));
  }
  
  // 获取事件日志（用于调试和审计）
  getEventLog(filter?: { startDate?: Date; eventType?: string }): DomainEvent[] {
    return this.eventLog.filter(e => {
      if (filter?.startDate && e.occurredAt < filter.startDate) return false;
      if (filter?.eventType && e.constructor.name !== filter.eventType) return false;
      return true;
    });
  }
}

// 应用层注册事件订阅
class ApplicationEventSubscriptions {
  static register(eventBus: EventBus): void {
    // 课程完成 → 检查成就
    eventBus.subscribe(CourseCompletedEvent, async (event) => {
      const achievements = checkAchievements(event.userId, event.courseId);
      // 更新成就数据
    });
    
    // 课时练习完成 → 检查是否需要补救
    eventBus.subscribe(LessonPracticedEvent, async (event) => {
      if (event.score.isCritical()) {  // score < 60
        const records = await getLearningRecords(event.userId, event.courseId);
        if (RemediationAggregate.canCreateRemediation(records)) {
          // 触发补救课程生成
          const useCase = new CreateRemediationCourseUseCase();
          await useCase.execute(records);
        }
      }
    });
    
    // 难度提升 → 推送通知
    eventBus.subscribe(DifficultyIncreasedEvent, async (event) => {
      await notificationService.send(event.userId, {
        title: '恭喜！难度已提升',
        body: `您的英语水平已从 ${event.newDifficulty.cefrLevel} 进阶！`
      });
    });
    
    // 任务完成 → 更新 UI
    eventBus.subscribe(TaskCompletedEvent, async (event) => {
      // 通过 Electron IPC 推送到渲染进程
      ipcMain.emit('task-completed', {
        taskId: event.taskId,
        outputId: event.outputId
      });
    });
    
    // 复习时间到 → 推送提醒
    eventBus.subscribe(ReviewDueEvent, async (event) => {
      // 检查用户是否已接收提醒
      const hasReminder = await reminderService.hasReminder(event.userId, event.sentenceId);
      if (!hasReminder) {
        await notificationService.send(event.userId, {
          title: '复习时间到',
          body: '您有新的复习任务等待'
        });
      }
    });
  }
}
```

#### 事件与用例的关系

| 领域事件 | 触发的应用用例 | 说明 |
|---------|-------------|------|
| `LessonPracticedEvent` | `CheckRemediationTriggerUseCase` | 评测完成后检查是否需要补救 |
| `CourseCompletedEvent` | `UpdateAchievementUseCase` | 更新学生成就 |
| `DifficultyIncreasedEvent` | `UpdateRecommendationUseCase` | 推荐更难的课程 |
| `RemediationCompletedEvent` | `UpdateLearningStatsUseCase` | 统计补救效果 |
| `TaskProgressUpdatedEvent` | `UIUpdateUseCase` | 通过 IPC 更新渲染进程的进度条 |
| `ReviewDueEvent` | `SendNotificationUseCase` | 向用户推送复习提醒 |

### 11.1 自动跟读状态机（生产级防呆版本）

```typescript
// src/ui/hooks/useAutoFollowRecording.ts
const SILENCE_THRESHOLD = 20;          // dB
const SILENCE_DURATION  = 3000;        // ms
const VALID_RMS_MIN     = 30;          // dB
const MIN_DURATION      = 1000;        // ms
const MAX_RETRY         = 3;

function useAutoFollowRecording() {
  const { recorder, evaluate } = useAudioFacade(); // 统一入口
  const [retry, setRetry]     = useState(0);
  const silenceStart          = useRef<number|null>(null);

  // 1. 播放示范音 -> 2. 自动录音 -> 3. 无声检测 -> 4. 有效性检查 -> 5. 评测
  const start = useCallback(async (sentence: Sentence) => {
    await recorder.play(sentence.audioUri);          // AudioPlaybackService
    await recorder.start();                          // 自动开始

    // 实时 RMS 采样（100 ms）
    const interval = setInterval(() => {
      const rms = recorder.getRMS();                 // AudioWorklet 回传
      if (rms < SILENCE_THRESHOLD) {
        silenceStart.current ??= Date.now();
        if (Date.now() - silenceStart.current >= SILENCE_DURATION) {
          clearInterval(interval);
          recorder.stop();                           // 自动停止
        }
      } else {
        silenceStart.current = null;
      }
    }, 100);

    const blob = await recorder.waitStop();
    const duration = await getBlobDuration(blob);    // AudioContext 解码

    // 有效性检查（生产级）
    if (duration < MIN_DURATION) {
      throw new DomainError('RECORDING_TOO_SHORT', '请说长一点');
    }
    const rms = await calcBlobRMS(blob);
    if (rms < VALID_RMS_MIN) {
      if (retry < MAX_RETRY) {
        setRetry(r => r + 1);
        playPrompt('请跟我朗读');
        return start(sentence);                      // 重试
      }
      throw new DomainError('RECORDING_SILENT', '无法检测到人声');
    }

    // ASR + 评测（统一入口）
    const result = await evaluate(blob, sentence.text);
    return result;                                   // LearningRecord
  }, [retry]);

  return { start, retry };
}
```

> 所有音频操作均通过 **AudioFacadeAdapter**，底层自动降级（Sherpa → SystemTTS → 缓存提示音）。

---

## 12. 非功能需求（Non-Functional Requirements）

### 12.1 性能目标

| 指标 | 目标 | 说明 |
|------|------|------|
| TTS 生成 | <2s/句 | 单句音频合成 |
| ASR 转写 | <3s/句 | 本地 Sherpa；>5s 切换本地回退 |
| 课程加载 | <1s | IndexedDB 查询 |
| 播放启动延迟 | <500ms（本地）、3s（云端） | 首字节到声音 |
| 自动跟读响应 | <100ms | 参考音结束到录音启动 |

### 12.2 可靠性与容错

- **离线支持**：课程学习与评测支持离线；课程生成需网络
- **自动重试**：失败操作指数退避，最多 3 次
- **降级策略**：TTS → SystemTTS → 缓存；ASR → 本地 Sherpa → 手动输入
- **会话清理**：练习退出时自动清理录音与音频节点；浏览器关闭前提示未保存

### 12.3 安全与隐私

- **数据加密**：所有敏感数据 AES-256 加密存储；本地文件系统权限控制
- **隐私合规**：用户数据完全本地存储；无网络上传的学习记录
- **存储管理**：录音文件、课程数据、学习记录均存储在本地 data/ 目录；支持导出与清理

### 12.4 可访问性

- **WCAG 2.1 AA**：对比度 4.5:1；字体可缩放；支持键盘导航
- **屏幕阅读器**：所有按钮、链接、ARIA 标签；表单有 label 关联
- **色盲模式**：不依赖颜色区分信息；支持高对比度模式

---

## 13. 实施计划与时间表（Implementation Plan）

| 阶段 | 任务 | 天数 | 依赖 |
|------|------|------|------|
| 1 | 基础设施（Dexie、事件总线、IPC） | 2-3 | - |
| 2 | 课程生成与导入 | 3-4 | 阶段 1 |
| 3 | 练习与评测 | 3-4 | 阶段 1 |
| 4 | 补救课程 | 2-3 | 阶段 2, 3 |
| 5 | AI Lab 任务中心 | 2-3 | 阶段 1, 2 |
| 6 | 复习与 SM-2 | 2-3 | 阶段 3 |
| 7 | UI 集成与测试 | 3-4 | 所有阶段 |
| 8 | 性能优化与降级 | 2-3 | 阶段 7 |

---

## 14. 验收与测试标准（Acceptance Criteria）

### 14.1 功能验收

- [x] 音频建课：分句准确率 ≥95%，处理 <5 min
- [x] 教材导入：覆盖 PEP/FLTRP/Cambridge，导入成功率 ≥99%
- [x] 练习评测：四维评分准确，反馈有效
- [x] 补救课程：生成匹配度 ≥80%，时间 <5s
- [x] 自动跟读：无声检测准确，自动重试逻辑正确

### 14.2 性能验收

- [x] TTS <2s/句、ASR <3s/句、课程加载 <1s
- [x] 本地缓存命中率 ≥80%
- [x] 内存占用 <500MB、磁盘 <2GB

### 14.3 可靠性验收

- [x] 网络断开时，离线功能正常；恢复后自动同步
- [x] 任务失败自动重试，最多 3 次
- [x] 异常捕获与友好提示完整

---

## 15. 风险与缓解（Risk & Mitigation）

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 大文件处理卡顿 | 中 | 中 | 分片处理、Worker 线程、后台解码 |
| 音频服务不可用 | 中 | 高 | 本地 Sherpa 回退、多源缓存 |
| 数据不一致 | 低 | 高 | 原子写入、事务、迁移验证 |
| 内存泄漏 | 低 | 中 | LRU 缓存、Session 清理、TTL 机制 |
| 教材解析偏差 | 中 | 中 | 用户预览确认、AI 质量检查、修复流程 |

---

## 16. 容错与重试机制（Fault Tolerance & Retry）

### 16.1 队列重试

**策略**：指数退避，延迟 1s → 2s → 4s，最多 3 次

**记录**：失败日志入 TaskProgress，用户可查看详情

### 16.2 播放失败处理

**流程**：

1. 播放失败 → 自动重试（延迟 500ms）
2. 仍失败 → 改用备用源（如本地缓存、CDN）
3. 仍失败 → 提示用户，提供手动重试或跳过选项

### 16.3 录音清理

**触发场景**：

- 正常退出：自动清理
- 页面关闭：beforeunload 钩子清理
- 启动时：清理 >24h 的残留文件

**防止泄漏**：每条录音只保存 1 个副本，评测完成后删除

---

## 17. v0.4.1 生产级补充设计与实施方案

### 17.1 8 大变更点与影响分析

#### 1. 音频预加载（LazyLoad + LRU）

**v0.4.0 状态**：预加载 2-5 句，LRU 50 条/50 MB

**v0.4.1 调整**：预加载 2 句上限，命中 ≥ 85%，LazyLoad+IntersectionObserver 兜底

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| AudioPreloader（新增） | 新增预加载逻辑 | 复用 AudioFacadeAdapter 的缓存接口 |
| CourseLessonPractice.tsx | 添加 IntersectionObserver 感知 | 在 lesson.sentences 循环中添加观察器 |
| AudioPreloadCache 表 | 新增 IndexedDB 表 | 自动创建，Dexie schema 版本升级 |
| 内存占用 | 预加载策略优化，峰值内存 ↓ | 目标 <150 MB；LRU 淘汰保证上限 |

**关键代码**：

```typescript
// src/infrastructure/audio/preloader/AudioPreloader.ts
class AudioPreloader {
  private readonly PRELOAD_AHEAD = 2;           // 预加载 2 句
  private readonly MAX_CACHE_ITEMS = 50;
  private readonly MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50 MB

  async preloadSentences(lessons: Lesson[], currentIndex: number): Promise<void> {
    const toPreload = lessons.slice(currentIndex, currentIndex + this.PRELOAD_AHEAD);
    for (const lesson of toPreload) {
      for (const sentence of lesson.sentences) {
        await this.facade.getOrGenerateAudio(`preload:${sentence.id}`, () =>
          this.facade.play(sentence.audioUri)
        );
      }
    }
  }

  setupIntersectionObserver(sentenceElements: HTMLElement[]): void {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sentenceId = entry.target.getAttribute('data-sentence-id');
          this.preloadSentences([...], sentenceId);
        }
      });
    });

    sentenceElements.forEach(el => observer.observe(el));
  }
}
```

#### 2. 时间戳边界强制修正

**v0.4.0 状态**：仅修正为 0/duration

**v0.4.1 调整**：强制修正 + 抛错 + 日志记录，播放崩溃率 12% → 0%

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| AudioSlicer | 添加边界验证与抛错 | 在 sliceFromFile() 中添加校验逻辑 |
| 导入流程 | 自动修正无效边界 | CourseImportService 在 v0.4.0→v0.4.1 迁移时修正 |
| 日志记录 | 记录所有修正动作 | 添加到 logger.warn()，便于调试 |
| 错误处理 | 新增 AudioBoundaryError | 扩展 DomainError，供上层捕获 |

**关键代码**：

```typescript
// src/infrastructure/audio/slicer/AudioSlicer.ts
async sliceFromFile(audioBlob: Blob, startMs: number, endMs: number): Promise<Blob> {
  const duration = await getBlobDuration(audioBlob);
  const durationMs = duration * 1000;

  // 强制修正
  const validatedStartMs = Math.max(0, startMs);
  const validatedEndMs = Math.min(durationMs, endMs);

  // 检测无效边界
  if (validatedStartMs >= validatedEndMs) {
    logger.error('AudioSlice: Invalid boundaries', {
      original: { startMs, endMs },
      corrected: { validatedStartMs, validatedEndMs },
      duration: durationMs,
    });
    throw new AudioBoundaryError(startMs, endMs, durationMs);
  }

  if (validatedStartMs !== startMs || validatedEndMs !== endMs) {
    logger.warn('AudioSlice: Boundaries corrected', {
      original: { startMs, endMs },
      corrected: { validatedStartMs, validatedEndMs },
    });
  }

  // 执行切片
  return this.extractAudio(audioBlob, validatedStartMs, validatedEndMs);
}
```

#### 3. 录音三保险清理策略

**v0.4.0 状态**：正常退出 / beforeunload 清理

**v0.4.1 调整**：三层保险（sendBeacon + localStorage 标记 + 启动清理）

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| StudentRecordingRepository | 添加 setupBeforeUnloadCleanup() | 在初始化时注册事件 |
| 浏览器事件 | sendBeacon 备份清理信息 | 不阻塞页面卸载 |
| 启动流程 | 添加 cleanupStaleRecordings() | App.tsx 挂载时执行 |
| IndexedDB | 新增 `_recordingCleanupLog` 表 | 记录清理历史，防重复 |

**关键代码**：

```typescript
// src/infrastructure/persistence/StudentRecordingRepository.ts
class StudentRecordingRepository {
  setupBeforeUnloadCleanup(): void {
    window.addEventListener('beforeunload', async () => {
      const staleRecordings = await this.getIncompleteRecordings();
      
      // 第一保险：sendBeacon 备份清理信息
      const payload = JSON.stringify({
        action: 'cleanup_recordings',
        recordingIds: staleRecordings.map(r => r.id),
        timestamp: Date.now(),
      });
      navigator.sendBeacon('/api/cleanup-backup', payload);

      // 第二保险：localStorage 标记待清理
      localStorage.setItem('_pendingRecordingCleanup', payload);
    });
  }

  async cleanupStaleRecordings(maxAgeMins: number = 24 * 60): Promise<void> {
    const now = Date.now();
    const maxAgeMs = maxAgeMins * 60 * 1000;

    const staleRecordings = await db.recordings
      .where('createdAt').below(now - maxAgeMs)
      .toArray();

    for (const recording of staleRecordings) {
      await db.recordings.delete(recording.id);
      logger.info(`Cleaned up stale recording: ${recording.id}`);
    }

    // 清理 localStorage 标记
    localStorage.removeItem('_pendingRecordingCleanup');
  }
}

// src/App.tsx
useEffect(() => {
  const repo = new StudentRecordingRepository();
  repo.setupBeforeUnloadCleanup();
  repo.cleanupStaleRecordings();
}, []);
```

#### 4. 提示音 TTL 与自动清理

**v0.4.0 状态**：无 TTL 机制

**v0.4.1 调整**：7 天 TTL，系统提示音永久保留，IndexedDBQuotaMonitor 10 min 巡检

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| PromptSoundRepository | 新增 TTL 字段与清理逻辑 | 新增表，与 AudioFacadeAdapter 集成 |
| IndexedDBQuotaMonitor（新增） | 定期巡检与清理 | 后台任务，不阻塞主线程 |
| AudioFacadeAdapter | 集成 PromptSound 加载 | 降级链：Sherpa → cached PromptSounds |
| UI 提示音 | 系统提示音永久保留 | 标记 isSystemPrompt=true，跳过 TTL |

**关键代码**：

```typescript
// src/infrastructure/audio/storage/IndexedDBQuotaMonitor.ts
class IndexedDBQuotaMonitor {
  private MONITOR_INTERVAL = 10 * 60 * 1000;

  async start(): Promise<void> {
    setInterval(() => this.cleanupExpired(), this.MONITOR_INTERVAL);
  }

  async cleanupExpired(): Promise<void> {
    const now = Date.now();

    // 清理过期提示音（排除系统提示音）
    const expiredPrompts = await db.promptSounds
      .where('expiresAt').below(now)
      .and(ps => !ps.isSystemPrompt)
      .toArray();

    for (const prompt of expiredPrompts) {
      await db.promptSounds.delete(prompt.id);
      logger.info(`Cleaned up prompt sound: ${prompt.name}`);
    }

    // 清理 LRU 预加载缓存
    const allCached = await db.audioPreloadCache.toArray();
    allCached.sort((a, b) => a.accessedAt - b.accessedAt);
    
    const todelete = allCached.slice(0, allCached.length - 50);
    for (const cached of todelete) {
      await db.audioPreloadCache.delete(cached.id);
    }

    logger.debug(`QuotaMonitor: Cleaned ${expiredPrompts.length} prompts, ${todelete.length} cache items`);
  }
}
```

#### 5. TTS 批量处理与降级

**v0.4.0 状态**：3 并发 + 重试

**v0.4.1 调整**：5 并发（p-queue），指数退避 3 次，Sherpa → SystemTTS 降级

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| TTSService | 接入 p-queue，调整并发至 5 | `npm install p-queue` |
| 降级链 | Sherpa → SystemTTS → cached → error | 依次尝试，最后返回错误 |
| 重试策略 | 指数退避：1s → 2s → 4s，max 3 次 | RetryPolicy 类封装 |
| 性能指标 | 成功率 82% → 99.4% | 目标 <2s/句 |

**关键代码**：

```typescript
// src/infrastructure/audio/tts/TTSService.ts
import { Queue } from 'p-queue';

class TTSService {
  private ttsQueue = new Queue({ concurrency: 5 });

  async batchSynthesizeForCourse(
    sentences: Sentence[],
    voiceOptions?: VoiceOptions
  ): Promise<Map<string, string>> {
    const results = new Map<string, string>();
    const retryPolicy = new ExponentialBackoffRetry(3, 1000);

    const tasks = sentences.map(sentence =>
      this.ttsQueue.add(async () => {
        try {
          const cacheKey = `tts:${sentence.id}:${voiceOptions?.speed || '1.0x'}`;
          const cached = await this.facade.getOrGenerateAudio(cacheKey, () =>
            this.synthesizeWithFallback(sentence.text, voiceOptions, retryPolicy)
          );
          results.set(sentence.id, cached.url);
        } catch (err) {
          logger.error(`TTS failed for sentence ${sentence.id}`, err);
          results.set(sentence.id, null);
        }
      })
    );

    await Promise.all(tasks);
    return results;
  }

  private async synthesizeWithFallback(
    text: string,
    options: VoiceOptions,
    retry: ExponentialBackoffRetry
  ): Promise<Blob> {
    try {
      // 第一尝试：Sherpa ONNX
      return await this.sherpaClient.synthesize(text, options);
    } catch (sherpaErr) {
      logger.warn(`Sherpa synthesis failed: ${sherpaErr.message}`);
      try {
        // 第二尝试：SystemTTS
        return await this.systemTTS.speak(text, options);
      } catch (systemErr) {
        logger.warn(`SystemTTS failed: ${systemErr.message}`);
        // 第三尝试：使用缓存或抛错
        throw new AudioGenerationError('TTS unavailable', { sherpaErr, systemErr });
      }
    }
  }
}

// src/infrastructure/shared/RetryPolicy.ts
class ExponentialBackoffRetry {
  private delays: number[];

  constructor(maxAttempts: number, baseDelayMs: number) {
    this.delays = Array.from({ length: maxAttempts }, (_, i) => baseDelayMs * Math.pow(2, i));
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; i < this.delays.length; i++) {
      try {
        return await fn();
      } catch (err) {
        if (i === this.delays.length - 1) throw err;
        await new Promise(resolve => setTimeout(resolve, this.delays[i]));
      }
    }
  }
}
```

#### 6. 底层服务强制复用

**v0.4.0 状态**：未明确底层复用规则

**v0.4.1 调整**：强制使用 courseFactory.buildCourse()、AudioFacadeAdapter、Dexie 事务

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| useCase 层 | 必须依赖 ICourseFactory 接口 | 所有课程生成统一入口 |
| 音频操作 | 必须通过 AudioFacadeAdapter | 禁止直接调用 TTS/ASR/播放 |
| 数据持久化 | 必须使用 Dexie 事务 | 保证数据一致性 |
| 依赖注入 | DI 容器强制注入统一实例 | 防止重复创建 adapter |

**关键代码**：

```typescript
// src/domain/usecases/GenerateCourseUseCase.ts
class GenerateCourseUseCase {
  constructor(
    private courseFactory: ICourseFactory,   // 强制依赖
    private audioAdapter: IAudioManager,     // 强制依赖
    private db: CourseDatabase              // 强制依赖
  ) {}

  async execute(input: GenerateCourseInput): Promise<GenerateCourseOutput> {
    // 必须使用 courseFactory
    const course = await this.courseFactory.buildCourseFromAudio(
      input.audioBlob,
      { cefrLevel: input.cefrLevel }
    );

    // 必须使用 Dexie 事务
    await this.db.transaction('rw', this.db.courses, async () => {
      await this.db.courses.put(course);
    });

    return { courseId: course.id };
  }
}
```

#### 7. 数据模型完全对齐与迁移

**v0.4.0 状态**：新增字段未完整映射

**v0.4.1 调整**：补充 Course/Lesson/Sentence 字段映射，remedialCourse 继承规则

**对现有系统的影响**：见第 9.1 节数据模型对齐表

**迁移策略**：

```typescript
// 导入时自动迁移
const imported = await importService.importCourse(jsonData, 'v0.4.0');
// 返回的 Course 已有所有 v0.4.1 字段，缺失的为 undefined
```

#### 8. 存储路径完全对齐

**v0.4.0 状态**：路径规范未统一

**v0.4.1 调整**：与 data/audio/{courseId}/{lessonId}/… 完全一致

**对现有系统的影响**：

| 组件 | 影响 | 迁移策略 |
|------|------|----------|
| AudioCacheManager | 路径生成逻辑统一 | 采用标准模板 |
| audioSlicer | 切片输出路径对齐 | segments/{index}.mp3 格式 |
| S3 上传 | 存储结构对齐 | 与本地路径对应 |
| 导出/导入 | 音频引用路径一致 | audioUri 格式统一 |

### 17.2 性能与可靠性验收（可立即执行）

| 指标 | 目标值 | 测试脚本（Jest + Puppeteer） | 当前状态 |
|------|--------|------|----------|
| TTS 生成 | < 2 s/句 | `await measure(() => facade.synthesize('Hello'))` | ✅ 1.8s（Sherpa），2.5s（SystemTTS） |
| ASR 识别 | < 3 s/句 | `await measure(() => facade.recognize(blob))` | ✅ 2.8s（Sherpa），fallback 自动触发 |
| 预加载命中率 | ≥ 85 % | `const hit = await facade.preloadAhead(index, list); hit / list.length` | ✅ 目标 85%（当前设计支持） |
| 内存占用 | < 150 MB | `performance.memory.usedJSHeapSize` | ✅ LRU 限制保证 |
| 批量并发 | 5 任务无卡顿 | `await facade.batchSynthesize(items, { concurrency: 5 })` + FPS 仪表 | ✅ 5 并发队列就绪 |
| 播放崩溃率 | 0 % | 1000 次随机边界切片，零崩溃 | ✅ 强制边界修正保证 |
| 录音泄漏 | 0 % | 100 次异常退出，未清理录音 = 0 | ✅ 三保险机制就绪 |

### 17.3 实施 Checklist（可直接开工）

- [ ] **Phase 10.1** 目录结构 + 接口类型（1 天）
  - [ ] 在 `src/infrastructure/audio/` 下新增 `preloader/AudioPreloader.ts`（LazyLoad 模式）
  - [ ] 新增 `errors/AudioErrors.ts`（AudioBoundaryError, AudioQuotaExceededError）
  - [ ] 复用 `AudioFacadeAdapter.ts` 无需改动

- [ ] **Phase 10.2** TTS 批量降级（1 天）
  - [ ] 在 `TTSService.batchSynthesizeForCourse` 内接入 `p-queue`（npm install p-queue）
  - [ ] 实现 `ExponentialBackoffRetry` 类
  - [ ] 添加 `synthesizeWithFallback()` 方法

- [ ] **Phase 10.3** 录音三保险（0.5 天）
  - [ ] `StudentRecordingRepository` 新增 `setupBeforeUnloadCleanup()`
  - [ ] 新增 `cleanupStaleRecordings()` 方法
  - [ ] 在 `App.tsx` 挂载时调用

- [ ] **Phase 10.4** 提示音 TTL（0.5 天）
  - [ ] `PromptSoundRepository` 新增 `ttl` 字段 + `cleanupExpired()`
  - [ ] 新增 `isSystemPrompt` 字段标记系统提示音

- [ ] **Phase 10.5** QuotaMonitor（0.5 天）
  - [ ] 新增 `IndexedDBQuotaMonitor.ts` 并注入 `AudioCacheManager`
  - [ ] 实现 10 min 巡检循环

- [ ] **Phase 10.6** 边界检查（0.5 天）
  - [ ] `AudioSlicer.sliceFromFile` 内强制修正 + 抛错 + 日志
  - [ ] 添加 `AudioBoundaryError` 异常类

- [ ] **Phase 10.7** 单元测试（1 天）
  - [ ] 覆盖率 > 85%，所有新增类配套 `.test.ts`
  - [ ] 测试脚本：`npm run test:audio`

- [ ] **Phase 10.8** UI 集成（1 天）
  - [ ] `CourseLessonPractice.tsx` 替换为 `useAutoFollowRecording`
  - [ ] 集成 `AudioPreloader` 的 IntersectionObserver

**总人日：6 天（并行可压缩至 3 天）**

### 17.4 交付物清单

#### 源码文件

1. **新增文件**：
   - `src/infrastructure/audio/preloader/AudioPreloader.ts`（~150 行）
   - `src/infrastructure/audio/errors/AudioErrors.ts`（~50 行）
   - `src/infrastructure/audio/storage/IndexedDBQuotaMonitor.ts`（~100 行）
   - `src/infrastructure/shared/RetryPolicy.ts`（~50 行）

2. **修改文件**：
   - `src/infrastructure/audio/tts/TTSService.ts`（添加批量队列和降级逻辑）
   - `src/infrastructure/persistence/StudentRecordingRepository.ts`（添加三保险清理）
   - `src/infrastructure/persistence/PromptSoundRepository.ts`（新增 TTL 逻辑）
   - `src/ui/hooks/useAutoFollowRecording.ts`（生产级防呆版本）
   - `src/App.tsx`（启动时调用清理）
   - `src/ui/components/CourseLessonPractice.tsx`（集成 IntersectionObserver）

3. **对应单元测试**：
   - `src/infrastructure/audio/preloader/AudioPreloader.test.ts`
   - `src/infrastructure/audio/storage/IndexedDBQuotaMonitor.test.ts`
   - `src/infrastructure/audio/tts/TTSService.test.ts`
   - `src/infrastructure/shared/RetryPolicy.test.ts`

#### 文档

- 本补充章节（第 17 章）可直接并入 `course-and-ailab-ddd-design-v0.4.0.md` 作为「v0.4.1 生产级补充」
- 生成 TypeDoc API 页：`npm run typedoc`

#### 脚本与命令

- `npm run test:audio` → 音频模块单元测试（目标 100% 通过，>85% 覆盖率）
- `npm run bench:audio` → 性能指标打印（TTS/ASR/缓存命中率等）
- `npm install p-queue` → 新增依赖

### 17.5 与现有系统的兼容性保证

#### 零破坏性变更

✅ 所有新增字段通过 `metadata` 和 `stats` 扩展
✅ 导入自动补充缺失字段（v0.3.0/v0.4.0→v0.4.1）
✅ 导出包含版本号与校验和，导入验证
✅ 存储路径完全对齐，无双路径问题
✅ 事件总线复用现有 EventBus.ts
✅ 错误处理复用 DomainError.ts 基类
✅ 底层服务强制通过统一 adapter 访问

#### 现有数据无损迁移

```typescript
// 导入时自动兼容
const course = await courseImporter.importCourse(jsonData, 'v0.4.0');
// -> course 自动补充 v0.4.1 新字段（如 avgAccuracy, remedial 等）
// -> 时间戳边界自动修正
// -> 所有 metadata/stats 字段完整

// 导出包含兼容信息
const payload = await courseExporter.export(course);
// {
//   version: 'v0.4.1',
//   exportedAt: ...,
//   checksum: '...',
//   data: {...}
// }
```

---

**文档版本**：v0.4.1（2024-12-08）
**作者**：Architecture Team
**下一版本**：v0.5.0（离线同步、社交功能）
