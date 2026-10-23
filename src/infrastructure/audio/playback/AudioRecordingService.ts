/**
 * 音频录音服务
 * 
 * 功能:
 * 1. AudioWorklet录音管理
 * 2. PCM数据处理
 * 3. 降噪+增益集成 (复用ASR的音频处理)
 * 4. 录音时长限制
 * 5. 实时监控
 * 
 * 优化:
 * - AudioWorklet高性能录音
 * - 实时音量监控
 * - 自动停止超时
 */

import { RecordingState, RecordingOptions } from './types';
import { AudioContextManager } from '../storage/AudioContextManager';

/**
 * 录音数据回调
 */
export type RecordingDataCallback = (data: Float32Array) => void;

/**
 * 录音完成回调
 */
export type RecordingCompleteCallback = (audioBlob: Blob, duration: number) => void;

/**
 * 音频录音服务
 */
export class AudioRecordingService {
  private state: RecordingState = RecordingState.IDLE;
  private audioContext: AudioContext;
  private mediaStream: MediaStream | null = null;
  private mediaStreamSource: MediaStreamAudioSourceNode | null = null;
  private audioWorkletNode: AudioWorkletNode | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private recordedChunks: Float32Array[] = [];
  private startTime = 0;
  private options: RecordingOptions | null = null;
  private dataCallbacks: Set<RecordingDataCallback> = new Set();
  private completeCallbacks: Set<RecordingCompleteCallback> = new Set();
  private timeoutTimer: number | null = null;
  
  /**
   * 构造函数
   */
  constructor(audioContextManager: AudioContextManager) {
    this.audioContext = audioContextManager.getContext();
  }
  
  /**
   * 开始录音
   */
  async startRecording(options: RecordingOptions = {}): Promise<void> {
    if (this.state === RecordingState.RECORDING) {
      console.warn('[AudioRecording] 已在录音中');
      return;
    }
    
    console.log('[AudioRecording] 开始录音...');
    
    this.options = {
      sampleRate: options.sampleRate || 16000,
      channels: options.channels || 1,
      maxDuration: options.maxDuration || 60,
      enableNoiseReduction: options.enableNoiseReduction ?? true,
      enableGain: options.enableGain ?? true,
      gainValue: options.gainValue || 2.0,
      outputFormat: options.outputFormat || 'wav',
    };
    
    try {
      // 请求麦克风权限
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.options.sampleRate,
          channelCount: this.options.channels,
          echoCancellation: true,
          noiseSuppression: this.options.enableNoiseReduction,
          autoGainControl: false, // 使用自定义增益
        },
      });
      
      // 创建音频处理链
      await this.setupAudioProcessing();
      
      // 开始记录
      this.recordedChunks = [];
      this.startTime = Date.now();
      this.state = RecordingState.RECORDING;
      
      // 设置超时
      const maxDuration = this.options.maxDuration;
      if (maxDuration && maxDuration > 0) {
        this.timeoutTimer = window.setTimeout(() => {
          console.log(`[AudioRecording] 达到最大时长 ${maxDuration}s, 自动停止`);
          this.stopRecording();
        }, maxDuration * 1000);
      }
      
      console.log('[AudioRecording] 录音中...');
    } catch (error) {
      this.state = RecordingState.ERROR;
      console.error('[AudioRecording] 录音失败:', error);
      throw error;
    }
  }
  
  /**
   * 设置音频处理链
   */
  private async setupAudioProcessing(): Promise<void> {
    if (!this.mediaStream) {
      throw new Error('MediaStream未初始化');
    }
    
    // 创建音频源
    this.mediaStreamSource = this.audioContext.createMediaStreamSource(this.mediaStream);
    
    let lastNode: AudioNode = this.mediaStreamSource;
    
    // 增益节点 (如果启用)
    if (this.options!.enableGain) {
      this.gainNode = this.audioContext.createGain();
      this.gainNode.gain.value = this.options!.gainValue || 2.0;
      lastNode.connect(this.gainNode);
      lastNode = this.gainNode;
    }
    
    // 动态压缩器 (降噪, 如果启用)
    if (this.options!.enableNoiseReduction) {
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      this.compressorNode.threshold.value = -50;
      this.compressorNode.knee.value = 40;
      this.compressorNode.ratio.value = 12;
      this.compressorNode.attack.value = 0;
      this.compressorNode.release.value = 0.25;
      lastNode.connect(this.compressorNode);
      lastNode = this.compressorNode;
    }
    
    // 分析器节点 (用于实时监控)
    this.analyserNode = this.audioContext.createAnalyser();
    this.analyserNode.fftSize = 2048;
    lastNode.connect(this.analyserNode);
    
    // AudioWorklet处理节点
    // 注意: 需要先注册AudioWorklet脚本
    // await this.audioContext.audioWorklet.addModule('/audio-worklet-processor.js');
    
    // 暂时使用ScriptProcessorNode (已废弃, 但兼容性好)
    const bufferSize = 4096;
    const scriptProcessor = this.audioContext.createScriptProcessor(
      bufferSize,
      this.options!.channels,
      this.options!.channels
    );
    
    scriptProcessor.onaudioprocess = (event) => {
      if (this.state !== RecordingState.RECORDING) {
        return;
      }
      
      // 获取输入数据
      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0);
      
      // 复制数据
      const chunk = new Float32Array(channelData);
      this.recordedChunks.push(chunk);
      
      // 触发数据回调
      for (const callback of this.dataCallbacks) {
        callback(chunk);
      }
    };
    
    lastNode.connect(scriptProcessor);
    scriptProcessor.connect(this.audioContext.destination);
    
    // 保存引用 (用于cleanup)
    this.audioWorkletNode = scriptProcessor as any;
  }
  
  /**
   * 暂停录音
   */
  pauseRecording(): void {
    if (this.state !== RecordingState.RECORDING) {
      return;
    }
    
    this.state = RecordingState.PAUSED;
    console.log('[AudioRecording] 已暂停');
  }
  
  /**
   * 恢复录音
   */
  resumeRecording(): void {
    if (this.state !== RecordingState.PAUSED) {
      return;
    }
    
    this.state = RecordingState.RECORDING;
    console.log('[AudioRecording] 已恢复');
  }
  
  /**
   * 停止录音
   */
  async stopRecording(): Promise<Blob | null> {
    if (this.state === RecordingState.IDLE || this.state === RecordingState.STOPPED) {
      return null;
    }
    
    console.log('[AudioRecording] 停止录音...');
    
    this.state = RecordingState.STOPPED;
    
    // 清除超时
    if (this.timeoutTimer !== null) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    
    // 计算录音时长
    const duration = (Date.now() - this.startTime) / 1000;
    
    // 合并录音数据
    const audioBlob = await this.createAudioBlob();
    
    // 清理资源
    this.cleanup();
    
    // 触发完成回调
    for (const callback of this.completeCallbacks) {
      callback(audioBlob, duration);
    }
    
    console.log(`[AudioRecording] 录音完成 (时长: ${duration.toFixed(2)}s)`);
    
    return audioBlob;
  }
  
  /**
   * 创建音频Blob
   */
  private async createAudioBlob(): Promise<Blob> {
    if (this.recordedChunks.length === 0) {
      throw new Error('没有录音数据');
    }
    
    // 合并所有chunk
    const totalLength = this.recordedChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const combinedData = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.recordedChunks) {
      combinedData.set(chunk, offset);
      offset += chunk.length;
    }
    
    // 创建AudioBuffer
    const channels = this.options!.channels || 1;
    const sampleRate = this.options!.sampleRate || 16000;
    const audioBuffer = this.audioContext.createBuffer(
      channels,
      combinedData.length,
      sampleRate
    );
    
    audioBuffer.getChannelData(0).set(combinedData);
    
    // 转换为WAV格式
    const wavBlob = await this.audioBufferToWav(audioBuffer);
    
    return wavBlob;
  }
  
  /**
   * AudioBuffer转WAV
   */
  private async audioBufferToWav(buffer: AudioBuffer): Promise<Blob> {
    const numberOfChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    
    const data = new Float32Array(buffer.length * numberOfChannels);
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < buffer.length; i++) {
        data[i * numberOfChannels + channel] = channelData[i];
      }
    }
    
    const dataLength = data.length * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    // PCM data
    let offset = 44;
    for (let i = 0; i < data.length; i++) {
      const sample = Math.max(-1, Math.min(1, data[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }
  
  /**
   * 写入字符串到DataView
   */
  private writeString(view: DataView, offset: number, string: string): void {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
  
  /**
   * 获取实时音量
   */
  getVolume(): number {
    if (!this.analyserNode) {
      return 0;
    }
    
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    
    // 计算平均音量
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    
    return sum / bufferLength / 255; // 归一化到0-1
  }
  
  /**
   * 订阅录音数据
   */
  onData(callback: RecordingDataCallback): () => void {
    this.dataCallbacks.add(callback);
    return () => this.dataCallbacks.delete(callback);
  }
  
  /**
   * 订阅录音完成
   */
  onComplete(callback: RecordingCompleteCallback): () => void {
    this.completeCallbacks.add(callback);
    return () => this.completeCallbacks.delete(callback);
  }
  
  /**
   * 获取录音状态
   */
  getState(): RecordingState {
    return this.state;
  }
  
  /**
   * 获取录音时长
   */
  getDuration(): number {
    if (this.state === RecordingState.IDLE) {
      return 0;
    }
    
    return (Date.now() - this.startTime) / 1000;
  }
  
  /**
   * 清理资源
   */
  private cleanup(): void {
    if (this.audioWorkletNode) {
      this.audioWorkletNode.disconnect();
      this.audioWorkletNode = null;
    }
    
    if (this.analyserNode) {
      this.analyserNode.disconnect();
      this.analyserNode = null;
    }
    
    if (this.compressorNode) {
      this.compressorNode.disconnect();
      this.compressorNode = null;
    }
    
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
    
    if (this.mediaStreamSource) {
      this.mediaStreamSource.disconnect();
      this.mediaStreamSource = null;
    }
    
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }
  }
  
  /**
   * 释放资源
   */
  dispose(): void {
    if (this.state === RecordingState.RECORDING || this.state === RecordingState.PAUSED) {
      this.stopRecording();
    }
    
    this.dataCallbacks.clear();
    this.completeCallbacks.clear();
  }
}
