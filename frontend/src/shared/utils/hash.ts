/**
 * 通用哈希与稳定 ID 工具
 *
 * 目的：
 * - 为课程生成/缓存等场景提供可复用的“稳定字符串哈希”能力
 * - 避免在多个文件里重复实现同一套哈希逻辑
 *
 * 注意：
 * - 该实现是轻量级非加密哈希，仅用于生成稳定 key/id，不用于安全相关场景
 */

/**
 * 将字符串哈希为 base36（稳定、短、适合做 key）
 * @param str 输入字符串
 */
export function hashStringToBase36(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // 转为 32 位整数
  }
  return Math.abs(hash).toString(36)
}

/**
 * 生成稳定 ID（同样的 parts 永远得到同样的 id）
 * @param prefix id 前缀
 * @param parts 参与生成的关键因子（顺序敏感）
 */
export function createStableId(prefix: string, ...parts: Array<string | number>): string {
  const raw = parts.map(p => String(p)).join('|')
  return `${prefix}_${hashStringToBase36(raw)}`
}
