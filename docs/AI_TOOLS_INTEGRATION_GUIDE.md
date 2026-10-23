# AI 工具模块集成快速指南

## 🚀 快速开始

### 第 1 步：检查文件结构

确认以下文件已创建：

```
src/renderer/
├── views/
│   └── AIToolsOptimizedPage.vue          ✅ 主页面
└── components/
    └── ai/
        ├── CourseGeneratorPanel.vue      ✅ 课程生成面板
        ├── TextbookImportPanel.vue       ✅ 教材导入面板
        ├── AIChatPanel.vue               ✅ AI 对话面板
        ├── AudioImportPanel.vue          ✅ 音频导入面板
        └── AISettingsPanel.vue           ✅ 设置面板
```

### 第 2 步：更新路由配置

编辑 `src/renderer/router/index.ts`，添加以下路由：

```typescript
import AIToolsOptimizedPage from '../views/AIToolsOptimizedPage.vue'

const routes = [
  // ... 其他路由
  {
    path: '/ai-tools',
    name: 'AITools',
    component: AIToolsOptimizedPage,
    meta: {
      title: 'AI 工具'
    }
  },
  // ... 其他路由
]
```

### 第 3 步：更新导航菜单

在 `src/renderer/components/Sidebar.vue` 或 `MainLayout.vue` 中添加菜单项：

```vue
<el-menu-item index="/ai-tools" @click="goToAITools">
  <el-icon><IconAI /></el-icon>
  <span>AI 工具</span>
</el-menu-item>
```

### 第 4 步：确保 CSS 变量定义

检查全局样式文件中是否定义了以下 CSS 变量：

```css
:root {
  --text-color: #303133;
  --bg-color: #ffffff;
  --border-color-light: #ebeef5;
  --bg-color-sidebar: #f5f7fa;
  --primary-color: #409eff;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text-color: #e4e7eb;
    --bg-color: #1a1a1a;
    --border-color-light: #3e3e3e;
    /* ... */
  }
}
```

### 第 5 步：启动开发服务器

```bash
npm run dev
```

访问 `http://localhost:5174/ai-tools` 查看新的 AI 工具页面。

---

## 📋 核心功能说明

### 1. 快速启动区
- 显示 4 张卡片，代表 4 个主功能
- 卡片可点击，直接切换到对应标签页
- 悬停时显示向上移动和阴影效果

### 2. 标签页系统

#### 课程生成标签页
```vue
<!-- 用户输入主题、选择难度、选择规模，生成课程 -->
<el-tab-pane label="🎓 课程生成" name="generate">
  <CourseGeneratorPanel
    :form="courseForm"
    :loading="courseGenerating"
    :pendingCourse="pendingCourse"
    @generate="generateCourse"
    @save="saveCourse"
    @clear="clearPendingCourse"
  />
</el-tab-pane>
```

#### 教材导入标签页
```vue
<!-- 用户上传文本，AI 解析为课程 -->
<el-tab-pane label="📁 教材导入" name="import">
  <TextbookImportPanel
    :form="textbookImportForm"
    :loading="textbookImporting"
    @import="importFromTextbook"
    @save="saveCourse"
  />
</el-tab-pane>
```

#### AI 对话标签页
```vue
<!-- 与 AI 教师进行英语对话 -->
<el-tab-pane label="💬 AI 对话" name="chat">
  <AIChatPanel
    :messages="messages"
    :input="chatInput"
    :loading="chatLoading"
    @send="sendMessage"
  />
</el-tab-pane>
```

#### 音频导入标签页
```vue
<!-- 上传音频，分割为课程 -->
<el-tab-pane label="🎤 音频导入" name="audio">
  <AudioImportPanel
    :step="audioImportStep"
    :form="audioImportForm"
    @next="audioImportStep++"
    @import="importFromAudio"
  />
</el-tab-pane>
```

#### 设置标签页
```vue
<!-- 配置 AI 模型参数和学习策略 -->
<el-tab-pane label="⚙️ 设置" name="settings">
  <AISettingsPanel
    :config="aiConfig"
    @update="updateConfig"
  />
</el-tab-pane>
```

---

## 🔧 实施 TODO

### 必须完成（P0）
- [ ] 集成到路由系统
- [ ] 更新导航菜单
- [ ] 验证 CSS 变量定义
- [ ] 测试页面加载和基本交互

### 应该完成（P1）
- [ ] 实现 `generateCourse()` 函数连接 AI 服务
- [ ] 实现 `saveCourse()` 函数保存到数据库
- [ ] 实现 `sendMessage()` 函数连接 AI 对话服务
- [ ] 添加真实数据而非示例数据

### 可以优化（P2）
- [ ] 添加用户个性化推荐
- [ ] 实现进度追踪和可视化
- [ ] 添加成就系统
- [ ] 支持社区分享课程

---

## 💡 实施细节

### 连接 AI 服务

```typescript
// 在 AIToolsOptimizedPage.vue 中
async function generateCourse() {
  if (!courseForm.value.topic) {
    ElMessage.warning('请输入课程主题')
    return
  }

  courseGenerating.value = true
  try {
    // TODO: 调用实际的 AI 服务
    const response = await fetch('/api/ai/generate-course', {
      method: 'POST',
      body: JSON.stringify({
        topic: courseForm.value.topic,
        level: courseForm.value.level,
        scale: courseForm.value.scale,
      })
    })
    
    const data = await response.json()
    pendingCourse.value = data.course
    
    ElMessage.success('课程生成成功！')
  } catch (error) {
    ElMessage.error('课程生成失败：' + error.message)
  } finally {
    courseGenerating.value = false
  }
}
```

### 保存课程到数据库

```typescript
// 在 AIToolsOptimizedPage.vue 中
async function saveCourse() {
  try {
    const response = await fetch('/api/courses', {
      method: 'POST',
      body: JSON.stringify(pendingCourse.value)
    })
    
    const data = await response.json()
    savedCourseId.value = data.id
    
    ElMessage.success('课程已保存')
  } catch (error) {
    saveCourseError.value = '保存失败，请重试'
  }
}
```

### 实现 AI 对话

```typescript
// 在 AIChatPanel.vue 中
async function sendMessage() {
  if (!input.trim()) return

  const userMessage = input.trim()
  messages.value.push({ role: 'user', content: userMessage })
  input.value = ''

  chatLoading.value = true
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: userMessage,
        context: 'English learning conversation'
      })
    })
    
    const data = await response.json()
    messages.value.push({
      role: 'assistant',
      content: data.message,
      feedback: data.feedback // 语法建议等
    })
  } catch (error) {
    ElMessage.error('对话失败')
  } finally {
    chatLoading.value = false
  }
}
```

---

## 📊 关键代码示例

### 快速启动卡片逻辑

```vue
<!-- 点击卡片切换标签页 -->
<div 
  class="quick-card"
  :class="{ active: activeTab === card.name }"
  @click="activeTab = card.name"
>
  <div class="card-icon">{{ card.icon }}</div>
  <h4>{{ card.title }}</h4>
  <p>{{ card.description }}</p>
</div>
```

### 标签页切换回调

```typescript
function onTabChange(tabName: string) {
  // 可以添加分析追踪
  console.log('Tab changed to:', tabName)
  
  // 可以重置某些状态
  // if (tabName === 'generate') {
  //   courseForm.value = { ... }
  // }
}
```

### 表单验证示例

```typescript
function validateForm() {
  const errors = []
  
  if (!courseForm.value.topic) {
    errors.push('请输入课程主题')
  }
  
  if (courseForm.value.topic.length < 3) {
    errors.push('课程主题至少 3 个字符')
  }
  
  if (errors.length > 0) {
    ElMessage.error(errors.join('\n'))
    return false
  }
  
  return true
}
```

---

## 🧪 测试建议

### 单元测试示例

```typescript
// tests/CourseGeneratorPanel.spec.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CourseGeneratorPanel from '@/components/ai/CourseGeneratorPanel.vue'

describe('CourseGeneratorPanel', () => {
  it('should emit generate event when button clicked', async () => {
    const wrapper = mount(CourseGeneratorPanel, {
      props: {
        form: { topic: '', level: 'intermediate', scale: 'standard' },
        loading: false,
        pendingCourse: null,
        error: '',
        savedId: ''
      }
    })
    
    await wrapper.find('.action-btn').trigger('click')
    expect(wrapper.emitted().generate).toBeTruthy()
  })
  
  it('should display hint when form-hint exists', () => {
    const wrapper = mount(CourseGeneratorPanel, {
      props: { /* ... */ }
    })
    
    expect(wrapper.find('.form-hint').exists()).toBe(true)
    expect(wrapper.find('.form-hint').text()).toContain('具体的主题')
  })
})
```

### 集成测试建议

```typescript
// tests/AITools.integration.spec.ts
describe('AI Tools Integration', () => {
  it('should complete course generation workflow', async () => {
    // 1. 导航到 AI 工具页面
    // 2. 填入课程主题
    // 3. 选择难度和规模
    // 4. 点击生成
    // 5. 验证预览显示
    // 6. 点击保存
    // 7. 验证成功消息
  })
})
```

---

## 📚 参考资源

### 已有文档
- [AI 工具优化总结](./AI_TOOLS_OPTIMIZATION_SUMMARY.md)
- [AI 工具设计规范检查清单](./AI_TOOLS_CHECKLIST.md)
- [系统架构与设计原则](../ARCHITECTURE.md)
- [核心数据模型](../DATA_MODELS.md)

### 外部参考
- [Vue 3 官方文档](https://vuejs.org/)
- [Element Plus 组件库](https://element-plus.org/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

---

## ❓ 常见问题

### Q1: 如何自定义 AI 服务的响应格式？

A: 在 `AIToolsOptimizedPage.vue` 的各函数中修改请求和响应处理逻辑。根据实际 AI 服务的 API 文档调整。

### Q2: 如何实现离线功能？

A: 使用 IndexedDB 存储已下载的课程数据，当离线时从本地存储读取。

### Q3: 如何添加新的标签页？

A: 在 `AIToolsOptimizedPage.vue` 中：
1. 添加新的状态和数据
2. 创建新的面板组件
3. 在 `el-tabs` 中添加新的 `el-tab-pane`
4. 实现相应的事件处理函数

### Q4: 如何支持多语言？

A: 使用 i18n 库（如 vue-i18n），为所有文案创建翻译文件。

---

## 🎯 成功标准

集成完成后应该满足以下条件：

- ✅ 页面能够在浏览器中正常加载
- ✅ 所有标签页可以正常切换
- ✅ 快速启动卡片可以点击并切换标签页
- ✅ 表单可以正常输入和选择
- ✅ 按钮点击有加载反馈
- ✅ 所有文案和图标显示正确
- ✅ 在不同设备上响应式显示正常
- ✅ 无控制台错误信息

---

**下一步**：完成上述集成步骤，然后进行功能测试和用户验收测试。
