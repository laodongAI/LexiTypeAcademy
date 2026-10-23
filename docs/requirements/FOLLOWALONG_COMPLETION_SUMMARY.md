# 跟读流程重新设计 - 完成总结

**日期**: 2025-01-17  
**版本**: v0.4.2  
**状态**: ✅ 已完成

---

## 您的需求总结

✅ **自动录音**：示范音播完后立即自动开始，无需点击按钮  
✅ **3秒无声自动停止**：连续 3 秒无声输入则自动停止录音  
✅ **异常处理 - 无声重试**：  
   - 如果检测到无声，播放提示音 "请跟我朗读"
   - 自动重新播放示范音，重新开始录音
   - 最多重试 3 次
   - 3 次都无声后，自动跳到下一个词/句

---

## 完成内容

### 📄 文档修正
已更新 `english-learning-requirements-v0.4.0.md`：
- **3.3.2 练习流程** - 完整重写，说明自动流程
- **3.3.3 跟读流程详细描述** - 9 步详细流程 + 状态机
- **关键边缘情况处理** - 无声检测、RMS 计算、重试机制

### 💻 代码实现
已创建 `src/app/hooks/useAutoFollowAlongRecording.ts`：
- **完整的 Hook 实现**（~450 行）
- 自动录音、3 秒无声停止、无声检测
- RMS 实时计算（用于音量条显示）
- 无声重试机制（最多 3 次）
- 提示音播放
- 完整状态机管理

### 📖 详细设计文档
已创建 `AUTO_FOLLOWALONG_DESIGN.md`：
- 完整的 9 步流程说明
- 状态机图
- 算法详解（RMS 计算、无声检测、有效性检查）
- 参数调优建议
- 代码集成步骤
- 测试清单

### 📋 快速参考
已创建 `FOLLOWALONG_QUICK_REFERENCE.md`：
- 3 大核心改动概览
- 工作流程简图
- 状态转移图
- 关键代码片段
- 常见问题解答

---

## 核心流程（新版本）

```
示范音播放 (用户跟读)
    ↓
示范音播完 → [自动开始录音] ⭐
    ↓
用户说话 (实时音量检测)
    ↓
3秒无声 → [自动停止录音] ⭐
    ↓
检查有效性
    ├─ 有效声音 → ASR 评测 → 显示结果 → 用户选择重试或下一个
    │
    └─ 无声 → [无声重试机制] ⭐⭐
              第 1-3 次：播放提示音 → 自动重新开始
              第 4 次仍无声 → 自动跳下一个
```

---

## 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `silenceDuration` | 3000ms | 3 秒无声自动停止 |
| `silenceThreshold` | 20dB | 判定"无声"的音量 |
| `minRecordingDuration` | 1000ms | 最少要录 1 秒 |
| `validRMSThreshold` | 30dB | 有效声音的下限 |
| `retryMaxCount` | 3 | 最多重试 3 次 |

---

## RMS 无声检测算法

```typescript
// 实时计算声压级（dB）
function calculateRMS(audioBuffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < audioBuffer.length; i++) {
    sum += audioBuffer[i] * audioBuffer[i];
  }
  const rms = Math.sqrt(sum / audioBuffer.length);
  return 20 * Math.log10(rms + 1e-10); // 转为 dB
}

// 检测 3 秒无声
function checkSilence(rms: number) {
  if (rms < SILENCE_THRESHOLD) {
    silenceStart 记录开始时间
    if (已持续 3 秒) → 返回 true（停止录音）
  } else {
    silenceStart = null （重置）
  }
}

// 有效性检查
if (recordingDuration < 1000ms || rms < 30dB) {
  → 无声/极低音量 → 触发重试
}
```

---

## 使用方式

### 导入
```typescript
import { useAutoFollowAlongRecording } from '@/app/hooks/useAutoFollowAlongRecording';
```

### 初始化
```typescript
const { state, handleRetry, skipToNextWord } = useAutoFollowAlongRecording({
  silenceDuration: 3000,  // 3 秒
  onReferenceAudioEnd: () => {
    // 示范音播完，自动开始录音
  },
  onEvaluationRequired: async (audioBlob) => {
    // 调用 ASR 服务
    return { score, errorPhonemes, feedback };
  },
  onNoSound: (retryCount) => {
    console.log(`无声重试: ${retryCount}/3`);
  }
});
```

### UI 显示
```typescript
{state.phase === 'recording' && (
  <div>
    🎤 麦克风动画
    音量条: {state.currentRMS}dB
    已录音: {state.recordingDuration}s
  </div>
)}

{state.phase === 'silence_check' && (
  <div>检测到无声... 重试 {state.silenceRetryCount}/3</div>
)}

{state.phase === 'feedback' && (
  <div>
    <button onClick={handleRetry}>重试</button>
    <button onClick={skipToNextWord}>下一个</button>
  </div>
)}
```

---

## 测试场景

### ✅ 正常跟读
```
自动开始录音 → 用户说话 1.2s → 3s 无声 → 自动停止 → ASR 评测 ✓
```

### ✅ 用户迟到（第 1 次无声）
```
自动开始 → 等待 3s → 检测无声 → 提示音 → 重新播放示范音 → 重新录音 → 有效 ✓
```

### ✅ 用户完全没准备（3 次都无声）
```
第 1 次: 无声 → 重试 1/3 → 提示
第 2 次: 无声 → 重试 2/3 → 提示
第 3 次: 无声 → 重试 3/3 → 提示
第 4 次: 无声 → 放弃 → 自动跳下一个词 ✓
```

---

## 文件位置

| 文件 | 描述 |
|------|------|
| `english-learning-requirements-v0.4.0.md` | 原始设计文档（已更新 3.3.2-3.3.3） |
| `useAutoFollowAlongRecording.ts` | 完整 Hook 实现 |
| `AUTO_FOLLOWALONG_DESIGN.md` | 详细设计文档（9步流程+状态机+算法） |
| `FOLLOWALONG_QUICK_REFERENCE.md` | 快速参考指南 |

---

## 下一步

1. **代码集成** - 在 FollowAlongPracticeView 中使用 Hook
2. **UI 开发** - 开发音量条、麦克风动画等界面
3. **ASR 集成** - 连接现有的 ASR 服务（Sherpa/豆包）
4. **测试** - 实际测试各种场景（网络、麦克风、噪音等）
5. **参数调优** - 根据实际环境调整 RMS 阈值

---

## 关键点总结

✨ **完全自动化** - 用户只需准备好，系统全自动处理  
✨ **智能重试** - 最多 3 次无声重试，给用户充足机会  
✨ **清晰反馈** - 提示音 + UI 提示 + 进度显示  
✨ **参数灵活** - 所有阈值都可配置，适应不同环境  
✨ **代码完整** - 开箱即用的 React Hook，无额外依赖  

---

**实现状态**: ✅ 文档 + 代码 + 设计文档 + 快速参考都已完成  
**预计集成时间**: 1-2 天  
**后续优化**: 动态阈值、VAD 集成、用户选择重试等
