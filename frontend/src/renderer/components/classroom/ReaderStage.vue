<script setup lang="ts">
/**
 * 精读课堂舞台
 *
 * 交互定义（与设计文档 5.4 一致）：
 *   1. 鼠标进入句子停留 120ms → 停止上一段音频并朗读该句；
 *   2. 鼠标停在单词上 180ms → 弹出词卡，不打断句子朗读；
 *   3. 离开正文 250ms → 停止朗读，词卡 300ms 后关闭；
 *   4. 支持键盘聚焦与点击朗读；悬停朗读可整体关闭。
 */

import { computed, onBeforeUnmount, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Headset, Loading, Plus, VideoPlay } from '@element-plus/icons-vue'
import type { Course, Lesson, LessonItem } from '../../../shared/types/course'
import { splitSentences, tokenizeSentence, normalizeWord } from '../../../shared/utils/sentenceSplit'
import { createLogger } from '../../../shared/utils/logger'
import { useSpeechPlayer } from '../../composables/useSpeechPlayer'
import { reviewRepository } from '../../../shared/database/repositories/reviewRepository'
import { MasteryLevel } from '../../../shared/types/review'

/** 组件属性 */
const props = defineProps<{
  /** 当前课时 */
  lesson: Lesson
  /** 所属课程（用于构建词卡索引） */
  course: Course | null
  /** 是否启用悬停朗读 */
  hoverEnabled: boolean
  /** 是否显示中文 */
  showChinese: boolean
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 阅读统计更新 */
  (event: 'stats', value: { sentencesRead: number; lookupCount: number }): void
  /** 阅读活动：供老师引导层挑选时机给方法提示 */
  (event: 'activity', value: {
    /** 活动类型：查词 / 加入生词本 */
    type: 'lookup' | 'add-word'
    /** 涉及的单词 */
    word: string
    /** 查词时是否命中课程词库 */
    matched?: boolean
  }): void
}>()

/** 日志器 */
const logger = createLogger('reader')

/** 语音播放器 */
const { playingKey, loadingKey, play, playSequence, stop } = useSpeechPlayer()

/** 阅读句子结构 */
interface ReaderSentence {
  /** 唯一键 */
  key: string
  /** 英文句子 */
  text: string
  /** 中文翻译 */
  chinese: string
  /** 对话角色 */
  speaker?: string
  /** 所属词条 */
  item: LessonItem
}

/** 词卡数据 */
interface WordCardData {
  /** 查询词 */
  word: string
  /** 音标 */
  phonetic?: string
  /** 词性 */
  partOfSpeech?: string
  /** 中文释义 */
  chinese: string
  /** 例句 */
  examples: string[]
  /** 例句翻译 */
  exampleTranslations: string[]
  /** 是否命中词条 */
  matched: boolean
}

/** 当前高亮句子 key */
const activeSentenceKey = ref<string | null>(null)
/** 当前词卡 */
const wordCard = ref<WordCardData | null>(null)
/** 词卡屏幕坐标 */
const cardPosition = reactive({ x: 0, y: 0 })
/** 已阅读句子集合 */
const readSentenceKeys = ref<Set<string>>(new Set())
/** 查词次数 */
const lookupCount = ref(0)
/** 正文容器引用 */
const articleRef = ref<HTMLElement | null>(null)
/** 舞台根元素引用：词课与文章课共用，同一时刻只挂载其一 */
const stageRef = ref<HTMLElement | null>(null)
/** 键盘导航的当前单元下标：-1 表示尚未定位 */
const focusIndex = ref(-1)

/** 悬停定时器：句子朗读 */
let sentenceTimer: ReturnType<typeof setTimeout> | null = null
/** 悬停定时器：词卡弹出 */
let wordTimer: ReturnType<typeof setTimeout> | null = null
/** 离开定时器：停止朗读 */
let stopTimer: ReturnType<typeof setTimeout> | null = null
/** 离开定时器：关闭词卡 */
let cardTimer: ReturnType<typeof setTimeout> | null = null

/** 是否为单词/短语类课时 */
const isWordLesson = computed(() => props.lesson.contentShape === 'word' || props.lesson.contentShape === 'phrase')

/** 是否为对话课时 */
const isDialog = computed(() => props.lesson.contentShape === 'dialog')

/** 句子列表：对话逐行、文章按句切分 */
const sentences = computed<ReaderSentence[]>(() => {
  return props.lesson.items.flatMap(item => {
    if (isDialog.value || isWordLesson.value) {
      return [{
        key: item.id,
        text: item.english,
        chinese: item.chinese,
        speaker: item.speaker,
        item,
      }]
    }

    // 文章：先按段落切句，首句沿用词条中文，其余留空
    const parts = splitSentences(item.english)
    if (parts.length === 0) {
      return [{
        key: item.id,
        text: item.english,
        chinese: item.chinese,
        item,
      }]
    }

    return parts.map((part, index) => ({
      key: `${item.id}-s${index}`,
      text: part.text,
      chinese: index === 0 ? item.chinese : '',
      item,
    }))
  })
})

/** 词条索引：仅收录单词级词条，键为归一化英文 */
const wordIndex = computed(() => {
  const index = new Map<string, LessonItem>()

  // 先放课程内其它课时，再用当前课时覆盖，保证当前课时优先
  const lessons = props.course?.lessons ?? []
  lessons.forEach(lesson => {
    lesson.items.forEach(item => {
      const english = (item.english || '').trim()
      if (!english || /\s/.test(english)) return
      index.set(normalizeWord(english), item)
    })
  })

  props.lesson.items.forEach(item => {
    const english = (item.english || '').trim()
    if (!english || /\s/.test(english)) return
    index.set(normalizeWord(english), item)
  })

  return index
})

/** 句子渲染数据：词元 + 标点 */
const renderedSentences = computed(() =>
  sentences.value.map(sentence => ({
    ...sentence,
    tokens: tokenizeSentence(sentence.text),
  })),
)

/** 当前是否有音频在播放 */
const isPlaying = computed(() => playingKey.value !== null)

/** 可键盘导航的单元总数：词课为词条数，文章课为句子数 */
const navigableCount = computed(() => (
  isWordLesson.value ? props.lesson.items.length : sentences.value.length
))

/**
 * 清理所有定时器
 */
function clearTimers(): void {
  if (sentenceTimer) clearTimeout(sentenceTimer)
  if (wordTimer) clearTimeout(wordTimer)
  if (stopTimer) clearTimeout(stopTimer)
  if (cardTimer) clearTimeout(cardTimer)
  sentenceTimer = null
  wordTimer = null
  stopTimer = null
  cardTimer = null
}

/**
 * 播放指定句子
 * @param sentence 句子数据
 */
async function playSentence(sentence: ReaderSentence): Promise<void> {
  if (!sentence.text.trim()) return
  activeSentenceKey.value = sentence.key
  readSentenceKeys.value.add(sentence.key)
  emitStats()
  logger.debug('朗读句子', { key: sentence.key, chars: sentence.text.length })
  await play(sentence.text, sentence.key)
}

/**
 * 句子悬停进入
 * @param sentence 句子
 */
function onSentenceEnter(sentence: ReaderSentence): void {
  if (!props.hoverEnabled) return
  if (sentenceTimer) clearTimeout(sentenceTimer)
  if (stopTimer) {
    clearTimeout(stopTimer)
    stopTimer = null
  }

  sentenceTimer = setTimeout(() => {
    // 同一句正在播放时不重复触发
    if (playingKey.value === sentence.key) return
    void playSentence(sentence)
  }, 120)
}

/**
 * 句子悬停离开
 */
function onSentenceLeave(): void {
  if (sentenceTimer) {
    clearTimeout(sentenceTimer)
    sentenceTimer = null
  }
  if (!props.hoverEnabled) return
  if (stopTimer) clearTimeout(stopTimer)
  // 留出移动到下一句的时间，避免频繁中断
  stopTimer = setTimeout(() => {
    stop('sentence-leave')
    activeSentenceKey.value = null
  }, 250)
}

/**
 * 点击句子：无视悬停开关，直接朗读
 * @param sentence 句子
 */
function onSentenceClick(sentence: ReaderSentence): void {
  clearTimers()
  // 点击后同步键盘导航位置，保证按左右键从当前句继续
  focusIndex.value = sentences.value.findIndex(item => item.key === sentence.key)
  void playSentence(sentence)
}

/**
 * 单词悬停进入
 * @param event 鼠标事件
 * @param token 词元
 */
function onWordEnter(event: MouseEvent, token: { word: string }): void {
  if (!props.hoverEnabled) return
  if (wordTimer) clearTimeout(wordTimer)
  if (cardTimer) {
    clearTimeout(cardTimer)
    cardTimer = null
  }

  wordTimer = setTimeout(() => {
    openWordCard(event, token.word)
  }, 180)
}

/**
 * 单词悬停离开：延迟关闭，便于鼠标移入词卡
 */
function onWordLeave(): void {
  if (wordTimer) {
    clearTimeout(wordTimer)
    wordTimer = null
  }
  if (cardTimer) clearTimeout(cardTimer)
  cardTimer = setTimeout(() => {
    wordCard.value = null
  }, 300)
}

/**
 * 打开词卡
 * @param event 鼠标事件
 * @param word 单词
 */
function openWordCard(event: MouseEvent, word: string): void {
  const normalized = normalizeWord(word)
  if (!normalized) return

  const item = wordIndex.value.get(normalized)
  wordCard.value = item
    ? {
        word: item.english,
        phonetic: item.phonetic,
        partOfSpeech: item.partOfSpeech,
        chinese: item.chinese || '暂无释义',
        examples: item.examples ?? [],
        exampleTranslations: item.exampleTranslations ?? [],
        matched: true,
      }
    : {
        word,
        chinese: '暂无释义，可加入生词本后续补充',
        examples: [],
        exampleTranslations: [],
        matched: false,
      }

  // 词卡定位：默认在鼠标右下方，并做视口边界收敛
  const cardWidth = 320
  const cardHeight = 260
  const x = Math.min(event.clientX + 16, window.innerWidth - cardWidth - 16)
  const y = Math.min(event.clientY + 18, window.innerHeight - cardHeight - 16)
  cardPosition.x = Math.max(16, x)
  cardPosition.y = Math.max(16, y)

  lookupCount.value += 1
  emitStats()
  // 通知老师引导层：学员正在查词，可择机给“不要停下来”的方法提示
  emit('activity', {
    type: 'lookup',
    word: item?.english || word,
    matched: Boolean(item),
  })
  logger.debug('打开词卡', { word: normalized, matched: Boolean(item) })
}

/**
 * 词卡悬停进入：取消关闭
 */
function onCardEnter(): void {
  if (cardTimer) {
    clearTimeout(cardTimer)
    cardTimer = null
  }
}

/**
 * 词卡悬停离开：关闭
 */
function onCardLeave(): void {
  cardTimer = setTimeout(() => {
    wordCard.value = null
  }, 200)
}

/**
 * 播放词卡单词发音
 */
function playCardWord(): void {
  if (!wordCard.value) return
  void play(wordCard.value.word, `word:${wordCard.value.word}`)
}

/**
 * 加入生词本
 */
async function addToVocabulary(): Promise<void> {
  if (!wordCard.value) return
  const word = wordCard.value.word
  const source = props.course?.id || 'classroom'

  try {
    const existing = await reviewRepository.getWordMastery(word, source)
    if (existing) {
      ElMessage.info(`“${word}”已在生词本中`)
      return
    }

    const now = Date.now()
    await reviewRepository.saveWordMastery({
      word,
      source,
      level: MasteryLevel.New,
      nextReview: now,
      interval: 0,
      reviewCount: 0,
      consecutiveCorrect: 0,
      lastReview: now,
      createdAt: now,
      easeFactor: 2.5,
    })
    ElMessage.success(`已加入生词本：${word}`)
    // 通知老师引导层：生词已收录，可提醒后续复习
    emit('activity', { type: 'add-word', word })
    logger.info('加入生词本', { word, source })
  } catch (error) {
    logger.error('加入生词本失败', { word, error })
    ElMessage.error('加入生词本失败，请稍后重试')
  }
}

/**
 * 正文区域离开：停止朗读并关闭词卡
 */
function onArticleLeave(): void {
  onSentenceLeave()
  if (cardTimer) clearTimeout(cardTimer)
  cardTimer = setTimeout(() => {
    wordCard.value = null
  }, 300)
}

/**
 * 播放全文：按顺序朗读所有句子
 */
async function playAll(): Promise<void> {
  clearTimers()
  const entries = sentences.value
    .filter(sentence => sentence.text.trim())
    .map(sentence => ({ text: sentence.text, key: sentence.key }))

  if (entries.length === 0) return
  activeSentenceKey.value = entries[0].key
  logger.info('播放全文', { count: entries.length })
  await playSequence(entries)

  // 连播结束后同步已读统计
  entries.forEach(entry => readSentenceKeys.value.add(entry.key))
  activeSentenceKey.value = null
  emitStats()
}

/**
 * 播放词条（单词/短语课时使用）
 * @param item 词条
 */
function playItem(item: LessonItem): void {
  void play(item.english, item.id)
}

/**
 * 点击词卡：朗读并同步键盘导航位置
 * @param item 词条
 * @param index 词条下标
 */
function onItemClick(item: LessonItem, index: number): void {
  clearTimers()
  focusIndex.value = index
  playItem(item)
}

/**
 * 滚动到指定单元，保证键盘导航时内容始终可见
 * @param index 单元下标
 */
function scrollToIndex(index: number): void {
  const container = stageRef.value
  if (!container) return
  // 词课与文章课共用同一套单元选择器，同一时刻只有一类节点存在
  const nodes = container.querySelectorAll<HTMLElement>('.word-tile, .reader-sentence')
  const node = nodes[index]
  if (!node) return
  node.scrollIntoView({ block: 'center', behavior: 'smooth' })
}

/**
 * 键盘导航：按偏移量移动单元并朗读
 * @param delta -1 表示上一句/上一词，1 表示下一句/下一词
 */
async function navigate(delta: -1 | 1): Promise<void> {
  if (navigableCount.value === 0) return
  // 尚未定位时：向右从第一句开始，向左从最后一句开始
  const base = focusIndex.value < 0
    ? (delta > 0 ? -1 : navigableCount.value)
    : focusIndex.value
  const next = Math.min(navigableCount.value - 1, Math.max(0, base + delta))
  if (next === focusIndex.value) return

  focusIndex.value = next
  clearTimers()

  if (isWordLesson.value) {
    const item = props.lesson.items[next]
    if (item) playItem(item)
  } else {
    const sentence = sentences.value[next]
    if (sentence) await playSentence(sentence)
  }

  scrollToIndex(next)
  logger.debug('键盘导航', { index: next, delta })
}

/**
 * 下一句 / 下一词
 */
async function nextSentence(): Promise<void> {
  await navigate(1)
}

/**
 * 上一句 / 上一词
 */
async function prevSentence(): Promise<void> {
  await navigate(-1)
}

/**
 * 播放当前聚焦的单元（Space 快捷键）
 * 尚未定位时播放第一句，保证空格始终有反馈。
 */
async function playCurrent(): Promise<void> {
  if (navigableCount.value === 0) return
  const index = focusIndex.value >= 0 ? focusIndex.value : 0
  focusIndex.value = index
  clearTimers()

  if (isWordLesson.value) {
    const item = props.lesson.items[index]
    if (item) playItem(item)
    return
  }

  const sentence = sentences.value[index]
  if (sentence) await playSentence(sentence)
}

/** 暴露给父组件的键盘导航能力 */
defineExpose({
  nextSentence,
  prevSentence,
  playCurrent,
})

/**
 * 触发统计更新
 */
function emitStats(): void {
  emit('stats', {
    sentencesRead: readSentenceKeys.value.size,
    lookupCount: lookupCount.value,
  })
}

/** 课时切换时重置阅读进度 */
watch(
  () => props.lesson.id,
  () => {
    stop('lesson-switch')
    readSentenceKeys.value = new Set()
    lookupCount.value = 0
    focusIndex.value = -1
    activeSentenceKey.value = null
    wordCard.value = null
    emitStats()
  },
)

/** 组件卸载时停止音频与定时器 */
onBeforeUnmount(() => {
  clearTimers()
  stop('unmount')
})
</script>

<template>
  <section ref="stageRef" class="reader-stage">
    <!-- 舞台工具条 -->
    <header class="stage-toolbar">
      <div class="toolbar-left">
        <span class="stage-label">精读</span>
        <span class="stage-meta">{{ sentences.length }} 句 · 悬停即读</span>
      </div>
      <div class="toolbar-right">
        <el-button
          size="small"
          :icon="VideoPlay"
          @click="playAll"
        >
          播放全文
        </el-button>
        <el-button size="small" :icon="Headset" :disabled="!isPlaying" @click="stop('toolbar')">
          停止
        </el-button>
      </div>
    </header>

    <!-- 单词 / 短语课时：卡片式点读 -->
    <div v-if="isWordLesson" class="word-grid">
      <article
        v-for="(item, index) in lesson.items"
        :key="item.id"
        class="word-tile"
        :class="{ 'is-playing': playingKey === item.id }"
        @mouseenter="onSentenceEnter({
          key: item.id,
          text: item.english,
          chinese: item.chinese,
          item,
        })"
        @mouseleave="onSentenceLeave"
        @click="onItemClick(item, index)"
      >
        <div class="word-tile-head">
          <h3>{{ item.english }}</h3>
          <el-icon v-if="loadingKey === item.id" class="is-loading"><Loading /></el-icon>
          <el-icon v-else class="tile-speaker"><Headset /></el-icon>
        </div>
        <p v-if="item.phonetic" class="word-phonetic">{{ item.phonetic }}</p>
        <p class="word-meaning">{{ item.chinese }}</p>
        <p v-if="item.examples?.length" class="word-example">{{ item.examples[0] }}</p>
      </article>
    </div>

    <!-- 文章 / 对话：句级悬停朗读 -->
    <div v-else ref="articleRef" class="reader-paper" @mouseleave="onArticleLeave">
      <article
        v-for="sentence in renderedSentences"
        :key="sentence.key"
        class="reader-sentence"
        :class="{ 'is-active': activeSentenceKey === sentence.key }"
        tabindex="0"
        @mouseenter="onSentenceEnter(sentence)"
        @mouseleave="onSentenceLeave"
        @click="onSentenceClick(sentence)"
        @keydown.enter.prevent="onSentenceClick(sentence)"
        @keydown.space.prevent="onSentenceClick(sentence)"
      >
        <span v-if="sentence.speaker" class="speaker-tag">{{ sentence.speaker }}</span>

        <p class="sentence-text">
          <template v-for="(token, tokenIndex) in sentence.tokens" :key="`${sentence.key}-${tokenIndex}`">
            <span class="word-token" @mouseenter.stop="onWordEnter($event, token)" @mouseleave.stop="onWordLeave">{{ token.word }}</span>{{ token.trailing }}{{ ' ' }}
          </template>
          <span v-if="loadingKey === sentence.key" class="sentence-loading" aria-label="合成中">
            <span /><span /><span />
          </span>
        </p>

        <p v-if="showChinese && sentence.chinese" class="sentence-translation">
          {{ sentence.chinese }}
        </p>
      </article>
    </div>

    <!-- 词卡：Teleport 到 body，避免被文章容器裁切 -->
    <Teleport to="body">
      <div
        v-if="wordCard"
        class="word-card"
        :style="{ left: `${cardPosition.x}px`, top: `${cardPosition.y}px` }"
        @mouseenter="onCardEnter"
        @mouseleave="onCardLeave"
      >
        <div class="word-card-head">
          <div>
            <h4>{{ wordCard.word }}</h4>
            <p v-if="wordCard.phonetic" class="card-phonetic">{{ wordCard.phonetic }}</p>
          </div>
          <button class="card-audio" type="button" aria-label="播放发音" @click="playCardWord">
            <el-icon><Headset /></el-icon>
          </button>
        </div>

        <div class="word-card-body">
          <span v-if="wordCard.partOfSpeech" class="card-pos">{{ wordCard.partOfSpeech }}</span>
          <p class="card-meaning">{{ wordCard.chinese }}</p>

          <template v-if="wordCard.examples.length">
            <p class="card-section-title">例句</p>
            <p v-for="(example, index) in wordCard.examples.slice(0, 2)" :key="index" class="card-example">
              {{ example }}
              <span v-if="wordCard.exampleTranslations[index]" class="card-example-zh">
                {{ wordCard.exampleTranslations[index] }}
              </span>
            </p>
          </template>
        </div>

        <div class="word-card-footer">
          <el-button v-if="!wordCard.matched" size="small" text :icon="Plus" @click="addToVocabulary">
            加入生词本
          </el-button>
          <span v-else class="card-source">已匹配课时词条</span>
        </div>
      </div>
    </Teleport>
  </section>
</template>

<style scoped>
/* 舞台外框 */
.reader-stage {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

/* 工具条 */
.stage-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(10px);
}

.toolbar-left {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.stage-label {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #0f766e;
  background: #ccfbf1;
}

.stage-meta {
  font-size: 12px;
  color: #94a3b8;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 文章纸面 */
.reader-paper {
  position: relative;
  padding: 34px clamp(18px, 4vw, 52px);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.96) 0%, rgba(252, 253, 255, 0.99) 100%);
  border: 1px solid rgba(148, 163, 184, 0.16);
  box-shadow:
    0 30px 60px -46px rgba(15, 23, 42, 0.45),
    inset 0 1px 0 rgba(255, 255, 255, 0.9);
}

/* 句子 */
.reader-sentence {
  position: relative;
  padding: 10px 14px 10px 16px;
  margin: 0 0 6px -16px;
  border-radius: 12px;
  border-left: 3px solid transparent;
  cursor: text;
  transition: background 0.18s ease, border-color 0.18s ease;
}

.reader-sentence:hover,
.reader-sentence.is-active {
  background: linear-gradient(90deg, rgba(13, 148, 136, 0.08) 0%, rgba(13, 148, 136, 0) 70%);
  border-left-color: #14b8a6;
}

.reader-sentence:focus-visible {
  outline: 2px solid #14b8a6;
  outline-offset: 2px;
}

.sentence-text {
  margin: 0;
  font-family: 'Iowan Old Style', 'Palatino Linotype', Georgia, 'Times New Roman', serif;
  font-size: clamp(17px, 1.35vw, 21px);
  line-height: 1.95;
  color: #1e293b;
  letter-spacing: 0.006em;
}

.word-token {
  border-radius: 4px;
  transition: background 0.14s ease, color 0.14s ease;
}

.word-token:hover {
  background: #ccfbf1;
  color: #0f766e;
  box-shadow: 0 0 0 2px #ccfbf1;
}

.sentence-translation {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: #94a3b8;
}

.speaker-tag {
  display: inline-block;
  margin-bottom: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #1d4ed8;
  background: #dbeafe;
}

/* 合成中动画 */
.sentence-loading {
  display: inline-flex;
  gap: 3px;
  margin-left: 6px;
  vertical-align: middle;
}

.sentence-loading span {
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: #14b8a6;
  animation: pulse 1s infinite ease-in-out;
}

.sentence-loading span:nth-child(2) {
  animation-delay: 0.15s;
}

.sentence-loading span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

/* 单词卡片网格 */
.word-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 14px;
}

.word-tile {
  padding: 18px;
  border-radius: 16px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: #ffffff;
  cursor: pointer;
  transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
}

.word-tile:hover {
  transform: translateY(-2px);
  border-color: #99f6e4;
  box-shadow: 0 18px 36px -28px rgba(13, 148, 136, 0.55);
}

.word-tile.is-playing {
  border-color: #14b8a6;
  box-shadow: 0 0 0 2px rgba(20, 184, 166, 0.2);
}

.word-tile-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.word-tile-head h3 {
  margin: 0;
  font-size: 19px;
  font-weight: 700;
  color: #0f172a;
}

.tile-speaker {
  color: #14b8a6;
}

.word-phonetic {
  margin: 4px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.word-meaning {
  margin: 10px 0 0;
  font-size: 14px;
  color: #334155;
}

.word-example {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.6;
  color: #94a3b8;
}

/* 词卡 */
.word-card {
  position: fixed;
  z-index: 3000;
  width: 320px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.98);
  border: 1px solid rgba(148, 163, 184, 0.2);
  box-shadow:
    0 24px 60px -24px rgba(15, 23, 42, 0.45),
    0 2px 6px rgba(15, 23, 42, 0.06);
  backdrop-filter: blur(8px);
}

.word-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.word-card-head h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.card-phonetic {
  margin: 3px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.card-audio {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 999px;
  border: none;
  color: #0f766e;
  background: #ccfbf1;
  cursor: pointer;
  transition: transform 0.15s ease;
}

.card-audio:hover {
  transform: scale(1.06);
}

.word-card-body {
  margin-top: 10px;
}

.card-pos {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #7c3aed;
  background: #ede9fe;
}

.card-meaning {
  margin: 8px 0 0;
  font-size: 14px;
  color: #1e293b;
}

.card-section-title {
  margin: 12px 0 6px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #94a3b8;
}

.card-example {
  margin: 0 0 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: #334155;
}

.card-example-zh {
  display: block;
  font-size: 11.5px;
  color: #94a3b8;
}

.word-card-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
}

.card-source {
  font-size: 11px;
  color: #94a3b8;
}

/* 窄屏 */
@media (max-width: 640px) {
  .reader-paper {
    padding: 22px 16px;
  }

  .word-card {
    width: calc(100vw - 32px);
  }
}
</style>
