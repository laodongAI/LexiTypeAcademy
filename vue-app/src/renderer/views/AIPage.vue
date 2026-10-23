<!--
  AI 助手页面
  
  AI 对话助手
-->

<template>
  <div class="ai-page">
    <el-row :gutter="24">
      <!-- 聊天区域 -->
      <el-col :span="16">
        <el-card class="chat-card">
          <template #header>
            <div class="card-header">
              <span>AI 助手</span>
              <el-button text @click="clearChat">
                <el-icon><Delete /></el-icon> 清空对话
              </el-button>
            </div>
          </template>
          
          <div class="chat-container">
            <div class="messages-area" ref="messagesRef">
              <div 
                v-for="message in messages" 
                :key="message.id"
                class="message"
                :class="message.role"
              >
                <div class="message-avatar">
                  <el-avatar v-if="message.role === 'user'" :size="36">
                    <el-icon><User /></el-icon>
                  </el-avatar>
                  <el-avatar v-else :size="36" style="background-color: var(--primary-color)">
                    <el-icon><ChatDotRound /></el-icon>
                  </el-avatar>
                </div>
                <div class="message-content">
                  <div class="message-header">
                    <span class="role-name">
                      {{ message.role === 'user' ? '你' : 'AI 助手' }}
                    </span>
                    <span class="message-time">{{ formatTime(message.timestamp) }}</span>
                  </div>
                  <div class="message-text" v-html="formatMessage(message.content)" />
                </div>
              </div>
              
              <!-- 加载指示器 -->
              <div v-if="isLoading" class="message assistant">
                <div class="message-avatar">
                  <el-avatar :size="36" style="background-color: var(--primary-color)">
                    <el-icon><ChatDotRound /></el-icon>
                  </el-avatar>
                </div>
                <div class="message-content">
                  <div class="loading-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="input-area">
              <el-input
                v-model="inputText"
                type="textarea"
                :rows="3"
                placeholder="输入你的问题..."
                @keydown.enter.ctrl="sendMessage"
              />
              <div class="input-actions">
                <span class="hint">Ctrl + Enter 发送</span>
                <el-button 
                  type="primary" 
                  :loading="isLoading"
                  @click="sendMessage"
                >
                  发送
                </el-button>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <!-- 快捷提问 -->
      <el-col :span="8">
        <el-card class="suggestions-card">
          <template #header>
            <span>快捷提问</span>
          </template>
          
          <div class="suggestion-list">
            <div 
              v-for="suggestion in suggestions" 
              :key="suggestion.id"
              class="suggestion-item"
              @click="useSuggestion(suggestion.text)"
            >
              <el-icon><QuestionFilled /></el-icon>
              <span>{{ suggestion.text }}</span>
            </div>
          </div>
        </el-card>
        
        <el-card class="tips-card">
          <template #header>
            <span>使用提示</span>
          </template>
          
          <ul class="tips-list">
            <li>你可以询问中文学习相关的任何问题</li>
            <li>AI 可以帮助你解释汉字的含义和用法</li>
            <li>试着用中文和 AI 对话来练习</li>
            <li>AI 可以帮助你纠正语法错误</li>
          </ul>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'
import { User, ChatDotRound, Delete, QuestionFilled } from '@element-plus/icons-vue'

// 消息列表
interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const messages = ref<Message[]>([
  {
    id: '1',
    role: 'assistant',
    content: '你好！我是你的 AI 中文学习助手。有什么我可以帮助你的吗？你可以问我关于汉字、拼音、语法等任何中文学习相关的问题。',
    timestamp: new Date(),
  },
])

// 输入文本
const inputText = ref('')

// 加载状态
const isLoading = ref(false)

// 消息区域引用
const messagesRef = ref<HTMLElement | null>(null)

// 快捷提问建议
const suggestions = ref([
  { id: '1', text: '如何记忆汉字？' },
  { id: '2', text: '拼音的四个声调怎么区分？' },
  { id: '3', text: '"的"、"地"、"得"有什么区别？' },
  { id: '4', text: '推荐一些学习中文的方法' },
  { id: '5', text: '常用的中文问候语有哪些？' },
])

// 发送消息
async function sendMessage() {
  if (!inputText.value.trim() || isLoading.value) return
  
  const userMessage: Message = {
    id: Date.now().toString(),
    role: 'user',
    content: inputText.value,
    timestamp: new Date(),
  }
  
  messages.value.push(userMessage)
  inputText.value = ''
  isLoading.value = true
  
  await scrollToBottom()
  
  // TODO: 调用 AI API
  await new Promise(resolve => setTimeout(resolve, 1500))
  
  const assistantMessage: Message = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: `这是 AI 助手的回复。你问的是："${userMessage.content}"。这里是详细的解答...（示例回复）`,
    timestamp: new Date(),
  }
  
  messages.value.push(assistantMessage)
  isLoading.value = false
  
  await scrollToBottom()
}

// 使用建议
function useSuggestion(text: string) {
  inputText.value = text
}

// 清空对话
function clearChat() {
  messages.value = [{
    id: '1',
    role: 'assistant',
    content: '对话已清空。有什么新的问题吗？',
    timestamp: new Date(),
  }]
}

// 滚动到底部
async function scrollToBottom() {
  await nextTick()
  if (messagesRef.value) {
    messagesRef.value.scrollTop = messagesRef.value.scrollHeight
  }
}

// 格式化时间
function formatTime(date: Date) {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 格式化消息（简单处理换行）
function formatMessage(content: string) {
  return content.replace(/\n/g, '<br>')
}
</script>

<style lang="scss" scoped>
.ai-page {
  height: calc(100vh - 180px);
}

.chat-card {
  height: 100%;
  
  :deep(.el-card__body) {
    padding: 0;
    height: calc(100% - 60px);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.message {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  
  &.user {
    flex-direction: row-reverse;
    
    .message-content {
      align-items: flex-end;
    }
    
    .message-text {
      background-color: var(--primary-color);
      color: #fff;
    }
  }
  
  &.assistant {
    .message-text {
      background-color: var(--bg-color-hover);
    }
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  max-width: 70%;
}

.message-header {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  
  .role-name {
    color: var(--text-color-secondary);
  }
  
  .message-time {
    color: var(--text-color-placeholder);
  }
}

.message-text {
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.6;
}

.loading-indicator {
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  
  span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background-color: var(--text-color-placeholder);
    animation: bounce 1.4s infinite ease-in-out both;
    
    &:nth-child(1) { animation-delay: -0.32s; }
    &:nth-child(2) { animation-delay: -0.16s; }
  }
}

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.input-area {
  padding: 16px;
  border-top: 1px solid var(--border-color-light);
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  
  .hint {
    font-size: 12px;
    color: var(--text-color-placeholder);
  }
}

.suggestions-card {
  margin-bottom: 16px;
}

.suggestion-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background-color: var(--bg-color-hover);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: var(--primary-color-lighter);
  }
  
  .el-icon {
    color: var(--primary-color);
  }
  
  span {
    font-size: 14px;
    color: var(--text-color);
  }
}

.tips-card {
  .tips-list {
    margin: 0;
    padding-left: 20px;
    
    li {
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--text-color-secondary);
      line-height: 1.5;
      
      &:last-child {
        margin-bottom: 0;
      }
    }
  }
}
</style>
