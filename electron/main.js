import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import fs from 'fs';
import http from 'http';
import os from 'os';

// Initialize electron-store for renderer usage
Store.initRenderer();
const store = new Store({ name: 'typing-data' });

// 在 ESM 环境下手动恢复 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.VITE_DEV === '1';
const SHERPA_RELATIVE_DIR = path.join('public', 'sherpa', 'sherpa-onnx-wasm-simd-v1.12.18-en-tts');
const DATA_SERVER_PORT = Number(process.env.DATA_SERVER_PORT || 4873);

const getRuntimeRoot = () => (isDev ? path.resolve(__dirname, '..') : path.dirname(process.resourcesPath));

const runtimePaths = (() => {
  const root = getRuntimeRoot();
  return {
    root,
    data: path.join(root, 'data'),
    logs: path.join(root, 'logs'),
    publicSherpa: path.join(root, SHERPA_RELATIVE_DIR),
    unpackedSherpa: path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'sherpa', 'sherpa-onnx-wasm-simd-v1.12.18-en-tts'),
  };
})();

let dataServer = null;
let cachedDataServerInfo = {
  root: '',
  port: DATA_SERVER_PORT,
  urls: []
};

function getStoredDataPath() {
  const stored = store.get('settings.dataPath');
  if (typeof stored === 'string' && stored.trim().length > 0) {
    return stored.trim();
  }
  return '';
}

function resolveDataRoot() {
  const override = getStoredDataPath();
  if (override) {
    const normalized = path.resolve(override);
    const isTemp = /AppData\\Local\\Temp|AppData\/Local\/Temp/i.test(normalized);
    if (!isTemp) {
      try {
        ensureDirExists(normalized);
        return normalized;
      } catch (error) {
        console.warn('[DataServer] Failed to ensure custom data dir, fallback to default', error);
      }
    } else {
      console.warn('[DataServer] Ignoring temp directory override', normalized);
    }
  }
  ensureDirExists(runtimePaths.data);
  return runtimePaths.data;
}

function getMimeType(ext) {
  const lower = ext.toLowerCase();
  if (lower === '.wav') return 'audio/wav';
  if (lower === '.mp3') return 'audio/mpeg';
  if (lower === '.ogg') return 'audio/ogg';
  if (lower === '.m4a') return 'audio/mp4';
  if (lower === '.json') return 'application/json';
  if (lower === '.txt') return 'text/plain; charset=utf-8';
  if (lower === '.srt' || lower === '.vtt') return 'text/vtt; charset=utf-8';
  return 'application/octet-stream';
}

function getNetworkHosts() {
  const interfaces = os.networkInterfaces();
  const hosts = new Set(['127.0.0.1', 'localhost']);
  Object.keys(interfaces).forEach((key) => {
    (interfaces[key] || []).forEach((net) => {
      if (net && net.family === 'IPv4' && !net.internal) {
        hosts.add(net.address);
      }
    });
  });
  return Array.from(hosts);
}

function startDataStaticServer() {
  if (dataServer) return;
  const dataRoot = resolveDataRoot();
  const normalizedRoot = path.normalize(dataRoot);

  dataServer = http.createServer((req, res) => {
    try {
      if (!req.url) {
        res.writeHead(400);
        res.end('Bad Request');
        return;
      }
      const requestUrl = new URL(req.url, 'http://localhost');
      if (!requestUrl.pathname.startsWith('/data')) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }
      const relative = decodeURIComponent(requestUrl.pathname.replace(/^\/data/, '')) || '/';
      const targetPath = path.normalize(path.join(normalizedRoot, relative));
      if (!targetPath.startsWith(normalizedRoot)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.stat(targetPath, (statErr, stat) => {
        if (statErr || !stat.isFile()) {
          res.writeHead(404);
          res.end('File Not Found');
          return;
        }
        const ext = path.extname(targetPath);
        res.writeHead(200, {
          'Content-Type': getMimeType(ext),
          'Content-Length': stat.size,
          'Access-Control-Allow-Origin': '*'
        });
        const stream = fs.createReadStream(targetPath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(500);
          }
          res.end('Read Error');
        });
        stream.pipe(res);
      });
    } catch (error) {
      console.error('[DataServer] Request handling error', error);
      if (!res.headersSent) {
        res.writeHead(500);
      }
      res.end('Internal Error');
    }
  });

  dataServer.listen(DATA_SERVER_PORT, '0.0.0.0', () => {
    const hosts = getNetworkHosts();
    const urls = hosts.map((host) => `http://${host}:${DATA_SERVER_PORT}/data`);
    cachedDataServerInfo = {
      root: normalizedRoot,
      port: DATA_SERVER_PORT,
      urls
    };
    console.log('[DataServer] Serving', normalizedRoot, 'at', urls.join(', '));
  });

  dataServer.on('error', (error) => {
    console.error('[DataServer] Failed to start', error);
  });
}

function stopDataStaticServer() {
  if (dataServer) {
    try {
      dataServer.close();
    } catch (error) {
      console.warn('[DataServer] Failed to close server', error);
    }
    dataServer = null;
  }
}

function ensureDirExists(target) {
  try {
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }
  } catch (error) {
    console.error('Failed to ensure directory', target, error);
  }
}

function ensureRuntimeLayout() {
  ensureDirExists(runtimePaths.data);
  ensureDirExists(runtimePaths.logs);

  const publicDir = path.join(runtimePaths.root, 'public');
  ensureDirExists(publicDir);

  if (!fs.existsSync(runtimePaths.publicSherpa)) {
    const parent = path.dirname(runtimePaths.publicSherpa);
    ensureDirExists(parent);
    const fallbackSources = [runtimePaths.unpackedSherpa];
    for (const candidate of fallbackSources) {
      if (candidate && fs.existsSync(candidate)) {
        try {
          fs.cpSync(candidate, runtimePaths.publicSherpa, { recursive: true });
          break;
        } catch (copyError) {
          console.error('Failed to copy Sherpa model directory', copyError);
        }
      }
    }
  }

  return runtimePaths;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true, // 自动隐藏菜单栏
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // For development we allow relaxed webSecurity to make loading local worker/wasm assets easier.
      // In production keep webSecurity enabled for better security.
      webSecurity: isDev ? false : true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // Optimization: Show window only when ready
  win.once('ready-to-show', () => {
    win.show();
  });

  // Auto-grant media permissions
  win.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  win.webContents.on('render-process-gone', (_event, details) => {
    const info = `renderer-process-gone: reason=${details?.reason}, exitCode=${details?.exitCode}`;
    console.error(info);
    try {
      ensureDirExists(runtimePaths.logs);
      fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), `[${new Date().toISOString()}][error] ${info}\n`, 'utf8');
    } catch {}
    // Attempt automatic reload to recover from white screen
    setTimeout(() => {
      if (!win.isDestroyed()) {
        win.reload();
      }
    }, 1500);
  });

  win.webContents.on('unresponsive', () => {
    const info = 'renderer-unresponsive detected';
    console.warn(info);
    try {
      ensureDirExists(runtimePaths.logs);
      fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), `[${new Date().toISOString()}][warn] ${info}\n`, 'utf8');
    } catch {}
  });
}

app.whenReady().then(() => {
  ensureRuntimeLayout();
  startDataStaticServer();

  createWindow();

  // ===== IPC Handlers =====
  
  // 获取所有路径配置
  ipcMain.handle('get-paths', async () => {
    return {
      appRoot: app.getAppPath(),
      dataDir: runtimePaths.data,
      publicDir: runtimePaths.public,
      sherpaModelsDir: runtimePaths.publicSherpa,
      ttsCacheDir: path.join(runtimePaths.data, 'tts-cache'),
      asrModelsDir: path.join(runtimePaths.publicSherpa, 'models', 'asr'),
      courseAudioDir: path.join(runtimePaths.data, 'audio'),
      userConfigDir: app.getPath('userData'),
      isDev
    };
  });
  
  // 获取数据目录
  ipcMain.handle('get-data-path', () => {
    return runtimePaths.data;
  });
  
  // 设置数据目录(暂不支持动态修改)
  ipcMain.handle('set-data-path', (_event, customPath) => {
    console.warn('[Main] 动态设置数据目录功能未实现');
    return runtimePaths.data;
  });

  // Simple logger via IPC
  ipcMain.handle('log-message', async (event, payload) => {
    try {
      ensureDirExists(runtimePaths.logs);
      const { level = 'info', message = '' } = payload || {};
      const line = `[${new Date().toISOString()}][${level}] ${message}\n`;
      fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), line, 'utf8');
      return true;
    } catch {
      return false;
    }
  });

  // Allow renderer to re-ensure directories on demand
  ipcMain.handle('ensure-runtime-dirs', async () => ensureRuntimeLayout());

  // Startup diagnostics: log key paths and existence for sherpa
  try {
    const entries = [
      `runtimeRoot=${runtimePaths.root}`,
      `resourcesPath=${process.resourcesPath}`,
      `publicSherpaDirExists=${fs.existsSync(runtimePaths.publicSherpa)}`,
      `asarUnpackedSherpaDirExists=${fs.existsSync(runtimePaths.unpackedSherpa)}`
    ];
    const bootLine = `[${new Date().toISOString()}][info] Boot Diagnostics: ${entries.join(' | ')}\n`;
    ensureDirExists(runtimePaths.logs);
    fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), bootLine, 'utf8');
  } catch {}

  ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('get-data-server-info', async () => cachedDataServerInfo);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopDataStaticServer();
});

// Global error handlers for the main process
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  try {
    ensureDirExists(runtimePaths.logs);
    const line = `[${new Date().toISOString()}][fatal] Uncaught Exception: ${error.message}\nStack: ${error.stack}\n`;
    fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), line, 'utf8');
  } catch (e) {
    console.error('Failed to log uncaught exception:', e);
  }
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  try {
    ensureDirExists(runtimePaths.logs);
    const line = `[${new Date().toISOString()}][fatal] Unhandled Rejection: ${reason}\n`;
    fs.appendFileSync(path.join(runtimePaths.logs, 'app.log'), line, 'utf8');
  } catch (e) {
    console.error('Failed to log unhandled rejection:', e);
  }
});
