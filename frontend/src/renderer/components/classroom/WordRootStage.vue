<script setup lang="ts">
/**
 * 词根课堂舞台
 *
 * 设计：
 *   - 左栏为词根组（无词根数据时按词性降级分组）；
 *   - 右栏为该组派生词，支持整组听读、遮中文回忆、逐词点读；
 *   - 不新增数据表，全部由 LessonItem 的可选字段实时聚合。
 */

import { computed, ref, watch } from 'vue'
import { Collection, Headset, Loading, View } from '@element-plus/icons-vue'
import type { Lesson, LessonItem } from '../../../shared/types/course'
import { groupItemsByRoot } from '../../../shared/utils/wordRoot'
import { createLogger } from '../../../shared/utils/logger'
import { useSpeechPlayer } from '../../composables/useSpeechPlayer'

/** 组件属性 */
const props = defineProps<{
  /** 当前课时 */
  lesson: Lesson
}>()

/** 日志器 */
const logger = createLogger('wordroot')

/** 语音播放器 */
const { playingKey, loadingKey, play, playSequence } = useSpeechPlayer()

/** 词根组列表 */
const groups = computed(() => groupItemsByRoot(props.lesson.items ?? []))

/** 当前选中的组键 */
const selectedKey = ref('')

/** 是否开启“遮中文”回忆模式 */
const hideChinese = ref(false)

/** 已揭示的单词集合（遮中文模式下点击揭示） */
const revealedWords = ref<Set<string>>(new Set())

/** 当前选中的组 */
const currentGroup = computed(() => {
  return groups.value.find(group => group.key === selectedKey.value) ?? groups.value[0]
})

/** 是否存在未标注词根的降级分组 */
const hasInferredGroup = computed(() => groups.value.some(group => group.inferred))

/** 当前组中的单词总数 */
const currentWordCount = computed(() => currentGroup.value?.items.length ?? 0)

/**
 * 选择词根组
 * @param key 组键
 */
function selectGroup(key: string): void {
  selectedKey.value = key
  logger.debug('切换词根组', { key })
}

/**
 * 播放单个词
 * @param item 词条
 */
function playWord(item: LessonItem): void {
  void play(item.english, `root:${item.id}`)
}

/**
 * 整组听读：按顺序朗读该组所有单词
 */
async function playGroup(): Promise<void> {
  const group = currentGroup.value
  if (!group) return
  const entries = group.items.map(item => ({
    text: item.english,
    key: `root:${item.id}`,
  }))
  logger.info('整组听读', { group: group.key, count: entries.length })
  await playSequence(entries, { rate: 0.95, gapMs: 260 })
}

/**
 * 切换遮中文模式
 */
function toggleHideChinese(): void {
  hideChinese.value = !hideChinese.value
  // 关闭遮中文时清空揭示记录，避免状态残留
  if (!hideChinese.value) {
    revealedWords.value = new Set()
  }
  logger.debug('遮中文模式', { enabled: hideChinese.value })
}

/**
 * 揭示某个词的中文
 * @param item 词条
 */
function revealWord(item: LessonItem): void {
  if (!hideChinese.value) return
  revealedWords.value.add(item.id)
}

/**
 * 判断某个词的中文是否可见
 * @param item 词条
 * @returns 是否可见
 */
function isChineseVisible(item: LessonItem): boolean {
  return !hideChinese.value || revealedWords.value.has(item.id)
}

/** 组变化时重置揭示状态 */
watch(
  () => currentGroup.value?.key,
  () => {
    revealedWords.value = new Set()
  },
)
</script>

<template>
  <section class="root-stage">
    <!-- 工具条 -->
    <header class="root-toolbar">
      <div class="toolbar-info">
        <span class="stage-label">词根课堂</span>
        <span class="stage-meta">
          {{ groups.length }} 组 · {{ lesson.items.length }} 词
        </span>
      </div>
      <div class="toolbar-actions">
        <el-button size="small" :icon="Headset" @click="playGroup">整组听读</el-button>
        <el-button
          size="small"
          :icon="View"
          :type="hideChinese ? 'primary' : 'default'"
          plain
          @click="toggleHideChinese"
        >
          {{ hideChinese ? '结束遮中文' : '遮中文回忆' }}
        </el-button>
      </div>
    </header>

    <!-- 无内容 -->
    <el-empty v-if="groups.length === 0" description="当前课时没有可用的词汇内容" />

    <!-- 主体：左组右词 -->
    <div v-else class="root-layout">
      <aside class="root-list">
        <button
          v-for="group in groups"
          :key="group.key"
          type="button"
          class="root-item"
          :class="{ active: currentGroup?.key === group.key }"
          @click="selectGroup(group.key)"
        >
          <span class="root-mark">
            <el-icon><Collection /></el-icon>
          </span>
          <span class="root-text">
            <strong>{{ group.label }}</strong>
            <small v-if="group.meaning">{{ group.meaning }}</small>
            <small v-else-if="group.inferred">按词性归组</small>
          </span>
          <span class="root-count">{{ group.items.length }}</span>
        </button>
      </aside>

      <div class="root-detail">
        <div v-if="currentGroup" class="root-detail-head">
          <div>
            <h3>{{ currentGroup.label }}</h3>
            <p v-if="currentGroup.meaning" class="root-meaning">词根含义：{{ currentGroup.meaning }}</p>
            <p v-else class="root-meaning">未标注词根，已按词性归组</p>
          </div>
          <span class="root-total">{{ currentWordCount }} 个派生词</span>
        </div>

        <el-alert
          v-if="hasInferredGroup && currentGroup?.inferred"
          type="info"
          :closable="false"
          show-icon
          class="root-alert"
          title="当前内容未标注词根"
          description="已按词性临时归组。后续接入 AI 词根生成后，可自动补齐词根与讲解。"
        />

        <div class="word-list">
          <article
            v-for="item in currentGroup?.items ?? []"
            :key="item.id"
            class="word-card"
            :class="{ 'is-playing': playingKey === `root:${item.id}` }"
            @click="revealWord(item)"
          >
            <div class="card-top">
              <div class="card-word">
                <h4>{{ item.english }}</h4>
                <span v-if="item.phonetic" class="card-phonetic">{{ item.phonetic }}</span>
              </div>
              <button
                class="card-play"
                type="button"
                aria-label="播放发音"
                @click.stop="playWord(item)"
              >
                <el-icon v-if="loadingKey === `root:${item.id}`" class="is-loading"><Loading /></el-icon>
                <el-icon v-else><Headset /></el-icon>
              </button>
            </div>

            <div class="card-meta">
              <span v-if="item.partOfSpeech" class="pos-tag">{{ item.partOfSpeech }}</span>
              <span v-if="item.rootRole === 'root'" class="root-tag">词根词</span>
            </div>

            <p
              class="card-chinese"
              :class="{ masked: hideChinese && !isChineseVisible(item) }"
            >
              {{ isChineseVisible(item) ? (item.chinese || '暂无释义') : '点击卡片揭示中文' }}
            </p>

            <p v-if="item.explanation" class="card-explanation">{{ item.explanation }}</p>

            <p v-if="item.examples?.length" class="card-example">
              {{ item.examples[0] }}
            </p>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* 舞台 */
.root-stage {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
}

/* 工具条 */
.root-toolbar {
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

.toolbar-info {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.stage-label {
  padding: 2px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  color: #1d4ed8;
  background: #dbeafe;
}

.stage-meta {
  font-size: 12px;
  color: #94a3b8;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

/* 布局 */
.root-layout {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

/* 左栏组列表 */
.root-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(148, 163, 184, 0.18);
  position: sticky;
  top: 12px;
}

.root-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: background 0.16s ease, border-color 0.16s ease;
}

.root-item:hover {
  background: #f8fafc;
}

.root-item.active {
  background: #eff6ff;
  border-color: #bfdbfe;
}

.root-mark {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 10px;
  color: #2563eb;
  background: #dbeafe;
}

.root-text {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.root-text strong {
  font-size: 13px;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.root-text small {
  font-size: 11px;
  color: #94a3b8;
}

.root-count {
  margin-left: auto;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
}

/* 右栏详情 */
.root-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.root-detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 18px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.16);
}

.root-detail-head h3 {
  margin: 0;
  font-size: 20px;
  color: #0f172a;
}

.root-meaning {
  margin: 4px 0 0;
  font-size: 12.5px;
  color: #64748b;
}

.root-total {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  color: #1d4ed8;
  background: #eff6ff;
  white-space: nowrap;
}

.root-alert {
  border-radius: 12px;
}

/* 单词网格 */
.word-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 12px;
}

.word-card {
  padding: 16px;
  border-radius: 16px;
  background: #ffffff;
  border: 1px solid rgba(148, 163, 184, 0.18);
  cursor: pointer;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.word-card:hover {
  transform: translateY(-2px);
  border-color: #bfdbfe;
  box-shadow: 0 16px 32px -26px rgba(37, 99, 235, 0.5);
}

.word-card.is-playing {
  border-color: #2563eb;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.14);
}

.card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.card-word h4 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.card-phonetic {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  color: #94a3b8;
}

.card-play {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: none;
  color: #1d4ed8;
  background: #eff6ff;
  cursor: pointer;
}

.card-meta {
  display: flex;
  gap: 6px;
  margin-top: 10px;
}

.pos-tag,
.root-tag {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10.5px;
}

.pos-tag {
  color: #7c3aed;
  background: #ede9fe;
}

.root-tag {
  color: #0f766e;
  background: #ccfbf1;
}

.card-chinese {
  margin: 10px 0 0;
  font-size: 13.5px;
  line-height: 1.6;
  color: #334155;
}

.card-chinese.masked {
  color: #94a3b8;
  font-style: italic;
}

.card-explanation {
  margin: 8px 0 0;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.6;
  color: #0f766e;
  background: #f0fdfa;
}

.card-example {
  margin: 8px 0 0;
  font-family: Georgia, 'Times New Roman', serif;
  font-size: 12.5px;
  line-height: 1.6;
  color: #64748b;
}

@media (max-width: 900px) {
  .root-layout {
    grid-template-columns: 1fr;
  }

  .root-list {
    position: static;
    flex-direction: row;
    overflow-x: auto;
  }

  .root-item {
    min-width: 180px;
  }
}
</style>
