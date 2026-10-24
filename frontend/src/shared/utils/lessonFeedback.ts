/**
 * 课堂点评计算（纯函数）
 *
 * 职责：
 * - 根据课堂指标计算 1–5 星
 * - 生成"称呼 + 肯定 + 观察 + 下一步"三段式点评
 * - 输出可朗读的完整文案
 *
 * 说明：
 * - 本模块不依赖 Vue/Pinia，便于复用与后续接 AI 润色
 * - 星级规则以"完成度、独立度、首答质量"为依据，速度不计分
 * - 文案只陈述真实数据，不生成不存在的优点
 */

/** 课堂模式 */
export type FeedbackMode = 'reader' | 'burn-sentence' | 'burn-word' | 'root'

/** 点评输入指标 */
export interface LessonMetrics {
  /** 课堂模式 */
  mode: FeedbackMode
  /** 完成单元数（燃尽为单元数，精读为已读句数，词根为浏览词条数） */
  units: number
  /** 总单元数 */
  totalUnits: number
  /** 使用提示次数 */
  hintsUsed: number
  /** 跳过单元数（仅燃尽） */
  skippedUnits: number
  /** 首次即正确的单元数（仅燃尽） */
  firstTryUnits: number
  /** 查词次数（仅精读） */
  lookupCount?: number
  /** 课堂用时（毫秒） */
  durationMs: number
}

/** 点评结果 */
export interface LessonFeedbackResult {
  /** 星级：1–5 */
  stars: number
  /** 完成度：0–1 */
  completionRate: number
  /** 首答正确率：0–1（无数据时为 0） */
  firstTryRate: number
  /** 具体肯定 */
  praise: string
  /** 真实观察 */
  observation: string
  /** 下一步建议 */
  nextAction: string
  /** 亮点标签 */
  strengths: string[]
  /** 待改进标签 */
  issues: string[]
  /** 可朗读的完整点评 */
  fullText: string
}

/** 小老师在界面中的称呼 */
export const TEACHER_NAME = '小老师'

/** 昵称为空时的默认称呼 */
const DEFAULT_ADDRESS = '同学'

/**
 * 计算完成度
 * @param metrics 课堂指标
 * @returns 0–1 的比例
 */
export function computeCompletionRate(metrics: LessonMetrics): number {
  const total = Math.max(metrics.totalUnits, 1)
  // 燃尽：跳过不计入完成
  const completed = metrics.mode.startsWith('burn')
    ? Math.max(0, metrics.units - metrics.skippedUnits)
    : metrics.units
  return Math.min(1, completed / total)
}

/**
 * 计算首答正确率
 * @param metrics 课堂指标
 * @returns 0–1 的比例
 */
export function computeFirstTryRate(metrics: LessonMetrics): number {
  if (!metrics.mode.startsWith('burn')) return 0
  const total = Math.max(metrics.units, 1)
  return Math.min(1, metrics.firstTryUnits / total)
}

/**
 * 计算星级（1–5）
 * @param metrics 课堂指标
 * @returns 星级与分项比例
 */
export function computeLessonStars(metrics: LessonMetrics): {
  stars: number
  completionRate: number
  firstTryRate: number
} {
  const completionRate = computeCompletionRate(metrics)
  const firstTryRate = computeFirstTryRate(metrics)
  const totalUnits = Math.max(metrics.units, 1)
  const hintRate = metrics.hintsUsed / totalUnits

  // 完成即保底 1 星
  let stars = 1
  if (completionRate >= 0.6) stars += 1
  if (completionRate >= 0.999) stars += 1
  if (hintRate <= 0.2) stars += 1

  // 质量星：按模式使用不同客观依据
  if (metrics.mode.startsWith('burn')) {
    if (firstTryRate >= 0.7) stars += 1
  } else if (metrics.mode === 'reader') {
    const read = Math.max(metrics.units, 1)
    const lookupRate = (metrics.lookupCount ?? 0) / read
    if (lookupRate <= 1) stars += 1
  } else if (completionRate >= 0.8) {
    stars += 1
  }

  return { stars: Math.min(5, Math.max(1, stars)), completionRate, firstTryRate }
}

/**
 * 按种子从模板数组中选择一条，避免每次完全一样
 * @param list 模板列表
 * @param seed 种子（通常取课时 ID）
 * @returns 选中的模板
 */
function pick(list: string[], seed: string): string {
  if (list.length === 0) return ''
  let code = 0
  for (let index = 0; index < seed.length; index += 1) {
    code = (code + seed.charCodeAt(index)) % 997
  }
  return list[code % list.length]
}

/**
 * 生成课堂点评
 * @param metrics 课堂指标
 * @param nickname 昵称（可为空）
 * @param seed 文案种子（课时 ID，保证同一课稳定）
 * @returns 点评结果
 */
export function buildLessonFeedback(
  metrics: LessonMetrics,
  nickname: string,
  seed: string,
): LessonFeedbackResult {
  const { stars, completionRate, firstTryRate } = computeLessonStars(metrics)
  const address = (nickname || '').trim() || DEFAULT_ADDRESS
  const percent = Math.round(completionRate * 100)
  const strengths: string[] = []
  const issues: string[] = []

  // 具体肯定：优先陈述可验证的数据
  const praiseTemplates: string[] = []
  if (completionRate >= 0.999) {
    praiseTemplates.push(
      `${address}，这次全部 ${metrics.totalUnits} 个内容都完成了，坚持到最后一题，很了不起。`,
      `${address}，你把 ${metrics.totalUnits} 个内容完整走完了一遍，节奏保持得很稳。`,
    )
    strengths.push('全部完成')
  } else {
    praiseTemplates.push(
      `${address}，这次完成了 ${metrics.units} / ${metrics.totalUnits} 个内容，已经拿下 ${percent}%。`,
      `${address}，你完成了 ${percent}% 的内容，先把这一段稳住就很好。`,
    )
  }

  if (metrics.mode.startsWith('burn') && firstTryRate >= 0.7) {
    praiseTemplates.push(
      `${address}，有 ${metrics.firstTryUnits} 个是第一次就写对的，说明这些词你已经真的记住了。`,
    )
    strengths.push('首答准确')
  }

  if (metrics.hintsUsed === 0) {
    praiseTemplates.push(`${address}，这次一次提示都没用，全靠自己想出来了。`)
    strengths.push('独立完成')
  }

  // 真实观察：只描述存在问题，不夸大
  const observationTemplates: string[] = []
  if (metrics.mode.startsWith('burn') && metrics.skippedUnits > 0) {
    observationTemplates.push(
      `不过我注意到有 ${metrics.skippedUnits} 个内容是跳过的，这部分还没有真正练到。`,
    )
    issues.push('有跳过内容')
  }
  if (metrics.hintsUsed > 0) {
    observationTemplates.push(
      `中间用了 ${metrics.hintsUsed} 次提示，说明有几个地方还不太熟。`,
    )
    if (metrics.hintsUsed > Math.max(1, Math.round(metrics.units * 0.2))) {
      issues.push('提示使用偏多')
    }
  }
  if (metrics.mode === 'reader' && (metrics.lookupCount ?? 0) > Math.max(1, metrics.units)) {
    observationTemplates.push(
      `查词用了 ${metrics.lookupCount} 次，生词密度有点高，读起来会比较吃力。`,
    )
    issues.push('生词密度偏高')
  }
  if (observationTemplates.length === 0) {
    observationTemplates.push('这次没有明显的卡点，节奏和正确率都比较稳定。')
    strengths.push('过程稳定')
  }

  // 下一步：给一个可执行动作，而不是泛泛的"继续加油"
  let nextAction: string
  if (metrics.mode.startsWith('burn')) {
    if (issues.includes('有跳过内容')) {
      nextAction = '下次先把跳过的那几个补一遍，再开始新内容，记忆会更完整。'
    } else if (issues.includes('提示使用偏多')) {
      nextAction = '明天先听一遍这几个词的发音，再默写一遍，提示次数会明显减少。'
    } else {
      nextAction = '保持这个节奏，明天换一篇新内容，再验证一次。'
    }
  } else if (metrics.mode === 'reader') {
    nextAction = issues.includes('生词密度偏高')
      ? '把这次查过的词加入生词本，明天先复习 5 个，再回来读一遍这篇。'
      : '明天试着不看中文提示读一遍，看看能记住多少。'
  } else {
    nextAction = '下次先遮住中文，试着只看词根说出意思，再对照检查。'
  }

  const praise = pick(praiseTemplates, seed)
  const observation = pick(observationTemplates, `${seed}-obs`)
  const fullText = `${praise}${observation}${nextAction}`

  return {
    stars,
    completionRate,
    firstTryRate,
    praise,
    observation,
    nextAction,
    strengths,
    issues,
    fullText,
  }
}
