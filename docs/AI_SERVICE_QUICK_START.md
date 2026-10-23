# AI 服务快速开始指南

**版本**: 1.0  
**更新日期**: 2026-01-06

---

## 🚀 快速开始（5 分钟）

### 1. 配置 API Key

在应用中配置通义千问（Qwen）API Key：

```typescript
// 方式一：代码配置（开发测试）
import { saveAIConfig } from '@shared/services/ai';

saveAIConfig({
  provider: 'qwen',
  apiKey: 'sk-YOUR_API_KEY_HERE',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-plus'
});
```

```typescript
// 方式二：在浏览器控制台配置
localStorage.setItem('lexitype_ai_config', JSON.stringify({
  provider: 'qwen',
  apiKey: 'sk-YOUR_API_KEY_HERE',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-plus'
}));
```

### 2. 获取 Qwen API Key

1. 访问 [阿里云百炼平台](https://dashscope.aliyuncs.com/)
2. 注册/登录账号
3. 进入"API-KEY 管理"
4. 创建新的 API Key
5. 复制 Key（格式：`sk-xxx`）

### 3. 测试连接

```typescript
import { getAIService } from '@shared/services/ai';

const aiService = getAIService();
const isConnected = await aiService.testConnection();

if (isConnected) {
  console.log('✅ AI 服务连接成功！');
} else {
  console.error('❌ AI 服务连接失败，请检查配置');
}
```

---

## 📚 使用示例

### 示例 1：生成英语课程

```typescript
import { getAIService } from '@shared/services/ai';

const aiService = getAIService();

// 生成课程
const course = await aiService.generateCourse({
  topic: '日常对话',
  level: 'beginner',
  lessonCount: 5,
  wordsPerLesson: 10,
  notes: '适合初学者，注重实用性'
});

console.log('课程名称:', course.courseName);
console.log('课程描述:', course.description);
console.log('课时数:', course.lessons.length);

// 打印第一课内容
const firstLesson = course.lessons[0];
console.log('第一课:', firstLesson.lessonName);
console.log('单词:', firstLesson.words.map(w => w.word).join(', '));
```

**预期输出**：
```json
{
  "courseName": "Daily Conversation - Beginner",
  "description": "A practical course for beginners focusing on everyday conversations",
  "lessons": [
    {
      "lessonName": "Greetings",
      "description": "Learn basic greetings",
      "words": [
        {
          "word": "hello",
          "meaning": "a greeting",
          "translation": "你好",
          "phonetic": "/həˈloʊ/",
          "example": "Hello, how are you?",
          "exampleTranslation": "你好，你好吗？",
          "partOfSpeech": "interjection"
        }
        // ... 更多单词
      ]
    }
    // ... 更多课时
  ]
}
```

### 示例 2：词汇增强

```typescript
// 为单词列表添加音标、例句、翻译
const words = ['hello', 'goodbye', 'thank', 'please', 'welcome'];

const enrichedWords = await aiService.enrichVocabulary({
  words,
  includeExamples: true,
  includePhonetics: true
});

enrichedWords.forEach(word => {
  console.log(`${word.word} [${word.phonetic}]`);
  console.log(`  含义: ${word.meaning}`);
  console.log(`  例句: ${word.example}`);
  console.log('');
});
```

### 示例 3：翻译

```typescript
// 英译中
const translation = await aiService.translate({
  text: 'Hello, welcome to our English learning platform.',
  sourceLang: 'en',
  targetLang: 'zh'
});

console.log('翻译:', translation);
// 输出: "你好，欢迎来到我们的英语学习平台。"
```

### 示例 4：AI 对话

```typescript
import type { AIMessage } from '@shared/services/ai';

const messages: AIMessage[] = [
  {
    role: 'system',
    content: 'You are a helpful English teacher.'
  },
  {
    role: 'user',
    content: 'How do I say "你好" in English?'
  }
];

const response = await aiService.chat(messages);
console.log('AI:', response);
// 输出: "Hello" or "Hi" are the common ways to say "你好" in English.
```

### 示例 5：从音频生成课程

```typescript
// 假设已有音频转录文本
const transcription = `
  Hello everyone. Today we will learn about colors.
  Red, blue, green, yellow, and orange are basic colors.
  Let's practice using these words in sentences.
`;

const course = await aiService.generateCourseFromAudio(
  transcription,
  3,  // 3 课时
  5   // 每课 5 个单词
);

console.log('从音频生成的课程:', course);
```

### 示例 6：流式生成（实时显示进度）

```typescript
let fullContent = '';

await aiService.generateCourse(
  {
    topic: 'Weather',
    level: 'intermediate',
    lessonCount: 3,
    wordsPerLesson: 8
  },
  // 进度回调
  (content) => {
    fullContent = content;
    console.log('生成进度:', content.length, '字符');
    // 更新 UI 显示进度
  }
);

console.log('生成完成！', fullContent);
```

---

## 🎯 AILab 功能使用

### 1. AI 课程生成器

**位置**: AI 实验室 → 课程生成器

**步骤**:
1. 输入课程主题（如"旅游英语"）
2. 选择难度级别（初级/中级/高级）
3. 设置课程数量（1-50）
4. 设置每课单词数（5-50）
5. 添加附加说明（可选）
6. 点击"生成课程"

**示例配置**:
```
主题: Travel English
级别: Intermediate
课程数: 5
单词数: 15
说明: Focus on airport, hotel, and restaurant scenarios
```

### 2. 音频导入向导

**位置**: AI 实验室 → 音频导入向导

**步骤**:
1. 拖拽音频文件（MP3/WAV/M4A）
2. 等待 ASR 识别（TODO: 需集成 ASR）
3. 查看转录文本
4. 点击"生成课程"
5. 课程自动保存

### 3. 教材导入

**位置**: AI 实验室 → 教材导入

**步骤**:
1. 选择导入方式：
   - 文本输入：直接粘贴文本
   - 文件上传：上传 TXT/PDF/DOCX
2. 点击"开始导入"
3. AI 自动提取词汇并生成课程

### 4. AI 写作助手

**位置**: AI 实验室 → 写作助手

**步骤**:
1. 输入英文文本
2. 点击"AI 优化"
3. 查看优化结果
4. 复制改进后的文本

**示例**:
```
输入: I go to school yesterday and meet my friend.
输出: I went to school yesterday and met my friend.
```

### 5. AI 对话练习

**位置**: AI 实验室 → 对话练习

**步骤**:
1. 在输入框输入英文消息
2. 按回车或点击"发送"
3. AI 实时回复
4. 继续对话练习

---

## 🛠️ 高级配置

### 切换 AI 模型

```typescript
import { saveAIConfig } from '@shared/services/ai';

// 使用 Qwen Turbo（更快）
saveAIConfig({
  provider: 'qwen',
  apiKey: 'sk-xxx',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-turbo'
});

// 使用 Qwen Max（更强）
saveAIConfig({
  provider: 'qwen',
  apiKey: 'sk-xxx',
  endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
  model: 'qwen-max'
});
```

### 调整生成参数

```typescript
const result = await aiService.call(
  'Generate 5 English words about food',
  'You are a helpful assistant',
  {
    temperature: 0.7,  // 创造性（0-1）
    maxTokens: 1000,   // 最大生成长度
    timeout: 30000     // 超时时间（毫秒）
  }
);
```

### 自定义提示词

```typescript
import { buildCourseGenerationPrompt } from '@shared/services/ai';

// 查看默认提示词
const prompt = buildCourseGenerationPrompt({
  topic: 'Sports',
  level: 'beginner',
  lessonCount: 3,
  wordsPerLesson: 10
});

console.log('提示词:', prompt);

// 使用自定义提示词
const customPrompt = `
Generate a typing practice course about Sports for beginners.
Include 3 lessons with 10 words each.
Focus on team sports like football, basketball, and volleyball.
`;

const result = await aiService.call(
  customPrompt,
  'You are an English teacher'
);
```

---

## ⚠️ 常见问题

### Q1: "API Key 不能为空"

**解决**: 检查配置是否正确保存
```typescript
import { loadAIConfig } from '@shared/services/ai';
console.log('当前配置:', loadAIConfig());
```

### Q2: "请求失败: 401"

**原因**: API Key 无效或过期

**解决**:
1. 检查 API Key 格式（应以 `sk-` 开头）
2. 在阿里云控制台验证 Key 是否有效
3. 重新生成新的 API Key

### Q3: "请求超时"

**原因**: 网络问题或生成内容过长

**解决**:
```typescript
// 增加超时时间
const result = await aiService.call(
  prompt,
  systemPrompt,
  { timeout: 60000 }  // 60 秒
);
```

### Q4: "无法解析 AI 响应"

**原因**: AI 返回格式不符合 JSON

**解决**: 检查提示词，确保要求返回 JSON 格式
```typescript
const prompt = `
Generate course content.
IMPORTANT: Return ONLY valid JSON, no markdown code blocks.
`;
```

### Q5: 如何查看 AI 调用日志？

```typescript
// 打开浏览器开发者工具
// 所有 AI 调用都会输出日志
// 格式: [Qwen] Calling Qwen API...
```

---

## 📊 费用说明

### Qwen 定价（参考）

| 模型 | 输入价格 | 输出价格 | 适用场景 |
|------|---------|---------|---------|
| qwen-turbo | ¥0.3/千tokens | ¥0.6/千tokens | 快速生成 |
| qwen-plus | ¥0.8/千tokens | ¥2/千tokens | **推荐** |
| qwen-max | ¥20/千tokens | ¥60/千tokens | 高级任务 |

### 估算示例

**生成 5 课时课程**（每课 10 单词）：
- 输入: ~500 tokens
- 输出: ~2000 tokens
- 费用: ¥0.8 × 0.5 + ¥2 × 2 = **¥4.4**

**词汇增强**（10 个单词）：
- 输入: ~100 tokens
- 输出: ~800 tokens
- 费用: ¥0.8 × 0.1 + ¥2 × 0.8 = **¥1.68**

---

## 🔗 相关文档

- [Phase 9 完成报告](./PHASE_9_COMPLETION_REPORT.md)
- [AI 服务 API 文档](../vue-app/src/shared/services/ai/README.md)
- [通义千问官方文档](https://help.aliyun.com/zh/dashscope/)

---

## 📞 技术支持

遇到问题？

1. 查看 [常见问题](#常见问题)
2. 检查浏览器控制台错误信息
3. 查看 [Phase 9 完成报告](./PHASE_9_COMPLETION_REPORT.md)

---

**最后更新**: 2026-01-06  
**版本**: 1.0
