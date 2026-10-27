import assert from 'node:assert/strict'
import test from 'node:test'
import type { Lesson } from '../types/course.ts'
import {
  availableLessonMethodIds,
  getLearningMethod,
  getLessonMethodUnavailableReason,
  isLessonMethodAvailable,
  learningMethods,
  lessonScopedMethods,
} from './learningMethodRegistry.ts'

// 注意：测试不导入 ContentShape 枚举——node strip-only 模式不支持 enum 运行时值。
// Lesson 的 contentShape 是枚举，测试里直接写对应字符串值并整体断言。
function makeLesson(overrides: Record<string, unknown> = {}): Lesson {
  return {
    id: 'lesson-1',
    courseId: 'course-1',
    title: '测试课时',
    contentShape: 'sentence',
    items: [{ id: 'item-1', english: 'I usually walk to work.', chinese: '我通常步行上班。' }],
    ...overrides,
  } as unknown as Lesson
}

test('registry covers classroom, practice and journey methods with distinct ids', () => {
  const ids = learningMethods.map(method => method.id)
  assert.equal(new Set(ids).size, ids.length)
  for (const required of ['reader', 'burn-word', 'burn-sentence', 'root', 'dictation', 'follow', 'imitation', 'translation', 'classic', 'unit-self', 'unit-teacher', 'spaced-review', 'error-retry']) {
    assert.ok(ids.includes(required), `missing method: ${required}`)
  }
})

test('every method declares goal, steps, evidence and an honest evidence note', () => {
  for (const method of learningMethods) {
    assert.ok(method.label.length > 0, `${method.id} missing label`)
    assert.ok(method.goal.length > 0, `${method.id} missing goal`)
    assert.ok(method.steps.length > 0, `${method.id} missing steps`)
    assert.ok(method.evidenceNote.length > 0, `${method.id} missing evidenceNote`)
    assert.ok(method.whenToChoose.length > 0, `${method.id} missing whenToChoose`)
  }
})

test('follow and imitation are separated by intent, not just label', () => {
  const follow = getLearningMethod('follow')
  const imitation = getLearningMethod('imitation')
  assert.ok(follow && imitation)
  assert.notEqual(follow.whenToChoose, imitation.whenToChoose)
  assert.match(follow.whenToChoose, /模仿/)
  assert.match(imitation.whenToChoose, /跟读/)
  // 证据边界必须如实：当前都是录音转写文本匹配，不是专业发音评分
  assert.equal(follow.evidence, 'recording-text-match')
  assert.equal(imitation.evidence, 'recording-text-match')
  assert.match(follow.evidenceNote, /不是专业发音评分/)
  assert.match(imitation.evidenceNote, /不是音素级发音评分/)
})

test('classroom availability delegates to the compatibility rules', () => {
  const wordLesson = makeLesson({ contentShape: 'word', items: [{ id: 'w1', english: 'spect' }] })
  assert.equal(isLessonMethodAvailable('burn-word', wordLesson), true)
  assert.equal(isLessonMethodAvailable('reader', wordLesson), false)
  const passageLesson = makeLesson({ contentShape: 'passage', items: [{ id: 'p1', english: 'A long story. Another sentence.' }] })
  assert.equal(isLessonMethodAvailable('reader', passageLesson), true)
  assert.equal(isLessonMethodAvailable('burn-word', passageLesson), false)
  assert.match(getLessonMethodUnavailableReason('burn-word', passageLesson) || '', /句子\/篇章|词汇课/)
})

test('practice method availability depends on lesson data', () => {
  const emptyLesson = makeLesson({ items: [] })
  assert.equal(isLessonMethodAvailable('dictation', emptyLesson), false)
  assert.ok(getLessonMethodUnavailableReason('dictation', emptyLesson).length > 0)
  const noChinese = makeLesson({ items: [{ id: 'e1', english: 'hello' }] })
  assert.equal(isLessonMethodAvailable('translation', noChinese), false)
  const bilingual = makeLesson({ items: [{ id: 'b1', english: 'hello', chinese: '你好' }] })
  assert.equal(isLessonMethodAvailable('translation', bilingual), true)
  assert.equal(isLessonMethodAvailable('follow', noChinese), true)
})

test('availableLessonMethodIds returns only available lesson-scoped methods', () => {
  const sentenceLesson = makeLesson()
  const ids = availableLessonMethodIds(sentenceLesson)
  assert.ok(ids.includes('reader'))
  assert.ok(ids.includes('burn-sentence'))
  assert.ok(ids.includes('dictation'))
  assert.ok(ids.includes('follow'))
  assert.ok(!ids.includes('burn-word'))
})

test('non lesson-scoped methods do not provide availability', () => {
  for (const method of lessonScopedMethods) {
    assert.equal(typeof method.available, 'function')
  }
  assert.equal(isLessonMethodAvailable('unit-self', makeLesson()), undefined)
  assert.equal(getLessonMethodUnavailableReason('unit-self', makeLesson()), '')
})
