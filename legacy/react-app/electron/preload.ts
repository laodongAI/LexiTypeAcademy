import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  isDev: process.env.NODE_ENV === 'development',
  
  // ===== 路径管理 =====
  
  /** 获取所有路径配置 */
  getPaths: () => ipcRenderer.invoke('get-paths'),
  
  /** 获取数据目录(兼容旧代码) */
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  
  /** 设置数据目录(兼容旧代码) */
  setDataPath: (customPath: string) => ipcRenderer.invoke('set-data-path', customPath),
  
  // ===== 文件操作 =====
  
  // Expose resourcesPath for accessing unpacked files
  // In production, this points to the resources directory
  getResourcesPath: () => process.resourcesPath,
  checkFileExists: (path: string) => ipcRenderer.invoke('check-file-exists', path),
  saveAudioFile: (subDir: string, filename: string, buffer: ArrayBuffer) => ipcRenderer.invoke('save-audio-file', subDir, filename, buffer),
  readAudioFile: (path: string) => ipcRenderer.invoke('read-audio-file', path),
  deleteAudioFile: (path: string) => ipcRenderer.invoke('delete-audio-file', path),
  getCacheSize: () => ipcRenderer.invoke('get-cache-size'),
  clearAudioCache: () => ipcRenderer.invoke('clear-audio-cache'),
  getDataServerInfo: () => ipcRenderer.invoke('get-data-server-info'),

  // ===== HTTP 代理 =====
  httpFetch: (req: { url: string; method?: string; headers?: Record<string, string>; body?: any; timeout?: number }) =>
    ipcRenderer.invoke('http-fetch', req),
  
  // ===== 事件监听 =====
  
  onAudioStopRequest: (handler: (payload: any) => void) => {
    const listener = (_event: any, payload: any) => handler(payload);
    ipcRenderer.on('app-audio-stop', listener);
    return () => ipcRenderer.removeListener('app-audio-stop', listener);
  },
});

contextBridge.exposeInMainWorld('typingAPI', {
  // 预留与主进程交互接口（后续可添加设置存储、导出等功能）
});
