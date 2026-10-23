# LexiType Academy 迁移审计报告
## Migration Audit Report - v1.0

**审计日期**: 2024-01-xx
**旧框架**: React + TypeScript (src_bak/)
**新框架**: Vue 3.5 + TypeScript (vue-app/)

---

## 📋 执行概要 Executive Summary

本报告对 LexiType Academy 从 React 迁移到 Vue 3 的完整性进行了全面审计，包括：
1. ✅ **配置功能对比** - 检查老代码的所有配置功能
2. ⏳ **页面迁移验证** - 确认所有页面是否完整迁移
3. ⏳ **产品设计评审** - 作为产品经理检查功能和交互

---

## 🔍 Part 1: 配置功能审计 (Configuration Feature Audit)

### 1.1 旧框架配置功能清单 (Old Framework - SettingsPanel.tsx)

**文件**: `src_bak/components/SettingsPanel.tsx` (1094 行)

#### 七大配置模块:

##### 1️⃣ **General Settings (通用设置)** ✅ 已迁移
- ✅ Language selection (语言选择: 中文/English)
- ✅ Font size adjustment (字体大小: 14-22px)
- ✅ Theme toggle (主题切换: light/dark)
- **迁移状态**: 100% - 在 SettingsPage.vue 的 "appearance" 标签页

##### 2️⃣ **TTS Settings (语音合成设置)** ⚠️ 部分迁移
**已实现**:
- ✅ Provider selection (提供者选择)
  - System TTS (浏览器内置)
  - Sherpa ONNX (本地模型)
- ✅ System voice selection (系统语音选择)
- ✅ Speed control (语速控制)
- ✅ Volume control (音量控制)

**缺失功能**:
- ❌ Sherpa ONNX speaker selection (多说话人选择)
  - 老框架支持多说话人模型 (numSpeakers > 1)
  - Speaker ID 选择和预览
- ❌ Model path display (模型路径显示)
- ❌ Provider switching feedback (提供者切换反馈)
- ❌ Advanced debugging info (调试信息)

**迁移状态**: 70% - 基础功能完成，高级特性缺失

##### 3️⃣ **ASR Settings (语音识别设置)** ⚠️ 严重不完整
**已实现**:
- ✅ Basic provider selection (基础提供者选择)
  - HTTP API
  - Browser built-in
  - Sherpa ONNX
- ✅ HTTP endpoint config (HTTP 端点配置)
- ✅ Language selection (语言选择)
- ✅ Test button (测试按钮 - 功能未实现)

**缺失功能** (老框架完整实现):
- ❌ **Model type selection** (模型类型选择)
  - sherpa-vad (带 VAD 的模型)
  - sherpa (纯识别模型)
  - http-backend (HTTP 后端)
- ❌ **Preset model selection** (预设模型选择)
  - 老框架提供 6+ 预设模型
  - zh-CN: sherpa-paraformer-zh, streaming-zipformer-zh
  - en-US: streaming-zipformer-en, paraformer-en
  - 支持自定义模型路径
- ❌ **VAD Configuration** (语音活动检测配置)
  - VAD model path (VAD 模型路径)
  - Enable/disable VAD segments
  - Output timestamps
- ❌ **Custom entry script** (自定义入口脚本)
- ❌ **Model path display** (模型路径显示)
- ❌ **Real testing functionality** (真实测试功能)
  - 老框架有完整的录音测试 UI
  - 实时识别结果显示

**迁移状态**: 35% - 仅有基础 UI 框架，核心功能缺失

##### 4️⃣ **AI Configuration (AI 配置)** ❌ 完全缺失
老框架实现 (代码行 450-600):
```tsx
// AI Provider Presets (6个预设提供商)
const PROVIDER_PRESETS = {
  volcengine: {
    name: '豆包 (Volcengine Doubao)',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3',
    model: 'doubao-pro-128k'
  },
  openai: {
    name: 'OpenAI GPT',
    endpoint: 'https://api.openai.com/v1',
    model: 'gpt-4-turbo-preview'
  },
  deepseek: {
    name: 'DeepSeek',
    endpoint: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat'
  },
  qwen: {
    name: '通义千问 (Qwen)',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus'
  },
  ollama: {
    name: 'Ollama Local',
    endpoint: 'http://localhost:11434/v1',
    model: 'qwen2.5:latest'
  },
  custom: {
    name: 'Custom OpenAI-compatible',
    endpoint: '',
    model: ''
  }
};
```

**功能列表**:
- ❌ Provider dropdown (提供商下拉选择)
- ❌ API endpoint input (API 端点输入)
- ❌ API key secure input (API 密钥输入 - 带遮罩)
- ❌ Model name input (模型名称输入)
- ❌ Test connection button (测试连接按钮)
  - 实际发送请求验证连接
  - 显示成功/失败反馈
- ❌ Save configuration (保存配置)
  - 持久化到 localStorage
  - 自动应用到 AI service

**影响**:
- 用户无法在 UI 中配置 AI 服务
- 目前只能通过浏览器控制台配置
- AILab 页面显示配置警告，但无配置入口

**迁移状态**: 0% - **此功能完全缺失**

##### 5️⃣ **AI Prompt Customization (AI 提示词自定义)** ❌ 完全缺失
老框架实现 (代码行 700-850):
```tsx
// Plugin-specific prompt editing
const plugins = pluginRegistry.getAllAIPlugins();
// 插件列表:
// - vocabulary (词汇扩展)
// - courseGeneration (课程生成)
// - translation (翻译)
// - sentenceAnalysis (句子分析)
// - pronunciation (发音指导)
```

**功能列表**:
- ❌ Plugin selector dropdown (插件选择下拉框)
- ❌ Prompt template display (提示词模板显示)
  - 显示当前插件的默认模板
  - 显示可用的模板变量
- ❌ Custom prompt textarea (自定义提示词编辑区)
  - 多行文本编辑器
  - 语法高亮
  - 变量提示
- ❌ Reset to default button (重置为默认)
- ❌ Save custom prompt (保存自定义提示词)
- ❌ Preview section (预览部分)
  - 显示变量替换后的效果

**影响**:
- 用户无法定制 AI 行为
- 无法优化特定场景的提示词
- 降低了 AI Lab 的灵活性

**迁移状态**: 0% - **此功能完全缺失**

##### 6️⃣ **Storage Management (存储管理)** ❌ 完全缺失
老框架实现 (代码行 370-400, 900-1000):
```tsx
const [storageStats, setStorageStats] = useState({
  ttsCacheCount: 0,
  reviewLogCount: 0,
  courseCount: 0,
  totalSize: 0
});

// 功能: loadStorageStats()
// - 统计 TTS 缓存数量
// - 统计学习记录数量
// - 统计课程数量
// - 计算总占用空间 (通过 Electron API)

// 功能: handleClearCache(type)
// - 清除 TTS 缓存
// - 清除学习历史
// - 清除所有数据 (需二次确认)
```

**功能列表**:
- ❌ Storage statistics display (存储统计显示)
  - TTS cache count (TTS 缓存条数)
  - Review logs count (学习记录数)
  - Course count (课程数)
  - Total size (总占用空间 MB)
- ❌ Clear TTS cache button (清除 TTS 缓存按钮)
  - 清除 IndexedDB 中的 ttsCache 表
  - 清除文件系统缓存 (Electron)
- ❌ Clear history button (清除历史记录按钮)
  - 清除 reviewLogs 表
  - 清除 aiTaskLogs 表
  - 清除 achievements 表
- ❌ Clear all data button (清除所有数据按钮)
  - 确认对话框
  - 清除所有 IndexedDB 表
  - 清除 localStorage
  - 警告不可撤销

**影响**:
- 用户无法查看应用占用空间
- 无法清理缓存释放存储
- 可能导致存储空间问题

**迁移状态**: 0% - **此功能完全缺失**

##### 7️⃣ **Prompt Sound Settings (提示音设置)** ❌ 完全缺失
老框架实现 (代码行 1000-1050):
```tsx
// Prompt sound configuration
// - Enable/disable prompt sounds
// - Volume control for prompts
// - Sound selection (different tones)
```

**功能列表**:
- ❌ Enable prompt sounds (启用提示音)
- ❌ Prompt volume control (提示音音量)
- ❌ Sound type selection (提示音类型选择)
  - Success sound
  - Error sound
  - Notification sound

**迁移状态**: 0% - **此功能完全缺失**

---

### 1.2 新框架配置功能清单 (New Framework - SettingsPage.vue)

**文件**: `vue-app/src/renderer/views/SettingsPage.vue` (399 行)

#### 当前实现的标签页:

##### ✅ Appearance Tab (外观)
- ✅ Theme selection (主题选择: 蓝色/浅色/深色)
- ✅ Language selection (语言选择: 中文/English)
- ✅ Font size slider (字体大小: 14-22px) - **文档中有，代码未见**

##### ⚠️ TTS Tab (语音合成)
- ✅ Provider selection (提供者选择)
- ✅ HTTP endpoint (HTTP 端点)
- ✅ Voice selection (语音选择)
- ✅ Speed slider (语速: 0.5-2.0)
- ✅ Volume slider (音量: 0-1.0)
- ✅ Test button (测试按钮 - 功能 TODO)

##### ⚠️ ASR Tab (语音识别)
- ✅ Provider selection (提供者选择)
- ✅ HTTP endpoint (HTTP 端点)
- ✅ Language selection (语言选择)
- ✅ Test button (测试按钮 - 功能 TODO)

##### ✅ Typing Tab (打字练习)
- ✅ Show hint toggle (显示提示)
- ✅ Show pinyin toggle (显示拼音)
- ✅ Key sound toggle (按键音效)

##### ✅ Learning Tab (学习)
- ✅ Daily goal input (每日目标: 5-120 分钟)
- ✅ Auto play audio toggle (自动播放音频)
- ✅ Review reminder toggle (复习提醒)

##### ✅ About Tab (关于)
- ✅ App logo and info
- ✅ Version display
- ✅ Links (GitHub, 官网)
- ✅ Reset all settings button

---

### 1.3 缺失功能汇总 (Missing Features Summary)

| 配置模块 | 老框架 | 新框架 | 缺失率 | 严重程度 |
|---------|--------|--------|--------|----------|
| General Settings | 3 项 | 3 项 | 0% | ✅ Low |
| TTS Settings | 8 项 | 5 项 | 37.5% | ⚠️ Medium |
| ASR Settings | 12 项 | 4 项 | 66.7% | 🔴 Critical |
| AI Configuration | 6 项 | 0 项 | **100%** | 🔴 **Critical** |
| AI Prompt Customization | 5 项 | 0 项 | **100%** | 🔴 **Critical** |
| Storage Management | 8 项 | 0 项 | **100%** | 🔴 **Critical** |
| Prompt Sound Settings | 3 项 | 0 项 | **100%** | ⚠️ Medium |

**整体迁移率**: **32.6%** (15/46 项功能已迁移)

---

### 1.4 关键问题 (Critical Issues)

#### 🔴 问题 #1: AI 配置无 UI 入口
**现状**: 
- AI 服务层已完整实现 (Phase 9)
- AILab 页面功能完整，但显示"未配置"警告
- 用户必须通过浏览器控制台配置 API Key

**问题**:
```javascript
// 目前用户配置方式 (浏览器控制台)
await aiService.configure({
  provider: 'qwen',
  apiKey: 'sk-xxx',
  endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  model: 'qwen-plus'
});
```

**影响**:
- 极差的用户体验
- 普通用户无法使用 AI 功能
- 违背桌面应用的基本 UX 原则

**优先级**: 🔴 **P0 - 阻塞性问题**

#### 🔴 问题 #2: ASR 高级功能完全缺失
**现状**:
- 老框架支持 6+ 预设 Sherpa 模型
- 支持 VAD 配置和时间戳输出
- 有完整的测试 UI (录音-识别-显示结果)

**新框架**:
- 只有基础的提供者选择
- 无法选择具体模型
- 测试按钮无实现

**影响**:
- 语音识别功能大幅降级
- 无法使用高质量的 Sherpa 模型
- 开发者无法测试 ASR 功能

**优先级**: 🔴 **P0 - 功能降级**

#### 🔴 问题 #3: 存储管理缺失导致潜在问题
**现状**:
- TTS 缓存会无限增长
- 用户无法清理数据
- 无占用空间可视化

**影响**:
- 长期使用后可能占用大量空间
- 出现问题时用户无法自救
- 需要手动清除浏览器数据

**优先级**: 🔴 **P1 - 长期运维问题**

---

## ⏳ Part 2: 页面迁移验证 (Page Migration Verification)

### 2.1 页面对比清单

#### 新框架页面 (vue-app/src/renderer/views/)
发现 **14 个页面文件**:

1. ✅ **HomePage.vue** - 主页
2. ✅ **CoursesPage.vue** - 课程列表
3. ✅ **CourseDetailPage.vue** - 课程详情
4. ✅ **LessonPracticePage.vue** - 课程练习
5. ✅ **AILabPage.vue** - AI 实验室
6. ✅ **AIPage.vue** - AI 聊天 (?)
7. ✅ **TypingPage.vue** - 打字练习
8. ✅ **PinyinPage.vue** - 拼音练习
9. ✅ **ReviewPage.vue** - 复习页面
10. ✅ **HistoryPage.vue** - 学习历史
11. ✅ **GamesPage.vue** - 游戏中心
12. ✅ **SettingsPage.vue** - 设置页面
13. ✅ **MigrationPage.vue** - 数据迁移
14. ✅ **NotFoundPage.vue** - 404 页面

#### 老框架核心组件 (src_bak/)
需要进一步检查以下组件是否对应迁移:

**待验证**:
- `AILab.tsx` → `AILabPage.vue` ✅
- `CourseManager.tsx` → `CoursesPage.vue` ❓
- `CourseEditor.tsx` → ❓ (未见独立编辑页面)
- `AudioCourseWizard.tsx` → ❓ (可能在 AILab 中)
- `GameCenter.tsx` → `GamesPage.vue` ✅
- `HistoryCharts.tsx` → `HistoryPage.vue` ❓
- `StatisticsPanel.tsx` → ❓ (未见统计页面)
- `TaskDashboard.tsx` → ❓ (未见任务面板)

**下一步**: 需要详细对比每个页面的功能完整性

---

## ⏳ Part 3: 产品设计评审 (Product Design Review)

### 3.1 用户体验问题

#### 问题 1: 配置流程断裂
**场景**: 新用户首次使用 AI Lab
1. 用户点击 "AI Lab" 菜单
2. 看到 "AI 服务未配置" 警告
3. 点击 "如何配置" 看到：
   ```
   请在设置中配置 AI 服务:
   1. 打开设置页面
   2. 选择 AI 提供商
   3. 输入 API Key 和端点
   ```
4. 用户打开设置页面 → **找不到 AI 配置选项** 😱
5. 用户困惑，无法继续

**改进建议**:
- 在 SettingsPage 添加 AI Configuration 标签页
- 或在 AILab 页面内嵌配置表单
- 首次进入时显示引导流程

#### 问题 2: 测试按钮无响应
**场景**: 用户配置 TTS/ASR 后想测试
1. 在设置中配置 TTS endpoint
2. 点击 "测试 TTS" 按钮
3. 弹出 "TTS 测试成功" (假的，代码为 TODO)
4. 实际上没有发起任何请求
5. 用户以为配置成功，实际可能错误

**改进建议**:
- 实现真实的测试功能
- 显示详细的测试结果
- 错误时给出具体的修复建议

#### 问题 3: 存储空间不可见
**场景**: 应用使用一段时间后
1. TTS 缓存累积数百条
2. 占用数百 MB 空间
3. 用户不知道，也无法清理
4. 可能导致性能问题

**改进建议**:
- 添加存储管理页面
- 定期提醒用户清理
- 提供自动清理策略

---

## 📊 审计结论 (Audit Conclusions)

### 总体评分

| 维度 | 评分 | 说明 |
|------|------|------|
| 功能完整性 | ⚠️ **32.6%** | 配置功能缺失严重 |
| 页面迁移 | ⏳ **待验证** | 需进一步功能对比 |
| 用户体验 | 🔴 **差** | 配置流程断裂 |
| 代码质量 | ✅ **良好** | 已迁移部分质量高 |

### 关键发现

1. **🔴 阻塞性问题**: AI 配置无 UI，导致 AI Lab 不可用
2. **🔴 功能降级**: ASR 设置从完整降级到基础版
3. **🔴 长期隐患**: 无存储管理，可能累积问题
4. **⚠️ 产品体验**: 配置引导流程不完整

### 优先级建议

#### Phase 10A: 修复阻塞性问题 (1-2 天)
1. 实现 AI Configuration 标签页
   - 提供商选择
   - API Key 输入
   - 端点配置
   - 测试连接
2. 实现 TTS/ASR 测试功能
   - 真实 API 调用
   - 结果显示
   - 错误处理

#### Phase 10B: 补全核心功能 (2-3 天)
3. 完善 ASR 设置
   - 模型预设选择
   - VAD 配置
   - 测试 UI
4. 实现存储管理
   - 统计显示
   - 清理功能
5. 实现 AI Prompt 自定义
   - 插件选择
   - 提示词编辑

#### Phase 10C: 优化体验 (1-2 天)
6. 完善配置引导流程
7. 添加高级 TTS 功能
8. 实现提示音设置

---

## 📝 详细实现计划 (Implementation Checklist)

见下一部分...
