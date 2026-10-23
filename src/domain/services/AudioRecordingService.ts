/**
 * 音频录制服务（领域服务）
 * 
 * 职责：
 * - 实现自动录音开始/停止
 * - 无声检测（3秒无声自动停止）
 * - 有效性检查（RMS阈值检测）
 * - 无声重试机制（最多3次）
 * 
 * 基于需求文档：english-learning-requirements-v0.4.0.md
 * 第 3.3.3 节 - 跟读流程详细描述
 */

export interface AudioRecordingConfig {
  /** 无声检测阈值（dB），默认 20dB */
  silenceThreshold: number;
  /** 无声持续时间（ms），默认 3000ms（3秒） */
  silenceDuration: number;
  /** 有效音频RMS阈值（dB），默认 30dB */
  validAudioThreshold: number;
  /** 最小录音时长（ms），默认 1000ms */
  minRecordingDuration: number;
  /** 最大重试次数，默认 3 */
  maxRetries: number;
}

export interface AudioValidityResult {
  valid: boolean;
  reason?: string;
  rms: number;
  duration: number;
}

export interface RecordingResult {
  blob: Blob;
  duration: number;
  isValid: boolean;
  retryCount: number;
  validityResult: AudioValidityResult;
}

/**
 * 音频录制服务类
 */
export class AudioRecordingService {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private microphone: MediaStreamAudioSourceNode | null = null;
  private silenceStart: number | null = null;
  private recordingStartTime: number = 0;
  private retryCount: number = 0;
  
  private config: AudioRecordingConfig = {
    silenceThreshold: 20,
    silenceDuration: 3000,
    validAudioThreshold: 30,
    minRecordingDuration: 1000,
    maxRetries: 3
  };

  constructor(config?: Partial<AudioRecordingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  /**
   * 初始化音频输入设备
   */
  async initialize(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });

      // 创建音频上下文
      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      
      // 连接麦克风
      this.microphone = this.audioContext.createMediaStreamSource(stream);
      this.microphone.connect(this.analyser);

      // 创建录音器
      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      console.log('[AudioRecordingService] 初始化成功');
    } catch (error) {
      console.error('[AudioRecordingService] 初始化失败:', error);
      throw new Error('无法访问麦克风，请检查权限设置');
    }
  }

  /**
   * 开始录音（自动模式）
   * 自动检测3秒无声后停止
   */
  async startRecording(): Promise<void> {
    if (!this.mediaRecorder) {
      throw new Error('录音服务未初始化，请先调用 initialize()');
    }

    this.audioChunks = [];
    this.silenceStart = null;
    this.recordingStartTime = Date.now();
    
    this.mediaRecorder.start(100); // 每100ms触发一次dataavailable事件
    
    console.log('[AudioRecordingService] 开始录音');
    
    // 启动无声检测
    this.startSilenceDetection();
  }

  /**
   * 手动停止录音
   */
  async stopRecording(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('录音服务未初始化'));
        return;
      }

      this.mediaRecorder.onstop = async () => {
        const duration = Date.now() - this.recordingStartTime;
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        
        // 检查有效性
        const validityResult = await this.checkAudioValidity(blob, duration);
        
        const result: RecordingResult = {
          blob,
          duration,
          isValid: validityResult.valid,
          retryCount: this.retryCount,
          validityResult
        };

        console.log('[AudioRecordingService] 录音停止:', result);
        resolve(result);
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * 实时计算RMS（声压级）
   */
  private calculateRMS(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    this.analyser.getFloatTimeDomainData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i] * dataArray[i];
    }
    
    const rms = Math.sqrt(sum / bufferLength);
    
    // 转换为 dB: 20 * log10(rms)
    const dB = 20 * Math.log10(rms + 1e-10);
    
    return dB;
  }

  /**
   * 启动无声检测循环
   */
  private startSilenceDetection(): void {
    const checkInterval = setInterval(() => {
      if (!this.mediaRecorder || this.mediaRecorder.state !== 'recording') {
        clearInterval(checkInterval);
        return;
      }

      const rms = this.calculateRMS();
      
      if (rms < this.config.silenceThreshold) {
        // 检测到无声
        if (this.silenceStart === null) {
          this.silenceStart = Date.now();
          console.log('[AudioRecordingService] 检测到无声开始');
        }
        
        const silenceDuration = Date.now() - this.silenceStart;
        if (silenceDuration >= this.config.silenceDuration) {
          console.log('[AudioRecordingService] 连续3秒无声，自动停止录音');
          clearInterval(checkInterval);
          this.stopRecording();
        }
      } else {
        // 有声音，重置无声计时
        if (this.silenceStart !== null) {
          console.log('[AudioRecordingService] 检测到声音，重置无声计时');
        }
        this.silenceStart = null;
      }
    }, 100); // 每100ms检测一次
  }

  /**
   * 检查音频有效性
   */
  private async checkAudioValidity(
    blob: Blob, 
    duration: number
  ): Promise<AudioValidityResult> {
    // 检查时长
    if (duration < this.config.minRecordingDuration) {
      return {
        valid: false,
        reason: '请说长一点（至少1秒）',
        rms: 0,
        duration
      };
    }

    // 检查RMS水平（需要解码音频）
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioContext = new AudioContext();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const rms = Math.sqrt(sum / channelData.length);
      const dB = 20 * Math.log10(rms + 1e-10);
      
      if (dB < this.config.validAudioThreshold) {
        return {
          valid: false,
          reason: '无声或音量极低，请提高音量',
          rms: dB,
          duration
        };
      }

      return {
        valid: true,
        rms: dB,
        duration
      };
    } catch (error) {
      console.error('[AudioRecordingService] 解码音频失败:', error);
      return {
        valid: false,
        reason: '音频格式错误',
        rms: 0,
        duration
      };
    }
  }

  /**
   * 增加重试计数
   */
  incrementRetry(): void {
    this.retryCount++;
  }

  /**
   * 重置重试计数
   */
  resetRetry(): void {
    this.retryCount = 0;
  }

  /**
   * 检查是否可以重试
   */
  canRetry(): boolean {
    return this.retryCount < this.config.maxRetries;
  }

  /**
   * 获取实时音量（用于UI显示）
   */
  getCurrentVolume(): number {
    if (!this.analyser) return 0;
    
    const rms = this.calculateRMS();
    // 将dB转换为0-100的音量值
    const normalized = Math.max(0, Math.min(100, (rms + 60) * 100 / 60));
    return normalized;
  }

  /**
   * 清理资源
   */
  dispose(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.microphone) {
      this.microphone.disconnect();
    }

    if (this.audioContext) {
      this.audioContext.close();
    }

    console.log('[AudioRecordingService] 资源已清理');
  }
}
