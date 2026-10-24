/**
 * 课堂入口弹窗
 *
 * 作用：
 *   用户点击“进入学习”时先进入课堂准备页，选择学习方式后再进入沉浸式课堂。
 * 设计：
 *   - 顶部课堂门头（课程名 + 课时名 + 内容规模）；
 *   - 中部四种课堂模式卡片（精读 / 句子燃尽 / 词燃尽 / 词根）；
 *   - 底部课堂偏好（悬停朗读、中文提示）与进入按钮。
 */

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  ArrowRight,
  Collection,
  EditPen,
  MagicStick,
  Reading,
  Timer,
} from '@element-plus/icons-vue'
import type { Lesson } from '../../../shared/types/course'
import type { ClassroomMode, ClassroomOptions } from '../../../shared/types/classroom'

/** 模式卡片配置 */
interface ModeCard {
  /** 模式标识 */
  key: ClassroomMode
  /** 卡片标题 */
  title: string
  /** 一句话说明 */
  description: string
  /** 能力标签 */
  tags: string[]
  /** 图标组件 */
  icon: unknown
  /** 主题色（用于卡片高亮） */
  tone: 'teal' | 'amber' | 'violet' | 'blue'
  /** 是否推荐 */
  recommended?: boolean
}

/** 组件属性 */
const props = defineProps<{
  /** 是否显示弹窗 */
  modelValue: boolean
  /** 当前课时 */
  lesson: Lesson | null
  /** 所属课程标题 */
  courseTitle?: string
}>()

/** 组件事件 */
const emit = defineEmits<{
  /** 更新显示状态 */
  (event: 'update:modelValue', value: boolean): void
  /** 确认进入课堂 */
  (event: 'enter', mode: ClassroomMode, options: ClassroomOptions): void
}>()

/** 当前选中的模式 */
const selectedMode = ref<ClassroomMode>('reader')
/** 悬停朗读偏好：默认开启，符合“鼠标划过即读”的预期 */
const hoverEnabled = ref(true)
/** 中文提示偏好：默认开启，降低理解压力 */
const showChinese = ref(true)

/** 词条数量 */
const itemCount = computed(() => props.lesson?.items?.length ?? 0)

/** 句子总量（粗略估算：按标点切分） */
const sentenceCount = computed(() => {
  const items = props.lesson?.items ?? []
  return items.reduce((total, item) => {
    const count = (item.english || '').split(/[.!?]+/).filter(part => part.trim()).length
    return total + Math.max(1, count)
  }, 0)
})

/** 预计时长（分钟）：按每 8 条内容 1 分钟估算，最少 3 分钟 */
const estimatedMinutes = computed(() => Math.max(3, Math.round(itemCount.value / 8)))

/** 是否有可练习的单词 */
const hasWords = computed(() => itemCount.value > 0)

/** 是否具备整句内容（用于句子燃尽） */
const hasSentences = computed(() => {
  const items = props.lesson?.items ?? []
  return items.some(item => (item.english || '').trim().split(/\s+/).length > 1)
})

/** 模式卡片列表 */
const modeCards = computed<ModeCard[]>(() => [
  {
    key: 'reader',
    title: '精读课堂',
    description: '鼠标划过句子自动朗读，停在单词上弹出音标、释义与例句。',
    tags: ['悬停朗读', '词卡', '不打断阅读'],
    icon: Reading,
    tone: 'teal',
    recommended: true,
  },
  {
    key: 'burn-sentence',
    title: '句子燃尽',
    description: '从句尾逐词遮蔽提示，做对升级、做错回退，直到整句复述。',
    tags: ['逐词遮蔽', '自动回退', '整句复现'],
    icon: MagicStick,
    tone: 'amber',
  },
  {
    key: 'burn-word',
    title: '词燃尽',
    description: '从完整拼写到听音拼写，五级提示逐步燃尽，专攻拼写记忆。',
    tags: ['五级提示', '听音拼写', '拼写自测'],
    icon: EditPen,
    tone: 'violet',
  },
  {
    key: 'root',
    title: '词根课堂',
    description: '按词根聚合派生词，整组听读、遮中文回忆，一组记住一串词。',
    tags: ['词根成组', '整组听读', '遮中文'],
    icon: Collection,
    tone: 'blue',
  },
])

/**
 * 模式是否可用
 * @param mode 模式标识
 * @returns 是否可进入
 */
function isModeAvailable(mode: ClassroomMode): boolean {
  if (mode === 'burn-sentence') return hasSentences.value
  if (mode === 'burn-word' || mode === 'root') return hasWords.value
  return true
}

/** 当前选中模式的说明（用于底部提示） */
const selectedDescription = computed(() => {
  return modeCards.value.find(card => card.key === selectedMode.value)?.description ?? ''
})

/**
 * 选择模式
 * @param mode 模式标识
 */
function selectMode(mode: ClassroomMode): void {
  if (!isModeAvailable(mode)) return
  selectedMode.value = mode
}

/**
 * 关闭弹窗
 */
function closeDialog(): void {
  emit('update:modelValue', false)
}

/**
 * 确认进入课堂
 */
function confirmEnter(): void {
  emit('enter', selectedMode.value, {
    hoverEnabled: hoverEnabled.value,
    showChinese: showChinese.value,
  })
  closeDialog()
}

/**
 * 进入原有练习页
 */
function enterClassic(): void {
  emit('enter', 'classic', {
    hoverEnabled: hoverEnabled.value,
    showChinese: showChinese.value,
  })
  closeDialog()
}

// 每次打开弹窗时重置为推荐模式，避免上次选择造成困惑
watch(
  () => props.modelValue,
  visible => {
    if (visible) {
      selectedMode.value = 'reader'
      hoverEnabled.value = true
      showChinese.value = true
    }
  },
)
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    width="940px"
    class="classroom-entry"
    :show-close="false"
    :close-on-click-modal="true"
    align-center
    @update:model-value="emit('update:modelValue', $event)"
  >
    <!-- 门头：课堂氛围区 -->
    <div class="entry-hero">
      <div class="hero-glow hero-glow--one" />
      <div class="hero-glow hero-glow--two" />
      <div class="hero-content">
        <div class="hero-eyebrow">
          <span class="live-dot" />
          CLASSROOM READY
        </div>
        <h1 class="hero-title">{{ lesson?.title || '课堂准备' }}</h1>
        <p class="hero-subtitle">
          {{ courseTitle || '英语学习' }} · {{ lesson?.contentShape || 'mixed' }}
        </p>
        <div class="hero-metrics">
          <span class="metric-chip">
            <el-icon><Reading /></el-icon>
            {{ itemCount }} 条内容
          </span>
          <span class="metric-chip">
            <el-icon><MagicStick /></el-icon>
            {{ sentenceCount }} 句
          </span>
          <span class="metric-chip">
            <el-icon><Timer /></el-icon>
            约 {{ estimatedMinutes }} 分钟
          </span>
        </div>
      </div>
      <button class="hero-close" type="button" aria-label="关闭" @click="closeDialog">×</button>
    </div>

    <!-- 模式选择区 -->
    <div class="entry-body">
      <div class="section-heading">
        <h2>选择你的课堂</h2>
        <span>不同模式共用同一份内容，可随时切换</span>
      </div>

      <div class="mode-grid">
        <button
          v-for="card in modeCards"
          :key="card.key"
          type="button"
          class="mode-card"
          :class="[
            `tone-${card.tone}`,
            { active: selectedMode === card.key, disabled: !isModeAvailable(card.key) },
          ]"
          :aria-pressed="selectedMode === card.key"
          @click="selectMode(card.key)"
        >
          <span class="mode-icon">
            <el-icon><component :is="card.icon" /></el-icon>
          </span>
          <span class="mode-title-row">
            <span class="mode-title">{{ card.title }}</span>
            <span v-if="card.recommended" class="mode-badge">推荐</span>
          </span>
          <span class="mode-desc">{{ card.description }}</span>
          <span class="mode-tags">
            <span v-for="tag in card.tags" :key="tag">{{ tag }}</span>
          </span>
          <span class="mode-check">✓</span>
        </button>
      </div>

      <!-- 课堂偏好 -->
      <div class="entry-preferences">
        <div class="preference-item">
          <div class="preference-text">
            <strong>悬停朗读</strong>
            <span>鼠标划过句子时自动朗读</span>
          </div>
          <el-switch v-model="hoverEnabled" />
        </div>
        <div class="preference-item">
          <div class="preference-text">
            <strong>中文提示</strong>
            <span>练习时显示中文辅助理解</span>
          </div>
          <el-switch v-model="showChinese" />
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <div class="entry-footer">
      <div class="footer-hint">{{ selectedDescription }}</div>
      <div class="footer-actions">
        <el-button text @click="enterClassic">使用原有练习页</el-button>
        <el-button type="primary" size="large" @click="confirmEnter">
          进入课堂
          <el-icon class="el-icon--right"><ArrowRight /></el-icon>
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
/* 弹窗整体：去掉默认内边距，让门头贴合边缘 */
:global(.classroom-entry.el-dialog) {
  max-width: 94vw;
  overflow: hidden;
  border-radius: 22px;
  background: #ffffff;
}

:global(.classroom-entry .el-dialog__header) {
  padding: 0;
  margin: 0;
}

:global(.classroom-entry .el-dialog__body) {
  padding: 0;
}

/* 门头 */
.entry-hero {
  position: relative;
  overflow: hidden;
  padding: 30px 36px 26px;
  color: #f6fbff;
  background:
    radial-gradient(120% 160% at 12% 0%, rgba(59, 130, 246, 0.55) 0%, transparent 55%),
    radial-gradient(100% 140% at 92% 10%, rgba(20, 184, 166, 0.5) 0%, transparent 58%),
    linear-gradient(135deg, #10243c 0%, #123a4f 55%, #0d2a3d 100%);
}

.hero-glow {
  position: absolute;
  border-radius: 999px;
  filter: blur(2px);
  opacity: 0.55;
  pointer-events: none;
}

.hero-glow--one {
  width: 220px;
  height: 220px;
  right: -60px;
  top: -90px;
  background: radial-gradient(circle, rgba(125, 211, 252, 0.7) 0%, transparent 65%);
}

.hero-glow--two {
  width: 180px;
  height: 180px;
  left: 32%;
  bottom: -110px;
  background: radial-gradient(circle, rgba(45, 212, 191, 0.55) 0%, transparent 70%);
}

.hero-content {
  position: relative;
  z-index: 1;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  letter-spacing: 0.18em;
  font-weight: 600;
  color: rgba(224, 242, 254, 0.78);
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.18);
}

.hero-title {
  margin: 12px 0 6px;
  font-size: 28px;
  line-height: 1.2;
  font-weight: 720;
  letter-spacing: -0.01em;
}

.hero-subtitle {
  margin: 0;
  font-size: 13px;
  color: rgba(226, 244, 255, 0.72);
}

.hero-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 18px;
}

.metric-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 12px;
  color: rgba(240, 249, 255, 0.92);
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.16);
  backdrop-filter: blur(6px);
}

.hero-close {
  position: absolute;
  top: 18px;
  right: 20px;
  z-index: 2;
  width: 34px;
  height: 34px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(240, 249, 255, 0.9);
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  transition: background 0.2s ease;
}

.hero-close:hover {
  background: rgba(255, 255, 255, 0.18);
}

/* 主体 */
.entry-body {
  padding: 24px 30px 4px;
}

.section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.section-heading h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.section-heading span {
  font-size: 12px;
  color: #94a3b8;
}

.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.mode-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 18px 18px 16px;
  text-align: left;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    box-shadow 0.18s ease,
    border-color 0.18s ease;
}

.mode-card:hover {
  transform: translateY(-2px);
  border-color: #cbd5e1;
  box-shadow: 0 12px 28px -18px rgba(15, 23, 42, 0.35);
}

.mode-card.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.mode-card.active {
  border-color: transparent;
  box-shadow:
    0 0 0 2px var(--card-accent),
    0 18px 32px -24px rgba(15, 23, 42, 0.5);
}

.mode-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  font-size: 19px;
  color: var(--card-accent);
  background: var(--card-soft);
}

.mode-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.mode-title {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.mode-badge {
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  color: #0f766e;
  background: #ccfbf1;
}

.mode-desc {
  font-size: 12.5px;
  line-height: 1.65;
  color: #64748b;
}

.mode-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

.mode-tags span {
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 10.5px;
  color: #64748b;
  background: #f1f5f9;
}

.mode-check {
  position: absolute;
  top: 14px;
  right: 14px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 999px;
  font-size: 12px;
  color: #ffffff;
  background: var(--card-accent);
  opacity: 0;
  transform: scale(0.7);
  transition: opacity 0.16s ease, transform 0.16s ease;
}

.mode-card.active .mode-check {
  opacity: 1;
  transform: scale(1);
}

/* 模式主题色 */
.tone-teal {
  --card-accent: #0d9488;
  --card-soft: #ccfbf1;
}

.tone-amber {
  --card-accent: #d97706;
  --card-soft: #fef3c7;
}

.tone-violet {
  --card-accent: #7c3aed;
  --card-soft: #ede9fe;
}

.tone-blue {
  --card-accent: #2563eb;
  --card-soft: #dbeafe;
}

/* 偏好 */
.entry-preferences {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 16px;
  padding: 14px 16px;
  border-radius: 14px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.preference-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.preference-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preference-text strong {
  font-size: 13px;
  color: #1e293b;
}

.preference-text span {
  font-size: 11.5px;
  color: #94a3b8;
}

/* 底部 */
.entry-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 30px 24px;
}

.footer-hint {
  flex: 1;
  font-size: 12px;
  line-height: 1.6;
  color: #94a3b8;
}

.footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 窄屏适配 */
@media (max-width: 768px) {
  .mode-grid,
  .entry-preferences {
    grid-template-columns: 1fr;
  }

  .entry-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .footer-actions {
    justify-content: flex-end;
  }
}
</style>
