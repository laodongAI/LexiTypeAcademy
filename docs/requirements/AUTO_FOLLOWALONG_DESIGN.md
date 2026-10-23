# 自动跟读流程设计文档（修正版）

**修正日期**: 2025-01-17（第 3 版）  
**状态**: ✅ 完整  
**核心改动**: 自动录音 + 3秒无声停止 + 最多3次无声重试

---

## 设计核心思想

跟读练习应该是**完全自动化的用户体验**，用户只需要跟着示范音说话，系统自动处理录音、检测、重试等逻辑，无需任何按钮交互。

---

## 完整流程

### 第1步：显示句子
```
界面显示：[英文句子] + [音标] + [中文翻译（隐藏）]
状态：idle → reference_audio
```

### 第2步：播放示范音
```
系统播放参考音频（原声或 TTS）
用户准备跟读
状态：reference_audio
```

### 第3步：示范音播完 → 自动开始录音 ⭐
```
触发：onReferenceAudioEnd() 回调
状态：自动转换为 recording
UI 显示：
  - 🎤 麦克风动画（持续脉动）
  - 实时音量条（0-100%）
  - 录音计时器（0.0s, 0.1s, ...）
  - "停止"按钮（可选，提前结束）

用户只需开始说话，无需点击任何按钮
```

### 第4步：实时监测声音 + 3秒无声自动停止 ⭐
```
算法：
  - 每 100ms 采样一次音频数据
  - 计算 RMS（声压级）
  - 如果 RMS < 20dB（无声阈值）持续 3 秒 → 自动停止录音

示例：
  时刻 0.0s: 用户说 "Hello" → RMS = 45dB
  时刻 1.5s: 说完，停止说话 → RMS = 18dB
  时刻 1.5-4.5s: 无声状态
  时刻 4.5s: 检测到 3 秒无声 → 自动停止录音

状态：recording → silence_check（检查有效性）
```

### 第5步：声音有效性检查
```
检查两个条件：
  1. 录音时长 ≥ 1 秒？
  2. 平均 RMS ≥ 30dB？（有效声音阈值）

结果 A：有效声音 ✓
  → 直接跳到第7步（ASR 评测）
  → 状态：silence_check → evaluating

结果 B：无声或极低音量 ✗
  → 触发异常处理（无声重试）
  → 状态：silence_check → silence_check（重试）
```

### 第6步：异常处理 - 无声重试机制 ⭐⭐
```
IF 检测到无声:
  重试次数 += 1
  
  IF 重试次数 < 3:
    播放提示音 "请跟我朗读"（800Hz, 500ms）
    等待 1 秒
    重新播放示范音
    返回第 3 步（重新开始录音）
    
  ELSE (重试次数 ≥ 3):
    标记为 "无法完成"
    跳到下一个词（第 9 步）
```

**重试流程示意**：
```
第 1 次无声 → 提示 "请跟我朗读" → 重新播放示范音 → 重新录音
                ↓（用户可能已准备好）
第 2 次无声 → 提示 "请跟我朗读" → 重新播放示范音 → 重新录音
                ↓（最后一次机会）
第 3 次无声 → 提示 "请跟我朗读" → 重新播放示范音 → 重新录音
                ↓（仍然无声）
                 ✗ 放弃 → 自动跳到下一个词
```

### 第7步：ASR 评测（仅在有有效声音时）
```
状态：evaluating
处理：
  1. 调用 ASR 服务（Sherpa/豆包/Whisper）
  2. 获得评测结果：分数、错误音素、反馈
  3. 生成评测报告

结果：
  - 分数 ≥ 80 ✓ → 通过，跳到第 9 步
  - 分数 < 80 ✗ → 未通过，进入第 8 步（反馈 + 重试）
```

### 第8步：反馈与重试选项
```
显示：
  - 得分（如 75 分）
  - 错误音素标红（如 /ð/ 发音错误）
  - 错误反馈（如 "th 音发音太轻"）

用户选择：
  A. 重试按钮 → 返回第 2 步（重新播放示范音 + 重新录音）
  B. 查看解析（可选）
  C. 放弃（如果已重试 3 次）→ 跳到第 9 步
```

### 第9步：自动推进
```
跳转到下一个词或句子
重复步骤 1-9，直到课程结束
```

---

## 状态机完整图

```
┌─────────────────────────────────────────────┐
│  IDLE                                       │
│  （等待用户点击"开始练习"）                 │
└────────┬────────────────────────────────────┘
         │ 用户点击"开始"
         ↓
┌─────────────────────────────────────────────┐
│  REFERENCE_AUDIO                            │
│  （播放示范音）                              │
└────────┬────────────────────────────────────┘
         │ 示范音播完（onReferenceAudioEnd）
         ↓
┌─────────────────────────────────────────────┐
│  RECORDING                 ⭐ 自动            │
│  （自动开始录音）                            │
│  UI：麦克风动画+音量条+计时器                │
└────────┬────────────────────────────────────┘
         │ 
    ┌────┴─────────────────────────────────────┐
    │                                          │
    ↓ (3s 无声)          用户点击"停止"(可选)  │
┌─────────────────────────────────────────────┐│
│  SILENCE_CHECK                              ││
│  （检查声音有效性）                          ││
└────┬────────────────────────────────────────┘│
     │                                         │
   /─┴─┬─────────────────────────────────────┐│
  /    │                                     ││
 / 有效声音  无声                            ││
 │   ✓  │   ✗                                ││
 │      │                                     ││
 ↓      └──→ (重试 < 3)                      ││
EVALUATING   │                                ││
（ASR 评测）  │ 播放提示音 + 等待 1s           ││
     │       │                                ││
     │       └──→ 重新播放示范音              ││
     │            返回 RECORDING ──────┐    ││
     │                                   │    ││
     │                                   └────┘│
     │                                         │
   /─┴─────────────────────────────────────┐  │
  /                                        │  │
 / 分数 ≥ 80    分数 < 80                 │  │
 │    ✓             ✗                     │  │
 │                  │                     │  │
 │              FEEDBACK                  │  │
 │          （显示错误 + 重试按钮）        │  │
 │              │                         │  │
 │            /─┴─┬────────────────────┐ │  │
 │           /    │                    │ │  │
 │      点击重试  点击放弃              │ │  │
 │       │        │                    │ │  │
 │       └─→ REFERENCE_AUDIO            │ │  │
 │           │                          │ │  │
 │           └──→ RECORDING ────────────┴─┘  │
 │                                           │
 └──────────→ NEXT_WORD                      │
             （自动推进）                    │
             │                               │
             └──→ (重复步骤) 或 END          │
```

---

## 关键算法详解

### 无声检测算法

```typescript
// 实时 RMS（Root Mean Square）计算
function calculateRMS(audioBuffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);
  // 转换为分贝（dB）: 20 * log10(RMS)
  return 20 * Math.log10(rms + 1e-10); // 防止 log(0)
}

// 示例：
// 说话时: RMS = 45dB
// 环境噪音: RMS = 25dB  
// 极度安静: RMS = 15dB
// 无声: RMS = -20dB
```

### 无声持续检测

```typescript
const SILENCE_THRESHOLD = 20; // dB
const SILENCE_DURATION = 3000; // 3 秒
let silenceStart: number | null = null;

function checkSilence(rms: number): boolean {
  if (rms < SILENCE_THRESHOLD) {
    // 开始无声计时
    if (silenceStart === null) {
      silenceStart = Date.now();
    }
    
    // 检查是否超过 3 秒
    const silenceDuration = Date.now() - silenceStart;
    if (silenceDuration >= SILENCE_DURATION) {
      return true; // 确认 3 秒无声
    }
  } else {
    // 有声音，重置计时器
    silenceStart = null;
  }
  
  return false;
}
```

### 有效性检查

```typescript
function isValidRecording(audioBuffer: Float32Array, duration: number): {
  valid: boolean;
  reason?: string;
} {
  const rms = calculateRMS(audioBuffer);
  const MIN_DURATION = 1000; // 1 秒
  const MIN_RMS = 30; // dB
  
  // 检查 1：录音时长
  if (duration < MIN_DURATION) {
    return { valid: false, reason: '请说长一点' };
  }
  
  // 检查 2：声音强度
  if (rms < MIN_RMS) {
    return { valid: false, reason: '无声或音量极低' };
  }
  
  return { valid: true };
}
```

---

## 参数调优建议

| 参数 | 默认值 | 说明 | 调优建议 |
|------|--------|------|--------|
| `silenceDuration` | 3000ms | 判定无声的时长 | 环境嘈杂 → 4000-5000ms；安静环境 → 2000ms |
| `silenceThreshold` | 20dB | 无声的 RMS 下限 | 嘈杂环境 → 25dB；安静环境 → 15dB |
| `minRecordingDuration` | 1000ms | 最少录音时长 | 单词 → 500ms；句子 → 1000ms |
| `validRMSThreshold` | 30dB | 有效声音的 RMS 下限 | 严格 → 35dB；宽松 → 25dB |
| `retryMaxCount` | 3 | 最多重试次数 | 学生水平高 → 2 次；初学者 → 4 次 |

---

## 代码实现

已在 `src/app/hooks/useAutoFollowAlongRecording.ts` 中提供完整实现。

关键功能：
- ✅ 自动录音（示范音播完立即触发）
- ✅ 3秒无声自动停止
- ✅ RMS 实时计算和音量条显示
- ✅ 有效性检查（时长 + RMS）
- ✅ 无声重试机制（最多 3 次）
- ✅ 提示音播放（800Hz 提示音）
- ✅ 完整状态机管理

---

## UI 交互要点

### 录音阶段 UI
```
┌────────────────────────────────┐
│  How are you?                  │
│  /haʊ ɑr juː/                 │
└────────────────────────────────┘

┌────────────────────────────────┐
│  🎤  [脉动动画]                 │
│  ▓▓░░░░  (音量条)              │
│  已录音: 1.2s                  │
│  [停止]                         │
└────────────────────────────────┘
```

### 无声检测 UI
```
┌────────────────────────────────┐
│  检测到无声...                  │
│  重试 1/3                       │
│  正在重新播放示范音...           │
└────────────────────────────────┘
```

### 反馈 UI
```
┌────────────────────────────────┐
│  85 分 ✓ 很好！                 │
│  错误音素: /ɪ/                 │
│  [重试]  [下一个]               │
└────────────────────────────────┘
```

---

## 集成步骤

### 1. 导入 Hook
```typescript
import { useAutoFollowAlongRecording } from '@/app/hooks/useAutoFollowAlongRecording';
```

### 2. 在组件中初始化
```typescript
const { state, startAutoRecording, handleRetry, skipToNextWord } = 
  useAutoFollowAlongRecording({
    silenceDuration: 3000,
    silenceThreshold: 20,
    onReferenceAudioEnd: () => {
      // 示范音播完，自动开始录音
      // Hook 会自动调用 startAutoRecording()
    },
    onEvaluationRequired: async (audioBlob) => {
      // 调用 ASR 服务进行评测
      const result = await asrService.evaluate(audioBlob);
      return {
        score: result.score,
        errorPhonemes: result.errors,
        feedback: result.feedback
      };
    },
    onNoSound: (retryCount) => {
      console.log(`无声重试: ${retryCount}/3`);
    }
  });
```

### 3. 示范音播放完毕时调用
```typescript
// 在音频播放完成的回调中
referenceAudio.onended = () => {
  startAutoRecording(); // 自动开始录音
};
```

### 4. 显示 UI
```typescript
{state.phase === 'recording' && (
  <div className="recording-indicator">
    <div className="mic-animation">🎤</div>
    <div className="volume-bar">
      <div style={{ width: `${(state.currentRMS + 20) * 2}%` }} />
    </div>
    <span>已录音: {state.recordingDuration}s</span>
  </div>
)}

{state.phase === 'feedback' && (
  <div className="feedback">
    <p>评测结果</p>
    <button onClick={handleRetry}>重试</button>
    <button onClick={skipToNextWord}>下一个</button>
  </div>
)}
```

---

## 测试清单

- [ ] 示范音播完后自动开始录音（无需点击）
- [ ] 实时音量条显示正确
- [ ] 3秒无声时自动停止录音
- [ ] 无声时自动重试（最多 3 次）
- [ ] 每次重试前播放提示音
- [ ] 3 次都无声后自动跳到下一个
- [ ] 有有效声音时进行 ASR 评测
- [ ] 评测完成后显示反馈
- [ ] 用户可点击"重试"重新开始
- [ ] 错误提示清晰明确

---

**文档版本**: v0.4.2  
**最后更新**: 2025-01-17  
**代码文件**: `src/app/hooks/useAutoFollowAlongRecording.ts`
