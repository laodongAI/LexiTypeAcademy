/**
 * 课程去重服务 - 实现
 * 
 * 功能：
 * 1. 课程指纹生成（基于内容哈希）
 * 2. 相似度计算
 * 3. 重复检测
 * 4. 智能合并建议
 * 5. 冲突解决策略
 */

// ============================================================================
// 类型定义
// ============================================================================

/**
 * 课程指纹
 */
export interface CourseFingerprint {
  id: string;
  courseId: string;
  version: number;
  
  // 内容哈希
  titleHash: string;
  contentHash: string;
  structureHash: string;
  
  // 元数据
  unitCount: number;
  exerciseCount: number;
  totalWordCount: number;
  
  // 时间戳
  createdAt: string;
  updatedAt: string;
}

/**
 * 相似度结果
 */
export interface SimilarityResult {
  courseId1: string;
  courseId2: string;
  
  // 分项相似度 (0-1)
  titleSimilarity: number;
  contentSimilarity: number;
  structureSimilarity: number;
  
  // 综合相似度
  overallSimilarity: number;
  
  // 判定
  isDuplicate: boolean;
  isSuspicious: boolean;
}

/**
 * 合并建议
 */
export interface MergeSuggestion {
  primaryCourseId: string;
  secondaryCourseId: string;
  
  // 建议操作
  action: 'merge' | 'keep-both' | 'replace' | 'manual-review';
  
  // 合并方案
  mergeStrategy?: {
    keepTitle: 'primary' | 'secondary';
    keepDescription: 'primary' | 'secondary';
    unitStrategy: 'union' | 'intersection' | 'primary-only' | 'secondary-only';
  };
  
  // 冲突点
  conflicts: MergeConflict[];
  
  // 置信度
  confidence: number;
}

/**
 * 合并冲突
 */
export interface MergeConflict {
  field: string;
  primaryValue: any;
  secondaryValue: any;
  suggestedValue: any;
  reason: string;
}

/**
 * 去重配置
 */
export interface DeduplicationConfig {
  titleWeight: number;           // 标题权重
  contentWeight: number;         // 内容权重
  structureWeight: number;       // 结构权重
  duplicateThreshold: number;    // 重复判定阈值 (0-1)
  suspiciousThreshold: number;   // 可疑判定阈值 (0-1)
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: DeduplicationConfig = {
  titleWeight: 0.2,
  contentWeight: 0.5,
  structureWeight: 0.3,
  duplicateThreshold: 0.9,
  suspiciousThreshold: 0.7
};

// ============================================================================
// 课程去重服务接口
// ============================================================================

/**
 * 课程去重服务接口
 */
export interface ICourseDeduplicationService {
  // 指纹操作
  generateFingerprint(course: any): CourseFingerprint;
  updateFingerprint(courseId: string, course: any): CourseFingerprint;
  getFingerprint(courseId: string): CourseFingerprint | undefined;
  
  // 相似度计算
  calculateSimilarity(course1: any, course2: any): SimilarityResult;
  findDuplicates(course: any): SimilarityResult[];
  findSimilar(course: any, threshold?: number): SimilarityResult[];
  
  // 合并建议
  suggestMerge(result: SimilarityResult): MergeSuggestion;
  executeMerge(suggestion: MergeSuggestion): any;
  
  // 批量操作
  scanAllDuplicates(): Map<string, SimilarityResult[]>;
  generateDeduplicationReport(): DeduplicationReport;
}

/**
 * 去重报告
 */
export interface DeduplicationReport {
  scannedCount: number;
  duplicateCount: number;
  suspiciousCount: number;
  duplicatePairs: SimilarityResult[];
  suspiciousPairs: SimilarityResult[];
  recommendations: MergeSuggestion[];
  generatedAt: string;
}

// ============================================================================
// 课程去重服务实现
// ============================================================================

/**
 * 课程去重服务
 */
export class CourseDeduplicationService implements ICourseDeduplicationService {
  private fingerprints: Map<string, CourseFingerprint> = new Map();
  private config: DeduplicationConfig;
  private static readonly STORAGE_KEY = 'course_fingerprints';

  constructor(config?: Partial<DeduplicationConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.loadFingerprints();
    console.log('🔍 课程去重服务已初始化');
  }

  // ============================================================================
  // 持久化
  // ============================================================================

  private loadFingerprints(): void {
    try {
      const saved = localStorage.getItem(CourseDeduplicationService.STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved) as CourseFingerprint[];
        for (const fp of data) {
          this.fingerprints.set(fp.courseId, fp);
        }
        console.log(`📚 已加载 ${data.length} 个课程指纹`);
      }
    } catch (error) {
      console.error('加载课程指纹失败:', error);
    }
  }

  private saveFingerprints(): void {
    try {
      const data = Array.from(this.fingerprints.values());
      localStorage.setItem(CourseDeduplicationService.STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      console.error('保存课程指纹失败:', error);
    }
  }

  // ============================================================================
  // 指纹操作
  // ============================================================================

  /**
   * 生成课程指纹
   */
  generateFingerprint(course: any): CourseFingerprint {
    const now = new Date().toISOString();
    
    // 提取课程信息
    const title = course.title || course.name || '';
    const content = this.extractContent(course);
    const structure = this.extractStructure(course);
    
    const fingerprint: CourseFingerprint = {
      id: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      courseId: course.id || course.courseId,
      version: 1,
      
      titleHash: this.hashString(title),
      contentHash: this.hashString(content),
      structureHash: this.hashString(JSON.stringify(structure)),
      
      unitCount: this.countUnits(course),
      exerciseCount: this.countExercises(course),
      totalWordCount: content.split(/\s+/).length,
      
      createdAt: now,
      updatedAt: now
    };

    this.fingerprints.set(fingerprint.courseId, fingerprint);
    this.saveFingerprints();
    
    return fingerprint;
  }

  /**
   * 更新课程指纹
   */
  updateFingerprint(courseId: string, course: any): CourseFingerprint {
    const existing = this.fingerprints.get(courseId);
    const newFingerprint = this.generateFingerprint(course);
    
    if (existing) {
      newFingerprint.version = existing.version + 1;
      newFingerprint.createdAt = existing.createdAt;
    }
    
    return newFingerprint;
  }

  /**
   * 获取课程指纹
   */
  getFingerprint(courseId: string): CourseFingerprint | undefined {
    return this.fingerprints.get(courseId);
  }

  // ============================================================================
  // 相似度计算
  // ============================================================================

  /**
   * 计算两个课程的相似度
   */
  calculateSimilarity(course1: any, course2: any): SimilarityResult {
    // 标题相似度
    const title1 = (course1.title || course1.name || '').toLowerCase();
    const title2 = (course2.title || course2.name || '').toLowerCase();
    const titleSimilarity = this.levenshteinSimilarity(title1, title2);

    // 内容相似度
    const content1 = this.extractContent(course1);
    const content2 = this.extractContent(course2);
    const contentSimilarity = this.jaccardSimilarity(
      this.tokenize(content1),
      this.tokenize(content2)
    );

    // 结构相似度
    const structure1 = this.extractStructure(course1);
    const structure2 = this.extractStructure(course2);
    const structureSimilarity = this.structuralSimilarity(structure1, structure2);

    // 综合相似度（加权平均）
    const overallSimilarity = 
      this.config.titleWeight * titleSimilarity +
      this.config.contentWeight * contentSimilarity +
      this.config.structureWeight * structureSimilarity;

    return {
      courseId1: course1.id || course1.courseId,
      courseId2: course2.id || course2.courseId,
      titleSimilarity,
      contentSimilarity,
      structureSimilarity,
      overallSimilarity,
      isDuplicate: overallSimilarity >= this.config.duplicateThreshold,
      isSuspicious: overallSimilarity >= this.config.suspiciousThreshold && 
                   overallSimilarity < this.config.duplicateThreshold
    };
  }

  /**
   * 查找重复课程
   */
  findDuplicates(course: any): SimilarityResult[] {
    const results: SimilarityResult[] = [];
    const courseId = course.id || course.courseId;

    for (const [id, fp] of this.fingerprints) {
      if (id === courseId) continue;
      
      // 快速预筛选：基于指纹哈希
      const courseFp = this.getFingerprint(courseId);
      if (courseFp && fp.contentHash === courseFp.contentHash) {
        // 哈希完全相同，很可能是重复
        results.push({
          courseId1: courseId,
          courseId2: id,
          titleSimilarity: 1,
          contentSimilarity: 1,
          structureSimilarity: 1,
          overallSimilarity: 1,
          isDuplicate: true,
          isSuspicious: false
        });
      }
    }

    return results;
  }

  /**
   * 查找相似课程
   */
  findSimilar(course: any, threshold?: number): SimilarityResult[] {
    const actualThreshold = threshold ?? this.config.suspiciousThreshold;
    const results: SimilarityResult[] = [];
    const courseId = course.id || course.courseId;

    // 注意：这里需要有课程数据的访问能力
    // 在实际实现中，需要通过仓库获取其他课程进行比较
    // 这里仅演示框架

    console.log(`🔍 查找与课程 ${courseId} 相似度 >= ${actualThreshold} 的课程`);
    
    return results;
  }

  // ============================================================================
  // 合并建议
  // ============================================================================

  /**
   * 生成合并建议
   */
  suggestMerge(result: SimilarityResult): MergeSuggestion {
    const conflicts: MergeConflict[] = [];
    
    // 根据相似度判定推荐操作
    let action: MergeSuggestion['action'];
    let confidence: number;

    if (result.overallSimilarity >= 0.95) {
      action = 'merge';
      confidence = 0.9;
    } else if (result.overallSimilarity >= 0.85) {
      action = 'merge';
      confidence = 0.7;
    } else if (result.overallSimilarity >= 0.7) {
      action = 'manual-review';
      confidence = 0.5;
    } else {
      action = 'keep-both';
      confidence = 0.8;
    }

    return {
      primaryCourseId: result.courseId1,
      secondaryCourseId: result.courseId2,
      action,
      mergeStrategy: action === 'merge' ? {
        keepTitle: 'primary',
        keepDescription: 'primary',
        unitStrategy: 'union'
      } : undefined,
      conflicts,
      confidence
    };
  }

  /**
   * 执行合并
   */
  executeMerge(suggestion: MergeSuggestion): any {
    console.log(`📦 执行课程合并: ${suggestion.primaryCourseId} + ${suggestion.secondaryCourseId}`);
    
    // 实际合并逻辑需要访问课程仓库
    // 这里返回合并结果的框架
    
    return {
      success: true,
      mergedCourseId: suggestion.primaryCourseId,
      removedCourseId: suggestion.secondaryCourseId,
      mergedAt: new Date().toISOString()
    };
  }

  // ============================================================================
  // 批量操作
  // ============================================================================

  /**
   * 扫描所有重复
   */
  scanAllDuplicates(): Map<string, SimilarityResult[]> {
    const duplicatesMap = new Map<string, SimilarityResult[]>();
    const fingerprints = Array.from(this.fingerprints.values());
    
    console.log(`🔍 扫描 ${fingerprints.length} 个课程的重复情况...`);

    // 基于哈希的快速分组
    const hashGroups = new Map<string, CourseFingerprint[]>();
    
    for (const fp of fingerprints) {
      const hash = fp.contentHash;
      if (!hashGroups.has(hash)) {
        hashGroups.set(hash, []);
      }
      hashGroups.get(hash)!.push(fp);
    }

    // 找出有多个课程的哈希组（潜在重复）
    for (const [hash, group] of hashGroups) {
      if (group.length > 1) {
        for (let i = 0; i < group.length; i++) {
          for (let j = i + 1; j < group.length; j++) {
            const result: SimilarityResult = {
              courseId1: group[i].courseId,
              courseId2: group[j].courseId,
              titleSimilarity: 1,
              contentSimilarity: 1,
              structureSimilarity: 1,
              overallSimilarity: 1,
              isDuplicate: true,
              isSuspicious: false
            };

            if (!duplicatesMap.has(group[i].courseId)) {
              duplicatesMap.set(group[i].courseId, []);
            }
            duplicatesMap.get(group[i].courseId)!.push(result);
          }
        }
      }
    }

    console.log(`✅ 发现 ${duplicatesMap.size} 组重复课程`);
    return duplicatesMap;
  }

  /**
   * 生成去重报告
   */
  generateDeduplicationReport(): DeduplicationReport {
    const duplicatesMap = this.scanAllDuplicates();
    
    const duplicatePairs: SimilarityResult[] = [];
    const suspiciousPairs: SimilarityResult[] = [];
    
    for (const [, results] of duplicatesMap) {
      for (const result of results) {
        if (result.isDuplicate) {
          duplicatePairs.push(result);
        } else if (result.isSuspicious) {
          suspiciousPairs.push(result);
        }
      }
    }

    const recommendations = duplicatePairs.map(pair => this.suggestMerge(pair));

    return {
      scannedCount: this.fingerprints.size,
      duplicateCount: duplicatePairs.length,
      suspiciousCount: suspiciousPairs.length,
      duplicatePairs,
      suspiciousPairs,
      recommendations,
      generatedAt: new Date().toISOString()
    };
  }

  // ============================================================================
  // 私有辅助方法
  // ============================================================================

  /**
   * 简单字符串哈希
   */
  private hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * 提取课程内容
   */
  private extractContent(course: any): string {
    const parts: string[] = [];
    
    if (course.title) parts.push(course.title);
    if (course.name) parts.push(course.name);
    if (course.description) parts.push(course.description);
    
    // 提取单元内容
    if (course.units && Array.isArray(course.units)) {
      for (const unit of course.units) {
        if (unit.title) parts.push(unit.title);
        if (unit.content) parts.push(unit.content);
        
        // 提取练习内容
        if (unit.exercises && Array.isArray(unit.exercises)) {
          for (const ex of unit.exercises) {
            if (ex.content) parts.push(ex.content);
            if (ex.question) parts.push(ex.question);
            if (ex.answer) parts.push(ex.answer);
          }
        }
      }
    }

    return parts.join(' ');
  }

  /**
   * 提取课程结构
   */
  private extractStructure(course: any): any {
    return {
      unitCount: this.countUnits(course),
      exerciseCount: this.countExercises(course),
      unitTypes: this.extractUnitTypes(course)
    };
  }

  /**
   * 统计单元数
   */
  private countUnits(course: any): number {
    if (course.units && Array.isArray(course.units)) {
      return course.units.length;
    }
    return 0;
  }

  /**
   * 统计练习数
   */
  private countExercises(course: any): number {
    let count = 0;
    if (course.units && Array.isArray(course.units)) {
      for (const unit of course.units) {
        if (unit.exercises && Array.isArray(unit.exercises)) {
          count += unit.exercises.length;
        }
      }
    }
    return count;
  }

  /**
   * 提取单元类型
   */
  private extractUnitTypes(course: any): string[] {
    const types: string[] = [];
    if (course.units && Array.isArray(course.units)) {
      for (const unit of course.units) {
        if (unit.type && !types.includes(unit.type)) {
          types.push(unit.type);
        }
      }
    }
    return types;
  }

  /**
   * 分词
   */
  private tokenize(text: string): Set<string> {
    return new Set(
      text.toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2)
    );
  }

  /**
   * Levenshtein 相似度
   */
  private levenshteinSimilarity(s1: string, s2: string): number {
    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    const len1 = s1.length;
    const len2 = s2.length;
    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    return 1 - distance / Math.max(len1, len2);
  }

  /**
   * Jaccard 相似度
   */
  private jaccardSimilarity(set1: Set<string>, set2: Set<string>): number {
    if (set1.size === 0 && set2.size === 0) return 1;
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return intersection.size / union.size;
  }

  /**
   * 结构相似度
   */
  private structuralSimilarity(s1: any, s2: any): number {
    let score = 0;
    let total = 0;

    // 单元数相似度
    if (s1.unitCount !== undefined && s2.unitCount !== undefined) {
      const maxUnits = Math.max(s1.unitCount, s2.unitCount);
      if (maxUnits > 0) {
        score += 1 - Math.abs(s1.unitCount - s2.unitCount) / maxUnits;
      } else {
        score += 1;
      }
      total += 1;
    }

    // 练习数相似度
    if (s1.exerciseCount !== undefined && s2.exerciseCount !== undefined) {
      const maxExercises = Math.max(s1.exerciseCount, s2.exerciseCount);
      if (maxExercises > 0) {
        score += 1 - Math.abs(s1.exerciseCount - s2.exerciseCount) / maxExercises;
      } else {
        score += 1;
      }
      total += 1;
    }

    // 单元类型相似度
    if (s1.unitTypes && s2.unitTypes) {
      score += this.jaccardSimilarity(new Set(s1.unitTypes), new Set(s2.unitTypes));
      total += 1;
    }

    return total > 0 ? score / total : 0;
  }
}

// ============================================================================
// 导出单例
// ============================================================================

let _instance: CourseDeduplicationService | null = null;

/**
 * 获取课程去重服务实例
 */
export function getCourseDeduplicationService(
  config?: Partial<DeduplicationConfig>
): CourseDeduplicationService {
  if (!_instance) {
    _instance = new CourseDeduplicationService(config);
  }
  return _instance;
}
