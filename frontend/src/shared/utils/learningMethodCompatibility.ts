/**
 * 学习方法兼容性注册表
 *
 * 统一管理课时内容形态与课堂方法的适配规则，供入口弹窗和课堂页共用。
 * 此处只判断现有数据是否满足方法前置条件，不隐式转换或改写课程内容。
 */
import { ContentShape, type Lesson } from '../types/course'
import type { ClassroomMode } from '../types/classroom'

export interface LearningMethodRule {
  mode: ClassroomMode
  label: string
  recommendedFor: ContentShape[]
  available: (lesson: Lesson) => boolean
  unavailableReason: (lesson: Lesson) => string
}

const hasItems = (lesson: Lesson): boolean => (lesson.items ?? []).some(item => Boolean(item.english?.trim()))
const hasMultiwordItems = (lesson: Lesson): boolean =>
  (lesson.items ?? []).some(item => (item.english ?? '').trim().split(/\s+/).filter(Boolean).length > 1)
const hasRootMetadata = (lesson: Lesson): boolean =>
  (lesson.items ?? []).some(item => Boolean(item.root?.trim() || item.rootGroupId?.trim()))

export const learningMethodRules: LearningMethodRule[] = [
  {
    mode: 'reader',
    label: '精读课堂',
    recommendedFor: [ContentShape.Passage, ContentShape.Dialog, ContentShape.Sentence],
    available: lesson => hasItems(lesson) && ![ContentShape.Word, ContentShape.Phrase].includes(lesson.contentShape),
    unavailableReason: lesson => [ContentShape.Word, ContentShape.Phrase].includes(lesson.contentShape)
      ? '当前是词汇内容，精读文章的阅读流程不适合直接套用；建议使用词燃尽。'
      : '当前课时没有可供精读的英文内容。',
  },
  {
    mode: 'burn-sentence',
    label: '句子燃尽',
    recommendedFor: [ContentShape.Sentence],
    available: lesson => hasItems(lesson) && hasMultiwordItems(lesson)
      && [ContentShape.Sentence, ContentShape.Passage, ContentShape.Dialog].includes(lesson.contentShape),
    unavailableReason: lesson => [ContentShape.Word, ContentShape.Phrase].includes(lesson.contentShape)
      ? '词汇内容不是完整句子，暂不能进行句子燃尽。'
      : '当前课时没有可供遮蔽和复现的完整句子。',
  },
  {
    mode: 'burn-word',
    label: '词燃尽',
    recommendedFor: [ContentShape.Word, ContentShape.Phrase],
    available: lesson => hasItems(lesson) && [ContentShape.Word, ContentShape.Phrase].includes(lesson.contentShape),
    unavailableReason: lesson => [ContentShape.Passage, ContentShape.Dialog, ContentShape.Sentence].includes(lesson.contentShape)
      ? '当前是句子/篇章内容。请先提取目标词并生成独立词汇课，再使用词燃尽。'
      : '当前课时没有可供拼写练习的词条。',
  },
  {
    mode: 'root',
    label: '词根课堂',
    recommendedFor: [ContentShape.Word],
    available: lesson => hasItems(lesson) && hasRootMetadata(lesson),
    unavailableReason: lesson => !hasItems(lesson)
      ? '当前课时没有可学习的词条。'
      : '当前词条没有标注词根或词根组；请先补充词根数据，避免按词性分组冒充词根学习。',
  },
]

export function isLearningMethodAvailable(lesson: Lesson, mode: ClassroomMode): boolean {
  if (mode === 'classic') return true
  return learningMethodRules.find(rule => rule.mode === mode)?.available(lesson) ?? false
}

export function getLearningMethodUnavailableReason(lesson: Lesson, mode: ClassroomMode): string {
  if (mode === 'classic') return ''
  const rule = learningMethodRules.find(item => item.mode === mode)
  return rule && !rule.available(lesson) ? rule.unavailableReason(lesson) : ''
}

export function recommendLearningMethod(lesson: Lesson): ClassroomMode {
  const preferred = lesson.contentShape === ContentShape.Word || lesson.contentShape === ContentShape.Phrase
    ? 'burn-word'
    : lesson.contentShape === ContentShape.Sentence
      ? 'burn-sentence'
      : 'reader'
  if (isLearningMethodAvailable(lesson, preferred)) return preferred
  return learningMethodRules.find(rule => rule.available(lesson))?.mode ?? 'classic'
}
