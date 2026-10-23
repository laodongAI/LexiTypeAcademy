/**
 * AI 教学引擎（规则层）
 *
 * 目标：在不依赖 AI 的情况下提供稳定的判定、相似度与提示层级，
 * 让 UI/交互可先落地；当 AI 可用时，再用 AIService 进行增强反馈。
 */

import type {
  DictationEvaluationInput,
  DictationEvaluationResult,
  HintLevel,
  PronunciationEvaluationInput,
  PronunciationEvaluationResult,
  TeachingErrorType,
  TeachingHint,
} from './teachingTypes'

function normalizeEnglishForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”"'`]/g, '')
    .replace(/[.,!?;:()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const dp: number[] = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) dp[j] = j

  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j++) {
      const temp = dp[j]
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      )
      prev = temp
    }
  }

  return dp[b.length]
}

function similarityByLevenshtein(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  const dist = levenshtein(a, b)
  return Math.max(0, Math.min(1, 1 - dist / maxLen))
}

function clampHintLevel(level: number): HintLevel {
  if (level <= 0) return 0
  if (level >= 4) return 4
  return level as HintLevel
}

function nextHintLevelByAttempts(attemptCount: number, previousHintLevel: HintLevel | undefined): HintLevel {
  // 业务规则：错误>=1 -> L1；>=2 -> L2；>=3 -> L3；L4 仅用户请求。
  // 这里用 attemptCount 作为“错误次数”的近似（提交即一次尝试）。
  const inferred = attemptCount >= 3 ? 3 : attemptCount >= 2 ? 2 : attemptCount >= 1 ? 1 : 0
  const base = Math.max(inferred, previousHintLevel ?? 0)
  return clampHintLevel(base)
}

function buildDictationHint(level: HintLevel, target: string, chineseHint?: string): TeachingHint {
  if (level === 0) {
    return {
      level,
      title: '无需提示',
      content: '先独立完成一次，再考虑提示。',
    }
  }

  if (level === 1) {
    return {
      level,
      title: '提示 Level 1：中文释义',
      content: chineseHint?.trim() ? chineseHint.trim() : '暂无中文释义，可先尝试回想关键单词。',
    }
  }

  if (level === 2) {
    const initials = target
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => (w[0] ? `${w[0]}_` : '_'))
      .join(' ')
    return {
      level,
      title: '提示 Level 2：首字母',
      content: initials || '（无法生成首字母提示）',
    }
  }

  if (level === 3) {
    return {
      level,
      title: '提示 Level 3：完整答案',
      content: target,
    }
  }

  return {
    level: 4,
    title: '提示 Level 4：例句/拓展',
    content: `建议：先跟读 3 遍再听写。\n参考：${target}`,
  }
}

export function evaluateDictation(input: DictationEvaluationInput): DictationEvaluationResult {
  const normalizedTarget = normalizeEnglishForComparison(input.targetText)
  const normalizedUser = normalizeEnglishForComparison(input.userText)

  const similarity = similarityByLevenshtein(normalizedTarget, normalizedUser)
  const correct = normalizedTarget === normalizedUser

  const errorTypes: TeachingErrorType[] = []
  if (!correct) {
    // 听写：主要是 LISTENING / SPELLING
    errorTypes.push('LISTENING', 'SPELLING')
  }

  const nextLevel = nextHintLevelByAttempts(input.attemptCount, input.previousHintLevel)
  const nextHint = buildDictationHint(nextLevel, input.targetText.trim(), input.chineseHint)

  return {
    correct,
    normalizedTarget,
    normalizedUser,
    similarity,
    errorTypes,
    nextHint,
  }
}

export function evaluatePronunciation(input: PronunciationEvaluationInput): PronunciationEvaluationResult {
  const overallScore = Math.round(input.scoreDetail.overall)
  const passed = overallScore >= 60

  const errorTypes: TeachingErrorType[] = []
  // 发音评估：主要是 PRONUNCIATION / FLUENCY
  if (!passed) {
    errorTypes.push('PRONUNCIATION')
  }
  if ((input.scoreDetail.fluency ?? 0) < 75) {
    errorTypes.push('FLUENCY')
  }

  const nextLevel = nextHintLevelByAttempts(input.attemptCount, input.previousHintLevel)
  const nextHint: TeachingHint = {
    level: nextLevel,
    title: nextLevel === 0 ? '无需提示' : `提示 Level ${nextLevel}`,
    content:
      nextLevel === 0
        ? '先完整朗读一次，注意节奏与停顿。'
        : nextLevel === 1
          ? '建议：放慢语速，先把每个单词读清楚。'
          : nextLevel === 2
            ? '建议：按词组断句，再连读。'
            : nextLevel === 3
              ? '建议：逐词跟读（shadowing），对照文本纠正重音。'
              : '建议：使用例句/替换练习巩固，再回到本句。',
  }

  return {
    passed,
    overallScore,
    errorTypes,
    nextHint,
  }
}
