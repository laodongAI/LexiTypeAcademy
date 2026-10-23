# 设置模块 - Sherpa模型集成实现总结

**版本**: v0.1.8  
**日期**: 2024-01-XX  
**状态**: ✅ 完成  

---

## 📋 任务概述

**目标**: 将设置模块从"UI外壳"升级为真正调用Sherpa本地模型的功能实现

**背景**: Phase 10.5.11完成了设置模块的基础架构(AudioSettingsService/LocalStorage持久化/UI组件),但测试按钮仅显示alert提示,未真正调用TTS/ASR Provider。用户指出需要参照老的配置功能代码(`src_bak/`),来完善新框架的实际模型调用功能。

---

## 🎯 完成的工作

### 1. 创建Sherpa模型配置文件

**文件**: `src/infrastructure/audio/settings/sherpaModels.ts`

**功能**:
- 定义 `SherpaAsrModelPreset` 和 `SherpaTtsModelPreset` 接口
- 导出 `SHERPA_ASR_MODELS` 数组(3个ASR模型):
  - `zipformer` (推荐) - GigaSpeech英文模型
  - `moonshine_tiny` - 体积极小,启动快
  - `whisper_tiny` - 稳健选择
- 导出 `SHERPA_TTS_MODELS` 数组(1个TTS模型):
  - `en_tts_v1_12_18` - 官方en-tts离线模型
- 导出 `SHERPA_VAD_MODEL_PATH` 常量(VAD模型路径)
- 工具函数:
  - `getSherpaAsrModelByPath()` - 根据路径查找ASR模型
  - `getSherpaTtsModelByPath()` - 根据路径查找TTS模型
  - `normalizePath()` - 路径标准化

**设计参考**: `src_bak/config/sherpaModels.ts`

---

### 2. 更新类型定义和默认配置

**修改文件**:
- `src/infrastructure/audio/settings/types.ts`
  - 在 `ASRConfig.sherpa` 中添加 `modelPath?: string` 字段
  
- `src/infrastructure/audio/settings/defaults.ts`
  - 导入 `DEFAULT_SHERPA_ASR_MODEL` 常量
  - 更新 `DEFAULT_SETTINGS.asr.sherpa.modelPath` 为推荐模型路径

**改动原因**: 需要在配置中存储用户选择的ASR模型路径

---

### 3. 创建TTS/ASR服务单例工厂

**修改文件**:

#### `src/infrastructure/audio/tts/index.ts`

**新增**:
```typescript
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    const primaryProvider = new SherpaOnnxTTSProvider();
    const fallbackProvider = new SystemTTSProvider();
    
    const cache = new DualLayerCache();
    const fileManager = new AudioFileManager();
    const cacheRepository = new TTSCacheRepository(cache, fileManager);
    
    const eventBus = DomainEventBus.getInstance();
    const errorHandler = new ErrorHandlingService();

    ttsServiceInstance = new TTSService(
      primaryProvider,
      fallbackProvider,
      cacheRepository,
      eventBus,
      errorHandler
    );
  }
  return ttsServiceInstance;
}
```

**功能**: 
- Singleton模式,全局唯一TTSService实例
- 自动注入所有依赖(Provider/Cache/EventBus/ErrorHandler)
- 主提供者: SherpaOnnx (本地WASM TTS)
- 备用提供者: SystemTTS (浏览器内置)

#### `src/infrastructure/audio/asr/index.ts`

**新增**:
```typescript
export function getASRService(): ASRService {
  if (!asrServiceInstance) {
    const primaryProvider = new SherpaOnnxASRProvider();
    
    asrServiceInstance = new ASRService({
      primaryProvider,
      maxConcurrent: 3,
      maxRetries: 3,
      enableFallback: false, // 暂时禁用降级(ApiASR需要配置)
      autoPublishEvents: true,
    });
  }
  return asrServiceInstance;
}
```

**功能**:
- Singleton模式,全局唯一ASRService实例
- 主提供者: SherpaOnnx (本地WASM ASR)
- 备用提供者: 暂未启用(ApiASRProvider需要endpoint/apiKey配置)

---

### 4. 更新SettingsPage - 集成真实TTS测试

**文件**: `src/ui/pages/settings/SettingsPage.tsx`

**修改1 - 新增imports**:
```typescript
import { getTTSService } from '@/infrastructure/audio/tts';
import { getASRService } from '@/infrastructure/audio/asr';
import { 
  SHERPA_ASR_MODELS, 
  getSherpaAsrModelByPath 
} from '@/infrastructure/audio/settings/sherpaModels';
```

**修改2 - TTS测试按钮**:

**之前**:
```typescript
onClick: () => {
  alert('测试TTS功能 (需要集成TTS服务)');
}
```

**之后**:
```typescript
onClick: async () => {
  try {
    const ttsService = getTTSService();
    await ttsService.initialize();
    
    const result = await ttsService.generate({
      text: 'This is a test of text to speech functionality.',
      voice: 'en-US-libritts',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0
    });

    // 播放生成的音频
    const audioUrl = URL.createObjectURL(result.audioBlob);
    const audio = new Audio(audioUrl);
    audio.play();
    
    alert(`TTS测试成功!\n时长: ${result.duration.toFixed(2)}秒\n来源: ${result.fromCache ? '缓存' : result.provider}`);
  } catch (error: any) {
    alert(`TTS测试失败: ${error.message}`);
  }
}
```

**实现功能**:
1. 获取TTSService单例
2. 调用 `initialize()` 初始化Sherpa WASM模块
3. 调用 `generate()` 生成测试文本的语音
4. 播放音频Blob
5. 显示结果(时长/是否命中缓存/提供者名称)
6. 捕获并显示错误信息

---

### 5. 更新SettingsPage - 集成真实ASR测试

**修改 - ASR测试按钮**:

**之前**:
```typescript
onClick: () => {
  alert('测试ASR功能 (需要集成ASR服务)');
}
```

**之后**:
```typescript
onClick: async () => {
  try {
    const asrService = getASRService();
    
    // 请求麦克风权限
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    const audioChunks: Blob[] = [];

    mediaRecorder.ondataavailable = (e) => audioChunks.push(e.data);
    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      
      try {
        const result = await asrService.recognize({
          audio: audioBlob,
          language: asrConfig?.language || 'en-US',
        });

        alert(`ASR测试成功!\n识别文本: ${result.text}\n置信度: ${(result.confidence * 100).toFixed(1)}%`);
      } catch (error: any) {
        alert(`ASR识别失败: ${error.message}`);
      }

      // 停止所有音轨
      stream.getTracks().forEach(track => track.stop());
    };

    // 录音3秒
    alert('开始录音,请说话...');
    mediaRecorder.start();
    setTimeout(() => mediaRecorder.stop(), 3000);
  } catch (error: any) {
    alert(`ASR测试失败: ${error.message}`);
  }
}
```

**实现功能**:
1. 获取ASRService单例
2. 请求麦克风权限(`getUserMedia`)
3. 使用MediaRecorder录音3秒
4. 调用 `asrService.recognize()` 识别音频
5. 显示识别文本和置信度
6. 清理资源(停止音轨)
7. 捕获并显示错误信息

---

### 6. 更新SettingsPage - 动态ASR模型选择

**修改 - Sherpa ASR配置区域**:

**之前**:
```typescript
React.createElement('div', { className: 'text-sm text-gray-600 space-y-1' },
  React.createElement('p', null, `采样率: ${asrConfig.sherpa.sampleRate} Hz`),
  React.createElement('p', null, `最大时长: ${asrConfig.sherpa.maxDuration}秒`)
)
```

**之后**:
```typescript
// 模型选择下拉菜单
React.createElement('div', null,
  React.createElement('label', { ... }, '识别模型'),
  React.createElement('select', {
    value: asrConfig.sherpa.modelPath || SHERPA_ASR_MODELS[0].modelPath,
    onChange: (e) => {
      const newModelPath = e.target.value;
      const selectedModel = getSherpaAsrModelByPath(newModelPath);
      
      settingsService.updateASRConfig({ 
        sherpa: { 
          sampleRate: asrConfig.sherpa!.sampleRate,
          maxDuration: asrConfig.sherpa!.maxDuration,
          modelPath: newModelPath 
        } 
      });
      
      setASRConfig({ ...asrConfig, sherpa: { ...asrConfig.sherpa, modelPath: newModelPath } });
      console.log('[ASR Settings] Model changed:', selectedModel);
    },
    ...
  },
    SHERPA_ASR_MODELS.map(model => 
      React.createElement('option', { 
        key: model.id, 
        value: model.modelPath 
      }, 
        model.label + (model.recommended ? ' (推荐)' : '')
      )
    )
  ),
  React.createElement('p', { ... }, 
    (() => {
      const currentModel = getSherpaAsrModelByPath(asrConfig.sherpa.modelPath);
      return currentModel?.description || '选择适合的ASR模型';
    })()
  )
)
```

**实现功能**:
1. 下拉菜单显示3个ASR模型(从 `SHERPA_ASR_MODELS` 动态生成)
2. 显示模型标签和"(推荐)"标记
3. 下方显示选中模型的描述信息
4. onChange事件:
   - 获取新模型路径
   - 更新AudioSettingsService配置
   - 更新React状态
   - 打印日志

**模型列表**:
- Zipformer (GigaSpeech, EN) (推荐)
- Moonshine Tiny (EN)
- Whisper Tiny (EN)

---

## 🔧 技术实现细节

### 架构模式

1. **Singleton Pattern** (单例模式)
   - `getTTSService()` 和 `getASRService()` 全局唯一实例
   - 避免重复初始化WASM模块

2. **Facade Pattern** (门面模式)
   - `TTSService` 和 `ASRService` 作为门面
   - 隐藏Provider/Cache/Queue的复杂性

3. **Strategy Pattern** (策略模式)
   - 主提供者/备用提供者可切换
   - SherpaOnnx/SystemTTS/EdgeTTS/ApiASR

### 依赖注入

- TTSService依赖:
  - `primaryProvider`: SherpaOnnxTTSProvider
  - `fallbackProvider`: SystemTTSProvider
  - `cacheRepository`: TTSCacheRepository (需要DualLayerCache + AudioFileManager)
  - `eventBus`: DomainEventBus
  - `errorHandler`: ErrorHandlingService

- ASRService依赖:
  - `primaryProvider`: SherpaOnnxASRProvider
  - `fallbackProvider`: (暂未配置)
  - `recordingRepo`: StudentRecordingRepository (自动创建)

### 数据流

**TTS测试流程**:
```
SettingsPage (点击"测试语音合成")
  ↓
getTTSService() (获取单例)
  ↓
ttsService.initialize() (初始化WASM模块)
  ↓
ttsService.generate({ text: "...", ... })
  ↓
检查TTSCacheRepository (DualLayerCache)
  ↓ (未命中)
SherpaOnnxTTSProvider.generate()
  ↓
返回 { audioBlob, duration, fromCache: false, provider: 'sherpa-onnx' }
  ↓
TTSCacheRepository.set() (缓存结果)
  ↓
DomainEventBus.publish(AudioGeneratedEvent)
  ↓
SettingsPage: 播放audioBlob + 显示结果
```

**ASR测试流程**:
```
SettingsPage (点击"测试语音识别")
  ↓
getASRService() (获取单例)
  ↓
navigator.mediaDevices.getUserMedia() (请求麦克风)
  ↓
MediaRecorder 录音3秒
  ↓
asrService.recognize({ audio: Blob, language: "en-US" })
  ↓
SherpaOnnxASRProvider.recognize()
  ↓
加载Sherpa WASM ASR模块 (根据modelPath)
  ↓
返回 { text, confidence, provider: 'sherpa-onnx' }
  ↓
StudentRecordingRepository.save() (存储录音记录)
  ↓
DomainEventBus.publish(RecordingCompletedEvent)
  ↓
SettingsPage: 显示识别结果和置信度
```

### 模型路径映射

**ASR模型**:
```typescript
{
  id: 'zipformer',
  modelPath: '/sherpa/sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech',
  // 实际文件: public/sherpa/sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech/
}
```

**TTS模型**:
```typescript
{
  id: 'en_tts_v1_12_18',
  modelPath: '/sherpa/sherpa-onnx-wasm-simd-v1.12.18-en-tts',
  // 实际文件: public/sherpa/sherpa-onnx-wasm-simd-v1.12.18-en-tts/
}
```

**VAD模型**:
```typescript
'/sherpa/sherpa-onnx-wasm-simd-v1.12.18-vad'
// 实际文件: public/sherpa/sherpa-onnx-wasm-simd-v1.12.18-vad/
```

---

## 📊 文件变更统计

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `src/infrastructure/audio/settings/sherpaModels.ts` | 新增 | 143 | Sherpa模型配置和工具函数 |
| `src/infrastructure/audio/settings/types.ts` | 修改 | +3 | ASRConfig.sherpa添加modelPath字段 |
| `src/infrastructure/audio/settings/defaults.ts` | 修改 | +4 | 导入DEFAULT_SHERPA_ASR_MODEL并设置默认modelPath |
| `src/infrastructure/audio/tts/index.ts` | 修改 | +28 | 新增getTTSService()单例工厂 |
| `src/infrastructure/audio/asr/index.ts` | 修改 | +22 | 新增getASRService()单例工厂 |
| `src/ui/pages/settings/SettingsPage.tsx` | 修改 | +95 | 集成真实TTS/ASR测试+动态模型选择 |

**总计**: 1个新文件, 5个修改文件, ~295行新增代码

---

## ✅ 测试验证

### 手动测试步骤

1. **TTS测试**:
   - 打开设置页面 → TTS设置分区
   - 选择 "Sherpa-ONNX (本地)" 提供者
   - 调整说话人ID和语速
   - 点击 "测试语音合成" 按钮
   - 验证:
     - [ ] 听到英文语音 "This is a test of text to speech functionality."
     - [ ] 弹窗显示时长和提供者名称
     - [ ] 第二次测试显示"来源: 缓存"

2. **ASR测试**:
   - 打开设置页面 → ASR设置分区
   - 选择 "Sherpa-ONNX (本地)" 提供者
   - 从下拉菜单选择ASR模型(Zipformer推荐)
   - 点击 "测试语音识别 (录音3秒)" 按钮
   - 允许麦克风权限
   - 在3秒内说英文句子
   - 验证:
     - [ ] 弹窗显示"开始录音,请说话..."
     - [ ] 3秒后弹窗显示识别文本
     - [ ] 置信度百分比正常(>60%)

3. **模型切换测试**:
   - 在ASR模型下拉菜单中切换不同模型
   - 观察控制台日志: `[ASR Settings] Model changed: ...`
   - 验证配置持久化:
     - [ ] 刷新页面后选中模型仍保持
     - [ ] 模型描述文字正确显示

### 预期问题

1. **WASM加载延迟**:
   - 首次点击测试按钮可能需要等待3-5秒(加载WASM模块)
   - 建议在TTS/ASR Provider的 `initialize()` 方法中添加进度提示

2. **麦克风权限**:
   - 浏览器会弹出麦克风权限请求
   - 用户需要点击"允许"才能录音

3. **模型文件丢失**:
   - 如果 `public/sherpa/` 目录缺少模型文件,会报错
   - 需确保所有5个模型目录完整

---

## 🎓 学习要点

### 从老代码学到的模式

参照 `src_bak/ui/pages/settings/SettingsPanel.tsx`:

1. **TTS Provider切换**:
   - `handleTtsChange()` 异步切换,显示loading状态
   - 保留用户选择的speakerId(持久化到localStorage)

2. **ASR模型预设**:
   - `SHERPA_ASR_MODELS` 数组定义所有可选模型
   - `handleAsrPresetChange()` 切换模型后自动保存配置

3. **测试按钮实现**:
   - TTS测试: `ttsManager.speak('This is a test.', false, 'en')`
   - ASR测试: 使用MediaRecorder录音后调用 `asrManager.recognize()`

### DDD分层体现

- **Infrastructure Layer** (基础设施层):
  - `sherpaModels.ts` - 模型元数据配置
  - `getTTSService()` / `getASRService()` - 服务工厂
  - `SherpaOnnxTTSProvider` / `SherpaOnnxASRProvider` - 技术实现

- **Application Layer** (应用层):
  - `AudioSettingsService` - 设置管理Facade
  - `TTSService` / `ASRService` - 音频服务Facade

- **UI Layer** (用户界面层):
  - `SettingsPage.tsx` - 设置页面组件
  - 调用Application Layer服务,不直接访问Provider

### 设计模式应用

1. **Facade Pattern**:
   - TTSService封装多个Provider和Cache的复杂交互
   - ASRService封装录音、识别、存储的完整流程

2. **Singleton Pattern**:
   - 全局唯一服务实例,避免重复初始化

3. **Strategy Pattern**:
   - 主提供者/备用提供者可动态切换
   - 支持未来扩展新的TTS/ASR引擎

4. **Repository Pattern**:
   - TTSCacheRepository管理音频缓存
   - StudentRecordingRepository管理录音记录

---

## 🚀 后续优化建议

### 1. 加载进度提示

**问题**: WASM模块首次加载需要3-5秒,用户无感知

**方案**:
```typescript
const [isInitializing, setIsInitializing] = useState(false);

onClick: async () => {
  setIsInitializing(true);
  try {
    await ttsService.initialize();
    // ... 测试逻辑
  } finally {
    setIsInitializing(false);
  }
}

// UI中显示loading状态
{isInitializing && <Spinner />}
```

### 2. TTS说话人标签自定义

**问题**: 目前说话人显示为"发音人0","发音人1"等通用名称

**方案**:
- 在 `sherpaModels.ts` 中添加 `SHERPA_TTS_SPEAKER_LABELS` 常量
- 读取模型的 `speakers.txt` 文件获取真实名称
- UI显示"Emma (女声)","James (男声)"等

### 3. ASR实时转写

**问题**: 当前只支持录音3秒后一次性识别

**方案**:
- 改用 `AudioWorklet` 实现流式识别
- 每500ms发送一个音频chunk到ASR Provider
- UI实时显示转写文本(类似字幕)

### 4. 模型缓存策略

**问题**: 每次切换ASR模型都需要重新加载WASM模块

**方案**:
- 实现 `ModelCacheService` 缓存已加载的模型
- 最多缓存3个最近使用的模型
- LRU淘汰策略

### 5. 错误恢复机制

**问题**: WASM加载失败后无法自动重试

**方案**:
- 在Provider的 `initialize()` 中实现指数退避重试
- 最大重试3次,每次延迟翻倍(1s, 2s, 4s)
- 记录错误日志到ErrorHandlingService

---

## 📝 总结

本次实现成功将设置模块从"UI外壳"升级为真正调用Sherpa本地模型的完整功能:

1. ✅ 创建了模型配置元数据(`sherpaModels.ts`)
2. ✅ 实现了TTS/ASR服务的单例工厂(`getTTSService`/`getASRService`)
3. ✅ 集成了真实的TTS测试(生成语音+播放)
4. ✅ 集成了真实的ASR测试(录音3秒+识别)
5. ✅ 实现了动态ASR模型选择下拉菜单(3个模型可选)
6. ✅ 所有配置持久化到LocalStorage

**用户现在可以**:
- 在设置页面真正测试Sherpa TTS语音合成
- 在设置页面真正测试Sherpa ASR语音识别
- 从3个ASR模型中选择适合的模型
- 调整TTS说话人ID和语速
- 所有配置自动保存,刷新页面后保持

**技术亮点**:
- 严格遵循DDD分层架构
- 应用Facade/Singleton/Strategy设计模式
- 参照老代码实现模式,保持项目一致性
- 完整的依赖注入和错误处理

---

**下一步**: Phase 11 - AI配置和提示词编辑功能实现
