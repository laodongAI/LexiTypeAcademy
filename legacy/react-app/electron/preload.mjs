import { contextBridge, ipcRenderer } from 'electron';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { pathToFileURL } from 'url';
import Store from 'electron-store';

const store = new Store({ name: 'typing-data' });

const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV === '1';
// Use relative path for better compatibility
const SHERPA_RELATIVE_DIR = path.join('public', 'sherpa', 'sherpa-onnx-wasm-simd-v1.12.18-en-tts');
const runtimeRoot = isDev ? path.resolve(process.cwd()) : path.dirname(process.resourcesPath);
const runtimeInfo = {
  root: runtimeRoot,
  dataDir: path.join(runtimeRoot, 'data'),
  logsDir: path.join(runtimeRoot, 'logs'),
  publicSherpaDir: path.join(runtimeRoot, SHERPA_RELATIVE_DIR),
  unpackedSherpaDir: path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'sherpa', 'sherpa-onnx-wasm-simd-v1.12.18-en-tts')
};

const toFileUrl = (targetPath) => pathToFileURL(targetPath).href;

contextBridge.exposeInMainWorld('electron', {
  isDev,
  getResourcesPath: () => process.resourcesPath,
  checkFileExists: (path) => ipcRenderer.invoke('check-file-exists', path),
  getAppBasePath: () => runtimeInfo.root,
  getRuntimePaths: () => ({ ...runtimeInfo }),
  getRuntimeRoot: () => runtimeInfo.root,
  getLogsDir: () => runtimeInfo.logsDir,
  getDataDir: () => runtimeInfo.dataDir,
  getSherpaModelPath: () => toFileUrl(runtimeInfo.unpackedSherpaDir),
  getPublicSherpaModelPath: () => toFileUrl(runtimeInfo.publicSherpaDir),
  ensureRuntimeLayout: () => ipcRenderer.invoke('ensure-runtime-dirs'),
  log: (level, message) => ipcRenderer.invoke('log-message', { level, message }),
  getDataServerInfo: () => ipcRenderer.invoke('get-data-server-info'),
  saveAudioFile: (subDir, fileName, buffer) => {
    try {
      const baseDir = runtimeInfo.dataDir;

      // Check if user has a custom override in settings, but validate it
      let dataPath = store.get('settings.dataPath');
      
      // If stored path is invalid or points to Temp (common issue with portable/updates), force default
      if (dataPath && (dataPath.includes('AppData\\Local\\Temp') || dataPath.includes('AppData/Local/Temp'))) {
        ipcRenderer.invoke('log-message', { level: 'warn', message: `Resetting invalid Temp data path: ${dataPath} -> ${baseDir}` });
        dataPath = '';
        store.set('settings.dataPath', '');
      }

      const targetBase = dataPath || baseDir;
      const targetDir = path.join(targetBase, subDir);
      
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const filePath = path.join(targetDir, fileName);
      fs.writeFileSync(filePath, new Uint8Array(buffer));
      return filePath;
    } catch (e) {
      console.error('Failed to save audio file', e);
      ipcRenderer.invoke('log-message', { level: 'error', message: `Failed to save audio file: ${e.message}` });
      return null;
    }
  },
  readAudioFile: (filePath) => {
    try {
      return fs.readFileSync(filePath);
    } catch (e) {
      console.error('readAudioFile error', e);
      return null;
    }
  },
  deleteAudioFile: (filePath) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return true;
    } catch (e) {
      console.error('deleteAudioFile error', e);
      return false;
    }
  },
  getCacheSize: () => {
    try {
      const baseDir = runtimeInfo.dataDir;
      const dataPath = store.get('settings.dataPath');
      const targetBase = dataPath || baseDir;
      const dir = path.join(targetBase, 'tts-cache');
      
      if (!fs.existsSync(dir)) return 0;
      
      const files = fs.readdirSync(dir);
      let total = 0;
      for (const f of files) {
        const stat = fs.statSync(path.join(dir, f));
        total += stat.size;
      }
      return total;
    } catch (e) {
      return 0;
    }
  },
  clearAudioCache: () => {
    try {
      const baseDir = runtimeInfo.dataDir;
      const dataPath = store.get('settings.dataPath');
      const targetBase = dataPath || baseDir;
      const dir = path.join(targetBase, 'tts-cache');
      
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          fs.unlinkSync(path.join(dir, f));
        }
      }
      return true;
    } catch (e) {
      console.error('clearAudioCache error', e);
      return false;
    }
  },
  clearTempRecordings: () => {
    try {
      const baseDir = runtimeInfo.dataDir;
      const dataPath = store.get('settings.dataPath');
      const targetBase = dataPath || baseDir;
      const dir = path.join(targetBase, 'tmp', 'customer');
      
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const f of files) {
          fs.unlinkSync(path.join(dir, f));
        }
      }
      return true;
    } catch (e) {
      console.error('clearTempRecordings error', e);
      return false;
    }
  },
  getDataPath: () => {
    const stored = store.get('settings.dataPath');
    if (stored && !stored.includes('AppData\\Local\\Temp')) return stored;
    
    return runtimeInfo.dataDir;
  },
  setDataPath: (p) => store.set('settings.dataPath', p)
});

// ---------- History ----------
function getHistory() { return store.get('history', []); }
function addRecord(record) {
  const history = store.get('history', []);
  history.push(record);
  store.set('history', history);
  return history;
}

// ---------- Settings ----------
function getSetting(key, defaultValue) { return store.get(`settings.${key}`, defaultValue); }
function setSetting(key, value) { store.set(`settings.${key}`, value); }

// ---------- Courses ----------
function getCourses() { return store.get('courses', []); }
function saveCourse(course) {
  const courses = store.get('courses', []);
  const idx = courses.findIndex(c => c.id === course.id);
  if (idx >= 0) courses[idx] = course; else courses.push(course);
  store.set('courses', courses);
  return course;
}
function deleteCourse(id) {
  const courses = store.get('courses', []);
  const updated = courses.filter(c => c.id !== id);
  store.set('courses', updated);
  return updated;
}

contextBridge.exposeInMainWorld('typingAPI', {
  // history
  getHistory,
  addRecord,
  // settings
  getSetting,
  setSetting,
  // courses
  getCourses,
  saveCourse,
  deleteCourse,
  // export history CSV
  exportHistoryCSV: () => {
    const history = getHistory();
    const header = 'date,practiceType,difficulty,wpm,accuracy\n';
    const rows = history.map(r => [r.date, r.practiceType, r.difficulty, r.wpm, r.accuracy].join(',')).join('\n');
    const csv = header + rows;
    const dir = os.homedir();
    const file = path.join(dir, `typing-history-${Date.now()}.csv`);
    try {
      fs.writeFileSync(file, csv, 'utf-8');
      return file;
    } catch (e) {
      return null;
    }
  },
  // export analytics CSV (including mastery)
  exportAnalyticsCSV: (masteryStats) => {
    const history = getHistory();
    const header = 'date,practiceType,difficulty,wpm,accuracy\n';
    const rows = history.map(r => [r.date, r.practiceType, r.difficulty, r.wpm, r.accuracy].join(',')).join('\n');
    
    const masteryHeader = '\n\nMastery Stats\nTotal,Mastered,Learning,Due\n';
    const masteryRow = `${masteryStats.total},${masteryStats.mastered},${masteryStats.learning},${masteryStats.due}\n`;

    const csv = header + rows + masteryHeader + masteryRow;
    const dir = os.homedir();
    const file = path.join(dir, `lexitype-analytics-${Date.now()}.csv`);
    try {
      fs.writeFileSync(file, csv, 'utf-8');
      return file;
    } catch (e) {
      return null;
    }
  }
});
