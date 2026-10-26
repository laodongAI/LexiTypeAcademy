import assert from 'node:assert/strict'
import test from 'node:test'
import { buildTeacherLessonContext } from './teacherLessonContext.ts'

test('includes lesson materials as valid JSON and teaching constraints', () => {
  const context = buildTeacherLessonContext({
    courseTitle: 'Daily routines',
    level: 'A2',
    lessons: [{ title: 'Main dialogue', shape: 'dialogue', items: [
      { english: 'I usually walk to work.', chinese: '我通常步行上班。', examples: ['I usually read at night.'] },
    ] }],
  })
  const materials = JSON.parse(context.slice(context.lastIndexOf('\n') + 1))
  assert.equal(materials[0].items[0].english, 'I usually walk to work.')
  assert.match(context, /不要编造教材原句/)
})

test('keeps context within the budget without truncating a material JSON value', () => {
  const context = buildTeacherLessonContext({
    courseTitle: 'Long course',
    level: 'B1',
    lessons: Array.from({ length: 20 }, (_, index) => ({
      title: `Lesson ${index}`,
      shape: 'vocabulary',
      items: Array.from({ length: 40 }, (_, itemIndex) => ({
        english: `word-${index}-${itemIndex}-${'x'.repeat(120)}`,
        chinese: '测试释义',
        explanation: '课程说明',
      })),
    })),
  })
  assert.ok(context.length <= 10_000)
  const materials = JSON.parse(context.slice(context.lastIndexOf('\n') + 1))
  assert.ok(materials.length > 0)
  assert.ok(materials.every((lesson: { items: unknown[] }) => Array.isArray(lesson.items)))
})
