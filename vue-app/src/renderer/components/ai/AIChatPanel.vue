<!--
  AI 对话面板
  
  功能：
  - 与 AI 教师进行英语对话
  - 支持语音和文本
  - 显示反馈和建议
-->

<template>
  <div class="ai-chat-panel">
    <!-- 对话模式选择 -->
    <div class="chat-modes">
      <el-radio-group v-model="chatMode" size="large" class="mode-selector">
        <el-radio-button label="text">💬 文字对话</el-radio-button>
        <el-radio-button label="voice">🎤 语音对话</el-radio-button>
      </el-radio-group>
    </div>

    <el-divider />

    <!-- 对话窗口 -->
    <div class="chat-container">
      <div class="messages-area" ref="messagesRef">
        <div
          v-for="(msg, idx) in messages"
          :key="idx"
          :class="['message-item', msg.role]"
        >
          <div class="message-avatar">
            {{ msg.role === 'user' ? '👤' : '🤖' }}
          </div>
          <div class="message-content">
            <p class="message-text">{{ msg.content }}</p>
            <div v-if="msg.feedback" class="message-feedback">
              <el-alert
                :title="msg.feedback.title"
                :type="msg.feedback.type"
                :closable="false"
                class="feedback-alert"
              />
            </div>
          </div>
        </div>

        <div v-if="loading" class="message-loading">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          <span>AI 正在思考中...</span>
        </div>
      </div>

      <!-- 输入区 -->
      <div class="input-area">
        <div v-if="chatMode === 'text'" class="text-input-wrapper">
          <el-input
            :model-value="input"
            @update:model-value="$emit('update:input', $event)"
            type="textarea"
            placeholder="输入英文内容或提问..."
            :rows="3"
            maxlength="500"
            show-word-limit
            @keydown.ctrl.enter="sendMessage"
          />
          <div class="input-actions">
            <el-button
              type="primary"
              :loading="loading"
              @click="$emit('send')"
            >
              发送 (Ctrl+Enter)
            </el-button>
          </div>
        </div>

        <div v-else class="voice-input-wrapper">
          <div class="voice-recorder">
            <el-button
              type="warning"
              size="large"
              class="record-btn"
              :loading="recording"
            >
              🎤 {{ recording ? '录音中...' : '开始录音' }}
            </el-button>
          </div>
          <div class="voice-actions">
            <el-button
              type="primary"
              :loading="loading"
              @click="$emit('send')"
            >
              发送
            </el-button>
            <el-button @click="recording = !recording">
              {{ recording ? '停止' : '重新录音' }}
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 对话指南 -->
    <el-collapse class="guide-collapse" accordion>
      <el-collapse-item title="💡 对话指南" name="guide">
        <div class="guide-content">
          <h5>常见话题：</h5>
          <el-tag
            v-for="topic in commonTopics"
            :key="topic"
            class="topic-tag"
            @close="() => {}"
            closable
          >
            {{ topic }}
          </el-tag>

          <h5 style="margin-top: 16px">对话技巧：</h5>
          <ul class="tips-list">
            <li>✅ 准备好要讨论的话题</li>
            <li>✅ 尝试用完整的句子表达</li>
            <li>✅ 不要害怕犯错，错误帮助进步</li>
            <li>✅ 问 AI 你不懂的表达或短语</li>
          </ul>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

interface Props {
  messages: Array<{ role: string; content: string; feedback?: any }>
  input: string
  loading: boolean
}

interface Emits {
  (e: 'send'): void
  (e: 'update:input', value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const chatMode = ref('text')
const recording = ref(false)
const messagesRef = ref(null)

const commonTopics = [
  '日常打招呼',
  '点餐和食物',
  '旅游和度假',
  '工作和职业',
  '兴趣爱好',
  '天气和季节',
]

function sendMessage() {
  if (props.loading) return
  const value = (props.input ?? '').trim()
  if (!value) {
    ElMessage.warning('请输入内容')
    return
  }
  emit('send')
}
</script>

<style lang="scss" scoped>
.ai-chat-panel {
  padding: 20px 0;
}

.chat-modes {
  margin-bottom: 16px;

  .mode-selector {
    width: 100%;

    :deep(.el-radio-button) {
      flex: 1;
    }
  }
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  margin-bottom: 24px;
  border: 1px solid var(--border-color-light);
  border-radius: 8px;
  background: #f5f7fa;
  overflow: hidden;
}

.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #dcdfe6;
    border-radius: 4px;

    &:hover {
      background: #bfcdc9;
    }
  }
}

.message-item {
  display: flex;
  gap: 12px;
  animation: slideIn 0.3s ease;

  &.user {
    flex-direction: row-reverse;

    .message-content {
      background: #409eff;
      color: white;
    }
  }

  &.assistant {
    .message-content {
      background: white;
      color: var(--text-color);
    }
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  flex-shrink: 0;
  font-size: 24px;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.message-content {
  flex: 1;
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 8px;
  word-break: break-word;

  .message-text {
    margin: 0;
    font-size: 14px;
    line-height: 1.5;
  }

  .message-feedback {
    margin-top: 12px;

    .feedback-alert {
      padding: 8px 12px;
      font-size: 12px;

      :deep(.el-alert__title) {
        font-size: 12px;
      }
    }
  }
}

.message-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #909399;
  font-size: 14px;

  .el-icon {
    font-size: 18px;
  }
}

.input-area {
  padding: 16px;
  background: white;
  border-top: 1px solid var(--border-color-light);
}

.text-input-wrapper {
  :deep(.el-textarea) {
    margin-bottom: 12px;
  }

  .input-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.voice-input-wrapper {
  text-align: center;
  padding: 20px 0;

  .voice-recorder {
    margin-bottom: 16px;

    .record-btn {
      font-size: 16px;
      padding: 20px 40px;
    }
  }

  .voice-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
  }
}

// 指南
.guide-collapse {
  :deep(.el-collapse-item__header) {
    background: #f5f7fa;
    font-weight: 500;
  }

  .guide-content {
    padding: 16px 0;

    h5 {
      margin: 0 0 12px;
      font-size: 14px;
      font-weight: 600;
      color: var(--text-color);
    }

    .topic-tag {
      margin: 4px 4px 4px 0;
    }

    .tips-list {
      margin: 0;
      padding: 0 0 0 20px;
      font-size: 13px;
      color: #606266;

      li {
        margin-bottom: 8px;
        line-height: 1.5;
      }
    }
  }
}
</style>
