# 跟读流程修正 - 快速参考

**最后更新**: 2025-01-17  
**版本**: v0.4.2  
**状态**: ✅ 完成

---

## 核心改动（3 大变化）

### 1️⃣ 自动录音（无需点击）
```
原设计：用户点击"录音"按钮 → 开始录音
新设计：示范音播完 → 系统自动开始录音 ⭐
```

### 2️⃣ 3秒无声自动停止
```
原设计：用户手动停止或点击"停止"按钮
新设计：3秒检测到无声 → 系统自动停止 ⭐
```

### 3️⃣ 无声重试机制（最多3次）
```
原设计：无声则失败，直接跳下一个
新设计：
  第 1-3 次无声 → 播放提示音 "请跟我朗读"
                → 自动重新播放示范音
                → 自动重新开始录音
  第 3 次重试后仍无声 → 才自动跳下一个 ⭐⭐
```

---

## 工作流程概览

```
1. 显示句子
   ↓
2. 播放示范音 (用户跟读)
   ↓
3. 示范音播完 → [自动开始录音] ⭐
   ↓
4. 用户说话 (系统实时监测音量)
   ↓
5. [3秒无声] → [自动停止录音] ⭐
   ↓
6. 检查有效性
   ├─ 有效 → ASR 评测 → 显示结果
   └─ 无声 → [播放提示音] ⭐
           → [自动重试] (< 3 次)
           → 重新播放示范音
           → 返回步骤 3
```

---

## 无声检测参数

| 参数 | 值 | 说明 |
|------|-----|------|
| **SILENCE_THRESHOLD** | 20 dB | 判定"无声"的音量阈值 |
| **SILENCE_DURATION** | 3000 ms | 无声时长（需连续 3 秒才判定） |
| **MIN_RECORDING_DURATION** | 1000 ms | 最少录音时长（小于此时间认为无效） |
| **VALID_RMS_THRESHOLD** | 30 dB | 有效声音的 RMS 下限 |
| **RETRY_MAX_COUNT** | 3 | 最多重试次数 |
| **PROMPT_SOUND_FREQ** | 800 Hz | 提示音频率 |
| **PROMPT_SOUND_DURATION** | 500 ms | 提示音时长 |

---

## 状态转移

```
IDLE
 ↓
REFERENCE_AUDIO (播放示范音)
 ↓
RECORDING ⭐ (自动开始)
 ├─ 有效声音 → EVALUATING → FEEDBACK
 └─ 无声 (重试 < 3) → 播放提示音 → RECORDING
              ↓
              (重试 ≥ 3) → NEXT_WORD
 ↓
NEXT_WORD (自动推进或结束)
```

---

## 代码集成

### 导入 Hook
```typescript
import { useAutoFollowAlongRecording } from '@/app/hooks/useAutoFollowAlongRecording';
```

### 初始化
```typescript
const { state, startAutoRecording, handleRetry, skipToNextWord } = 
  useAutoFollowAlongRecording({
    silenceDuration: 3000,        // 3 秒无声停止
    silenceThreshold: 20,         // 20dB 无声阈值
    minRecordingDuration: 1000,   // 最少 1 秒
    validRMSThreshold: 30,        // 30dB 有效声音下限
    
    // 示范音播完时调用
    onReferenceAudioEnd: () => {
      console.log('自动开始录音');
      // Hook 内部会自动调用 startAutoRecording()
    },
    
    // 有有效声音时进行评测
    onEvaluationRequired: async (audioBlob) => {
      const result = await asrService.evaluate(audioBlob);
      return {
        score: result.score,
        errorPhonemes: result.errors,
        feedback: result.feedback
      };
    },
    
    // 检测到无声时调用
    onNoSound: (retryCount) => {
      console.log(`无声，正在重试 ${retryCount}/3`);
    }
  });
```

### UI 显示
```typescript
{state.phase === 'recording' && (
  <div className="recording">
    <div className="mic-icon">🎤</div>
    <div className="volume-bar">
      <div style={{ width: `${(state.currentRMS + 20) * 2}%` }} />
    </div>
    <span>已录音: {state.recordingDuration.toFixed(1)}s</span>
  </div>
)}

{state.phase === 'silence_check' && (
  <div>检测到无声... 重试 {state.silenceRetryCount}/3</div>
)}

{state.phase === 'feedback' && (
  <div>
    <p>评测完成</p>
    <button onClick={handleRetry}>重试</button>
    <button onClick={skipToNextWord}>下一个</button>
  </div>
)}
```

---

## 关键代码片段

### RMS 计算
```typescript
function calculateRMS(audioBuffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);
  return 20 * Math.log10(rms + 1e-10); // 转换为 dB
}
```

### 无声检测
```typescript
let silenceStartTime = null;

function checkSilence(rms: number, silenceThreshold: number, silenceDuration: number) {
  if (rms < silenceThreshold) {
    if (silenceStartTime === null) {
      silenceStartTime = Date.now();
    }
    if (Date.now() - silenceStartTime >= silenceDuration) {
      return true; // 检测到 N 秒无声
    }
  } else {
    silenceStartTime = null; // 重置
  }
  return false;
}
```

### 有效性检查
```typescript
function isValidRecording(
  audioBuffer: Float32Array, 
  duration: number,
  minDuration: number,
  minRMS: number
) {
  const rms = calculateRMS(audioBuffer);
  
  if (duration < minDuration) {
    return { valid: false, reason: '请说长一点' };
  }
  if (rms < minRMS) {
    return { valid: false, reason: '无声或音量极低' };
  }
  return { valid: true };
}
```

---

## 测试场景

### 场景 1：正常跟读
```
✓ 示范音播完 → 自动开始录音
✓ 用户说 "Hello" → 录音 1.2s
✓ 停止说话 → 3s 无声 → 自动停止
✓ 检测：有效 → ASR 评测 → 显示分数 85
✓ 通过 → 自动推进
```

### 场景 2：用户迟到（第 1 次无声）
```
✓ 自动开始录音 → 等待用户
✓ 3s 无声 → 检测到无声
✓ 重试 1/3 → 播放提示音 → 重新播放示范音
✓ 用户开始说话 → 录音 1.5s → 有效
✓ ASR 评测 → 显示结果
```

### 场景 3：用户完全没准备（3 次都无声）
```
✓ 第 1 次无声 → 重试 1/3 → 提示
✓ 第 2 次无声 → 重试 2/3 → 提示
✓ 第 3 次无声 → 重试 3/3 → 提示
✓ 第 4 次无声 → 给放弃 → 自动跳下一个
```

### 场景 4：用户点击停止
```
✓ 自动开始录音 → 用户说话 0.8s
✓ 用户点击"停止"按钮
✓ 录音停止 → 检测：不足 1s → 无效
✓ 提示"请说长一点" → 重试
```

---

## 相关文件

| 文件 | 用途 |
|------|------|
| `english-learning-requirements-v0.4.0.md` | 3.3.2-3.3.3 章节更新了流程设计 |
| `useAutoFollowAlongRecording.ts` | 完整的 Hook 实现 |
| `AUTO_FOLLOWALONG_DESIGN.md` | 详细设计文档 |
| 本文件 | 快速参考 |

---

## 常见问题

**Q: 为什么要 3 秒无声才停止？**  
A: 考虑用户可能会停顿。3 秒是合理的平衡点，既能检测到真正的无声，又不会过长。

**Q: 为什么最多重试 3 次？**  
A: 3 次给用户足够的机会准备，但也防止无限循环。可根据实际调整。

**Q: 提示音 800Hz 能改吗？**  
A: 可以，改 `PROMPT_SOUND_FREQ` 参数即可。推荐用 600-1000Hz 的声调。

**Q: 无声 RMS < 20dB 是硬编码吗？**  
A: 是的，但可以作为参数传入 Hook。环境不同可能需要调整。

**Q: 用户能跳过无声重试吗？**  
A: 目前不能，因为这是自动流程。如需跳过，可改为"给出提示+让用户选择"。

---

## 后续改进方向

1. **动态阈值**: 根据环境噪音自动调整 `SILENCE_THRESHOLD`
2. **VAD 集成**: 使用 Web Audio API 的 Voice Activity Detection 更精准
3. **重试提示**: 可选地让用户选择"重试"或"跳过"而不是自动重试
4. **反馈优化**: 根据无声原因给出不同的提示（如"麦克风问题"vs"网络问题"）
5. **学习曲线**: 根据用户水平调整重试次数和阈值

---

**版本历史**:
- v0.4.0: 原设计（点击录音 + 手动回放）
- v0.4.1: 添加自动回放（点击录音 + 自动回放）
- v0.4.2: 完全自动化（自动录音 + 3s 无声 + 最多 3 次重试）← **当前**

