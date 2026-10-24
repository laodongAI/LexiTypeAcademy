# 设置页分页与模型配置设计 v1

**状态**：已实现并验证（IMPLEMENTED，2026-10-24）
**日期**：2026-10-24
**适用版本**：阶段4 · 批次G
**需求来源**：用户要求“设置页按类别分页；语音模型增加音色选择与上传音频克隆；大模型增加 DeepSeek、千问、智谱等常用配置”
**决策记录**：见 9.2（Q1–Q9 已确认）

**修订记录**
- 2026-10-24：初稿（设置分页、普通音色、大模型配置）。
- 2026-10-24：补充 OpenVoice v2 克隆音色、G3b 切片与 C-1–C-9 验收；确认 Q1–Q9，状态更新为 APPROVED。
- 2026-10-24：G1–G6 实现完成；前端 `npm run build` 通过、后端 `pytest -q` 27 passed，克隆链路端到端实测通过。

---

## 1. 需求认知记录

### 1.1 目标

把当前单页纵向堆叠的设置页改为按类别分页的设置中心，并补齐两类“模型配置”的真实能力：

1. **语音模型**：可选择本地 TTS 引擎与具体音色，支持试听，且选择结果真正作用于课堂朗读、练习朗读与预缓存。
2. **大模型**：可配置 DeepSeek、通义千问、智谱 GLM 等常用 OpenAI 兼容服务商，支持保存多个配置、切换当前生效配置、测试连通性。

### 1.2 目标用户与场景

| 场景 | 用户动作 | 期望结果 |
| --- | --- | --- |
| 换音色 | 进入“语音模型”页，选择引擎/音色并试听 | 立即听到该音色；后续课堂朗读使用该音色 |
| 换大模型 | 进入“大模型”页，选 DeepSeek/千问/智谱，填密钥与模型 | 保存后 AI 功能使用新配置；可测试连接 |
| 日常调整 | 调主题、每日目标、打字提示 | 即改即存，不刷新页面 |
| 排障 | 查看服务状态、错误原因、配置来源 | 明确知道是密钥缺失、模型未安装还是网络不通 |

### 1.3 范围

**本期包含**

- 设置页信息架构重构：左侧分类导航 + 右侧内容区，支持 URL 深链。
- 语音模型：引擎发现、音色列表、试听、语速/音量、音色写入实际播放链路、缓存维度扩展。
- 音色克隆：上传 1–30 秒参考音频，基于 OpenVoice v2 + melo 生成并调用克隆音色；含上传校验、试听、启用、删除与本地存储。
- 大模型：服务商目录、多配置档案、写密钥、切换生效、测试连接、状态展示、密钥不回显。
- 前端设置结构升级与旧值迁移（存储键不变）。
- 后端新增/调整接口与单测、前后端构建与手工验收。

**本期不包含**

- 多用户、登录、远程同步。
- 模型文件下载/安装向导（模型仍需用户本地放置到 `backend/models`）。
- ChatTTS、CosyVoice2、IndexTTS2 等实验/高成本引擎的正式接入（可保留“实验性”隐藏开关）；OpenVoice v2 克隆是本期明确范围，不属于此项排除。
- 按课程/按课时单独覆盖音色。
- 从服务商自动拉取模型列表（首版用手写目录 + 允许手工输入，后续可作为增强）。
- 设置页数据导入/导出/清空的具体实现（属批次E，本期只保留入口占位与说明）。

### 1.4 关键事实与现状证据

| 事实 | 来源 |
| --- | --- |
| 设置页当前为单页纵向分区：外观 / 语音合成 / 语音识别 / 打字练习 / AI 模型 / 学习 / 关于 | `frontend/src/renderer/views/SettingsPage.vue` |
| 设置持久化键为 `lexitype-settings`，字段含 `ttsVoice` 但课堂播放未使用 | `frontend/src/renderer/stores/settings.ts`、`frontend/src/renderer/composables/useSpeechPlayer.ts` |
| TTS 提供者/音色下拉是占位值（default/female/male），未映射到真实说话人 | `SettingsPage.vue`、`tts_service.py` |
| 后端 TTS 仅按 `.env` 的 `TTS_ENGINE=melo` 加载单一引擎，`/api/tts/voices` 仅返回 `num_speakers` | `backend/app/core/config.py`、`backend/app/api/routers/tts.py`、`backend/app/services/voice/tts_service.py` |
| 本机已安装多套 TTS 模型：melo（中英双语单说话人）、aishell3（中文 174 说话人）、kokoro（多语种）、matcha（单说话人）、chattts/cosyvoice/OpenVoice（实验） | `backend/models/manifest.json` 与 `backend/models/tts/*` |
| 本机已安装 OpenVoice v2 克隆资产：`tone_extract.onnx`（约 3.3MB）、`tone_color.onnx`（约 157MB）、`tone_config.json` 与 `sample_ref.wav` | `backend/models/tts/openvoice-onnx-v2/` |
| 历史评估已实测 OpenVoice v2 + melo：参考音频 1–30 秒、输出 22.05kHz、热路径 RTF≈1.11（melo 0.63 + 转换 0.47），适合试听/预生成，不适合实时交互 | `语音模型选型评估_2026-10-22.md` 第 3、6 节 |
| 历史评估记录过参考音频落盘与克隆开关方案，但**当前仓库未保留对应实现代码**，需按本设计重建 | 同上，第 6 节 |
| 大模型配置当前只读，来自 `backend/.env`；密钥不落前端、不回显 | `SettingsPage.vue`、`backend/app/api/routers/ai.py`、`backend/app/core/config.py` |
| 现有 AI 代理是通用 OpenAI 兼容透传，切换到其他兼容服务商不需要改调用层 | `docs/design/ai-backend-proxy-v1.md` |
| 前端 `AIConfig` 只持久化 `customPrompts`，历史密钥已清理 | `frontend/src/shared/services/ai/aiConfig.ts` |

### 1.5 约束

- 本地单机、单用户、无登录；后端仅监听 `127.0.0.1`。
- 不可修改核心标识：`lexitype-settings`、`lexitype_ai_config`、`LexiTypeAcademyDB`。
- 密钥不得进入浏览器存储、URL、日志、接口回显；这是一条硬约束。
- 枚举/目录唯一维护在后端，前端不复制服务商或引擎清单。
- 现有业务链路（课堂朗读、练习、AI 对话）不能因设置重构而中断。
- 克隆参考音频仅保存在本机 `backend/data`，不上传云端；界面必须要求用户确认拥有该声音的使用授权。删除克隆音色时必须同时删除参考音频与音色嵌入。

### 1.6 非功能需求

| 维度 | 要求 | 判定方法 |
| --- | --- | --- |
| 安全 | GET 接口无密钥；日志无密钥；密钥文件仅本机可读 | 代码检索 + 接口响应 + 日志抽查 |
| 兼容 | 旧 `lexitype-settings` 可直接加载；旧 `ttsVoice` 自动迁移 | 手工构造旧数据后刷新验证 |
| 性能 | 试听首响 ≤ 模型加载时间；已加载普通引擎复响 ≤ 3 秒；克隆音色按实测 RTF≈1.11 告知用户 | 手工计时（首响含加载，单独记录） |
| 内存 | 同一时刻只驻留一个主合成引擎；克隆模式允许 melo 基底 + OpenVoice 转换器同时驻留 | 后端日志与进程内存观察 |
| 隐私 | 克隆参考音频仅本机保存；删除克隆后参考音频、嵌入与可定位缓存一并清理 | 文件系统抽查 + 删除接口验证 |
| 存储 | 单个参考音频 ≤ 10MB，1–30 秒；克隆档案建议上限 5 个 | 接口校验 + 目录大小检查 |
| 可观测 | 引擎加载、音色切换、模型保存、连接测试均有分级日志 | `backend/logs/app.log` 抽查 |
| 可访问 | 所有配置项有标签与说明；错误有可操作文案；键盘可操作 | 手工走查 |

---

## 2. 设置页信息架构

### 2.1 分页方案

采用“左侧分类导航 + 右侧内容区”，桌面端固定左栏，窄屏折叠为顶部横向标签。

| 分页 | 路由 | 内容 | 保存方式 |
| --- | --- | --- | --- |
| 通用 | `/settings?tab=general` | 主题色、界面语言、启动行为（预留） | 即改即存 |
| 语音模型 | `/settings?tab=speech` | TTS 引擎、音色、试听、语速、音量；ASR 识别模型与语言 | 即改即存 |
| 大模型 | `/settings?tab=models` | 服务商目录、配置档案、密钥、模型、参数、测试、状态 | **显式保存** |
| 学习 | `/settings?tab=learning` | 每日目标、自动播放、复习提醒 | 即改即存 |
| 练习 | `/settings?tab=practice` | 显示提示、显示拼音、按键音效 | 即改即存 |
| 数据与关于 | `/settings?tab=about` | 数据导入/导出入口（占位）、缓存清理、重置、版本与链接 | 按钮触发 |

**导航规则**

- 默认进入 `general`；非法 `tab` 回退到 `general`，不报错。
- 支持从其他页面深链，例如“AI 不可用”提示可直接跳到 `/settings?tab=models`。
- 分页切换不丢草稿：大模型页有未保存修改时，切换/离开需确认。
- 页面标题固定“设置”，副标题“管理外观、语音、模型与学习偏好”。

### 2.2 布局线框

```text
┌──────────────────────────────────────────────────────────────┐
│ 设置                                                         │
│ 管理外观、语音、模型与学习偏好                    [已保存/未保存] │
├───────────────┬──────────────────────────────────────────────┤
│ 通用          │  大模型                                      │
│ 语音模型      │  当前生效：DeepSeek / deepseek-chat  [已配置]  │
│ 大模型   ●    │  ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ 学习          │  │ DeepSeek   │ │ 通义千问   │ │ 智谱 GLM   │ │
│ 练习          │  └────────────┘ └────────────┘ └────────────┘ │
│ 数据与关于    │  Base URL  [.......................]          │
│               │  API Key   [•••••••• 已配置] [显示][清除]      │
│               │  模型      [deepseek-chat        ▼]          │
│               │  温度 [0.7]  最大输出 [8000]  超时 [120s]     │
│               │  [测试连接]                      [保存并应用]  │
└───────────────┴──────────────────────────────────────────────┘
```

### 2.3 交互与状态

- 顶部统一显示保存状态：`已保存` / `保存中…` / `未保存` / `保存失败（原因）`。
- 本地偏好（主题、语速等）沿用即时保存；大模型因涉及密钥与后端写入，使用显式“保存并应用”。
- 每个分页有独立的加载/空/错误状态，互不阻塞。
- 危险操作（重置、清除密钥、清理缓存）必须二次确认。
- 所有测试按钮具备 loading、防重复点击、成功/失败 toast 与可展开详情。

---

## 3. 语音模型设计

### 3.1 现状问题

1. 音色下拉只有“默认/女声/男声”，后端并不存在对应音色。
2. `ttsVoice` 只存在设置里，课堂播放从未传给 `/api/tts/generate`。
3. 只有一个全局引擎，无法在 melo / aishell3 / kokoro 之间切换。
4. `/api/tts/voices` 依赖引擎已加载，未加载时永远返回 1 个音色。
5. 没有克隆音色入口：本机虽已放置 OpenVoice v2 资产，但当前后端未加载、未提供参考音频上传与克隆合成能力。

### 3.2 目标模型

引入“引擎（Engine）+ 音色（Voice）”两级模型：

```text
Engine: melo        → 音色: melo:0（中英双语默认）
Engine: aishell3    → 音色: aishell3:SSB0005 …（174 个中文说话人）
Engine: kokoro      → 音色: kokoro:0 …（多语种）
Engine: matcha      → 音色: matcha:0（单说话人，非商用授权）
Engine: openvoice   → 音色: clone:<profileId>（用户上传参考音频克隆，melo 基底）
```

- 前端只保存 `ttsEngine` 与 `ttsVoiceId`（形如 `aishell3:SSB0005` 或 `clone:<profileId>`）。
- 请求 `/api/tts/generate` 时携带 `engine` 与 `voice`；后端按 `engine` 懒加载对应模型。
- 音色标识统一为 `{engineId}:{speakerId}`；裸数字/旧值由后端归一化，保证兼容。
- 克隆音色是特殊音色：`engine=openvoice`，`voice=clone:<profileId>`，后端使用 melo 合成基底再执行 OpenVoice 音色迁移。

### 3.3 后端引擎注册表（唯一来源）

新增 `backend/app/services/voice/tts_engines.py`，集中定义：

| 字段 | 说明 |
| --- | --- |
| `id` | 引擎标识，如 `melo` / `aishell3` / `kokoro` / `matcha` |
| `displayName` | 界面名称 |
| `engineType` | `vits` / `kokoro` / `matcha` / `openvoice`，决定模型配置构造与推理管线 |
| `modelDir` | 相对 `backend/models` 的目录 |
| `requiredFiles` | 判定“已安装”的必需文件 |
| `license` | 许可证，界面必须展示（如 DataBaker-NC） |
| `languages` | 支持语种 |
| `voiceSource` | `speakers.txt` / `voices.bin` / 固定单说话人 / `clone_refs` |
| `supportsClone` | 是否支持上传参考音频克隆音色 |
| `experimental` | 是否实验性，默认隐藏 |
| `defaultVoiceId` | 默认音色 |

说明：

- 不把引擎清单写进 `.env`，避免“配置散落”；`.env` 的 `TTS_ENGINE` 仅作为旧默认值兜底。
- 模型是否可用由 `requiredFiles` 实际检测，未安装的引擎在界面置灰并给出缺失原因。
- `backend/models/manifest.json` 继续作为模型资产清单；注册表引用其 `id`，不重复维护路径与许可证。
- `openvoice` 条目不是独立声学模型：必需文件包含 melo 基底、`tone_extract.onnx`、`tone_color.onnx`、`tone_config.json`；任一缺失即 `available=false`，界面显示“克隆组件不完整”。
- 遵循 `manifest.json` 的 `role=voice-clone` 与“默认关闭，仅显式启用时加载”：未选择/未试听克隆音色时不加载 OpenVoice 转换器。
- ChatTTS / CosyVoice2 / IndexTTS2 等实验引擎按 Q3 决策默认隐藏，仅在“高级/实验功能”开关打开后展示；OpenVoice 克隆不在此列。

### 3.4 音色目录与命名

- aishell3 的 `speakers.txt` 含 174 个 `SSBxxxx`，不适合直接展示。
- 首版采用“**精选音色 + 全部音色**”两层（Q2 决策）：
  - 精选：后端 `voice_catalog.json` 维护 6–10 个条目，含 `displayName`（如“女声 01”）、`speakerId`、`language`、`tags`。
  - 全部：按 `speakers.txt` 展开，显示“音色 66（SSB0066）”。
- **命名必须基于实际试听确认**；未确认前只显示中性编号，不推断性别。
- 音色标签（性别/风格）如无法从模型元数据核实，标注为 `UNKNOWN`，不得编造。

### 3.4.1 克隆音色（OpenVoice v2）

**能力定位**：本方案中的“克隆”是 OpenVoice v2 的**音色迁移**——用 melo 生成基础语音，再把参考音频的音色迁移到合成结果上。它复制的是音色特征，不复制参考音频的语气、节奏与内容。界面文案必须写作“音色克隆（音色迁移）”，不得宣称“完整复刻某人声音”。

**用户流程**

1. 进入“语音模型”页，展开“我的克隆音色”区域。
2. 上传参考音频（拖拽或选择文件），确认授权声明，填写音色名称。
3. 后端校验并归一化音频，提取音色嵌入，创建克隆档案。
4. 用户点击“试听”，听到用该参考音色朗读的示例句。
5. 点击“设为当前音色”，前端保存 `ttsEngine=openvoice`、`ttsVoiceId=clone:<profileId>`。
6. 课堂、练习、预缓存请求携带该音色；不再需要时在列表中删除。

**上传与校验**

| 项目 | 规则 |
| --- | --- |
| 支持格式 | `wav`、`mp3`、`m4a`、`ogg`（统一转 WAV） |
| 大小上限 | 10MB |
| 时长 | 1–30 秒；建议 5–20 秒 |
| 音频要求 | 单人说话、少背景噪声、无音乐；界面给出录制建议 |
| 归一化 | 转 22.05kHz、单声道、16bit PCM；转换失败返回可操作错误 |
| 文件命名 | 服务端使用 UUID 目录，**不使用用户文件名作为路径**，防止路径穿越 |
| 数量上限 | 5 个克隆档案（Q7 决策）；总占用上限 50MB |
| 授权 | 上传前必须勾选“我确认拥有该声音的使用权或已获得授权”，并记录时间戳 |
| 上传方式 | 首版仅文件上传（Q9 决策）；浏览器录音放 P2 |

**档案模型**

```json
{
  "id": "vc_7f3a2b",
  "name": "我的音色 01",
  "createdAt": "2026-10-24T10:00:00+08:00",
  "consentAt": "2026-10-24T10:00:00+08:00",
  "durationSec": 12.4,
  "sampleRate": 22050,
  "refHash": "<sha256>",
  "embeddingFile": "embedding.npy",
  "refFile": "ref.wav",
  "status": "ready",
  "lastUsedAt": null
}
```

- 目录：`backend/data/voice-clone/<profileId>/`，含 `ref.wav`、`embedding.npy`（可选）、`meta.json`。
- 列表接口只返回名称、时长、创建时间、状态、是否当前使用，不返回服务器绝对路径。
- 删除档案：删除整个目录，并清理该档案记录过的缓存条目；删除操作幂等。

**处理管线**

1. 接收上传 → 校验大小/格式/时长。
2. ffmpeg 归一化为 `ref.wav`（22.05kHz、单声道、16bit）；若 ffmpeg 缺失，仅接受已符合要求的 WAV，并给出提示。
3. 使用 `tone_extract.onnx` 提取音色嵌入并缓存为 `embedding.npy`；若当前运行时不支持嵌入序列化，则退回“合成时实时提取”，并在档案中标记 `embeddingCached=false`。
4. 试听/合成：melo 生成基础音频 → OpenVoice `tone_color.onnx` 迁移音色 → 返回 WAV。
5. 记录耗时日志：`base_ms`、`convert_ms`、`total_ms`、`ref_hash`，不记录音频内容。

**合成与缓存**

- 请求形态：`engine=openvoice`，`voice=clone:<profileId>`，其余字段与普通 TTS 一致。
- 缓存键：`openvoice|clone:<profileId>|<refHash>|text|speed|format`。
- 更换/删除参考音频后 `refHash` 变化，旧缓存自然失效；删除档案时尽力清理其缓存。
- 克隆音色输出固定 22.05kHz；如果前端要求 44.1kHz，由现有播放链路重采样，不在克隆层重复转换。

**性能与产品约束（依据历史实测）**

- 热路径 RTF≈1.11（melo 0.63 + 转换 0.47），即 10 秒音频约需 11 秒合成；首次还需加载约 190MB 模型。
- 界面必须显示“克隆音色合成较慢，约等于音频时长”，并为试听提供 loading 与耗时。
- 课堂悬停朗读使用克隆音色时，优先命中预缓存；未命中按 Q8 决策**自动回退普通音色**，不阻塞课堂交互。后续可增加“强制克隆实时朗读”高级开关。
- 克隆模式内存占用 = melo 基底 + OpenVoice 转换器，需在“内存”约束中单独说明，切换回普通引擎时释放 OpenVoice。

**失败与降级**

| 情况 | 行为 |
| --- | --- |
| 克隆组件缺失 | 克隆区域置灰，显示缺失文件与“重新放置模型”提示 |
| 参考音频不合格 | 拒绝创建，提示具体原因（过长/过短/多声道/静音/解码失败） |
| 音色档案被删除但设置仍指向它 | 自动回退 `melo:0`，提示“原克隆音色已删除” |
| 合成超时 | 返回 `TTS_CLONE_TIMEOUT`，建议改用普通音色或稍后重试 |
| 并发试听 | 按档案串行排队，界面显示“排队中” |
| 磁盘写入失败 | 不创建半成品档案；清理临时文件并返回错误 |

**隐私与删除**

- 参考音频、嵌入、克隆产物只存在本机；不上传任何第三方服务。
- 设置页明确提示“仅用于本机学习朗读”。
- 删除克隆音色为硬删除；同时清除档案目录与缓存；若设置当前指向该音色，回退到 `melo:0`。

### 3.5 接口设计

| 接口 | 变更 | 说明 |
| --- | --- | --- |
| `GET /api/tts/engines` | 新增 | 返回全部引擎、可用状态、许可证、支持语种、默认音色、音色数量、`supportsClone`；不加载模型 |
| `GET /api/tts/voices?engine=aishell3` | 调整 | 按引擎返回音色列表；未加载时也能从文件读取；克隆引擎返回档案列表 |
| `POST /api/tts/generate` | 调整 | 新增可选 `engine`；`voice` 支持 `engineId:speakerId` 与 `clone:<profileId>`；缓存键纳入引擎与参考音频哈希 |
| `POST /api/tts/clone/refs` | 新增 | `multipart/form-data` 上传参考音频，创建克隆档案；返回安全元数据 |
| `GET /api/tts/clone/refs` | 新增 | 列出克隆档案（不含路径与音频内容） |
| `DELETE /api/tts/clone/refs/{id}` | 新增 | 删除档案、参考音频、嵌入与相关缓存 |
| `POST /api/tts/unload` | 新增（可选） | 释放当前引擎（含克隆转换器），供“节省内存”与切换使用 |
| `GET /api/tts/health` | 调整 | 补充当前已加载引擎、引擎总数、可用数量、克隆档案数 |

**生成请求示例**

```json
{
  "text": "The quick brown fox jumps over the lazy dog.",
  "language": "en",
  "engine": "aishell3",
  "voice": "aishell3:SSB0066",
  "rate": 1.0,
  "format": "wav"
}
```

**引擎返回示例（安全、无路径泄露可选裁剪）**

```json
{
  "success": true,
  "engines": [
    {
      "id": "melo",
      "displayName": "MeloTTS 中英双语",
      "available": true,
      "license": "MIT",
      "languages": ["zh", "en"],
      "defaultVoiceId": "melo:0",
      "voiceCount": 1,
      "experimental": false
    },
    {
      "id": "aishell3",
      "displayName": "AISHELL-3 中文多音色",
      "available": true,
      "license": "Apache-2.0",
      "languages": ["zh"],
      "defaultVoiceId": "aishell3:SSB0005",
      "voiceCount": 174,
      "experimental": false
    },
    {
      "id": "openvoice",
      "displayName": "OpenVoice v2 音色克隆（音色迁移）",
      "available": true,
      "license": "MIT",
      "languages": ["zh", "en"],
      "defaultVoiceId": null,
      "voiceCount": 0,
      "supportsClone": true,
      "cloneProfileCount": 2,
      "experimental": false
    }
  ]
}
```

**克隆试听请求示例**

```json
{
  "text": "Reading every day makes a difference.",
  "language": "en",
  "engine": "openvoice",
  "voice": "clone:vc_7f3a2b",
  "rate": 1.0,
  "format": "wav",
  "timeoutSeconds": 180
}
```

### 3.6 后端服务改造

- `TTSService` 从“单引擎单例”改为“引擎缓存表 + 当前驻留引擎”：
  - `Map<engineId, EngineHandle>`；普通引擎同一时刻只保留一个（LRU=1）。
  - 克隆模式例外：`melo` 基底与 `openvoice` 转换器需同时驻留；切回普通引擎时释放 `openvoice`。
  - 切换引擎时：停止推理 → 释放旧 `OfflineTts` → 加载新引擎 → 记录加载耗时日志。
  - 每个引擎独立推理锁，避免不同会话并发冲突；克隆按档案串行排队，防止内存峰值。
- 构造配置需按 `engineType` 分支：
  - `vits`：`OfflineTtsVitsModelConfig`（melo/aishell3）。
  - `kokoro`：`OfflineTtsKokoroModelConfig`（需要 `voices.bin`、词典、espeak 数据）。
  - `matcha`：`OfflineTtsMatchaModelConfig`（需声码器，若缺失则判不可用）。
  - `openvoice`：不构造 `OfflineTts`；复用 melo 基底 + `tone_extract.onnx` + `tone_color.onnx`，按档案加载嵌入。
- 新增 `VoiceCloneStore`：负责档案目录、元数据、参考音频归一化、嵌入缓存、删除与容量限制；所有路径以 UUID 拼接并做根目录校验。
- 实现前必须用已安装的 `sherpa-onnx` 版本验证三种配置构造可用；不可用的引擎明确标记，不强行接入。
- 缓存键扩展为 `engineId|sid|text|speed|format`；克隆为 `openvoice|clone:<profileId>|<refHash>|text|speed|format`，避免同文本不同音色串音。
- 加载失败只影响该引擎，接口返回 `success:false + code`，不抛出 500；克隆相关错误单独编码（`TTS_CLONE_*`）。

### 3.7 前端改造

- 新增 `shared/services/ttsEngineService.ts`：调用 `/api/tts/engines`、`/api/tts/voices`，带缓存与失败降级。
- 新增 `components/settings/SpeechSettingsTab.vue`：
  - 引擎卡片：名称、许可证、语种、可用状态、缺失原因。
  - 音色选择：精选优先，展开“全部音色”；支持搜索 `SSB` 编号。
  - 克隆区域：上传/拖拽音频、授权勾选、名称输入、上传进度、试听、设为当前、删除；展示“合成较慢”提示与实测耗时。
  - 每个音色有“试听”按钮，试听文本按语种选择。
  - 语速、音量滑块；ASR 区域可折叠。
- 新增 `shared/services/ttsCloneService.ts`：封装档案列表、上传（`FormData`）、删除、试听；上传失败展示后端可操作错误。
- `useSpeechPlayer` 改为默认读取设置：
  - 新签名内部取 `ttsEngine/ttsVoiceId/ttsSpeed/ttsVolume`，调用方传入参数优先。
  - 播放前按 `playToken` 丢弃过期结果（保留现有机制）。
  - 克隆音色请求设置更长超时，并在 UI 显示合成中状态。
- `ttsPrecacheService` 同样带入引擎与音色，避免与试听/课堂缓存错位；克隆音色优先预生成。
- `testTTS` 使用当前选择的引擎与音色，不再固定默认值。
- 克隆档案在设置页初始化时校验：若 `ttsVoiceId=clone:<id>` 已不存在，回退 `melo:0` 并提示。
- 浏览器内置音色作为 P2 可选兜底，本期不做。

### 3.8 设置字段与迁移

`frontend/src/renderer/stores/settings.ts` 新增：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `settingsVersion` | number | `2` | 设置结构版本 |
| `ttsEngine` | string | `melo` | 当前 TTS 引擎 |
| `ttsVoiceId` | string | `melo:0` | 当前音色 |

旧值迁移：

- `ttsVoice = 'default' | 'female' | 'male'` → `melo:0`（并做一次性提示：旧音色为占位值）。
- 保留 `ttsVoice` 字段一个版本以兼容读取，但新代码只使用 `ttsVoiceId`。
- `ttsProvider` 保留（固定 `http` 表示走本地后端），界面不再展示无实际实现的 browser/sherpa 选项。
- 克隆音色只在前端保存 `clone:<profileId>` 字符串；档案实体与音频在后端，前端不缓存音频 Blob（现有 TTS Blob 缓存除外）。
- 存储键 `lexitype-settings` **不修改**。

### 3.9 验收标准

| 编号 | 可观察行为 | 判定方法 |
| --- | --- | --- |
| S-1 | 语音页展示 melo/aishell3/kokoro，缺失模型置灰并显示原因 | 对照 `backend/models` 与界面 |
| S-2 | aishell3 可选音色数 = `speakers.txt` 行数 | 接口与文件行数比对 |
| S-3 | 点击任一音色“试听”返回该音色的音频 | 听感 + 后端日志 engine/sid |
| S-4 | 课堂朗读使用当前音色与语速 | 切换音色后进入课堂朗读，日志核对 |
| S-5 | 同文本不同音色的缓存互不覆盖 | 切换后试听，确认重新合成且音色不同 |
| S-6 | 切换引擎后旧引擎被释放 | 后端日志出现 unload，进程内存不持续增长 |
| S-7 | 旧设置刷新后仍可用且无报错 | 构造旧 `lexitype-settings` 验证 |
| C-1 | 上传 5–20 秒人声可创建克隆档案，并能在列表中看到 | 页面上传 + `GET /api/tts/clone/refs` |
| C-2 | 0.5 秒、31 秒、10MB+、非音频文件被拒绝且提示明确 | 四类非法文件逐一上传 |
| C-3 | 上传后 `ref.wav` 为 22.05kHz 单声道 16bit，文件名不可控路径 | 检查 `backend/data/voice-clone/<id>/` |
| C-4 | 试听返回克隆音色音频，日志含 base/convert/total 耗时 | 听感 + 后端日志 |
| C-5 | 设为当前后课堂朗读使用克隆音色；缓存键含 `refHash` | 切换后朗读 + 后端日志 |
| C-6 | 删除克隆后档案目录、嵌入与缓存被清理，设置回退 `melo:0` | 文件系统 + 刷新设置 |
| C-7 | 未勾选授权无法上传；提示文案明确“仅本机使用” | 页面操作 |
| C-8 | 克隆组件缺失时区域置灰并显示缺失文件 | 临时重命名 `tone_color.onnx` 验证 |
| C-9 | 克隆合成超时返回可操作错误，不导致服务崩溃 | 注入长文本/超时配置 |

---

## 4. 大模型配置设计

### 4.1 核心决策

1. **默认密钥仍只存后端**，前端永不落盘；但密钥改由后端本地配置文件管理，页面可写不可读。
2. **服务商目录唯一来源在后端**，前端只渲染，不硬编码。
3. **多档案、单生效**：可保存多个服务商配置，同一时刻只有一个 `activeProvider`。
4. **测试使用草稿**：允许在保存前用当前表单参数测试，密钥只在本次请求内存中使用。

### 4.2 服务商目录

后端新增 `backend/app/core/ai_providers.py`：

| id | 名称 | Base URL | 预置模型（可编辑） | 备注 |
| --- | --- | --- | --- | --- |
| `deepseek` | DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat`、`deepseek-reasoner` | 需密钥 |
| `qwen` | 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus`、`qwen-turbo`、`qwen-max`、`qwen-long` | 需密钥 |
| `zhipu` | 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4-plus`、`glm-4-air`、`glm-4-flash`、`glm-4-long` | 需密钥 |
| `moonshot` | 月之暗面 Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k`、`moonshot-v1-32k`、`moonshot-v1-128k` | 需密钥 |
| `openai` | OpenAI | `https://api.openai.com/v1` | `gpt-4o-mini`、`gpt-4o` | 需密钥 |
| `siliconflow` | 硅基流动 | `https://api.siliconflow.cn/v1` | 手工输入 | 需密钥 |
| `volcengine` | 火山方舟（豆包） | `https://ark.cn-beijing.volces.com/api/v3` | 手工输入 Endpoint ID | 需密钥 |
| `ollama` | 本地 Ollama | `http://127.0.0.1:11434/v1` | 手工输入 | 免密钥 |
| `custom` | 自定义兼容服务 | 用户输入 | 手工输入 | 需密钥（可空） |

说明：

- 预置模型名会随服务商演进变化，因此模型下拉**允许自由输入**（`allow-create`），不把目录当唯一真相。
- 火山方舟的“模型”实际是推理接入点 ID，界面文案写“模型 / Endpoint ID”。
- 服务商图标不引入外部图片，使用文字徽标，避免新增静态资源与版权问题。

### 4.3 配置档案模型

```json
{
  "schemaVersion": 1,
  "activeProvider": "deepseek",
  "profiles": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat",
      "temperature": 0.7,
      "maxTokens": 8000,
      "timeoutSeconds": 120,
      "apiKey": "<仅后端文件保存，接口永不返回>"
    },
    "qwen": {
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "model": "qwen-plus",
      "temperature": 0.7,
      "maxTokens": 8000,
      "timeoutSeconds": 120,
      "apiKey": ""
    }
  }
}
```

- 落盘位置：`backend/data/ai-settings.json`（`backend/data` 已在 `.gitignore` 内）。按 Q1 决策首版采用本机 JSON，后续可升级 Windows DPAPI 加密。
- 原子写入：临时文件 + `os.replace`，避免写一半损坏。
- 文件权限：Windows 下尽力设置仅当前用户可读；日志只记录“已保存/已清除”，不记录密钥。
- 密钥读取优先级：`ai-settings.json` 的 active profile > `.env` 的 `AI_*` > 内置默认。这样旧 `.env` 用户无需迁移，界面保存后以界面为准。
- 若 active profile 未填密钥，则回落到 `.env` 密钥并在状态中标注来源 `env`。

### 4.4 接口设计

| 接口 | 变更 | 说明 |
| --- | --- | --- |
| `GET /api/ai/providers` | 新增 | 服务商目录、预置模型、是否必需密钥、文档链接 |
| `GET /api/ai/settings` | 新增 | 生效配置与全部档案，**不含密钥**；含 `keyConfigured`、`keyTail`（可选后 4 位）、`keySource` |
| `PUT /api/ai/settings` | 新增 | 保存一个或多个档案与 activeProvider；`apiKey` 为空表示“保持不变”，`clearApiKey:true` 表示清除 |
| `POST /api/ai/test` | 调整 | 支持传入草稿 `{provider, baseUrl, model, apiKey?}`；不传则测试当前生效配置 |
| `GET /api/ai/config` | 保留 | 兼容旧前端；返回生效配置的安全摘要 |
| `POST /api/ai/chat`、`/chat/stream` | 不变 | 后端按生效配置选择服务商，前端无需感知 |

**GET 响应示例（无密钥）**

```json
{
  "activeProvider": "deepseek",
  "configured": true,
  "keySource": "file",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "baseUrl": "https://api.deepseek.com/v1",
  "timeoutSeconds": 120,
  "maxTokens": 8000,
  "profiles": [
    { "provider": "deepseek", "model": "deepseek-chat", "keyConfigured": true, "keyTail": "…ab12" },
    { "provider": "qwen", "model": "qwen-plus", "keyConfigured": false, "keyTail": "" }
  ]
}
```

### 4.5 安全设计（硬门禁）

| 风险 | 措施 |
| --- | --- |
| 密钥回显 | GET/PUT 响应只返回 `keyConfigured` 与可选 `keyTail`；任何字段名含 `key` 都不得返回原值 |
| 密钥落前端 | 前端不写 localStorage/sessionStorage；输入框只存在于内存；保存后立即清空明文状态 |
| 密钥进日志 | 日志只记录 provider/model/baseUrl（去凭据）/耗时/状态；请求头不打印 |
| 密钥文件泄露 | 仅本机路径；原子写；尽力设置权限；不纳入版本库 |
| SSRF | 仅允许 `http/https`；禁止 URL 内嵌账号密码；禁止 `169.254.169.254`、链路本地与组播地址；`http://` 仅允许回环地址；自定义域名需用户确认 |
| 恶意上游 | 超时上限、最大输出上限沿用服务端配置；错误信息不透传上游原始报文 |
| 并发写 | 文件写锁 + 原子替换；保存失败保留旧文件 |

### 4.6 后端生效配置改造

新增 `backend/app/services/ai/ai_settings_store.py`：

- `load()`：读取 `ai-settings.json`，校验 schema，损坏时备份并回退 `.env`。
- `get_effective()`：返回 `{provider, baseUrl, model, apiKey, temperature, maxTokens, timeoutSeconds, source}`。
- `save(profiles, activeProvider)`：校验 → 原子写 → 返回安全摘要。
- `ai.py` 路由不再直接读 `get_settings()` 的 AI 字段，而是调用 `get_effective()`；Chat/流式/测试共用同一解析逻辑，避免三处漂移。
- 保留 `Settings` 中的 AI 字段作为默认值与 `.env` 兼容层。

### 4.7 前端大模型页

新增 `components/settings/ModelSettingsTab.vue`：

- 顶部状态条：当前生效服务商/模型、密钥来源（本地配置/环境变量/未配置）、最后测试结果与耗时。
- 服务商卡片网格：名称、Base URL 摘要、已配置状态；点击切换编辑对象。
- 表单：
  - Base URL：默认只读；`custom` 或高级模式下可编辑。
  - API Key：密码框；占位“已配置（••••ab12）”；空值保存=保持不变；提供“清除密钥”。
  - 模型：可搜索下拉 + 允许自由输入。
  - 温度：0–2，步长 0.1；最大输出：1–服务端上限；超时：5–600 秒。
  - 按钮：“测试连接”（当前草稿）、“保存并应用”。
- 保存成功后刷新状态；失败展示后端 `detail.message`，不展示堆栈。
- 未保存离开拦截：使用路由守卫或 `onBeforeRouteLeave` + 确认框。
- 页面不展示任何“.env 配置代码块”（旧页面引导文案移除），改为“本地配置已保存到后端，不进入浏览器”。

### 4.8 验收标准

| 编号 | 可观察行为 | 判定方法 |
| --- | --- | --- |
| M-1 | 可切换 DeepSeek/千问/智谱，保存后状态显示对应 provider/model | 页面操作 + `GET /api/ai/settings` |
| M-2 | 未保存时可“测试连接”，成功返回模型与耗时 | 页面 toast + 后端日志 |
| M-3 | 保存后 AI 对话使用新生效配置 | 发起对话，后端日志 provider/model 一致 |
| M-4 | 任意 GET 响应与浏览器存储中无密钥 | DevTools 搜索 + 接口响应 |
| M-5 | 密钥留空保存不会清除已存密钥 | 保存后 `keyConfigured` 仍为 true |
| M-6 | 清除密钥后 AI 返回 `AI_CONFIG_MISSING` | 接口 503 + 页面提示 |
| M-7 | 非法 Base URL（非 http/https、含凭据、元数据地址）被拒绝 | 接口 400 + 页面提示 |
| M-8 | `.env` 旧配置在未保存界面配置时仍可用 | 仅设 `.env`，`keySource=env` |

---

## 5. 前端文件影响面

| 文件 | 变更 |
| --- | --- |
| `frontend/src/renderer/views/SettingsPage.vue` | 改为分页壳：导航、路由同步、保存状态、重置入口 |
| `frontend/src/renderer/components/settings/GeneralSettingsTab.vue` | 新增：外观/语言 |
| `.../SpeechSettingsTab.vue` | 新增：TTS 引擎/音色/试听 + ASR + 克隆音色区域 |
| `.../VoiceClonePanel.vue` | 新增：上传、授权、进度、档案列表、试听、设为当前、删除 |
| `.../ModelSettingsTab.vue` | 新增：大模型配置 |
| `.../LearningSettingsTab.vue` | 新增：学习偏好 |
| `.../PracticeSettingsTab.vue` | 新增：打字练习 |
| `.../AboutSettingsTab.vue` | 新增：数据入口占位、版本、重置 |
| `frontend/src/renderer/stores/settings.ts` | 新增字段、迁移、默认值；存储键不变 |
| `frontend/src/shared/services/ttsApiService.ts` | 请求增加 `engine`；新增引擎/音色查询；克隆请求超时 |
| `frontend/src/shared/services/ttsCloneService.ts` | 新增：档案列表、上传、删除、试听 |
| `frontend/src/renderer/composables/useSpeechPlayer.ts` | 默认读取设置中的引擎/音色/语速/音量；克隆超时与状态 |
| `frontend/src/renderer/services/ttsPrecacheService.ts` | 带入引擎/音色，克隆优先预生成 |
| `frontend/src/shared/services/ai/aiConfig.ts` | 保持只存 `customPrompts`；新增模型设置 API 客户端或独立服务 |
| `frontend/src/renderer/router/index.ts` | 设置页支持 `?tab=` 深链（不新增路由） |

## 6. 后端文件影响面

| 文件 | 变更 |
| --- | --- |
| `backend/app/services/voice/tts_engines.py` | 新增：引擎注册表与音色目录 |
| `backend/app/services/voice/tts_service.py` | 多引擎懒加载、单引擎驻留、按类型构造配置、克隆管线、缓存键扩展 |
| `backend/app/services/voice/voice_clone_store.py` | 新增：参考音频校验/归一化、嵌入缓存、档案 CRUD、容量限制 |
| `backend/app/api/routers/tts.py` | 新增 `/engines`、`/clone/refs`；调整 `/voices`、`/generate`、`/health` |
| `backend/app/core/ai_providers.py` | 新增：服务商目录唯一来源 |
| `backend/app/services/ai/ai_settings_store.py` | 新增：本地配置读写、校验、原子落盘、生效解析 |
| `backend/app/api/routers/ai.py` | 新增 `/providers`、`/settings`；调整 `/test`；改用生效配置 |
| `backend/app/core/config.py` | AI/TTS 字段保留为默认与兼容层；新增配置文件名等常量 |
| `backend/tests/test_tts_engines.py` | 新增：引擎发现、音色数量、缓存键、不可用引擎 |
| `backend/tests/test_voice_clone.py` | 新增：上传校验、归一化、档案 CRUD、删除清理、refHash 缓存隔离 |
| `backend/tests/test_ai_settings.py` | 新增：保存/读取、密钥不回显、优先级、非法 URL、清除密钥 |

---

## 7. 实施切片

| 切片 | 内容 | 前置 | 完成判据 |
| --- | --- | --- | --- |
| G0 | 本设计评审与开放问题确认 | 无 | 已完成（2026-10-24），Q1–Q9 已确认 |
| G1 | 设置页分页壳与 6 个 Tab 组件（行为不变） | G0 通过 | 分页可切换、深链可用、`npm run build` 通过 |
| G2 | 语音引擎注册表 + 多引擎 TTS + 接口 + 单测 | G1 | `pytest` 通过；`/api/tts/engines` 返回真实可用状态 |
| G3a | 语音页普通音色选择/试听 + 播放链路接入 + 设置迁移 | G2 | S-1～S-7 通过 |
| G3b | 克隆音色：上传/归一化/嵌入/试听/删除 + 播放链路 + 单测 | G2 | C-1～C-9 通过；克隆试听可用 |
| G4 | 大模型目录 + 本地配置存储 + 接口 + 单测 | G1 | `pytest` 通过；密钥不回显、非法 URL 拒绝 |
| G5 | 大模型页表单/测试/保存/未保存拦截 | G4 | M-1～M-8 通过 |
| G6 | 全链路验收、文档与台账更新 | G3a+G3b+G5 | 前后端构建通过；课堂朗读、克隆朗读、AI 对话、设置持久化回归通过 |

**建议顺序**：G1 → G2 → G3a → G3b → G4 → G5 → G6；G1 可先独立交付，G3b 可在 G3a 稳定后单独交付，降低一次性改动风险。

---

## 8. 测试计划

### 8.1 后端单测

- 引擎注册表：已安装/未安装判定；`requiredFiles` 缺失时 `available=false`。
- 音色数量：aishell3 = `speakers.txt` 行数；melo = 1。
- 缓存键：同文本不同引擎/音色生成不同 key。
- 引擎切换：加载新引擎前释放旧引擎；克隆模式保留 melo + OpenVoice，切回普通引擎释放转换器（可用 mock 断言调用顺序）。
- 克隆档案：上传合法/非法音频、时长边界、大小边界、静音检测、UUID 目录、删除清理、容量上限。
- 克隆缓存：同文本不同 `profileId`/`refHash` 生成不同 key；删除档案后缓存不可命中。
- 克隆错误：组件缺失、ffmpeg 缺失、超时、并发排队均返回稳定错误码，不产生半成品目录。
- AI 配置：保存 → 读取；密钥不回显；空密钥保持不变；清除密钥；`.env` 回落。
- URL 校验：`ftp://`、`http://user:pass@host`、`169.254.169.254`、`http://公网域名` 拒绝；`http://127.0.0.1:11434/v1` 允许。
- 连通性测试：MockTransport 覆盖成功/401/429/超时。

### 8.2 前端构建与类型

- `npm run build`（`vue-tsc --noEmit && vite build`）。
- 新增组件无重复类型定义；设置 store 字段与 Tab 组件使用同一 `Settings` 类型。

### 8.3 浏览器手工验收

1. 进入 `/settings`，逐个切换 6 个 Tab；刷新后仍停留在同一 Tab（URL 保留）。
2. 语音页：切换 aishell3 → 选音色 → 试听；再切 kokoro → 试听；观察后端日志 engine/sid 与加载/释放。
3. 克隆：上传 10 秒人声 → 勾选授权 → 创建 → 试听 → 设为当前 → 课堂朗读；删除后确认文件清理与设置回退。
4. 课堂页：选音色后进入课堂，悬停朗读/整组听读使用该音色与语速。
5. 大模型页：配置 DeepSeek → 测试 → 保存 → 发起 AI 对话；再切千问重复一次。
6. DevTools：Application/Storage 与 Network 中搜索密钥片段，确认为空。
7. 断开后端：语音页与大模型页显示可操作错误，不白屏。
8. 清除密钥：AI 功能返回未配置提示；重新填写后恢复。

### 8.4 回归范围

- 课程仓库、课程详情、课堂页、练习页、学习计划、统计页。
- 设置页重置：重置后端 AI 配置与本地偏好需分别明确（重置前端设置不应静默删除后端密钥）。

---

## 9. 风险与决策记录

### 9.1 风险

| 风险 | 影响 | 缓解 |
| --- | --- | --- |
| 多引擎模型体积大、加载慢 | 首次试听等待久、内存升高 | 单引擎驻留 + 显式 unload + 加载耗时日志 + 界面提示 |
| 克隆合成慢（RTF≈1.11） | 课堂实时朗读明显延迟 | 界面明示耗时；优先预缓存；超时可控；由 Q8 决定实时范围 |
| 参考音频质量差/多人说话 | 克隆音色效果差、用户困惑 | 上传规范提示 + 时长/静音校验 + 先试听后启用 |
| 克隆声音授权与隐私 | 合规与信任风险 | 强制授权勾选、仅本机保存、硬删除、界面明确用途 |
| 克隆档案占用磁盘 | 长期增长 | 档案上限 5 个、总量 50MB、删除即清理、清理入口 |
| OpenVoice 与 melo 同时驻留 | 内存峰值约 190MB+ | 克隆模式专用驻留策略；切回普通引擎立即释放转换器 |
| ffmpeg 缺失 | 非 WAV 无法归一化 | 探测 ffmpeg；缺失时仅接受合规 WAV 并明确提示 |
| aishell3 `rule.far` 体积大 | 加载/内存成本高 | 可选启用规则文件；优先加载必需文件 |
| Kokoro/Matcha 配置构造与 sherpa-onnx 版本不匹配 | 引擎不可用 | G2 先做能力探测，不匹配则标记不可用并隐藏 |
| 服务商预置模型名过期 | 用户选到失效模型 | 模型可自由输入 + 测试连接前置 |
| 后端配置写入引入密钥文件 | 本机泄露风险 | 权限最小化、不纳入版本库、接口不回显；后续可接 Windows DPAPI |
| 分页重构破坏现有设置读取 | 旧用户设置丢失 | 存储键不变 + 迁移单测 + 手工旧数据验证 |
| `.env` 与界面配置双来源 | 行为不明确 | 明确优先级并在状态条展示 `keySource` |

### 9.2 已确认决策（2026-10-24）

| 编号 | 决策项 | 确认结果 | 实施影响 |
| --- | --- | --- | --- |
| Q1 | 大模型密钥保存方式 | **A**：`backend/data/ai-settings.json`；首版本机 JSON，后续可升级 Windows DPAPI | G4 |
| Q2 | 音色列表展示 | **A**：精选 8 个 + 全部 174 个 | G3a |
| Q3 | 实验引擎展示 | **A**：ChatTTS/CosyVoice2/IndexTTS2 默认隐藏，高级开关显示；OpenVoice 克隆正常展示 | G2 |
| Q4 | 拉取服务商模型列表 | **A**：首版不做，预置模型 + 手工输入 | 不阻断 |
| Q5 | 数据导入/导出 | **A**：本期仅入口占位，实现归入批次E | 不阻断 |
| Q6 | 音色命名 | **A**：先中性编号，实际试听后补充名称 | G3a 定名 |
| Q7 | 克隆档案上限 | **A**：最多 5 个，总占用 50MB | G3b |
| Q8 | 克隆音色使用链路 | **B**：试听与预缓存使用克隆；课堂实时未命中自动回退普通音色；后续可加强制开关 | G3b |
| Q9 | 上传方式 | **A**：首版仅文件上传，浏览器录音放 P2 | G3b |

- 决策生效日期：2026-10-24；后续如变更，必须同步更新本节与 `project-control/TASKS.md`。
- 未决增强项（不阻断本期）：自动拉取模型列表、浏览器录音、克隆实时朗读强制开关、密钥 DPAPI 加密。

### 9.3 批准门禁

- **G0 状态**：已通过（2026-10-24），Q1–Q9 均已确认，可进入 G1。
- **实施授权**：按 G1→G2→G3a→G3b→G4→G5→G6 顺序实施，每个切片必须附构建/测试证据，未执行项标 `NOT_RUN`。
- **变更控制**：若实施中发现与决策冲突（例如 OpenVoice 资产不可用、sherpa-onnx 不支持某引擎），暂停该切片并回到本设计更新，不得静默降级或绕过验收。
- **范围控制**：未获用户同意，不扩展 Q4–Q9 之外的增强项。

---

## 10. 追溯关系

| 需求 | 设计章节 | 验收 |
| --- | --- | --- |
| 设置页按类别分页 | 2 | 8.3-1 |
| 语音模型增加音色选择 | 3 | S-1～S-7 |
| 上传音频克隆并调用音色 | 3.4.1 | C-1～C-9 |
| 音色真正作用于朗读 | 3.7 | S-4、C-5 |
| 大模型支持 DeepSeek/千问/智谱 | 4.2 | M-1、M-3 |
| 密钥安全不回显 | 4.5 | M-4 |
| 兼容旧设置与旧 `.env` | 3.8、4.3 | S-7、M-8 |
| 本地单机、无登录 | 1.5、4.5 | 代码与接口走查 |

---

## 11. 结论

本方案把设置页从“单页表单”升级为“分类设置中心”，并把两类模型配置从占位/只读升级为真实可用能力：

- 分页结构清晰，支持深链与独立保存策略；本地偏好即时保存，模型配置显式保存。
- 语音侧以“引擎 + 音色”统一模型接入已安装的 melo/aishell3/kokoro，音色选择真正进入朗读链路。
- 克隆侧基于 OpenVoice v2 音色迁移，支持上传参考音频、试听、设为当前与删除；明确实测性能、授权与本地隐私边界。
- 大模型侧以“后端目录 + 本地配置档案 + 单生效”支持 DeepSeek、千问、智谱等常用服务商，同时保持密钥不落前端、不回显、不进日志。

当前状态：**设计已确认（2026-10-24），G0 通过，可进入 G1 实现；实现前未改动业务代码。**
