# Lexitype Academy 架构设计文档

## 1. 系统整体架构

Lexitype Academy 采用分层架构设计，主要分为前端展示层、业务逻辑层和数据存储层。系统基于 React + TypeScript 构建，使用 Electron 进行桌面应用打包，支持跨平台运行。

### 1.1 架构分层

| 层级 | 职责 | 技术实现 |
|------|------|----------|
| 前端展示层 | 用户界面展示和交互 | React 组件、Tailwind CSS |
| 业务逻辑层 | 核心业务逻辑处理 | TypeScript 服务、React Hooks |
| 数据存储层 | 数据持久化存储 | IndexedDB、LocalStorage |
| 音频处理层 | 音频播放、录制、识别和评估 | Web Audio API、Sherpa-ONNX |

### 1.2 系统架构图

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                                用户界面                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  组件层                                                                 │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │
│  │  │ App        │  │ Course     │  │ Lesson     │  │ Game       │         │ │
│  │  │ Component  │  │ Manager    │  │ Practice   │  │ Center     │         │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │
│  │  │ Audio      │  │ Typing     │  │ Hint       │  │ Progress   │         │ │
│  │  │ Player     │  │ Input      │  │ Panel      │  │ Bar        │         │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
                                      │
┌───────────────────────────────────────────────────────────────────────────────┐
│                                业务逻辑层                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  服务层                                                                 │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │
│  │  │ Course     │  │ TTS        │  │ ASR        │  │ Speech     │         │ │
│  │  │ Service    │  │ Service    │  │ Service    │  │ Eval       │         │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │
│  │  │ Progress   │  │ Review     │  │ Audio      │  │ AI         │         │ │
│  │  │ Service    │  │ Service    │  │ Recorder   │  │ Service    │         │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
                                      │
┌───────────────────────────────────────────────────────────────────────────────┐
│                                数据存储层                                    │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  存储层                                                                 │ │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐         │ │
│  │  │ IndexedDB  │  │ Local      │  │ File       │  │ Web        │         │ │
│  │  │           │  │ Storage    │  │ System     │  │ Worker     │         │ │
│  │  └────────────┘  └────────────┘  └────────────┘  └────────────┘         │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────┘
```

## 2. 前端架构设计

### 2.1 组件设计原则

- **单一职责原则**：每个组件只负责一个特定的功能
- **可复用性**：组件设计应考虑复用性，避免重复代码
- **可维护性**：组件结构清晰，易于维护和扩展
- **性能优化**：组件设计应考虑性能优化，避免不必要的重渲染
- **可测试性**：组件设计应便于测试

### 2.2 核心组件结构

#### 2.2.1 主应用组件

- **App.tsx**：应用入口，管理全局状态和路由
- **Layout.tsx**：应用布局组件，包含导航栏、侧边栏和主内容区
- **Navigation.tsx**：导航组件，处理应用导航

#### 2.2.2 课程管理组件

- **CourseManager.tsx**：课程管理中心，负责课程列表、筛选、导入导出
- **CourseCard.tsx**：课程卡片组件，展示课程信息
- **LessonList.tsx**：课时列表组件，展示课程的课时信息

#### 2.2.3 练习组件

- **CourseLessonPractice.tsx**：句子级课程练习，支持多种练习模式
- **WordLessonPractice.tsx**：单词级课程练习
- **PracticeModeSelector.tsx**：练习模式选择组件
- **LearningCard.tsx**：学习卡片组件，展示练习内容

#### 2.2.4 音频组件

- **AudioPlayer.tsx**：音频播放组件，支持播放、暂停、循环等功能
- **PlaybackController.tsx**：播放控制组件，支持播放模式切换
- **ShadowingRecorder.tsx**：跟读录音组件，支持录音和回放
- **PronunciationResultView.tsx**：发音评估结果展示组件

#### 2.2.5 UI 组件

- **HintPanel.tsx**：多级提示组件
- **TypingInput.tsx**：听写/拼写输入组件
- **ProgressBar.tsx**：进度条组件
- **ErrorBadge.tsx**：错误标记组件
- **HotkeyGuidePopover.tsx**：热键提示组件

### 2.3 状态管理设计

- **组件内部状态**：使用 React Hooks（useState, useReducer）管理组件内部状态
- **跨组件状态共享**：使用 Context API 管理跨组件状态共享
- **持久化状态**：使用 LocalStorage/IndexedDB 管理持久化状态
- **状态更新策略**：使用不可变数据模式，确保状态更新的可预测性

## 3. 服务层架构设计

### 3.1 服务设计原则

- **模块化设计**：服务按功能模块划分，职责清晰
- **松耦合**：服务之间耦合度低，便于维护和扩展
- **可测试性**：服务设计便于测试
- **错误处理**：服务应包含完善的错误处理机制
- **性能优化**：服务设计应考虑性能优化

### 3.2 核心服务

#### 3.2.1 课程管理服务

- **courseStore.ts**：课程数据存储与管理
  - 课程数据的增删改查
  - 课程导入和导出
  - 课程内容验证和转换

- **courseFactory.ts**：课程生成工厂
  - 基于文本生成课程
  - 基于 URL 生成课程
  - 课程内容格式化

- **progressService.ts**：学习进度跟踪
  - 记录课程学习进度
  - 计算课程完成率
  - 生成学习统计数据

- **reviewService.ts**：复习内容管理
  - 基于记忆曲线生成复习内容
  - 管理复习队列
  - 记录复习结果

#### 3.2.2 音频处理服务

- **ttsManager.ts**：文本转语音服务
  - 支持多种 TTS 提供商
  - 音频缓存管理
  - 语速调节

- **asrManager.ts**：自动语音识别服务
  - 基于 Sherpa-ONNX 实现本地语音识别
  - 支持 VAD（语音活动检测）
  - 支持多种语言模型

- **audioRecorder.ts**：音频录制服务
  - 音频录制控制
  - 录音数据处理
  - 录音格式转换

- **playbackController.ts**：音频播放控制服务
  - 音频播放管理
  - 播放模式控制（正常、慢速、分段等）
  - 音频资源管理

- **speechEvalService.ts**：语音评估服务
  - 语音发音评估
  - 流畅度评分
  - 完整度评分
  - 发音反馈

#### 3.2.3 AI 服务

- **aiService.ts**：AI 语义分析服务
  - 语义相似度分析
  - 翻译建议
  - 语法纠错

- **aiDialogueService.ts**：AI 对话服务
  - 基于课程内容的对话生成
  - 对话历史管理
  - 对话评估

## 4. 数据模型设计

### 4.1 课程数据模型

```typescript
// 课程模型
interface Course {
  id: string;                // 课程 ID
  title: string;             // 课程标题
  description: string;       // 课程描述
  tags: string[];            // 课程标签
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom'; // 难度等级
  type: 'words' | 'text' | 'mixed'; // 课程类型
  stats: CourseStats;        // 学习统计
  lessons: Lesson[];         // 课时列表
  createdAt: string;         // 创建时间
  updatedAt: string;         // 更新时间
}

// 课程统计模型
interface CourseStats {
  practiceCount: number;     // 练习次数
  avgAccuracy: number;       // 平均准确率
  avgWpm: number;            // 平均 WPM
  completedLessons: string[]; // 已完成的课时
  sentencesPerfect: number;  // 满分句子数
  sentencesHigh: number;     // 高分句子数
  sentencesNeedsReview: number; // 需要复习的句子数
}

// 课时模型
interface Lesson {
  id: string;                // 课时 ID
  content: string;           // 课时内容
  contentTranslation?: string; // 课时内容翻译
  sentences: Sentence[];     // 句子列表
  words: Word[];             // 单词列表
  modesEnabled: LessonModes; // 支持的练习模式
  audio?: LessonAudio;       // 音频元数据
  index?: number;            // 课时索引
}

// 句子模型
interface Sentence {
  id?: string;               // 句子 ID
  en: string;                // 英文句子
  zh?: string;               // 中文翻译
  keywords?: Keyword[];      // 关键词列表
  startMs?: number;          // 音频开始时间（毫秒）
  endMs?: number;            // 音频结束时间（毫秒）
  audioUrl?: string;         // 音频 URL
  modes?: SentenceModes;     // 支持的练习模式
}

// 单词模型
interface Word {
  id?: string;               // 单词 ID
  word: string;              // 单词
  phonetic?: string;         // 音标
  meaning?: string;          // 词义
  translation?: string;      // 中文翻译
  example?: string;          // 例句
  exampleTranslation?: string; // 例句翻译
  partOfSpeech?: string;     // 词性
}

// 关键词模型
interface Keyword {
  word: string;              // 关键词
  phonetic?: string;         // 音标
  meaning?: string;          // 词义
}

// 课时模式模型
interface LessonModes {
  dictation?: boolean;       // 听写模式
  followRead?: boolean;      // 跟读模式
  translation?: boolean;     // 翻译模式
  imitation?: boolean;       // 模仿模式
}

// 句子模式模型
interface SentenceModes {
  dictation?: boolean;       // 听写模式
  followRead?: boolean;      // 跟读模式
  translation?: boolean;     // 翻译模式
  imitation?: boolean;       // 模仿模式
}

// 课时音频模型
interface LessonAudio {
  originalFileUrl?: string;  // 原始音频文件 URL
  durationMs?: number;       // 音频时长（毫秒）
}
```

### 4.2 学习数据模型

```typescript
// 学习记录模型
interface LearningRecord {
  id: string;                // 记录 ID
  courseId: string;          // 课程 ID
  lessonId: string;          // 课时 ID
  practiceType: string;      // 练习类型
  wpm: number;               // 每分钟字数
  accuracy: number;          // 准确率
  date: string;              // 练习日期
  duration: number;          // 练习时长（秒）
  errors: ErrorRecord[];     // 错误记录
}

// 错误记录模型
interface ErrorRecord {
  id: string;                // 错误 ID
  unitType: 'word' | 'phrase' | 'sentence' | 'paragraph'; // 错误单位类型
  unitContent: string;       // 错误单位内容
  errorType: ErrorType;      // 错误类型
  detail: string;            // 错误详情
  timestamp: number;         // 错误时间戳
  attemptContext?: {         // 尝试上下文
    mode: 'listen' | 'speak' | 'read' | 'write';
    sourceExerciseId?: string;
  };
  severity: 1 | 2 | 3;       // 影响程度
}

// 错误类型枚举
enum ErrorType {
  SPELLING = 'SPELLING',                 // 拼写错误
  VOCAB_MEANING = 'VOCAB_MEANING',       // 词汇含义错误
  GRAMMAR = 'GRAMMAR',                   // 语法错误
  PRONUNCIATION = 'PRONUNCIATION',       // 发音错误
  LISTENING = 'LISTENING',               // 听力错误
  SEMANTIC_INAPPROPRIATE = 'SEMANTIC_INAPPROPRIATE', // 语义不当
  FLUENCY = 'FLUENCY'                   // 流畅度错误
}

// 单词掌握度模型
interface WordMastery {
  word: string;              // 单词
  masteryLevel: number;      // 掌握程度（0-100）
  practiceCount: number;     // 练习次数
  lastPracticedAt: string;   // 最后练习时间
  errorCount: number;        // 错误次数
  reviewPriority: number;    // 复习优先级
  nextReviewAt?: string;     // 下次复习时间
}
```

## 5. 数据流设计

### 5.1 练习数据流

1. **练习开始**：
   - 用户选择课程和课时，进入练习界面
   - 加载练习内容和音频资源
   - 初始化练习状态

2. **练习进行**：
   - 播放目标音频
   - 用户进行练习（听写、跟读、翻译等）
   - 系统实时处理用户输入
   - 记录练习数据和错误信息

3. **练习评估**：
   - 系统评估练习结果
   - 提供评估反馈
   - 更新学习统计数据

4. **练习完成**：
   - 保存练习记录
   - 更新课程进度
   - 生成复习内容
   - 提供后续学习建议

### 5.2 音频数据流

1. **音频生成**：
   - 文本转语音（TTS）生成音频
   - 音频缓存管理

2. **音频播放**：
   - 音频资源加载
   - 音频播放控制
   - 播放模式切换

3. **音频录制**：
   - 录音开始和停止控制
   - 录音数据处理
   - 录音格式转换

4. **语音识别**：
   - 录音数据输入
   - ASR 语音识别
   - 识别结果输出

5. **语音评估**：
   - 录音数据输入
   - 语音评估算法处理
   - 评估结果输出

## 6. 性能优化设计

### 6.1 前端性能优化

- **组件懒加载**：使用 React.lazy 和 Suspense 实现组件懒加载
- **代码分割**：使用 Vite 的代码分割功能，减小初始加载体积
- **虚拟滚动**：使用虚拟滚动技术处理大量数据列表
- **图片优化**：使用适当尺寸和格式的图片，实现图片懒加载
- **缓存机制**：实现组件缓存和数据缓存，减少重复计算
- **减少重渲染**：使用 React.memo、useMemo 和 useCallback 优化组件重渲染

### 6.2 音频处理性能优化

- **音频缓存**：实现音频资源缓存，减少重复生成和加载
- **Web Worker 处理**：将音频处理、ASR 和 TTS 等耗时操作移至 Web Worker
- **资源池管理**：实现音频资源池，统一管理音频资源的创建和释放
- **批量处理**：对音频数据进行批量处理，减少系统调用
- **异步处理**：使用异步编程模型，避免阻塞主线程

### 6.3 数据存储性能优化

- **索引优化**：为 IndexedDB 数据添加适当的索引，提高查询性能
- **批量操作**：对数据进行批量操作，减少数据库交互次数
- **数据压缩**：对大量数据进行压缩存储，减少存储空间占用
- **定期清理**：定期清理过期数据，保持数据库性能

## 7. 安全设计

### 7.1 数据安全

- **数据加密**：对敏感数据进行加密存储
- **安全的本地存储**：使用安全的本地存储方案，避免 XSS 攻击
- **数据备份与恢复**：实现数据备份与恢复功能，防止数据丢失

### 7.2 应用安全

- **输入验证**：对用户输入进行严格验证，防止注入攻击
- **XSS 防护**：使用 React 的内置 XSS 防护机制，避免 XSS 攻击
- **CSRF 防护**：实现 CSRF 防护机制，防止跨站请求伪造攻击
- **安全的 API 调用**：确保 API 调用的安全性，实现适当的认证和授权

### 7.3 音频安全

- **安全的音频资源加载**：确保音频资源来自安全的来源
- **音频资源验证**：对加载的音频资源进行验证，防止恶意音频
- **麦克风权限管理**：合理管理麦克风权限，尊重用户隐私

## 8. 部署设计

### 8.1 开发环境部署

- **Node.js**：18+
- **npm**：9+
- **Git**：版本控制
- **IDE**：Visual Studio Code 或其他支持 TypeScript 的 IDE

### 8.2 构建流程

1. **代码检查**：使用 ESLint 和 TypeScript 进行代码检查
2. **单元测试**：使用 Jest 进行单元测试
3. **构建**：使用 Vite 进行项目构建
4. **打包**：使用 Electron Builder 进行桌面应用打包

### 8.3 生产环境部署

- **Windows**：支持 Windows 10+
- **macOS**：支持 macOS 11+
- **Linux**：支持 Ubuntu 20.04+ 和其他主流 Linux 发行版

### 8.4 自动更新设计

- **更新检查**：应用启动时检查更新
- **更新下载**：自动下载更新包
- **更新安装**：在应用关闭时安装更新
- **更新回滚**：支持更新失败时的回滚机制

## 9. 技术栈选择

| 技术 | 版本 | 用途 | 选择理由 |
|------|------|------|----------|
| React | 18+ | 前端框架 | 组件化开发，丰富的生态系统，良好的性能 |
| TypeScript | 5+ | 类型系统 | 类型安全，提高代码质量和可维护性 |
| Electron | 30+ | 桌面应用打包 | 跨平台支持，丰富的原生 API，成熟的生态系统 |
| Vite | 5+ | 构建工具 | 快速的开发体验，良好的构建性能 |
| Tailwind CSS | 3+ | CSS 框架 | 实用优先，易于定制，良好的开发体验 |
| IndexedDB | 浏览器内置 | 本地数据库 | 适合存储大量结构化数据，良好的性能 |
| Web Audio API | 浏览器内置 | 音频处理 | 强大的音频处理能力，浏览器原生支持 |
| Sherpa-ONNX | 1.12.18 | TTS 和 ASR | 高性能的本地语音处理，支持多种语言模型 |

## 10. 总结

Lexitype Academy 采用现代化的架构设计，基于 React + TypeScript 构建，使用分层架构设计，组件和服务分离，职责清晰。系统支持多种练习模式，集成了先进的音频处理技术，提供了完整的学习体验。

架构设计考虑了性能优化、安全设计和可扩展性，能够支持系统的持续演进和功能扩展。系统的模块化设计使得各功能模块可以独立开发和测试，提高了开发效率和代码质量。

通过合理的架构设计和技术选型，Lexitype Academy 能够提供高效、稳定、安全的英语学习体验，满足不同用户的学习需求。