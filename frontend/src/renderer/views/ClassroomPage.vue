<script setup lang="ts">
/**
 * 沉浸式课堂页
 *
 * 结构：
 *   - 顶部课堂导航：返回、课程/课时信息、模式切换、课堂设置；
 *   - 左侧舞台：精读 / 句子燃尽 / 词燃尽 / 词根；
 *   - 右侧课堂助手：进度、提示、本课内容概览；
 *   - 完成弹窗：展示本课统计并支持再练一次。
 */

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { storeToRefs } from 'pinia'
import {
  ArrowLeft,
  CircleCheck,
  Collection,
  EditPen,
  MagicStick,
  Mouse,
  Reading,
  SwitchButton,
} from '@element-plus/icons-vue'
import type { Course, Lesson } from '../../shared/types/course'
import { courseRepository } from '../../shared/database/repositories/courseRepository'
import { commonRepository } from '../../shared/database/repositories/commonRepository'
import { createLogger } from '../../shared/utils/logger'
import { useSettingsStore } from '../stores/settings'
import { buildLessonFeedback } from '../../shared/utils/lessonFeedback'
import type { FeedbackMode, LessonFeedbackResult, LessonMetrics } from '../../shared/utils/lessonFeedback'
import ReaderStage from '../components/classroom/ReaderStage.vue'
import BurnDownStage from '../components/classroom/BurnDownStage.vue'
import WordRootStage from '../components/classroom/WordRootStage.vue'
import LessonFeedbackDialog from '../components/classroom/LessonFeedbackDialog.vue'
import TeacherBubble from '../components/classroom/TeacherBubble.vue'
import { useTeacherGuide } from '../composables/useTeacherGuide'
import type { ClassroomMode } from '../../shared/types/classroom'

/** 日志器 */
const logger = createLogger('classroom')

/** 路由与跳转 */
const route = useRoute()
const router = useRouter()

/** 课程 ID（来自查询参数） */
const courseId = computed(() => String(route.query.courseId || ''))
/** 课时 ID（来自路径参数） */
const lessonId = computed(() => String(route.params.lessonId || ''))

/** 当前课程 */
const course = ref<Course | null>(null)
/** 当前课时 */
const lesson = ref<Lesson | null>(null)
/** 加载状态 */
const loading = ref(true)
/** 加载错误 */
const loadError = ref('')

/** 当前课堂模式 */
const mode = ref<ClassroomMode>('reader')
/** 悬停朗读开关 */
const hoverEnabled = ref(route.query.hover !== '0')
/** 中文提示开关 */
const showChinese = ref(route.query.zh !== '0')

/** 精读统计 */
const readerStats = ref({ sentencesRead: 0, lookupCount: 0 })
/** 燃尽进度 */
const burnProgress = ref({ current: 1, total: 1, stage: 0, maxStage: 0 })
/** 舞台重建键：点击"再练一次"时强制重置子组件状态 */
const retryKey = ref(0)
/** 本课开始时间：用于点评里的用时统计 */
const lessonStartedAt = ref(Date.now())

/** 设置仓库：读取学习昵称 */
const settingsStore = useSettingsStore()
const { nickname } = storeToRefs(settingsStore)

/** 昵称引导跳过标记的存储键（跳过后本机不再重复弹出） */
const NICKNAME_SKIP_KEY = 'lexitype_nickname_prompt_skipped'
/** 是否显示昵称引导 */
const showNicknameGuide = ref(false)
/** 昵称输入草稿 */
const nicknameDraft = ref('')
/** 是否已在本会话内检查过昵称引导，避免重复弹出 */
let nicknameGuideChecked = false

/** 点评结果 */
const feedbackResult = ref<LessonFeedbackResult | null>(null)
/** 点评卡是否显示 */
const showFeedback = ref(false)
/** 点评卡展示的课堂用时 */
const feedbackDurationMs = ref(0)

/** 精读舞台引用：用于左右键切句与空格朗读 */
const readerStageRef = ref<InstanceType<typeof ReaderStage> | null>(null)
/** 燃尽舞台引用：句子/词模式共用，同一时刻只挂载其一 */
const burnStageRef = ref<InstanceType<typeof BurnDownStage> | null>(null)

/** 老师语音引导：字幕、播报、静音与打断控制 */
const {
  currentText: teacherText,
  visible: teacherVisible,
  speaking: teacherSpeaking,
  muted: teacherMuted,
  say: teacherSay,
  replay: teacherReplay,
  setMuted: setTeacherMuted,
  stop: stopTeacher,
} = useTeacherGuide()

/** 已提示过的燃尽单元键：避免同一题反复播报 */
let lastPromptedUnitKey = ''
/** 鼓励台词轮换下标 */
let praiseIndex = 0
/** 纠错台词轮换下标 */
let wrongIndex = 0

/** 快捷键提示条是否高亮（首次进入高亮 3 秒） */
const shortcutHighlight = ref(true)
/** 高亮定时器 */
let shortcutTimer: ReturnType<typeof setTimeout> | null = null

/** 模式配置 */
const modeTabs = [
  { key: 'reader' as ClassroomMode, label: '精读', icon: Reading },
  { key: 'burn-sentence' as ClassroomMode, label: '句子燃尽', icon: MagicStick },
  { key: 'burn-word' as ClassroomMode, label: '词燃尽', icon: EditPen },
  { key: 'root' as ClassroomMode, label: '词根', icon: Collection },
]

/** 当前模式展示名：点评卡副标题使用 */
const modeLabel = computed(() => modeTabs.find(tab => tab.key === mode.value)?.label ?? '课堂')

/** 句子总数（用于精读进度） */
const totalSentences = computed(() => {
  const items = lesson.value?.items ?? []
  return items.reduce((total, item) => {
    const count = (item.english || '').split(/[.!?]+/).filter(part => part.trim()).length
    return total + Math.max(1, count)
  }, 0)
})

/** 当前模式总进度百分比 */
const progressPercent = computed(() => {
  if (mode.value === 'reader') {
    if (totalSentences.value === 0) return 0
    return Math.min(100, Math.round((readerStats.value.sentencesRead / totalSentences.value) * 100))
  }
  if (mode.value === 'burn-sentence' || mode.value === 'burn-word') {
    if (burnProgress.value.total === 0) return 0
    return Math.min(100, Math.round(((burnProgress.value.current - 1) / burnProgress.value.total) * 100))
  }
  return 0
})

/** 右侧提示文案 */
const classroomTips = computed<string[]>(() => {
  if (mode.value === 'reader') {
    return [
      '鼠标划过句子会自动朗读，停在单词上查看词卡。',
      '遇到生词可直接加入生词本，不打断阅读。',
      '关闭“悬停朗读”后，可点击句子手动播放。',
    ]
  }
  if (mode.value === 'burn-sentence') {
    return [
      '做对两次升级一级，做错自动回退一级。',
      '遮蔽从句子末尾开始，像文字被逐词烧掉。',
      '卡住时点“查看提示”，回退一级继续。',
    ]
  }
  if (mode.value === 'burn-word') {
    return [
      '五级提示：完整拼写 → 首尾 → 首字母 → 中文 → 听音拼写。',
      '一次正确即升级，错误回退一级。',
      '先听发音，再默写，记忆更牢。',
    ]
  }
  return [
    '按词根聚合派生词，一组记住一串词。',
    '整组听读后再做遮中文回忆。',
    '点击卡片可揭示中文，检验是否真的记住。',
  ]
})

/**
 * 生成当前模式的玩法讲解
 * @param target 目标模式
 * @returns 老师台词
 */
function modeIntroText(target: ClassroomMode): string {
  const title = lesson.value?.title || '这一课'
  if (target === 'reader') {
    return `今天我们精读《${title}》。鼠标划过句子会自动朗读，遇到生词可以打开词卡。`
  }
  if (target === 'burn-sentence') {
    return `我们来做句子燃尽。先听一遍示范，再点开始，让文字从末尾逐个烧掉。`
  }
  if (target === 'burn-word') {
    return `我们来做词燃尽。先听发音，再补全字母，一次答对就升一级。`
  }
  return `我们来看词根。把同一词根的词放在一起记，一串词就都记住了。`
}

/**
 * 进入课堂开场：称呼学员 + 当前模式玩法
 */
function startLessonGuidance(): void {
  if (!lesson.value) return
  const name = (nickname.value || '').trim()
  const opening = name ? `${name}，我们开始吧。` : '我们开始吧。'
  const isBurn = mode.value === 'burn-sentence' || mode.value === 'burn-word'
  // 燃尽模式在开场里直接报第一题，随后自动播放示范音
  const firstPrompt = isBurn
    ? `第 1 个${mode.value === 'burn-word' ? '单词' : '句子'}，先听一遍示范，再点开始。`
    : ''
  teacherSay(`${opening}${modeIntroText(mode.value)}${firstPrompt}`, {
    priority: 3,
    dedupeKey: `open:${lesson.value.id}:${mode.value}`,
    dedupeWindowMs: 1500,
    onDone: isBurn ? () => burnStageRef.value?.playReference() : undefined,
  })
}

/** 答对时的鼓励台词（轮换，避免重复） */
const praiseLines = [
  '不错，就是这样。',
  '很稳，继续保持。',
  '对了，再跟读一遍会更牢。',
  '漂亮，记忆正在变牢。',
]

/** 答错时的纠正台词（轮换，聚焦下一步动作） */
const wrongLines = [
  '差一点，再看一眼提示。',
  '没关系，回退一级更扎实。',
  '先听一遍示范，再补全。',
]

/**
 * 燃尽作答反馈：决定老师下一句是鼓励还是纠正
 * @param payload 作答事件
 */
function onBurnAnswer(payload: {
  correct: boolean
  expected: string
  input: string
  unitKey: string
  unitIndex: number
  stage: number
  mode: 'sentence' | 'word'
}): void {
  if (payload.correct) {
    const line = praiseLines[praiseIndex % praiseLines.length]
    praiseIndex += 1
    teacherSay(line, {
      priority: 2,
      dedupeKey: `praise:${payload.unitKey}:${payload.stage}`,
      dedupeWindowMs: 5000,
    })
    return
  }

  const line = wrongLines[wrongIndex % wrongLines.length]
  wrongIndex += 1
  teacherSay(line, {
    priority: 2,
    dedupeKey: `wrong:${payload.unitKey}:${payload.stage}`,
    dedupeWindowMs: 5000,
  })
}

/**
 * 燃尽超时：按提醒次数逐级升级提示
 * @param payload 超时事件
 */
function onBurnIdle(payload: {
  count: number
  unitKey: string
  unitIndex: number
  stage: number
}): void {
  const firstReminder = payload.count <= 1
  const line = firstReminder
    ? '还在想吗？先听一遍示范，再试一次。'
    : '卡住了就点查看提示，回退一级也没关系。'

  teacherSay(line, {
    priority: 2,
    dedupeKey: `idle:${payload.unitKey}:${payload.count}`,
    dedupeWindowMs: 3000,
    // 第一次超时顺带播一遍当前示范音，帮助学员重新起步
    onDone: firstReminder ? () => burnStageRef.value?.playReference() : undefined,
  })
}

/**
 * 精读活动反馈：查词与加入生词本的时机给方法提示
 * @param payload 活动事件
 */
function onReaderActivity(payload: {
  type: 'lookup' | 'add-word'
  word: string
  matched?: boolean
}): void {
  if (payload.type === 'lookup') {
    teacherSay('遇到生词不用停下来，先看词卡，再继续读。', {
      priority: 1,
      dedupeKey: 'reader:lookup',
      dedupeWindowMs: 60000,
    })
    return
  }

  teacherSay('已经放进生词本，复习时会再见到它。', {
    priority: 1,
    dedupeKey: `reader:add:${payload.word}`,
    dedupeWindowMs: 15000,
  })
}

/**
 * 切换课堂模式
 * @param next 目标模式
 */
function switchMode(next: ClassroomMode): void {
  if (mode.value === next) return
  mode.value = next
  logger.info('切换课堂模式', { mode: next })
  // 切换后立即讲解新玩法，帮助学员建立操作预期
  teacherSay(modeIntroText(next), {
    priority: 2,
    dedupeKey: `mode:${next}`,
    dedupeWindowMs: 4000,
  })
  void router.replace({
    path: route.path,
    query: { ...route.query, mode: next },
  })
}

/**
 * 燃尽进度变化：换题或回到起始阶段时，老师报题并自动播放示范
 */
watch(
  () => [burnProgress.value.current, burnProgress.value.stage, burnProgress.value.total],
  () => {
    if (mode.value !== 'burn-sentence' && mode.value !== 'burn-word') return
    if (!lesson.value || loading.value || showNicknameGuide.value || showFeedback.value) return
    if (burnProgress.value.total <= 0) return

    const unitKey = `${mode.value}:${burnProgress.value.current}`
    const isNewUnit = unitKey !== lastPromptedUnitKey
    const isStartStage = burnProgress.value.stage === 0
    // 同一题的中间阶段不打扰，只在新题或起始阶段提示
    if (!isNewUnit && !isStartStage) return

    lastPromptedUnitKey = unitKey
    const label = mode.value === 'burn-word' ? '单词' : '句子'
    const text = isStartStage
      ? `第 ${burnProgress.value.current} 个${label}，先听一遍示范，再点开始燃尽。`
      : `第 ${burnProgress.value.current} 个${label}，先听示范，再补全。`

    teacherSay(text, {
      priority: 2,
      dedupeKey: `burn:${unitKey}:${isStartStage ? 'start' : 'play'}`,
      dedupeWindowMs: 4000,
      // 老师说完后接续播放当前单元的示范音
      onDone: () => burnStageRef.value?.playReference(),
    })
  },
)

/**
 * 切换悬停朗读
 */
function toggleHover(): void {
  hoverEnabled.value = !hoverEnabled.value
  logger.debug('切换悬停朗读', { enabled: hoverEnabled.value })
}

/**
 * 切换中文提示
 */
function toggleChinese(): void {
  showChinese.value = !showChinese.value
  logger.debug('切换中文提示', { enabled: showChinese.value })
}

/**
 * 返回课程详情
 */
function goBack(): void {
  if (courseId.value) {
    void router.push(`/courses/${courseId.value}`)
    return
  }
  void router.back()
}

/**
 * 同步课程进度：完成课时 + 更新百分比
 * 说明：进度失败不阻塞点评，只记录日志。
 */
async function syncCourseProgress(): Promise<void> {
  try {
    if (!courseId.value || !lesson.value) return
    const progress = await courseRepository.getCourseProgress(courseId.value)
    const completed = new Set(progress?.completedLessonIds ?? [])
    completed.add(lesson.value.id)
    const total = course.value?.lessons.length ?? 1
    await courseRepository.updateCourseProgress({
      courseId: courseId.value,
      completedLessonIds: Array.from(completed),
      currentLessonId: lesson.value.id,
      completionPercentage: Math.min(100, Math.round((completed.size / total) * 100)),
      lastStudiedAt: Date.now(),
    })
    logger.info('课程进度已更新', { completed: completed.size, total })
  } catch (error) {
    logger.warn('更新课程进度失败', { error })
  }
}

/**
 * 打开点评卡并保存点评记录
 * @param metrics 课堂指标
 * @param durationMs 课堂用时（毫秒）
 */
async function presentFeedback(metrics: LessonMetrics, durationMs: number): Promise<void> {
  if (!lesson.value) return
  // 以课时 ID 作为文案种子，保证同一课多次完成文案稳定
  const seed = lesson.value.id || `${courseId.value}-${Date.now()}`
  const result = buildLessonFeedback(metrics, nickname.value, seed)

  feedbackResult.value = result
  feedbackDurationMs.value = durationMs
  showFeedback.value = true
  logger.info('生成课堂点评', {
    mode: metrics.mode,
    stars: result.stars,
    completionRate: result.completionRate,
    firstTryRate: result.firstTryRate,
  })

  await saveFeedbackRecord(metrics, result, durationMs)
}

/**
 * 写入点评记录：复用 learning_records.metadata，不新增表
 * @param metrics 课堂指标
 * @param result 点评结果
 * @param durationMs 课堂用时（毫秒）
 */
async function saveFeedbackRecord(
  metrics: LessonMetrics,
  result: LessonFeedbackResult,
  durationMs: number,
): Promise<void> {
  if (!lesson.value) return
  try {
    await commonRepository.addLearningRecord({
      courseId: courseId.value,
      lessonId: lesson.value.id,
      activityType: 'lesson-feedback',
      score: result.stars * 20,
      accuracy: metrics.mode.startsWith('burn') ? result.firstTryRate : result.completionRate,
      duration: durationMs,
      createdAt: Date.now(),
      metadata: {
        mode: metrics.mode,
        units: metrics.units,
        totalUnits: metrics.totalUnits,
        hintsUsed: metrics.hintsUsed,
        skippedUnits: metrics.skippedUnits,
        firstTryUnits: metrics.firstTryUnits,
        lookupCount: metrics.lookupCount ?? 0,
        stars: result.stars,
        praise: result.praise,
        observation: result.observation,
        nextAction: result.nextAction,
        strengths: result.strengths,
        issues: result.issues,
      },
    })
    logger.info('课堂点评已保存', { lessonId: lesson.value.id, stars: result.stars })
  } catch (error) {
    logger.error('保存课堂点评失败', { error })
    ElMessage.warning('点评已生成，但记录保存失败，请检查本地后端服务')
  }
}

/**
 * 燃尽课堂完成
 * @param payload 完成统计（含点评所需过程指标）
 */
async function onBurnComplete(payload: {
  units: number
  totalUnits: number
  hintsUsed: number
  skippedUnits: number
  firstTryUnits: number
  durationMs: number
}): Promise<void> {
  logger.info('课堂完成', payload)
  // 老师先给一句完成反馈，再展示点评卡，衔接更自然
  teacherSay('这一课完成了，我们一起看看你的表现。', {
    priority: 3,
    dedupeKey: `summary:${lesson.value?.id || lessonId.value}:${mode.value}`,
    dedupeWindowMs: 5000,
  })
  await syncCourseProgress()

  // 燃尽模式固定映射为句子/词两种点评模式
  const metrics: LessonMetrics = {
    mode: (mode.value === 'burn-word' ? 'burn-word' : 'burn-sentence') as FeedbackMode,
    units: payload.units,
    totalUnits: payload.totalUnits,
    hintsUsed: payload.hintsUsed,
    skippedUnits: payload.skippedUnits,
    firstTryUnits: payload.firstTryUnits,
    durationMs: payload.durationMs,
  }
  await presentFeedback(metrics, payload.durationMs)
}

/**
 * 完成本课：精读 / 词根模式手动触发点评
 * 说明：燃尽模式由子组件的 complete 事件自动触发。
 */
async function finishLesson(): Promise<void> {
  if (!lesson.value) return
  const durationMs = Math.max(0, Date.now() - lessonStartedAt.value)
  const totalItems = Math.max(1, lesson.value.items.length)

  let metrics: LessonMetrics
  if (mode.value === 'reader') {
    const totalUnits = Math.max(totalSentences.value, 1)
    metrics = {
      mode: 'reader',
      // 已读句数可能因切分方式差异略超总数，这里做上限收敛
      units: Math.min(readerStats.value.sentencesRead, totalUnits),
      totalUnits,
      hintsUsed: 0,
      skippedUnits: 0,
      firstTryUnits: 0,
      lookupCount: readerStats.value.lookupCount,
      durationMs,
    }
  } else if (mode.value === 'root') {
    // 词根舞台为浏览式学习，点击"完成本课"即视为覆盖全部词条
    metrics = {
      mode: 'root',
      units: totalItems,
      totalUnits: totalItems,
      hintsUsed: 0,
      skippedUnits: 0,
      firstTryUnits: 0,
      durationMs,
    }
  } else {
    // 燃尽模式不提供手动完成入口，避免跳过过程指标
    return
  }

  logger.info('手动完成本课', { mode: metrics.mode, units: metrics.units, totalUnits: metrics.totalUnits })
  // 精读/词根完成时也给一句老师总结，保持全模式一致的收尾体验
  teacherSay('这一课完成了，我们一起看看你的表现。', {
    priority: 3,
    dedupeKey: `summary:${lesson.value.id}:${mode.value}`,
    dedupeWindowMs: 5000,
  })
  await syncCourseProgress()
  await presentFeedback(metrics, durationMs)
}

/**
 * 再练一次：关闭点评卡并重建当前舞台
 */
function retryLesson(): void {
  showFeedback.value = false
  // 递增重建键，强制销毁并重建当前舞台，清空所有中间状态
  retryKey.value += 1
  lessonStartedAt.value = Date.now()
  // 重置报题标记，让老师从第一题重新引导
  lastPromptedUnitKey = ''
  logger.info('重新开始课堂', { mode: mode.value })
}

/**
 * 检查是否需要弹出昵称引导
 * 说明：昵称为空且未标记跳过时才提示，每次进入课堂最多检查一次。
 */
function maybeShowNicknameGuide(): void {
  if (nicknameGuideChecked) return
  nicknameGuideChecked = true
  if ((nickname.value || '').trim()) return

  try {
    if (localStorage.getItem(NICKNAME_SKIP_KEY) === '1') return
  } catch (error) {
    logger.warn('读取昵称跳过标记失败', { error })
  }

  nicknameDraft.value = ''
  showNicknameGuide.value = true
  logger.debug('弹出昵称引导')
}

/**
 * 保存昵称并关闭引导
 */
function saveNickname(): void {
  const value = nicknameDraft.value.trim()
  if (!value) {
    ElMessage.warning('请输入 1–12 个字符的昵称')
    return
  }

  settingsStore.updateSettings({ nickname: value })
  showNicknameGuide.value = false
  ElMessage.success(`好的，${value}，我们开始吧`)
  logger.info('昵称已设置', { length: value.length })
  // 昵称确定后立即进入老师引导流程
  startLessonGuidance()
}

/**
 * 跳过昵称引导：本机不再重复弹出
 */
function skipNicknameGuide(): void {
  showNicknameGuide.value = false
  try {
    localStorage.setItem(NICKNAME_SKIP_KEY, '1')
  } catch (error) {
    logger.warn('写入昵称跳过标记失败', { error })
  }
  logger.debug('用户跳过昵称引导')
  // 跳过昵称也要进入老师引导，只是称呼使用通用说法
  startLessonGuidance()
}

/**
 * 判断事件目标是否为可编辑控件
 * @param target 事件目标
 * @returns 是否属于输入态
 */
function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null
  if (!element) return false
  const tag = element.tagName?.toLowerCase()
  return tag === 'input' || tag === 'textarea' || element.isContentEditable === true
}

/**
 * 全局键盘分发：交给当前舞台处理，输入态不接管导航
 * @param event 键盘事件
 */
function handleKeydown(event: KeyboardEvent): void {
  // 输入法组合、长按重复、组合键一律不拦截
  if (event.repeat || event.isComposing) return
  if (event.ctrlKey || event.metaKey || event.altKey) return

  const editable = isEditableTarget(event.target)

  // Esc：退出输入态
  if (event.key === 'Escape') {
    if (editable) {
      (event.target as HTMLElement).blur()
      event.preventDefault()
    }
    return
  }

  if (editable) return
  // 引导与点评卡展示期间不响应课堂导航
  if (showNicknameGuide.value || showFeedback.value) return

  const isBurn = mode.value === 'burn-sentence' || mode.value === 'burn-word'
  const isReader = mode.value === 'reader'

  if (event.key === 'ArrowRight') {
    if (isReader) {
      event.preventDefault()
      void readerStageRef.value?.nextSentence()
    } else if (isBurn) {
      event.preventDefault()
      burnStageRef.value?.nextUnit()
    }
    return
  }

  if (event.key === 'ArrowLeft') {
    if (isReader) {
      event.preventDefault()
      void readerStageRef.value?.prevSentence()
    } else if (isBurn) {
      event.preventDefault()
      burnStageRef.value?.prevUnit()
    }
    return
  }

  if (event.key === ' ') {
    if (isReader) {
      event.preventDefault()
      void readerStageRef.value?.playCurrent()
    } else if (isBurn) {
      event.preventDefault()
      burnStageRef.value?.playReference()
    }
  }
}

/**
 * 加载课程与课时
 */
async function loadCourse(): Promise<void> {
  loading.value = true
  loadError.value = ''
  // 切换课时/重新进入时，先停掉上一课的老师语音并重置提示状态
  stopTeacher()
  lastPromptedUnitKey = ''
  praiseIndex = 0
  wrongIndex = 0

  try {
    if (!courseId.value) {
      loadError.value = '缺少课程信息，请从课程详情页进入课堂'
      return
    }

    const found = await courseRepository.getCourseById(courseId.value)
    if (!found) {
      loadError.value = '课程不存在或已被删除'
      return
    }

    course.value = found
    const target = found.lessons.find(item => item.id === lessonId.value)
    if (!target) {
      loadError.value = '课时不存在，可能已被删除'
      return
    }

    lesson.value = target

    // 进入课堂时立即持久化当前课时，确保刷新/重启后首页可以恢复学习位置。
    // 进度写入失败不阻断课堂，但会留下可诊断日志。
    try {
      const previousProgress = await courseRepository.getCourseProgress(courseId.value)
      await courseRepository.updateCourseProgress({
        courseId: courseId.value,
        completedLessonIds: previousProgress?.completedLessonIds ?? [],
        currentLessonId: target.id,
        completionPercentage: previousProgress?.completionPercentage ?? 0,
        lastStudiedAt: Date.now(),
      })
    } catch (progressError) {
      logger.warn('保存当前学习位置失败', { courseId: courseId.value, lessonId: target.id, error: progressError })
    }

    // 每次进入（或切换）课时都重置计时起点，保证点评用时准确
    lessonStartedAt.value = Date.now()
    logger.info('进入课堂', {
      courseId: courseId.value,
      lessonId: lessonId.value,
      mode: mode.value,
      items: target.items.length,
    })

    // 首次进入课堂且未设置昵称时给出引导
    maybeShowNicknameGuide()
    // 昵称引导关闭后才开始老师开场，避免语音与弹窗互相干扰
    if (!showNicknameGuide.value) startLessonGuidance()
  } catch (error) {
    logger.error('加载课堂失败', { error })
    loadError.value = '加载课堂失败，请检查本地后端服务是否启动'
  } finally {
    loading.value = false
  }
}

/** 初始化：校验 mode 参数并加载数据 */
onMounted(async () => {
  const queryMode = String(route.query.mode || 'reader')
  const allowed: ClassroomMode[] = ['reader', 'burn-sentence', 'burn-word', 'root']
  mode.value = allowed.includes(queryMode as ClassroomMode) ? (queryMode as ClassroomMode) : 'reader'

  // 注册全局键盘监听：课堂期间接管方向键/空格
  window.addEventListener('keydown', handleKeydown)
  // 快捷键提示条首次进入高亮 3 秒，之后弱化显示
  shortcutTimer = setTimeout(() => {
    shortcutHighlight.value = false
  }, 3000)

  await loadCourse()
})

/** 监听路由参数变化：支持从课程详情再次进入不同课时 */
watch(
  () => [route.params.lessonId, route.query.courseId],
  () => {
    void loadCourse()
  },
)

/** 卸载时写回课堂偏好并移除全局监听 */
onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  // 离开课堂立即停止老师语音，避免后台残留音轨
  stopTeacher()
  if (shortcutTimer) {
    clearTimeout(shortcutTimer)
    shortcutTimer = null
  }
  try {
    localStorage.setItem('lexitype_classroom_prefs', JSON.stringify({
      hoverEnabled: hoverEnabled.value,
      showChinese: showChinese.value,
    }))
  } catch (error) {
    logger.warn('保存课堂偏好失败', { error })
  }
})
</script>

<template>
  <div class="classroom-page">
    <!-- 顶部课堂导航 -->
    <header class="classroom-topbar">
      <div class="topbar-left">
        <button class="back-button" type="button" aria-label="返回课程" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="title-block">
          <span class="course-name">{{ course?.title || '课堂' }}</span>
          <h1>{{ lesson?.title || '加载中…' }}</h1>
        </div>
      </div>

      <nav class="mode-tabs" aria-label="课堂模式">
        <button
          v-for="tab in modeTabs"
          :key="tab.key"
          type="button"
          class="mode-tab"
          :class="{ active: mode === tab.key }"
          @click="switchMode(tab.key)"
        >
          <el-icon><component :is="tab.icon" /></el-icon>
          {{ tab.label }}
        </button>
      </nav>

      <div class="topbar-right">
        <el-tooltip content="悬停朗读" placement="bottom">
          <button
            type="button"
            class="icon-toggle"
            :class="{ active: hoverEnabled }"
            @click="toggleHover"
          >
            <el-icon><Mouse /></el-icon>
          </button>
        </el-tooltip>
        <el-tooltip content="中文提示" placement="bottom">
          <button
            type="button"
            class="icon-toggle text-toggle"
            :class="{ active: showChinese }"
            @click="toggleChinese"
          >
            中
          </button>
        </el-tooltip>
        <el-button
          v-if="mode === 'reader' || mode === 'root'"
          size="small"
          type="primary"
          :icon="CircleCheck"
          @click="finishLesson"
        >
          完成本课
        </el-button>
        <el-button size="small" :icon="SwitchButton" @click="goBack">退出课堂</el-button>
      </div>
    </header>

    <!-- 加载态 -->
    <div v-if="loading" class="classroom-state">
      <el-skeleton :rows="6" animated />
    </div>

    <!-- 错误态 -->
    <div v-else-if="loadError || !lesson" class="classroom-state">
      <el-result icon="warning" title="无法进入课堂" :sub-title="loadError || '课时数据为空'">
        <template #extra>
          <el-button type="primary" @click="goBack">返回课程</el-button>
        </template>
      </el-result>
    </div>

    <!-- 课堂主体 -->
    <div v-else class="classroom-layout">
      <main class="classroom-stage">
        <ReaderStage
          v-if="mode === 'reader'"
          ref="readerStageRef"
          :key="`reader-${retryKey}`"
          :lesson="lesson"
          :course="course"
          :hover-enabled="hoverEnabled"
          :show-chinese="showChinese"
          @stats="readerStats = $event"
          @activity="onReaderActivity"
        />

        <BurnDownStage
          v-else-if="mode === 'burn-sentence'"
          ref="burnStageRef"
          :key="`burn-sentence-${retryKey}`"
          :lesson="lesson"
          :course-id="courseId"
          mode="sentence"
          :show-chinese="showChinese"
          @progress="burnProgress = $event"
          @complete="onBurnComplete"
          @answer="onBurnAnswer"
          @idle="onBurnIdle"
        />

        <BurnDownStage
          v-else-if="mode === 'burn-word'"
          ref="burnStageRef"
          :key="`burn-word-${retryKey}`"
          :lesson="lesson"
          :course-id="courseId"
          mode="word"
          :show-chinese="showChinese"
          @progress="burnProgress = $event"
          @complete="onBurnComplete"
          @answer="onBurnAnswer"
          @idle="onBurnIdle"
        />

        <WordRootStage v-else :key="`root-${retryKey}`" :lesson="lesson" />
      </main>

      <!-- 右侧课堂助手 -->
      <aside class="classroom-aside">
        <section class="aside-card progress-card">
          <div class="progress-ring" :style="{ '--percent': `${progressPercent}%` }">
            <span>{{ progressPercent }}%</span>
          </div>
          <div class="progress-copy">
            <strong>{{ mode === 'reader' ? '阅读进度' : mode === 'root' ? '词根浏览' : '燃尽进度' }}</strong>
            <span v-if="mode === 'reader'">
              已读 {{ readerStats.sentencesRead }} / {{ totalSentences }} 句
            </span>
            <span v-else-if="mode === 'burn-sentence' || mode === 'burn-word'">
              第 {{ burnProgress.current }} / {{ burnProgress.total }} 个 · 阶段 {{ burnProgress.stage }}
            </span>
            <span v-else>共 {{ lesson.items.length }} 个词条</span>
          </div>
        </section>

        <section class="aside-card">
          <h3>课堂提示</h3>
          <ul class="tip-list">
            <li v-for="(tip, index) in classroomTips" :key="index">{{ tip }}</li>
          </ul>
        </section>

        <section class="aside-card">
          <h3>本课内容</h3>
          <div class="lesson-meta">
            <span class="meta-chip">{{ lesson.contentShape }}</span>
            <span class="meta-chip">{{ lesson.items.length }} 条</span>
            <span v-if="course?.cefrLevel" class="meta-chip">{{ course.cefrLevel }}</span>
          </div>
          <p class="lesson-desc">{{ lesson.description || '暂无课时描述' }}</p>
        </section>

        <section v-if="mode === 'reader'" class="aside-card">
          <h3>查词记录</h3>
          <p class="lookup-count">{{ readerStats.lookupCount }} 次查词</p>
          <p class="aside-note">悬停单词即可查看音标、释义与例句。</p>
        </section>

        <section v-else-if="mode === 'burn-sentence' || mode === 'burn-word'" class="aside-card">
          <h3>当前阶段</h3>
          <p class="stage-number">{{ burnProgress.stage }}<span>/ {{ burnProgress.maxStage }}</span></p>
          <p class="aside-note">
            {{ mode === 'burn-sentence' ? '数值为被遮蔽的词数' : '数值为提示等级（0-4）' }}
          </p>
        </section>
      </aside>
    </div>

    <!-- 快捷键提示条：首次进入高亮 3 秒，之后弱化常驻 -->
    <div v-if="!loading && lesson" class="shortcut-bar" :class="{ 'is-highlight': shortcutHighlight }">
      <span class="shortcut-title">快捷键</span>
      <span
        v-if="mode === 'reader' || mode === 'burn-sentence' || mode === 'burn-word'"
        class="shortcut-item"
      >
        <kbd>←</kbd><kbd>→</kbd>
        {{ mode === 'reader' ? '切换句子' : '切换题目' }}
      </span>
      <span v-if="mode === 'reader'" class="shortcut-item"><kbd>空格</kbd> 朗读当前句</span>
      <span v-if="mode === 'burn-sentence' || mode === 'burn-word'" class="shortcut-item">
        <kbd>空格</kbd> 听发音
      </span>
      <span v-if="mode === 'burn-sentence' || mode === 'burn-word'" class="shortcut-item">
        <kbd>Enter</kbd> 提交答案
      </span>
      <span class="shortcut-item"><kbd>Esc</kbd> 退出输入</span>
    </div>

    <!-- 老师字幕气泡：固定在课堂底部，语音与文字同步 -->
    <TeacherBubble
      v-if="!loading && lesson"
      :visible="teacherVisible"
      :text="teacherText"
      :speaking="teacherSpeaking"
      :muted="teacherMuted"
      @replay="teacherReplay"
      @update:muted="setTeacherMuted"
    />

    <!-- 昵称引导：首次进入课堂且昵称为空时出现 -->
    <el-dialog
      v-model="showNicknameGuide"
      width="420px"
      align-center
      :close-on-click-modal="false"
      :show-close="false"
      title="先认识一下"
    >
      <div class="nickname-guide">
        <div class="guide-avatar">师</div>
        <p class="guide-text">我是你的学习小老师。之后每次学完，我都会给你点评。我该怎么称呼你？</p>
        <el-input
          v-model="nicknameDraft"
          maxlength="12"
          show-word-limit
          placeholder="例如：小明"
          @keyup.enter="saveNickname"
        />
        <p class="guide-hint">昵称只保存在本机，之后可以在设置 → 通用里修改。</p>
      </div>
      <template #footer>
        <div class="finish-actions">
          <el-button @click="skipNicknameGuide">以后再说</el-button>
          <el-button type="primary" @click="saveNickname">就这么叫</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 学习点评卡 -->
    <LessonFeedbackDialog
      v-model="showFeedback"
      :result="feedbackResult"
      :lesson-title="lesson?.title || '本课'"
      :mode-label="modeLabel"
      :duration-ms="feedbackDurationMs"
      :lesson-id="lesson?.id || ''"
      @retry="retryLesson"
    />
  </div>
</template>

<style scoped>
/* 页面外壳：沉浸式渐变背景 */
.classroom-page {
  min-height: 100vh;
  padding: 18px clamp(14px, 3vw, 34px) 40px;
  background:
    radial-gradient(1200px 520px at 12% -10%, rgba(20, 184, 166, 0.12) 0%, transparent 60%),
    radial-gradient(900px 480px at 88% 0%, rgba(59, 130, 246, 0.1) 0%, transparent 62%),
    #f6f8fb;
  box-sizing: border-box;
}

/* 顶部导航 */
.classroom-topbar {
  position: sticky;
  top: 12px;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 10px 16px;
  margin-bottom: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  box-shadow: 0 20px 40px -34px rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(14px);
}

.topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.back-button {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #475569;
  cursor: pointer;
  transition: background 0.16s ease, color 0.16s ease;
}

.back-button:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.title-block {
  min-width: 0;
}

.course-name {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.title-block h1 {
  margin: 1px 0 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 模式切换 */
.mode-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px;
  margin: 0 auto;
  border-radius: 12px;
  background: #f1f5f9;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 12px;
  border: none;
  border-radius: 9px;
  font-size: 12.5px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.16s ease, color 0.16s ease, box-shadow 0.16s ease;
}

.mode-tab:hover {
  color: #0f172a;
}

.mode-tab.active {
  color: #0f766e;
  background: #ffffff;
  box-shadow: 0 6px 16px -10px rgba(15, 23, 42, 0.35);
}

/* 右侧开关 */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.icon-toggle {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.16s ease;
}

.icon-toggle.text-toggle {
  font-size: 12px;
  font-weight: 700;
}

.icon-toggle.active {
  color: #0f766e;
  border-color: #99f6e4;
  background: #f0fdfa;
}

/* 主体布局 */
.classroom-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 18px;
  align-items: start;
}

.classroom-stage {
  min-width: 0;
}

.classroom-state {
  padding: 40px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

/* 右侧助手 */
.classroom-aside {
  display: flex;
  flex-direction: column;
  gap: 12px;
  position: sticky;
  top: 92px;
}

.aside-card {
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.86);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(10px);
}

.aside-card h3 {
  margin: 0 0 10px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: #94a3b8;
  text-transform: uppercase;
}

/* 进度环 */
.progress-card {
  display: flex;
  align-items: center;
  gap: 14px;
}

.progress-ring {
  --percent: 0%;
  position: relative;
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  flex: none;
  border-radius: 999px;
  background: conic-gradient(#14b8a6 var(--percent), #e2e8f0 var(--percent));
}

.progress-ring::before {
  content: '';
  position: absolute;
  inset: 7px;
  border-radius: 999px;
  background: #ffffff;
}

.progress-ring span {
  position: relative;
  font-size: 12px;
  font-weight: 700;
  color: #0f766e;
}

.progress-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.progress-copy strong {
  font-size: 13px;
  color: #0f172a;
}

.progress-copy span {
  font-size: 11.5px;
  color: #94a3b8;
}

/* 提示 */
.tip-list {
  margin: 0;
  padding: 0 0 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tip-list li {
  font-size: 12px;
  line-height: 1.65;
  color: #64748b;
}

/* 内容概览 */
.lesson-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.meta-chip {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #475569;
  background: #f1f5f9;
}

.lesson-desc {
  margin: 10px 0 0;
  font-size: 12px;
  line-height: 1.65;
  color: #94a3b8;
}

.lookup-count {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.aside-note {
  margin: 6px 0 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: #94a3b8;
}

.stage-number {
  margin: 0;
  font-size: 28px;
  font-weight: 700;
  color: #b45309;
}

.stage-number span {
  font-size: 13px;
  font-weight: 500;
  color: #94a3b8;
}

/* 快捷键提示条 */
.shortcut-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 16px;
  padding: 9px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  color: #64748b;
  font-size: 12px;
  backdrop-filter: blur(10px);
  transition: border-color 0.3s ease, box-shadow 0.3s ease, background 0.3s ease;
}

/* 首次进入高亮 3 秒，引导用户注意快捷键 */
.shortcut-bar.is-highlight {
  border-color: rgba(20, 184, 166, 0.55);
  background: #f0fdfa;
  box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.12);
}

.shortcut-title {
  font-weight: 700;
  color: #0f766e;
}

.shortcut-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.shortcut-bar kbd {
  display: inline-block;
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 5px;
  border: 1px solid #cbd5e1;
  border-bottom-width: 2px;
  background: #ffffff;
  color: #0f172a;
  font-family: inherit;
  font-size: 11px;
  text-align: center;
}

/* 昵称引导 */
.nickname-guide {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.guide-avatar {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 999px;
  font-size: 22px;
  font-weight: 700;
  color: #0f766e;
  background: #ccfbf1;
}

.guide-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: #334155;
}

.guide-hint {
  margin: 0;
  font-size: 11.5px;
  color: #94a3b8;
}

.finish-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

/* 窄屏 */
@media (max-width: 1100px) {
  .classroom-layout {
    grid-template-columns: 1fr;
  }

  .classroom-aside {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
  }

  .aside-card {
    flex: 1 1 240px;
  }
}

@media (max-width: 760px) {
  .classroom-topbar {
    flex-wrap: wrap;
  }

  .mode-tabs {
    order: 3;
    width: 100%;
    margin: 0;
    overflow-x: auto;
  }

  .topbar-right {
    margin-left: auto;
  }
}
</style>
