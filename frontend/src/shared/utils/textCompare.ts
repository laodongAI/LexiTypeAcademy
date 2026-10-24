/**
 * 文本比对工具
 *
 * 用途：
 *   燃尽练习中判断用户输入与目标文本是否一致。
 * 规则：
 *   - 忽略大小写、标点与多余空格；
 *   - 使用 Levenshtein 距离计算相似度，默认阈值 0.9。
 */

/**
 * 归一化文本：小写、去标点、压缩空格
 * @param text 原始文本
 * @returns 归一化文本
 */
export function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    // 保留字母、数字、撇号与空格，其余标点全部去掉
    .replace(/[^a-z0-9'\s]/g, ' ')
    // 连续空白压缩为单个空格
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 计算两个字符串的 Levenshtein 编辑距离
 * @param a 字符串 A
 * @param b 字符串 B
 * @returns 编辑距离（非负整数）
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a) return b.length
  if (!b) return a.length

  // 滚动数组优化空间：只保留上一行
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      )
    }
    previous = current
  }

  return previous[b.length]
}

/**
 * 计算文本相似度
 * @param input 用户输入
 * @param target 目标文本
 * @returns 0-1 的相似度；空文本返回 0
 */
export function textSimilarity(input: string, target: string): number {
  const a = normalizeText(input)
  const b = normalizeText(target)
  if (!a || !b) return 0
  const maxLength = Math.max(a.length, b.length)
  if (maxLength === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLength
}

/**
 * 判断输入是否正确
 * @param input 用户输入
 * @param target 目标文本
 * @param threshold 相似度阈值，默认 0.9
 * @returns 是否达到阈值
 */
export function isAnswerCorrect(input: string, target: string, threshold = 0.9): boolean {
  return textSimilarity(input, target) >= threshold
}
