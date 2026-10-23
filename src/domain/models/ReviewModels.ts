/**
 * 复习系统领域模型
 * DDD设计：Domain层 - 领域模型定义
 * 
 * 职责：
 * - 定义复习系统的核心业务实体和值对象
 * - 封装复习相关的业务规则和约束
 * - 提供类型安全的数据结构
 */

/**
 * 单词掌握度实体
 * 表示用户对某个单词的掌握程度和复习计划
 * 
 * 业务规则：
 * - word + source 作为唯一标识（复合主键）
 * - level 范围 0-5，代表掌握程度从"未掌握"到"完全掌握"
 * - interval 使用间隔重复算法（SM-2）计算
 */
export interface WordMastery {
  /** 单词文本（主键之一） */
  word: string;
  
  /** 学习来源（主键之一）
   * - 'english': 英文单词练习
   * - 'pinyin': 拼音练习
   * - 'finger': 指法练习
   */
  source: 'english' | 'pinyin' | 'finger' | string;
  
  /** 下次复习时间戳（毫秒）
   * 通过间隔重复算法计算得出
   */
  nextReview: number;
  
  /** 当前复习间隔（天数）
   * - 0: 今天需要复习
   * - 1: 明天复习
   * - 3: 三天后复习
   * - 以此类推，根据掌握程度递增
   */
  interval: number;
  
  /** 掌握等级（0-5）
   * - 0: 未掌握，需要重新学习
   * - 1: 刚刚记住，需要短期复习
   * - 2-3: 正在学习中
   * - 4-5: 已掌握，长期记忆
   */
  level: number;
}

/**
 * 复习结果枚举
 * 用于记录单词复习的结果
 */
export type ReviewResult = 'correct' | 'incorrect';

/**
 * 复习日志实体
 * 记录每次单词复习的详细信息，用于分析学习效果和遗忘曲线
 */
export interface ReviewLog {
  /** 日志唯一标识（自增主键） */
  id?: number;
  
  /** 复习的单词 */
  word: string;
  
  /** 学习来源 */
  source: string;
  
  /** 复习时间戳（毫秒） */
  reviewDate: number;
  
  /** 复习结果：正确或错误 */
  result: ReviewResult;
  
  /** 复习前的间隔天数
   * 用于分析遗忘曲线
   */
  intervalBefore: number;
  
  /** 复习后的新间隔天数
   * 根据复习结果重新计算
   */
  intervalAfter: number;
  
  /** 易用因子（SM-2算法参数）
   * 默认值 2.5，范围 1.3-2.5
   * 影响间隔增长速度
   */
  easeFactor: number;
  
  /** 复习用时（毫秒）
   * 可选，用于分析反应速度
   */
  timeTaken?: number;
}

/**
 * 复习统计值对象
 * 包含用户学习进度的汇总数据
 */
export interface ReviewStats {
  /** 总单词数 */
  total: number;
  
  /** 已掌握单词数（level >= 4） */
  mastered: number;
  
  /** 学习中单词数（level < 4） */
  learning: number;
  
  /** 到期需要复习的单词数 */
  due: number;
  
  /** 按来源分类的单词数统计
   * 例如：{ english: 50, pinyin: 30, finger: 20 }
   */
  bySource: Record<string, number>;
}

/**
 * 待复习单词值对象
 * 简化的单词表示，用于复习列表
 */
export interface DueWord {
  /** 单词文本 */
  word: string;
  
  /** 学习来源 */
  source: string;
}

/**
 * 遗忘曲线数据点
 * 用于可视化学习效果
 */
export interface RetentionDataPoint {
  /** 复习间隔（天数） */
  interval: number;
  
  /** 保留率（百分比，0-100）
   * 表示在该间隔下正确复习的比率
   */
  retentionRate: number;
  
  /** 数据点样本数
   * 该间隔下的总复习次数
   */
  count: number;
}

/**
 * 单词最后复习信息值对象
 * 用于显示记忆曲线提示
 */
export interface LastReviewInfo {
  /** 最后复习日期时间戳 */
  lastReviewDate: number;
  
  /** 最后复习结果 */
  lastResult: ReviewResult;
  
  /** 下次复习时间戳 */
  nextReview?: number;
  
  /** 当前掌握级别 */
  level?: number;
  
  /** 当前复习间隔 */
  interval?: number;
}
