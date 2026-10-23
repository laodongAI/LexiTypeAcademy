/**
 * 语言学习能力聚合根
 * 
 * 职责：追踪学生在听力、口语、词汇等维度的掌握程度
 * 不变量：
 *   - 所有维度的级别必须在 A1-C2 之间
 *   - 听力级别 >= 口语级别
 *   - 掌握词汇数 >= 该级别下限
 * 
 * 设计文档：5.3 语言学习能力建模
 */

import { Difficulty, Accuracy } from '../../shared/value-objects';
import { DomainEvent } from '../events/DomainEvent';

/**
 * 词汇掌握情况值对象
 */
export class VocabularyMastery {
  private masteredWords: Set<string>;
  private targetCount: number;
  private level: Difficulty;

  private constructor(masteredWords: Set<string>, targetCount: number) {
    this.masteredWords = masteredWords;
    this.targetCount = targetCount;
    this.level = this.calculateLevel();
  }

  static create(): VocabularyMastery {
    return new VocabularyMastery(new Set(), 500);
  }

  static restore(masteredWords: string[], targetCount: number): VocabularyMastery {
    return new VocabularyMastery(new Set(masteredWords), targetCount);
  }

  // ===== 业务方法 =====

  addWord(word: string): void {
    this.masteredWords.add(word);
    this.level = this.calculateLevel();
  }

  hasWord(word: string): boolean {
    return this.masteredWords.has(word);
  }

  getMasteredCount(): number {
    return this.masteredWords.size;
  }

  getTargetCount(): number {
    return this.targetCount;
  }

  getMasteryPercentage(): number {
    return Math.min(100, (this.getMasteredCount() / this.targetCount) * 100);
  }

  getLevel(): Difficulty {
    return this.level;
  }

  // ===== 私有方法 =====

  private calculateLevel(): Difficulty {
    const percentage = this.getMasteryPercentage();
    const levelString = percentage > 90
      ? 'C2'
      : percentage > 80
        ? 'C1'
        : percentage > 70
          ? 'B2'
          : percentage > 60
            ? 'B1'
            : percentage > 50
              ? 'A2'
              : 'A1';
    return Difficulty.create(levelString);
  }

  toJSON() {
    return {
      masteredWords: Array.from(this.masteredWords),
      targetCount: this.targetCount,
      level: this.level.toString()
    };
  }
}

/**
 * 学习趋势数据值对象
 */
export class LearningMetrics {
  private averageAccuracy: number;
  private totalPracticeDays: number;
  private completedCoursesCount: number;
  private lastPracticeDate: Date | null;

  private constructor(
    averageAccuracy: number,
    totalPracticeDays: number,
    completedCoursesCount: number,
    lastPracticeDate: Date | null
  ) {
    this.averageAccuracy = averageAccuracy;
    this.totalPracticeDays = totalPracticeDays;
    this.completedCoursesCount = completedCoursesCount;
    this.lastPracticeDate = lastPracticeDate;
  }

  static create(): LearningMetrics {
    return new LearningMetrics(0, 0, 0, null);
  }

  static restore(data: {
    averageAccuracy: number;
    totalPracticeDays: number;
    completedCoursesCount: number;
    lastPracticeDate: string | null;
  }): LearningMetrics {
    return new LearningMetrics(
      data.averageAccuracy,
      data.totalPracticeDays,
      data.completedCoursesCount,
      data.lastPracticeDate ? new Date(data.lastPracticeDate) : null
    );
  }

  getAverageAccuracy(): number {
    return this.averageAccuracy;
  }

  getTotalPracticeDays(): number {
    return this.totalPracticeDays;
  }

  getCompletedCoursesCount(): number {
    return this.completedCoursesCount;
  }

  getLastPracticeDate(): Date | null {
    return this.lastPracticeDate;
  }

  updateAfterPractice(newAccuracy: number): void {
    // 移动平均：保留最近 20 次的平均值
    const count = 20;
    this.averageAccuracy = (this.averageAccuracy * (count - 1) + newAccuracy) / count;
    this.lastPracticeDate = new Date();
  }

  incrementPracticeDays(): void {
    this.totalPracticeDays++;
  }

  incrementCompletedCourses(): void {
    this.completedCoursesCount++;
  }

  toJSON() {
    return {
      averageAccuracy: this.averageAccuracy,
      totalPracticeDays: this.totalPracticeDays,
      completedCoursesCount: this.completedCoursesCount,
      lastPracticeDate: this.lastPracticeDate?.toISOString() || null
    };
  }
}

/**
 * 语言学习能力聚合根
 * 
 * 追踪学生在听力、口语、词汇等维度的掌握程度
 */
export class LanguageAbilityAggregate {
  private userId: string;
  private currentDifficulty: Difficulty;
  private listeningLevel: Difficulty;
  private speakingLevel: Difficulty;
  private vocabularyMastery: VocabularyMastery;
  private metrics: LearningMetrics;
  private completedCourses: Set<string>;
  private createdAt: Date;
  private lastUpdatedAt: Date;
  private domainEvents: DomainEvent[] = [];

  private constructor() {
    this.userId = '';
    this.currentDifficulty = Difficulty.create('A1');
    this.listeningLevel = Difficulty.create('A1');
    this.speakingLevel = Difficulty.create('A1');
    this.vocabularyMastery = VocabularyMastery.create();
    this.metrics = LearningMetrics.create();
    this.completedCourses = new Set();
    this.createdAt = new Date();
    this.lastUpdatedAt = new Date();
  }

  static create(userId: string): LanguageAbilityAggregate {
    const ability = new LanguageAbilityAggregate();
    ability.userId = userId;
    return ability;
  }

  static restore(data: {
    userId: string;
    currentDifficulty: string;
    listeningLevel: string;
    speakingLevel: string;
    vocabularyMastery: {
      masteredWords: string[];
      targetCount: number;
    };
    metrics: {
      averageAccuracy: number;
      totalPracticeDays: number;
      completedCoursesCount: number;
      lastPracticeDate: string | null;
    };
    completedCourses: string[];
    createdAt: string;
    lastUpdatedAt: string;
  }): LanguageAbilityAggregate {
    const ability = new LanguageAbilityAggregate();
    ability.userId = data.userId;
    ability.currentDifficulty = Difficulty.create(data.currentDifficulty);
    ability.listeningLevel = Difficulty.create(data.listeningLevel);
    ability.speakingLevel = Difficulty.create(data.speakingLevel);
    ability.vocabularyMastery = VocabularyMastery.restore(
      data.vocabularyMastery.masteredWords,
      data.vocabularyMastery.targetCount
    );
    ability.metrics = LearningMetrics.restore(data.metrics);
    ability.completedCourses = new Set(data.completedCourses);
    ability.createdAt = new Date(data.createdAt);
    ability.lastUpdatedAt = new Date(data.lastUpdatedAt);
    return ability;
  }

  // ===== 业务方法 =====

  /**
   * 更新学习记录后，聚合该课程/课时的统计数据
   */
  updateFromLessonPractice(
    accuracy: Accuracy,
    completedCourseId?: string
  ): void {
    const before = {
      listening: this.listeningLevel,
      speaking: this.speakingLevel,
      vocabulary: this.vocabularyMastery.getLevel()
    };

    // 更新维度级别
    this.listeningLevel = this.calculateListeningLevel(accuracy);
    this.speakingLevel = this.calculateSpeakingLevel(accuracy);

    // 添加掌握的词汇（示例）
    // 实际应该从 accuracy 对象中提取词汇信息

    // 更新学习指标
    this.metrics.updateAfterPractice(accuracy.getOverallScore());

    // 标记课程为已完成
    if (completedCourseId) {
      this.completedCourses.add(completedCourseId);
      this.metrics.incrementCompletedCourses();
    }

    // 计算新的全局难度
    const newDifficulty = this.calculateOverallDifficulty();

    // 检查是否需要自动调整难度
    const difficultyChange = this.checkDifficultyAdjustment(before, {
      listening: this.listeningLevel,
      speaking: this.speakingLevel,
      vocabulary: this.vocabularyMastery.getLevel()
    });

    if (difficultyChange === 'increase') {
      this.increaseDifficulty('consecutive_pass');
    } else if (difficultyChange === 'decrease') {
      this.decreaseDifficulty('low_accuracy');
    }

    this.lastUpdatedAt = new Date();
  }

  /**
   * 推荐下一个课程的难度
   */
  recommendNextCourseDifficulty(): Difficulty {
    const accuracy = this.metrics.getAverageAccuracy();

    // 规则 1: 若平均准确率 > 85%，建议提升难度
    if (accuracy > 85) {
      return this.getNextHigherDifficulty();
    }

    // 规则 2: 若平均准确率 < 70%，建议降低难度
    if (accuracy < 70) {
      return this.getNextLowerDifficulty();
    }

    // 规则 3: 默认推荐当前难度
    return this.currentDifficulty;
  }

  /**
   * 获取学生的学习进度报告
   */
  getProgressReport() {
    return {
      userId: this.userId,
      currentDifficulty: this.currentDifficulty.toString(),
      listeningLevel: this.listeningLevel.toString(),
      speakingLevel: this.speakingLevel.toString(),
      vocabularyMastered: this.vocabularyMastery.getMasteredCount(),
      vocabularyTarget: this.vocabularyMastery.getTargetCount(),
      vocabularyMasteryPercentage: this.vocabularyMastery.getMasteryPercentage(),
      completedCoursesCount: this.metrics.getCompletedCoursesCount(),
      totalPracticeDays: this.metrics.getTotalPracticeDays(),
      averageAccuracy: this.metrics.getAverageAccuracy(),
      lastPracticeDate: this.metrics.getLastPracticeDate()
    };
  }

  // ===== 访问器 =====

  getUserId(): string {
    return this.userId;
  }

  getCurrentDifficulty(): Difficulty {
    return this.currentDifficulty;
  }

  getListeningLevel(): Difficulty {
    return this.listeningLevel;
  }

  getSpeakingLevel(): Difficulty {
    return this.speakingLevel;
  }

  getVocabularyMastery(): VocabularyMastery {
    return this.vocabularyMastery;
  }

  getMetrics(): LearningMetrics {
    return this.metrics;
  }

  getCreatedAt(): Date {
    return this.createdAt;
  }

  getLastUpdatedAt(): Date {
    return this.lastUpdatedAt;
  }

  // ===== 事件管理 =====

  getDomainEvents(): DomainEvent[] {
    return this.domainEvents;
  }

  clearDomainEvents(): void {
    this.domainEvents = [];
  }

  private recordDomainEvent(event: DomainEvent): void {
    this.domainEvents.push(event);
  }

  // ===== 私有辅助方法 =====

  private calculateListeningLevel(accuracy: Accuracy): Difficulty {
    const phonemeAccuracy = accuracy.getPhonemeAccuracy();
    const level = phonemeAccuracy > 90
      ? 'C2'
      : phonemeAccuracy > 80
        ? 'C1'
        : phonemeAccuracy > 70
          ? 'B2'
          : phonemeAccuracy > 60
            ? 'B1'
            : phonemeAccuracy > 50
              ? 'A2'
              : 'A1';
    return Difficulty.create(level);
  }

  private calculateSpeakingLevel(accuracy: Accuracy): Difficulty {
    const fluency = accuracy.getFluency();
    const level = fluency > 90
      ? 'C2'
      : fluency > 80
        ? 'C1'
        : fluency > 70
          ? 'B2'
          : fluency > 60
            ? 'B1'
            : fluency > 50
              ? 'A2'
              : 'A1';
    return Difficulty.create(level);
  }

  private calculateOverallDifficulty(): Difficulty {
    // 不变量：全局难度 = min(听力, 口语, 词汇)
    const listeningNum = this.listeningLevel.getNumericLevel();
    const speakingNum = this.speakingLevel.getNumericLevel();
    const vocabNum = this.vocabularyMastery.getLevel().getNumericLevel();

    const minNum = Math.min(listeningNum, speakingNum, vocabNum);
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[minNum - 1]);
  }

  private checkDifficultyAdjustment(
    before: Record<string, Difficulty>,
    after: Record<string, Difficulty>
  ): 'increase' | 'decrease' | null {
    const beforeNum = Math.min(
      before.listening.getNumericLevel(),
      before.speaking.getNumericLevel(),
      before.vocabulary.getNumericLevel()
    );

    const afterNum = Math.min(
      after.listening.getNumericLevel(),
      after.speaking.getNumericLevel(),
      after.vocabulary.getNumericLevel()
    );

    if (afterNum > beforeNum) return 'increase';
    if (afterNum < beforeNum) return 'decrease';
    return null;
  }

  private increaseDifficulty(reason: 'consecutive_pass' | 'high_accuracy'): void {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum >= 6) {
      // 已达最高级别
      return;
    }

    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const newLevel = levelMap[currentNum];
    this.currentDifficulty = Difficulty.create(newLevel);
  }

  private decreaseDifficulty(reason: 'consecutive_fail' | 'low_accuracy'): void {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum <= 1) {
      // 已达最低级别
      return;
    }

    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const newLevel = levelMap[currentNum - 2];
    this.currentDifficulty = Difficulty.create(newLevel);
  }

  private getNextHigherDifficulty(): Difficulty {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum >= 6) return this.currentDifficulty;
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[currentNum]);
  }

  private getNextLowerDifficulty(): Difficulty {
    const currentNum = this.currentDifficulty.getNumericLevel();
    if (currentNum <= 1) return this.currentDifficulty;
    const levelMap = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    return Difficulty.create(levelMap[currentNum - 2]);
  }

  // ===== 序列化 =====

  toJSON() {
    return {
      userId: this.userId,
      currentDifficulty: this.currentDifficulty.toString(),
      listeningLevel: this.listeningLevel.toString(),
      speakingLevel: this.speakingLevel.toString(),
      vocabularyMastery: this.vocabularyMastery.toJSON(),
      metrics: this.metrics.toJSON(),
      completedCourses: Array.from(this.completedCourses),
      createdAt: this.createdAt.toISOString(),
      lastUpdatedAt: this.lastUpdatedAt.toISOString()
    };
  }
}
