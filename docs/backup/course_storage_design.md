# 课程数据存储方案设计

## 1. 存储方案概述

### 1.1 设计目标
- 统一课程和课时数据结构，确保所有生成方式创建的课程结构一致
- 设计合理的音频文件组织方式，便于管理和访问
- 保证数据一致性和完整性
- 支持覆盖替换功能
- 提高系统可靠性、性能稳定性和健壮性

### 1.2 存储结构设计

#### 1.2.1 数据文件组织
```
data/
├── courses/                # 课程数据根目录
│   ├── {courseId}/         # 课程ID目录
│   │   ├── course.json     # 课程元数据
│   │   └── lessons/        # 课时目录
│   │       └── {lessonId}/ # 课时ID目录
│   │           └── lesson.json # 课时元数据
├── audio/                  # 音频文件根目录
│   ├── {courseId}/         # 课程ID目录
│   │   └── {lessonId}/     # 课时ID目录
│   │       ├── main.mp3    # 课时主音频
│   │       └── sentences/  # 句子音频目录
│   │           └── {sentenceId}.mp3 # 句子音频
└── tts-cache/              # TTS缓存目录（保持不变）
```

#### 1.2.2 音频文件命名规则
- 课时主音频：`main.mp3`
- 句子音频：`{sentenceId}.mp3`
- 单词音频：`{wordId}.mp3`（可选，用于单独的单词发音）

## 2. 数据结构设计

### 2.1 统一的Course和Lesson接口

```typescript
// Course 接口（src/models/course.ts）
export interface Course {
  id: string;              // 课程ID（必填）
  title: string;           // 课程标题（必填）
  description: string;     // 课程描述（必填）
  tags: string[];          // 课程标签（必填，默认空数组）
  difficulty: 'easy' | 'medium' | 'hard'; // 难度（必填）
  type: 'audio' | 'text' | 'ai' | 'pep'; // 课程类型（必填）
  lessons: Lesson[];       // 课时列表（必填，默认空数组）
  createdAt: string;       // 创建时间（必填）
  updatedAt: string;       // 更新时间（必填）
  stats: {
    totalLessons: number;  // 总课时数（必填）
    totalDuration: number; // 总时长（毫秒，必填）
  };                      // 统计信息（必填）
  modesEnabled: string[];  // 启用的模式（必填，默认空数组）
  fields: string[];        // 包含的字段（必填，默认空数组）
  audioFiles: string[];    // 关联的音频文件路径列表（必填，默认空数组）
}

// Lesson 接口（src/models/course.ts）
export interface Lesson {
  id: string;              // 课时ID（必填）
  title: string;           // 课时标题（必填）
  content: string;         // 课时内容（必填）
  contentTranslation: string; // 课时内容翻译（必填）
  sentences: Sentence[];   // 句子列表（必填，默认空数组）
  words: WordEntry[];      // 单词列表（必填，默认空数组）
  audioMeta: AudioMeta;    // 音频元数据（必填）
  createdAt: string;       // 创建时间（必填）
  updatedAt: string;       // 更新时间（必填）
  stats: {
    duration: number;      // 时长（毫秒，必填）
    sentenceCount: number; // 句子数量（必填）
    wordCount: number;     // 单词数量（必填）
  };                      // 统计信息（必填）
  modesEnabled: string[];  // 启用的模式（必填，默认空数组）
  fields: string[];        // 包含的字段（必填，默认空数组）
  audioFiles: string[];    // 关联的音频文件路径列表（必填，默认空数组）
}
```

### 2.2 音频文件关联

- 课程和课时的`audioFiles`字段存储关联音频文件的相对路径
- 相对路径格式：`audio/{courseId}/{lessonId}/{fileName}`
- 示例：`audio/course_123/lesson_456/main.mp3`

## 3. 存储服务设计

### 3.1 核心功能

#### 3.1.1 课程数据管理
- 保存课程：`saveCourse(course: Course): Promise<Course>`
- 获取课程列表：`listCourses(): Promise<Course[]>`
- 获取课程详情：`getCourseById(id: string): Promise<Course | null>`
- 删除课程：`deleteCourse(id: string): Promise<void>`

#### 3.1.2 音频文件管理
- 保存音频文件：`saveAudioFile(courseId: string, lessonId: string, fileName: string, data: Buffer): Promise<string>`
- 获取音频文件路径：`getAudioFilePath(courseId: string, lessonId: string, fileName: string): string`
- 删除音频文件：`deleteAudioFiles(courseId: string, lessonId: string): Promise<void>`

#### 3.1.3 覆盖替换机制
- 保存课程时，检查是否已存在相同ID的课程
- 如存在，更新课程数据并替换相关音频文件
- 支持部分更新（仅更新修改的字段和音频）

### 3.2 实现细节

#### 3.2.1 数据一致性保证
- 使用事务机制，确保课程数据和音频文件的原子性操作
- 保存课程前，先验证数据结构完整性
- 音频文件保存失败时，回滚课程数据更新

#### 3.2.2 性能优化
- 缓存常用课程数据，减少IO操作
- 异步处理音频文件IO，提高响应速度
- 批量处理课时数据，减少数据库交互次数

#### 3.2.3 可靠性设计
- 定期备份课程数据和音频文件
- 实现数据恢复机制，支持从备份恢复
- 对音频文件进行校验，确保文件完整性

## 4. 代码实现计划

### 4.1 核心文件修改

1. **src/models/course.ts**
   - 统一Course和Lesson接口定义
   - 添加必填字段验证
   - 移除冗余字段

2. **src/services/courseStore.ts**
   - 更新课程存储服务，支持统一的数据结构
   - 实现课程数据的文件存储
   - 集成音频文件管理功能

3. **src/services/audioService.ts**
   - 实现音频文件的保存、获取和删除功能
   - 支持音频文件的覆盖替换

4. **课程生成服务**
   - 修改音频课程生成服务
   - 修改AI生成课程服务
   - 修改PEP导入课程服务
   - 确保所有生成服务使用统一的数据结构

### 4.2 测试计划

1. **单元测试**
   - 测试课程数据结构验证
   - 测试课程存储服务的各项功能
   - 测试音频文件管理功能

2. **集成测试**
   - 测试不同课程生成方式的数据一致性
   - 测试覆盖替换功能
   - 测试数据恢复机制

3. **性能测试**
   - 测试课程数据的读写性能
   - 测试音频文件的处理性能
   - 测试大量课程数据下的系统稳定性

## 5. 迁移计划

### 5.1 现有数据迁移
- 编写迁移脚本，将现有课程数据转换为统一格式
- 迁移现有音频文件到新的目录结构
- 验证迁移后的数据一致性

### 5.2 系统升级计划
- 先更新数据结构定义
- 再更新课程存储服务
- 最后更新各课程生成服务
- 逐步迁移现有数据

## 6. 监控和维护

### 6.1 监控指标
- 课程数据读写成功率
- 音频文件处理成功率
- 系统响应时间
- 存储空间使用情况

### 6.2 维护策略
- 定期清理临时文件和过期缓存
- 定期检查数据完整性
- 及时更新依赖库和安全补丁

## 7. 总结

本设计方案统一了课程和课时的数据结构，设计了合理的音频文件组织方式，实现了覆盖替换功能，保证了系统的可靠性、性能稳定性和健壮性。该方案将为后续开发和维护提供良好的基础，便于系统扩展和功能增强。