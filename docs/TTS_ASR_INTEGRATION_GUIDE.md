# TTS/ASR API 集成指南

## 📋 概述

本文档说明如何将外部 TTS/ASR API 服务集成到 LexiType Academy 系统中。

## 🎯 当前状态

### ✅ 已完成
1. ✅ 创建 TTS API 客户端服务 (`ttsApiService.ts`)
2. ✅ 创建 ASR API 客户端服务 (`asrApiService.ts`)
3. ✅ 集成到音频播放服务 (`audioPlayService.ts`)
4. ✅ 环境配置文件 (`.env.example`, `.env.development`)

### ⏳ 待完成
1. ⏳ 验证 API 接口对接（需要实际 API 文档）
2. ⏳ 集成 ASR 评分到练习组件
3. ⏳ 测试完整流程

## 📁 文件结构

```
vue-app/src/shared/services/
├── audioPlayService.ts      # 音频播放服务（已集成 TTS API）
├── audioRecordService.ts    # 录音服务
├── ttsApiService.ts         # TTS API 客户端（新增）
└── asrApiService.ts         # ASR API 客户端（新增）

vue-app/
├── .env.example            # 环境配置示例
└── .env.development        # 开发环境配置
```

## 🔧 配置说明

### 1. 环境变量

在项目根目录创建 `.env.local` 文件：

```bash
# TTS API 服务地址
VITE_TTS_API_URL=http://localhost:3000

# ASR API 服务地址
VITE_ASR_API_URL=http://localhost:3000
```

### 2. API 地址配置

根据实际部署情况修改：

**开发环境**: `.env.development`
```bash
VITE_TTS_API_URL=http://localhost:3000
VITE_ASR_API_URL=http://localhost:3000
```

**生产环境**: `.env.production`
```bash
VITE_TTS_API_URL=https://api.your-domain.com
VITE_ASR_API_URL=https://api.your-domain.com
```

## 📡 API 接口规范

### TTS API

#### 接口地址
```
POST ${VITE_TTS_API_URL}/api/tts/generate
```

#### 请求格式
```typescript
{
  text: string              // 要转换的文本
  language: 'en' | 'zh'     // 语言
  voice?: string            // 音色（可选）
  rate?: number             // 语速：0.5-2.0
  pitch?: number            // 音调：0.5-2.0
  format?: 'mp3' | 'wav'    // 音频格式
}
```

#### 响应格式
```typescript
{
  success: boolean
  audio?: string            // Base64 编码的音频数据
  url?: string              // 音频文件 URL
  duration?: number         // 音频时长（秒）
  error?: string            // 错误信息
  code?: string             // 错误码
}
```

### ASR API

#### 接口地址
```
POST ${VITE_ASR_API_URL}/api/asr/recognize
```

#### 请求格式（FormData）
```typescript
audio: Blob                 // 音频文件
language: 'en' | 'zh'       // 语言
referenceText?: string      // 参考文本（用于评分）
enableScore?: boolean       // 是否启用评分
```

#### 响应格式
```typescript
{
  success: boolean
  text?: string             // 识别的文本
  confidence?: number       // 置信度：0-1
  
  // 评分详情（如果 enableScore=true）
  score?: {
    overall: number         // 总分：0-100
    accuracy: number        // 准确度：0-100
    fluency: number         // 流畅度：0-100
    completeness: number    // 完整度：0-100
    pronunciation: number   // 发音：0-100
  }
  
  // 单词详情
  words?: Array<{
    word: string
    startTime: number
    endTime: number
    confidence: number
  }>
  
  error?: string
  code?: string
}
```

## 💻 使用示例

### 1. TTS 播放

```typescript
import { getAudioPlayService } from '@/shared/services/audioPlayService'

const audioService = getAudioPlayService()

// 播放文本（自动使用 TTS API）
await audioService.play({
  source: 'Hello, world!',
  type: 'tts',
  onEnded: () => console.log('播放完成'),
  onError: (error) => console.error('播放失败', error)
})
```

### 2. ASR 识别

```typescript
import { getASRApiService } from '@/shared/services/asrApiService'

const asrService = getASRApiService()

// 识别录音
const response = await asrService.recognize({
  audio: recordedBlob,
  language: 'en'
})

if (response.success) {
  console.log('识别文本:', response.text)
  console.log('置信度:', response.confidence)
}
```

### 3. 发音评分

```typescript
import { scorePronunciation } from '@/shared/services/asrApiService'

// 评估发音
const score = await scorePronunciation(
  recordedBlob,
  'Hello, world!',  // 参考文本
  'en'
)

if (score) {
  console.log('总分:', score.overall)
  console.log('准确度:', score.accuracy)
  console.log('流畅度:', score.fluency)
  console.log('完整度:', score.completeness)
  console.log('发音:', score.pronunciation)
}
```

## 🔌 组件集成示例

### DictationMode 听写模式

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { getAudioPlayService } from '@/shared/services/audioPlayService'

const audioService = getAudioPlayService()
const isPlaying = ref(false)

async function playAudio() {
  if (isPlaying.value) {
    audioService.stop()
    isPlaying.value = false
    return
  }
  
  isPlaying.value = true
  
  // 使用 TTS 播放文本
  await audioService.play({
    source: props.item.english,
    type: 'tts',
    onEnded: () => { isPlaying.value = false },
    onError: () => { isPlaying.value = false }
  })
}
</script>
```

### FollowMode 跟读模式

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { getAudioRecordService } from '@/shared/services/audioRecordService'
import { scorePronunciation } from '@/shared/services/asrApiService'
import { ElMessage } from 'element-plus'

const recordService = getAudioRecordService()
const isRecording = ref(false)
const score = ref<number>(0)
const showResult = ref(false)

async function toggleRecording() {
  if (isRecording.value) {
    // 停止录音并评分
    try {
      const audioBlob = await recordService.stopRecording()
      isRecording.value = false
      
      // 调用 ASR API 评分
      ElMessage.info('正在评分...')
      const scoreResult = await scorePronunciation(
        audioBlob,
        props.item.english,
        'en'
      )
      
      if (scoreResult) {
        score.value = scoreResult.overall
        showResult.value = true
        ElMessage.success('评分完成！')
      } else {
        ElMessage.error('评分失败')
      }
    } catch (error) {
      isRecording.value = false
      ElMessage.error('录音失败')
    }
  } else {
    // 开始录音
    await recordService.startRecording({
      maxDuration: 30000,
      onStart: () => { isRecording.value = true }
    })
  }
}
</script>
```

## 🚨 错误处理

### 常见错误

1. **网络错误**
```typescript
{
  success: false,
  error: 'Failed to fetch',
  code: 'NETWORK_ERROR'
}
```

2. **API 超时**
```typescript
{
  success: false,
  error: 'Request timeout',
  code: 'TIMEOUT_ERROR'
}
```

3. **音频格式错误**
```typescript
{
  success: false,
  error: 'Unsupported audio format',
  code: 'FORMAT_ERROR'
}
```

### 处理方式

```typescript
try {
  const response = await asrService.recognize({ audio, language: 'en' })
  
  if (!response.success) {
    // 显示错误信息
    ElMessage.error(response.error || '识别失败')
    
    // 根据错误码处理
    switch (response.code) {
      case 'NETWORK_ERROR':
        // 检查网络连接
        break
      case 'TIMEOUT_ERROR':
        // 提示重试
        break
      default:
        // 通用错误处理
    }
  }
} catch (error) {
  console.error('ASR 调用异常:', error)
  ElMessage.error('服务异常，请稍后重试')
}
```

## 🎨 性能优化

### 1. TTS 缓存

TTS API 服务已内置缓存机制：

```typescript
// 相同的文本会自动使用缓存
await generateSpeech('Hello', 'en')  // 第一次调用 API
await generateSpeech('Hello', 'en')  // 从缓存获取
```

### 2. 批量处理

```typescript
import { getTTSApiService } from '@/shared/services/ttsApiService'

const ttsService = getTTSApiService()

// 批量生成多个音频
const requests = lessons.map(lesson => ({
  text: lesson.english,
  language: 'en' as const
}))

const responses = await ttsService.batchGenerate(requests)
```

### 3. 预加载

```typescript
// 在课程加载时预生成音频
async function preloadAudio(lesson: Lesson) {
  for (const item of lesson.items) {
    // 异步生成并缓存
    generateSpeech(item.english, 'en').catch(console.error)
  }
}
```

## 🔍 调试

### 启用调试日志

在浏览器控制台中：

```javascript
// 查看 API 请求
window.localStorage.setItem('debug', 'tts,asr')

// 清除 TTS 缓存
import { getTTSApiService } from '@/shared/services/ttsApiService'
getTTSApiService().clearCache()
```

### 测试 API 连接

```typescript
// 测试 TTS API
import { generateSpeech } from '@/shared/services/ttsApiService'
const url = await generateSpeech('test', 'en')
console.log('TTS 测试:', url ? '成功' : '失败')

// 测试 ASR API
import { recognizeSpeech } from '@/shared/services/asrApiService'
const text = await recognizeSpeech(audioBlob, 'en')
console.log('ASR 测试:', text || '失败')
```

## 📝 下一步工作

### 立即完成
1. ✅ 获取实际 API 文档
2. ⏳ 验证接口格式
3. ⏳ 调整请求/响应结构
4. ⏳ 更新组件集成代码

### 短期计划
5. ⏳ 在 FollowMode 中集成 ASR 评分
6. ⏳ 在 ImitationMode 中集成多维度评分
7. ⏳ 完整测试所有场景

### 中期计划
8. ⏳ 优化缓存策略
9. ⏳ 添加离线支持
10. ⏳ 性能监控和优化

## 🤝 协作事项

### 需要后端提供

请后端 API 开发人员确认或实现以下接口：

#### 1. TTS 接口（必需）
- ✅ 基础 TTS 功能
- ⚠️ 语速控制
- ⚠️ 多语言支持（英文、中文）
- ⚠️ 音频缓存机制

#### 2. ASR 接口（必需）
- ✅ 基础语音识别
- ✅ 发音评分功能
- ⚠️ 详细评分指标（准确度、流畅度、完整度）
- ⚠️ 单词级别分析

#### 3. 额外接口（可选）
- ⚠️ 批量 TTS 生成
- ⚠️ 音频分段识别
- ⚠️ 流式语音识别

### API 文档需求

请提供完整的 API 文档，包括：

1. **接口地址**: 完整的 URL 路径
2. **请求方法**: GET/POST 等
3. **请求参数**: 详细的参数说明和类型
4. **请求示例**: 实际的请求示例
5. **响应格式**: 完整的响应结构
6. **响应示例**: 成功和失败的响应示例
7. **错误码**: 所有可能的错误码和说明
8. **限流规则**: API 调用频率限制
9. **认证方式**: 是否需要 API Key 或 Token

## 📞 联系方式

如有问题，请联系：
- 前端开发：[你的联系方式]
- 后端开发：[后端联系方式]
- 项目文档：`docs/TTS_ASR_API_REQUIREMENTS.md`

---

**文档版本**: v1.0  
**更新日期**: 2026-01-06  
**状态**: 待验证 API 接口
