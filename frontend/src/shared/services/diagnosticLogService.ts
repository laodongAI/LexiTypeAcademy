/** 前端诊断日志：仅保存诊断摘要，不记录请求正文、密钥或完整学习输入。 */
export type DiagnosticLevel = 'debug' | 'info' | 'warn' | 'error'
export interface DiagnosticLogEntry { id: string; timestamp: number; level: DiagnosticLevel; source: string; message: string; details?: string }
const STORAGE_KEY = 'lexitype-diagnostic-logs-v1'
const MAX_ENTRIES = 1000
const listeners = new Set<() => void>()
let entries: DiagnosticLogEntry[] = []
let initialized = false
function init() {
  if (initialized) return
  initialized = true
  try { const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); if (Array.isArray(value)) entries = value.slice(-MAX_ENTRIES) as DiagnosticLogEntry[] } catch { entries = [] }
}
function persist() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_ENTRIES))) } catch { /* 存储不可用时保留内存日志 */ } }
function notify() { listeners.forEach((listener) => listener()) }
export function addDiagnosticLog(level: DiagnosticLevel, source: string, message: string, details?: unknown) {
  init()
  let detailText: string | undefined
  if (details instanceof Error) detailText = details.name + ': ' + details.message
  else if (typeof details === 'string') detailText = details
  else if (details !== undefined) { try { detailText = JSON.stringify(details) } catch { detailText = String(details) } }
  entries.push({ id: Date.now() + '-' + Math.random().toString(36).slice(2, 9), timestamp: Date.now(), level, source: source.slice(0, 80), message: message.slice(0, 500), details: detailText?.slice(0, 1500) })
  if (entries.length > MAX_ENTRIES) entries = entries.slice(-MAX_ENTRIES)
  persist(); notify()
}
export function getDiagnosticLogs(): DiagnosticLogEntry[] { init(); return [...entries].reverse() }
export function clearDiagnosticLogs() { init(); entries = []; try { localStorage.removeItem(STORAGE_KEY) } catch { /* 忽略 */ }; notify() }
export function subscribeDiagnosticLogs(listener: () => void): () => void { init(); listeners.add(listener); return () => listeners.delete(listener) }
export function installGlobalDiagnosticHandlers() {
  if (typeof window === 'undefined') return
  const target = window as Window & { __lexitypeDiagnosticHandlersInstalled?: boolean }
  if (target.__lexitypeDiagnosticHandlersInstalled) return
  target.__lexitypeDiagnosticHandlersInstalled = true
  window.addEventListener('error', (event) => addDiagnosticLog('error', 'window', event.message || '前端运行错误', { file: event.filename, line: event.lineno, column: event.colno }))
  window.addEventListener('unhandledrejection', (event) => addDiagnosticLog('error', 'promise', '未处理的异步异常', event.reason instanceof Error ? event.reason : String(event.reason)))
  addDiagnosticLog('info', 'app', '前端诊断日志已启动', { url: window.location.pathname })
}
