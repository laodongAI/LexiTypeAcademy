<!--
  单词农场游戏
  
  种植单词收获知识，经营你的学习农场
-->

<template>
  <div class="word-farm-game">
    <el-card class="game-card">
      <!-- 游戏状态 -->
      <div class="game-status">
        <div class="status-item">
          <el-icon :size="24" color="#FFD700"><Coin /></el-icon>
          <span class="value">{{ coins }}</span>
        </div>
        <div class="status-item">
          <el-icon :size="24" color="#67C23A"><GoodsFilled /></el-icon>
          <span class="value">{{ harvested }}</span>
        </div>
        <div class="status-item">
          <el-icon :size="24" color="#409EFF"><Trophy /></el-icon>
          <span class="value">{{ level }}</span>
        </div>
      </div>

      <!-- 农场网格 -->
      <div v-if="gameStarted" class="farm-grid">
        <div
          v-for="(plot, index) in plots"
          :key="index"
          class="plot"
          :class="{ 'has-plant': plot.word, 'can-harvest': plot.stage === 3 }"
          @click="handlePlotClick(index)"
        >
          <div v-if="!plot.word" class="empty-plot">
            <el-icon :size="40" color="#909399"><Plus /></el-icon>
            <div class="plot-hint">种植</div>
          </div>
          <div v-else class="plant">
            <div class="plant-icon">{{ getPlantIcon(plot.stage) }}</div>
            <div class="plant-word">{{ plot.word }}</div>
            <el-progress
              v-if="plot.stage < 3"
              :percentage="plot.progress"
              :show-text="false"
              :stroke-width="4"
              :color="'#67C23A'"
            />
            <el-button
              v-if="plot.stage === 3"
              type="success"
              size="small"
              @click.stop="harvest(index)"
            >
              收获
            </el-button>
          </div>
        </div>
      </div>

      <!-- 种植对话框 -->
      <el-dialog v-model="showPlantDialog" title="种植单词" width="500px">
        <div class="plant-dialog">
          <el-alert
            title="输入一个单词来种植"
            type="info"
            :closable="false"
            style="margin-bottom: 20px"
          />

          <el-input
            v-model="plantInput"
            ref="plantInputRef"
            size="large"
            placeholder="输入英文单词..."
            @keyup.enter="confirmPlant"
          >
            <template #prepend>
              <el-icon><Edit /></el-icon>
            </template>
          </el-input>

          <div class="word-suggestions">
            <el-tag
              v-for="word in wordSuggestions"
              :key="word"
              @click="plantInput = word"
              style="cursor: pointer; margin: 4px"
            >
              {{ word }}
            </el-tag>
          </div>
        </div>

        <template #footer>
          <el-button @click="showPlantDialog = false">取消</el-button>
          <el-button type="primary" @click="confirmPlant">种植</el-button>
        </template>
      </el-dialog>

      <!-- 商店对话框 -->
      <div class="shop-button">
        <el-button type="warning" @click="showShop = true">
          <el-icon><ShoppingCart /></el-icon>
          商店
        </el-button>
      </div>

      <el-dialog v-model="showShop" title="农场商店" width="600px">
        <div class="shop-items">
          <el-card
            v-for="item in shopItems"
            :key="item.id"
            :body-style="{ padding: '20px' }"
            shadow="hover"
            class="shop-item"
          >
            <div class="item-icon">{{ item.icon }}</div>
            <div class="item-name">{{ item.name }}</div>
            <div class="item-description">{{ item.description }}</div>
            <div class="item-price">
              <el-icon color="#FFD700"><Coin /></el-icon>
              {{ item.price }}
            </div>
            <el-button
              type="primary"
              size="small"
              :disabled="coins < item.price"
              @click="buyItem(item)"
            >
              购买
            </el-button>
          </el-card>
        </div>
      </el-dialog>

      <!-- 游戏控制 -->
      <div class="game-controls">
        <el-button v-if="!gameStarted" type="primary" size="large" @click="startGame">
          <el-icon><VideoPlay /></el-icon>
          开始经营
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  Plus,
  Edit,
  Coin,
  GoodsFilled,
  Trophy,
  ShoppingCart,
  VideoPlay,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

const emit = defineEmits<{
  scoreUpdate: [score: number]
  gameOver: [score: number]
}>()

interface Plot {
  word: string | null
  stage: number // 0: 空地, 1: 种子, 2: 生长中, 3: 成熟
  progress: number
  plantedAt: number
}

interface ShopItem {
  id: string
  name: string
  description: string
  icon: string
  price: number
  effect: () => void
}

// 游戏状态
const gameStarted = ref(false)
const showPlantDialog = ref(false)
const showShop = ref(false)
const plantInputRef = ref()
const plantInput = ref('')
const selectedPlotIndex = ref(-1)

// 游戏数据
const coins = ref(100)
const harvested = ref(0)
const level = ref(1)
const plots = ref<Plot[]>(
  Array(9).fill(null).map(() => ({
    word: null,
    stage: 0,
    progress: 0,
    plantedAt: 0,
  }))
)

// 单词建议
const wordSuggestions = ref([
  'apple', 'banana', 'carrot', 'tomato', 'potato',
  'flower', 'tree', 'grass', 'rose', 'tulip',
])

// 商店物品
const shopItems = ref<ShopItem[]>([
  {
    id: 'fertilizer',
    name: '肥料',
    description: '加速所有植物生长',
    icon: '🌿',
    price: 50,
    effect: () => {
      plots.value.forEach(plot => {
        if (plot.word && plot.stage < 3) {
          plot.progress = Math.min(100, plot.progress + 30)
          checkGrowth(plot)
        }
      })
      ElMessage.success('使用了肥料，所有植物生长加速！')
    },
  },
  {
    id: 'water',
    name: '水桶',
    description: '立即成熟一个植物',
    icon: '💧',
    price: 80,
    effect: () => {
      const growingPlot = plots.value.find(p => p.word && p.stage < 3)
      if (growingPlot) {
        growingPlot.stage = 3
        growingPlot.progress = 100
        ElMessage.success('一个植物立即成熟了！')
      } else {
        ElMessage.warning('没有正在生长的植物')
      }
    },
  },
  {
    id: 'expand',
    name: '扩展土地',
    description: '增加3块土地',
    icon: '🏞️',
    price: 200,
    effect: () => {
      for (let i = 0; i < 3; i++) {
        plots.value.push({
          word: null,
          stage: 0,
          progress: 0,
          plantedAt: 0,
        })
      }
      ElMessage.success('农场扩建了3块土地！')
    },
  },
])

// 获取植物图标
function getPlantIcon(stage: number): string {
  switch (stage) {
    case 1: return '🌱'
    case 2: return '🌿'
    case 3: return '🌻'
    default: return ''
  }
}

// 开始游戏
function startGame() {
  gameStarted.value = true
  startGrowthCycle()
}

// 启动生长周期
function startGrowthCycle() {
  setInterval(() => {
    plots.value.forEach(plot => {
      if (plot.word && plot.stage < 3) {
        plot.progress += 2
        checkGrowth(plot)
      }
    })
  }, 1000)
}

// 检查生长
function checkGrowth(plot: Plot) {
  if (plot.progress >= 33 && plot.stage === 1) {
    plot.stage = 2
  } else if (plot.progress >= 66 && plot.stage === 2) {
    plot.stage = 3
    ElMessage.success('有植物成熟了！')
  }
}

// 处理土地点击
function handlePlotClick(index: number) {
  const plot = plots.value[index]
  
  if (!plot.word) {
    // 空地，打开种植对话框
    selectedPlotIndex.value = index
    showPlantDialog.value = true
    plantInput.value = ''
    setTimeout(() => plantInputRef.value?.focus(), 100)
  }
}

// 确认种植
function confirmPlant() {
  const word = plantInput.value.trim().toLowerCase()
  
  if (!word) {
    ElMessage.warning('请输入单词')
    return
  }

  if (word.length < 3) {
    ElMessage.warning('单词至少3个字母')
    return
  }

  if (coins.value < 10) {
    ElMessage.error('金币不足（需要10金币）')
    return
  }

  const plot = plots.value[selectedPlotIndex.value]
  plot.word = word
  plot.stage = 1
  plot.progress = 0
  plot.plantedAt = Date.now()

  coins.value -= 10
  showPlantDialog.value = false
  
  ElMessage.success(`种下了 "${word}"`)
  emit('scoreUpdate', coins.value)
}

// 收获
function harvest(index: number) {
  const plot = plots.value[index]
  
  if (plot.stage !== 3) return

  const wordLength = plot.word!.length
  const reward = 20 + wordLength * 5

  coins.value += reward
  harvested.value++

  // 升级检查
  if (harvested.value % 5 === 0) {
    level.value++
    ElMessage.success(`升级到 Lv.${level.value}！`)
  }

  ElMessage.success(`收获了 "${plot.word}"，获得 ${reward} 金币`)

  // 重置土地
  plot.word = null
  plot.stage = 0
  plot.progress = 0

  emit('scoreUpdate', coins.value)
}

// 购买物品
function buyItem(item: ShopItem) {
  if (coins.value < item.price) {
    ElMessage.error('金币不足')
    return
  }

  coins.value -= item.price
  item.effect()
  emit('scoreUpdate', coins.value)
}
</script>

<style lang="scss" scoped>
.word-farm-game {
  .game-card {
    max-width: 900px;
    margin: 0 auto;
  }

  .game-status {
    display: flex;
    justify-content: center;
    gap: 40px;
    padding: 20px;
    background: linear-gradient(135deg, #a8e063 0%, #56ab2f 100%);
    border-radius: 8px;
    margin-bottom: 20px;

    .status-item {
      display: flex;
      align-items: center;
      gap: 8px;

      .value {
        font-size: 28px;
        font-weight: 700;
        color: #fff;
      }
    }
  }

  .farm-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    padding: 20px;
    background: #f5f7fa;
    border-radius: 8px;
    margin-bottom: 20px;

    .plot {
      aspect-ratio: 1;
      background: #e4e7ed;
      border: 3px solid #dcdfe6;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.3s;

      &:hover {
        border-color: #409EFF;
        transform: scale(1.05);
      }

      &.can-harvest {
        border-color: #67C23A;
        animation: glow 2s infinite;
      }

      .empty-plot {
        text-align: center;
        color: #909399;

        .plot-hint {
          font-size: 14px;
          margin-top: 8px;
        }
      }

      .plant {
        text-align: center;
        width: 100%;
        padding: 12px;

        .plant-icon {
          font-size: 50px;
          margin-bottom: 8px;
        }

        .plant-word {
          font-size: 16px;
          font-weight: 600;
          color: #303133;
          margin-bottom: 8px;
        }
      }
    }
  }

  .plant-dialog {
    .word-suggestions {
      margin-top: 16px;
    }
  }

  .shop-button {
    text-align: center;
    margin-bottom: 20px;
  }

  .shop-items {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;

    .shop-item {
      text-align: center;

      .item-icon {
        font-size: 50px;
        margin-bottom: 12px;
      }

      .item-name {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 8px;
      }

      .item-description {
        font-size: 14px;
        color: #606266;
        margin-bottom: 12px;
        min-height: 40px;
      }

      .item-price {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        font-size: 20px;
        font-weight: 600;
        color: #FFD700;
        margin-bottom: 12px;
      }
    }
  }

  .game-controls {
    text-align: center;
  }
}

@keyframes glow {
  0%, 100% {
    box-shadow: 0 0 10px rgba(103, 194, 58, 0.5);
  }
  50% {
    box-shadow: 0 0 20px rgba(103, 194, 58, 0.8);
  }
}
</style>
