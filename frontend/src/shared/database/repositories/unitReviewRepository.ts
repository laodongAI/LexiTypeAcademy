/**
 * Unit 维度复习仓库（unitId + mode）
 */

import { db, databaseReady } from '../index'
import type { DueUnit, UnitMastery, UnitReviewLog } from '../../types/unitReview'

export class UnitReviewRepository {
  async getUnitMastery(courseId: string, unitId: string, mode: string): Promise<UnitMastery | undefined> {
    if (!databaseReady) return
    return await db.unitMasteryItems.get([courseId, unitId, mode])
  }

  async saveUnitMastery(mastery: UnitMastery): Promise<void> {
    if (!databaseReady) return
    await db.unitMasteryItems.put(mastery)
  }

  async addUnitReviewLog(log: UnitReviewLog): Promise<number | undefined> {
    if (!databaseReady) return
    return await db.unitReviewLogs.add(log)
  }

  async getDueUnits(limit: number = 20, courseId?: string): Promise<DueUnit[]> {
    if (!databaseReady) return []
    const now = Date.now()

    if (courseId) {
      const all = await db.unitMasteryItems.where('courseId').equals(courseId).toArray()
      return all
        .filter(m => m.nextReview <= now)
        .sort((a, b) => a.nextReview - b.nextReview)
        .slice(0, limit)
        .map(m => ({
          courseId: m.courseId,
          unitId: m.unitId,
          mode: m.mode,
          lessonId: m.lessonId,
          level: m.level,
          nextReview: m.nextReview,
          reviewCount: m.reviewCount,
        }))
    }

    const all = await db.unitMasteryItems.toArray()
    return all
      .filter(m => m.nextReview <= now)
      .sort((a, b) => a.nextReview - b.nextReview)
      .slice(0, limit)
      .map(m => ({
        courseId: m.courseId,
        unitId: m.unitId,
        mode: m.mode,
        lessonId: m.lessonId,
        level: m.level,
        nextReview: m.nextReview,
        reviewCount: m.reviewCount,
      }))
  }
}

export const unitReviewRepository = new UnitReviewRepository()
