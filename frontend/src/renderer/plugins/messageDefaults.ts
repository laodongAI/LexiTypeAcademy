/**
 * Global message defaults plugin
 * Ensures all toasts are visible, closable, and auto-dismiss after 3s (unless duration explicitly set).
 * 
 * Must be called after ElMessage is available (i.e., after app creation).
 */

import { ElMessage } from 'element-plus'

const DEFAULT_DURATION = 3000
const DEFAULT_OFFSET = 64
const SHOW_CLOSE = true

let patched = false

type MessageInput = any

function normalize(options: MessageInput) {
  if (typeof options === 'string') return { message: options }
  return options || {}
}

function applyDefaults(opts: any) {
  // Apply defaults - do NOT override if user explicitly set these
  if (opts.duration === undefined || opts.duration === null || opts.duration === 0) {
    opts.duration = DEFAULT_DURATION
  }
  if (opts.showClose === undefined) {
    opts.showClose = SHOW_CLOSE
  }
  if (opts.offset === undefined) {
    opts.offset = DEFAULT_OFFSET
  }
  // Ensure it's appended to body (avoid being hidden in scroll containers)
  if (opts.appendTo === undefined) {
    opts.appendTo = document.body
  }
  return opts
}

export function showMessage(options: MessageInput) {
  const opts = applyDefaults(normalize(options))
  return ElMessage(opts)
}

export function setupMessageDefaults() {
  if (patched) return
  patched = true

  const originalMethods = {
    success: ElMessage.success,
    warning: ElMessage.warning,
    error: ElMessage.error,
    info: ElMessage.info,
  }

  const createWrapper = (originalFn: any) => {
    return function (options: MessageInput) {
      const opts = applyDefaults(normalize(options))
      return originalFn(opts)
    }
  }

  ;(Object.keys(originalMethods) as Array<keyof typeof originalMethods>).forEach((key) => {
    ElMessage[key] = createWrapper(originalMethods[key]) as any
  })

  if (import.meta.env.DEV) {
    console.log('[Message Defaults] ✅ Applied (3s + closable + appendTo body)')
  }
}
