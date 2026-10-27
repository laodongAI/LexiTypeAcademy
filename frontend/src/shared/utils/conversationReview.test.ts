import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConversationReviewPrompt,
  buildReviewTranscript,
  parseConversationReview,
} from './conversationReview.ts'

test('prompt contains scenario label, full transcript and JSON contract', () => {
  const prompt = buildConversationReviewPrompt([
    { role: 'user', content: 'I go to school yesterday.' },
    { role: 'assistant', content: 'Almost! Use "went" for past tense.' },
  ], 'ai-tutor')
  assert.match(prompt, /AI 英语教学/)
  assert.match(prompt, /I go to school yesterday\./)
  assert.match(prompt, /Almost! Use "went"/)
  assert.match(prompt, /学员：/)
})

test('transcript keeps the most recent turns when the conversation is too long', () => {
  const turns = Array.from({ length: 200 }, (_, index) => ({
    role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `turn-${index}-${'x'.repeat(80)}`,
  }))
  const transcript = buildReviewTranscript(turns)
  assert.ok(transcript.length <= 8000)
  assert.ok(transcript.includes('turn-199-'))
  assert.ok(!transcript.includes('turn-0-'))
})

test('parses a valid review and caps oversized arrays', () => {
  const review = parseConversationReview(JSON.stringify({
    summary: '整体表达清楚，时态有一处小错误。',
    corrections: Array.from({ length: 6 }, (_, index) => ({
      original: `wrong-${index}`,
      suggestion: `right-${index}`,
      reason: '时态',
    })),
    expressions: Array.from({ length: 8 }, (_, index) => `phrase-${index}`),
    nextActions: Array.from({ length: 5 }, (_, index) => `action-${index}`),
  }))
  assert.ok(review)
  assert.equal(review.corrections.length, 3)
  assert.equal(review.expressions.length, 5)
  assert.equal(review.nextActions.length, 3)
  assert.equal(review.corrections[0].original, 'wrong-0')
})

test('parses fenced JSON and drops invalid correction entries', () => {
  const raw = [
    '```json',
    JSON.stringify({
      summary: '表达自然。',
      corrections: [
        { original: 'I am agree.', suggestion: 'I agree.', reason: 'agree 是动词' },
        { original: '', suggestion: '缺少原句，丢弃' },
        'not-an-object',
      ],
      expressions: ['', 'Good job!（夸奖）'],
      nextActions: 'should-be-array-but-string',
    }),
    '```',
  ].join('\n')
  const review = parseConversationReview(raw)
  assert.ok(review)
  assert.equal(review.corrections.length, 1)
  assert.deepEqual(review.corrections[0], { original: 'I am agree.', suggestion: 'I agree.', reason: 'agree 是动词' })
  assert.deepEqual(review.expressions, ['Good job!（夸奖）'])
  assert.deepEqual(review.nextActions, [])
})

test('returns null for unparseable or empty output instead of fabricating a review', () => {
  assert.equal(parseConversationReview(''), null)
  assert.equal(parseConversationReview('   '), null)
  assert.equal(parseConversationReview('抱歉，我无法复盘。'), null)
  assert.equal(parseConversationReview('{"summary": broken json'), null)
  assert.equal(parseConversationReview('[1,2,3]'), null)
})

test('an empty review is still parseable so the UI can show an honest empty state', () => {
  const review = parseConversationReview(JSON.stringify({ summary: '', corrections: [], expressions: [], nextActions: [] }))
  assert.ok(review)
  assert.equal(review.corrections.length, 0)
  assert.equal(review.expressions.length, 0)
  assert.equal(review.nextActions.length, 0)
})
