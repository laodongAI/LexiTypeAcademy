# TTS/ASR API 需求分析与接口对比

## 当前系统需求

### 1. TTS (文本转语音) 需求

#### 使用场景
1. **听写模式 (DictationMode)**
   - 播放英文单词/句子
   - 需要清晰的发音
   - 可能需要重复播放

2. **跟读模式 (FollowMode)**
   - 播放标准发音供用户跟读
   - 需要支持多语言（英文、中文）
   - 可能需要调整语速

3. **模仿模式 (ImitationMode)**
   - 播放标准音频供对比
   - 需要高质量音频

#### 功能需求
- ✅ 文本转语音
- ✅ 支持多语言（英文、中文）
- ✅ 语速控制（可选）
- ✅ 音质选择（可选）
- ✅ 缓存机制（性能优化）
- ⚠️ 批量生成（课程导入时）
- ⚠️ 音频格式选择（MP3/WAV/OGG）

### 2. ASR (语音识别) 需求

#### 使用场景
1. **跟读模式 (FollowMode)**
   - 识别用户录音内容
   - 评估发音准确度
   - 计算评分（0-100）

2. **模仿模式 (ImitationMode)**
   - 识别用户发音
   - 多维度评分：
     - 准确度 (Accuracy)
     - 流畅度 (Fluency)
     - 完整度 (Completeness)
   - 与标准发音对比

3. **AI 实验室 - 音频导入**
   - 长音频转文本
   - 自动分段
   - 支持大文件

#### 功能需求
- ✅ 语音转文本
- ✅ 支持多语言（英文、中文）
- ✅ 发音评分
- ⚠️ 实时识别（流式）
- ⚠️ 音频分段识别
- ⚠️ 详细评分指标（准确度、流畅度、完整度）
- ⚠️ 与参考文本对比

---

## 现有 API 分析

### 已提供的接口（基于 API_REFERENCE.md）

根据附件内容，请提供以下信息：

#### 1. TTS 接口
- **接口地址**: ?
- **请求方法**: ?
- **请求参数**: 
  - text: 文本内容
  - language: 语言（en/zh）
  - rate: 语速（可选）
  - format: 音频格式（可选）
- **响应格式**: ?
- **错误处理**: ?

#### 2. ASR 接口
- **接口地址**: ?
- **请求方法**: ?
- **请求参数**:
  - audio: 音频数据（Blob/Base64/File）
  - language: 语言（en/zh）
  - referenceText: 参考文本（用于评分）
- **响应格式**: ?
- **返回数据**:
  - text: 识别文本
  - score: 评分（可选）
  - accuracy: 准确度（可选）
  - fluency: 流畅度（可选）
  - completeness: 完整度（可选）

---

## 接口需求对比

### ✅ 基础功能（必需）

| 功能 | 需求 | API支持 | 状态 |
|------|------|---------|------|
| TTS - 文本转语音 | ✅ | ? | 待确认 |
| TTS - 多语言支持 | ✅ | ? | 待确认 |
| TTS - 返回音频数据 | ✅ | ? | 待确认 |
| ASR - 语音转文本 | ✅ | ? | 待确认 |
| ASR - 多语言支持 | ✅ | ? | 待确认 |
| ASR - 发音评分 | ✅ | ? | 待确认 |

### ⚠️ 增强功能（建议）

| 功能 | 需求 | API支持 | 优先级 |
|------|------|---------|--------|
| TTS - 语速控制 | ⚠️ | ? | 中 |
| TTS - 批量生成 | ⚠️ | ? | 低 |
| TTS - 音频缓存 | ⚠️ | ? | 高 |
| ASR - 详细评分 | ⚠️ | ? | 高 |
| ASR - 流式识别 | ⚠️ | ? | 低 |
| ASR - 长音频处理 | ⚠️ | ? | 中 |

---

## 新增接口需求（如果现有 API 不满足）

### 1. TTS 接口建议

```typescript
// POST /api/tts/generate
interface TTSRequest {
  text: string              // 要转换的文本
  language: 'en' | 'zh'     // 语言
  voice?: string            // 音色选择（可选）
  rate?: number             // 语速：0.5-2.0，默认 1.0
  pitch?: number            // 音调：0.5-2.0，默认 1.0
  format?: 'mp3' | 'wav'    // 音频格式，默认 mp3
  cache?: boolean           // 是否缓存，默认 true
}

interface TTSResponse {
  success: boolean
  audio: string             // Base64 编码的音频数据
  url?: string              // 音频文件 URL（如果服务器存储）
  duration: number          // 音频时长（秒）
  cacheKey?: string         // 缓存键（用于后续请求）
  error?: string
}
```

### 2. ASR 接口建议

```typescript
// POST /api/asr/recognize
interface ASRRequest {
  audio: string | Blob      // 音频数据（Base64 或 Blob）
  language: 'en' | 'zh'     // 语言
  referenceText?: string    // 参考文本（用于评分）
  enableScore?: boolean     // 是否返回评分，默认 false
}

interface ASRResponse {
  success: boolean
  text: string              // 识别的文本
  confidence: number        // 置信度：0-1
  
  // 如果启用评分
  score?: {
    overall: number         // 总分：0-100
    accuracy: number        // 准确度：0-100
    fluency: number         // 流畅度：0-100
    completeness: number    // 完整度：0-100
    pronunciation: number   // 发音：0-100
  }
  
  // 详细信息
  words?: Array<{
    word: string
    startTime: number
    endTime: number
    confidence: number
  }>
  
  error?: string
}
```

### 3. 批量 TTS 接口（可选）

```typescript
// POST /api/tts/batch
interface BatchTTSRequest {
  items: Array<{
    id: string
    text: string
    language: 'en' | 'zh'
    rate?: number
  }>
  format?: 'mp3' | 'wav'
}

interface BatchTTSResponse {
  success: boolean
  results: Array<{
    id: string
    audio: string
    url?: string
    duration: number
    error?: string
  }>
}
```

### 4. 音频分段识别接口（可选）

```typescript
// POST /api/asr/segment
interface SegmentASRRequest {
  audio: string | Blob
  language: 'en' | 'zh'
  segmentMode: 'sentence' | 'paragraph' | 'time'
  maxSegmentDuration?: number  // 最大段落时长（秒）
}

interface SegmentASRResponse {
  success: boolean
  segments: Array<{
    id: string
    text: string
    startTime: number
    endTime: number
    confidence: number
  }>
  fullText: string
  error?: string
}
```

---

## 实现建议

### 客户端服务架构

```
audioPlayService.ts (现有)
    ↓ 调用
ttsApiService.ts (新建)
    ↓ HTTP
TTS API 服务器

audioRecordService.ts (现有)
    ↓ 调用
asrApiService.ts (新建)
    ↓ HTTP
ASR API 服务器
```

### 缓存策略

1. **TTS 缓存**
   - 使用 IndexedDB 缓存生成的音频
   - 键：`tts_${language}_${text_hash}`
   - 避免重复请求相同内容

2. **ASR 缓存**
   - 缓存识别结果（可选）
   - 键：`asr_${audio_hash}_${language}`

### 错误处理

1. **网络错误**: 重试机制（最多3次）
2. **超时处理**: 设置合理超时时间（30秒）
3. **降级策略**: 
   - TTS 失败 → 使用 Web Speech API
   - ASR 失败 → 提示用户手动输入

---

## 配置管理

```typescript
// config/api.ts
export const API_CONFIG = {
  TTS_BASE_URL: process.env.TTS_API_URL || 'http://localhost:3000',
  ASR_BASE_URL: process.env.ASR_API_URL || 'http://localhost:3000',
  TTS_TIMEOUT: 30000,
  ASR_TIMEOUT: 60000,
  ENABLE_CACHE: true,
  MAX_RETRY: 3,
}
```

---

## 待确认事项

请确认以下信息以便完成集成：

### 必需信息
1. ✅ TTS 接口完整规范（URL、参数、响应格式）
2. ✅ ASR 接口完整规范（URL、参数、响应格式）
3. ✅ 服务器地址和端口
4. ✅ 是否需要认证（API Key/Token）
5. ✅ 错误码定义

### 可选信息
6. ⚠️ 是否支持语速控制
7. ⚠️ 是否支持音频缓存
8. ⚠️ 是否支持批量处理
9. ⚠️ 是否支持流式识别
10. ⚠️ 发音评分的详细指标

---

## 下一步行动

1. **立即**: 请提供现有 API 的完整文档
2. **短期**: 根据文档实现 API 客户端服务
3. **中期**: 集成到音频服务和组件
4. **长期**: 优化性能和用户体验
