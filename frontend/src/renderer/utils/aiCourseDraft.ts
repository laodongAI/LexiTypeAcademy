import { ContentShape, type Course, type Lesson, type LessonItem } from '../../shared/types/course'
import type { CourseGenerationResponse, WordEntry } from '../../shared/services/ai'
import { createStableId } from '../../shared/utils/hash'

export type CourseDraft = Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lessonCount'>

export function courseDraftFromGenerationResponse(
  result: CourseGenerationResponse,
  context: { title?: string; difficulty?: 'beginner' | 'intermediate' | 'advanced'; tags?: string[] } = {}
): CourseDraft {
  const difficulty = context.difficulty || 'intermediate'
  const courseTitle = context.title || result.courseName || 'AI 生成课程'

  const lessons: Lesson[] = (result.lessons || []).map((lesson, lessonIndex) => {
    const lessonKey = String(lesson.lessonName || `Lesson_${lessonIndex + 1}`)
    const lessonId = createStableId('ai_lesson', courseTitle, lessonIndex, lessonKey)

    const items: LessonItem[] = (lesson.words || []).reduce<LessonItem[]>((acc, word: WordEntry, wordIndex: number) => {
      const english = String(word.word || '').trim()
      if (!english) return acc

      const itemId = createStableId('ai_item', lessonId, wordIndex, english)
      const item: LessonItem = {
        id: itemId,
        english,
        chinese: String(word.translation || word.meaning || '').trim(),
        phonetic: word.phonetic,
        partOfSpeech: word.partOfSpeech,
        examples: word.example ? [String(word.example)] : undefined,
      }

      acc.push(item)
      return acc
    }, [])

    return {
      id: lessonId,
      title: lesson.lessonName || `Lesson ${lessonIndex + 1}`,
      description: lesson.description || '',
      contentShape: ContentShape.Word,
      items,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
  })

  return {
    title: courseTitle,
    description: result.description || 'AI 生成课程',
    category: 'special',
    difficulty,
    lessons,
    tags: (context.tags || []).filter(Boolean),
  }
}

export function courseDraftFromWordEntries(
  words: WordEntry[],
  context: { title: string; description?: string; difficulty?: 'beginner' | 'intermediate' | 'advanced'; lessonTitle?: string; tags?: string[] }
): CourseDraft {
  const difficulty = context.difficulty || 'intermediate'

  const normalized = (words || [])
    .map((w) => ({
      word: String(w.word || '').trim(),
      translation: String(w.translation || w.meaning || '').trim(),
      phonetic: w.phonetic,
      partOfSpeech: w.partOfSpeech,
      example: w.example,
    }))
    .filter((w) => !!w.word)

  const lessonTitle = context.lessonTitle || '词汇课'
  const lessonId = createStableId('ai_lesson', context.title, 0, lessonTitle)
  const items: LessonItem[] = normalized.map((w, idx) => ({
    id: createStableId('ai_item', lessonId, idx, w.word),
    english: w.word,
    chinese: w.translation,
    phonetic: w.phonetic,
    partOfSpeech: w.partOfSpeech,
    examples: w.example ? [String(w.example)] : undefined,
  }))

  const lessons: Lesson[] = [
    {
      id: lessonId,
      title: lessonTitle,
      description: '',
      contentShape: ContentShape.Word,
      items,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ]

  return {
    title: context.title,
    description: context.description || '',
    category: 'special',
    difficulty,
    lessons,
    tags: (context.tags || []).filter(Boolean),
  }
}
