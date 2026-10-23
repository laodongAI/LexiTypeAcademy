# LexiType Academy 任务台账

> 本文件是项目唯一任务状态记录（AIMES 治理要求）。状态取值：`TODO` / `DOING` / `DONE` / `BLOCKED`。
> 验证结论必须附可复现证据，未执行标 `NOT_RUN`。

## 一、已完成阶段

| 阶段 | 内容 | 状态 |
| --- | --- | --- |
| 0 | .gitignore、git 基线、旧版归档到 `legacy/` | DONE |
| 1 | 前后端骨架：`frontend/`（Vue3+Vite）、`backend/`（FastAPI）、`scripts/` | DONE |
| 2 | 数据层：14 张业务表 ORM、Alembic、IndexedDB 导出/导入与 17 项校验 | DONE |
| 3 | 语音后端化：`/api/tts/*`、`/api/asr/*`、模型懒加载、缓存 | DONE |

## 二、当前迭代（阶段4 · 批次A：可交付性修复）

| 任务 | 状态 | 验收证据 |
| --- | --- | --- |
| 修复前端生产构建 6 处 TS 类型错误 | DONE | `npm run build` 通过（2520 modules） |
| 设置页 TTS 测试接入真实 `/api/tts/generate` | DOING | 已触发请求；持久化缓存返回 url 分支待 UI 复验 |
| 设置页 ASR 测试接入真实 `/api/asr/health` | DOING | 接口 200 已证；UI 复验受浏览器自动化环境阻塞 |

## 三、未完成功能清单（按学习闭环优先级）

| 优先级 | 功能 | 现状 | 关键依据 |
| --- | --- | --- | --- |
| P0 | 后端业务 CRUD（课程/课时/进度/练习/复习） | 只有表与迁移导入，无 REST 接口 | `backend/app/api/routers/` 仅 health/migration/tts/asr |
| P0 | 前端数据源与后端统一 | 业务读写仍走 IndexedDB，后端 SQLite 为旁路 | `shared/database/repositories/*` |
| P0 | 真实存量数据迁移 | 库内仅有样例数据，未导入真实导出 | 各表行数远低于实际使用量 |
| P1 | 学习计划页 | 页面占位，无数据模型 | `router` 注释“数据模型待实现” |
| P1 | 统计页真实数据 | WPM/完成率使用随机数；记录缺 WPM 字段 | `StatisticsPage.vue` |
| P1 | AI 对话/课程生成 | 前端直连模型服务；后端无 AI 代理 | `AIPage.vue` 为未挂载的旧页面 |
| P1 | 资源工坊（YouTube 字幕导入） | 仅有旧的 mock 导入逻辑，无后端 | `AILabPage.vue`（未挂载） |
| P2 | 游戏成绩持久化 | 结束不上报 | `GameCenterPage.vue` |
| P2 | 设置页数据导出/导入/清空 | 仅提示成功，未真正执行 | `AISettingsPanel` |
| P2 | 拼音练习 | 3 处 TODO | `PinyinPage.vue` |
| P3 | 翻译工具 / 词汇分析 | 各 2-4 处未完成 | `TranslateToolPage.vue`、`VocabularyAnalyzerPage.vue` |

## 四、后续执行计划

1. **批次B（P0）**：后端业务 CRUD + 前端 Repository 切换为 HTTP（先课程/课时/练习记录，再复习）。
   - 前置：确认真实 IndexedDB 导出文件，先完成一次真实迁移并校验。
2. **批次C（P1）**：统计页真实聚合；学习计划需求分析与建模。
3. **批次D（P1）**：AI 能力后端化（统一代理、密钥留在本地后端），再接前端。
4. **批次E（P2）**：游戏成绩、设置数据管理、拼音、翻译/词汇页收尾。

## 五、验证命令

```powershell
# 后端
cd backend; .\.venv\Scripts\python.exe -m compileall -q .\app
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8010

# 前端
cd frontend; npm run build
```
