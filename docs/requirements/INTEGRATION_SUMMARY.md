# v0.4.0 功能需求融合集成总结

**更新时间**：2025-12-08  
**版本**：v0.4.0  
**主文档**：`english-learning-requirements-v0.4.0.md`（729 行，33.21 KB）

---

## 📌 核心融合点

本次迭代将现有四个主要组件与新需求进行了深度整合：

### 1️⃣ 英语课程模块融合
- **CourseManager** + **AudioCourseWizard** + **PEP 导入**
- 学习中心作为统一入口，支持 `type='audio'/'mixed'` 的课程展示与过滤
- AudioCourseWizard 保留五步流程，新增 RMS 静音检测自动跳过
- PEP 教材解析在 AI 实验室新增「教材粘贴」卡片，复用三步解析逻辑

### 2️⃣ AI 实验室扩展
- 首页快捷卡片统一入口：上传音频建课、粘贴教材文本、扩写单词表
- 新增任务中心：统一管理 AudioCourseJob，显示进度条、日志、取消/重试
- 失败任务自动标记原因（ASR 模型加载失败等）

### 3️⃣ 复习模块智能化
- 错题自动来源：score < 80 的句子 + ASR 置信度 <0.3 的无效录音
- 补救课自动生成：使用统一 courseFactory.buildCourse()，自动关联原课程 ID
- 支持在复习模块和 AI 实验室同时展示与追踪

### 4️⃣ 学习仪表盘可视化
- 技能雷达图：accuracy/fluency/completeness 三维评分
- 每日热力图：IndexedDB recordedAt 字段聚合
- 成就勋章：基于 taskManager 事件触发

---

## 🔧 技术实现对齐

| 能力 | 原始实现 | v0.4.0 优化 | 文件位置 |
|------|---------|-----------|---------|
| 课程结构 | course.ts | 完全复用，type 新增 'audio'/'mixed' | domain/models/course.ts |
| 音频存储 | data/audio/{courseId}/{lessonId}/file.ext | 不变，但播放使用时间戳定位 | infrastructure/storage |
| 分句算法 | segmentation.ts | 增强：自动跳过 RMS<-60dB 静音段 | domain/services/audioSegmentation.ts |
| 词汇提取 | vocabularyExtractor.ts | 复用，限制 ≤50 词防信息过载 | domain/services/vocabularyExtractor.ts |
| 播放逻辑 | ShadowingModal.tsx | 升级：若无 audioUrl，调用 getSegmentAudioBuffer | app/components/PlaybackControl.tsx |
| 错误处理 | ErrorBoundary.tsx | 增强：捕获 DomainError 并友好提示 | app/components/ErrorBoundary.tsx |
| 进度跟踪 | progressService.ts | 新增 audioSegment 级别粒度记录 | domain/services/progressService.ts |
| 复习调度 | reviewService.ts | 新增补救课程自动关联与生成 | domain/services/reviewService.ts |

---

## 🎯 关键流程实现

### 流程 1：音频文件处理

```
上传 → ASR 转写 + 分句 → RMS 静音检测 → AI 翻译/词汇 → 统一结构生成 → 保存 metadata + timestamps
```

- **RMS 阈值**：-60dB（自动跳过）
- **生成时间**：<3s（总体）
- **输出格式**：data/audio/{courseId}/{lessonId}/main.mp3 + 元数据

### 流程 2：教材解析（PEP 导入）

```
选择教材体系 → AI 解析单元结构 → 勾选单元+课程类型 → AI 生成内容 → 自动加入课程列表
```

- **解析时间**：<1min
- **支持教材**：人教PEP小学 G1-G6
- **课程类型**：单词/句子/音标

### 流程 3：补救课程生成

```
错题识别（score<80 或 ASR<0.3） → 触发生成 → 使用 courseFactory.buildCourse(source='Remedial') → 自动关联原课程 ID
```

- **生成时间**：<5s
- **限流**：最多 5 并发
- **显示位置**：复习模块 + AI 实验室任务中心

---

## ✅ 验收标准（DoD）

### 功能验收

| 功能 | 验收条件 | 优先级 |
|------|----------|--------|
| 音频建课 | 上传 10min 音频 → 生成课程 → 播放流畅，静音自动跳过 | P0 |
| 教材解析 | 选择"人教PEP三年级上册" → 解析出 Unit 1-6 → 生成单词/句子课（≤1min） | P1 |
| 补救课 | 练习 5 句错题 → 自动生成专项课 → 在复习模块可见 | P1 |
| 课程导入/导出 | 导出 JSON 可被他人导入，数据完整无损 | P1 |
| 学习仪表盘 | 显示技能雷达图、每日热力图、成就勋章 | P2 |

### 性能验收

- **TTS 生成**：<2s/句
- **ASR 识别**：<3s/句
- **内存占用**：<200MB（5 门课程）
- **课程加载**：<1s
- **补救课生成**：<5s

---

## 📋 里程碑与交付物

### P0 最小闭环（2 周）
- ✅ AudioCourseWizard RMS 静音检测
- ✅ pepImportService 三步解析向导
- ✅ remedialCourseService 基础生成
- ✅ 跟读流程完整（播放→录音→评估→反馈）

### P1 复习与导入（4-6 周）
- ✅ ReviewManager 补救课程展示
- ✅ HistoryCharts 热力图 + 技能雷达图
- ✅ 课程导入/导出 JSON/XML
- ✅ TaskManager 进度监控 UI

### P2 体验提升（8-10 周）
- ✅ 内存优化（IndexedDB 改进）
- ✅ 成就勋章系统
- ✅ 排行榜（学习时长、练习句数）
- ✅ 课程分享与协作

---

## ⚠️ 风险控制

| 风险 | 控制措施 | 监控方式 |
|------|---------|---------|
| 音频文件过大 | 限制 <60min | 上传前验证 |
| 补救课延迟 | 限流 5 并发 + 异步生成 | 任务中心进度 |
| 数据不一致 | 原子性写入 + 事前检查 | 自动化测试 |
| 内存泄漏 | IndexedDB 监控（>80% 清理） | DevTools 监控 |
| 教材过时 | 定期更新（6 个月）+ 用户上传 | 版本管理 |

---

## 📚 相关文档

- **主文档**：`docs/requirements/english-learning-requirements-v0.4.0.md` （729 行）
- **参考设计**：
  - `docs/design/course-generation-system-design.md`（4 步 PEP 导入流程）
  - `docs/design/audio-services-design-v0.1.2.md`（4988 行，DDD 模式、5 个生产级优化）
  - `docs/design/architecture.md`（系统分层架构）
  - `docs/design/functionality-design.md`（组件级功能分析）

---

## 🚀 后续优先开发（Phase 10.8）

1. **AudioCourseWizard RMS 静音检测**
   - 实现 RMS<-60dB 自动跳过
   - 参考 audio-services-design 第 5 个优化点

2. **PEP 教材解析向导**
   - 复用现有 pepImportService 三步逻辑
   - 新增树形控件 + 多选矩阵 UI

3. **学习仪表盘可视化**
   - 扩展 HistoryCharts（热力图）
   - 新增技能雷达图 + 成就系统

4. **补救课程自动化**
   - 优化生成逻辑
   - 支持基于错误类型的针对性课程（发音纠正 → 音标课）
   - 实现 5 并发限流

---

**状态**：✅ 完成  
**下一步**：开发计划、代码实现、集成测试
