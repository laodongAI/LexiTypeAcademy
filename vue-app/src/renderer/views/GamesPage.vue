<!--
  游戏页面
  
  趣味学习游戏
-->

<template>
  <div class="games-page">
    <h2 class="page-subtitle">选择一个游戏开始学习</h2>
    
    <el-row :gutter="24">
      <el-col 
        v-for="game in games" 
        :key="game.id" 
        :xs="24" 
        :sm="12" 
        :md="8"
      >
        <el-card 
          class="game-card" 
          shadow="hover"
          @click="startGame(game)"
        >
          <div class="game-icon">
            <el-icon :size="64">
              <component :is="game.icon" />
            </el-icon>
          </div>
          <h3 class="game-title">{{ game.title }}</h3>
          <p class="game-description">{{ game.description }}</p>
          <div class="game-meta">
            <el-tag :type="getDifficultyType(game.difficulty)">
              {{ game.difficulty }}
            </el-tag>
            <span class="best-score" v-if="game.bestScore">
              最高分: {{ game.bestScore }}
            </span>
          </div>
          <el-button type="primary" class="start-button">
            开始游戏
          </el-button>
        </el-card>
      </el-col>
    </el-row>
    
    <!-- 游戏对话框 -->
    <el-dialog 
      v-model="showGameDialog" 
      :title="currentGame?.title" 
      width="800px"
      :close-on-click-modal="false"
    >
      <div class="game-container">
        <WordChallengeGame
          v-if="currentGame?.id === 'word-challenge'"
          @gameOver="handleGameOver"
        />

        <PinyinMatchGame
          v-else-if="currentGame?.id === 'match'"
          @gameOver="(p) => handleGameOver({ score: p.score })"
        />

        <KeyboardSpeedGame
          v-else-if="currentGame?.id === 'speed'"
          @gameOver="handleGameOver"
        />

        <div v-else class="game-placeholder">
          <p>{{ currentGame?.title }} 游戏区域</p>
          <p>游戏开发中...</p>
        </div>
      </div>
      <template #footer>
        <el-button @click="showGameDialog = false">返回</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import { 
  Aim, 
  Timer, 
  Connection, 
  Grid,
  QuestionFilled,
  TrendCharts,
} from '@element-plus/icons-vue'

const KeyboardSpeedGame = defineAsyncComponent(() => import('../components/games/KeyboardSpeedGame.vue'))
const PinyinMatchGame = defineAsyncComponent(() => import('../components/games/PinyinMatchGame.vue'))
const WordChallengeGame = defineAsyncComponent(() => import('../components/games/WordChallengeGame.vue'))

// 游戏数据
interface Game {
  id: string
  title: string
  description: string
  icon: typeof Aim
  difficulty: string
  bestScore?: number
}

const games = ref<Game[]>([
  {
    id: 'word-challenge',
    title: '单词挑战',
    description: '60 秒内正确输入尽可能多的单词',
    icon: TrendCharts,
    difficulty: '中等',
  },
  {
    id: 'match',
    title: '汉字配对',
    description: '将汉字与正确的拼音配对，锻炼记忆力',
    icon: Connection,
    difficulty: '简单',
    bestScore: 1200,
  },
  {
    id: 'speed',
    title: '速度挑战',
    description: '在限定时间内输入尽可能多的汉字',
    icon: Timer,
    difficulty: '中等',
    bestScore: 850,
  },
  {
    id: 'aim',
    title: '打靶游戏',
    description: '点击正确的汉字目标',
    icon: Aim,
    difficulty: '简单',
  },
  {
    id: 'puzzle',
    title: '汉字拼图',
    description: '将汉字笔画拼成完整的字',
    icon: Grid,
    difficulty: '困难',
  },
  {
    id: 'quiz',
    title: '知识问答',
    description: '测试你的汉字知识',
    icon: QuestionFilled,
    difficulty: '中等',
    bestScore: 950,
  },
  {
    id: 'chart',
    title: '成语接龙',
    description: '根据提示接续成语',
    icon: TrendCharts,
    difficulty: '困难',
  },
])

// 当前游戏
const currentGame = ref<Game | null>(null)

// 游戏对话框
const showGameDialog = ref(false)

// 获取难度标签类型
function getDifficultyType(difficulty: string) {
  const types: Record<string, '' | 'success' | 'warning' | 'danger' | 'info'> = {
    '简单': 'success',
    '中等': 'warning',
    '困难': 'danger',
  }
  return types[difficulty] || 'info'
}

// 开始游戏
function startGame(game: Game) {
  currentGame.value = game
  showGameDialog.value = true
}

function handleGameOver(payload: { score: number }) {
  if (!currentGame.value) return

  // 只更新本次实现的游戏分数
  const idx = games.value.findIndex(g => g.id === currentGame.value?.id)
  if (idx >= 0) {
    const best = games.value[idx].bestScore || 0
    if (payload.score > best) {
      games.value[idx] = {
        ...games.value[idx],
        bestScore: payload.score,
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.games-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-subtitle {
  margin: 0 0 24px 0;
  color: var(--text-color-secondary);
  font-weight: 400;
}

.game-card {
  cursor: pointer;
  transition: transform 0.2s;
  margin-bottom: 24px;
  text-align: center;
  
  &:hover {
    transform: translateY(-8px);
  }
  
  :deep(.el-card__body) {
    padding: 32px 24px;
  }
}

.game-icon {
  margin-bottom: 16px;
  color: var(--primary-color);
}

.game-title {
  margin: 0 0 12px 0;
  font-size: 20px;
  color: var(--text-color);
}

.game-description {
  margin: 0 0 16px 0;
  font-size: 14px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.game-meta {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
  
  .best-score {
    font-size: 12px;
    color: var(--text-color-placeholder);
  }
}

.start-button {
  width: 100%;
}

.game-container {
  min-height: 400px;
}

.game-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 400px;
  color: var(--text-color-placeholder);
  font-size: 18px;
  
  p {
    margin: 8px 0;
  }
}
</style>
