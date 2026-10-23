<!--
  打字练习页面
  
  核心功能页面，实现打字练习功能
  包含三种练习模式：指法练习、汉字练习、英文练习
-->

<template>
  <div class="typing-page">
    <!-- 练习类型选择 -->
    <div class="practice-selector">
      <el-radio-group v-model="practiceCategory" size="large">
        <el-radio-button value="fingerPractice">
          <el-icon><Edit /></el-icon>
          指法练习
        </el-radio-button>
        <el-radio-button value="typingPractice">
          <el-icon><Notebook /></el-icon>
          汉字练习
        </el-radio-button>
        <el-radio-button value="englishPractice">
          <el-icon><Reading /></el-icon>
          英文练习
        </el-radio-button>
      </el-radio-group>
      
      <el-radio-group v-model="difficultyLevel" size="default" class="difficulty-selector">
        <el-radio-button value="beginner">初级</el-radio-button>
        <el-radio-button value="intermediate">中级</el-radio-button>
        <el-radio-button value="advanced">高级</el-radio-button>
      </el-radio-group>
    </div>
    
    <!-- 练习控制区 -->
    <div class="typing-header">
      <div class="course-info">
        <h2>{{ currentLesson?.title || '打字练习' }}</h2>
        <el-progress 
          :percentage="lessonProgress" 
          :stroke-width="8"
          class="lesson-progress"
        />
      </div>
      <div class="typing-controls">
        <el-button-group>
          <el-button type="primary" @click="nextPractice">下一篇</el-button>
          <el-button :icon="Setting" @click="showSettings = true">设置</el-button>
          <el-button :icon="Refresh" @click="resetLesson">重新开始</el-button>
        </el-button-group>
      </div>
    </div>
    
    <!-- 打字区域 -->
    <el-card class="typing-area">
      <el-alert
        v-if="isLessonFinished"
        title="本篇完成，按 Enter 进入下一篇"
        type="success"
        :closable="false"
        show-icon
        class="finish-alert"
      />
      <!-- 目标文本 -->
      <div class="target-text">
        <span 
          v-for="(char, index) in targetChars" 
          :key="index"
          :class="getCharClass(index)"
        >
          {{ char }}
        </span>
      </div>
      
      <!-- 拼音提示 -->
      <div v-if="showPinyin" class="pinyin-hint">
        <span v-for="(pinyin, index) in targetPinyins" :key="index">
          {{ pinyin }}
        </span>
      </div>
      
      <!-- 输入区域 -->
      <el-input
        v-model="userInput"
        ref="inputRef"
        class="typing-input"
        placeholder="开始输入..."
        size="large"
        @input="handleInput"
        @keydown="handleKeydown"
      />
    </el-card>
    
    <!-- 统计信息 -->
    <div class="typing-stats">
      <el-row :gutter="24">
        <el-col :span="6">
          <el-statistic title="准确率" :value="accuracy" suffix="%" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="速度" :value="speed" suffix="字/分" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已完成" :value="completedChars" :suffix="`/${targetChars.length}`" />
        </el-col>
        <el-col :span="6">
          <div class="custom-statistic">
            <div class="el-statistic">
              <div class="el-statistic__head">用时</div>
              <div class="el-statistic__content">
                <span class="el-statistic__number">{{ formatTime(elapsedTime) }}</span>
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>
    
    <!-- 键盘显示 -->
    <el-card v-if="showKeyboard" class="keyboard-display">
      <VirtualKeyboard
        :highlight-key="nextKey"
        :pressed-key="pressedKey"
        @key-click="handleVirtualKeyClick"
      />
    </el-card>
    
    <!-- 设置对话框 -->
    <el-dialog v-model="showSettings" title="练习设置" width="400px">
      <el-form label-width="120px">
        <el-form-item label="显示拼音提示">
          <el-switch v-model="showPinyin" />
        </el-form-item>
        <el-form-item label="显示虚拟键盘">
          <el-switch v-model="showKeyboard" />
        </el-form-item>
        <el-form-item label="显示手指区域">
          <el-switch v-model="showFingerHint" :disabled="!showKeyboard" />
        </el-form-item>
        <el-form-item label="音效提示">
          <el-switch v-model="soundEnabled" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSettings = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { defineAsyncComponent, ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { Setting, Refresh, Edit, Reading, Notebook } from '@element-plus/icons-vue'
import { practiceTexts, type PracticeCategory, type DifficultyLevel } from '../../shared/data/typingData'

const VirtualKeyboard = defineAsyncComponent(() => import('../../shared/components/VirtualKeyboard.vue'))

// 输入框引用
const inputRef = ref<HTMLInputElement | null>(null)

// 设置对话框
const showSettings = ref(false)

// 练习设置
const showPinyin = ref(true)
const showKeyboard = ref(true)
const showFingerHint = ref(true)
const soundEnabled = ref(true)

// 练习类型和难度
const practiceCategory = ref<PracticeCategory>('fingerPractice')
const difficultyLevel = ref<DifficultyLevel>('beginner')

// 当前练习索引
const currentPracticeIndex = ref(0)

// 当前课程和课时
const currentLesson = computed(() => {
  const texts = practiceTexts[practiceCategory.value][difficultyLevel.value]
  const content = texts[currentPracticeIndex.value % texts.length]
  const titles: Record<PracticeCategory, Record<DifficultyLevel, string>> = {
    fingerPractice: {
      beginner: '指法练习 - 基准键位',
      intermediate: '指法练习 - 延伸键位',
      advanced: '指法练习 - 全键盘',
    },
    typingPractice: {
      beginner: '汉字练习 - 拼音基础',
      intermediate: '汉字练习 - 短文阅读',
      advanced: '汉字练习 - 经典散文',
    },
    englishPractice: {
      beginner: '英文练习 - 基础单词',
      intermediate: '英文练习 - 常用短语',
      advanced: '英文练习 - 英语文章',
    },
  }
  return {
    title: titles[practiceCategory.value][difficultyLevel.value],
    content,
  }
})

// 键盘状态
const pressedKey = ref('')
const nextKey = computed(() => {
  const chars = targetChars.value
  const index = completedChars.value
  if (index < chars.length) {
    return chars[index]
  }
  return ''
})

// 目标字符
const targetChars = computed(() => currentLesson.value.content.split(''))
const targetPinyins = computed(() => ['nǐ', 'hǎo', 'shì', 'jiè'])

// 用户输入
const userInput = ref('')

const isLessonFinished = ref(false)

// 已完成字符数
const completedChars = ref(0)

// 正确字符数
const correctChars = ref(0)

// 开始时间和用时
const startTime = ref<number | null>(null)
const elapsedTime = ref(0)
let timer: ReturnType<typeof setInterval> | null = null

// 准确率
const accuracy = computed(() => {
  if (completedChars.value === 0) return 100
  return Math.round((correctChars.value / completedChars.value) * 100)
})

// 速度（字/分钟）
const speed = computed(() => {
  if (elapsedTime.value === 0) return 0
  return Math.round((correctChars.value / elapsedTime.value) * 60)
})

// 课程进度
const lessonProgress = computed(() => {
  if (targetChars.value.length === 0) return 0
  return Math.round((completedChars.value / targetChars.value.length) * 100)
})

// 获取字符样式类
function getCharClass(index: number) {
  if (index < completedChars.value) {
    return userInput.value[index] === targetChars.value[index] 
      ? 'char-correct' 
      : 'char-error'
  }
  if (index === completedChars.value) {
    return 'char-current'
  }
  return 'char-pending'
}

// 处理输入
function handleInput() {
  if (isLessonFinished.value) return
  if (!startTime.value) {
    startTime.value = Date.now()
    startTimer()
  }
  
  const input = userInput.value
  const currentIndex = input.length - 1
  
  if (currentIndex >= 0 && currentIndex < targetChars.value.length) {
    completedChars.value = input.length
    
    if (input[currentIndex] === targetChars.value[currentIndex]) {
      correctChars.value++
    }
    
    // 检查是否完成
    if (completedChars.value === targetChars.value.length) {
      finishLesson()
    }
  }
}

// 处理按键
function handleKeydown(e: Event | KeyboardEvent) {
  if (!(e instanceof KeyboardEvent)) return

  // 完成后按 Enter 进入下一篇
  if (isLessonFinished.value && e.key === 'Enter') {
    e.preventDefault()
    nextPractice()
    return
  }

  pressedKey.value = e.key
  // 清除按下状态
  setTimeout(() => {
    pressedKey.value = ''
  }, 100)
}

// 处理虚拟键盘点击
function handleVirtualKeyClick(key: string) {
  if (key === 'Backspace') {
    if (userInput.value.length > 0) {
      userInput.value = userInput.value.slice(0, -1)
      completedChars.value = Math.max(0, completedChars.value - 1)
    }
  } else if (key === 'Space') {
    userInput.value += ' '
    handleInput()
  } else if (key.length === 1) {
    userInput.value += key
    handleInput()
  }
  inputRef.value?.focus()
}

// 切换练习
function nextPractice() {
  const texts = practiceTexts[practiceCategory.value][difficultyLevel.value]
  currentPracticeIndex.value = (currentPracticeIndex.value + 1) % texts.length
  resetLesson()
}

// 切换练习类型时重置
watch([practiceCategory, difficultyLevel], () => {
  currentPracticeIndex.value = 0
  resetLesson()
})

// 开始计时器
function startTimer() {
  timer = setInterval(() => {
    if (startTime.value) {
      elapsedTime.value = Math.floor((Date.now() - startTime.value) / 1000)
    }
  }, 1000)
}

// 重置课时
function resetLesson() {
  userInput.value = ''
  completedChars.value = 0
  correctChars.value = 0
  startTime.value = null
  elapsedTime.value = 0
  isLessonFinished.value = false
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  inputRef.value?.focus()
}

// 完成课时
function finishLesson() {
  if (isLessonFinished.value) return
  if (timer) {
    clearInterval(timer)
    timer = null
  }
  isLessonFinished.value = true
}

// 格式化时间
function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// 组件挂载时聚焦输入框
onMounted(() => {
  inputRef.value?.focus()
})

// 组件卸载时清理计时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})
</script>

<style lang="scss" scoped>
.typing-page {
  max-width: 1000px;
  margin: 0 auto;
}

.typing-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  
  .course-info {
    flex: 1;
    
    h2 {
      margin: 0 0 12px 0;
      color: var(--text-color);
    }
    
    .lesson-progress {
      max-width: 300px;
    }
  }
}

.typing-area {
  margin-bottom: 24px;
  
  :deep(.el-card__body) {
    padding: 32px;
  }
}

.finish-alert {
  margin-bottom: 16px;
}

.target-text {
  font-size: 36px;
  line-height: 1.8;
  margin-bottom: 16px;
  letter-spacing: 8px;
  text-align: center;
  
  .char-correct {
    color: var(--el-color-success);
  }
  
  .char-error {
    color: var(--el-color-danger);
    text-decoration: underline;
  }
  
  .char-current {
    color: var(--primary-color);
    background-color: var(--bg-color-hover);
    border-radius: 4px;
    padding: 0 4px;
  }
  
  .char-pending {
    color: var(--text-color-placeholder);
  }
}

.pinyin-hint {
  font-size: 18px;
  color: var(--text-color-secondary);
  text-align: center;
  margin-bottom: 24px;
  letter-spacing: 16px;
  
  span {
    display: inline-block;
    min-width: 44px;
  }
}

.typing-input {
  :deep(.el-input__inner) {
    font-size: 24px;
    text-align: center;
    letter-spacing: 4px;
  }
}

.typing-stats {
  margin-bottom: 24px;
  
  :deep(.el-statistic) {
    text-align: center;
  }
}

.keyboard-display {
  :deep(.el-card__body) {
    display: flex;
    justify-content: center;
    padding: 24px;
    overflow-x: auto;
    overflow-y: visible;
  }
}

.practice-selector {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 24px;
  margin-bottom: 24px;
  padding: 16px;
  background: var(--bg-color);
  border-radius: 12px;
  
  .el-radio-button {
    :deep(.el-radio-button__inner) {
      display: flex;
      align-items: center;
      gap: 6px;
    }
  }
  
  .difficulty-selector {
    margin-left: 16px;
    padding-left: 16px;
    border-left: 1px solid var(--border-color);
  }
}
</style>
