/**
 * 全局类型声明
 */

/**
 * Electron API接口
 */
export interface ElectronAPI {
  /**
   * 日志记录
   */
  log?: (level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]) => void;
  
  /**
   * 获取Sherpa模型路径
   */
  getPublicSherpaModelPath?: () => Promise<string>;
  
  /**
   * 检查文件是否存在
   */
  checkFileExists?: (path: string) => Promise<boolean>;
  
  /**
   * 保存音频文件
   */
  saveAudioFile?: (
    subDir: string,
    filename: string,
    buffer: ArrayBuffer
  ) => Promise<string | null> | string | null;
  
  /**
   * 读取音频文件
   */
  readAudioFile?: (
    path: string
  ) => Promise<ArrayBuffer | ArrayBufferView | Blob | null> | ArrayBuffer | ArrayBufferView | Blob | null;
  
  /**
   * 删除音频文件
   */
  deleteAudioFile?: (path: string) => Promise<boolean> | boolean;
  
  /**
   * 删除文件 (通用)
   */
  deleteFile?: (path: string) => Promise<void>;
  
  /**
   * 事件监听
   */
  on?: (event: string, callback: (...args: any[]) => void) => void;
  
  /**
   * 移除事件监听
   */
  off?: (event: string, callback: (...args: any[]) => void) => void;
}

/**
 * 扩展Window接口
 */
declare global {
  interface Window {
    /**
     * Electron API
     */
    electron?: ElectronAPI;
  }
}

export {};
