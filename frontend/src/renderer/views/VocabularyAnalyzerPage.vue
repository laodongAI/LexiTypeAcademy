<!--
  词汇解析工具页面
  
  分析单词/短语的详细信息，包括释义、用法、例句等
-->

<template>
  <div class="vocabulary-analyzer-page">
    <el-card class="tool-card">
      <template #header>
        <span>词汇解析</span>
      </template>

      <!-- 输入区 -->
      <div class="input-section">
        <el-input
          v-model="keyword"
          placeholder="输入单词或短语进行解析..."
          size="large"
          clearable
          @keyup.enter="analyze"
        >
          <template #append>
            <el-button :icon="Search" :loading="analyzing" @click="analyze">
              解析
            </el-button>
          </template>
        </el-input>
      </div>

      <!-- 快速示例 -->
      <div class="quick-examples">
        <span class="examples-label">快速示例：</span>
        <el-tag
          v-for="example in examples"
          :key="example"
          class="example-tag"
          @click="keyword = example; analyze()"
        >
          {{ example }}
        </el-tag>
      </div>
    </el-card>

    <!-- 解析结果 -->
    <el-card v-if="result" class="result-card">
      <template #header>
        <div class="result-header">
          <div class="word-info">
            <h2 class="word-title">{{ result.word }}</h2>
            <el-tag v-if="result.phonetic" size="small" type="info">
              {{ result.phonetic }}
            </el-tag>
          </div>
          <div class="actions">
            <el-button :icon="VideoPlay" circle @click="playAudio" title="播放发音" />
            <el-button :icon="Star" circle @click="addToFavorites" title="收藏" />
          </div>
        </div>
      </template>

      <!-- 基本信息 -->
      <el-descriptions :column="2" border class="word-details">
        <el-descriptions-item label="词性">
          <el-tag v-for="pos in result.partOfSpeech" :key="pos" size="small">
            {{ pos }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="难度">
          <el-tag :type="getDifficultyType(result.difficulty)" size="small">
            {{ result.difficulty }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="词频" :span="2">
          <el-progress
            :percentage="result.frequency"
            :color="getFrequencyColor(result.frequency)"
          />
        </el-descriptions-item>
      </el-descriptions>

      <!-- 释义 -->
      <el-divider content-position="left">释义</el-divider>
      <div class="definitions">
        <div v-for="(def, index) in result.definitions" :key="index" class="definition-item">
          <el-tag size="small" class="def-number">{{ index + 1 }}</el-tag>
          <span class="def-text">{{ def }}</span>
        </div>
      </div>

      <!-- 例句 -->
      <el-divider content-position="left">例句</el-divider>
      <div class="examples-section">
        <el-card
          v-for="(example, index) in result.examples"
          :key="index"
          class="example-card"
          shadow="hover"
        >
          <div class="example-en">{{ example.english }}</div>
          <div class="example-zh">{{ example.chinese }}</div>
        </el-card>
      </div>

      <!-- 词根词缀 -->
      <el-divider content-position="left">词根词缀</el-divider>
      <div v-if="result.etymology" class="etymology">
        <el-alert :closable="false" type="info">
          {{ result.etymology }}
        </el-alert>
      </div>

      <!-- 同义词/反义词 -->
      <el-row :gutter="20">
        <el-col :xs="24" :md="12">
          <el-divider content-position="left">同义词</el-divider>
          <div class="related-words">
            <el-tag
              v-for="word in result.synonyms"
              :key="word"
              class="related-tag"
              @click="keyword = word; analyze()"
            >
              {{ word }}
            </el-tag>
          </div>
        </el-col>
        <el-col :xs="24" :md="12">
          <el-divider content-position="left">反义词</el-divider>
          <div class="related-words">
            <el-tag
              v-for="word in result.antonyms"
              :key="word"
              class="related-tag"
              type="danger"
              @click="keyword = word; analyze()"
            >
              {{ word }}
            </el-tag>
          </div>
        </el-col>
      </el-row>

      <!-- 操作按钮 -->
      <el-divider />
      <div class="result-actions">
        <el-button type="primary" @click="addToCourse">
          <el-icon><Plus /></el-icon>
          加入课程
        </el-button>
        <el-button @click="practiceWord">
          <el-icon><Edit /></el-icon>
          开始练习
        </el-button>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  Search,
  VideoPlay,
  Star,
  Plus,
  Edit,
} from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 输入关键词
const keyword = ref('')
const analyzing = ref(false)

// 快速示例
const examples = ['abandon', 'benefit', 'challenge', 'determine', 'efficient']

// 解析结果
interface VocabularyResult {
  word: string
  phonetic: string
  partOfSpeech: string[]
  difficulty: string
  frequency: number
  definitions: string[]
  examples: Array<{ english: string; chinese: string }>
  etymology?: string
  synonyms: string[]
  antonyms: string[]
}

const result = ref<VocabularyResult | null>(null)

// 解析词汇
async function analyze() {
  if (!keyword.value.trim()) {
    ElMessage.warning('请输入要解析的词汇')
    return
  }
  
  analyzing.value = true
  
  try {
    // TODO: 调用真实的词汇分析 API
    await new Promise(resolve => setTimeout(resolve, 800))
    
    // 模拟解析结果
    result.value = {
      word: keyword.value,
      phonetic: '/əˈbændən/',
      partOfSpeech: ['v.', 'n.'],
      difficulty: 'CET-4',
      frequency: 75,
      definitions: [
        '放弃；抛弃；遗弃',
        '（因危险等）舍弃；离弃',
        '放纵；沉溺',
      ],
      examples: [
        {
          english: 'The crew abandoned the sinking ship.',
          chinese: '船员们弃船逃生。',
        },
        {
          english: 'He abandoned his family for another woman.',
          chinese: '他为了另一个女人抛弃了家庭。',
        },
        {
          english: 'The project was abandoned due to lack of funding.',
          chinese: '由于缺乏资金，该项目被放弃了。',
        },
      ],
      etymology: '来自古法语 abandoner，由 a（to）+ bandon（control）组成，字面意思是"放弃控制"。',
      synonyms: ['desert', 'forsake', 'leave', 'quit', 'give up'],
      antonyms: ['keep', 'retain', 'maintain', 'continue'],
    }
    
    ElMessage.success('解析完成')
  } catch (error) {
    console.error('解析失败:', error)
    ElMessage.error('解析失败，请重试')
  } finally {
    analyzing.value = false
  }
}

// 播放发音
function playAudio() {
  ElMessage.info('发音播放功能开发中')
}

// 收藏
function addToFavorites() {
  ElMessage.success('已收藏')
}

// 加入课程
function addToCourse() {
  ElMessage.success('已加入课程')
}

// 练习单词
function practiceWord() {
  ElMessage.info('练习功能开发中')
}

// 获取难度类型
function getDifficultyType(difficulty: string): 'success' | 'warning' | 'danger' | 'info' {
  if (difficulty.includes('CET-4') || difficulty.includes('初级')) return 'success'
  if (difficulty.includes('CET-6') || difficulty.includes('中级')) return 'warning'
  return 'info'
}

// 获取词频颜色
function getFrequencyColor(frequency: number): string {
  if (frequency >= 80) return '#67C23A'
  if (frequency >= 50) return '#409EFF'
  if (frequency >= 30) return '#E6A23C'
  return '#F56C6C'
}
</script>

<style lang="scss" scoped>
.vocabulary-analyzer-page {
  .tool-card {
    margin-bottom: 20px;
    
    .input-section {
      margin-bottom: 16px;
    }
    
    .quick-examples {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      
      .examples-label {
        font-size: 14px;
        color: #909399;
      }
      
      .example-tag {
        cursor: pointer;
        
        &:hover {
          opacity: 0.8;
        }
      }
    }
  }
  
  .result-card {
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      
      .word-info {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .word-title {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
          color: #303133;
        }
      }
      
      .actions {
        display: flex;
        gap: 8px;
      }
    }
    
    .word-details {
      margin-bottom: 20px;
    }
    
    .definitions {
      .definition-item {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        padding: 8px 0;
        
        .def-number {
          flex-shrink: 0;
        }
        
        .def-text {
          line-height: 1.8;
        }
      }
    }
    
    .examples-section {
      display: grid;
      gap: 12px;
      
      .example-card {
        padding: 16px;
        
        .example-en {
          margin-bottom: 8px;
          font-size: 15px;
          color: #303133;
          line-height: 1.6;
        }
        
        .example-zh {
          font-size: 14px;
          color: #606266;
          line-height: 1.6;
        }
      }
    }
    
    .etymology {
      margin-bottom: 20px;
    }
    
    .related-words {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      
      .related-tag {
        cursor: pointer;
        
        &:hover {
          opacity: 0.8;
        }
      }
    }
    
    .result-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
    }
  }
}
</style>
