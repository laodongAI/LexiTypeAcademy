/**
 * 共享值对象
 * 
 * 跨多个聚合根使用的值对象，用于确保类型安全和业务规则一致性
 */

/**
 * 难度等级值对象（CEFR 标准）
 */
export class Difficulty {
  private level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

  private constructor(level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2') {
    this.level = level;
  }

  static create(level: string): Difficulty {
    const validLevels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
    const normalizedLevel = level.toUpperCase();

    if (!validLevels.includes(normalizedLevel)) {
      throw new Error(`Invalid difficulty level: ${level}`);
    }

    return new Difficulty(normalizedLevel as 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2');
  }

  getNumericLevel(): number {
    const levelMap: Record<string, number> = {
      'A1': 1,
      'A2': 2,
      'B1': 3,
      'B2': 4,
      'C1': 5,
      'C2': 6
    };
    return levelMap[this.level];
  }

  toString(): string {
    return this.level;
  }

  toJSON(): string {
    return this.level;
  }

  equals(other: Difficulty): boolean {
    return this.level === other.level;
  }

  isHigherThan(other: Difficulty): boolean {
    return this.getNumericLevel() > other.getNumericLevel();
  }

  isLowerThan(other: Difficulty): boolean {
    return this.getNumericLevel() < other.getNumericLevel();
  }
}

/**
 * 准确率值对象
 * 
 * 表示学生的学习评测结果中各个维度的准确率
 */
export class Accuracy {
  private phonemeAccuracy: number; // 音素准确率
  private fluency: number; // 流利度
  private completeness: number; // 完整性（是否说完全）
  private rhythm: number; // 韵律/节奏

  private constructor(
    phonemeAccuracy: number,
    fluency: number,
    completeness: number,
    rhythm: number
  ) {
    this.validateAccuracy(phonemeAccuracy);
    this.validateAccuracy(fluency);
    this.validateAccuracy(completeness);
    this.validateAccuracy(rhythm);

    this.phonemeAccuracy = phonemeAccuracy;
    this.fluency = fluency;
    this.completeness = completeness;
    this.rhythm = rhythm;
  }

  static create(
    phonemeAccuracy: number,
    fluency: number,
    completeness: number,
    rhythm: number
  ): Accuracy {
    return new Accuracy(phonemeAccuracy, fluency, completeness, rhythm);
  }

  static restore(data: {
    phonemeAccuracy: number;
    fluency: number;
    completeness: number;
    rhythm: number;
  }): Accuracy {
    return new Accuracy(
      data.phonemeAccuracy,
      data.fluency,
      data.completeness,
      data.rhythm
    );
  }

  private validateAccuracy(value: number): void {
    if (value < 0 || value > 100) {
      throw new Error(`准确率必须在 0-100 之间，得到 ${value}`);
    }
  }

  getPhonemeAccuracy(): number {
    return this.phonemeAccuracy;
  }

  getFluency(): number {
    return this.fluency;
  }

  getCompleteness(): number {
    return this.completeness;
  }

  getRhythm(): number {
    return this.rhythm;
  }

  /**
   * 计算总体分数（四维加权平均）
   */
  getOverallScore(): number {
    const weights = {
      phoneme: 0.3,
      fluency: 0.3,
      completeness: 0.2,
      rhythm: 0.2
    };

    return (
      this.phonemeAccuracy * weights.phoneme +
      this.fluency * weights.fluency +
      this.completeness * weights.completeness +
      this.rhythm * weights.rhythm
    );
  }

  /**
   * 获取最弱的维度
   */
  getWeakestDimension(): 'phoneme' | 'fluency' | 'completeness' | 'rhythm' {
    const scores = {
      phoneme: this.phonemeAccuracy,
      fluency: this.fluency,
      completeness: this.completeness,
      rhythm: this.rhythm
    };

    let weakest = 'phoneme' as const;
    let minScore = scores.phoneme;

    for (const [dimension, score] of Object.entries(scores)) {
      if (score < minScore) {
        minScore = score;
        weakest = dimension as 'phoneme' | 'fluency' | 'completeness' | 'rhythm';
      }
    }

    return weakest;
  }

  /**
   * 转为 JSON 格式
   */
  toJSON() {
    return {
      phonemeAccuracy: this.phonemeAccuracy,
      fluency: this.fluency,
      completeness: this.completeness,
      rhythm: this.rhythm,
      overallScore: this.getOverallScore()
    };
  }
}

/**
 * 分数值对象
 */
export class Score {
  private value: number;

  private constructor(value: number) {
    if (value < 0 || value > 100) {
      throw new Error(`分数必须在 0-100 之间，得到 ${value}`);
    }
    this.value = value;
  }

  static create(value: number): Score {
    return new Score(value);
  }

  getValue(): number {
    return this.value;
  }

  isPass(threshold: number = 60): boolean {
    return this.value >= threshold;
  }

  toJSON(): number {
    return this.value;
  }

  toString(): string {
    return `${this.value}分`;
  }
}
