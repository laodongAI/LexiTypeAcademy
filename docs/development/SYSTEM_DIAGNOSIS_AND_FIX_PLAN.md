# LexiType Academy 系统问题诊断与修复计划

**日期**: 2025-12-09  
**状态**: 🔴 紧急修复中  
**优先级**: P0 - 核心功能缺失

---

## 🚨 核心问题汇总

### 1. AI 实验室问题

#### 1.1 任务列表丢失
**现状**: AI Lab 应该有任务列表展示，但当前缺失  
**预期**: 
- 显示所有 AI 生成任务（进行中、已完成、失败）
- 每个任务显示进度、状态、结果
- 支持查看、编辑、删除任务

**问题定位**:
- [ ] 检查 AILabPage.tsx 是否有任务列表UI
- [ ] 检查任务数据是否正确存储在 IndexedDB (aiLabTasks 表)
- [ ] 检查任务状态更新逻辑

#### 1.2 课程编辑功能缺失
**现状**: 生成的课程无法编辑  
**预期**: 
- 点击任务结果可以进入课程编辑器
- 可以修改课程标题、描述、难度
- 可以编辑、删除、重排 lessons
- 保存后更新到数据库

**问题定位**:
- [ ] 检查是否有 CourseEditorPage 组件
- [ ] 检查路由是否配置课程编辑页面
- [ ] 检查课程保存逻辑

#### 1.3 AI 模型设置缺失
**现状**: 设置页面没有 AI 模型选择  
**预期**:
- 可以选择默认 AI 提供商（OpenAI / Anthropic / 豆包等）
- 配置 API Key
- 设置默认模型（GPT-4 / Claude / 豆包）
- 保存到用户配置

**问题定位**:
- [ ] 检查 SettingsPage 是否有 AI 配置区域
- [ ] 检查配置存储位置（localStorage / electron-store）
- [ ] 检查 AI 服务是否读取配置

---

### 2. 英语课程页面问题

#### 2.1 课程列表界面混乱
**现状**: 只显示卡片，缺少筛选、排序、分类  
**预期** (基于需求文档 english-learning-requirements-v0.4.0.md):
- **左侧边栏**: 课程分类（全部、我的创作、AI生成、系统预设、已归档）
- **顶部工具栏**: 搜索、筛选（难度、CEFR、标签）、排序（创建时间、名称、进度）、视图切换（卡片/列表/表格）
- **批量操作**: 多选、批量删除、批量导出
- **课程卡片**: 显示进度条、来源标识、权限徽章

**问题定位**:
- [ ] CoursesPage.tsx 缺少侧边栏布局
- [ ] 缺少高级筛选组件
- [ ] 缺少批量操作工具栏
- [ ] 缺少视图切换功能

#### 2.2 学习功能缺失
**现状**: 需求文档定义了多个学习模块未实现  
**预期模块** (需求文档 Section 3):
- [x] 3.1 跟读模式（Follow-Along Practice）- 已实现
- [ ] 3.2 听写模式（Dictation）- 未实现
- [ ] 3.3 补救课程生成（Remediation Course）- 部分实现
- [ ] 3.4 复习模块（Review System）- 未实现
- [ ] 3.5 学习进度可视化（Progress Tracking）- 未实现
- [ ] 3.6 多维度评测（Assessment）- 未实现

**问题定位**:
- [ ] 检查是否有 DictationPracticePage
- [ ] 检查是否有 ReviewPage
- [ ] 检查是否有 ProgressPage
- [ ] 检查是否有评测报告组件

#### 2.3 课程数据读取错误
**现状**: "所有课程都是同一句话"  
**可能原因**:
1. 数据库读取逻辑错误（读取了错误的 lesson）
2. 课程 lessons 数组存储格式错误
3. 组件渲染时使用了固定索引

**问题定位**:
```typescript
// 需要检查的地方：
// 1. CoursesPage.tsx loadCourses() 函数
// 2. FollowAlongPracticePage.tsx 课程数据加载
// 3. LexiTypeDB courses 表数据完整性
```

---

### 3. 数据迁移问题

#### 3.1 旧课程数据未迁移
**现状**: 旧系统课程数据和文件未迁移到新系统  
**需要检查**:
- [ ] 旧数据位置：`data/courses/` 目录下的课程文件
- [ ] 旧音频位置：`data/audio/` 目录下的音频文件
- [ ] 是否有迁移脚本：`src/infrastructure/migration/`
- [ ] 新数据库schema是否兼容旧数据

#### 3.2 存储结构变化
**对比**:

| 项目 | 旧系统 | 新系统 | 迁移状态 |
|------|--------|--------|----------|
| 课程存储 | 文件系统 JSON | IndexedDB courses表 | ⚠️ 部分迁移 |
| 音频文件 | `data/audio/{courseId}/` | 同左 | ✅ 未变化 |
| 学习记录 | localStorage | IndexedDB learningRecords | ❌ 未迁移 |
| 用户设置 | electron-store | localStorage | ⚠️ 混乱 |

**问题定位**:
- [ ] 检查 courseMigration.ts 是否完整
- [ ] 检查是否有数据验证逻辑
- [ ] 检查旧数据备份机制

---

## 🔧 修复优先级

### P0 - 立即修复（阻塞使用）
1. **课程数据读取错误** - 影响所有课程学习
2. **AI Lab 任务列表** - AI 功能完全不可用
3. **AI 模型设置** - AI 功能无法配置

### P1 - 高优先级（1-2天）
4. **课程编辑功能** - AI 生成结果无法调整
5. **课程列表界面重构** - 用户体验极差
6. **数据迁移脚本** - 旧用户数据丢失

### P2 - 中优先级（3-5天）
7. **听写模式** - 核心学习功能缺失
8. **复习模块** - 学习闭环不完整
9. **进度可视化** - 无学习动力

### P3 - 低优先级（迭代优化）
10. **多维度评测**
11. **成就系统**
12. **社交分享**

---

## 📋 详细修复计划

### Phase 1: 紧急修复（今天完成）

#### Task 1.1: 修复课程数据读取
**文件**: `src/ui/pages/courses/CoursesPage.tsx`

**检查点**:
```typescript
// 1. loadCourses() 是否正确读取所有 lessons
const loadCourses = async () => {
  const db = new LexiTypeDB();
  const allCourses = await db.courses.toArray();
  console.log('Loaded courses:', allCourses.map(c => ({
    id: c.id,
    title: c.title,
    lessonCount: c.lessons?.length
  })));
  setCourses(allCourses);
};

// 2. 检查 lessons 数据结构
// 期望: course.lessons = [{id, content, contentTranslation, ...}, ...]
// 实际: ？
```

**修复步骤**:
1. [ ] 添加数据加载日志
2. [ ] 验证 lessons 数组完整性
3. [ ] 修复 lesson 索引逻辑
4. [ ] 测试多个课程切换

#### Task 1.2: 实现 AI Lab 任务列表
**文件**: `src/ui/pages/ailab/AILabPage.tsx`

**需要添加**:
```tsx
// 1. 任务列表状态
const [tasks, setTasks] = useState<AILabTask[]>([]);

// 2. 加载任务
useEffect(() => {
  loadTasks();
}, []);

const loadTasks = async () => {
  const db = new LexiTypeDB();
  const allTasks = await db.aiLabTasks.orderBy('createdAt').reverse().toArray();
  setTasks(allTasks);
};

// 3. 任务列表 UI
return (
  <div className="task-list">
    {tasks.map(task => (
      <TaskCard 
        key={task.id}
        task={task}
        onView={() => handleViewTask(task)}
        onEdit={() => handleEditCourse(task.result?.courseId)}
        onDelete={() => handleDeleteTask(task.id)}
      />
    ))}
  </div>
);
```

#### Task 1.3: 添加 AI 模型设置
**文件**: `src/ui/pages/settings/SettingsPage.tsx`

**需要添加**:
```tsx
// AI 配置区域
<div className="ai-settings-section">
  <h3>AI 模型配置</h3>
  
  <select value={aiProvider} onChange={handleProviderChange}>
    <option value="openai">OpenAI (GPT-4)</option>
    <option value="anthropic">Anthropic (Claude)</option>
    <option value="doubao">字节豆包</option>
  </select>
  
  <input 
    type="password"
    placeholder="API Key"
    value={apiKey}
    onChange={handleApiKeyChange}
  />
  
  <select value={defaultModel}>
    <option value="gpt-4">GPT-4</option>
    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
  </select>
</div>
```

---

### Phase 2: 核心功能补全（2-3天）

#### Task 2.1: 课程编辑器
**新文件**: `src/ui/pages/courses/CourseEditorPage.tsx`

**功能清单**:
- [ ] 课程基本信息编辑（标题、描述、难度、标签）
- [ ] Lessons 列表管理（添加、删除、重排序）
- [ ] 单个 Lesson 编辑（内容、翻译、词汇）
- [ ] 保存到数据库
- [ ] 路由配置

**集成点**:
1. **从 AI Lab 任务跳转**:
   - TaskHistoryPage → 点击任务结果 → CourseEditorPage
   - 传递参数: `courseId` 或 `task.result.courseId`
   
2. **从课程列表跳转**:
   - CoursesPage → 点击课程卡片"编辑"按钮 → CourseEditorPage
   - 需要权限检查: `canEditCourse(course)`

3. **路由配置**:
   ```typescript
   // App.tsx 或 Router 中添加:
   case 'course-editor':
     return <CourseEditorPage courseId={pageData.courseId} onBack={...} />
   ```

#### Task 2.2: 课程列表重构
**修改文件**: `src/ui/pages/courses/CoursesPage.tsx`

**新增组件**:
```
CoursesPage/
├── Sidebar.tsx (分类导航)
├── FilterPanel.tsx (高级筛选)
├── Toolbar.tsx (搜索、排序、视图切换)
├── CourseCard.tsx (卡片视图)
├── CourseListItem.tsx (列表视图)
├── CourseTable.tsx (表格视图)
└── BatchOperationBar.tsx (批量操作)
```

#### Task 2.3: 数据迁移
**修改文件**: `src/infrastructure/migration/courseMigration.ts`

**步骤**:
1. [ ] 扫描 `data/courses/` 目录 (通过 Electron IPC)
2. [ ] 读取每个课程 JSON 文件
3. [ ] 转换为新格式（添加 source, sourceType, permissions 等字段）
4. [ ] 转换音频路径 (`data/audio/course_xxx/` → 保持或更新)
5. [ ] 写入 IndexedDB courses 表
6. [ ] 迁移学习记录: localStorage → IndexedDB learningRecords
7. [ ] 验证数据完整性 (检查 lessons 数组、音频文件存在性)
8. [ ] 生成迁移报告 (成功/失败/跳过数量)

**触发方式**:
- **选项 A**: 首次启动检测 IndexedDB 为空时自动弹出迁移提示
- **选项 B**: 设置页面添加"数据迁移"按钮,手动触发
- **选项 C**: MigrationPage 独立页面 (已实现,需要添加入口)

**注意事项**:
- 迁移前备份旧数据到 `data/backup/`
- 音频文件不移动,只更新路径引用
- 支持增量迁移 (跳过已存在的课程)

---

### Phase 3: 学习功能补全（3-5天）

#### Task 3.1: 听写模式
**新文件**: `src/ui/pages/practice/DictationPracticePage.tsx`
- [ ] 播放音频
- [ ] 用户输入文本
- [ ] ASR 识别比对
- [ ] 评分反馈

#### Task 3.2: 复习模块
**新文件**: `src/ui/pages/review/ReviewPage.tsx`
- [ ] 间隔重复算法（SM-2）
- [ ] 今日待复习列表
- [ ] 复习进度跟踪
- [ ] 复习历史

#### Task 3.3: 进度可视化
**新文件**: `src/ui/pages/progress/ProgressPage.tsx`
- [ ] 总体进度仪表盘
- [ ] 课程完成情况
- [ ] 每日学习热力图
- [ ] 技能雷达图

---

## 🎯 成功标准

### 修复验证清单

#### AI 实验室
- [ ] 可以看到所有历史任务
- [ ] 任务显示正确的状态和进度
- [ ] 点击任务可以查看生成的课程
- [ ] 可以编辑生成的课程 (跳转到 CourseEditorPage)
- [ ] AI 模型可以在设置中配置
- [ ] 任务列表可以筛选 (全部/进行中/已完成/失败)
- [ ] 可以暂停/恢复/取消任务

#### 英语课程
- [ ] 课程列表显示所有课程，每个课程 lessons 不同
- [ ] 有侧边栏分类导航 (全部/我的创作/AI生成/系统预设)
- [ ] 有搜索和筛选功能 (难度/CEFR/标签)
- [ ] 进入课程学习，每句话都不一样 (✅ 已修复)
- [ ] 可以看到学习进度
- [ ] 可以编辑自己创建的课程
- [ ] AI 生成课程显示"只读"徽章
- [ ] 可以导出课程为 JSON

#### 数据完整性
- [ ] 旧课程数据全部迁移 (从 `data/courses/` 目录)
- [ ] 音频文件路径正确 (`data/audio/course_xxx/` 引用有效)
- [ ] 学习记录保留 (localStorage → IndexedDB)
- [ ] 没有数据丢失
- [ ] 迁移后旧数据有备份 (`data/backup/`)

### 端到端测试流程

#### 测试 1: 数据迁移 (⏱️ 10分钟)
1. 备份 `data/courses/` 目录
2. 启动应用,触发数据迁移
3. 验证 IndexedDB courses 表数据
4. 打开课程列表,确认所有旧课程显示
5. 随机选择 3 个课程进入学习,验证内容正确

#### 测试 2: AI Lab 完整流程 (⏱️ 15分钟)
1. 进入 AI 实验室
2. 生成一个课程 (AI 生成器或音频导入)
3. 在"任务历史"中查看任务状态
4. 等待任务完成
5. 点击任务结果,跳转到课程详情
6. 点击"编辑课程",进入编辑器
7. 修改课程标题,添加一个 lesson
8. 保存并返回课程列表
9. 验证修改生效

#### 测试 3: 课程学习流程 (⏱️ 10分钟)
1. 在课程列表选择任意课程
2. 点击"开始练习"
3. 验证显示正确的第一句话
4. 播放示范音频 (TTS)
5. 录音并评测 (ASR)
6. 查看评测结果
7. 点击"下一句",验证内容变化
8. 完成 5 句练习
9. 返回课程列表,查看学习进度

#### 测试 4: 设置和配置 (⏱️ 5分钟)
1. 进入设置页面
2. 切换到"AI 配置"分区
3. 选择 AI 提供商 (豆包)
4. 输入 API Key
5. 点击"测试连接"
6. 保存配置
7. 返回 AI Lab,验证 AI 功能使用新配置

---

## 📊 对比分析

### 老系统 vs 新系统

| 功能模块 | 老系统状态 | 新系统状态 | 差距 |
|---------|----------|----------|------|
| AI Lab 任务列表 | ✅ 有 | ❌ 无 | 🔴 严重 |
| 课程编辑器 | ✅ 有 | ❌ 无 | 🔴 严重 |
| 课程筛选 | ✅ 完善 | ⚠️ 基础 | 🟡 中等 |
| 跟读练习 | ✅ 有 | ✅ 有 | ✅ 对齐 |
| 听写练习 | ✅ 有 | ❌ 无 | 🔴 严重 |
| 复习系统 | ✅ 有 | ❌ 无 | 🔴 严重 |
| 进度跟踪 | ✅ 有 | ❌ 无 | 🟡 中等 |
| AI 设置 | ✅ 有 | ❌ 无 | 🔴 严重 |

### 需求文档对齐度

**已实现** (30%):
- ✅ 跟读模式（Section 3.1）
- ✅ TTS/ASR 基础（Section 2）
- ✅ 课程数据模型（Section 4）

**部分实现** (20%):
- ⚠️ AI 生成（Section 5.1）- 缺任务管理
- ⚠️ 课程管理（Section 6）- 缺编辑器
- ⚠️ 设置（Section 8）- 缺 AI 配置

**未实现** (50%):
- ❌ 听写模式（Section 3.2）
- ❌ 补救课程（Section 3.3）
- ❌ 复习系统（Section 3.4）
- ❌ 进度可视化（Section 3.5）
- ❌ 多维度评测（Section 3.6）
- ❌ 成就系统（Section 7）

---

## 下一步行动

**立即开始**:
1. 诊断课程数据读取问题（添加日志）
2. 实现 AI Lab 任务列表
3. 添加 AI 模型设置界面

**接下来**:
4. 实现课程编辑器
5. 重构课程列表界面
6. 运行数据迁移脚本

**本周目标**:
- P0 问题全部修复
- P1 问题完成 80%
- 新系统功能对齐老系统核心功能

---

**负责人**: AI Assistant  
**预计完成时间**: 3-5 天  
**当前阶段**: Phase 1 - 紧急修复
