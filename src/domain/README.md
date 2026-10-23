# domain/ - 领域层

## 职责
包含核心业务逻辑、领域模型和领域服务，是整个应用的核心。

## 子目录

### models/ - 领域模型
定义业务实体和值对象：
- `course.ts` - 课程、课时、句子、单词等模型
- `user.ts` - 用户模型
- `progress.ts` - 学习进度模型

### services/ - 领域服务
实现业务逻辑：
- `courseService.ts` - 课程管理服务
- `progressService.ts` - 进度跟踪服务
- `reviewService.ts` - 复习调度服务
- `aiService.ts` - AI功能服务
- `speechEvalService.ts` - 语音评估服务
- `dictionaryService.ts` - 词典服务

## 设计原则
1. **业务纯粹性**：不包含技术实现细节
2. **框架无关**：不依赖React、Electron等
3. **可测试性**：逻辑清晰，易于单元测试
4. **单向依赖**：仅依赖 core 层，不依赖 lib/ui

## 示例

```typescript
// models/course.ts
export interface Course {
  id: string;
  title: string;
  lessons: Lesson[];
}

// services/courseService.ts
export class CourseService {
  async createCourse(data: CourseData): Promise<Course> {
    // 业务逻辑：验证、创建、持久化
  }
}
```
