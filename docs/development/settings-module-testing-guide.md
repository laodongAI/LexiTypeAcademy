# 音频设置模块测试指南

## 测试环境

- **开发服务器**: http://localhost:5173
- **测试页面**: http://localhost:5173/test-settings.html
- **设置页面**: http://localhost:5173 (导航到设置)

## 测试准备

1. 启动开发服务器:
   ```bash
   npm run dev
   ```

2. 打开浏览器 DevTools (F12) 查看 Console 和 Application > LocalStorage

## 测试用例

### 1. TTS配置测试

#### 1.1 Provider切换测试
- [ ] 打开测试页面 http://localhost:5173/test-settings.html
- [ ] 点击 "切换到 Sherpa-ONNX"
- [ ] 验证: 配置显示区域显示 `provider: "sherpa-onnx"`
- [ ] 点击 "切换到 Edge TTS"
- [ ] 验证: 配置显示 `provider: "edge"`
- [ ] 点击 "切换到 System TTS"
- [ ] 验证: 配置显示 `provider: "system"`

**预期结果**: provider字段正确更新,配置持久化到LocalStorage

#### 1.2 Sherpa配置测试
前提: 先切换到 Sherpa-ONNX

- [ ] 点击 "说话人 ID: 0"
- [ ] 验证: `sherpa.speakerId: 0`
- [ ] 点击 "说话人 ID: 5"
- [ ] 验证: `sherpa.speakerId: 5`
- [ ] 点击 "语速: 1.5x"
- [ ] 验证: `sherpa.speed: 1.5`
- [ ] 点击 "语速: 0.8x"
- [ ] 验证: `sherpa.speed: 0.8`

**预期结果**: sherpa配置正确更新,其他字段保持不变

#### 1.3 Edge TTS配置测试
前提: 切换到 Edge TTS

- [ ] 打开主应用设置页面
- [ ] 在TTS设置中选择 Edge TTS
- [ ] 选择不同的语音 (Jenny/Guy/晓晓)
- [ ] 验证: `edge.voiceName` 正确更新

**预期结果**: Edge配置独立更新,不影响Sherpa配置

### 2. ASR配置测试

#### 2.1 Provider切换测试
- [ ] 点击 "切换到 Sherpa-ONNX"
- [ ] 验证: 配置显示 `provider: "sherpa-onnx"`
- [ ] 点击 "切换到 API服务"
- [ ] 验证: 配置显示 `provider: "api"`

**预期结果**: ASR provider正确切换

#### 2.2 语言配置测试
- [ ] 点击 "English (US)"
- [ ] 验证: `language: "en-US"`
- [ ] 点击 "中文 (简体)"
- [ ] 验证: `language: "zh-CN"`

**预期结果**: 语言配置正确更新

#### 2.3 Sherpa配置显示
前提: 切换到 Sherpa-ONNX

- [ ] 点击 "📖 获取ASR配置"
- [ ] 验证: 显示 `sherpa.sampleRate: 16000`
- [ ] 验证: 显示 `sherpa.maxDuration: 30`

**预期结果**: Sherpa只读配置正确显示

### 3. 完整配置管理测试

#### 3.1 查看完整配置
- [ ] 点击 "📖 查看完整配置"
- [ ] 验证: 显示包含 general/tts/asr/promptSound 的完整JSON

**预期结果**: 显示完整的AppSettings对象

#### 3.2 配置导出测试
- [ ] 修改一些TTS和ASR配置
- [ ] 点击 "💾 导出配置"
- [ ] 验证: 浏览器下载 `lexitype-settings-[时间戳].json` 文件
- [ ] 打开下载的JSON文件
- [ ] 验证: 包含所有修改后的配置

**预期结果**: JSON文件包含完整配置,可读性好(格式化)

#### 3.3 配置导入测试 (手动)
- [ ] 修改导出的JSON文件 (如改speakerId为99)
- [ ] 在主应用设置页面使用导入功能(如果已实现)
- [ ] 或者: 手动执行 `service.importConfig(jsonString)` 在Console
- [ ] 验证: 配置被正确导入

**预期结果**: 导入的配置覆盖当前配置

#### 3.4 重置为默认值测试
- [ ] 修改多个配置项
- [ ] 点击 "🔄 重置为默认"
- [ ] 确认弹窗
- [ ] 验证: TTS provider恢复为 "sherpa-onnx"
- [ ] 验证: Sherpa speakerId恢复为 0
- [ ] 验证: Sherpa speed恢复为 1.0
- [ ] 验证: ASR provider恢复为 "sherpa-onnx"
- [ ] 验证: ASR language恢复为 "en-US"

**预期结果**: 所有配置恢复为DEFAULT_SETTINGS中的默认值

### 4. 持久化测试

#### 4.1 刷新页面测试
- [ ] 修改TTS provider为 "edge"
- [ ] 修改Sherpa speakerId为 10
- [ ] 刷新页面 (F5)
- [ ] 点击 "📖 获取TTS配置"
- [ ] 验证: provider仍为 "edge"
- [ ] 验证: speakerId仍为 10

**预期结果**: 配置在页面刷新后保持不变

#### 4.2 跨页面测试
- [ ] 在测试页面修改TTS配置
- [ ] 打开主应用 (另一个标签页)
- [ ] 导航到设置页面
- [ ] 验证: TTS设置显示修改后的配置

**预期结果**: LocalStorage在不同页面间共享

#### 4.3 LocalStorage检查
- [ ] 打开 DevTools > Application > LocalStorage
- [ ] 查找 `lexitype_settings_v1` key
- [ ] 验证: 值是格式化的JSON对象
- [ ] 修改配置后再次检查
- [ ] 验证: JSON立即更新

**预期结果**: LocalStorage实时同步

### 5. 边界测试

#### 5.1 无效provider测试 (Console手动)
```javascript
service.updateTTSConfig({ provider: 'invalid' })
```
**预期结果**: 不应崩溃,可能静默忽略或记录错误

#### 5.2 speakerId边界测试
- [ ] 手动修改 speakerId 为 -1 (Console)
- [ ] 验证: UI显示正常或修正为 0

- [ ] 修改 speakerId 为 999
- [ ] 验证: 不应崩溃,允许或限制在100

**预期结果**: 边界值处理合理,不崩溃

#### 5.3 缺少子配置测试
- [ ] 切换到 System TTS
- [ ] 尝试修改 sherpa.speakerId (Console)
```javascript
service.updateTTSConfig({ sherpa: { speakerId: 5, speed: 1.0 } })
```
- [ ] 验证: 不影响当前 provider="system"

**预期结果**: 可以预设其他provider的配置,不影响当前使用

### 6. UI集成测试 (主应用设置页面)

#### 6.1 TTS设置UI
- [ ] 打开主应用设置页面
- [ ] 点击 "语音合成 (TTS)" tab
- [ ] 验证: Provider选择器显示当前值
- [ ] 切换provider到 Sherpa-ONNX
- [ ] 验证: 显示蓝色配置区域
- [ ] 拖动 speakerId 滑块
- [ ] 验证: 标签实时更新 "说话人ID: X"
- [ ] 拖动 speed 滑块
- [ ] 验证: 标签显示 "语速: X.Xx"

**预期结果**: UI响应流畅,实时显示配置值

#### 6.2 ASR设置UI
- [ ] 点击 "语音识别 (ASR)" tab
- [ ] 切换provider到 Sherpa-ONNX
- [ ] 验证: 显示采样率和最大时长(只读)
- [ ] 切换到 API
- [ ] 验证: 显示语言选择器
- [ ] 修改语言
- [ ] 验证: 配置更新

**预期结果**: ASR UI正确显示不同provider的配置

#### 6.3 测试按钮 (预留)
- [ ] 点击 "测试语音合成" 按钮
- [ ] 验证: 显示提示 "需要集成TTS服务" (当前阶段)

**预期结果**: 按钮可点击,提示功能待实现

### 7. 性能测试

#### 7.1 快速切换测试
- [ ] 快速连续点击 provider 切换按钮 (10次)
- [ ] 验证: 不卡顿,不崩溃
- [ ] 验证: 最终配置是最后一次点击的值

**预期结果**: 连续操作稳定,配置最终一致

#### 7.2 大量配置更新
- [ ] 执行循环更新 (Console):
```javascript
for (let i = 0; i < 100; i++) {
  service.updateTTSConfig({ sherpa: { speakerId: i % 100, speed: 1.0 } });
}
```
- [ ] 验证: 不阻塞UI
- [ ] 验证: 最终值为99

**预期结果**: 批量更新不影响性能

## 测试报告模板

| 测试用例 | 状态 | 备注 |
|---------|------|------|
| TTS Provider切换 | ✅ / ❌ | |
| Sherpa配置更新 | ✅ / ❌ | |
| ASR Provider切换 | ✅ / ❌ | |
| 配置导出 | ✅ / ❌ | |
| 配置重置 | ✅ / ❌ | |
| 持久化验证 | ✅ / ❌ | |
| UI集成 | ✅ / ❌ | |
| 边界处理 | ✅ / ❌ | |

## 已知限制

1. **测试TTS/ASR按钮**: 当前只显示提示,实际音频测试需要集成TTS/ASR服务层
2. **配置导入UI**: 主应用设置页面暂未实现导入按钮,需手动测试
3. **System TTS配置**: UI未实现System provider的详细配置选项

## 下一步集成

- [ ] TTS服务读取AudioSettingsService初始化
- [ ] ASR服务读取AudioSettingsService初始化
- [ ] 配置变更时重新初始化服务
- [ ] 实现真实的"测试TTS"和"测试ASR"功能
