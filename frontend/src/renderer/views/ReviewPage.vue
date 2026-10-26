<!--
  复习页面
  
  使用间隔重复算法进行复习
-->

<template>
  <div class="review-page">
    <el-alert
      v-if="errorText"
      :title="errorText"
      type="error"
      :closable="true"
      show-icon
      class="error-alert"
      @close="errorText = ''"
    />
    <!-- 复习统计 -->
    <el-row :gutter="24" class="filter-row">
      <el-col :span="24">
        <el-card class="filter-card">
          <div class="filter-content">
            <span class="filter-label">来源：</span>
            <el-select v-model="sourceFilter" placeholder="全部" style="min-width: 240px" @change="loadReviewItems">
              <el-option label="全部" value="" />
              <el-option v-for="s in sourceOptions" :key="s" :label="s" :value="s" />
            </el-select>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="24" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="待复习" :value="pendingCount" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="今日已复习" :value="todayReviewed" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="总单词" :value="totalWords" />
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <el-statistic title="正确率" :value="accuracy" suffix="%" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 弱词列表 -->
    <el-card class="weak-words-card" v-loading="loadingWeakWords">
      <template #header>
        <div class="weak-words-header">
          <span>弱词（Top 10）</span>
          <el-button size="small" @click="loadWeakWords">刷新</el-button>
        </div>
      </template>
      <el-table :data="weakWords" size="small" style="width: 100%">
        <el-table-column prop="word" label="单词" width="180" />
        <el-table-column label="等级" width="120">
          <template #default="scope">
            {{ levelText(scope.row.level) }}
          </template>
        </el-table-column>
        <el-table-column prop="consecutiveCorrect" label="连续正确" width="120" />
        <el-table-column label="下次复习">
          <template #default="scope">
            {{ formatNextReview(scope.row.nextReview) }}
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <!-- 复习区域 -->
    <el-card v-if="currentItem && !isCompleted" class="review-card" v-loading="loading">
      <div class="review-content">
        <!-- 卡片正面/背面 -->
        <div 
          class="flashcard" 
          :class="{ flipped: isFlipped }"
          @click="flipCard"
        >
          <div class="card-front">
            <span class="main-char">{{ currentItem.word }}</span>
            <span class="hint">点击查看答案</span>
          </div>
          <div class="card-back">
            <span class="mastery-level">掌握状态：{{ levelText(currentItem.level) }}</span>
            <span class="meaning">来源：{{ currentItem.source }}</span>
          </div>
        </div>
        
        <!-- 评分按钮 -->
        <div v-if="isFlipped" class="rating-buttons">
          <el-button 
            type="danger" 
            size="large"
            @click="rateItem(1)"
          >
            忘记了
          </el-button>
          <el-button 
            type="warning" 
            size="large"
            @click="rateItem(2)"
          >
            有点难
          </el-button>
          <el-button 
            type="primary" 
            size="large"
            @click="rateItem(3)"
          >
            记住了
          </el-button>
          <el-button 
            type="success" 
            size="large"
            @click="rateItem(4)"
          >
            很简单
          </el-button>
        </div>
      </div>
      
      <div class="review-progress">
        <el-progress 
          :percentage="reviewProgress" 
          :stroke-width="8"
          :show-text="false"
        />
        <span class="progress-text">{{ currentIndex + 1 }} / {{ reviewItems.length }}</span>
      </div>
    </el-card>
    
    <!-- 空状态 -->
    <el-empty 
      v-else-if="!isCompleted"
      description="暂无待复习内容"
    >
      <el-button type="primary" @click="loadReviewItems">
        加载复习内容
      </el-button>
    </el-empty>
    
    <!-- 完成状态 -->
    <el-card v-if="isCompleted" class="completion-card">
      <el-result
        icon="success"
        title="复习完成！"
        sub-title="你今天的复习任务已完成"
      >
        <template #extra>
          <el-button type="primary" @click="resetReview">再来一轮</el-button>
          <el-button @click="goHome">返回首页</el-button>
        </template>
      </el-result>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useReviewStore } from '../stores/reviewStore'
import { MasteryLevel, type DueWord, type WordMastery } from '../../shared/types/review'
import { ratingToQuality } from '../../shared/services/sm2Algorithm'

const router = useRouter()
const reviewStore = useReviewStore()

const errorText = ref('')

const sourceFilter = ref<string>('')
const sourceOptions = computed(() => reviewStore.sources ?? [])

// 复习统计
const pendingCount = computed(() => reviewStore.reviewStats?.dueToday ?? reviewStore.dueCount)
const todayReviewed = computed(() => reviewStore.reviewStats?.reviewedToday ?? 0)
const totalWords = computed(() => reviewStore.reviewStats?.totalWords ?? 0)
const accuracy = computed(() => {
  const session = reviewStore.currentSession
  if (!session) return 0
  if (session.totalCount <= 0) return 0
  // 会话进行中/完成都可用
  return Math.round((session.correctCount / session.totalCount) * 100)
})

const weakWords = ref<WordMastery[]>([])
const loadingWeakWords = ref(false)

// 复习项目
const reviewItems = ref<DueWord[]>([])

// 当前索引
const currentIndex = ref(0)

// 当前项目
const currentItem = computed(() => reviewItems.value[currentIndex.value])

// 卡片翻转状态
const isFlipped = ref(false)

// 是否完成
const isCompleted = ref(false)

// 加载状态
const loading = ref(false)

// 复习进度
const reviewProgress = computed(() => {
  if (reviewItems.value.length === 0) return 0
  return Math.round(((currentIndex.value + 1) / reviewItems.value.length) * 100)
})

// 初始化
onMounted(async () => {
  await loadReviewItems()
})

function formatNextReview(ts: number) {
  if (!ts) return '-'
  try {
    return new Date(ts).toLocaleString()
  } catch {
    return String(ts)
  }
}

function levelText(level: MasteryLevel) {
  switch (level) {
    case MasteryLevel.New:
      return '新单词'
    case MasteryLevel.Learning:
      return '学习中'
    case MasteryLevel.Familiar:
      return '熟悉'
    case MasteryLevel.Proficient:
      return '熟练'
    case MasteryLevel.Mastered:
      return '精通'
    default:
      return '未知'
  }
}

// 翻转卡片
function flipCard() {
  isFlipped.value = !isFlipped.value
}

// 评分项目
async function rateItem(rating: number) {
  if (!currentItem.value) return
  
  try {
    const quality = ratingToQuality(rating)
    await reviewStore.submitReviewWithQuality(currentItem.value.word, currentItem.value.source, quality)
    
    // 移动到下一个
    if (currentIndex.value < reviewItems.value.length - 1) {
      currentIndex.value++
      isFlipped.value = false
    } else {
      isCompleted.value = true
    }
  } catch (error) {
    errorText.value = '记录复习失败'
    console.error('记录复习失败:', error)
  }
}

// 加载复习项目
async function loadReviewItems() {
  loading.value = true
  try {
    errorText.value = ''
    await reviewStore.loadSources()
    const source = sourceFilter.value || undefined
    await reviewStore.loadReviewStats(source)
    await reviewStore.loadDueWords(20, source)
    reviewItems.value = [...reviewStore.dueWords]
    currentIndex.value = 0
    isFlipped.value = false
    isCompleted.value = false

    await loadWeakWords()
    
  } catch (error) {
    errorText.value = '加载复习项目失败'
    console.error('加载复习项目失败:', error)
  } finally {
    loading.value = false
  }
}

async function loadWeakWords() {
  loadingWeakWords.value = true
  try {
    const source = sourceFilter.value || undefined
    weakWords.value = await reviewStore.loadWeakWords(source, 10)
  } finally {
    loadingWeakWords.value = false
  }
}

// 重置复习
async function resetReview() {
  await loadReviewItems()
}

// 返回首页
function goHome() {
  router.push('/')
}
</script>

<style lang="scss" scoped>
.review-page {
  max-width: 800px;
  margin: 0 auto;
}

.error-alert {
  margin-bottom: 16px;
}

.filter-row {
  margin-bottom: 16px;
}

.filter-card {
  :deep(.el-card__body) {
    padding: 12px 16px;
  }
}

.filter-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.filter-label {
  color: var(--text-color);
}

.stats-row {
  margin-bottom: 24px;
}

.weak-words-card {
  margin-bottom: 24px;
}

.weak-words-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stat-card {
  text-align: center;
  
  :deep(.el-statistic__content) {
    justify-content: center;
  }
}

.review-card {
  margin-bottom: 24px;
}

.review-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
}

.flashcard {
  width: 100%;
  max-width: 400px;
  height: 300px;
  perspective: 1000px;
  cursor: pointer;
  margin-bottom: 32px;
  
  .card-front,
  .card-back {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background-color: var(--bg-color-card);
    border: 1px solid var(--border-color);
    border-radius: 16px;
    backface-visibility: hidden;
    transition: transform 0.6s;
    box-shadow: var(--shadow-light);
  }
  
  .card-front {
    .main-char {
      font-size: 120px;
      color: var(--text-color);
    }
    
    .hint {
      font-size: 14px;
      color: var(--text-color-placeholder);
      margin-top: 16px;
    }
  }
  
  .card-back {
    transform: rotateY(180deg);
    gap: 16px;
    
    .pinyin {
      font-size: 32px;
      color: var(--primary-color);
    }
    
    .meaning {
      font-size: 24px;
      color: var(--text-color);
    }
    
    .example {
      font-size: 18px;
      color: var(--text-color-secondary);
    }
  }
  
  &.flipped {
    .card-front {
      transform: rotateY(180deg);
    }
    
    .card-back {
      transform: rotateY(0deg);
    }
  }
}

.rating-buttons {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
  justify-content: center;
}

.review-progress {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 0 24px;
  
  .el-progress {
    flex: 1;
  }
  
  .progress-text {
    font-size: 14px;
    color: var(--text-color-secondary);
    white-space: nowrap;
  }
}

.completion-card {
  text-align: center;
}
</style>
