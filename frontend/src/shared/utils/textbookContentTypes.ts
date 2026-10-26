/**
 * 教材课程已有内容类型识别。
 *
 * 该规则会决定补充生成时哪些内容被跳过，因此必须保持纯函数、
 * 可独立测试；不能用宽泛的“课文/对话”匹配来推断句子内容。
 */
export type TextbookContentType = 'words' | 'sentences' | 'passage' | 'grammar' | 'phonics'

export interface LessonTitleLike {
  title?: string | null
}

/**
 * 根据生成器使用的显式标题标记推断已有内容类型。
 * 一个 lesson 标题只归属一种类型，多个 lesson 的结果按首次出现顺序去重。
 */
export function inferGeneratedContentTypes(
  lessons: readonly LessonTitleLike[] | null | undefined,
): TextbookContentType[] {
  if (!lessons?.length) return []

  const detected = new Set<TextbookContentType>()
  for (const lesson of lessons) {
    const title = String(lesson.title || '').trim()
    if (!title) continue

    // 具体语义优先于较宽泛的类型，避免同一标题被多类重复认领。
    if (/phonics|发音|音标/i.test(title)) {
      detected.add('phonics')
    } else if (/语法/i.test(title)) {
      detected.add('grammar')
    } else if (/短文|阅读|课文|篇章/i.test(title)) {
      detected.add('passage')
    } else if (/重点句|句子|句型/i.test(title)) {
      detected.add('sentences')
    } else if (/单词|词汇/i.test(title)) {
      detected.add('words')
    }
  }
  return [...detected]
}
