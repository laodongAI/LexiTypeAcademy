/**
 * 音频工具集合：负责路径解析、URL 构建及本地文件读写管理
 */
const electronWindow = window as any;

// 缓存数据服务器元信息，便于在渲染进程拼接 HTTP 访问路径
interface DataServerInfoPayload {
  root?: string;
  port?: number;
  urls?: string[];
}

interface NormalizedDataServerInfo {
  root: string;
  port?: number;
  urls: string[];
}

let cachedDataServerInfo: NormalizedDataServerInfo | null = null;
let dataServerInfoPromise: Promise<void> | null = null;

// 将主进程返回的数据服务器信息进行归一化
function normalizeDataServerInfo(info?: DataServerInfoPayload | null): NormalizedDataServerInfo | null {
  if (!info || typeof info !== 'object') return null;
  const root = typeof info.root === 'string' ? info.root : '';
  const port = typeof info.port === 'number' ? info.port : undefined;
  const urls = Array.isArray(info.urls)
    ? info.urls.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];
  return { root, port, urls };
}

/**
 * 主动刷新一次数据服务器信息，避免每次播放都发同样 IPC
 */
function refreshDataServerInfo() {
  const api = electronWindow?.electron;
  if (!api?.getDataServerInfo) return;
  if (dataServerInfoPromise) return;
  dataServerInfoPromise = Promise.resolve(api.getDataServerInfo())
    .then((info) => {
      const normalized = normalizeDataServerInfo(info);
      if (normalized) {
        cachedDataServerInfo = {
          root: normalized.root,
          port: normalized.port,
          urls: normalized.urls.map((url) => url.replace(/\/+$/, '')),
        };
      }
    })
    .catch((error) => {
      console.warn('[audioUtils] 获取数据服务器信息失败', error);
    })
    .finally(() => {
      dataServerInfoPromise = null;
    });
}

/**
 * 获取缓存中的数据服务器基础 URL
 */
function getCachedDataServerBaseUrl(): string {
  if (cachedDataServerInfo?.urls?.length) {
    return cachedDataServerInfo.urls[0];
  }
  if (typeof cachedDataServerInfo?.port === 'number') {
    return `http://127.0.0.1:${cachedDataServerInfo.port}/data`;
  }
  return '';
}

/**
 * 将相对路径映射到可直接 fetch 的 HTTP 链接
 */
function buildDataServerAudioUrl(relativePath: string): string {
  const base = getCachedDataServerBaseUrl();
  if (!base) {
    refreshDataServerInfo();
    return '';
  }
  const sanitizedBase = base.replace(/\/+$/, '');
  const normalizedRelative = normalizeSlashes(relativePath).replace(/^\/+/, '');
  if (!normalizedRelative) return sanitizedBase;
  return `${sanitizedBase}/${normalizedRelative}`;
}

refreshDataServerInfo();

/**
 * 获取 Electron Bridge，避免重复判断
 */
function getElectronBridge() {
  return electronWindow?.electron;
}

/**
 * 克隆任意 ArrayBuffer 视图，避免引用共享
 */
function cloneBufferView(view: ArrayBufferView): ArrayBuffer {
  const copy = new Uint8Array(view.byteLength);
  copy.set(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
  return copy.buffer;
}

/**
 * 将多种二进制载荷统一转换为 ArrayBuffer
 */
async function toArrayBuffer(payload: ArrayBuffer | ArrayBufferView | Blob): Promise<ArrayBuffer> {
  if (payload instanceof ArrayBuffer) {
    return payload;
  }
  if (ArrayBuffer.isView(payload)) {
    return cloneBufferView(payload);
  }
  if (typeof Blob !== 'undefined' && payload instanceof Blob) {
    return await payload.arrayBuffer();
  }
  throw new Error('Unsupported audio payload');
}

/**
 * 兼容 readAudioFile 返回的多种结构，将其转换为 ArrayBuffer
 */
async function normalizeReadResult(raw: any): Promise<ArrayBuffer | null> {
  if (!raw) return null;
  if (raw instanceof ArrayBuffer) return raw;
  if (ArrayBuffer.isView(raw)) return cloneBufferView(raw);
  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    return await raw.arrayBuffer();
  }
  if (typeof raw === 'string') {
    try {
      const binary = atob(raw);
      const view = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) {
        view[i] = binary.charCodeAt(i);
      }
      return view.buffer;
    } catch (error) {
      console.warn('[audioUtils] 无法解析字符串音频内容', error);
      return null;
    }
  }
  return null;
}

/**
 * 获取运行时的数据根目录
 * 优先使用 PathManager,降级使用 Electron IPC
 */
function getDataRoot(): string {
  // 优先尝试使用 PathManager(如果已初始化)
  try {
    const { getPathManager } = require('@/app/PathManager');
    const pathManager = getPathManager();
    if (pathManager) {
      return pathManager.getDataDir();
    }
  } catch {
    // PathManager 未初始化或不可用,降级
  }
  
  // 降级: 使用 Electron IPC
  const electronApi = electronWindow?.electron;
  if (!electronApi) return '';
  try {
    const direct = typeof electronApi.getDataPath === 'function' ? electronApi.getDataPath() : '';
    if (direct) return direct;
  } catch {}
  try {
    const runtime = typeof electronApi.getRuntimePaths === 'function' ? electronApi.getRuntimePaths() : null;
    if (runtime?.dataDir) return runtime.dataDir;
  } catch {}
  try {
    if (typeof electronApi.getRuntimeRoot === 'function') {
      return electronApi.getRuntimeRoot();
    }
  } catch {}
  return '';
}

/**
 * 统一替换路径分隔符，避免出现混合的斜杠
 */
function normalizeSlashes(value: string): string {
  return value.replace(/\\/g, '/');
}

/**
 * 判断是否为本地绝对路径，优先用 file:// 回退
 */
function isAbsoluteFsPath(value: string): boolean {
  return /^[a-zA-Z]:/.test(value) || value.startsWith('\\\\');
}

/**
 * 拼接根目录与相对路径
 */
function joinWithBase(base: string, relative: string): string {
  const normalizedBase = normalizeSlashes(base).replace(/\/+$/, '');
  const normalizedRelative = normalizeSlashes(relative).replace(/^\/+/, '');
  if (!normalizedBase) return normalizedRelative;
  if (!normalizedRelative) return normalizedBase;
  return `${normalizedBase}/${normalizedRelative}`;
}

/**
 * 将 file:// URL 转换为绝对磁盘路径
 */
function fileUrlToAbsolute(urlLike: string): string {
  try {
    const url = new URL(urlLike);
    let pathname = decodeURIComponent(url.pathname || '');
    if (url.host) {
      pathname = `//${url.host}${pathname}`;
    }
    if (/^\/[a-zA-Z]:/.test(pathname)) {
      pathname = pathname.slice(1);
    }
    return normalizeSlashes(pathname || '');
  } catch {
    return urlLike;
  }
}

/**
 * 将任意音频路径解析为当前系统可用的绝对路径
 */
export function resolveAbsoluteAudioPath(raw?: string | null): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^file:\/\//i.test(trimmed)) {
    return fileUrlToAbsolute(trimmed);
  }
  if (/^[a-zA-Z]:/.test(trimmed) || trimmed.startsWith('\\\\')) {
    return normalizeSlashes(trimmed);
  }

  const baseDir = getDataRoot();
  if (!baseDir) {
    return normalizeSlashes(trimmed);
  }
  return joinWithBase(baseDir, trimmed);
}

/**
 * 将绝对路径转换为可直接交给 Audio 标签使用的 file:// URL
 */
export function absolutePathToFileUrl(absPath?: string | null): string {
  if (!absPath) return '';
  let normalized = normalizeSlashes(absPath);
  if (!normalized) return '';
  if (/^[a-zA-Z]:/.test(normalized)) {
    normalized = `/${normalized}`;
  }
  return `file://${normalized}`;
}

/**
 * 将任意音频路径（相对/绝对）转换为可播放的 URL
 */
export function ensurePlayableAudioUrl(input?: string | null): string {
  if (!input) return '';
  const trimmed = input.trim();
  if (!trimmed) return '';
  if (/^(https?:|blob:|data:)/i.test(trimmed)) return trimmed;
  if (/^file:\/\//i.test(trimmed)) return trimmed;
  if (isAbsoluteFsPath(trimmed)) {
    return absolutePathToFileUrl(normalizeSlashes(trimmed));
  }
  const serverUrl = buildDataServerAudioUrl(trimmed);
  if (serverUrl) {
    return serverUrl;
  }
  const absolute = resolveAbsoluteAudioPath(trimmed);
  return absolute ? absolutePathToFileUrl(absolute) : trimmed;
}

/**
 * 保存音频文件，若文件名已存在则会自动覆盖
 */
export async function saveAudioBinary(options: {
  subDir?: string;
  filename: string;
  data: ArrayBuffer | ArrayBufferView | Blob;
}): Promise<string | null> {
  const electronApi = getElectronBridge();
  if (!electronApi?.saveAudioFile) {
    console.warn('[audioUtils] Electron saveAudioFile API 不可用');
    return null;
  }
  if (!options?.filename) {
    console.warn('[audioUtils] 保存音频时需要提供文件名');
    return null;
  }
  try {
    const buffer = await toArrayBuffer(options.data);
    const result = electronApi.saveAudioFile(options.subDir ?? '', options.filename, buffer);
    return result instanceof Promise ? await result : result;
  } catch (error) {
    console.error('[audioUtils] 保存音频文件失败', error);
    return null;
  }
}

/**
 * 读取音频二进制内容，自动解析相对路径
 */
export async function readAudioBinary(pathOrRelative?: string | null): Promise<ArrayBuffer | null> {
  if (!pathOrRelative) return null;
  const electronApi = getElectronBridge();
  if (!electronApi?.readAudioFile) {
    console.warn('[audioUtils] Electron readAudioFile API 不可用');
    return null;
  }
  try {
    const absolute = resolveAbsoluteAudioPath(pathOrRelative);
    const result = electronApi.readAudioFile(absolute);
    const payload = result instanceof Promise ? await result : result;
    return await normalizeReadResult(payload);
  } catch (error) {
    console.error('[audioUtils] 读取音频文件失败', error);
    return null;
  }
}

/**
 * 删除音频文件，若文件不存在则视为成功
 */
export async function deleteAudioFile(pathOrRelative?: string | null): Promise<boolean> {
  if (!pathOrRelative) return false;
  const electronApi = getElectronBridge();
  if (!electronApi?.deleteAudioFile) {
    console.warn('[audioUtils] Electron deleteAudioFile API 不可用');
    return false;
  }
  try {
    const absolute = resolveAbsoluteAudioPath(pathOrRelative);
    const result = electronApi.deleteAudioFile(absolute);
    const outcome = result instanceof Promise ? await result : result;
    return !!outcome;
  } catch (error) {
    console.error('[audioUtils] 删除音频文件失败', error);
    return false;
  }
}

