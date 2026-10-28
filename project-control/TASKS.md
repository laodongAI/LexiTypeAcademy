# LexiType Academy 任务台账

> 本文件是项目唯一任务状态记录（AIMES 治理要求）。状态取值：`TODO` / `DOING` / `DONE` / `BLOCKED`。
> 验证结论必须附可复现证据，未执行标 `NOT_RUN`。

## 一、已完成阶段

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 0 | .gitignore、git 基线、旧版归档到 `legacy/` | DONE |
| 1 | 前后端骨架：`frontend/`（Vue3+Vite）、`backend/`（FastAPI）、`scripts/` | DONE |
| 2 | 数据层：14 张业务表 ORM、Alembic、IndexedDB 导出/导入与 17 项校验（批次C 扩展至 17 张） | DONE |
| 3 | 语音后端化：`/api/tts/*`、`/api/asr/*`、模型懒加载、缓存 | DONE |

## 二、当前迭代（阶段4 · 批次A：可交付性修复）

| 任务 | 状态 | 验收证据 |
| --- | --- | --- |
| 修复前端生产构建 6 处 TS 类型错误 | DONE | `npm run build` 通过（2520 modules） |
| 设置页 TTS 测试接入真实 `/api/tts/generate` | DONE | 已触发请求；持久化缓存返回 url 分支已处理 |
| 设置页 ASR 测试接入真实 `/api/asr/health` | DONE | 接口 200 已证；修正后 UI 复验 `NOT_RUN` |
| 真实存量数据迁移（旧 React 版 LexiTypeDB v80） | DONE | 报告 `backend/data/migration-reports/20261024-002846-16f1e8.json`；17/17 PASS |

### 真实迁移证据（2026-10-24）

- 数据源：`%APPDATA%\键语学苑\IndexedDB\file__0.indexeddb.leveldb`，库 `LexiTypeDB` v80，origin `file://`。
- 数据量：`wordMasteryItems` 27 条、`reviewLogs` 142 条；其余集合为空。
- 导出方式：打包目录缺少 `app.asar` 无法启动旧应用，改为把 profile 复制到临时目录，用 Chrome `file://` 页同源读取导出（见临时脚本 `lexitype-legacy-export.py`，未入库）。
- 字段映射：`result` → `quality`（correct=4 / incorrect=0）+ `correct` 布尔；掌握度缺失字段按 schema 默认值补齐（`ease_factor=2.5` 等）。
- 新增代码：`backend/app/services/migration/legacy_react.py`；CLI 新增 `--adapter auto|none|legacy-react`。
- 校验：14 张表行数一致 + 掌握度逐条比对 + 今日复习队列 = 17/17 PASS；库内实际 27/142，quality 分布 4×35、0×107，与源一致。
- 原始快照位置：`%LOCALAPPDATA%\lexitype-migration-backup\export\legacy-react-20261024-002646.json`（仓库外）。

## 三、阶段4 · 批次B：后端业务 CRUD + 前端仓储切 HTTP（DONE）

| 交付物 | 状态 | 证据 |
| --- | --- | --- |
| 后端业务路由 4 组：课程/练习/复习/记录 | DONE | `backend/app/api/routers/{courses,practice,review,records}.py`；`app.main` 注册 15 个路由组 |
| 字段映射唯一来源抽取 | DONE | `backend/app/db/field_maps.py`；迁移 `importer.py` 改为 import，避免两份映射漂移 |
| 前后端契约序列化 | DONE | `backend/app/api/contracts.py`（ORM→camelCase、请求体→snake_case、必填校验） |
| 前端 HTTP 客户端 | DONE | `frontend/src/shared/services/apiClient.ts`，默认 `http://127.0.0.1:8010`，`VITE_API_URL` 可覆盖 |
| 5 个仓储切换 HTTP | DONE | `courseRepository`、`reviewRepository`、`unitReviewRepository`、`practiceAttemptEventRepository`、`commonRepository` |
| 页面/服务清理 Dexie 直连 | DONE | `learningService`、`unitReviewService`、`PracticeCenterPage`、`StatisticsPage`；仅 TTS Blob 缓存保留 IndexedDB |

### 批次B 实测证据（2026-10-23，后端 8010）

- `GET /api/courses` → 200 `{"items":[],"total":0}`（真实库当前无课程）
- `GET /api/review/stats` → 200 `{"totalWords":27,"newWords":5,"learningWords":22,"masteredWords":0,"dueToday":27,"reviewedToday":0}`，与迁移入库的 27 条掌握度一致
- `GET /api/review/sources` → 200 `{"items":["english","finger"]}`
- `GET /api/review/due?limit=3` → 200，返回真实到期单词（`s`/`c`…，source=english）
- 课程链路：POST 课程（含 1 课时）→ 201；PUT 课程/课时 → 200；PUT 进度 → 200；POST 练习记录 → 201；DELETE 课程 → 200 且关联练习记录清零
- 复习链路：PUT/GET/batch 掌握度、POST/GET 日志、DELETE by source → 全部 2xx，测试数据已清理
- 错误契约：`PUT /api/lessons/not-exist` → 404
- 前端 `npm run build` → `✓ built in 38.17s`（仅 chunk >500 kB 提示）
- 后端 `compileall` → exit=0
- 浏览器联调：首页、练习中心、统计页无 `[api]` 报错；写入测试课程后，课程仓库页与「我的学习」页均渲染出该课程（测试数据随后删除）

## 三·补、阶段4 · 批次C 切片1：统计页真实聚合（DONE）

| 交付物 | 状态 | 证据 |
| --- | --- | --- |
| 练习记录扩展字段 | DONE | `PracticeRecord` 新增 `total_items/correct_items/wpm`（可空）；`field_maps.py` 同步映射 |
| Alembic 迁移 | DONE | `alembic/versions/20261024_1000_c1a2b3d4e5f6_practice_metrics.py`；`upgrade head` 执行成功，库内版本 `c1a2b3d4e5f6` |
| 练习页采集真实指标 | DONE | `LessonPracticePage.vue`：真实耗时、总题数、正确数、WPM（字符数/5/分钟，语音模式无 WPM） |
| 统计页去除模拟数据 | DONE | `StatisticsPage.vue`：平均 WPM 取真实值；进步曲线“完成度”改为“题量”，WPM/题量仅取有效记录；总时长改为分钟 |

### 批次C 切片1 实测证据（2026-10-24，后端 8010）

- `POST /api/practice-records`（含 `totalItems/correctItems/wpm`）→ 201，响应回显新字段；`GET /api/practice-records?limit=2` → 200，`totalItems/correctItems/wpm` 均正确返回（修复前旧进程会告警“存在未映射字段，已忽略”）
- 浏览器实测 `/statistics`（2 条测试记录：60s+120s、WPM 42.5/45）：总学习时长 3 分钟、总练习次数 2、平均 WPM 43、平均准确率 87.5%；WPM 与题量曲线各 2 个真实数据点；控制台无 error/Vue 警告
- 测试记录已删除，`GET /api/practice-records` → `{"items":[],"total":0}`
- 前端 `npm run build` → `✓ built in 36.19s`；后端 `compileall` → exit=0

## 三·补二、阶段4 · 批次C 切片2：学习计划完整版（DONE）

| 交付物 | 状态 | 证据 |
| --- | --- | --- |
| 后端三张表与迁移 | DONE | `StudyPlan/StudyPlanTask/StudyPlanCheckin`（`models.py`）；Alembic `d4b5c6e7f8a9` 已应用，含 `(plan_id, checkin_date)` 唯一约束 |
| 字段映射唯一来源扩展 | DONE | `field_maps.py` 新增 `studyPlans/studyPlanTasks/studyPlanCheckins` 三组 camel→snake 映射 |
| 学习计划 REST | DONE | `backend/app/api/routers/study_plans.py`：计划 CRUD、自定义任务 CRUD、打卡 upsert、看板聚合；`main.py` 注册三组路由 |
| 派生口径唯一实现 | DONE | 课时任务由 `lessons + course_progress` 派生（最多 3 个）；今日分钟/课时数取当日练习记录；到期复习与 `/api/review/stats` 同口径；连续打卡由打卡日期倒推 |
| 前端类型与仓储 | DONE | `shared/types/studyPlan.ts`、`shared/database/repositories/studyPlanRepository.ts`（全部走 `apiClient`） |
| 学习计划页面 | DONE | `LearningPlansPage.vue` 重写：计划卡片（进度/今日目标/状态/剩余天数）、新建编辑对话框（多课程/每日分钟/起止日期/提醒）、详情（课时任务一键开始、到期复习入口、自定义任务、打卡、历史回顾、页面内提醒横幅） |

### 批次C 切片2 实测证据（2026-10-24，后端 8010）

- `POST /api/study-plans` → 201（返回完整字段与默认值）；`GET/PUT/DELETE` → 2xx；删除时级联清理 `deleted_tasks=1`、`deleted_checkins=1`
- 派生校验：写入一条 30 分钟练习记录（`duration=1800000`）+ 完成 1 个自定义任务后，`GET /dashboard` 返回 `minutes=30, goalPercent=100, lessonCount=1, customTaskDone=1, dueReviewCount=27`
- 打卡：首次 POST 自动固化 `minutes=30, lessonCount=1, customTaskCount=1, reviewCount=0`；同日再次 POST 覆盖 `minutes=35` 且保留原 `id/createdAt`；`streakDays=1`、`weekCompletionRate=0.14`
- 浏览器实测 `/plans`：空状态 → 新建计划 → 卡片与详情渲染 → 添加并完成任务（摘要 1/1）→ 打卡（按钮变“今日已打卡”、历史出现记录）→ 暂停/恢复，全部通过；无应用级控制台错误，无 4xx/5xx
- 测试数据已全部清理：`GET /api/study-plans` → `{"items":[],"total":0}`，测试练习记录已删除
- 前端 `npm run build` → `✓ built in 36.62s`；后端 `compileall` → exit=0

## 三·补三、阶段4 · 批次D AI 后端代理（DONE）

- 设计文档：`docs/design/ai-backend-proxy-v1.md`
- 关键决策：密钥只进 `backend/.env`；后端提供 OpenAI 兼容透传 `/api/ai/chat`（含 SSE）；前端 `AIService` 接口不变，只替换 provider 为 `BackendAIProvider`；设置页改为只读状态 + 测试连接
- 实施切片：D1 后端代理与单测 → D2 前端切换 → D3 设置页 → D4 清理与全链路验收
- 落地结果：
  1. D1：`backend/app/core/config.py` 新增 6 项 AI 配置与 `ai_chat_url/ai_configured` 派生属性；`requirements.txt` 新增 `httpx`；新增 `backend/app/api/routers/ai.py` 四个接口；`main.py` 注册；`.env.example` 更新；新增 `backend/tests/test_ai_router.py` 与 `requirements-dev.txt`
  2. D2：新增 `shared/services/ai/providers/backendProvider.ts`；`AIService` 固定使用后端代理；`aiConfig` 仅持久化 `customPrompts` 并清理历史明文密钥（键名 `lexitype_ai_config` 未改）
  3. D3：`SettingsPage.vue` AI 区域改为只读状态卡片（提供商/模型/上游地址/超时/最大输出）+ 刷新状态 + 测试连接 + `.env` 配置指引，无任何密钥输入项
  4. D4：删除 `qwenProvider.ts`，移除 `baseProvider` 的 Electron 代理与直连分支；全局无 `Bearer` 密钥与直连端点残留；修复 `generateCourse` 流式内容未累加的缺陷
- 验证证据（2026-10-24）：
  - `backend/.venv/Scripts/python.exe -m pytest tests -q`：9 passed（MockTransport 覆盖未配置/成功/401/429/超时/流式成功/流式中断/非法入参/连通性测试）
  - `backend/.venv/Scripts/python.exe -m compileall -q app`：通过
  - `frontend: npm run build`（`vue-tsc --noEmit && vite build`）：通过
  - 运行态：`GET /api/ai/config` 返回 `configured=false`（未填密钥）；`POST /api/ai/chat` 返回 503 `AI_CONFIG_MISSING` 统一错误体
- 未完成：真实密钥联调（本机 `backend/.env` 的 `AI_API_KEY` 为空）；补齐密钥后需按设计 6.2 手工验收流式课程生成
- 缺陷修复（2026-10-24，空正文）：
  - 现象：前端提示「AI 响应内容为空」，后端日志上游 200、usage 正常
  - 根因：`zhipu/glm-5.3-flash` 为思考模型；请求未指定 `maxTokens` 时后端默认 2000，思考过程耗尽全部输出预算（`finish_reason=length`），正文为空
  - 修复：`/api/ai/chat` 检测“正文为空 + length”时自动将输出上限翻倍重试一次；仍为空则返回 502 `AI_INVALID_RESPONSE` 可读提示，不再返回 200 空字符串；流式接口同样改为 error 事件收尾
  - 日志：调用结束新增 `content_chars` / `reasoning_chars` / `finish_reason`（只记长度，不记内容），日志文件 `backend/logs/app.log`
  - 证据：`pytest tests -q` 30 passed（新增空正文重试/持续为空/流式为空 3 例）；真实上游复测 200 + 正文 821 字符；强制 `maxTokens=200` 复测返回 502 与“请提高最大输出 token”提示

## 三·补四、阶段4 · 批次F 英语学习体系（设计 DONE；F2/F3/F4 首批课堂 UI 已实现，待联调）

- 设计文档：`docs/design/english-learning-vision-v1.md`
- 覆盖需求：词根扩展记词、句子/词的燃尽法、悬停领读（鼠标划过即读、词卡）、标准等级与系列教材资源库、YouTube/B站资料借鉴与导入、AI 模拟对话场景生成
- 关键决策：
  1. 只扩展 `courses → lessons → items(JSON)` 单一内容模型：新增 `courses.resource_meta`（JSON，可空）与 `LessonItem` 可选字段（词根/讲解/角色/时间戳），不新建资源表、词根表、燃尽表、对话表
  2. 枚举唯一来源为后端 `app/core/taxonomy.py`，经 `GET /api/courses/taxonomy` 下发，前端不复制枚举值；分类树由 `GET /api/courses/facets` 聚合，不存树
  3. 燃尽法复用 `practice_attempt_events.hint_level_at_submit/extra` 与 `unit_mastery_items`，不新增练习模式
  4. 悬停领读复用 `/api/tts/generate` + 前端 Blob 缓存；句子切分与词卡匹配在前端实时计算，不落库
  5. 资源导入首版只解析用户本地 SRT/VTT/TXT，不做视频抓取；AI 场景生成硬依赖批次D
- 页面与入口：资源库升级现有“课程仓库”（不新增顶层菜单）；精读新增 `/reader/:lessonId`（从课时/资源库进入）；词根/燃尽/AI 对话均在课时学习页内
- 实施切片：F0 方法调研 → F1 资源元数据与分类 → F2 词根扩展 → F3 燃尽法 → F4 悬停精读 → F5 字幕导入 → F6 AI 对话场景（依赖批次D）→ F7 全链路验收
- 已实现（首批课堂 UI，待联调）：
  - 入口：课程详情课时列表“进入课堂” → `ClassroomEntryDialog`（4 模式卡片 + 悬停朗读/中文提示开关 + 保留原有练习页入口）
  - 页面：新增路由 `/lessons/:lessonId/classroom`（`ClassroomPage.vue`），顶部模式切换 + 左侧舞台 + 右侧课堂助手
  - 舞台：`ReaderStage.vue`（悬停精读/词卡/加入生词本）、`BurnDownStage.vue`（句子/词燃尽，进度存 `lexitype_burn_*`，事件写 `practice_attempt_events`）、`WordRootStage.vue`（词根分组/整组听读/遮中文）
  - 公共能力：`useSpeechPlayer`（模块级单音频通道 + 连播令牌）、`sentenceSplit/textCompare/wordRoot`、`shared/utils/logger`
  - 验证证据：`npm run build`（`vue-tsc --noEmit && vite build`）通过；演示课程 `demo-classroom-001`（3 课时：词根/短文/对话）已通过 `POST /api/courses` 写入并回读校验中文与扩展字段
- 待用户确认：句燃尽遮蔽顺序（句末向前 vs 功能词优先）、词燃尽阶段定义、课程与教材的粒度、导入是否自动 AI 补全中文

## 三·补五、阶段4 · 批次G 设置页分页与模型配置（已实现并验证 2026-10-24）

- 设计文档：`docs/design/settings-tabs-and-model-config-v1.md`
- 需求：设置页按类别分页；语音模型增加真实音色选择；支持上传参考音频克隆音色；大模型增加 DeepSeek、千问、智谱等常用服务商配置
- 关键决策（已确认，2026-10-24）：
  1. 设置页改为“左侧分类导航 + 右侧内容区”，6 个分页：通用 / 语音模型 / 大模型 / 学习 / 练习 / 数据与关于；`/settings?tab=` 深链
  2. 语音采用“引擎 + 音色”两级模型：`melo:0`、`aishell3:SSB0005`、`kokoro:<id>`；同一时刻只驻留一个主引擎，克隆模式允许 melo + OpenVoice 同时驻留；缓存键纳入引擎/音色/参考音频哈希
  2.1 克隆音色：基于本机 OpenVoice v2 资产，上传 1–30 秒参考音频（≤10MB），后端归一化 22.05kHz 单声道、提取音色嵌入，`ttsVoiceId=clone:<profileId>`；历史实测 RTF≈1.11，需提示较慢并优先预缓存
  2.2 克隆安全：仅本机保存、强制授权勾选、UUID 目录防路径穿越、删除档案同时清理参考音频/嵌入/缓存、档案上限 5 个/50MB
  3. 大模型服务商目录唯一维护在后端 `app/core/ai_providers.py`；配置支持多档案单生效，密钥只写不读，落盘 `backend/data/ai-settings.json`（Q1 已确认，后续可升级 DPAPI）
  4. 本地偏好即改即存；大模型配置显式“保存并应用”，支持草稿测试、未保存离开拦截
  5. 前端不保存密钥、不复制服务商/引擎枚举；旧 `lexitype-settings` 存储键与旧字段做兼容迁移
- 实施切片：G0 已确认（2026-10-24）→ G1 分页壳 → G2 多引擎 TTS → G3a 普通音色与播放链路 → G3b 克隆音色 → G4 AI 配置存储与接口 → G5 大模型页 → G6 全链路验收
- 已确认决策：Q1 密钥落盘 `backend/data/ai-settings.json`；Q2 音色“精选 8 + 全部 174”；Q3 实验引擎默认隐藏、OpenVoice 正常展示；Q4 首版不自动拉模型；Q5 数据导入导出仅占位；Q6 音色先中性编号后试听定名；Q7 克隆最多 5 个/50MB；Q8 克隆用于试听/预缓存，课堂未命中回退普通音色；Q9 首版仅文件上传
- 状态：设计 `DONE`、决策 `DONE`；实现 `DONE`（G1–G6 全部完成），证据见下

### 批次G 实测证据（2026-10-24）

- 前端构建：`npm run build` 通过（`vue-tsc --noEmit` 无错误，`vite build` 产物生成成功）
- 后端测试：`backend/.venv/Scripts/python.exe -m pytest -q` → `27 passed`
- 引擎目录：`GET /api/tts/engines` 返回 `melo / aishell3 / kokoro / matcha / openvoice`，5 个引擎 `available=true`；音色数 1 / 174 / 103 / 1 / 0（克隆按档案）
- 多引擎合成：`kokoro:45` 返回 `sampleRate=24000, duration=0.42`；`aishell3:SSB0005` 返回 `sampleRate=8000, duration=1.55`
- 克隆链路：上传 3.48s 参考音频创建 `vc_xxx` → `engine=openvoice, voice=clone:vc_xxx` 合成成功（`duration=1.93`）→ 删除档案成功；参考音频、嵌入与缓存随档案清理
- 大模型接口：`GET /api/ai/providers`、`GET /api/ai/settings` 均 200；Ollama/自定义免密钥判定已修正（不再被误判为未配置）
- 前端页面：设置页 6 分页、`/settings?tab=` 深链、旧入口别名（`ai`→`models`、`tts`→`speech`、`migration`→`about`）、大模型未保存离开拦截均已落地
- 说明：`aishell3` 模型实际采样率为 8kHz（模型固有），界面未展示该数值，避免误导

## 三·补六、阶段4 · 批次H 课堂引导与学习点评 v1（已实现并验证 2026-10-24）

- 设计文档：`docs/design/classroom-guidance-and-feedback-v1.md`（APPROVED，v1 仅 P0）
- 范围：昵称引导、课堂键盘导航（←/→/空格/Esc）、完成点评（1–5 星 + 三句话 + 语音朗读）、点评记录落库
- 关键实现：
  1. 昵称：`settings.nickname` 全链路（默认值/迁移/持久化），设置页通用 Tab 可改；课堂首次进入且昵称为空时弹引导，跳过后本机不再重复（`lexitype_nickname_prompt_skipped`）
  2. 键盘：`ClassroomPage.vue` 全局监听并分发到舞台；输入框/组合键/长按/输入法组合态不拦截；精读 ←/→ 切句并朗读+滚动定位，燃尽 ←/→ 切题（向后未完成记为跳过），空格播放，Esc 退出输入
  3. 点评：`shared/utils/lessonFeedback.ts` 纯函数计算星级与三段文案；`LessonFeedbackDialog.vue` 展示星级/数据/点评并支持“听小老师说”
  4. 记录：复用 `learning_records.metadata`，`activityType=lesson-feedback`；燃尽自动触发，精读/词根顶栏“完成本课”手动触发
  5. 指标：燃尽新增 `firstTryUnits`、`skippedUnits` 与按单元键去重；完成数由已完成键集合推导，避免重复计数

### 批次H 实测证据（2026-10-24）

- 前端构建：`npm run build` 通过（`vue-tsc --noEmit` 无错误，`vite build` 成功，产物含 `ClassroomPage` 55.15 kB）
- 后端接口：临时独立 SQLite 建表后用 TestClient 实测 `POST /api/learning-records`（activityType=`lesson-feedback`, metadata.stars=4）→ 201；`GET /api/learning-records?courseId=course-test` → 200 且返回该记录；验证后已删除临时库，未写入开发数据
- 交互待实机复验：`NOT_RUN`（需在 5183 打开演示课程验证：昵称引导、左右键切句滚动、燃尽切题、点评卡朗读与落库）
- 后续版本（用户愿景）：开机语音引导、完成自动播报、AI 个性化点评、学习报告趋势页

## 四、未完成功能清单（按学习闭环优先级）

| 优先级 | 功能 | 现状 | 关键依据 |
| --- | --- | --- | --- |
| ~~P0~~ | ~~后端业务 CRUD（课程/课时/进度/练习/复习）~~ 已完成 | 4 组业务路由已上线并实测 | 见“批次B 实测证据” |
| ~~P0~~ | ~~前端数据源与后端统一~~ 已完成 | 5 个仓储全部走 HTTP；仅 TTS Blob 缓存留在 IndexedDB | `shared/services/apiClient.ts`、`shared/database/repositories/*` |
| ~~P0~~ | ~~真实存量数据迁移~~ 已完成 | 27 条掌握度 + 142 条复习日志已入库，17/17 校验通过 | 见“真实迁移证据” |
| ~~P1~~ | ~~统计页真实数据~~ 已完成（批次C 切片1） | 练习记录补齐 `totalItems/correctItems/wpm`，统计页去除随机数与模拟完成度 | 见“批次C 切片1 实测证据” |
| ~~P1~~ | ~~学习计划页~~ 已完成（批次C 切片2） | 多计划、自定义每日任务、打卡快照、页面内提醒、历史回顾均已落地 | 见“批次C 切片2 实测证据” |
| ~~P1~~ | ~~AI 对话/课程生成~~ 已完成（批次D） | 密钥下沉 `backend/.env`，前端统一走 `/api/ai/*` 代理；设置页只读状态 | 见“批次D 验证证据” |
| ~~P1~~ | ~~设置页分页与模型配置（批次G，含 OpenVoice 克隆音色）~~ 已完成 | 6 分页与深链、多引擎/音色选择、克隆上传/试听/删除、大模型服务商配置与草稿测试全部落地 | 见“批次G 实测证据” |
| P1 | 资源库与字幕导入 | 设计已产出（批次F F1/F5），当前仅有旧的 mock 导入逻辑 | `docs/design/english-learning-vision-v1.md`、`AILabPage.vue` |
| P2 | 游戏成绩持久化 | 结束不上报 | `GameCenterPage.vue` |
| P2 | 设置页数据导出/导入/清空 | 仅提示成功，未真正执行 | `AISettingsPanel` |
| P2 | 拼音练习 | 3 处 TODO | `PinyinPage.vue` |
| P3 | 翻译工具 / 词汇分析 | 各 2-4 处未完成 | `TranslateToolPage.vue`、`VocabularyAnalyzerPage.vue` |

## 五、后续执行计划

1. **批次C（P1）**：统计页真实聚合（切片1）与学习计划完整版（切片2）均已完成。
2. **批次D（P1）**：已完成（D1 后端代理 → D2 前端切换 → D3 设置页 → D4 清理验收）；待填入真实密钥后执行手工联调。
3. **批次E（P2）**：游戏成绩、设置数据管理、拼音、翻译/词汇页收尾。
4. **批次F（P1）**：英语学习体系设计已产出（`docs/design/english-learning-vision-v1.md`），待评审；通过后按 F0 调研 → F1 资源元数据与分类 → F4 悬停精读 → F3 燃尽法 → F2 词根扩展 → F5 字幕导入 → F6 AI 对话场景（硬依赖批次D）→ F7 验收 实施。
5. 遗留清理：`frontend/src/shared/database/dataMigration.ts` 仍为旧 IndexedDB 导入工具，未挂载到 UI；设置页数据管理（批次E）接入后端 `/api/migration/import` 后一并下线。
6. 可选补迁：`http://localhost:5173` 源（旧 Vue 版 IndexedDB，约 11KB）尚未导出，该端口被其它项目占用，待端口释放后执行。

## 六、验证命令

```powershell
# 后端
cd backend; .\.venv\Scripts\python.exe -m compileall -q .\app
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010

# 前端
cd frontend; npm run build
```

## 七、AI 调用失败修复（2026-10-24）

- 状态：已完成并验证（批次D 补丁）。
- 根因：`glm-5.3-flash` 为思考模型，`max_tokens` 被 `reasoning_content` 吃光（实测 13099 字符 reasoning、正文 0），`finish_reason=length`；课程/教材单次输出需求又远超 4000 预算，导致空响应或 JSON 截断。
- 修复：
  - 后端 `app/core/ai_providers.py` 新增 `thinking_disable_params()` 单点维护，`/api/ai/chat` 与 `/api/ai/chat/stream` 自动关闭思考（zhipu `thinking.type=disabled`，qwen3 `enable_thinking=false`）。
  - 前端 `aiService.ts`：课程生成超过 40 词自动拆为“大纲 + 每批 20 词”；补齐音频/翻译路径缺失的 JSON 结构；翻译上限 4000、教材词汇 5000；批次内按单词去重。
- 证据：同请求由 140s 无返回变为 38.9s / 14869 字符；真实 UI 中文生成英文课程 6 次调用全 `status=ok`（07:35:21→07:36:22）；教材单元 6.5s 可解析、词汇 10.4s、翻译 2.2s；`pytest` 31 passed；`npm run build` 通过。

## 八、课程学习缺陷修复（2026-10-24）

- 状态：已修复，构建通过，待用户实机复测。
- 缺陷1（词燃尽卡死）：`BurnDownStage.vue` 的“开始燃尽”按钮原仅 `mode === 'sentence' && stage === 0` 渲染，单词模式下 stage=0 输入框与提交按钮为 disabled，导致整课无法开始。修复：起点按钮对两种模式都渲染，文案随模式变化；单词模式完成/跳过/切题后直接进入 stage=1，不再每词多点一次。
- 缺陷2（语音不播放）：控制台报 `Failed to load because no supported source was found.`。修复：`ttsApiService` 持久化缓存增加音频文件头校验（RIFF/OggS/ID3/ADTS），损坏条目自动删除并重新合成；新增 `force` 参数跳过缓存；`useSpeechPlayer` 播放失败自动重试一次（强制重新合成），仍失败则 `fetch` 校验 `audio/*` 后用 Blob 兜底播放，最终失败日志带 `src` 便于定位。
- 验证：`npm run build` 通过；已复现四个学习环节中课堂加载、精读渲染、课时练习判分正常，词燃尽与语音为上述两处真实缺陷。

## 九、课程仓库分级 + 课堂老师语音引导（2026-10-24）

- 状态：已实现并验证；设计见 `docs/design/course-library-and-teacher-guidance-v1.md`。
- 需求1（生成语音）：实测当前设置（melo / melo:0 / rate=0.5）下，单词 `hello` 与 64~68 字符句子均返回有效 WAV（RIFF 头、0.75s / 6.84s / 7.38s），`/api/tts/audio/*.wav` 返回 `audio/wav`；中文老师台词 TTS 亦正常（2.59s）。补充修复：教材“生成音频”与课程预缓存均显式沿用设置页当前引擎/音色/语速，预缓存支持把例句句子一并缓存。
- 需求2（课程仓库分级）：新增纯函数 `shared/utils/courseTaxonomy.ts`，按 `tags`（含新增 `Textbook:/Grade:/Semester:` 标签）优先、标题/描述回退解析，输出「教材系列 → 年级册 → 单元课程」；课程仓库新增第三个视图 `textbook`，保留卡片/列表与批量操作，非教材课程归入“其他课程”。
- 需求3（老师语音引导）：`useTeacherGuide` + `TeacherBubble` 接入课堂，事件驱动台词状态机：开场、切换模式、报题并自动播放示范、答对鼓励、答错纠正、20/45 秒超时逐级提示、精读查词/生词本提示、完成总结；台词中文 TTS，字幕常驻底部，支持重播与静音，重复台词 8 秒去重、非关键台词 1.2 秒最小间隔。
- 子舞台事件：`BurnDownStage` 新增 `answer`（正确/错误/期望/阶段）与 `idle`；`ReaderStage` 新增 `activity`（lookup/add-word）。
- 验证证据（2026-10-24）：`npm run build` 通过；浏览器实测教材视图出现「鲁教版 · 鲁教版小学英语（三年级起点，五四制）→ 三年级 · 上册 → 10 个单元」三级结构；课堂实测底部老师气泡台词为“小玉米，我们开始吧。我们来做词燃尽……第 1 个单词，先听一遍示范，再点开始。”，`POST /api/tts/generate` 返回 200；答错与 20/45 秒超时均触发对应纠错/升级提示，控制台无 error。
- 附带修复（控制台 35 条 `net::ERR_ABORTED`）：根因为 `unplugin-vue-components` / `unplugin-auto-import` 在开发与构建期间反复重写 `components.d.ts`、`auto-imports.d.ts`，Vite 将其视为源码变更并触发整页刷新，浏览器正在加载的模块被中断。已在 `frontend/vite.config.ts` 的 `server.watch.ignored` 中忽略这两个类型声明文件；验证：修改其时间戳不再触发 page reload，首页与课堂页新鲜加载均为 0 条 error。

## 十、“没有声音”三层根因修复（2026-10-24）

- 状态：已修复并验证；用户反馈现象为课堂有字幕但无声音。
- 根因1（CSP 拦截媒体）：`frontend/index.html` 的 CSP 未声明 `media-src`，媒体加载回退到 `default-src 'self'`，后端 `http://127.0.0.1:8010/api/tts/audio/*.wav` 与 `blob:` 音频全部被拦截，控制台报 `NotSupportedError: Failed to load because no supported source was found`。修复：显式声明 `media-src 'self' blob: data: http: https:`（保留 http/https 兜底，支持通过 `VITE_TTS_API_URL` 指向局域网 TTS）。
- 根因2（非法音色导致合成失败但 HTTP 200）：历史设置残留 `ttsEngine=openvoice / ttsVoiceId=openvoice:0`，openvoice 只接受真实克隆音色 `clone:xxx`，后端合成失败仍返回 HTTP 200 + `success:false`，前端只看到字幕。修复：`renderer/stores/settings.ts` 迁移时回退 `melo/melo:0`；`composables/useSpeechPlayer.ts` 增加运行期同款兜底并输出 warn 日志。
- 根因3（静音开关被持久化为开启）：`lexitype_teacher_voice_muted` 存在 localStorage 且值为 `1`，`useTeacherGuide.say()` 走静音分支只更新字幕不合成语音。修复：改为 **sessionStorage** 会话级存储（新标签页/重启后自动恢复有声）；进入课堂时若检测到静音输出 `info` 日志；`TeacherBubble` 静音态改用琥珀色并让图标表达当前状态（静音=划掉喇叭），标题文案改为“老师语音已静音，点击开启”，避免把“开启声音”误点成静音。
- 验证证据（2026-10-24，浏览器实测）：课堂页在 `sessionStorage` 静音键为 `null` 时，老师气泡正常出现，文案为“小玉米，我们开始吧。今天我们精读《词根 spect：看见的家族》。鼠标划过句子会自动朗读，遇到生词可以打开词卡。”；控制台出现 `[speech] 开始播放 {key: teacher:3:..., attempt: 1}` 与 `[classroom-teacher] 老师播报结束 {priority: 3, completed: true}`，说明 `await audio.play()` 已成功、整段台词播完；音频命中 IndexedDB 缓存时 `performance` 中无 `/api/tts/generate` 请求（`ttsCount=0` 属缓存命中，非失败）；控制台无 error，无 CSP/NotSupportedError/NotAllowedError。前端 `npm run build` 通过（32.87s）。



## 十一、练习模块审计与入口修复（2026-10-24）

- 任务：修复练习中心听力/口语按钮无响应，并审查快速练习、课程练习、错题复习与统计入口。
- 代码已提交到 main：推荐听力/口语入口可启动指定模式；课时页支持 `mode` 深链自动开始；快速练习优先查找有题目的课时；课程练习面板从占位页改为真实课程列表；错题复习支持按错题 ID 启动单题复练；快速启动区拆分错题与复习队列事件。
- 数据修复：今日统计读取后端练习记录；推荐错误率与高频错题从持久化练习记录计算；近 30 天模式准确率与错题数量图表移除固定示例值；统计请求失败显示错误提示。
- 审计报告：`docs/tasks/PRACTICE_MODULE_AUDIT_2026-10-24.md`。
- 尚未完成：课程间隔复习队列未接入独立数据源；跟读/模仿真实麦克风、ASR、TTS 与完整结果持久化仍需浏览器/Windows 实测；本次没有本机运行验证。
- 验证状态：GitHub Actions 对当前提交 `6b86cd9` 的前后端 CI 正在运行（截至记录时未完成）；不得标记 PASS，需以最终 Actions 结果更新。


## 十二、教材生成可靠性与性能优化（2026-10-24）

- 状态：代码已提交，CI/运行验证待完成；不可标记 VERIFIED。
- 目标：修复教材生成步骤状态、默认全选、内容类型增补归类、目录请求重复与页面切换后生成结果丢失。
- 已实现：
  - 解析单元和命中单元缓存时默认不勾选任何单元，避免误触发全量生成。
  - 系列、教材目录、单元目录请求增加模块级 in-flight 去重；教材目录命中缓存时保留当前有效选择，避免无谓清空和重选。
  - 生成任务在 localStorage 保存检查点：教材身份、选中单元/内容类型、已完成项、失败项、已生成课程草稿、当前任务项和时间戳。
  - 单元 × 内容类型维度记录成功状态，只有返回可用课程内容后才标记该类型完成；失败类型不被误标为成功。
  - 生成日志增加单项耗时、完成/失败计数；支持从检查点继续/重试失败项。
  - 页面卸载不会主动取消当前 JS 异步循环；每种内容完成后立即写检查点，重新进入页面可恢复任务，并在完成后重新读取草稿预览。
  - 增补时复用同一教材身份的上次生成草稿，保留原有课程，只生成所选单元中尚未完成的内容类型，避免把新内容错误覆盖或混入其他教材。
- 已知边界：
  - 当前后台执行依赖应用标签页仍然打开；刷新/崩溃/关闭标签页时，正在进行的单个 AI HTTP 请求无法从中间 token 续跑，但请求结束后已完成项可从检查点恢复；未完成项需要重新请求。
  - 草稿恢复以本地浏览器 localStorage 为基础，尚未迁移成后端持久化任务队列；换浏览器/清理站点数据不会跨设备恢复。
  - 生成耗时的真实瓶颈需要在实际 AI provider/模型下采集请求时长、输出 token、超时/重试次数；本次仅补充单项耗时日志，未执行真实模型压测。
- 验证：GitHub Actions Frontend quality 对提交 `0134e3a` 的结果待查询；此前 `093c72b` 前端 typecheck 失败，已按错误日志修复按钮事件参数类型。后端 CI 对前端改动无直接覆盖意义；Windows/浏览器端到端测试 NOT_RUN。


## 十三、主用教材生成面板审计补充（2026-10-24）

- 主用入口为 `frontend/src/renderer/components/ai/TextbookImportPanel.vue`；此前 TypeScript 检查暴露该文件调用了未定义的 `markCheckpointTask`。现已实现逐内容类型保存检查点，并修复相关类型检查问题。
- 修复主用面板解析单元后默认全选；新增手动补充单元；课程识别增加出版社/系列/教材身份约束，避免同名教材串用；生成空内容不再标记成功。
- 生成进度改为内容类型级别，同时显示完整单元进度；后台任务检查点记录当前单元、内容类型、完成项、教材年级和手动补充单元；页面切换后恢复进度，完成后恢复预览。
- 系列/教材/单元目录增加并发请求去重；单元缓存按出版社、系列、年级、教材名称隔离；主用面板采用最多 2 个单元并发 worker，降低串行 AI 往返的总等待时间。
- 详细审计：`docs/tasks/TEXTBOOK_GENERATION_AUDIT_2026-10-24.md`。
- 状态：代码已提交；最新前端 CI 尚待最终结果；浏览器/Windows E2E、刷新恢复和真实模型性能压测均为 NOT_RUN。后台任务目前仍是前端 localStorage 检查点方案，不是后端常驻任务队列。


- 补充优化：`frontend/src/shared/services/apiClient.ts` 对同一路径/查询参数的并发 GET 做请求合并（不缓存已完成响应，避免陈旧数据）；手动补充单元写入年级隔离的目录缓存；保存课程时禁止仅凭同名标题跨出版社/系列合并。


### 十三、教材生成任务验收状态更新（2026-10-24）

- 最新功能代码提交 `eba4bde6f8af63bd14c32800360c56f3ce55e532`：Frontend quality 和 Backend quality 均通过（前端包含 TypeScript typecheck 与 production build）。
- 最新进度修正：完整单元数现在按该单元所选内容类型全部完成计算，不再把“单元标题”误当成内容类型任务键。
- CI 仅证明自动化检查通过；浏览器切换页面持续运行、刷新/异常后恢复、真实模型耗时与 Windows E2E 仍为 NOT_RUN。
- 详细报告：`docs/tasks/TEXTBOOK_GENERATION_AUDIT_2026-10-24.md`。


## 学习内容与学习方法兼容性（2026-10-24）

- 状态：代码提交 `6bb6fab842e006e1f78bc8227cf9eb098d284d28` 的 Frontend quality 与 Backend quality 均 PASS；浏览器 E2E NOT_RUN。证据：[Frontend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40080120807)、[Backend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40080120779)。
- 新增统一规则：`frontend/src/shared/utils/learningMethodCompatibility.ts`，供课堂入口与课堂页共用。
- 修复：入口弹窗按内容形态动态推荐；不适用的方法禁用并显示原因；课堂导航阻止不兼容切换；直接 URL 指定不兼容模式时回退到推荐模式。
- 规则：word/phrase → 词燃尽；sentence → 句子燃尽（需有完整多词句）；passage/dialog → 精读，必须先拆分为独立句子后才能做句子燃尽；词根课堂要求单词课中至少两个词条共享明确 root/rootGroupId 分组。
- 设计文档：`docs/design/learning-method-compatibility-v1.md`。
- 保护边界：未修改历史课程内容；未自动把篇章转换成词汇课；未将音标字段等同于音素教学能力。
- 待验证：前端 typecheck/build、直接 URL 兼容性、入口弹窗默认模式、无词根数据时词根模式禁用、窄屏禁用态显示。


## 单元整体学习 + 双模式课堂（2026-10-24）

- 状态：DOING（代码实现与 CI 已通过；浏览器 E2E 待验证）。
- 设计：`docs/design/unit-learning-modes-v1.md`。
- 新增 `frontend/src/renderer/views/UnitLearningPage.vue`，按整个 Course/单元聚合现有 lessons/items，流程为单元导入 → 通读篇章/对话 → 重点句子 → 重点词汇 → 语法 → 输出检查 → 总结。
- 新增自主学习模式：原文朗读、显示/隐藏翻译、重点句/词展示、语法讲解按需调用现有 AI、基于真实文本提交的小测与即时相似度反馈；阶段进度/小测统计保存本地检查点。
- 跟读：链接到既有 `LessonPracticePage.vue?mode=follow`，复用当前练习和结果反馈，不伪造 ASR/发音准确率。
- 新增 AI 老师模式：复用 `conversationCoreService` 与现有持久化会话，关联课程 ID 和本单元材料；按协议一次讲一个重点、提问、等待回答并反馈。会话保存到既有 ai_task_logs，不新增表。
- 新增路由 `UnitLearning`，课程详情提供“开始单元学习”入口；旧的逐课时课堂入口保留。
- 数据边界：不迁移或改写原课程，不新增内容表；语法讲解为 AI 临时生成内容，未写回原教材。
- CI 证据：Frontend quality PASS（TypeScript typecheck + production build，https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40083684942）；Backend quality PASS（https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40083684818）。待验证：AI 会话恢复、TTS/跟读跳转、不同内容形态空状态、刷新后进度恢复、Windows/浏览器 E2E。

- 单元整体学习补充修正（2026-10-24）：阶段跳过与真正完成分开保存，跳过项单独显示且不计入完成率；重新完成阶段时清除其跳过状态。篇章拆句时不再把整段中文误配到第一句，也不把提取句链接到整段跟读项目。等待新分支 CI 验证；浏览器/Windows E2E 仍待执行。


## 主干产品与实现专项审计（2026-10-26）

- 正式清单：`docs/product/MAIN_BRANCH_PRODUCT_AUDIT_AND_IMPLEMENTATION_BACKLOG.md`。
- 审计基线：`main` 原提交 `e37526ec927b00cd26bf7146ac0439137c2614c3`；本轮只读核对页面、服务、路由、Skills 注册表、工作流和既有任务证据。
- 确认现状：首页已经消费真实学习看板；教材生成具备类型选择、断点、并发和部分保存重试；课程仓库具备集合层级；AI 教学/面试共享对话页面已存在。上述功能的真实浏览器/Windows 运行状态仍须分别验证。
- 修复：`frontend/src/renderer/components/ai/TextbookImportPanel.vue` 的 `getExistingTypes()` 不再把“课文/对话”宽泛识别为“句子”，改为具体标记优先、非重叠分类。
- 修复提交：`82be5efd6741ad45e437a0d67c6d1fa27a890fc7`；状态 `FIXED_PENDING_CI`，本轮尚未执行前端构建/浏览器回归，不可标记 VERIFIED。
- 新增正式审计清单提交：`f392e80b06494d3158d6fcc9b19ef568e4fee1e8`。
- 后续 P0 顺序：教材草稿/断点配置变化保护 → 生成进度与状态一致性验收 → 首页学习恢复和错误态 → 内容形态/教学方法契约 → 共享对话内核运行验收。
- Skill 证据：本轮实际读取并使用 `.aimes/skills/product-manager/SKILL.md`；该 Skill 头部状态为 PROPOSED，注册表相关 `validation_status` 仍有 UNKNOWN，不能宣称工具运行时自动路由已验证。
- 测试证据：以修复提交 `82be5efd6741ad45e437a0d67c6d1fa27a890fc7` 对应的 GitHub Actions 结果为准；本地构建、真实教材增补、刷新/重启、Windows 实机和浏览器 E2E 均需单独记录。

- 补充修复提交：`e4972e4b4f9c9da98251257c7c5d1ebc531e9fea`，旧课程标题中的“句型”也归入 sentences 类型；同样待前端 CI 与真实教材回归。
- 增补审计：已追加 `LTA-P0-11`（单元默认选择与增补行为）及 `LTA-P1-12`（教材生成耗时分解与安全优化）；耗时优化必须先取得可复现基线，不直接盲目提高并发。


## 产品深度评估与 Top 10 竞品对标（2026-10-26）

- 正式报告：`docs/product/PRODUCT_DEEP_REVIEW_AND_TOP10_BENCHMARK.md`。已基于当前 main 的页面/服务/Skill 静态代码和公开竞品资料建立事实、推断与 NOT_RUN 边界。
- 竞品范围：Duolingo、Babbel、Busuu、ELSA Speak、Speak、Memrise、British Council LearnEnglish、Anki、Pimsleur、LingQ；报告明确这不是未经方法学支持的绝对排名，也未声称本轮实机试用十款产品。
- 首批微文案修复：ClassroomPage.vue commit `306a27ea619b5cda58fff1b252b89be88e5e21a2`；ConversationPage.vue commit `0ee9e28ee9d6c6e3858a6235a7923665ab4029a0`。前端 CI #245、后端 CI #160 在最后查询时仍为 pending；前一提交 #242/#157 成功不代表新改动已验证。
- 下一步：等待最新 CI；为教材生成断点/部分成功、课堂 TTS 状态、对话失败重试补充自动化/可重复验收；在 Windows 真实窗口下检查按钮层级、键盘焦点、窄屏、音频打断与教师台词时序。


## 五、产品基线驱动的实现与证据闭环（2026-10-26）

| 任务 | 状态 | 验收证据 |
| --- | --- | --- |
| 建立产品基线执行与证据协议 | DONE（协议文档已提交；执行效果待后续任务验证） | [PRODUCT_EXECUTION_AND_EVIDENCE_PROTOCOL.md](../docs/product/PRODUCT_EXECUTION_AND_EVIDENCE_PROTOCOL.md)，提交 `ec728aeaded98292f5d6b9cc4a0af2cbf7039041` |
| 每项改动强制回答用户价值、交互决策、效果证据三个问题 | DOING（作为后续任务门禁） | 每项任务必须附产品基线章节、验收标准、自动化测试和真实运行证据；当前没有因协议落盘而自动视为已验收的功能 |
| 从产品深度评估报告逐项实施 P0 | TODO | 首选教材生成状态/草稿/检查点/部分成功闭环；实施前复核当前 main、CI 和相关 Skill |
| 关键 UI/AI 文案真实窗口验收 | TODO | 目标环境、视口、操作步骤、实际结果及截图/日志；未执行前保持 NOT_RUN |


## 五、产品基线实施任务（2026-10-26）

| 任务 | 状态 | 验收证据 |
| --- | --- | --- |
| 将教材已有内容类型识别提取为纯函数并补齐单元测试 | CI_PENDING | [规则实现](https://github.com/laodongAI/LexiTypeAcademy/commit/881183c4e98cd96ed4e38bf292175fd0d1b5fa97)、[测试](https://github.com/laodongAI/LexiTypeAcademy/commit/5b6fbcdbdfa9e389ec8463d77818411fa681c091)、[组件接入](https://github.com/laodongAI/LexiTypeAcademy/commit/07292afd383858aeaa8be4d44ee4ac04346b87c7)、[前端 CI #256](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281030870) |
| 将纯函数单元测试纳入 Frontend quality workflow | CI_PENDING | [workflow 修改](https://github.com/laodongAI/LexiTypeAcademy/commit/6417e76e3798ae4daf1b938d3ebfb00cb1e97a4e)；需等待 CI 实际执行结果 |
| 教材生成草稿隔离、检查点保护、部分成功和恢复 | TODO | 需先设计多教材并存/冲突处理和数据保护验收，再编码 |
| 真实教材增补与刷新/重启恢复 E2E | NOT_RUN | 需要目标浏览器/Windows 环境及真实教材数据 |


## 六、教材生成 P0 实施（2026-10-26）

| 任务 | 状态 | 验收证据 |
| --- | --- | --- |
| 内容类型识别纯函数与边界单元测试 | TEST_PASS（12 项单元测试整体通过） | [测试与规则提交](https://github.com/laodongAI/LexiTypeAcademy/commit/5b6fbcdbdfa9e389ec8463d77818411fa681c091)、[测试接入 CI](https://github.com/laodongAI/LexiTypeAcademy/commit/6417e76e3798ae4daf1b938d3ebfb00cb1e97a4e) |
| 多教材检查点隔离、旧版迁移、明确替换确认与定向清理 | TEST_PASS（自动化/构建） | [存储仓库](https://github.com/laodongAI/LexiTypeAcademy/commit/4eaf6c5eca933bb4106e840e08342938ae7c5648)、[保存后定向清理](https://github.com/laodongAI/LexiTypeAcademy/commit/38f7e11da8f140c130c228be768961f8d69ba337)、[代码提交](https://github.com/laodongAI/LexiTypeAcademy/commit/9786de955a90a815e761cb28909796c4ad5256fe)；Frontend quality #268 与 Backend quality #183 均 PASS，前端 12 项单测、类型检查和生产构建通过 |
| 生产构建和 Backend quality 对当前代码的最终结果 | PENDING | [Frontend quality #268](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281817242)、[Backend quality #183](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40281817275) |
| 浏览器/Windows 多教材切换、配置替换、刷新恢复、存储配额异常 E2E | NOT_RUN | 需要目标浏览器/Windows 环境；单元测试不能替代实机验收 |


## 英语学习核心体验 P0-A：播放驱动的句子同步（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 产品基线与源码审查 | DONE（STATIC_REVIEW） | `docs/design/english-learning-core-experience-restructure-v1.md`、`docs/tasks/ENGLISH_LEARNING_UX_SOURCE_AUDIT_2026-10-26.md`；已读取 product-manager 与 ui-implementation-validation Skill 正文 |
| 连续播放时当前句高亮/定位跟随实际播放 key | IMPLEMENTED_UNVERIFIED | 分支提交 `e6d97e4c61c342cffccc4f3749ccf9136394fa37`：`ReaderStage.vue` 监听共享播放器 `playingKey`，映射句子/词条索引并在 DOM 更新后定位；连播被中断时不再把所有句子记为已读 |
| 播放 key → 渲染索引纯函数及单元测试 + 手动滚动控制 | TEST_PASS（最新代码 SHA） | `readerSpeechSync.ts`、`readerSpeechSync.test.ts` 与 `ReaderStage.vue` 自动跟随/手动滚动暂停/返回当前句；最新 [Frontend quality #286](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40289483314) 对 SHA `9aa41da94c49aecd62b0889c3357ce8e97a1ca94` 的单测、类型检查和生产构建均 PASS。真实 Windows/浏览器交互仍 NOT_RUN |
| 连续至少 10 句真实播放/高亮/滚动回归 | NOT_RUN | 当前执行环境没有目标 Windows 应用/真实浏览器交互会话，不能伪称已运行；需在本机连续播放至少 10 句，并覆盖切句、暂停/停止、手动滚动、TTS 失败与旧事件 |
| 用户手动滚动时的自动跟随暂停/“回到当前句” | IMPLEMENTED_UNVERIFIED | `ReaderStage.vue` 增加跟随开关、滚轮主动滚动后暂停自动定位，以及“回到当前句”；仍需浏览器验证滚动意图与键盘/触控行为 |
| 两套语音播放服务的并存边界 | TODO（边界已定位） | `FollowMode.vue` 的 `audioPlayService` 会创建自己的 `HTMLAudioElement`，TTS 失败时可回退 `speechSynthesis`；`ReaderStage.vue` 的 `useSpeechPlayer` 使用模块级唯一 `Audio`。目前是不同路由/组件路径，尚无证据证明它们同时播放；后续检查页面切换/卸载与教师播报打断，不应直接断言双音轨 |

**本切片验收状态：** 静态修改已提交到 PR 分支；自动化测试/类型检查/构建等待 CI；Windows/浏览器 E2E、截图、真实 TTS 时序与用户效果验证均为 `NOT_RUN`。不得将代码写入或 CI 通过单独视为产品验收完成。


## 英语学习核心体验 P0-B：AI 老师黑板式课堂（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 将 P0-A 设计、播放同步、测试和交接记录合并到 main | MERGED | [PR #10](https://github.com/laodongAI/LexiTypeAcademy/pull/10)，合并提交 `f62373afff6e8f508bb662944857b86b4b2c939c)；后续默认直接在 `main` 开发 |
| AI 老师主界面改为当前讲解黑板，历史消息默认折叠 | IMPLEMENTED_UNVERIFIED | `frontend/src/renderer/views/UnitLearningPage.vue`；黑板展示最新 assistant 消息，保留完整历史记录，不新增会话存储 |
| 固定回答区、状态提示与失败恢复入口 | IMPLEMENTED_UNVERIFIED | 新增当前讲解播报、思考/等待状态、启动失败与发送失败区分、Ctrl+Enter 提交；尚未实机验证 |
| 移除 AI 历史记录自动滚底 | IMPLEMENTED_UNVERIFIED | 不再在每次消息变化后强制设置历史滚动位置，避免夺回用户滚动控制权 |
| 前端单测与类型检查 | PASS（代码 SHA `570c2a09049b9f8954e40a86c6f4817d178207b1`） | [Frontend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40290310921)：单测、TypeScript 类型检查已通过；生产构建最终 PASS；[Frontend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40290310921) 单测、类型检查、生产构建均 PASS |
| 后端质量检查 | PASS（代码 SHA `570c2a09049b9f8954e40a86c6f4817d178207b1`） | [Backend quality](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40290310907) |
| Windows/浏览器真实课堂验收、窄屏/键盘、长回复、AI 错误恢复 | NOT_RUN | 需在目标窗口验证当前讲解是否清晰、历史折叠行为、输入区可达性、启动失败重试和发送失败重试；CI 不能替代视觉/交互验收 |
| 学习效果验证 | NOT_RUN | 尚无用户测试数据，不宣称已改善完成率或学习效果 |

**产品理由：** 用户需要一眼看到当前教学重点和下一步，而不是在连续聊天记录中自行定位。历史对话仍可查阅，但默认不抢占主视觉；回答操作保持稳定位置。验收必须分别记录自动化、真实运行和用户效果证据。


## P0-B 可靠性补充：AI 老师发送失败重试不重复追加消息（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 以持久化会话作为重试判定基线，避免 UI 旧 session 导致重复追加用户消息 | IMPLEMENTED | `frontend/src/shared/services/conversationCoreService.ts`：每次发送先读取已保存会话；只有最新尾部用户消息与本次文本完全一致才复用 |
| AI 老师课堂失败后刷新已持久化会话状态 | IMPLEMENTED | `frontend/src/renderer/views/UnitLearningPage.vue`：回答失败后重载会话，保留输入并允许重试 |
| 启动阶段存在已保存但未收到回复的用户消息时恢复同一请求 | IMPLEMENTED | 重试启动时检查现有活跃会话的尾部消息并重发原消息，避免创建重复会话/重复请求内容 |
| 增加重试去重纯函数测试 | PASS | `frontend/src/shared/utils/conversationRetry.test.ts` 覆盖同一尾部用户消息复用、尾部为 assistant 时不复用、文本不一致/空历史不复用 |
| Frontend quality | PASS | [Run #40291216089](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40291216089)：单元测试、类型检查、生产构建均通过；代码 SHA `57132229dd4f8ced72f5a782be88624613935318` |
| Backend quality | PASS | [Run #40291216256](https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40291216256)：通过；同一代码 SHA `57132229dd4f8ced72f5a782be88624613935318` |
| 真实 AI 超时/网络中断后的端到端恢复 | NOT_RUN | 纯函数与 CI 已验证；真实网络故障、服务端超时、刷新后恢复仍需窗口级测试 |

**发现原因：** 对话内核先持久化用户消息；若 AI 请求失败，UI 原先保留旧的内存会话，重试时内存消息尾部仍是上一条 assistant 消息，去重逻辑无法识别已保存的待处理用户消息。此次改为读取持久化会话再判断重试，并在 UI 失败后恢复已保存状态。


## 2026-10-26 · AI 课堂沉浸式入口与学习模块职责澄清

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| AI 老师课堂改为全屏沉浸式窗口层 | IMPLEMENTED | `UnitLearningPage.vue` 使用 Teleport、dialog 语义、显式退出与 Escape 退出 |
| 讲解/历史/回答区重新分层并适配窄屏 | IMPLEMENTED | 主讲解区弹性滚动，历史区域限制高度，回答区独立布局 |
| 讲解朗读语言策略调整 | IMPLEMENTED | 含中文字符用中文朗读，纯英文文本用英文朗读；混合语音分段仍待设计 |
| 学习计划与我的学习职责文案 | IMPLEMENTED | 计划=目标/排期/任务/打卡；我的学习=课程实际进度/学习历史 |
| 前端 CI 与真实窗口验收 | NOT_RUN | 提交后以 CI 结果补录；localhost 真实窗口尚未由自动化浏览器验证 |

设计记录：`docs/design/ai-classroom-experience-v1.md`。


### AI 课堂教学协议补充（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| AI 老师提示词输出结构化教学标记 | IMPLEMENTED | `conversationCoreService.ts` 要求状态、目标、讲解、问题、反馈与下一步标记 |
| 前端将教学标记渲染为独立卡片 | IMPLEMENTED | `teacherLessonPresentation.ts` 解析；旧自由文本回退为讲解卡片 |
| 结构化教学解析单测 | IMPLEMENTED | `teacherLessonPresentation.test.ts` 覆盖标签顺序、旧消息兼容、空章节 |
| 持久化教学状态机、证据化评价与掌握度更新 | TODO | 当前只定义输出格式，尚未把教学状态和评价结果作为独立领域数据持久化 |


- 补充可访问性：课堂进入时将键盘焦点移入 dialog，退出后恢复到 AI 老师入口；已提交，真实键盘验收仍 NOT_RUN。


### AI 课堂上下文与学习事件补充（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 课程上下文在 10,000 字符预算内保持有效 JSON | IMPLEMENTED | `teacherLessonContext.ts` 按完整条目装配；对应测试覆盖超长材料 |
| 成功对话轮次写入统一学习事件 | IMPLEMENTED | `conversation_turn_completed` 记录消息 ID、输入长度与课程关联，不保存答案正文 |
| 上下文与轮次事件自动化验证 | PENDING | 等待当前 main 的前端 CI |
| 将教学反馈转为可追踪的评价结果/掌握度 | TODO | 不能仅凭 AI 自述更新掌握度 |


### 学习导航与跟读体验修正（2026-10-26）

| 任务 | 状态 | 验收边界 |
| --- | --- | --- |
| 侧边栏移除同级“学习计划”，从“我的学习”进入“目标与计划” | IMPLEMENTED | 计划独立路由保留兼容，前端 CI 待完成 |
| 我的学习页面提供目标与计划快捷入口 | IMPLEMENTED | 真实导航验收 NOT_RUN |
| 跟读题目进入/切换时自动领读 | IMPLEMENTED | 复用现有 TTS 服务；真实音频设备/自动播放行为 NOT_RUN |
| 跟读方向键导航 | IMPLEMENTED | ← 上一项；→ 当前题完成后下一项；真实键盘验收 NOT_RUN |


### 练习与复习静态审查（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 修复自适应练习推荐组件事件绑定中的字面量换行 | IMPLEMENTED | `AdaptivePracticeCenterPage.vue` |
| 复习进度按当前已复习项计算，完成时不再同时显示复习卡与完成结果 | IMPLEMENTED | `ReviewPage.vue` |
| 无有效复习会话时不将正确率显示为 0%；改为“本轮正确率”并显示 — | IMPLEMENTED | 避免误导用户 |
| 复习卡片背面语义修正为“掌握状态” | IMPLEMENTED | 当前数据模型 `DueWord` 没有释义字段，不能伪造单词释义 |
| 复习词义/例句关联、复习与课时练习的统一学习记录 | TODO | 需要追溯词典/教材数据源并设计统一事件口径 |
| 最新主干 CI | PENDING | 以最新代码提交对应 Actions 为准；真实窗口验收 NOT_RUN |


### 学习方法全景与 UI 流程梳理（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 盘点内容类型、学习方法、产品入口的区别 | STATIC_REVIEW | `docs/design/learning-methods-and-ui-flows-v1.md` |
| 逐方法梳理自主单元、AI 老师、精读、词燃尽、句子燃尽、词根、跟读、模仿、听写、翻译、复习、错题与快速练习的流程/UI | PROPOSED | 包含适配矩阵、AI/语音边界、状态和验收清单 |
| 移除模仿模式随机生成的假波形 | IMPLEMENTED | `ImitationMode.vue` 改为标准发音/用户录音状态面板；真实波形能力未实现时不再误导用户 |
| 复习词条与真实释义/例句数据关联 | TODO | 当前 `DueWord` 结构仍缺少释义/音标/例句，需追溯课程/词典数据源 |
| 全部方法真实 E2E 与 AI/TTS/ASR 验收 | NOT_RUN | 需要真实浏览器、音频设备和服务端环境；静态盘点不能代替运行验收 |


### 继续改进：模仿评分真实性与样式构建修复（2026-10-26）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| 修复 `ImitationMode.vue` 的 SCSS 构建错误 | FIXED_PENDING_CI | 恢复完整嵌套规则与响应式样式；等待最新前端 CI |
| 移除模仿评分服务失败时固定返回 70 分并判定正确的降级逻辑 | IMPLEMENTED_PENDING_CI | 评分服务失败时不再显示伪分、不再发出答对事件；提示用户检查服务并允许重试 |
| 移除缺失流畅度字段时默认补 70 分 | IMPLEMENTED_PENDING_CI | 仅使用评分服务实际返回值 |
| 复习卡关联真实释义/音标/例句 | TODO | `DueWord` 当前仅包含 word/source/level/nextReview/reviewCount；需定位词典/教材数据模型并建立可靠关联 |
| 最新主干前端/后端 CI | PENDING | 前端 https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40308885553；后端 https://github.com/laodongAI/LexiTypeAcademy/actions/runs/40308885589 |


## 竞品亮点借鉴与第一版产品改进设计（2026-10-27）

| 任务 | 状态 | 验收证据 / 边界 |
| --- | --- | --- |
| 六个英语学习竞品亮点、借鉴判断与现有功能映射 | PROPOSED | `docs/product/COMPETITOR_INSPIRED_PRODUCT_IMPROVEMENT_V1.md`；官方产品页面链接已记录 |
| 复杂教学规则后置、学员流程与 UI 简化原则 | PROPOSED | 同上：统一课堂、内容类型活动模板、首页单一主任务、设置页默认/高级分层 |
| 后端学习任务推荐与教学规则编排 | TODO | 先审计当前 main 的服务、数据契约和已有能力，避免平行数据源；需定义 API/错误态/幂等与测试 |
| 统一学习活动模板（词、句、文章/对话、跟读） | TODO | 先对照现有学习方法实现与 UI；按小切片复用组件并验收 |
| 写作修订、短口语和 AI 对话反馈闭环 | TODO | 先核实现有入口/数据模型；原稿保留、ASR/评分证据边界、来源关系和失败恢复为硬门禁 |
| 本版设计文档纳入 README 与 docs 导航 | DONE | `docs/README.md`、`README.md` 已链接新设计文档；GitHub 写入成功 |
| 自动化验证、Windows/浏览器课堂验收、学习效果基线 | NOT_RUN | 本次只写入产品设计与任务记录；未修改业务代码，未运行项目测试或实机验收 |

**实施顺序建议：** 先完成 P0 证据核查与真实运行缺陷，再实施首页“下一步学习”聚合；随后以单词、句子、文章/对话和跟读为代表流程统一课堂；最后将写作/口语/会话反馈转为可追溯复练。所有实施任务必须先核对当前 main 与已有 P0 清单，避免重复实现。


## 第一轮实施：首页唯一下一步主操作（2026-10-27）

| 任务 | 状态 | 证据 / 下一步 |
| --- | --- | --- |
| IMP-01A 下一步学习确定性排序 | IMPLEMENTED_UNVERIFIED | 新增 `frontend/src/shared/utils/nextLearningAction.ts`，复用现有看板数据；新增 6 个规则分支单元测试，等待 CI 实际执行 |
| IMP-01B 首页主操作简化 | IMPLEMENTED_UNVERIFIED | `HomePage.vue` 首屏改为动态推荐标题、原因和单一主操作；移除重复的继续学习卡片，保留次级 AI 对话入口 |
| IMP-01C 读取失败与真实空状态区分 | IMPLEMENTED_UNVERIFIED | 推荐规则识别数据警告；练习统计读取失败保留 null，不以 0 代替；待故障注入和浏览器验收 |
| IMP-01D 后端推荐 API 架构决策 | TODO | 当前切片沿用既有前端聚合服务；先审查 FastAPI 各仓库/看板 API，确定是否有必要新增聚合端点，不得直接复制业务规则 |
| IMP-01E CI 与 Windows/浏览器验收 | NOT_RUN | 当前对话没有运行本地项目命令或浏览器；需查看 GitHub Actions 结果并执行真实窗口验证 |


## 英语对话语音交互第一切片（2026-10-27）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| CONV-VOICE-01 AI 回复 TTS 朗读入口 | IMPLEMENTED_UNVERIFIED | `ConversationPage.vue` 对 AI 回复提供按需朗读，复用现有 `generateSpeech`；TTS 服务状态与浏览器播放仍需实测 |
| CONV-VOICE-02 麦克风录音转写 | IMPLEMENTED_UNVERIFIED | 使用 `getUserMedia` + `MediaRecorder` 录制，调用既有 `asrApiService.recognize` 将英文转写填入输入框；用户确认后才发送，避免误发 |
| CONV-VOICE-03 权限与失败反馈 / 清理资源 | IMPLEMENTED_UNVERIFIED | 覆盖浏览器不支持、麦克风拒绝、空录音、ASR 失败提示；组件卸载时停止录音轨道并停止播放 |
| CONV-VOICE-04 连续自动收音闭环 | TODO | 当前仍需用户点击开始/结束录音，尚未实现 AI 播放结束自动收音、静音检测与轮次状态机；须在真实设备验证 ASR 能力后实施 |
| CONV-VOICE-05 CI 与真实浏览器/麦克风验收 | NOT_RUN | 需查看本次提交 Actions；本次未运行本地构建或真实浏览器/麦克风测试 |


## 连续语音对话试验切片（2026-10-27）

| 项目 | 状态 | 说明 |
| --- | --- | --- |
| 可选连续语音模式入口 | IMPLEMENTED_UNVERIFIED | 学员显式开启，可随时退出；默认不自动收音 |
| 静音检测结束一轮录音 | IMPLEMENTED_UNVERIFIED | Web Audio RMS 阈值，连续静音约 1.2 秒结束；单轮录音最长 15 秒 |
| ASR 识别后自动发送 | IMPLEMENTED_UNVERIFIED | 仅在显式连续模式下自动发送识别结果；普通语音输入仍回填草稿供确认 |
| AI 回复 TTS 后自动继续聆听 | IMPLEMENTED_UNVERIFIED | 复用既有 TTS，播放结束后尝试进入下一轮；失败路径有重试保护 |
| CI / 真实浏览器和麦克风验收 | NOT_RUN | 新提交 CI 需确认；尚无真实设备端到端证据 |
| 语音边界与误触发调优 | TODO | RMS 阈值、停顿长度、环境噪声、用户打断、播放回声需真实设备调试 |


### 连续语音 CI 类型错误修复（2026-10-27）

- 提交 `6e65c45`：将 Vue 表单和 Ctrl+Enter 的事件处理器改为无参数的 `handleSendMessage()` 包装函数，避免把可选字符串参数的 `sendMessage(voiceText?)` 直接绑定为 DOM 事件处理器。
- 根因证据：前一轮前端 CI 的 TypeScript 错误为 `ConversationPage.vue(102,12)` 和 `(112,16)`，类型不兼容；单元测试通过，但类型检查失败，生产构建被跳过。
- 当前提交对应的前端 CI：待执行/待确认；不得把修复本身当作验证通过。


### AI 教学对话反馈分区展示（2026-10-27）

- 提交 `543605a`：对 AI 教学回复中已存在的【教学状态】【本步目标】【老师讲解】【请你回答】【反馈与纠错】【下一步】标记进行解析，并按分区展示；未带标记的回复保持原样展示，英语面试回复不受影响。
- 状态：IMPLEMENTED_UNVERIFIED。尚待最新前端 CI 与真实 UI 检查；这是展示层改进，不代表新增了结构化评分、词汇掌握度或复习记录。


## AI 教学反馈保存与追溯（2026-10-27）

- 任务：AI tutor 回复已有结构化展示后，学习者可对单条教学反馈显式点击“保存学习反馈”，避免有价值的纠错内容只留在聊天历史里、不便标记。
- 实现：`frontend/src/renderer/views/ConversationPage.vue`；复用现有 `learningEventService` 的 `conversation_feedback_saved` 事件，不新建表、不复制存储层。事件关联 sessionId、assistantMessageId、课程/课时来源，保存反馈原文与章节标题；以确定性 eventId 防止重复保存。重新进入页面会读取近期事件并恢复“已保存反馈”状态。
- 交互：按钮只出现在带教学章节标记的 AI 教学回复上；保存中禁用，保存成功显示“已保存反馈”。英语面试流程不变。
- 边界：目前是可追溯的学习事件，不等于自动创建复练任务，也未接入独立的反馈收藏/复练列表；暂无专门的组件/服务单测。
- 提交：`a6ed01447b4317499927b5e9cf714534925081b0`。
- 验证：代码已提交 main；新提交对应 CI 结果待检查；浏览器持久化、刷新恢复和重复点击实测 `NOT_RUN`。
- 状态：`IMPLEMENTED_UNVERIFIED`，不得标记为端到端 VERIFIED。

## 已保存教学反馈 → 交互式复练（2026-10-27）

- 任务：让学习者从已保存的 AI 教学反馈直接开始复练，避免反馈只保存、不进入实际练习。
- 实现：frontend/src/renderer/views/ConversationPage.vue 在已保存的教学反馈下显示“开始复练”；点击后通过现有 conversationCoreService 创建 AI 教学会话，并把原反馈作为复练依据，要求 AI 组织短练习、等待学习者作答、纠错并提供一次重试。
- 数据：新增 conversation_feedback_practice_started 学习事件，关联来源会话/反馈消息和复练会话；继续复用现有对话持久化与学习事件存储，不新增表、不把反馈伪装成 SM-2 单词复习记录。
- 交互边界：只对已保存的 AI 教学反馈显示复练入口；新会话创建后首轮请求失败时，保留会话与可重试的用户消息，错误由现有对话流程展示。
- 验证：代码已提交 main；前端 CI、类型检查、实际 AI 端到端复练、刷新后事件追溯与窄屏 UI 验收待确认，当前 NOT_RUN。
- 状态：IMPLEMENTED_UNVERIFIED。

## 学习方法统一注册表与对话后复盘（2026-10-28）

| 任务 | 状态 | 证据 / 限制 |
| --- | --- | --- |
| S1 统一学习方法注册表（单一来源：目标/选择理由/步骤/证据类型/承载壳，覆盖课堂 4+classic、练习 4、单元 2、复习 2、中心 2、对话 2 共 17 项） | TEST_PASS | `frontend/src/shared/utils/learningMethodRegistry.ts` + `learningMethodRegistry.test.ts`（7 用例）；课堂可用性复用 `learningMethodCompatibility.ts` 不复制规则 |
| S2-lite 课程详情入口语义澄清（每课时「进入课堂」→「选择学法」；「开始单元学习」保持为主入口） | IMPLEMENTED_UNVERIFIED | `CourseDetailPage.vue`；完整决策流合并仍待用户确认直达习惯 |
| S3-lite 练习中心假听写入口清理（移除「功能开发中」占位卡片与分支，3 卡布局对齐） | IMPLEMENTED_UNVERIFIED | `PracticeCenterPage.vue` |
| S4 课时练习模式卡消费注册表（听写/跟读/翻译/模仿显示注册表目标与选择理由；前置条件不满足禁用并解释；深链同样受保护） | IMPLEMENTED_UNVERIFIED | `LessonPracticePage.vue`；跟读/模仿以 whenToChoose 明确区分（说得出来 vs 说得像） |
| IMP-08 AI 对话后复盘（WeSpeak 借鉴：会话结束→集中纠错/表达/下一步；对话中不打断） | IMPLEMENTED_UNVERIFIED | `conversationReview.ts` 纯函数 + 6 用例单测；`ConversationPage.vue` completed 会话显示复盘卡；解析器截断/丢弃/返回 null 防伪 |
| 测试基建修正（node strip-only 不支持 enum） | DONE | `package.json` test:unit 改 `--experimental-transform-types`；`learningMethodCompatibility.ts` 运行时导入补 `.ts` 扩展名 |
| 验证：test:unit 42/42、vue-tsc exit 0、生产构建 ✓ 31.86s | PASS | 本机执行；浏览器真实 UI、AI 复盘真实调用、语音类模式实机均为 NOT_RUN |

### 学习方法注册表交付补充（2026-10-28）

- 提交：`6458a1d feat(learning): unify method registry and add conversation review`（12 文件，已推送 origin/main）；用户 TTS WIP 未包含。
- 新增运行时证据：本地后端 8010（`GET /api/review/stats` → 200）与前端 Vite 5183 启动正常；6 个修改/新增模块（4 视图 + 2 注册表/复盘模块）经 Vite 按需编译全部 200，无编译错误。
- 浏览器视觉走查：本会话浏览器自动化工具（node_repl MCP）不可用，按治理规则标记 BLOCKED；页面交互（按钮文案、禁用态、复盘卡渲染）需人工或后续会话实机验证。

## 课堂幻灯片化：固定视口教学界面（2026-10-28）

- 用户反馈：教学界面应类似幻灯片不能滚动；滚动与悬停朗读互相干扰（滚动经过的句子被误触发朗读）。
- 根因：`.classroom-page` 为 min-height:100vh 整页滚动 + ReaderStage `scrollIntoView` 自动定位 + 悬停触发三者叠加。
- 改造（ReaderStage.vue + ClassroomPage.vue，均为增量修改）：
  1. 课堂壳层固定视口：`height:100vh; overflow:hidden`，布局 flex/grid `minmax(0,1fr)`；右侧助手改内部滚动；燃尽/词根舞台根节点内部滚动防裁切；窄屏（≤1100px）回退常规滚动布局。
  2. 精读幻灯片分页：句子按"页"呈现（容量按舞台实际尺寸 ResizeObserver 测量，保守估算不溢出），页内禁止滚动、内容垂直居中；词卡网格同样分页。
  3. 翻页导航：页脚"上一页/下一页 + 页码"；连播/键盘导航跨页自动翻页（保持跟随）；手动翻页暂停自动跟随，"回到当前句"恢复（沿用旧滚动语义）。
  4. 移除 wheel 监听与 scrollIntoView；悬停朗读仅作用于当前页可见单元，滚动误触发的混乱随之消除。
- 验证：`vue-tsc --noEmit` exit 0；ReaderStage/ClassroomPage 经 Vite 按需编译 200；`test:unit` 42/42 PASS。浏览器视觉走查与交互实测 NOT_RUN（本会话无浏览器自动化工具），待人工在 5183 实机确认。
- 状态：IMPLEMENTED_UNVERIFIED；文件含用户未提交 TTS WIP（ClassroomPage.vue），未提交。
