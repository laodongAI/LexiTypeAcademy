# 设计修正实现指南

**文档日期**: 2025-01-17  
**目标**: 指导如何将两个核心设计修正集成到现有代码库

---

## 修正 1：跟读录音回放功能

### 文件位置
- **文档**: `docs/requirements/english-learning-requirements-v0.4.0.md` (第 3.3.2 练习流程)
- **新代码**: `src/app/hooks/useFollowAlongRecordingPlayback.ts` ✅ 已创建
- **现有代码**: `src/app/pages/FollowAlongPractice/` (需要集成)

### 实现步骤

#### Step 1: 在现有组件中使用新 Hook

```tsx
// src/app/pages/FollowAlongPractice/FollowAlongPracticeView.tsx

import { useFollowAlongRecordingPlayback } from '@/app/hooks/useFollowAlongRecordingPlayback';
import { useASREvaluation } from '@/app/hooks/useASREvaluation'; // 现有 ASR 服务

export function FollowAlongPracticeView() {
  const { state, startRecording, stopRecording, replayUserRecording, skipPlayback } =
    useFollowAlongRecordingPlayback({
      autoPlayAfterRecording: true, // 自动进入回放阶段
      onEvaluationRequired: async (audioBlob) => {
        // 调用现有的 ASR 评测服务
        const result = await asrEvaluation.evaluate(audioBlob, currentSentence);
        // 显示评测结果
        handleEvaluationResult(result);
      },
      onError: (error) => {
        console.error('跟读错误:', error);
        showErrorMessage(error.message);
      }
    });

  // ... 其他逻辑
}
```

#### Step 2: 更新 UI 流程

在跟读练习的 UI 中：

```tsx
// 显示句子和音频播放按钮（现有逻辑）
<div className="sentence-display">
  <h2>{currentSentence.text}</h2>
  <button onClick={playReferenceAudio}>播放标准音频</button>
</div>

// 录音按钮（新增交互）
<div className="recording-section">
  {state.phase === 'idle' && (
    <button 
      onClick={startRecording}
      className="record-button"
    >
      开始录音
    </button>
  )}

  {state.phase === 'recording' && (
    <div className="recording-indicator">
      <span className="pulse-dot">●</span>
      已录音: {state.recordingDuration}s
      <button onClick={stopRecording}>停止</button>
    </div>
  )}
</div>

// 回放用户录音（新增）
{state.phase === 'playback' && (
  <div className="playback-section">
    <h3>你的读音</h3>
    <div className="playback-progress">
      <div 
        className="progress-bar"
        style={{ width: `${state.playbackProgress}%` }}
      />
    </div>
    {state.canReplayUserRecording && (
      <button onClick={replayUserRecording}>
        重新听
      </button>
    )}
    {state.canSkipPlayback && (
      <button onClick={skipPlayback}>
        直接评测
      </button>
    )}
  </div>
)}

// 评测结果（现有逻辑）
{state.phase === 'evaluating' && (
  <div className="evaluating">正在评测...</div>
)}
```

#### Step 3: 集成 ASR 评测服务

确保现有的 ASR 服务可以被调用：

```tsx
async function handleASREvaluation(audioBlob: Blob) {
  try {
    const result = await asrService.evaluate({
      audio: audioBlob,
      referenceText: currentSentence.text,
      // 其他参数
    });

    // 处理评测结果
    displayEvaluationResult({
      score: result.score,
      accuracy: result.accuracy,
      errorPhonemes: result.errorPhonemes, // 错误音素高亮
      feedback: result.feedback
    });

    // 根据分数决定是否自动推进
    if (result.score >= 80) {
      autoAdvanceToNextSentence();
    } else {
      showRetryOption();
    }
  } catch (error) {
    handleError(error);
  }
}
```

---

## 修正 2：教材 AI 查询导入

### 文件位置
- **文档**: `docs/requirements/english-learning-requirements-v0.4.0.md` (第 3.3.5 智能教材导入流程)
- **新代码**: `src/infrastructure/services/publisherQueryService.ts` ✅ 已创建
- **现有代码**: `src_bak/components/AILab.tsx` (lines 442-592, PEP 导入模式)

### 实现步骤

#### Step 1: 创建 AI 查询服务实例

```tsx
// src/infrastructure/services/index.ts

import { createPublisherQueryService } from './publisherQueryService';

export const publisherQueryService = createPublisherQueryService(
  process.env.REACT_APP_OPENAI_API_KEY!
);
```

#### Step 2: 更新 AILab 组件中的教材导入模式

**现有状态** (PEP 文本粘贴):
```tsx
const [pepText, setPepText] = useState('');
const [pepSelections, setPepSelections] = useState({});
// ... 解析 PEP 文本
```

**新状态** (AI 查询导航):
```tsx
// 第 1 步：出版社选择
const [publishers] = useState(publisherQueryService.getAvailablePublishers());
const [selectedPublisher, setSelectedPublisher] = useState<string | null>(null);

// 第 2 步：AI 查询课程系列
const [curricula, setCurricula] = useState<Curriculum[]>([]);
const [selectedCurriculum, setSelectedCurriculum] = useState<string | null>(null);

// 第 3 步：AI 查询单元列表
const [courseUnits, setCourseUnits] = useState<CourseUnit[]>([]);
const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

// 第 4 步：生成课程
const [generatedCourse, setGeneratedCourse] = useState<GeneratedCourse | null>(null);
const [isGenerating, setIsGenerating] = useState(false);

// 导航状态
const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
```

#### Step 3: 实现四步导航流程

```tsx
// 第 2 步：用户选择出版社后，AI 查询课程系列
async function handlePublisherSelect(publisherId: string) {
  setSelectedPublisher(publisherId);
  
  try {
    setIsGenerating(true);
    const curricula = await publisherQueryService.queryPublisherCurricula(publisherId);
    setCurricula(curricula);
    setCurrentStep(2);
  } catch (error) {
    showError(`查询课程系列失败: ${error.message}`);
  } finally {
    setIsGenerating(false);
  }
}

// 第 3 步：用户选择课程系列后，AI 查询单元
async function handleCurriculumSelect(curriculumId: string) {
  const curriculum = curricula.find(c => c.id === curriculumId);
  if (!curriculum) return;

  setSelectedCurriculum(curriculum.name);
  
  try {
    setIsGenerating(true);
    const units = await publisherQueryService.queryUnitsByCurriculum(
      selectedPublisher!,
      curriculum.name
    );
    setCourseUnits(units);
    setCurrentStep(3);
  } catch (error) {
    showError(`查询单元列表失败: ${error.message}`);
  } finally {
    setIsGenerating(false);
  }
}

// 第 4 步：用户选择单元后，AI 生成课程
async function handleUnitSelect(unitId: string) {
  const unit = courseUnits.find(u => u.id === unitId);
  if (!unit) return;

  setSelectedUnit(unit.unitId);
  
  try {
    setIsGenerating(true);
    const course = await publisherQueryService.generateCourseFromUnit(
      selectedPublisher!,
      selectedCurriculum!,
      unit.unitId,
      {
        includeVocabulary: true,
        includeSentences: true,
        includeDialogue: false,
        enrichWithAI: true
      }
    );
    setGeneratedCourse(course);
    setCurrentStep(4);
  } catch (error) {
    showError(`生成课程失败: ${error.message}`);
  } finally {
    setIsGenerating(false);
  }
}

// 保存生成的课程
async function saveCourse() {
  if (!generatedCourse) return;

  try {
    // 使用现有的课程工厂构建完整课程对象
    const courseObject = await courseFactory.buildCourseFromGeneratedData(
      generatedCourse
    );
    
    // 保存到数据库
    await courseService.save(courseObject);
    
    showSuccess('课程已保存！');
    // 重置状态
    reset();
  } catch (error) {
    showError(`保存课程失败: ${error.message}`);
  }
}
```

#### Step 4: 更新 UI 显示四步流程

```tsx
// src_bak/components/AILab.tsx - pep subView 部分

<div className="ai-lab-pep-import">
  {/* 进度指示器 */}
  <div className="progress-steps">
    <div className={`step ${currentStep >= 1 ? 'active' : ''}`}>
      <span>1</span> 选择出版社
    </div>
    <div className={`step ${currentStep >= 2 ? 'active' : ''}`}>
      <span>2</span> 选择课程系列
    </div>
    <div className={`step ${currentStep >= 3 ? 'active' : ''}`}>
      <span>3</span> 选择单元
    </div>
    <div className={`step ${currentStep >= 4 ? 'active' : ''}`}>
      <span>4</span> 生成课程
    </div>
  </div>

  {/* 第 1 步：选择出版社 */}
  {currentStep === 1 && (
    <div className="step-content">
      <h3>选择教材出版社</h3>
      <div className="publisher-list">
        {publishers.map(pub => (
          <button
            key={pub.id}
            onClick={() => handlePublisherSelect(pub.id)}
            className={`publisher-option ${selectedPublisher === pub.id ? 'selected' : ''}`}
          >
            {pub.name}
            <small>{pub.description}</small>
          </button>
        ))}
      </div>
    </div>
  )}

  {/* 第 2 步：选择课程系列 */}
  {currentStep === 2 && (
    <div className="step-content">
      <h3>选择课程系列</h3>
      {isGenerating ? (
        <div className="loading">正在查询课程系列...</div>
      ) : (
        <div className="curriculum-list">
          {curricula.map(curr => (
            <button
              key={curr.id}
              onClick={() => handleCurriculumSelect(curr.id)}
              className="curriculum-option"
            >
              {curr.name}
              <small>{curr.grades.join(' / ')}</small>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setCurrentStep(1)}>上一步</button>
    </div>
  )}

  {/* 第 3 步：选择单元 */}
  {currentStep === 3 && (
    <div className="step-content">
      <h3>选择单元</h3>
      {isGenerating ? (
        <div className="loading">正在查询单元列表...</div>
      ) : (
        <div className="units-list">
          {courseUnits.map(unit => (
            <button
              key={unit.id}
              onClick={() => handleUnitSelect(unit.id)}
              className="unit-option"
            >
              {unit.unitId} - {unit.title}
              <small>{unit.keywords.join(', ')}</small>
            </button>
          ))}
        </div>
      )}
      <button onClick={() => setCurrentStep(2)}>上一步</button>
    </div>
  )}

  {/* 第 4 步：预览和保存 */}
  {currentStep === 4 && (
    <div className="step-content">
      <h3>课程内容预览</h3>
      {isGenerating ? (
        <div className="loading">正在生成课程...</div>
      ) : generatedCourse ? (
        <div className="course-preview">
          <h4>{generatedCourse.title}</h4>
          <p>难度级别: {generatedCourse.level}</p>
          <div className="lessons">
            {generatedCourse.lessons.map((lesson, idx) => (
              <div key={idx} className="lesson">
                <h5>{lesson.type === 'vocabulary' ? '词汇' : '句子'}</h5>
                {lesson.words?.length && (
                  <div className="word-list">
                    {lesson.words.slice(0, 5).map(word => (
                      <div key={word.id} className="word">
                        <span className="en">{word.text}</span>
                        <span className="phonetic">{word.pronunciation}</span>
                        <span className="cn">{word.translation}</span>
                      </div>
                    ))}
                    {lesson.words.length > 5 && (
                      <div className="more">还有 {lesson.words.length - 5} 个词</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <button onClick={saveCourse} className="save-button">
            保存课程
          </button>
        </div>
      ) : null}
      <button onClick={() => setCurrentStep(3)}>上一步</button>
    </div>
  )}
</div>
```

---

## 代码复用指南

### 现有可复用代码

#### 1. 课程构建工厂 (courseFactory.ts)

```typescript
// 原有函数可直接复用
import { courseFactory } from '@/infrastructure/services/courseFactory';

// 从 AI 生成的数据构建完整课程对象
const course = await courseFactory.buildCourseFromGeneratedData({
  title: 'Unit 1 - Numbers',
  lessons: [
    {
      type: 'vocabulary',
      words: [
        {
          text: 'one',
          pronunciation: '/wʌn/',
          translation: '一',
          // ...
        }
      ]
    }
  ]
});
```

#### 2. PEP 导入服务中的数据验证

```typescript
// 原 pepImportService.ts 中的验证函数可复用
import { validateCourse, validateLesson } from '@/infrastructure/services/pepImportService';

// 验证 AI 生成的课程数据
if (!validateCourse(generatedCourse)) {
  throw new Error('生成的课程数据格式错误');
}
```

### 新增代码的集成点

| 新增代码 | 集成到 | 说明 |
|---------|-------|------|
| `publisherQueryService.ts` | AILab.tsx 的 'pep' 子视图 | 提供 AI 查询功能 |
| `useFollowAlongRecordingPlayback.ts` | FollowAlongPracticeView | 提供录音回放能力 |

---

## 测试清单

### 跟读录音回放测试

- [ ] 点击"开始录音"能正常启动录音
- [ ] 录音时长显示正确
- [ ] 停止录音后自动进入回放阶段
- [ ] 用户录音能正确播放
- [ ] 播放进度条显示正确
- [ ] 回放完成后自动进入 ASR 评测
- [ ] "重新听"按钮能重复播放
- [ ] "直接评测"按钮能跳过回放
- [ ] 错误处理正确（无麦克风权限等）

### 教材 AI 查询导入测试

- [ ] 能显示出版社列表
- [ ] 选择出版社后 AI 能查询课程系列
- [ ] 选择课程系列后 AI 能查询单元列表
- [ ] 选择单元后 AI 能生成课程
- [ ] 生成的课程数据格式正确
- [ ] 生成的课程能正确保存到数据库
- [ ] 各步骤都有适当的加载动画
- [ ] 错误处理正确（API 失败、网络超时等）
- [ ] 缓存机制正常工作

---

## API 依赖

### 新增 API 调用

| 服务 | 用途 | 现有实现 |
|------|------|---------|
| OpenAI API (GPT-3.5/4) | AI 查询课程系列、单元、生成课程 | ✅ 在 `publisherQueryService.ts` |
| 浏览器 MediaRecorder API | 录音 | ✅ 在 `useFollowAlongRecordingPlayback.ts` |
| 现有 ASR 服务 | 评测用户发音 | 需集成 |

### 配置要求

```env
# .env.local
REACT_APP_OPENAI_API_KEY=sk-...
REACT_APP_OPENAI_MODEL=gpt-4  # 推荐 gpt-4，accuracy 更高
```

---

## 后续优化方向

1. **缓存优化**: 添加本地存储，避免重复查询同一出版社的课程
2. **离线模式**: 预加载主流教材，支持离线使用
3. **Prompt 优化**: 收集用户反馈，改进 AI 查询的准确度
4. **用户体验**: 添加搜索功能，快速查找特定课程
5. **性能优化**: 实现分页加载，处理大量教材数据
6. **多语言支持**: 扩展到其他语言教材

---

**实现状态**: 
- ✅ 文档修正完成
- ✅ 代码示例创建
- ⏳ 等待集成到现有项目

**下一步**: 根据本指南，将新代码集成到 AILab.tsx 和 FollowAlongPracticeView 组件中。
