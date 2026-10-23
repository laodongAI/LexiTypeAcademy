# Phase 11 补充设计文档

> 本文档整合了 AI Lab 系统的补充设计、实现指南和迁移总结。
> 
> **版本**: 1.0  
> **日期**: 2024-01  
> **状态**: ✅ 已完成实现

---

## 目录

1. [系统架构概述](#1-系统架构概述)
2. [5 个核心补充服务](#2-5-个核心补充服务)
3. [实现路线图](#3-实现路线图)
4. [技术决策](#4-技术决策)
5. [数据库 Schema](#5-数据库-schema)
6. [功能完整性对比](#6-功能完整性对比)
7. [集成检查清单](#7-集成检查清单)
8. [故障排除指南](#8-故障排除指南)

---

## 1. 系统架构概述

### 1.1 老系统与新系统映射

| 老系统文件 | 新系统对应 | 核心功能 |
|-----------|-----------|---------|
| `aiService.ts` | `AIConfigService` + `PromptTemplateService` | AI 提供商管理 + Prompt 模板 |
| `CourseSystemBuilder.tsx` | `CourseGeneratorService` + `AILabTaskCenter` | 课程生成 + 任务管理 |
| `courseSystemStore.ts` | `CourseRepository` | 课程持久化 |
| `languageAbilityUtils.ts` | `RecommendationService` | 能力推荐 |
| `audioInputHandler.ts` | `PublisherQueryService` | 教材/音频导入 |

### 1.2 架构演进

```
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 10C 已完成                              │
├─────────────────────────────────────────────────────────────────┤
│  ✅ RecommendationService (推荐服务)                             │
│  ✅ CourseGeneratorService (课程生成)                            │
│  ✅ PublisherQueryService (教材查询)                             │
│  ✅ WritingFeedbackService (写作反馈)                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    Phase 11 补充设计                             │
├─────────────────────────────────────────────────────────────────┤
│  ✅ AIConfigService (AI 配置管理)                                │
│  ✅ AILabTaskCenter (任务中心)                                   │
│  ✅ PromptTemplateService (Prompt 模板)                          │
│  ✅ CacheManager (缓存管理)                                      │
│  ✅ CourseDeduplicationService (课程去重)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 5 个核心补充服务

### 2.1 AIConfigService (AI 配置服务)

**职责**: 多提供商 AI 配置管理、API 密钥加密、连接测试

**支持的提供商**:
- OpenAI
- VolcEngine (火山引擎)
- DeepSeek
- Qwen (通义千问)
- Ollama (本地部署)
- Custom (自定义端点)

**核心功能**:
```typescript
interface AIConfigService {
  // 保存配置 (API 密钥自动加密)
  saveConfig(config: AIConfig): Promise<void>;
  
  // 加载配置 (自动解密)
  loadConfig(): Promise<AIConfig | null>;
  
  // 测试连接
  testConnection(config: AIConfig): Promise<{
    success: boolean;
    latency?: number;
    errorMessage?: string;
  }>;
  
  // 配置版本管理
  getConfigHistory(): Promise<AIConfigHistory[]>;
  rollbackConfig(version: number): Promise<void>;
}
```

**安全特性**:
- AES-256-GCM 加密存储 API 密钥
- Electron 环境优先使用 OS 密钥链 (keytar)
- 配置变更审计日志

### 2.2 AILabTaskCenter (任务中心)

**职责**: 任务队列、优先级管理、并发控制、断点恢复

**任务类型**:
- `COURSE_GENERATION`: 课程生成
- `AUDIO_TO_COURSE`: 音频转课程
- `TEXTBOOK_IMPORT`: 教材导入
- `WRITING_ANALYSIS`: 写作分析

**优先级**: `critical` > `high` > `normal` > `low`

**核心功能**:
```typescript
interface AILabTaskCenter {
  // 创建任务
  createTask(
    userId: string,
    taskType: AILabTaskType,
    input: Record<string, any>,
    priority?: TaskPriority
  ): Promise<AILabTask>;
  
  // 任务控制
  pauseTask(taskId: string): Promise<void>;
  resumeTask(taskId: string): Promise<void>;  // 从断点恢复
  cancelTask(taskId: string): Promise<void>;
  
  // 状态查询
  getTaskStatus(taskId: string): AILabTask | undefined;
  getTasksByStatus(status: TaskStatus): AILabTask[];
}
```

**可靠性特性**:
- 优先级堆排序
- 最大并发控制 (默认 5)
- 指数退避重试 (最多 3 次)
- 任务断点 (checkpoint) 支持

### 2.3 PromptTemplateService (Prompt 模板服务)

**职责**: 模板库管理、模板渲染、变量验证

**模板分类**:
- `course-generation`: 课程生成
- `translation`: 翻译
- `writing-analysis`: 写作分析
- `vocabulary`: 词汇

**核心功能**:
```typescript
interface PromptTemplateService {
  // 模板管理
  getTemplate(id: string): PromptTemplate | null;
  getAllTemplates(): PromptTemplate[];
  saveTemplate(template: PromptTemplate): Promise<void>;
  
  // 模板渲染 (Handlebars 风格)
  renderTemplate(templateId: string, variables: Record<string, any>): string;
  
  // 变量验证
  validateVariables(
    templateId: string,
    variables: Record<string, any>
  ): { valid: boolean; errors: string[] };
  
  // 模板测试
  testTemplate(templateId: string): Promise<{
    success: boolean;
    output: string;
    error?: string;
  }>;
}
```

**预设模板**:
- 课程生成默认模板
- 翻译模板
- 写作分析模板
- 词汇抽取模板

### 2.4 CacheManager (缓存管理器)

**职责**: 分层缓存、TTL 管理、自动过期清理

**缓存策略**:
| 数据类型 | TTL |
|---------|-----|
| 出版社数据 | 30 天 |
| 教材数据 | 7 天 |
| 单元数据 | 1 天 |
| 推荐结果 | 12 小时 |
| 生成的课程 | 永久 |
| TTS 音频 | 30 天 |

**核心功能**:
```typescript
interface CacheManager {
  set(key: string, value: any, ttl: number): void;
  get<T>(key: string): T | null;
  delete(key: string): void;
  clearExpired(): void;
  clear(): void;
  getStats(): CacheStats;
}
```

**实现特性**:
- 内存 + localStorage 双层缓存
- LRU 淘汰策略
- 自动过期清理
- 缓存命中率统计

### 2.5 CourseDeduplicationService (课程去重服务)

**职责**: 课程相似度计算、重复检测、课程合并

**相似度算法**:
- 标题匹配: 30% 权重
- 标签重叠 (Jaccard): 40% 权重
- 难度匹配: 30% 权重
- 阈值: > 0.8 判定为重复

**核心功能**:
```typescript
interface CourseDeduplicationService {
  // 检查重复
  checkDuplicate(
    course: Course,
    existingCourses: Course[]
  ): Promise<{
    isDuplicate: boolean;
    similarCourseId?: string;
    similarity: number;
  }>;
  
  // 合并课程
  mergeCourses(source: Course, target: Course): Course;
  
  // 批量去重
  deduplicateBatch(courses: Course[]): Course[];
}
```

---

## 3. 实现路线图

### 3.1 Phase 11: 后端服务 (已完成 ✅)

| 周次 | 任务 | 代码行数 | 状态 |
|-----|------|---------|------|
| Week 1-2 | AIConfigService + 加密管理 | 450 行 | ✅ |
| Week 2-3 | AILabTaskCenter | 700 行 | ✅ |
| Week 3-4 | PromptTemplateService | 520 行 | ✅ |
| Week 4-5 | CacheManager + CourseDeduplicationService | 540 行 | ✅ |
| Week 5-6 | DI 容器更新 + 集成测试 | 530 行 | ✅ |

**总产出**: 2,740 行核心代码 + 测试

### 3.2 Phase 12: UI 集成 (进行中 🔄)

| 周次 | 任务 | 代码行数 | 状态 |
|-----|------|---------|------|
| Week 1-2 | 课程编辑器 | 1,150 行 | ⏳ |
| Week 2-3 | 教材导入向导 | 1,500 行 | ⏳ |
| Week 3-4 | 设置面板 (AI 配置 + Prompt) | 2,350 行 | ✅ |
| Week 4-5 | 任务中心 UI | 1,200 行 | ✅ |
| Week 5-6 | 集成与优化 | 400 行 | ⏳ |

**预期总产出**: 6,600 行 React 代码

---

## 4. 技术决策

### 4.1 API 密钥加密方案

| 环境 | 方案 | 备注 |
|-----|------|-----|
| 浏览器 | Web Crypto API (crypto.subtle) | AES-256-GCM |
| Electron | keytar (OS 密钥链) | 优先使用 |
| 降级 | Base64 编码 | 仅开发环境 |

### 4.2 任务队列算法

- **数据结构**: 小根堆 (Min-Heap)
- **并发数**: 可配置，默认 5
- **重试策略**: 指数退避 (2^n 秒)
- **最大重试**: 3 次
- **超时控制**: 任务级别可配，默认 30 分钟

### 4.3 Prompt 模板语法

- **风格**: Handlebars (`{{variable}}`)
- **实现**: 基于正则替换
- **验证**: 类型检查 + 必需字段验证
- **版本**: 支持版本号

### 4.4 缓存策略

```
L1: 出版社数据 (30 天, 长期稳定)
L2: 教材数据 (7 天, 定期更新)
L3: 单元数据 (1 天, 高频变化)
L4: 推荐结果 (12 小时, 个性化)
```

### 4.5 相似度计算

- **标题**: 精确匹配 (0.3 权重)
- **标签**: Jaccard 相似度 (0.4 权重)
- **难度**: 精确匹配 (0.3 权重)
- **阈值**: > 0.8 判定为重复

---

## 5. 数据库 Schema

### 5.1 新增表

```typescript
// Dexie Schema v2
db.version(2).stores({
  // 现有表...
  
  // ✨ 新增表
  ai_configs: '&id, provider, createdAt',
  prompt_templates: '&id, category, version',
  ai_config_history: '++id, configId, timestamp',
  cache_entries: '&key, expiresAt'
});
```

### 5.2 表结构

**ai_configs**:
- `id` (primary)
- `provider`
- `apiKey` (加密)
- `endpoint`
- `model`
- `version`
- `lastTestedAt`
- `createdAt`

**prompt_templates**:
- `id` (primary)
- `name`
- `category`
- `version`
- `template`
- `variables` (JSON)
- `success_rate`
- `createdBy`
- `createdAt`

**tasks** (更新):
- 添加字段: `checkpoint` (JSON)
- 添加字段: `error` (JSON)
- 添加索引: `(userId, status)`

---

## 6. 功能完整性对比

### 6.1 AI 配置与连接

| 功能 | 老系统 | 新设计 |
|-----|--------|--------|
| 多提供商支持 | ✅ | ✅ |
| API 密钥加密 | ❌ | ✅ |
| 连接测试 | ✅ | ✅ |
| 性能监控 | ❌ | ✅ |
| 配置版本管理 | ❌ | ✅ |
| 配置审计日志 | ❌ | ✅ |

### 6.2 任务管理

| 功能 | 老系统 | 新设计 |
|-----|--------|--------|
| 任务队列 | ❌ | ✅ |
| 优先级管理 | ❌ | ✅ |
| 并发控制 | ❌ | ✅ |
| 断点恢复 | ❌ | ✅ |
| 错误重试 | ✅ | ✅ |
| 指数退避 | ❌ | ✅ |

### 6.3 Prompt 管理

| 功能 | 老系统 | 新设计 |
|-----|--------|--------|
| 自定义模板 | ✅ | ✅ |
| 模板预设库 | ❌ | ✅ |
| 模板版本管理 | ❌ | ✅ |
| 模板验证 | ❌ | ✅ |
| 模板测试 | ❌ | ✅ |

---

## 7. 集成检查清单

### 7.1 Phase 11 完成检查 ✅

- [x] AIConfigService 完整实现
- [x] 加密管理模块
- [x] AILabTaskCenter 实现
- [x] PromptTemplateService 与预设
- [x] CacheManager
- [x] CourseDeduplicationService
- [x] DI 容器更新
- [x] 编译验证 (97 modules, 0 errors)

### 7.2 Phase 12 检查清单 (进行中)

- [x] AIConfigPanel.tsx
- [x] AIPromptsPanel.tsx
- [x] TaskHistoryPage.tsx 集成
- [x] SettingsPage.tsx 更新
- [ ] CourseGeneratorPage.tsx 集成
- [ ] PublisherImportPage.tsx 集成
- [ ] FreeWritingPage.tsx 集成
- [ ] WeakVocabularyReviewPage.tsx 集成

---

## 8. 故障排除指南

### 8.1 API 密钥加密后无法解密

**症状**: 保存配置后加载时出错，提示 "Decryption failed"

**原因**:
- 浏览器关闭后 crypto.subtle 不可用
- 密钥过期或格式不匹配

**解决**:
- 使用 Electron 中的 keytar 替代 Web Crypto
- 实现降级方案 (base64 编码作为备选)
- 添加迁移脚本支持旧格式

### 8.2 任务中心任务卡住

**症状**: 任务状态为 IN_PROGRESS 但没有执行

**原因**:
- maxConcurrentTasks 设置过小
- 任务执行函数抛出异常但未被捕获

**解决**:
- 增加 maxConcurrentTasks 默认值到 5
- 在 executeTask 中添加 try-catch
- 实现任务超时自动取消 (30 分钟)

### 8.3 缓存数据过期但未自动清理

**症状**: 存储占用持续增长

**原因**:
- clearExpired() 未定期调用
- TTL 计算错误

**解决**:
- 启动时调用 clearExpired()
- 定时任务每 1 小时清理一次
- 缓存满时触发 LRU 清理

### 8.4 课程去重误判

**症状**: 相似度算法过于宽松，合并了不同的课程

**解决**:
- 提高阈值到 0.9
- 添加标题精确匹配的强制检查
- 支持用户手动确认合并

### 8.5 Prompt 模板渲染出错

**症状**: 生成的 prompt 包含 `{{variable}}` 字符串

**解决**:
- 增强正则: `/{{\\s*varName\\s*}}/`
- 在渲染前验证所有变量
- 生成调试日志显示最终 prompt

---

## 附录：成功指标

### 技术指标

- ✅ 编译: `npm run build` < 5s, 0 errors, 97 modules
- ✅ 类型安全: 0 TypeScript 错误
- ✅ 性能:
  - 教材数据加载: < 2s
  - 课程生成: 1-5 分钟
  - 去重检查: < 100ms
  - 缓存命中率: > 80%

### 质量指标

- ✅ 遵循 TypeScript 最佳实践
- ✅ 中文注释清晰易懂
- ✅ 模块耦合度低 (SOLID 原则)
- ✅ API 密钥不会在日志中泄露

---

*文档结束*
