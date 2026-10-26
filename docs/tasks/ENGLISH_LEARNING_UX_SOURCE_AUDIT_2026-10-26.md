# 英语学习核心体验源码初审（2026-10-26）

- 状态：STATIC_REVIEW；不是浏览器视觉验收。
- 范围：主干 `main` 上的 `UnitLearningPage.vue`、`LessonPracticePage.vue`、`ReaderStage.vue`、`useSpeechPlayer.ts` 与路由配置。
- 目的：为 `docs/design/english-learning-core-experience-restructure-v1.md` 提供可定位的源码线索，确定下一步实机检查重点。

## 发现

### SRC-01：AI 老师消息区会自动滚到消息列表底部

- 文件：`frontend/src/renderer/views/UnitLearningPage.vue`
- 证据：`scrollTeacherMessages()` 在 `nextTick()` 后把 `messagesRef.scrollTop` 设置为 `messagesRef.scrollHeight`；并监听 `teacherSession.value?.messages.length` 后调用该方法。
- 影响：消息追加时会强制跟随底部；这与用户反馈的“像网页一样要下拉/滚动”高度相关。需要在真实窗口确认主页面滚动与消息容器滚动的实际效果。
- 设计建议：AI 老师课堂应把当前教学任务和操作区固定在课堂框架内；历史消息不要自动成为唯一的主教学进度。若保留消息流，自动跟随需遵循用户滚动意图，并提供回到当前教学步骤的操作。

### SRC-02：跟读评分与精读课堂是不同入口/组件

- 文件：`frontend/src/renderer/views/UnitLearningPage.vue`、`frontend/src/renderer/views/LessonPracticePage.vue`
- 证据：单元学习材料项通过 `openFollowRead(item)` 跳转到 `LessonPractice` 路由并带 `courseId`、`lessonId`、练习模式等 query；`LessonPracticePage.vue` 用 `FollowMode` 渲染跟读模式。
- 影响：用户可能从阅读/句子学习跳到另一套练习页。需要确认这是必要的专业练习步骤，还是导致当前句、上下文和学习流程丢失的体验断点。
- 设计建议：第一步不急于把两套页面合并；先明确跨页面跳转的目的、是否保留来源句和返回位置、完成后如何回到原单元阶段。

### SRC-03：ReaderStage 主要以悬停触发朗读，滚动定位主要由导航调用

- 文件：`frontend/src/renderer/components/classroom/ReaderStage.vue`
- 证据：组件注释定义句子悬停约 120ms 后朗读；词语悬停约 180ms 打开词卡；`scrollToIndex(index)` 调用 `scrollIntoView({ block: 'center', behavior: 'smooth' })`，出现在键盘导航定位逻辑中。
- 影响：现有“悬停即读”与用户期望的“音频播放驱动当前句自动跟随”不是同一交互契约。当前可见源码片段不能证明音频连播过程中一定会自动定位到正在播放的句子。
- 设计建议：保留悬停作为可选辅助能力，不让它成为核心学习的唯一入口；为明确的跟读/连续播放模式建立播放驱动的当前句状态和自动定位策略，并支持手动滚动后暂停追随。

### SRC-04：播放器已有全局单通道和令牌机制，可作为复用基础

- 文件：`frontend/src/renderer/composables/useSpeechPlayer.ts`
- 证据：文件注释与模块状态显示全局唯一音频元素、播放 token、连播 token、过期异步结果丢弃，以及 `playingKey` / `loadingKey`。
- 影响：不应新增第二个播放器；后续需要核对播放事件与 ReaderStage 的当前句状态能否可靠关联。
- 设计建议：复用现有单通道和令牌机制，补齐“播放开始/结束 → 当前句定位与高亮”的事件契约，而非重写音频底层。

## 当前结论

- 已确认的源码事实：AI 消息容器有自动滚动到底部逻辑；ReaderStage 有悬停朗读与导航时滚动定位；单元学习的跟读评分会跳转到独立练习路由；播放器已有单通道与 token 机制。
- 尚未确认：真实窗口中滚动容器、按钮位置、当前播放句高亮、连续播放定位、AI 长消息视觉效果、TTS/ASR 实际端到端行为。
- 验证状态：STATIC_REVIEW；浏览器/Windows E2E、截图、语音时序与用户效果验证均 NOT_RUN。
- 下一步：先对真实窗口执行跟读连续播放与 AI 老师长回复两个场景，记录视口、滚动容器、焦点、按钮和实际行为；再分别实施 P0-A 与 P0-B。
