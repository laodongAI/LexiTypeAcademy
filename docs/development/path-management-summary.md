# 统一路径管理方案 - 实施总结

## ✅ 已完成

### 1. 核心架构
- **PathManager 服务** (`src/app/PathManager.ts`) - 210行
  - 单例模式路径管理器
  - 支持所有路径配置(appRoot, dataDir, sherpaModelsDir等)
  - 提供路径拼接/规范化工具
  - 在应用启动时从 Electron 获取绝对路径

### 2. Electron 集成
- **main.ts** - 新增路径辅助函数
  - `getAppRoot()` - 应用根目录
  - `getDataDir()` - 数据目录
  - `getPublicDir()` - Public 资源目录
  
- **IPC Handlers** - 新增3个接口
  - `get-paths` - 获取所有路径配置
  - `get-data-path` - 获取数据目录(兼容)
  - `set-data-path` - 设置数据目录(兼容)

- **preload.ts** - 暴露 IPC 接口
  - `electron.getPaths()`
  - `electron.getDataPath()`
  - `electron.setDataPath()`

### 3. 类型定义
- **electron.d.ts** - 新增 `PathsConfig` 接口
  - 包含10个路径属性
  - 完整的 TypeScript 类型支持

### 4. 应用初始化
- **App.tsx** - 集成 PathManager
  - 启动时调用 `initializePaths()`
  - 显示加载状态(初始化中...)
  - 降级机制(初始化失败仍可运行)

### 5. 文档
- **使用指南** (`docs/development/path-management-guide.md`) - 358行
  - 完整的使用说明
  - 代码示例
  - 迁移指南
  - 最佳实践

---

## ⏳ 待修改

### 需要集成 PathManager 的模块:

1. **SherpaOnnxASRProvider** (`src/infrastructure/audio/asr/SherpaOnnxASRProvider.ts`)
   ```typescript
   // 当前: 硬编码路径
   private modelPath: string = '/sherpa/models/asr';
   
   // 需改为:
   private modelPath: string = getPathManager().getASRModelsDir();
   ```

2. **SherpaOnnxTTSProvider** (`src/infrastructure/audio/tts/SherpaOnnxTTSProvider.ts`)
   ```typescript
   // 当前: 硬编码路径
   modelPath: '/sherpa/models/en-US-libritts/'
   
   // 需改为:
   modelPath: getPathManager().resolveSherpaModel('models/en-US-libritts')
   ```

3. **sherpaModels.ts** (`src/infrastructure/audio/settings/sherpaModels.ts`)
   ```typescript
   // 当前: 绝对路径
   modelPath: '/sherpa/sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech'
   
   // 需改为: 相对路径
   modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech'
   ```

4. **audioUtils.ts** (`src/shared/utils/audioUtils.ts`)
   ```typescript
   // 当前: 直接调用 electron.getDataPath()
   const direct = electronApi.getDataPath();
   
   // 需改为:
   const direct = getPathManager().getDataDir();
   ```

5. **main.ts 音频文件操作** (`electron/main.ts`)
   ```typescript
   // 当前: 每个 handler 都重复计算路径
   const baseDir = isDev ? path.join(process.cwd(), 'data') : ...
   
   // 需改为: 使用统一函数
   const baseDir = getDataDir();
   ```

---

## 🎯 下一步行动

### 优先级 1: 修复 WASM 加载路径
```typescript
// SherpaOnnxASRProvider.ts
const pathManager = getPathManager();
const sherpaPath = pathManager.toURL('/sherpa/sherpa-onnx-wasm-main.js');
// 注意: 仍需字符串拼接绕过 Vite 分析
const module = await import(/* @vite-ignore */ sherpaPath);
```

### 优先级 2: 修改模型配置
```typescript
// sherpaModels.ts - 所有 modelPath 改为相对路径
export const SHERPA_ASR_MODELS = [
  {
    id: 'gigaspeech-zipformer',
    modelPath: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech',
    // 不再是: '/sherpa/sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech'
  }
];
```

### 优先级 3: 重构 Provider 初始化
```typescript
// ASRProvider 和 TTSProvider 的 initialize() 方法
async initialize(config: SherpaASRConfig): Promise<void> {
  const pathManager = getPathManager();
  this.modelPath = pathManager.resolveSherpaModel(config.modelPath);
  // ...
}
```

---

## 📊 影响范围

### 已修改文件 (6个)
- ✅ `src/app/PathManager.ts` (新增)
- ✅ `electron/main.ts` (修改)
- ✅ `electron/preload.ts` (修改)
- ✅ `src/types/electron.d.ts` (修改)
- ✅ `src/App.tsx` (修改)
- ✅ `docs/development/path-management-guide.md` (新增)

### 待修改文件 (5个)
- ⏳ `src/infrastructure/audio/asr/SherpaOnnxASRProvider.ts`
- ⏳ `src/infrastructure/audio/tts/SherpaOnnxTTSProvider.ts`
- ⏳ `src/infrastructure/audio/settings/sherpaModels.ts`
- ⏳ `src/shared/utils/audioUtils.ts`
- ⏳ `electron/main.ts` (音频文件操作部分)

---

## 🧪 测试计划

### 1. 开发环境测试
```bash
npm run dev
# 检查控制台: [PathManager] 初始化成功
# 测试 TTS: 点击设置 → 语音合成 → 测试语音合成
# 测试 ASR: 点击设置 → 语音识别 → 测试语音识别
```

### 2. 生产环境测试
```bash
npm run build
npm run package
# 安装打包的应用
# 检查日志中的路径配置
# 验证模型加载正常
```

### 3. 路径验证
在控制台运行:
```javascript
const pm = require('@/app/PathManager').getPathManager();
console.log(pm.getConfig());
```

---

## 💡 设计要点

### 1. 为什么需要初始化?
- Renderer 进程无法访问 Node.js API
- 必须通过 IPC 从 Main 进程获取绝对路径
- 异步初始化避免阻塞应用启动

### 2. 为什么使用相对路径?
- 配置文件更简洁(不需要完整路径)
- 更容易迁移和维护
- 运行时动态解析为绝对路径

### 3. 为什么需要 toURL()?
- 前端加载资源使用 URL 而非文件路径
- Vite 开发服务器和 Electron 生产环境处理不同
- `toURL()` 确保跨环境兼容

### 4. 降级机制
```typescript
// 初始化失败时使用默认路径
catch (error) {
  this.config = {
    dataDir: '/data',
    sherpaModelsDir: '/sherpa',
    // ...
  };
}
```

---

## 🎓 最佳实践

### ✅ 推荐
```typescript
// 1. 通过 PathManager 获取所有路径
const pm = getPathManager();
const path = pm.resolveSherpaModel('model-name');

// 2. 配置使用相对路径
const config = { modelPath: 'relative/path/to/model' };

// 3. 运行时解析
const fullPath = pm.resolveSherpaModel(config.modelPath);
```

### ❌ 避免
```typescript
// 1. 硬编码路径
const path = '/sherpa/models/asr'; // ❌

// 2. 环境判断
const dir = isDev ? './data' : '/app/data'; // ❌

// 3. 直接拼接
const full = baseDir + '/' + filename; // ❌
```

---

## 📞 FAQ

**Q: 现有代码还能用吗?**
A: 能! 旧的 `electron.getDataPath()` 仍然保留,新代码建议使用 PathManager。

**Q: 如何查找需要修改的地方?**
A: 搜索关键字: `modelPath`, `/sherpa/`, `/data/`, `process.cwd()`, `__dirname`

**Q: 初始化失败怎么办?**
A: PathManager 有降级机制,会使用相对路径,应用可继续运行。

**Q: 生产环境如何验证?**
A: 查看控制台日志,确认 PathManager 输出正确的绝对路径。

---

**状态**: ✅ 架构完成,待集成到各模块  
**下一步**: 修改 ASRProvider 和 TTSProvider 集成 PathManager
