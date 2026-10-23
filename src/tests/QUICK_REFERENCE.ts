/**
 * Phase 10C 快速参考指南
 * 快速查阅 4 个服务和 DI 容器的使用方法
 */

/**
 * ============================================================================
 * 1. DI 容器初始化
 * ============================================================================
 */

// 在应用启动时（App.tsx 或 main.ts）
import { AILabDependencyContainer } from './infrastructure/di/AILabDependencyContainer';

export async function initializeApp() {
  const container = AILabDependencyContainer.getInstance();
  await container.initialize(); // ⚠️ 必须调用，否则服务为 null
  console.log('✓ AI Lab 依赖容器初始化完成');
}

/**
 * ============================================================================
 * 2. RecommendationService 快速用法
 * ============================================================================
 */

import { IAbilityInput } from './domain/services/IRecommendationService';

async function example_recommendationService() {
  const container = AILabDependencyContainer.getInstance();
  const service = container.getRecommendationService();

  // 学生的学习能力
  const ability: IAbilityInput = {
    listening: 75,
    speaking: 70,
    vocabularySize: 1200,
    lastLessonDifficulty: 'B1',
  };

  // 获取推荐课程（前 5 个）
  const recommendations = await service.recommendCourses(ability, 5);
  console.log(`推荐 ${recommendations.results.length} 个课程:`);
  recommendations.results.forEach((course) => {
    console.log(
      `- ${course.name} (${course.difficulty}, 相关性 ${(course.relevanceScore * 100).toFixed(0)}%)`
    );
  });

  // 获取补习课程（针对特定错误）
  const remedial = await service.recommendRemediationCourses(
    ability,
    ['pronunciation', 'grammar']
  );
  console.log('补习课程:', remedial.results);

  // 获取上次的推荐（带缓存）
  const lastRecommendation = await service.getLastRecommendation('user-123');
  console.log('最后推荐:', lastRecommendation);
}

/**
 * ============================================================================
 * 3. CourseGeneratorService 快速用法
 * ============================================================================
 */

async function example_courseGeneratorService() {
  const container = AILabDependencyContainer.getInstance();
  const service = container.getCourseGeneratorService();

  // 从文本生成课程
  const course = await service.generateCourseFromText(
    'The quick brown fox jumps over the lazy dog.',
    {
      difficulty: 'B1',
      includeAudio: true,
      vocabularyGranularity: 'basic', // 'basic' | 'extended'
    }
  );

  console.log(`生成课程: ${course.title}`);
  console.log(`课程数: ${course.lessons.length}`);
  console.log('课程结构:');
  course.lessons.forEach((lesson) => {
    console.log(`  - ${lesson.title}: ${lesson.content}`);
    if (lesson.vocabulary) {
      console.log(`    词汇: ${lesson.vocabulary.join(', ')}`);
    }
  });

  // 从音频文件生成课程
  const audioPath = '/path/to/audio.mp3';
  const audioCourse = await service.generateCourseFromAudio(audioPath, {
    difficulty: 'A2',
    includeAudio: true,
  });

  // 监控任务进度
  const taskId = 'task-123';
  const progress = await service.monitorTaskProgress({ id: taskId } as any);
  console.log(`任务进度: ${progress}%`);

  // 取消任务
  await service.cancelTask(taskId);
  console.log('✓ 任务已取消');
}

/**
 * ============================================================================
 * 4. PublisherQueryService 快速用法 (四步导航)
 * ============================================================================
 */

async function example_publisherQueryService() {
  const container = AILabDependencyContainer.getInstance();
  const service = container.getPublisherQueryService();

  // 步骤 1: 获取所有出版社
  const publishers = await service.getAvailablePublishers();
  console.log(`可用出版社: ${publishers.length} 个`);
  publishers.forEach((pub) => {
    console.log(`  - ${pub.name} (${pub.id})`);
  });

  // 步骤 2: 查询出版社的教材系列
  const publisherId = publishers[0].id;
  const curricula = await service.queryCurricula(publisherId);
  console.log(`${publishers[0].name} 的教材系列: ${curricula.length} 个`);
  curricula.forEach((curr) => {
    console.log(`  - ${curr.name} (${curr.id})`);
  });

  // 步骤 3: 查询教材系列的单元
  const curriculumId = curricula[0]?.id;
  if (curriculumId) {
    const units = await service.queryUnits(publisherId, curriculumId);
    console.log(`${curricula[0]?.name} 的单元: ${units.length} 个`);
    units.forEach((unit) => {
      console.log(`  - ${unit.title}`);
    });

    // 步骤 4: 从单元生成课程
    const unitId = units[0]?.id;
    if (unitId) {
      const generatedCourse = await service.generateCourseFromUnit(
        publisherId,
        curriculumId,
        unitId,
        { includeAudio: true }
      );
      console.log(`✓ 从 ${units[0]?.title} 生成课程: ${generatedCourse.title}`);
      console.log(`课程数: ${generatedCourse.lessons.length}`);
    }
  }

  // 获取单元预览
  if (units.length > 0) {
    const preview = await service.getUnitPreview(
      publisherId,
      curriculumId!,
      units[0].id
    );
    console.log(`单元预览: ${preview.title}`);
    console.log(`词汇: ${preview.vocabulary.join(', ')}`);
  }

  // 清除缓存
  await service.clearCache();
  console.log('✓ 缓存已清除');
}

/**
 * ============================================================================
 * 5. WritingFeedbackService 快速用法
 * ============================================================================
 */

async function example_writingFeedbackService() {
  const container = AILabDependencyContainer.getInstance();
  const service = container.getWritingFeedbackService();

  // 分析写作
  const text = 'I goes to school yesterday. The weather is very nice.';
  const feedback = await service.analyzeWriting(text, 'B1');

  console.log(`得分: ${feedback.score}/100`);
  console.log(`评论: ${feedback.overallComment}`);

  // 显示语法错误
  console.log(`\n语法错误 (${feedback.grammarErrors.length} 个):`);
  feedback.grammarErrors.forEach((error) => {
    console.log(
      `  - [${error.errorType}] ${error.explanation} → 改为 "${error.suggestion}"`
    );
  });

  // 显示词汇建议
  console.log(`\n词汇建议 (${feedback.vocabularySuggestions.length} 个):`);
  feedback.vocabularySuggestions.forEach((sugg) => {
    console.log(`  - "${sugg.originalWord}" → "${sugg.suggestedWord}" (${sugg.reason})`);
  });

  // 显示表达改进
  console.log(`\n表达改进 (${feedback.expressionSuggestions.length} 个):`);
  feedback.expressionSuggestions.forEach((sugg) => {
    console.log(`  - ${sugg.reason}`);
    console.log(`    示例: ${sugg.example}`);
  });

  // 生成改进版本
  const improved = await service.generateImprovedVersion(text, [
    'grammar',
    'vocabulary',
  ]);
  console.log(`\n改进版本: ${improved}`);

  // 获取错误说明
  const explanation = await service.getErrorExplanation('tense');
  console.log(`\n时态错误说明:`);
  console.log(`  定义: ${explanation.definition}`);
  console.log(`  技巧:`);
  explanation.tips.forEach((tip) => {
    console.log(`    - ${tip}`);
  });

  // 分析词汇难度
  const difficulty = await service.analyzeVocabularyDifficulty(text);
  console.log(`\n词汇难度分析:`);
  console.log(`  平均难度: ${difficulty.averageDifficulty}`);
  console.log(`  独特词汇数: ${difficulty.wordCount}`);
  if (difficulty.difficultWords.length > 0) {
    console.log(`  高难度词汇: ${difficulty.difficultWords.map((w) => w.word).join(', ')}`);
  }
}

/**
 * ============================================================================
 * 6. 仓储快速用法 (通过 DI 容器)
 * ============================================================================
 */

async function example_repositories() {
  const container = AILabDependencyContainer.getInstance();

  // 获取语言能力仓储
  const languageAbilityRepo = container.getLanguageAbilityRepository();

  // 查找用户的语言能力
  const ability = await languageAbilityRepo.findByUserId('user-123');
  if (ability) {
    console.log(`用户 user-123 的语言能力:`);
    console.log(`  听: ${ability.listening}`);
    console.log(`  说: ${ability.speaking}`);
    console.log(`  词汇: ${ability.vocabularySize}`);
  }

  // 获取任务仓储
  const taskRepo = container.getTaskRepository();

  // 查询用户的任务
  const userTasks = await taskRepo.findByUserId('user-123');
  console.log(`用户 user-123 的任务: ${userTasks.length} 个`);

  // 查询进行中的任务
  const inProgressTasks = await taskRepo.findInProgressTasks('user-123');
  console.log(`进行中的任务: ${inProgressTasks.length} 个`);

  // 复杂查询
  const completedTasks = await taskRepo.query({
    userId: 'user-123',
    status: 'COMPLETED',
    taskType: 'COURSE_GENERATION',
    limit: 10,
    offset: 0,
  });
  console.log(`已完成的课程生成任务: ${completedTasks.length} 个`);
}

/**
 * ============================================================================
 * 7. React 组件集成示例
 * ============================================================================
 */

import { useEffect, useState } from 'react';

export function MyAILabComponent() {
  const [recommendations, setRecommendations] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadRecommendations = async () => {
      try {
        setLoading(true);
        const container = AILabDependencyContainer.getInstance();
        const service = container.getRecommendationService();

        const result = await service.recommendCourses(
          {
            listening: 75,
            speaking: 70,
            vocabularySize: 1200,
            lastLessonDifficulty: 'B1',
          },
          5
        );
        setRecommendations(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    loadRecommendations();
  }, []);

  // JSX 示例（注释掉以避免类型检查错误）
  /*
  if (loading) return <div>加载中...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!recommendations) return <div>无数据</div>;

  return (
    <div>
      <h2>推荐课程</h2>
      {recommendations.results.map((course: any) => (
        <div key={course.id} className="course-card">
          <h3>{course.name}</h3>
          <p>难度: {course.difficulty}</p>
          <p>相关性: {(course.relevanceScore * 100).toFixed(0)}%</p>
        </div>
      ))}
    </div>
  );
  */
}

/**
 * ============================================================================
 * 8. 错误处理最佳实践
 * ============================================================================
 */

async function example_errorHandling() {
  const container = AILabDependencyContainer.getInstance();

  try {
    // ❌ 未初始化时调用会抛出错误
    const service = container.getRecommendationService(); // 可能抛出 "AI Lab 依赖容器未初始化"

    // ✅ 正确做法：确保初始化
    await container.initialize();
    const properService = container.getRecommendationService();

    // 调用服务
    const result = await properService.recommendCourses(
      {
        listening: 70,
        speaking: 65,
        vocabularySize: 800,
        lastLessonDifficulty: 'A2',
      },
      5
    );
  } catch (error) {
    if (error instanceof Error) {
      console.error(`错误: ${error.message}`);
      // 处理错误：显示用户提示、记录日志等
    }
  }
}

/**
 * ============================================================================
 * 9. 常见问题解答
 * ============================================================================
 *
 * Q: 什么时候初始化 DI 容器？
 * A: 在应用启动时（App.tsx 的 useEffect 或 main.ts 中）
 *
 * Q: 可以创建多个 DI 容器实例吗？
 * A: 否，getInstance() 返回单例。这确保所有组件共享同一个容器。
 *
 * Q: 如何在测试中重置容器？
 * A: 调用 container.reset()，然后再次初始化。
 *
 * Q: 服务返回 null 的原因？
 * A: 通常是容器未初始化。检查是否调用了 await container.initialize()
 *
 * Q: 可以替换某个服务实现吗？
 * A: 可以，直接修改 AILabDependencyContainer.initialize() 中的实现。
 *
 * Q: 如何获取当前用户的 ID？
 * A: 从 auth context 或 Redux store 获取，然后传给服务方法。
 */

/**
 * ============================================================================
 * 10. 性能优化建议
 * ============================================================================
 *
 * 1. 缓存策略
 *    - RecommendationService: 30 天缓存推荐结果
 *    - PublisherQueryService: 按级别缓存 (30/7/1 天)
 *
 * 2. 批量操作
 *    - 使用 TaskRepository.query() 而不是多个 findById()
 *
 * 3. 懒加载
 *    - DI 容器在需要时创建服务（已实现）
 *
 * 4. 索引优化
 *    - Dexie 已创建关键索引 (userId, taskId, createdAt)
 *
 * 5. 并发控制
 *    - 在 React 中使用 Promise.all() 并行加载多个数据
 */

export { example_recommendationService, example_courseGeneratorService,
  example_publisherQueryService, example_writingFeedbackService,
  example_repositories, example_errorHandling };
