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


## 控制台错误修复交接（2026-10-24）

- 分支：`fix/radio-value-api-2026-10-24`。
- 已将 AI 音频导入面板的 `el-radio-button :label` 改为 `:value`；AI 设置面板 6 个 `el-radio label` 改为 `value`，对应选择值保持不变。
- 当前状态：静态检查完成；前端构建、浏览器实机回归和 CI 尚未运行（`NOT_RUN`）。
- 用户报告的 `VM149:2 et.reportAllChanges` 访问 `startTime` 错误，仓库源码未找到该函数。不能通过盲目改 Vue 页面或全局屏蔽错误来宣称修复；后续需确认该 VM 脚本的实际来源，再决定是否涉及项目代码。
