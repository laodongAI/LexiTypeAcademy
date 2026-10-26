import assert from 'node:assert/strict'
import test from 'node:test'
import { parseTeacherLessonContent } from './teacherLessonPresentation.ts'

test('parses a structured tutor reply into teaching sections in message order', () => {
  const sections = parseTeacherLessonContent([
    '【教学状态】提问',
    '【本步目标】学习日常习惯表达',
    '【老师讲解】usually 表示通常。',
    '【请你回答】What do you usually do after dinner?',
  ].join('\n'))
  assert.deepEqual(sections.map(section => section.key), ['status', 'goal', 'explanation', 'question'])
  assert.equal(sections[3].content, 'What do you usually do after dinner?')
})

test('keeps legacy unstructured assistant messages readable', () => {
  assert.deepEqual(parseTeacherLessonContent('  Let us practise one sentence.  '), [
    { key: 'explanation', label: '老师讲解', content: 'Let us practise one sentence.' },
  ])
})

test('ignores empty tagged sections and whitespace-only messages', () => {
  assert.deepEqual(parseTeacherLessonContent('【本步目标】\n【老师讲解】Start here.'), [
    { key: 'explanation', label: '老师讲解', content: 'Start here.' },
  ])
  assert.deepEqual(parseTeacherLessonContent('   '), [])
})
