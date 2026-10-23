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

## 三·补三、阶段4 · 批次D 需求与设计（DONE，待评审后实现）

- 设计文档：`docs/design/ai-backend-proxy-v1.md`
- 关键决策：密钥只进 `backend/.env`；后端提供 OpenAI 兼容透传 `/api/ai/chat`（含 SSE）；前端 `AIService` 接口不变，只替换 provider 为 `BackendAIProvider`；设置页改为只读状态 + 测试连接
- 实施切片：D1 后端代理与单测 → D2 前端切换 → D3 设置页 → D4 清理与全链路验收
- 待用户确认：默认沿用 DashScope OpenAI 兼容端点；是否具备真实 API Key（无 Key 时用 Mock 上游完成开发验收）

## 四、未完成功能清单（按学习闭环优先级）

| 优先级 | 功能 | 现状 | 关键依据 |
| --- | --- | --- | --- |
| ~~P0~~ | ~~后端业务 CRUD（课程/课时/进度/练习/复习）~~ 已完成 | 4 组业务路由已上线并实测 | 见“批次B 实测证据” |
| ~~P0~~ | ~~前端数据源与后端统一~~ 已完成 | 5 个仓储全部走 HTTP；仅 TTS Blob 缓存留在 IndexedDB | `shared/services/apiClient.ts`、`shared/database/repositories/*` |
| ~~P0~~ | ~~真实存量数据迁移~~ 已完成 | 27 条掌握度 + 142 条复习日志已入库，17/17 校验通过 | 见“真实迁移证据” |
| ~~P1~~ | ~~统计页真实数据~~ 已完成（批次C 切片1） | 练习记录补齐 `totalItems/correctItems/wpm`，统计页去除随机数与模拟完成度 | 见“批次C 切片1 实测证据” |
| ~~P1~~ | ~~学习计划页~~ 已完成（批次C 切片2） | 多计划、自定义每日任务、打卡快照、页面内提醒、历史回顾均已落地 | 见“批次C 切片2 实测证据” |
| P1 | AI 对话/课程生成 | 需求与设计已完成（批次D，`docs/design/ai-backend-proxy-v1.md`），待评审后实现 | 前端直连模型服务；后端无 AI 代理 |
| P1 | 资源工坊（YouTube 字幕导入） | 仅有旧的 mock 导入逻辑，无后端 | `AILabPage.vue`（未挂载） |
| P2 | 游戏成绩持久化 | 结束不上报 | `GameCenterPage.vue` |
| P2 | 设置页数据导出/导入/清空 | 仅提示成功，未真正执行 | `AISettingsPanel` |
| P2 | 拼音练习 | 3 处 TODO | `PinyinPage.vue` |
| P3 | 翻译工具 / 词汇分析 | 各 2-4 处未完成 | `TranslateToolPage.vue`、`VocabularyAnalyzerPage.vue` |

## 五、后续执行计划

1. **批次C（P1）**：统计页真实聚合（切片1）与学习计划完整版（切片2）均已完成。
2. **批次D（P1）**：设计已产出，待评审；评审通过后按 D1 后端代理 → D2 前端切换 → D3 设置页 → D4 清理验收 实施。
3. **批次E（P2）**：游戏成绩、设置数据管理、拼音、翻译/词汇页收尾。
4. 遗留清理：`frontend/src/shared/database/dataMigration.ts` 仍为旧 IndexedDB 导入工具，未挂载到 UI；设置页数据管理（批次E）接入后端 `/api/migration/import` 后一并下线。
5. 可选补迁：`http://localhost:5173` 源（旧 Vue 版 IndexedDB，约 11KB）尚未导出，该端口被其它项目占用，待端口释放后执行。

## 六、验证命令

```powershell
# 后端
cd backend; .\.venv\Scripts\python.exe -m compileall -q .\app
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010

# 前端
cd frontend; npm run build
```
