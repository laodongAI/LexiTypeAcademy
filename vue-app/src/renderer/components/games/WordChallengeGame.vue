<template>
  <div class="word-challenge-game">
    <div class="top-bar">
      <el-alert
        title="单词挑战"
        type="warning"
        :closable="false"
        show-icon
      />

      <div class="stats">
        <el-statistic title="得分" :value="score" />
        <el-statistic title="剩余时间" :value="timeLeft" suffix="秒" />
        <el-statistic title="连对" :value="streak" />
      </div>
    </div>

    <el-divider />

    <div v-if="status === 'idle'" class="panel">
      <div class="intro">
        <div class="title">60 秒内尽可能多地输入单词</div>
        <div class="desc">输入正确会自动切换到下一个单词</div>
      </div>

      <el-button type="primary" size="large" @click="start">
        开始游戏
      </el-button>
    </div>

    <div v-else-if="status === 'running'" class="panel">
      <div class="word">{{ currentWord }}</div>

      <el-input
        ref="inputRef"
        v-model="input"
        class="input"
        placeholder="开始输入..."
        size="large"
        autocomplete="off"
        @input="handleInput"
      />

      <div class="hint">提示：可连续输入，完全匹配即算正确</div>

      <div class="actions">
        <el-button type="danger" plain @click="stop">结束</el-button>
      </div>
    </div>

    <div v-else class="panel">
      <el-result icon="success" title="时间到！">
        <template #sub-title>
          <div class="result-sub">
            <span>最终得分：{{ score }}</span>
            <span>最高连对：{{ bestStreak }}</span>
          </div>
        </template>
        <template #extra>
          <el-button type="primary" @click="start">再玩一次（Enter）</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'

type Status = 'idle' | 'running' | 'finished'

const emit = defineEmits<{
  gameOver: [payload: { score: number }]
}>()

// 与老版保持一致的最小词库（可后续扩展为从课程/词库抽取）
const WORD_DATABASE = [
  'react',
  'typescript',
  'electron',
  'javascript',
  'component',
  'interface',
  'hook',
  'render',
  'state',
  'props',
]

const status = ref<Status>('idle')
const currentWord = ref('')
const input = ref('')
const score = ref(0)
const timeLeft = ref(60)
const streak = ref(0)
const bestStreak = ref(0)

const inputRef = ref<any>(null)

let timer: ReturnType<typeof setInterval> | null = null

function pickNextWord() {
  const idx = Math.floor(Math.random() * WORD_DATABASE.length)
  currentWord.value = WORD_DATABASE[idx]
}

async function start() {
  stopTimer()
  status.value = 'running'
  score.value = 0
  timeLeft.value = 60
  streak.value = 0
  bestStreak.value = 0
  input.value = ''
  pickNextWord()

  await nextTick()
  inputRef.value?.focus?.()

  timer = setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      finish()
    }
  }, 1000)
}

function finish() {
  stopTimer()
  if (status.value !== 'running') return
  status.value = 'finished'
  emit('gameOver', { score: score.value })
}

function stop() {
  finish()
}

function stopTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

function handleInput() {
  if (status.value !== 'running') return

  const val = input.value.trim()
  if (val === currentWord.value) {
    score.value += 1
    streak.value += 1
    bestStreak.value = Math.max(bestStreak.value, streak.value)
    input.value = ''
    pickNextWord()
  } else {
    // 只在用户输入长度达到目标长度且不匹配时判为断连
    if (val.length >= currentWord.value.length && val !== currentWord.value) {
      streak.value = 0
    }
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (status.value === 'finished' && e.key === 'Enter') {
    e.preventDefault()
    start()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
  stopTimer()
})
</script>

<style scoped lang="scss">
.word-challenge-game {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.top-bar {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;

  :deep(.el-statistic) {
    text-align: center;
  }
}

.panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 8px 0;
}

.intro {
  text-align: center;

  .title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-color);
    margin-bottom: 6px;
  }

  .desc {
    color: var(--text-color-secondary);
  }
}

.word {
  font-size: 56px;
  font-weight: 800;
  letter-spacing: 1px;
  color: var(--text-color);
}

.input {
  max-width: 480px;
  width: 100%;
}

.hint {
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.result-sub {
  display: flex;
  justify-content: center;
  gap: 16px;
  color: var(--text-color-secondary);
}
</style>
