export type TeacherLessonSectionKey = 'status' | 'goal' | 'explanation' | 'question' | 'feedback' | 'nextStep'

export interface TeacherLessonSection {
  key: TeacherLessonSectionKey
  label: string
  content: string
}

const HEADINGS: Array<{ token: string; key: TeacherLessonSectionKey; label: string }> = [
  { token: '【教学状态】', key: 'status', label: '课堂状态' },
  { token: '【本步目标】', key: 'goal', label: '本步目标' },
  { token: '【老师讲解】', key: 'explanation', label: '老师讲解' },
  { token: '【请你回答】', key: 'question', label: '轮到你了' },
  { token: '【反馈与纠错】', key: 'feedback', label: '反馈与纠错' },
  { token: '【下一步】', key: 'nextStep', label: '下一步' },
]

/** Parse the optional classroom protocol; preserve legacy free-text replies as a single explanation. */
export function parseTeacherLessonContent(content: string): TeacherLessonSection[] {
  const positions = HEADINGS
    .map(heading => ({ ...heading, index: content.indexOf(heading.token) }))
    .filter(heading => heading.index >= 0)
    .sort((a, b) => a.index - b.index)

  if (positions.length === 0) {
    const text = content.trim()
    return text ? [{ key: 'explanation', label: '老师讲解', content: text }] : []
  }

  const sections: TeacherLessonSection[] = []
  for (let index = 0; index < positions.length; index += 1) {
    const current = positions[index]
    const start = current.index + current.token.length
    const end = index + 1 < positions.length ? positions[index + 1].index : content.length
    const value = content.slice(start, end).trim()
    if (value) sections.push({ key: current.key, label: current.label, content: value })
  }
  return sections
}
