# 课程系统迁移和重构分析报告

**日期**: 2026-01-07  
**任务**: 课程编辑、游戏模块迁移及课程仓库功能增强

## 1. 老代码分析（src/ 目录）

### 1.1 课程编辑功能分析

#### 核心文件
- **主文件**: `src_bak/components/CourseEditor.tsx` (1273行)
- **管理器**: `src_bak/components/CourseManager.tsx` (1327行)
- **数据模型**: `src_bak/models/course.ts`
- **存储服务**: `src_bak/services/courseStore.ts`

#### 课程编辑器功能详解

**1. 课程元数据管理**
- 标题、描述、类型（text/words/mixed）
- 难度等级（beginner/intermediate/advanced/custom）
- 标签系统
- 课程来源追踪

**2. 课时列表管理**
- 课时增删改查
- 课时排序
- 课时类型：句子模式 / 词汇模式
- 练习模式启用：听写、跟读、翻译、模仿

**3. 句子模式编辑器**
- 智能分句功能 (`splitIntoSentences`)
- AI 自动翻译和关键词提取
- 句子标签系统（重点句/难点句/范文句）
- 音频 URL 管理和预览播放
- 音频生成状态统计

**4. 词汇模式编辑器**
- 单词列表编辑（拼写、音标、释义、翻译）
- AI 解析单词功能
- AI 生成例句
- 例句音频管理
- 分页控制（每页10条）

**5. 音频批量生成**
- 基于 TTS 的音频批量生成
- 进度实时展示
- 可取消操作
- 支持仅生成缺失音频或全量覆盖

**6. 导入导出功能**
- JSON 格式导入
- 格式校验和错误提示
- 课程导出

#### 课程管理器功能详解

**1. 课程列表展示**
- 筛选功能：
  - 搜索框（标题）
  - 难度筛选
  - 类型筛选
  - 标签筛选
- 排序功能：按日期/标题等
- 分页显示（每页10条）

**2. 批量操作**
- 多选课程
- 批量删除
- 批量导出

**3. 单条操作**
- 编辑课程
- 删除课程
- 预览/详情查看
- 开始练习

**4. 课程导入**
- CourseImportWizard: JSON导入向导
- CourseSystemBuilder: 课程系统构建器
- AudioCourseWizard: 音频课程向导

**5. 练习模式**
- 统一练习弹窗（UnifiedPracticeModal）
- 听写模式（DictationModal）
- 课时练习（CourseLessonPractice）
- 播放列表播放（PlaylistPlayer）

### 1.2 游戏模块分析

#### 游戏列表（共7个游戏）

**位置**: `src_bak/components/games/`

1. **FlightGame.tsx** - 飞行模式游戏
   - 单词从右到左飞行
   - 三个难度等级（初级/中级/高级）
   - 燃料系统和得分机制
   - 速度递增机制

2. **WordChallenge.tsx** - 单词挑战
   - 60秒限时挑战
   - 快速输入单词得分

3. **ComboGame.tsx** - 连击风暴
   - 保持连击不断
   - 错误重置连击数
   - 分数加成系统

4. **DungeonTyper.tsx** - 地牢打字师
   - 打字魔法战斗
   - 怪物击败机制

5. **WordFarm.tsx** - 单词农场
   - 种植单词收获
   - 农场经营元素

6. **TypingRacer.tsx** - 打字赛车
   - 竞速打字
   - 速度排名

7. **RhythmKey.tsx** - 节奏打字
   - 音乐节奏配合
   - 节奏感训练

#### 游戏框架

**GameCenter组件** (`src_bak/components/GameCenter.tsx`)
- 游戏卡片展示
- 国际化支持 (i18n)
- 插件注册系统 (`pluginRegistry`)

**游戏注册** (`src_bak/config/gamePlugins.ts`)
```typescript
pluginRegistry.registerGame({
  id: 'flight',
  titleKey: 'game.flight.title',
  descKey: 'game.flight.desc',
  icon: '✈️',
  color: 'bg-blue-100 hover:bg-blue-200',
  component: FlightGame,
});
```

**国际化支持**
- 中文: `src_bak/i18n/zh.json`
- 英文: `src_bak/i18n/en.json`
- 所有游戏文本都有完整翻译

#### 游戏共通特性
- 音效管理 (`soundManager`)
- 复习服务集成 (`reviewService`)
- 得分统计
- 难度调整
- 重玩机制

### 1.3 导航系统分析

#### 老代码导航 (`src_bak/components/Navigation.tsx`)

**导航项**:
1. 首页 (home)
2. 指法练习 (finger)
3. 打字练习 (typing)
4. 课程管理 (courses)
5. 游戏中心 (games)
6. AI 实验室 (ai)
7. 复习系统 (review)
8. 学习历史 (history)
9. 设置 (settings)
10. 任务中心 (tasks)

**特性**:
- 侧边栏折叠功能
- 图标 + 文字显示
- 当前页面高亮
- 暗黑模式支持

## 2. 新代码分析（vue-app/ 目录）

### 2.1 当前课程功能实现

#### 核心文件
- **课程存储**: `vue-app/src/shared/services/courseService.ts`
- **课程Store**: `vue-app/src/renderer/stores/courseStore.ts`
- **课程类型**: `vue-app/src/shared/types/course.ts`
- **数据库**: `vue-app/src/shared/database/index.ts` (Dexie.js)

#### 已实现功能
- 课程CRUD操作
- 课程导入导出
- 课程分类和筛选
- 学习进度记录
- 练习记录统计

#### 缺失功能
- ❌ 完整的课程编辑器
- ❌ 课时详细编辑功能
- ❌ 音频批量生成
- ❌ AI 辅助功能（翻译、关键词提取）
- ❌ 课程仓库管理界面

### 2.2 当前游戏功能实现

#### 已实现游戏（vue-app/src/renderer/components/games/）
1. **KeyboardSpeedGame.vue** - 键盘速度游戏
2. **PinyinMatchGame.vue** - 拼音匹配游戏
3. **WordChallengeGame.vue** - 单词挑战游戏（简化版）

#### 缺失游戏
- ❌ FlightGame（飞行模式）
- ❌ ComboGame（连击风暴）
- ❌ DungeonTyper（地牢打字师）
- ❌ WordFarm（单词农场）
- ❌ TypingRacer（打字赛车）
- ❌ RhythmKey（节奏打字）

### 2.3 当前导航系统

#### MainLayout组件 (`vue-app/src/renderer/layouts/MainLayout.vue`)

**导航项**:
1. 首页 (/)
2. 课程 (/courses)
3. 打字练习 (/typing)
4. 拼音学习 (/pinyin)
5. 游戏 (/games)
6. 复习 (/review)
7. AI 实验室 (/ailab)
8. 学习历史 (/history)
9. 数据迁移 (/migration)
10. AI 助手 (/ai)

**特性**:
- Element Plus 菜单组件
- 侧边栏折叠
- 主题切换（蓝色/浅色/暗黑）
- 路由集成

#### 导航问题分析
1. **功能重复**:
   - "AI 实验室" 和 "AI 助手" 功能可能重叠
   - "数据迁移" 应该是一次性工具，不应常驻导航
   
2. **缺失功能**:
   - 无指法练习入口
   - 无设置页面入口
   - 无任务中心

3. **组织不清晰**:
   - 学习类（课程、打字、拼音、游戏）
   - 工具类（AI、复习、历史）
   - 管理类（设置、迁移）
   混在一起，缺乏分组

## 3. 功能差异对比

### 3.1 课程系统差异

| 功能 | 老代码 | 新代码 | 状态 |
|------|--------|--------|------|
| 课程列表展示 | ✅ 完整 | ✅ 基础 | 需增强 |
| 课程筛选 | ✅ 多维度 | ✅ 基础 | 需增强 |
| 课程编辑器 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 课时编辑 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 句子模式 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 词汇模式 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| AI 翻译 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| AI 解析词汇 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 音频生成 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 音频预览 | ✅ 完整 | ❌ 缺失 | **需迁移** |
| 批量操作 | ✅ 完整 | ⚠️ 部分 | 需完善 |
| 导入导出 | ✅ 完整 | ✅ 基础 | 需增强 |
| 课程仓库 | ❌ 无 | ❌ 无 | **需新建** |
| 学习列表 | ❌ 无 | ⚠️ 部分 | **需新建** |
| 学习进度 | ⚠️ 简单 | ✅ 完整 | - |

### 3.2 游戏模块差异

| 游戏 | 老代码 | 新代码 | 状态 |
|------|--------|--------|------|
| FlightGame | ✅ 完整 | ❌ 无 | **需迁移** |
| WordChallenge | ✅ 完整 | ⚠️ 简化版 | 需完善 |
| ComboGame | ✅ 完整 | ❌ 无 | **需迁移** |
| DungeonTyper | ✅ 完整 | ❌ 无 | **需迁移** |
| WordFarm | ✅ 完整 | ❌ 无 | **需迁移** |
| TypingRacer | ✅ 完整 | ❌ 无 | **需迁移** |
| RhythmKey | ✅ 完整 | ❌ 无 | **需迁移** |
| KeyboardSpeed | ❌ 无 | ✅ 完整 | - |
| PinyinMatch | ❌ 无 | ✅ 完整 | - |

## 4. 新增需求分析

### 4.1 课程仓库功能

**需求**:
- 所有生成的课程都可在仓库中可见
- 列表形式展示
- 条件过滤（来源、类型、难度、标签等）
- 多选加入学习列表
- 批量操作：删除、导出、导入
- 单条操作：编辑、浏览、删除

**设计方案**:
```
CourseRepositoryPage
├── FilterPanel（筛选面板）
│   ├── 来源筛选（AI生成/用户创建/导入/音频导入等）
│   ├── 类型筛选（text/words/mixed）
│   ├── 难度筛选（beginner/intermediate/advanced/custom）
│   ├── 标签筛选（多选）
│   └── 搜索框
├── Toolbar（工具栏）
│   ├── 批量选择
│   ├── 批量删除
│   ├── 批量导出
│   ├── 导入课程
│   ├── 加入学习列表
│   └── 视图切换（卡片/列表/表格）
├── CourseList（课程列表）
│   └── CourseCard（课程卡片）
│       ├── 课程信息
│       ├── 来源标识
│       ├── 权限图标
│       ├── 操作按钮
│       └── 选择框
└── Pagination（分页）
```

**数据模型增强**:
```typescript
interface CourseSource {
  type: 'ai_generated' | 'user_created' | 'imported' | 'audio_import' | 'material_parsed';
  metadata?: {
    generator?: string;
    importedFrom?: string;
    audioFile?: string;
    materialTitle?: string;
  };
  createdAt: string;
}

interface CourseRepository {
  id: string;
  course: Course;
  source: CourseSource;
  inLearningList: boolean;
  addedToListAt?: string;
}
```

### 4.2 个人学习课程列表功能

**需求**:
- 列出加入的学习课程
- 显示学习进度
- 提供操作：删除、学习、复习

**设计方案**:
```
MyLearningPage
├── LearningStats（学习统计）
│   ├── 总课程数
│   ├── 进行中课程
│   ├── 已完成课程
│   └── 学习时长
├── CourseList（课程列表）
│   └── LearningCourseCard（学习课程卡片）
│       ├── 课程信息
│       ├── 进度条
│       ├── 学习状态
│       ├── 最后学习时间
│       └── 操作按钮
│           ├── 继续学习
│           ├── 复习
│           ├── 查看详情
│           └── 移除
└── FilterTabs（筛选标签）
    ├── 全部
    ├── 进行中
    ├── 已完成
    └── 待复习
```

**数据模型**:
```typescript
interface LearningCourse {
  id: string;
  courseId: string;
  addedAt: string;
  lastStudiedAt?: string;
  progress: {
    completedLessons: string[];
    totalLessons: number;
    percent: number;
  };
  stats: {
    totalPracticeCount: number;
    totalPracticeTime: number; // seconds
    avgAccuracy: number;
    avgWpm: number;
  };
  status: 'not_started' | 'in_progress' | 'completed' | 'review_due';
  nextReviewDate?: string;
}
```

### 4.3 导航优化建议

**当前问题**:
1. 导航项过多（10项）
2. 功能分类不清晰
3. 临时工具常驻导航
4. 部分功能重复

**优化方案**:

**方案A: 功能分组（推荐）**
```
📚 学习中心
  ├── 首页
  ├── 我的课程（学习列表）
  ├── 课程仓库（所有课程）
  ├── 打字练习
  └── 拼音学习

🎮 游戏中心
  └── 趣味游戏

📖 复习系统
  └── 间隔复习

🤖 AI 工具
  ├── AI 实验室（生成课程）
  └── AI 助手（对话帮助）

📊 数据中心
  └── 学习历史

⚙️ 更多
  ├── 设置
  └── 数据迁移（一次性工具）
```

**方案B: 扁平化简化（备选）**
```
1. 首页
2. 我的学习（学习列表）
3. 课程仓库
4. 练习中心（打字+拼音）
5. 游戏
6. 复习
7. AI 工具
8. 历史
9. 设置
```

**合并建议**:
- "AI 实验室" + "AI 助手" → "AI 工具"
- "打字练习" + "拼音学习" → "练习中心"（可选）
- "数据迁移" → 移到设置页面
- 新增 "我的学习" 和 "课程仓库" 分离

## 5. 实施计划

### Phase 1: 课程编辑器迁移（5-7天）

**任务清单**:
- [ ] 迁移 CourseEditor 组件到 Vue 3
  - [ ] 课程元数据编辑
  - [ ] 课时列表管理
  - [ ] 句子模式编辑器
  - [ ] 词汇模式编辑器
  - [ ] 音频预览播放
- [ ] 迁移 AI 服务
  - [ ] AI 翻译服务
  - [ ] AI 词汇提取服务
  - [ ] AI 例句生成服务
- [ ] 迁移音频生成服务
  - [ ] TTS 批量生成
  - [ ] 进度展示
  - [ ] 取消机制
- [ ] 集成到课程管理
  - [ ] 编辑入口
  - [ ] 权限检查
  - [ ] 保存流程

**关键文件**:
- `vue-app/src/renderer/views/CourseEditorPage.vue` (新建)
- `vue-app/src/renderer/components/course-editor/` (新建目录)
  - `MetadataEditor.vue`
  - `LessonList.vue`
  - `SentenceEditor.vue`
  - `WordEditor.vue`
  - `AudioGenerator.vue`

### Phase 2: 游戏模块迁移（3-4天）

**任务清单**:
- [ ] 迁移游戏组件到 Vue 3
  - [ ] FlightGame.vue
  - [ ] ComboGame.vue
  - [ ] DungeonTyper.vue
  - [ ] WordFarm.vue
  - [ ] TypingRacer.vue
  - [ ] RhythmKey.vue
- [ ] 完善 WordChallengeGame.vue
- [ ] 更新游戏注册机制
- [ ] 迁移音效系统
- [ ] 集成复习服务

**关键文件**:
- `vue-app/src/renderer/components/games/` (扩展)
- `vue-app/src/shared/services/gameRegistry.ts` (新建)
- `vue-app/src/shared/services/soundManager.ts` (新建)

### Phase 3: 课程仓库功能（4-5天）

**任务清单**:
- [ ] 设计课程仓库数据模型
- [ ] 创建 CourseRepositoryPage 页面
- [ ] 实现筛选功能
  - [ ] 来源筛选
  - [ ] 类型筛选
  - [ ] 难度筛选
  - [ ] 标签筛选
  - [ ] 搜索功能
- [ ] 实现批量操作
  - [ ] 多选功能
  - [ ] 批量删除
  - [ ] 批量导出
  - [ ] 加入学习列表
- [ ] 实现单条操作
  - [ ] 编辑课程
  - [ ] 浏览预览
  - [ ] 删除课程
- [ ] 完善导入功能
  - [ ] 格式校验
  - [ ] 错误提示
  - [ ] 导入向导

**关键文件**:
- `vue-app/src/renderer/views/CourseRepositoryPage.vue` (新建)
- `vue-app/src/renderer/components/course-repository/` (新建目录)
  - `FilterPanel.vue`
  - `CourseCard.vue`
  - `BatchOperationBar.vue`
- `vue-app/src/shared/services/courseRepository.ts` (新建)

### Phase 4: 个人学习列表（2-3天）

**任务清单**:
- [ ] 设计学习课程数据模型
- [ ] 创建 MyLearningPage 页面
- [ ] 实现学习统计面板
- [ ] 实现课程列表
  - [ ] 进度显示
  - [ ] 状态标识
  - [ ] 排序功能
- [ ] 实现操作功能
  - [ ] 继续学习
  - [ ] 复习提醒
  - [ ] 移除课程
- [ ] 状态筛选
  - [ ] 全部
  - [ ] 进行中
  - [ ] 已完成
  - [ ] 待复习

**关键文件**:
- `vue-app/src/renderer/views/MyLearningPage.vue` (新建)
- `vue-app/src/renderer/components/learning/` (新建目录)
  - `LearningStats.vue`
  - `LearningCourseCard.vue`
- `vue-app/src/shared/services/learningService.ts` (新建)

### Phase 5: 导航优化（1-2天）

**任务清单**:
- [ ] 分析当前导航使用情况
- [ ] 设计新导航结构
- [ ] 更新 MainLayout 组件
- [ ] 调整路由配置
- [ ] 添加功能分组
- [ ] 移除/隐藏临时工具
- [ ] 更新菜单图标和文案
- [ ] 测试导航流畅性

**关键文件**:
- `vue-app/src/renderer/layouts/MainLayout.vue` (修改)
- `vue-app/src/renderer/router/index.ts` (修改)

## 6. 技术注意事项

### 6.1 React到Vue迁移要点

1. **状态管理**:
   - React `useState` → Vue `ref`/`reactive`
   - React `useEffect` → Vue `watch`/`watchEffect`
   - React `useRef` → Vue `ref` (DOM ref)

2. **组件通信**:
   - Props: 相似，但Vue需要`defineProps`
   - Events: `onXxx` → `@xxx` / `emit`
   - Context: 使用 Pinia store

3. **生命周期**:
   - `useEffect(() => {}, [])` → `onMounted`
   - `useEffect(() => {...}, [deps])` → `watch`
   - `useEffect(() => () => cleanup)` → `onUnmounted`

4. **条件渲染**:
   - `{condition && <Component />}` → `v-if`
   - `{condition ? <A /> : <B />}` → `v-if` + `v-else`

5. **列表渲染**:
   - `{array.map(item => <Item />)}` → `v-for`

### 6.2 Element Plus组件使用

- `el-form` 表单管理
- `el-table` 表格组件
- `el-card` 卡片组件
- `el-dialog` 对话框
- `el-dropdown` 下拉菜单
- `el-tag` 标签
- `el-progress` 进度条
- `el-pagination` 分页

### 6.3 性能优化

1. **虚拟滚动**: 课程列表超过100项时使用
2. **懒加载**: 游戏组件按需加载
3. **防抖节流**: 搜索输入、音频预览
4. **缓存策略**: 课程数据、音频资源

### 6.4 代码规范

1. **命名约定**:
   - 组件: PascalCase
   - Composables: useCamelCase
   - 文件: kebab-case.vue

2. **注释规范**:
   - 所有注释使用中文
   - 组件顶部添加功能说明
   - 复杂逻辑添加详细注释

3. **类型安全**:
   - 所有props定义类型
   - 所有API响应定义接口
   - 避免使用`any`

## 7. 测试计划

### 7.1 单元测试
- [ ] 课程编辑器核心功能
- [ ] 音频生成服务
- [ ] AI 服务调用
- [ ] 数据模型转换

### 7.2 集成测试
- [ ] 课程创建流程
- [ ] 课程编辑流程
- [ ] 导入导出流程
- [ ] 学习列表管理

### 7.3 用户测试
- [ ] 课程编辑易用性
- [ ] 游戏可玩性
- [ ] 导航清晰度
- [ ] 整体流畅度

## 8. 风险评估

### 高风险
- **音频生成服务迁移**: 涉及复杂的异步流程和文件操作
- **AI 服务集成**: API调用和错误处理
- **数据兼容性**: 老数据格式转换

### 中风险
- **游戏逻辑迁移**: 动画和交互逻辑复杂
- **组件重构**: React到Vue的架构差异

### 低风险
- **UI组件迁移**: 使用Element Plus简化开发
- **导航优化**: 主要是结构调整

## 9. 后续优化方向

1. **课程模板系统**: 提供常用课程模板
2. **协作分享**: 课程分享和协作编辑
3. **数据分析**: 详细的学习数据分析和可视化
4. **智能推荐**: 基于学习情况推荐课程和练习
5. **多语言支持**: 完整的国际化
6. **云同步**: 跨设备数据同步

## 10. 结论

本次迁移和重构将显著提升课程管理系统的功能完整性和用户体验。通过分阶段实施，可以确保每个模块都经过充分测试，同时保持系统的稳定性。

**预计总工期**: 15-21天  
**关键里程碑**:
- Day 7: 课程编辑器完成
- Day 11: 游戏模块完成
- Day 16: 课程仓库完成
- Day 19: 学习列表完成
- Day 21: 导航优化和测试完成

---

**文档状态**: 初版  
**下一步**: 开始Phase 1实施
