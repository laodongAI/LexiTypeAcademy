# 批次D：AI 能力后端化 —— 需求与设计（v1）

- 状态：已实现（D1 后端代理 → D2 前端切换 → D3 设置页 → D4 清理验收；真实密钥联调待补齐）
- 日期：2026-10-24
- 适用版本：本地单机、单用户、无登录形态
- 前置结论：批次C 已完成（统计页真实聚合、学习计划完整版）

---

## 1. 背景与问题

当前 AI 能力全部由前端直连模型供应商：

| 现状 | 位置 | 说明 |
| --- | --- | --- |
| 密钥存储 | `frontend/src/shared/services/ai/aiConfig.ts` | 存在 `localStorage['lexitype_ai_config']`，随浏览器存储明文保存 |
| 直连请求 | `shared/services/ai/providers/qwenProvider.ts` | `fetch(endpoint)` + `Authorization: Bearer <apiKey>` |
| 可选代理 | `shared/services/ai/providers/baseProvider.ts` | 旧 Electron 壳提供 `window.electron.httpFetch`，Web 形态下不可用 |
| 调用入口 | `shared/services/ai/aiService.ts` | 15+ 方法：课程生成、教材引导、词汇增强、翻译、对话、教学反馈、音频导入等 |
| 调用方 | `courseGenerationService.ts`、`AILabPage.vue`、`useTeachingFeedback.ts`、`AudioImportPanel.vue`、`TextbookImportPanel.vue`、`SettingsPage.vue` | 共 6 处 |

由此带来的问题：

1. **密钥暴露面大**：渲染进程与浏览器存储均可读到明文密钥。
2. **跨域不可控**：Web 形态依赖供应商是否放行浏览器 CORS，失败时只能依赖已退役的 Electron 代理。
3. **错误口径分散**：401/429/超时/解析失败在各调用方各自处理。
4. **无统一日志**：无法排查失败率、耗时与 token 消耗，也无法定位是哪类任务失败。
5. **后端已有 AI 能力缺口**：`backend/app/core/config.py` 无任何 AI 配置，`requirements.txt` 无 HTTP 客户端依赖。

---

## 2. 目标与非目标

### 2.1 目标

1. 密钥只存在于本地后端 `backend/.env`，前端不再持有、不再回显。
2. 前端调用方式（`AIService` 的公开方法签名）保持不变，业务页面零改动。
3. 支持非流式与流式（SSE）两种调用，覆盖课程生成的实时进度展示。
4. 统一错误结构、超时策略与日志字段。
5. 设置页改为只读展示后端 AI 状态 + 测试连接，不再要求用户填写密钥。
6. 未配置密钥时给出明确、可操作的提示，不影响非 AI 功能。

### 2.2 非目标

- 不在后端重写 prompt（prompt 仍由前端 `shared/services/ai/prompts/*` 维护）。
- 不做多用户、配额、计费、密钥轮换与审计体系。
- 不把 AI 输入输出写入业务表（不碰 `aiTaskLogs`，避免与业务日志语义混淆）。
- 不改造课程/课时的数据结构与解析逻辑。
- 不支持非 OpenAI 兼容协议（如 DashScope 原生 `input/parameters` 协议）。

---

## 3. 方案决策

| 决策点 | 结论 | 理由 |
| --- | --- | --- |
| 代理粒度 | **通用透传** `/api/ai/chat`（messages + 采样参数） | 前端已有完整 prompt 与 JSON 解析逻辑，语义化端点会导致 prompt 双份维护 |
| 上游协议 | **OpenAI 兼容 Chat Completions** | 现有默认端点为 DashScope 兼容模式；切换供应商只改 `.env` |
| HTTP 客户端 | **httpx（AsyncClient）** | 原生支持异步与流式读取；`requirements.txt` 需新增依赖 |
| 流式实现 | 后端读取上游 SSE，改写为自有事件后转发 | 前端只需解析一种事件格式，同时可统一处理错误与 usage |
| 密钥注入 | `backend/.env` → `Settings` | 用户已确认；`.env` 已被 `.gitignore` 忽略（`.gitignore:63`） |
| 认证 | 不新增认证 | 本地单机、监听 `127.0.0.1`、CORS 白名单已足够 |
| 旧 Electron 代理 | 前端切换到后端代理后不再使用 | Web 形态为唯一主线，避免双通道分叉 |

---

## 4. 后端设计

### 4.1 配置项（`backend/app/core/config.py`）

| 环境变量 | 默认值 | 说明 |
| --- | --- | --- |
| `AI_PROVIDER` | `qwen` | 仅用于展示与日志标识 |
| `AI_BASE_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | 上游 base，不含 `/chat/completions` |
| `AI_API_KEY` | 空 | 密钥；为空时 AI 接口返回 503 |
| `AI_MODEL` | `qwen-plus` | 默认模型 |
| `AI_TIMEOUT_SECONDS` | `120` | 非流式与流式读超时上限 |
| `AI_MAX_TOKENS` | `8000` | 请求 maxTokens 的服务端上限 |

派生属性：
- `ai_chat_url`：`AI_BASE_URL.rstrip('/') + '/chat/completions'`
- `ai_configured`：`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL` 均非空

同步更新 `backend/.env.example`，并给出 DashScope/OpenAI/DeepSeek 三种 `AI_BASE_URL` 示例（注释形式）。

### 4.2 接口契约

统一前缀 `/api`，路由文件 `backend/app/api/routers/ai.py`，在 `main.py` 注册。

#### (1) `GET /api/ai/config`

返回**不含密钥**的只读状态，供设置页展示。

```json
{
  "configured": true,
  "provider": "qwen",
  "model": "qwen-plus",
  "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
  "timeoutSeconds": 120,
  "maxTokens": 8000
}
```

#### (2) `POST /api/ai/chat`

```json
{
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "temperature": 0.7,
  "maxTokens": 4000,
  "timeoutMs": 60000,
  "requestId": "前端可选，用于日志串联"
}
```

成功响应（200）：

```json
{
  "requestId": "...",
  "content": "模型输出的完整文本",
  "usage": { "promptTokens": 0, "completionTokens": 0, "totalTokens": 0 },
  "provider": "qwen",
  "model": "qwen-plus",
  "latencyMs": 1234
}
```

#### (3) `POST /api/ai/chat/stream`

请求体同 (2)，响应 `text/event-stream`，每行一个 JSON：

```
data: {"type":"delta","content":"片段"}

data: {"type":"done","usage":{...},"latencyMs":1234,"model":"qwen-plus"}

data: {"type":"error","code":"AI_TIMEOUT","message":"上游响应超时"}
```

约定：
- `delta` 可多次；`done` 与 `error` 二选一，且必须是最后一条。
- 客户端不依赖 `event:` 字段，只解析 `data:` 后的 JSON，降低解析复杂度。
- 流开始后若发生错误，HTTP 状态仍为 200，错误通过 `type=error` 事件传达。

#### (4) `POST /api/ai/test`

用最小请求验证连通性（`maxTokens=8`、`timeoutMs=15000`），返回：

```json
{ "ok": true, "model": "qwen-plus", "latencyMs": 842 }
```

失败时按下方错误码规范返回。

### 4.3 入参校验（服务端强制）

| 字段 | 规则 | 越界处理 |
| --- | --- | --- |
| `messages` | 1–64 条，role ∈ system/user/assistant | 400 `AI_BAD_REQUEST` |
| 文本总量 | ≤ 200000 字符 | 400 `AI_BAD_REQUEST` |
| `temperature` | 0–2 | 超出则截断 |
| `maxTokens` | 1–`AI_MAX_TOKENS` | 超出则截断 |
| `timeoutMs` | 5000–`AI_TIMEOUT_SECONDS*1000` | 超出则截断 |

### 4.4 错误码与 HTTP 状态

| code | HTTP | 场景 | 前端映射（`AIErrorCode`） |
| --- | --- | --- | --- |
| `AI_CONFIG_MISSING` | 503 | 未配置密钥/模型 | `API_KEY_MISSING` |
| `AI_BAD_REQUEST` | 400 | 参数非法 | `INVALID_CONFIG` |
| `AI_RATE_LIMIT` | 429 | 上游 429 | `RATE_LIMIT` |
| `AI_TIMEOUT` | 504 | 连接/读取超时 | `TIMEOUT` |
| `AI_UPSTREAM_ERROR` | 502 | 上游 4xx/5xx 或网络错误 | `PROVIDER_ERROR` |
| `AI_INVALID_RESPONSE` | 502 | 上游返回体无法解析 | `INVALID_RESPONSE` |

统一错误体：

```json
{ "detail": { "code": "AI_UPSTREAM_ERROR", "message": "...", "upstreamStatus": 401 } }
```

### 4.5 日志与可观测（复用 `app.core.logging`）

每次调用输出两条日志（开始 / 结束或失败）：

| 字段 | 示例 | 说明 |
| --- | --- | --- |
| `request_id` | `a1b2c3` | 前端传入或后端生成 |
| `provider` / `model` | `qwen` / `qwen-plus` | 配置值 |
| `message_count` / `prompt_chars` | `2` / `1834` | 规模指标 |
| `stream` | `true` | 是否流式 |
| `status` / `upstream_status` | `ok` / `200` | 结果 |
| `latency_ms` | `2314` | 端到端耗时 |
| `usage` | `{"totalTokens": 912}` | 上游返回时记录 |

**禁止记录**：`AI_API_KEY`、完整 prompt 与模型输出内容。

### 4.6 安全约束

- 上游地址只能来自 `AI_BASE_URL`，接口不接受调用方传入 URL（避免 SSRF）。
- `GET /api/ai/config` 不回传密钥，也不回传密钥片段。
- 后端继续只监听 `127.0.0.1`，CORS 仍限定 `5183` 本机来源。
- `.env` 已忽略，禁止提交真实密钥。

---

## 5. 前端改造设计

### 5.1 变更清单

| 文件 | 变更 |
| --- | --- |
| `shared/services/ai/aiTypes.ts` | 新增 `AIBackendConfig`、`AIChatUsage` 类型；`AIConfig` 中 `apiKey/endpoint/model` 标记为不再持久化 |
| `shared/services/ai/providers/backendProvider.ts`（新增） | 继承 `BaseAIProvider`，实现 `callAPI` / `streamAPI`，全部走本地后端 |
| `shared/services/ai/providers/qwenProvider.ts` | 切换完成后删除（不再直连，避免双通道） |
| `shared/services/ai/aiService.ts` | `createProvider` 固定返回 `BackendAIProvider`；`isConfigured` 改为查询后端状态；`testConnection` 调 `/api/ai/test` |
| `shared/services/ai/aiConfig.ts` | 保留 `lexitype_ai_config` 键（核心标识冻结），只持久化 `customPrompts`；加载时清理历史 `apiKey` 并提示迁移 |
| `renderer/views/SettingsPage.vue` | 删除提供商/密钥/端点/模型输入；改为只读状态卡片（configured/provider/model/baseUrl）+「刷新状态」「测试连接」 |

### 5.2 `BackendAIProvider` 行为

- `callAPI`：`POST /api/ai/chat`，把 `systemPrompt` 合并进 `messages` 后提交；读取 `content`。
- `streamAPI`：`fetch('/api/ai/chat/stream')`，用 `ReadableStream` 逐行解析 `data:` JSON：
  - `delta` → `onChunk(content)`
  - `done` → 结束
  - `error` → 抛 `AIError`（按错误码映射）
- `isConfigured`：由 `GET /api/ai/config` 的 `configured` 决定，结果缓存 5 秒。

### 5.3 兼容与迁移

- `AIService` 所有公开方法签名不变，6 处调用方无需改动（`AILabPage`、`courseGenerationService`、`useTeachingFeedback`、两个导入面板、设置页）。
- 历史 `localStorage` 中的 `apiKey`：首次加载时删除并展示一次提示「密钥已迁移至后端 .env」；**不改存储键名**。
- 回滚策略：按切片 revert 代码即可；用户已配置的后端 `.env` 不依赖前端状态。

---

## 6. 测试与验收

### 6.1 自动化（后端）

新增 `backend/tests/test_ai_router.py`（当前无测试目录，需新建），使用 `httpx.MockTransport` 模拟上游，不依赖真实密钥。
测试依赖单独放 `backend/requirements-dev.txt`（`pytest`、`pytest-asyncio`、`anyio`），不污染运行时依赖：

| 用例 | 期望 |
| --- | --- |
| 未配置密钥 | `GET /config.configured=false`；`POST /chat` → 503 `AI_CONFIG_MISSING` |
| 非流式成功 | 200，`content` 与 usage 映射正确，`latencyMs >= 0` |
| 上游 401 | 502 `AI_UPSTREAM_ERROR`，`upstreamStatus=401` |
| 上游 429 | 429 `AI_RATE_LIMIT` |
| 上游超时 | 504 `AI_TIMEOUT` |
| 流式成功 | 事件序列为若干 `delta` + 一个 `done` |
| 流式中途断开 | 以 `error` 事件收尾，不抛未捕获异常 |
| 超限入参 | 400 `AI_BAD_REQUEST` |

### 6.2 手工验收（真实密钥只在本机 `.env`）

1. 设置页展示 `configured=true`、正确 provider/model/baseUrl；「测试连接」成功。
2. 课程生成（流式）：`AILabPage` 实时进度可见，完成后课程数据可保存。
3. 教材引导、音频导入、教学反馈各跑一次，均正常返回。
4. 临时改错 `AI_API_KEY`：错误提示为可读中文，不泄露密钥；改回后恢复。
5. 浏览器 DevTools 中搜索 `AI_API_KEY` 值：页面与网络请求均不应出现。
6. 后端日志包含 request_id/耗时/usage，且不含密钥与完整内容。

### 6.3 证据要求

每个切片完成后在 `project-control/TASKS.md` 记录：命令、关键输出、时间；`npm run build` 与 `compileall` 必须通过。

---

## 7. 实施切片

| 切片 | 内容 | 交付判定 |
| --- | --- | --- |
| **D1 后端代理** | `config.py` 配置项、`requirements.txt` 加 `httpx`、`routers/ai.py` 四个接口、`main.py` 注册、`.env.example` 更新、`tests/test_ai_router.py` | 单测全绿；未配置时 503；Mock 上游流式/非流式通过 |
| **D2 前端切换** | `BackendAIProvider`、`aiService` 切换、`aiConfig` 清理密钥 | `npm run build` 通过；设置页外的 5 处调用方编译无误 |
| **D3 设置页** | 只读状态卡片、刷新与测试连接、迁移提示 | 页面无密钥输入项；测试连接可用 |
| **D4 清理与验证** | 删除 `qwenProvider.ts`、移除 Electron 代理分支（如确认无引用）、全链路手工验收、台账更新 | 6 处调用方实测通过；无重复实现；提交推送 |

---

## 8. 风险与对策

| 风险 | 影响 | 对策 |
| --- | --- | --- |
| 供应商协议差异 | 非 OpenAI 兼容端点无法直用 | `.env.example` 明确要求兼容模式 base；不兼容时明确报错 |
| 长文本生成超时 | 课程生成中断 | 流式优先；`AI_TIMEOUT_SECONDS` 默认 120，读超时按块重置 |
| SSE 解析边界 | 片段丢失或 JSON 截断 | 按行缓冲，保留未完成行；单测覆盖跨块场景 |
| 用户已有前端密钥 | 切换后出现「未配置」 | 设置页给出 `.env` 配置指引与迁移提示 |
| 误提交密钥 | 泄露 | `.env` 已忽略；`.env.example` 仅占位；验收检查 git diff |

---

## 9. 假设与待确认

1. 默认沿用通义千问 DashScope 的 OpenAI 兼容端点（与现有默认配置一致）。
2. 本机已有可用 API Key；若没有，D1–D3 仍可用 Mock 上游完成开发与验收，真实联调留待用户提供。
3. 旧 Electron 壳已退役，`window.electron.httpFetch` 分支可在 D4 一并移除。
