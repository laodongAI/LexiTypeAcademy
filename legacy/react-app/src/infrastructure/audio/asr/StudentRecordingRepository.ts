/**
 * 学生录音仓储实现
 * 
 * 功能:
 * 1. 会话级管理 (sessionId分组)
 * 2. 三保险清理机制:
 *    - 保险1: 正常退出时清理 (dispose调用)
 *    - 保险2: 页面卸载时清理 (beforeunload事件)
 *    - 保险3: 启动时清理遗留数据 (启动时检查)
 * 3. IndexedDB CRUD操作
 * 4. 自动过期清理 (7天)
 * 
 * 优化:
 * - 批量删除性能优化
 * - 错误容错 (单个失败不影响整体)
 */

import { db } from '@/infrastructure/persistence/database';
import { StudentRecording } from './types';
import type { AudioFile } from '@/infrastructure/audio/storage/types';

/**
 * 学生录音仓储
 */
export class StudentRecordingRepository {
  private currentSessionId: string;
  private disposed = false;
  
  // 录音过期时间 (7天)
  private static readonly EXPIRY_DAYS = 7;
  private static readonly EXPIRY_MS = StudentRecordingRepository.EXPIRY_DAYS * 24 * 60 * 60 * 1000;
  
  /**
   * 构造函数
   */
  constructor() {
    // 生成唯一会话ID
    this.currentSessionId = this.generateSessionId();
    
    // 注册清理机制
    this.registerCleanupHooks();
    
    // 启动时清理遗留数据 (保险3)
    this.cleanupOrphanedRecordings().catch(error => {
      console.error('[StudentRecordingRepo] 启动清理失败:', error);
    });
  }
  
  /**
   * 生成会话ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 注册清理钩子
   */
  private registerCleanupHooks(): void {
    // 保险2: 页面卸载时清理
    window.addEventListener('beforeunload', () => {
      this.cleanup();
    });
    
    // Electron环境: 监听窗口关闭
    if (window.electron) {
      window.electron.on?.('window-close', () => {
        this.cleanup();
      });
    }
  }
  
  /**
   * 添加录音
   */
  async addRecording(recording: Omit<StudentRecording, 'id' | 'sessionId' | 'recordedAt'>): Promise<string> {
    const id = this.generateRecordingId();
    
    const fullRecording: StudentRecording = {
      ...recording,
      id,
      sessionId: this.currentSessionId,
      recordedAt: Date.now(),
    };
    
    await db.studentRecordings.add(fullRecording);
    
    console.log(`[StudentRecordingRepo] 录音已添加: ${id}`);
    return id;
  }
  
  /**
   * 生成录音ID
   */
  private generateRecordingId(): string {
    return `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * 获取录音
   */
  async getRecording(id: string): Promise<StudentRecording | null> {
    const recording = await db.studentRecordings.get(id);
    return recording || null;
  }
  
  /**
   * 获取课程的所有录音
   */
  async getRecordingsByCourse(courseId: string): Promise<StudentRecording[]> {
    return await db.studentRecordings
      .where('courseId')
      .equals(courseId)
      .toArray();
  }
  
  /**
   * 获取句子的所有录音
   */
  async getRecordingsBySentence(courseId: string, sentenceId: string): Promise<StudentRecording[]> {
    return await db.studentRecordings
      .where(['courseId', 'sentenceId'])
      .equals([courseId, sentenceId])
      .toArray();
  }
  
  /**
   * 获取当前会话的所有录音
   */
  async getCurrentSessionRecordings(): Promise<StudentRecording[]> {
    return await db.studentRecordings
      .where('sessionId')
      .equals(this.currentSessionId)
      .toArray();
  }
  
  /**
   * 更新ASR结果
   */
  async updateASRResult(id: string, asrResult: StudentRecording['asrResult']): Promise<void> {
    await db.studentRecordings.update(id, { asrResult });
    console.log(`[StudentRecordingRepo] ASR结果已更新: ${id}`);
  }
  
  /**
   * 删除录音
   */
  async deleteRecording(id: string): Promise<void> {
    const recording = await this.getRecording(id);
    if (!recording) return;
    
    // 删除音频文件
    await this.deleteAudioFile(recording.audioFile);
    
    // 删除数据库记录
    await db.studentRecordings.delete(id);
    
    console.log(`[StudentRecordingRepo] 录音已删除: ${id}`);
  }
  
  /**
   * 批量删除录音
   */
  async deleteRecordings(ids: string[]): Promise<void> {
    console.log(`[StudentRecordingRepo] 批量删除 ${ids.length} 条录音...`);
    
    // 获取所有录音
    const recordings = await db.studentRecordings
      .where('id')
      .anyOf(ids)
      .toArray();
    
    // 删除音频文件 (并行, 错误容错)
    await Promise.allSettled(
      recordings.map(rec => this.deleteAudioFile(rec.audioFile))
    );
    
    // 删除数据库记录
    await db.studentRecordings.bulkDelete(ids);
    
    console.log(`[StudentRecordingRepo] ${ids.length} 条录音已删除`);
  }
  
  /**
   * 删除会话的所有录音
   */
  async deleteSessionRecordings(sessionId: string): Promise<void> {
    const recordings = await db.studentRecordings
      .where('sessionId')
      .equals(sessionId)
      .toArray();
    
    const ids = recordings.map(r => r.id);
    await this.deleteRecordings(ids);
    
    console.log(`[StudentRecordingRepo] 会话 ${sessionId} 的所有录音已删除`);
  }
  
  /**
   * 删除音频文件
   */
  private async deleteAudioFile(audioFile: AudioFile): Promise<void> {
    try {
      if (audioFile.storageType === 'indexeddb') {
        // 从IndexedDB删除
        await db.audioFiles.delete(audioFile.path);
      } else if (audioFile.storageType === 'filesystem') {
        // 从文件系统删除
        if (window.electron?.deleteFile) {
          await window.electron.deleteFile(audioFile.path);
        }
      }
    } catch (error) {
      console.error(`[StudentRecordingRepo] 删除音频文件失败: ${audioFile.path}`, error);
      // 不抛出错误, 继续删除其他文件
    }
  }
  
  /**
   * 清理过期录音
   */
  async cleanupExpiredRecordings(): Promise<void> {
    const expiryTimestamp = Date.now() - StudentRecordingRepository.EXPIRY_MS;
    
    const expiredRecordings = await db.studentRecordings
      .where('recordedAt')
      .below(expiryTimestamp)
      .toArray();
    
    if (expiredRecordings.length === 0) {
      console.log('[StudentRecordingRepo] 无过期录音');
      return;
    }
    
    console.log(`[StudentRecordingRepo] 清理 ${expiredRecordings.length} 条过期录音...`);
    
    const ids = expiredRecordings.map(r => r.id);
    await this.deleteRecordings(ids);
    
    console.log('[StudentRecordingRepo] 过期录音清理完成');
  }
  
  /**
   * 清理遗留录音 (保险3: 启动时清理)
   */
  private async cleanupOrphanedRecordings(): Promise<void> {
    console.log('[StudentRecordingRepo] 启动清理: 检查遗留录音...');
    
    // 获取所有会话
    const allRecordings = await db.studentRecordings.toArray();
    
    // 按会话分组
    const sessionMap = new Map<string, StudentRecording[]>();
    for (const recording of allRecordings) {
      const recordings = sessionMap.get(recording.sessionId) || [];
      recordings.push(recording);
      sessionMap.set(recording.sessionId, recordings);
    }
    
    // 清理非当前会话的录音 (这些是上次崩溃或异常退出遗留的)
    let orphanedCount = 0;
    for (const [sessionId, recordings] of sessionMap) {
      if (sessionId !== this.currentSessionId) {
        const ids = recordings.map(r => r.id);
        await this.deleteRecordings(ids);
        orphanedCount += ids.length;
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`[StudentRecordingRepo] 启动清理: 已清理 ${orphanedCount} 条遗留录音`);
    } else {
      console.log('[StudentRecordingRepo] 启动清理: 无遗留录音');
    }
  }
  
  /**
   * 清理当前会话 (保险1: 正常退出)
   */
  async cleanup(): Promise<void> {
    if (this.disposed) return;
    
    console.log('[StudentRecordingRepo] 正常退出: 清理当前会话录音...');
    
    try {
      await this.deleteSessionRecordings(this.currentSessionId);
      this.disposed = true;
      console.log('[StudentRecordingRepo] 当前会话录音已清理');
    } catch (error) {
      console.error('[StudentRecordingRepo] 清理失败:', error);
    }
  }
  
  /**
   * 释放资源
   */
  async dispose(): Promise<void> {
    await this.cleanup();
  }
  
  /**
   * 获取统计信息
   */
  async getStats(): Promise<{
    total: number;
    currentSession: number;
    byCourse: Map<string, number>;
    oldestRecording: number | null;
  }> {
    const allRecordings = await db.studentRecordings.toArray();
    
    const currentSessionRecordings = allRecordings.filter(
      r => r.sessionId === this.currentSessionId
    );
    
    const byCourse = new Map<string, number>();
    for (const recording of allRecordings) {
      const count = byCourse.get(recording.courseId) || 0;
      byCourse.set(recording.courseId, count + 1);
    }
    
    const oldestRecording = allRecordings.length > 0
      ? Math.min(...allRecordings.map(r => r.recordedAt))
      : null;
    
    return {
      total: allRecordings.length,
      currentSession: currentSessionRecordings.length,
      byCourse,
      oldestRecording,
    };
  }
}
