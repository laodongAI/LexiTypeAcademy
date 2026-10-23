# 功能任务总览

| 序号 | 任务 | 当前状态 | 说明 |
| --- | --- | --- | --- |
| 1 | 需求拆分与依赖顺序 | 进行中 | 顶层拆分文档已成型（本页与 `ROADMAP.md`），待结合最新需求做节奏复盘 |
| 2 | 课时拆分与数据模型更新 | 待开始 | 拆分句子/单词 lesson，音频/课程去重，ASR 长短通道，迁移前 stopPlayback，异常回滚 |
| 3 | UI/交互与听写入口重构 | 已完成 | `CourseManager` 拆分「单词/句子读写」「听力练习」按钮，DictationModal 具备侧边反馈、语速、错误提示并在入口侧输出条目统计 |
| 4 | 原音播放复用与 Hook | 已完成 | `useOriginalAudioPlayback` + `originalAudioRegistry` 统一缓存原音；`stopAllPlayback` 在模式切换时强制清理音频，Shadowing/Dictation 均复用原音切片 |
| 5 | 跟读与 ASR 双通道优化 | 进行中 | `useShadowingWorkflow` + `useSpeechEngine` now run auto recording, silence-stop, instant playback, and scoring; original-audio priority + debug logging still pending |
| 6 | 调试/日志与模式防串音 | 已完成 | `Shadowing` 时间轴日志 + Dictation/入口统计、`stopAllPlayback` 统一串音控制，所有节点写入 electron.log 便于定位性能瓶颈 |
| 7 | 跟读自动化体验优化 | 已完成 | Manual buttons removed; Shadowing flow now auto-links prompt, demo, recording, silence auto-stop, playback, scoring, and threshold feedback with live UI hints |
| 8 | 单词/句子读写拆分 | 已完成 | `CourseManager` 拥有「单词读写」「句子读写」入口，聚合所选课程生成练习队列并打开独立 DictationModal（原音切片 + TTS 双通道），旧“听写”模式彻底移除 |
| 9 | 听写界面回滚与模式统一 | 已完成 | 批量入口直接打开新的 DictationModal（含听写与跟读双模式、原音优先 + 录音评测），保留原 UI 布局与日志体系 |

## 统一实施计划

1. **需求拆分与依赖顺序**  
	- 四大模块：课时拆分 → UI/交互更新 → 原音播放复用 → 跟读逻辑。  
	- 先改数据层，后更前端消费逻辑，最后统一日志与性能策略。

2. **课时拆分与数据模型**  
	- `audioCoursePipeline.ts` / `courseFactory.ts`：导入含句子+单词的课程时生成 sentence+word 两个 lesson，并扩展 `lesson.type` 或 `sourceSubtype`。  
	- `courseStore`：一次性迁移旧课程，拆分 lesson、保留原音路径，异常时回滚并写入日志，迁移或课程切换前调用 `stopPlayback` 防残留音频。  
	- 去重策略：  
	  * 原音导入前计算 checksum，遇到重复（同课程同文件名/校验值）提供覆盖、跳过或另存提醒并记录。  
	  * 生成课程前采用 `title + duration + sentence hash` 检测，重复课程提示覆盖或版本化。  
	  * 拆分时对句子/单词文本（含时间戳）去重，冗余合并并输出 WARN。  
	- ASR 双通道：  
	  * `recognizeLongFile`：现有 ASR + VAD + 分句，继续用于音频导入。  
	  * `recognizeShortUtterance`：轻量版本用于跟读/短句评测，跳过分句提升性能。  
	  * 全部调用记录耗时和模型信息，写入调试日志。

3. **课程详情与编辑界面**  
	- `CourseEditor`、`CourseLessonPractice`、详情页按 lesson 类型渲染。  
	- 句子课时：展示原文、翻译、关键词，并提供基于时间戳的原音试听。  
	- 单词课时：沿用现有词表编辑与 TTS 播放。  
	- 支持在课程导航中按类型切换，并显示重复检测警告。  
	- 所有操作包裹 try/catch，错误写 `electron.log` 并以非阻断提示反馈。

4. **听写/听力入口重构**  
	- `CourseManager`：替换旧单一“听写”按钮为「单词读写」「句子读写」「听力练习」。  
	- 单词读写：聚合所有单词课时并逐词调用 TTS/缓存录音，提供拼写 + 朗读双向练习。  
	- 句子读写：聚合句子课时，优先使用时间戳原音切片，支持文本填写 + 朗读检验。  
	- 入口在数据缺失（无句子/无单词）时提示用户，并在调试模式输出条目统计与原音命中率。  
	- 模式切换必须立即调用 `cancelAllSpeechPlayback()`，防止多路音频叠加。
	- **当前实现**：`CourseManager` 入口按钮已上线，`DictationModal` 统一处理单词/句子模式，右侧包含原音播放、语速、答案、输入/比对和错误高亮；模式打开时立即预加载原音切片并统计条目数量。  

5. **原音播放复用与 Hook**  
	- `audioSource.ts` / `audioPlayback.ts`：实现课程级缓存、统一错误处理和调试日志，避免重复 `decodeAudioData`。  
	- 提取 `useOriginalAudioPlayback` Hook（或工具），封装“有时间戳→原音、否则→TTS”逻辑，供 CourseLessonPractice/详情页/听写/听力/跟读复用。  
	- 在句子/课程切换、模式切换、键盘导航（左右句子、上下课程）前统一执行 stop 并清理状态。
	- **当前实现**：`originalAudioRegistry` + `useOriginalAudioPlayback` 负责缓存/复用原音与切片，命中率、缓存大小、播放来源写入调试日志；`stopAllPlayback` 服务在 Dictation/Shadowing 打开、课程切换与导入完成时统一清理音轨。  

6. **跟读与 ASR 双通道**  
	- `useShadowingWorkflow` / `ShadowingModal`：  
	  * `ShadowingItem` 增加 `sourceType` / `hasOriginalAudio`。  
	  * 引入严格状态机（提示 → 播放 → 倒计时 → 录音 → 评估 → 反馈），自动推进下一句。  
	  * 句子项强制使用原音切片，失败才回退并 WARN；单词项保持 TTS。  
	  * 跟读期间使用 `recognizeShortUtterance`，减少等待。  
	  * 保留键盘控制：左右切换句子、上下切换课程单元；减少界面点击（自动开始/结束录音、自动下一句）。  
	- 录音/播放/模式切换前统调用 `cancelAllSpeechPlayback()`，避免串音。

7. **调试/日志与模式防串音**  
	- 引入 `isDebug` 标记（或复用现有 dev flag）控制日志量。  
	- 必需日志：课时拆分、重复检测、听写数据统计、音频播放来源、缓存命中、ASR 通道耗时、状态机流转。  
	- 所有 try/catch 写入 `electron.log`，UI 以 toast/提示反馈。  
	- 听写↔跟读切换、句子/课程跳转、手动播放/录音前统一 `cancelAllSpeechPlayback()` 并重置状态，确保当前模式独占音频输出。
	- **当前实现**：Dictation 入口在打开时输出 `selectedCourseCount`、`wordCount`、`sentenceCount`、原音命中率；`playbackController` 记录 stop 调用来源；Shadowing/Dictation 的业务日志和异常通过 Electron bridge 写入 `electron.log`，用于定位串音与性能问题。  

8. **执行顺序（对应 Todo）**  
	1. **Design implementation plan**：巩固上述计划并细化里程碑。  
	2. **Implement lesson splitting & data model updates**：修改导入管线、迁移/去重逻辑和 ASR 服务接口。  
	3. **Update UI flows**：更新编辑/详情/听写入口，融入播放 Hook 和模式防串音。  
	4. **Enhance shadowing playback logic**：套用严格状态机、短句 ASR、原音播放与调试日志。

9. **单词/句子读写拆分实施结果**（已发布）  
	1. **入口调整**：`CourseManager` 现在提供「单词读写」「句子读写」「跟读训练」独立按钮，批量选择课程后可分别启动。  
	2. **数据聚合层**：
		- 单词读写：遍历所选课程词表，缺失音频时即时调用 `ttsManager.synthesizeToFile` 补齐并回写 `courseStore`。  
		- 句子读写：优先消费 `segments`/`sentences` 的时间戳 + 原音 URL，无法命中时生成句子级 TTS。  
	3. **练习容器**：`DictationModal` 组件恢复为主承载，内置听写/跟读双视图、语速切换、原音优先播放与录音评分；句子模式自动走原音切片，无法命中时回落至 TTS。  
	4. **评测与记录**：内置文本比对 + Diff，标记每条是否正确并在侧边栏高亮；保留语速切换与 Answer 显示开关。  
	5. **收尾与迁移**：`ShadowingModal` 仅保留跟读状态机，旧“听写” tab、语音 TTS fallback 逻辑已删除；文档与路线图同步更新。  
	6. **调试与文档**：保留错误 toast + console 提示，后续可在 `electron.log` 中追加统计；本页记录最终结构，便于后续复盘。

10. **听写界面回滚任务说明**（完成）  
	1. **需求背景**：单词/句子按钮仅负责构建数据列表，练习 UI 应维持原“听写模式/跟读模式”双视图，DictationModal 替换的全屏交互需撤销。  
	2. **影响范围**：`CourseManager` 负责聚合条目并触发弹窗，`DictationModal` 重新接管体验；`playbackController` 与 `originalAudioRegistry` 继续负责停播与缓存。  
	3. **实施结果**：  
		- 批量入口改为直接打开 `DictationModal`，无需跳转 `WordLessonPractice` / `CourseLessonPractice`。  
		- 弹窗同时支持听写与跟读：听写提供输入校验 + Diff，跟读走统一语音引擎，得分≥85 自动标记完成。  
		- 支持语速切换、原音优先播放、录音回放，以及键盘左右切换条目；日志继续写入 `[DictationPrep]`。  
	4. **后续观察**：多音频课程的原音命中率与长列表性能需要在后续批量导入中持续验证，如遇卡顿再做分批渲染。  
