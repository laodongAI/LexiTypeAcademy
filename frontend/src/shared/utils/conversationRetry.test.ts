import assert from 'node:assert/strict'
import test from 'node:test'
import { findRetryablePendingMessage } from './conversationRetry.ts'

const original = { id: 'message-1', role: 'user' as const, content: 'I enjoy reading.' }
const assistant = { id: 'message-2', role: 'assistant' as const, content: 'Why do you enjoy it?' }

test('reuses the persisted tail user message for the same retry text', () => {
  assert.equal(findRetryablePendingMessage([assistant, original], 'I enjoy reading.'), original)
})

test('does not reuse an older user message when the latest message is from the assistant', () => {
  assert.equal(findRetryablePendingMessage([original, assistant], 'I enjoy reading.'), undefined)
})

test('does not reuse a pending message for different text or an empty history', () => {
  assert.equal(findRetryablePendingMessage([original], 'I like reading.'), undefined)
  assert.equal(findRetryablePendingMessage([], 'I enjoy reading.'), undefined)
})
