import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseNextLearningAction } from './nextLearningAction.ts'

const resumeTarget = { courseId: 'course-1', courseTitle: 'Everyday English', lessonId: 'lesson-2', lessonTitle: 'At the café' }
const planLesson = { courseId: 'course-2', courseTitle: 'Work English', lessonId: 'lesson-1', lessonTitle: 'Introduce yourself' }

test('prefers resuming an unfinished lesson over review and plan tasks', () => {
  const action = chooseNextLearningAction({ resumeTarget, hasDueReview: true, dueReviewCount: 12, nextPlanLesson: planLesson, planTitle: 'Interview preparation', hasDataWarnings: false })
  assert.equal(action.kind, 'resume')
  assert.equal(action.courseId, 'course-1')
  assert.equal(action.lessonId, 'lesson-2')
  assert.equal(action.ctaLabel, '继续学习')
})
test('recommends review before a planned lesson when review is due', () => {
  const action = chooseNextLearningAction({ resumeTarget: null, hasDueReview: true, dueReviewCount: 4, nextPlanLesson: planLesson, planTitle: 'Interview preparation', hasDataWarnings: false })
  assert.equal(action.kind, 'review')
  assert.match(action.description, /4 个单词/)
})
test('does not invent an exact review count when only the due state is known', () => {
  const action = chooseNextLearningAction({ resumeTarget: null, hasDueReview: true, dueReviewCount: null, nextPlanLesson: null, planTitle: null, hasDataWarnings: false })
  assert.equal(action.kind, 'review')
  assert.match(action.description, /有到期词汇/)
  assert.doesNotMatch(action.description, /\d+ 个单词/)
})
test('uses the next lesson from the active plan when no resume or review is available', () => {
  const action = chooseNextLearningAction({ resumeTarget: null, hasDueReview: false, dueReviewCount: 0, nextPlanLesson: planLesson, planTitle: 'Interview preparation', hasDataWarnings: false })
  assert.equal(action.kind, 'plan-lesson')
  assert.equal(action.courseId, 'course-2')
  assert.equal(action.lessonId, 'lesson-1')
})
test('does not claim there is no learning history when source data failed', () => {
  const action = chooseNextLearningAction({ resumeTarget: null, hasDueReview: null, dueReviewCount: null, nextPlanLesson: null, planTitle: null, hasDataWarnings: true })
  assert.equal(action.kind, 'browse-courses')
  assert.match(action.description, /不会把读取失败当成没有学习记录/)
})
test('offers a simple course entry when there are genuinely no next actions', () => {
  const action = chooseNextLearningAction({ resumeTarget: null, hasDueReview: false, dueReviewCount: 0, nextPlanLesson: null, planTitle: null, hasDataWarnings: false })
  assert.equal(action.kind, 'browse-courses')
  assert.equal(action.ctaLabel, '浏览英语课程')
})
