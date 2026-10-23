/**
 * AI Lab 页面服务绑定指南
 * 说明 5 个 AI Lab 页面如何与各个服务集成
 */

/**
 * ============================================================================
 * 1. WeakVocabularyReviewPage - 弱项词汇复习页面
 * ============================================================================
 * 
 * 功能：基于学生的学习数据，推荐需要复习的词汇
 * 绑定服务：RecommendationService
 * 
 * 集成步骤：
 * 
 * ```typescript
 * import { useEffect, useState } from 'react';
 * import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';
 * import { RecommendationResult } from '../domain/services/IRecommendationService';
 * 
 * export function WeakVocabularyReviewPage() {
 *   const [recommendations, setRecommendations] = useState<RecommendationResult | null>(null);
 *   const [loading, setLoading] = useState(false);
 *   const [error, setError] = useState<string | null>(null);
 * 
 *   useEffect(() => {
 *     const loadRecommendations = async () => {
 *       try {
 *         setLoading(true);
 *         const container = AILabDependencyContainer.getInstance();
 *         const recommendationService = container.getRecommendationService();
 * 
 *         // 获取当前用户的语言能力
 *         const languageAbilityRepository = container.getLanguageAbilityRepository();
 *         const ability = await languageAbilityRepository.findByUserId('current-user-id');
 * 
 *         // 获取推荐课程
 *         if (ability) {
 *           const result = await recommendationService.recommendCourses(
 *             {
 *               listening: ability.listening,
 *               speaking: ability.speaking,
 *               vocabularySize: ability.vocabularySize,
 *               lastLessonDifficulty: ability.currentDifficulty,
 *             },
 *             5
 *           );
 *           setRecommendations(result);
 *         }
 *       } catch (err) {
 *         setError(err instanceof Error ? err.message : '加载失败');
 *       } finally {
 *         setLoading(false);
 *       }
 *     };
 * 
 *     loadRecommendations();
 *   }, []);
 * 
 *   return (
 *     <div>
 *       {loading && <p>加载中...</p>}
 *       {error && <p className="text-red-500">{error}</p>}
 *       {recommendations && (
 *         <div>
 *           <h2>推荐课程</h2>
 *           {recommendations.results.map((course) => (
 *             <div key={course.id} className="card">
 *               <h3>{course.name}</h3>
 *               <p>难度: {course.difficulty}</p>
 *               <p>相关性: {(course.relevanceScore * 100).toFixed(0)}%</p>
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 关键点：
 * - 获取当前用户的 LanguageAbilityAggregate
 * - 调用 RecommendationService.recommendCourses()
 * - 处理加载和错误状态
 * - 显示推荐结果列表
 */

/**
 * ============================================================================
 * 2. TaskHistoryPage - 任务历史页面
 * ============================================================================
 * 
 * 功能：显示用户所有已完成和进行中的 AI Lab 任务
 * 绑定服务：TaskRepository (通过 AILabUseCases)
 * 
 * 集成步骤：
 * 
 * ```typescript
 * import { useEffect, useState } from 'react';
 * import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';
 * import { AILabTaskAggregate } from '../domain/aggregates/AILabTaskAggregate';
 * 
 * export function TaskHistoryPage() {
 *   const [tasks, setTasks] = useState<AILabTaskAggregate[]>([]);
 *   const [loading, setLoading] = useState(false);
 *   const [filter, setFilter] = useState<'all' | 'completed' | 'in_progress'>('all');
 * 
 *   useEffect(() => {
 *     const loadTasks = async () => {
 *       try {
 *         setLoading(true);
 *         const container = AILabDependencyContainer.getInstance();
 *         const taskRepository = container.getTaskRepository();
 * 
 *         const userId = 'current-user-id';
 *         let userTasks: AILabTaskAggregate[] = [];
 * 
 *         if (filter === 'all') {
 *           userTasks = await taskRepository.findByUserId(userId);
 *         } else if (filter === 'completed') {
 *           userTasks = await taskRepository.query({
 *             userId,
 *             status: 'COMPLETED',
 *           });
 *         } else if (filter === 'in_progress') {
 *           userTasks = await taskRepository.findInProgressTasks(userId);
 *         }
 * 
 *         // 按创建时间倒序排列
 *         userTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
 *         setTasks(userTasks);
 *       } catch (error) {
 *         console.error('加载任务失败:', error);
 *       } finally {
 *         setLoading(false);
 *       }
 *     };
 * 
 *     loadTasks();
 *   }, [filter]);
 * 
 *   return (
 *     <div>
 *       <div className="filter-bar">
 *         <button
 *           onClick={() => setFilter('all')}
 *           className={filter === 'all' ? 'active' : ''}
 *         >
 *           全部任务
 *         </button>
 *         <button
 *           onClick={() => setFilter('in_progress')}
 *           className={filter === 'in_progress' ? 'active' : ''}
 *         >
 *           进行中
 *         </button>
 *         <button
 *           onClick={() => setFilter('completed')}
 *           className={filter === 'completed' ? 'active' : ''}
 *         >
 *           已完成
 *         </button>
 *       </div>
 * 
 *       {loading ? (
 *         <p>加载中...</p>
 *       ) : (
 *         <div className="task-list">
 *           {tasks.map((task) => (
 *             <div key={task.id} className="task-card">
 *               <h3>{task.taskType}</h3>
 *               <p>状态: {task.status}</p>
 *               <p>创建时间: {task.createdAt.toLocaleDateString()}</p>
 *               {task.result && (
 *                 <p>得分: {task.result.score}/100</p>
 *               )}
 *             </div>
 *           ))}
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 关键点：
 * - 使用 TaskRepository 查询任务
 * - 支持多种过滤条件（状态、日期等）
 * - 显示任务详情（类型、状态、结果）
 * - 按时间倒序排列
 */

/**
 * ============================================================================
 * 3. CourseGeneratorPage - 课程生成页面
 * ============================================================================
 * 
 * 功能：从音频或文本生成 AI 课程
 * 绑定服务：CourseGeneratorService, AILabTaskAggregate
 * 
 * 集成步骤：
 * 
 * ```typescript
 * import { useEffect, useState } from 'react';
 * import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';
 * import { GeneratedCourse } from '../domain/services/ICourseGeneratorService';
 * 
 * export function CourseGeneratorPage() {
 *   const [inputType, setInputType] = useState<'audio' | 'text'>('text');
 *   const [textInput, setTextInput] = useState('');
 *   const [audioFile, setAudioFile] = useState<File | null>(null);
 *   const [generating, setGenerating] = useState(false);
 *   const [generatedCourse, setGeneratedCourse] = useState<GeneratedCourse | null>(null);
 *   const [progress, setProgress] = useState(0);
 * 
 *   const handleGenerate = async () => {
 *     try {
 *       setGenerating(true);
 *       setProgress(0);
 *       const container = AILabDependencyContainer.getInstance();
 *       const courseGeneratorService = container.getCourseGeneratorService();
 *       const taskRepository = container.getTaskRepository();
 * 
 *       // 创建任务
 *       const task = await courseGeneratorService.generateCourseFromText(
 *         inputType === 'text' ? textInput : audioFile?.name || '',
 *         {
 *           difficulty: 'B1',
 *           includeAudio: true,
 *           vocabularyGranularity: 'basic',
 *         }
 *       );
 * 
 *       setGeneratedCourse(task);
 *       setProgress(100);
 *     } catch (error) {
 *       console.error('课程生成失败:', error);
 *     } finally {
 *       setGenerating(false);
 *     }
 *   };
 * 
 *   return (
 *     <div>
 *       <div className="input-section">
 *         <div className="input-type-selector">
 *           <button
 *             onClick={() => setInputType('text')}
 *             className={inputType === 'text' ? 'active' : ''}
 *           >
 *             文本输入
 *           </button>
 *           <button
 *             onClick={() => setInputType('audio')}
 *             className={inputType === 'audio' ? 'active' : ''}
 *           >
 *             音频输入
 *           </button>
 *         </div>
 * 
 *         {inputType === 'text' ? (
 *           <textarea
 *             value={textInput}\n *             onChange={(e) => setTextInput(e.target.value)}
 *             placeholder="输入要生成课程的文本..."
 *             rows={6}
 *           />
 *         ) : (
 *           <input
 *             type="file"
 *             accept="audio/*"
 *             onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
 *           />
 *         )}
 *       </div>
 * 
 *       <button
 *         onClick={handleGenerate}
 *         disabled={generating || (!textInput && !audioFile)}
 *       >
 *         {generating ? `生成中... ${progress}%` : '生成课程'}
 *       </button>
 * 
 *       {generatedCourse && (
 *         <div className="generated-course">
 *           <h2>{generatedCourse.title}</h2>
 *           <p>难度: {generatedCourse.difficulty}</p>
 *           <div className="lessons">
 *             {generatedCourse.lessons.map((lesson, idx) => (
 *               <div key={idx} className="lesson">
 *                 <h3>{lesson.title}</h3>
 *                 <p>{lesson.content}</p>
 *                 {lesson.vocabulary && (
 *                   <div className="vocabulary">
 *                     <strong>词汇:</strong> {lesson.vocabulary.join(', ')}
 *                   </div>
 *                 )}
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 关键点：
 * - 支持文本和音频两种输入方式
 * - 调用 CourseGeneratorService.generateCourseFromText/Audio()
 * - 显示生成进度
 * - 展示生成的课程内容
 */

/**
 * ============================================================================
 * 4. PublisherImportPage - 出版社导入页面
 * ============================================================================
 * 
 * 功能：从出版社数据库导入教材课程
 * 绑定服务：PublisherQueryService
 * 
 * 集成步骤：
 * 
 * ```typescript
 * import { useEffect, useState } from 'react';
 * import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';
 * import { Publisher, Curriculum, CourseUnit } from '../domain/services/IPublisherQueryService';
 * 
 * export function PublisherImportPage() {
 *   const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
 *   const [publishers, setPublishers] = useState<Publisher[]>([]);
 *   const [curricula, setCurricula] = useState<Curriculum[]>([]);
 *   const [units, setUnits] = useState<CourseUnit[]>([]);
 * 
 *   const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);
 *   const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null);
 *   const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
 * 
 *   const container = AILabDependencyContainer.getInstance();
 *   const publisherQueryService = container.getPublisherQueryService();
 * 
 *   // 步骤 1: 获取出版社列表
 *   useEffect(() => {
 *     const loadPublishers = async () => {
 *       const pubs = await publisherQueryService.getAvailablePublishers();
 *       setPublishers(pubs);
 *     };
 *     loadPublishers();
 *   }, []);
 * 
 *   // 步骤 2: 获取课程系列
 *   const handleSelectPublisher = async (publisherId: string) => {
 *     setSelectedPublisher(publisherId);
 *     const currs = await publisherQueryService.queryCurricula(publisherId);
 *     setCurricula(currs);
 *     setStep(2);
 *   };
 * 
 *   // 步骤 3: 获取教学单元
 *   const handleSelectCurriculum = async (curriculumId: string) => {
 *     setSelectedCurriculum(curriculumId);
 *     const courseUnits = await publisherQueryService.queryUnits(
 *       selectedPublisher!,
 *       curriculumId
 *     );
 *     setUnits(courseUnits);
 *     setStep(3);
 *   };
 * 
 *   // 步骤 4: 生成课程
 *   const handleSelectUnit = async (unitId: string) => {
 *     setSelectedUnit(unitId);
 *     const generatedCourse = await publisherQueryService.generateCourseFromUnit(
 *       selectedPublisher!,
 *       selectedCurriculum!,
 *       unitId,
 *       { includeAudio: true }
 *     );
 *     // 显示生成的课程
 *     setStep(4);
 *   };
 * 
 *   return (
 *     <div className="publisher-import">
 *       {step === 1 && (
 *         <div>
 *           <h2>选择出版社</h2>
 *           <div className="publisher-list">
 *             {publishers.map((pub) => (
 *               <div
 *                 key={pub.id}
 *                 className="publisher-card"
 *                 onClick={() => handleSelectPublisher(pub.id)}
 *               >
 *                 <h3>{pub.name}</h3>
 *                 <p>{pub.description}</p>
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       )}
 * 
 *       {step === 2 && (
 *         <div>
 *           <h2>选择教材系列</h2>
 *           <div className="curriculum-list">
 *             {curricula.map((curr) => (
 *               <div
 *                 key={curr.id}
 *                 className="curriculum-card"
 *                 onClick={() => handleSelectCurriculum(curr.id)}
 *               >
 *                 <h3>{curr.name}</h3>
 *                 <p>{curr.description}</p>
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       )}
 * 
 *       {step === 3 && (
 *         <div>
 *           <h2>选择教学单元</h2>
 *           <div className="unit-list">
 *             {units.map((unit) => (
 *               <div
 *                 key={unit.id}
 *                 className="unit-card"
 *                 onClick={() => handleSelectUnit(unit.id)}
 *               >
 *                 <h3>{unit.title}</h3>
 *                 <p>{unit.description}</p>
 *               </div>
 *             ))}
 *           </div>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 关键点：
 * - 四步导航流程（出版社 → 系列 → 单元 → 生成）
 * - 调用 PublisherQueryService 的各个方法
 * - 动态更新下一步的选项列表
 * - 最后调用 generateCourseFromUnit() 生成课程
 */

/**
 * ============================================================================
 * 5. FreeWritingPage - 自由写作页面
 * ============================================================================
 * 
 * 功能：学生自由写作，获取 AI 反馈
 * 绑定服务：WritingFeedbackService
 * 
 * 集成步骤：
 * 
 * ```typescript
 * import { useEffect, useState } from 'react';
 * import { AILabDependencyContainer } from '../infrastructure/di/AILabDependencyContainer';
 * import { WritingFeedback, GrammarError } from '../domain/services/IWritingFeedbackService';
 * 
 * export function FreeWritingPage() {
 *   const [writingText, setWritingText] = useState('');
 *   const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
 *   const [analyzing, setAnalyzing] = useState(false);
 *   const [selectedError, setSelectedError] = useState<GrammarError | null>(null);
 * 
 *   const container = AILabDependencyContainer.getInstance();
 *   const writingFeedbackService = container.getWritingFeedbackService();
 * 
 *   const handleAnalyze = async () => {
 *     try {
 *       setAnalyzing(true);
 *       const result = await writingFeedbackService.analyzeWriting(
 *         writingText,
 *         'B1' // 学生级别
 *       );
 *       setFeedback(result);
 *     } catch (error) {
 *       console.error('分析失败:', error);
 *     } finally {
 *       setAnalyzing(false);
 *     }
 *   };
 * 
 *   const handleGetImprovement = async () => {
 *     if (!feedback) return;
 *     const improved = await writingFeedbackService.generateImprovedVersion(
 *       writingText,
 *       ['grammar', 'vocabulary']
 *     );
 *     // 显示改进版本
 *   };
 * 
 *   return (
 *     <div className="free-writing-page">
 *       <div className="writing-area">
 *         <h2>自由写作</h2>
 *         <textarea
 *           value={writingText}
 *           onChange={(e) => setWritingText(e.target.value)}
 *           placeholder="输入你的英文作文..."
 *           rows={8}
 *         />
 *         <button
 *           onClick={handleAnalyze}
 *           disabled={analyzing || !writingText.trim()}
 *         >
 *           {analyzing ? '分析中...' : '获取反馈'}
 *         </button>
 *       </div>
 * 
 *       {feedback && (\n *         <div className="feedback-panel">
 *           <div className="score-card">
 *             <h3>得分</h3>
 *             <div className="score-display">{feedback.score}/100</div>
 *             <p className="comment">{feedback.overallComment}</p>
 *           </div>
 * 
 *           <div className="errors-section">
 *             <h3>语法错误 ({feedback.grammarErrors.length})</h3>
 *             {feedback.grammarErrors.map((error, idx) => (
 *               <div
 *                 key={idx}
 *                 className="error-item"
 *                 onClick={() => setSelectedError(error)}
 *               >
 *                 <span className="error-type">{error.errorType}</span>
 *                 <span className="suggestion">→ {error.suggestion}</span>
 *               </div>
 *             ))}
 *           </div>
 * 
 *           <div className="vocabulary-section">
 *             <h3>词汇建议 ({feedback.vocabularySuggestions.length})</h3>
 *             {feedback.vocabularySuggestions.map((sugg, idx) => (
 *               <div key={idx} className="suggestion-item">
 *                 <span className="original">{sugg.originalWord}</span>
 *                 <span className="arrow">→</span>
 *                 <span className="suggested">{sugg.suggestedWord}</span>
 *                 <span className="reason">({sugg.reason})</span>
 *               </div>
 *             ))}
 *           </div>
 * 
 *           <button onClick={handleGetImprovement}>生成改进版本</button>
 *         </div>
 *       )}
 * 
 *       {selectedError && (
 *         <div className="error-explanation">
 *           <h3>错误说明</h3>
 *           <p>{selectedError.explanation}</p>
 *           <button onClick={() => setSelectedError(null)}>关闭</button>
 *         </div>
 *       )}
 *     </div>
 *   );
 * }
 * ```
 * 
 * 关键点：
 * - 获取输入的写作文本
 * - 调用 WritingFeedbackService.analyzeWriting()
 * - 显示得分、错误和建议
 * - 提供改进版本生成
 * - 支持点击错误查看详细说明
 */

/**
 * ============================================================================
 * 总结：服务集成清单
 * ============================================================================
 * 
 * | 页面 | 主要服务 | 关键方法 | 状态 |
 * |------|---------|---------|------|
 * | WeakVocabularyReviewPage | RecommendationService | recommendCourses() | ✅ 服务完成 |
 * | TaskHistoryPage | TaskRepository | findByUserId(), query() | ✅ 服务完成 |
 * | CourseGeneratorPage | CourseGeneratorService | generateCourseFromText/Audio() | ✅ 服务完成 |
 * | PublisherImportPage | PublisherQueryService | getAvailablePublishers(), queryCurricula(), queryUnits(), generateCourseFromUnit() | ✅ 服务完成 |
 * | FreeWritingPage | WritingFeedbackService | analyzeWriting(), generateImprovedVersion() | ✅ 服务完成 |
 * 
 * 下一步：
 * 1. 按照上述示例，更新实际的 React 组件
 * 2. 添加错误处理和加载状态
 * 3. 添加用户认证集成（userId 来自 auth context）
 * 4. 创建端到端测试
 * 5. 性能优化和 UI 细节调整
 */
