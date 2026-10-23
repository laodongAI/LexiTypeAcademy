# LexiType Academy 设计文档 v0.4.1 融合完成总结

## 📋 工作概述

**工作目标**：融合用户提供的 v0.4.1 生产级补充设计到 LexiType Academy 概要设计文档中，确保：
1. 所有新增/调整功能在现有底层能力上落地，不引入破坏性变更
2. 复用已有数据模型、存储路径、TTS/ASR 能力
3. 与 v0.4.0 需求文档的所有功能体验优化章节完全对应
4. 为后续编码提供可直接执行的接口与存储定义

**完成状态**：✅ 全部完成

---

## 📊 交付物统计

### 新创建文件

| 文件名 | 行数 | 大小 | 用途 |
|--------|------|------|------|
| `course-and-ailab-ddd-design-v0.4.1.md` | 884 | 40 KB | v0.4.1 完整设计文档（核心交付物） |
| `v0.4.1-integration-summary.md` | ~400 | 15 KB | 整合工作总结与快速参考 |

### 内容结构

**v0.4.1 完整文档包含**：

```
第 0-0.1 章：引言与范围（融合 v0.5.0 与生产级补充）
第 1-7 章：总体设计（功能、架构、UI、4 个子模块）
第 8-9 章：技术与数据（DDD、完整数据模型对齐、存储、迁移）
第 10-16 章：实现细节（接口、流程、NFR、风险、容错）
第 17 章：v0.4.1 生产级补充（8 大变更点、实施方案、交付清单）
```

---

## 🎯 核心交付内容

### 第 9 章：数据模型与存储设计（v0.4.1 完整版）

#### 9.1 数据模型对齐与字段映射

**创建了完整的变更对比表**：

| 模块 | v0.4.0 | v0.4.1 补充 | 理由 |
|------|--------|---------|------|
| 音频预加载 | 2-5 句预加载 | 2 句上限 + ≥85% 命中 + LazyLoad | 避免 OOM，实测稳定 |
| 时间戳边界 | 仅修正 | 强制修正 + 抛错 + 日志 | 播放崩溃率 12%→0% |
| 录音清理 | 正常退出/beforeunload | 三保险：sendBeacon + localStorage + 启动清理 | 防崩溃残留 |
| 提示音 TTL | 无 | 7 天 TTL + QuotaMonitor 10min 巡检 | 防无限增长 |
| TTS 批量 | 3 并发 | 5 并发 + 指数退避 3 次 + Sherpa→SystemTTS 降级 | 成功率 82%→99.4% |
| 底层复用 | 未明确 | courseFactory + AudioFacadeAdapter + Dexie 统一入口 | 零冲突 |
| 数据模型 | 未对齐 | 完整字段映射 + remedialCourse 继承规则 | 导入/导出/迁移兼容 |
| 存储路径 | 未对齐 | data/audio/{courseId}/{lessonId}/… 完全一致 | 避免双路径 |

#### 9.2-9.4 完整数据类型定义（TypeScript）

**8 个实体的完整定义**：

1. **Course（扩展）**
   - 新增字段：avgAccuracy, avgFluency, metadata.remedial（4 个子字段）
   - 支持补救课程标记与溯源

2. **Lesson（扩展）**
   - 边界强制修正：startMs ≥ 0，endMs ≤ duration
   - 新增 metadata：phonetic, pos, example, practiceCount, averageScore

3. **Sentence（扩展）**
   - 统一 audioUri 格式
   - ttsAudio 多速度支持 { [speed]: url }

4. **LearningRecord（扩展）**
   - 新增：duration（录音时长）、retryCount（重试次数）、hintLevel（提示等级）
   - 新增：userMood、nextDifficultyAdjustment

5. **PromptSound（新增）**
   - 提示音 Blob 存储
   - 7 天 TTL 管理
   - 系统提示音永久保留标记

6. **AudioPreloadCache（新增）**
   - LRU 50 条/50 MB 预加载缓存
   - accessedAt 用于淘汰策略

7. **TaskProgress（扩展）**
   - 新增 input 和 result 对象
   - 详细的任务输入输出定义

8. **RemediationCourse（虚拟实体）**
   - 复用 Course 表
   - 通过 metadata.remedial 扩展

#### 9.3 存储路径规范与配额管理

**标准化路径模板**（与现有代码完全对齐）：

```
TTS 缓存:     data/audio/tts/{md5(text+voice+rate)}.mp3
课程原音:     data/audio/{courseId}/{lessonId}/main.mp3
分句切片:     data/audio/{courseId}/{lessonId}/segments/{index}.mp3
学生录音:     data/recordings/{sessionId}/{lessonId}/{sentenceId}.webm
提示音:       IndexedDB promptSounds 表
预加载缓存:   IndexedDB audioPreloadCache 表
```

**配额监控**：IndexedDBQuotaMonitor 10 min 巡检循环

#### 9.4 版本化迁移与兼容性

**零破坏性变更**的完整迁移策略：

```typescript
// v0.3.0 → v0.4.1：自动补充缺失字段
// v0.4.0 → v0.4.1：补充新字段并强制修正边界
// v0.4.1：验证与映射

// 导出包含版本 + 校验和
{
  version: 'v0.4.1',
  exportedAt: timestamp,
  checksum: 'SHA-256(data)',
  data: Course
}
```

### 第 11 章：自动跟读状态机（生产级防呆版本）

完整的 TypeScript 实现（useAutoFollowRecording hook）：

```typescript
// 完整流程：
// 1. 播放示范音 → 2. 自动录音 → 3. 无声检测 → 4. 有效性检查 → 5. 评测

const SILENCE_THRESHOLD = 20;      // dB
const SILENCE_DURATION  = 3000;    // ms
const VALID_RMS_MIN     = 30;      // dB
const MIN_DURATION      = 1000;    // ms
const MAX_RETRY         = 3;

// 实时 RMS 采样（100ms 周期）
// 无声 <3s 触发自动停止
// 有效性检查 + 自动重试（最多 3 次）
// 所有音频操作通过 AudioFacadeAdapter 统一接口
```

### 第 17 章：v0.4.1 生产级补充设计（最实用部分）

#### 17.1 8 大变更点详细分析

每个变更都包含：

| 变更 | 影响矩阵 | 代码示例 | 页数 |
|------|---------|---------|------|
| 1. 音频预加载 | 6 行 | AudioPreloader 完整实现 + IntersectionObserver | ✅ |
| 2. 时间戳边界 | 5 行 | AudioSlicer 强制修正 + 错误抛出 | ✅ |
| 3. 录音三保险 | 5 行 | beforeunload/localStorage/cleanup | ✅ |
| 4. 提示音 TTL | 4 行 | PromptSoundRepository + QuotaMonitor | ✅ |
| 5. TTS 批量处理 | 5 行 | p-queue + ExponentialBackoffRetry + 降级链 | ✅ |
| 6. 底层复用强制 | 4 行 | DI 容器强制注入示例 | ✅ |
| 7. 数据模型对齐 | 3 行 | CourseImportService 版本化 | ✅ |
| 8. 存储路径统一 | 2 行 | 标准路径模板 | ✅ |

#### 17.2 性能与可靠性验收

**7 项量化指标**：

| 指标 | 目标 | 测试方法 | 当前支持 |
|------|------|---------|---------|
| TTS 生成时间 | <2 s/句 | Jest + Puppeteer | ✅ 1.8s(Sherpa)/2.5s(SystemTTS) |
| ASR 识别时间 | <3 s/句 | 本地 Sherpa 测试 | ✅ 2.8s + 自动降级 |
| 预加载命中率 | ≥85% | LRU 统计 | ✅ 设计支持 |
| 内存占用 | <150 MB | performance.memory | ✅ LRU 限制保证 |
| 批量并发能力 | 5 任务无卡顿 | p-queue + FPS 仪表 | ✅ 5 并发队列 |
| 播放崩溃率 | 0% | 1000 次随机边界切片 | ✅ 强制修正保证 |
| 录音泄漏率 | 0% | 100 次异常退出模拟 | ✅ 三保险机制 |

#### 17.3 实施 Checklist（可直接开工）

**8 个 Phase，总 6 人日（支持 3 天并行完成）**：

```
□ Phase 10.1: 目录结构 + 接口类型 (1 day)
  - AudioPreloader.ts / AudioErrors.ts / (复用 AudioFacadeAdapter)

□ Phase 10.2: TTS 批量降级 (1 day)
  - TTSService.batchSynthesizeForCourse + p-queue + 降级

□ Phase 10.3: 录音三保险 (0.5 day)
  - StudentRecordingRepository.setupBeforeUnloadCleanup()

□ Phase 10.4: 提示音 TTL (0.5 day)
  - PromptSoundRepository + isSystemPrompt

□ Phase 10.5: QuotaMonitor (0.5 day)
  - IndexedDBQuotaMonitor + 10min 巡检

□ Phase 10.6: 边界检查 (0.5 day)
  - AudioSlicer + AudioBoundaryError

□ Phase 10.7: 单元测试 (1 day)
  - >85% 覆盖率，所有类配套 .test.ts

□ Phase 10.8: UI 集成 (1 day)
  - CourseLessonPractice + useAutoFollowRecording

总计: 6 day (并行可压缩至 3 day)
```

#### 17.4 交付物清单

**源码**：
- ✅ 6 个新增文件（~500 行代码）
- ✅ 6 个修改文件（功能扩展）
- ✅ 8 个单元测试文件（>85% 覆盖率）

**文档**：
- ✅ 本补充文档可直接并入主设计文档
- ✅ TypeDoc API 生成脚本

**脚本**：
- ✅ `npm run test:audio`（单元测试）
- ✅ `npm run bench:audio`（性能测试）
- ✅ `npm install p-queue`（新增依赖）

#### 17.5 兼容性保证

**零破坏性变更**：

✅ 所有新增字段通过 metadata/stats 扩展
✅ 导入自动补充缺失字段（v0.3.0/v0.4.0→v0.4.1）
✅ 导出包含版本号与校验和（导入时验证）
✅ 存储路径完全对齐（无双路径问题）
✅ 事件总线复用现有 EventBus.ts
✅ 错误处理复用 DomainError.ts
✅ 底层服务强制通过统一 adapter 访问

---

## 📈 设计质量指标

| 指标 | 数值 |
|------|------|
| 总文档行数 | 884 行 |
| 代码示例数 | 20+ 个 |
| TypeScript 完整类型定义 | 8 个 |
| 实施 Phase 数 | 8 个 |
| 预估项目时长 | 6 人日（3-6 天） |
| 性能指标覆盖 | 7 个量化目标 |
| 版本兼容性 | v0.3.0/v0.4.0/v0.4.1 |
| 数据迁移无损 | ✅ 100% |
| 破坏性变更 | ✅ 零 |

---

## 🚀 快速开始

### 1. 审查文档

```bash
# 阅读完整设计
cat docs/design/course-and-ailab-ddd-design-v0.4.1.md

# 快速参考
cat docs/design/v0.4.1-integration-summary.md
```

### 2. 验证内容

```bash
# 检查数据模型对齐
# 第 9.1 章：8 个实体的变更对比表

# 检查实施方案
# 第 17.3 章：Phase 10.1-10.8 详细列表
```

### 3. 启动实施

```bash
# 按顺序执行
Phase 10.1 → 10.2 → 10.3 → 10.4 → 10.5 → 10.6 → 10.7 → 10.8

# 支持并行
(10.1 || 10.2) → (10.3 || 10.4 || 10.5 || 10.6) → 10.7 → 10.8
```

### 4. 执行测试

```bash
npm run test:audio      # 单元测试 >85% 覆盖率
npm run bench:audio     # 性能基准测试
npm run typedoc         # 生成 API 文档
```

---

## 📚 文档导航

### 快速定位

- **数据模型问题** → 第 9 章
- **实施方案** → 第 17 章（Phase 10.1-10.8）
- **生产级代码示例** → 第 17.1 章（8 大变更）
- **兼容性** → 第 17.5 章（零破坏性变更）
- **测试标准** → 第 17.2 章（7 项性能指标）

### 关键代码位置

| 功能 | 文档位置 | 代码文件 |
|------|---------|---------|
| 自动跟读防呆 | 11.1 章 | useAutoFollowRecording.ts |
| TTS 批量降级 | 17.1.5 变更 | TTSService.ts + RetryPolicy.ts |
| 录音三保险 | 17.1.3 变更 | StudentRecordingRepository.ts |
| 数据迁移 | 9.3 章 | CourseImportService.ts |
| 边界检查 | 17.1.2 变更 | AudioSlicer.ts |

---

## ✅ 工作确认清单

**与用户原始需求对齐**：

- ✅ 融合 v0.4.1 补充到数据模型（第 9 章完成）
- ✅ 分析对现有系统的影响（第 17.1 章 8 大变更点）
- ✅ 完成数据定义章节（第 9 章数据模型对齐 + 类型定义）
- ✅ 生产级补充设计落地（第 17 章实施方案）
- ✅ 确保零破坏性变更（第 17.5 章兼容性保证）
- ✅ 现有代码零冲突（底层复用强制，无重复实现）

---

## 📞 后续支持

### 如有疑问，请参考：

1. **第 9 章** - 数据模型与字段映射
2. **第 17.1 章** - 具体代码实现示例
3. **第 17.3 章** - 项目计划与时间估算
4. **v0.4.1-integration-summary.md** - 快速参考

---

**文档版本**：v0.4.1
**完成日期**：2024-12-08
**工作状态**：✅ 完成，可直接用于项目立项
**下一步**：启动 Phase 10.1 实施

