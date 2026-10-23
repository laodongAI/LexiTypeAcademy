# LexiType Academy（键语学苑）

本地单机英语学习应用：课程学习、打字练习、间隔复习、AI 辅助内容生成与离线语音。

- 部署形态：本地单机（后端 `127.0.0.1:8000`，前端 `localhost:5173`）
- 用户体系：单用户、无登录
- 数据存储：前端 IndexedDB（存量）+ 后端 SQLite（迁移后主线）

## 目录结构

```
lexitype-academy/
├── frontend/          # 前端：Vue 3 + TypeScript + Vite（纯 Web 运行）
│   ├── src/renderer/  # 页面、组件、路由、状态、样式
│   └── src/shared/    # 跨层共享：类型定义、数据库访问、服务
├── backend/           # 后端：Python FastAPI
│   ├── app/           # 应用代码（core 配置与日志、api 路由、services 业务）
│   ├── models/        # 本地模型资产（不入版本库，仅提交 manifest.json）
│   └── data/          # 运行时数据（SQLite 等，不入版本库）
├── legacy/            # 历史版本归档（React 旧版、Electron Vue 旧壳、构建产物）
├── docs/              # 项目文档与设计资料
└── scripts/           # 开发与运维脚本
```

## 环境要求

| 组件 | 版本 |
| --- | --- |
| Python | 3.11+ |
| Node.js | 18+ |
| ffmpeg（资源工坊后续需要） | 可选 |

## 快速开始

```powershell
# 一键启动（首次会自动创建后端虚拟环境、安装依赖、执行模型自检）
.\scripts\dev.ps1

# 只启动后端
.\scripts\dev.ps1 -BackendOnly

# 只启动前端
.\scripts\dev.ps1 -FrontendOnly

# 跳过模型自检（模型尚未拷贝时）
.\scripts\dev.ps1 -SkipModels
```

启动后访问：

- 前端页面：<http://localhost:5173>
- 后端健康检查：<http://127.0.0.1:8000/api/health>
- 后端接口文档：<http://127.0.0.1:8000/docs>

## 分别启动

后端：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.main
```

前端：

```powershell
cd frontend
npm install
npm run dev
```

## 模型资产

语音模型体积大，**不入版本库**，需从本地拷贝到 `backend/models/`，并保持目录名不变。
期望结构与授权信息见 [`backend/models/manifest.json`](backend/models/manifest.json)：

- `tts/vits-melo-tts-zh_en`（必需，MIT，默认合成引擎）
- `tts/matcha-icefall-zh-baker`（可选，DataBaker 非商用）
- `tts/vits-icefall-zh-aishell3`、`tts/kokoro-int8-multi-lang-v1_1`（可选）
- `tts/openvoice-onnx-v2`（可选，音色克隆默认关闭）
- `tts/vocos-22khz-univ.onnx`（可选，声码器）
- `asr/sensevoice`（必需，主识别引擎）
- `asr/silero_vad.onnx`（可选，语音活动检测）
- `asr/sherpa-onnx-whisper-tiny`（可选，兜底识别）

自检命令：

```powershell
backend\.venv\Scripts\python.exe scripts\check_models.py
backend\.venv\Scripts\python.exe scripts\check_models.py --json
```

## 开发约定

- 配置文件：`backend/.env`（参考 `backend/.env.example`）、`frontend/.env.local`（参考 `frontend/.env.example`）
- 日志：后端按级别输出到控制台与 `backend/logs/app.log`（10 MB 滚动，保留 5 份）
- 代码注释、函数注释、变量注释统一使用中文
- 业务逻辑写在 `backend/app/services/`，路由只做参数校验与编排

## 迁移说明

旧版 Electron 应用的 IndexedDB 数据（库名 `LexiTypeAcademyDB`）需在旧应用内导出 JSON，
再由后端导入并校验通过后，方可退役 `legacy/` 下的旧壳。IndexedDB 按 origin 隔离，
旧应用停止使用前必须完成导出，否则数据不可恢复。
