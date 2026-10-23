import { app, BrowserWindow, ipcMain, session } from 'electron';
import path from 'path';
import fs from 'fs';

const isDev = process.env.VITE_DEV === '1';

/**
 * 获取应用根目录
 * - 开发环境: 项目根目录
 * - 生产环境: app.asar 所在目录
 */
function getAppRoot(): string {
  return isDev 
    ? process.cwd() 
    : path.dirname(app.getAppPath());
}

/**
 * 获取数据目录
 * - 开发环境: 项目根/data
 * - 生产环境: userData/data
 */
function getDataDir(): string {
  return isDev 
    ? path.join(process.cwd(), 'data') 
    : path.join(app.getPath('userData'), 'data');
}

/**
 * 获取 Public 目录
 * - 开发环境: 项目根/public
 * - 生产环境: 资源目录/public
 */
function getPublicDir(): string {
  return isDev 
    ? path.join(process.cwd(), 'public') 
    : path.join(process.resourcesPath, 'public');
}

const AUDIO_STOP_CHANNEL = 'app-audio-stop';

function emitAudioStop(win: BrowserWindow, reason: string) {
  try {
    win.webContents.send(AUDIO_STOP_CHANNEL, { reason, timestamp: Date.now() });
  } catch (err) {
    console.warn('[AudioGuard] emit failed', reason, err);
  }
}

function registerAudioGuards(win: BrowserWindow) {
  win.on('blur', () => emitAudioStop(win, 'window-blur'));
  win.on('minimize', () => emitAudioStop(win, 'window-minimize'));
  win.on('hide', () => emitAudioStop(win, 'window-hide'));
  win.on('close', () => emitAudioStop(win, 'window-close'));
  app.on('browser-window-blur', () => emitAudioStop(win, 'app-blur'));
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false, // Wait for content to load
    backgroundColor: '#ffffff', // Prevent black flash
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false // Allow loading local resources if needed, but be careful
    },
  });

  // Auto-grant permissions for media (microphone)
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  win.once('ready-to-show', () => {
    win.show();
  });

  // 监听渲染进程异常与导航，定位白屏/重载来源
  win.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Electron] render-process-gone', details);
  });
  win.webContents.on('unresponsive', () => {
    console.error('[Electron] 渲染进程无响应');
  });
  win.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Electron] 页面加载失败', { errorCode, errorDescription, validatedURL });
  });
  win.webContents.on('crashed', () => {
    console.error('[Electron] 渲染进程崩溃');
  });
  win.webContents.on('did-navigate', (_event, url) => {
    console.info('[Electron] did-navigate', { url });
  });
  win.webContents.on('did-navigate-in-page', (_event, url) => {
    console.info('[Electron] did-navigate-in-page', { url });
  });

  registerAudioGuards(win);
}

app.whenReady().then(() => {
  createWindow();

  // ===== IPC Handlers: 路径管理 =====
  
  /**
   * 获取所有路径配置(统一路径管理)
   */
  ipcMain.handle('get-paths', async () => {
    const appRoot = getAppRoot();
    const dataDir = getDataDir();
    const publicDir = getPublicDir();
    
    return {
      appRoot,
      dataDir,
      publicDir,
      sherpaModelsDir: path.join(publicDir, 'sherpa'),
      ttsCacheDir: path.join(dataDir, 'tts-cache'),
      asrModelsDir: path.join(publicDir, 'sherpa', 'models', 'asr'),
      courseAudioDir: path.join(dataDir, 'audio'),
      userConfigDir: app.getPath('userData'),
      isDev
    };
  });

  /**
   * 获取数据目录(兼容旧代码)
   */
  ipcMain.handle('get-data-path', () => {
    return getDataDir();
  });

  /**
   * 设置数据目录(兼容旧代码)
   */
  ipcMain.handle('set-data-path', (_event, customPath: string) => {
    // TODO: 实现自定义数据目录逻辑
    console.log('[Electron] set-data-path', customPath);
    return customPath || getDataDir();
  });

  // ===== IPC Handlers: 文件操作 =====

  ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('save-audio-file', async (event, subDir, filename, buffer) => {
    try {
      const baseDir = isDev 
        ? path.join(process.cwd(), 'data') 
        : path.join(app.getPath('userData'), 'data');
      
      const dir = path.join(baseDir, subDir);
      
      if (!fs.existsSync(dir)) {
        await fs.promises.mkdir(dir, { recursive: true });
      }
      
      const filePath = path.join(dir, filename);
      await fs.promises.writeFile(filePath, Buffer.from(buffer));
      return filePath;
    } catch (e) {
      console.error('save-audio-file error:', e);
      return null;
    }
  });

  ipcMain.handle('read-audio-file', async (event, filePath) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer;
    } catch (e) {
      console.error('read-audio-file error:', e);
      return null;
    }
  });

  ipcMain.handle('delete-audio-file', async (_event, filePath) => {
    if (!filePath) return false;
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (e: any) {
      if (e?.code === 'ENOENT') return true;
      console.error('delete-audio-file error:', e);
      return false;
    }
  });

  ipcMain.handle('get-cache-size', async () => {
    try {
      const dir = isDev 
        ? path.join(process.cwd(), 'data', 'tts-cache') 
        : path.join(app.getPath('userData'), 'tts-cache');
      
      if (!fs.existsSync(dir)) return 0;
      
      const files = await fs.promises.readdir(dir);
      let total = 0;
      for (const f of files) {
        const stat = await fs.promises.stat(path.join(dir, f));
        total += stat.size;
      }
      return total;
    } catch (e) {
      return 0;
    }
  });

  ipcMain.handle('clear-audio-cache', async () => {
    try {
      const dir = isDev 
        ? path.join(process.cwd(), 'data', 'tts-cache') 
        : path.join(app.getPath('userData'), 'tts-cache');
      
      if (fs.existsSync(dir)) {
        const files = await fs.promises.readdir(dir);
        for (const f of files) {
          await fs.promises.unlink(path.join(dir, f));
        }
      }
      return true;
    } catch (e) {
      console.error('clear-audio-cache error:', e);
      return false;
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // ===== IPC Handlers: HTTP 代理，避免渲染进程跨域 =====
  ipcMain.handle('http-fetch', async (_event, req: {
    url: string,
    method?: string,
    headers?: Record<string, string>,
    body?: any,
    timeout?: number
  }) => {
    const controller = new AbortController();
    const timeout = req.timeout ?? 60000;
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(req.url, {
        method: req.method || 'POST',
        headers: req.headers as any,
        body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
        signal: controller.signal
      } as any);
      const text = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        headers,
        bodyText: text
      };
    } catch (e: any) {
      return {
        ok: false,
        status: 0,
        statusText: e?.message || 'fetch_error',
        headers: {},
        bodyText: ''
      };
    } finally {
      clearTimeout(id);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
