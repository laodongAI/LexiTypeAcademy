<!--
  课程生成面板
  
  功能：
  - 输入主题、难度、规模
  - 实时预览生成的课程
  - 编辑并保存
-->

<template>
  <div class="course-generator-panel">
    <!-- 输入表单 -->
    <el-form
      :model="form"
      label-position="top"
      label-width="auto"
      @submit.prevent="generateCourse"
      class="generator-form prototype-form"
    >
      <el-form-item label="课程名称" required>
        <el-input
          v-model="form.courseName"
          placeholder="例如：机场通关与出行英语"
          clearable
        />
      </el-form-item>

      <el-form-item label="课程集合（用于仓库分组）" required>
        <el-input v-model="form.collectionName" placeholder="例如：旅行英语 / 职场英语 / A2 主题词汇" clearable />
        <div class="field-hint">多个课程可以归入同一个集合，避免在仓库中平铺。</div>
      </el-form-item>

      <el-form-item label="学习内容类型" required>
        <el-radio-group v-model="form.focus">
          <el-radio-button value="word">主题词汇</el-radio-button>
          <el-radio-button value="phrase">常用表达与搭配</el-radio-button>
        </el-radio-group>
        <div class="field-hint">目前支持单词或多词固定表达。句型、完整对话和短文精读属于后续独立生成模板，不会伪装成已支持的课程类型。</div>
      </el-form-item>

      <el-form-item label="中文内容" required>
        <el-input
          v-model="form.chineseText"
          type="textarea"
          placeholder="输入中文内容，AI 会先生成对应英文文本，再生成词汇课程。"
          :rows="10"
          show-word-limit
          maxlength="5000"
        />
      </el-form-item>

      <el-form-item label="预期课程数" required>
        <el-slider v-model="form.lessonCount" :min="3" :max="30" />
      </el-form-item>

      <el-form-item label="每节课内容数" required>
        <el-slider v-model="form.wordsPerLesson" :min="5" :max="50" />
      </el-form-item>

      <el-form-item>
        <div class="form-actions">
          <el-button
            type="primary"
            size="large"
            :loading="loading"
            @click="generateCourse"
            class="action-btn"
          >
            生成课程
          </el-button>
          <el-button
            size="large"
            @click="resetAll"
            class="action-btn"
          >
            重置
          </el-button>
        </div>
      </el-form-item>
    </el-form>

    <!-- 预览区 -->
    <el-divider />

    <div v-if="pendingCourse" class="preview-section">
      <el-alert
        type="info"
        show-icon
        :closable="false"
        :title="form.focus === 'phrase' ? '本方式当前生成的是表达与搭配课程' : '本方式当前生成的是主题词汇课程'"
        :description="form.focus === 'phrase' ? '建议通过情景补全、搭配辨析、短语拼写和例句迁移来学习固定表达；当前仍以表达条目为核心，不等于完整对话课程。' : '建议采用听音辨词、词形与词义回忆、例句理解、主动检索及间隔复习。单词清单不应直接按短文精读流程教学。'"
        class="learning-method-hint"
      />
      <h4>📋 课程预览</h4>
      <el-card class="preview-card">
        <template #header>
          <div class="card-header">
            <span>{{ pendingCourse.title }}</span>
            <el-tag>{{ pendingCourse.lessons?.length || 0 }} 节课</el-tag>
          </div>
        </template>

        <el-collapse>
          <el-collapse-item
            v-for="(lesson, idx) in pendingCourse.lessons"
            :key="lesson.id || idx"
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

        <div class="preview-actions">
          <el-button type="success" size="small" @click="saveCourse">
            保存课程
          </el-button>
          <el-button size="small" @click="clearPending">
            清空
          </el-button>
        </div>
      </el-card>

      <el-alert v-if="error" :title="error" type="error" closable />
      <el-result
        v-if="savedId"
        icon="success"
        title="课程已保存"
        :sub-title="`课程 ID: ${savedId}`"
      >
        <template #extra>
          <el-button type="primary" @click="resetAll">
            继续生成课程
          </el-button>
          <el-button @click="goToPractice">
            查看课程并开始学习 →
          </el-button>
        </template>
      </el-result>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <p>请输入中文内容并点击“生成课程”开始</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { CourseDraft } from '../../utils/aiCourseDraft'
import { generateCourseDraftFromChineseText } from '../../services/courseGenerationService'
import { useCourseStore } from '../../stores/courseStore'
import { addDiagnosticLog } from '../../../shared/services/diagnosticLogService'

const router = useRouter()
const courseStore = useCourseStore()

const loading = ref(false)
const error = ref('')
const savedId = ref('')
const pendingCourse = ref<CourseDraft | null>(null)

const form = reactive({
  courseName: '',
  collectionName: 'AI 生成课程',
  chineseText: '',
  lessonCount: 5,
  wordsPerLesson: 10,
  focus: 'word' as 'word' | 'phrase',
})

async function generateCourse() {
  addDiagnosticLog('info', 'course-generation', '开始从中文生成课程', { lessonCount: form.lessonCount, wordsPerLesson: form.wordsPerLesson })
  error.value = ''
  savedId.value = ''

  if (!form.courseName.trim()) {
    ElMessage.warning('请输入课程名称')
    return
  }
  if (!form.chineseText.trim()) {
    ElMessage.warning('请输入中文内容')
    return
  }

  loading.value = true
  try {
    pendingCourse.value = await generateCourseDraftFromChineseText({
      courseName: form.courseName,
      chineseText: form.chineseText,
      lessonCount: form.lessonCount,
      wordsPerLesson: form.wordsPerLesson,
      focus: form.focus,
      difficulty: 'intermediate',
      tags: ['AI', 'Chinese', `Collection:${form.collectionName.trim() || 'AI 生成课程'}`]
    })

    addDiagnosticLog('info', 'course-generation', '中文课程草稿生成成功', { lessons: pendingCourse.value.lessons.length })
    ElMessage.success('课程已生成，可预览后保存')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成失败'
    addDiagnosticLog('error', 'course-generation', '中文课程生成失败', error.value)
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
    addDiagnosticLog('info', 'course-generation', '课程保存成功', { courseId: id })
    ElMessage.success('课程已保存到课程仓库')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

function clearPending() {
  pendingCourse.value = null
  error.value = ''
  savedId.value = ''
}

function resetAll() {
  clearPending()
  form.courseName = ''
  form.collectionName = 'AI 生成课程'
  form.chineseText = ''
  form.lessonCount = 5
  form.wordsPerLesson = 10
  form.focus = 'word'
  ElMessage.success('已重置')
}

function goToPractice() {
  if (savedId.value) router.push(`/courses/${encodeURIComponent(savedId.value)}`)
  else router.push('/course-repository')
}
</script>

<style lang="scss" scoped>
.course-generator-panel {
  padding: 0;
}

.generator-form {
  max-width: 800px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    color: var(--text-color);
    margin-bottom: 8px;
  }
}

.field-hint { margin-top: 6px; color: var(--text-color-secondary); font-size: 12px; line-height: 1.5; }

.form-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.action-btn {
  font-weight: 500;
}

.learning-method-hint {
  margin-bottom: 16px;
}

.preview-section {
  margin-top: 20px;

  h4 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
  }
}

.preview-card {
  margin-bottom: 16px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .preview-actions {
    display: flex;
    gap: 8px;
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid var(--border-color-light);
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

.empty-state {
  text-align: center;
  padding: 36px 12px;

  p {
    margin: 0;
    color: #909399;
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
