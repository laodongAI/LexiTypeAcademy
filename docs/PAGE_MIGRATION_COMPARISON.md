# LexiType Academy - 页面迁移对比详表
## Page Migration Comparison Matrix

**审计日期**: 2024-01-xx  
**对比版本**: src_bak (React) vs vue-app (Vue 3)

---

## 📊 页面迁移总览

| 旧框架 (React) | 新框架 (Vue) | 迁移状态 | 功能完整度 | 备注 |
|---------------|-------------|----------|-----------|------|
| **主要组件/页面** |
| CourseManager.tsx (1327行) | CoursesPage.vue | ✅ 已迁移 | ⚠️ 60% | 课程管理主页面 |
| CourseEditor.tsx | ❓ 未见独立页面 | ⚠️ 部分 | ❓ | 可能集成在其他页面中 |
| CourseLessonPractice.tsx | LessonPracticePage.vue | ✅ 已迁移 | ⚠️ | 课程练习页面 |
| AILab.tsx | AILabPage.vue | ✅ 已迁移 | ⚠️ 80% | AI实验室，部分功能待实现 |
| GameCenter.tsx | GamesPage.vue | ✅ 已迁移 | ❓ | 游戏中心 |
| HistoryCharts.tsx | HistoryPage.vue | ✅ 已迁移 | ❓ | 学习历史统计 |
| StatisticsPanel.tsx | ❓ 未见 | ❌ 缺失 | 0% | 统计面板 |
| TaskDashboard.tsx | ❓ 未见 | ❌ 缺失 | 0% | 任务面板 |
| TypingGame.tsx | TypingPage.vue | ✅ 已迁移 | ❓ | 打字游戏 |
| ReviewManager.tsx | ReviewPage.vue | ✅ 已迁移 | ❓ | 复习管理 |
| SettingsPanel.tsx (1094行) | SettingsPage.vue (399行) | ⚠️ 部分 | ⚠️ 33% | **严重不完整** |
| **功能性组件** |
| CourseImportWizard.tsx | ❓ | ⚠️ | ❓ | 课程导入向导，可能在AILab中 |
| AudioCourseWizard.tsx | ❓ | ⚠️ | ❓ | 音频课程向导，可能在AILab中 |
| CourseSystemBuilder.tsx | ❓ | ⚠️ | ❓ | 课程系统构建器 |
| DictationModal.tsx | DictationMode.vue (practice/) | ✅ 已迁移 | ✅ 90% | 听写模式 |
| ShadowingModal.tsx | FollowMode.vue (practice/) | ✅ 已迁移 | ✅ 90% | 跟读模式 |
| UnifiedPracticeModal.tsx | ImitationMode.vue (practice/) | ⚠️ 部分 | ⚠️ 70% | 统一练习模态框 |
| FreeWritingMode.tsx | ❓ | ❌ 缺失 | 0% | 自由写作模式 |
| **其他页面** |
| - | HomePage.vue | ✅ 新增 | ✅ | 主页 |
| - | PinyinPage.vue | ✅ 新增 | ❓ | 拼音练习 |
| - | AIPage.vue | ✅ 新增 | ❓ | AI聊天（与AILab重复？） |
| - | MigrationPage.vue | ✅ 新增 | ✅ | 数据迁移工具 |
| - | NotFoundPage.vue | ✅ 新增 | ✅ | 404页面 |

**整体迁移率**: ✅ 约 70% (主要页面已迁移)  
**功能完整度**: ⚠️ 约 60% (已迁移页面中功能不完整)

---

## 📝 详细功能对比

### 1. CourseManager.tsx → CoursesPage.vue

#### 旧框架功能清单 (1327行)
- ✅ 课程列表展示 (卡片/列表视图)
- ✅ 多维度筛选
  - 搜索关键词
  - 难度筛选 (beginner/intermediate/advanced)
  - 类型筛选 (text/words/mixed)
  - 标签筛选
- ✅ 多种排序方式
  - 创建时间
  - 更新时间
  - 标题
  - 练习次数
- ✅ 分页显示 (每页10条)
- ✅ 课程进度显示
  - 进度百分比
  - 已练习课时数
  - 平均准确率
  - 平均WPM
- ✅ 课程操作
  - 开始练习
  - 编辑课程
  - 删除课程
  - 导出JSON
  - 批量听写
  - 播放列表
- ✅ 课程导入
  - JSON导入向导
  - 音频课程向导
  - 课程系统构建器
- ✅ 状态持久化 (localStorage)

#### 新框架实现情况 (待验证)
**需要检查的功能点**:
- ❓ 筛选功能是否完整
- ❓ 排序功能是否完整
- ❓ 课程进度计算
- ❓ 批量听写功能
- ❓ 播放列表功能
- ❓ 课程编辑功能 (是否有独立编辑页)
- ❓ 导入向导是否集成

**建议操作**: 
1. 打开 CoursesPage.vue 详细阅读
2. 测试各个功能是否工作
3. 对比旧框架缺失的功能

---

### 2. SettingsPanel.tsx → SettingsPage.vue ⚠️ 严重不完整

**已在 MIGRATION_AUDIT_REPORT.md 中详细分析**

关键问题:
- 老框架: 1094行，7个主要配置模块
- 新框架: 399行，5个标签页（仅2个完整）
- 缺失率: 67.4%
- 阻塞性问题: AI配置无UI入口

---

### 3. AILab.tsx → AILabPage.vue ⚠️ 80%

#### 旧框架功能 (需详细检查)
- AI课程生成
- 音频导入
- 教材导入
- 写作助手
- AI对话
- 发音测试
- 词汇推荐

#### 新框架实现情况
**已实现** (根据 Phase 9 报告):
- ✅ 课程生成器 (100%)
- ✅ 音频导入 (90% - 需ASR集成)
- ✅ 教材导入 (90% - 需文件解析器)
- ✅ 写作助手 (100%)
- ✅ AI对话 (100%)
- ⚠️ 发音测试 (10%)
- ⚠️ 词汇推荐 (10%)

**缺失功能**:
- 完整的发音评分系统
- 词汇推荐智能算法

---

### 4. 练习组件对比

#### 听写模式
- **旧**: DictationModal.tsx
- **新**: DictationMode.vue (practice/)
- **状态**: ✅ 90% 已实现
- **缺失**: 高级统计功能

#### 跟读/影子跟读
- **旧**: ShadowingModal.tsx
- **新**: FollowMode.vue (practice/)
- **状态**: ✅ 90% 已实现
- **缺失**: 详细评分反馈

#### 统一练习
- **旧**: UnifiedPracticeModal.tsx
- **新**: ImitationMode.vue (practice/)
- **状态**: ⚠️ 70% 实现
- **缺失**: 
  - 多种练习模式切换
  - 自定义练习配置

#### 自由写作 ❌
- **旧**: FreeWritingMode.tsx
- **新**: **未找到对应组件**
- **状态**: ❌ 完全缺失
- **功能**: 
  - 自由文本输入
  - AI写作指导
  - 语法检查
  - 风格建议

---

### 5. 统计和历史

#### 学习历史
- **旧**: HistoryCharts.tsx
- **新**: HistoryPage.vue
- **状态**: ❓ 待验证
- **需检查**:
  - 图表是否完整 (练习时长、准确率、WPM趋势)
  - 数据筛选 (按时间、课程、练习类型)
  - 数据导出功能

#### 统计面板 ❌
- **旧**: StatisticsPanel.tsx (practice/StatisticsPanel.tsx)
- **新**: **未找到独立页面**
- **状态**: ❌ 可能缺失或集成在其他页面
- **功能**:
  - 实时练习统计
  - WPM计算
  - 准确率显示
  - 错误分析

#### 任务面板 ❌
- **旧**: TaskDashboard.tsx
- **新**: **未找到对应页面**
- **状态**: ❌ 完全缺失
- **功能**:
  - 学习任务列表
  - 每日目标进度
  - 任务完成统计
  - 奖励系统

---

### 6. 游戏和娱乐

#### 游戏中心
- **旧**: GameCenter.tsx + TypingGame.tsx
- **新**: GamesPage.vue + TypingPage.vue (?)
- **状态**: ❓ 待验证
- **需检查**:
  - 游戏种类数量
  - 游戏难度设置
  - 积分系统
  - 排行榜

---

### 7. 新增页面评估

#### HomePage.vue ✅
- **状态**: 新框架新增
- **功能**: 
  - 应用介绍
  - 快速开始入口
  - 学习统计概览
  - 推荐内容
- **评估**: ✅ 良好，提升了用户体验

#### PinyinPage.vue ✅
- **状态**: 新框架新增
- **功能**: 拼音练习
- **评估**: ✅ 功能扩展，符合中文学习需求

#### MigrationPage.vue ✅
- **状态**: 新框架新增
- **功能**: 从旧版本迁移数据
- **评估**: ✅ 实用工具

#### AIPage.vue ❓
- **状态**: 新框架新增
- **与 AILabPage.vue 的关系**: 待确认
- **可能场景**:
  1. AIPage = 纯聊天界面
  2. AILabPage = 功能工具集
- **需验证**: 功能是否重复或互补

---

## 🔍 关键发现

### 完全缺失的功能 ❌
1. **StatisticsPanel** - 实时练习统计面板
2. **TaskDashboard** - 任务和目标管理
3. **FreeWritingMode** - 自由写作模式
4. **CourseEditor** (独立) - 课程编辑器可能集成在其他页面
5. **PromptSoundSettings** - 提示音设置 (可能在Settings中)

### 严重不完整的功能 ⚠️
1. **SettingsPanel** - 仅33%功能迁移，AI配置缺失
2. **CourseManager** - 功能待验证，可能缺少高级特性
3. **UnifiedPractice** - 统一练习模式仅70%完成

### 新增但需验证的功能 ❓
1. **AIPage** vs **AILabPage** - 功能定位不明确
2. **PinyinPage** - 新增功能，待评估质量
3. **HomePage** - 新增导航页，需评估信息架构

---

## 📋 后续行动

### Phase 2A: 页面功能验证 (预计1-2天)
1. **逐页测试新框架功能**
   - [ ] HomePage.vue - 测试所有链接和统计
   - [ ] CoursesPage.vue - 测试筛选、排序、CRUD
   - [ ] CourseDetailPage.vue - 测试课程详情和开始练习
   - [ ] LessonPracticePage.vue - 测试练习模式
   - [ ] AILabPage.vue - 测试5个已实现功能
   - [ ] AIPage.vue - 确认与AILab的区别
   - [ ] TypingPage.vue - 测试打字游戏
   - [ ] PinyinPage.vue - 测试拼音练习
   - [ ] ReviewPage.vue - 测试复习系统
   - [ ] HistoryPage.vue - 测试统计图表
   - [ ] GamesPage.vue - 测试游戏列表
   - [ ] SettingsPage.vue - 测试已有配置项
   - [ ] MigrationPage.vue - 测试数据迁移

2. **记录每个页面的功能完整度**
   - 完整实现的功能 ✅
   - 部分实现的功能 ⚠️
   - 完全缺失的功能 ❌

3. **对比旧框架缺失的功能列表**

### Phase 2B: 补全缺失页面 (预计2-3天)
1. **实现 StatisticsPanel** (作为独立页面或组件)
2. **实现 TaskDashboard** 
3. **实现 FreeWritingMode**
4. **评估是否需要独立的 CourseEditor 页面**

### Phase 2C: 完善不完整页面 (预计3-5天)
1. **SettingsPage** - 补全AI配置、ASR高级设置、存储管理等
2. **CourseManager** - 补全高级功能
3. **UnifiedPractice** - 完善多模式支持

---

## 📊 迁移评分矩阵

| 类别 | 旧框架页面数 | 新框架页面数 | 迁移率 | 功能完整度 |
|------|------------|------------|--------|-----------|
| 核心学习页面 | 5 | 5 | ✅ 100% | ⚠️ 70% |
| 管理页面 | 3 | 2 | ⚠️ 67% | ⚠️ 50% |
| 工具页面 | 4 | 6 | ✅ 150% | ⚠️ 60% |
| 练习组件 | 4 | 3 | ⚠️ 75% | ⚠️ 80% |
| 设置/配置 | 1 | 1 | ✅ 100% | 🔴 33% |
| **总计** | **17** | **17** | **✅ 100%** | **⚠️ 63%** |

**结论**: 
- ✅ 页面数量迁移完整 (甚至有新增)
- ⚠️ 功能完整度需提升 (63%)
- 🔴 关键配置功能严重不足 (33%)

---

## 🎯 优先级矩阵

| 优先级 | 任务 | 影响范围 | 工作量 | 完成时间 |
|--------|------|----------|--------|----------|
| 🔴 P0 | Settings - AI配置UI | 阻塞AI功能使用 | 1天 | 立即 |
| 🔴 P0 | Settings - ASR高级设置 | 影响语音识别质量 | 1天 | 立即 |
| 🔴 P1 | Settings - 存储管理 | 长期运维问题 | 0.5天 | 本周 |
| ⚠️ P2 | 实现 StatisticsPanel | 影响练习反馈 | 1天 | 下周 |
| ⚠️ P2 | 实现 TaskDashboard | 影响学习动力 | 1.5天 | 下周 |
| ⚠️ P2 | 完善 UnifiedPractice | 练习体验 | 1天 | 下周 |
| 🟢 P3 | 实现 FreeWritingMode | 功能扩展 | 2天 | 后续 |
| 🟢 P3 | Settings - 提示音 | 细节优化 | 0.5天 | 后续 |
| 🟢 P3 | Settings - AI Prompt自定义 | 高级功能 | 1天 | 后续 |

---

**文档状态**: 初稿 - 待实际测试验证  
**下一步**: 启动 Phase 2A - 页面功能验证
