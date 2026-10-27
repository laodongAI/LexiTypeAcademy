/**
 * 统一学习方法注册表（单一来源）
 *
 * 用一个目录描述产品内所有学习方法：教学目标、选择理由、步骤、适用内容、
 * 评价证据类型与承载壳。入口卡片、模式选择与课程详情决策流都从这里取文案，
 * 不再各自硬编码，避免同一方法在不同入口说法不一致。
 *
 * 边界：
 * - 课堂 4 模式的可用性判断复用 learningMethodCompatibility.ts，不复制规则；
 * - availability 只判断现有数据是否满足前置条件，不隐式转换课程内容；
 * - evidence 描述当前真实支持的评价证据级别，入口文案不得夸大
 *   （如文本匹配不得宣称为专业发音评分）。
 */
import type { Lesson } from '../types/course'
import { learningMethodRules } from './learningMethodCompatibility.ts'

export type MethodCarrier =
  | 'classroom'
  | 'practice'
  | 'unit'
  | 'review'
  | 'center'
  | 'conversation'

/**
 * 评价证据类型：
 * - text-match：基于文本比对（拼写/差异/相似度）
 * - self-assess：学员自查或自评
 * - recording-text-match：录音转写后的文本匹配（当前非专业发音评分）
 * - ai-feedback：AI 生成的反馈（引用原话/教材，非客观掌握度）
 * - mixed：聚合入口，证据取决于所选具体方法
 */
export type MethodEvidence =
  | 'text-match'
  | 'self-assess'
  | 'recording-text-match'
  | 'ai-feedback'
  | 'mixed'

export interface LearningMethodDefinition {
  id: string
  label: string
  /** 一句话教学目标，入口卡片直接展示 */
  goal: string
  /** 什么时候选它；与相近方法的区分语 */
  whenToChoose: string
  /** 大致学习步骤 */
  steps: string[]
  /** 推荐内容形态（ContentShape 的字符串值）；null 表示不依赖单一内容形态。
   * 用字符串而非枚举引用，保证本文件可被 node strip-only 单测直接加载。 */
  recommendedShapes: string[] | null
  /** 当前真实支持的评价证据类型 */
  evidence: MethodEvidence
  /** 证据边界的人话说明，用于防误导 */
  evidenceNote: string
  /** 承载壳：方法由哪个页面/流程承载 */
  carrier: MethodCarrier
  /** 课时级方法的前置条件判断；入口级方法不提供 */
  available?: (lesson: Lesson) => boolean
  /** 课时级方法不可用时的解释 */
  unavailableReason?: (lesson: Lesson) => string
}

/** 课堂模式元信息（可用性规则来自 learningMethodCompatibility） */
const CLASSROOM_META: Record<
  'reader' | 'burn-sentence' | 'burn-word' | 'root',
  Pick<LearningMethodDefinition, 'goal' | 'whenToChoose' | 'steps' | 'evidence' | 'evidenceNote'>
> = {
  reader: {
    goal: '读懂短文或对话，在语境中理解句子',
    whenToChoose: '内容是完整短文、对话或句子，想先整体理解再逐句学习',
    steps: ['通读全文或对话', '逐句点读与查词', '结合翻译核对理解', '完成理解自查'],
    evidence: 'self-assess',
    evidenceNote: '理解由自查与播放反馈支持，页面不提供自动评分',
  },
  'burn-sentence': {
    goal: '把完整句子练到能主动复现',
    whenToChoose: '内容是完整句子，想通过遮蔽与逐级提示练句子结构',
    steps: ['听示范并理解句意', '逐步遮蔽关键片段', '主动复现整句', '对照反馈再练'],
    evidence: 'text-match',
    evidenceNote: '判定基于文本比对，答对文本不等于发音正确',
  },
  'burn-word': {
    goal: '记住单词或短语的拼写与词义',
    whenToChoose: '内容是单词或短语，想集中记忆与拼写',
    steps: ['看词形听发音', '查看释义与例句', '隐藏答案主动回忆', '拼写与语境练习'],
    evidence: 'text-match',
    evidenceNote: '判定基于拼写与文本比对',
  },
  root: {
    goal: '通过词根理解一组同根词',
    whenToChoose: '课时内至少两个单词共享真实词根或词根组',
    steps: ['认识词根含义', '看构词方式', '对比同根词', '完成辨析检测'],
    evidence: 'text-match',
    evidenceNote: '依赖课程内真实词根数据，不把拼写相似当成词根',
  },
}

const classroomMethods: LearningMethodDefinition[] = learningMethodRules.flatMap(rule => {
  const meta = CLASSROOM_META[rule.mode as keyof typeof CLASSROOM_META]
  if (!meta) return []
  return [{
    id: rule.mode,
    label: rule.label,
    ...meta,
    recommendedShapes: [...rule.recommendedFor],
    available: rule.available,
    unavailableReason: rule.unavailableReason,
    carrier: 'classroom' as const,
  }]
})

const hasSpeakableEnglish = (lesson: Lesson): boolean =>
  (lesson.items ?? []).some(item => Boolean(item.english?.trim()))

const hasBilingualPair = (lesson: Lesson): boolean =>
  (lesson.items ?? []).some(item => Boolean(item.english?.trim()) && Boolean(item.chinese?.trim()))

const practiceMethods: LearningMethodDefinition[] = [
  {
    id: 'dictation',
    label: '听写训练',
    goal: '听准并写出听到的内容',
    whenToChoose: '想训练听辨与拼写：先听音频，再写出所听内容',
    steps: ['播放音频', '输入听到的英文', '对照差异', '错项重听再练'],
    recommendedShapes: ['word', 'phrase', 'sentence'],
    evidence: 'text-match',
    evidenceNote: '答案比对是归一化文本差异，不是听力理解评分',
    carrier: 'practice',
    available: hasSpeakableEnglish,
    unavailableReason: lesson => (hasSpeakableEnglish(lesson) ? '' : '当前课时没有可播放的英文内容。'),
  },
  {
    id: 'follow',
    label: '跟读训练',
    goal: '逐句把内容练到能独立说出来',
    whenToChoose: '想按顺序过整段内容：每句听示范、录音、看转写对比后进入下一句；与模仿的区别是跟读重“说得出来”，模仿重“说得像”',
    steps: ['听老师示范', '跟读并录音', '查看转写与原文对比', '进入下一句'],
    recommendedShapes: ['phrase', 'sentence'],
    evidence: 'recording-text-match',
    evidenceNote: '当前评分为录音转写后的文本匹配，不是专业发音评分',
    carrier: 'practice',
    available: hasSpeakableEnglish,
    unavailableReason: lesson => (hasSpeakableEnglish(lesson) ? '' : '当前课时没有可朗读的英文内容。'),
  },
  {
    id: 'imitation',
    label: '模仿训练',
    goal: '让发音更接近示范音',
    whenToChoose: '想针对“像不像”做对照：听示范、录自己、回放比较后再提交；与跟读的区别是模仿逐句对照重录，不急于推进',
    steps: ['听标准音', '录自己的发音', '回放对照', '提交评价或重录'],
    recommendedShapes: ['phrase', 'sentence'],
    evidence: 'recording-text-match',
    evidenceNote: '当前评分为录音转写后的文本匹配，不是音素级发音评分',
    carrier: 'practice',
    available: hasSpeakableEnglish,
    unavailableReason: lesson => (hasSpeakableEnglish(lesson) ? '' : '当前课时没有可模仿的英文内容。'),
  },
  {
    id: 'translation',
    label: '翻译输出',
    goal: '看中文独立写出英文',
    whenToChoose: '想训练输出组织与表达，而不是听力或发音',
    steps: ['读中文提示', '独立写出英文', '对照参考答案与差异', '修改或进入下一题'],
    recommendedShapes: ['sentence', 'passage', 'dialog'],
    evidence: 'text-match',
    evidenceNote: '相似度只是文本相似，不自动代表语义完全正确',
    carrier: 'practice',
    available: hasBilingualPair,
    unavailableReason: lesson => (hasBilingualPair(lesson) ? '' : '当前课时缺少中英对照内容，无法提供翻译参考。'),
  },
]

const journeyMethods: LearningMethodDefinition[] = [
  {
    id: 'classic',
    label: '经典练习（旧版）',
    goal: '按旧版练习页流程逐项作答',
    whenToChoose: '需要旧版练习页的既定流程时',
    steps: ['选择模式', '逐项作答', '查看结果'],
    recommendedShapes: null,
    evidence: 'mixed',
    evidenceNote: '沿用旧版页面各自的结果口径',
    carrier: 'classroom',
  },
  {
    id: 'unit-self',
    label: '单元自主学习',
    goal: '按整个单元完成通读 → 重点句 → 重点词 → 语法 → 输出检查 → 总结',
    whenToChoose: '想系统性地过完一个单元的全部内容',
    steps: ['目标导入', '通读篇章或对话', '重点句与重点词', '语法讲解', '输出检查', '总结'],
    recommendedShapes: null,
    evidence: 'text-match',
    evidenceNote: '各阶段由作答与自查支持；跳过的阶段不计入完成',
    carrier: 'unit',
  },
  {
    id: 'unit-teacher',
    label: 'AI 老师带学',
    goal: '在 AI 老师一次一个问题的引导下完成单元学习',
    whenToChoose: '想要引导式讲解、即时反馈和重练机会',
    steps: ['建立或恢复会话', '老师讲解示范', '回答一个问题', '根据反馈重练或迁移'],
    recommendedShapes: null,
    evidence: 'ai-feedback',
    evidenceNote: 'AI 反馈引用教材与你的原话；不会自动更新掌握度',
    carrier: 'unit',
  },
  {
    id: 'spaced-review',
    label: '间隔复习',
    goal: '按到期队列主动回忆已学内容',
    whenToChoose: '首页或复习页提示有到期复习时',
    steps: ['先回忆再看答案', '作答或自评', '记录结果', '更新下次复习时间'],
    recommendedShapes: null,
    evidence: 'self-assess',
    evidenceNote: '复习调度基于真实作答记录；跳过不算掌握',
    carrier: 'review',
  },
  {
    id: 'error-retry',
    label: '错题复练',
    goal: '针对历史做错的题定向重练',
    whenToChoose: '想攻克之前做错的内容',
    steps: ['查看错因与原题', '再次作答', '对比正确答案', '复练或加入复习队列'],
    recommendedShapes: null,
    evidence: 'text-match',
    evidenceNote: '错题来自真实作答记录，无历史错误时不生成假题',
    carrier: 'review',
  },
  {
    id: 'adaptive-practice',
    label: '自适应推荐',
    goal: '按真实练习记录获得有理由的练习推荐',
    whenToChoose: '不确定练什么、想让系统给出下一步时',
    steps: ['查看推荐与理由', '确认进入对应方法', '完成练习', '按结果更新建议'],
    recommendedShapes: null,
    evidence: 'mixed',
    evidenceNote: '推荐理由来自真实学习记录；无证据时不声称薄弱项',
    carrier: 'center',
  },
  {
    id: 'quick-practice',
    label: '快速练习',
    goal: '选一个短任务立刻开始',
    whenToChoose: '时间有限，想完成一小段练习',
    steps: ['选择目标', '完成短任务', '查看结果', '退出或再练'],
    recommendedShapes: null,
    evidence: 'mixed',
    evidenceNote: '证据取决于所选的具体任务',
    carrier: 'center',
  },
  {
    id: 'ai-tutor',
    label: 'AI 英语教学对话',
    goal: '在对话中理解课程重点并完成练习',
    whenToChoose: '有课程相关疑问，或想在对话中被引导练习',
    steps: ['选择课程上下文', '提问或回答', '查看结构化反馈', '按下一步建议练习'],
    recommendedShapes: null,
    evidence: 'ai-feedback',
    evidenceNote: '反馈引用你的原话与教材；不代替系统掌握度记录',
    carrier: 'conversation',
  },
  {
    id: 'english-interview',
    label: '英语面试练习',
    goal: '练习面试回答的结构与具体例证',
    whenToChoose: '正在准备英文面试',
    steps: ['回答面试问题', '接收追问', '查看表达建议', '可加入学习计划跟进'],
    recommendedShapes: null,
    evidence: 'ai-feedback',
    evidenceNote: '反馈关注回答结构与清晰度，不构成招聘判断',
    carrier: 'conversation',
  },
]

/** 全部学习方法的单一权威目录 */
export const learningMethods: LearningMethodDefinition[] = [
  ...classroomMethods,
  ...practiceMethods,
  ...journeyMethods,
]

/** 课时级方法：可用性依赖具体课时数据 */
export const lessonScopedMethods: LearningMethodDefinition[] =
  learningMethods.filter(method => typeof method.available === 'function')

export function getLearningMethod(id: string): LearningMethodDefinition | undefined {
  return learningMethods.find(method => method.id === id)
}

/** 课时级方法是否可用；非课时级方法返回 undefined，调用方不得当作 false 使用 */
export function isLessonMethodAvailable(id: string, lesson: Lesson): boolean | undefined {
  const method = getLearningMethod(id)
  if (!method || typeof method.available !== 'function') return undefined
  return method.available(lesson)
}

export function getLessonMethodUnavailableReason(id: string, lesson: Lesson): string {
  const method = getLearningMethod(id)
  if (!method || typeof method.unavailableReason !== 'function') return ''
  return method.available && !method.available(lesson) ? method.unavailableReason(lesson) : ''
}

/** 当前课时可用的课时级方法 ID 列表（按注册表顺序） */
export function availableLessonMethodIds(lesson: Lesson): string[] {
  return lessonScopedMethods
    .filter(method => method.available!(lesson))
    .map(method => method.id)
}
