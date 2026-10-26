import assert from 'node:assert/strict'
import test from 'node:test'
import { resolvePlayingIndex } from './readerSpeechSync.ts'

const sentenceKeys = ['item-1-s0', 'item-1-s1', 'item-2-s0']
const itemKeys = ['item-1', 'item-2', 'item-3']

test('maps the active sentence key to the sentence rendered index', () => {
  assert.equal(resolvePlayingIndex('item-1-s1', sentenceKeys, itemKeys, false), 1)
  assert.equal(resolvePlayingIndex('item-2-s0', sentenceKeys, itemKeys, false), 2)
})

test('maps the active word key to the word tile index', () => {
  assert.equal(resolvePlayingIndex('item-2', sentenceKeys, itemKeys, true), 1)
})

test('does not resolve a missing, cleared, or unrelated speech key', () => {
  assert.equal(resolvePlayingIndex(null, sentenceKeys, itemKeys, false), -1)
  assert.equal(resolvePlayingIndex('', sentenceKeys, itemKeys, false), -1)
  assert.equal(resolvePlayingIndex('word:hello', sentenceKeys, itemKeys, false), -1)
  assert.equal(resolvePlayingIndex('item-1-s0', sentenceKeys, itemKeys, true), -1)
})
