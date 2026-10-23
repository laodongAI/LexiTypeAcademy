/**
 * useFollowAlongRecordingPlayback.ts
 * 跟读练习中的录音回放 Hook
 * 
 * 功能：
 * 1. 录制用户音频
 * 2. 自动回放用户录音
 * 3. 支持重新听、跳过回放
 * 4. 回放完后自动触发 ASR 评测
 */

import { useState, useRef, useCallback, useEffect } from 'react';

// ========================================
// 类型定义
// ========================================

export interface RecordingPlaybackState {
  // 录音相关
  isRecording: boolean;
  recordingDuration: number; // 秒
  audioBlob?: Blob;
  audioUrl?: string;

  // 回放相关
  isPlayingUserRecording: boolean;
  canSkipPlayback: boolean;
  canReplayUserRecording: boolean;
  playbackProgress: number; // 0-100
  playbackCurrentTime: number; // 秒

  // 状态机
  phase: 'idle' | 'recording' | 'playback' | 'evaluating';
  error?: string;
}

export interface UseFollowAlongRecordingPlaybackOptions {
  // 自动回放配置
  autoPlayAfterRecording?: boolean; // 默认: true
  skipPlaybackDuration?: number; // 毫秒，何时显示"跳过"按钮（默认: 1000）

  // 评测回调
  onEvaluationRequired?: (audioBlob: Blob) => Promise<void>;
  onRecordingComplete?: (audioBlob: Blob) => void;

  // 错误处理
  onError?: (error: Error) => void;
}

// ========================================
// 主 Hook
// ========================================

export function useFollowAlongRecordingPlayback(
  options: UseFollowAlongRecordingPlaybackOptions = {}
) {
  const {
    autoPlayAfterRecording = true,
    skipPlaybackDuration = 1000,
    onEvaluationRequired,
    onRecordingComplete,
    onError
  } = options;

  // 状态管理
  const [state, setState] = useState<RecordingPlaybackState>({
    isRecording: false,
    recordingDuration: 0,
    isPlayingUserRecording: false,
    canSkipPlayback: false,
    canReplayUserRecording: false,
    playbackProgress: 0,
    playbackCurrentTime: 0,
    phase: 'idle'
  });

  // 引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const recordingStartTimeRef = useRef<number | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const skipPlaybackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const updatePlaybackProgressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // ========================================
  // 1. 开始录音
  // ========================================

  const startRecording = useCallback(async () => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm'
      });

      recordingChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordingChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        // 合并 Blob
        const audioBlob = new Blob(recordingChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);

        setState(prev => ({
          ...prev,
          audioBlob,
          audioUrl,
          isRecording: false
        }));

        onRecordingComplete?.(audioBlob);

        // 如果启用自动回放，则自动进入回放阶段
        if (autoPlayAfterRecording) {
          setTimeout(() => playUserRecording(audioUrl), 100);
        }

        // 停止录音流
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();

      recordingStartTimeRef.current = Date.now();
      setState(prev => ({
        ...prev,
        isRecording: true,
        phase: 'recording',
        recordingDuration: 0
      }));

      // 更新录音时长
      const durationInterval = setInterval(() => {
        if (recordingStartTimeRef.current) {
          const duration = (Date.now() - recordingStartTimeRef.current) / 1000;
          setState(prev => ({
            ...prev,
            recordingDuration: Math.round(duration * 10) / 10
          }));
        }
      }, 100);

      // 自动停止（防止无限录音，最多 30 秒）
      setTimeout(() => {
        stopRecording();
        clearInterval(durationInterval);
      }, 30000);
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: `无法启动录音: ${err.message}`
      }));
      onError?.(err);
    }
  }, [autoPlayAfterRecording, onRecordingComplete, onError]);

  // ========================================
  // 2. 停止录音
  // ========================================

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ========================================
  // 3. 自动回放用户录音
  // ========================================

  const playUserRecording = useCallback(async (audioUrl: string) => {
    try {
      // 创建音频元素
      let audioElement = audioElementRef.current;
      if (!audioElement) {
        audioElement = new Audio();
        audioElementRef.current = audioElement;
      }

      audioElement.src = audioUrl;
      setState(prev => ({
        ...prev,
        phase: 'playback',
        isPlayingUserRecording: true,
        canSkipPlayback: false,
        playbackProgress: 0
      }));

      // 开始播放
      await audioElement.play();

      // 显示"跳过回放"按钮（延迟显示，避免用户刚按下就跳过）
      skipPlaybackTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          canSkipPlayback: true
        }));
      }, skipPlaybackDuration);

      // 更新播放进度
      updatePlaybackProgressIntervalRef.current = setInterval(() => {
        if (audioElement) {
          const progress = (audioElement.currentTime / audioElement.duration) * 100;
          setState(prev => ({
            ...prev,
            playbackProgress: progress,
            playbackCurrentTime: audioElement.currentTime
          }));
        }
      }, 100);

      // 回放完成
      audioElement.onended = () => {
        setState(prev => ({
          ...prev,
          isPlayingUserRecording: false,
          canReplayUserRecording: true,
          playbackProgress: 100
        }));

        if (updatePlaybackProgressIntervalRef.current) {
          clearInterval(updatePlaybackProgressIntervalRef.current);
        }

        // 回放完后自动进入评测
        triggerEvaluation();
      };
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: `播放失败: ${err.message}`,
        isPlayingUserRecording: false
      }));
      onError?.(err);
    }
  }, [skipPlaybackDuration, onError]);

  // ========================================
  // 4. 重新听回放
  // ========================================

  const replayUserRecording = useCallback(() => {
    if (audioElementRef.current && state.audioUrl) {
      audioElementRef.current.currentTime = 0;
      audioElementRef.current.play();

      setState(prev => ({
        ...prev,
        isPlayingUserRecording: true,
        canSkipPlayback: false,
        playbackProgress: 0
      }));

      // 再次显示"跳过"按钮
      skipPlaybackTimeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          canSkipPlayback: true
        }));
      }, skipPlaybackDuration);
    }
  }, [state.audioUrl, skipPlaybackDuration]);

  // ========================================
  // 5. 跳过回放，直接进入评测
  // ========================================

  const skipPlayback = useCallback(() => {
    // 停止回放
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    if (updatePlaybackProgressIntervalRef.current) {
      clearInterval(updatePlaybackProgressIntervalRef.current);
    }

    if (skipPlaybackTimeoutRef.current) {
      clearTimeout(skipPlaybackTimeoutRef.current);
    }

    setState(prev => ({
      ...prev,
      isPlayingUserRecording: false,
      canReplayUserRecording: true
    }));

    // 直接触发评测
    triggerEvaluation();
  }, []);

  // ========================================
  // 6. 触发 ASR 评测
  // ========================================

  const triggerEvaluation = useCallback(async () => {
    if (!state.audioBlob) return;

    try {
      setState(prev => ({
        ...prev,
        phase: 'evaluating'
      }));

      // 调用外部评测函数
      if (onEvaluationRequired) {
        await onEvaluationRequired(state.audioBlob);
      }
    } catch (error) {
      const err = error as Error;
      setState(prev => ({
        ...prev,
        error: `评测失败: ${err.message}`
      }));
      onError?.(err);
    }
  }, [state.audioBlob, onEvaluationRequired, onError]);

  // ========================================
  // 7. 重置状态（开始新一轮）
  // ========================================

  const reset = useCallback(() => {
    // 清理
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    if (skipPlaybackTimeoutRef.current) {
      clearTimeout(skipPlaybackTimeoutRef.current);
    }

    if (updatePlaybackProgressIntervalRef.current) {
      clearInterval(updatePlaybackProgressIntervalRef.current);
    }

    // 重置状态
    setState({
      isRecording: false,
      recordingDuration: 0,
      audioBlob: undefined,
      audioUrl: undefined,
      isPlayingUserRecording: false,
      canSkipPlayback: false,
      canReplayUserRecording: false,
      playbackProgress: 0,
      playbackCurrentTime: 0,
      phase: 'idle',
      error: undefined
    });

    recordingChunksRef.current = [];
    recordingStartTimeRef.current = null;
  }, []);

  // 清理
  useEffect(() => {
    return () => {
      if (skipPlaybackTimeoutRef.current) {
        clearTimeout(skipPlaybackTimeoutRef.current);
      }

      if (updatePlaybackProgressIntervalRef.current) {
        clearInterval(updatePlaybackProgressIntervalRef.current);
      }

      // 停止录音
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  return {
    // 状态
    state,

    // 操作
    startRecording,
    stopRecording,
    replayUserRecording,
    skipPlayback,
    reset,

    // 调试
    audioElementRef
  };
}

// ========================================
// React 组件示例
// ========================================

export function FollowAlongRecordingPlaybackUI() {
  const { state, startRecording, stopRecording, replayUserRecording, skipPlayback } =
    useFollowAlongRecordingPlayback({
      autoPlayAfterRecording: true,
      onEvaluationRequired: async (audioBlob) => {
        console.log('开始评测，音频大小:', audioBlob.size);
        // 调用 ASR 服务
      }
    });

  return (
    <div className="recording-playback-ui">
      {/* 录音阶段 */}
      {state.phase === 'recording' && (
        <div className="recording-phase">
          <button onClick={stopRecording}>停止录音</button>
          <span>已录音: {state.recordingDuration}s</span>
        </div>
      )}

      {/* 回放阶段 */}
      {state.phase === 'playback' && (
        <div className="playback-phase">
          <div className="playback-progress">
            <div
              className="progress-bar"
              style={{ width: `${state.playbackProgress}%` }}
            />
          </div>
          <div className="playback-controls">
            {state.canReplayUserRecording && (
              <button onClick={replayUserRecording}>重新听</button>
            )}
            {state.canSkipPlayback && (
              <button onClick={skipPlayback}>不需要回放，直接评测</button>
            )}
          </div>
        </div>
      )}

      {/* 评测阶段 */}
      {state.phase === 'evaluating' && (
        <div className="evaluating-phase">
          <span>正在评测你的发音...</span>
        </div>
      )}

      {/* 错误 */}
      {state.error && <div className="error-message">{state.error}</div>}

      {/* 初始状态：显示开始录音按钮 */}
      {state.phase === 'idle' && !state.audioUrl && (
        <button onClick={startRecording}>开始录音</button>
      )}
    </div>
  );
}
