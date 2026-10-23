<!--
  AI 实验室页面
  
  AI 辅助学习功能
-->

<template>
  <div class="ailab-page">
    <!-- 页面介绍 -->
    <div class="page-intro">
      <h2>AI 工具实验室</h2>
      <p>利用 AI 技术辅助学习，提供智能课程生成、写作辅助等功能</p>
    </div>
    
    <el-row :gutter="24" class="ailab-content">
      <!-- 左侧功能列表 -->
      <transition name="slide-left">
        <el-col v-show="!sidebarCollapsed" :span="sidebarCollapsed ? 0 : 8" class="sidebar-col">
          <el-card class="features-card">
            <template #header>
              <div class="features-header">
                <span>AI 功能</span>
                <el-button text @click="toggleSidebar" class="collapse-btn">
                  <el-icon><DArrowLeft /></el-icon>
                </el-button>
              </div>
            </template>
            
            <div class="feature-list">
              <div 
                v-for="feature in features" 
                :key="feature.id"
                class="feature-item"
                :class="{ active: selectedFeature?.id === feature.id }"
                @click="selectFeature(feature)"
              >
                <el-icon :size="24">
                  <component :is="feature.icon" />
                </el-icon>
                <div class="feature-info">
                  <h4>{{ feature.title }}</h4>
                  <p>{{ feature.description }}</p>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </transition>
      
      <!-- 右侧功能区 -->
      <el-col :span="sidebarCollapsed ? 24 : 16">
        <!-- 展开按钮（侧边栏折叠时显示） -->
        <el-button 
          v-if="sidebarCollapsed" 
          text 
          @click="toggleSidebar" 
          class="expand-sidebar-btn"
        >
          <el-icon><DArrowRight /></el-icon>
          展开功能列表
        </el-button>
        
        <el-card v-if="selectedFeature" class="feature-content-card">
          <template #header>
            <div class="card-header">
              <span>{{ selectedFeature.title }}</span>
              <el-tag type="success">Beta</el-tag>
            </div>
          </template>
          
          <!-- AI 课程生成器 -->
          <div v-if="selectedFeature.id === 'course-generator'" class="course-generator">
            <el-form :model="courseForm" label-width="120px">
              <el-form-item label="课程主题">
                <el-input
                  v-model="courseForm.topic"
                  placeholder="例如：日常生活对话、商务英语等"
                />
              </el-form-item>
              
              <el-form-item label="难度等级">
                <el-radio-group v-model="courseForm.level">
                  <el-radio value="beginner">初级</el-radio>
                  <el-radio value="intermediate">中级</el-radio>
                  <el-radio value="advanced">高级</el-radio>
                </el-radio-group>
              </el-form-item>
              
              <el-form-item label="课程数量">
                <el-input-number
                  v-model="courseForm.lessonCount"
                  :min="1"
                  :max="50"
                />
              </el-form-item>
              
              <el-form-item label="每课单词数">
                <el-input-number
                  v-model="courseForm.wordsPerLesson"
                  :min="5"
                  :max="50"
                />
              </el-form-item>
              
              <el-form-item label="附加说明">
                <el-input
                  v-model="courseForm.notes"
                  type="textarea"
                  :rows="4"
                  placeholder="描述您想要的课程内容、风格等..."
                />
              </el-form-item>
              
              <el-form-item>
                <el-button
                  type="primary"
                  :loading="courseGenerating"
                  @click="generateCourse"
                >
                  生成课程
                </el-button>
              </el-form-item>
            </el-form>

            <div v-if="pendingCourseSource === 'course-generator' && pendingCourse" class="course-preview">
              <el-divider content-position="left">生成预览</el-divider>
              <el-alert v-if="saveCourseError" type="error" :closable="false" show-icon>
                {{ saveCourseError }}
              </el-alert>
              <el-alert v-else-if="savedCourseId" type="success" :closable="false" show-icon>
                已保存为课程。
              </el-alert>

              <div class="preview-meta">
                <div class="meta-title">{{ pendingCourse.title }}</div>
                <div class="meta-desc">{{ pendingCourse.description }}</div>
                <div class="meta-stats">课时数：{{ pendingCourse.lessons.length }}</div>
              </div>

              <el-table :data="pendingCourse.lessons" stripe style="width: 100%">
                <el-table-column prop="title" label="课时" />
                <el-table-column label="项目数" width="100">
                  <template #default="scope">
                    {{ scope.row.items?.length || 0 }}
                  </template>
                </el-table-column>
              </el-table>

              <div class="preview-actions">
                <el-button
                  type="primary"
                  :loading="saveCourseLoading"
                  :disabled="!!savedCourseId"
                  @click="savePendingCourse"
                >
                  保存为课程
                </el-button>
                <el-button
                  v-if="savedCourseId"
                  type="success"
                  plain
                  @click="openSavedCourse"
                >
                  打开课程
                </el-button>
                <el-button @click="clearPendingCourse">清空预览</el-button>
              </div>
            </div>
          </div>
          
          <!-- 音频导入向导 -->
          <div v-if="selectedFeature.id === 'audio-import'" class="audio-import">
            <el-steps :active="audioImportStep" align-center>
              <el-step title="选择音频" />
              <el-step title="识别内容" />
              <el-step title="生成课程" />
            </el-steps>
            
            <div class="step-content">
              <div v-if="audioImportStep === 0" class="step-panel">
                <el-upload
                  drag
                  :auto-upload="false"
                  accept="audio/*"
                >
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                  <div class="el-upload__text">
                    拖拽音频文件到这里，或 <em>点击选择</em>
                  </div>
                  <template #tip>
                    <div class="el-upload__tip">
                      支持 MP3, WAV, M4A 等常见音频格式
                    </div>
                  </template>
                </el-upload>
              </div>
              
              <div v-if="audioImportStep === 1" class="step-panel">
                <el-alert title="正在识别音频内容..." type="info" :closable="false">
                  <el-progress :percentage="50" />
                </el-alert>
              </div>
              
              <div v-if="audioImportStep === 2" class="step-panel">
                <el-form label-width="100px">
                  <el-form-item label="课程名称">
                    <el-input v-model="audioImportForm.courseName" />
                  </el-form-item>
                  <el-form-item label="分段方式">
                    <el-radio-group v-model="audioImportForm.segmentMode">
                      <el-radio value="sentence">按句子</el-radio>
                      <el-radio value="paragraph">按段落</el-radio>
                      <el-radio value="time">按时间</el-radio>
                    </el-radio-group>
                  </el-form-item>
                </el-form>

                <div v-if="pendingCourseSource === 'audio-import' && pendingCourse" class="course-preview">
                  <el-divider content-position="left">生成预览</el-divider>
                  <el-alert v-if="saveCourseError" type="error" :closable="false" show-icon>
                    {{ saveCourseError }}
                  </el-alert>
                  <el-alert v-else-if="savedCourseId" type="success" :closable="false" show-icon>
                    已保存为课程。
                  </el-alert>

                  <div class="preview-meta">
                    <div class="meta-title">{{ pendingCourse.title }}</div>
                    <div class="meta-desc">{{ pendingCourse.description }}</div>
                    <div class="meta-stats">课时数：{{ pendingCourse.lessons.length }}</div>
                  </div>

                  <el-table :data="pendingCourse.lessons" stripe style="width: 100%">
                    <el-table-column prop="title" label="课时" />
                    <el-table-column label="项目数" width="100">
                      <template #default="scope">
                        {{ scope.row.items?.length || 0 }}
                      </template>
                    </el-table-column>
                  </el-table>

                  <div class="preview-actions">
                    <el-button
                      type="primary"
                      :loading="saveCourseLoading"
                      :disabled="!!savedCourseId"
                      @click="savePendingCourse"
                    >
                      保存为课程
                    </el-button>
                    <el-button
                      v-if="savedCourseId"
                      type="success"
                      plain
                      @click="openSavedCourse"
                    >
                      打开课程
                    </el-button>
                    <el-button @click="clearPendingCourse">清空预览</el-button>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="step-actions">
              <el-button v-if="audioImportStep > 0" @click="audioImportStep--">
                上一步
              </el-button>
              <el-button
                v-if="audioImportStep < 2"
                type="primary"
                @click="audioImportStep++"
              >
                下一步
              </el-button>
              <el-button
                v-else
                type="primary"
                :loading="audioImporting"
                @click="importFromAudio"
              >
                完成导入
              </el-button>
            </div>
          </div>
          
          <!-- 教材导入向导 -->
          <div v-if="selectedFeature.id === 'textbook-import'" class="textbook-import">
            <el-tabs v-model="textbookImportTab">
              <el-tab-pane label="文本导入" name="text">
                <el-form label-width="100px">
                  <el-form-item label="教材内容">
                    <el-input
                      v-model="textbookImportForm.content"
                      type="textarea"
                      :rows="15"
                      placeholder="粘贴教材文本内容..."
                    />
                  </el-form-item>
                  <el-form-item label="课程名称">
                    <el-input v-model="textbookImportForm.courseName" />
                  </el-form-item>
                </el-form>

                <div v-if="pendingCourseSource === 'textbook-import' && pendingCourse" class="course-preview">
                  <el-divider content-position="left">生成预览</el-divider>
                  <el-alert v-if="saveCourseError" type="error" :closable="false" show-icon>
                    {{ saveCourseError }}
                  </el-alert>
                  <el-alert v-else-if="savedCourseId" type="success" :closable="false" show-icon>
                    已保存为课程。
                  </el-alert>

                  <div class="preview-meta">
                    <div class="meta-title">{{ pendingCourse.title }}</div>
                    <div class="meta-desc">{{ pendingCourse.description }}</div>
                    <div class="meta-stats">课时数：{{ pendingCourse.lessons.length }}</div>
                  </div>

                  <el-table :data="pendingCourse.lessons" stripe style="width: 100%">
                    <el-table-column prop="title" label="课时" />
                    <el-table-column label="项目数" width="100">
                      <template #default="scope">
                        {{ scope.row.items?.length || 0 }}
                      </template>
                    </el-table-column>
                  </el-table>

                  <div class="preview-actions">
                    <el-button
                      type="primary"
                      :loading="saveCourseLoading"
                      :disabled="!!savedCourseId"
                      @click="savePendingCourse"
                    >
                      保存为课程
                    </el-button>
                    <el-button
                      v-if="savedCourseId"
                      type="success"
                      plain
                      @click="openSavedCourse"
                    >
                      打开课程
                    </el-button>
                    <el-button @click="clearPendingCourse">清空预览</el-button>
                  </div>
                </div>
              </el-tab-pane>
              
              <el-tab-pane label="文件导入" name="file">
                <el-upload
                  drag
                  :auto-upload="false"
                  accept=".txt,.pdf,.docx"
                >
                  <el-icon class="el-icon--upload"><upload-filled /></el-icon>
                  <div class="el-upload__text">
                    拖拽教材文件到这里，或 <em>点击选择</em>
                  </div>
                  <template #tip>
                    <div class="el-upload__tip">
                      支持 TXT, PDF, DOCX 格式
                    </div>
                  </template>
                </el-upload>
              </el-tab-pane>

              <el-tab-pane label="教材引导" name="guide">
                <TextbookCourseSystemBuilder
                  :ai-service="aiService"
                  :is-a-i-configured="isAIConfigured"
                  @preview="handleTextbookGuidePreview"
                  @require-config="showAIConfigGuide"
                />

                <div v-if="pendingCourseSource === 'textbook-guide' && pendingCourse" class="course-preview">
                  <el-divider content-position="left">生成预览</el-divider>
                  <el-alert v-if="saveCourseError" type="error" :closable="false" show-icon>
                    {{ saveCourseError }}
                  </el-alert>
                  <el-alert v-else-if="savedCourseId" type="success" :closable="false" show-icon>
                    已保存为课程。
                  </el-alert>

                  <div class="preview-meta">
                    <div class="meta-title">{{ pendingCourse.title }}</div>
                    <div class="meta-desc">{{ pendingCourse.description }}</div>
                    <div class="meta-stats">课时数：{{ pendingCourse.lessons.length }}</div>
                  </div>

                  <el-table :data="pendingCourse.lessons" stripe style="width: 100%">
                    <el-table-column prop="title" label="课时" />
                    <el-table-column label="项目数" width="100">
                      <template #default="scope">
                        {{ scope.row.items?.length || 0 }}
                      </template>
                    </el-table-column>
                  </el-table>

                  <div class="preview-actions">
                    <el-button
                      type="primary"
                      :loading="saveCourseLoading"
                      :disabled="!!savedCourseId"
                      @click="savePendingCourse"
                    >
                      保存为课程
                    </el-button>
                    <el-button v-if="savedCourseId" type="success" plain @click="openSavedCourse">
                      打开课程
                    </el-button>
                    <el-button @click="clearPendingCourse">清空预览</el-button>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
            
            <div class="action-buttons">
              <el-button
                type="primary"
                :loading="textbookImporting"
                @click="importFromTextbook"
              >
                开始导入
              </el-button>
            </div>
          </div>
          
          <!-- AI 写作助手 -->
          <div v-if="selectedFeature.id === 'writing'" class="writing-assistant">
            <el-input
              v-model="writingInput"
              type="textarea"
              :rows="4"
              placeholder="输入你想表达的内容，AI 会帮你优化..."
            />
            <div class="action-buttons">
              <el-button type="primary" :loading="isProcessing" @click="processWriting">
                AI 优化
              </el-button>
            </div>
            <div v-if="writingOutput" class="output-area">
              <h4>优化结果</h4>
              <p>{{ writingOutput }}</p>
            </div>
          </div>
          
          <!-- AI 发音评测 -->
          <div v-if="selectedFeature.id === 'pronunciation'" class="pronunciation-test">
            <div class="target-text">
              <span class="label">目标文本：</span>
              <span class="text">{{ pronunciationTarget }}</span>
              <el-button text @click="playTarget">
                <el-icon><Microphone /></el-icon> 播放
              </el-button>
            </div>
            <el-button 
              :type="isRecording ? 'danger' : 'primary'"
              size="large"
              :icon="isRecording ? 'Close' : 'Microphone'"
              @click="toggleRecording"
            >
              {{ isRecording ? '停止录音' : '开始录音' }}
            </el-button>
            <div v-if="pronunciationScore" class="score-result">
              <el-progress 
                type="circle" 
                :percentage="pronunciationScore"
                :color="getScoreColor(pronunciationScore)"
              />
              <p class="score-label">发音评分</p>
            </div>
          </div>
          
          <!-- AI 词汇推荐 -->
          <div v-if="selectedFeature.id === 'vocabulary'" class="vocabulary-recommend">
            <div class="recommend-options">
              <el-select v-model="vocabLevel" placeholder="选择级别">
                <el-option label="HSK 1" value="hsk1" />
                <el-option label="HSK 2" value="hsk2" />
                <el-option label="HSK 3" value="hsk3" />
                <el-option label="HSK 4" value="hsk4" />
              </el-select>
              <el-button type="primary" @click="getRecommendations">
                获取推荐
              </el-button>
            </div>
            <div class="vocab-list">
              <div v-for="word in recommendedWords" :key="word.id" class="vocab-item">
                <span class="word">{{ word.character }}</span>
                <span class="pinyin">{{ word.pinyin }}</span>
                <span class="meaning">{{ word.meaning }}</span>
                <el-button text size="small">添加到学习</el-button>
              </div>
            </div>
          </div>
          
          <!-- AI 对话练习 -->
          <div v-if="selectedFeature.id === 'conversation'" class="conversation-practice">
            <div class="chat-messages">
              <div 
                v-for="msg in messages" 
                :key="msg.id" 
                class="message"
                :class="msg.role"
              >
                <div class="message-content">{{ msg.content }}</div>
              </div>
            </div>
            <div class="chat-input">
              <el-input 
                v-model="chatInput" 
                placeholder="输入你的回复..."
                @keyup.enter="sendMessage"
              />
              <el-button type="primary" @click="sendMessage">发送</el-button>
            </div>
          </div>
        </el-card>
        
        <el-empty v-else description="选择一个 AI 功能开始体验" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, defineAsyncComponent, markRaw } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  Edit, 
  Microphone, 
  Collection, 
  ChatDotRound,
  DArrowLeft,
  DArrowRight,
} from '@element-plus/icons-vue'
import { getAIService, AIError, AIErrorCode } from '../../shared/services/ai'
import type { 
  CourseGenerationRequest, 
  AIMessage,
  WordEntry 
} from '../../shared/services/ai'
import { useCourseStore } from '../stores/courseStore'
import { ContentShape } from '../../shared/types/course'
import type { Course, Lesson, LessonItem } from '../../shared/types/course'

const TextbookCourseSystemBuilder = defineAsyncComponent(
  () => import('../components/ai/TextbookCourseSystemBuilder.vue') as any
)

// 获取 AI 服务实例
let aiService: ReturnType<typeof getAIService> | null = null
try {
  aiService = getAIService()
} catch (error) {
  console.warn('AI 服务初始化失败，请配置 API Key', error)
}

// AI 配置状态
const isAIConfigured = ref(aiService?.isConfigured() ?? false)

const router = useRouter()
const courseStore = useCourseStore()

type PendingCourseData = Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lessonCount'>
const pendingCourse = ref<PendingCourseData | null>(null)
const pendingCourseSource = ref<'course-generator' | 'textbook-guide' | 'audio-import' | 'textbook-import' | ''>('')
const saveCourseLoading = ref(false)
const saveCourseError = ref<string | null>(null)
const savedCourseId = ref<string | null>(null)

// AI 功能列表
interface Feature {
  id: string
  title: string
  description: string
  icon: typeof Edit
}

const features = ref<Feature[]>([
  {
    id: 'course-generator',
    title: 'AI 课程生成器',
    description: 'AI 自动生成完整课程内容',
    icon: markRaw(Edit),
  },
  {
    id: 'audio-import',
    title: '音频导入向导',
    description: '从音频自动识别生成课程',
    icon: markRaw(Microphone),
  },
  {
    id: 'textbook-import',
    title: '教材导入向导',
    description: '导入教材转换为互动课程',
    icon: markRaw(Collection),
  },
  {
    id: 'writing',
    title: 'AI 写作助手',
    description: '帮助你优化中文表达',
    icon: markRaw(Edit),
  },
  {
    id: 'pronunciation',
    title: 'AI 发音评测',
    description: '评估你的发音准确度',
    icon: markRaw(Microphone),
  },
  {
    id: 'vocabulary',
    title: 'AI 词汇推荐',
    description: '智能推荐适合你的词汇',
    icon: markRaw(Collection),
  },
  {
    id: 'conversation',
    title: 'AI 对话练习',
    description: '与 AI 进行中文对话',
    icon: markRaw(ChatDotRound),
  },
])

// 当前选中的功能
const selectedFeature = ref<Feature | null>(null)

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏
function toggleSidebar() {
  sidebarCollapsed.value = !sidebarCollapsed.value
}

// AI 课程生成器
const courseGenerating = ref(false)
const courseForm = ref({
  topic: '',
  level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
  lessonCount: 10,
  wordsPerLesson: 20,
  notes: ''
})

// 音频导入向导
const audioImportStep = ref(0)
const audioImporting = ref(false)
const audioImportForm = ref({
  courseName: '',
  segmentMode: 'sentence' as 'sentence' | 'paragraph' | 'time',
  lessonCount: 5,
  wordsPerLesson: 10
})

// 教材导入向导
const textbookImportTab = ref('text')
const textbookImporting = ref(false)
const textbookImportForm = ref({
  content: '',
  courseName: '',
  mode: 'extract' as 'extract' | 'generate'
})

// 写作助手
const writingInput = ref('')
const writingOutput = ref('')
const isProcessing = ref(false)

// 发音评测
const pronunciationTarget = ref('你好，很高兴认识你')
const isRecording = ref(false)
const pronunciationScore = ref<number | null>(null)

// 词汇推荐
const vocabLevel = ref('hsk1')
const recommendedWords = ref([
  { id: '1', character: '学习', pinyin: 'xuéxí', meaning: '学习' },
  { id: '2', character: '工作', pinyin: 'gōngzuò', meaning: '工作' },
])

// 对话练习
const chatInput = ref('')
const messages = ref([
  { id: '1', role: 'assistant', content: '你好！今天想聊什么话题？' },
])

// 选择功能
function selectFeature(feature: Feature) {
  selectedFeature.value = feature
}

// 处理写作
async function processWriting() {
  if (!writingInput.value.trim()) {
    ElMessage.warning('请输入要优化的内容')
    return
  }

  if (!aiService || !aiService.isConfigured()) {
    showAIConfigGuide()
    return
  }

  isProcessing.value = true
  try {
    // 构建提示词
    const prompt = `
Please improve and optimize the following English text. Make it more natural, grammatically correct, and fluent:

"${writingInput.value}"

Provide the improved version only.
    `.trim()

    // 调用 AI 服务
    const result = await aiService.call(
      prompt,
      'You are an English writing assistant.',
      { temperature: 0.5, maxTokens: 500 }
    )

    writingOutput.value = result
    ElMessage.success('内容优化完成！')
  } catch (error: any) {
    console.error('写作处理失败:', error)
    ElMessage.error(error.message || '写作处理失败')
  } finally {
    isProcessing.value = false
  }
}

// 播放目标文本
function playTarget() {
  // TODO: 调用 TTS API
  console.log('播放:', pronunciationTarget.value)
}

// 切换录音
function toggleRecording() {
  isRecording.value = !isRecording.value
  if (!isRecording.value) {
    // 模拟评分
    pronunciationScore.value = Math.floor(Math.random() * 30) + 70
  }
}

// 获取评分颜色
function getScoreColor(score: number) {
  if (score >= 90) return '#67c23a'
  if (score >= 70) return '#e6a23c'
  return '#f56c6c'
}

// 显示 AI 配置引导
function showAIConfigGuide() {
  ElMessageBox.alert(
    `请先配置 AI 模型，点击下方"前往设置"按钮进入设置页面配置 AI API Key。`,
    '需要 AI 配置',
    {
      confirmButtonText: '前往设置',
      cancelButtonText: '取消',
      type: 'warning',
      callback: (action: string) => {
        if (action === 'confirm') {
          router.push('/settings?tab=ai')
        }
      }
    }
  )
}

// 检查 AI 配置
function checkAIConfig() {
  try {
    const { getAIService: reloadAIService, resetAIService } = require('../../shared/services/ai')
    resetAIService()
    const newAiService = reloadAIService()
    if (newAiService.isConfigured()) {
      aiService = newAiService
      isAIConfigured.value = true
      ElMessage.success('✅ AI 配置检测成功！')
    } else {
      ElMessage.warning('未检测到有效的 API Key 配置，请在设置中配置')
    }
  } catch (error: any) {
    ElMessage.error('配置检测失败: ' + error.message)
  }
}

function handleTextbookGuidePreview(course: PendingCourseData) {
  pendingCourse.value = course
  pendingCourseSource.value = 'textbook-guide'
  savedCourseId.value = null
  saveCourseError.value = null
}

// 生成课程
async function generateCourse() {
  if (!courseForm.value.topic) {
    ElMessage.warning('请输入课程主题')
    return
  }

  if (!aiService || !aiService.isConfigured()) {
    showAIConfigGuide()
    return
  }

  courseGenerating.value = true
  try {
    const request: CourseGenerationRequest = {
      topic: courseForm.value.topic,
      level: courseForm.value.level,
      lessonCount: courseForm.value.lessonCount,
      wordsPerLesson: courseForm.value.wordsPerLesson,
      notes: courseForm.value.notes
    }

    // 调用 AI 服务生成课程
    const result = await aiService.generateCourse(request, (content) => {
      console.log('生成进度:', content.length)
    })

    pendingCourse.value = convertGeneratedCourseToPendingCourse(result, {
      topic: courseForm.value.topic,
      level: courseForm.value.level
    })
    pendingCourseSource.value = 'course-generator'
    savedCourseId.value = null
    saveCourseError.value = null

  } catch (error: any) {
    console.error('课程生成失败:', error)
    ElMessage.error(error.message || '课程生成失败')
  } finally {
    courseGenerating.value = false
  }
}

// 获取词汇推荐
function getRecommendations() {
  // TODO: 调用 AI API
  console.log('获取推荐:', vocabLevel.value)
}

// 从音频导入
async function importFromAudio() {
  if (!aiService || !aiService.isConfigured()) {
    showAIConfigGuide()
    return
  }

  audioImporting.value = true
  try {
    // TODO: 1. 调用 ASR 服务识别音频
    // const transcription = await asrService.transcribe(audioFile)
    
    // 示例：模拟转录结果
    const mockTranscription = `
      Hello everyone, welcome to our English learning course. 
      Today we will learn some common words and phrases used in daily conversations.
      We will start with greetings, introductions, and basic expressions.
    `

    ElMessage.info('正在从音频生成课程...')

    // 2. 使用 AI 从转录生成课程
    const result = await aiService.generateCourseFromAudio(
      mockTranscription,
      audioImportForm.value.lessonCount || 5,
      audioImportForm.value.wordsPerLesson || 10
    )

    pendingCourse.value = convertGeneratedCourseToPendingCourse(result, {
      topic: audioImportForm.value.courseName || '音频导入',
      level: 'intermediate'
    })
    if (audioImportForm.value.courseName) {
      pendingCourse.value.title = audioImportForm.value.courseName
    }
    pendingCourseSource.value = 'audio-import'
    savedCourseId.value = null
    saveCourseError.value = null

    // 保持在最后一步，让用户预览后手动保存
    audioImportStep.value = 2
  } catch (error: any) {
    console.error('音频导入失败:', error)
    ElMessage.error(error.message || '音频导入失败')
  } finally {
    audioImporting.value = false
  }
}

// 从教材导入
async function importFromTextbook() {
  if (!aiService || !aiService.isConfigured()) {
    showAIConfigGuide()
    return
  }

  textbookImporting.value = true
  try {
    // TODO: 1. 读取教材文件内容
    // const content = await readFile(textbookFile)

    // 示例：模拟教材内容
    const mockContent = `
      Chapter 1: Greetings and Introductions
      
      Key Vocabulary:
      - hello: a greeting
      - goodbye: a farewell
      - please: used to make a polite request
      - thank you: expression of gratitude
      - welcome: to greet someone in a friendly way
      
      In this chapter, we learn basic greetings and how to introduce ourselves...
    `

    ElMessage.info('正在从教材生成课程...')

    // 2. 使用 AI 从教材生成课程
    const extractWords = textbookImportForm.value.mode === 'extract'
    const result = await aiService.generateCourseFromTextbook(mockContent, extractWords)

    pendingCourse.value = extractWords
      ? convertExtractedWordsToPendingCourse(result as any, {
          courseName: textbookImportForm.value.courseName || '教材导入',
          wordsPerLesson: courseForm.value.wordsPerLesson || 20
        })
      : convertGeneratedCourseToPendingCourse(result as any, {
          topic: textbookImportForm.value.courseName || '教材导入',
          level: courseForm.value.level
        })

    if (textbookImportForm.value.courseName) {
      pendingCourse.value.title = textbookImportForm.value.courseName
    }
    pendingCourseSource.value = 'textbook-import'
    savedCourseId.value = null
    saveCourseError.value = null
  } catch (error: any) {
    console.error('教材导入失败:', error)
    ElMessage.error(error.message || '教材导入失败')
  } finally {
    textbookImporting.value = false
  }
}

// 发送消息（AI 对话）
async function sendMessage() {
  if (!chatInput.value.trim()) return

  if (!aiService || !aiService.isConfigured()) {
    showAIConfigGuide()
    return
  }

  const userMessage = chatInput.value.trim()
  messages.value.push({
    id: Date.now().toString(),
    role: 'user',
    content: userMessage,
  })
  chatInput.value = ''

  try {
    // 构建对话历史
    const aiMessages: AIMessage[] = messages.value.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    }))

    // 添加系统提示词
    aiMessages.unshift({
      role: 'system',
      content: 'You are a helpful English teacher. Help students practice English conversation.'
    })

    // 调用 AI 服务
    const response = await aiService.chat(aiMessages, { temperature: 0.8 })

    // 添加 AI 回复
    messages.value.push({
      id: Date.now().toString(),
      role: 'assistant',
      content: response,
    })
  } catch (error: any) {
    console.error('AI 对话失败:', error)
    ElMessage.error(error.message || 'AI 对话失败')
  }
}

async function savePendingCourse() {
  if (!pendingCourse.value) return
  saveCourseLoading.value = true
  saveCourseError.value = null
  try {
    const id = await courseStore.createCourse(pendingCourse.value)
    savedCourseId.value = id
  } catch (e: any) {
    saveCourseError.value = e?.message || '保存课程失败'
  } finally {
    saveCourseLoading.value = false
  }
}

function clearPendingCourse() {
  pendingCourse.value = null
  pendingCourseSource.value = ''
  savedCourseId.value = null
  saveCourseError.value = null
}

function openSavedCourse() {
  if (!savedCourseId.value) return
  router.push(`/courses/${savedCourseId.value}`)
}

function convertGeneratedCourseToPendingCourse(
  result: any,
  context: { topic?: string; level?: 'beginner' | 'intermediate' | 'advanced' }
): PendingCourseData {
  const now = Date.now()
  const difficulty = context.level || 'beginner'
  const lessons: Lesson[] = (result.lessons || []).map((l: any, idx: number) => {
    const lessonId = `ai_lesson_${now}_${idx}_${Math.random().toString(36).slice(2, 8)}`
    const items: LessonItem[] = (l.words || []).map((w: any, widx: number) => {
      const itemId = `ai_item_${now}_${idx}_${widx}_${Math.random().toString(36).slice(2, 8)}`
      return {
        id: itemId,
        english: String(w.word || '').trim(),
        chinese: String(w.translation || w.meaning || '').trim(),
        phonetic: w.phonetic,
        partOfSpeech: w.partOfSpeech,
        examples: w.example ? [String(w.example)] : undefined
      }
    }).filter((it: LessonItem) => !!it.english)

    return {
      id: lessonId,
      title: l.lessonName || `Lesson ${idx + 1}`,
      description: l.description || '',
      contentShape: ContentShape.Word,
      items,
      createdAt: now,
      updatedAt: now
    }
  })

  return {
    title: result.courseName || `AI课程：${context.topic || ''}`,
    description: result.description || `AI 生成课程（主题：${context.topic || '未命名'}）`,
    category: 'special',
    difficulty,
    lessons,
    tags: [context.topic || 'AI', 'AI'].filter(Boolean)
  }
}

function convertExtractedWordsToPendingCourse(
  words: Array<{ word: string; meaning?: string; translation?: string; phonetic?: string; example?: string; partOfSpeech?: string }>,
  context: { courseName: string; wordsPerLesson: number }
): PendingCourseData {
  const now = Date.now()
  const perLesson = Math.max(5, Math.min(50, context.wordsPerLesson || 20))
  const normalized = (words || []).map(w => ({
    word: String(w.word || '').trim(),
    translation: String(w.translation || w.meaning || '').trim(),
    phonetic: w.phonetic,
    example: w.example,
    partOfSpeech: w.partOfSpeech
  })).filter(w => !!w.word)

  const lessons: Lesson[] = []
  const totalLessons = Math.max(1, Math.ceil(normalized.length / perLesson))

  for (let i = 0; i < totalLessons; i++) {
    const slice = normalized.slice(i * perLesson, (i + 1) * perLesson)
    const items: LessonItem[] = slice.map((w, widx) => ({
      id: `ai_item_${now}_${i}_${widx}_${Math.random().toString(36).slice(2, 8)}`,
      english: w.word,
      chinese: w.translation,
      phonetic: w.phonetic,
      partOfSpeech: w.partOfSpeech,
      examples: w.example ? [String(w.example)] : undefined
    }))

    lessons.push({
      id: `ai_lesson_${now}_${i}_${Math.random().toString(36).slice(2, 8)}`,
      title: `导入词汇 ${i + 1}`,
      description: '',
      contentShape: ContentShape.Word,
      items,
      createdAt: now,
      updatedAt: now
    })
  }

  return {
    title: context.courseName,
    description: `教材提取词汇（总词数：${normalized.length}）`,
    category: 'special',
    difficulty: 'intermediate',
    lessons,
    tags: ['教材', '导入', 'AI']
  }
}
</script>

<style lang="scss" scoped>
.ailab-page {
  max-width: 1200px;
  margin: 0 auto;
}

.page-intro {
  margin-bottom: 24px;
  padding: 24px;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.05) 0%, rgba(64, 158, 255, 0.02) 100%);
  border-radius: 12px;
  border: 1px solid rgba(64, 158, 255, 0.1);
  
  h2 {
    margin: 0 0 8px 0;
    color: var(--text-color);
    font-size: 24px;
    font-weight: 600;
  }
  
  p {
    margin: 0;
    color: var(--text-color-secondary);
    font-size: 14px;
  }
}

.config-alert {
  margin-bottom: 20px;
  
  :deep(.el-alert__content) {
    width: 100%;
  }
}

.ailab-content {
  position: relative;
}

.sidebar-col {
  transition: all 0.3s ease;
}

.features-card {
  :deep(.el-card__header) {
    background: linear-gradient(90deg, rgba(64, 158, 255, 0.08) 0%, rgba(64, 158, 255, 0.03) 100%);
    border-bottom: 2px solid rgba(64, 158, 255, 0.15);
    padding: 16px 20px;
  }
  
  .features-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    
    span {
      font-weight: 600;
      font-size: 16px;
      color: var(--text-color);
    }
    
    .collapse-btn {
      padding: 4px 8px;
      
      &:hover {
        background-color: rgba(64, 158, 255, 0.1);
      }
    }
  }
}

.expand-sidebar-btn {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 8px;
}

// 侧边栏滑动动画
.slide-left-enter-active,
.slide-left-leave-active {
  transition: all 0.3s ease;
}

.slide-left-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.slide-left-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.feature-list {
  height: calc(100vh - 180px);
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.feature-item {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
  border: 2px solid transparent;
  position: relative;
  overflow: hidden;
  
  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    width: 4px;
    height: 100%;
    background: var(--primary-color);
    transform: scaleY(0);
    transition: transform 0.3s ease;
  }
  
  &:hover {
    background-color: var(--bg-color-hover);
    border-color: rgba(64, 158, 255, 0.2);
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    
    &::before {
      transform: scaleY(1);
    }
  }
  
  &.active {
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.1) 0%, rgba(64, 158, 255, 0.05) 100%);
    border-color: var(--primary-color);
    color: var(--primary-color);
    box-shadow: 0 4px 16px rgba(64, 158, 255, 0.2);
    
    &::before {
      transform: scaleY(1);
    }
    
    h4 {
      color: var(--primary-color);
      font-weight: 600;
    }
    
    p {
      color: var(--text-color);
      opacity: 0.8;
    }
    
    .el-icon {
      color: var(--primary-color);
    }
  }
  
  .el-icon {
    flex-shrink: 0;
    margin-top: 2px;
    transition: transform 0.3s ease;
  }
  
  &:hover .el-icon {
    transform: scale(1.1);
  }
  
  .feature-info {
    flex: 1;
    
    h4 {
      margin: 0 0 6px 0;
      font-size: 15px;
      font-weight: 500;
      transition: color 0.2s;
    }
    
    p {
      margin: 0;
      font-size: 13px;
      color: var(--text-color-secondary);
      line-height: 1.5;
    }
  }
}

.feature-content-card {
  min-height: 500px;
  
  :deep(.el-card__header) {
    background: linear-gradient(90deg, rgba(64, 158, 255, 0.08) 0%, rgba(64, 158, 255, 0.03) 100%);
    border-bottom: 2px solid rgba(64, 158, 255, 0.15);
    padding: 16px 20px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  
  span {
    font-weight: 600;
    font-size: 16px;
    color: var(--text-color);
  }
}

.course-preview {
  margin-top: 16px;
}

.preview-meta {
  margin: 8px 0 12px 0;
}

.meta-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.meta-desc {
  color: var(--text-color-secondary);
  margin-bottom: 4px;
}

.meta-stats {
  color: var(--text-color-secondary);
  font-size: 13px;
}

.preview-actions {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

// 写作助手
.writing-assistant {
  .action-buttons {
    margin: 16px 0;
  }
  
  .output-area {
    padding: 16px;
    background-color: var(--bg-color-hover);
    border-radius: 8px;
    
    h4 {
      margin: 0 0 8px 0;
      color: var(--text-color);
    }
    
    p {
      margin: 0;
      color: var(--text-color-secondary);
    }
  }
}

// 发音评测
.pronunciation-test {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px 0;
  
  .target-text {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 18px;
    
    .label {
      color: var(--text-color-secondary);
    }
    
    .text {
      font-weight: 500;
    }
  }
  
  .score-result {
    text-align: center;
    
    .score-label {
      margin-top: 12px;
      color: var(--text-color-secondary);
    }
  }
}

// 词汇推荐
.vocabulary-recommend {
  .recommend-options {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
  }
  
  .vocab-list {
    .vocab-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--border-color-light);
      
      .word {
        font-size: 18px;
        font-weight: 500;
        min-width: 80px;
      }
      
      .pinyin {
        color: var(--primary-color);
        min-width: 80px;
      }
      
      .meaning {
        flex: 1;
        color: var(--text-color-secondary);
      }
    }
  }
}

// AI 课程生成器
.course-generator {
  .el-form {
    max-width: 600px;
  }
}

// 音频导入向导
.audio-import {
  .el-steps {
    margin-bottom: 32px;
  }
  
  .step-content {
    min-height: 300px;
    padding: 24px 0;
  }
  
  .step-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 24px;
  }
}

// 教材导入向导
.textbook-import {
  .action-buttons {
    display: flex;
    justify-content: center;
    margin-top: 24px;
  }
}

// 对话练习
.conversation-practice {
  display: flex;
  flex-direction: column;
  height: 400px;
  
  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    background-color: var(--bg-color);
    border-radius: 8px;
    margin-bottom: 16px;
    
    .message {
      margin-bottom: 12px;
      
      &.user .message-content {
        background-color: var(--primary-color);
        color: #fff;
        margin-left: auto;
      }
      
      &.assistant .message-content {
        background-color: var(--bg-color-card);
      }
      
      .message-content {
        display: inline-block;
        max-width: 70%;
        padding: 10px 16px;
        border-radius: 12px;
      }
    }
  }
  
  .chat-input {
    display: flex;
    gap: 12px;
    
    .el-input {
      flex: 1;
    }
  }
}
</style>
