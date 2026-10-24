<template>
  <div class="conversation-page">
    <header class="page-header">
      <div>
        <h2>AI 英语对话</h2>
        <p>AI 教学与英语面试共用同一套会话、消息持久化和模型调用内核。</p>
      </div>
      <el-button type="primary" @click="createNewSession">新建会话</el-button>
    </header>

    <el-alert
      v-if="errorMessage"
      type="warning"
      show-icon
      :closable="false"
      :title="errorMessage"
      class="error-alert"
    />

    <div class="conversation-layout">
      <el-card class="session-panel" shadow="never">
        <h3>会话场景</h3>
        <el-radio-group v-model="scenarioId" class="scenario-options">
          <el-radio value="ai-tutor">AI 英语教学</el-radio>
          <el-radio value="english-interview">英语面试</el-radio>
        </el-radio-group>

        <el-divider />
        <div class="session-list-header">
          <h3>历史会话</h3>
          <el-button text @click="loadSessions" :loading="loadingSessions">刷新</el-button>
        </div>
        <el-empty v-if="sessions.length === 0 && !loadingSessions" description="还没有保存的会话" />
        <button
          v-for="item in sessions"
          :key="item.id"
          type="button"
          class="session-item"
          :class="{ selected: item.id === selectedSessionId }"
          @click="selectSession(item.id)"
        >
          <strong>{{ item.title }}</strong>
          <span>{{ item.scenarioId === 'ai-tutor' ? 'AI 教学' : '英语面试' }} · {{ item.messages.length }} 条消息</span>
          <small>{{ formatTime(item.updatedAt) }} · {{ statusLabel(item.status) }}</small>
        </button>
      </el-card>

      <el-card class="chat-panel" shadow="never">
        <template v-if="currentSession">
          <div class="chat-header">
            <div>
              <h3>{{ currentSession.title }}</h3>
              <p>{{ currentSession.scenarioId === 'ai-tutor' ? '循序渐进讲解、练习与纠错' : '逐题面试、追问与证据化反馈' }}</p>
            </div>
            <el-dropdown v-if="currentSession.status === 'active'" @command="finishSession">
              <el-button>结束会话<el-icon class="el-icon--right"><ArrowDown /></el-icon></el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="completed">正常结束</el-dropdown-item>
                  <el-dropdown-item command="abandoned">放弃会话</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>

          <div class="message-list">
            <el-empty v-if="currentSession.messages.length === 0" description="发送第一条消息，开始练习" />
            <div
              v-for="message in currentSession.messages"
              :key="message.id"
              class="message-row"
              :class="message.role"
            >
              <div class="message-bubble">
                <span class="message-role">{{ message.role === 'user' ? '我' : 'AI' }}</span>
                <p>{{ message.content }}</p>
                <small>{{ formatTime(message.createdAt) }}</small>
              </div>
            </div>
            <div v-if="sending" class="assistant-thinking">
              <el-icon class="is-loading"><Loading /></el-icon>
              AI 正在思考，请稍候…
            </div>
          </div>

          <form class="composer" @submit.prevent="sendMessage">
            <el-input
              v-model="draft"
              type="textarea"
              :rows="3"
              resize="none"
              maxlength="4000"
              show-word-limit
              :disabled="sending || currentSession.status !== 'active'"
              :placeholder="currentSession.status === 'active' ? '输入英文回答或用中文询问……' : '该会话已结束，请新建会话继续'"
              @keydown.ctrl.enter.prevent="sendMessage"
            />
            <div class="composer-footer">
              <span>Ctrl + Enter 发送 · 会话自动保存到本地 SQLite</span>
              <el-button type="primary" native-type="submit" :loading="sending" :disabled="!draft.trim() || currentSession.status !== 'active'">
                发送
              </el-button>
            </div>
          </form>
        </template>
        <el-empty v-else description="选择一个历史会话，或新建 AI 教学 / 英语面试会话" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { ArrowDown, Loading } from '@element-plus/icons-vue'
import {
  conversationCoreService,
  type ConversationScenarioId,
  type ConversationSession,
} from '../../shared/services/conversationCoreService'

const sessions = ref<ConversationSession[]>([])
const selectedSessionId = ref<number | null>(null)
const scenarioId = ref<ConversationScenarioId>('ai-tutor')
const draft = ref('')
const sending = ref(false)
const loadingSessions = ref(false)
const errorMessage = ref('')

const currentSession = computed(
  () => sessions.value.find(session => session.id === selectedSessionId.value) ?? null,
)

function statusLabel(status: ConversationSession['status']): string {
  if (status === 'completed') return '已结束'
  if (status === 'abandoned') return '已放弃'
  return '进行中'
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

async function loadSessions() {
  loadingSessions.value = true
  errorMessage.value = ''
  try {
    sessions.value = await conversationCoreService.listSessions()
    if (!sessions.value.some(session => session.id === selectedSessionId.value)) {
      const resumable = sessions.value.find(session => session.status === 'active')
      selectedSessionId.value = (resumable ?? sessions.value[0])?.id ?? null
    }
  } catch (error) {
    console.error('读取对话历史失败:', error)
    errorMessage.value = '无法读取会话历史，请检查本地后端服务是否启动。'
  } finally {
    loadingSessions.value = false
  }
}

async function createNewSession() {
  errorMessage.value = ''
  try {
    const session = await conversationCoreService.createSession(scenarioId.value)
    sessions.value = [session, ...sessions.value]
    selectedSessionId.value = session.id
    draft.value = ''
    ElMessage.success('新会话已保存')
  } catch (error) {
    console.error('创建对话会话失败:', error)
    errorMessage.value = '创建会话失败，请检查本地后端服务。'
  }
}

function selectSession(id: number) {
  selectedSessionId.value = id
  draft.value = ''
  const session = sessions.value.find(item => item.id === id)
  if (session) scenarioId.value = session.scenarioId
}

async function sendMessage() {
  const session = currentSession.value
  const text = draft.value.trim()
  if (!session || !text || sending.value || session.status !== 'active') return
  sending.value = true
  draft.value = ''
  errorMessage.value = ''
  try {
    const updated = await conversationCoreService.sendMessage(session, text)
    sessions.value = sessions.value.map(item => item.id === updated.id ? updated : item)
  } catch (error) {
    console.error('发送 AI 对话失败:', error)
    const saved = await conversationCoreService.getSession(session.id).catch(() => null)
    if (saved) sessions.value = sessions.value.map(item => item.id === saved.id ? saved : item)
    draft.value = text
    errorMessage.value = error instanceof Error ? error.message : 'AI 请求失败，请检查模型设置后重试。'
  } finally {
    sending.value = false
  }
}

async function finishSession(status: 'completed' | 'abandoned') {
  const session = currentSession.value
  if (!session) return
  try {
    const updated = await conversationCoreService.finishSession(session, status)
    sessions.value = sessions.value.map(item => item.id === updated.id ? updated : item)
    ElMessage.success(status === 'completed' ? '会话已结束' : '已标记为放弃')
  } catch (error) {
    console.error('结束会话失败:', error)
    errorMessage.value = '保存会话状态失败，请稍后重试。'
  }
}

onMounted(() => {
  void loadSessions()
})
</script>

<style lang="scss" scoped>
.conversation-page { padding: 24px; }
.page-header, .chat-header, .session-list-header, .composer-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.page-header { margin-bottom: 20px; }
.page-header h2, .chat-header h3, .session-panel h3 { margin: 0 0 6px; }
.page-header p, .chat-header p { margin: 0; color: var(--text-color-secondary); line-height: 1.6; }
.error-alert { margin-bottom: 16px; }
.conversation-layout { display: grid; grid-template-columns: minmax(240px, 300px) minmax(0, 1fr); gap: 18px; align-items: start; }
.session-panel, .chat-panel { min-width: 0; }
.scenario-options { display: flex; flex-direction: column; align-items: flex-start; gap: 10px; }
.session-list-header { margin-bottom: 8px; }
.session-item {
  display: flex; flex-direction: column; align-items: flex-start; gap: 5px; width: 100%;
  padding: 12px; margin: 5px 0; text-align: left; border: 1px solid var(--border-color);
  border-radius: 8px; background: transparent; color: var(--text-color); cursor: pointer;
}
.session-item.selected { border-color: var(--primary-color); background: var(--fill-color-light); }
.session-item span, .session-item small { color: var(--text-color-secondary); font-size: 12px; }
.chat-header { padding-bottom: 14px; border-bottom: 1px solid var(--border-color-light); }
.message-list { min-height: 280px; max-height: 52vh; overflow-y: auto; padding: 18px 4px; }
.message-row { display: flex; margin-bottom: 14px; }
.message-row.user { justify-content: flex-end; }
.message-bubble { max-width: min(85%, 760px); padding: 12px 14px; border-radius: 12px; background: var(--fill-color-light); }
.message-row.user .message-bubble { background: var(--primary-color-light-9, var(--fill-color-light)); }
.message-role { font-size: 12px; font-weight: 600; color: var(--text-color-secondary); }
.message-bubble p { white-space: pre-wrap; overflow-wrap: anywhere; margin: 6px 0; line-height: 1.7; }
.message-bubble small { font-size: 11px; color: var(--text-color-secondary); }
.assistant-thinking { display: flex; gap: 8px; align-items: center; color: var(--text-color-secondary); padding: 8px; }
.composer { border-top: 1px solid var(--border-color-light); padding-top: 16px; }
.composer-footer { margin-top: 10px; }
.composer-footer span { color: var(--text-color-secondary); font-size: 12px; }
@media (max-width: 860px) {
  .conversation-layout { grid-template-columns: 1fr; }
  .message-list { max-height: none; }
}
</style>
