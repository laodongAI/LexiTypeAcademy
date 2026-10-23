<!--
  智能翻译工具页面
  
  提供中英文互译功能，支持单词、短语、句子和段落翻译
-->

<template>
  <div class="translate-tool-page">
    <el-card class="tool-card">
      <template #header>
        <div class="card-header">
          <span>智能翻译</span>
          <el-button-group size="small">
            <el-button :type="direction === 'en-zh' ? 'primary' : ''" @click="direction = 'en-zh'">
              英 → 中
            </el-button>
            <el-button :type="direction === 'zh-en' ? 'primary' : ''" @click="direction = 'zh-en'">
              中 → 英
            </el-button>
          </el-button-group>
        </div>
      </template>

      <el-row :gutter="20">
        <!-- 输入区 -->
        <el-col :xs="24" :md="12">
          <div class="input-section">
            <div class="section-header">
              <span>{{ direction === 'en-zh' ? '英文输入' : '中文输入' }}</span>
              <el-button text size="small" @click="clearInput">清空</el-button>
            </div>
            <el-input
              v-model="inputText"
              type="textarea"
              :rows="12"
              :placeholder="direction === 'en-zh' ? '请输入英文...' : '请输入中文...'"
              @input="handleInput"
            />
            <div class="input-stats">
              <span>字数: {{ inputText.length }}</span>
              <el-button type="primary" size="small" :loading="translating" @click="translate">
                <el-icon><Document /></el-icon>
                翻译
              </el-button>
            </div>
          </div>
        </el-col>

        <!-- 输出区 -->
        <el-col :xs="24" :md="12">
          <div class="output-section">
            <div class="section-header">
              <span>{{ direction === 'en-zh' ? '中文翻译' : '英文翻译' }}</span>
              <el-button text size="small" @click="copyOutput" :disabled="!outputText">
                <el-icon><CopyDocument /></el-icon>
                复制
              </el-button>
            </div>
            <div class="output-content" :class="{ empty: !outputText }">
              {{ outputText || '翻译结果将显示在这里...' }}
            </div>
            
            <!-- 翻译建议 -->
            <div v-if="suggestions.length > 0" class="suggestions">
              <div class="suggestions-header">其他翻译建议：</div>
              <el-tag
                v-for="(suggestion, index) in suggestions"
                :key="index"
                class="suggestion-tag"
                @click="useSuggestion(suggestion)"
              >
                {{ suggestion }}
              </el-tag>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 快捷翻译 -->
      <el-divider content-position="left">快捷翻译</el-divider>
      <div class="quick-translate">
        <el-tag
          v-for="example in quickExamples"
          :key="example"
          class="example-tag"
          @click="inputText = example; translate()"
        >
          {{ example }}
        </el-tag>
      </div>
    </el-card>

    <!-- 翻译历史 -->
    <el-card class="history-card">
      <template #header>
        <div class="card-header">
          <span>翻译历史</span>
          <el-button text size="small" @click="clearHistory">清空历史</el-button>
        </div>
      </template>
      
      <el-empty v-if="history.length === 0" description="暂无翻译历史" />
      
      <div v-else class="history-list">
        <div
          v-for="(item, index) in history"
          :key="index"
          class="history-item"
          @click="useHistoryItem(item)"
        >
          <div class="history-source">{{ item.source }}</div>
          <el-icon class="history-arrow"><Right /></el-icon>
          <div class="history-target">{{ item.target }}</div>
          <div class="history-time">{{ formatTime(item.timestamp) }}</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Document, CopyDocument, Right } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 翻译方向
const direction = ref<'en-zh' | 'zh-en'>('en-zh')

// 输入输出
const inputText = ref('')
const outputText = ref('')
const translating = ref(false)
const suggestions = ref<string[]>([])

// 翻译历史
interface TranslationHistory {
  source: string
  target: string
  timestamp: number
}
const history = ref<TranslationHistory[]>([])

// 快捷示例
const quickExamples = [
  'Hello, how are you?',
  'I love learning English.',
  'Practice makes perfect.',
  'Knowledge is power.',
]

// 输入处理
function handleInput() {
  // 自动检测语言（简化版）
  if (inputText.value) {
    const hasChineseChar = /[\u4e00-\u9fa5]/.test(inputText.value)
    const hasEnglishChar = /[a-zA-Z]/.test(inputText.value)
    
    if (hasChineseChar && !hasEnglishChar) {
      direction.value = 'zh-en'
    } else if (hasEnglishChar && !hasChineseChar) {
      direction.value = 'en-zh'
    }
  }
}

// 翻译
async function translate() {
  if (!inputText.value.trim()) {
    ElMessage.warning('请输入要翻译的内容')
    return
  }
  
  translating.value = true
  
  try {
    // TODO: 调用真实的翻译 API
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    // 模拟翻译结果
    if (direction.value === 'en-zh') {
      outputText.value = `【模拟翻译】${inputText.value} 的中文翻译`
      suggestions.value = ['备选翻译1', '备选翻译2', '备选翻译3']
    } else {
      outputText.value = `【Mock Translation】English translation of ${inputText.value}`
      suggestions.value = ['Alternative 1', 'Alternative 2', 'Alternative 3']
    }
    
    // 添加到历史
    history.value.unshift({
      source: inputText.value,
      target: outputText.value,
      timestamp: Date.now(),
    })
    
    // 限制历史记录数量
    if (history.value.length > 20) {
      history.value = history.value.slice(0, 20)
    }
    
    ElMessage.success('翻译完成')
  } catch (error) {
    console.error('翻译失败:', error)
    ElMessage.error('翻译失败，请重试')
  } finally {
    translating.value = false
  }
}

// 清空输入
function clearInput() {
  inputText.value = ''
  outputText.value = ''
  suggestions.value = []
}

// 复制输出
function copyOutput() {
  if (!outputText.value) return
  
  navigator.clipboard.writeText(outputText.value).then(() => {
    ElMessage.success('已复制到剪贴板')
  }).catch(() => {
    ElMessage.error('复制失败')
  })
}

// 使用建议
function useSuggestion(suggestion: string) {
  outputText.value = suggestion
  ElMessage.success('已应用该翻译')
}

// 使用历史记录
function useHistoryItem(item: TranslationHistory) {
  inputText.value = item.source
  outputText.value = item.target
  ElMessage.info('已加载历史翻译')
}

// 清空历史
function clearHistory() {
  history.value = []
  ElMessage.success('已清空历史记录')
}

// 格式化时间
function formatTime(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  
  return date.toLocaleDateString()
}
</script>

<style lang="scss" scoped>
.translate-tool-page {
  .tool-card {
    margin-bottom: 20px;
    
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }
  
  .input-section,
  .output-section {
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      font-weight: 600;
      color: #303133;
    }
    
    .input-stats {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 12px;
      color: #909399;
      font-size: 14px;
    }
  }
  
  .output-content {
    min-height: 300px;
    padding: 12px;
    background: #f5f7fa;
    border-radius: 4px;
    line-height: 1.8;
    white-space: pre-wrap;
    word-break: break-word;
    
    &.empty {
      color: #c0c4cc;
      display: flex;
      align-items: center;
      justify-content: center;
    }
  }
  
  .suggestions {
    margin-top: 16px;
    
    .suggestions-header {
      margin-bottom: 8px;
      font-size: 14px;
      color: #606266;
    }
    
    .suggestion-tag {
      margin-right: 8px;
      margin-bottom: 8px;
      cursor: pointer;
      
      &:hover {
        opacity: 0.8;
      }
    }
  }
  
  .quick-translate {
    .example-tag {
      margin-right: 12px;
      margin-bottom: 12px;
      cursor: pointer;
      
      &:hover {
        opacity: 0.8;
      }
    }
  }
  
  .history-card {
    .history-list {
      max-height: 400px;
      overflow-y: auto;
    }
    
    .history-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      border-radius: 4px;
      cursor: pointer;
      transition: background-color 0.2s;
      
      &:hover {
        background-color: #f5f7fa;
      }
      
      .history-source,
      .history-target {
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .history-source {
        color: #303133;
      }
      
      .history-target {
        color: #606266;
      }
      
      .history-arrow {
        color: #c0c4cc;
      }
      
      .history-time {
        font-size: 12px;
        color: #909399;
        white-space: nowrap;
      }
    }
  }
}
</style>
