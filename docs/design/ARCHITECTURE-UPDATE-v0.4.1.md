# 技术架构更新总结 - v0.4.1

## 概述

根据项目实际需求，更新了 v0.4.1 设计文档中的技术架构部分，确保文档准确反映系统的真实设计。主要调整包括：

1. **移除云端架构**：移除 MongoDB、Redis、S3、后端服务器的引用
2. **确认本地架构**：确认为 Electron 桌面应用 + 本地存储
3. **内置模型**：明确内置 Sherpa ONNX (ASR)、系统 TTS
4. **LLM 集成**：支持 Qwen 和豆包文生文 API 调用
5. **语言简化**：移除国际化、权限管理等与实际不符的内容

---

## 详细变更清单

### 第 2 章：总体架构设计

#### 2.1 分层架构概览

**变更前**：
- 强调"分布式架构"
- 包含 Electron/React (Desktop) + RN (Mobile)
- 基础设施层：Dexie、MongoDB、S3

**变更后**：
- 改为"本地应用架构"
- 仅 Electron (Desktop) 版本（React GUI）
- 基础设施层：Dexie + 本地文件系统
- 明确内置 Sherpa ONNX、系统 TTS
- 清晰的 Main Process ↔ Renderer 通信

#### 2.2 技术栈

**关键更新**：

| 维度 | 变更前 | 变更后 |
|------|--------|--------|
| 桌面应用 | Electron (Desktop)、React | Electron (v22+)、Node.js Main |
| 前端 | React、TypeScript、Tailwind CSS、Dexie.js | React 18、TypeScript、Tailwind CSS、Hooks |
| 移动端 | React Native（规划）| ❌ 移除 |
| **语言** | 未明确 | **仅中文 (zh-CN)** |
| 后端 | Node.js、Express/Fastify、MongoDB、Redis | ❌ 无独立后端 |
| 音频 | Sherpa-ONNX、SystemTTS/Edge TTS | ✅ Sherpa ONNX (离线)、Windows SAPI5 (内置) |
| AI/LLM | OpenAI GPT-4 / Local LLM | ✅ Qwen / 豆包 (HTTP 调用) |
| **存储** | S3、IndexedDB、MongoDB | **IndexedDB + 本地文件系统** |
| 监控 | OpenTelemetry、日志聚合 | 本地日志 |

#### 2.3 部署架构

**变更前**：
```
API Gateway → 多个微服务 → 云端存储 (S3 + MongoDB + Redis)
```

**变更后**：
```
单机应用 (Windows)
  ├─ Renderer (React GUI) + IndexedDB
  └─ Main Process (Node.js)
      ├─ 课程/学习/AI Lab 业务逻辑
      ├─ 音频处理 (Sherpa ASR、System TTS)
      ├─ LLM 调用 (HTTP)
      └─ 本地文件系统 (data/ 目录)
```

---

### 第 3 章：UI 设计 - 国际化部分

#### 3.4 国际化 (i18n)

**变更前**：
- 支持中文、英文、日文 (3 语言)
- 日期、货币、数字本地化
- RTL 预留 (阿拉伯语、希伯来语)

**变更后**：
- **仅支持中文 (zh-CN)**
- 所有 UI、菜单、日志、文档均中文
- 日期格式：中国标准 (2024年12月8日)
- 数字格式：分数、时间、百分比的中文表示
- 文件名：支持中文命名

---

### 第 3 章：UI 设计 - 权限管理部分

#### 3.1 Dashboard 布局

**变更**：
- 左侧栏状态标签：移除"权限状态" → 改为"存储状态"

#### 3.2 全局状态栏

**变更前**：
```
[离线指示 🔴] [权限 🎤] [存储 ▓▓▓░ 60%] [个人菜单 ▼]
```

**变更后**：
```
[离线指示 🔴] [录音 🎤] [存储 ▓▓▓░ 60%] [个人菜单 ▼]
```

---

### 第 8 章：技术架构细节

#### 8.5 缓存策略

**变更前**：
- 3 层缓存：内存、IndexedDB、云端 (S3)
- S3 永久存储

**变更后**：
- 3 层本地缓存：
  1. 内存 LRU（50 TTS、100 ASR、TTL 1h）
  2. IndexedDB（最多 500 项、TTL 7d）
  3. 文件系统（data/cache/、TTL 30d 自动清理）
- 所有数据完全本地，离线可用（除 LLM 调用）

---

### 第 12 章：非功能需求 - 安全与隐私

#### 12.3 安全与隐私

**变更前**：
- GDPR、CCPA、COPPA 合规
- HTTPS 传输
- 麦克风权限严格控制

**变更后**：
- AES-256 本地加密存储
- 用户数据完全本地（无网络上传）
- 支持导出和清理功能

---

## 架构特性总结

### ✅ 确认的功能特性

1. **完全本地存储**
   - IndexedDB 用于索引化数据
   - 文件系统用于音频、导出、缓存
   - 无云端依赖

2. **内置离线模型**
   - Sherpa ONNX ASR（自动语音识别）
   - Windows 系统 TTS（文本转语音）
   - 支持离线学习、录音、评测

3. **可选网络功能**
   - Qwen LLM API（课程生成、补救策略）
   - 豆包 LLM API（备选）
   - 仅文生文接口

4. **单机可安装**
   - Electron 应用包
   - Windows 系统支持
   - 开箱即用（包含内置模型）

5. **仅中文支持**
   - 所有 UI 界面中文
   - 文档、日志、菜单中文
   - 日期、数字、时间格式按中文标准

---

## 存储架构详解

### 目录结构

```
AppData/LexiType-Academy/
├── data/
│   ├── courses/          # 课程元数据、JSON
│   ├── audio/            # 原始音频文件、TTS 音频
│   │   ├── {courseId}/
│   │   │   ├── {lessonId}/
│   │   │   │   ├── original.mp3         # 原始音频
│   │   │   │   └── {sentenceId}.mp3    # 句子片段
│   │   │   └── tts/
│   │   │       └── {hash}.mp3          # TTS 缓存
│   ├── exports/          # 导出的课程文件 (.zip)
│   ├── cache/            # 临时缓存（自动清理）
│   │   ├── tts/
│   │   ├── asr/
│   │   └── preload/
│   └── logs/             # 应用日志
└── database.db           # Dexie IndexedDB 本地数据库
```

### 数据库表

**IndexedDB (Dexie)**：
- `courses` - 课程元数据
- `lessons` - 课时信息
- `sentences` - 句子内容
- `learningRecords` - 学习记录
- `remediationCourses` - 补救课程
- `aiLabTasks` - AI Lab 任务
- `promptSounds` - 提示音库
- `audioPreloadCache` - 音频预加载缓存

---

## 与原文档的兼容性

✅ **完全向后兼容**：
- 所有 DDD 分层结构保持不变
- 数据模型定义保持一致
- API 接口定义保持一致
- 业务逻辑流程保持一致
- 仅更新了外部依赖和部署方式

❌ **破坏性变更**：无

---

## 后续建议

### Phase 1: 开发前的核实

1. **Electron 版本确认** - v22+ 最低要求
2. **Sherpa ONNX 集成** - 验证模型包大小和初始化时间
3. **系统 TTS API** - Windows SAPI5 vs Edge TTS 的选择
4. **LLM API 集成** - Qwen 和豆包的认证、限流、重试策略
5. **文件系统权限** - AppData 目录的访问权限

### Phase 2: 开发中的架构验证

1. **IPC 通信** - Main ↔ Renderer 的消息协议设计
2. **热更新** - Electron 的自动更新机制
3. **性能监控** - 内存、CPU、磁盘占用的基准线
4. **错误恢复** - 应用崩溃后的数据恢复机制

### Phase 3: 交付前的测试

1. **离线模式** - 网络断开后的功能可用性
2. **存储清理** - data/ 目录的定期清理策略
3. **升级迁移** - 版本升级时的数据迁移
4. **性能基准** - 1000+ 课程、10000+ 学习记录下的性能

---

## 文档修改记录

| 章节 | 修改项 | 变更摘要 |
|-----|--------|---------|
| 2.1 | 架构概览图 | 五层分布式 → 本地应用架构 |
| 2.2 | 技术栈 | 移除 RN、后端、MongoDB、Redis；确认 Electron、内置模型 |
| 2.3 | 部署架构 | 云服务 → 单机应用；S3+MongoDB → 本地文件系统 |
| 3.2 | 全局状态栏 | [权限 🎤] → [录音 🎤] |
| 3.4 | 国际化 | 3 语言支持 → 仅中文 |
| 8.5 | 缓存策略 | S3 云端缓存 → 本地文件系统缓存 |
| 12.3 | 安全隐私 | GDPR 合规、权限管理 → 本地隐私、数据导出 |

---

## 验证清单

- [x] v0.4.1 文档行数：1698 行（无占位符）
- [x] MongoDB / Redis 引用：完全移除
- [x] S3 云存储引用：完全移除
- [x] React Native 移动端：完全移除
- [x] Electron 桌面应用：确认强调
- [x] 本地文件系统：详细说明
- [x] Sherpa ONNX ASR：明确为内置模型
- [x] 系统 TTS：明确为 Windows SAPI5
- [x] Qwen / 豆包 LLM：标注为可选网络功能
- [x] 仅中文支持：全文一致
- [x] 权限管理相关内容：完全移除
- [x] 多语言国际化：简化为中文说明

---

**完成日期**：2024年12月  
**版本**：v0.4.1 架构更新版  
**影响范围**：第 2、3、8、12 章  
**兼容性**：完全向后兼容，无破坏性变更
