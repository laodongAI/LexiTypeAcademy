# 交接说明（HANDOFF）

## 当前状态

- 主线：`frontend/`（Vue3+Vite，端口 5183）+ `backend/`（FastAPI，127.0.0.1:8010），本地单机、单用户、无登录。
- 已完成：仓库基线、前后端骨架、14 表数据层与迁移工具、TTS/ASR 后端服务。
- 已完成：阶段4 批次A（前端构建恢复、设置页语音测试接真实后端）。
- 已完成：真实存量数据迁移（旧 React 版 `LexiTypeDB` v80：27 条掌握度 + 142 条复习日志），17/17 校验 PASS。
- 已完成：批次B（后端业务 CRUD + 前端仓储切 HTTP）。后端新增 `courses/practice/review/records` 四组路由；前端新增 `apiClient.ts`，5 个仓储改为 HTTP，页面与服务不再直连 Dexie（TTS Blob 缓存除外）。
- 已完成：批次C 切片1（统计页真实聚合）。练习记录新增 `totalItems/correctItems/wpm`（Alembic `c1a2b3d4e5f6` 已应用），练习页采集真实耗时/题量/WPM，统计页去除随机数，进步曲线“完成度”改为“题量”。
- 已完成：批次C 切片2（学习计划完整版）。新增 `study_plans/study_plan_tasks/study_plan_checkins` 三表（Alembic `d4b5c6e7f8a9` 已应用）与 `/api/study-plans`、`/api/study-plan-tasks`、`/api/study-plan-checkins` 三组路由；`LearningPlansPage.vue` 重写为多计划列表 + 详情看板 + 打卡 + 历史回顾，派生口径只在 `GET /api/study-plans/{id}/dashboard` 实现。
- 已完成：批次D（AI 后端代理）。密钥只存 `backend/.env`；新增 `/api/ai/config`、`/api/ai/chat`、`/api/ai/chat/stream`、`/api/ai/test`；前端新增 `BackendAIProvider` 并删除直连 `qwenProvider`；设置页改为只读状态卡片；后端单测 9 passed。
- 已安装：`backend/.venv` 新增 `httpx`；测试依赖见 `backend/requirements-dev.txt`（pytest/pytest-asyncio/anyio）。
- 已修复：AI 空正文。思考模型（当前 `zhipu/glm-5.3-flash`）在默认 2000 输出预算下会把 token 全用于 reasoning（`finish_reason=length`），正文为空。后端现会自动翻倍输出上限重试一次；仍为空返回 502 可读提示。调用结束日志新增 `content_chars/reasoning_chars/finish_reason`。
- 已修复：设置页「语音合成」语速/音量滑块塌缩。`.slider-row` 与 `.voice-row` 缺少 `flex: 1` 导致行宽仅 68px、滑块轨道 0px；修复后行宽 780px、滑块 712px，并与音色下拉框右边缘对齐（`SpeechSettingsTab.vue`）。

## 下一步

1. 批次D 收尾：在 `backend/.env` 填入真实 `AI_API_KEY` 并重启后端，按设计 6.2 手工验收（设置页状态/测试连接、课程流式生成、教材引导、音频导入、教学反馈、DevTools 无密钥、日志无密钥与完整内容）。
2. 批次F：设计已产出（`docs/design/english-learning-vision-v1.md`），F2/F3/F4 首批课堂 UI 已实现并构建通过，进入联调阶段：
   - 入口链路：课程详情课时列表“进入课堂” → `ClassroomEntryDialog` → `/lessons/:lessonId/classroom`（`ClassroomPage.vue`）
   - 舞台：`ReaderStage.vue`（悬停精读/词卡/生词本）、`BurnDownStage.vue`（句子/词燃尽）、`WordRootStage.vue`（词根分组）
   - 联调用演示数据：`demo-classroom-001`（3 课时：词根/短文/对话），可直接在课程详情页删除
   - 待联调项：悬停朗读节奏、燃尽回退/升级阈值、词卡定位与关闭时机、窄屏布局
3. 批次F 剩余切片顺序：F1 资源元数据与分类 → F5 字幕导入 → F6 AI 对话场景（依赖D）→ F7 全链路验收；F0 方法调研可并行。
4. 设置页数据管理接入后端 `/api/migration/import` 后，下线 `shared/database/dataMigration.ts`。
5. 可选补迁：`http://localhost:5173` 源（旧 Vue 版 IndexedDB，约 11KB），需该端口释放后执行。
6. 批次G（设置页分页与模型配置）已完成并验证（2026-10-24）：
   - 设置页 6 分页 + `/settings?tab=` 深链；旧入口别名 `ai→models`、`tts→speech`、`migration→about`
   - 多引擎 TTS：`GET /api/tts/engines|voices`、`POST /api/tts/generate` 支持 `engine`；引擎目录唯一来源 `backend/app/services/voice/tts_engines.py`
   - OpenVoice v2 克隆：`/api/tts/clone/refs` 上传/列表/删除；端到端实测上传 3.48s 参考音频 → 合成 1.93s → 删除成功
   - 大模型配置：`/api/ai/providers`、`/api/ai/settings`、草稿 `/api/ai/test`；密钥只写不读，落盘 `backend/data/ai-settings.json`
   - 证据：前端 `npm run build` 通过；后端 `pytest -q` → 27 passed；引擎实测 kokoro 24kHz、aishell3 8kHz（模型固有）
   - 剩余可选：`aishell3` 音色中文名补充（Q6 后续）、浏览器录音上传（Q9 P2）
7. 批次H（课堂引导与学习点评 v1，P0）已完成并验证（2026-10-24）：
   - 设计：`docs/design/classroom-guidance-and-feedback-v1.md`
   - 昵称：`settings.nickname`；课堂首次进入弹引导（可跳过，本机不再重复）；设置 → 通用可改
   - 键盘：精读 ←/→ 切句朗读并滚动定位；燃尽 ←/→ 切题（向后未完成记跳过）；空格播放；Esc 退出输入；输入态不拦截
   - 点评：`shared/utils/lessonFeedback.ts` + `LessonFeedbackDialog.vue`（星级/数据/三句话/朗读）；燃尽自动，精读/词根顶栏“完成本课”
   - 记录：`learning_records` 写入 `activityType=lesson-feedback`，metadata 含 stars/文案/过程指标
   - 证据：`npm run build` 通过；临时库 TestClient 实测 POST/GET `/api/learning-records` → 201/200
   - 待实机复验（`NOT_RUN`）：昵称引导、左右键滚动定位、燃尽切题与跳过计数、点评朗读与落库
   - 下一版愿景：开机语音引导（上次学到哪/本次目标）、完成自动播报、阶段进步对比、AI 个性化点评

8. AI 调用失败根治（2026-10-24，批次D 补丁）：
   - 根因：思考模型 `glm-5.3-flash` 把 `max_tokens` 全部用于 `reasoning_content`，`finish_reason=length` 且正文为空；课程/教材输出的 token 需求远超单次预算，JSON 被截断。
   - 后端：`app/core/ai_providers.thinking_disable_params()` 统一声明“关闭思考”参数（zhipu `thinking.type=disabled`、qwen3 `enable_thinking=false`），`/api/ai/chat` 与 `/api/ai/chat/stream` 均自动注入；服务商差异只在 `ai_providers.py` 一处维护。
   - 前端：`aiService.generateCourse/ generateCourseFromAudio` 超过 40 词自动拆为“大纲 + 每批 20 词”，并补齐音频路径缺失的 JSON 结构说明；翻译上限 4000、教材词汇 5000。
   - 证据：同一课程请求由 140s 无返回，变为 38.9s、14869 字符；浏览器真实“中文生成英文课程”流程 07:35:21→07:36:22 共 6 次调用全部 `status=ok`；教材单元解析 6.5s 可解析、词汇生成 10.4s、中文翻译 2.2s；后端 `pytest` 31 passed，前端 `npm run build` 通过。
   - 备注：思考模型下不宜再靠“加大 max_tokens”硬扛，关闭思考是确定性解法。

9. 课程仓库分级 + 课堂老师语音引导（2026-10-24，已完成并验证）：
   - 设计：`docs/design/course-library-and-teacher-guidance-v1.md`
   - 分级：`shared/utils/courseTaxonomy.ts`（纯函数）+ 课程仓库第三个视图 `textbook`，层级为「教材系列 → 年级册 → 单元课程」；历史课程按标题/描述回退解析，新生成课程追加 `Textbook:/Grade:/Semester:` 标签。
   - 引导：`useTeacherGuide.ts` + `components/classroom/TeacherBubble.vue`；事件源为 `BurnDownStage` 的 `answer`/`idle` 与 `ReaderStage` 的 `activity`；覆盖开场、切模式、报题+示范音、答对/答错、20/45 秒超时升级、查词/生词本、完成总结。
   - 语音：`useSpeechPlayer` 新增 `language`（默认 en，老师台词 zh）；教材“生成音频”与课程预缓存显式沿用设置页引擎/音色/语速，预缓存可选包含例句句子。
   - 证据：`npm run build` 通过；浏览器实测三级结构（鲁教版 → 三年级·上册 → 10 单元）、老师气泡台词与 `/api/tts/generate` 200、答错与超时提示切换、控制台无 error。
   - 控制台噪声修复：`vite.config.ts` 忽略 `src/renderer/components.d.ts` 与 `auto-imports.d.ts` 的 watch；此前插件在开发/构建时反复重写这两个文件触发整页刷新，造成 35 条 `net::ERR_ABORTED`。修复后新鲜加载首页/课堂页均为 0 error。

10. “没有声音”三层根因修复（2026-10-24，已完成并验证）：
   - 根因A（CSP 拦截媒体）：`frontend/index.html` 缺少 `media-src`，媒体回退 `default-src 'self'`，后端 WAV 与 `blob:`/`data:` 音频被拦截，报 `NotSupportedError`。已补 `media-src 'self' blob: data: http: https:`。
   - 根因B（非法音色静默失败）：设置残留 `openvoice / openvoice:0`，后端返回 HTTP 200 但 `success:false`。已在 `settings.ts` 迁移与 `useSpeechPlayer` 运行期双处回退 `melo/melo:0`。
   - 根因C（静音开关持久化）：`lexitype_teacher_voice_muted` 在 localStorage 为 `1`，`useTeacherGuide` 只显示字幕不合成。已改为 sessionStorage 会话级（新标签页/重启自动有声），进入课堂时输静音状态 info 日志；`TeacherBubble` 静音态改琥珀色、图标表达当前状态，文案改为“老师语音已静音，点击开启”。
   - 证据：课堂页 sessionStorage 静音键为 `null` 时老师气泡出现（文案“小玉米，我们开始吧。今天我们精读《词根 spect：看见的家族》…”），控制台 `[speech] 开始播放 {key: teacher:3:..., attempt: 1}` 与 `[classroom-teacher] 老师播报结束 {priority: 3, completed: true}`，即 `await audio.play()` 成功且整段播完；命中 IndexedDB 缓存时无 `/api/tts/generate` 网络请求属正常；无 CSP/NotSupportedError/NotAllowedError；`npm run build` 通过（32.87s）。
   - 排查提示：如果再次出现“有字幕没声音”，先看 `[classroom-teacher]` 是否有“处于静音状态”，再看 `[speech] 播放失败` 的 `src/error`，最后确认 CSP `media-src` 与当前音色是否合法。

## 环境事实

- Python 虚拟环境：`backend/.venv`（sherpa-onnx、numpy、onnxruntime、soundfile 已装）。
- 本地服务：后端 `127.0.0.1:8010`（uvicorn，本次已用 venv 重启以加载新路由），前端 `localhost:5183`（Vite 仅监听 `::1`）。
- 模型目录：`backend/models`（整体 gitignore，仅 `manifest.json` 入库）。
- ffmpeg：系统环境变量 `FFMPEG_PATH=D:\tools\ffmpeg-7.1`（指向安装目录，配置层已兼容）。
- 端口：8000/5173 属于另一个运行中的项目，不要占用或终止其进程。

## 已知风险

- 旧版应用已无法启动：`legacy/artifacts/electron-release/win-unpacked/resources/app.asar` 缺失，`C:\Program Files\LexiType Academy` 为空目录；再次导出数据只能复用“复制 profile + file:// 同源读取”的方式。
- 前端业务数据已统一走后端 SQLite；IndexedDB 仅保留 TTS 音频 Blob 缓存，该缓存可重建、不属于业务数据。
- 后端未启动时前端列表页会提示“无法连接本地后端服务”，本地开发需先启动 8010 服务（`backend/scripts/dev.ps1`）。
- IndexedDB 按 origin 隔离，旧 Electron 应用停止使用前必须完成导出。
- 发音评分为文本相似度级简化实现，不能作为专业发音评测结论。


## 练习模块审计与修复（2026-10-24）

- 当前主线：`main`，练习模块审计记录见 `docs/tasks/PRACTICE_MODULE_AUDIT_2026-10-24.md`。
- 已修复的主要入口链路：听力推荐 → 听写模式；口语推荐 → 跟读模式；快速练习按模式导航并自动启动；错题列表可按目标题目启动单题复练；课程练习面板不再是“开发中”占位页。
- 统计数据改为真实持久化练习记录聚合，不再用固定示例错误率/图表值；统计加载失败有显式提示。
- 待处理：课程练习复习队列仍未接入 SRS 数据源；需实测真实音频、麦克风权限、ASR 评分、练习提交和退出恢复。Windows 本机 E2E 为 `NOT_RUN`。
- 当前 CI 状态应查看 GitHub Actions 对最新 `main` SHA 的 Frontend quality / Backend quality；未完成时标记 `NOT_RUN`，不可宣称通过。


## 教材生成可靠性优化（2026-10-24，待 CI/运行验收）

- 相关实现：`frontend/src/renderer/components/ai/TextbookCourseSystemBuilder.vue`、`frontend/src/shared/services/courseSystemStore.ts`。
- 现在单元默认未选中；系列/教材/单元目录请求有并发去重；生成状态以“单元 × 内容类型”记录，成功后才更新 generatedTypes。
- 任务检查点保存在浏览器 localStorage，包含已完成课程、成功/失败项、当前项和时间戳；页面离开不会主动取消当前循环，回到页面可查看进度、恢复或重试失败项。完成草稿按出版社/系列/教材名称匹配，增补时保留已有内容，只补未完成的内容类型。
- 限制必须保留：这是前端后台任务，不等同于后端常驻任务。浏览器标签页关闭/崩溃时正在执行的 HTTP 请求无法从中间状态续跑，恢复时需重新请求该项；已完成的单元/类型可跳过。跨浏览器/清理 localStorage 不保证恢复。
- 验证状态：`NOT_RUN`，请查看最新 Frontend quality workflow；上一提交 `093c72b` 的 TypeScript 检查因模板按钮事件签名失败，已修复为 lambda 绑定，需确认新提交 CI。未做 Windows 实机或真实 AI 模型耗时测试。


## 教材生成模块可靠性/性能优化补充（2026-10-24）

- 主用页面：`frontend/src/renderer/components/ai/TextbookImportPanel.vue`；旧版页面：`TextbookCourseSystemBuilder.vue`；共享目录缓存：`frontend/src/shared/services/courseSystemStore.ts`。
- 已处理：默认不全选单元、补充单元入口、按教材身份匹配已有课程、内容类型级检查点、空内容质量闸门、后台完成后恢复预览、年级隔离的单元缓存、目录请求去重、两个单元并发生成。
- 生成耗时的代码层原因：每单元按选择类型调用多次 AI，开启音频后还会调用多批 TTS；现用最大并发 2 缩短串行等待，但未实测真实模型耗时，也未实现自动调节并发。
- 断点边界：路由切换时当前异步任务可继续；刷新/崩溃后从已完成内容类型恢复，正在执行的单次 HTTP 请求需要重试。检查点在当前浏览器 localStorage，不是后端常驻任务队列。
- 审计报告：`docs/tasks/TEXTBOOK_GENERATION_AUDIT_2026-10-24.md`。浏览器/Windows E2E 与真实模型压测均 NOT_RUN；以最新 GitHub Actions 结论更新 CI 状态。


- 共享效率优化：`apiClient.ts` 合并并发重复 GET 请求但不保留响应缓存；手动新增单元进入 grade-scoped catalog cache；课程保存合并必须匹配教材身份，避免同名课程跨出版社/系列误合并。


### 教材生成当前交接状态（2026-10-24）

- Frontend quality：[PASS](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40074139632)；Backend quality：[PASS](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40074139620)，对应代码提交 `eba4bde6f8af63bd14c32800360c56f3ce55e532`。
- 已修正完整单元计数逻辑；随后更新了审计报告，记录 CI 结果。
- 继续工作前仍需浏览器/Windows 验证：页面切换时生成是否继续、异常/刷新后的断点恢复、增补内容是否正确合并、TTS 和真实模型耗时。当前断点机制是前端 localStorage 检查点，并非后端任务队列。


## 学习方法兼容性实现交接（2026-10-24）

- 分支：`feat/learning-method-compatibility-2026-10-24`。
- 核心规则：`frontend/src/shared/utils/learningMethodCompatibility.ts`。
- 修改文件：`frontend/src/renderer/components/classroom/ClassroomEntryDialog.vue`、`frontend/src/renderer/views/ClassroomPage.vue`。
- 新设计文档：`docs/design/learning-method-compatibility-v1.md`。
- 当前状态：代码提交 `6bb6fab842e006e1f78bc8227cf9eb098d284d28` 的 Frontend quality 与 Backend quality 均 PASS；未做 Windows/浏览器 E2E，不应宣称端到端 VERIFIED。证据：[Frontend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40080120807)、[Backend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40080120779)。
- 下一步：检查 TypeScript 类型兼容与生产构建；修复 CI 发现的问题；确认入口/课堂/直接 URL 规则一致；再创建 PR 并记录准确的 workflow 结果。
- 重要边界：当前仅做方法适配和不兼容阻断，不会自动提取文章中的词汇，不新增音素课堂，也不重分类历史课程。


## 单元整体学习 + 双模式课堂交接（2026-10-24）

- 分支：`feat/unit-learning-modes-2026-10-24`。
- 设计文档：`docs/design/unit-learning-modes-v1.md`。
- 页面：`frontend/src/renderer/views/UnitLearningPage.vue`。
- 路由：`frontend/src/renderer/router/index.ts`，路由名 `UnitLearning`，路径 `/courses/:courseId/learn`。
- 入口：`frontend/src/renderer/views/CourseDetailPage.vue` 的“开始单元学习”；原有每个课时的“进入课堂”保留。
- 自主模式：通读、重点句、重点词、AI 语法、输出小测、阶段进度检查点；跟读入口复用既有 `LessonPracticePage.vue?mode=follow`。
- AI 模式：复用 `conversationCoreService` 的已持久化 `ai-tutor` 会话，关联课程与上下文，不新建消息/内容表。
- 状态：Frontend quality PASS（TypeScript typecheck + production build，https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40083684942）；Backend quality PASS（https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40083684818）。浏览器 E2E 尚未运行。严禁宣称语音、ASR、AI 教学体验已通过端到端验证；CI 通过也不能替代实机验收。
- 下一步：检查 GitHub Actions 的 frontend typecheck/build 与 backend quality；修复发现的类型/构建问题；验证会话恢复、空内容、跟读评分跳转、刷新检查点与窄屏布局；更新证据后再合并。

- 单元整体学习续修分支 `fix/unit-learning-stage-state-2026-10-24`：跳过阶段不再计入完成率；原文提取句不再误用段落级翻译或链接整段跟读。待新分支 CI 完成后，仍需人工验证真实教材、多轮 AI 对话恢复、TTS/跟读跳转和刷新恢复。


## 主干产品与实现专项审计交接（2026-10-26）

- 当前主干审计清单：`docs/product/MAIN_BRANCH_PRODUCT_AUDIT_AND_IMPLEMENTATION_BACKLOG.md`。
- 基线提交：`e37526ec927b00cd26bf7146ac0439137c2614c3`；本轮先核对当前代码与既有审计文档，不把历史 TASKS/HANDOFF 中的测试记录冒充为本轮新证据。
- 本轮修复：教材生成的既有内容类型识别从宽泛正则改为明确标题标记，避免把“课文/对话”自动当成“句子”。提交 `82be5efd6741ad45e437a0d67c6d1fa27a890fc7`。
- 审计文档提交：`f392e80b06494d3158d6fcc9b19ef568e4fee1e8`。
- 当前状态：修复待 CI 和真实教材增补回归；未执行本地 typecheck/build、浏览器或 Windows E2E。不得将此项标为 VERIFIED。
- 下一步：
  1. 查询并记录修复提交的 Frontend quality 与 Backend quality workflow 结果。
  2. 为教材类型识别建立可测试的纯函数与单元测试，覆盖“课文/对话/句子/短文/单词/语法/phonics”及补充生成不重复场景。
  3. 设计并实现生成 checkpoint 与未保存草稿隔离，配置变化时不得静默覆盖草稿。
  4. 以 UI/UX 验收规范核对教材进度、空/错误/部分成功状态和窄屏交互。
  5. 再验收首页刷新/重启恢复、学习计划持久化、共享对话恢复与 TTS 真实播放。
- AIMES：产品经理 Skill 文本已实际读取并应用；自动 Skill 路由仍未验证，registry 中的 UNKNOWN/空 evidence 必须保留，直到获得目标工具实际执行证据。

- 追加代码修复 `e4972e4b4f9c9da98251257c7c5d1ebc531e9fea`：标题识别补充“句型”标记。正式审计清单已新增单元默认选择、增补行为与生成耗时基线项。


## 产品经理深度评估交接（2026-10-26）

- 报告：`docs/product/PRODUCT_DEEP_REVIEW_AND_TOP10_BENCHMARK.md`。
- 本轮实际读取 AIMES product-manager、market-analysis、requirement-cognition、ui-quality-review、frontend-design 等 Skill 文件；产品分析与微文案审查步骤已实际执行，但注册表 validation_status 为 UNKNOWN，目标 IDE/CLI 自动路由仍未验证。
- 首批低风险文案改动已提交：`306a27ea619b5cda58fff1b252b89be88e5e21a2`（课堂提示/教师台词）；`0ee9e28ee9d6c6e3858a6235a7923665ab4029a0`（AI 教学与面试输入提示）。
- 最新 CI 在最后查询时仍 pending：Frontend #245、Backend #160。前一提交 Frontend #242/Backend #157 成功，但不覆盖后续 UI 文案提交。
- 真实窗口/键盘/屏幕尺寸/语音时序验收仍 NOT_RUN；不得声称按钮位置、视觉和 TTS 交互已通过。
- 继续优先：教材生成草稿/断点保护、进度状态真实化、首页主 CTA 与数据解释、课堂语音打断与提示适配、对话场景化反馈与失败恢复。


## 产品基线驱动的实现与真实验收协议（2026-10-26）

- 权威产品基线：`docs/product/PRODUCT_DEEP_REVIEW_AND_TOP10_BENCHMARK.md`。
- 新增强制协议：`docs/product/PRODUCT_EXECUTION_AND_EVIDENCE_PROTOCOL.md`，提交 `ec728aeaded98292f5d6b9cc4a0af2cbf7039041`。
- 每项改动都必须回答：①用户为什么需要；②具体交互/控件位置/默认值/状态/AI 文案为什么这样设计；③哪些可复现证据能证明达到验收目标、是否有证据证明用户效果改善。
- 验收分层：静态检查、自动化测试、真实运行验收、真实用户效果验证。任何一层不能冒充另一层；CI 通过不等于视觉、语音、实机或学习效果通过。
- 后续每项任务必须关联产品基线章节、任务 ID、范围与非目标、交互理由、验收标准、实际执行命令、CI/提交、真实运行环境/视口/步骤/结果/截图或日志，以及未解决风险。
- 当前状态：协议文档已提交；协议自身不代表任何功能已通过验收。此前微文案修改的真实窗口/键盘/视口/TTS 验收仍 NOT_RUN。AIMES 目标 IDE/CLI 自动路由仍 UNKNOWN/NOT_RUN。
- 建议下一切片：先重查最新 main CI 和相关实现，再实施教材生成内容类型纯函数测试、草稿与 checkpoint 隔离、任务状态/部分成功/恢复验收。若发现更高优先级的真实阻塞，应记录依据后调整顺序。


## 教材内容类型识别首个实现切片（2026-10-26）

- 产品基线：`docs/product/PRODUCT_DEEP_REVIEW_AND_TOP10_BENCHMARK.md`；执行门禁：`docs/product/PRODUCT_EXECUTION_AND_EVIDENCE_PROTOCOL.md`。
- 用户问题：已有内容类型识别直接决定补充生成是否跳过某类型；“课文/对话”误判可能让用户无法生成缺失内容。
- 交互决策：本切片不改控件布局，先确保“已有内容”语义稳定，随后再处理草稿与检查点。测试覆盖五类显式标题、课文/对话边界、多课时去重、空/未知标题和标记优先级。
- 改动：`frontend/src/shared/utils/textbookContentTypes.ts`、`frontend/src/shared/utils/textbookContentTypes.test.ts`、`frontend/src/renderer/components/ai/TextbookImportPanel.vue`、`frontend/package.json`、`.github/workflows/frontend-quality.yml`。
- 提交：`881183c`（纯函数）、`5b6fbc`（测试）、`270370d`（测试脚本）、`07292af`（组件接入）、`6417e76`（CI 测试步骤）。
- 当前 CI：[Frontend #256](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281030870) 与 [Backend #171](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281031057) 在最后查询时 pending。不得提前宣称测试或构建通过。
- 真实运行/Windows/教材增补/刷新恢复验收仍 `NOT_RUN`；本切片没有验证学习效果提升。
- 下一步：先确认 CI 实际结果；若测试脚本失败先修复。通过后，设计并实现多教材草稿/检查点隔离和显式恢复/覆盖保护，再为进度、部分成功、失败重试补齐状态矩阵与 E2E 步骤。


## 教材生成检查点与草稿保护（2026-10-26）

- 用户价值：教材生成时间成本高，切换教材不能静默覆盖另一教材的未保存内容；同教材修改生成配置也必须明确告知替换风险。
- 交互：按教材身份隔离检查点；同教材已有草稿且配置变化时显示已完成内容项数，允许取消保留或明确确认替换；保存后只清理当前教材检查点；存储失败要显示错误并停止生成。
- 改动：新增 `textbookGenerationCheckpointStore.ts` 与测试；生成组件改为多检查点读写、旧版单检查点迁移、定向删除；提示文案说明替换和清理失败后果。
- 自动化：代码提交 `9786de955a90a815e761cb28909796c4ad5256fe` 的 Frontend quality #268 与 Backend quality #183 均 PASS；前端 12 项单元测试、TypeScript 类型检查和生产构建通过（[Frontend CI](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281817242)，[Backend CI](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281817275)）。之后提交仅为文档记录，不改动本批代码。
- 失败透明记录：提交 `fb01277` 曾出现 TS18047，随后 `9786de9` 修复；最终 CI 结果仍需确认。
- 真实运行：浏览器/Windows 多教材切换、刷新恢复、存储配额不足和真实教材增补 E2E 仍 `NOT_RUN`；不可标记 UI/端到端 VERIFIED。
- 下一步：确认当前 CI 最终结果；通过后，在真实窗口中执行报告中的场景。若实机发现状态或数据行为与预期不符，优先修复，不以 CI 通过替代体验验收。


## 英语学习核心体验 P0-A 交接（2026-10-26）

- P0-A 已通过 PR #10 合并至 `main`：<https://github.com/laodongAI/LexiTypeAcademy/pull/10>；常规功能后续直接在 `main` 开发。
- 产品基线：`docs/design/english-learning-core-experience-restructure-v1.md`；源码初审：`docs/tasks/ENGLISH_LEARNING_UX_SOURCE_AUDIT_2026-10-26.md`。
- 本轮已读：`.aimes/skills/product-manager/SKILL.md`、`.aimes/skills/ui-implementation-validation/SKILL.md`、`AGENTS.md`、`.trae/rules/00-aimes-governance.md`、`docs/_governance/AIMES-CORE-V1.2.md`；Skill 正文已读取，但不代表 IDE/CLI 自动路由已验证。
- 代码切片：`ReaderStage.vue` 监听共享播放器 `playingKey`，将实际播放 key 映射为当前句/词条索引；连播切句时同步高亮与定位。新增“跟随朗读：开/开启跟随”状态按钮，用户滚轮主动浏览后暂停自动定位，并可点击“回到当前句”恢复跟随。连播被停止/中断时不再把所有句子都标记为已读。纯函数 `readerSpeechSync.ts` 及 `readerSpeechSync.test.ts` 覆盖 key 到索引的映射。
- 代码提交：`e6d97e4c61c342cffccc4f3749ccf9136394fa37`（播放驱动同步）、`382c8d116e5b173ae51e7e33a2bd4cb5e51854fb`（手动滚动控制）、`5057eea2e8980a08b68fc4e859197e4e9a4fa09c`（测试）。最新 UI 代码及任务记录提交 `9aa41da94c49aecd62b0889c3357ce8e97a1ca94` 的 Frontend quality <https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40289483314> 已 PASS（单测、类型检查、生产构建）；Backend quality <https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40289483301> 已 PASS。此为 CI 证据，不替代 Windows/浏览器 E2E。
- 产品价值：连续朗读时高亮和滚动跟随实际播放项；用户手动滚动时不持续抢回视口；被停止的连播不应将未播放的句子计入已读。
- 播放服务边界：`FollowMode.vue` 使用 `audioPlayService`（独立 Audio 元素，TTS 失败时可能回退 Web Speech），`ReaderStage.vue` 使用模块级 `useSpeechPlayer`。两者位于不同路由/组件路径；目前没有证据证明会同时播放，仍需验证路由切换与老师播报打断。
- 验证限制：本轮没有可操作的目标 Windows 应用/浏览器会话；最新 UI 改动的 CI、真实播放、连续 10 句、手动滚动、窄屏、控制台/网络、TTS/ASR 端到端均需复核或为 `NOT_RUN`。未证明学习效果提升。
- 下一步：①确认包含 `382c8d1` 的 Frontend quality；②在目标 Windows 窗口连续播放至少 10 句，检查高亮、自动定位、手动滚动暂停和返回当前句；③覆盖停止/中断、快速切句、TTS 失败、触控/键盘；④复核 PR diff 与最新 main 后再决定是否合并。


## 英语学习核心体验 P0-B 交接（2026-10-26）

- **开发策略：** 用户明确要求常规开发直接在 `main` 主干进行；PR #10 已合并，不再将常规切片放在独立分支等待合并。
- **P0-A 合并：** [PR #10](https://github.com/laodongAI/LexiTypeAcademy/pull/10)，merge commit `f62373afff6e8f508bb662944857b86b4b2c939c)。包含产品设计、源码审查、播放 key 到句子/词条索引同步、手动滚动暂停自动跟随、返回当前句与映射测试。
- **P0-B 主干实现：** `frontend/src/renderer/views/UnitLearningPage.vue` 已改为黑板式 AI 老师课堂：中央突出最新老师讲解；课堂历史通过原生 details 折叠；回答输入固定在主课堂下方；显示老师思考/等待状态；错误时按启动失败或发送失败提供对应重试；不再自动将历史记录滚动到最底部。
- **相关提交：** `7855c79291668188adc1d47e352f9a890a2c6810`（第一版布局）、`c6fc96b48e70c2cc1f3adb25f354d035a38ab5c8`（错误恢复与移除强制滚动）、`5e0c45526dc993f9879e38af9e4ee80205fc22f0`（清理过期 ref/import）、`570c2a09049b9f8954e40a86c6f4817d178207b1`（清理剩余滚动调用）。
- **用户价值与交互理由：** 当前讲解成为视觉中心，避免长历史挤占主界面；历史可按需展开；用户查看历史时不被强制拉回底部；输入和提交动作保持稳定。复用现有 `conversationCoreService` 与语音播放能力。
- **自动化证据：** 对 `570c2a09049b9f8954e40a86c6f4817d178207b1`，Frontend quality #? 的单测与类型检查已通过，生产构建在写入交接时仍运行；Backend quality 已 PASS。必须复查 [Frontend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40290310921) 最终结论。
- **真实验收：** Windows/浏览器运行、桌面与窄屏截图、长回复、历史折叠、键盘操作、启动失败/发送失败恢复、语音打断均 `NOT_RUN`；用户效果未验证。
- **下一步：** ①确认最新主干 CI；②在目标窗口实测 AI 老师从启动到回答/失败重试的完整流程；③检查黑板主视觉、历史折叠、长回复布局与窄屏键盘；④依据真实观察修复，而不是把“页面能打开”当作验收；⑤随后再推进统一课堂骨架与跟读实机验收。
