/**
 * 英文句子切分与词元拆分工具
 *
 * 目标：
 *   为“悬停精读”和“句子燃尽”提供唯一的文本切分实现，避免各页面各写一套。
 * 约束：
 *   - 切分结果不落库，始终由内容实时计算，防止出现两份文本。
 *   - 保留常见缩写与小数点，避免把 Mr. / 3.14 切断。
 */

/** 句子切分结果 */
export interface SplitSentence {
  /** 句子在原文中的序号（从 0 开始） */
  index: number
  /** 句子文本（保留原始标点与大小写） */
  text: string
}

/** 句子内词元：word 为可朗读的词，trailing 为紧跟其后的标点 */
export interface SentenceToken {
  /** 词本身（不含标点），如 "don't" */
  word: string
  /** 词后紧跟的标点，如 "," "?"；可能为空 */
  trailing: string
}

/** 常见缩写白名单：遇到这些以点结尾的词不切句 */
const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc',
  'e.g', 'i.e', 'u.s', 'u.k', 'a.m', 'p.m', 'no', 'fig', 'approx',
])

/**
 * 判断句子末尾的点是否属于缩写或小数
 * @param text 完整文本
 * @param dotIndex 点的下标
 * @returns true 表示不应在此处切句
 */
function shouldProtectDot(text: string, dotIndex: number): boolean {
  // 小数点：点前后都是数字
  const prevChar = text[dotIndex - 1] || ''
  const nextChar = text[dotIndex + 1] || ''
  if (/\d/.test(prevChar) && /\d/.test(nextChar)) {
    return true
  }

  // 缩写：向前取连续字母，命中白名单则保护
  let start = dotIndex - 1
  while (start >= 0 && /[A-Za-z.]/.test(text[start])) {
    start -= 1
  }
  const word = text.slice(start + 1, dotIndex).toLowerCase().replace(/\./g, '')
  return ABBREVIATIONS.has(word)
}

/**
 * 将一段英文文本切分为句子
 * @param text 原文
 * @returns 句子数组；空文本返回空数组
 */
export function splitSentences(text: string): SplitSentence[] {
  // 输入清洗：统一换行，去首尾空白
  const source = (text || '').replace(/\r\n?/g, '\n').trim()
  if (!source) return []

  const sentences: SplitSentence[] = []
  // 当前句缓冲区
  let buffer = ''

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]
    buffer += char

    const isTerminator = char === '.' || char === '!' || char === '?'
    if (!isTerminator) continue

    // 点号需要额外保护判断
    if (char === '.' && shouldProtectDot(source, i)) {
      continue
    }

    // 判断后续是否为句子边界：后面是空白 + 大写/引号，或文本结束
    let next = i + 1
    while (next < source.length && /\s/.test(source[next])) next += 1
    const nextChar = source[next] || ''
    const isBoundary = next >= source.length || /[A-Z"'“]/.test(nextChar) || nextChar === '\n'

    if (isBoundary) {
      const trimmed = buffer.trim()
      if (trimmed) {
        sentences.push({ index: sentences.length, text: trimmed })
      }
      buffer = ''
    }
  }

  // 处理最后没有结束标点的残句
  const rest = buffer.trim()
  if (rest) {
    sentences.push({ index: sentences.length, text: rest })
  }

  return sentences
}

/**
 * 将句子拆成“词 + 尾随标点”的词元
 * @param sentence 句子文本
 * @returns 词元数组；纯标点会被并入前一个词的 trailing
 */
export function tokenizeSentence(sentence: string): SentenceToken[] {
  const tokens: SentenceToken[] = []
  // 匹配英文单词（含撇号与连字符），其余字符视为标点
  const pattern = /([A-Za-z]+(?:['’-][A-Za-z]+)*)/g
  const matches = Array.from((sentence || '').matchAll(pattern))

  if (matches.length === 0) {
    return []
  }

  matches.forEach((match, index) => {
    const word = match[0]
    const start = (match.index ?? 0) + word.length
    const nextStart = index + 1 < matches.length
      ? (matches[index + 1].index ?? sentence.length)
      : sentence.length
    // 词后到下一个词之间的内容全部视为尾随标点（如 ", " / "?!"）
    const trailing = sentence.slice(start, nextStart).trim()
    tokens.push({ word, trailing })
  })

  return tokens
}

/**
 * 归一化单词：小写并去掉首尾标点
 * @param word 原始词
 * @returns 归一化后的词
 */
export function normalizeWord(word: string): string {
  return (word || '')
    .toLowerCase()
    .replace(/^[^a-z]+|[^a-z]+$/g, '')
}
