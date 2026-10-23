/**
 * 路径管理器 (PathManager)
 * 
 * 职责:
 * - 统一管理应用所有路径(数据目录、模型目录、缓存目录等)
 * - 处理开发/生产环境的路径差异
 * - 提供路径拼接、规范化等工具方法
 * - 在应用启动时从 Electron 获取绝对路径并缓存
 * 
 * 架构:
 * - 单例模式,全局唯一实例
 * - 启动时初始化,缓存所有路径
 * - 前端通过 Electron IPC 获取后端绝对路径
 * 
 * 使用场景:
 * - TTS/ASR 模型路径拼接
 * - 课程音频文件路径拼接
 * - 缓存文件路径拼接
 * - 配置文件路径拼接
 */

/**
 * 路径配置接口
 */
export interface PathConfig {
  /** 应用根目录(开发环境: 项目根, 生产环境: app.asar所在目录) */
  appRoot: string;
  
  /** 数据目录(用户数据: 课程、录音、缓存等) */
  dataDir: string;
  
  /** Public 资源目录(WASM、模型等静态资源) */
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

/**
 * 路径管理器类
 */
class PathManager {
  private static instance: PathManager | null = null;
  private config: PathConfig | null = null;
  private initialized: boolean = false;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): PathManager {
    if (!PathManager.instance) {
      PathManager.instance = new PathManager();
    }
    return PathManager.instance;
  }

  /**
   * 初始化路径配置(应用启动时调用)
   * 从 Electron 获取所有路径并缓存
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('[PathManager] 已经初始化,跳过重复初始化');
      return;
    }

    try {
      // 检查 Electron API 是否可用
      const electron = (window as any).electron;
      if (!electron) {
        throw new Error('Electron API 不可用');
      }

      // 从 Electron 获取路径配置
      const paths = await electron.getPaths();
      
      this.config = {
        appRoot: paths.appRoot,
        dataDir: paths.dataDir,
        publicDir: paths.publicDir,
        sherpaModelsDir: paths.sherpaModelsDir,
        ttsCacheDir: paths.ttsCacheDir,
        asrModelsDir: paths.asrModelsDir,
        courseAudioDir: paths.courseAudioDir,
        userConfigDir: paths.userConfigDir,
        isDev: paths.isDev
      };

      this.initialized = true;
      console.log('[PathManager] 初始化成功:', this.config);
    } catch (error) {
      console.error('[PathManager] 初始化失败:', error);
      
      // 降级: 使用默认相对路径(仅用于开发调试)
      this.config = {
        appRoot: '',
        dataDir: '/data',
        publicDir: '/public',
        sherpaModelsDir: '/sherpa',
        ttsCacheDir: '/data/tts-cache',
        asrModelsDir: '/sherpa/models/asr',
        courseAudioDir: '/data/audio',
        userConfigDir: '',
        isDev: true
      };
      this.initialized = true;
      console.warn('[PathManager] 使用降级路径配置');
    }
  }

  /**
   * 确保已初始化
   */
  private ensureInitialized(): void {
    if (!this.initialized || !this.config) {
      throw new Error('[PathManager] 未初始化,请先调用 initialize()');
    }
  }

  /**
   * 获取完整路径配置
   */
  getConfig(): PathConfig {
    this.ensureInitialized();
    return { ...this.config! };
  }

  /**
   * 获取应用根目录
   */
  getAppRoot(): string {
    this.ensureInitialized();
    return this.config!.appRoot;
  }

  /**
   * 获取数据目录
   */
  getDataDir(): string {
    this.ensureInitialized();
    return this.config!.dataDir;
  }

  /**
   * 获取 Sherpa 模型根目录
   */
  getSherpaModelsDir(): string {
    this.ensureInitialized();
    return this.config!.sherpaModelsDir;
  }

  /**
   * 获取 TTS 缓存目录
   */
  getTTSCacheDir(): string {
    this.ensureInitialized();
    return this.config!.ttsCacheDir;
  }

  /**
   * 获取 ASR 模型目录
   */
  getASRModelsDir(): string {
    this.ensureInitialized();
    return this.config!.asrModelsDir;
  }

  /**
   * 获取课程音频目录
   */
  getCourseAudioDir(): string {
    this.ensureInitialized();
    return this.config!.courseAudioDir;
  }

  /**
   * 拼接 Sherpa 模型路径
   * @param modelRelativePath 模型相对路径(如: 'sherpa-onnx-wasm-simd-1.12.18-vad-asr-en-zipformer_gigaspeech')
   * @returns 完整模型路径
   */
  resolveSherpaModel(modelRelativePath: string): string {
    this.ensureInitialized();
    return this.joinPath(this.config!.sherpaModelsDir, modelRelativePath);
  }

  /**
   * 拼接课程音频路径
   * @param courseId 课程ID
   * @param filename 文件名
   * @returns 完整音频路径
   */
  resolveCourseAudio(courseId: string, filename: string): string {
    this.ensureInitialized();
    return this.joinPath(this.config!.courseAudioDir, courseId, filename);
  }

  /**
   * 拼接 TTS 缓存路径
   * @param filename 缓存文件名
   * @returns 完整缓存路径
   */
  resolveTTSCache(filename: string): string {
    this.ensureInitialized();
    return this.joinPath(this.config!.ttsCacheDir, filename);
  }

  /**
   * 路径拼接(跨平台兼容)
   */
  joinPath(...parts: string[]): string {
    // 过滤空字符串
    const filtered = parts.filter(p => p && p.length > 0);
    
    // 规范化路径分隔符(统一使用 /)
    const normalized = filtered.map(p => p.replace(/\\/g, '/'));
    
    // 拼接路径
    let joined = normalized.join('/');
    
    // 移除重复的斜杠
    joined = joined.replace(/\/+/g, '/');
    
    return joined;
  }

  /**
   * 规范化路径(统一格式)
   */
  normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  /**
   * 检查是否为开发环境
   */
  isDevelopment(): boolean {
    this.ensureInitialized();
    return this.config!.isDev;
  }

  /**
   * 将相对路径转换为 URL(用于前端资源加载)
   * @param relativePath 相对于 public 的路径(如: '/sherpa/model.wasm')
   * @returns 开发环境返回 Vite URL,生产环境返回文件路径
   */
  toURL(relativePath: string): string {
    // 前端资源始终使用相对于根的路径
    // Vite 开发服务器会自动处理 /public 映射
    // 生产环境 Electron 会 serve public 目录
    return relativePath.startsWith('/') ? relativePath : `/${relativePath}`;
  }
}

/**
 * 导出单例实例获取函数
 */
export function getPathManager(): PathManager {
  return PathManager.getInstance();
}

/**
 * 快捷初始化函数(在 App.tsx 中调用)
 */
export async function initializePaths(): Promise<void> {
  const manager = getPathManager();
  await manager.initialize();
}
