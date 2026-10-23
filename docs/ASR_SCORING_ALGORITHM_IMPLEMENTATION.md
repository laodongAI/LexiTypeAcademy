# ASR 发音评分算法实现文档

## 📋 文档说明

本文档详细说明 LexiType Academy 前端系统中的发音评分算法，供后端开发人员在 ASR 服务中实现。

评分算法位于旧代码库中，经过多次迭代优化（v0.1.3 → v0.1.4），是一套成熟的评分体系。

---

## 📂 代码位置

### 核心文件

| 文件路径 | 职责 | 行数 |
|---------|------|------|
| `src/infrastructure/audio/evaluation/types.ts` | 类型定义 | ~150 |
| `src/infrastructure/audio/evaluation/SpeechEvaluationService.ts` | 评估服务（入口） | ~359 |
| `src/infrastructure/audio/evaluation/PronunciationScorer.ts` | 评分算法实现 | ~438 |
| `src/infrastructure/audio/evaluation/SuggestionGenerator.ts` | 建议生成器 | ~200+ |

### 架构说明

```
SpeechEvaluationService (服务层)
    ↓ 调用
PronunciationScorer (算法层)
    ↓ 输出
SpeechEvaluationResult (评分结果)
```

---

## 🎯 评分体系概览

### 核心指标（5 个维度）

| 指标 | 英文名 | 范围 | 权重 | 说明 |
|------|-------|------|------|------|
| **综合评分** | Overall Score | 0-100 | - | 最终总分 |
| **准确性** | Accuracy | 0-100 | 50% | 发音准确程度 |
| **流利度** | Fluency | 0-100 | 30% | 语速和停顿 |
| **完整性** | Completeness | 0-100 | 20% | 内容完整度 |
| **发音评分** | Pronunciation | 0-100 | - | 单个音素评分 |

### 评分模式

系统支持两种评分模式，根据 ASR 返回数据自动选择：

#### 1. **精确模式 (Precision Mode)**
- **前提**: ASR 返回音素级对齐数据（phoneme alignment）
- **精度**: 高精度，音素级别评分
- **适用场景**: 生产环境，专业语音评估

#### 2. **回退模式 (Fallback Mode)**
- **前提**: ASR 仅返回文本转录
- **精度**: 中等精度，基于文本匹配
- **适用场景**: 无音素数据时的降级方案

---

## 📐 精确模式算法（推荐实现）

### 算法公式（v0.1.4）

```
综合评分 = 准确性 × 0.5 + 流利度 × 0.3 + 完整性 × 0.2
```

### 1. 准确性评分 (Accuracy Score)

#### 定义
**音素正确率** = 正确音素数 / 总音素数 × 100

#### 判断标准
- 音素置信度 ≥ 0.7 → 正确
- 音素置信度 < 0.7 → 错误

#### 代码实现（参考）

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `scoreFromPhonemes()`  
**行数**: 75-95

```typescript
// 1. 计算准确性评分（音素正确率）
const phonemeDetails: PhonemeEvaluationDetail[] = [];
let correctPhonemes = 0;
let totalPhonemes = 0;

asrResult.alignments!.forEach((word: WordAlignment) => {
  word.phonemes?.forEach((p: PhonemeAlignment) => {
    totalPhonemes++;
    const isCorrect = p.confidence >= 0.7;
    if (isCorrect) {
      correctPhonemes++;
    }
    phonemeDetails.push({
      phoneme: p.phoneme,
      score: p.confidence,
      word: word.word
    });
  });
});

const accuracyScore = clamp(
  (correctPhonemes / Math.max(1, totalPhonemes)) * 100,
  0,
  100
);
```

#### 后端实现要点

1. **ASR 必须返回音素级对齐数据**:
```json
{
  "alignments": [
    {
      "word": "hello",
      "phonemes": [
        {
          "phoneme": "HH",
          "confidence": 0.95,
          "startTime": 0.0,
          "endTime": 0.1
        },
        {
          "phoneme": "EH",
          "confidence": 0.82,
          "startTime": 0.1,
          "endTime": 0.3
        }
      ]
    }
  ]
}
```

2. **音素置信度计算**:
   - 使用 ASR 模型的音素级概率
   - 推荐模型: Kaldi, Whisper (需要自定义输出层)

3. **音素符号标准**:
   - 英语: 使用 ARPAbet 或 IPA
   - 中文: 使用拼音声母韵母

---

### 2. 流利度评分 (Fluency Score)

#### 定义
流利度 = 语速合理性 × 0.7 + 停顿控制 × 0.3

#### 2.1 语速合理性 (Speaking Rate)

**公式**:
```
WPM (Words Per Minute) = 单词数 / 音频时长(秒) × 60
语速分数 = (1 - |WPM - 目标WPM| / 目标WPM) × 100
```

**目标语速**:
- 英语: 150 WPM
- 中文: 180-200 字/分钟

#### 2.2 停顿控制 (Pause Control)

**公式**:
```
停顿比例 = 停顿总时长 / 音频总时长
停顿分数 = ((0.2 - 停顿比例) / 0.2) × 100
```

**判断标准**:
- 停顿比例 ≤ 20% → 满分 100
- 停顿比例 > 20% → 扣分

#### 代码实现（参考）

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `scoreFromPhonemes()`  
**行数**: 97-120

```typescript
// 2. 计算流利度评分（语速 + 停顿）
const wordCount = asrResult.alignments!.length;
const duration = asrResult.duration || 1;

// 2.1 语速合理性
const wordsPerMinute = (wordCount / duration) * 60;
const targetWPM = 150; // 英语正常语速
const speedScore = clamp(
  (1 - Math.abs(wordsPerMinute - targetWPM) / targetWPM) * 100,
  0,
  100
);

// 2.2 停顿控制
const pauseDuration = this.calculatePauseDuration(asrResult);
const pauseRatio = pauseDuration / duration;
const pauseScore = clamp(
  ((0.2 - pauseRatio) / 0.2) * 100,
  0,
  100
);

const fluencyScore = speedScore * 0.7 + pauseScore * 0.3;
```

#### 停顿时长计算

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `calculatePauseDuration()`  
**行数**: 275-295

```typescript
private calculatePauseDuration(asrResult: ASRResult): number {
  if (!asrResult.voiceSegments || asrResult.voiceSegments.length === 0) {
    return 0;
  }
  
  let pauseDuration = 0;
  const segments = asrResult.voiceSegments;
  
  // 计算相邻语音段之间的间隔
  for (let i = 1; i < segments.length; i++) {
    const gap = segments[i].start - segments[i - 1].end;
    if (gap > 0) {
      pauseDuration += gap;
    }
  }
  
  return pauseDuration;
}
```

#### 后端实现要点

1. **VAD（语音活动检测）分段**:
```json
{
  "voiceSegments": [
    { "start": 0.0, "end": 1.2 },
    { "start": 1.5, "end": 3.0 }
  ]
}
```

2. **停顿识别**:
   - 使用 VAD 算法（如 WebRTC VAD, Silero VAD）
   - 检测相邻语音段之间的静音

3. **时长精度**:
   - 精确到 0.01 秒
   - 使用音频采样率计算

---

### 3. 完整性评分 (Completeness Score)

#### 定义
**完整性** = LCS 匹配词数 / 目标词数 × 100

其中 LCS (Longest Common Subsequence) 是最长公共子序列算法。

#### 为什么使用 LCS？

**问题**: 简单单词匹配无法处理重复词和顺序问题

**示例**:
- 目标: "I love you love me"
- 用户: "I love you me"
- 简单匹配: 4/5 = 80%（错误！重复 "love" 算 2 次）
- LCS 匹配: 3/5 = 60%（正确！）

#### LCS 算法实现

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `longestCommonSubsequence()`  
**行数**: 295-320

```typescript
function longestCommonSubsequence(arr1: string[], arr2: string[]): number {
  const m = arr1.length;
  const n = arr2.length;
  
  // 创建DP表
  const dp: number[][] = Array(m + 1).fill(0).map(() => Array(n + 1).fill(0));
  
  // 填充DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (arr1[i - 1] === arr2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  return dp[m][n];
}
```

#### 代码实现（参考）

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `scoreFromPhonemes()`  
**行数**: 122-135

```typescript
// 3. 计算完整性评分（使用LCS）
const normalizedTarget = normalizeText(targetText);
const normalizedTranscript = normalizeText(asrResult.text);
const targetWords = normalizedTarget.split(/\s+/).filter(Boolean);
const transcriptWords = normalizedTranscript.split(/\s+/).filter(Boolean);

// 使用LCS计算匹配度
const matchedWordsCount = longestCommonSubsequence(targetWords, transcriptWords);
const completenessScore = clamp(
  (matchedWordsCount / Math.max(1, targetWords.length)) * 100,
  0,
  100
);

// 计算缺失和多余单词数
const missingWords = targetWords.length - matchedWordsCount;
const extraWords = Math.max(0, transcriptWords.length - matchedWordsCount);
```

#### 文本归一化

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `normalizeText()`  
**行数**: 333-342

```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // 标点转空格
    .replace(/\s+/g, ' ')      // 合并空格
    .trim();
}
```

#### 后端实现要点

1. **文本预处理**:
   - 转小写
   - 移除标点
   - 分词

2. **LCS 算法优化**:
   - 时间复杂度: O(m×n)
   - 空间复杂度: O(m×n)
   - 可用滚动数组优化至 O(min(m,n))

---

### 4. 综合评分计算

#### 公式

```typescript
const overallScore = clamp(
  accuracyScore * 0.5 + fluencyScore * 0.3 + completenessScore * 0.2,
  0,
  100
);
```

#### 权重说明（v0.1.4）

| 指标 | 权重 | 理由 |
|------|------|------|
| 准确性 | 50% | 最重要：发音是否正确 |
| 流利度 | 30% | 次要：语速和节奏 |
| 完整性 | 20% | 最次要：内容完整度 |

---

## 🔄 回退模式算法（降级方案）

### 使用场景

当 ASR 无法提供音素级对齐数据时，使用基于文本匹配的回退模式。

### 算法说明

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `scoreFromTranscript()`  
**行数**: 168-233

#### 1. 完整性评分（同精确模式）
使用 LCS 算法计算单词匹配度。

#### 2. 流利度评分（简化版）

```typescript
// 基于时长估算
const expectedDuration = targetWords.length * 0.6; // 每词0.6秒
fluencyScore = clamp((expectedDuration / userDuration) * 100, 0, 100);
```

**注意**: 如果无音频 Blob，流利度可为 `null`。

#### 3. 准确性评分（ASR 置信度）

```typescript
const accuracyScore = clamp((asrResult.confidence || 0.8) * 100, 0, 100);
```

#### 4. 噪音惩罚

```typescript
const noisePenalty = (missingWords * 10) + (extraWords * 5);
const overallScore = Math.max(0, completenessScore - noisePenalty);
```

---

## 📊 ASR 返回数据格式

### 精确模式所需数据

```typescript
interface ASRResult {
  // 基础字段
  text: string;              // 识别文本
  duration: number;          // 音频时长（秒）
  confidence: number;        // 整体置信度 0-1
  
  // 精确模式必需字段
  alignments?: WordAlignment[];  // 单词级对齐
  voiceSegments?: VoiceSegment[]; // VAD分段
  
  // 元数据
  provider: string;
  processingTime: number;
}

interface WordAlignment {
  word: string;              // 单词
  startTime: number;         // 开始时间（秒）
  endTime: number;           // 结束时间（秒）
  confidence: number;        // 单词置信度 0-1
  phonemes?: PhonemeAlignment[]; // 音素对齐（关键！）
}

interface PhonemeAlignment {
  phoneme: string;           // 音素符号（如 "HH", "EH"）
  confidence: number;        // 音素置信度 0-1（关键！）
  startTime: number;         // 开始时间（秒）
  endTime: number;           // 结束时间（秒）
}

interface VoiceSegment {
  start: number;             // 语音段开始时间
  end: number;               // 语音段结束时间
}
```

### 回退模式所需数据

```typescript
interface ASRResult {
  text: string;              // 识别文本（必需）
  duration: number;          // 音频时长（可选）
  confidence: number;        // 整体置信度（可选）
}
```

---

## 🔧 辅助工具函数

### 1. 分数限制函数

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `clamp()`  
**行数**: 352-358

```typescript
function clamp(value: number, min: number, max: number): number {
  if (!isFinite(value)) return min; // 处理NaN和Infinity
  return Math.max(min, Math.min(max, value));
}
```

### 2. 音频时长获取

**文件**: `src/infrastructure/audio/evaluation/PronunciationScorer.ts`  
**方法**: `getBlobDuration()`  
**行数**: 368-390

```typescript
async function getBlobDuration(audioBlob: Blob): Promise<number> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return estimateDurationFromSize(audioBlob);
  }
  
  const audioContext = new AudioContextClass();
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    return audioBuffer.duration;
  } catch (error) {
    return estimateDurationFromSize(audioBlob);
  } finally {
    await audioContext.close();
  }
}
```

---

## 🎓 建议生成算法

### 文件位置
`src/infrastructure/audio/evaluation/SuggestionGenerator.ts`

### 核心逻辑

根据评分结果生成个性化建议：

```typescript
// 准确性建议
if (accuracyScore < 60) {
  suggestions.push('发音准确度较低，请注意每个音节的发音');
}

// 流利度建议
if (fluencyScore !== null && fluencyScore < 70) {
  if (wordsPerMinute && wordsPerMinute < 100) {
    suggestions.push('语速偏慢，可以尝试加快一些');
  }
  if (pauseRatio && pauseRatio > 0.3) {
    suggestions.push('停顿过多，尝试连贯地朗读');
  }
}

// 完整性建议
if (missingWords > 0) {
  suggestions.push(`有 ${missingWords} 个单词未读出`);
}
if (extraWords > 0) {
  suggestions.push(`有 ${extraWords} 个多余单词`);
}

// 综合建议
if (overallScore >= 90) {
  suggestions.push('发音非常棒！继续保持！');
} else if (overallScore >= 70) {
  suggestions.push('发音不错，继续练习会更好！');
} else {
  suggestions.push('需要多加练习，建议重复朗读');
}
```

---

## 🧪 测试用例

### 测试用例 1: 完美发音

**输入**:
```json
{
  "targetText": "Hello world",
  "asrResult": {
    "text": "Hello world",
    "duration": 1.5,
    "confidence": 0.95,
    "alignments": [
      {
        "word": "Hello",
        "phonemes": [
          { "phoneme": "HH", "confidence": 0.98 },
          { "phoneme": "EH", "confidence": 0.95 },
          { "phoneme": "L", "confidence": 0.92 },
          { "phoneme": "OW", "confidence": 0.94 }
        ]
      },
      {
        "word": "world",
        "phonemes": [
          { "phoneme": "W", "confidence": 0.97 },
          { "phoneme": "ER", "confidence": 0.93 },
          { "phoneme": "L", "confidence": 0.91 },
          { "phoneme": "D", "confidence": 0.89 }
        ]
      }
    ],
    "voiceSegments": [
      { "start": 0.0, "end": 1.5 }
    ]
  }
}
```

**期望输出**:
```json
{
  "overallScore": 95,
  "accuracyScore": 95,
  "fluencyScore": 95,
  "completenessScore": 100,
  "suggestions": ["发音非常棒！继续保持！"]
}
```

---

### 测试用例 2: 缺失单词

**输入**:
```json
{
  "targetText": "Hello beautiful world",
  "asrResult": {
    "text": "Hello world",
    "duration": 1.2,
    "confidence": 0.90
  }
}
```

**期望输出**:
```json
{
  "overallScore": 45,
  "completenessScore": 67,
  "missingWords": 1,
  "suggestions": ["有 1 个单词未读出"]
}
```

---

### 测试用例 3: 语速过慢

**输入**:
```json
{
  "targetText": "Hello world",
  "asrResult": {
    "text": "Hello world",
    "duration": 3.0,
    "confidence": 0.92,
    "alignments": [...]
  }
}
```

**期望输出**:
```json
{
  "overallScore": 75,
  "fluencyScore": 60,
  "wordsPerMinute": 40,
  "suggestions": ["语速偏慢，可以尝试加快一些"]
}
```

---

## 🚀 后端实现建议

### 推荐技术栈

#### ASR 引擎
1. **Whisper** (OpenAI)
   - 优点: 开源，精度高
   - 缺点: 默认无音素对齐，需自定义
   - 解决方案: 集成 Phoneme Recognizer

2. **Kaldi**
   - 优点: 支持音素级对齐
   - 缺点: 配置复杂
   - 推荐模型: LibriSpeech, Tedlium

3. **Azure Speech SDK**
   - 优点: 商业级精度，原生支持评分
   - 缺点: 付费

#### VAD 工具
- **Silero VAD**: 高精度，开源
- **WebRTC VAD**: 轻量级
- **PyAudioAnalysis**: Python 库

### 实现步骤

#### Step 1: 基础 ASR 识别
```python
import whisper

model = whisper.load_model("base")
result = model.transcribe(audio_path)
text = result["text"]
duration = result["duration"]
```

#### Step 2: 添加音素对齐
```python
# 使用 Montreal Forced Aligner 或 Kaldi
from mfa import align

alignments = align(audio_path, text)
# 输出: [{"word": "hello", "phonemes": [...]}, ...]
```

#### Step 3: VAD 分段
```python
import torch
from silero_vad import load_silero_vad

model = load_silero_vad()
voice_segments = model(audio, sample_rate=16000)
```

#### Step 4: 实现评分算法
按照本文档中的算法实现五个评分函数：
1. `calculate_accuracy_score(alignments)`
2. `calculate_fluency_score(alignments, duration, voice_segments)`
3. `calculate_completeness_score(target_words, transcript_words)`
4. `calculate_overall_score(accuracy, fluency, completeness)`
5. `generate_suggestions(scores)`

---

## 📝 API 接口集成

### 修改 ASR 接口响应

在 `docs/TTS_ASR_BACKEND_API_SPEC.md` 定义的接口基础上，添加以下字段：

```json
{
  "success": true,
  "text": "Hello world",
  "confidence": 0.95,
  
  // ===== 评分功能扩展 =====
  "score": {
    "overall": 95,
    "accuracy": 95,
    "fluency": 92,
    "completeness": 100,
    "pronunciation": 94
  },
  
  // ===== 精确模式扩展字段 =====
  "alignments": [
    {
      "word": "Hello",
      "startTime": 0.0,
      "endTime": 0.6,
      "confidence": 0.98,
      "phonemes": [
        {
          "phoneme": "HH",
          "confidence": 0.98,
          "startTime": 0.0,
          "endTime": 0.1
        },
        {
          "phoneme": "EH",
          "confidence": 0.95,
          "startTime": 0.1,
          "endTime": 0.3
        }
      ]
    }
  ],
  
  "voiceSegments": [
    { "start": 0.0, "end": 1.5 }
  ],
  
  // ===== 辅助字段 =====
  "duration": 1.5,
  "wordsPerMinute": 80,
  "pauseRatio": 0.1,
  "missingWords": 0,
  "extraWords": 0,
  
  // ===== 建议 =====
  "suggestions": [
    "发音非常棒！继续保持！"
  ]
}
```

---

## 🎯 开发优先级

### 阶段 1: 基础功能（1-2 天）
- ✅ ASR 文本识别
- ✅ 回退模式评分（文本匹配）
- ✅ 基础 API 接口

### 阶段 2: 精确模式（3-5 天）
- ⏳ 音素级对齐
- ⏳ VAD 分段
- ⏳ 准确性评分
- ⏳ 流利度评分
- ⏳ 完整性评分

### 阶段 3: 优化（1-2 天）
- ⏳ 建议生成
- ⏳ 性能优化
- ⏳ 错误处理

---

## 📞 联系与协作

### 前端状态
- ✅ 评分算法已在旧代码中实现并经过验证
- ✅ API 客户端已完成
- ⏳ 等待后端接口实现评分功能

### 需要确认

1. 后端使用哪个 ASR 引擎？
2. 是否支持音素级对齐？
3. 预计何时完成评分功能？

### 协作建议

1. **优先实现回退模式**: 快速上线，降低风险
2. **逐步添加精确模式**: 根据 ASR 能力迭代
3. **保持接口一致性**: 按照 API 规范返回数据

---

**文档版本**: v1.0  
**基于代码版本**: v0.1.4  
**创建日期**: 2026-01-06  
**状态**: 待实现

---

## 🔗 相关文档

- [TTS_ASR_BACKEND_API_SPEC.md](./TTS_ASR_BACKEND_API_SPEC.md) - API 接口规范
- [TTS_ASR_INTEGRATION_GUIDE.md](./TTS_ASR_INTEGRATION_GUIDE.md) - 前端集成指南
- `src/infrastructure/audio/evaluation/` - 源代码实现
