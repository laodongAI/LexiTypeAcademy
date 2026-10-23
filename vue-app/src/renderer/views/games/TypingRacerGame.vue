<!--
  打字赛车游戏
  
  在赛车竞速中提升打字速度和准确率
-->

<template>
  <div class="typing-racer-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <el-statistic title="速度 (WPM)" :value="wpm" />
        <el-statistic title="准确率" :value="accuracy" suffix="%" :precision="1" />
        <el-statistic title="进度" :value="progress" suffix="%" />
        <div class="timer">
          <el-icon><Timer /></el-icon>
          {{ formatTime(timeLeft) }}
        </div>
      </div>

      <!-- 赛道区域 -->
      <div class="race-track">
        <div class="track-line"></div>
        
        <!-- 玩家赛车 -->
        <div class="car player-car" :style="{ left: `${playerPosition}%` }">
          🏎️
        </div>
        
        <!-- 对手赛车 -->
        <div class="car opponent-car" :style="{ left: `${opponentPosition}%` }">
          🚗
        </div>
        
        <!-- 终点线 -->
        <div class="finish-line">🏁</div>
      </div>

      <!-- 目标单词 -->
      <div class="target-word">
        <span
          v-for="(char, index) in currentWord"
          :key="index"
          :class="{
            'char': true,
            'typed': index < typedText.length,
            'correct': index < typedText.length && typedText[index] === char,
            'incorrect': index < typedText.length && typedText[index] !== char,
            'current': index === typedText.length,
          }"
        >
          {{ char }}
        </span>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <el-input
          v-model="typedText"
          ref="inputRef"
          size="large"
          placeholder="开始输入..."
          :disabled="!gameStarted || gameOver"
          @input="handleInput"
          @keyup.enter="handleEnter"
        />
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          开始游戏
        </el-button>
        <el-button v-else-if="!gameOver" size="large" @click="pauseGame">
          <el-icon><VideoPause /></el-icon>
          暂停
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          再玩一次
        </el-button>
      </div>

      <!-- 游戏结束提示 -->
      <el-dialog v-model="showResults" title="游戏结束" width="400px">
        <div class="game-results">
          <div v-if="playerWon" class="result-message win">
            <el-icon :size="60" color="#67C23A"><Trophy /></el-icon>
            <h2>恭喜你赢了！🎉</h2>
          </div>
          <div v-else class="result-message lose">
            <el-icon :size="60" color="#F56C6C"><WarningFilled /></el-icon>
            <h2>很遗憾，再接再厉！</h2>
          </div>
          
          <el-descriptions :column="1" border>
            <el-descriptions-item label="最终得分">{{ finalScore }}</el-descriptions-item>
            <el-descriptions-item label="平均速度">{{ Math.round(wpm) }} WPM</el-descriptions-item>
            <el-descriptions-item label="准确率">{{ accuracy.toFixed(1) }}%</el-descriptions-item>
            <el-descriptions-item label="完成单词">{{ completedWords }} / {{ totalWords }}</el-descriptions-item>
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
import { Timer, VideoPlay, VideoPause, RefreshRight, Trophy, WarningFilled } from '@element-plus/icons-vue'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)

// 输入相关
const inputRef = ref()
const typedText = ref('')
const currentWord = ref('')
const currentWordIndex = ref(0)

// 单词列表
const wordsList = ref([
  'hello', 'world', 'practice', 'typing', 'speed',
  'accuracy', 'challenge', 'learning', 'keyboard', 'skill',
  'improvement', 'focus', 'concentration', 'performance', 'achievement',
  'progress', 'dedication', 'perseverance', 'excellence', 'mastery',
])

// 统计数据
const startTime = ref(0)
const timeLeft = ref(60) // 60秒倒计时
const completedWords = ref(0)
const totalChars = ref(0)
const correctChars = ref(0)
const playerPosition = ref(0)
const opponentPosition = ref(0)
const playerWon = ref(false)

// 定时器
let gameTimer: number | null = null
let opponentTimer: number | null = null

// 计算属性
const totalWords = computed(() => wordsList.value.length)

const wpm = computed(() => {
  const minutes = (Date.now() - startTime.value) / 60000
  if (minutes === 0) return 0
  return Math.round((completedWords.value / minutes))
})

const accuracy = computed(() => {
  if (totalChars.value === 0) return 100
  return (correctChars.value / totalChars.value) * 100
})

const progress = computed(() => {
  return (completedWords.value / totalWords.value) * 100
})

const finalScore = computed(() => {
  return Math.round(wpm.value * (accuracy.value / 100) * 100)
})

// 格式化时间
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false
  
  startTime.value = Date.now()
  timeLeft.value = 60
  completedWords.value = 0
  totalChars.value = 0
  correctChars.value = 0
  playerPosition.value = 0
  opponentPosition.value = 0
  currentWordIndex.value = 0
  
  // 打乱单词列表
  wordsList.value = wordsList.value.sort(() => Math.random() - 0.5)
  currentWord.value = wordsList.value[0]
  typedText.value = ''
  
  // 聚焦输入框
  inputRef.value?.focus()
  
  // 启动倒计时
  gameTimer = window.setInterval(() => {
    timeLeft.value--
    if (timeLeft.value <= 0) {
      endGame(false)
    }
  }, 1000)
  
  // 启动对手赛车（AI模拟）
  opponentTimer = window.setInterval(() => {
    opponentPosition.value += Math.random() * 1.5 + 0.5
    if (opponentPosition.value >= 100) {
      endGame(false)
    }
  }, 100)
}

// 处理输入
function handleInput() {
  if (!currentWord.value) return
  
  totalChars.value++
  
  const lastChar = typedText.value[typedText.value.length - 1]
  const targetChar = currentWord.value[typedText.value.length - 1]
  
  if (lastChar === targetChar) {
    correctChars.value++
  }
}

// 处理回车（提交单词）
function handleEnter() {
  if (typedText.value === currentWord.value) {
    // 正确完成单词
    completedWords.value++
    playerPosition.value = progress.value
    
    // 加载下一个单词
    currentWordIndex.value++
    if (currentWordIndex.value >= wordsList.value.length) {
      // 所有单词完成
      endGame(true)
      return
    }
    
    currentWord.value = wordsList.value[currentWordIndex.value]
    typedText.value = ''
    
    // 更新分数
    emit('scoreUpdate', finalScore.value)
  } else {
    // 输入错误，清空重试
    typedText.value = ''
  }
}

// 暂停游戏
function pauseGame() {
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  if (opponentTimer) {
    clearInterval(opponentTimer)
    opponentTimer = null
  }
}

// 结束游戏
function endGame(won: boolean) {
  gameOver.value = true
  playerWon.value = won
  showResults.value = true
  
  if (gameTimer) {
    clearInterval(gameTimer)
    gameTimer = null
  }
  if (opponentTimer) {
    clearInterval(opponentTimer)
    opponentTimer = null
  }
  
  emit('gameOver', finalScore.value)
}

// 重新开始
function restartGame() {
  showResults.value = false
  startGame()
}

// 清理定时器
onUnmounted(() => {
  if (gameTimer) clearInterval(gameTimer)
  if (opponentTimer) clearInterval(opponentTimer)
})
</script>

<style lang="scss" scoped>
.typing-racer-game {
  .game-card {
    max-width: 900px;
    margin: 0 auto;
  }
  
  .game-status {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    margin-bottom: 30px;
    
    :deep(.el-statistic__head) {
      color: #fff;
      opacity: 0.9;
    }
    
    :deep(.el-statistic__content) {
      color: #fff;
      font-size: 28px;
      font-weight: 700;
    }
    
    .timer {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 24px;
      font-weight: 600;
      color: #fff;
    }
  }
  
  .race-track {
    position: relative;
    height: 120px;
    background: linear-gradient(180deg, #87CEEB 0%, #98D8C8 100%);
    border-radius: 8px;
    margin-bottom: 30px;
    overflow: hidden;
    
    .track-line {
      position: absolute;
      top: 50%;
      left: 0;
      right: 0;
      height: 4px;
      background: repeating-linear-gradient(
        90deg,
        #fff 0px,
        #fff 20px,
        transparent 20px,
        transparent 40px
      );
      transform: translateY(-50%);
    }
    
    .car {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      font-size: 40px;
      transition: left 0.3s ease-out;
      z-index: 10;
    }
    
    .player-car {
      top: 40%;
    }
    
    .opponent-car {
      top: 60%;
      opacity: 0.8;
    }
    
    .finish-line {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 50px;
    }
  }
  
  .target-word {
    text-align: center;
    font-size: 48px;
    font-weight: 600;
    margin: 30px 0;
    min-height: 70px;
    letter-spacing: 4px;
    
    .char {
      display: inline-block;
      padding: 0 4px;
      transition: all 0.2s;
      
      &.typed {
        opacity: 0.5;
      }
      
      &.correct {
        color: #67C23A;
      }
      
      &.incorrect {
        color: #F56C6C;
        animation: shake 0.3s;
      }
      
      &.current {
        background: #409EFF;
        color: #fff;
        border-radius: 4px;
        animation: pulse 1s infinite;
      }
    }
  }
  
  .input-area {
    margin: 30px 0;
    
    :deep(.el-input__inner) {
      text-align: center;
      font-size: 24px;
      font-weight: 500;
      letter-spacing: 2px;
    }
  }
  
  .game-controls {
    text-align: center;
  }
  
  .game-results {
    .result-message {
      text-align: center;
      margin-bottom: 20px;
      
      h2 {
        margin-top: 12px;
        font-size: 24px;
      }
      
      &.win {
        color: #67C23A;
      }
      
      &.lose {
        color: #F56C6C;
      }
    }
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

@keyframes pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}
</style>
