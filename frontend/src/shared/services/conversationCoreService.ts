/**
 * 可复用对话内核。
 *
 * 会话消息暂存于现有 SQLite 持久化的 ai_task_logs JSON 字段，
 * 复用统一 AI Provider 代理；不在场景页面中复制请求、消息存储与错误处理。
 */
import { commonRepository } from '../database/repositories/commonRepository'
import { apiPost } from './apiClient'
import { learningEventService } from './learningEventService'
import type { AITaskLog } from '../types/common'

export type ConversationScenarioId = 'ai-tutor' | 'english-interview'

export interface ConversationMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

export interface ConversationSession {
  id: number
  scenarioId: ConversationScenarioId
  title: string
  status: 'active' | 'completed' | 'abandoned'
  messages: ConversationMessage[]
  createdAt: number
  updatedAt: number
  linkedCourseId?: string
  linkedLessonId?: string
  contextSummary?: string
}

interface StoredConversation {
  scenarioId: ConversationScenarioId
  title: string
  status: ConversationSession['status']
  messages: ConversationMessage[]
  createdAt: number
  updatedAt: number
  linkedCourseId?: string
  linkedLessonId?: string
  contextSummary?: string
}

interface ChatResponse {
  content: string
  requestId?: string
  provider?: string
  model?: string
}

const SESSION_TYPE = 'conversation_session'

const SCENARIO_PROMPTS: Record<ConversationScenarioId, string> = {
  'ai-tutor': [
    'You are a patient, practical English tutor.',
    'Use clear English matched to the learner level; briefly explain difficult points in Chinese when useful.',
    'Prefer a learning loop: explain one point, ask one focused question, wait for the learner, correct gently with evidence, then offer a short retry.',
    'Never claim that a learner has mastered a word or completed a lesson unless the application records that activity.',
    'Keep replies focused and end with one actionable next step.',
  ].join(' '),
  'english-interview': [
    'You are an experienced but supportive English-language interviewer.',
    'Ask one interview question at a time and adapt follow-up questions to the candidate answer.',
    'After an answer, provide specific evidence-based feedback on relevance, structure, grammar, vocabulary, and clarity.',
    'Do not invent credentials or claim your evaluation predicts a real hiring decision.',
    'Do not give the full ideal answer before the candidate has tried. Offer a concise improved example after feedback.',
  ].join(' '),
}

function parseStored(log: AITaskLog): StoredConversation | null {
  const input = log.input as Partial<StoredConversation> | undefined
  if (!input || (input.scenarioId !== 'ai-tutor' && input.scenarioId !== 'english-interview')) return null
  return {
    scenarioId: input.scenarioId,
    title: typeof input.title === 'string' ? input.title : '英语对话',
    status: input.status === 'completed' || input.status === 'abandoned' ? input.status : 'active',
    messages: Array.isArray(input.messages) ? input.messages : [],
    createdAt: Number(input.createdAt ?? log.createdAt),
    updatedAt: Number(input.updatedAt ?? log.createdAt),
    linkedCourseId: input.linkedCourseId,
    linkedLessonId: input.linkedLessonId,
  }
}

function toSession(log: AITaskLog): ConversationSession | null {
  const stored = parseStored(log)
  if (!stored || !log.id) return null
  return { id: log.id, ...stored }
}

function makeMessage(role: ConversationMessage['role'], content: string): ConversationMessage {
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    role,
    content,
    createdAt: Date.now(),
  }
}

export class ConversationCoreService {
  async listSessions(): Promise<ConversationSession[]> {
    const logs = await commonRepository.getAITaskLogsByType(SESSION_TYPE, 200)
    return logs
      .map(toSession)
      .filter((session): session is ConversationSession => session !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }

  async getSession(id: number): Promise<ConversationSession | null> {
    const log = await commonRepository.getAITaskLog(id)
    return log ? toSession(log) : null
  }

  async createSession(
    scenarioId: ConversationScenarioId,
    title?: string,
    linked?: { courseId?: string; lessonId?: string; contextSummary?: string },
  ): Promise<ConversationSession> {
    const now = Date.now()
    const stored: StoredConversation = {
      scenarioId,
      title: title?.trim() || (scenarioId === 'ai-tutor' ? 'AI 英语教学' : '英语面试练习'),
      status: 'active',
      messages: [],
      createdAt: now,
      updatedAt: now,
      linkedCourseId: linked?.courseId,
      linkedLessonId: linked?.lessonId,
      contextSummary: linked?.contextSummary,
    }
    const id = await commonRepository.createAITaskLog({
      type: SESSION_TYPE,
      status: 'completed',
      input: stored as unknown as Record<string, unknown>,
      output: { sessionStatus: 'active' },
      createdAt: now,
    })
    if (!id) throw new Error('会话保存失败，未返回会话 ID')
    return { id, ...stored }
  }

  async sendMessage(session: ConversationSession, text: string): Promise<ConversationSession> {
    const userText = text.trim()
    if (!userText) throw new Error('请输入内容后再发送')
    if (session.status !== 'active') throw new Error('该会话已结束，请新建会话继续')

    const log = await commonRepository.getAITaskLog(session.id)
    if (!log) throw new Error('找不到已保存的会话，请刷新会话列表')
    const userMessage = makeMessage('user', userText)
    const pending: ConversationSession = {
      ...session,
      messages: [...session.messages, userMessage],
      updatedAt: Date.now(),
    }

    // 先保存用户消息，保证上游超时或刷新后不会丢失输入。
    await this.persist(pending, log, 'active')
    try {
      const response = await apiPost<ChatResponse>('/api/ai/chat', {
        messages: [
          { role: 'system', content: SCENARIO_PROMPTS[session.scenarioId] },
          ...(pending.contextSummary ? [{ role: 'system', content: `Verified learner context from saved learning data: ${pending.contextSummary}. Use this only as helpful context; do not claim completion or mastery beyond these facts.` }] : []),
          ...pending.messages.map(message => ({ role: message.role, content: message.content })),
        ],
        requestId: `conversation-${session.id}-${userMessage.id}`,
      }, { timeout: 120000 })
      if (!response.content?.trim()) throw new Error('AI 返回了空内容，请重试')
      const completed: ConversationSession = {
        ...pending,
        messages: [...pending.messages, makeMessage('assistant', response.content.trim())],
        updatedAt: Date.now(),
      }
      await this.persist(completed, log, 'active')
      return completed
    } catch (error) {
      // 用户消息已持久化；错误由 UI 呈现，用户可重试而不丢失上下文。
      await this.persist(pending, log, 'active')
      throw error
    }
  }

  async finishSession(session: ConversationSession, status: 'completed' | 'abandoned'): Promise<ConversationSession> {
    const log = await commonRepository.getAITaskLog(session.id)
    if (!log) throw new Error('找不到已保存的会话')
    const updated = { ...session, status, updatedAt: Date.now() }
    await this.persist(updated, log, status)
    void learningEventService.record({
      eventType: status === 'completed' ? 'conversation_completed' : 'conversation_abandoned',
      occurredAt: updated.updatedAt,
      activityId: String(updated.id),
      courseId: updated.linkedCourseId,
      lessonId: updated.linkedLessonId,
      metadata: { scenarioId: updated.scenarioId, messageCount: updated.messages.length },
    }).catch(error => console.warn('记录对话生命周期事件失败，不影响已保存的会话状态:', error))
    return updated
  }

  private async persist(
    session: ConversationSession,
    log: AITaskLog,
    status: ConversationSession['status'],
  ): Promise<void> {
    const input: StoredConversation = {
      scenarioId: session.scenarioId,
      title: session.title,
      status,
      messages: session.messages,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      linkedCourseId: session.linkedCourseId,
      linkedLessonId: session.linkedLessonId,
      contextSummary: session.contextSummary,
    }
    await commonRepository.updateAITaskLog(session.id, {
      status: 'completed',
      input: input as unknown as Record<string, unknown>,
      output: { sessionStatus: status, messageCount: session.messages.length },
      completedAt: session.updatedAt,
    })
    void log
  }
}

export const conversationCoreService = new ConversationCoreService()
