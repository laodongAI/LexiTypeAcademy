/**
 * Electron 主进程入口
 * 
 * 职责：
 * - 创建主窗口
 * - 处理 IPC 通信
 * - 管理应用生命周期
 */
import { app, BrowserWindow, ipcMain } from 'electron';
import fs from 'fs';
import os from 'os';
import path from 'path';

// 开发模式下的主窗口 URL 由 Electron Forge 注入
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

// 保持窗口引用，防止被垃圾回收
let mainWindow: BrowserWindow | null = null;

function ensureWritableDir(dirPath: string): boolean {
  try {
    fs.mkdirSync(dirPath, { recursive: true });
    fs.accessSync(dirPath, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * 修复 Windows 下偶发的 Chromium Cache/Quota/IndexedDB 无法写入问题。
 * 当默认 userData/cache 目录不可写或损坏时，会导致 Dexie open 报 UnknownError: Internal error。
 */
function configureAppStoragePaths(): void {
  const candidates: string[] = [];

  // 先尝试 Electron 默认目录（通常在 AppData 下）
  try {
    candidates.push(app.getPath('userData'));
  } catch {
    // ignore
  }

  if (process.env.LOCALAPPDATA) candidates.push(process.env.LOCALAPPDATA);
  if (process.env.APPDATA) candidates.push(process.env.APPDATA);
  candidates.push(os.tmpdir());

  for (const base of candidates) {
    if (!base) continue;
    const root = path.join(base, 'LexiTypeAcademy');
    const userDataDir = path.join(root, 'userData');
    const cacheDir = path.join(root, 'cache');

    if (!ensureWritableDir(userDataDir)) continue;
    if (!ensureWritableDir(cacheDir)) continue;

    app.setPath('userData', userDataDir);
    app.setPath('cache', cacheDir);
    return;
  }
}

configureAppStoragePaths();

// ===================== 进程级诊断与兜底 =====================

/**
 * 输出更可用的错误信息，避免 Electron 静默退出难以排查。
 */
process.on('uncaughtException', (error) => {
  console.error('[Main] uncaughtException:', error);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Main] unhandledRejection:', reason);
});

app.on('render-process-gone', (_event, webContents, details) => {
  console.error('[Main] render-process-gone:', {
    id: webContents.id,
    reason: details.reason,
    exitCode: details.exitCode,
  });
});

app.on('child-process-gone', (_event, details) => {
  console.error('[Main] child-process-gone:', details);
});

/**
 * 创建主窗口
 */
function createWindow(): void {
  try {
    mainWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1024,
      minHeight: 700,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      // 隐藏默认菜单栏
      autoHideMenuBar: true,
      // 窗口标题
      title: '键语学苑 - LexiType Academy',
      // 背景色（避免白屏闪烁）
      backgroundColor: '#f5f5f5',
      // 显示窗口边框
      frame: true,
      // 图标：打包资源路径在不同环境可能不同，不阻塞窗口创建
      icon: path.join(__dirname, '../../public/icon.png'),
    });
  } catch (error) {
    console.error('[Main] BrowserWindow 创建失败:', error);
    throw error;
  }

  // 页面加载失败时输出原因，便于排查白屏/闪退
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('[Main] did-fail-load:', {
      errorCode,
      errorDescription,
      validatedURL,
    });
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[Main] webContents render-process-gone:', details);
  });

  // 加载页面
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    // 开发模式：加载 Vite 开发服务器
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL).catch((error) => {
      console.error('[Main] loadURL 失败:', error);
    });
    // 默认不自动打开 DevTools（DevTools 自身偶发的协议/语言告警会污染日志）
    // 如需自动打开：设置环境变量 LEXITYPE_OPEN_DEVTOOLS=1
    if (process.env.LEXITYPE_OPEN_DEVTOOLS === '1') {
      mainWindow.webContents.openDevTools();
    }
  } else {
    // 生产模式：加载打包后的 HTML
    void mainWindow
      .loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
      .catch((error) => {
        console.error('[Main] loadFile 失败:', error);
      });
  }

  // 窗口关闭时清理引用
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 应用就绪时创建窗口
app.whenReady().then(() => {
  createWindow();

  // macOS：点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ===================== IPC 处理器 =====================

/**
 * 获取应用数据目录
 */
ipcMain.handle('get-app-path', (_, name: string) => {
  return app.getPath(name as Parameters<typeof app.getPath>[0]);
});

/**
 * 获取应用版本
 */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/**
 * 获取平台信息
 */
ipcMain.handle('get-platform', () => {
  return process.platform;
});
