import assert from 'node:assert/strict'
import test from 'node:test'
import { inferGeneratedContentTypes } from './textbookContentTypes.ts'

test('识别生成器使用的五类明确标题标记', () => {
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 单词' }]), ['words'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 重点句' }]), ['sentences'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 句型' }]), ['sentences'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 短文' }]), ['passage'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 语法' }]), ['grammar'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 发音/Phonics' }]), ['phonics'])
})

test('“课文/对话”不应被误判为句子内容', () => {
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 课文' }]), ['passage'])
  assert.deepEqual(inferGeneratedContentTypes([{ title: 'Unit 1 - 对话' }]), [])
})

test('多个课时按首次出现顺序去重', () => {
  assert.deepEqual(inferGeneratedContentTypes([
    { title: 'Unit 1 - 单词' },
    { title: 'Unit 1 - 句子' },
    { title: 'Unit 1 - 单词补充' },
    { title: 'Unit 1 - 语法' },
    { title: 'Unit 1 - 发音' },
  ]), ['words', 'sentences', 'grammar', 'phonics'])
})

test('空集合、缺失标题和未知标题不产生虚假类型', () => {
  assert.deepEqual(inferGeneratedContentTypes(undefined), [])
  assert.deepEqual(inferGeneratedContentTypes(null), [])
  assert.deepEqual(inferGeneratedContentTypes([]), [])
  assert.deepEqual(inferGeneratedContentTypes([{ title: '   ' }, {}, { title: 'Unit 1 - 自定义练习' }]), [])
})

test('具体的发音标记优先于标题中的其他宽泛标记', () => {
  assert.deepEqual(inferGeneratedContentTypes([{ title: '课文发音/Phonics' }]), ['phonics'])
})
