/**
 * Electron API 类型定义
 * 
 * 定义主进程暴露给渲染进程的API接口
 */

export type ElectronLog = (
  level: 'debug' | 'info' | 'warn' | 'error',
  message: string,
  ...args: any[]
) => void;

/**
 * 路径配置接口
 */
export interface PathsConfig {
  /** 应用根目录 */
  appRoot: string;
  /** 数据目录 */
  dataDir: string;
  /** Public 资源目录 */
  publicDir: string;
  /** Sherpa 模型根目录 */
  sherpaModelsDir: string;
  /** TTS 缓存目录 */
  ttsCacheDir: string;
  /** ASR 模型目录 */
  asrModelsDir: string;
  /** 课程音频目录 */
  courseAudioDir: string;
  /** 用户配置目录 */
  userConfigDir: string;
  /** 是否为开发环境 */
  isDev: boolean;
}

export interface ElectronAPI {
  /** 日志记录 */
  log?: ElectronLog;

  // ===== 路径管理 =====
  
  /** 获取所有路径配置 */
  getPaths?: () => Promise<PathsConfig>;
  
  /** 获取数据目录(兼容旧代码) */
  getDataPath?: () => Promise<string>;
  
  /** 设置数据目录(兼容旧代码) */
  setDataPath?: (customPath: string) => Promise<string>;

  // ===== 文件操作 =====

  /** 获取Sherpa模型路径 */
  getPublicSherpaModelPath?: () => Promise<string>;

  /** 检查文件是否存在 */
  checkFileExists?: (path: string) => Promise<boolean>;

  /** 确保运行时目录结构 */
  ensureRuntimeLayout?: () => Promise<void>;

  /** 获取数据服务器信息 */
  getDataServerInfo?: () => Promise<{
    root?: string;
    port?: number;
    urls?: string[];
  }>;

  /** 保存音频文件 */
  saveAudioFile?: (
    subDir: string,
    filename: string,
    buffer: ArrayBuffer
  ) => Promise<string | null> | string | null;

  /** 读取音频文件 */
  readAudioFile?: (
    path: string
  ) => Promise<ArrayBuffer | ArrayBufferView | Blob | null> | ArrayBuffer | ArrayBufferView | Blob | null;

  /** 删除音频文件 */
  deleteAudioFile?: (path: string) => Promise<boolean> | boolean;

  /** 删除文件(通用) */
  deleteFile?: (path: string) => Promise<boolean> | boolean;

  /** 监听事件 */
  on?: (event: string, callback: (...args: any[]) => void) => void;
}

/**
 * 扩展Window接口
 */
declare global {
  interface Window {
    electron?: ElectronAPI;
  }
}

export {};
