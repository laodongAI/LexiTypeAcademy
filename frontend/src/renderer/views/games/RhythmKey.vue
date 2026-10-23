<!--
  节奏键盘游戏
  
  跟随音乐节奏输入单词，体验韵律美
-->

<template>
  <div class="rhythm-key-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <el-statistic title="得分" :value="score" />
        <el-statistic title="连击" :value="combo" suffix="x" />
        <el-statistic title="准确率" :value="accuracy" suffix="%" :precision="1" />
        <div class="bpm-display">
          <el-icon :size="24" color="#E6A23C"><Headset /></el-icon>
          <span class="bpm-value">{{ bpm }} BPM</span>
        </div>
      </div>

      <!-- 游戏轨道 -->
      <div v-if="gameStarted && !gameOver" class="rhythm-tracks">
        <div class="center-line"></div>
        
        <!-- 音符轨道 -->
        <div
          v-for="note in activeNotes"
          :key="note.id"
          class="note"
          :class="{ 'perfect-timing': note.perfectTiming }"
          :style="{
            top: note.position + 'px',
            left: getTrackPosition(note.track) + 'px',
          }"
        >
          <div class="note-letter">{{ note.letter }}</div>
        </div>

        <!-- 判定区域 -->
        <div class="judgment-zone">
          <div
            v-for="track in 4"
            :key="track"
            class="track-indicator"
            :class="{ 'active': trackActive[track - 1] }"
            :style="{ left: getTrackPosition(track - 1) + 'px' }"
          >
            {{ ['F', 'G', 'H', 'J'][track - 1] }}
          </div>
        </div>

        <!-- 判定反馈 -->
        <transition name="fade">
          <div v-if="showJudgment" class="judgment-feedback" :class="lastJudgment">
            {{ judgmentText }}
          </div>
        </transition>
      </div>

      <!-- 当前单词 -->
      <div v-if="gameStarted && !gameOver" class="current-word">
        <div class="word-label">当前单词</div>
        <div class="word-text">
          <span
            v-for="(char, index) in currentWord"
            :key="index"
            :class="{
              'char': true,
              'typed': index < typedIndex,
              'current': index === typedIndex,
            }"
          >
            {{ char }}
          </span>
        </div>
      </div>

      <!-- 按键提示 -->
      <div v-if="gameStarted && !gameOver" class="key-hints">
        <div class="hint-text">按 F G H J 键击打音符</div>
        <div class="keys">
          <div
            v-for="(key, index) in ['F', 'G', 'H', 'J']"
            :key="key"
            class="key"
            :class="{ 'pressed': trackActive[index] }"
          >
            {{ key }}
          </div>
        </div>
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          开始演奏
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          再来一曲
        </el-button>
      </div>

      <!-- 游戏结束 -->
      <el-dialog v-model="showResults" title="演奏结束" width="450px">
        <div class="game-results">
          <div class="result-header">
            <el-icon :size="70" :color="getRankColor(rank)">
              <Medal />
            </el-icon>
            <h2 class="rank" :style="{ color: getRankColor(rank) }">{{ rank }}</h2>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="最终得分">{{ score }}</el-descriptions-item>
            <el-descriptions-item label="最高连击">{{ maxCombo }}x</el-descriptions-item>
            <el-descriptions-item label="Perfect">{{ perfectCount }}</el-descriptions-item>
            <el-descriptions-item label="Great">{{ greatCount }}</el-descriptions-item>
            <el-descriptions-item label="Good">{{ goodCount }}</el-descriptions-item>
            <el-descriptions-item label="Miss">{{ missCount }}</el-descriptions-item>
            <el-descriptions-item label="准确率" :span="2">
              {{ accuracy.toFixed(2) }}%
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <template #footer>
          <el-button @click="showResults = false">关闭</el-button>
          <el-button type="primary" @click="restartGame">再玩一次</el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { VideoPlay, RefreshRight, Medal, Headset } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface Note {
  id: number
  track: number // 0-3
  letter: string
  position: number
  speed: number
  perfectTiming?: boolean
}

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)
const trackActive = ref([false, false, false, false])

// 游戏数据
const score = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const bpm = ref(120)
const currentWord = ref('')
const typedIndex = ref(0)
const activeNotes = ref<Note[]>([])
let nextNoteId = 1

// 判定统计
const perfectCount = ref(0)
const greatCount = ref(0)
const goodCount = ref(0)
const missCount = ref(0)
const showJudgment = ref(false)
const lastJudgment = ref('')
const judgmentText = ref('')

// 单词库
const wordPool = [
  'rhythm', 'music', 'beat', 'melody', 'song', 'dance', 'piano', 'guitar',
  'drum', 'note', 'chord', 'tempo', 'harmony', 'jazz', 'rock', 'pop',
]

// 定时器
let gameLoop: number | null = null
let spawnTimer: number | null = null
let keydownListener: ((e: KeyboardEvent) => void) | null = null
let keyupListener: ((e: KeyboardEvent) => void) | null = null

// 计算属性
const accuracy = computed(() => {
  const total = perfectCount.value + greatCount.value + goodCount.value + missCount.value
  if (total === 0) return 100
  return ((perfectCount.value + greatCount.value + goodCount.value) / total) * 100
})

const rank = computed(() => {
  if (accuracy.value >= 95) return 'SSS'
  if (accuracy.value >= 90) return 'SS'
  if (accuracy.value >= 85) return 'S'
  if (accuracy.value >= 80) return 'A'
  if (accuracy.value >= 70) return 'B'
  if (accuracy.value >= 60) return 'C'
  return 'D'
})

// 获取轨道位置
function getTrackPosition(track: number): number {
  const trackWidth = 100
  const startX = 150
  return startX + track * trackWidth
}

// 获取等级颜色
function getRankColor(rank: string): string {
  const colors: Record<string, string> = {
    'SSS': '#FFD700',
    'SS': '#FF69B4',
    'S': '#FF6347',
    'A': '#FF8C00',
    'B': '#32CD32',
    'C': '#1E90FF',
    'D': '#808080',
  }
  return colors[rank] || '#808080'
}

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false

  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  perfectCount.value = 0
  greatCount.value = 0
  goodCount.value = 0
  missCount.value = 0
  activeNotes.value = []
  nextNoteId = 1

  nextWord()
  setupKeyboardListeners()

  // 游戏主循环
  gameLoop = window.setInterval(() => {
    updateNotes()
  }, 1000 / 60)

  // 生成音符
  const noteInterval = (60 / bpm.value) * 1000
  spawnTimer = window.setInterval(() => {
    spawnNote()
  }, noteInterval)
}

// 下一个单词
function nextWord() {
  currentWord.value = wordPool[Math.floor(Math.random() * wordPool.length)].toUpperCase()
  typedIndex.value = 0
}

// 生成音符
function spawnNote() {
  if (typedIndex.value >= currentWord.value.length) {
    nextWord()
  }

  const track = Math.floor(Math.random() * 4)
  const letter = currentWord.value[typedIndex.value]

  activeNotes.value.push({
    id: nextNoteId++,
    track,
    letter,
    position: 0,
    speed: 3 + bpm.value / 60,
  })

  typedIndex.value++
}

// 更新音符
function updateNotes() {
  activeNotes.value = activeNotes.value.filter(note => {
    note.position += note.speed

    // 超出判定区域，算miss
    if (note.position > 420) {
      handleMiss()
      return false
    }

    return true
  })
}

// 键盘监听
function setupKeyboardListeners() {
  const keyMap: Record<string, number> = {
    'f': 0,
    'F': 0,
    'g': 1,
    'G': 1,
    'h': 2,
    'H': 2,
    'j': 3,
    'J': 3,
  }

  keydownListener = (e: KeyboardEvent) => {
    const track = keyMap[e.key]
    if (track !== undefined && !trackActive.value[track]) {
      trackActive.value[track] = true
      hitNote(track)
    }
  }

  keyupListener = (e: KeyboardEvent) => {
    const track = keyMap[e.key]
    if (track !== undefined) {
      trackActive.value[track] = false
    }
  }

  window.addEventListener('keydown', keydownListener)
  window.addEventListener('keyup', keyupListener)
}

// 击打音符
function hitNote(track: number) {
  // 找到该轨道上最接近判定线的音符
  const note = activeNotes.value
    .filter(n => n.track === track)
    .sort((a, b) => Math.abs(a.position - 350) - Math.abs(b.position - 350))[0]

  if (!note) return

  const distance = Math.abs(note.position - 350)

  // 判定
  let judgment = ''
  let points = 0

  if (distance < 20) {
    judgment = 'perfect'
    judgmentText.value = 'PERFECT!'
    perfectCount.value++
    points = 100
    note.perfectTiming = true
  } else if (distance < 40) {
    judgment = 'great'
    judgmentText.value = 'GREAT!'
    greatCount.value++
    points = 70
  } else if (distance < 60) {
    judgment = 'good'
    judgmentText.value = 'GOOD'
    goodCount.value++
    points = 40
  } else {
    return // 太远了，不判定
  }

  // 更新得分和连击
  combo.value++
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  score.value += points * (1 + combo.value * 0.1)

  // 显示判定
  lastJudgment.value = judgment
  showJudgment.value = true
  setTimeout(() => {
    showJudgment.value = false
  }, 500)

  // 移除音符
  const index = activeNotes.value.indexOf(note)
  if (index > -1) {
    activeNotes.value.splice(index, 1)
  }

  emit('scoreUpdate', Math.floor(score.value))
}

// Miss
function handleMiss() {
  missCount.value++
  combo.value = 0

  lastJudgment.value = 'miss'
  judgmentText.value = 'MISS'
  showJudgment.value = true
  setTimeout(() => {
    showJudgment.value = false
  }, 500)
}

// 结束游戏（30秒后自动结束）
onMounted(() => {
  setTimeout(() => {
    if (gameStarted.value && !gameOver.value) {
      endGame()
    }
  }, 60000) // 60秒
})

// 结束游戏
function endGame() {
  gameOver.value = true
  showResults.value = true

  if (gameLoop) clearInterval(gameLoop)
  if (spawnTimer) clearInterval(spawnTimer)

  if (keydownListener) window.removeEventListener('keydown', keydownListener)
  if (keyupListener) window.removeEventListener('keyup', keyupListener)

  emit('gameOver', Math.floor(score.value))
}

// 重新开始
function restartGame() {
  showResults.value = false
  startGame()
}

// 清理
onUnmounted(() => {
  if (gameLoop) clearInterval(gameLoop)
  if (spawnTimer) clearInterval(spawnTimer)
  if (keydownListener) window.removeEventListener('keydown', keydownListener)
  if (keyupListener) window.removeEventListener('keyup', keyupListener)
})
</script>

<style lang="scss" scoped>
.rhythm-key-game {
  .game-card {
    max-width: 900px;
    margin: 0 auto;
  }

  .game-status {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    border-radius: 8px;
    margin-bottom: 20px;

    :deep(.el-statistic__head) {
      color: #fff;
      opacity: 0.9;
    }

    :deep(.el-statistic__content) {
      color: #fff;
      font-size: 28px;
      font-weight: 700;
    }

    .bpm-display {
      display: flex;
      align-items: center;
      gap: 8px;

      .bpm-value {
        color: #fff;
        font-size: 20px;
        font-weight: 600;
      }
    }
  }

  .rhythm-tracks {
    position: relative;
    height: 450px;
    background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
    border-radius: 8px;
    margin-bottom: 20px;
    overflow: hidden;

    .center-line {
      position: absolute;
      top: 350px;
      left: 0;
      right: 0;
      height: 4px;
      background: rgba(255, 255, 255, 0.5);
      z-index: 1;
    }

    .note {
      position: absolute;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      transform: translateX(-30px);
      transition: all 0.1s;

      &.perfect-timing {
        background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
        animation: glow 0.5s;
      }

      .note-letter {
        color: #fff;
        font-size: 28px;
        font-weight: 700;
      }
    }

    .judgment-zone {
      position: absolute;
      top: 350px;
      left: 0;
      right: 0;
      height: 80px;
      transform: translateY(-40px);

      .track-indicator {
        position: absolute;
        width: 80px;
        height: 80px;
        border: 4px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        color: rgba(255, 255, 255, 0.5);
        font-size: 32px;
        font-weight: 700;
        transform: translateX(-40px);
        transition: all 0.2s;

        &.active {
          border-color: #67C23A;
          color: #67C23A;
          box-shadow: 0 0 20px rgba(103, 194, 58, 0.5);
          transform: translateX(-40px) scale(1.1);
        }
      }
    }

    .judgment-feedback {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 48px;
      font-weight: 900;
      text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 100;

      &.perfect {
        color: #FFD700;
      }

      &.great {
        color: #67C23A;
      }

      &.good {
        color: #409EFF;
      }

      &.miss {
        color: #F56C6C;
      }
    }
  }

  .current-word {
    text-align: center;
    margin-bottom: 20px;

    .word-label {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }

    .word-text {
      font-size: 32px;
      font-weight: 700;
      letter-spacing: 8px;

      .char {
        display: inline-block;
        color: #909399;
        transition: all 0.2s;

        &.typed {
          color: #67C23A;
        }

        &.current {
          color: #409EFF;
          animation: pulse 1s infinite;
        }
      }
    }
  }

  .key-hints {
    text-align: center;
    margin-bottom: 20px;

    .hint-text {
      font-size: 14px;
      color: #606266;
      margin-bottom: 12px;
    }

    .keys {
      display: flex;
      justify-content: center;
      gap: 16px;

      .key {
        width: 60px;
        height: 60px;
        background: #fff;
        border: 3px solid #dcdfe6;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 700;
        color: #606266;
        transition: all 0.2s;

        &.pressed {
          background: #67C23A;
          border-color: #67C23A;
          color: #fff;
          transform: scale(0.9);
        }
      }
    }
  }

  .game-controls {
    text-align: center;
  }

  .game-results {
    .result-header {
      text-align: center;
      margin-bottom: 24px;

      .rank {
        font-size: 48px;
        font-weight: 900;
        margin-top: 12px;
      }
    }
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s;
}

.fade-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}

.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(1.5);
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.8);
  }
}

@keyframes pulse {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.2);
  }
}
</style>
