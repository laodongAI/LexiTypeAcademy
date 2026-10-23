<!--
  地牢打字游戏
  
  在地牢冒险中用打字击败怪物
-->

<template>
  <div class="dungeon-typer-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <div class="player-info">
          <div class="info-label">勇士</div>
          <el-progress
            :percentage="playerHpPercent"
            :color="playerHpColor"
            :stroke-width="20"
          >
            <span class="hp-text">{{ playerHp }} / {{ maxPlayerHp }}</span>
          </el-progress>
        </div>

        <div class="stats">
          <el-statistic title="楼层" :value="floor" />
          <el-statistic title="击败" :value="defeated" />
          <el-statistic title="得分" :value="score" />
        </div>
      </div>

      <!-- 战斗场景 -->
      <div v-if="gameStarted && !gameOver" class="dungeon-scene">
        <!-- 玩家 -->
        <div class="player" :class="{ 'attacking': isAttacking }">
          <div class="character">🗡️</div>
          <div class="character-name">勇士</div>
        </div>

        <!-- 怪物 -->
        <div v-if="currentMonster" class="monster">
          <div class="monster-hp">
            <el-progress
              :percentage="monsterHpPercent"
              :color="'#F56C6C'"
              :stroke-width="10"
              :show-text="false"
            />
          </div>
          <div class="monster-icon">{{ currentMonster.icon }}</div>
          <div class="monster-name">{{ currentMonster.name }}</div>
          <div class="monster-word">{{ currentMonster.word }}</div>
          
          <!-- 已输入部分 -->
          <div class="typed-progress">
            <span
              v-for="(char, index) in currentMonster.word"
              :key="index"
              :class="{
                'char': true,
                'typed': index < typedLength,
                'correct': index < typedLength,
                'current': index === typedLength,
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
          placeholder="输入单词攻击怪物..."
          :disabled="!gameStarted || gameOver"
          @input="handleInput"
        />
        <div class="input-hint">完整输入单词后按回车攻击</div>
      </div>

      <!-- 战斗日志 -->
      <div v-if="gameStarted && !gameOver" class="battle-log">
        <transition-group name="log-slide">
          <div
            v-for="log in battleLogs"
            :key="log.id"
            class="log-entry"
            :class="log.type"
          >
            {{ log.message }}
          </div>
        </transition-group>
      </div>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          进入地牢
        </el-button>
        <el-button v-if="gameOver" type="success" size="large" @click="restartGame">
          <el-icon><RefreshRight /></el-icon>
          重新冒险
        </el-button>
      </div>

      <!-- 游戏结束 -->
      <el-dialog v-model="showResults" title="冒险结束" width="450px">
        <div class="game-results">
          <div class="result-header">
            <el-icon :size="70" :color="floor >= 10 ? '#67C23A' : '#F56C6C'">
              <component :is="floor >= 10 ? 'Trophy' : 'WarningFilled'" />
            </el-icon>
            <h2>{{ floor >= 10 ? '成功通关！' : '冒险失败' }}</h2>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="最终得分">{{ score }}</el-descriptions-item>
            <el-descriptions-item label="到达楼层">{{ floor }}</el-descriptions-item>
            <el-descriptions-item label="击败怪物">{{ defeated }}</el-descriptions-item>
            <el-descriptions-item label="平均速度">{{ avgSpeed }} WPM</el-descriptions-item>
          </el-descriptions>

          <div v-if="floor >= 10" class="achievement">
            <el-tag type="success" size="large" effect="dark">
              🏆 地牢征服者
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
import { ref, computed } from 'vue'
import { VideoPlay, RefreshRight, Trophy, WarningFilled } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface Monster {
  id: number
  name: string
  icon: string
  word: string
  hp: number
  maxHp: number
  attack: number
}

interface BattleLog {
  id: number
  message: string
  type: 'player' | 'monster' | 'system'
}

// 游戏状态
const gameStarted = ref(false)
const gameOver = ref(false)
const showResults = ref(false)
const inputRef = ref()
const userInput = ref('')
const isAttacking = ref(false)
const typedLength = ref(0)

// 游戏数据
const score = ref(0)
const floor = ref(1)
const defeated = ref(0)
const playerHp = ref(100)
const maxPlayerHp = ref(100)
const currentMonster = ref<Monster | null>(null)
const battleLogs = ref<BattleLog[]>([])
let logId = 1
let attackStartTime = 0
const totalAttackTime = ref(0)
const attackCount = ref(0)

// 怪物模板
const monsterTemplates = [
  { name: '史莱姆', icon: '👾', hpMultiplier: 1, attack: 5, words: ['cat', 'dog', 'run', 'jump'] },
  { name: '哥布林', icon: '👺', hpMultiplier: 1.5, attack: 8, words: ['hello', 'world', 'game', 'play'] },
  { name: '骷髅', icon: '💀', hpMultiplier: 2, attack: 12, words: ['fight', 'brave', 'sword', 'magic'] },
  { name: '恶魔', icon: '👹', hpMultiplier: 2.5, attack: 15, words: ['dragon', 'wizard', 'castle', 'dungeon'] },
  { name: '巨龙', icon: '🐉', hpMultiplier: 3, attack: 20, words: ['powerful', 'legendary', 'treasure', 'adventure'] },
]

// 计算属性
const playerHpPercent = computed(() => (playerHp.value / maxPlayerHp.value) * 100)
const playerHpColor = computed(() => {
  if (playerHpPercent.value > 60) return '#67C23A'
  if (playerHpPercent.value > 30) return '#E6A23C'
  return '#F56C6C'
})

const monsterHpPercent = computed(() => {
  if (!currentMonster.value) return 0
  return (currentMonster.value.hp / currentMonster.value.maxHp) * 100
})

const avgSpeed = computed(() => {
  if (attackCount.value === 0) return 0
  const avgTime = totalAttackTime.value / attackCount.value
  return Math.round((60 / avgTime) * 60)
})

// 添加战斗日志
function addLog(message: string, type: 'player' | 'monster' | 'system' = 'system') {
  battleLogs.value.unshift({
    id: logId++,
    message,
    type,
  })
  if (battleLogs.value.length > 5) {
    battleLogs.value.pop()
  }
}

// 开始游戏
function startGame() {
  gameStarted.value = true
  gameOver.value = false
  showResults.value = false

  score.value = 0
  floor.value = 1
  defeated.value = 0
  playerHp.value = 100
  maxPlayerHp.value = 100
  battleLogs.value = []
  totalAttackTime.value = 0
  attackCount.value = 0

  spawnMonster()
  inputRef.value?.focus()
}

// 生成怪物
function spawnMonster() {
  const templateIndex = Math.min(
    Math.floor(floor.value / 3),
    monsterTemplates.length - 1
  )
  const template = monsterTemplates[templateIndex]
  
  const word = template.words[Math.floor(Math.random() * template.words.length)]
  const hp = Math.floor(50 * template.hpMultiplier * (1 + floor.value * 0.1))

  currentMonster.value = {
    id: Date.now(),
    name: template.name,
    icon: template.icon,
    word,
    hp,
    maxHp: hp,
    attack: template.attack,
  }

  userInput.value = ''
  typedLength.value = 0
  attackStartTime = Date.now()

  addLog(`第 ${floor.value} 层：遭遇 ${template.name}！`, 'system')
}

// 处理输入
function handleInput() {
  if (!currentMonster.value) return

  const input = userInput.value.toLowerCase()
  const target = currentMonster.value.word.toLowerCase()

  // 检查输入匹配
  if (input === target.substring(0, input.length)) {
    typedLength.value = input.length

    // 完成单词，进行攻击
    if (input === target) {
      attack()
    }
  } else {
    // 输入错误
    userInput.value = ''
    typedLength.value = 0
    takeDamage(5)
    addLog('输入错误，受到反噬！', 'monster')
  }
}

// 攻击怪物
function attack() {
  if (!currentMonster.value) return

  const attackTime = (Date.now() - attackStartTime) / 1000
  totalAttackTime.value += attackTime
  attackCount.value++

  isAttacking.value = true
  setTimeout(() => {
    isAttacking.value = false
  }, 300)

  const damage = 20 + Math.floor(playerHp.value / 10)
  currentMonster.value.hp -= damage

  addLog(`你对 ${currentMonster.value.name} 造成了 ${damage} 点伤害！`, 'player')

  if (currentMonster.value.hp <= 0) {
    // 怪物被击败
    defeatMonster()
  } else {
    // 怪物反击
    monsterAttack()
  }

  userInput.value = ''
  typedLength.value = 0
  attackStartTime = Date.now()
}

// 击败怪物
function defeatMonster() {
  if (!currentMonster.value) return

  defeated.value++
  const reward = 50 + floor.value * 10
  score.value += reward

  addLog(`击败了 ${currentMonster.value.name}，获得 ${reward} 分！`, 'player')
  ElMessage.success(`+${reward} 分`)

  emit('scoreUpdate', score.value)

  // 下一层
  floor.value++
  
  if (floor.value > 10) {
    // 通关
    endGame(true)
  } else {
    setTimeout(() => {
      spawnMonster()
    }, 1000)
  }
}

// 怪物攻击
function monsterAttack() {
  if (!currentMonster.value) return

  takeDamage(currentMonster.value.attack)
  addLog(`${currentMonster.value.name} 攻击了你！`, 'monster')
}

// 受到伤害
function takeDamage(damage: number) {
  playerHp.value -= damage
  
  if (playerHp.value <= 0) {
    playerHp.value = 0
    endGame(false)
  }
}

// 结束游戏
function endGame(victory: boolean) {
  gameOver.value = true
  showResults.value = true

  if (victory) {
    ElMessage.success('成功通关地牢！')
  } else {
    ElMessage.error('你倒下了...')
  }

  emit('gameOver', score.value)
}

// 重新开始
function restartGame() {
  showResults.value = false
  startGame()
}
</script>

<style lang="scss" scoped>
.dungeon-typer-game {
  .game-card {
    max-width: 900px;
    margin: 0 auto;
  }

  .game-status {
    padding: 20px;
    background: linear-gradient(135deg, #434343 0%, #000000 100%);
    border-radius: 8px;
    margin-bottom: 20px;

    .player-info {
      margin-bottom: 16px;

      .info-label {
        color: #fff;
        font-size: 16px;
        margin-bottom: 8px;
      }

      .hp-text {
        color: #fff;
        font-weight: 600;
      }
    }

    .stats {
      display: flex;
      justify-content: space-around;

      :deep(.el-statistic__head) {
        color: rgba(255, 255, 255, 0.8);
      }

      :deep(.el-statistic__content) {
        color: #fff;
        font-size: 24px;
        font-weight: 700;
      }
    }
  }

  .dungeon-scene {
    position: relative;
    height: 300px;
    background: linear-gradient(180deg, #2c3e50 0%, #34495e 100%);
    border-radius: 8px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 60px;

    .player {
      text-align: center;
      transition: transform 0.3s;

      &.attacking {
        transform: translateX(20px);
      }

      .character {
        font-size: 80px;
        margin-bottom: 12px;
      }

      .character-name {
        color: #fff;
        font-size: 18px;
        font-weight: 600;
      }
    }

    .monster {
      text-align: center;

      .monster-hp {
        width: 200px;
        margin-bottom: 12px;
      }

      .monster-icon {
        font-size: 100px;
        margin-bottom: 12px;
        animation: float 2s ease-in-out infinite;
      }

      .monster-name {
        color: #fff;
        font-size: 20px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .monster-word {
        color: #FFD700;
        font-size: 28px;
        font-weight: 700;
        letter-spacing: 4px;
        margin-bottom: 8px;
      }

      .typed-progress {
        .char {
          display: inline-block;
          padding: 0 4px;
          font-size: 24px;
          color: rgba(255, 255, 255, 0.5);
          transition: all 0.2s;

          &.typed {
            color: #67C23A;
            transform: scale(1.2);
          }

          &.current {
            background: #409EFF;
            border-radius: 4px;
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

    .input-hint {
      text-align: center;
      color: #909399;
      font-size: 14px;
      margin-top: 8px;
    }
  }

  .battle-log {
    min-height: 150px;
    max-height: 150px;
    overflow-y: auto;
    background: #f5f7fa;
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 20px;

    .log-entry {
      padding: 8px 12px;
      margin-bottom: 4px;
      border-radius: 4px;
      font-size: 14px;
      transition: all 0.3s;

      &.player {
        background: rgba(103, 194, 58, 0.1);
        color: #67C23A;
      }

      &.monster {
        background: rgba(245, 108, 108, 0.1);
        color: #F56C6C;
      }

      &.system {
        background: rgba(64, 158, 255, 0.1);
        color: #409EFF;
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

      h2 {
        font-size: 28px;
        font-weight: 700;
        color: #303133;
        margin-top: 12px;
      }
    }

    .achievement {
      text-align: center;
      margin-top: 20px;
    }
  }
}

.log-slide-enter-active {
  transition: all 0.3s;
}

.log-slide-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
</style>
