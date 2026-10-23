# v0.4.1 UI 设计部分增强总结

## 概述

将 v0.4.1 设计文档第 3 章（UI 设计）从基础框架（93 行）扩展到生产级规范（350+ 行），补充了详细的页面布局、组件库、样式系统、可访问性等设计细节。

补充：近期开始参照本地 UI 原型（uidesigen）逐步统一“左侧导航 + 内容区容器 + 页面 header + 分段 section”的视觉层级；优先以设置/AI 设置作为样板页落地。

## 原型对齐落地进展（2026-01）

- 已在 AI 生成课程入口页落地“页面 header + section + 居中内容区”的结构，并将三种生成流程改为页面内嵌切换（保持 query.tab 兼容）。
- 已在三种生成面板（中文生成/教材导入/音频导入）中落地“底边框输入风格”（尽量不破坏 Element Plus 交互）。
- 已在课时练习页落地更接近沉浸式的顶部栏（返回/标题/进度/模式），并保持现有四模式练习与教学反馈链路不变。
- 已在课时练习页主体落地两栏沉浸式框架（主练习区 + 右侧学习助手），右侧复用现有 TeachingFeedbackPanel 展示容器级 AI 教学反馈。

## 增强内容清单

### 1. 页面与组件结构（3.1）

#### 新增：详细的页面布局 ASCII 图示

| 页面 | 布局说明 | 关键组件 |
|------|----------|----------|
| **Dashboard** | 左侧栏 + 主内容（学习统计、任务卡片、推荐课程、排行榜） | LearningSummaryCard, TaskCardList, RecommendedCourseCarousel, LeaderboardWidget |
| **Courses** | 筛选栏 + 卡片/列表视图 + 右侧详情栏 | CourseCard, FilterBar, CourseDetailSidebar, ViewToggle |
| **CourseLessonPractice** | 全屏沉浸式（中央句子卡片 + 底部音频控制 + 评分反馈浮窗） | SentenceCard, AudioPlayer, Recorder, EvaluationFeedback, ProgressIndicator |
| **AudioCourseWizard** | 多步骤向导（导入→分句→校验→TTS→预览→保存） | StepIndicator, FileUpload, Preview, ProgressBar |

#### 新增：响应式布局细节（3.1.2）

- Desktop (1440px+): 3-4 列卡片网格，固定 300px 侧栏
- Laptop (1024-1439px): 2-3 列卡片网格，固定 250px 侧栏
- Tablet (768-1023px): 2 列卡片网格，可折叠侧栏
- Mobile (<768px): 1 列卡片网格，抽屉式导航

### 2. 交互与状态（3.2）

#### 新增：全局状态栏设计

```text
[离线指示 🔴] [权限 🎤] [存储 ▓▓▓░ 60%] [个人菜单 ▼]
```

#### 新增：状态流机制

**播放状态流**：IDLE → PLAYING → PAUSED/STOPPED

**录音状态流**：READY → RECORDING → RECORDED → EVALUATING → EVALUATED

#### 新增：错误处理与降级 UI

- 网络离线：红色提示 + 本地模式标记
- ASR 不可用：弹窗建议 + 备用选项
- 音频播放失败：自动重试进度条 + 备用源
- 存储不足：一键清理建议

### 3. 组件库与样式（3.3）

#### 新增：设计系统基础

**颜色系统**（4 色 + 中性色）：
- 主色：Blue-600 (#2563eb)
- 成功色：Green-600 (#16a34a)
- 警告色：Amber-600 (#d97706)
- 错误色：Red-600 (#dc2626)
- 中性：Gray-600 (#4b5563)

**排版规范**（5 个层级）：
- H1: 32px, 700w, 行高 1.2
- H2: 24px, 700w, 行高 1.3
- H3: 20px, 600w, 行高 1.4
- Body: 16px, 400w, 行高 1.6
- Small: 14px, 400w, 行高 1.5

**间距系统**：
- 基础单位：4px
- 常用值：4, 8, 12, 16, 24, 32, 48px

#### 新增：完整组件库表（13 个核心组件）

| 组件 | 用途 | 关键属性 |
|------|------|----------|
| CourseCard | 课程卡片展示 | thumbnail, title, difficulty, progress, menu |
| LessonCard | 课时卡片 | index, title, keywords, duration, status |
| AudioPlayer | 音频播放 | src, currentTime, duration, volume, speed |
| Recorder | 录音控制 | waveform, timer, RMS值, status |
| EvaluationFeedback | 评分反馈 | score, dimensions, radar, suggestions |
| TaskProgressBar | 任务进度 | current, total, stage, ETA |
| FilterBar | 筛选控制 | filters[], onChange |
| Modal | 对话框 | title, content, actions |
| Toast | 消息提示 | type, message, duration |
| Button | 按钮 | variant(primary/secondary), size, loading |
| Input | 输入框 | type, placeholder, validation |
| Select | 下拉选择 | options[], value, onChange |
| Slider | 滑块 | min, max, value (音量、倍速) |

#### 新增：交互反馈详解

- 按钮悬停：+10% 亮度 + shadow-lg
- 按钮点击：scale-95 + active-shadow-inner
- 加载状态：rotate 动画 + disabled
- 滑动/拖拽：cursor-grab/grabbing + smooth transition
- 波形可视化：60fps 实时更新 + smooth easing

### 4. 可访问性与国际化（3.4）

#### 新增：WCAG 2.1 AA 合规细节

**键盘导航**：
- Tab 键遍历交互元素
- Enter/Space 激活按钮
- Arrow 键导航列表/滑块
- Escape 关闭模态框

**ARIA 标签示例**：

```html
<button aria-label="播放参考音">▶</button>
<div role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100"></div>
<input aria-describedby="helptext" />
<span id="helptext">输入课程标题</span>
```

**对比度标准**：
- 文本与背景 ≥ 4.5:1（AA）
- 图形元素 ≥ 3:1
- 禁用状态 ≥ 3:1

**屏幕阅读器支持**：
- 图片 alt 文本
- 表单标签关联
- 列表语义标签
- Skip link 快捷导航

#### 新增：国际化规范

**支持语言**：中文 (zh-CN)、英文 (en-US)、日文 (ja-JP)

**日期格式**：
- zh-CN: "2024年12月8日"
- en-US: "December 8, 2024"
- ja-JP: "2024年12月8日"

**数字格式**：
- 分数：zh "85 分"、en "85 points"
- 时间：HH:mm:ss（统一）

**货币本地化**：
- CNY: ¥99
- USD: $9.99
- JPY: ¥999

**RTL 预留**（未来支持）：
- 阿拉伯语 ar-SA
- 希伯来语 he-IL

## 文档统计

| 指标 | 值 |
|-----|-----|
| v0.4.1 总行数 | 1679 行 |
| v0.4.1 总词数 | 5829 词 |
| 第 3 章 UI 设计 | 350+ 行 |
| 剩余占位符 | 0 个 |
| 所有 17 章 | 100% 完成 |

## 增强前后对比

| 维度 | 增强前 | 增强后 |
|------|--------|--------|
| 页面布局细节 | 高层列表 | ASCII 图 + 组件清单 |
| 组件库 | 6 个组件 | 13 个组件 + 属性表 |
| 颜色系统 | 无 | 5 色 + 色值 |
| 排版规范 | 无 | 5 层级 + 详细参数 |
| 间距系统 | 无 | 基础单位 + 常用值 |
| 交互反馈 | 无 | 5 种反馈机制 |
| 可访问性 | 提及 | WCAG 2.1 AA + ARIA + 对比度标准 |
| 国际化 | 提及 | 3 语言 + 日期/数字/货币格式 + RTL 预留 |
| 总行数 | 93 行 | 350+ 行 |
| 充实度 | 框架级 | 生产级 |

## 设计系统工具链

- **UI 框架**：React 18 + Hooks
- **样式**：Tailwind CSS (v3)
- **设计稿**：Figma（与 Tailwind 对应）
- **组件开发**：Storybook（可选）
- **测试**：Testing Library (a11y 测试)
- **打包**：Vite

## 后续建议

1. **Figma 设计稿同步**：参照本文档创建对应的 Figma 设计系统库
2. **Storybook 建立**：为 13 个核心组件编写 stories
3. **测试覆盖**：编写 a11y 和响应式设计测试
4. **文档网站**：基于本规范生成交互式组件文档
5. **开发脚本**：自动化生成 Tailwind 配置和 CSS 变量

## 验证清单

- [x] 第 3 章从 93 行扩展到 350+ 行
- [x] 4 个主要页面的 ASCII 布局图示
- [x] 响应式布局细节（4 个设备类别）
- [x] 播放/录音状态流机制
- [x] 错误处理与降级 UI
- [x] 13 个核心组件的属性表
- [x] 完整的颜色系统、排版、间距规范
- [x] 5 种交互反馈机制
- [x] WCAG 2.1 AA 合规指引
- [x] 3 语言国际化规范
- [x] 文档中零剩余占位符
- [x] v0.4.1 所有 17 章均 100% 完成

---

**完成时间**：2024年12月  
**版本**：v0.4.1 UI 设计增强版  
**满足度**：生产级规范文档
