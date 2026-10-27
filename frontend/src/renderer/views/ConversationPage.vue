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
            <el-dropdown v-if="currentSession.status === 'active'" @command="handleFinishCommand">
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
                <el-button v-if="message.role === 'assistant'" text size="small" :loading="speakingMessageId === message.id" @click="playAssistantMessage(message.id, message.content)">
                  <el-icon><VideoPlay /></el-icon> 朗读英文回复
                </el-button>
                <small>{{ formatTime(message.createdAt) }}</small>
              </div>
            </div>
            <div v-if="sending" class="assistant-thinking">
              <el-icon class="is-loading"><Loading /></el-icon>
              AI 正在思考，请稍候…
            </div>
          </div>

          <div
            v-if="currentSession.scenarioId === 'english-interview' && currentSession.messages.some(message => message.role === 'user') && currentSession.messages.some(message => message.role === 'assistant')"
            class="feedback-action"
          >
            <div>
              <strong>把面试反馈转成可执行任务</strong>
              <p>将本次反馈关联到进行中的学习计划，之后可以在首页继续跟进。</p>
            </div>
            <el-button plain :loading="savingFeedback" @click="saveInterviewFeedback">
              加入今日学习计划
            </el-button>
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
              :placeholder="currentSession.status !== 'active' ? '该会话已结束，请新建会话继续' : currentSession.scenarioId === 'english-interview' ? '请尽量用英文回答；回答结束后可查看表达建议。' : '用英文回答练习；如果卡住，可以用中文问提示。'"
              @keydown.ctrl.enter.prevent="sendMessage"
            />
            <div class="composer-footer">
              <span>可输入文字，也可录音转成文字；Ctrl + Enter 发送</span>
              <div class="composer-actions">
                <el-button v-if="!recording" plain :loading="transcribing" :disabled="sending || currentSession.status !== 'active'" @click="startRecording">
                  <el-icon><Microphone /></el-icon> 语音输入
                </el-button>
                <el-button v-else type="danger" plain @click="stopRecording">结束录音并识别</el-button>
                <el-button type="primary" native-type="submit" :loading="sending" :disabled="!draft.trim() || currentSession.status !== 'active'">
                  发送
                </el-button>
              </div>
            </div>
          </form>
        </template>
        <el-empty v-else description="选择一个历史会话，或新建 AI 教学 / 英语面试会话" />
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowDown, Loading, Microphone, VideoPlay } from '@element-plus/icons-vue'
import {
  conversationCoreService,
  type ConversationScenarioId,
  type ConversationSession,
} from '../../shared/services/conversationCoreService'
import { learningDashboardService } from '../../shared/services/learningDashboardService'
import { studyPlanRepository } from '../../shared/database/repositories/studyPlanRepository'
import { learningEventService } from '../../shared/services/learningEventService'
import { asrApiService } from '../../shared/services/asrApiService'
import { generateSpeech } from '../../shared/services/ttsApiService'

const router = useRouter()
const sessions = ref<ConversationSession[]>([])
const selectedSessionId = ref<number | null>(null)
const scenarioId = ref<ConversationScenarioId>('ai-tutor')
const draft = ref('')
const sending = ref(false)
const loadingSessions = ref(false)
const savingFeedback = ref(false)
const errorMessage = ref('')
const recording = ref(false)
const transcribing = ref(false)
const speakingMessageId = ref<string | null>(null)
let mediaRecorder: MediaRecorder | null = null
let recordingStream: MediaStream | null = null
let recordedChunks: BlobPart[] = []
let currentAudio: HTMLAudioElement | null = null

const currentSession = computed(
  () => sessions.value.find(session => session.id === selectedSessionId.value) ?? null,
)

async function playAssistantMessage(messageId: string, content: string) {
  if (speakingMessageId.value === messageId) return
  currentAudio?.pause()
  currentAudio = null
  speakingMessageId.value = messageId
  try {
    const audioUrl = await generateSpeech(content, 'en')
    if (!audioUrl) throw new Error('语音合成未返回可播放音频')
    const audio = new Audio(audioUrl)
    currentAudio = audio
    audio.onended = () => {
      if (currentAudio === audio) currentAudio = null
      speakingMessageId.value = null
    }
    audio.onerror = () => {
      if (currentAudio === audio) currentAudio = null
      speakingMessageId.value = null
      ElMessage.error('语音播放失败，请检查 TTS 服务状态')
    }
    await audio.play()
  } catch (error) {
    speakingMessageId.value = null
    errorMessage.value = error instanceof Error ? error.message : '无法播放语音'
  }
}

async function startRecording() {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    errorMessage.value = '当前浏览器不支持录音，请改用文字输入。'
    return
  }
  try {
    errorMessage.value = ''
    recordedChunks = []
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    mediaRecorder = new MediaRecorder(recordingStream)
    mediaRecorder.ondataavailable = event => {
      if (event.data.size > 0) recordedChunks.push(event.data)
    }
    mediaRecorder.onstop = () => {
      recordingStream?.getTracks().forEach(track => track.stop())
      recordingStream = null
      void transcribeRecording()
    }
    mediaRecorder.start()
    recording.value = true
  } catch (error) {
    recordingStream?.getTracks().forEach(track => track.stop())
    recordingStream = null
    errorMessage.value = error instanceof Error && error.name === 'NotAllowedError'
      ? '麦克风权限未获批准，请在浏览器地址栏允许麦克风后重试。'
      : '无法启动麦克风，请检查设备和浏览器权限。'
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop()
  }
  recording.value = false
}

async function transcribeRecording() {
  const blob = new Blob(recordedChunks, { type: mediaRecorder?.mimeType || 'audio/webm' })
  recordedChunks = []
  mediaRecorder = null
  if (blob.size === 0) {
    errorMessage.value = '没有录到有效音频，请重试。'
    return
  }
  transcribing.value = true
  try {
    const result = await asrApiService.recognize({ audio: blob, language: 'en-US' })
    if (!result.success || !result.text?.trim()) {
      throw new Error(result.error || '没有识别到清晰的语音，请重试或直接输入文字。')
    }
    draft.value = [draft.value.trim(), result.text.trim()].filter(Boolean).join(' ')
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '语音识别失败，请重试。'
  } finally {
    transcribing.value = false
  }
}

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
    let linked: { courseId?: string; lessonId?: string; contextSummary?: string } = {}
    if (scenarioId.value === 'ai-tutor') {
      // 只把可追溯的已保存学习数据作为教学上下文，不将模型猜测写回学习画像。
      try {
        const dashboard = await learningDashboardService.load()
        const target = dashboard.resumeTarget
        if (target) {
          linked = {
            courseId: target.courseId,
            lessonId: target.lessonId,
            contextSummary: `current course "${target.courseTitle}", current lesson "${target.lessonTitle}", course completion ${target.completionPercentage}%`,
          }
        }
        if (dashboard.dueWords.length) {
          const words = dashboard.dueWords.slice(0, 5).map(item => item.word).join(', ')
          linked.contextSummary = [linked.contextSummary, `due review words: ${words}`].filter(Boolean).join('; ')
        }
      } catch (contextError) {
        console.warn('读取学习上下文失败，仍允许创建普通教学会话:', contextError)
      }
    }
    const session = await conversationCoreService.createSession(scenarioId.value, undefined, linked)
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

function handleFinishCommand(command: string | number | object) {
  if (command === 'completed' || command === 'abandoned') {
    void finishSession(command)
  }
}

async function saveInterviewFeedback() {
  const session = currentSession.value
  if (!session || session.scenarioId !== 'english-interview' || !session.messages.some(message => message.role === 'user')) return
  const latestFeedback = [...session.messages].reverse().find(message => message.role === 'assistant')
  if (!latestFeedback) return

  savingFeedback.value = true
  errorMessage.value = ''
  try {
    const plans = await studyPlanRepository.listPlans('active')
    const activePlan = [...plans].sort((a, b) => b.updatedAt - a.updatedAt)[0]
    if (!activePlan) {
      ElMessage.warning('请先创建一个学习计划，再保存面试复练任务')
      await router.push('/plans')
      return
    }

    const now = Date.now()
    const today = new Date(now)
    today.setHours(0, 0, 0, 0)
    const taskTitle = `英语面试反馈复练 #${session.id}`
    const todayTasks = await studyPlanRepository.listTasks(activePlan.id, today.getTime())
    const existing = todayTasks.find(task => task.title === taskTitle)
    const task = existing ?? await studyPlanRepository.createTask({
      planId: activePlan.id,
      title: taskTitle,
      dueDate: today.getTime(),
    })

    await learningEventService.record({
      eventId: `conversation-feedback-saved-${session.id}-${latestFeedback.id}`,
      eventType: 'conversation_feedback_saved',
      occurredAt: now,
      activityId: String(task.id),
      courseId: session.linkedCourseId,
      lessonId: session.linkedLessonId,
      metadata: {
        scenarioId: session.scenarioId,
        sessionId: session.id,
        assistantMessageId: latestFeedback.id,
        planId: activePlan.id,
        taskId: task.id,
      },
    })
    ElMessage.success(existing ? '复练任务已存在，反馈已关联到学习计划' : '已将面试反馈加入今日学习计划')
  } catch (error) {
    console.error('保存面试反馈失败:', error)
    errorMessage.value = '保存反馈任务失败，请检查学习计划服务后重试。'
  } finally {
    savingFeedback.value = false
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

onBeforeUnmount(() => {
  if (mediaRecorder) {
    mediaRecorder.onstop = null
    if (mediaRecorder.state !== 'inactive') mediaRecorder.stop()
  }
  recordingStream?.getTracks().forEach(track => track.stop())
  currentAudio?.pause()
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
.feedback-action { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px; margin: 0 0 16px; border: 1px solid var(--border-color-light); border-radius: 10px; }
.feedback-action strong { display: block; margin-bottom: 4px; }
.feedback-action p { margin: 0; color: var(--text-color-secondary); font-size: 12px; line-height: 1.6; }
.composer { border-top: 1px solid var(--border-color-light); padding-top: 16px; }
.composer-footer { margin-top: 10px; }
.composer-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.composer-footer span { color: var(--text-color-secondary); font-size: 12px; }
@media (max-width: 860px) {
  .conversation-layout { grid-template-columns: 1fr; }
  .message-list { max-height: none; }
}
</style>
