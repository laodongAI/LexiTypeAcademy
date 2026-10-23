# LexiType Academy (键语学苑)

> 一个集英语学习、打字训练、AI辅助于一体的跨平台桌面应用

[![Version](https://img.shields.io/badge/version-0.1.1-blue.svg)](package.json)
[![Electron](https://img.shields.io/badge/Electron-28.3.0-47848F.svg)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.x-42B883.svg)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3.3-3178C6.svg)](https://www.typescriptlang.org/)

## ⚠️ 重要：当前维护版本

当前主要维护与开发的版本在 `vue-app/`（Vue 3 + TS + Element Plus + Electron Forge）。

- 正确启动方式（推荐）：在项目根目录直接运行 `npm run dev`（已默认代理到 `vue-app`）
- 老版本（React/Electron）仍保留在根目录，但相关脚本已改为 `legacy:*`，避免误启动

## 📖 项目简介

**LexiType Academy（键语学苑）** 是一个功能丰富的英语学习和打字练习桌面应用，旨在通过游戏化学习、AI辅助生成和科学的复习机制，帮助用户提升英语词汇记忆、打字速度和语言综合能力。

### 核心特色

- 🎮 **7种游戏化学习模式**：让学习变得有趣
- 🤖 **AI智能课程生成**：支持词汇、句子、故事、对话等多种内容类型
- 🧠 **科学复习系统**：基于间隔重复算法（Spaced Repetition）的智能复习
- 🔊 **离线语音功能**：集成 Sherpa-ONNX TTS/ASR，支持离线语音合成和识别
- 📊 **数据可视化**：详细的练习统计和趋势分析
- 🌍 **多语言支持**：中英文界面切换
- 🔌 **插件化架构**：易于扩展的游戏和AI模块

## ✨ 主要功能

### 1. 打字练习模块

#### 指法练习（Finger Practice）
- 按难度分级：初级、中级、高级
- 实时键盘高亮显示
- 指法位置引导

#### 打字练习（Typing Practice）
- 中文古诗词练习
- 英文文本练习
- 实时WPM（每分钟字数）和准确率统计

### 2. 课程系统

#### 课程管理
- **导入功能**：支持JSON格式课程导入
- **课程类型**：
  - 文本课程（Text）：文章、故事、对话等
  - 词汇课程（Words）：单词列表，包含音标、释义、例句
  - 混合课程（Mixed）：结合文本和词汇
- **课程筛选**：按标签、难度、类型筛选
- **进度跟踪**：记录练习次数、准确率、最后练习时间

#### 练习模式
- **标准模式**：显示原文、译文、关键词
- **视译模式**：仅显示中文翻译，用户输入英文，训练中英思维转换
- **听写模式**：隐藏原文和译文，仅播放音频，训练听力
- **精抄模式**：显示原文，隐藏译文，专注于拼写和输入精度
- **专注模式**：单句显示，提供沉浸式练习体验

### 3. 游戏中心（7种游戏模式）

1. **✈️ 飞行模式（Flight Game）**：字幕流式呈现，正确输入提高速度
2. **⚡ 单词挑战（Word Challenge）**：倒计时输入词汇，正确获得时间奖励
3. **🔥 连击模式（Combo Game）**：系统生成按键序列，稳定无误差提高连击等级
4. **⚔️ 地牢勇士（Dungeon Typer）**：RPG回合制战斗，拼写单词发动魔法攻击
5. **🌾 单词农场（Word Farm）**：模拟经营，通过拼写单词进行播种、浇水和收割
6. **🏎️ 极速赛车（Typing Racer）**：竞速模式，输入单词加速和超车
7. **🎵 指尖音符（Rhythm Key）**：音乐节奏模式，跟随节拍输入单词

### 4. AI实验室

#### AI课程生成
支持6种生成模式：

- **📝 词汇生成（Vocabulary）**：生成包含音标、释义、例句的完整词汇卡片
- **📄 文本生成（Text）**：生成连贯的文章，用于段落练习
- **✍️ 句子生成（Sentences）**：生成多样化的练习句子
- **📖 故事生成（Story）**：生成引人入胜的故事内容
- **💬 对话生成（Dialog）**：生成自然对话场景
- **🔄 混合生成（Mixed）**：结合多种类型的综合课程

#### AI功能特性
- **智能提示词工程**：根据用户水平自动调整生成难度
- **CEFR分级支持**：A1-C1级别自适应
- **字段自定义**：可选择包含音标、翻译、例句等字段
- **错误词复习**：自动混入最近错误词汇，生成巩固课程
- **主题模板**：支持童话、科普、日常会话等多种风格

### 5. 复习管理系统

#### 间隔重复算法
- 基于SM-2算法的智能复习调度
- 根据错误次数和掌握度动态调整复习间隔
- 自动生成每日复习任务队列

#### 掌握度追踪
- 词汇掌握度评分（0-100）
- 遗忘曲线统计
- 复习历史记录

### 6. 统计分析

#### 数据可视化
- **WPM趋势图**：显示打字速度变化趋势
- **准确率趋势图**：跟踪输入准确率变化
- **词汇掌握度图表**：展示学习进度
- **遗忘曲线分析**：可视化记忆保留率

#### 数据导出
- 支持CSV格式导出
- 包含日期、WPM、准确率、已掌握词数、错误统计等字段

### 7. 语音功能

#### TTS（文本转语音）
- **Sherpa-ONNX TTS**：高质量离线语音合成
- **系统TTS**：备用方案，使用系统语音引擎
- 支持单词和句子朗读
- 可调节语速和音调

#### ASR（语音识别）
- **Sherpa-ONNX ASR**：离线语音识别
- **API ASR**：支持在线语音识别服务
- 实时音量可视化
- 支持语音输入练习

### 8. 其他功能

- **暗色/亮色主题**：支持主题切换
- **字体大小调节**：12px-32px可调
- **多语言界面**：中文/English切换
- **历史记录**：完整的练习历史查看
- **设置面板**：集中管理所有设置选项

## 🛠️ 技术栈

### 前端技术
- **框架**：React 18.2.0 + TypeScript 5.3.3
- **构建工具**：Vite 5.0.10
- **样式**：TailwindCSS 3.3.5
- **状态管理**：React Hooks + Context API
- **图表库**：Chart.js 4.4.1 + react-chartjs-2
- **国际化**：自定义i18n实现

### 桌面应用
- **Electron**：28.3.0
- **electron-builder**：24.6.0（打包工具）

### 数据存储
- **IndexedDB**：Dexie.js 4.2.1（主要数据存储）
- **electron-store**：8.2.0（配置和设置存储）

### AI与语音
- **sherpa-onnx**：1.12.17（离线TTS/ASR）
- **mpg123-decoder**：1.0.3（音频解码）

### 开发工具
- **TypeScript**：类型安全
- **PostCSS + Autoprefixer**：CSS处理
- **Concurrently**：并发运行开发服务器

## 📦 安装与运行

### 环境要求

- Node.js >= 18.0.0
- npm >= 9.0.0
- Windows 10/11（当前主要支持Windows平台）

### 安装依赖

```powershell
npm install
```

### 开发模式

```powershell
npm run dev
```

等价于：

```powershell
cd vue-app
npm run dev
```

这将同时启动：
- Vite开发服务器（渲染进程）：`http://localhost:5173`
- Electron主进程

如需启动老版本（不推荐）：`npm run legacy:dev`

### 构建

```powershell
# 仅构建渲染进程静态文件
npm run build

# 生成未打包目录（用于调试）
npm run dist:dir

# 生成便携版exe
npm run dist:portable

# 生成NSIS安装包
npm run dist
```

### 输出说明

- **`dist/win-unpacked/`**：直接可运行的解包目录，包含主程序与Electron运行所需DLL
- **`release/`**：打包输出目录，包含安装包和便携版

## 📁 项目结构

```
lexitype-academy/
├── electron/              # Electron主进程代码
│   ├── main.ts          # 主进程入口
│   ├── preload.ts       # 预加载脚本
│   └── preload.js       # 预加载脚本（编译后）
├── src/                  # 渲染进程React源码
│   ├── components/      # React组件
│   │   ├── games/       # 游戏组件
│   │   └── ...          # 其他组件
│   ├── services/        # 业务逻辑服务
│   │   ├── asr/         # 语音识别服务
│   │   ├── tts/         # 语音合成服务
│   │   └── ...          # 其他服务
│   ├── config/          # 配置文件
│   │   ├── gamePlugins.ts    # 游戏插件注册
│   │   ├── aiPlugins.ts      # AI插件注册
│   │   └── ...               # 其他配置
│   ├── hooks/           # 自定义Hooks
│   ├── i18n/            # 国际化资源
│   ├── types/           # TypeScript类型定义
│   ├── utils/           # 工具函数
│   ├── App.tsx          # 主应用组件
│   └── index.tsx        # 入口文件
├── public/              # 静态资源
│   └── sherpa/          # Sherpa-ONNX模型文件
├── dist/                # Vite构建输出
├── release/             # 打包输出
├── docs/                # 项目文档
│   ├── ROADMAP.md      # 项目路线图
│   ├── SHERPA_INSTALL.md  # Sherpa安装指南
│   └── ...              # 其他文档
├── data/                # 数据目录
│   ├── courses/         # 课程数据
│   └── tts-cache/       # TTS缓存
├── package.json         # 项目配置
├── vite.config.ts       # Vite配置
├── tsconfig.json        # TypeScript配置
└── tailwind.config.cjs  # TailwindCSS配置
```

## 🎯 核心模块说明

### 插件系统

项目采用插件化架构，支持动态注册游戏和AI模块：

- **游戏插件**：通过`pluginRegistry.registerGame()`注册
- **AI插件**：通过`pluginRegistry.registerAI()`注册
- 易于扩展新的游戏模式和AI功能

### 课程数据结构

```typescript
interface Course {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  type: 'text' | 'words' | 'mixed';
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  lessons: Lesson[];
  createdAt: string;
  updatedAt: string;
}

interface Lesson {
  id: string;
  content: string;              // 原文
  contentTranslation?: string;  // 中文翻译
  language: 'en' | 'zh';
  words?: WordEntry[];          // 词汇列表
  sentences?: Sentence[];      // 句子列表（支持句子级学习）
}

interface WordEntry {
  word: string;
  meaning?: string;
  translation?: string;
  phonetic?: string;
  partOfSpeech?: string;
  example?: string;
  exampleTranslation?: string;
}
```

### 存储架构

- **IndexedDB（Dexie.js）**：存储课程、练习记录、词汇掌握度等大量数据
- **electron-store**：存储用户设置、主题、语言等配置
- **本地文件系统**：存储TTS生成的音频文件

## 🐛 常见问题 FAQ

### 1. 主进程无法启动
- 确认`electron/main.js`存在
- 使用`npm run dev`而不是单独启动Vite
- 检查Node.js版本是否符合要求

### 2. 渲染进程空白
- 检查控制台是否有跨域或端口错误
- 确认Vite开发服务器正常运行（`http://localhost:5173`）
- 检查`main.js`中的加载逻辑

### 3. DLL缺失问题
- 执行`npm run dist:dir`检查`win-unpacked`目录
- 确认关键DLL存在：`ffmpeg.dll`, `d3dcompiler_47.dll`, `libEGL.dll`, `libGLESv2.dll`等
- 若缺失，删除`node_modules`和`dist`后重新`npm install`和打包
- 检查杀毒软件是否隔离了DLL文件

### 4. TTS/ASR功能异常
- 确认`sherpa`模型文件已正确放置在`public/sherpa/`目录
- 检查浏览器控制台是否有WebAssembly加载错误
- 参考`docs/SHERPA_INSTALL.md`和`docs/TTS_SETUP.md`进行配置

### 5. 课程导入失败
- 检查JSON格式是否正确
- 确认包含必需的`title`和`lessons`字段
- 查看控制台错误信息

### 6. 数据丢失
- 数据存储在IndexedDB中，不会因应用更新而丢失
- 建议定期使用CSV导出功能备份数据
- 检查浏览器是否清除了网站数据

### 7. 性能问题
- 大量课程数据可能导致加载缓慢，使用课程筛选功能
- 关闭不需要的游戏和AI功能
- 清理TTS缓存文件（`data/tts-cache/`）

## 🚀 开发指南
### Phase 1 UI 统一（Design Tokens & 基础组件）

本项目已开始进行 UI 语义化与组件统一重构（Phase 1）。新增以下设计 Token 与基础组件，后续新代码应优先使用：

#### 设计 Token（Tailwind 扩展）
在 `tailwind.config.cjs` 增加：`colors.success|warning|danger`、`borderRadius.card|button`、`spacing.card`。

配套的语义化类在 `src/tailwind.css` 中通过 `@layer components` 定义：
- `card`：标准卡片容器（含暗色模式边框与阴影）
- `btn` 系列：`btn-primary` / `btn-secondary` / `btn-danger` / `btn-outline`
- `badge-*`：状态徽章（success/warning/danger）
- `modal-overlay` / `modal-panel`：统一模态框结构

#### 基础组件目录
```
src/components/ui/
  Button.tsx       // 统一按钮（variant: primary|secondary|danger|outline）
  BaseCard.tsx     // 标题 + 副标题 + actions 区域
  BaseModal.tsx    // 遮罩 + 标题栏 + footer 操作区
  FormField.tsx    // 表单项包装（label + hint + error）
```

#### 使用示例
```tsx
import Button from '@/components/ui/Button';
import BaseCard from '@/components/ui/BaseCard';
import BaseModal from '@/components/ui/BaseModal';
import { FormField } from '@/components/ui/FormField';
import { notify } from '@/utils/notify';

export const DemoPanel = () => {
  const [open, setOpen] = React.useState(false);

  return (
    <BaseCard title="示例面板" subtitle="统一组件演示" actions={<Button variant="outline" onClick={()=>setOpen(true)}>打开弹窗</Button>}>
      <FormField label="用户名" hint="请输入英文名">
        <input className="w-full px-3 py-2 border rounded-xl focus:outline-none focus:ring focus:ring-primary" />
      </FormField>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => notify.success('保存成功')}>保存</Button>
        <Button variant="secondary" onClick={() => notify.info('已刷新')}>刷新</Button>
        <Button variant="danger" onClick={() => notify.error('操作失败')}>删除</Button>
      </div>
      <BaseModal open={open} title="统一弹窗" onClose={()=>setOpen(false)} footer={
        <>
          <Button variant="outline" onClick={()=>setOpen(false)}>关闭</Button>
          <Button onClick={()=>{ notify.success('提交成功'); setOpen(false); }}>提交</Button>
        </>
      }>
        <p className="text-sm text-gray-600">这里是弹窗内容区域。保持结构统一：标题栏 / 内容 / 底部操作。</p>
      </BaseModal>
    </BaseCard>
  );
};
```

#### 扩展约定
- 新增页面请优先使用 `BaseCard` 包裹主要区块
- 表单输入统一使用 `FormField`，错误信息不再直接写 `<p class="text-red-500">`，交由组件负责
- 所有按钮替换为 `Button`，禁止再拼接裸 `px-4 py-2 bg-*` 类名
- 模态框统一迁移至 `BaseModal`（后续将加入动画与可访问性增强）

#### 通知工具（全局反馈）
`src/utils/notify.ts` 提供统一反馈入口：
```ts
notify.success('操作完成');
notify.error('网络异常');
notify.info('正在加载');
```
内部自动检测是否存在第三方 `toast`（可与 `react-hot-toast` 集成），无依赖时使用简易浮层回退。

> 下一阶段（Phase 2）将抽象语音录制/播放 Hook（`useSpeechEngine`），为跟读/听写/评测流程提供统一状态与超时控制。


### 添加新游戏

1. 在`src/components/games/`创建游戏组件
2. 在`src/config/gamePlugins.ts`中注册游戏：

```typescript
pluginRegistry.registerGame({
  id: 'my-game',
  titleKey: 'game.myGame.title',
  descKey: 'game.myGame.desc',
  icon: '🎮',
  color: 'bg-blue-100 hover:bg-blue-200',
  component: MyGame,
});
```

3. 在`src/i18n/`中添加对应的翻译文本

### 添加新AI模式

1. 在`src/config/aiPlugins.ts`中注册AI插件：

```typescript
pluginRegistry.registerAI({
  id: 'my-ai-mode',
  nameKey: 'ai.mode.myMode',
  descKey: 'ai.mode.myMode.desc',
  icon: '🤖',
  buildPrompt: (options) => {
    // 构建提示词
    return prompt;
  }
});
```

### 代码规范

- 使用TypeScript进行类型检查
- 遵循React Hooks最佳实践
- 组件使用函数式组件
- 使用TailwindCSS进行样式设计
- 为每个方法编写注释，说明功能、输入、输出

## 📝 更新日志

### v0.1.1 (当前版本)

- ✅ 完成英语情景教学与文章练习功能升级
- ✅ 实现句子级课程数据结构
- ✅ 新增多种练习模式（视译、听写、精抄）
- ✅ 优化AI生成逻辑，支持结构化课程生成
- ✅ 修复TTS和ASR相关问题
- ✅ 完善插件化架构

详细更新历史请查看 [ROADMAP.md](docs/ROADMAP.md)

## 🔮 未来规划

- [ ] 语音评分功能（Pronunciation Scoring）
- [ ] 语法纠错功能（Grammar Correction）
- [ ] 自由写作模式（Free Writing）
- [ ] 云端同步功能
- [ ] 移动端适配
- [ ] 更多游戏模式
- [ ] 社区课程分享

## 📄 License

本项目遵循 MIT 许可证。详见 LICENSE 文件。

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📧 联系方式

如有问题或建议，请通过Issue反馈。

---

**LexiType Academy** - 让英语学习更有趣，让打字练习更高效！ 🚀
