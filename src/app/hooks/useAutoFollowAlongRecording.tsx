/**
 * useAutoFollowAlongRecording.ts
 * 自动跟读录音 Hook（新版本）
 * 
 * 功能流程：
 * 1. 自动录音：示范音播完后立即自动开始
 * 2. 自动停止：3 秒无声则自动停止
 * 3. 无声检测：如果无声，自动重试（最多 3 次）
 * 4. ASR 评测：有效声音才进行评测
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ========================================
// 类型定义
// ========================================

export interface AutoFollowAlongRecordingState {
  // 录音阶段
  phase: 'idle' | 'reference_audio' | 'recording' | 'silence_check' | 'evaluating' | 'feedback' | 'next_word';
  
  // 录音数据
  audioBlob?: Blob;
  audioUrl?: string;
  recordingDuration: number; // 秒
  
  // 无声重试
  silenceRetryCount: number; // 0-3
  isNoSound: boolean;
  
  // 音量显示
  currentRMS: number; // dB，用于 UI 显示音量条
  
  // 状态标志
  isRecording: boolean;
  error?: string;
}

export interface UseAutoFollowAlongRecordingOptions {
  // 录音配置
  silenceDuration?: number; // 毫秒，默认 3000ms
  silenceThreshold?: number; // dB，默认 20dB
  minRecordingDuration?: number; // 毫秒，默认 1000ms
  validRMSThreshold?: number; // 有效声音的 RMS 下限，默认 30dB
  
  // 回调
  onReferenceAudioEnd?: () => void; // 示范音播完，立即开始录音
  onEvaluationRequired?: (audioBlob: Blob) => Promise<{
    score: number;
    errorPhonemes: string[];
    feedback: string;
  }>;
  onNoSound?: (retryCount: number) => void; // 检测到无声
  onFeedback?: (result: any) => void; // 评测完成
  onError?: (error: Error) => void;
}

// ========================================
// 主 Hook
// ========================================

export function useAutoFollowAlongRecording(
  options: UseAutoFollowAlongRecordingOptions = {}
) {
  const {
    silenceDuration = 3000,
    silenceThreshold = 20,
    minRecordingDuration = 1000,
    validRMSThreshold = 30,
    onReferenceAudioEnd,
    onEvaluationRequired,
    onNoSound,
    onFeedback,
    onError
  } = options;

  // 状态
  const [state, setState] = useState<AutoFollowAlongRecordingState>({
    phase: 'idle',
    recordingDuration: 0,
    silenceRetryCount: 0,
    isNoSound: false,
    currentRMS: 0,
    isRecording: false
  });

  // 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingStartTimeRef = useRef<number | null>(null);
  const silenceStartTimeRef = useRef<number | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const dataAvailableListenerRef = useRef<((event: BlobEvent) => void) | null>(null);
  const stopListenerRef = useRef<(() => void) | null>(null);

  // ========================================
  // 1. 示范音播完后自动开始录音
  // ========================================

  const startAutoRecording = useCallback(async () => {
    try {
      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 创建 AudioContext 用于实时音量检测
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      recordingChunksRef.current = [];

      // 数据可用时回调
      dataAvailableListenerRef.current = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };
      mediaRecorder.addEventListener('dataavailable', dataAvailableListenerRef.current);

      // 录音停止时的处理
      stopListenerRef.current = () => {
        const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        const duration = recordingStartTimeRef.current
          ? Date.now() - recordingStartTimeRef.current
          : 0;

        // 检查声音有效性
        if (duration < minRecordingDuration || state.currentRMS < validRMSThreshold) {
          setState(prev => ({
            ...prev,
            isNoSound: true,
            phase: 'silence_check'
          }));

          onNoSound?.(state.silenceRetryCount + 1);

          // 处理无声重试
          handleSilenceRetry();
        } else {
          // 有效声音，进入评测
          setState(prev => ({
            ...prev,
            audioBlob,
            audioUrl,
            isRecording: false,
            phase: 'evaluating',
            isNoSound: false
          }));

          // 触发 ASR 评测
          if (onEvaluationRequired) {
            evaluateRecording(audioBlob);
          }
        }

        // 停止音频流
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorder.addEventListener('stop', stopListenerRef.current);

      mediaRecorderRef.current = mediaRecorder;

      // 开始录音
      mediaRecorder.start();
      recordingStartTimeRef.current = Date.now();

      setState(prev => ({
        ...prev,
        phase: 'recording',
        isRecording: true,
        recordingDuration: 0,
        currentRMS: 0
      }));

      // 更新录音时长
      recordingTimerRef.current = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
          setState(prev => ({
            ...prev,
            recordingDuration: Math.round(duration * 10) / 10
          }));
        }
      }, 100);

      // 实时音量检测（检测无声）
      silenceCheckIntervalRef.current = setInterval(() => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);

        // 计算 RMS（简化版）
        const rms = Math.sqrt(
          dataArray.reduce((sum, val) => sum + val * val, 0) / dataArray.length
        );
        const rmsDb = 20 * Math.log10(rms + 1e-10);

        setState(prev => ({
          ...prev,
          currentRMS: Math.max(0, rmsDb) // 确保非负
        }));

        // 检测无声
        if (rmsDb < silenceThreshold) {
          if (silenceStartTimeRef.current === null) {
            silenceStartTimeRef.current = Date.now();
          }

          // 连续无声 3 秒则停止
          if (Date.now() - silenceStartTimeRef.current >= silenceDuration) {
            stopAutoRecording();
          }
        } else {
          silenceStartTimeRef.current = null; // 重置
        }
      }, 100);

      // 防止无限录音（最多 30 秒）
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopAutoRecording();
        }
      }, 30000);
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: `无法启动录音: ${err.message}`
      }));
      onError?.(err);
    }
  }, [silenceDuration, silenceThreshold, minRecordingDuration, validRMSThreshold, state.silenceRetryCount, state.currentRMS, onEvaluationRequired, onNoSound, onError]);

  // ========================================
  // 2. 停止录音
  // ========================================

  const stopAutoRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // 清理定时器
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }

    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
    }
  }, []);

  // ========================================
  // 3. 无声重试处理
  // ========================================

  const handleSilenceRetry = useCallback(() => {
    const newRetryCount = state.silenceRetryCount + 1;

    if (newRetryCount < 3) {
      // 还可以重试
      setState(prev => ({
        ...prev,
        silenceRetryCount: newRetryCount
      }));

      // 播放提示音 "请跟我朗读"
      playPromptSound();

      // 等待 1 秒后重新开始
      setTimeout(() => {
        // 重新播放示范音并重启录音
        onReferenceAudioEnd?.();
        startAutoRecording();
      }, 1000);
    } else {
      // 超过 3 次，跳到下一个词
      setState(prev => ({
        ...prev,
        phase: 'next_word',
        silenceRetryCount: 0
      }));
    }
  }, [state.silenceRetryCount, onReferenceAudioEnd, startAutoRecording]);

  // ========================================
  // 4. 播放提示音
  // ========================================

  const playPromptSound = useCallback(async () => {
    try {
      // 使用 Web Audio API 合成提示音
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      // 生成 800Hz 的提示音（500ms）
      oscillator.frequency.value = 800;
      gain.gain.setValueAtTime(0.3, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.error('提示音播放失败:', error);
    }
  }, []);

  // ========================================
  // 5. ASR 评测
  // ========================================

  const evaluateRecording = useCallback(async (audioBlob: Blob) => {
    try {
      if (!onEvaluationRequired) return;

      const result = await onEvaluationRequired(audioBlob);

      setState(prev => ({
        ...prev,
        phase: 'feedback'
      }));

      onFeedback?.(result);

      // 判断是否需要重试
      if (result.score < 80) {
        // 未通过，显示"重试"选项
        // （UI 层面处理）
      } else {
        // 通过，自动推进
        setTimeout(() => {
          setState(prev => ({
            ...prev,
            phase: 'next_word'
          }));
        }, 2000);
      }
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: `评测失败: ${err.message}`
      }));
      onError?.(err);
    }
  }, [onEvaluationRequired, onFeedback, onError]);

  // ========================================
  // 6. 重试（用户点击"重试"按钮）
  // ========================================

  const handleRetry = useCallback(() => {
    // 重置状态
    setState(prev => ({
      ...prev,
      phase: 'reference_audio',
      recordingDuration: 0,
      currentRMS: 0
    }));

    // 重新播放示范音
    onReferenceAudioEnd?.();
  }, [onReferenceAudioEnd]);

  // ========================================
  // 7. 跳过（自动跳到下一个词）
  // ========================================

  const skipToNextWord = useCallback(() => {
    setState(prev => ({
      ...prev,
      phase: 'idle',
      recordingDuration: 0,
      currentRMS: 0,
      silenceRetryCount: 0,
      isNoSound: false
    }));

    recordingChunksRef.current = [];
    recordingStartTimeRef.current = null;
    silenceStartTimeRef.current = null;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }

      if (silenceCheckIntervalRef.current) {
        clearInterval(silenceCheckIntervalRef.current);
      }

      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }

      if (dataAvailableListenerRef.current && mediaRecorderRef.current) {
        mediaRecorderRef.current.removeEventListener('dataavailable', dataAvailableListenerRef.current);
      }

      if (stopListenerRef.current && mediaRecorderRef.current) {
        mediaRecorderRef.current.removeEventListener('stop', stopListenerRef.current);
      }
    };
  }, []);

  return {
    state,
    startAutoRecording,
    stopAutoRecording,
    handleRetry,
    skipToNextWord
  };
}

// ========================================
// UI 组件示例
// ========================================

export function AutoFollowAlongUI() {
  const { state, startAutoRecording, stopAutoRecording, handleRetry, skipToNextWord } =
    useAutoFollowAlongRecording({
      silenceDuration: 3000,
      onReferenceAudioEnd: () => {
        console.log('示范音播完，自动开始录音');
      },
      onEvaluationRequired: async (audioBlob) => {
        console.log('开始评测', audioBlob.size);
        // 调用 ASR 服务
        return {
          score: 85,
          errorPhonemes: [],
          feedback: '很好！'
        };
      },
      onNoSound: (retryCount) => {
        console.log(`检测到无声，重试次数: ${retryCount}`);
      }
    });

  return (
    <div className="auto-follow-along-ui">
      {/* 显示当前阶段 */}
      <div className="phase-indicator">
        {state.phase === 'recording' && (
          <div className="recording-phase">
            <div className="mic-animation">🎤</div>
            <div className="volume-bar">
              <div
                className="volume-fill"
                style={{
                  height: `${Math.min(100, (state.currentRMS + 20) * 2)}%`
                }}
              />
            </div>
            <span>已录音: {state.recordingDuration.toFixed(1)}s</span>
            <button onClick={stopAutoRecording}>停止</button>
          </div>
        )}

        {state.phase === 'silence_check' && (
          <div className="silence-check-phase">
            <span>检测到无声... 重试 {state.silenceRetryCount}/3</span>
          </div>
        )}

        {state.phase === 'evaluating' && (
          <div className="evaluating-phase">
            <span>正在评测你的发音...</span>
          </div>
        )}

        {state.phase === 'feedback' && (
          <div className="feedback-phase">
            <span>评测完成</span>
            <button onClick={handleRetry}>重试</button>
            <button onClick={skipToNextWord}>下一个</button>
          </div>
        )}

        {state.phase === 'next_word' && (
          <div className="next-word-phase">
            <span>跳到下一个词</span>
          </div>
        )}

        {state.error && (
          <div className="error-message">{state.error}</div>
        )}
      </div>
    </div>
  );
}
