/**
 * AI 对话会话复盘（RULE-CONV-001 / IMP-08）
 *
 * 会话正常结束后，把完整对话交给 AI 做一次集中复盘：关键纠错、可用表达、
 * 下一步练习建议。对话过程中不打断交流（与 WeSpeak 的策略一致），反馈集中在
 * 结束后呈现。
 *
 * 边界：
 * - 纠错必须引用学员真实消息，AI 不得虚构原句；
 * - 复盘只是 AI 建议，不直接更新学习记录或掌握度；
 * - 解析器对 AI 输出做防御：截断超量条目、丢弃缺字段条目、解析失败返回 null。
 */

export interface ConversationReviewCorrection {
  original: string
  suggestion: string
  reason?: string
}

export interface ConversationReview {
  summary: string
  corrections: ConversationReviewCorrection[]
  expressions: string[]
  nextActions: string[]
}

export interface ReviewTurn {
  role: 'user' | 'assistant'
  content: string
}

/** 复盘产出上限：控制输出体量，也防止把一条建议拆成几十条刷屏 */
const MAX_CORRECTIONS = 3
const MAX_EXPRESSIONS = 5
const MAX_NEXT_ACTIONS = 3
const MAX_FIELD_LENGTH = 300
const MAX_TURN_LENGTH = 2000
const MAX_TRANSCRIPT_LENGTH = 8000

const SCENARIO_LABELS: Record<string, string> = {
  'ai-tutor': 'AI 英语教学',
  'english-interview': '英语面试练习',
}

export const CONVERSATION_REVIEW_SYSTEM_PROMPT = [
  'You are a language learning review assistant. A practice conversation has just finished; summarize it for the learner.',
  'Return ONLY one JSON object with exactly these keys:',
  '- "summary": one short Chinese sentence describing how the practice went',
  '- "corrections": array of at most 3 items, each {"original": string, "suggestion": string, "reason": string}; quote the learner\'s original English sentence verbatim, give a corrected or more natural version, and explain briefly in Chinese',
  '- "expressions": array of at most 5 useful English phrases from the conversation, each followed by a short Chinese explanation in parentheses',
  '- "nextActions": array of at most 3 short Chinese follow-up practice suggestions',
  'Rules: base every correction on the learner\'s real messages and quote them exactly; never invent quotes; if the learner made no mistakes, use an empty corrections array; never claim the learner has mastered anything or update learning records; respond with JSON only, no markdown fences.',
].join(' ')

/** 把会话消息整理成带角色标签的转写文本，超长时从尾部保留最新内容 */
export function buildReviewTranscript(turns: ReviewTurn[]): string {
  const lines: string[] = []
  let total = 0
  for (let index = turns.length - 1; index >= 0; index--) {
    const turn = turns[index]
    const content = (turn.content || '').slice(0, MAX_TURN_LENGTH)
    const line = `${turn.role === 'user' ? '学员' : 'AI'}：${content}`
    if (total + line.length > MAX_TRANSCRIPT_LENGTH) break
    lines.unshift(line)
    total += line.length
  }
  return lines.join('\n')
}

export function buildConversationReviewPrompt(turns: ReviewTurn[], scenarioId: string): string {
  const label = SCENARIO_LABELS[scenarioId] ?? '英语练习'
  return [
    `场景：${label}。以下是本次已结束会话的完整对话记录（按时间顺序）：`,
    '',
    buildReviewTranscript(turns),
    '',
    '请按系统要求只输出一个 JSON 对象，对学员的真实表达做集中复盘。',
  ].join('\n')
}

function clampString(value: unknown, maxLength = MAX_FIELD_LENGTH): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : ''
}

/** 去掉 Markdown 代码围栏，截取首个 { 到最后一个 } 之间的 JSON 片段 */
function extractJsonBlock(raw: string): string | null {
  const withoutFences = raw.replace(/```(?:json)?/gi, '').trim()
  const start = withoutFences.indexOf('{')
  const end = withoutFences.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return withoutFences.slice(start, end + 1)
}

function parseCorrections(value: unknown): ConversationReviewCorrection[] {
  if (!Array.isArray(value)) return []
  const corrections: ConversationReviewCorrection[] = []
  for (const item of value) {
    if (corrections.length >= MAX_CORRECTIONS) break
    if (typeof item !== 'object' || item === null) continue
    const record = item as Record<string, unknown>
    const original = clampString(record.original)
    const suggestion = clampString(record.suggestion)
    if (!original || !suggestion) continue
    const reason = clampString(record.reason)
    corrections.push(reason ? { original, suggestion, reason } : { original, suggestion })
  }
  return corrections
}

function parseStringList(value: unknown, maxItems: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .map(item => clampString(item))
    .filter(item => item.length > 0)
    .slice(0, maxItems)
}

/**
 * 解析 AI 复盘输出；无法解析时返回 null，由调用方提示重试，不伪造结果。
 * 解析成功但内容为空时返回空字段对象，由调用方决定空态展示。
 */
export function parseConversationReview(raw: string): ConversationReview | null {
  if (!raw || !raw.trim()) return null
  const jsonBlock = extractJsonBlock(raw)
  if (!jsonBlock) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(jsonBlock)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  const record = parsed as Record<string, unknown>
  return {
    summary: clampString(record.summary, 200),
    corrections: parseCorrections(record.corrections),
    expressions: parseStringList(record.expressions, MAX_EXPRESSIONS),
    nextActions: parseStringList(record.nextActions, MAX_NEXT_ACTIONS),
  }
}
