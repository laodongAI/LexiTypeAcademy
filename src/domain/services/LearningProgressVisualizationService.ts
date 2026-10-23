/**
 * 学习进度可视化服务
 * 
 * 职责：
 * - 生成每日热力图数据（类似GitHub贡献图）
 * - 生成技能雷达图数据（准确度/流畅度/完整度）
 * - 统计学习进度和成就
 * 
 * 基于需求文档：english-learning-requirements-v0.4.0.md
 * 第 8.3 节 - 学习热力图验证与点击深入
 */

/**
 * 学习记录接口
 */
export interface LearningRecord {
  recordId: string;
  userId: string;
  courseId: string;
  lessonId: string;
  mode: 'dictation' | 'follow' | 'translation' | 'cloze' | 'retell';
  score: number; // 0-100
  breakdown?: {
    accuracy: number;
    fluency: number;
    completeness: number;
  };
  createdAt: Date;
  duration: number; // 学习时长（秒）
}

/**
 * 热力图数据点
 */
export interface HeatmapDataPoint {
  date: string; // YYYY-MM-DD
  count: number; // 练习次数
  totalDuration: number; // 总时长（分钟）
  averageScore: number; // 平均分数
  intensity: 'none' | 'light' | 'medium' | 'heavy'; // 强度等级
}

/**
 * 技能雷达图数据
 */
export interface SkillRadarData {
  accuracy: number; // 准确度 0-100
  fluency: number; // 流畅度 0-100
  completeness: number; // 完整度 0-100
  consistency: number; // 稳定性 0-100
  improvement: number; // 进步速度 0-100
}

/**
 * 日期详细数据
 */
export interface DayDetailData {
  date: string;
  totalDuration: number; // 总时长（分钟）
  practiceCount: number; // 练习次数
  averageScore: number; // 平均分数
  courses: Array<{
    courseId: string;
    courseName: string;
    practiceCount: number;
    averageScore: number;
  }>;
  errorDistribution: {
    pronunciation: number;
    fluency: number;
    grammar: number;
    vocabulary: number;
  };
}

/**
 * 学习进度可视化服务类
 */
export class LearningProgressVisualizationService {
  /**
   * 生成热力图数据
   * @param records 学习记录数组
   * @param days 天数（默认30天）
   */
  generateHeatmapData(records: LearningRecord[], days: number = 30): HeatmapDataPoint[] {
    const today = new Date();
    const heatmapData: HeatmapDataPoint[] = [];
    
    // 按日期分组
    const recordsByDate = new Map<string, LearningRecord[]>();
    
    for (const record of records) {
      const dateStr = this.formatDate(new Date(record.createdAt));
      if (!recordsByDate.has(dateStr)) {
        recordsByDate.set(dateStr, []);
      }
      recordsByDate.get(dateStr)!.push(record);
    }
    
    // 生成最近N天的数据
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = this.formatDate(date);
      
      const dayRecords = recordsByDate.get(dateStr) || [];
      const count = dayRecords.length;
      const totalDuration = dayRecords.reduce((sum, r) => sum + r.duration, 0) / 60; // 转换为分钟
      const averageScore = count > 0 
        ? dayRecords.reduce((sum, r) => sum + r.score, 0) / count 
        : 0;
      
      // 计算强度等级
      let intensity: HeatmapDataPoint['intensity'] = 'none';
      if (count === 0) {
        intensity = 'none';
      } else if (count <= 5) {
        intensity = 'light';
      } else if (count <= 15) {
        intensity = 'medium';
      } else {
        intensity = 'heavy';
      }
      
      heatmapData.push({
        date: dateStr,
        count,
        totalDuration,
        averageScore,
        intensity
      });
    }
    
    return heatmapData;
  }

  /**
   * 生成技能雷达图数据
   * @param records 最近的学习记录
   */
  generateSkillRadarData(records: LearningRecord[]): SkillRadarData {
    if (records.length === 0) {
      return {
        accuracy: 0,
        fluency: 0,
        completeness: 0,
        consistency: 0,
        improvement: 0
      };
    }

    // 计算平均值
    let totalAccuracy = 0;
    let totalFluency = 0;
    let totalCompleteness = 0;
    let validCount = 0;

    for (const record of records) {
      if (record.breakdown) {
        totalAccuracy += record.breakdown.accuracy;
        totalFluency += record.breakdown.fluency;
        totalCompleteness += record.breakdown.completeness;
        validCount++;
      }
    }

    const accuracy = validCount > 0 ? totalAccuracy / validCount : 0;
    const fluency = validCount > 0 ? totalFluency / validCount : 0;
    const completeness = validCount > 0 ? totalCompleteness / validCount : 0;

    // 计算稳定性（分数标准差的倒数）
    const scores = records.map(r => r.score);
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);
    const consistency = Math.max(0, 100 - stdDev * 2); // 标准差越小，稳定性越高

    // 计算进步速度（前半段与后半段的平均分对比）
    const halfIndex = Math.floor(records.length / 2);
    const firstHalfAvg = records.slice(0, halfIndex)
      .reduce((sum, r) => sum + r.score, 0) / halfIndex;
    const secondHalfAvg = records.slice(halfIndex)
      .reduce((sum, r) => sum + r.score, 0) / (records.length - halfIndex);
    const improvement = Math.min(100, Math.max(0, 50 + (secondHalfAvg - firstHalfAvg)));

    return {
      accuracy: Math.round(accuracy),
      fluency: Math.round(fluency),
      completeness: Math.round(completeness),
      consistency: Math.round(consistency),
      improvement: Math.round(improvement)
    };
  }

  /**
   * 获取指定日期的详细数据
   * @param records 学习记录
   * @param date 日期
   */
  getDayDetailData(records: LearningRecord[], date: string): DayDetailData {
    const dayRecords = records.filter(r => 
      this.formatDate(new Date(r.createdAt)) === date
    );

    const totalDuration = dayRecords.reduce((sum, r) => sum + r.duration, 0) / 60;
    const practiceCount = dayRecords.length;
    const averageScore = practiceCount > 0
      ? dayRecords.reduce((sum, r) => sum + r.score, 0) / practiceCount
      : 0;

    // 按课程分组
    const courseMap = new Map<string, { count: number; totalScore: number }>();
    for (const record of dayRecords) {
      if (!courseMap.has(record.courseId)) {
        courseMap.set(record.courseId, { count: 0, totalScore: 0 });
      }
      const courseData = courseMap.get(record.courseId)!;
      courseData.count++;
      courseData.totalScore += record.score;
    }

    const courses = Array.from(courseMap.entries()).map(([courseId, data]) => ({
      courseId,
      courseName: `Course ${courseId}`, // TODO: 从数据库加载课程名称
      practiceCount: data.count,
      averageScore: data.totalScore / data.count
    }));

    // 错误分布（模拟数据，实际需要从错误记录中统计）
    const errorDistribution = {
      pronunciation: Math.floor(Math.random() * 10),
      fluency: Math.floor(Math.random() * 10),
      grammar: Math.floor(Math.random() * 10),
      vocabulary: Math.floor(Math.random() * 10)
    };

    return {
      date,
      totalDuration,
      practiceCount,
      averageScore,
      courses,
      errorDistribution
    };
  }

  /**
   * 计算学习目标达成率
   * @param records 学习记录
   * @param dailyGoalMinutes 每日目标时长（分钟）
   */
  calculateGoalAchievement(records: LearningRecord[], dailyGoalMinutes: number = 15): {
    achievedDays: number;
    totalDays: number;
    achievementRate: number;
  } {
    const recordsByDate = new Map<string, number>();
    
    for (const record of records) {
      const dateStr = this.formatDate(new Date(record.createdAt));
      const current = recordsByDate.get(dateStr) || 0;
      recordsByDate.set(dateStr, current + record.duration / 60);
    }

    let achievedDays = 0;
    for (const duration of recordsByDate.values()) {
      if (duration >= dailyGoalMinutes) {
        achievedDays++;
      }
    }

    const totalDays = recordsByDate.size;
    const achievementRate = totalDays > 0 ? (achievedDays / totalDays) * 100 : 0;

    return {
      achievedDays,
      totalDays,
      achievementRate: Math.round(achievementRate)
    };
  }

  /**
   * 格式化日期为 YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * 获取周数据（7天一组）
   */
  getWeeklyData(heatmapData: HeatmapDataPoint[]): HeatmapDataPoint[][] {
    const weeks: HeatmapDataPoint[][] = [];
    let currentWeek: HeatmapDataPoint[] = [];

    for (let i = 0; i < heatmapData.length; i++) {
      currentWeek.push(heatmapData[i]);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // 添加最后不满一周的数据
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }
}
