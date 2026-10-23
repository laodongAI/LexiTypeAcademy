# LexiType Academy 功能迁移计划与开发路线图

**文档版本**: v1.0  
**创建日期**: 2026-01-05  
**作者**: AI 产品经理 & 架构师

---

## 📋 目录

1. [迁移现状分析](#1-迁移现状分析)
2. [功能差异对比](#2-功能差异对比)
3. [技术架构对比](#3-技术架构对比)
4. [迁移策略](#4-迁移策略)
5. [详细迁移任务](#5-详细迁移任务)
6. [开发计划与里程碑](#6-开发计划与里程碑)
7. [风险评估与应对](#7-风险评估与应对)

---

## 1. 迁移现状分析

### 1.1 代码库状态

| 目录 | 技术栈 | 状态 | 说明 |
|------|--------|------|------|
| `src/` | React + TypeScript | ✅ 完整功能 | 原始完整实现 |
| `src_bak/` | React + TypeScript | 🔄 备份 | 旧版备份代码 |
| `vue-app/` | Vue 3 + TypeScript + Element Plus | 🚧 部分迁移 | 新架构，功能不完整 |

### 1.2 已迁移功能

| 功能模块 | 迁移状态 | 完成度 | 备注 |
|---------|---------|--------|------|
| 基础框架 | ✅ 完成 | 100% | Vue 3 + Vite + Electron Forge |
| 首页布局 | ✅ 完成 | 90% | HomePage.vue 已创建 |
| 拼音练习 | ✅ 完成 | 80% | 基础功能已实现 |
| 打字练习页面 | ✅ 完成 | 70% | TypingPage.vue 已创建 |
| 路由系统 | ✅ 完成 | 90% | Vue Router 配置完成 |
| 状态管理 | ✅ 完成 | 60% | Pinia stores 部分完成 |

### 1.3 缺失功能清单

#### 🔴 高优先级缺失

1. **指法练习（Finger Practice）**
   - 键盘布局可视化
   - 按键高亮显示
   - 手指位置引导
   - 练习记录统计

2. **游戏中心（Game Center）**
   - 7种游戏模式
   - 打字竞速
   - 单词连连看
   - 拼写挑战
   - 记忆卡片
   - 成就系统

3. **AI 实验室（AI Lab）**
   - AI 课程生成器
   - 音频建课向导
   - 教材导入功能
   - 弱词强化复习
   - 自由写作教练
   - 任务历史记录

4. **英语课程系统（English Courses）**
   - 课程管理
   - 课程列表/搜索/筛选
   - 课程详情查看
   - 课时练习（听写/跟读/翻译/模仿）
   - 课程导入/导出
   - 学习进度追踪

#### 🟡 中优先级缺失

5. **复习系统（Review Management）**
   - SM-2 间隔重复算法
   - 复习队列管理
   - 复习模式（听写/闪卡）
   - 掌握等级追踪
   - 复习统计报表

6. **学习记录（Learning History）**
   - 练习记录查看
   - 统计图表
   - 成绩趋势分析
   - 错题本

7. **设置中心（Settings）**
   - AI 配置（API Key/Base URL）
   - 语言切换
   - 主题切换
   - 字体大小调整
   - 音频设置

#### 🟢 低优先级缺失

8. **高级功能**
   - 课程仓库系统
   - 学习计划
   - 今日任务中心
   - AI 互动对话
   - 阶段性评估报告

---

## 2. 功能差异对比

### 2.1 组件级对比

#### 旧代码（src/src_bak）主要组件

```
src/
├── App.tsx                           # 主应用入口
├── ui/
│   ├── pages/
│   │   ├── home/HomePage.tsx         # 首页
│   │   ├── typing/TypingGamePage.tsx # 打字练习
│   │   ├── pinyin/PinyinPage.tsx     # 拼音练习
│   │   ├── courses/CoursesPage.tsx   # 课程管理
│   │   ├── ailab/AILabPage.tsx       # AI实验室
│   │   ├── review/ReviewPage.tsx     # 复习管理
│   │   └── settings/SettingsPage.tsx # 设置
│   └── components/
│       ├── Keyboard.tsx              # 键盘组件
│       ├── TypingGame.tsx            # 打字游戏
│       ├── CourseLessonPractice.tsx  # 课程练习
│       ├── CourseManager.tsx         # 课程管理器
│       ├── AICourseGenerator.tsx     # AI生成器
│       └── ReviewManager.tsx         # 复习管理器
├── domain/
│   ├── course/                       # 课程领域模型
│   ├── practice/                     # 练习领域模型
│   └── review/                       # 复习领域模型
├── application/
│   ├── courseService.ts              # 课程服务
│   ├── practiceService.ts            # 练习服务
│   └── reviewService.ts              # 复习服务
└── infrastructure/
    ├── db/                           # Dexie.js 数据库
    └── storage/                      # 本地存储
```

#### 新代码（vue-app）现有结构

```
vue-app/src/
├── main/                             # Electron 主进程
├── preload/                          # Preload 脚本
├── renderer/                         # 渲染进程
│   ├── App.vue                       # 主应用
│   ├── main.ts                       # 入口
│   ├── views/
│   │   ├── HomePage.vue              # ✅ 首页
│   │   ├── TypingPage.vue            # ✅ 打字练习
│   │   └── SettingsPage.vue          # ✅ 设置
│   ├── components/
│   │   └── [基础组件]
│   ├── stores/
│   │   └── [Pinia stores]
│   └── router/
│       └── index.ts                  # 路由配置
└── shared/                           # 共享类型和工具
```

### 2.2 功能模块对比表

| 模块 | 旧代码文件 | 新代码文件 | 迁移状态 | 优先级 |
|------|-----------|-----------|---------|--------|
| **首页** | HomePage.tsx | HomePage.vue | ✅ 已迁移 | P0 |
| **拼音练习** | PinyinPracticePage.tsx | TypingPage.vue | ⚠️ 部分 | P0 |
| **指法练习** | TypingGamePage.tsx | ❌ 缺失 | ❌ 未迁移 | P0 |
| **游戏中心** | GameCenterPage.tsx | ❌ 缺失 | ❌ 未迁移 | P1 |
| **英语课程** | CoursesPage.tsx<br/>CourseLessonPractice.tsx<br/>CourseManager.tsx | ❌ 缺失 | ❌ 未迁移 | P0 |
| **AI 实验室** | AILabPage.tsx<br/>AICourseGenerator.tsx<br/>AudioCourseWizard.tsx | ❌ 缺失 | ❌ 未迁移 | P1 |
| **复习管理** | ReviewPage.tsx<br/>ReviewManager.tsx | ❌ 缺失 | ❌ 未迁移 | P1 |
| **学习记录** | HistoryPage.tsx | ❌ 缺失 | ❌ 未迁移 | P2 |
| **设置** | SettingsPage.tsx | SettingsPage.vue | ⚠️ 部分 | P1 |
| **键盘组件** | Keyboard.tsx | ❌ 缺失 | ❌ 未迁移 | P0 |
| **课程服务** | courseService.ts | ❌ 缺失 | ❌ 未迁移 | P0 |
| **AI 服务** | aiService.ts | ❌ 缺失 | ❌ 未迁移 | P1 |
| **复习服务** | reviewService.ts | ❌ 缺失 | ❌ 未迁移 | P1 |
| **数据库** | db/index.ts (Dexie) | ❌ 缺失 | ❌ 未迁移 | P0 |

---

## 3. 技术架构对比

### 3.1 框架差异

| 方面 | 旧代码 (React) | 新代码 (Vue 3) |
|------|---------------|---------------|
| **UI 框架** | React 18 | Vue 3 Composition API |
| **状态管理** | Zustand / Context | Pinia |
| **路由** | 手动切换 | Vue Router |
| **UI 组件库** | 自定义 + Tailwind | Element Plus + Tailwind |
| **表单处理** | 手动 | Element Plus Form |
| **样式方案** | Tailwind CSS | Tailwind CSS + SCSS |
| **类型系统** | TypeScript | TypeScript |
| **构建工具** | Vite | Vite |
| **Electron** | 原生集成 | Electron Forge |

### 3.2 架构模式对比

#### 旧代码架构（DDD 分层）

```
presentation layer  → ui/pages, ui/components
application layer   → application/ (services)
domain layer        → domain/ (models, entities)
infrastructure      → infrastructure/ (db, storage, api)
```

#### 新代码架构（Vue 生态）

```
视图层            → views/, components/
业务逻辑层         → stores/ (Pinia)
数据访问层         → services/, api/
共享层            → shared/
```

### 3.3 数据持久化对比

| 数据类型 | 旧代码方案 | 新代码方案 | 迁移难度 |
|---------|-----------|-----------|---------|
| 课程数据 | Dexie.js (IndexedDB) | ❌ 需实现 | 中 |
| 复习记录 | Dexie.js | ❌ 需实现 | 中 |
| 练习历史 | Dexie.js | ❌ 需实现 | 中 |
| 用户设置 | LocalStorage | Pinia + LocalStorage | 低 |
| 音频文件 | 本地文件系统 | 本地文件系统 | 低 |
| 课程包 | JSON 文件 | JSON 文件 | 低 |

---

## 4. 迁移策略

### 4.1 迁移原则

1. **功能优先原则**：优先迁移核心功能，确保基本可用
2. **渐进式迁移**：按模块逐步迁移，每个模块完成后立即可用
3. **保持兼容性**：数据格式保持兼容，支持旧版数据导入
4. **代码质量**：遵循 Vue 3 最佳实践和 Composition API 风格
5. **可测试性**：关键功能编写单元测试

### 4.2 迁移路径

```
阶段1: 核心基础设施
├── 数据库层（Dexie.js）
├── 服务层（课程/练习/复习服务）
└── 共享组件（键盘/统计/反馈）

阶段2: 核心练习功能
├── 指法练习
├── 英语课程系统
└── 课程练习组件

阶段3: AI 和游戏功能
├── AI 实验室
├── 游戏中心
└── 音频建课

阶段4: 复习和分析
├── 复习系统（SM-2）
├── 学习记录
└── 统计分析

阶段5: 高级功能
├── 课程仓库
├── 学习计划
├── AI 对话
└── 阶段评估
```

### 4.3 代码转换策略

#### React → Vue 组件转换模板

```typescript
// React 组件
export function MyComponent({ prop1, prop2 }: MyComponentProps) {
  const [state, setState] = useState(initialValue);
  
  useEffect(() => {
    // side effect
  }, [dependency]);
  
  const handleClick = () => {
    // handler
  };
  
  return <div>{/* JSX */}</div>;
}

// ↓ 转换为 ↓

// Vue 组件
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

interface Props {
  prop1: string;
  prop2: number;
}

const props = defineProps<Props>();
const state = ref(initialValue);

onMounted(() => {
  // side effect
});

watch(() => dependency, () => {
  // watch effect
});

const handleClick = () => {
  // handler
};
</script>

<template>
  <div><!-- Template --></div>
</template>
```

---

## 5. 详细迁移任务

### P0 - 立即实现（核心功能闭环）

#### 任务 1: 数据库基础设施
**预计工时**: 3天  
**实际工时**: 3天  
**状态**: ✅ 已完成

**子任务**:
- [x] 创建 `src/shared/database/index.ts` (Dexie 配置)
- [x] 定义数据表结构：courses, lessons, reviews, records
- [x] 实现 CRUD 基础操作
- [x] 编写数据迁移工具（旧数据导入）
- [ ] 单元测试

**文件清单**:
```
vue-app/src/shared/
├── database/
│   ├── index.ts              # Dexie 初始化 ✅
│   ├── repositories/
│   │   ├── courseRepository.ts    ✅
│   │   ├── reviewRepository.ts    ✅
│   │   └── commonRepository.ts    ✅
├── types/
│   ├── course.ts             # 课程类型定义 ✅
│   ├── review.ts             # 复习类型定义 ✅
│   └── common.ts             # 通用类型定义 ✅
└── utils/
    └── dataMigration.ts      # 数据迁移工具 ✅
```

**参考旧代码**:
- `src/infrastructure/persistence/database.ts` ✅
- `src/domain/course/CourseRepository.ts` ✅

**完成日期**: 2026-01-06

---

#### 任务 2: 指法练习功能迁移
**预计工时**: 4天

**子任务**:
- [ ] 创建 `FingerPracticePage.vue`
- [ ] 迁移键盘组件 `Keyboard.vue`
- [ ] 实现按键高亮逻辑
- [ ] 添加手指位置引导
- [ ] 练习统计和记录
- [ ] 难度选择界面

**文件清单**:
```
vue-app/src/renderer/
├── views/
│   └── FingerPracticePage.vue
├── components/
│   ├── keyboard/
│   │   ├── Keyboard.vue
│   │   ├── KeyboardKey.vue
│   │   └── HandGuide.vue
│   └── practice/
│       ├── PracticeStats.vue
│       └── PracticeHistory.vue
```

**参考旧代码**:
- `src/ui/pages/typing/TypingGamePage.tsx`
- `src/ui/components/Keyboard.tsx`

---

#### 任务 3: 英语课程系统迁移
**预计工时**: 7天

**子任务**:
- [ ] 课程服务层 `courseService.ts`
- [ ] 课程数据模型和类型定义
- [ ] 课程列表页面 `CoursesPage.vue`
- [ ] 课程详情页面 `CourseDetailPage.vue`
- [ ] 课程编辑器 `CourseEditor.vue`
- [ ] 课时练习组件 `LessonPractice.vue`
- [ ] 练习模式：听写/跟读/翻译/模仿
- [ ] 课程导入/导出功能

**文件清单**:
```
vue-app/src/
├── shared/
│   ├── services/
│   │   └── courseService.ts
│   └── types/
│       └── course.ts
├── renderer/
│   ├── views/
│   │   ├── CoursesPage.vue
│   │   ├── CourseDetailPage.vue
│   │   └── LessonPracticePage.vue
│   ├── components/
│   │   ├── course/
│   │   │   ├── CourseList.vue
│   │   │   ├── CourseCard.vue
│   │   │   ├── CourseEditor.vue
│   │   │   └── CourseImporter.vue
│   │   └── lesson/
│   │       ├── LessonPractice.vue
│   │       ├── DictationMode.vue
│   │       ├── FollowMode.vue
│   │       ├── TranslationMode.vue
│   │       └── ImitationMode.vue
│   └── stores/
│       └── courseStore.ts
```

**参考旧代码**:
- `src/ui/pages/courses/CoursesPage.tsx`
- `src/ui/components/CourseLessonPractice.tsx`
- `src/application/courseService.ts`
- `src/domain/course/`

---

#### 任务 4: 课程内容形态校验
**预计工时**: 2天

**子任务**:
- [ ] 定义内容形态规范（Word/Phrase/Sentence/Passage/Dialog）
- [ ] 实现字段校验逻辑
- [ ] 创建校验工具函数
- [ ] 在课程编辑器中集成校验
- [ ] 错误提示和修复建议

**文件清单**:
```
vue-app/src/shared/
├── validators/
│   ├── courseValidator.ts
│   ├── contentShapeValidator.ts
│   └── schemas/
│       ├── wordSchema.ts
│       ├── phraseSchema.ts
│       ├── sentenceSchema.ts
│       ├── passageSchema.ts
│       └── dialogSchema.ts
```

---

### P1 - 短期实现（听说读写完整覆盖）

#### 任务 5: 游戏中心迁移
**预计工时**: 5天

**子任务**:
- [ ] 游戏中心主页 `GameCenterPage.vue`
- [ ] 打字竞速游戏
- [ ] 单词连连看
- [ ] 拼写挑战
- [ ] 记忆卡片
- [ ] 成就系统
- [ ] 游戏统计

**文件清单**:
```
vue-app/src/renderer/
├── views/
│   ├── GameCenterPage.vue
│   └── games/
│       ├── TypingRaceGame.vue
│       ├── WordMatchGame.vue
│       ├── SpellingChallenge.vue
│       └── MemoryCardGame.vue
├── components/
│   └── game/
│       ├── GameCard.vue
│       ├── GameStats.vue
│       └── Achievement.vue
└── stores/
    └── gameStore.ts
```

**参考旧代码**:
- `src/ui/pages/games/`

---

#### 任务 6: AI 实验室迁移
**预计工时**: 6天

**子任务**:
- [ ] AI 配置管理
- [ ] AI 服务层 `aiService.ts`
- [ ] AI 课程生成器页面
- [ ] 音频建课向导
- [ ] 教材导入功能
- [ ] 生成历史记录
- [ ] 课程预览和编辑

**文件清单**:
```
vue-app/src/
├── shared/
│   ├── services/
│   │   └── aiService.ts
│   └── types/
│       └── ai.ts
├── renderer/
│   ├── views/
│   │   ├── AILabPage.vue
│   │   └── ai/
│   │       ├── CourseGeneratorPage.vue
│   │       ├── AudioWizardPage.vue
│   │       └── TextbookImportPage.vue
│   ├── components/
│   │   └── ai/
│   │       ├── GeneratorForm.vue
│   │       ├── AudioUploader.vue
│   │       ├── TaskHistory.vue
│   │       └── CoursePreview.vue
│   └── stores/
│       └── aiStore.ts
```

**参考旧代码**:
- `src/ui/pages/ailab/AILabPage.tsx`
- `src/ui/components/AICourseGenerator.tsx`
- `src/application/aiService.ts`

---

#### 任务 7: 复习系统迁移（SM-2算法）
**预计工时**: 4天

**子任务**:
- [ ] SM-2 算法实现
- [ ] 复习服务层 `reviewService.ts`
- [ ] 复习队列管理
- [ ] 复习页面 `ReviewPage.vue`
- [ ] 听写模式复习
- [ ] 闪卡模式复习
- [ ] 复习统计

**文件清单**:
```
vue-app/src/
├── shared/
│   ├── services/
│   │   └── reviewService.ts
│   ├── algorithms/
│   │   └── sm2.ts
│   └── types/
│       └── review.ts
├── renderer/
│   ├── views/
│   │   └── ReviewPage.vue
│   ├── components/
│   │   └── review/
│   │       ├── ReviewQueue.vue
│   │       ├── DictationReview.vue
│   │       ├── FlashcardReview.vue
│   │       └── ReviewStats.vue
│   └── stores/
│       └── reviewStore.ts
```

**参考旧代码**:
- `src/application/reviewService.ts`
- `src/domain/review/`
- `src/ui/pages/review/ReviewPage.tsx`

---

#### 任务 8: 组合练习编排
**预计工时**: 3天

**子任务**:
- [ ] 练习模板系统
- [ ] 模式组合配置
- [ ] 练习流程编排引擎
- [ ] 统一报告生成
- [ ] 模板管理界面

**文件清单**:
```
vue-app/src/
├── shared/
│   ├── services/
│   │   └── practiceService.ts
│   └── templates/
│       └── practiceTemplates.ts
├── renderer/
│   └── components/
│       └── practice/
│           ├── PracticeOrchestrator.vue
│           ├── TemplateSelector.vue
│           └── UnifiedReport.vue
```

---

### P2 - 中期实现（内容生产能力）

#### 任务 9: 音频导入建课
**预计工时**: 5天

**子任务**:
- [ ] 音频文件上传
- [ ] 音频分段工具
- [ ] 字幕生成/对齐
- [ ] 半自动校正界面
- [ ] 课时生成

**文件清单**:
```
vue-app/src/renderer/
├── views/
│   └── ai/
│       └── AudioImportWizard.vue
└── components/
    └── audio/
        ├── AudioUploader.vue
        ├── AudioSegmenter.vue
        ├── SubtitleEditor.vue
        └── AlignmentTool.vue
```

---

#### 任务 10: 教材导入建课
**预计工时**: 4天

**子任务**:
- [ ] 教材模板系统
- [ ] 出版社选择器
- [ ] 文本/PDF 导入
- [ ] 内容解析和提取
- [ ] 课程生成

**文件清单**:
```
vue-app/src/renderer/
├── views/
│   └── ai/
│       └── TextbookImportWizard.vue
└── components/
    └── textbook/
        ├── PublisherSelector.vue
        ├── TextbookSelector.vue
        ├── ContentExtractor.vue
        └── CourseGenerator.vue
```

---

### P3 - 长期实现（高级功能）

#### 任务 11: 课程仓库系统
**预计工时**: 6天

**子任务**:
- [ ] 课程仓库数据模型
- [ ] 预置课程库
- [ ] 课程仓库页面
- [ ] 课程搜索/筛选
- [ ] 课程订阅管理
- [ ] 课程评分和评论

---

#### 任务 12: 学习计划系统
**预计工时**: 7天

**子任务**:
- [ ] 学习计划数据模型
- [ ] 目标设定界面
- [ ] 学习路径配置
- [ ] 任务调度引擎
- [ ] 进度追踪
- [ ] 阶段性评估

---

#### 任务 13: AI 互动对话
**预计工时**: 6天

**子任务**:
- [ ] AI 场景生成
- [ ] 对话引擎
- [ ] 实时反馈机制
- [ ] 对话记录
- [ ] 场景评估

---

## 6. 开发计划与里程碑

### Sprint 规划（2周一迭代）

#### Sprint 1: 核心基础设施（第1-2周）

**目标**: 建立数据持久化和服务层基础

**任务**:
- ✅ 任务1: 数据库基础设施 (3天) - **已完成**
- ✅ 任务2: 指法练习功能 (4天) - **已完成**
- ✅ 任务3: 英语课程系统 (前3天) - **服务层已完成**

**交付物**:
- [x] Dexie 数据库完全可用
- [x] 数据仓库层实现（courseRepository, reviewRepository, commonRepository）
- [x] 服务层实现（courseService, reviewService, sm2Algorithm）
- [x] TypeScript 类型定义完整
- [x] Pinia 状态管理（courseStore, reviewStore）
- [ ] 指法练习完整可用

**验收标准**:
- [x] 所有数据操作通过类型检查
- [x] 数据库在应用启动时正确初始化
- [x] 课程可以正常增删改查
- [ ] 指法练习可以正常使用并保存记录

**实施日期**: 2026-01-06

---

#### Sprint 2: 英语课程系统（第3-4周）

**目标**: 完整的课程管理和练习功能

**任务**:
- ✅ 完成任务3: 英语课程系统 (4天)
- ✅ 任务4: 内容形态校验 (2天)
- ✅ 开始任务8: 组合练习编排 (2天)

**交付物**:
- [ ] 课程列表和详情页面
- [ ] 完整的课时练习功能
- [ ] 课程导入/导出
- [ ] 内容校验系统

**验收标准**:
- 可以创建、编辑、删除课程
- 支持4种练习模式（听写/跟读/翻译/模仿）
- 练习结果可以保存和查看
- 导入的课程内容通过校验

---

#### Sprint 3: 游戏和AI功能（第5-6周）

**目标**: 增加趣味性和AI能力

**任务**:
- ✅ 任务5: 游戏中心 (5天)
- ✅ 开始任务6: AI 实验室 (3天)

**交付物**:
- [ ] 至少3个游戏模式可玩
- [ ] AI 课程生成器可用
- [ ] 游戏成就系统

**验收标准**:
- 游戏可以正常游玩并统计成绩
- AI 可以生成可用的课程
- 成就系统正常工作

---

#### Sprint 4: AI和复习系统（第7-8周）

**目标**: 完善AI功能和复习系统

**任务**:
- ✅ 完成任务6: AI 实验室 (3天)
- ✅ 任务7: 复习系统 (4天)
- ✅ 完成任务8: 组合练习 (1天)

**交付物**:
- [ ] 音频建课功能
- [ ] 教材导入功能
- [ ] SM-2 复习系统
- [ ] 组合练习模板

**验收标准**:
- 可以从音频生成课程
- 可以从教材生成课程
- 复习队列正常工作
- 复习记录符合SM-2算法
- 组合练习流畅切换

---

#### Sprint 5-6: 高级功能（第9-12周）

**目标**: 完善高级功能

**任务**:
- 任务9: 音频导入建课
- 任务10: 教材导入建课
- 任务11: 课程仓库
- 任务12: 学习计划
- 任务13: AI 对话

**交付物**:
- [ ] 音频建课完整流程
- [ ] 教材导入完整流程
- [ ] 课程仓库系统
- [ ] 学习计划功能
- [ ] AI 互动对话

**验收标准**:
- 所有核心功能完整可用
- 产品达到可发布状态

---

## 7. 风险评估与应对

### 7.1 技术风险

| 风险项 | 影响 | 概率 | 应对策略 |
|-------|------|------|---------|
| Vue组件化重构复杂度高 | 高 | 中 | 逐模块迁移，及时测试 |
| Dexie数据库迁移兼容性 | 中 | 低 | 提供数据导入导出工具 |
| AI API 调用稳定性 | 中 | 中 | 添加重试机制和错误处理 |
| Electron IPC 通信问题 | 高 | 低 | 完善 preload 层设计 |
| 音频处理性能问题 | 中 | 中 | 使用 Web Worker |

### 7.2 进度风险

| 风险项 | 应对策略 |
|-------|---------|
| 需求变更频繁 | 敏捷开发，快速迭代 |
| 技术债务累积 | 代码审查，重构优化 |
| 测试覆盖不足 | 关键功能必须测试 |
| 文档更新滞后 | 开发同步更新文档 |

### 7.3 质量保证

**代码质量**:
- [ ] ESLint + Prettier 规范
- [ ] TypeScript 严格模式
- [ ] 组件复用率 > 60%
- [ ] 代码注释覆盖率 > 40%

**功能测试**:
- [ ] 核心功能单元测试
- [ ] E2E 测试覆盖主流程
- [ ] 手动测试用例清单
- [ ] 性能基准测试

---

## 8. 附录

### 8.1 命名规范

**文件命名**:
- 组件：`PascalCase.vue`
- 页面：`PascalCasePage.vue`
- 服务：`camelCaseService.ts`
- 类型：`camelCase.types.ts`
- Store：`camelCaseStore.ts`

**变量命名**:
- 组件 props：`camelCase`
- 事件：`on + PascalCase`
- 常量：`UPPER_SNAKE_CASE`
- 类型：`PascalCase`

### 8.2 目录结构规范

```
vue-app/src/
├── main/                    # Electron 主进程
├── preload/                 # Preload 脚本
├── renderer/                # 渲染进程
│   ├── views/              # 页面组件
│   ├── components/         # 可复用组件
│   ├── layouts/            # 布局组件
│   ├── stores/             # Pinia stores
│   ├── router/             # Vue Router
│   ├── composables/        # 组合式函数
│   ├── directives/         # 自定义指令
│   └── styles/             # 全局样式
└── shared/                  # 共享代码
    ├── types/              # TypeScript 类型
    ├── constants/          # 常量定义
    ├── utils/              # 工具函数
    ├── services/           # 业务服务
    ├── database/           # 数据库
    ├── validators/         # 校验器
    └── algorithms/         # 算法实现
```

### 8.3 Git 工作流

**分支策略**:
- `main`: 生产分支
- `develop`: 开发分支
- `feature/*`: 功能分支
- `fix/*`: 修复分支
- `refactor/*`: 重构分支

**提交规范**:
```
<type>(<scope>): <subject>

<body>

<footer>
```

类型：
- `feat`: 新功能
- `fix`: 修复
- `docs`: 文档
- `style`: 格式
- `refactor`: 重构
- `test`: 测试
- `chore`: 构建

---

## 总结

本迁移计划涵盖了从 React 到 Vue 3 的完整功能迁移路径，按照 P0/P1/P2/P3 优先级划分，预计 12 周完成核心功能迁移。

**关键里程碑**:
- ✅ Week 2: 基础设施和指法练习
- ✅ Week 4: 英语课程系统完整可用
- ✅ Week 6: 游戏和AI基础功能
- ✅ Week 8: 复习系统和组合练习
- ✅ Week 12: 所有核心功能完成

**下一步行动**:
1. 确认迁移优先级
2. 开始 Sprint 1 任务执行
3. 建立每周进度同步机制
4. 持续更新本文档
