# 设计修正报告 v0.4.1
**日期**: 2025-01-17  
**由**: 用户反馈  
**涉及**: 跟读交互 & 教材导入架构  

---

## 修正概览

在完成 v0.4.0 产品设计规范后，用户指出了两个**核心设计错误**，已在本次修正中彻底解决。

| 修正项 | 原设计 | 新设计 | 文档位置 | 状态 |
|-------|-------|-------|---------|------|
| **跟读交互** | 录音 → ASR 评测 | 录音 → 自动回放 → ASR 评测 | 3.3.2 | ✅ 已完成 |
| **教材导入** | 用户粘贴文本 | AI 逐步查询导航 | 3.3.5 | ✅ 已完成 |

---

## 修正 1：跟读交互增强

### 用户需求
> "在跟读这个练习方式上面，我们要增加用户的交互感，在有基础之上我们应该录音后自动回放出来用户的读音，让用户听到自己的读音，有一种亲切的感觉。"

### 修正内容

**文档位置**: `docs/requirements/english-learning-requirements-v0.4.0.md` - 第 3.3.2 练习流程

**修正前**：
```
1. 显示句子
2. 播放示范音频
3. 用户录音
4. ASR 评测 ← 直接评测，没有回放
5. 反馈结果
```

**修正后**：
```
1. 显示句子（英文+音标+翻译隐藏）
2. 播放示范音频（标准发音）
3. 用户长按录音（或手动停止录音）
4. ✨ 自动回放用户录音（新增交互）
   - 回放完毕后自动进入 ASR 评测
   - 用户可点击"重新听"重复回放
   - 用户可点击"不需要回放"跳过此步直接评测
5. 评估中（loading 动画）
6. 结果反馈（得分、错误高亮）
7. 自动推进下一句或重试
```

### UX 改进点

1. **增强自觉性**: 用户听到自己的录音，能更直观地发现发音问题
2. **优化信心**: "原来我的发音是这样"，增加学习动力
3. **灵活交互**: 支持重新听、跳过回放等选项，满足不同用户需求
4. **心理学**: 类似"照镜子"的效果，增加课程的趣味性和参与度

### 技术实现建议

```typescript
// 跟读流程中的回放状态管理
interface FollowAlongState {
  currentPhase: 'display' | 'playing_reference' | 'recording' | 'playing_user_recording' | 'evaluating' | 'feedback';
  
  // 录音数据
  userRecordingData: AudioBuffer;
  userRecordingUrl: string;
  
  // 回放状态
  isPlayingUserRecording: boolean;
  canSkipPlayback: boolean;
  canReplayUserRecording: boolean;
}

// 回放完成后自动进入评测
async function playUserRecordingAndEvaluate(audioBuffer: AudioBuffer) {
  // 1. 播放用户录音
  await playAudio(audioBuffer, { onComplete: () => {
    // 2. 回放完毕，自动触发 ASR 评测
    evaluateUserRecording(audioBuffer);
  }});
}
```

---

## 修正 2：教材导入架构完全重设

### 用户需求
> "教材生成，你这块理解错误，它应该是全程调用 AI 模型去查询。首先我不是提供了一些出版社，然后调用 AI 去查询这些出版社有哪些英语课程的系列..."

### 修正内容

**文档位置**: `docs/requirements/english-learning-requirements-v0.4.0.md` - 第 3.3.5 智能教材导入流程

**修正前** ❌：
- 用户粘贴文本（PEP 格式 / CSV / PDF）
- 系统解析文本
- 用户选择单元
- 生成课程

**修正后** ✅：
- 用户选择出版社 (人教版/外研版/剑桥/新概念等)
- **AI 查询该出版社的课程系列** (如 PEP 小学英语 Grade 3-6)
- 用户选择课程系列
- **AI 查询该系列的单元列表** (Unit 1-12 + 标题 + 内容概览)
- 用户选择单元
- **AI 生成完整课程对象** (词汇、句子、对话、难度、标签等)

### 用户导航流程图

```
┌─────────────────────────────────┐
│  第 1 步：选择教材出版社        │
│  ☐ 人教版 (PEP)                │
│  ☐ 外研版 (FLTRP)              │
│  ☐ 剑桥英语 (Cambridge)        │
│  ☐ 新概念英语 (New Concept)    │
│  [下一步]                      │
└─────────────────────────────────┘
          ↓
┌─────────────────────────────────┐
│  第 2 步：AI 查询课程系列       │
│  "正在查询人教版课程系列..."   │
│  ☐ PEP 小学英语 (Grade 3-6)   │
│  ☐ PEP 初中英语 (Grade 7-9)   │
│  ☐ PEP 高中英语 (Grade 10-12) │
│  [选择]                        │
└─────────────────────────────────┘
          ↓
┌─────────────────────────────────┐
│  第 3 步：选择课程级别          │
│  PEP 小学英语 Grade 3           │
│  ☐ Unit 1 - Numbers            │
│  ☐ Unit 2 - Colors             │
│  ☐ Unit 3 - Family             │
│  [选择]                        │
└─────────────────────────────────┘
          ↓
┌─────────────────────────────────┐
│  第 4 步：AI 生成课程            │
│  "正在从 Unit 1 生成课程..."   │
│  ✓ 词汇课 (Unit1-words)        │
│  ✓ 句子课 (Unit1-sentences)    │
│  ✓ 对话课 (Unit1-dialogue)     │
│  [保存课程]                    │
└─────────────────────────────────┘
```

### 核心优势

| 维度 | 原方式（粘贴文本） | 新方式（AI 查询） |
|------|------------------|------------------|
| **输入方式** | 用户粘贴文本 | AI 在线查询 |
| **出版社支持** | 仅 PEP 文本解析 | 支持主流出版社 |
| **交互方式** | 一步完成 | 四步导航 |
| **内容获取** | 用户提供 | AI 自动查询 |
| **可靠性** | 依赖文本格式 | 依赖 AI 模型 |
| **更新频率** | 无法更新 | 持续学习新课程 |

### 技术实现建议

**API 接口设计**：

```typescript
// 第 2 步：查询出版社的课程系列
async function queryPublisherCurricula(publisher: string): Promise<{
  name: string; // e.g., "PEP 小学英语"
  grades: string[]; // e.g., ["Grade 3", "Grade 4", ...]
  description?: string;
}[]> {
  // 调用 LLM 查询出版社信息
  const prompt = `列出${publisher}的所有英语课程系列及其涵盖的年级范围`;
  return await gptQuery(prompt);
}

// 第 3 步：查询课程系列的单元列表
async function queryUnitsByCurricula(
  publisher: string,
  curriculum: string
): Promise<{
  unitId: string; // e.g., "Unit 1"
  title: string; // e.g., "Numbers"
  description?: string;
  keywords: string[]; // e.g., ["one", "two", "three"]
}[]> {
  // 调用 LLM 查询单元列表
  const prompt = `列出${publisher}${curriculum}的所有单元及其标题`;
  return await gptQuery(prompt);
}

// 第 4 步：从单元生成课程
async function generateCourseFromUnit(
  publisher: string,
  curriculum: string,
  unitId: string,
  options?: {
    includeVocabulary?: boolean; // 生成词汇课
    includeSentences?: boolean; // 生成句子课
    includeDialogue?: boolean; // 生成对话课
    enrichWithAI?: boolean; // AI 扩展音标/例句
  }
): Promise<Course> {
  // 调用 LLM 生成课程对象
  const prompt = `从${publisher}${curriculum}${unitId}的内容生成英语课程对象，格式为 {words: [...], sentences: [...], dialogues: [...]}`;
  return await gptQuery(prompt);
}
```

### 代码复用策略

**可复用的现有代码** (来自 `src_bak/services/pepImportService.ts` 和 `src_bak/services/courseFactory.ts`):

- `buildCourse()` - 课程对象构建
- `buildLesson()` - 课时对象构建
- `buildWordEntry()` - 单词条目构建
- `validateCourse()` / `validateLesson()` - 数据验证

**新增的 AI 查询代码**:

- `queryPublisherAPI()` - 查询出版社列表
- `queryCurriculaAPI()` - 查询课程系列
- `queryUnitsAPI()` - 查询单元列表
- `generateCourseFromUnitContent()` - 从单元内容生成课程

---

## 更新清单

### 文档更新 ✅
- [x] 3.3.2 练习流程：添加录音回放步骤
- [x] 3.3.5 课程导入：从文本粘贴改为 AI 查询导航

### 代码更新 📋
- [ ] AILab.tsx: PEP 导入模式改为出版社/系列/单元选择
- [ ] 新增 publisherQueryService.ts: AI 出版社/课程查询
- [ ] courseFactory.ts: 复用现有构建函数
- [ ] 跟读组件: 添加录音回放功能

### 用户反馈 📝
> "我建议这部分你可以去找一下原来的代码，原来代码是完全可以复用的。这块功能做的是比较完善。"

**启示**: 原有代码库中已有成熟的出版社/课程查询实现，应找出并复用，而非全新编写。

---

## 下一步行动

### 高优先级 (P0)
1. 搜索原有的出版社/课程查询代码 (可能在 `src/` 而非 `src_bak/`)
2. 分析原实现模式，提取可复用部分
3. 更新 AILab.tsx 的 PEP 导入部分，改为出版社选择 → AI 查询流程
4. 实现跟读组件的录音回放功能

### 中优先级 (P1)
5. 新增 publisherQueryService.ts，提供标准化的 API 接口
6. 编写跟读和教材导入的端到端测试用例
7. 在 AILab.tsx 中添加 loading 状态和错误提示

### 低优先级 (P2)
8. 优化 AI 查询性能 (缓存、防抖、分页)
9. 添加离线模式支持 (预制教材列表)
10. 用户反馈：记录查询失败案例，改进 Prompt 工程

---

## 相关文档引用

- **原 v0.4.0 规范**: `docs/requirements/english-learning-requirements-v0.4.0.md`
- **产品经理集成总结**: `docs/requirements/PRODUCT_MANAGER_REVIEW_INTEGRATION_SUMMARY.md`
- **代码库位置**:
  - 跟读逻辑: `src/app/pages/FollowAlongPractice/`
  - 教材导入: `src_bak/components/AILab.tsx` (lines 442-592)
  - 课程工厂: `src_bak/services/courseFactory.ts`
  - PEP 解析: `src_bak/services/pepImportService.ts`

---

**修正完成日期**: 2025-01-17  
**审核状态**: ✅ 文档修正完成，代码实现待进行  
**下次审核**: 代码实现完成后进行端到端测试
