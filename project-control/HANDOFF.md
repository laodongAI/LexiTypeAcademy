# 交接说明（HANDOFF）

## 当前状态

- 主线：`frontend/`（Vue3+Vite，端口 5183）+ `backend/`（FastAPI，127.0.0.1:8010），本地单机、单用户、无登录。
- 已完成：仓库基线、前后端骨架、14 表数据层与迁移工具、TTS/ASR 后端服务。
- 已完成：阶段4 批次A（前端构建恢复、设置页语音测试接真实后端）。
- 已完成：真实存量数据迁移（旧 React 版 `LexiTypeDB` v80：27 条掌握度 + 142 条复习日志），17/17 校验 PASS。

## 下一步

1. 批次B：实现课程/课时/练习/复习 REST CRUD，并把前端仓储切到 HTTP。
2. 批次C：统计页改为真实聚合（需给练习记录补 `wpm`/`totalItems` 字段）。
3. AI 能力后端化前，先确认用户使用的模型服务商与密钥管理方式。
4. 可选补迁：`http://localhost:5173` 源（旧 Vue 版 IndexedDB，约 11KB），需该端口释放后执行。

## 环境事实

- Python 虚拟环境：`backend/.venv`（sherpa-onnx、numpy 已装）。
- 模型目录：`backend/models`（整体 gitignore，仅 `manifest.json` 入库）。
- ffmpeg：系统环境变量 `FFMPEG_PATH=D:\tools\ffmpeg-7.1`（指向安装目录，配置层已兼容）。
- 端口：8000/5173 属于另一个运行中的项目，不要占用或终止其进程。

## 已知风险

- 旧版应用已无法启动：`legacy/artifacts/electron-release/win-unpacked/resources/app.asar` 缺失，`C:\Program Files\LexiType Academy` 为空目录；再次导出数据只能复用“复制 profile + file:// 同源读取”的方式。
- 前端业务数据仍在浏览器 IndexedDB，后端 SQLite 尚未成为唯一数据源，存在“双存储”不一致风险。
- IndexedDB 按 origin 隔离，旧 Electron 应用停止使用前必须完成导出。
- 发音评分为文本相似度级简化实现，不能作为专业发音评测结论。
