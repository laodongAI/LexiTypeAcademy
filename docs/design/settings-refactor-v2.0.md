# 设置模块重构设计 v2.0 - 移除多语言支持

**版本**: v2.0  
**日期**: 2025-12-07  
**状态**: 设计中  

---

## 📋 重构目标

### 核心变更
1. **移除多语言支持** - 应用改为纯中文界面
2. **完善通用设置** - 添加字体大小和字体系列配置
3. **建立配置读取机制** - 确保各模块能正确读取和应用设置

### 设计原则
- 保持DDD架构清晰分层
- 配置集中管理在AudioSettingsService
- 各模块通过Service读取配置,不直接访问LocalStorage
- 设置测试功能验证配置是否被正确应用

---

## 🏗️ 架构设计

### 1. 配置存储层次

```
┌─────────────────────────────────────────┐
│         SettingsPage (UI Layer)         │
│  - 配置界面展示和用户交互              │
└──────────────────┬──────────────────────┘
                   │ 调用
                   ↓
┌─────────────────────────────────────────┐
│   AudioSettingsService (Application)    │
│  - 配置读写Facade                       │
│  - 提供类型安全的配置访问               │
└──────────────────┬──────────────────────┘
                   │ 使用
                   ↓
┌─────────────────────────────────────────┐
│ LocalStorageSettingsStorage (Infra)     │
│  - LocalStorage持久化                   │
│  - 深度合并配置                         │
└─────────────────────────────────────────┘

配置消费者:
  - TTSService → 读取 tts 配置
  - ASRService → 读取 asr 配置  
  - App组件 → 读取 general 配置(主题/字体)
```

### 2. 配置流转机制

```typescript
// 写入流程
用户修改设置 
  → SettingsPage.onChange()
  → settingsService.updateGeneralConfig(partial)
  → storage.update({ general: partial })
  → localStorage.setItem('lexitype_settings_v1', JSON.stringify(settings))

// 读取流程
组件初始化
  → const config = settingsService.getGeneralConfig()
  → 应用配置(设置CSS变量/主题类名)
```

---

## 📝 数据结构设计

### GeneralConfig (通用配置)

**重构前**:
```typescript
interface GeneralConfig {
  language: string;      // 'zh-CN' | 'en-US'
  theme: 'light' | 'dark';
  autoSave: boolean;
}
```

**重构后**:
```typescript
interface GeneralConfig {
  /** 主题模式 */
  theme: 'light' | 'dark';
  
  /** 字体大小 (px) */
  fontSize: number;        // 12-24, 默认16
  
  /** 字体系列 */
  fontFamily: string;      // 'system' | 'serif' | 'mono'
  
  /** 自动保存间隔 (秒) */
  autoSaveInterval: number; // 0=禁用, >0=启用
}
```

### 默认配置

```typescript
export const DEFAULT_SETTINGS: AppSettings = {
  general: {
    theme: 'light',
    fontSize: 16,
    fontFamily: 'system',
    autoSaveInterval: 30  // 30秒自动保存
  },
  
  tts: {
    provider: TTSProviderType.SHERPA_ONNX,
    sherpa: {
      speakerId: 0,
      speed: 1.0
    }
  },
  
  asr: {
    provider: ASRProviderType.SHERPA_ONNX,
    language: 'zh-CN',  // 固定中文,但ASR可能需要识别英文
    enableVAD: true,
    enableAlignment: true,
    sherpa: {
      sampleRate: 16000,
      maxDuration: 60,
      modelPath: '/sherpa/...'
    }
  },
  
  promptSound: {
    enabled: true,
    volume: 50
  },
  
  lastUpdated: Date.now()
};
```

### 字体系统映射

```typescript
export const FONT_FAMILIES = {
  system: {
    name: '系统默认',
    value: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  serif: {
    name: '衬线字体',
    value: 'Georgia, "Times New Roman", serif'
  },
  mono: {
    name: '等宽字体',
    value: '"Courier New", Consolas, monospace'
  }
} as const;
```

---

## 🎨 UI层设计

### SettingsPage 通用设置区域

```tsx
// 渲染通用设置内容
const renderGeneralSettings = () => {
  return React.createElement('div', { className: 'space-y-6' },
    
    // 主题切换
    React.createElement('div', null,
      React.createElement('label', { className: '...' }, '主题模式'),
      React.createElement('div', { className: 'flex gap-3' },
        // Light按钮
        React.createElement('button', {
          onClick: () => handleThemeChange('light'),
          className: theme === 'light' ? '激活样式' : '非激活样式'
        }, 
          React.createElement('svg', { /* 太阳图标 */ }),
          '浅色模式'
        ),
        // Dark按钮
        React.createElement('button', {
          onClick: () => handleThemeChange('dark'),
          className: theme === 'dark' ? '激活样式' : '非激活样式'
        },
          React.createElement('svg', { /* 月亮图标 */ }),
          '深色模式'
        )
      )
    ),
    
    // 字体大小滑块
    React.createElement('div', null,
      React.createElement('label', null, `字体大小: ${fontSize}px`),
      React.createElement('input', {
        type: 'range',
        min: 12,
        max: 24,
        value: fontSize,
        onChange: (e) => handleFontSizeChange(Number(e.target.value))
      }),
      React.createElement('div', { className: 'flex justify-between text-xs' },
        React.createElement('span', null, '小 (12px)'),
        React.createElement('span', null, '中 (16px)'),
        React.createElement('span', null, '大 (24px)')
      )
    ),
    
    // 字体系列选择
    React.createElement('div', null,
      React.createElement('label', null, '字体系列'),
      React.createElement('select', {
        value: fontFamily,
        onChange: (e) => handleFontFamilyChange(e.target.value)
      },
        React.createElement('option', { value: 'system' }, '系统默认'),
        React.createElement('option', { value: 'serif' }, '衬线字体 (更正式)'),
        React.createElement('option', { value: 'mono' }, '等宽字体 (代码风格)')
      )
    ),
    
    // 自动保存
    React.createElement('div', null,
      React.createElement('label', { className: 'flex items-center gap-2' },
        React.createElement('input', {
          type: 'checkbox',
          checked: autoSaveInterval > 0,
          onChange: (e) => handleAutoSaveChange(e.target.checked)
        }),
        '启用自动保存'
      ),
      autoSaveInterval > 0 && React.createElement('div', { className: 'ml-6 mt-2' },
        React.createElement('label', null, `保存间隔: ${autoSaveInterval}秒`),
        React.createElement('input', {
          type: 'range',
          min: 10,
          max: 300,
          step: 10,
          value: autoSaveInterval,
          onChange: (e) => handleAutoSaveIntervalChange(Number(e.target.value))
        })
      )
    ),
    
    // 保存和重置按钮
    React.createElement('div', { className: 'flex gap-4 pt-4 border-t' },
      React.createElement('button', {
        onClick: handleSaveSettings,
        className: '保存按钮样式'
      }, '保存设置'),
      React.createElement('button', {
        onClick: handleResetSettings,
        className: '重置按钮样式'
      }, '恢复默认')
    )
  );
};
```

### 移除的UI元素

- ❌ 语言选择下拉菜单 (general设置中)
- ❌ 多语言切换按钮
- ❌ i18n相关的t()函数调用

### 保留的UI元素

- ✅ ASR语言设置 (用于语音识别引擎,不是界面语言)
- ✅ TTS语音选择 (中英文发音人)

---

## 🔧 实现计划

### Phase 1: 更新类型定义和默认配置

**文件**:
- `src/infrastructure/audio/settings/types.ts`
- `src/infrastructure/audio/settings/defaults.ts`

**变更**:
1. 移除 `GeneralConfig.language` 字段
2. 添加 `GeneralConfig.fontSize` 字段
3. 添加 `GeneralConfig.fontFamily` 字段
4. 修改 `GeneralConfig.autoSave` 为 `autoSaveInterval: number`
5. 移除 `SUPPORTED_LANGUAGES` 常量
6. 添加 `FONT_FAMILIES` 常量

### Phase 2: 更新SettingsPage UI

**文件**:
- `src/ui/pages/settings/SettingsPage.tsx`

**变更**:
1. 移除 `language` state和相关函数
2. 添加 `fontSize` state (默认16)
3. 添加 `fontFamily` state (默认'system')
4. 修改 `autoSave` 为 `autoSaveInterval` (默认30)
5. 重写 `renderGeneralSettings()` 方法
6. 移除语言选择相关JSX
7. 添加字体大小滑块
8. 添加字体系列下拉菜单
9. 更新保存/加载逻辑

### Phase 3: 实现配置应用机制

**新建文件**: `src/app/ThemeManager.ts`

```typescript
/**
 * 主题管理器
 * 负责应用通用配置到DOM
 */
export class ThemeManager {
  private settingsService: AudioSettingsService;
  
  constructor() {
    this.settingsService = getAudioSettingsService();
  }
  
  /**
   * 应用所有通用配置
   */
  applyGeneralSettings(): void {
    const config = this.settingsService.getGeneralConfig();
    
    // 应用主题
    this.applyTheme(config.theme);
    
    // 应用字体大小
    this.applyFontSize(config.fontSize);
    
    // 应用字体系列
    this.applyFontFamily(config.fontFamily);
  }
  
  /**
   * 应用主题
   */
  private applyTheme(theme: 'light' | 'dark'): void {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }
  
  /**
   * 应用字体大小
   */
  private applyFontSize(fontSize: number): void {
    document.documentElement.style.setProperty('--base-font-size', `${fontSize}px`);
  }
  
  /**
   * 应用字体系列
   */
  private applyFontFamily(fontFamily: string): void {
    const fontValue = FONT_FAMILIES[fontFamily as keyof typeof FONT_FAMILIES]?.value || FONT_FAMILIES.system.value;
    document.documentElement.style.setProperty('--base-font-family', fontValue);
  }
  
  /**
   * 监听配置变化
   */
  watchSettings(): void {
    // 可以使用EventBus监听SettingsChangedEvent
    // 或者使用polling轮询检查lastUpdated
    setInterval(() => {
      this.applyGeneralSettings();
    }, 1000);
  }
}

// 全局单例
let themeManagerInstance: ThemeManager | null = null;

export function getThemeManager(): ThemeManager {
  if (!themeManagerInstance) {
    themeManagerInstance = new ThemeManager();
  }
  return themeManagerInstance;
}
```

**集成到App.tsx**:

```typescript
// src/App.tsx
import { useEffect } from 'react';
import { getThemeManager } from '@/app/ThemeManager';

function App() {
  useEffect(() => {
    const themeManager = getThemeManager();
    
    // 初始应用配置
    themeManager.applyGeneralSettings();
    
    // 监听配置变化
    themeManager.watchSettings();
  }, []);
  
  return (
    // ... 应用内容
  );
}
```

### Phase 4: TTS/ASR服务读取配置

**TTSService初始化时读取配置**:

```typescript
// src/infrastructure/audio/tts/index.ts
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    const settingsService = getAudioSettingsService();
    const ttsConfig = settingsService.getTTSConfig();
    
    // 根据配置创建Provider
    const primaryProvider = new SherpaOnnxTTSProvider(ttsConfig.sherpa);
    const fallbackProvider = new SystemTTSProvider(ttsConfig.system);
    
    // ... 其他初始化
  }
  return ttsServiceInstance;
}
```

**ASRService初始化时读取配置**:

```typescript
// src/infrastructure/audio/asr/index.ts
export function getASRService(): ASRService {
  if (!asrServiceInstance) {
    const settingsService = getAudioSettingsService();
    const asrConfig = settingsService.getASRConfig();
    
    // 根据配置创建Provider
    const primaryProvider = new SherpaOnnxASRProvider(asrConfig.sherpa);
    
    // ... 其他初始化
  }
  return asrServiceInstance;
}
```

### Phase 5: 设置测试功能验证

**TTS测试按钮验证**:
```typescript
// 点击"测试语音合成"按钮时:
const ttsService = getTTSService();
const ttsConfig = settingsService.getTTSConfig();

// 使用当前配置生成语音
const result = await ttsService.generate({
  text: '这是中文语音合成测试',
  // 以下参数应该来自ttsConfig
  voice: `speaker_${ttsConfig.sherpa.speakerId}`,
  rate: ttsConfig.sherpa.speed,
});

// 播放并显示使用的配置
console.log('使用的TTS配置:', ttsConfig);
alert(`
  TTS测试成功!
  使用配置:
  - 提供者: ${ttsConfig.provider}
  - 发音人ID: ${ttsConfig.sherpa.speakerId}
  - 语速: ${ttsConfig.sherpa.speed}x
  - 音频时长: ${result.duration.toFixed(2)}秒
`);
```

**ASR测试按钮验证**:
```typescript
// 点击"测试语音识别"按钮时:
const asrService = getASRService();
const asrConfig = settingsService.getASRConfig();

// 使用当前配置识别语音
const result = await asrService.recognize({
  audio: audioBlob,
  // 以下参数应该来自asrConfig
  language: asrConfig.language,
  enableVAD: asrConfig.enableVAD,
  modelPath: asrConfig.sherpa.modelPath
});

// 显示识别结果和使用的配置
console.log('使用的ASR配置:', asrConfig);
alert(`
  ASR测试成功!
  使用配置:
  - 提供者: ${asrConfig.provider}
  - 模型: ${asrConfig.sherpa.modelPath}
  - 语言: ${asrConfig.language}
  - VAD: ${asrConfig.enableVAD ? '启用' : '禁用'}
  识别结果: ${result.text}
`);
```

---

## 📊 配置流转追踪

### 通用配置流转

```
用户操作: 切换到深色主题
  ↓
SettingsPage.handleThemeChange('dark')
  ↓
settingsService.updateGeneralConfig({ theme: 'dark' })
  ↓
LocalStorage: lexitype_settings_v1.general.theme = 'dark'
  ↓
ThemeManager 检测到变化
  ↓
document.documentElement.classList.add('dark')
  ↓
界面应用深色主题 ✅
```

### TTS配置流转

```
用户操作: 修改说话人ID为2
  ↓
SettingsPage.handleSpeakerChange(2)
  ↓
settingsService.updateTTSConfig({ sherpa: { speakerId: 2, speed: 1.0 } })
  ↓
LocalStorage: lexitype_settings_v1.tts.sherpa.speakerId = 2
  ↓
用户点击"测试TTS"
  ↓
getTTSService() 读取配置
  ↓
ttsService.generate() 使用 speakerId=2 生成语音 ✅
```

### ASR配置流转

```
用户操作: 选择Whisper Tiny模型
  ↓
SettingsPage.handleModelChange('/sherpa/whisper_tiny')
  ↓
settingsService.updateASRConfig({ sherpa: { modelPath: '...' } })
  ↓
LocalStorage: lexitype_settings_v1.asr.sherpa.modelPath = '...'
  ↓
用户点击"测试ASR"
  ↓
getASRService() 读取配置
  ↓
asrService.recognize() 使用Whisper模型识别 ✅
```

---

## ✅ 验收标准

### 功能验收

1. **通用设置**
   - [ ] 移除语言选择UI,界面固定为中文
   - [ ] 主题切换正常(浅色/深色)
   - [ ] 字体大小滑块调整后立即生效
   - [ ] 字体系列切换后立即生效
   - [ ] 自动保存间隔可配置
   - [ ] 刷新页面后配置保持

2. **TTS设置**
   - [ ] 修改发音人ID后,测试按钮使用新配置
   - [ ] 修改语速后,测试按钮使用新语速
   - [ ] 测试弹窗显示实际使用的配置参数

3. **ASR设置**
   - [ ] 切换模型后,测试按钮加载新模型
   - [ ] 修改VAD设置后,测试按钮应用新设置
   - [ ] 测试弹窗显示实际使用的配置参数

4. **配置持久化**
   - [ ] 所有配置保存到LocalStorage
   - [ ] 配置深度合并(不覆盖未修改字段)
   - [ ] 重置按钮恢复所有默认值

### 代码质量

- [ ] TypeScript类型检查通过 (`npm run typecheck`)
- [ ] 编译成功 (`npm run build`)
- [ ] 无控制台错误
- [ ] 代码遵循DDD分层架构
- [ ] 所有中文字符串使用UTF-8编码

---

## 🚀 实施步骤

1. **更新设计文档** ✅ (当前文件)
2. **修复TypeScript错误** (types.ts, ReviewManager.tsx, electron.d.ts)
3. **更新类型定义** (GeneralConfig接口)
4. **更新默认配置** (DEFAULT_SETTINGS常量)
5. **更新SettingsPage** (移除语言选择,添加字体设置)
6. **创建ThemeManager** (应用配置到DOM)
7. **集成到App.tsx** (初始化ThemeManager)
8. **更新TTSService** (读取配置初始化)
9. **更新ASRService** (读取配置初始化)
10. **增强测试按钮** (显示实际使用的配置)
11. **运行typecheck** → **运行build** → **手动测试**

---

## 📝 备注

- ASR的`language`字段保留,因为语音识别引擎需要知道识别什么语言
- 旧的多语言文本可以从`src_bak/i18n/`中提取,转为纯中文硬编码
- 字体设置通过CSS变量实现,避免直接操作每个元素的style
- ThemeManager使用轮询检测配置变化,未来可优化为EventBus事件驱动

