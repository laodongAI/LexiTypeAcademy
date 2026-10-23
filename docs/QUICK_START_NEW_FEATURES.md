# 快速开始指南 - 新增功能使用

## 🎯 核心功能概览

基于 `english-learning-requirements-v0.4.0.md` 需求文档，我已实现以下核心功能：

### 1️⃣ 自动跟读练习（含无声检测）
### 2️⃣ 学习进度热力图
### 3️⃣ 技能雷达图评估
### 4️⃣ 补救课程自动生成

---

## 🚀 功能1: 增强版跟读练习

### 使用路径
```
英语课程 → 选择课程 → 开始跟读 → EnhancedFollowAlongPracticePage
```

### 功能特点
1. **自动化流程**
   - 播放示范音频后自动开始录音
   - 3秒无声自动停止录音
   - 无需手动点击开始/停止

2. **无声重试机制**
   - 检测到无声：显示提示"请跟我朗读"
   - 自动重试（最多3次）
   - 超过3次：自动跳到下一句

3. **实时反馈**
   - 音量条实时显示
   - 录音状态动画
   - 评分详情（准确度/流畅度/完整度）

### 代码集成示例

```tsx
import EnhancedFollowAlongPracticePage from '@/ui/pages/courses/EnhancedFollowAlongPracticePage';

// 在 App.tsx 或路由中使用
<EnhancedFollowAlongPracticePage 
  courseId="your_course_id" 
  onBack={() => navigate('/courses')}
/>
```

---

## 📊 功能2: 学习热力图

### 使用示例

```tsx
import { LearningHeatmap } from '@/ui/components/LearningHeatmap';
import { LearningProgressVisualizationService } from '@/domain/services/LearningProgressVisualizationService';

function HistoryPage() {
  const service = new LearningProgressVisualizationService();
  
  // 从数据库加载学习记录
  const records = await loadLearningRecords();
  
  // 生成热力图数据（最近30天）
  const heatmapData = service.generateHeatmapData(records, 30);
  
  // 点击日期查看详情的回调
  const handleDateClick = (date: string) => {
    return service.getDayDetailData(records, date);
  };
  
  return (
    <LearningHeatmap 
      data={heatmapData}
      onDateClick={handleDateClick}
      dailyGoalMinutes={15}
    />
  );
}
```

### 显示效果
```
    Sun Mon Tue Wed Thu Fri Sat
W1   ▯   ▮   ▯   ▮▮  ▮▮▮ ▮   ▯
W2   ▯   ▯   ▮   ▮   ▮   ▮   ▮▮
W3   ▮▮▮ ▮▮▮ ▮▮▮ ▮▮▮ ▯   ▯   ▯
W4   ▯   ▮   ▯   ▮   ▮▮  ▮▮▮ ▮▮▮
```

- **颜色深浅**：表示学习强度（无/轻/中/重）
- **悬停提示**：显示日期、练习次数、时长、平均分
- **点击日期**：弹出详情模态框

---

## 🎯 功能3: 技能雷达图

### 使用示例

```tsx
import { SkillRadarChart } from '@/ui/components/SkillRadarChart';
import { LearningProgressVisualizationService } from '@/domain/services/LearningProgressVisualizationService';

function SkillDashboard() {
  const service = new LearningProgressVisualizationService();
  
  // 加载最近的学习记录（如最近50条）
  const recentRecords = await loadRecentRecords(50);
  
  // 生成雷达图数据
  const radarData = service.generateSkillRadarData(recentRecords);
  
  return (
    <SkillRadarChart 
      data={radarData}
      size={300}
      showLabels={true}
    />
  );
}
```

### 评估维度

| 维度 | 说明 | 计算方式 |
|------|------|----------|
| 🎯 准确度 | 发音和拼写准确率 | 平均 accuracy 分数 |
| 🌊 流畅度 | 朗读流畅性 | 平均 fluency 分数 |
| ✅ 完整度 | 练习完成情况 | 平均 completeness 分数 |
| 📊 稳定性 | 成绩波动情况 | 标准差倒数 |
| 📈 进步度 | 进步速度 | 前后半段对比 |

---

## 🔄 功能4: 补救课程自动生成

### 自动触发条件
- 累计 **5个或更多** 错误记录
- 错误类型会被自动分类

### 错误类型分类

| 错误类型 | 特征识别 | 生成课程 |
|---------|---------|---------|
| PRONUNCIATION | ASR置信度<60% | 音素/音标强化 |
| FLUENCY | 时长>预期×1.5 | 连读、节奏训练 |
| GRAMMAR | 句法异常 | 语法专项 |
| VOCABULARY | 单词不会 | 词汇上下文 |
| COMPLETENESS | 完成度<80% | 简化版课程 |

### 代码集成示例

```typescript
import { RemediationCourseService, ErrorType } from '@/domain/services/RemediationCourseService';

// 在跟读练习中收集错误
const errorRecords: ErrorRecord[] = [];

// 当用户得分<80时记录错误
if (score < 80) {
  errorRecords.push({
    lessonId: currentLesson.id,
    courseId: courseId,
    errorType: ErrorType.PRONUNCIATION,
    timestamp: new Date(),
    details: {
      confidence: asrResult.confidence,
      text: currentLesson.text
    }
  });
}

// 练习结束后检查是否生成补救课程
const remediationService = new RemediationCourseService();

if (remediationService.shouldGenerateRemediation(errorRecords)) {
  const remediationCourse = await remediationService.generateRemediationCourse(
    errorRecords,
    userId
  );
  
  console.log(`生成补救课程: ${remediationCourse.title}`);
  console.log(`包含 ${remediationCourse.lessons.length} 个练习`);
  
  // TODO: 保存到数据库并显示给用户
}
```

---

## 📦 集成到现有系统

### 步骤1: 在历史记录页面添加可视化

编辑 `src/ui/pages/history/HistoryPage.tsx`：

```tsx
import { LearningHeatmap } from '@/ui/components/LearningHeatmap';
import { SkillRadarChart } from '@/ui/components/SkillRadarChart';
import { LearningProgressVisualizationService } from '@/domain/services/LearningProgressVisualizationService';

export const HistoryPage: React.FC = () => {
  const service = new LearningProgressVisualizationService();
  const [records, setRecords] = useState([]);
  
  useEffect(() => {
    // 从IndexedDB加载学习记录
    loadRecords().then(setRecords);
  }, []);
  
  const heatmapData = service.generateHeatmapData(records, 30);
  const radarData = service.generateSkillRadarData(records);
  
  return (
    <div className="space-y-6">
      <LearningHeatmap 
        data={heatmapData}
        onDateClick={(date) => service.getDayDetailData(records, date)}
      />
      
      <SkillRadarChart data={radarData} />
      
      {/* 其他历史记录内容 */}
    </div>
  );
};
```

### 步骤2: 替换现有跟读页面

编辑 `src/App.tsx`：

```tsx
import EnhancedFollowAlongPracticePage from '@/ui/pages/courses/EnhancedFollowAlongPracticePage';

// 在路由中替换
case 'follow-along-practice':
  return React.createElement(EnhancedFollowAlongPracticePage, {
    courseId: practiceData?.courseId || '',
    onBack: () => setCurrentPage('courses')
  });
```

### 步骤3: 集成补救课程到复习模块

编辑 `src/ui/pages/review/ReviewPage.tsx`：

```tsx
// 在复习页面显示补救课程列表
const remediationCourses = await db.courses
  .where('source')
  .equals('Remedial')
  .toArray();

// 渲染补救课程卡片
{remediationCourses.map(course => (
  <RemediationCourseCard 
    key={course.id}
    course={course}
    onStart={() => startCourse(course.id)}
  />
))}
```

---

## 🔍 数据持久化需求

### 当前状态
⚠️ **目前使用模拟数据，需要实现真实数据持久化**

### 需要添加的 IndexedDB 表

#### 1. learning_records 表
```typescript
interface LearningRecord {
  recordId: string;         // 主键
  userId: string;
  courseId: string;
  lessonId: string;
  mode: string;            // dictation/follow/translation
  score: number;
  breakdown: {
    accuracy: number;
    fluency: number;
    completeness: number;
  };
  createdAt: Date;
  duration: number;        // 秒
}
```

#### 2. error_records 表
```typescript
interface ErrorRecord {
  errorId: string;         // 主键
  userId: string;
  lessonId: string;
  courseId: string;
  errorType: string;
  timestamp: Date;
  details: object;
}
```

#### 3. remediation_courses 表
```typescript
// 使用现有 courses 表，但 source = 'Remedial'
// 需要额外字段：
interface RemediationCourse extends Course {
  sourceErrors: string[];  // 源错误ID数组
  remedialType: string;    // 错误类型
}
```

### 数据加载示例

```typescript
// 加载学习记录用于可视化
async function loadLearningRecords(days: number = 30): Promise<LearningRecord[]> {
  const db = await getDatabase();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return db.learning_records
    .where('createdAt')
    .above(cutoffDate)
    .toArray();
}

// 保存学习记录
async function saveLearningRecord(record: LearningRecord): Promise<void> {
  const db = await getDatabase();
  await db.learning_records.add(record);
}
```

---

## 🧪 测试建议

### 单元测试

```typescript
// AudioRecordingService 测试
describe('AudioRecordingService', () => {
  it('应该在3秒无声后自动停止', async () => {
    const service = new AudioRecordingService();
    // ... 测试逻辑
  });
  
  it('应该正确检测音频有效性', async () => {
    // ... 测试逻辑
  });
});

// RemediationCourseService 测试
describe('RemediationCourseService', () => {
  it('应该在5个错误时生成补救课程', async () => {
    const service = new RemediationCourseService();
    const errors = createMockErrors(5);
    expect(service.shouldGenerateRemediation(errors)).toBe(true);
  });
});
```

### 集成测试

1. **跟读流程测试**
   - 播放音频 → 自动录音 → 评测 → 显示结果
   - 无声检测 → 重试提示 → 自动重新录音
   - 3次失败 → 自动跳过

2. **数据可视化测试**
   - 加载30天数据 → 渲染热力图
   - 点击日期 → 显示详情
   - 加载学习记录 → 生成雷达图

3. **补救课程测试**
   - 累计5个错误 → 自动生成课程
   - 检查课程内容 → 验证与错误类型匹配

---

## 📞 技术支持

### 常见问题

**Q: 麦克风权限被拒绝怎么办？**  
A: 在浏览器设置中允许麦克风权限，或检查系统设置中的麦克风访问权限。

**Q: 录音无法自动停止？**  
A: 检查 `silenceThreshold` 和 `silenceDuration` 配置是否合理，默认值为20dB和3000ms。

**Q: 热力图没有数据？**  
A: 确保已加载学习记录，并且记录包含 `createdAt` 字段。

**Q: 补救课程没有生成？**  
A: 检查错误记录数量是否≥5，以及 `errorRecords` 数组是否正确收集。

### 联系方式

- **需求问题**: 查阅 `docs/requirements/english-learning-requirements-v0.4.0.md`
- **实现进度**: 查阅 `IMPLEMENTATION_PROGRESS_PHASE1.md`
- **代码问题**: 参考各文件顶部的详细注释

---

**最后更新**: 2025-12-08  
**文档版本**: v1.0
