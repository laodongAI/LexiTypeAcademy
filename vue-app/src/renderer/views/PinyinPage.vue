<!--
  拼音学习页面
  
  支持语音识别和发音练习
-->

<template>
  <div class="pinyin-page">
    <el-row :gutter="24">
      <!-- 左侧拼音列表 -->
      <el-col :xs="24" :md="8">
        <el-card class="pinyin-list-card">
          <template #header>
            <div class="card-header">
              <span>拼音表</span>
              <el-select v-model="pinyinType" size="small" style="width: 160px">
                <el-option label="单韵母" value="single" />
                <el-option label="复韵母" value="compound" />
                <el-option label="前鼻韵母" value="nasalN" />
                <el-option label="后鼻韵母" value="nasalNG" />
                <el-option label="声母" value="consonants" />
                <el-option label="整体认读" value="whole" />
                <el-option label="声调练习" value="tones" />
              </el-select>
            </div>
          </template>
          
          <div class="pinyin-grid">
            <div 
              v-for="item in currentPinyinList" 
              :key="item.pinyin"
              class="pinyin-item"
              :class="{ active: selectedPinyin?.pinyin === item.pinyin }"
              @click="selectPinyin(item)"
            >
              <span class="pinyin-text">{{ item.pinyin }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      
      <!-- 右侧详情和练习 -->
      <el-col :xs="24" :md="16">
        <!-- 拼音详情 -->
        <el-card v-if="selectedPinyin" class="pinyin-detail-card">
          <div class="pinyin-display">
            <span class="main-pinyin">{{ selectedPinyin.pinyin }}</span>
            <el-button 
              circle 
              :icon="Microphone" 
              size="large"
              @click="playPronunciation"
            />
          </div>
          
          <div class="pinyin-info">
            <p class="description">{{ selectedPinyin.description }}</p>
            <p v-if="selectedPinyin.tips" class="tips">
              <el-icon><InfoFilled /></el-icon>
              提示：{{ selectedPinyin.tips }}
            </p>
            <div class="examples">
              <h4>例字练习</h4>
              <div class="example-list">
                <div 
                  v-for="example in selectedPinyin.examples" 
                  :key="example.char"
                  class="example-item"
                  @click="playExample(example)"
                >
                  <span class="char">{{ example.char }}</span>
                  <span class="pinyin">{{ example.pinyin }}</span>
                  <span v-if="example.word" class="word">{{ example.word }}</span>
                  <span v-if="example.meaning" class="meaning">- {{ example.meaning }}</span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
        
        <!-- 发音练习 -->
        <el-card class="practice-card">
          <template #header>
            <div class="card-header">
              <span>发音练习</span>
              <el-tag :type="isRecording ? 'danger' : 'info'">
                {{ isRecording ? '录音中...' : '点击开始' }}
              </el-tag>
            </div>
          </template>
          
          <div class="practice-content">
            <div class="target-pronunciation">
              <span class="label">目标发音:</span>
              <span class="value">{{ selectedPinyin?.pinyin || '-' }}</span>
            </div>
            
            <el-button
              :type="isRecording ? 'danger' : 'primary'"
              :icon="isRecording ? CircleClose : Microphone"
              size="large"
              circle
              class="record-button"
              @click="toggleRecording"
            />
            
            <div v-if="recognitionResult" class="recognition-result">
              <span class="label">识别结果:</span>
              <span class="value" :class="{ correct: isCorrect, incorrect: !isCorrect }">
                {{ recognitionResult }}
              </span>
              <el-icon v-if="isCorrect" class="result-icon correct">
                <CircleCheck />
              </el-icon>
              <el-icon v-else class="result-icon incorrect">
                <CircleClose />
              </el-icon>
            </div>
          </div>
        </el-card>
        
        <!-- 学习进度 -->
        <el-card class="progress-card">
          <template #header>
            <span>学习进度</span>
          </template>
          <el-progress 
            :percentage="learningProgress" 
            :stroke-width="16"
            :format="formatProgress"
          />
          <p class="progress-text">
            已掌握 {{ masteredCount }} / {{ totalCount }} 个拼音
          </p>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { 
  Microphone, 
  CircleCheck, 
  CircleClose,
  InfoFilled
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { 
  singleVowels, 
  compoundVowels, 
  nasalVowelsN, 
  nasalVowelsNG,
  consonants as consonantsData, 
  tones as tonesData,
  wholeSyllables,
  learningPaths,
  type PinyinItem 
} from '../../shared/data/pinyinData'
import { getTTSApiService } from '../../shared/services/ttsApiService'

const ttsService = getTTSApiService()

// 拼音类型
type PinyinType = 'single' | 'compound' | 'nasalN' | 'nasalNG' | 'consonants' | 'tones' | 'whole'
const pinyinType = ref<PinyinType>('single')

// 当前学习路径
const currentPath = ref(0)

// 获取当前拼音列表
const currentPinyinList = computed(() => {
  switch (pinyinType.value) {
    case 'single': return singleVowels
    case 'compound': return compoundVowels
    case 'nasalN': return nasalVowelsN
    case 'nasalNG': return nasalVowelsNG
    case 'consonants': return consonantsData
    case 'tones': return tonesData.map(t => ({
      pinyin: t.name,
      description: t.description,
      examples: t.examples.map(e => ({
        char: e.char,
        pinyin: e.pinyin,
        word: e.meaning,
        meaning: e.meaning
      })),
      tips: `${t.symbol} - ${t.pitch}`
    }))
    case 'whole': return wholeSyllables
    default: return singleVowels
  }
})

// 选中的拼音
const selectedPinyin = ref<PinyinItem>(singleVowels[0])

// 录音状态
const isRecording = ref(false)

// 识别结果
const recognitionResult = ref('')

// 是否正确
const isCorrect = computed(() => {
  if (!recognitionResult.value || !selectedPinyin.value) return false
  return recognitionResult.value.toLowerCase() === selectedPinyin.value.pinyin.toLowerCase()
})

// 学习进度
const masteredCount = ref(0)
const totalCount = computed(() => {
  return singleVowels.length + 
         compoundVowels.length + 
         nasalVowelsN.length + 
         nasalVowelsNG.length + 
         consonantsData.length + 
         wholeSyllables.length
})
const learningProgress = computed(() => 
  Math.round((masteredCount.value / totalCount.value) * 100)
)

// 选择拼音
function selectPinyin(item: PinyinItem) {
  selectedPinyin.value = item
  recognitionResult.value = ''
}

// 播放发音
async function playPronunciation() {
  if (!selectedPinyin.value) return
  
  try {
    const audioUrl = await ttsService.getAudioUrl({
      text: selectedPinyin.value.pinyin,
      language: 'zh-CN',
      rate: 0.8, // 慢速播放便于学习
      format: 'mp3',
    })
    
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      // blob URL 播放完后回收
      if (audioUrl.startsWith('blob:')) {
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl), { once: true })
      }
      await audio.play()
    } else {
      ElMessage.error('生成语音失败')
    }
  } catch (error) {
    console.error('播放发音失败:', error)
    ElMessage.error('播放发音失败')
  }
}

// 播放例字
async function playExample(example: { char: string; pinyin: string; word?: string }) {
  try {
    const text = example.word || example.char
    const audioUrl = await ttsService.getAudioUrl({
      text: text,
      language: 'zh-CN',
      rate: 0.9,
      format: 'mp3',
    })
    
    if (audioUrl) {
      const audio = new Audio(audioUrl)
      if (audioUrl.startsWith('blob:')) {
        audio.addEventListener('ended', () => URL.revokeObjectURL(audioUrl), { once: true })
      }
      await audio.play()
    } else {
      ElMessage.error('播放失败')
    }
  } catch (error) {
    console.error('播放例字失败:', error)
    ElMessage.error('播放例字失败')
  }
}

// 切换录音
function toggleRecording() {
  if (isRecording.value) {
    stopRecording()
  } else {
    startRecording()
  }
}

// 开始录音
async function startRecording() {
  isRecording.value = true
  recognitionResult.value = ''
  
  try {
    // TODO: 调用 ASR API 开始录音
    ElMessage.info('开始录音，请读出拼音')
  } catch (error) {
    console.error('开始录音失败:', error)
    ElMessage.error('开始录音失败')
    isRecording.value = false
  }
}

// 停止录音
async function stopRecording() {
  isRecording.value = false
  
  try {
    // TODO: 调用 ASR API 停止录音并获取结果
    // 模拟结果
    await new Promise(resolve => setTimeout(resolve, 500))
    recognitionResult.value = selectedPinyin.value?.pinyin || ''
    
    if (isCorrect.value) {
      ElMessage.success('发音正确！')
      masteredCount.value++
    } else {
      ElMessage.warning('再试一次吧')
    }
  } catch (error) {
    console.error('识别失败:', error)
    ElMessage.error('识别失败')
  }
}

// 格式化进度
function formatProgress(percentage: number) {
  return `${percentage}%`
}

// 初始化
onMounted(() => {
  // 计算已掌握的拼音数量
  const saved = localStorage.getItem('pinyin_mastered')
  if (saved) {
    try {
      masteredCount.value = JSON.parse(saved).length
    } catch (e) {
      console.error('读取学习进度失败', e)
    }
  }
})
</script>

<style lang="scss" scoped>
.pinyin-page {
  max-width: 1400px;
  margin: 0 auto;
}

.pinyin-list-card {
  height: 100%;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .pinyin-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
    gap: 12px;
    max-height: 70vh;
    overflow: auto;
    
    .pinyin-item {
      padding: 16px;
      text-align: center;
      background-color: var(--bg-color-hover);
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.3s;
      
      &:hover {
        background-color: var(--primary-color-lighter);
        transform: translateY(-2px);
      }
      
      &.active {
        background-color: var(--primary-color);
        color: white;
        font-weight: 600;
      }
      
      .pinyin-text {
        font-size: 24px;
      }
    }
  }
}

.pinyin-detail-card {
  margin-bottom: 24px;
  
  .pinyin-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 24px;
    padding: 16px;
    background-color: var(--bg-color-hover);
    border: 1px solid var(--border-color);
    border-radius: 10px;
    margin-bottom: 24px;
    
    .main-pinyin {
      font-size: 44px;
      font-weight: 700;
      color: var(--primary-color);
    }
  }
}

.pinyin-info {
  .description {
    font-size: 16px;
    color: var(--text-color);
    margin-bottom: 16px;
    line-height: 1.6;
  }
  
  .tips {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px;
    background-color: var(--el-color-warning-light-9);
    border-left: 3px solid var(--el-color-warning);
    border-radius: 4px;
    margin-bottom: 24px;
    font-size: 14px;
    color: var(--el-color-warning);
    
    .el-icon {
      font-size: 16px;
    }
  }
  
  .examples {
    h4 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--text-color);
    }
    
    .example-list {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
      
      .example-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px 16px;
        background-color: var(--bg-color-hover);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.2s;
        
        &:hover {
          background-color: var(--primary-color-lighter);
          transform: translateY(-1px);
        }
        
        .char {
          font-size: 24px;
          font-weight: 600;
          color: var(--primary-color);
        }
        
        .pinyin {
          font-size: 14px;
          color: var(--text-color-secondary);
        }
        
        .word {
          font-size: 14px;
          color: var(--text-color);
        }
        
        .meaning {
          font-size: 12px;
          color: var(--text-color-placeholder);
        }
      }
    }
  }
}

.practice-card {
  margin-bottom: 24px;
  
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .practice-content {
    text-align: center;
    padding: 32px;
    
    .target-pronunciation {
      margin-bottom: 32px;
      
      .label {
        display: block;
        font-size: 14px;
        color: var(--text-color-secondary);
        margin-bottom: 8px;
      }
      
      .value {
        font-size: 48px;
        font-weight: 700;
        color: var(--primary-color);
      }
    }
    
    .record-button {
      width: 80px;
      height: 80px;
      margin-bottom: 32px;
      
      :deep(.el-icon) {
        font-size: 32px;
      }
    }
    
    .recognition-result {
      .label {
        display: block;
        font-size: 14px;
        color: var(--text-color-secondary);
        margin-bottom: 8px;
      }
      
      .value {
        font-size: 36px;
        font-weight: 600;
        
        &.correct {
          color: var(--el-color-success);
        }
        
        &.incorrect {
          color: var(--el-color-danger);
        }
      }
      
      .result-icon {
        font-size: 48px;
        margin-top: 16px;
        
        &.correct {
          color: var(--el-color-success);
        }
        
        &.incorrect {
          color: var(--el-color-danger);
        }
      }
    }
  }
}

.progress-card {
  .progress-text {
    margin-top: 16px;
    text-align: center;
    font-size: 16px;
    color: var(--text-color-secondary);
  }
}
</style>
