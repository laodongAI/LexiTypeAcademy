# 课程管理系统重新设计方案

**版本**: v1.0  
**日期**: 2025-12-08  
**状态**: 设计中  
**基于**: english-learning-requirements-v0.4.0.md

---

## 1. 核心问题分析

### 1.1 当前问题

1. **课程来源混乱**
   - AI生成、音频导入、教材解析、手动创建的课程混在一起
   - 没有明确的来源标识和权限控制
   - AI生成课程可以被编辑导致内容错乱

2. **界面性能问题**
   - 卡片式布局在课程数量多时（>50个）性能下降
   - 缺少虚拟滚动和分页机制
   - 过滤和搜索响应慢

3. **功能缺失**
   - 无高级筛选（多维度、标签、时间范围）
   - 无批量操作（删除、导出、归档）
   - 无课程分组和收藏功能
   - 无导入/导出功能入口

### 1.2 设计目标

1. **清晰的课程分类**
   - 按来源分类：系统预设、AI生成、我的创作、导入课程
   - 明确的只读/可编辑标识
   - 权限控制：AI课程只读、我的创作可编辑

2. **高性能列表**
   - 虚拟滚动支持1000+课程
   - 多种视图：卡片视图/列表视图/表格视图
   - 响应式布局适配不同屏幕

3. **完整的管理功能**
   - 高级筛选面板（折叠式）
   - 批量操作工具栏
   - 课程导入/导出向导
   - 课程归档和回收站

---

## 2. 数据模型设计

### 2.1 课程元数据扩展

```typescript
interface Course {
  // 基础信息
  id: string;
  title: string;
  description?: string;
  
  // 分类信息
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  type: 'text' | 'words' | 'mixed';
  cefrLevel?: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  tags: string[];
  
  // 来源与权限 ⭐ 新增
  source: {
    type: 'system' | 'ai_generated' | 'user_created' | 'imported' | 'audio_import' | 'material_parsed';
    creator?: string; // 创建者ID
    generatorTask?: string; // AI任务ID（用于追溯）
    importedFrom?: string; // 导入来源文件名
    originalCourseId?: string; // 原始课程ID（用于复制/派生）
  };
  
  // 权限控制 ⭐ 新增
  permissions: {
    editable: boolean; // 是否可编辑
    deletable: boolean; // 是否可删除
    exportable: boolean; // 是否可导出
    shareable: boolean; // 是否可分享
  };
  
  // 状态 ⭐ 新增
  status: 'active' | 'archived' | 'draft';
  visibility: 'private' | 'public' | 'shared';
  
  // 学习数据
  lessons: Lesson[];
  stats?: {
    practiceCount: number;
    avgAccuracy: number;
    avgWpm: number;
    completedLessons: string[];
    lastPracticeAt?: string; // ⭐ 新增
    totalDuration?: number; // 预估学习时长（秒）
  };
  
  // 元数据
  createdAt: string;
  updatedAt: string;
  archivedAt?: string; // ⭐ 新增
  
  // 扩展信息 ⭐ 新增
  metadata?: {
    estimatedDuration?: number; // 预估完成时间（分钟）
    vocabularyCount?: number; // 词汇量
    sentenceCount?: number; // 句子数
    audioSource?: string; // 音频来源
    aiModel?: string; // AI模型版本
    version?: number; // 课程版本号
  };
}
```

### 2.2 权限规则

```typescript
// 权限规则矩阵
const PERMISSION_RULES = {
  system: {
    editable: false,
    deletable: false,
    exportable: true,
    shareable: true,
    description: '系统预设课程，只读'
  },
  ai_generated: {
    editable: false, // ⭐ AI生成内容不可编辑
    deletable: true,
    exportable: true,
    shareable: true,
    description: 'AI生成课程，可删除但不可编辑（保证AI内容完整性）'
  },
  user_created: {
    editable: true,
    deletable: true,
    exportable: true,
    shareable: true,
    description: '用户手动创建，完全控制'
  },
  imported: {
    editable: true, // 导入后视为用户内容
    deletable: true,
    exportable: true,
    shareable: true,
    description: '导入课程，可编辑'
  },
  audio_import: {
    editable: false, // 基于音频生成，编辑可能破坏音频对齐
    deletable: true,
    exportable: true,
    shareable: true,
    description: '音频导入课程，不可编辑（保持音频同步）'
  },
  material_parsed: {
    editable: false, // 教材解析内容，保持原版权完整性
    deletable: true,
    exportable: true,
    shareable: false, // 版权考虑
    description: '教材解析课程，不可编辑'
  }
};
```

### 2.3 课程分类树

```typescript
interface CourseCategory {
  id: string;
  name: string;
  icon: string;
  filter: (course: Course) => boolean;
  count?: number;
  children?: CourseCategory[];
}

const COURSE_CATEGORIES: CourseCategory[] = [
  {
    id: 'all',
    name: '全部课程',
    icon: '📚',
    filter: () => true
  },
  {
    id: 'my-courses',
    name: '我的创作',
    icon: '✍️',
    filter: (c) => c.source.type === 'user_created' || c.source.type === 'imported',
    children: [
      { id: 'my-created', name: '手动创建', icon: '📝', filter: (c) => c.source.type === 'user_created' },
      { id: 'my-imported', name: '导入课程', icon: '📥', filter: (c) => c.source.type === 'imported' }
    ]
  },
  {
    id: 'ai-generated',
    name: 'AI 生成',
    icon: '🤖',
    filter: (c) => c.source.type === 'ai_generated' || c.source.type === 'audio_import' || c.source.type === 'material_parsed',
    children: [
      { id: 'ai-text', name: 'AI文本生成', icon: '✨', filter: (c) => c.source.type === 'ai_generated' },
      { id: 'audio-import', name: '音频导入', icon: '🎵', filter: (c) => c.source.type === 'audio_import' },
      { id: 'material', name: '教材解析', icon: '📖', filter: (c) => c.source.type === 'material_parsed' }
    ]
  },
  {
    id: 'system',
    name: '系统预设',
    icon: '⭐',
    filter: (c) => c.source.type === 'system'
  },
  {
    id: 'archived',
    name: '已归档',
    icon: '📦',
    filter: (c) => c.status === 'archived'
  }
];
```

---

## 3. 界面设计

### 3.1 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  ← 返回首页    [搜索框]           [筛选▼] [视图▼] [新建▼]    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─ 侧边栏 ──┐  ┌─ 主内容区 ──────────────────────────────┐  │
│  │           │  │                                          │  │
│  │ 📚 全部   │  │  ┌─ 工具栏 ─────────────────────────┐   │  │
│  │           │  │  │ 已选 3 项 | [删除] [导出] [归档]  │   │  │
│  │ ✍️ 我的  │  │  └──────────────────────────────────┘   │  │
│  │  📝 创建 │  │                                          │  │
│  │  📥 导入 │  │  ┌─ 课程卡片/列表 ──────────────────┐   │  │
│  │           │  │  │                                  │   │  │
│  │ 🤖 AI生成│  │  │  [卡片] [卡片] [卡片]           │   │  │
│  │  ✨ 文本 │  │  │  [卡片] [卡片] [卡片]           │   │  │
│  │  🎵 音频 │  │  │  [卡片] [卡片] [卡片]           │   │  │
│  │  📖 教材 │  │  │                                  │   │  │
│  │           │  │  └──────────────────────────────┘   │  │
│  │ ⭐ 系统  │  │                                          │  │
│  │           │  │  ┌─ 分页/滚动 ──────────────────┐     │  │
│  │ 📦 归档  │  │  │  第 1 页 / 共 10 页  [加载更多] │     │  │
│  │           │  │  └──────────────────────────────┘     │  │
│  │           │  │                                          │  │
│  └───────────┘  └──────────────────────────────────────┘  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 侧边栏分类导航

**设计要点**：
- 树形结构，支持折叠/展开
- 显示每个分类的课程数量
- 当前选中项高亮
- 支持拖拽课程到分类进行归档

```tsx
<Sidebar>
  {COURSE_CATEGORIES.map(category => (
    <CategoryItem 
      key={category.id}
      icon={category.icon}
      name={category.name}
      count={getCourseCount(category.filter)}
      active={currentCategory === category.id}
      onClick={() => setCurrentCategory(category.id)}
    >
      {category.children?.map(child => (
        <SubCategoryItem key={child.id} {...child} />
      ))}
    </CategoryItem>
  ))}
</Sidebar>
```

### 3.3 顶部工具栏

```tsx
<Toolbar>
  {/* 搜索框 */}
  <SearchInput 
    placeholder="搜索课程名称、标签、内容..."
    value={searchQuery}
    onChange={setSearchQuery}
  />
  
  {/* 筛选按钮 */}
  <FilterButton onClick={() => setShowFilterPanel(!showFilterPanel)}>
    筛选 {activeFilterCount > 0 && `(${activeFilterCount})`}
  </FilterButton>
  
  {/* 视图切换 */}
  <ViewSwitcher>
    <ViewOption value="grid" icon="⊞">卡片</ViewOption>
    <ViewOption value="list" icon="☰">列表</ViewOption>
    <ViewOption value="table" icon="▦">表格</ViewOption>
  </ViewSwitcher>
  
  {/* 新建菜单 */}
  <CreateMenu>
    <MenuItem onClick={handleCreateManual}>✍️ 手动创建</MenuItem>
    <MenuItem onClick={handleImport}>📥 导入课程</MenuItem>
    <MenuDivider />
    <MenuItem onClick={() => navigate('ai')}>🤖 AI 实验室</MenuItem>
  </CreateMenu>
</Toolbar>
```

### 3.4 高级筛选面板（折叠式）

```tsx
<FilterPanel visible={showFilterPanel}>
  {/* 难度 */}
  <FilterSection title="难度">
    <CheckboxGroup>
      <Checkbox value="beginner">初级 (A1-A2)</Checkbox>
      <Checkbox value="intermediate">中级 (B1-B2)</Checkbox>
      <Checkbox value="advanced">高级 (C1-C2)</Checkbox>
    </CheckboxGroup>
  </FilterSection>
  
  {/* CEFR等级 */}
  <FilterSection title="CEFR 等级">
    <CheckboxGroup>
      {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(level => (
        <Checkbox key={level} value={level}>{level}</Checkbox>
      ))}
    </CheckboxGroup>
  </FilterSection>
  
  {/* 标签 */}
  <FilterSection title="标签">
    <TagSearch placeholder="搜索标签..." />
    <TagList>
      {popularTags.map(tag => (
        <Tag key={tag} selectable>{tag}</Tag>
      ))}
    </TagList>
  </FilterSection>
  
  {/* 来源 */}
  <FilterSection title="来源">
    <CheckboxGroup>
      <Checkbox value="system">系统预设</Checkbox>
      <Checkbox value="ai_generated">AI生成</Checkbox>
      <Checkbox value="user_created">我的创作</Checkbox>
      <Checkbox value="imported">导入课程</Checkbox>
    </CheckboxGroup>
  </FilterSection>
  
  {/* 状态 */}
  <FilterSection title="学习状态">
    <RadioGroup>
      <Radio value="all">全部</Radio>
      <Radio value="not-started">未开始</Radio>
      <Radio value="in-progress">进行中</Radio>
      <Radio value="completed">已完成</Radio>
    </RadioGroup>
  </FilterSection>
  
  {/* 时间范围 */}
  <FilterSection title="创建时间">
    <DateRangePicker
      from={filterDateFrom}
      to={filterDateTo}
      presets={[
        { label: '最近7天', days: 7 },
        { label: '最近30天', days: 30 },
        { label: '最近3个月', days: 90 }
      ]}
    />
  </FilterSection>
  
  {/* 操作按钮 */}
  <FilterActions>
    <Button variant="ghost" onClick={clearFilters}>清除筛选</Button>
    <Button variant="primary" onClick={applyFilters}>应用</Button>
  </FilterActions>
</FilterPanel>
```

### 3.5 课程卡片设计

#### 3.5.1 卡片视图（默认）

```tsx
<CourseCard 
  course={course}
  selected={selectedIds.has(course.id)}
  onSelect={handleSelect}
  onClick={handleCardClick}
>
  {/* 顶部：来源标识 */}
  <CardHeader>
    <SourceBadge type={course.source.type}>
      {getSourceIcon(course.source.type)} {getSourceLabel(course.source.type)}
    </SourceBadge>
    {!course.permissions.editable && (
      <ReadOnlyBadge>🔒 只读</ReadOnlyBadge>
    )}
    <SelectCheckbox checked={selectedIds.has(course.id)} />
  </CardHeader>
  
  {/* 主体：课程信息 */}
  <CardBody>
    <CourseTitle>{course.title}</CourseTitle>
    <CourseDescription>{course.description}</CourseDescription>
    
    <CourseMeta>
      <MetaItem>
        <DifficultyBadge level={course.difficulty} />
        {course.cefrLevel && <CEFRBadge>{course.cefrLevel}</CEFRBadge>}
      </MetaItem>
      <MetaItem>
        📝 {course.lessons.length} 课时
      </MetaItem>
      <MetaItem>
        ⏱️ {course.metadata?.estimatedDuration || 0} 分钟
      </MetaItem>
    </CourseMeta>
    
    {/* 标签 */}
    <TagList>
      {course.tags.slice(0, 3).map(tag => (
        <Tag key={tag}>{tag}</Tag>
      ))}
      {course.tags.length > 3 && <Tag>+{course.tags.length - 3}</Tag>}
    </TagList>
  </CardBody>
  
  {/* 底部：进度和操作 */}
  <CardFooter>
    <ProgressBar 
      value={course.stats?.completedLessons?.length || 0}
      max={course.lessons.length}
    />
    <QuickActions>
      <ActionButton onClick={() => handleStart(course)}>开始练习</ActionButton>
      <ActionButton icon="⋯" onClick={(e) => showContextMenu(e, course)} />
    </QuickActions>
  </CardFooter>
</CourseCard>
```

#### 3.5.2 列表视图（紧凑）

```tsx
<CourseListItem course={course}>
  <Checkbox checked={selectedIds.has(course.id)} />
  <SourceIcon type={course.source.type} />
  <CourseTitle>{course.title}</CourseTitle>
  <DifficultyBadge level={course.difficulty} />
  <LessonCount>{course.lessons.length} 课时</LessonCount>
  <ProgressIndicator value={getProgress(course)} />
  <CreatedDate>{formatDate(course.createdAt)}</CreatedDate>
  <Actions>
    {course.permissions.editable && <EditButton />}
    <DeleteButton />
    <MoreButton />
  </Actions>
</CourseListItem>
```

#### 3.5.3 表格视图（详细）

```tsx
<Table>
  <thead>
    <tr>
      <th><Checkbox onChange={toggleSelectAll} /></th>
      <th>课程名称</th>
      <th>来源</th>
      <th>难度</th>
      <th>课时数</th>
      <th>进度</th>
      <th>创建时间</th>
      <th>操作</th>
    </tr>
  </thead>
  <tbody>
    {courses.map(course => (
      <tr key={course.id}>
        <td><Checkbox checked={selectedIds.has(course.id)} /></td>
        <td>
          <CourseTitleCell>
            {!course.permissions.editable && <LockIcon />}
            {course.title}
          </CourseTitleCell>
        </td>
        <td><SourceBadge type={course.source.type} /></td>
        <td><DifficultyBadge level={course.difficulty} /></td>
        <td>{course.lessons.length}</td>
        <td><ProgressBar value={getProgress(course)} /></td>
        <td>{formatDate(course.createdAt)}</td>
        <td><ActionButtons course={course} /></td>
      </tr>
    ))}
  </tbody>
</Table>
```

### 3.6 批量操作工具栏

```tsx
{selectedIds.size > 0 && (
  <BatchActionBar>
    <SelectedInfo>已选 {selectedIds.size} 项</SelectedInfo>
    <ActionButton onClick={handleBatchDelete} disabled={!canDeleteAll()}>
      删除
    </ActionButton>
    <ActionButton onClick={handleBatchExport}>
      导出
    </ActionButton>
    <ActionButton onClick={handleBatchArchive}>
      归档
    </ActionButton>
    <ActionButton variant="ghost" onClick={clearSelection}>
      取消选择
    </ActionButton>
  </BatchActionBar>
)}
```

### 3.7 课程详情侧边栏

```tsx
<CourseDetailDrawer visible={!!selectedCourse} onClose={() => setSelectedCourse(null)}>
  {/* 头部 */}
  <DrawerHeader>
    <CourseTitle>{selectedCourse.title}</CourseTitle>
    <SourceBadge type={selectedCourse.source.type} />
    {!selectedCourse.permissions.editable && (
      <Tooltip content="此课程为只读，不可编辑">
        <ReadOnlyBadge>🔒 只读</ReadOnlyBadge>
      </Tooltip>
    )}
  </DrawerHeader>
  
  {/* 统计信息 */}
  <StatsSection>
    <StatCard>
      <StatLabel>课时数</StatLabel>
      <StatValue>{selectedCourse.lessons.length}</StatValue>
    </StatCard>
    <StatCard>
      <StatLabel>完成度</StatLabel>
      <StatValue>{getCompletionRate(selectedCourse)}%</StatValue>
    </StatCard>
    <StatCard>
      <StatLabel>平均分</StatLabel>
      <StatValue>{selectedCourse.stats?.avgAccuracy || 0}</StatValue>
    </StatCard>
  </StatsSection>
  
  {/* 课程信息 */}
  <InfoSection>
    <InfoItem label="难度" value={selectedCourse.difficulty} />
    <InfoItem label="CEFR" value={selectedCourse.cefrLevel} />
    <InfoItem label="预估时长" value={`${selectedCourse.metadata?.estimatedDuration || 0} 分钟`} />
    <InfoItem label="创建时间" value={formatDate(selectedCourse.createdAt)} />
    {selectedCourse.source.type === 'ai_generated' && (
      <InfoItem 
        label="AI模型" 
        value={selectedCourse.metadata?.aiModel || '未知'} 
      />
    )}
  </InfoSection>
  
  {/* 标签 */}
  <TagsSection>
    {selectedCourse.tags.map(tag => (
      <Tag key={tag}>{tag}</Tag>
    ))}
  </TagsSection>
  
  {/* 课时列表 */}
  <LessonsSection>
    <SectionTitle>课时列表</SectionTitle>
    <LessonList>
      {selectedCourse.lessons.map((lesson, index) => (
        <LessonItem 
          key={lesson.id}
          number={index + 1}
          completed={selectedCourse.stats?.completedLessons?.includes(lesson.id)}
        >
          {lesson.content}
        </LessonItem>
      ))}
    </LessonList>
  </LessonsSection>
  
  {/* 操作按钮 */}
  <DrawerActions>
    <Button variant="primary" size="lg" onClick={() => handleStartPractice(selectedCourse)}>
      开始练习
    </Button>
    {selectedCourse.permissions.editable && (
      <Button variant="secondary" onClick={() => handleEdit(selectedCourse)}>
        编辑课程
      </Button>
    )}
    {selectedCourse.permissions.exportable && (
      <Button variant="secondary" onClick={() => handleExport(selectedCourse)}>
        导出
      </Button>
    )}
    {selectedCourse.permissions.deletable && (
      <Button variant="danger" onClick={() => handleDelete(selectedCourse)}>
        删除
      </Button>
    )}
  </DrawerActions>
  
  {/* AI课程说明 */}
  {selectedCourse.source.type === 'ai_generated' && (
    <InfoBanner type="info">
      💡 此课程由 AI 生成，为保证内容完整性不支持编辑。如需修改，请创建新课程或使用"复制为副本"功能。
    </InfoBanner>
  )}
</CourseDetailDrawer>
```

---

## 4. 交互流程设计

### 4.1 课程浏览与筛选

```
用户操作                          系统响应
──────────────────────────────────────────────
1. 进入课程页面                    加载课程列表（默认显示全部）
2. 点击侧边栏"AI生成"              筛选显示AI生成课程
3. 点击"筛选"按钮                  展开筛选面板
4. 选择"初级"+"口语"标签           实时更新列表
5. 输入搜索关键词"日常"            模糊搜索匹配
6. 点击课程卡片                    右侧打开详情抽屉
7. 悬停"只读"徽章                  显示提示："此课程不可编辑"
```

### 4.2 批量操作流程

```
用户操作                          系统响应
──────────────────────────────────────────────
1. 勾选多个课程卡片                 显示批量操作工具栏
2. 点击"导出"按钮                   弹出导出对话框
   - 选择格式：JSON / CSV
   - 选择内容：完整数据 / 仅元数据
3. 确认导出                         打包下载ZIP文件
4. 点击"归档"按钮                   确认对话框
5. 确认归档                         课程移至"已归档"分类
```

### 4.3 课程编辑权限控制

```
场景：用户尝试编辑AI生成课程

用户操作                          系统响应
──────────────────────────────────────────────
1. 点击AI课程详情                   显示详情，"编辑"按钮置灰
2. 悬停"编辑"按钮                   提示："AI课程不可编辑"
3. 点击"更多操作" > "编辑"         弹出说明对话框：
   "此课程由AI生成，为保证内容完整性不支持直接编辑。
    您可以：
    - 创建副本进行编辑
    - 导出后重新导入
    - 在AI实验室重新生成"
4. 点击"创建副本"                   创建可编辑副本
   - source.type 改为 'user_created'
   - source.originalCourseId 记录原始ID
   - permissions.editable 设为 true
```

### 4.4 课程导入流程

```
用户操作                          系统响应
──────────────────────────────────────────────
1. 点击"新建" > "导入课程"          打开导入向导
2. 步骤1: 选择文件                  支持 JSON / XML / CSV
   - 拖拽上传
   - 点击浏览
3. 步骤2: 预览解析结果              显示课程列表预览
   - 课程数量
   - 基本信息
   - 冲突检测
4. 步骤3: 处理冲突                  如果有重复课程：
   - 跳过
   - 覆盖
   - 保留两者
5. 步骤4: 确认导入                  批量插入数据库
6. 导入完成                         显示结果报告
   - 成功 X 个
   - 失败 X 个
   - 跳过 X 个
```

### 4.5 性能优化：虚拟滚动

```typescript
// 虚拟滚动实现方案

interface VirtualScrollConfig {
  itemHeight: number; // 单个卡片/行高度
  containerHeight: number; // 可视区域高度
  overscan: number; // 预渲染数量（前后各N个）
}

function useVirtualScroll<T>(
  items: T[],
  config: VirtualScrollConfig
) {
  const [scrollTop, setScrollTop] = useState(0);
  
  // 计算可见范围
  const startIndex = Math.max(0, 
    Math.floor(scrollTop / config.itemHeight) - config.overscan
  );
  const endIndex = Math.min(items.length,
    Math.ceil((scrollTop + config.containerHeight) / config.itemHeight) + config.overscan
  );
  
  // 只渲染可见项
  const visibleItems = items.slice(startIndex, endIndex);
  
  // 计算偏移量
  const offsetY = startIndex * config.itemHeight;
  
  return {
    visibleItems,
    totalHeight: items.length * config.itemHeight,
    offsetY,
    onScroll: (e) => setScrollTop(e.target.scrollTop)
  };
}

// 使用示例
const { visibleItems, totalHeight, offsetY, onScroll } = useVirtualScroll(
  filteredCourses,
  { itemHeight: 200, containerHeight: 800, overscan: 5 }
);

return (
  <ScrollContainer height={800} onScroll={onScroll}>
    <div style={{ height: totalHeight, position: 'relative' }}>
      <div style={{ transform: `translateY(${offsetY}px)` }}>
        {visibleItems.map(course => (
          <CourseCard key={course.id} course={course} />
        ))}
      </div>
    </div>
  </ScrollContainer>
);
```

---

## 5. 技术实现

### 5.1 数据库迁移

```typescript
// 迁移脚本：为现有课程添加新字段

async function migrateCourses() {
  const db = new LexiTypeDB();
  const courses = await db.courses.toArray();
  
  const migratedCourses = courses.map(course => {
    // 推断来源类型
    const sourceType = inferSourceType(course);
    
    // 设置权限
    const permissions = PERMISSION_RULES[sourceType];
    
    return {
      ...course,
      source: {
        type: sourceType,
        creator: 'system', // 默认为系统
      },
      permissions,
      status: 'active',
      visibility: 'private',
      metadata: {
        estimatedDuration: estimateDuration(course),
        vocabularyCount: countVocabulary(course),
        sentenceCount: course.lessons.length,
        version: 1
      }
    };
  });
  
  await db.courses.bulkPut(migratedCourses);
  console.log(`Migrated ${migratedCourses.length} courses`);
}

function inferSourceType(course: any): string {
  // 根据现有字段推断来源
  if (course.source === '示例课程') return 'system';
  if (course.source?.includes('AI')) return 'ai_generated';
  if (course.source?.includes('音频')) return 'audio_import';
  if (course.source?.includes('教材')) return 'material_parsed';
  return 'user_created';
}
```

### 5.2 筛选逻辑实现

```typescript
interface FilterState {
  search: string;
  difficulties: Set<string>;
  cefrLevels: Set<string>;
  tags: Set<string>;
  sourceTypes: Set<string>;
  learningStatus: 'all' | 'not-started' | 'in-progress' | 'completed';
  dateFrom?: Date;
  dateTo?: Date;
}

function filterCourses(
  courses: Course[],
  filter: FilterState,
  category: string
): Course[] {
  return courses.filter(course => {
    // 分类过滤
    const categoryFilter = COURSE_CATEGORIES.find(c => c.id === category);
    if (categoryFilter && !categoryFilter.filter(course)) {
      return false;
    }
    
    // 搜索过滤
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      const matchTitle = course.title.toLowerCase().includes(searchLower);
      const matchTags = course.tags.some(tag => 
        tag.toLowerCase().includes(searchLower)
      );
      const matchContent = course.lessons.some(lesson =>
        lesson.content.toLowerCase().includes(searchLower)
      );
      if (!matchTitle && !matchTags && !matchContent) {
        return false;
      }
    }
    
    // 难度过滤
    if (filter.difficulties.size > 0 && 
        !filter.difficulties.has(course.difficulty)) {
      return false;
    }
    
    // CEFR过滤
    if (filter.cefrLevels.size > 0 && 
        !filter.cefrLevels.has(course.cefrLevel || '')) {
      return false;
    }
    
    // 标签过滤（AND逻辑）
    if (filter.tags.size > 0) {
      const hasAllTags = Array.from(filter.tags).every(tag =>
        course.tags.includes(tag)
      );
      if (!hasAllTags) {
        return false;
      }
    }
    
    // 来源过滤
    if (filter.sourceTypes.size > 0 &&
        !filter.sourceTypes.has(course.source.type)) {
      return false;
    }
    
    // 学习状态过滤
    if (filter.learningStatus !== 'all') {
      const progress = getProgress(course);
      if (filter.learningStatus === 'not-started' && progress > 0) {
        return false;
      }
      if (filter.learningStatus === 'in-progress' && 
          (progress === 0 || progress === 100)) {
        return false;
      }
      if (filter.learningStatus === 'completed' && progress < 100) {
        return false;
      }
    }
    
    // 日期范围过滤
    if (filter.dateFrom || filter.dateTo) {
      const createdDate = new Date(course.createdAt);
      if (filter.dateFrom && createdDate < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && createdDate > filter.dateTo) {
        return false;
      }
    }
    
    return true;
  });
}
```

### 5.3 导入/导出实现

```typescript
// 导出课程
async function exportCourses(
  courseIds: string[],
  format: 'json' | 'csv',
  includeFullData: boolean
) {
  const db = new LexiTypeDB();
  const courses = await db.courses.bulkGet(courseIds);
  
  if (format === 'json') {
    const data = includeFullData 
      ? courses
      : courses.map(c => ({
          title: c.title,
          description: c.description,
          difficulty: c.difficulty,
          lessons: c.lessons.map(l => ({
            content: l.content,
            translation: l.contentTranslation
          }))
        }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });
    downloadFile(blob, 'courses-export.json');
  } else {
    // CSV格式
    const csv = convertToCSV(courses);
    const blob = new Blob([csv], { type: 'text/csv' });
    downloadFile(blob, 'courses-export.csv');
  }
}

// 导入课程
async function importCourses(file: File) {
  const content = await file.text();
  let courses: Course[];
  
  if (file.name.endsWith('.json')) {
    courses = JSON.parse(content);
  } else if (file.name.endsWith('.csv')) {
    courses = parseCSV(content);
  } else {
    throw new Error('不支持的文件格式');
  }
  
  // 验证数据
  const validCourses = courses.filter(course => {
    try {
      validateCourse(course);
      return true;
    } catch (error) {
      console.error(`Invalid course: ${course.title}`, error);
      return false;
    }
  });
  
  // 检测冲突
  const db = new LexiTypeDB();
  const existing = await db.courses.toArray();
  const existingTitles = new Set(existing.map(c => c.title));
  
  const conflicts = validCourses.filter(c => 
    existingTitles.has(c.title)
  );
  
  if (conflicts.length > 0) {
    // 显示冲突解决对话框
    const resolution = await showConflictDialog(conflicts);
    // 根据用户选择处理冲突
  }
  
  // 导入课程
  const coursesToImport = validCourses.map(course => ({
    ...course,
    id: generateId(),
    source: {
      type: 'imported' as const,
      importedFrom: file.name
    },
    permissions: PERMISSION_RULES.imported,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }));
  
  await db.courses.bulkPut(coursesToImport);
  
  return {
    success: coursesToImport.length,
    failed: courses.length - validCourses.length,
    conflicts: conflicts.length
  };
}
```

---

## 6. 实施计划

### 阶段 1: 数据模型升级（1-2天）
- [ ] 扩展 Course 接口
- [ ] 实现权限规则
- [ ] 编写数据库迁移脚本
- [ ] 迁移现有课程数据

### 阶段 2: 核心UI组件（3-4天）
- [ ] 侧边栏分类导航
- [ ] 高级筛选面板
- [ ] 三种视图模式（卡片/列表/表格）
- [ ] 课程详情抽屉
- [ ] 批量操作工具栏

### 阶段 3: 交互功能（2-3天）
- [ ] 筛选逻辑实现
- [ ] 虚拟滚动优化
- [ ] 拖拽排序
- [ ] 右键菜单
- [ ] 快捷键支持

### 阶段 4: 导入/导出（2-3天）
- [ ] 导入向导
- [ ] 导出对话框
- [ ] 格式转换（JSON/CSV/XML）
- [ ] 冲突检测和解决

### 阶段 5: 测试与优化（2-3天）
- [ ] 性能测试（1000+课程）
- [ ] 交互测试
- [ ] 权限控制测试
- [ ] Bug修复
- [ ] 文档完善

**总计**: 10-15天

---

## 7. 验收标准

### 7.1 功能完整性
- [ ] 所有课程正确分类显示
- [ ] AI生成课程不可编辑
- [ ] 用户创建课程可编辑
- [ ] 筛选功能正常工作
- [ ] 批量操作正常执行
- [ ] 导入/导出功能正常

### 7.2 性能指标
- [ ] 1000个课程时列表渲染 < 1秒
- [ ] 筛选响应时间 < 200ms
- [ ] 滚动流畅（60fps）
- [ ] 内存占用 < 300MB

### 7.3 用户体验
- [ ] 界面清晰直观
- [ ] 操作反馈及时
- [ ] 错误提示友好
- [ ] 支持键盘快捷键
- [ ] 响应式布局适配

---

## 8. 未来扩展

### 8.1 短期（1-2个月）
- 课程收藏和书签
- 课程分享链接生成
- 学习路径推荐
- 课程评分和评论

### 8.2 中期（3-6个月）
- 协作编辑（多人共同编辑课程）
- 版本控制（课程历史版本）
- 课程市场（公开分享）
- 课程模板库

### 8.3 长期（6-12个月）
- AI智能推荐课程
- 自适应学习路径
- 社区贡献课程
- 课程认证系统

---

**文档版本**: 1.0  
**最后更新**: 2025-12-08  
**下一步**: 开始实施阶段1
