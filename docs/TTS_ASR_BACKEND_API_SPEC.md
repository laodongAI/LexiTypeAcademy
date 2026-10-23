# TTS/ASR API 后端接口需求文档

## 📋 文档说明

本文档为 LexiType Academy 前端系统所需的 TTS 和 ASR API 接口规范。请后端开发人员根据此文档实现或调整现有接口。

---

## 🎯 核心需求

### 1. TTS (文本转语音) API

#### 功能概述
- 将文本转换为语音音频
- 支持多语言（英文、中文）
- 支持语速控制
- 返回音频数据或 URL

#### 使用场景
- 听写练习：播放单词/句子
- 跟读练习：提供标准发音
- 模仿练习：对比标准音频

#### 预计调用量
- 开发阶段：~100 次/天
- 生产阶段：~1000-5000 次/天

---

### 2. ASR (语音识别) API

#### 功能概述
- 将语音转换为文本
- 支持多语言（英文、中文）
- 提供发音评分
- 返回详细的评分指标

#### 使用场景
- 跟读练习：识别用户发音并评分
- 模仿练习：多维度评分分析
- AI 音频导入：长音频转文本

#### 预计调用量
- 开发阶段：~50 次/天
- 生产阶段：~500-2000 次/天

---

## 📡 接口规范

### 接口 1: TTS 生成语音

#### 基本信息
- **接口名称**: 文本转语音
- **接口路径**: `/api/tts/generate`
- **请求方法**: `POST`
- **Content-Type**: `application/json`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| text | string | ✅ | 要转换的文本 | "Hello, world!" |
| language | string | ✅ | 语言代码 | "en" 或 "zh" |
| voice | string | ❌ | 音色/说话人 | "male" 或 "female" |
| rate | number | ❌ | 语速（0.5-2.0） | 1.0 |
| pitch | number | ❌ | 音调（0.5-2.0） | 1.0 |
| format | string | ❌ | 音频格式 | "mp3" 或 "wav" |

**语言代码说明**:
- `en` 或 `en-US`: 英语
- `zh` 或 `zh-CN`: 中文

#### 请求示例

```json
{
  "text": "Hello, world!",
  "language": "en",
  "rate": 1.0,
  "format": "mp3"
}
```

#### 响应格式

**成功响应**:
```json
{
  "success": true,
  "audio": "base64_encoded_audio_data...",
  "url": "https://api.example.com/audio/abc123.mp3",
  "duration": 2.5,
  "cacheKey": "tts_en_1.0_hash123"
}
```

**失败响应**:
```json
{
  "success": false,
  "error": "Invalid language code",
  "code": "INVALID_LANGUAGE"
}
```

#### 响应字段说明

| 字段名 | 类型 | 必返回 | 说明 |
|-------|------|--------|------|
| success | boolean | ✅ | 是否成功 |
| audio | string | ⚠️ | Base64 编码的音频（二选一） |
| url | string | ⚠️ | 音频文件 URL（二选一） |
| duration | number | ❌ | 音频时长（秒） |
| cacheKey | string | ❌ | 缓存键（用于后续优化） |
| error | string | ⚠️ | 错误信息（失败时必返回） |
| code | string | ⚠️ | 错误码（失败时必返回） |

**注意**: `audio` 和 `url` 至少返回一个，建议同时返回。

#### 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| INVALID_TEXT | 文本为空或无效 | 400 |
| INVALID_LANGUAGE | 不支持的语言 | 400 |
| TEXT_TOO_LONG | 文本过长 | 400 |
| TTS_ENGINE_ERROR | TTS 引擎错误 | 500 |
| INTERNAL_ERROR | 内部服务器错误 | 500 |

---

### 接口 2: ASR 语音识别

#### 基本信息
- **接口名称**: 语音识别
- **接口路径**: `/api/asr/recognize`
- **请求方法**: `POST`
- **Content-Type**: `multipart/form-data`

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 | 示例 |
|-------|------|------|------|------|
| audio | File/Blob | ✅ | 音频文件 | recording.webm |
| language | string | ✅ | 语言代码 | "en" 或 "zh" |
| referenceText | string | ❌ | 参考文本（用于评分） | "Hello, world!" |
| enableScore | boolean | ❌ | 是否启用评分 | true |

**音频格式支持**:
- WebM (推荐，浏览器录音默认格式)
- MP3
- WAV
- OGG

#### 请求示例

```bash
curl -X POST http://api.example.com/api/asr/recognize \
  -F "audio=@recording.webm" \
  -F "language=en" \
  -F "referenceText=Hello, world!" \
  -F "enableScore=true"
```

#### 响应格式

**成功响应（基础识别）**:
```json
{
  "success": true,
  "text": "Hello, world!",
  "confidence": 0.95
}
```

**成功响应（包含评分）**:
```json
{
  "success": true,
  "text": "Hello, world!",
  "confidence": 0.95,
  "score": {
    "overall": 85,
    "accuracy": 90,
    "fluency": 82,
    "completeness": 88,
    "pronunciation": 83
  },
  "words": [
    {
      "word": "Hello",
      "startTime": 0.0,
      "endTime": 0.5,
      "confidence": 0.98,
      "score": 90
    },
    {
      "word": "world",
      "startTime": 0.6,
      "endTime": 1.2,
      "confidence": 0.92,
      "score": 85
    }
  ]
}
```

**失败响应**:
```json
{
  "success": false,
  "error": "Audio file is too large",
  "code": "FILE_TOO_LARGE"
}
```

#### 响应字段说明

| 字段名 | 类型 | 必返回 | 说明 |
|-------|------|--------|------|
| success | boolean | ✅ | 是否成功 |
| text | string | ⚠️ | 识别的文本（成功时必返回） |
| confidence | number | ⚠️ | 置信度 0-1（成功时必返回） |
| score | object | ❌ | 评分详情（enableScore=true 时返回） |
| score.overall | number | ❌ | 总分 0-100 |
| score.accuracy | number | ❌ | 准确度 0-100 |
| score.fluency | number | ❌ | 流畅度 0-100 |
| score.completeness | number | ❌ | 完整度 0-100 |
| score.pronunciation | number | ❌ | 发音 0-100 |
| words | array | ❌ | 单词详情列表 |
| error | string | ⚠️ | 错误信息（失败时必返回） |
| code | string | ⚠️ | 错误码（失败时必返回） |

#### 评分指标说明

1. **overall (总分)**: 综合评分，通常是其他指标的加权平均
2. **accuracy (准确度)**: 识别文本与参考文本的匹配程度
3. **fluency (流畅度)**: 语速、停顿等流畅性指标
4. **completeness (完整度)**: 是否完整读出所有内容
5. **pronunciation (发音)**: 发音标准程度

#### 错误码定义

| 错误码 | 说明 | HTTP 状态码 |
|-------|------|------------|
| MISSING_AUDIO | 缺少音频文件 | 400 |
| INVALID_AUDIO_FORMAT | 不支持的音频格式 | 400 |
| FILE_TOO_LARGE | 文件过大 | 413 |
| AUDIO_TOO_SHORT | 音频时长过短 | 400 |
| AUDIO_TOO_LONG | 音频时长过长 | 400 |
| NO_SPEECH_DETECTED | 未检测到语音 | 400 |
| ASR_ENGINE_ERROR | ASR 引擎错误 | 500 |
| INTERNAL_ERROR | 内部服务器错误 | 500 |

---

### 接口 3: 批量 TTS（可选）

#### 基本信息
- **接口名称**: 批量文本转语音
- **接口路径**: `/api/tts/batch`
- **请求方法**: `POST`
- **Content-Type**: `application/json`

#### 请求参数

```json
{
  "items": [
    {
      "id": "1",
      "text": "Hello",
      "language": "en",
      "rate": 1.0
    },
    {
      "id": "2",
      "text": "World",
      "language": "en",
      "rate": 1.0
    }
  ],
  "format": "mp3"
}
```

#### 响应格式

```json
{
  "success": true,
  "results": [
    {
      "id": "1",
      "audio": "base64_data...",
      "url": "https://api.example.com/audio/1.mp3",
      "duration": 0.8
    },
    {
      "id": "2",
      "audio": "base64_data...",
      "url": "https://api.example.com/audio/2.mp3",
      "duration": 0.9
    }
  ]
}
```

---

### 接口 4: 音频分段识别（可选）

#### 基本信息
- **接口名称**: 音频分段识别
- **接口路径**: `/api/asr/segment`
- **请求方法**: `POST`
- **Content-Type**: `multipart/form-data`

#### 使用场景
- AI 音频导入：将长音频自动分段并识别
- 课程生成：从音频提取内容

#### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| audio | File | ✅ | 音频文件 |
| language | string | ✅ | 语言代码 |
| segmentMode | string | ✅ | 分段模式：sentence/paragraph/time |
| maxSegmentDuration | number | ❌ | 最大段落时长（秒） |

#### 响应格式

```json
{
  "success": true,
  "segments": [
    {
      "id": "seg_1",
      "text": "First sentence.",
      "startTime": 0.0,
      "endTime": 2.5,
      "confidence": 0.95
    },
    {
      "id": "seg_2",
      "text": "Second sentence.",
      "startTime": 2.6,
      "endTime": 5.2,
      "confidence": 0.92
    }
  ],
  "fullText": "First sentence. Second sentence.",
  "totalDuration": 5.2
}
```

---

## 🔐 认证与安全

### API 认证（如需要）

#### 方式 1: API Key
```bash
curl -H "X-API-Key: your_api_key" \
     http://api.example.com/api/tts/generate
```

#### 方式 2: Bearer Token
```bash
curl -H "Authorization: Bearer your_token" \
     http://api.example.com/api/tts/generate
```

### 限流规则

建议实施以下限流策略：

| 接口 | 限流规则 | 说明 |
|------|---------|------|
| TTS | 100 次/分钟 | 每个 IP 或 API Key |
| ASR | 50 次/分钟 | 每个 IP 或 API Key |
| Batch TTS | 10 次/分钟 | 每个 IP 或 API Key |

---

## 📊 性能要求

### 响应时间

| 接口 | 目标响应时间 | 最大响应时间 |
|------|------------|-------------|
| TTS (短文本 <50字) | < 2 秒 | < 5 秒 |
| TTS (长文本 <200字) | < 5 秒 | < 10 秒 |
| ASR (短音频 <10秒) | < 3 秒 | < 8 秒 |
| ASR (长音频 <60秒) | < 10 秒 | < 30 秒 |

### 文件大小限制

| 类型 | 最大大小 | 建议 |
|------|---------|------|
| TTS 文本 | 1000 字符 | 单次请求 <200 字符 |
| ASR 音频 | 10 MB | 单次录音 <5 MB |
| 长音频 | 50 MB | 分段处理 |

---

## 🧪 测试用例

### TTS 测试

#### 测试 1: 基础功能
```bash
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello, world!",
    "language": "en"
  }'
```

**期望结果**: 返回音频数据或 URL

#### 测试 2: 中文支持
```bash
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "你好，世界！",
    "language": "zh"
  }'
```

**期望结果**: 返回中文语音

#### 测试 3: 语速控制
```bash
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hello",
    "language": "en",
    "rate": 1.5
  }'
```

**期望结果**: 返回加速的语音

### ASR 测试

#### 测试 1: 基础识别
```bash
curl -X POST http://localhost:3000/api/asr/recognize \
  -F "audio=@test.webm" \
  -F "language=en"
```

**期望结果**: 返回识别文本

#### 测试 2: 发音评分
```bash
curl -X POST http://localhost:3000/api/asr/recognize \
  -F "audio=@test.webm" \
  -F "language=en" \
  -F "referenceText=Hello, world!" \
  -F "enableScore=true"
```

**期望结果**: 返回识别文本和评分详情

---

## 📝 实现建议

### TTS 实现

推荐技术栈：
- **开源方案**: eSpeak, Festival, Piper
- **商业方案**: Google TTS, Azure TTS, Amazon Polly
- **本地方案**: Coqui TTS, VITS

### ASR 实现

推荐技术栈：
- **开源方案**: Whisper (OpenAI), Vosk, DeepSpeech
- **商业方案**: Google STT, Azure STT, Amazon Transcribe
- **评分方案**: 基于 Levenshtein 距离 + 音素分析

### 缓存策略

建议实施缓存：
- **TTS**: 缓存生成的音频（相同文本复用）
- **ASR**: 可选缓存（音频哈希作为键）

---

## 🤝 联系与协作

### 前端集成状态
✅ 已完成客户端代码  
⏳ 等待后端接口

### 需要确认的问题

请后端开发人员回答：

1. ✅ 接口地址和端口是什么？
2. ✅ 是否需要 API Key 或 Token 认证？
3. ✅ TTS 返回 Base64 还是 URL？
4. ✅ ASR 是否支持详细评分？
5. ✅ 错误码定义是否有变化？
6. ⚠️ 是否支持语速控制？
7. ⚠️ 是否支持批量处理？
8. ⚠️ 是否支持音频分段？

### 联系方式
- 前端负责人: [联系方式]
- 后端负责人: [联系方式]
- 项目文档: `docs/` 目录

---

**文档版本**: v1.0  
**创建日期**: 2026-01-06  
**状态**: 待确认
