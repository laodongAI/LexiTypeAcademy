<template>
<div class="unit-learning-page">
<header class="learning-header"><button type="button" @click="goBack">← 返回单元</button><div class="header-copy"><span class="eyebrow">UNIT LEARNING</span><h1>{{ course?.title || '单元整体学习' }}</h1><div>先整体理解，再学习重点句、词汇与语法，最后主动输出。</div></div><div v-if="course" class="header-meta"><span>{{ course.cefrLevel || course.difficulty }}</span><span>{{ course.lessons.length }} 个内容课时</span></div></header>
<div v-if="loading" class="loading-state">正在加载单元材料…</div><div v-if="!loading && loadError" class="load-error"><h2>无法打开单元</h2><div>{{ loadError }}</div><button type="button" @click="goBack">返回课程</button></div>
<div v-if="!loading && !loadError && course">
<section class="mode-picker"><span class="section-kicker">选择学习方式</span><h2>今天，你想怎么学？</h2><div class="mode-cards"><button type="button" class="mode-card" :class="{ selected: learningMode === 'self' }" @click="learningMode = 'self'"><strong>自主学习</strong><span>自己点读、跟读、完成小测，查看真实作答反馈。</span><b>{{ learningMode === 'self' ? '正在使用' : '自己开始' }}</b></button><button type="button" class="mode-card teacher-mode" :class="{ selected: learningMode === 'teacher' }" @click="chooseTeacherMode"><strong>AI 老师带学</strong><span>老师讲解、提问、等待回答，再根据回答纠错并带你继续。</span><b>{{ teacherLoading ? '准备中…' : learningMode === 'teacher' ? '老师课堂中' : '请老师带我学' }}</b></button></div></section>
<div v-if="learningMode === 'self'">
<section class="progress-strip"><strong>单元学习流程</strong><span>{{ progressPercent }}% 已完成 · {{ skippedCount }} 个阶段已跳过</span><div class="progress-track"><span :style="{ width: progressPercent + '%' }"></span></div></section>
<nav class="stage-nav"><button v-for="(stage, index) in stages" :key="stage.id" type="button" :class="{ active: currentStage === stage.id, done: completedStages.includes(stage.id), skipped: skippedStages.includes(stage.id) }" @click="currentStage = stage.id">{{ completedStages.includes(stage.id) ? '✓' : skippedStages.includes(stage.id) ? '↷' : index + 1 }}. {{ stage.label }}</button></nav>
<div class="stage-layout"><main class="stage-main"><div class="stage-heading"><span class="section-kicker">STAGE {{ stageIndex + 1 }} / {{ stages.length }}</span><h2>{{ activeStage.label }}</h2><div>{{ activeStage.description }}</div></div>
<div v-if="currentStage === 'intro'" class="intro-panel"><h3>先建立整单元的整体认识</h3><div>{{ course.description || '本单元将通过原文理解、重点句、词汇、语法和输出练习，逐步建立完整的语言能力。' }}</div><div class="overview-grid"><div><strong>{{ readingItems.length }}</strong><span>篇章/对话</span></div><div><strong>{{ sentenceItems.length }}</strong><span>重点句</span></div><div><strong>{{ vocabularyItems.length }}</strong><span>词汇/短语</span></div></div></div>
<div v-if="currentStage === 'reading'" class="material-list"><div v-for="item in readingItems" :key="item.key" class="material-card"><strong>{{ item.lessonTitle }}</strong><h3>{{ item.english }}</h3><div v-if="showTranslations && item.chinese">{{ item.chinese }}</div><button type="button" @click="playText(item.english, item.key)">朗读</button><button v-if="item.lessonId && item.practiceItemId" type="button" @click="openFollowRead(item)">跟读评分</button><button type="button" @click="showTranslations = !showTranslations">{{ showTranslations ? '隐藏翻译' : '显示翻译' }}</button></div><div v-if="!readingItems.length">本单元暂时没有篇章/对话原文，可以继续学习重点句和词汇。</div></div>
<div v-if="currentStage === 'sentences'" class="material-list"><div v-for="(item, index) in sentenceItems" :key="item.key" class="material-card"><strong>重点句 {{ index + 1 }} · {{ item.lessonTitle }}</strong><h3>{{ item.english }}</h3><div>{{ item.chinese }}</div><button type="button" @click="playText(item.english, item.key)">听句子</button><button v-if="item.lessonId && item.practiceItemId" type="button" @click="openFollowRead(item)">跟读评分</button></div><div v-if="!sentenceItems.length">本单元没有可识别的完整句子，请检查教材内容。</div></div>
<div v-if="currentStage === 'vocabulary'" class="vocabulary-grid"><div v-for="item in vocabularyItems" :key="item.key" class="vocabulary-card"><h3>{{ item.english }}</h3><span>{{ item.phonetic }}</span><div>{{ item.chinese || '暂无中文释义' }}</div><button type="button" @click="playText(item.english, item.key)">朗读单词</button><button v-if="item.lessonId && item.practiceItemId" type="button" @click="openFollowRead(item)">跟读评分</button><div v-if="item.examples?.length">例句：{{ item.examples[0] }}</div></div><div v-if="!vocabularyItems.length">本单元暂无独立词汇课，请补充重点词条。</div></div>
<div v-if="currentStage === 'grammar'" class="grammar-panel"><h3>从本单元真实句子中理解语法</h3><div>AI 将基于本单元材料生成讲解，不会改写原教材。</div><button type="button" :disabled="grammarLoading" @click="generateGrammar">{{ grammarLoading ? '生成中…' : '生成语法讲解' }}</button><div v-if="grammarError">{{ grammarError }}</div><div v-if="grammarContent" class="generated-content">{{ grammarContent }}</div></div>
<div v-if="currentStage === 'output'" class="quiz-card"><div v-if="quizItem"><h3>{{ quizItem.chinese || '请根据提示写出英文' }}</h3><div>{{ quizItem.kind === 'sentence' ? '根据中文提示写出完整英文句子。' : '根据中文释义写出对应英文单词。' }}</div><input v-model="quizAnswer" :placeholder="quizItem.kind === 'sentence' ? '输入英文句子' : '输入英文单词'" @keydown.enter.prevent="submitQuiz" /><button type="button" :disabled="!quizAnswer.trim()" @click="submitQuiz">提交答案</button><button type="button" @click="playText(quizItem.english, 'quiz-reference')">听参考发音</button><div v-if="quizResult">{{ quizResult.correct ? '回答正确。' : '还需要练习。' }} {{ quizResult.message }}</div><div v-if="quizResult">参考答案：{{ quizItem.english }}</div><button v-if="quizResult" type="button" @click="nextQuiz">下一题</button></div><div v-else>本单元没有足够的句子或词汇来生成小测。</div></div>
<div v-if="currentStage === 'summary'" class="summary-panel"><h3>本次单元学习记录</h3><div>已完成 {{ completedStages.length }} / {{ stages.length }} 个阶段；跳过 {{ skippedCount }} 个；小测提交 {{ quizAttempts }} 次，正确 {{ quizCorrect }} 次。</div><div>跳过阶段不会计入完成率，也不代表已掌握内容。</div><button type="button" @click="resetUnitProgress">重新开始本单元流程</button></div>
<footer class="stage-footer"><button type="button" :disabled="stageIndex === 0" @click="moveStage(-1)">上一步</button><button v-if="currentStage !== 'summary'" type="button" @click="skipStage">跳过本阶段</button><button v-if="currentStage !== 'summary'" type="button" class="primary-action" @click="completeAndNext">完成并继续</button><button v-if="currentStage === 'summary'" type="button" class="primary-action" @click="goBack">返回单元详情</button></footer>
</main><aside class="stage-aside"><h3>本单元内容</h3><div v-for="lesson in course.lessons" :key="lesson.id" class="lesson-outline"><strong>{{ lesson.title }}</strong><small>{{ contentShapeLabel(lesson.contentShape) }} · {{ lesson.items?.length || 0 }} 条</small></div><label><input v-model="showTranslations" type="checkbox" /> 显示中文翻译</label><div>学习建议：先理解整体，再拆解重点，最后尝试独立输出。</div></aside></div>
</div>
<section v-if="!loading && !loadError && course && learningMode === 'teacher'" class="teacher-workspace"><div class="teacher-intro"><div><h2>AI 老师正在带你学习</h2><div>老师会一次讲一个重点，向你提问，并根据你的回答继续讲解。</div></div><button type="button" @click="learningMode = 'self'">切换自主学习</button></div><div v-if="teacherError">{{ teacherError }}</div><div class="teacher-messages" ref="messagesRef"><div v-if="!teacherSession?.messages.length && !teacherLoading">点击 AI 老师带学后，老师会开始本单元导入。</div><div v-for="message in teacherSession?.messages || []" :key="message.id" class="teacher-message" :class="message.role"><strong>{{ message.role === 'assistant' ? 'AI 老师' : '你' }}</strong><div>{{ message.content }}</div><small>{{ formatTime(message.createdAt) }}</small><button v-if="message.role === 'assistant'" type="button" @click="playText(message.content, 'teacher-' + message.id, 'zh')">朗读老师讲解</button></div><div v-if="teacherLoading">老师正在思考…</div></div><form class="teacher-composer" @submit.prevent="sendTeacherAnswer"><input v-model="teacherDraft" placeholder="写下你的回答，也可以用中文提问" :disabled="teacherLoading || !teacherSession || teacherSession.status !== 'active'" /><button type="submit" :disabled="!teacherDraft.trim() || !teacherSession || teacherSession.status !== 'active' || teacherLoading">{{ teacherLoading ? '老师思考中…' : '回答老师' }}</button></form></section>
</div>
</div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ContentShape, type Course, type LessonItem } from '../../shared/types/course'
import { courseRepository } from '../../shared/database/repositories/courseRepository'
import { AIService } from '../../shared/services/ai/aiService'
import { conversationCoreService, type ConversationSession } from '../../shared/services/conversationCoreService'
import { isAnswerCorrect, textSimilarity } from '../../shared/utils/textCompare'
import { splitSentences } from '../../shared/utils/sentenceSplit'
import { playSpeech, stopSpeech } from '../composables/useSpeechPlayer'

type StageId = 'intro' | 'reading' | 'sentences' | 'vocabulary' | 'grammar' | 'output' | 'summary'
type LearningMode = 'self' | 'teacher'
interface TeachingMaterial {
  key: string
  lessonTitle: string
  lessonId?: string
  practiceItemId?: string
  english: string
  chinese: string
  phonetic?: string
  partOfSpeech?: string
  examples?: string[]
  exampleTranslations?: string[]
  kind?: 'sentence' | 'word'
}
interface QuizResult { correct: boolean; message: string }

const route = useRoute()
const router = useRouter()
const aiService = new AIService()
const courseId = computed(() => String(route.params.courseId || ''))
const course = ref<Course | null>(null)
const loading = ref(true)
const loadError = ref('')
const learningMode = ref<LearningMode>('self')
const currentStage = ref<StageId>('intro')
const completedStages = ref<StageId[]>([])
const skippedStages = ref<StageId[]>([])
const showTranslations = ref(true)
const grammarContent = ref('')
const grammarLoading = ref(false)
const grammarError = ref('')
const quizAnswer = ref('')
const quizResult = ref<QuizResult | null>(null)
const quizAttempts = ref(0)
const quizCorrect = ref(0)
const quizIndex = ref(0)
const teacherSession = ref<ConversationSession | null>(null)
const teacherDraft = ref('')
const teacherLoading = ref(false)
const teacherError = ref('')
const messagesRef = ref<HTMLElement | null>(null)

const stages: { id: StageId; label: string; description: string }[] = [
  { id: 'intro', label: '单元导入', description: '了解本单元主题、材料构成与学习目标。' },
  { id: 'reading', label: '通读短文', description: '先理解文章或对话整体，不急着逐词拆解。' },
  { id: 'sentences', label: '重点句子', description: '听句子、看译文，观察表达方式和句子结构。' },
  { id: 'vocabulary', label: '重点词汇', description: '学习教材已有的重点词与短语，听发音并查看例句。' },
  { id: 'grammar', label: '语法讲解', description: '从本单元真实句子中提炼语法点，并生成针对性练习。' },
  { id: 'output', label: '输出检查', description: '尝试独立写出英文，查看基于实际作答的反馈。' },
  { id: 'summary', label: '单元总结', description: '回顾已完成的阶段和本次小测表现。' },
]

const activeStage = computed(() => stages.find(stage => stage.id === currentStage.value) || stages[0])
const stageIndex = computed(() => stages.findIndex(stage => stage.id === currentStage.value))
const progressPercent = computed(() => Math.round((completedStages.value.length / stages.length) * 100))
const skippedCount = computed(() => skippedStages.value.length)
const readingItems = computed<TeachingMaterial[]>(() => {
  const lessons = course.value?.lessons.filter(lesson => [ContentShape.Passage, ContentShape.Dialog].includes(lesson.contentShape)) || []
  return lessons.flatMap(lesson => {
    const items = lesson.items.filter(item => item.english?.trim())
    if (!items.length) return []
    return [{
      key: lesson.id,
      lessonTitle: lesson.title,
      english: items.map(item => item.english.trim()).join(' '),
      chinese: items.map(item => item.chinese?.trim()).filter(Boolean).join(' '),
    }]
  })
})
const sentenceItems = computed<TeachingMaterial[]>(() => {
  const lessons = course.value?.lessons || []
  return lessons.flatMap(lesson => {
    if (lesson.contentShape === ContentShape.Sentence) {
      return lesson.items.filter(item => item.english?.trim()).map(item => ({
        key: item.id, lessonTitle: lesson.title, lessonId: lesson.id, practiceItemId: item.id, english: item.english, chinese: item.chinese || '', kind: 'sentence' as const,
      }))
    }
    if ([ContentShape.Passage, ContentShape.Dialog].includes(lesson.contentShape)) {
      return lesson.items.flatMap(item => splitSentences(item.english || '').map((sentence, index) => ({
        key: `${item.id}-sentence-${index}`, lessonTitle: `${lesson.title} · 从原文提取`, english: sentence.text, chinese: '', kind: 'sentence' as const,
      })))
    }
    return []
  })
})
const vocabularyItems = computed<TeachingMaterial[]>(() => (course.value?.lessons || [])
  .filter(lesson => [ContentShape.Word, ContentShape.Phrase].includes(lesson.contentShape))
  .flatMap(lesson => lesson.items.filter(item => item.english?.trim()).map(item => ({
    key: item.id, lessonTitle: lesson.title, lessonId: lesson.id, practiceItemId: item.id, english: item.english, chinese: item.chinese || '',
    phonetic: item.phonetic, partOfSpeech: item.partOfSpeech, examples: item.examples || [], exampleTranslations: item.exampleTranslations || [],
  }))))
const quizItem = computed<TeachingMaterial | null>(() => {
  if (sentenceItems.value.length) {
    const item = sentenceItems.value[quizIndex.value % sentenceItems.value.length]
    return { ...item, kind: 'sentence' }
  }
  if (vocabularyItems.value.length) {
    const item = vocabularyItems.value[quizIndex.value % vocabularyItems.value.length]
    return { ...item, kind: 'word' }
  }
  return null
})

function contentShapeLabel(shape: ContentShape): string {
  const labels: Record<string, string> = { word: '词汇', phrase: '短语', sentence: '句子', passage: '篇章', dialog: '对话' }
  return labels[shape] || shape
}
function formatTime(value: number): string {
  return new Date(value).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}
function checkpointKey(): string { return `lexitype_unit_learning_${courseId.value}` }
function saveCheckpoint(): void {
  if (!courseId.value) return
  try {
    localStorage.setItem(checkpointKey(), JSON.stringify({
      currentStage: currentStage.value, completedStages: completedStages.value, skippedStages: skippedStages.value,
      quizAttempts: quizAttempts.value, quizCorrect: quizCorrect.value, quizIndex: quizIndex.value,
      grammarContent: grammarContent.value,
      updatedAt: Date.now(),
    }))
  } catch { /* private browsing/storage limits: learning can continue without checkpoint */ }
}
function loadCheckpoint(): void {
  try {
    const raw = localStorage.getItem(checkpointKey())
    if (!raw) return
    const saved = JSON.parse(raw) as { currentStage?: StageId; completedStages?: StageId[]; skippedStages?: StageId[]; quizAttempts?: number; quizCorrect?: number; quizIndex?: number; grammarContent?: string }
    if (stages.some(stage => stage.id === saved.currentStage)) currentStage.value = saved.currentStage!
    if (Array.isArray(saved.completedStages)) completedStages.value = saved.completedStages.filter(id => stages.some(stage => stage.id === id))
    if (Array.isArray(saved.skippedStages)) skippedStages.value = saved.skippedStages.filter(id => stages.some(stage => stage.id === id) && !completedStages.value.includes(id))
    quizAttempts.value = Math.max(0, Number(saved.quizAttempts || 0))
    quizCorrect.value = Math.max(0, Number(saved.quizCorrect || 0))
    quizIndex.value = Math.max(0, Number(saved.quizIndex || 0))
    grammarContent.value = typeof saved.grammarContent === 'string' ? saved.grammarContent : ''
  } catch { /* ignore a damaged checkpoint and start a clean flow */ }
}
watch([currentStage, completedStages, skippedStages, quizAttempts, quizCorrect, quizIndex], saveCheckpoint, { deep: true })

async function loadCourse(): Promise<void> {
  loading.value = true
  loadError.value = ''
  try {
    const found = await courseRepository.getCourseById(courseId.value)
    if (!found) { loadError.value = '课程不存在或已被删除。'; return }
    course.value = found
    loadCheckpoint()
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : '读取课程失败。'
  } finally { loading.value = false }
}
function goBack(): void { router.push(`/courses/${courseId.value}`) }
function moveStage(delta: number): void {
  const next = Math.min(stages.length - 1, Math.max(0, stageIndex.value + delta))
  currentStage.value = stages[next].id
}
function completeAndNext(): void {
  if (!completedStages.value.includes(currentStage.value)) completedStages.value = [...completedStages.value, currentStage.value]
  skippedStages.value = skippedStages.value.filter(id => id !== currentStage.value)
  moveStage(1)
}
function skipStage(): void {
  if (!completedStages.value.includes(currentStage.value) && !skippedStages.value.includes(currentStage.value)) {
    skippedStages.value = [...skippedStages.value, currentStage.value]
  }
  moveStage(1)
  ElMessage.info('已跳过本阶段；跳过内容不会计入已完成进度或掌握成绩。')
}
function resetUnitProgress(): void {
  currentStage.value = 'intro'
  completedStages.value = []
  skippedStages.value = []
  quizAttempts.value = 0
  quizCorrect.value = 0
  quizIndex.value = 0
  quizResult.value = null
  try { localStorage.removeItem(checkpointKey()) } catch { /* ignore */ }
}
function openFollowRead(item: TeachingMaterial): void {
  if (!item.lessonId || !item.practiceItemId) return
  router.push({
    name: 'LessonPractice',
    params: { lessonId: item.lessonId },
    query: { courseId: courseId.value, lessonId: item.lessonId, mode: 'follow', itemId: item.practiceItemId },
  })
}
async function playText(text: string, key: string, language: 'en' | 'zh' = 'en'): Promise<void> {
  try {
    const success = await playSpeech(text, key, { language })
    if (!success) ElMessage.warning('这段内容暂时无法朗读，请检查语音服务设置。')
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '语音播放失败。')
  }
}
async function generateGrammar(): Promise<void> {
  if (grammarLoading.value || !course.value) return
  if (!sentenceItems.value.length) {
    grammarError.value = '本单元没有可用的英文句子，无法基于教材生成可靠的语法讲解。'
    return
  }
  grammarLoading.value = true
  grammarError.value = ''
  try {
    const source = sentenceItems.value.slice(0, 24).map((item, index) => `${index + 1}. ${item.english}${item.chinese ? `（${item.chinese}）` : ''}`).join('\n')
    grammarContent.value = await aiService.chat([
      { role: 'system', content: '你是一位严谨的英语教研老师。请只基于用户提供的句子讲解 1-3 个真正出现的语法点。输出中文，先引用原句，再解释结构、语义、易错点，最后给一个练习题和答案。若材料不足，明确说不足；不得编造原文。格式清晰，控制在 1000 中文字以内。' },
      { role: 'user', content: `单元：${course.value.title}\n课程等级：${course.value.cefrLevel || course.value.difficulty}\n以下是教材原句：\n${source}` },
    ], { temperature: 0.25, maxTokens: 1200, timeout: 120000 })
    completeStageWithoutAdvancing('grammar')
  } catch (error) {
    grammarError.value = error instanceof Error ? error.message : '语法讲解生成失败，请检查 AI 服务配置后重试。'
  } finally { grammarLoading.value = false }
}
function completeStageWithoutAdvancing(id: StageId): void {
  if (!completedStages.value.includes(id)) completedStages.value = [...completedStages.value, id]
}
function submitQuiz(): void {
  const item = quizItem.value
  const answer = quizAnswer.value.trim()
  if (!item || !answer) return
  const similarity = textSimilarity(answer, item.english)
  const correct = isAnswerCorrect(answer, item.english, 0.88)
  quizAttempts.value += 1
  if (correct) quizCorrect.value += 1
  quizResult.value = {
    correct,
    message: correct
      ? `文本相似度 ${Math.round(similarity * 100)}%。已记录本次正确作答。`
      : `文本相似度 ${Math.round(similarity * 100)}%。请对照参考答案，再听一遍后重试。`,
  }
  completeStageWithoutAdvancing('output')
}
function nextQuiz(): void {
  quizIndex.value += 1
  quizAnswer.value = ''
  quizResult.value = null
}
function unitContext(): string {
  const current = course.value
  if (!current) return ''
  const materials = current.lessons.map(lesson => ({
    title: lesson.title, shape: lesson.contentShape,
    items: lesson.items.slice(0, 40).map((item: LessonItem) => ({
      english: item.english, chinese: item.chinese, phonetic: item.phonetic,
      partOfSpeech: item.partOfSpeech, examples: item.examples?.slice(0, 2), explanation: item.explanation,
    })),
  }))
  return [
    '【单元学习材料与教学协议】',
    `课程：${current.title}；等级：${current.cefrLevel || current.difficulty}。`,
    '请按以下教学顺序持续带学：单元导入 → 通读篇章/对话 → 重点句子 → 重点词汇 → 语法 → 输出检查 → 总结。',
    '每次只讲一个小重点并提出一个主要问题，等待学员回答后再纠错/追问；不要在学员作答前直接泄露答案。用友好、耐心的中文讲解，英语示例必须来自下面材料，生成的例句要明确标注为补充例句。',
    '如果当前阶段材料不存在，说明缺失并引导进入下一阶段；不要编造教材原句。反馈必须依据学员实际回答，不声称没有证据的掌握情况。',
    JSON.stringify(materials),
  ].join('\n').slice(0, 10000)
}
async function chooseTeacherMode(): Promise<void> {
  learningMode.value = 'teacher'
  if (teacherSession.value || teacherLoading.value || !course.value) return
  teacherLoading.value = true
  teacherError.value = ''
  try {
    const title = `单元 AI 老师带学：${course.value.title}`
    const existing = (await conversationCoreService.listSessions()).find(session =>
      session.scenarioId === 'ai-tutor' && session.linkedCourseId === course.value?.id
      && session.title === title && session.status === 'active')
    if (existing) {
      teacherSession.value = existing
      await scrollTeacherMessages()
      return
    }
    const session = await conversationCoreService.createSession('ai-tutor', title, {
      courseId: course.value.id,
      contextSummary: unitContext(),
    })
    const updated = await conversationCoreService.sendMessage(session, '我们开始学习这个单元吧。请先介绍学习目标，然后进入第一步，并向我提出一个问题。')
    teacherSession.value = updated
    await scrollTeacherMessages()
  } catch (error) {
    teacherError.value = error instanceof Error ? error.message : 'AI 老师暂时无法开始，请检查 AI 服务配置后重试。'
  } finally { teacherLoading.value = false }
}
async function sendTeacherAnswer(): Promise<void> {
  const session = teacherSession.value
  const text = teacherDraft.value.trim()
  if (!session || !text || teacherLoading.value) return
  teacherLoading.value = true
  teacherError.value = ''
  teacherDraft.value = ''
  try {
    teacherSession.value = await conversationCoreService.sendMessage(session, text)
    await scrollTeacherMessages()
  } catch (error) {
    teacherDraft.value = text
    teacherError.value = error instanceof Error ? error.message : '回答发送失败，请重试。'
  } finally { teacherLoading.value = false }
}
async function scrollTeacherMessages(): Promise<void> {
  await nextTick()
  if (messagesRef.value) messagesRef.value.scrollTop = messagesRef.value.scrollHeight
}
watch(() => teacherSession.value?.messages.length, () => { void scrollTeacherMessages() })
onMounted(() => { void loadCourse() })
onBeforeUnmount(() => { stopSpeech('unit-learning-unmount') })
</script>

<style scoped>
.unit-learning-page { max-width: 1440px; margin: 0 auto; padding: 24px; color: #172033; }
.learning-header { display: grid; grid-template-columns: 1fr auto; gap: 10px 24px; align-items: center; margin-bottom: 24px; }
.learning-header > :first-child { grid-column: 1 / -1; justify-self: start; }
.header-copy h1 { margin: 4px 0 8px; font-size: clamp(26px, 3vw, 36px); letter-spacing: -0.04em; }
.header-copy p { max-width: 760px; color: #64748b; line-height: 1.7; margin: 0; }
.eyebrow, .section-kicker { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .12em; }
.header-meta { display: flex; gap: 12px; align-items: center; color: #64748b; font-size: 13px; }
.mode-picker, .progress-strip, .stage-main, .stage-aside, .teacher-workspace { background: #fff; border: 1px solid #e5eaf1; border-radius: 18px; }
.mode-picker { padding: 24px; margin-bottom: 18px; }
.mode-picker h2 { margin: 5px 0 18px; font-size: 23px; }
.mode-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.mode-card { text-align: left; display: flex; flex-direction: column; align-items: flex-start; gap: 10px; padding: 20px; border: 1px solid #dce4ef; border-radius: 14px; background: #fff; cursor: pointer; color: inherit; transition: border-color .18s, box-shadow .18s, transform .18s; }
.mode-card:hover { border-color: #94a3b8; transform: translateY(-1px); }
.mode-card.selected { border-color: #2563eb; box-shadow: 0 0 0 2px #dbeafe; background: #f8fbff; }
.mode-icon { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 11px; background: #eff6ff; color: #1d4ed8; font-size: 22px; }
.teacher-mode .mode-icon { background: #f5f3ff; color: #6d28d9; }
.mode-title { font-weight: 800; font-size: 17px; }
.mode-description { color: #64748b; font-size: 13px; line-height: 1.7; min-height: 44px; }
.mode-action { margin-top: 4px; color: #1d4ed8; font-size: 13px; font-weight: 700; }
.progress-strip { padding: 18px 22px; margin-bottom: 16px; display: grid; grid-template-columns: minmax(200px, 1fr) minmax(160px, 1.4fr); align-items: center; gap: 20px; }
.progress-copy { display: flex; flex-direction: column; gap: 4px; }
.progress-copy span { color: #64748b; font-size: 12px; }
.stage-nav { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
.stage-nav button { display: flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 999px; background: #fff; color: #475569; cursor: pointer; font-size: 13px; }
.stage-nav button.active { color: #1d4ed8; border-color: #93c5fd; background: #eff6ff; }
.stage-nav button.done { color: #166534; border-color: #86efac; background: #f0fdf4; }
.stage-nav button.skipped { color: #92400e; border-color: #fcd34d; background: #fffbeb; }
.stage-number { display: grid; place-items: center; width: 22px; height: 22px; border-radius: 50%; background: #f1f5f9; font-size: 11px; font-weight: 800; }
.stage-layout { display: grid; grid-template-columns: minmax(0, 1fr) 300px; gap: 16px; align-items: start; }
.stage-main { min-width: 0; padding: 24px; }
.stage-heading { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 22px; }
.stage-heading h2 { margin: 6px 0; font-size: 26px; }
.stage-heading p { margin: 0; color: #64748b; line-height: 1.6; }
.intro-panel, .summary-panel { padding: 26px; border-radius: 16px; background: linear-gradient(135deg, #eff6ff, #f8fafc); }
.intro-symbol, .summary-icon { display: inline-grid; place-items: center; width: 54px; height: 54px; border-radius: 16px; background: #fff; color: #1d4ed8; font-weight: 900; }
.intro-panel h3, .summary-panel h3 { margin: 18px 0 8px; font-size: 20px; }
.intro-panel p, .summary-panel p { line-height: 1.8; color: #475569; }
.overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 24px; }
.overview-grid > div { display: flex; flex-direction: column; gap: 5px; padding: 15px; background: #fff; border-radius: 12px; }
.overview-grid strong { font-size: 24px; }
.overview-grid span { color: #64748b; font-size: 12px; }
.material-list { display: flex; flex-direction: column; gap: 14px; }
.material-card, .vocabulary-card, .quiz-card, .grammar-panel { border: 1px solid #e2e8f0; border-radius: 14px; padding: 20px; }
.material-label { color: #64748b; font-size: 12px; margin-bottom: 12px; }
.material-card h3 { font-size: 19px; line-height: 1.8; margin: 0 0 8px; overflow-wrap: anywhere; }
.translation { color: #64748b; line-height: 1.7; }
.material-actions, .sentence-actions, .quiz-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.vocabulary-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.word-topline { display: flex; justify-content: space-between; align-items: center; }
.word-topline h3 { margin: 0; font-size: 20px; }
.phonetic { display: block; color: #7c3aed; font-family: ui-monospace, monospace; margin-top: 8px; }
.vocabulary-card > p { margin: 10px 0; }
.vocabulary-card small { color: #64748b; }
.example { margin-top: 16px; padding-top: 12px; border-top: 1px solid #e2e8f0; }
.example p { line-height: 1.6; margin: 0 0 5px; }
.example small { display: block; }
.grammar-panel { display: flex; flex-direction: column; gap: 16px; }
.grammar-heading { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
.grammar-heading h3 { margin: 0 0 6px; }
.grammar-heading p { color: #64748b; font-size: 13px; margin: 0; line-height: 1.7; }
.generated-content { white-space: pre-wrap; line-height: 1.9; overflow-wrap: anywhere; }
.quiz-card h3 { font-size: 23px; line-height: 1.7; }
.quiz-actions { margin-bottom: 16px; }
.reference-answer { display: flex; flex-direction: column; gap: 6px; margin-top: 18px; padding: 14px; border-radius: 10px; background: #f8fafc; }
.reference-answer span { color: #64748b; font-size: 12px; }
.next-question { margin-top: 12px; }
.stage-footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 28px; padding-top: 20px; border-top: 1px solid #e2e8f0; }
.stage-footer-right { display: flex; gap: 8px; }
.stage-aside { padding: 22px; }
.stage-aside h3 { margin: 0 0 18px; }
.lesson-outline { display: flex; gap: 10px; align-items: flex-start; padding: 12px 0; border-bottom: 1px solid #f1f5f9; }
.outline-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 6px; background: #94a3b8; flex: none; }
.outline-dot.passage { background: #2563eb; } .outline-dot.dialog { background: #7c3aed; } .outline-dot.word, .outline-dot.phrase { background: #0d9488; } .outline-dot.sentence { background: #d97706; }
.lesson-outline strong, .lesson-outline small { display: block; overflow-wrap: anywhere; }
.lesson-outline strong { font-size: 13px; line-height: 1.5; }
.lesson-outline small { margin-top: 4px; color: #64748b; }
.aside-note { font-size: 12px; line-height: 1.7; color: #64748b; margin-top: 18px; }
.stage-footer :deep(.el-button) { min-height: 38px; }
.teacher-workspace { padding: 24px; }
.teacher-intro { display: flex; align-items: center; gap: 14px; padding-bottom: 18px; border-bottom: 1px solid #e2e8f0; }
.teacher-intro h2 { margin: 0 0 6px; font-size: 22px; }
.teacher-intro p { margin: 0; color: #64748b; line-height: 1.6; font-size: 13px; }
.teacher-intro > div:nth-child(2) { flex: 1; }
.teacher-avatar, .message-avatar { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 14px; background: #ede9fe; color: #6d28d9; font-weight: 800; flex: none; }
.teacher-messages { display: flex; flex-direction: column; gap: 14px; min-height: 320px; max-height: min(58vh, 680px); overflow-y: auto; padding: 22px 2px; }
.teacher-message { display: flex; align-items: flex-start; gap: 12px; padding: 16px; border: 1px solid #e2e8f0; border-radius: 14px; }
.teacher-message.user { background: #f8fafc; }
.teacher-message .message-body { flex: 1; min-width: 0; }
.message-body p { white-space: pre-wrap; line-height: 1.8; overflow-wrap: anywhere; margin: 8px 0; }
.message-body small { color: #94a3b8; }
.teacher-message.user .message-avatar { background: #dbeafe; color: #1d4ed8; }
.teacher-thinking { color: #64748b; display: flex; align-items: center; gap: 5px; padding: 8px; }
.teacher-thinking span { width: 6px; height: 6px; border-radius: 50%; background: #8b5cf6; animation: pulse 1s infinite alternate; }
.teacher-thinking span:nth-child(2) { animation-delay: .2s; } .teacher-thinking span:nth-child(3) { animation-delay: .4s; }
.teacher-composer { padding-top: 18px; border-top: 1px solid #e2e8f0; }
.composer-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-top: 12px; }
.composer-footer span { color: #64748b; font-size: 12px; line-height: 1.6; }
@keyframes pulse { from { opacity: .35; transform: translateY(0); } to { opacity: 1; transform: translateY(-2px); } }
@media (max-width: 960px) { .stage-layout { grid-template-columns: 1fr; } .stage-aside { order: -1; } }
@media (max-width: 680px) {
  .unit-learning-page { padding: 14px; }
  .mode-cards, .vocabulary-grid, .progress-strip { grid-template-columns: 1fr; }
  .learning-header { grid-template-columns: 1fr; }
  .header-meta { justify-content: flex-start; }
  .stage-main, .stage-aside, .mode-picker, .teacher-workspace { padding: 16px; }
  .stage-nav { gap: 6px; }
  .stage-nav button { font-size: 12px; padding: 8px 10px; }
  .stage-heading, .grammar-heading, .teacher-intro, .composer-footer { align-items: flex-start; flex-direction: column; }
  .teacher-message { flex-wrap: wrap; }
  .teacher-message .message-body { min-width: calc(100% - 55px); }
  .stage-footer { flex-direction: column; }
  .stage-footer-right { justify-content: flex-end; flex-wrap: wrap; }
}
</style>
