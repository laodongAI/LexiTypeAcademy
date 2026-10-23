# LexiType Academy - Vue 3 版本

**键语学苑** - 英语词汇学习与打字练习应用

![Version](https://img.shields.io/badge/version-0.2.0-blue.svg)
![Vue](https://img.shields.io/badge/Vue-3.5.0-green.svg)
![Electron](https://img.shields.io/badge/Electron-33.3.0-47848F.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7.0-blue.svg)

---

## 📋 项目简介

LexiType Academy 是一款基于 **Vue 3 + Electron + TypeScript** 构建的现代化英语学习应用，集成了打字练习、词汇学习、课程管理、AI 辅助学习等功能。

### 核心特性

- 🎯 **智能打字练习** - 多种练习模式（听写、跟读、模仿）
- 📚 **课程系统** - 完整的课程创建、管理和学习流程
- 🤖 **AI 辅助学习** - 基于通义千问的智能课程生成和词汇增强
- 🎤 **语音功能** - TTS 文本转语音、ASR 语音识别与评分
- 📊 **学习统计** - 详细的学习进度和成绩追踪
- 🗄️ **本地数据库** - 基于 IndexedDB 的离线数据存储

---

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.0.0
- **npm**: >= 9.0.0
- **操作系统**: Windows 10/11、macOS 10.15+、Linux

### 安装依赖

```bash
cd vue-app
npm install
```

### 启动开发服务器

```bash
npm run dev
```

这将启动 Electron 应用，支持热重载。

### 构建应用

```bash
# 构建生产版本
npm run build

# 打包应用
npm run package

# 制作安装包
npm run make
```

---

## 🏗️ 项目结构

```
vue-app/
├── src/
│   ├── main/                    # Electron 主进程
│   │   └── index.ts            # 主进程入口
│   ├── preload/                 # 预加载脚本
│   │   └── index.ts
│   ├── renderer/                # 渲染进程（Vue 应用）
│   │   ├── App.vue             # 根组件
│   │   ├── main.ts             # 渲染进程入口
│   │   ├── router/             # 路由配置
│   │   ├── views/              # 页面组件
│   │   ├── components/         # 可复用组件
│   │   └── stores/             # Pinia 状态管理
│   ├── shared/                  # 共享代码
│   │   ├── services/           # 业务服务
│   │   │   ├── ai/             # AI 服务层 ⭐ 新增
│   │   │   ├── ttsApiService.ts    # TTS 服务
│   │   │   ├── asrApiService.ts    # ASR 服务
│   │   │   └── ...
│   │   ├── database/           # 数据库层
│   │   └── types/              # 类型定义
│   ├── domain/                  # 领域模型
│   ├── application/             # 应用层
│   └── infrastructure/          # 基础设施
├── public/                      # 静态资源
├── forge.config.ts             # Electron Forge 配置
├── vite.config.ts              # Vite 配置
└── package.json

AI 服务结构:
src/shared/services/ai/
├── index.ts                    # 导出入口
├── aiTypes.ts                  # 类型定义（~300 行）
├── aiConfig.ts                 # 配置管理（~150 行）
├── aiService.ts                # 核心服务（~380 行）
├── providers/                  # AI 提供商
│   ├── baseProvider.ts         # 基础类（~180 行）
│   ├── qwenProvider.ts         # 通义千问（~160 行）
│   └── index.ts
└── prompts/                    # 提示词模板
    ├── courseGeneration.ts     # 课程生成（~90 行）
    ├── vocabularyEnrich.ts     # 词汇增强（~100 行）
    └── translation.ts          # 翻译（~80 行）
```

---

## 🎯 核心功能模块

### 1. 课程管理系统
- 创建、编辑、删除课程
- 课时管理（添加/移除单词）
- 导入/导出课程数据
- 课程分类和标签

### 2. 打字练习模式
- **听写模式** - 听音频输入单词
- **跟读模式** - 录音并与标准发音对比
- **模仿模式** - 模仿标准发音，获得评分

### 3. AI 实验室 ⭐ 最新功能
- **AI 课程生成器** - 根据主题自动生成完整课程
- **音频导入向导** - 从音频提取词汇并生成课程
- **教材导入** - 从文本/PDF 提取词汇
- **写作助手** - AI 语法检查和优化
- **AI 对话练习** - 智能英语对话
- **词汇推荐** - 个性化单词推荐
- **发音评测** - AI 发音评分

### 4. 语音服务集成
- **TTS（文本转语音）** - 支持多种语音引擎
- **ASR（语音识别）** - 实时语音识别和评分
- **发音评估** - 5 维度评分（准确度、流利度、完整度、发音、韵律）

### 5. 学习统计
- 学习时长统计
- 打字速度和准确率
- 词汇掌握程度
- 学习进度追踪

---

## 🤖 AI 功能配置

### 获取 Qwen API Key

1. 访问 [阿里云百炼平台](https://dashscope.aliyuncs.com/)
2. 注册/登录账号
3. 进入"API-KEY 管理"
4. 创建新的 API Key
5. 复制 Key（格式：`sk-xxx`）

### 配置方式

**方式一：浏览器控制台配置**
```javascript
localStorage.setItem('lexitype_ai_config', JSON.stringify({
  provider: 'qwen',
  apiKey: 'sk-YOUR_API_KEY_HERE',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-plus'
}));
```

**方式二：代码配置**
```typescript
import { saveAIConfig } from './src/shared/services/ai';

saveAIConfig({
  provider: 'qwen',
  apiKey: 'sk-xxx',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-plus'
});
```

### 使用示例

```typescript
import { getAIService } from './src/shared/services/ai';

const aiService = getAIService();

// 生成课程
const course = await aiService.generateCourse({
  topic: '日常对话',
  level: 'beginner',
  lessonCount: 5,
  wordsPerLesson: 10
});

// 词汇增强
const enrichedWords = await aiService.enrichVocabulary({
  words: ['hello', 'goodbye', 'thank', 'please'],
  includeExamples: true
});

// 翻译
const translation = await aiService.translate({
  text: 'Hello, welcome!',
  targetLang: 'zh'
});
```

详细文档：[AI 服务快速开始指南](../docs/AI_SERVICE_QUICK_START.md)

---

## 🔧 技术栈

### 前端框架
- **Vue 3.5** - 渐进式框架（Composition API）
- **TypeScript 5.7** - 类型安全
- **Vite 6.0** - 快速构建工具
- **Element Plus 2.9** - UI 组件库

### 桌面应用
- **Electron 33.3** - 跨平台桌面应用框架
- **Electron Forge 7.6** - 应用构建工具

### 状态管理
- **Pinia 2.3** - Vue 状态管理
- **Vue Router 4.5** - 路由管理

### 数据存储
- **Dexie.js 4.2** - IndexedDB 封装
- **Electron Store 8.2** - Electron 配置存储

### AI 集成
- **通义千问 API** - 课程生成、词汇增强、翻译
- **自定义 TTS/ASR 服务** - 语音功能

### 开发工具
- **ESLint** - 代码检查
- **Prettier** - 代码格式化
- **Vue TSC** - Vue 类型检查

---

## 📦 数据库结构

使用 Dexie.js 管理 11 个数据表：

| 表名 | 说明 | 主键 |
|------|------|------|
| `courses` | 课程信息 | id |
| `lessons` | 课时信息 | id |
| `words` | 单词数据 | id |
| `practiceRecords` | 练习记录 | id |
| `typingRecords` | 打字记录 | id |
| `learningProgress` | 学习进度 | id |
| `userStats` | 用户统计 | id |
| `settings` | 用户设置 | key |
| `audioCache` | 音频缓存 | id |
| `reviewQueue` | 复习队列 | id |
| `achievements` | 成就记录 | id |

---

## 🎨 开发规范

### 代码风格
- 使用 **Composition API**（`<script setup>`）
- **TypeScript** 类型定义完整
- 组件命名：PascalCase
- 文件命名：camelCase

### Git 提交规范
```
feat: 新功能
fix: 修复 bug
docs: 文档更新
style: 代码格式调整
refactor: 重构
perf: 性能优化
test: 测试
chore: 构建/工具配置
```

### 目录结构规范
- `views/` - 页面级组件
- `components/` - 可复用组件
- `services/` - 业务逻辑服务
- `stores/` - 状态管理
- `types/` - 类型定义

---

## 🧪 测试

```bash
# 类型检查
npm run typecheck

# 代码检查
npm run lint

# 单元测试（TODO）
npm test
```

---

## 📚 相关文档

- [系统功能完成检查](../docs/SYSTEM_FEATURE_COMPLETION_CHECK.md)
- [Phase 9 AI 服务迁移完成报告](../docs/PHASE_9_COMPLETION_REPORT.md)
- [AI 服务快速开始指南](../docs/AI_SERVICE_QUICK_START.md)
- [迁移计划和开发路线图](../docs/MIGRATION_PLAN_AND_DEVELOPMENT_ROADMAP.md)

---

## 🐛 已知问题

1. **发音评测功能** - UI 完成，后端评分算法待集成
2. **词汇推荐功能** - UI 完成，推荐算法待实现
3. **音频导入** - 需集成 ASR 转录服务
4. **教材导入** - 需文件解析器（PDF/DOCX）

---

## 🗓️ 开发路线图

### ✅ 已完成（Phase 1-9）
- [x] 基础框架搭建（Vue 3 + Electron）
- [x] 数据库层实现（Dexie.js）
- [x] 课程管理系统
- [x] 打字练习功能
- [x] TTS/ASR 服务集成
- [x] AI 服务层实现（Qwen）
- [x] AILab 页面集成

### 🚧 进行中（Phase 10）
- [ ] 发音评测完整实现
- [ ] 词汇推荐算法
- [ ] AI 配置界面
- [ ] 更多 AI 提供商（OpenAI、Volcengine）

### 📅 计划中（Phase 11+）
- [ ] 移动端适配
- [ ] 云同步功能
- [ ] 社区课程分享
- [ ] 游戏化学习
- [ ] 多语言支持

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

---

## 📄 许可证

本项目采用 MIT 许可证。详见 [LICENSE](../LICENSE) 文件。

---

## 📞 联系方式

- **项目主页**: [LexiType Academy](https://github.com/yourname/lexitype-academy)
- **问题反馈**: [Issues](https://github.com/yourname/lexitype-academy/issues)

---

## 🙏 致谢

感谢以下开源项目：
- [Vue.js](https://vuejs.org/)
- [Electron](https://www.electronjs.org/)
- [Element Plus](https://element-plus.org/)
- [Dexie.js](https://dexie.org/)
- [阿里云通义千问](https://dashscope.aliyuncs.com/)

---

**最后更新**: 2026-01-06  
**版本**: 0.2.0  
**状态**: 🚀 积极开发中
