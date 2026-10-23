/**
 * 游戏音效管理器
 * 
 * 使用 Web Audio API 合成游戏音效
 * 提供各种游戏场景的音效播放功能
 * 
 * @example
 * import { soundManager } from '@/shared/utils/SoundManager';
 * soundManager.playSuccess(); // 播放成功音效
 */

class SoundManager {
  /** Web Audio 上下文 */
  private context: AudioContext | null = null;
  /** 是否静音 */
  private muted: boolean = false;
  /** 音量（0-1） */
  private volume: number = 0.5;

  constructor() {
    try {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (e) {
      console.warn('[SoundManager] Web Audio API not supported');
    }
  }

  /**
   * 确保音频上下文处于活动状态
   * 由于浏览器自动播放策略，需要在用户交互后恢复
   */
  private ensureContext() {
    if (this.context?.state === 'suspended') {
      this.context.resume();
    }
  }

  /**
   * 设置静音状态
   */
  setMuted(muted: boolean) {
    this.muted = muted;
  }

  /**
   * 获取静音状态
   */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * 设置音量
   * @param volume 0-1 之间的数值
   */
  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * 获取当前音量
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * 播放射击/开始音效
   * 用于游戏开始或发射动作
   */
  playShoot() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(880, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1 * this.volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.1);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.1);
  }

  /**
   * 播放爆炸音效
   * 用于消灭敌人或碰撞
   */
  playExplosion() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(100, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.2 * this.volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.context.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }

  /**
   * 播放成功音效
   * 用于输入正确、得分等正面反馈
   */
  playSuccess() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(500, this.context.currentTime);
    osc.frequency.linearRampToValueAtTime(1000, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1 * this.volume, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.3);
  }

  /**
   * 播放游戏结束音效
   * 用于游戏失败或结束
   */
  playGameOver() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, this.context.currentTime);
    osc.frequency.linearRampToValueAtTime(50, this.context.currentTime + 1);
    
    gain.gain.setValueAtTime(0.3 * this.volume, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 1);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 1);
  }

  /**
   * 播放按键音效
   * 用于打字时的即时反馈
   */
  playKeypress() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, this.context.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.context.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.05 * this.volume, this.context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.context.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.05);
  }

  /**
   * 播放错误音效
   * 用于输入错误等负面反馈
   */
  playError() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(200, this.context.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.context.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.1 * this.volume, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  /**
   * 播放连击音效
   * 音高随连击数递增
   * @param combo 当前连击数
   */
  playCombo(combo: number) {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    const baseFreq = 400 + Math.min(combo, 10) * 50; // 最高到900Hz
    
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(baseFreq, this.context.currentTime);
    osc.frequency.linearRampToValueAtTime(baseFreq * 1.5, this.context.currentTime + 0.1);
    
    gain.gain.setValueAtTime(0.1 * this.volume, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0, this.context.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(this.context.destination);
    
    osc.start();
    osc.stop(this.context.currentTime + 0.2);
  }

  /**
   * 播放升级音效
   * 用于等级提升或解锁
   */
  playLevelUp() {
    if (!this.context || this.muted) return;
    this.ensureContext();
    
    // 使用三个音符的和弦效果
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
    
    notes.forEach((freq, i) => {
      const osc = this.context!.createOscillator();
      const gain = this.context!.createGain();
      
      const startTime = this.context!.currentTime + i * 0.1;
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.1 * this.volume, startTime + 0.05);
      gain.gain.linearRampToValueAtTime(0, startTime + 0.4);
      
      osc.connect(gain);
      gain.connect(this.context!.destination);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
    });
  }
}

/** 单例音效管理器 */
export const soundManager = new SoundManager();
