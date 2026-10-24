<script setup lang="ts">
/**
 * 燃尽练习舞台
 *
 * 两种模式：
 *   - sentence：从句末向前逐词遮蔽，做对两次升级一级，做错回退一级；
 *   - word：五级提示（全显 → 首尾 → 首字母 → 仅中文 → 仅发音）。
 * 持久化：
 *   - 进度缓存在 localStorage（lexitype_burn_*），切换课时或完成后清除；
 *   - 每次提交写入 practice_attempt_events，复用现有事件表，不新增表。
 */

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Back, Headset, RefreshRight, Right, View } from '@element-plus/icons-vue'
import type { Lesson, LessonItem } from '../../../shared/types/course'
import { PracticeMode } from '../../../shared/types/course'
import type { SentenceToken } from '../../../shared/utils/sentenceSplit'
import { splitSentences, tokenizeSentence } from '../../../shared/utils/sentenceSplit'
import { isAnswerCorrect, textSimilarity } from '../../../shared/utils/textCompare'
import { createLogger } from '../../../shared/utils/logger'
import { useSpeechPlayer } from '../../composables/useSpeechPlayer'
import { practiceAttemptEventRepository } from '../../../shared/database/repositories/practiceAttemptEventRepository'

/** 组件属性 */
const props = defineProps<{
  /** 当前课时 */
  lesson: Lesson
  /** 所属课程 ID（事件记录用） */
  courseId: string
  /** 燃尽模式：句子 / 单词 */
  mode: 'sentence' | 'word'
  /** 是否显示中文提示 */
  showChinese: boolean
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 进度更新 */
  (event: 'progress', value: { current: number; total: number; stage: number; maxStage: number }): void
  /** 整课完成（附带点评所需的过程指标） */
  (event: 'complete', value: {
    /** 已完成单元数 */
    units: number
    /** 单元总数 */
    totalUnits: number
    /** 使用提示次数 */
    hintsUsed: number
    /** 跳过单元数 */
    skippedUnits: number
    /** 首次即正确的单元数 */
    firstTryUnits: number
    /** 课堂用时（毫秒） */
    durationMs: number
  }): void
  /** 学员提交答案：供老师引导层即时反馈 */
  (event: 'answer', value: {
    /** 是否正确 */
    correct: boolean
    /** 参考答案（单词为原词，句子为当前阶段期望文本） */
    expected: string
    /** 学员输入 */
    input: string
    /** 当前单元键 */
    unitKey: string
    /** 当前单元下标（从 0 开始） */
    unitIndex: number
    /** 提交时所在燃尽阶段 */
    stage: number
    /** 练习模式 */
    mode: 'sentence' | 'word'
  }): void
  /** 输入区长时间无操作：供老师引导层做超时提示 */
  (event: 'idle', value: {
    /** 第几次超时提醒（从 1 开始） */
    count: number
    /** 当前单元键 */
    unitKey: string
    /** 当前单元下标 */
    unitIndex: number
    /** 当前燃尽阶段 */
    stage: number
  }): void
}>()

/** 日志器 */
const logger = createLogger('burndown')

/** 语音播放器 */
const { playingKey, play, stop } = useSpeechPlayer()

/** 练习单元 */
interface BurnUnit {
  /** 唯一键 */
  key: string
  /** 原始词条 */
  item: LessonItem
  /** 参考文本（句子或单词） */
  text: string
  /** 中文提示 */
  chinese: string
  /** 对话角色 */
  speaker?: string
  /** 句内词元（仅句子模式） */
  tokens: SentenceToken[]
}

/** 当前单元下标 */
const unitIndex = ref(0)
/** 当前阶段：句子模式为遮蔽词数，单词模式为 0-4 */
const stage = ref(0)
/** 连续正确次数（句子模式需要 2 次才升级） */
const streak = ref(0)
/** 用户输入 */
const answer = ref('')
/** 判定状态 */
const status = ref<'idle' | 'correct' | 'wrong' | 'unit-done'>('idle')
/** 提示使用次数 */
const hintsUsed = ref(0)
/** 开始时间 */
const startedAt = ref(Date.now())
/** 提交次数（按单元累计） */
const attemptCount = ref(1)
/** 是否已完成全部单元 */
const allDone = ref(false)
/** 首次即正确的单元数：用于点评首答正确率 */
const firstTryUnits = ref(0)
/** 主动跳过的单元数：跳过不计入完成度 */
const skippedUnits = ref(0)
/** 已完成单元的键集合：避免“下一题”重复计数 */
const completedKeys = ref<Set<string>>(new Set())
/** 已跳过单元的键集合：避免重复跳过重复计数 */
const skippedKeys = ref<Set<string>>(new Set())

/** 首次超时提醒等待时长（毫秒） */
const IDLE_TIMEOUT_MS = 20000
/** 第二次超时提醒等待时长（毫秒） */
const IDLE_RETRY_MS = 25000
/** 超时定时器句柄 */
let idleTimer: ReturnType<typeof setTimeout> | null = null
/** 当前单元内的超时提醒次数（输入变化后归零） */
let idleCount = 0

/** 句子模式最大阶段 = 词元数；单词模式固定 4 */
const maxStage = computed(() => {
  const unit = currentUnit.value
  if (!unit) return 0
  return props.mode === 'sentence' ? unit.tokens.length : 4
})

/** 课堂进度缓存键 */
const storageKey = computed(() => `lexitype_burn_${props.mode}_${props.lesson.id}`)

/**
 * 构建练习单元
 * @returns 单元数组
 */
function buildUnits(): BurnUnit[] {
  if (props.mode === 'word') {
    return props.lesson.items
      .filter(item => {
        // 单词模式只取单词级词条，避免把整句当成拼写题
        const english = (item.english || '').trim()
        return english.length > 0 && !/\s/.test(english)
      })
      .map(item => ({
        key: item.id,
        item,
        text: item.english.trim(),
        chinese: item.chinese,
        tokens: [],
      }))
  }

  // 句子模式：对话逐行，文章按句切分
  return props.lesson.items.flatMap(item => {
    if (props.lesson.contentShape === 'dialog') {
      return [{
        key: item.id,
        item,
        text: item.english,
        chinese: item.chinese,
        speaker: item.speaker,
        tokens: tokenizeSentence(item.english),
      }]
    }

    const parts = splitSentences(item.english)
    const list = parts.length > 0 ? parts : [{ index: 0, text: item.english }]
    return list.map((part, index) => ({
      key: `${item.id}-s${index}`,
      item,
      text: part.text,
      chinese: index === 0 ? item.chinese : '',
      tokens: tokenizeSentence(part.text),
    }))
  })
}

/** 练习单元列表 */
const units = ref<BurnUnit[]>(buildUnits())

/** 当前单元 */
const currentUnit = computed<BurnUnit | undefined>(() => units.value[unitIndex.value])

/** 完成单元数：由已完成键集合推导，避免完成/跳过/回补造成重复计数 */
const completedUnits = computed(() => completedKeys.value.size)

/** 总进度百分比 */
const progressPercent = computed(() => {
  if (units.value.length === 0) return 0
  return Math.round((completedUnits.value / units.value.length) * 100)
})

/**
 * 单词燃尽：根据阶段生成遮蔽文本
 * @param word 单词
 * @param level 阶段
 * @returns 展示文本
 */
function maskWord(word: string, level: number): string {
  const chars = word.split('')
  if (level <= 0) return word
  if (level === 1) {
    if (chars.length <= 2) return `${chars[0]}${'_'.repeat(chars.length - 1)}`
    return `${chars[0]}${'_'.repeat(chars.length - 2)}${chars[chars.length - 1]}`
  }
  if (level === 2) {
    return `${chars[0]}${'_'.repeat(chars.length - 1)}`
  }
  return '_'.repeat(chars.length)
}

/** 当前单词的展示文本 */
const wordDisplay = computed(() => {
  const unit = currentUnit.value
  if (!unit || props.mode !== 'word') return ''
  return maskWord(unit.text, stage.value)
})

/** 句子模式下被遮蔽的词元下标集合（从句末向前） */
const hiddenIndexes = computed(() => {
  const unit = currentUnit.value
  if (!unit || props.mode !== 'sentence') return new Set<number>()
  const total = unit.tokens.length
  const indexes = new Set<number>()
  for (let i = total - stage.value; i < total; i += 1) {
    if (i >= 0) indexes.add(i)
  }
  return indexes
})

/** 句子模式下需要用户补全的答案 */
const expectedAnswer = computed(() => {
  const unit = currentUnit.value
  if (!unit || props.mode !== 'sentence') return ''
  return unit.tokens
    .filter((_, index) => hiddenIndexes.value.has(index))
    .map(token => token.word)
    .join(' ')
})

/** 输入框占位提示 */
const inputPlaceholder = computed(() => {
  if (props.mode === 'word') {
    return stage.value >= 3 ? '听音后输入完整单词' : '补全被遮蔽的字母'
  }
  if (stage.value === 0) return '先通读一遍，再开始燃尽'
  return `按顺序输入被遮蔽的 ${stage.value} 个词（空格分隔）`
})

/**
 * 读取本地进度
 */
function restoreProgress(): void {
  try {
    const raw = localStorage.getItem(storageKey.value)
    if (!raw) return
    const parsed = JSON.parse(raw) as { unitIndex?: number; stage?: number }
    const index = Math.min(Math.max(parsed.unitIndex ?? 0, 0), Math.max(units.value.length - 1, 0))
    unitIndex.value = index
    stage.value = Math.max(0, Math.min(parsed.stage ?? 0, maxStage.value))
    logger.info('恢复燃尽进度', { index: unitIndex.value, stage: stage.value })
  } catch (error) {
    logger.warn('恢复进度失败，已忽略', { error })
  }
}

/**
 * 保存本地进度
 */
function saveProgress(): void {
  try {
    localStorage.setItem(storageKey.value, JSON.stringify({
      unitIndex: unitIndex.value,
      stage: stage.value,
    }))
  } catch (error) {
    logger.warn('保存进度失败', { error })
  }
}

/**
 * 清理本地进度
 */
function clearProgress(): void {
  try {
    localStorage.removeItem(storageKey.value)
  } catch (error) {
    logger.warn('清理进度失败', { error })
  }
}

/**
 * 同步进度到父组件
 */
function emitProgress(): void {
  emit('progress', {
    current: unitIndex.value + 1,
    total: units.value.length,
    stage: stage.value,
    maxStage: maxStage.value,
  })
}

/**
 * 清理超时提醒定时器
 */
function clearIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer)
    idleTimer = null
  }
}

/**
 * 重新安排超时提醒
 * @param resetCount 是否把提醒次数归零（学员有新操作时为 true）
 */
function scheduleIdleTimer(resetCount = true): void {
  clearIdleTimer()
  if (resetCount) {
    idleCount = 0
  }

  const unit = currentUnit.value
  if (!unit || allDone.value) return

  const delay = idleCount === 0 ? IDLE_TIMEOUT_MS : IDLE_RETRY_MS
  idleTimer = setTimeout(() => {
    idleTimer = null
    const activeUnit = currentUnit.value
    if (!activeUnit || allDone.value) return

    idleCount += 1
    emit('idle', {
      count: idleCount,
      unitKey: activeUnit.key,
      unitIndex: unitIndex.value,
      stage: stage.value,
    })
    logger.debug('输入区超时提醒', { count: idleCount, unit: activeUnit.key, stage: stage.value })

    // 最多两次提醒：第一次提示听示范，第二次建议看提示
    if (idleCount < 2) scheduleIdleTimer(false)
  }, delay)
}

/**
 * 播放当前单元示范音
 */
function playReference(): void {
  const unit = currentUnit.value
  if (!unit) return
  void play(unit.text, `burn:${unit.key}`)
}

/**
 * 开始当前单元：k=0 → k=1
 */
function startUnit(): void {
  if (!currentUnit.value) return
  stage.value = Math.max(1, stage.value)
  status.value = 'idle'
  answer.value = ''
  saveProgress()
  emitProgress()
  logger.debug('开始燃尽', { unit: currentUnit.value.key, stage: stage.value })
}

/**
 * 提交答案
 */
async function submitAnswer(): Promise<void> {
  const unit = currentUnit.value
  if (!unit) return

  // 句子模式 stage=0 时先进入燃尽
  if (props.mode === 'sentence' && stage.value === 0) {
    startUnit()
    return
  }

  const correct = props.mode === 'sentence'
    ? isAnswerCorrect(answer.value, expectedAnswer.value)
    : isAnswerCorrect(answer.value, unit.text)

  const similarity = props.mode === 'sentence'
    ? textSimilarity(answer.value, expectedAnswer.value)
    : textSimilarity(answer.value, unit.text)

  // 本次是第几次尝试：提交时同步递增，避免异步写库导致计数滞后
  const attemptNo = attemptCount.value
  attemptCount.value = attemptNo + 1

  // 写入练习事件：复用现有表，hintLevelAtSubmit 即燃尽阶段
  void recordAttempt(unit, correct, similarity, attemptNo)

  // 通知父页面：供老师引导层即时给出鼓励或纠正
  emit('answer', {
    correct,
    expected: props.mode === 'sentence' ? expectedAnswer.value : unit.text,
    input: answer.value,
    unitKey: unit.key,
    unitIndex: unitIndex.value,
    stage: stage.value,
    mode: props.mode,
  })

  if (correct) {
    // 第一次提交就正确且该单元尚未完成：计入首答正确单元
    if (attemptNo === 1 && !completedKeys.value.has(unit.key)) firstTryUnits.value += 1
    status.value = 'correct'
    streak.value += 1

    // 单词模式一次正确即升级；句子模式需连续两次
    const needStreak = props.mode === 'word' ? 1 : 2
    if (streak.value >= needStreak) {
      stage.value += 1
      streak.value = 0
    }

    // 达到最大阶段后完成当前单元
    if (stage.value > maxStage.value) {
      completeUnit()
      return
    }

    answer.value = ''
    saveProgress()
    emitProgress()
    return
  }

  // 错误：回退一级，保留输入便于对照
  status.value = 'wrong'
  streak.value = 0
  stage.value = Math.max(props.mode === 'sentence' ? 1 : 0, stage.value - 1)
  saveProgress()
  emitProgress()
  logger.debug('判定错误', { unit: unit.key, stage: stage.value, similarity })
}

/**
 * 记录一次练习尝试
 * @param unit 当前单元
 * @param correct 是否正确
 * @param similarity 相似度
 * @param attemptNo 本次尝试序号（从 1 开始）
 */
async function recordAttempt(
  unit: BurnUnit,
  correct: boolean,
  similarity: number,
  attemptNo: number,
): Promise<void> {
  try {
    await practiceAttemptEventRepository.add({
      createdAt: Date.now(),
      courseId: props.courseId,
      lessonId: props.lesson.id,
      unitId: unit.item.id,
      mode: PracticeMode.Dictation,
      referenceText: unit.text,
      chineseHint: unit.chinese,
      userText: answer.value,
      correct,
      attemptCount: attemptNo,
      hintLevelAtSubmit: stage.value,
      nextHintLevel: correct ? Math.min(stage.value + 1, maxStage.value) : Math.max(stage.value - 1, 0),
      similarity,
      extra: {
        burnType: props.mode,
        hiddenTokens: props.mode === 'sentence'
          ? unit.tokens.filter((_, index) => hiddenIndexes.value.has(index)).map(token => token.word)
          : [],
        stageTotal: maxStage.value,
      },
    })
  } catch (error) {
    logger.warn('写入练习事件失败', { unit: unit.key, error })
  }
}

/**
 * 完成当前单元并进入下一单元
 */
function completeUnit(): void {
  const unit = currentUnit.value
  if (!unit) return

  completedKeys.value.add(unit.key)
  // 若该单元此前被跳过，完成即撤销跳过计数，保证点评完成度准确
  if (skippedKeys.value.has(unit.key)) {
    skippedKeys.value.delete(unit.key)
    skippedUnits.value = Math.max(0, skippedUnits.value - 1)
  }
  status.value = 'unit-done'
  logger.info('单元完成', { unit: unit.key, completed: completedUnits.value, total: units.value.length })

  // 短暂展示完成态后进入下一单元
  setTimeout(() => {
    if (unitIndex.value >= units.value.length - 1) {
      finishAll()
      return
    }

    unitIndex.value += 1
    // 单词模式无需再次通读，直接进入燃尽阶段，避免每词都要多点一次“开始”
    stage.value = props.mode === 'word' ? 1 : 0
    streak.value = 0
    answer.value = ''
    attemptCount.value = 1
    status.value = 'idle'
    saveProgress()
    emitProgress()
  }, 700)
}

/**
 * 全部单元完成
 */
function finishAll(): void {
  allDone.value = true
  clearProgress()
  stop('complete')

  const durationMs = Date.now() - startedAt.value
  // units 取真实完成数（已排除首次跳过但未回补的单元），供点评计算完成度
  const unitsDone = completedUnits.value
  emit('complete', {
    units: unitsDone,
    totalUnits: units.value.length,
    hintsUsed: hintsUsed.value,
    skippedUnits: skippedUnits.value,
    firstTryUnits: firstTryUnits.value,
    durationMs,
  })
  logger.info('燃尽课堂完成', {
    mode: props.mode,
    units: unitsDone,
    totalUnits: units.value.length,
    hintsUsed: hintsUsed.value,
    skippedUnits: skippedUnits.value,
    firstTryUnits: firstTryUnits.value,
    durationMs,
  })
}

/**
 * 查看提示：回退一级并计次
 */
function showHint(): void {
  if (stage.value <= 1) {
    status.value = 'idle'
    ElMessage.info('已经是最低提示级别，先看一遍内容再试')
    return
  }
  stage.value = Math.max(1, stage.value - 1)
  hintsUsed.value += 1
  status.value = 'idle'
  saveProgress()
  emitProgress()
  logger.debug('使用提示', { unit: currentUnit.value?.key, stage: stage.value })
}

/**
 * 跳过当前单元
 */
function skipUnit(): void {
  const unit = currentUnit.value
  if (!unit) return
  logger.info('跳过单元', { unit: unit.key })
  // 同一单元只计一次跳过，避免重复按键放大跳过数
  if (!skippedKeys.value.has(unit.key)) {
    skippedKeys.value.add(unit.key)
    skippedUnits.value += 1
  }
  completedKeys.value.add(unit.key)
  if (unitIndex.value >= units.value.length - 1) {
    finishAll()
    return
  }
  unitIndex.value += 1
  // 单词模式直接进入燃尽阶段
  stage.value = props.mode === 'word' ? 1 : 0
  streak.value = 0
  answer.value = ''
  attemptCount.value = 1
  status.value = 'idle'
  saveProgress()
  emitProgress()
}

/**
 * 切换到指定单元并重置该单元状态
 * @param index 目标下标
 * @param countSkip 当前单元未完成时是否计为跳过（向后导航为 true）
 */
function goToUnit(index: number, countSkip: boolean): void {
  if (units.value.length === 0 || allDone.value) return
  const current = currentUnit.value
  const next = Math.min(units.value.length - 1, Math.max(0, index))
  if (next === unitIndex.value) return

  // 向后导航且当前单元未完成：按设计记为跳过，保证点评完成度真实
  if (countSkip && current
    && !completedKeys.value.has(current.key)
    && !skippedKeys.value.has(current.key)) {
    skippedKeys.value.add(current.key)
    skippedUnits.value += 1
    ElMessage.info('当前内容还没完成，已记为跳过，稍后可以回来补')
    logger.info('下一题跳过未完成单元', { unit: current.key, skipped: skippedUnits.value })
  }

  unitIndex.value = next
  // 单词模式直接进入燃尽阶段；句子模式保留“先通读再开始”的起点
  stage.value = props.mode === 'word' ? 1 : 0
  streak.value = 0
  answer.value = ''
  attemptCount.value = 1
  status.value = 'idle'
  saveProgress()
  emitProgress()
  logger.debug('切换练习单元', { index: next })
}

/** 下一题（向后导航） */
function nextUnit(): void {
  goToUnit(unitIndex.value + 1, true)
}

/** 上一题（重置该题阶段） */
function prevUnit(): void {
  goToUnit(unitIndex.value - 1, false)
}

/** 暴露给父组件的键盘导航与播放能力 */
defineExpose({
  nextUnit,
  prevUnit,
  playReference,
})

/**
 * 重新开始本课
 */
function restart(): void {
  unitIndex.value = 0
  stage.value = 0
  streak.value = 0
  answer.value = ''
  status.value = 'idle'
  hintsUsed.value = 0
  attemptCount.value = 1
  allDone.value = false
  firstTryUnits.value = 0
  skippedUnits.value = 0
  completedKeys.value = new Set()
  skippedKeys.value = new Set()
  startedAt.value = Date.now()
  clearProgress()
  emitProgress()
}

/** 监听课时与模式变化：重建单元并恢复进度 */
watch(
  () => [props.lesson.id, props.mode],
  () => {
    stop('switch')
    units.value = buildUnits()
    unitIndex.value = 0
    stage.value = 0
    streak.value = 0
    answer.value = ''
    status.value = 'idle'
    hintsUsed.value = 0
    attemptCount.value = 1
    allDone.value = false
    firstTryUnits.value = 0
    skippedUnits.value = 0
    completedKeys.value = new Set()
    skippedKeys.value = new Set()
    startedAt.value = Date.now()
    restoreProgress()
    emitProgress()
  },
  { immediate: true },
)

/** 监听输入/题目/阶段变化：学员仍在操作时重置超时提醒 */
watch(
  () => [unitIndex.value, stage.value, status.value, answer.value, allDone.value, props.lesson.id, props.mode],
  () => scheduleIdleTimer(true),
  { immediate: true },
)

/** 卸载时停止音频 */
onBeforeUnmount(() => {
  clearIdleTimer()
  stop('unmount')
})
</script>

<template>
  <section class="burn-stage">
    <!-- 顶部进度 -->
    <header class="burn-header">
      <div class="burn-progress-info">
        <span class="burn-mode-pill">{{ mode === 'sentence' ? '句子燃尽' : '词燃尽' }}</span>
        <span class="burn-counter">
          第 {{ Math.min(unitIndex + 1, units.length) }} / {{ Math.max(units.length, 1) }} 个
        </span>
      </div>
      <div class="burn-progress-track">
        <div class="burn-progress-fill" :style="{ width: `${progressPercent}%` }" />
      </div>
      <span class="burn-percent">{{ progressPercent }}%</span>
    </header>

    <!-- 全部完成 -->
    <div v-if="allDone" class="burn-finish">
      <div class="finish-medal">✓</div>
      <h2>本课燃尽完成</h2>
      <p>共完成 {{ units.length }} 个{{ mode === 'sentence' ? '句子' : '单词' }}，使用提示 {{ hintsUsed }} 次。</p>
      <el-button type="primary" :icon="RefreshRight" @click="restart">再练一次</el-button>
    </div>

    <!-- 单元为空 -->
    <el-empty v-else-if="units.length === 0" description="当前课时没有适合燃尽练习的内容" />

    <!-- 练习主体 -->
    <div v-else-if="currentUnit" class="burn-body">
      <div class="burn-card" :class="`status-${status}`">
        <div class="stage-row">
          <span class="stage-chip">
            {{ mode === 'sentence' ? `遮蔽 ${stage} / ${maxStage} 词` : `提示 Level ${stage} / 4` }}
          </span>
          <span v-if="streak > 0" class="streak-chip">连续正确 {{ streak }}</span>
        </div>

        <!-- 单词模式：大字遮蔽展示 -->
        <div v-if="mode === 'word'" class="word-burn">
          <button
            class="word-play"
            type="button"
            :class="{ 'is-playing': playingKey === `burn:${currentUnit.key}` }"
            @click="playReference"
          >
            <el-icon><Headset /></el-icon>
          </button>
          <div class="word-display">{{ wordDisplay }}</div>
          <div v-if="currentUnit.item.phonetic" class="word-phonetic">
            {{ stage >= 3 ? currentUnit.item.phonetic : '提示：先听音，再补全字母' }}
          </div>
          <div v-if="showChinese" class="word-chinese">{{ currentUnit.chinese }}</div>
        </div>

        <!-- 句子模式：逐词遮蔽展示 -->
        <div v-else class="sentence-burn">
          <span v-if="currentUnit.speaker" class="speaker-tag">{{ currentUnit.speaker }}</span>
          <p class="sentence-line">
            <template v-for="(token, index) in currentUnit.tokens" :key="`${currentUnit.key}-${index}`">
              <span
                v-if="hiddenIndexes.has(index)"
                class="hidden-token"
                :title="`共 ${token.word.length} 个字母`"
              >{{ '_'.repeat(Math.min(token.word.length, 12)) }}</span>
              <span v-else class="visible-token">{{ token.word }}</span>{{ token.trailing }}{{ ' ' }}
            </template>
          </p>
          <p v-if="showChinese && currentUnit.chinese" class="sentence-chinese">
            {{ currentUnit.chinese }}
          </p>
        </div>

        <!-- 反馈 -->
        <transition name="fade">
          <div
            v-if="status === 'correct' || status === 'wrong' || status === 'unit-done'"
            class="feedback-row"
            :class="status"
          >
            <template v-if="status === 'correct'">正确，提示已升级</template>
            <template v-else-if="status === 'wrong'">差一点，提示已回退一级，再试一次</template>
            <template v-else>本{{ mode === 'sentence' ? '句' : '词' }}完成，进入下一个</template>
          </div>
        </transition>

        <!-- 输入区 -->
        <div class="answer-row">
          <el-input
            v-model="answer"
            :placeholder="inputPlaceholder"
            :disabled="stage === 0 || status === 'unit-done'"
            size="large"
            clearable
            @keyup.enter="submitAnswer"
          />
          <el-button
            type="primary"
            size="large"
            :icon="Right"
            :disabled="!answer.trim() || status === 'unit-done'"
            @click="submitAnswer"
          >
            提交
          </el-button>
        </div>

        <!-- 底部操作 -->
        <div class="burn-actions">
          <el-button text :icon="Headset" @click="playReference">播放示范</el-button>
          <el-button text :icon="View" @click="showHint">查看提示</el-button>
          <el-button text :icon="Back" @click="skipUnit">跳过</el-button>
          <span class="burn-tip">做对升级，做错回退；句子模式需连续两次正确才升级</span>
        </div>
      </div>

      <!-- 燃尽起点提示：句子模式与单词模式都需要先显式开始，否则输入框处于禁用状态 -->
      <div v-if="stage === 0" class="start-hint">
        <el-button type="primary" plain size="large" @click="startUnit">
          {{ mode === 'word' ? '开始词燃尽' : '开始燃尽这一句' }}
        </el-button>
        <span>
          {{ mode === 'word'
            ? '先听一遍、读一遍，再让字母逐个“烧掉”'
            : '先听一遍、读一遍，再让文字逐词“烧掉”' }}
        </span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 舞台 */
.burn-stage {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
}

/* 顶部进度 */
.burn-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(10px);
}

.burn-progress-info {
  display: flex;
  align-items: center;
  gap: 10px;
  white-space: nowrap;
}

.burn-mode-pill {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #b45309;
  background: #fef3c7;
}

.burn-counter {
  font-size: 12px;
  color: #64748b;
}

.burn-progress-track {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}

.burn-progress-fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #f59e0b 0%, #14b8a6 100%);
  transition: width 0.35s ease;
}

.burn-percent {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

/* 练习卡片 */
.burn-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.burn-card {
  padding: clamp(22px, 3vw, 40px);
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow: 0 30px 60px -46px rgba(15, 23, 42, 0.4);
  transition: border-color 0.2s ease, box-shadow 0.2s ease;
}

.burn-card.status-correct {
  border-color: #5eead4;
  box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.14), 0 30px 60px -46px rgba(15, 23, 42, 0.4);
}

.burn-card.status-wrong {
  border-color: #fca5a5;
  box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.1), 0 30px 60px -46px rgba(15, 23, 42, 0.4);
}

.stage-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stage-chip,
.streak-chip {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 600;
}

.stage-chip {
  color: #92400e;
  background: #fef3c7;
}

.streak-chip {
  color: #0f766e;
  background: #ccfbf1;
}

/* 单词展示 */
.word-burn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 28px 0 18px;
}

.word-play {
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: none;
  color: #0f766e;
  background: #ccfbf1;
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease;
}

.word-play:hover {
  transform: scale(1.05);
}

.word-play.is-playing {
  box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.2);
}

.word-display {
  font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif;
  font-size: clamp(34px, 5vw, 52px);
  letter-spacing: 0.12em;
  font-weight: 600;
  color: #0f172a;
}

.word-phonetic {
  font-size: 13px;
  color: #94a3b8;
}

.word-chinese {
  font-size: 15px;
  color: #334155;
}

/* 句子展示 */
.sentence-burn {
  padding: 26px 0 10px;
}

.speaker-tag {
  display: inline-block;
  margin-bottom: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
}

.sentence-line {
  margin: 0;
  font-family: 'Iowan Old Style', Georgia, 'Times New Roman', serif;
  font-size: clamp(20px, 2.2vw, 28px);
  line-height: 2;
  color: #1e293b;
  word-break: break-word;
}

.visible-token {
  color: #1e293b;
}

.hidden-token {
  display: inline-block;
  padding: 0 6px;
  border-radius: 6px;
  color: #f59e0b;
  letter-spacing: 0.12em;
  background: #fffbeb;
  border-bottom: 2px dashed #fbbf24;
}

.sentence-chinese {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #94a3b8;
}

/* 反馈 */
.feedback-row {
  margin: 12px 0 0;
  padding: 9px 14px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
}

.feedback-row.correct {
  color: #0f766e;
  background: #f0fdfa;
}

.feedback-row.wrong {
  color: #b91c1c;
  background: #fef2f2;
}

.feedback-row.unit-done {
  color: #1d4ed8;
  background: #eff6ff;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 输入区 */
.answer-row {
  display: flex;
  gap: 10px;
  margin-top: 18px;
}

.answer-row :deep(.el-input__inner) {
  font-size: 16px;
}

.burn-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed #e2e8f0;
}

.burn-tip {
  margin-left: auto;
  font-size: 11.5px;
  color: #94a3b8;
}

/* 起点提示 */
.start-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 16px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px dashed #cbd5e1;
}

.start-hint span {
  font-size: 12px;
  color: #94a3b8;
}

/* 完成态 */
.burn-finish {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 60px 20px;
  border-radius: 20px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.finish-medal {
  display: grid;
  place-items: center;
  width: 64px;
  height: 64px;
  border-radius: 999px;
  font-size: 28px;
  color: #0f766e;
  background: #ccfbf1;
}

.burn-finish h2 {
  margin: 6px 0 0;
  font-size: 22px;
  color: #0f172a;
}

.burn-finish p {
  margin: 0 0 8px;
  font-size: 13px;
  color: #64748b;
}

@media (max-width: 640px) {
  .answer-row {
    flex-direction: column;
  }

  .burn-actions {
    flex-wrap: wrap;
  }

  .burn-tip {
    margin-left: 0;
    width: 100%;
  }
}
</style>
