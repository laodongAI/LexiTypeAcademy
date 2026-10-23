# LexiType Academy - 源代码目录结构

本项目采用 **领域驱动设计 (DDD)** 架构，清晰分离各层职责。

## 📁 目录结构

```
src/
├── app/              # 应用层 - 应用上下文、全局状态管理
├── core/             # 核心层 - 基础设施（i18n, DI容器）
├── domain/           # 领域层 - 业务逻辑、领域模型、领域服务
├── lib/              # 技术基础设施层 - TTS, ASR, 数据库, 存储
├── shared/           # 共享层 - 工具函数、常量、通用Hooks
├── ui/               # 表现层 - 页面组件、UI组件
├── types/            # 全局类型定义
├── index.tsx         # 应用入口
└── tailwind.css      # 样式入口
```

## 🏗️ 架构层级说明

### 1. **app/** - 应用层
- **职责**：应用级上下文、全局状态管理
- **示例**：`AppContext`, `ThemeProvider`
- **依赖方向**：可依赖 domain, lib, shared

### 2. **core/** - 核心基础设施
- **职责**：框架无关的核心基础设施
- **示例**：
  - `i18n/` - 国际化配置
  - `di/` - 依赖注入容器
- **依赖方向**：不依赖其他层

### 3. **domain/** - 领域层（核心业务）
- **职责**：业务逻辑、领域模型、领域服务
- **子目录**：
  - `models/` - 领域模型（Course, Lesson, User等）
  - `services/` - 领域服务（业务逻辑）
- **依赖方向**：仅依赖 core, 不依赖 lib/ui

### 4. **lib/** - 技术基础设施层
- **职责**：技术实现细节、第三方库封装
- **子目录**：
  - `tts/` - 文本转语音服务
  - `asr/` - 语音识别服务
  - `audio/` - 音频处理管道
  - `db/` - 数据库（IndexedDB）
  - `storage/` - 数据持久化
- **依赖方向**：可依赖 domain, core

### 5. **shared/** - 共享层
- **职责**：跨层复用的工具和资源
- **子目录**：
  - `utils/` - 工具函数
  - `constants/` - 常量配置
  - `hooks/` - 自定义React Hooks
- **依赖方向**：可依赖 domain, lib, core

### 6. **ui/** - 表现层
- **职责**：用户界面、页面组件
- **子目录**：
  - `pages/` - 页面组件（按功能模块）
    - `home/` - 首页
    - `typing/` - 打字练习
    - `pinyin/` - 拼音练习
    - `games/` - 游戏中心
    - `ai/` - AI功能
    - `review/` - 复习管理
    - `history/` - 历史记录
    - `settings/` - 设置面板
  - `components/` - 通用UI组件
- **依赖方向**：可依赖所有层

### 7. **types/** - 全局类型定义
- **职责**：TypeScript类型定义、接口声明
- **依赖方向**：不依赖其他层

## 🔗 依赖规则

```
ui → shared → lib → domain → core
     ↓         ↓      ↓
   types    types  types
```

**核心原则**：
- ✅ 外层可依赖内层
- ❌ 内层禁止依赖外层
- ✅ domain 层保持纯粹，不依赖技术实现

## 📦 导入路径规范

使用路径别名，提升可维护性：

```typescript
import { Course } from '@/domain/models/course';
import { courseService } from '@/domain/services/courseService';
import { ttsManager } from '@/lib/tts';
import { useAudioGuards } from '@/shared/hooks/useAudioGuards';
import { HomePage } from '@/ui/pages/home/HomePage';
```

## 🚀 迁移策略

采用**增量迁移**策略：
1. 初始化目录结构 ✅
2. 迁移核心基础设施（App, Navigation, I18n）
3. 按功能模块逐个迁移（home → typing → pinyin → games → ai → review → history → settings）
4. 最后迁移复杂的英语课程系统

每次迁移确保：
- ✅ 编码问题修复（UTF-8）
- ✅ 导入路径正确
- ✅ 编译通过
- ✅ 功能验证

## 📝 开发规范

1. **文件命名**：
   - 组件：PascalCase（`HomePage.tsx`）
   - 服务/工具：camelCase（`courseService.ts`）
   - 类型：PascalCase（`Course.ts`）

2. **注释规范**：
   - 所有注释使用**中文**
   - 复杂逻辑必须添加注释

3. **导入顺序**：
   ```typescript
   // 1. 第三方库
   import React from 'react';
   
   // 2. 内部模块（按层级）
   import { Course } from '@/domain/models/course';
   import { ttsManager } from '@/lib/tts';
   import { Button } from '@/ui/components/Button';
   
   // 3. 样式
   import './styles.css';
   ```

## 🔍 常见问题

### Q: domain 层可以使用 React Hooks 吗？
A: ❌ 不可以。domain 层应保持框架无关，Hooks 应放在 `shared/hooks/` 或 UI 组件中。

### Q: lib 层和 domain 层的区别？
A: 
- `lib/` - 技术实现（TTS、ASR、数据库等），可替换
- `domain/` - 业务逻辑（课程管理、学习路径等），核心不变

### Q: 何时使用 shared/utils vs domain/services?
A:
- `shared/utils` - 无业务含义的纯函数（格式化、校验等）
- `domain/services` - 有业务含义的服务（课程创建、成绩计算等）
