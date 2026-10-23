<template>
  <div class="pinyin-match-game">
    <div class="top-bar">
      <el-alert
        title="汉字配对"
        type="success"
        :closable="false"
        show-icon
      />

      <div class="stats">
        <el-statistic title="题目" :value="currentIndex + 1" :suffix="`/${total}`" />
        <el-statistic title="得分" :value="score" />
        <el-statistic title="连对" :value="streak" />
      </div>
    </div>

    <el-divider />

    <div v-if="status === 'playing'" class="question">
      <div class="prompt">
        <div class="label">选择这个汉字的正确拼音：</div>
        <div class="char">{{ currentQuestion?.char }}</div>
      </div>

      <div class="options">
        <el-button
          v-for="opt in options"
          :key="opt"
          size="large"
          @click="choose(opt)"
        >
          {{ opt }}
        </el-button>
      </div>

      <div class="hint">
        {{ feedbackText || '点击按钮选择答案' }}
      </div>
    </div>

    <div v-else class="result">
      <el-result icon="success" title="本局完成">
        <template #sub-title>
          <div class="sub">
            <span>总分：{{ score }}</span>
            <span>正确：{{ correctCount }}</span>
            <span>错误：{{ wrongCount }}</span>
          </div>
        </template>
        <template #extra>
          <el-button type="primary" @click="start">再来一局</el-button>
        </template>
      </el-result>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import {
  compoundVowels,
  consonants,
  nasalVowelsN,
  nasalVowelsNG,
  singleVowels,
  wholeSyllables,
  type PinyinItem,
} from '../../../shared/data/pinyinData'

type Status = 'playing' | 'finished'

const emit = defineEmits<{
  gameOver: [payload: { score: number; correct: number; wrong: number; total: number }]
}>()

const total = 10

type Example = PinyinItem['examples'][number]

const pool = computed<Example[]>(() => {
  const groups = [singleVowels, compoundVowels, nasalVowelsN, nasalVowelsNG, consonants, wholeSyllables]
  const all: Example[] = []
  for (const g of groups) {
    for (const item of g) {
      for (const ex of item.examples) {
        if (ex?.char && ex?.pinyin) all.push(ex)
      }
    }
  }
  return all
})

const status = ref<Status>('playing')
const currentIndex = ref(0)
const score = ref(0)
const streak = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)

const feedbackText = ref('')

const currentQuestion = ref<Example | null>(null)
const options = ref<string[]>([])

function randInt(max: number) {
  return Math.floor(Math.random() * max)
}

function pickQuestion() {
  const all = pool.value
  if (all.length < 10) return

  currentQuestion.value = all[randInt(all.length)]

  const correct = currentQuestion.value.pinyin
  const optionSet = new Set<string>()
  optionSet.add(correct)

  while (optionSet.size < 4) {
    const candidate = all[randInt(all.length)]?.pinyin
    if (candidate) optionSet.add(candidate)
  }

  // 打乱
  options.value = Array.from(optionSet).sort(() => Math.random() - 0.5)
}

function start() {
  status.value = 'playing'
  currentIndex.value = 0
  score.value = 0
  streak.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  feedbackText.value = ''
  pickQuestion()
}

function finish() {
  status.value = 'finished'
  emit('gameOver', {
    score: score.value,
    correct: correctCount.value,
    wrong: wrongCount.value,
    total,
  })
}

function next() {
  if (currentIndex.value >= total - 1) {
    finish()
    return
  }
  currentIndex.value += 1
  pickQuestion()
}

function choose(opt: string) {
  if (!currentQuestion.value) return
  const correct = currentQuestion.value.pinyin

  if (opt === correct) {
    correctCount.value += 1
    streak.value += 1
    score.value += 10 + Math.min(10, streak.value) // 连对稍加成
    feedbackText.value = '正确！'
  } else {
    wrongCount.value += 1
    streak.value = 0
    feedbackText.value = `错误，正确答案是：${correct}`
  }

  next()
}

function handleKeydown(e: KeyboardEvent) {
  if (status.value === 'finished' && e.key === 'Enter') {
    e.preventDefault()
    start()
  }
}

onMounted(() => {
  start()
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped lang="scss">
.pinyin-match-game {
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

.question {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.prompt {
  text-align: center;
  padding: 16px;
  background: var(--bg-color-hover);
  border-radius: 12px;

  .label {
    color: var(--text-color-secondary);
    margin-bottom: 8px;
  }

  .char {
    font-size: 72px;
    font-weight: 800;
    color: var(--primary-color);
    line-height: 1;
  }
}

.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.hint {
  text-align: center;
  color: var(--text-color-placeholder);
  font-size: 12px;
}

.sub {
  display: flex;
  justify-content: center;
  gap: 16px;
  color: var(--text-color-secondary);
}
</style>
