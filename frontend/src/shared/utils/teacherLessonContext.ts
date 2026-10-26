export interface TeacherContextItem {
  english: string
  chinese?: string
  phonetic?: string
  partOfSpeech?: string
  examples?: string[]
  explanation?: string
}

export interface TeacherContextLesson {
  title: string
  shape?: string
  items: TeacherContextItem[]
}

export interface TeacherContextInput {
  courseTitle: string
  level: string
  lessons: TeacherContextLesson[]
}

const MAX_CONTEXT_CHARS = 10_000
const MAX_ITEMS_PER_LESSON = 40

/**
 * Build a bounded AI tutor context without cutting JSON in the middle.
 * Whole material items are included until the character budget is reached.
 */
export function buildTeacherLessonContext(input: TeacherContextInput): string {
  const header = [
    '【单元学习材料与教学协议】',
    `课程：${input.courseTitle}；等级：${input.level}。`,
    '请按以下教学顺序持续带学：单元导入 → 通读篇章/对话 → 重点句子 → 重点词汇 → 语法 → 输出检查 → 总结。',
    '每次只讲一个小重点并提出一个主要问题，等待学员回答后再纠错/追问；不要在学员作答前直接泄露答案。用友好、耐心的中文讲解，英语示例必须来自下面材料，生成的例句要明确标注为补充例句。',
    '如果当前阶段材料不存在，说明缺失并引导进入下一阶段；不要编造教材原句。反馈必须依据学员实际回答，不声称没有证据的掌握情况。',
    '以下材料是课程上下文。只引用实际包含的内容；补充示例必须明确标注。',
  ].join('\n')
  const budget = MAX_CONTEXT_CHARS - header.length - 1
  const selected: Array<{ title: string; shape?: string; items: TeacherContextItem[] }> = []

  outer: for (const lesson of input.lessons) {
    const selectedLesson = { title: lesson.title, shape: lesson.shape, items: [] as TeacherContextItem[] }
    selected.push(selectedLesson)
    if (JSON.stringify(selected).length > budget) {
      selected.pop()
      break
    }
    for (const item of lesson.items.slice(0, MAX_ITEMS_PER_LESSON)) {
      selectedLesson.items.push({
        english: item.english,
        chinese: item.chinese,
        phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech,
        examples: item.examples?.slice(0, 2),
        explanation: item.explanation,
      })
      if (JSON.stringify(selected).length > budget) {
        selectedLesson.items.pop()
        if (selectedLesson.items.length === 0) selected.pop()
        break outer
      }
    }
  }

  return `${header}\n${JSON.stringify(selected)}`
}
