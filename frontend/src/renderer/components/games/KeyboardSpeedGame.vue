<template>
  <div class="keyboard-speed-game">
    <div class="top-bar">
      <el-alert
        title="键盘速度挑战"
        type="info"
        :closable="false"
        show-icon
      />

      <div class="stats">
        <el-statistic title="剩余时间" :value="timeLeft" suffix="秒" />
        <el-statistic title="得分" :value="score" />
        <el-statistic title="正确" :value="hits" />
        <el-statistic title="失误" :value="misses" />
      </div>
    </div>

    <el-divider />

    <div class="center">
      <div class="prompt">
        <div class="label">请按下：</div>
        <div class="key">{{ targetKeyDisplay }}</div>
        <div class="hint">可直接按实体键盘，也可点击虚拟键盘</div>
      </div>

      <div class="controls">
        <el-button v-if="status !== 'running'" type="primary" @click="start">
          {{ status === 'finished' ? '再来一局' : '开始' }}
        </el-button>
        <el-button v-else type="danger" @click="stop">结束</el-button>

        <el-select v-model="duration" :disabled="status === 'running'" style="width: 140px">
          <el-option :value="30" label="30 秒" />
          <el-option :value="60" label="60 秒" />
          <el-option :value="90" label="90 秒" />
        </el-select>
      </div>

      <div class="keyboard">
        <VirtualKeyboard :highlight-key="targetKey" :pressed-key="pressedKey" @key-click="onVirtualKey" />
      </div>

      <div v-if="status === 'finished'" class="result">
        <el-result icon="success" title="本局结束">
          <template #sub-title>
            <div class="result-sub">
              <span>命中率：{{ accuracy }}%</span>
              <span>每分钟命中：{{ hitsPerMinute }}</span>
            </div>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'

const VirtualKeyboard = defineAsyncComponent(() => import('../../../shared/components/VirtualKeyboard.vue'))

type GameStatus = 'idle' | 'running' | 'finished'

const emit = defineEmits<{
  gameOver: [payload: { score: number; hits: number; misses: number; duration: number }]
}>()

const status = ref<GameStatus>('idle')
const duration = ref(60)

const timeLeft = ref(60)
const score = ref(0)
const hits = ref(0)
const misses = ref(0)

const pressedKey = ref('')

const candidateKeys = [
  'a','s','d','f','j','k','l',';','g','h',
  'q','w','e','r','t','y','u','i','o','p',
  'z','x','c','v','b','n','m',',','.','/',
  '1','2','3','4','5','6','7','8','9','0',
  '-','=',
]

const targetKey = ref('f')

const targetKeyDisplay = computed(() => {
  if (targetKey.value === ' ') return 'Space'
  return targetKey.value.toUpperCase()
})

const accuracy = computed(() => {
  const total = hits.value + misses.value
  if (total === 0) return 0
  return Math.round((hits.value / total) * 100)
})

const hitsPerMinute = computed(() => {
  const d = duration.value
  if (d <= 0) return 0
  return Math.round((hits.value / d) * 60)
})

let timer: ReturnType<typeof setInterval> | null = null

function pickNextKey() {
  const idx = Math.floor(Math.random() * candidateKeys.length)
  targetKey.value = candidateKeys[idx]
}

function reset() {
  timeLeft.value = duration.value
  score.value = 0
  hits.value = 0
  misses.value = 0
  pressedKey.value = ''
  pickNextKey()
}

function start() {
  status.value = 'running'
  reset()

  if (timer) clearInterval(timer)
  timer = setInterval(() => {
    timeLeft.value -= 1
    if (timeLeft.value <= 0) {
      stop()
    }
  }, 1000)
}

function stop() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  if (status.value === 'running') {
    status.value = 'finished'
    emit('gameOver', { score: score.value, hits: hits.value, misses: misses.value, duration: duration.value })
  } else {
    status.value = 'finished'
  }
}

function judgeKey(rawKey: string) {
  if (status.value !== 'running') return

  const key = rawKey.length === 1 ? rawKey.toLowerCase() : rawKey
  pressedKey.value = key
  setTimeout(() => (pressedKey.value = ''), 80)

  if (key === targetKey.value) {
    hits.value += 1
    score.value += 10
    pickNextKey()
  } else {
    misses.value += 1
    score.value = Math.max(0, score.value - 2)
  }
}

function onVirtualKey(key: string) {
  if (key === 'Backspace' || key === 'Tab' || key === 'Caps' || key === 'Enter' || key === 'Shift') return
  if (key === 'Space') {
    judgeKey(' ')
    return
  }
  if (key.length === 1) {
    judgeKey(key)
  }
}

function onKeydown(e: KeyboardEvent) {
  // 结束后按 Enter 立即再来一局
  if (status.value === 'finished' && e.key === 'Enter') {
    e.preventDefault()
    start()
    return
  }

  if (status.value !== 'running') return

  const key = e.key
  if (key.length === 1) {
    judgeKey(key)
  } else {
    // 忽略控制键
  }
}

onMounted(() => {
  timeLeft.value = duration.value
  pickNextKey()
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (timer) clearInterval(timer)
})
</script>

<style scoped lang="scss">
.keyboard-speed-game {
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
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;

  :deep(.el-statistic) {
    text-align: center;
  }
}

.center {
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

  .key {
    font-size: 56px;
    font-weight: 800;
    color: var(--primary-color);
    line-height: 1;
    margin-bottom: 8px;
  }

  .hint {
    color: var(--text-color-placeholder);
    font-size: 12px;
  }
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.keyboard {
  display: flex;
  justify-content: center;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
}

.result-sub {
  display: flex;
  justify-content: center;
  gap: 24px;
  color: var(--text-color-secondary);
}
</style>
