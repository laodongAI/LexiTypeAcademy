<!--
  单词挑战游戏
  
  快速记忆和拼写单词，挑战你的词汇量
-->

<template>
  <div class="word-challenge-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <el-statistic title="等级" :value="level" prefix="Lv." />
        <el-statistic title="连击" :value="combo" suffix="x" />
        <el-statistic title="生命" :value="lives">
          <template #suffix>
            <span class="lives-hearts">
              <span v-for="i in 3" :key="i" :class="{ 'lost': i > lives }">❤️</span>
            </span>
          </template>
        </el-statistic>
        <div class="countdown">
          <el-progress
            :percentage="timePercentage"
            :color="timePercentage > 30 ? '#67C23A' : '#F56C6C'"
            :show-text="false"
          />
          <span class="time-text">{{ timeLeft }}s</span>
        </div>
      </div>

      <!-- 单词展示区 -->
      <div v-if="gameStarted && !gameOver" class="word-display">
        <!-- 单词卡片 -->
        <transition name="flip">
          <div v-if="showWord" class="word-card" :key="currentChallenge?.id">
            <div class="word-side">
              <div class="word-chinese">{{ currentChallenge?.chinese }}</div>
              <div class="word-hint">请拼写这个单词</div>
              <div v-if="showHint" class="word-phonetic">{{ currentChallenge?.phonetic }}</div>
            </div>
          </div>
        </transition>
        
        <!-- 输入区域 -->
        <div class="input-area">
          <el-input
            v-model="userInput"
            ref="inputRef"
            size="large"
            placeholder="输入英文单词..."
            :disabled="!gameStarted || gameOver"
            @keyup.enter="checkAnswer"
          >
            <template #append>
              <el-button @click="checkAnswer" type="primary">提交</el-button>
            </template>
          </el-input>
        </div>
        
        <!-- 提示按钮 -->
        <div class="actions">
          <el-button @click="useHint" :disabled="hintUsed || !gameStarted">
            <el-icon><View /></el-icon>
            查看音标 (-10分)
          </el-button>
          <el-button @click="skipWord" :disabled="!gameStarted">
            <el-icon><DArrowRight /></el-icon>
            跳过 (-1生命)
          </el-button>
        </div>
        
        <!-- 答案反馈 -->
        <transition name="fade">
          <div v-if="showFeedback" class="feedback" :class="feedbackType">
            <el-icon v-if="feedbackType === 'correct'" :size="60"><SuccessFilled /></el-icon>
            <el-icon v-else :size="60"><CircleCloseFilled /></el-icon>
            <p>{{ feedbackMessage }}</p>
          </div>
        </transition>
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          开始挑战
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          重新挑战
        </el-button>
      </div>

      <!-- 游戏结束对话框 -->
      <el-dialog v-model="showResults" title="挑战结束" width="500px">
        <div class="game-results">
          <div class="result-header">
            <el-icon :size="80" color="#409EFF"><Medal /></el-icon>
            <h2>挑战完成！</h2>
          </div>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="最终得分" :span="2">
              <span class="final-score">{{ score }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="达到等级">Lv.{{ level }}</el-descriptions-item>
            <el-descriptions-item label="最高连击">{{ maxCombo }}x</el-descriptions-item>
            <el-descriptions-item label="正确单词">{{ correctCount }}</el-descriptions-item>
            <el-descriptions-item label="错误单词">{{ wrongCount }}</el-descriptions-item>
            <el-descriptions-item label="准确率" :span="2">
              {{ accuracy.toFixed(1) }}%
            </el-descriptions-item>
          </el-descriptions>
          
          <div class="achievements">
            <h3>成就徽章</h3>
            <div class="badges">
              <el-tag v-if="maxCombo >= 10" type="success" size="large">连击高手 🔥</el-tag>
              <el-tag v-if="accuracy >= 90" type="warning" size="large">精准射手 🎯</el-tag>
              <el-tag v-if="level >= 5" type="danger" size="large">词汇大师 📚</el-tag>
            </div>
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
import {
  VideoPlay,
  RefreshRight,
  View,
  DArrowRight,
  SuccessFilled,
  CircleCloseFilled,
  Medal,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface WordChallenge {
  id: number
  english: string
  chinese: string
  phonetic: string
  difficulty: number
}

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)

// 输入和显示
const inputRef = ref()
const userInput = ref('')
const showWord = ref(false)
const currentChallenge = ref<WordChallenge | null>(null)

// 游戏数据
const score = ref(0)
const level = ref(1)
const combo = ref(0)
const maxCombo = ref(0)
const lives = ref(3)
const correctCount = ref(0)
const wrongCount = ref(0)
const timeLeft = ref(15)
const timePerLevel = ref(15)
const showHint = ref(false)
const hintUsed = ref(false)

// 反馈
const showFeedback = ref(false)
const feedbackType = ref<'correct' | 'wrong'>('correct')
const feedbackMessage = ref('')

// 定时器
let countdownTimer: number | null = null

// 单词库（按难度分级）
const wordBank: WordChallenge[] = [
  // Level 1: 简单
  { id: 1, english: 'apple', chinese: '苹果', phonetic: '/ˈæpl/', difficulty: 1 },
  { id: 2, english: 'book', chinese: '书', phonetic: '/bʊk/', difficulty: 1 },
  { id: 3, english: 'cat', chinese: '猫', phonetic: '/kæt/', difficulty: 1 },
  { id: 4, english: 'dog', chinese: '狗', phonetic: '/dɔːɡ/', difficulty: 1 },
  { id: 5, english: 'egg', chinese: '鸡蛋', phonetic: '/eɡ/', difficulty: 1 },
  
  // Level 2: 中等
  { id: 6, english: 'banana', chinese: '香蕉', phonetic: '/bəˈnɑːnə/', difficulty: 2 },
  { id: 7, english: 'computer', chinese: '电脑', phonetic: '/kəmˈpjuːtər/', difficulty: 2 },
  { id: 8, english: 'elephant', chinese: '大象', phonetic: '/ˈelɪfənt/', difficulty: 2 },
  { id: 9, english: 'guitar', chinese: '吉他', phonetic: '/ɡɪˈtɑːr/', difficulty: 2 },
  { id: 10, english: 'happiness', chinese: '幸福', phonetic: '/ˈhæpinəs/', difficulty: 2 },
  
  // Level 3: 困难
  { id: 11, english: 'beautiful', chinese: '美丽的', phonetic: '/ˈbjuːtɪfl/', difficulty: 3 },
  { id: 12, english: 'challenge', chinese: '挑战', phonetic: '/ˈtʃælɪndʒ/', difficulty: 3 },
  { id: 13, english: 'education', chinese: '教育', phonetic: '/ˌedʒuˈkeɪʃn/', difficulty: 3 },
  { id: 14, english: 'important', chinese: '重要的', phonetic: '/ɪmˈpɔːrtnt/', difficulty: 3 },
  { id: 15, english: 'knowledge', chinese: '知识', phonetic: '/ˈnɑːlɪdʒ/', difficulty: 3 },
  
  // Level 4: 更难
  { id: 16, english: 'extraordinary', chinese: '非凡的', phonetic: '/ɪkˈstrɔːrdneri/', difficulty: 4 },
  { id: 17, english: 'magnificent', chinese: '壮丽的', phonetic: '/mæɡˈnɪfɪsnt/', difficulty: 4 },
  { id: 18, english: 'opportunity', chinese: '机会', phonetic: '/ˌɑːpərˈtuːnəti/', difficulty: 4 },
  { id: 19, english: 'responsibility', chinese: '责任', phonetic: '/rɪˌspɑːnsəˈbɪləti/', difficulty: 4 },
  { id: 20, english: 'understand', chinese: '理解', phonetic: '/ˌʌndərˈstænd/', difficulty: 4 },
]

const usedWords = ref<Set<number>>(new Set())

// 计算属性
const timePercentage = computed(() => (timeLeft.value / timePerLevel.value) * 100)

const accuracy = computed(() => {
  const total = correctCount.value + wrongCount.value
  if (total === 0) return 100
  return (correctCount.value / total) * 100
})

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false
  
  score.value = 0
  level.value = 1
  combo.value = 0
  maxCombo.value = 0
  lives.value = 3
  correctCount.value = 0
  wrongCount.value = 0
  usedWords.value.clear()
  
  nextChallenge()
}

// 下一个挑战
function nextChallenge() {
  showWord.value = false
  showHint.value = false
  hintUsed.value = false
  userInput.value = ''
  
  // 根据等级选择单词
  const availableWords = wordBank.filter(
    w => w.difficulty <= Math.min(level.value, 4) && !usedWords.value.has(w.id)
  )
  
  if (availableWords.length === 0) {
    // 所有单词用完，重置
    usedWords.value.clear()
    level.value++
    timePerLevel.value = Math.max(10, timePerLevel.value - 1)
    ElMessage.success(`升级到 Lv.${level.value}！`)
  }
  
  const randomIndex = Math.floor(Math.random() * availableWords.length)
  currentChallenge.value = availableWords[randomIndex]
  usedWords.value.add(currentChallenge.value.id)
  
  // 重置倒计时
  timeLeft.value = timePerLevel.value
  
  setTimeout(() => {
    showWord.value = true
    inputRef.value?.focus()
    startCountdown()
  }, 300)
}

// 启动倒计时
function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer)
  
  countdownTimer = window.setInterval(() => {
    timeLeft.value--
    
    if (timeLeft.value <= 0) {
      handleTimeout()
    }
  }, 1000)
}

// 超时处理
function handleTimeout() {
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  
  wrongAnswer('超时了！')
}

// 使用提示
function useHint() {
  showHint.value = true
  hintUsed.value = true
  score.value = Math.max(0, score.value - 10)
  emit('scoreUpdate', score.value)
}

// 跳过单词
function skipWord() {
  lives.value--
  combo.value = 0
  
  if (lives.value <= 0) {
    endGame()
  } else {
    ElMessage.warning('跳过了一个单词')
    nextChallenge()
  }
}

// 检查答案
function checkAnswer() {
  if (!currentChallenge.value || !userInput.value.trim()) return
  
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  
  const correct = userInput.value.trim().toLowerCase() === currentChallenge.value.english.toLowerCase()
  
  if (correct) {
    correctAnswer()
  } else {
    wrongAnswer(`正确答案是: ${currentChallenge.value.english}`)
  }
}

// 正确答案
function correctAnswer() {
  correctCount.value++
  combo.value++
  maxCombo.value = Math.max(maxCombo.value, combo.value)
  
  // 计算得分（基础分 + 连击加成 + 时间加成 - 提示扣分）
  const baseScore = 10 * level.value
  const comboBonus = Math.min(combo.value * 2, 50)
  const timeBonus = Math.floor(timeLeft.value / 2)
  const earnedScore = baseScore + comboBonus + timeBonus
  
  score.value += earnedScore
  emit('scoreUpdate', score.value)
  
  feedbackType.value = 'correct'
  feedbackMessage.value = `+${earnedScore} 分！${combo.value > 1 ? `${combo.value}连击！` : ''}`
  showFeedback.value = true
  
  setTimeout(() => {
    showFeedback.value = false
    
    // 每5个正确升级
    if (correctCount.value % 5 === 0) {
      level.value++
      timePerLevel.value = Math.max(10, timePerLevel.value - 1)
      ElMessage.success(`升级到 Lv.${level.value}！`)
    }
    
    nextChallenge()
  }, 1500)
}

// 错误答案
function wrongAnswer(message: string) {
  wrongCount.value++
  combo.value = 0
  lives.value--
  
  feedbackType.value = 'wrong'
  feedbackMessage.value = message
  showFeedback.value = true
  
  if (lives.value <= 0) {
    setTimeout(() => {
      endGame()
    }, 1500)
  } else {
    setTimeout(() => {
      showFeedback.value = false
      nextChallenge()
    }, 1500)
  }
}

// 结束游戏
function endGame() {
  gameOver.value = true
  showResults.value = true
  
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
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
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<style lang="scss" scoped>
.word-challenge-game {
  .game-card {
    max-width: 800px;
    margin: 0 auto;
  }
  
  .game-status {
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 20px;
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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
    
    .lives-hearts {
      display: flex;
      gap: 4px;
      font-size: 24px;
      
      span {
        transition: all 0.3s;
        
        &.lost {
          opacity: 0.3;
          filter: grayscale(1);
        }
      }
    }
    
    .countdown {
      width: 150px;
      
      .time-text {
        display: block;
        text-align: center;
        color: #fff;
        font-size: 18px;
        font-weight: 600;
        margin-top: 8px;
      }
    }
  }
  
  .word-display {
    min-height: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 30px;
    
    .word-card {
      width: 100%;
      max-width: 500px;
      padding: 60px 40px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 16px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
      
      .word-side {
        text-align: center;
        color: #fff;
        
        .word-chinese {
          font-size: 48px;
          font-weight: 700;
          margin-bottom: 20px;
        }
        
        .word-hint {
          font-size: 18px;
          opacity: 0.9;
          margin-bottom: 16px;
        }
        
        .word-phonetic {
          font-size: 24px;
          font-style: italic;
          opacity: 0.8;
          animation: fadeIn 0.5s;
        }
      }
    }
    
    .input-area {
      width: 100%;
      max-width: 500px;
      
      :deep(.el-input__inner) {
        font-size: 20px;
        text-align: center;
      }
    }
    
    .actions {
      display: flex;
      gap: 16px;
    }
    
    .feedback {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 40px 60px;
      background: #fff;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      text-align: center;
      z-index: 1000;
      
      p {
        font-size: 24px;
        font-weight: 600;
        margin-top: 16px;
      }
      
      &.correct {
        color: #67C23A;
      }
      
      &.wrong {
        color: #F56C6C;
      }
    }
  }
  
  .game-controls {
    text-align: center;
    margin-top: 30px;
  }
  
  .game-results {
    .result-header {
      text-align: center;
      margin-bottom: 30px;
      
      h2 {
        margin-top: 16px;
        font-size: 28px;
        color: #303133;
      }
    }
    
    .final-score {
      font-size: 32px;
      font-weight: 700;
      color: #409EFF;
    }
    
    .achievements {
      margin-top: 30px;
      text-align: center;
      
      h3 {
        margin-bottom: 16px;
        color: #606266;
      }
      
      .badges {
        display: flex;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }
    }
  }
}

// 动画
.flip-enter-active,
.flip-leave-active {
  transition: all 0.5s;
}

.flip-enter-from {
  opacity: 0;
  transform: rotateY(90deg);
}

.flip-leave-to {
  opacity: 0;
  transform: rotateY(-90deg);
}

.fade-enter-active,
.fade-leave-active {
  transition: all 0.3s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 0.8;
    transform: translateY(0);
  }
}
</style>
