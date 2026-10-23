/**
 * AI Lab 服务集成测试
 * 验证 DI 容器和所有服务的创建和基本功能
 */

import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';

/**
 * 测试 DI 容器初始化
 */
async function testDIContainerInitialization() {
  console.log('=== 测试 DI 容器初始化 ===');
  const container = AILabDependencyContainer.getInstance();
  await container.initialize();
  console.log('✓ DI 容器初始化成功');
}

/**
 * 测试推荐服务
 */
async function testRecommendationService() {
  console.log('\n=== 测试推荐服务 ===');
  const container = AILabDependencyContainer.getInstance();
  const recommendationService = container.getRecommendationService();

  // 测试推荐课程
  const ability = {
    listening: 70,
    speaking: 65,
    vocabularySize: 800,
    lastLessonDifficulty: 'A2',
  };

  const recommendations = await recommendationService.recommendCourses(ability, 3);
  console.log(`✓ 推荐课程: ${recommendations.results.length} 个课程`);
  recommendations.results.forEach((course) => {
    console.log(
      `  - ${course.name} (${course.difficulty}, 相关性: ${course.relevanceScore.toFixed(2)})`
    );
  });
}

/**
 * 测试课程生成服务
 */
async function testCourseGeneratorService() {
  console.log('\n=== 测试课程生成服务 ===');
  const container = AILabDependencyContainer.getInstance();
  const courseGeneratorService = container.getCourseGeneratorService();

  // 测试文本生成课程
  const options = {
    difficulty: 'A2' as const,
    includeAudio: true,
    vocabularyGranularity: 'basic' as const,
  };

  const course = await courseGeneratorService.generateCourseFromText(
    'Hello, my name is John.',
    options
  );
  console.log(`✓ 课程生成成功`);
  console.log(`  - 标题: ${course.title}`);
  console.log(`  - 课程数: ${course.lessons.length}`);
  console.log(`  - 难度: ${course.difficulty}`);

  if (course.lessons.length > 0) {
    const lesson = course.lessons[0];
    console.log(`  - 第一课: ${lesson.title} (${lesson.vocabulary?.length || 0} 个单词)`);
  }
}

/**
 * 测试出版社查询服务
 */
async function testPublisherQueryService() {
  console.log('\n=== 测试出版社查询服务 ===');
  const container = AILabDependencyContainer.getInstance();
  const publisherQueryService = container.getPublisherQueryService();

  // 获取出版社列表
  const publishers = await publisherQueryService.getAvailablePublishers();
  console.log(`✓ 获取出版社: ${publishers.length} 个出版社`);
  publishers.forEach((publisher) => {
    console.log(`  - ${publisher.name}`);
  });

  // 查询课程系列
  if (publishers.length > 0) {
    const publisherId = publishers[0].id;
    const curricula = await publisherQueryService.queryCurricula(publisherId);
    console.log(`✓ ${publishers[0].name} 的课程系列: ${curricula.length} 个`);
    if (curricula.length > 0) {
      console.log(`  - 第一个系列: ${curricula[0].name}`);
    }
  }
}

/**
 * 测试写作反馈服务
 */
async function testWritingFeedbackService() {
  console.log('\n=== 测试写作反馈服务 ===');
  const container = AILabDependencyContainer.getInstance();
  const writingFeedbackService = container.getWritingFeedbackService();

  // 分析写作
  const text = 'I goes to school yesterday. This is a very nice day.';
  const feedback = await writingFeedbackService.analyzeWriting(text, 'B1');
  console.log(`✓ 写作分析完成`);
  console.log(`  - 得分: ${feedback.score}/100`);
  console.log(`  - 语法错误: ${feedback.grammarErrors.length} 个`);
  console.log(`  - 词汇建议: ${feedback.vocabularySuggestions.length} 个`);
  console.log(`  - 表达改进: ${feedback.expressionSuggestions.length} 个`);
  console.log(`  - 评论: ${feedback.overallComment}`);

  // 生成改进版本
  const improved = await writingFeedbackService.generateImprovedVersion(text);
  console.log(`✓ 生成改进版本`);
  console.log(`  原文: ${text}`);
  console.log(`  改进: ${improved}`);

  // 词汇难度分析
  const difficulty = await writingFeedbackService.analyzeVocabularyDifficulty(text);
  console.log(`✓ 词汇难度分析`);
  console.log(`  - 平均难度: ${difficulty.averageDifficulty}`);
  console.log(`  - 词汇数: ${difficulty.wordCount}`);
}

/**
 * 测试仓储
 */
async function testRepositories() {
  console.log('\n=== 测试仓储 ===');
  const container = AILabDependencyContainer.getInstance();
  const languageAbilityRepository = container.getLanguageAbilityRepository();
  const taskRepository = container.getTaskRepository();

  // 测试能力仓储
  console.log('✓ 语言能力仓储初始化成功');
  console.log('✓ 任务仓储初始化成功');
}

/**
 * 运行所有测试
 */
async function runAllTests() {
  try {
    console.log('开始 AI Lab 服务集成测试...\n');

    // 初始化容器
    await testDIContainerInitialization();

    // 运行各个服务的测试
    await testRecommendationService();
    await testCourseGeneratorService();
    await testPublisherQueryService();
    await testWritingFeedbackService();
    await testRepositories();

    console.log('\n✅ 所有测试通过！');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ 测试失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件
if (require.main === module) {
  runAllTests();
}

export { runAllTests };
