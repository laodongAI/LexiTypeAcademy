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
