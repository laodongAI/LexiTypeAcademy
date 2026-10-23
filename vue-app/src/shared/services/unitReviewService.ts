/**
 * Unit 维度复习服务（消费 PracticeAttemptEvent -> 更新 unitMasteryItems）
 *
 * 目标：最小消费链路；不影响现有 UI。
 */

import type { PracticeMode } from '../types/course'
import type { PracticeAttemptEvent } from '../types/practiceAttemptEvent'
import type { UnitMastery, UnitReviewLog } from '../types/unitReview'
import { MasteryLevel } from '../types/review'
import { calculateSM2, createNewMastery } from './sm2Algorithm'
import { unitReviewRepository } from '../database/repositories/unitReviewRepository'
import { db, databaseReady } from '../database'

function qualityFromCorrectAndSimilarity(correct: boolean, similarity?: number): number {
  if (!correct) return 0
  if (typeof similarity === 'number') {
    if (similarity >= 0.95) return 5
    if (similarity >= 0.85) return 4
    return 3
  }
  return 4
}

function qualityFromCorrectAndOverall(correct: boolean, overall?: number): number {
  if (!correct) return 0
  if (typeof overall === 'number') {
    if (overall >= 90) return 5
    if (overall >= 80) return 4
    return 3
  }
  return 4
}

function deriveWeakDimensionsFromEvent(event: PracticeAttemptEvent): string[] | undefined {
  if (event.scoreDetail) {
    const weak: string[] = []
    const { accuracy, fluency, completeness, pronunciation } = event.scoreDetail

    if (accuracy < 75) weak.push('ACCURACY')
    if ((fluency ?? 100) < 75) weak.push('FLUENCY')
    if (completeness < 75) weak.push('COMPLETENESS')
    if (pronunciation < 75) weak.push('PRONUNCIATION')

    return weak.length ? weak : undefined
  }

  if (typeof event.similarity === 'number' && event.similarity < 0.8) {
    return ['SIMILARITY_LOW']
  }

  if (!event.correct) {
    return ['INCORRECT']
  }

  return undefined
}

function updateUnitMasteryWithSM2(mastery: UnitMastery, quality: number): UnitMastery {
  const sm2Result = calculateSM2({
    quality,
    interval: mastery.interval,
    consecutiveCorrect: mastery.consecutiveCorrect,
    easeFactor: mastery.easeFactor,
  })

  const now = Date.now()
  const nextReview = now + sm2Result.interval * 24 * 60 * 60 * 1000

  let newLevel = mastery.level
  if (quality >= 4) {
    if (sm2Result.consecutiveCorrect >= 3 && newLevel < MasteryLevel.Familiar) newLevel = MasteryLevel.Familiar
    if (sm2Result.consecutiveCorrect >= 6 && newLevel < MasteryLevel.Proficient) newLevel = MasteryLevel.Proficient
    if (sm2Result.consecutiveCorrect >= 10 && newLevel < MasteryLevel.Mastered) newLevel = MasteryLevel.Mastered
  } else if (quality < 3) {
    if (newLevel > MasteryLevel.Learning) newLevel = MasteryLevel.Learning
  } else if (mastery.level === MasteryLevel.New) {
    newLevel = MasteryLevel.Learning
  }

  return {
    ...mastery,
    level: newLevel,
    interval: sm2Result.interval,
    consecutiveCorrect: sm2Result.consecutiveCorrect,
    easeFactor: sm2Result.easeFactor,
    nextReview,
    lastReview: now,
    reviewCount: mastery.reviewCount + 1,
  }
}

function createNewUnitMastery(courseId: string, unitId: string, mode: PracticeMode, lessonId?: string): UnitMastery {
  const base = createNewMastery(unitId, courseId)
  return {
    courseId,
    unitId,
    mode,
    lessonId,
    level: base.level,
    nextReview: base.nextReview,
    interval: base.interval,
    reviewCount: base.reviewCount,
    consecutiveCorrect: base.consecutiveCorrect,
    lastReview: base.lastReview,
    createdAt: base.createdAt,
    easeFactor: base.easeFactor,
  }
}

async function computeRollingAccuracy(courseId: string, unitId: string, mode: PracticeMode, sampleSize: number = 5): Promise<number | undefined> {
  if (!databaseReady) return

  const all = await db.practiceAttemptEvents
    .where('courseId')
    .equals(courseId)
    .and(e => e.unitId === unitId && e.mode === mode)
    .toArray()

  all.sort((a, b) => b.createdAt - a.createdAt)
  const recent = all.slice(0, sampleSize)
  if (!recent.length) return
  const correctCount = recent.filter(e => e.correct).length
  return correctCount / recent.length
}

export class UnitReviewService {
  /**
   * 消费单条 PracticeAttemptEvent：更新 unitMasteryItems + 写入 unitReviewLogs
   */
  async consumePracticeAttemptEvent(event: PracticeAttemptEvent): Promise<void> {
    if (!databaseReady) return

    const quality = event.scoreDetail
      ? qualityFromCorrectAndOverall(event.correct, event.scoreDetail.overall)
      : qualityFromCorrectAndSimilarity(event.correct, event.similarity)

    const weakDimensions = deriveWeakDimensionsFromEvent(event)

    const existing = await unitReviewRepository.getUnitMastery(event.courseId, event.unitId, event.mode)
    const mastery = existing ?? createNewUnitMastery(event.courseId, event.unitId, event.mode, event.lessonId)

    const updated = updateUnitMasteryWithSM2(mastery, quality)

    // 滚动准确率（MVP）：取最近 N 次事件
    const rollingAccuracy = await computeRollingAccuracy(event.courseId, event.unitId, event.mode)

    const finalMastery: UnitMastery = {
      ...updated,
      lessonId: event.lessonId ?? updated.lessonId,
      rollingAccuracy,
      weakDimensions,
    }

    await unitReviewRepository.saveUnitMastery(finalMastery)

    const log: UnitReviewLog = {
      courseId: event.courseId,
      unitId: event.unitId,
      mode: event.mode,
      lessonId: event.lessonId,
      reviewDate: Date.now(),
      quality,
      correct: event.correct,
      level: finalMastery.level,
      weakDimensions,
      extra: {
        attemptCount: event.attemptCount,
        hintLevelAtSubmit: event.hintLevelAtSubmit,
        nextHintLevel: event.nextHintLevel,
        similarity: event.similarity,
        scoreDetail: event.scoreDetail,
      },
    }

    await unitReviewRepository.addUnitReviewLog(log)
  }

  async getDueUnits(limit: number = 20, courseId?: string) {
    return await unitReviewRepository.getDueUnits(limit, courseId)
  }
}

export const unitReviewService = new UnitReviewService()
