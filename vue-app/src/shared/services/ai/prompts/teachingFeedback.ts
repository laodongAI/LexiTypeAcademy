/**
 * 教学反馈提示词
 * 要求：只返回 JSON（无 markdown），便于稳定解析。
 */

import type { TeachingFeedbackRequest } from '../aiTypes'

export function buildTeachingFeedbackPrompt(request: TeachingFeedbackRequest): string {
  const {
    mode,
    referenceText,
    userText,
    chineseHint,
    attemptCount,
    scoreDetail,
    recognizedText,
  } = request

  const scoring = scoreDetail
    ? `\nScoreDetail(0-100): ${JSON.stringify(scoreDetail)}`
    : ''

  const recognized = recognizedText ? `\nASRRecognizedText: ${recognizedText}` : ''

  return [
    `You are an experienced English teacher and coach.`,
    `Your job is to provide actionable, kind, and specific teaching feedback for a single practice attempt.`,
    `Return ONLY valid JSON. No markdown.`,
    `Language: Chinese (you may quote key English words/phonemes).`,
    `Mode: ${mode}`,
    `AttemptCount: ${attemptCount}`,
    `ReferenceText: ${referenceText}`,
    userText ? `UserText: ${userText}` : `UserText: (not provided)`,
    chineseHint ? `ChineseHint: ${chineseHint}` : `ChineseHint: (not provided)`,
    recognized,
    scoring,
    `\nOutput JSON schema:`,
    `{`,
    `  "title": string,`,
    `  "summary": string,`,
    `  "strengths": string[],`,
    `  "issues": Array<{`,
    `    "type": "SPELLING"|"VOCAB_MEANING"|"GRAMMAR"|"PRONUNCIATION"|"LISTENING"|"SEMANTIC_INAPPROPRIATE"|"FLUENCY",`,
    `    "severity": 1|2|3,`,
    `    "message": string,`,
    `    "suggestion": string`,
    `  }>,`,
    `  "nextSteps": string[],`,
    `  "recommendedHintLevel": 0|1|2|3|4`,
    `}`,
    `\nRules:`,
    `- Keep strengths <= 3 items, issues <= 3 items, nextSteps <= 3 items.`,
    `- If mode is dictation: focus on listening + spelling.`,
    `- If mode is imitation or follow: focus on pronunciation + fluency + rhythm.`,
    `- If mode is translation: focus on meaning accuracy + grammar + natural phrasing.`,
    `- recommendedHintLevel should usually be min(3, AttemptCount) unless user explicitly asked for full answer; never exceed 4.`,
  ].join('\n')
}
