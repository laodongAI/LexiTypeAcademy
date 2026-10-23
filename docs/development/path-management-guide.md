# 统一路径管理方案

## 概述

**PathManager** 是一个单例服务,用于统一管理应用所有路径,解决以下问题:
- ✅ 多处硬编码路径
- ✅ 开发/生产环境路径不一致
- ✅ 前端无法获取绝对路径
- ✅ Electron 和 Renderer 路径隔离

---

## 架构设计

### 组件关系

```
┌─────────────────┐
│   App.tsx       │ ← 应用启动时初始化
│ initializePaths()│
└────────┬────────┘
         │
         ▼
┌─────────────────────────┐
│  PathManager (前端)      │
│  - 单例模式              │
│  - 缓存路径配置          │
│  - 提供路径拼接工具      │
└────────┬────────────────┘
         │ IPC: get-paths
         ▼
┌─────────────────────────┐
│  Electron Main (后端)    │
│  - getAppRoot()          │
│  - getDataDir()          │
│  - getPublicDir()        │
│  - 返回绝对路径          │
└─────────────────────────┘
```

### 路径配置

| 路径 | 开发环境 | 生产环境 | 用途 |
|------|----------|----------|------|
| `appRoot` | `E:/project/lexitype-academy` | `C:/Program Files/LexiType/resources/app.asar` | 应用根目录 |
| `dataDir` | `E:/project/lexitype-academy/data` | `C:/Users/xxx/AppData/Roaming/LexiType/data` | 用户数据 |
| `publicDir` | `E:/project/lexitype-academy/public` | `C:/Program Files/LexiType/resources/public` | 静态资源 |
| `sherpaModelsDir` | `E:/project/lexitype-academy/public/sherpa` | `C:/Program Files/LexiType/resources/public/sherpa` | Sherpa 模型 |
| `ttsCacheDir` | `E:/project/lexitype-academy/data/tts-cache` | `C:/Users/xxx/AppData/Roaming/LexiType/data/tts-cache` | TTS 缓存 |
| `courseAudioDir` | `E:/project/lexitype-academy/data/audio` | `C:/Users/xxx/AppData/Roaming/LexiType/data/audio` | 课程音频 |

---

## 使用方法

### 1. 基础使用

```typescript
import { getPathManager } from '@/app/PathManager';

// 获取 PathManager 实例
const pathManager = getPathManager();

// 获取路径配置
const config = pathManager.getConfig();
console.log('数据目录:', config.dataDir);

// 获取单个路径
const dataDir = pathManager.getDataDir();
const sherpaDir = pathManager.getSherpaModelsDir();
```

### 2. 路径拼接

```typescript
import { getPathManager } from '@/app/PathManager';

const pathManager = getPathManager();

// 拼接 Sherpa 模型路径
const modelPath = pathManager.resolveSherpaModel(
  'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech'
);
// 结果: /public/sherpa/sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech

// 拼接课程音频路径
const audioPath = pathManager.resolveCourseAudio('course_123', 'lesson_01.mp3');
// 结果: /data/audio/course_123/lesson_01.mp3

// 拼接 TTS 缓存路径
const cachePath = pathManager.resolveTTSCache('hello_world.wav');
// 结果: /data/tts-cache/hello_world.wav

// 通用路径拼接
const customPath = pathManager.joinPath(dataDir, 'custom', 'file.txt');
```

### 3. 在 Provider 中使用

#### ASRProvider 示例

```typescript
// src/infrastructure/audio/asr/SherpaOnnxASRProvider.ts

import { getPathManager } from '@/app/PathManager';

export class SherpaOnnxASRProvider implements ASRProvider {
  private modelPath: string = '';
  
  async initialize(config: SherpaASRConfig): Promise<void> {
    const pathManager = getPathManager();
    
    // 使用配置的模型路径(相对路径)
    const modelRelativePath = config.modelPath || 
      'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech';
    
    // 解析为完整路径
    this.modelPath = pathManager.resolveSherpaModel(modelRelativePath);
    
    console.log('[ASR] 模型路径:', this.modelPath);
    
    // 使用路径加载模型...
  }
}
```

#### TTSProvider 示例

```typescript
// src/infrastructure/audio/tts/SherpaOnnxTTSProvider.ts

import { getPathManager } from '@/app/PathManager';

export class SherpaOnnxTTSProvider implements TTSProvider {
  async synthesize(text: string): Promise<AudioBuffer> {
    const pathManager = getPathManager();
    
    // 生成缓存文件名
    const cacheKey = this.generateCacheKey(text);
    const cachePath = pathManager.resolveTTSCache(`${cacheKey}.wav`);
    
    // 检查缓存...
    const cached = await this.loadCache(cachePath);
    if (cached) return cached;
    
    // 合成音频并保存到缓存...
  }
}
```

### 4. 在配置中使用

```typescript
// src/infrastructure/audio/settings/sherpaModels.ts

export const SHERPA_ASR_MODELS: SherpaASRModelConfig[] = [
  {
    id: 'gigaspeech-zipformer',
    label: 'Zipformer GigaSpeech (推荐)',
    // 注意: 这里使用相对于 sherpaModelsDir 的相对路径
    modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech',
    description: '高精度英语识别模型'
  },
  // ...
];
```

### 5. URL 转换(前端资源加载)

```typescript
import { getPathManager } from '@/app/PathManager';

const pathManager = getPathManager();

// 将相对路径转换为 URL
const scriptURL = pathManager.toURL('/sherpa/sherpa-onnx-tts.js');
// 开发环境: /sherpa/sherpa-onnx-tts.js (Vite 处理)
// 生产环境: /sherpa/sherpa-onnx-tts.js (Electron serve)

// 使用 URL 加载脚本
const script = document.createElement('script');
script.src = scriptURL;
document.head.appendChild(script);
```

---

## 迁移指南

### 从旧代码迁移

#### 迁移前
```typescript
// ❌ 硬编码路径
private modelPath: string = '/sherpa/models/asr';

// ❌ 直接拼接
const audioPath = `/data/audio/${courseId}/${filename}`;

// ❌ 环境判断
const dataDir = isDev 
  ? path.join(process.cwd(), 'data')
  : path.join(app.getPath('userData'), 'data');
```

#### 迁移后
```typescript
// ✅ 使用 PathManager
import { getPathManager } from '@/app/PathManager';

const pathManager = getPathManager();
const modelPath = pathManager.getASRModelsDir();

const audioPath = pathManager.resolveCourseAudio(courseId, filename);

const dataDir = pathManager.getDataDir();
```

### 需要修改的文件

1. **ASR Provider**
   - `src/infrastructure/audio/asr/SherpaOnnxASRProvider.ts`
   - 替换硬编码的 `modelPath`

2. **TTS Provider**
   - `src/infrastructure/audio/tts/SherpaOnnxTTSProvider.ts`
   - 替换硬编码的 `modelPath`
   - 使用 `resolveTTSCache()` 生成缓存路径

3. **Sherpa 模型配置**
   - `src/infrastructure/audio/settings/sherpaModels.ts`
   - `modelPath` 改为相对路径(相对于 `sherpaModelsDir`)

4. **音频工具**
   - `src/shared/utils/audioUtils.ts`
   - 替换 `getDataPath()` 调用为 `pathManager.getDataDir()`

---

## 常见问题

### Q: PathManager 何时初始化?
A: 在 `App.tsx` 的 `useEffect` 中调用 `initializePaths()`,应用启动时自动初始化。

### Q: 初始化失败会怎样?
A: PathManager 有降级机制,会使用默认相对路径(开发环境),应用仍可继续运行。

### Q: WASM 文件路径怎么处理?
A: WASM 文件在 `public` 目录,使用 `toURL()` 转换:
```typescript
const wasmURL = pathManager.toURL('/sherpa/sherpa-onnx.wasm');
```

### Q: 动态导入路径问题?
A: 使用字符串拼接绕过 Vite 静态分析:
```typescript
const sherpaPath = '/sherpa' + '/sherpa-onnx-wasm-main.js';
const module = await import(/* @vite-ignore */ sherpaPath);
```

### Q: 生产环境如何验证路径?
A: 打包后在控制台查看 PathManager 初始化日志:
```
[PathManager] 初始化成功: {
  appRoot: "C:/Program Files/LexiType/resources/app.asar",
  dataDir: "C:/Users/xxx/AppData/Roaming/LexiType/data",
  ...
}
```

---

## 最佳实践

### ✅ 推荐做法

```typescript
// 1. 总是通过 PathManager 获取路径
const pathManager = getPathManager();
const modelPath = pathManager.resolveSherpaModel('model-name');

// 2. 配置文件中使用相对路径
const config = {
  modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech'
};

// 3. 运行时解析为完整路径
const fullPath = pathManager.resolveSherpaModel(config.modelPath);
```

### ❌ 避免做法

```typescript
// 1. 不要硬编码绝对路径
const path = 'C:/Program Files/LexiType/data/audio/file.mp3'; // ❌

// 2. 不要直接使用 process.cwd() 或 __dirname
const dataDir = process.cwd() + '/data'; // ❌

// 3. 不要假设路径结构
const modelPath = '../../../public/sherpa/models/asr'; // ❌
```

---

## 下一步

完成路径管理器集成后,需要修改以下模块:

1. ✅ **PathManager** - 已完成
2. ✅ **Electron IPC** - 已完成
3. ✅ **App.tsx 初始化** - 已完成
4. ⏳ **ASRProvider 集成** - 待修改
5. ⏳ **TTSProvider 集成** - 待修改
6. ⏳ **Sherpa 模型配置** - 待修改
7. ⏳ **音频工具集成** - 待修改

使用命令查找需要修改的硬编码路径:
```bash
npm run grep:paths
```
