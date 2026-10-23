<!--
  音频导入面板
  
  功能：
  - 上传音频文件
  - 识别和解析
  - 生成课程
-->

<template>
  <div class="audio-import-panel">
    <el-steps :active="step" class="import-steps" align-center>
      <el-step title="选择模式" />
      <el-step title="上传音频" />
      <el-step title="预览课程" />
      <el-step title="保存课程" />
    </el-steps>

    <el-divider />

    <!-- Step 0: 选择模式 -->
    <div v-if="step === 0" class="step-content">
      <h4>选择分割方式</h4>
      <el-form :model="form" label-position="top" class="step-form prototype-form">
        <el-form-item label="课程名称" required>
          <el-input
            v-model="form.courseName"
            placeholder="输入课程名称"
            clearable
          />
        </el-form-item>

        <el-form-item label="分割模式" required>
          <el-radio-group v-model="form.segmentMode" class="mode-options">
            <el-radio-button
              v-for="mode in segmentModes"
              :key="mode.value"
              :label="mode.value"
              class="mode-btn"
            >
              <div class="mode-label">
                <span class="mode-name">{{ mode.label }}</span>
                <span class="mode-desc">{{ mode.desc }}</span>
              </div>
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="每节课内容数" required>
          <el-slider v-model="form.wordsPerLesson" :min="5" :max="50" />
        </el-form-item>

        <el-form-item label="预期课程数" required>
          <el-slider v-model="form.lessonCount" :min="3" :max="30" />
        </el-form-item>

        <div class="step-actions">
          <el-button type="primary" size="large" @click="goNextFromConfig">
            下一步 →
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Step 1: 上传音频 -->
    <div v-else-if="step === 1" class="step-content">
      <h4>上传音频文件</h4>
      <el-upload
        class="audio-upload"
        drag
        accept="audio/*"
        :auto-upload="false"
        :limit="1"
        :file-list="fileList"
        :before-upload="handleBeforeUpload"
        :on-remove="handleRemove"
      >
        <el-icon class="el-icon--upload"><Upload /></el-icon>
        <div class="el-upload__text">
          拖入音频文件或 <em>点击选择</em>
        </div>
        <template #tip>
          <div class="el-upload__tip">
            支持 MP3、WAV、M4A 等格式，单个文件大小不超过 100MB
          </div>
        </template>
      </el-upload>

      <div class="step-actions">
        <el-button @click="step = 0">← 上一步</el-button>
        <el-button type="primary" :loading="loading" @click="recognizeAndGenerate">
          🔄 识别音频
        </el-button>
      </div>
    </div>

    <!-- Step 2: 预览课程 -->
    <div v-else-if="step === 2" class="step-content">
      <h4>课程预览</h4>
      <div v-if="pendingCourse" class="preview-card">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>{{ pendingCourse.title }}</span>
              <el-tag>{{ pendingCourse.lessons?.length || 0 }} 节课</el-tag>
            </div>
          </template>

          <el-collapse>
            <el-collapse-item
              v-for="(lesson, idx) in pendingCourse.lessons"
              :key="idx"
              :title="`第 ${Number(idx) + 1} 课：${lesson.title}`"
              :name="idx"
            >
              <div v-if="lesson.items?.length" class="items-preview">
                <el-tag
                  v-for="(it, itIdx) in lesson.items.slice(0, 24)"
                  :key="it.id || itIdx"
                  class="vocab-tag"
                >
                  {{ it.english }}
                </el-tag>
              </div>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </div>

      <div class="step-actions">
        <el-button @click="step = 1">← 上一步</el-button>
        <el-button type="primary" @click="step = 3">
          下一步 →
        </el-button>
      </div>
    </div>

    <!-- Step 3: 保存课程 -->
    <div v-else-if="step === 3" class="step-content">
      <h4>保存课程</h4>

      <el-result
        v-if="!error && savedId"
        icon="success"
        title="音频课程已保存"
        :sub-title="`课程 ID: ${savedId}`"
      >
        <template #extra>
          <el-button type="primary" @click="resetAll">
            继续导入音频
          </el-button>
          <el-button @click="goToPractice">
            立即学习 →
          </el-button>
        </template>
      </el-result>

      <div v-else class="save-actions">
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          closable
          class="error-alert"
        />
        <el-button
          type="success"
          size="large"
          :loading="loading"
          @click="saveCourse"
        >
          💾 保存课程
        </el-button>
        <el-button @click="step = 2">
          ← 返回编辑
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Upload } from '@element-plus/icons-vue'
import type { UploadUserFile, UploadRawFile } from 'element-plus'
import { getASRApiService } from '../../../shared/services/asrApiService'
import { getAIService } from '../../../shared/services/ai'
import type { CourseDraft } from '../../utils/aiCourseDraft'
import { courseDraftFromGenerationResponse } from '../../utils/aiCourseDraft'
import { useCourseStore } from '../../stores/courseStore'

const router = useRouter()
const courseStore = useCourseStore()

const step = ref(0)
const loading = ref(false)
const error = ref('')
const savedId = ref('')

const form = reactive({
  courseName: '',
  segmentMode: 'sentence',
  lessonCount: 5,
  wordsPerLesson: 10,
})

const fileList = ref<UploadUserFile[]>([])
const selectedFile = ref<File | null>(null)

const pendingCourse = ref<CourseDraft | null>(null)

const segmentModes = [
  { value: 'sentence', label: '按句子分割', desc: '每个句子为一个学习单元' },
  { value: 'paragraph', label: '按段落分割', desc: '每个段落为一个学习单元' },
  { value: 'time', label: '按时间分割', desc: '按固定时长拆分长音频' },
]

function goNextFromConfig() {
  if (!form.courseName.trim()) {
    ElMessage.warning('请输入课程名称')
    return
  }
  step.value = 1
}

function handleBeforeUpload(file: UploadRawFile) {
  selectedFile.value = file as unknown as File
  fileList.value = [{ name: file.name, url: '', uid: file.uid }]
  return false
}

function handleRemove() {
  selectedFile.value = null
  fileList.value = []
}

async function recognizeAndGenerate() {
  error.value = ''
  savedId.value = ''

  if (!selectedFile.value) {
    ElMessage.warning('请先选择音频文件')
    return
  }

  loading.value = true
  try {
    const asr = getASRApiService()
    const segmentMode = (form.segmentMode === 'sentence' || form.segmentMode === 'paragraph' || form.segmentMode === 'time')
      ? form.segmentMode
      : 'sentence'

    const asrResult = await asr.recognizeSegments({
      audio: selectedFile.value,
      language: 'en',
      segmentMode,
    })

    if (!asrResult.success) {
      throw new Error(asrResult.error || 'ASR 识别失败')
    }

    const transcription = String(asrResult.fullText || '').trim()
    if (!transcription) {
      throw new Error('ASR 返回文本为空')
    }

    const ai = getAIService()
    const generated = await ai.generateCourseFromAudio(transcription, form.lessonCount, form.wordsPerLesson)
    pendingCourse.value = courseDraftFromGenerationResponse(generated, {
      title: form.courseName || generated.courseName,
      difficulty: 'intermediate',
      tags: ['AI', 'Audio'],
    })

    step.value = 2
    ElMessage.success('课程已生成，可预览后保存')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '音频识别/生成失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function saveCourse() {
  error.value = ''
  savedId.value = ''
  if (!pendingCourse.value) {
    ElMessage.warning('没有可保存的课程')
    return
  }

  loading.value = true
  try {
    const id = await courseStore.createCourse(pendingCourse.value)
    savedId.value = id
    ElMessage.success('课程已保存到课程仓库')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

function resetAll() {
  step.value = 0
  loading.value = false
  error.value = ''
  savedId.value = ''
  pendingCourse.value = null
  handleRemove()
  form.courseName = ''
  form.segmentMode = 'sentence'
  form.lessonCount = 5
  form.wordsPerLesson = 10
}

function goToPractice() {
  router.push('/practice')
}
</script>

<style lang="scss" scoped>
.audio-import-panel {
  padding: 20px 0;
}

.import-steps {
  margin-bottom: 32px;

  :deep(.el-step__title) {
    font-weight: 500;
  }
}

.step-content {
  padding: 20px 0;
  min-height: 300px;

  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
}

.step-form {
  max-width: 600px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    margin-bottom: 8px;
  }
}

.mode-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;

  :deep(.el-radio-button) {
    flex: 1;
    min-width: 160px;
  }

  :deep(.el-radio-button__inner) {
    padding: 12px 16px;
    white-space: normal;
    height: auto;
    text-align: center;
  }
}

.items-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.vocab-tag {
  margin-right: 0;
}

.mode-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;

  .mode-name {
    font-weight: 600;
    font-size: 13px;
  }

  .mode-desc {
    font-size: 12px;
    opacity: 0.7;
  }
}

// 上传区
.audio-upload {
  :deep(.el-upload-dragger) {
    padding: 30px;
    border-radius: 8px;
  }
}

// 预览
.preview-card {
  margin-bottom: 20px;

  :deep(.el-card) {
    border: 1px solid var(--border-color-light);

    .el-card__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 500;
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }
}

.step-actions {
  display: flex;
  justify-content: flex-start;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--border-color-light);
}

.save-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;

  .error-alert {
    margin-bottom: 12px;
  }
}

/* 原型风格：弱化默认边框，强调底边框（尽量不破坏 Element Plus 交互） */
.prototype-form {
  :deep(.el-input__wrapper),
  :deep(.el-select__wrapper),
  :deep(.el-textarea__inner) {
    box-shadow: none !important;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid var(--border-color);
    background-color: transparent;
  }

  :deep(.el-input__wrapper.is-focus),
  :deep(.el-select__wrapper.is-focus),
  :deep(.el-textarea__inner:focus) {
    border-bottom-color: var(--primary-color);
  }
}
</style>
