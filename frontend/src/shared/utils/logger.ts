/**
 * 前端分级日志工具
 *
 * 目标：
 *   统一课堂相关模块的日志格式与级别，便于调试时按模块过滤。
 * 约定：
 *   - debug：交互细节（悬停、阶段变化）
 *   - info：关键流程（进入课堂、完成练习、音频开始播放）
 *   - warn：可恢复异常（TTS 失败、词条缺失）
 *   - error：不可恢复异常（数据加载失败）
 */

/** 日志级别枚举 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

/** 日志器接口定义 */
export interface ScopedLogger {
  /** 调试日志 */
  debug: (message: string, ...args: unknown[]) => void
  /** 普通信息日志 */
  info: (message: string, ...args: unknown[]) => void
  /** 警告日志 */
  warn: (message: string, ...args: unknown[]) => void
  /** 错误日志 */
  error: (message: string, ...args: unknown[]) => void
}

/**
 * 创建带作用域的日志器
 * @param scope 作用域名称，如 classroom / reader / burndown
 * @returns 具备四个级别的日志器
 */
export function createLogger(scope: string): ScopedLogger {
  // 统一前缀：便于在控制台按模块筛选
  const prefix = `[${scope}]`

  return {
    debug: (message: string, ...args: unknown[]) => {
      console.debug(prefix, message, ...args)
    },
    info: (message: string, ...args: unknown[]) => {
      console.info(prefix, message, ...args)
    },
    warn: (message: string, ...args: unknown[]) => {
      console.warn(prefix, message, ...args)
    },
    error: (message: string, ...args: unknown[]) => {
      console.error(prefix, message, ...args)
    },
  }
}
