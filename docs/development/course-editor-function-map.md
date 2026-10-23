# 课程编辑器功能与代码映射

## 1. 入口与数据流概览
- **课程列表加载**：`src/components/CourseManager.tsx` 在组件挂载时通过 `listCourses()`（`src/services/courseStore.ts`）拉取 IndexedDB 中的所有课程，并写入 `courses` 状态供列表展示与筛选。
- **进入编辑界面**：点击“新建/编辑”后，`CourseManager` 设置 `editingCourse` 或 `isCreating`，并在 JSX 中渲染 `<CourseEditor />`（`src/components/CourseEditor.tsx`）。
- **保存动作回流**：`CourseEditor` 完成编辑后触发 `onSave(course)`，`CourseManager` 中的 `handleSaveEditedCourse` 调用 `saveCourse()` 持久化，随后再次执行 `listCourses()` 刷新列表。
- **数据模型**：课程、课时、词汇、句子等结构统一定义在 `src/models/course.ts`，包括 `PracticeMode`、`LessonContentType`、`WordEntry`、`Sentence` 等。

## 2. 课程编辑器功能模块

### 2.1 左侧：课程元数据与课时列表
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 课程基本信息录入 | 维护标题、描述、课程类型、难度的受控输入，并在 `handleSaveCourse` 中写入 `Course` 对象 | `CourseEditor` 顶部 `useState` + JSX 表单绑定 | 最终通过 `handleSaveCourse` → `onSave` → `saveCourse()` 持久化 |
| 启用练习模式选择 | 勾选听写/跟读/翻译/模仿模式，更新 `lessonModes`，在保存课时时写入 `Lesson.modesEnabled` | `lessonModes` 状态 + JSX checkbox（约第 150 行） | `handleSaveLesson`、`handleGenerateAudio` 中读取 |
| 课时列表展示与切换 | 依据 `lessons` 状态渲染卡片，点击设置 `activeLessonId`，`useEffect` 自动同步当前课时内容到编辑面板 | `lessons.map` 渲染块；`useEffect` 监听 `activeLessonId` | `setActiveLessonId`，内部同步 `lessonContent`、`lessonWords`、`lessonSentences` |
| 新增课时 | 依据当前课程类型推断 `lessonType`，构造空 `Lesson` 并插入列表 | `handleAddLesson` | 本地生成 `uuid()`；重置右侧编辑态 |
| 删除课时 | 弹窗确认后将目标课时移出 `lessons`，若当前课时被删则清空 `activeLessonId` | `handleDeleteLesson` | 仅在前端状态中操作；最终保存写入数据库 |

### 2.2 右侧：课时内容通用功能
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 课时类型切换 | 在“句子/词汇”之间切换，决定右侧面板显示的编辑器形式 | `lessonContentType` 状态 + 切换按钮 | 同时影响默认 `lessonType`、音频统计与按钮可用性 |
| 英文内容与中文翻译 | `textarea` 受控输入分别绑定 `lessonContent`、`lessonTranslation` | JSX 输入框（约第 250 行） | 数据在 `handleSaveLesson`/`handleSaveCourse` 时写回当前课时 |
| 保存当前课时 | 将正在编辑的临时字段合并回 `lessons` | `handleSaveLesson` | 更新 `lessons` 数组，提示“课时已更新” |
| 智能分句 | 基于 `smartSplitSentences` 将 `lessonContent` 切分为 `lessonSentences` | `splitIntoSentences` → `smartSplitSentences` | 按标点/长度进行二次拆分，确保句子列表初始值 |
| AI 翻译 + 关键词 | 组装句子列表并调用通用 AI 接口生成中文翻译与关键词，更新到 `lessonSentences` | `aiTranslateAndExtract` | `getAIConfig()` 读取配置 → fetch 调用 → 合并结果 |
| AI 解析单词 | 将课文内容拆句为 `SegmentItem`，调用 `extractVocabularyFromSegments` 自动生成高价值词汇列表 | `handleParseWords` | 构造时间戳段 → `extractVocabularyFromSegments`（`src/services/vocabularyExtractor.ts`） |
| AI 生成例句 | 给缺失例句的词汇批量补充例句与翻译 | `aiGenerateExamples` | 同样依赖 `getAIConfig()` 与通用 AI 接口 |

### 2.3 句子模式（`lessonContentType === 'sentence'`）
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 句子列表编辑 | `lessonSentences` 映射生成卡片，支持中英文本、关键词、标签输入 | `lessonSentences.map` 渲染块 | `updateSentence`、`addSentence`、`removeSentence` |
| 句子标签 | “重点句/难点句/范文句”多选框记录在 `Sentence.labels` | JSX checkbox 绑定 | 状态写回通过 `updateSentence` |
| 音频 URL 与播放 | 支持为每句录入/预览现有音频 | 输入框 + `▶️ 播放` 按钮 | `playAudio()` → `decodeToAudioBuffer()`/`getAudioContext()`（`src/services/audio/audioPlayback.ts`） |
| 音频统计 | `useEffect` 统计句子音频生成情况显示在面板上 | `setSentenceAudioStats` | 依赖 `lessonSentences` 状态自动刷新 |

### 2.4 词汇模式（`lessonContentType === 'word'`）
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 单词表编辑 | `lessonWords` 分页渲染（每页 10 条），可编辑拼写、音标、释义、翻译、例句 | `lessonWords.slice` 渲染块 | `handleAddWord`、`handleUpdateWord`、`handleDeleteWord` |
| 例句与例句音频 | 若存在例句可录入示例音频地址并播放预览 | 例句音频输入 + `▶️ 播放例句` | `playAudio()` |
| 音频统计 | 与句子类似，通过 `useEffect` 统计单词音频完成度 | `setWordAudioStats` | 数据来源 `lessonWords` |
| 分页控制 | 控制 `wordPage`，上一页/下一页按钮防抖 | Pagination JSX | `setWordPage` |

### 2.5 音频批量生成与播放
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 批量生成音频 | 将当前课程快照传给 `audioGenerationService.generateCourseAudio`，可选择仅生成缺失音频或全量覆盖 | `handleGenerateAudio` | `audioGenerationService`（`src/services/audioGenerationService.ts`）→ 内部 `ttsManager.synthesizeToFile` |
| 取消生成 | 通过 `cancelToken.isCancelled = true` 通知生成流程停止 | `handleCancelAudioGeneration` | `audioGenerationService` 在循环内读取 cancel token |
| 进度展示 | 使用 `showAudioProgress` 控制模态框，实时展示百分比、类型、内容、错误信息 | JSX 模态框（文件末尾） | `setAudioProgress` 回调来自 `audioGenerationService.generateCourseAudio` |
| 单条音频预览 | 句子和单词都可立即播放本地或远端音频 | `playAudio` | `decodeToAudioBuffer` + WebAudio |

### 2.6 课程预览与保存
| 功能 | 描述 | 代码入口 | 关键调用 |
| --- | --- | --- | --- |
| 课程级校验与保存 | 检查标题、课时数量，合并当前课时草稿，构造新的 `Course` 对象 | `handleSaveCourse` | 设置 `pendingCourse` 并展示预览模态 |
| 预览模态 | 按课时展示词汇/句子概览，用户确认后触发 `onSave(pendingCourse)` | `showPreview` + JSX 模态 | 关闭后回调 `CourseManager.handleSaveEditedCourse` → `saveCourse` |
| 取消编辑 | 点击“取消”按钮调用 `onCancel`，`CourseManager` 将 `editingCourse`/`isCreating` 复位 | 底部按钮区 | `onCancel` 由父组件注入 |

## 3. 关联服务与关键方法
| 服务/模块 | 位置 | 职责 | 主要导出 |
| --- | --- | --- | --- |
| AI 配置服务 | `src/services/aiService.ts` | 统一管理 API Key/Endpoint/Model，封装多种 AI 生成能力 | `getAIConfig`、`saveAIConfig`、`generateCourseContent`、`generateAdvancedCourse`、`translateToChinese` 等 |
| 词汇提取服务 | `src/services/vocabularyExtractor.ts` | 调用 AI 从段落中提取高价值词汇并转成 `WordEntry` | `extractVocabularyFromSegments(segments, options)` |
| 音频生成服务 | `src/services/audioGenerationService.ts` | 基于 `ttsManager` 为句子/单词批量生成音频，处理进度与取消逻辑 | `audioGenerationService.generateCourseAudio`、内部 `generateSentenceAudio` / `generateWordAudio` |
| 音频播放工具 | `src/services/audio/audioPlayback.ts` | 负责 WebAudio 解码、缓存与片段提取，供编辑器播放已存在的音频资源 | `decodeToAudioBuffer`、`getAudioContext`、`getSegmentAudioBuffer` |
| 课程存储服务 | `src/services/courseStore.ts` | IndexedDB + 旧数据迁移，提供课程 CRUD 操作 | `listCourses`、`saveCourse`、`deleteCourse`、`getCourseById` |
| 课程管理器 | `src/components/CourseManager.tsx` | 管理课程列表、筛选、批量操作，并负责调起 `CourseEditor` | `handleSaveEditedCourse`、`toggleSelection`、`handleImport` 等 |
| 课程模型定义 | `src/models/course.ts` | 声明 `Course`、`Lesson`、`WordEntry`、`Sentence`、`SegmentItem` 等结构与工具函数 | `ensureLessonSchema`、类型别名 |

## 4. 使用建议
1. **调试某个功能时**：先在本文件表格中定位到对应 handler，快速跳转到 `CourseEditor.tsx` 内部实现；若涉及 AI/音频等后台逻辑，再根据“关联服务”定位到 `services` 层文件。
2. **扩展功能**：新增功能应先在本文档中登记所在模块、入口函数与下游服务，保持追踪透明；实现时遵循项目约定（React Hooks + Tailwind、中文注释）。
3. **测试覆盖**：音频生成、AI 请求等异步流程需要在开发阶段准备可取消的测试场景，并确认 `audioGenerationService` 的 cancel token 和进度回调正常工作。
