<!--
  游戏中心页面
  
  展示所有可用的学习游戏，支持选择进入具体游戏
-->

<template>
  <div class="game-center-page">
    <!-- 游戏选择模式 -->
    <div v-if="!selectedGame" class="games-grid">
      <el-card
        v-for="game in games"
        :key="game.id"
        :body-style="{ padding: '30px' }"
        shadow="hover"
        class="game-card"
        :class="game.color"
        @click="selectGame(game.id)"
      >
        <div class="game-card-content">
          <div class="game-icon">{{ game.icon }}</div>
          <h3 class="game-title">{{ game.title }}</h3>
          <p class="game-description">{{ game.description }}</p>
          <div class="game-stats">
            <el-tag size="small" type="info">{{ game.difficulty }}</el-tag>
            <el-tag size="small">{{ game.type }}</el-tag>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 游戏运行模式 -->
    <div v-else class="game-container">
      <div class="game-header">
        <el-button @click="exitGame">
          <el-icon><Back /></el-icon>
          返回游戏中心
        </el-button>
        <h2 class="game-name">{{ currentGame?.title }}</h2>
        <div class="game-score">
          <el-statistic title="得分" :value="gameScore" />
        </div>
      </div>

      <!-- 动态加载游戏组件 -->
      <component
        :is="currentGameComponent"
        @score-update="updateScore"
        @game-over="handleGameOver"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, markRaw, type Component } from 'vue'
import { Back } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import * as TypingRacerGameModule from './games/TypingRacerGame.vue'
import * as WordChallengeGameModule from './games/WordChallengeGame.vue'
import * as ComboGameModule from './games/ComboGame.vue'
import * as FlightGameModule from './games/FlightGame.vue'
import * as WordFarmModule from './games/WordFarm.vue'
import * as DungeonTyperModule from './games/DungeonTyper.vue'
import * as RhythmKeyModule from './games/RhythmKey.vue'

const TypingRacerGame = (TypingRacerGameModule as unknown as { default: Component }).default
const WordChallengeGame = (WordChallengeGameModule as unknown as { default: Component }).default
const ComboGame = (ComboGameModule as unknown as { default: Component }).default
const FlightGame = (FlightGameModule as unknown as { default: Component }).default
const WordFarm = (WordFarmModule as unknown as { default: Component }).default
const DungeonTyper = (DungeonTyperModule as unknown as { default: Component }).default
const RhythmKey = (RhythmKeyModule as unknown as { default: Component }).default

// 游戏列表定义
interface GameInfo {
  id: string
  icon: string
  title: string
  description: string
  difficulty: string
  type: string
  color: string
  component: any
}

const games = ref<GameInfo[]>([
  {
    id: 'typing-racer',
    icon: '🏎️',
    title: '打字赛车',
    description: '在赛车竞速中提升打字速度和准确率',
    difficulty: '简单',
    type: '速度练习',
    color: 'game-card-blue',
    component: markRaw(TypingRacerGame),
  },
  {
    id: 'word-challenge',
    icon: '🎯',
    title: '单词挑战',
    description: '快速记忆和拼写单词，挑战你的词汇量',
    difficulty: '中等',
    type: '词汇练习',
    color: 'game-card-green',
    component: markRaw(WordChallengeGame),
  },
  {
    id: 'combo-game',
    icon: '⚡',
    title: '连击大师',
    description: '连续正确输入获得高分连击奖励',
    difficulty: '困难',
    type: '综合练习',
    color: 'game-card-orange',
    component: markRaw(ComboGame),
  },
  {
    id: 'flight-game',
    icon: '✈️',
    title: '飞行冒险',
    description: '驾驶飞机躲避障碍，同时完成单词输入',
    difficulty: '中等',
    type: '反应练习',
    color: 'game-card-purple',
    component: markRaw(FlightGame),
  },
  {
    id: 'word-farm',
    icon: '🌾',
    title: '单词农场',
    description: '种植单词收获知识，经营你的学习农场',
    difficulty: '简单',
    type: '休闲练习',
    color: 'game-card-yellow',
    component: markRaw(WordFarm),
  },
  {
    id: 'dungeon-typer',
    icon: '⚔️',
    title: '地牢打字',
    description: '在地牢冒险中用打字击败怪物',
    difficulty: '困难',
    type: '冒险练习',
    color: 'game-card-red',
    component: markRaw(DungeonTyper),
  },
  {
    id: 'rhythm-key',
    icon: '🎵',
    title: '节奏键盘',
    description: '跟随音乐节奏输入单词，体验韵律美',
    difficulty: '中等',
    type: '音乐练习',
    color: 'game-card-pink',
    component: markRaw(RhythmKey),
  },
])

const selectedGame = ref<string | null>(null)
const gameScore = ref(0)

// 当前游戏信息
const currentGame = computed(() => {
  return games.value.find(g => g.id === selectedGame.value)
})

// 当前游戏组件
const currentGameComponent = computed(() => {
  return currentGame.value?.component
})

// 选择游戏
function selectGame(gameId: string) {
  const game = games.value.find(g => g.id === gameId)
  
  if (!game?.component) {
    ElMessage.info('该游戏正在开发中，敬请期待')
    return
  }
  
  selectedGame.value = gameId
  gameScore.value = 0
}

// 退出游戏
function exitGame() {
  selectedGame.value = null
  gameScore.value = 0
}

// 更新分数
function updateScore(score: number) {
  gameScore.value = score
}

// 游戏结束
function handleGameOver(finalScore: number) {
  ElMessage.success(`游戏结束！最终得分：${finalScore}`)
  // TODO: 记录游戏成绩到数据库
}
</script>

<style lang="scss" scoped>
.game-center-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
  min-height: calc(100vh - 60px);
}

.page-header {
  margin-bottom: 30px;
}

.games-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
  
  .game-card {
    cursor: pointer;
    transition: all 0.3s;
    border: 2px solid transparent;
    
    &:hover {
      transform: translateY(-8px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    }
    
    .game-card-content {
      text-align: center;
      
      .game-icon {
        font-size: 60px;
        margin-bottom: 16px;
      }
      
      .game-title {
        font-size: 20px;
        font-weight: 600;
        margin: 12px 0;
        color: #303133;
      }
      
      .game-description {
        color: #606266;
        line-height: 1.6;
        margin: 12px 0;
        min-height: 48px;
      }
      
      .game-stats {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin-top: 16px;
      }
    }
    
    // 不同颜色主题
    &.game-card-blue { border-color: #409EFF; }
    &.game-card-green { border-color: #67C23A; }
    &.game-card-orange { border-color: #E6A23C; }
    &.game-card-purple { border-color: #9B59B6; }
    &.game-card-yellow { border-color: #F1C40F; }
    &.game-card-red { border-color: #F56C6C; }
    &.game-card-pink { border-color: #EC407A; }
  }
}

.game-container {
  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    padding: 16px;
    background: #f5f7fa;
    border-radius: 8px;
    
    .game-name {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
  }
}
</style>
