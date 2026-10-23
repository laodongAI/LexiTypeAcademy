<!--
  连击大师游戏
  
  连续正确输入获得高分连击奖励
-->

<template>
  <div class="combo-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <div class="status-item">
          <div class="status-label">得分</div>
          <div class="status-value score">{{ score }}</div>
        </div>
        <div class="status-item combo-display">
          <div class="combo-value" :class="{ 'mega-combo': combo >= 10, 'super-combo': combo >= 20 }">
            {{ combo }}x
          </div>
          <div class="combo-label">COMBO!</div>
          <div v-if="combo >= 10" class="combo-effect">🔥</div>
        </div>
        <div class="status-item">
          <div class="status-label">倍率</div>
          <div class="status-value multiplier">{{ multiplier.toFixed(1) }}x</div>
        </div>
        <div class="status-item">
          <div class="status-label">剩余时间</div>
          <div class="status-value time">{{ timeLeft }}s</div>
        </div>
      </div>

      <!-- 单词展示区 -->
      <div v-if="gameStarted && !gameOver" class="word-area">
        <transition-group name="word-slide" tag="div" class="words-list">
          <div
            v-for="word in activeWords"
            :key="word.id"
            class="word-item"
            :style="{ top: word.position + 'px' }"
          >
            <div class="word-text">{{ word.text }}</div>
            <el-progress
              :percentage="word.health"
              :color="word.health > 50 ? '#67C23A' : word.health > 25 ? '#E6A23C' : '#F56C6C'"
              :show-text="false"
            />
          </div>
        </transition-group>

        <!-- 输入区域 -->
        <div class="input-section">
          <el-input
            v-model="userInput"
            ref="inputRef"
            size="large"
            placeholder="快速输入单词..."
            :disabled="!gameStarted || gameOver"
            @input="handleInput"
          >
            <template #prepend>
              <el-icon><Edit /></el-icon>
            </template>
          </el-input>
        </div>

        <!-- 连击特效 -->
        <transition name="fade">
          <div v-if="showComboEffect" class="combo-effect-overlay">
            <div class="effect-text">+{{ lastComboScore }}</div>
            <div class="effect-combo">{{ combo }}x COMBO!</div>
          </div>
        </transition>
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          开始游戏
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          再来一次
        </el-button>
      </div>

      <!-- 游戏结束 -->
      <el-dialog v-model="showResults" title="游戏结束" width="450px">
        <div class="game-results">
          <div class="result-score">
            <el-icon :size="70" color="#409EFF"><Trophy /></el-icon>
            <h2>{{ score }}</h2>
            <p>最终得分</p>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="最高连击">{{ maxCombo }}x</el-descriptions-item>
            <el-descriptions-item label="最高倍率">{{ maxMultiplier.toFixed(1) }}x</el-descriptions-item>
            <el-descriptions-item label="完成单词">{{ completedWords }}</el-descriptions-item>
            <el-descriptions-item label="错过单词">{{ missedWords }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="maxCombo >= 20" class="achievement">
            <el-tag type="danger" size="large" effect="dark">
              🏆 连击王者
            </el-tag>
          </div>
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
import { ref, computed, onUnmounted } from 'vue'
import { Edit, VideoPlay, RefreshRight, Trophy } from '@element-plus/icons-vue'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface Word {
  id: number
  text: string
  position: number
  health: number
  speed: number
}

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)
const inputRef = ref()
const userInput = ref('')

// 游戏数据
const score = ref(0)
const combo = ref(0)
const maxCombo = ref(0)
const multiplier = ref(1.0)
const maxMultiplier = ref(1.0)
const completedWords = ref(0)
const missedWords = ref(0)
const timeLeft = ref(60)
const activeWords = ref<Word[]>([])
const nextWordId = ref(1)
const lastComboScore = ref(0)
const showComboEffect = ref(false)

// 单词库
const wordPool = [
  'cat', 'dog', 'run', 'jump', 'fast', 'slow', 'big', 'small',
  'hello', 'world', 'game', 'play', 'fun', 'cool', 'nice', 'good',
  'happy', 'lucky', 'smile', 'laugh', 'dance', 'sing', 'read', 'write',
  'apple', 'banana', 'orange', 'grape', 'water', 'coffee', 'tea', 'milk',
  'computer', 'keyboard', 'mouse', 'screen', 'phone', 'music', 'video', 'picture',
]

// 定时器
let gameTimer: number | null = null
let spawnTimer: number | null = null
let updateTimer: number | null = null

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false

  score.value = 0
  combo.value = 0
  maxCombo.value = 0
  multiplier.value = 1.0
  maxMultiplier.value = 1.0
  completedWords.value = 0
  missedWords.value = 0
  timeLeft.value = 60
  activeWords.value = []
  nextWordId.value = 1
  userInput.value = ''

  inputRef.value?.focus()

  // 游戏倒计时
  gameTimer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      endGame()
    }
  }, 1000)

  // 生成单词
  spawnTimer = window.setInterval(() => {
    spawnWord()
  }, 2000)

  // 更新单词位置和生命值
  updateTimer = window.setInterval(() => {
    updateWords()
  }, 50)
}

// 生成单词
function spawnWord() {
  const randomWord = wordPool[Math.floor(Math.random() * wordPool.length)]
  const newWord: Word = {
    id: nextWordId.value++,
    text: randomWord,
    position: 0,
    health: 100,
    speed: 1 + Math.random() * 1.5,
  }
  activeWords.value.push(newWord)
}

// 更新单词
function updateWords() {
  activeWords.value = activeWords.value.filter(word => {
    word.position += word.speed
    word.health -= 0.5

    if (word.health <= 0 || word.position > 350) {
      // 单词消失，连击中断
      if (combo.value > 0) {
        combo.value = 0
        multiplier.value = 1.0
      }
      missedWords.value++
      return false
    }
    return true
  })
}

// 处理输入
function handleInput() {
  const input = userInput.value.trim().toLowerCase()
  if (!input) return

  const matchedWordIndex = activeWords.value.findIndex(
    word => word.text.toLowerCase() === input
  )

  if (matchedWordIndex !== -1) {
    // 击中单词
    const word = activeWords.value[matchedWordIndex]
    activeWords.value.splice(matchedWordIndex, 1)

    combo.value++
    maxCombo.value = Math.max(maxCombo.value, combo.value)

    // 更新倍率 (每5个连击提升0.5倍)
    multiplier.value = 1.0 + Math.floor(combo.value / 5) * 0.5
    maxMultiplier.value = Math.max(maxMultiplier.value, multiplier.value)

    // 计算得分 (基础分10 * 倍率 * 剩余生命值加成)
    const baseScore = 10
    const healthBonus = 1 + word.health / 100
    const earnedScore = Math.round(baseScore * multiplier.value * healthBonus)

    score.value += earnedScore
    completedWords.value++
    lastComboScore.value = earnedScore

    // 显示连击特效
    if (combo.value >= 5) {
      showComboEffect.value = true
      setTimeout(() => {
        showComboEffect.value = false
      }, 800)
    }

    emit('scoreUpdate', score.value)
    userInput.value = ''
  }
}

// 结束游戏
function endGame() {
  gameOver.value = true
  showResults.value = true

  if (gameTimer) clearInterval(gameTimer)
  if (spawnTimer) clearInterval(spawnTimer)
  if (updateTimer) clearInterval(updateTimer)

  emit('gameOver', score.value)
}

// 重新开始
function restartGame() {
  showResults.value = false
  startGame()
}

// 清理
onUnmounted(() => {
  if (gameTimer) clearInterval(gameTimer)
  if (spawnTimer) clearInterval(spawnTimer)
  if (updateTimer) clearInterval(updateTimer)
})
</script>

<style lang="scss" scoped>
.combo-game {
  .game-card {
    max-width: 900px;
    margin: 0 auto;
  }

  .game-status {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 24px;
    background: linear-gradient(135deg, #FA8BFF 0%, #2BD2FF 52%, #2BFF88 100%);
    border-radius: 12px;
    margin-bottom: 30px;

    .status-item {
      text-align: center;

      .status-label {
        color: #fff;
        font-size: 14px;
        opacity: 0.9;
        margin-bottom: 8px;
      }

      .status-value {
        color: #fff;
        font-size: 32px;
        font-weight: 700;
        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.3);

        &.score {
          font-size: 40px;
        }
      }
    }

    .combo-display {
      position: relative;

      .combo-value {
        font-size: 48px;
        font-weight: 900;
        color: #fff;
        text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.4);
        transition: all 0.3s;

        &.mega-combo {
          color: #FFD700;
          animation: pulse 0.5s infinite;
        }

        &.super-combo {
          color: #FF1493;
          animation: pulse 0.3s infinite;
        }
      }

      .combo-label {
        color: #fff;
        font-size: 16px;
        font-weight: 600;
        margin-top: 4px;
      }

      .combo-effect {
        position: absolute;
        top: -20px;
        right: -20px;
        font-size: 30px;
        animation: fire 0.5s infinite;
      }
    }
  }

  .word-area {
    position: relative;
    min-height: 450px;
    background: linear-gradient(180deg, #f5f7fa 0%, #e4e7ed 100%);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;

    .words-list {
      position: relative;
      height: 350px;
      overflow: hidden;

      .word-item {
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        width: 200px;
        padding: 16px;
        background: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        transition: all 0.1s;

        .word-text {
          font-size: 24px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 8px;
          color: #303133;
        }
      }
    }

    .input-section {
      margin-top: 20px;

      :deep(.el-input__inner) {
        font-size: 20px;
        text-align: center;
      }
    }

    .combo-effect-overlay {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
      z-index: 100;

      .effect-text {
        font-size: 60px;
        font-weight: 900;
        color: #FFD700;
        text-shadow: 3px 3px 6px rgba(0, 0, 0, 0.5);
        animation: scoreUp 0.8s ease-out;
      }

      .effect-combo {
        font-size: 32px;
        font-weight: 700;
        color: #FF1493;
        margin-top: 10px;
        animation: fadeIn 0.5s;
      }
    }
  }

  .game-controls {
    text-align: center;
  }

  .game-results {
    .result-score {
      text-align: center;
      margin-bottom: 24px;

      h2 {
        font-size: 48px;
        font-weight: 700;
        color: #409EFF;
        margin: 12px 0 8px;
      }

      p {
        color: #909399;
        font-size: 16px;
      }
    }

    .achievement {
      text-align: center;
      margin-top: 20px;
    }
  }
}

// 动画
.word-slide-enter-active,
.word-slide-leave-active {
  transition: all 0.3s;
}

.word-slide-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(-30px);
}

.word-slide-leave-to {
  opacity: 0;
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.5s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.5);
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}

@keyframes fire {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(10deg); }
}

@keyframes scoreUp {
  0% {
    opacity: 1;
    transform: translateY(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-100px);
  }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
</style>
