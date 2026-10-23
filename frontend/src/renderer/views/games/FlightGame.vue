<!--
  飞行冒险游戏
  
  驾驶飞机躲避障碍，同时完成单词输入
-->

<template>
  <div class="flight-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <el-statistic title="距离" :value="distance" suffix="m" />
        <el-statistic title="得分" :value="score" />
        <el-statistic title="速度" :value="speed" suffix="km/h" />
      </div>

      <!-- 游戏画布 -->
      <div v-if="gameStarted && !gameOver" class="game-canvas" ref="canvasContainer">
        <!-- 飞机 -->
        <div class="plane" :style="{ top: planeY + 'px' }">✈️</div>

        <!-- 障碍物 -->
        <div
          v-for="obstacle in obstacles"
          :key="obstacle.id"
          class="obstacle"
          :style="{
            left: obstacle.x + 'px',
            top: obstacle.y + 'px',
            fontSize: obstacle.size + 'px',
          }"
        >
          🏔️
        </div>

        <!-- 云朵 -->
        <div
          v-for="cloud in clouds"
          :key="cloud.id"
          class="cloud"
          :style="{
            left: cloud.x + 'px',
            top: cloud.y + 'px',
            opacity: cloud.opacity,
          }"
        >
          ☁️
        </div>

        <!-- 星星（奖励） -->
        <div
          v-for="star in stars"
          :key="star.id"
          class="star"
          :style="{
            left: star.x + 'px',
            top: star.y + 'px',
          }"
        >
          ⭐
        </div>

        <!-- 当前单词 -->
        <div class="current-word-display">
          <div class="word-prompt">输入单词控制飞机上升</div>
          <div class="word-text">{{ currentWord }}</div>
          <div class="word-input-area">
            <span
              v-for="(char, index) in currentWord"
              :key="index"
              :class="{
                'char': true,
                'typed': index < typedChars,
                'correct': index < typedChars,
              }"
            >
              {{ char }}
            </span>
          </div>
        </div>
      </div>

      <!-- 输入区域 -->
      <div v-if="gameStarted && !gameOver" class="input-area">
        <el-input
          v-model="userInput"
          ref="inputRef"
          size="large"
          placeholder="输入单词让飞机上升..."
          :disabled="!gameStarted || gameOver"
          @input="handleInput"
        />
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          起飞
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          重新起飞
        </el-button>
      </div>

      <!-- 游戏结束 -->
      <el-dialog v-model="showResults" title="飞行结束" width="450px">
        <div class="game-results">
          <div class="result-header">
            <el-icon :size="70" :color="distance >= 5000 ? '#67C23A' : '#409EFF'">
              <component :is="distance >= 5000 ? 'Trophy' : 'Medal'" />
            </el-icon>
            <h2>飞行距离: {{ distance }}m</h2>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="最终得分">{{ score }}</el-descriptions-item>
            <el-descriptions-item label="收集星星">{{ collectedStars }}</el-descriptions-item>
            <el-descriptions-item label="完成单词">{{ completedWords }}</el-descriptions-item>
            <el-descriptions-item label="最高速度">{{ maxSpeed }} km/h</el-descriptions-item>
          </el-descriptions>

          <div v-if="distance >= 5000" class="achievement">
            <el-tag type="success" size="large" effect="dark">
              🏆 飞行大师
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
import { ref, onMounted, onUnmounted } from 'vue'
import { VideoPlay, RefreshRight, Trophy, Medal } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface GameObject {
  id: number
  x: number
  y: number
  speed?: number
  size?: number
  opacity?: number
}

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)
const inputRef = ref()
const canvasContainer = ref()
const userInput = ref('')

// 游戏数据
const score = ref(0)
const distance = ref(0)
const speed = ref(100)
const maxSpeed = ref(100)
const planeY = ref(200)
const completedWords = ref(0)
const collectedStars = ref(0)
const typedChars = ref(0)

// 游戏对象
const obstacles = ref<GameObject[]>([])
const clouds = ref<GameObject[]>([])
const stars = ref<GameObject[]>([])
const currentWord = ref('')
let nextId = 1

// 单词库
const wordPool = [
  'fly', 'sky', 'bird', 'cloud', 'wind', 'high', 'fast', 'free',
  'plane', 'pilot', 'wings', 'soar', 'glide', 'flight', 'heaven', 'eagle',
]

// 定时器
let gameLoop: number | null = null

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false

  score.value = 0
  distance.value = 0
  speed.value = 100
  maxSpeed.value = 100
  planeY.value = 200
  completedWords.value = 0
  collectedStars.value = 0
  typedChars.value = 0
  userInput.value = ''

  obstacles.value = []
  clouds.value = []
  stars.value = []
  nextId = 1

  nextWord()
  inputRef.value?.focus()

  // 游戏主循环
  gameLoop = window.setInterval(() => {
    updateGame()
  }, 1000 / 60) // 60 FPS
}

// 下一个单词
function nextWord() {
  currentWord.value = wordPool[Math.floor(Math.random() * wordPool.length)]
  typedChars.value = 0
  userInput.value = ''
}

// 更新游戏
function updateGame() {
  // 飞机下降（重力）
  planeY.value += 1.5

  // 检查碰撞边界
  if (planeY.value < 0) {
    planeY.value = 0
  } else if (planeY.value > 380) {
    endGame('crashed')
    return
  }

  // 更新距离和速度
  distance.value += Math.floor(speed.value / 10)
  speed.value = Math.min(200, 100 + Math.floor(distance.value / 200))
  maxSpeed.value = Math.max(maxSpeed.value, speed.value)

  // 生成云朵
  if (Math.random() < 0.02) {
    clouds.value.push({
      id: nextId++,
      x: 800,
      y: Math.random() * 350,
      speed: speed.value / 20 + Math.random() * 2,
      opacity: 0.3 + Math.random() * 0.4,
    })
  }

  // 生成障碍物
  if (Math.random() < 0.015) {
    obstacles.value.push({
      id: nextId++,
      x: 800,
      y: Math.random() * 300 + 50,
      speed: speed.value / 10,
      size: 40 + Math.random() * 20,
    })
  }

  // 生成星星
  if (Math.random() < 0.01) {
    stars.value.push({
      id: nextId++,
      x: 800,
      y: Math.random() * 350,
      speed: speed.value / 10,
    })
  }

  // 更新云朵
  clouds.value = clouds.value.filter(cloud => {
    cloud.x -= cloud.speed!
    return cloud.x > -100
  })

  // 更新障碍物
  obstacles.value = obstacles.value.filter(obstacle => {
    obstacle.x -= obstacle.speed!

    // 检查碰撞
    if (
      obstacle.x < 100 &&
      obstacle.x > 20 &&
      Math.abs(planeY.value - obstacle.y) < 40
    ) {
      endGame('crashed')
      return false
    }

    return obstacle.x > -100
  })

  // 更新星星
  stars.value = stars.value.filter(star => {
    star.x -= star.speed!

    // 检查收集
    if (
      star.x < 100 &&
      star.x > 20 &&
      Math.abs(planeY.value - star.y) < 30
    ) {
      collectedStars.value++
      score.value += 50
      emit('scoreUpdate', score.value)
      ElMessage.success('+50 分！')
      return false
    }

    return star.x > -100
  })
}

// 处理输入
function handleInput() {
  const input = userInput.value.toLowerCase()
  const target = currentWord.value.toLowerCase()

  // 检查输入是否匹配
  if (input === target.substring(0, input.length)) {
    typedChars.value = input.length

    // 完成单词
    if (input === target) {
      completedWords.value++
      
      // 飞机上升
      planeY.value = Math.max(0, planeY.value - 80)

      // 加分
      const earnedScore = 20 + Math.floor(speed.value / 10)
      score.value += earnedScore
      emit('scoreUpdate', score.value)

      nextWord()
    }
  } else {
    // 输入错误，重置
    userInput.value = ''
    typedChars.value = 0
  }
}

// 结束游戏
function endGame(reason: 'crashed' | 'timeout' = 'crashed') {
  gameOver.value = true
  showResults.value = true

  if (gameLoop) {
    clearInterval(gameLoop)
    gameLoop = null
  }

  if (reason === 'crashed') {
    ElMessage.error('飞机坠毁了！')
  }

  emit('gameOver', score.value)
}

// 重新开始
function restartGame() {
  showResults.value = false
  startGame()
}

// 清理
onUnmounted(() => {
  if (gameLoop) clearInterval(gameLoop)
})
</script>

<style lang="scss" scoped>
.flight-game {
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
  }

  .game-canvas {
    position: relative;
    height: 400px;
    background: linear-gradient(180deg, #87CEEB 0%, #E0F6FF 100%);
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 20px;

    .plane {
      position: absolute;
      left: 60px;
      font-size: 50px;
      transition: top 0.1s ease-out;
      z-index: 10;
    }

    .obstacle {
      position: absolute;
      transition: left 0.05s linear;
    }

    .cloud {
      position: absolute;
      font-size: 40px;
      transition: left 0.05s linear;
    }

    .star {
      position: absolute;
      font-size: 30px;
      transition: left 0.05s linear;
      animation: sparkle 1s infinite;
    }

    .current-word-display {
      position: absolute;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      background: rgba(255, 255, 255, 0.95);
      padding: 20px 40px;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

      .word-prompt {
        font-size: 14px;
        color: #909399;
        margin-bottom: 8px;
      }

      .word-text {
        font-size: 32px;
        font-weight: 700;
        color: #303133;
        margin-bottom: 12px;
        letter-spacing: 4px;
      }

      .word-input-area {
        .char {
          display: inline-block;
          padding: 0 6px;
          font-size: 28px;
          font-weight: 600;
          color: #909399;
          transition: all 0.2s;

          &.typed {
            color: #67C23A;
            transform: scale(1.1);
          }
        }
      }
    }
  }

  .input-area {
    margin-bottom: 20px;

    :deep(.el-input__inner) {
      font-size: 20px;
      text-align: center;
    }
  }

  .game-controls {
    text-align: center;
  }

  .game-results {
    .result-header {
      text-align: center;
      margin-bottom: 24px;

      h2 {
        font-size: 32px;
        font-weight: 700;
        color: #409EFF;
        margin-top: 12px;
      }
    }

    .achievement {
      text-align: center;
      margin-top: 20px;
    }
  }
}

@keyframes sparkle {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.2) rotate(180deg); }
}
</style>
