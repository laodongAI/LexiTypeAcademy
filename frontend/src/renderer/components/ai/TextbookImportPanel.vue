<!--
  教材导入面板
  
  功能：
  - 上传教材文本
  - 解析课程
  - 预览与编辑
  - 保存课程
-->

<template>
  <div class="textbook-import-panel">
    <el-steps :active="step" class="import-steps" align-center>
      <el-step title="选择出版社" />
      <el-step title="选择教材" />
      <el-step title="选择单元" />
      <el-step title="预览与保存" />
    </el-steps>

    <el-divider />

    <el-alert v-if="error" :title="error" type="error" closable class="error-alert" />

    <!-- Step 0: 出版社 -> 系列 -->
    <div v-if="step === 0" class="step-content">
      <h4>选择出版社</h4>
      <el-form :model="publisherForm" label-position="top" class="step-form prototype-form">
        <el-form-item label="出版社" required>
          <el-autocomplete
            v-model="publisherForm.publisher"
            placeholder="选择或输入出版社"
            clearable
            class="full-width"
            :fetch-suggestions="queryPublisherSuggestions"
            @select="onPublisherSelect"
          />
        </el-form-item>

        <div class="step-actions">
          <el-button type="primary" size="large" :loading="loading" :disabled="!publisherForm.publisher.trim()" @click="fetchSeries(false)">
            识别教材系列 →
          </el-button>
          <el-button size="large" :loading="loading" :disabled="!publisherForm.publisher.trim()" @click="fetchSeries(true)">
            刷新系列
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Step 1: 系列 -> 教材列表 -->
    <div v-else-if="step === 1" class="step-content">
      <h4>选择教材</h4>
      <el-form :model="textbookForm" label-position="top" class="step-form prototype-form">
        <el-form-item label="教材系列" required>
          <el-select
            v-model="textbookForm.series"
            placeholder="选择系列"
            filterable
            class="full-width"
            @change="onSeriesChange"
          >
            <el-option v-for="s in seriesOptions" :key="s" :label="s" :value="s" />
          </el-select>
        </el-form-item>

        <el-form-item label="年级">
          <div class="inline-row">
            <el-select v-model="textbookForm.grade" placeholder="全部年级" clearable filterable class="full-width" @change="onGradeChange">
              <el-option v-for="grade in gradeOptions" :key="grade" :label="grade" :value="grade" />
            </el-select>
            <el-button :loading="loading" :disabled="!textbookForm.series.trim()" @click="() => fetchTextbooks(true)">刷新年级/教材</el-button>
          </div>
          <div class="form-hint">年级选项根据该系列教材目录自动提取；清空年级可查看完整目录。</div>
        </el-form-item>

        <el-form-item label="教材" required>
          <el-select
            v-model="textbookForm.textbookName"
            placeholder="选择教材"
            filterable
            class="full-width"
            @change="onTextbookChange"
          >
            <el-option
              v-for="tb in textbookOptions"
              :key="tb.name"
              :label="`${tb.grade} ${tb.semester} - ${tb.name}`"
              :value="tb.name"
            />
          </el-select>
        </el-form-item>

        <div class="step-actions">
          <el-button @click="step = 0">← 上一步</el-button>
          <el-button :loading="loading" :disabled="!textbookForm.series.trim()" @click="() => fetchTextbooks()">刷新教材列表</el-button>
          <el-button type="primary" :loading="loading" @click="parseUnits">
            解析单元结构 →
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Step 2: 单元 -> 生成 -->
    <div v-else-if="step === 2" class="step-content">
      <h4>选择单元并生成课程</h4>
      <el-alert v-if="checkpointStatus" :title="checkpointStatus" type="info" :closable="false" show-icon class="error-alert" />
      <el-form :model="unitForm" label-position="top" class="step-form prototype-form">
        <el-form-item label="单元（可多选，支持批量生成）" required>
          <el-select
            v-model="unitForm.unitTitles"
            placeholder="选择单元"
            filterable
            multiple
            collapse-tags
            collapse-tags-tooltip
            class="full-width"
            :disabled="loading"
          >
            <el-option v-for="u in unitOptions" :key="u.title" :label="`Unit ${u.unit_num}: ${u.title}${u.generatedTypes?.length ? '（已有：' + u.generatedTypes.join('、') + '）' : ''}`" :value="u.title" />
          </el-select>
          <div class="step-actions"><el-button size="small" @click="addSupplementUnit" :disabled="loading || !textbookForm.textbookName.trim()">＋ 补充单元</el-button></div>
        </el-form-item>

        <el-form-item label="生成内容类型" required>
          <el-checkbox-group v-model="unitForm.contentTypes" :disabled="loading">
            <el-checkbox label="words">单词</el-checkbox>
            <el-checkbox label="sentences">句子</el-checkbox>
            <el-checkbox label="passage">短文</el-checkbox>
            <el-checkbox label="grammar">语法</el-checkbox>
            <el-checkbox label="phonics">发音/phonics</el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <el-form-item label="生成音频（可选）">
          <el-switch v-model="unitForm.withAudio" :disabled="loading" />
          <div class="form-hint">开启后会为单词/句子/短文尝试生成 TTS 音频链接</div>
        </el-form-item>

        <el-form-item label="核心词汇数量" required>
          <el-slider v-model="unitForm.coreCount" :min="5" :max="30" :disabled="loading" />
        </el-form-item>

        <el-form-item label="拓展词汇数量" required>
          <el-slider v-model="unitForm.extraCount" :min="0" :max="30" :disabled="loading" />
        </el-form-item>

        <div v-if="generationProgress.active" class="generation-progress">
          <div class="progress-header">
            <span>已完成内容项：{{ generationProgress.doneTasks }}/{{ generationProgress.totalTasks }}</span>
            <span class="progress-meta">完整单元 {{ generationProgress.doneUnits }}/{{ generationProgress.totalUnits }}</span>
            <span v-if="generationProgress.currentUnit" class="progress-detail">
              {{ generationProgress.currentUnit }}<span v-if="generationProgress.currentType"> · {{ generationProgress.currentType }}</span>
            </span>
          </div>
          <el-progress :percentage="generationProgress.percentage" :status="loading ? undefined : 'success'" />
        </div>

        <div class="step-actions">
          <el-button :disabled="loading" @click="step = 1">← 上一步</el-button>
          <el-button type="primary"  :loading="loading" :disabled="checkpointStatus.includes('正在后台生成')" @click="generateCoursesFromTextbook">
            ✨ 批量生成课程
          </el-button>
        </div>
      </el-form>
    </div>

    <!-- Step 3: 预览与保存 -->
    <div v-else-if="step === 3" class="step-content">
      <h4>课程预览</h4>

      <div v-if="pendingCourses.length" class="preview-card">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>已生成 {{ pendingCourses.length }} 个课程</span>
              <el-tag>可批量保存</el-tag>
            </div>
          </template>

          <el-collapse>
            <el-collapse-item
              v-for="(course, courseIdx) in pendingCourses"
              :key="courseIdx"
              :title="course.title"
              :name="courseIdx"
            >
              <el-collapse>
                <el-collapse-item
                  v-for="(lesson, idx) in course.lessons"
                  :key="lesson.id || idx"
                  :title="`第 ${Number(idx) + 1} 课：${lesson.title}`"
                  :name="`${courseIdx}-${idx}`"
                >
                  <div v-if="lesson.items?.length" class="items-preview">
                    <el-tag v-for="(it, itIdx) in lesson.items.slice(0, 24)" :key="it.id || itIdx" class="vocab-tag">
                      {{ it.english }}
                    </el-tag>
                  </div>
                </el-collapse-item>
              </el-collapse>
            </el-collapse-item>
          </el-collapse>
        </el-card>
      </div>

      <el-result
        v-if="!error && savedIds.length"
        icon="success"
        title="教材课程已保存"
        :sub-title="`已保存 ${savedIds.length} 个课程`"
      >
        <template #extra>
          <el-button type="primary" @click="resetAll">继续生成教材课程</el-button>
          <el-button @click="goToPractice">立即学习 →</el-button>
        </template>
      </el-result>

      <div v-else class="step-actions">
        <el-button type="success" size="large" :loading="loading" @click="saveCourses">
          💾 批量保存课程
        </el-button>
        <el-button @click="step = 2">← 返回编辑</el-button>
      </div>
    </div>

    <!-- 空状态 -->
    <div v-else class="empty-state">
      <div class="empty-icon">🏫</div>
      <p>选择出版社与教材开始</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getAIService } from '../../../shared/services/ai'
import type { WordEntry } from '../../../shared/services/ai'
import { generateSpeech } from '../../../shared/services/ttsApiService'
import { ContentShape, type Lesson, type LessonItem } from '../../../shared/types/course'
import { useCourseStore } from '../../stores/courseStore'
import { useSettingsStore } from '../../stores/settings'
import type { CourseDraft } from '../../utils/aiCourseDraft'
import { courseDraftFromWordEntries } from '../../utils/aiCourseDraft'
import { addDiagnosticLog } from '../../../shared/services/diagnosticLogService'
import { courseSystemStore } from '../../../shared/services/courseSystemStore'

const router = useRouter()

const courseStore = useCourseStore()
/** 设置仓库：生成音频时必须沿用用户在设置页选择的音色/语速 */
const settingsStore = useSettingsStore()
const step = ref(0)
const loading = ref(false)
const error = ref('')
const savedIds = ref<string[]>([])
const pendingCourses = ref<CourseDraft[]>([])

const publisherOptions = ref<string[]>([
  '人教版',
  '外研版',
  '译林版',
  '北师大版',
  '沪教版',
  '冀教版',
  '鲁教版',
  '牛津版',
  '朗文版',
])

function queryPublisherSuggestions(queryString: string, cb: (results: Array<{ value: string }>) => void) {
  const q = queryString.trim()
  const list = publisherOptions.value
  const results = (q ? list.filter((p) => p.includes(q)) : list).map((p) => ({ value: p }))
  cb(results)
}

async function onPublisherSelect() {
  if (!publisherForm.publisher.trim()) return
  await fetchSeries()
}

const publisherForm = reactive({
  publisher: '',
})

const seriesOptions = ref<string[]>([])
const activePublisher = ref('')
const gradeOptions = ref<string[]>([])
const textbookOptions = ref<Array<{ grade: string; semester: string; name: string }>>([])
type UnitOption = { unit_num: number; title: string; topics: string[]; generatedTypes?: string[] }
const unitOptions = ref<UnitOption[]>([])

const textbookForm = reactive({
  series: '',
  grade: '',
  textbookName: '',
})

const unitForm = reactive({
  unitTitles: [] as string[],
  contentTypes: ['words'] as Array<'words' | 'sentences' | 'passage' | 'grammar' | 'phonics'>,
  withAudio: false,
  coreCount: 12,
  extraCount: 8,
})

const generationProgress = reactive({
  active: false,
  totalUnits: 0,
  doneUnits: 0,
  totalTasks: 0,
  doneTasks: 0,
  currentUnit: '',
  currentType: '' as '' | 'words' | 'sentences' | 'passage' | 'grammar' | 'phonics',
  get percentage() {
    if (!this.totalTasks) return 0
    return Math.min(100, Math.round((this.doneTasks / this.totalTasks) * 100))
  },
})

function toTypeLabel(type: string): string {
  if (type === 'words') return '单词'
  if (type === 'sentences') return '句子'
  if (type === 'passage') return '短文'
  if (type === 'grammar') return '语法'
  if (type === 'phonics') return '发音/phonics'
  return type
}

interface TextbookGenerationCheckpoint {
  key: string
  publisher: string
  series: string
  textbookName: string
  grade?: string
  currentUnit?: string
  currentType?: 'words' | 'sentences' | 'passage' | 'grammar' | 'phonics'
  unitTitles: string[]
  contentTypes: Array<'words' | 'sentences' | 'passage' | 'grammar' | 'phonics'>
  withAudio: boolean
  coreCount: number
  extraCount: number
  completedTasks: string[]
  lessonsByUnit: Record<string, Lesson[]>
  updatedAt: number
  status?: 'running' | 'paused' | 'completed'
}

const GENERATION_CHECKPOINT_KEY = 'textbook_generation_checkpoint_v1'
const pendingCatalogRequests = new Map<string, Promise<unknown>>()
function sharedCatalogRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = pendingCatalogRequests.get(key)
  if (existing) return existing as Promise<T>
  const pending = request().finally(() => pendingCatalogRequests.delete(key))
  pendingCatalogRequests.set(key, pending)
  return pending
}

// Two units at a time reduces sequential AI round-trip latency while bounding provider load.
// Wait for all workers before surfacing an error so no background worker is left untracked.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0
  const errors: unknown[] = []
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      try { await worker(items[index]) } catch (error) { errors.push(error) }
    }
  })
  await Promise.all(workers)
  if (errors.length) throw errors[0]
}
const checkpointStatus = ref('')
let checkpointPollId: number | undefined

function selectedGradeKey(): string {
  return textbookForm.grade.trim() || textbookOptions.value.find(tb => tb.name === textbookForm.textbookName)?.grade?.trim() || ''
}

function makeGenerationKey(publisher: string, series: string, textbookName: string, grade = '') {
  return [publisher, series, grade, textbookName].map(value => value.trim()).join('|')
}

function readGenerationCheckpoint(): TextbookGenerationCheckpoint | null {
  try {
    const raw = localStorage.getItem(GENERATION_CHECKPOINT_KEY)
    return raw ? JSON.parse(raw) as TextbookGenerationCheckpoint : null
  } catch {
    return null
  }
}

function persistGenerationCheckpoint(checkpoint: TextbookGenerationCheckpoint) {
  checkpoint.updatedAt = Date.now()
  generationProgress.totalTasks = checkpoint.unitTitles.length * checkpoint.contentTypes.length
  generationProgress.doneTasks = checkpoint.completedTasks.filter(task => checkpoint.unitTitles.some(unit => checkpoint.contentTypes.some(type => task === generationTaskKey(unit, type)))).length
  try {
    localStorage.setItem(GENERATION_CHECKPOINT_KEY, JSON.stringify(checkpoint))
    checkpointStatus.value = '断点已保存：' + new Date(checkpoint.updatedAt).toLocaleTimeString()
  } catch (e) {
    console.error('保存教材生成断点失败', e)
    checkpointStatus.value = '断点保存失败，请检查本地存储空间'
  }
}

function generationTaskKey(unitTitle: string, type: string) {
  return unitTitle + '::' + type
}

/** Persist each successful content type, not just the whole unit, so failures can resume precisely. */
function markCheckpointTask(checkpoint: TextbookGenerationCheckpoint, unitTitle: string, type: string, lessons: Lesson[]) {
  const key = generationTaskKey(unitTitle, type)
  if (!checkpoint.completedTasks.includes(key)) checkpoint.completedTasks.push(key)
  checkpoint.lessonsByUnit[unitTitle] = [...lessons]
  checkpoint.status = 'running'
  persistGenerationCheckpoint(checkpoint)
}

function createId(prefix: string, now: number, ...parts: Array<string | number>) {
  return `${prefix}_${now}_${parts.join('_')}_${Math.random().toString(36).slice(2, 8)}`
}

async function onSeriesChange() {
  textbookForm.grade = ''
  textbookForm.textbookName = ''
  textbookOptions.value = []
  unitOptions.value = []
  if (!publisherForm.publisher.trim() || !textbookForm.series.trim()) return
  await fetchTextbooks()
}

async function onGradeChange() {
  textbookForm.textbookName = ''
  unitOptions.value = []
  await fetchTextbooks()
}

async function onTextbookChange() {
  if (!textbookForm.textbookName.trim()) return
  await parseUnits()
}

async function addSupplementUnit() {
  try {
    const result = await ElMessageBox.prompt('请输入要补充的单元标题（例如 Unit 11: Review）', '补充教材单元', {
      confirmButtonText: '添加并选择',
      cancelButtonText: '取消',
      inputPlaceholder: '单元编号与标题',
      inputValidator: value => !!value?.trim() || '单元标题不能为空',
    })
    const title = result.value.trim()
    if (unitOptions.value.some(unit => unit.title.toLocaleLowerCase() === title.toLocaleLowerCase())) {
      ElMessage.warning('该单元已存在，请直接选择')
      return
    }
    const maxNumber = Math.max(0, ...unitOptions.value.map(unit => Number(unit.unit_num) || 0))
    unitOptions.value = [...unitOptions.value, { unit_num: maxNumber + 1, title, topics: [], generatedTypes: getExistingTypes(getExistingCourseForUnit(title)) }]
    unitForm.unitTitles = [...unitForm.unitTitles, title]
    ElMessage.success('已添加补充单元；生成内容会归属当前出版社、系列和教材')
  } catch {
    // User canceled the prompt.
  }
}

async function fetchSeries(forceRefresh = false) {
  error.value = ''
  savedIds.value = []
  const publisher = publisherForm.publisher.trim()
  if (!publisher) {
    ElMessage.warning('请输入出版社')
    return
  }

  loading.value = true
  try {
    let series = forceRefresh ? null : courseSystemStore.getSeries(publisher)
    if (!series?.length) {
      const ai = getAIService()
      const result = await sharedCatalogRequest(`series:${publisher}`, () => ai.fetchSeriesList(publisher))
      series = [...new Set((result.series || []).map((value) => String(value).trim()).filter(Boolean))]
      if (!series.length) throw new Error('未获取到教材系列，请检查出版社名称后重试')
      courseSystemStore.saveSeries(publisher, series)
    }
    seriesOptions.value = series
    const publisherChanged = activePublisher.value !== publisher
    activePublisher.value = publisher
    if (publisherChanged || !seriesOptions.value.includes(textbookForm.series)) {
      textbookForm.series = seriesOptions.value[0] || ''
      textbookForm.grade = ''
      textbookForm.textbookName = ''
      textbookOptions.value = []
      gradeOptions.value = []
    }
    step.value = 1
    if (textbookForm.series) await fetchTextbooks(false)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '获取系列失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function parseUnits() {
  error.value = ''
  savedIds.value = []
  if (!textbookForm.series.trim()) {
    ElMessage.warning('请选择教材系列')
    return
  }

  loading.value = true
  try {
    const ai = getAIService()

    if (!textbookOptions.value.length) {
      await fetchTextbooksInternal(ai)
    }

    if (!textbookForm.textbookName.trim()) {
      ElMessage.warning('请选择教材')
      return
    }

    const publisher = publisherForm.publisher.trim()
    const selectedSeries = textbookForm.series.trim()
    const textbookName = textbookForm.textbookName.trim()
    const selectedTextbookMeta = textbookOptions.value.find(tb => tb.name === textbookName)
    const gradeKey = textbookForm.grade || selectedTextbookMeta?.grade || ''
    let parsedUnits = courseSystemStore.getUnits(publisher, selectedSeries, textbookName, gradeKey)
    if (!parsedUnits?.length) {
      const result = await sharedCatalogRequest(`units:${publisher}|${selectedSeries}|${textbookForm.grade}|${textbookName}`, () => ai.parseTextbookUnits(publisher, selectedSeries, textbookName))
      parsedUnits = (result.units || []).map((unit: any) => ({
        unit_num: Number(unit.unit_num) || 0,
        title: String(unit.title || '').trim(),
        topics: Array.isArray(unit.topics) ? unit.topics.map((topic: unknown) => String(topic)) : [],
      })).filter((unit: { title: string }) => !!unit.title)
      courseSystemStore.saveUnits(publisher, selectedSeries, textbookName, parsedUnits, gradeKey)
    }
    await courseStore.loadCourses()
    unitOptions.value = parsedUnits.map(unit => ({
      ...unit,
      generatedTypes: getExistingTypes(getExistingCourseForUnit(unit.title)),
    }))
    if (!unitOptions.value.length) {
      throw new Error('未解析到教材单元')
    }
    unitForm.unitTitles = []
    step.value = 2
  } catch (e) {
    error.value = e instanceof Error ? e.message : '解析单元失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function fetchTextbooks(forceRefresh = false) {
  error.value = ''
  savedIds.value = []
  const publisher = publisherForm.publisher.trim()
  const selectedSeries = textbookForm.series.trim()
  if (!publisher || !selectedSeries) {
    ElMessage.warning('请先选择出版社和教材系列')
    return
  }

  loading.value = true
  try {
    const allTextbooks = await fetchTextbooksInternal(getAIService(), forceRefresh)
    gradeOptions.value = [...new Set(allTextbooks.map((tb) => tb.grade).filter(Boolean))]
    textbookOptions.value = textbookForm.grade
      ? allTextbooks.filter((tb) => tb.grade === textbookForm.grade)
      : allTextbooks
    if (textbookForm.grade && !gradeOptions.value.includes(textbookForm.grade)) {
      textbookForm.grade = ''
      textbookOptions.value = allTextbooks
    }
    if (!textbookOptions.value.length) {
      throw new Error('该年级下没有匹配的教材，请选择其他年级或刷新目录。')
    }
    if (!textbookOptions.value.some((tb) => tb.name === textbookForm.textbookName)) {
      textbookForm.textbookName = textbookOptions.value[0].name
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '获取教材列表失败'
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

async function fetchTextbooksInternal(ai = getAIService(), forceRefresh = false) {
  const publisher = publisherForm.publisher.trim()
  const selectedSeries = textbookForm.series.trim()
  if (forceRefresh) courseSystemStore.clearTextbooks(publisher, selectedSeries)
  let allTextbooks = forceRefresh ? null : courseSystemStore.getTextbooks(publisher, selectedSeries)
  if (!allTextbooks?.length) {
    const result = await sharedCatalogRequest(`textbooks:${publisher}|${selectedSeries}`, () => ai.fetchTextbookList(publisher, selectedSeries))
    allTextbooks = (result.textbooks || [])
      .map((tb) => ({ grade: String(tb.grade || '').trim(), semester: String(tb.semester || '').trim(), name: String(tb.name || '').trim() }))
      .filter((tb) => tb.name)
    if (!allTextbooks.length) throw new Error('未获取到教材目录或年级信息，请刷新或检查系列名称')
    courseSystemStore.saveTextbooks(publisher, selectedSeries, allTextbooks)
  }
  gradeOptions.value = [...new Set(allTextbooks.map((tb) => tb.grade).filter(Boolean))]
  textbookOptions.value = textbookForm.grade
    ? allTextbooks.filter((tb) => tb.grade === textbookForm.grade)
    : allTextbooks
  if (!textbookForm.textbookName.trim() && textbookOptions.value.length) {
    textbookForm.textbookName = textbookOptions.value[0].name
  }
  return allTextbooks
}

function getExistingCourseForUnit(unitTitle: string) {
  const publisher = publisherForm.publisher.trim()
  const series = textbookForm.series.trim()
  const textbookTag = 'Textbook:' + textbookForm.textbookName.trim()
  const expectedTitle = textbookForm.textbookName.trim() + ' - ' + unitTitle
  const expectedDescription = publisher + ' / ' + series
  return courseStore.courses.find(course => {
    const tags = course.tags || []
    const stronglyMatched = tags.includes(textbookTag) && tags.includes(unitTitle) && tags.includes(publisher) && tags.includes(series)
    const legacyMatched = course.title === expectedTitle && course.description === expectedDescription
    return stronglyMatched || legacyMatched
  }) ?? null
}

function getExistingTypes(course: { lessons?: Lesson[] } | null | undefined): string[] {
  if (!course) return []
  const types: Array<[string, RegExp]> = [
    ['words', /单词|词汇/i],
    ['sentences', /句子|课文|对话/i],
    ['passage', /短文|阅读/i],
    ['grammar', /语法/i],
    ['phonics', /phonics|发音|音标/i],
  ]
  return types.filter(([, pattern]) => course.lessons?.some(lesson => pattern.test(lesson.title))).map(([type]) => type)
}

async function generateCourseFromTextbook() {
  addDiagnosticLog('info', 'textbook-course-generation', '开始教材课程生成', { unitCount: unitForm.unitTitles.length, contentTypes: [...unitForm.contentTypes] })
  error.value = ''
  savedIds.value = []
  if (!unitForm.unitTitles.length) {
    ElMessage.warning('请选择单元')
    return
  }

  if (!unitForm.contentTypes.length) {
    ElMessage.warning('请选择生成内容类型')
    return
  }

  loading.value = true
  generationProgress.active = true
  generationProgress.totalUnits = unitForm.unitTitles.length
  generationProgress.doneUnits = 0
  generationProgress.currentUnit = ''
  generationProgress.currentType = ''
  try {
    const ai = getAIService()
    const now = Date.now()

    const courses: CourseDraft[] = []

    // 生成快照：避免生成过程中用户改动选择影响本次任务
    const selectedUnits = [...unitForm.unitTitles]
    const selectedTypes = [...unitForm.contentTypes]
    const withAudio = unitForm.withAudio
    const coreCount = unitForm.coreCount
    const extraCount = unitForm.extraCount

    const gradeKey = selectedGradeKey()
    const key = makeGenerationKey(publisherForm.publisher, textbookForm.series, textbookForm.textbookName, gradeKey)
    const config = { unitTitles: selectedUnits, contentTypes: selectedTypes, withAudio, coreCount, extraCount }
    let checkpoint = readGenerationCheckpoint()
    const legacyKey = makeGenerationKey(publisherForm.publisher, textbookForm.series, textbookForm.textbookName)
    const checkpointMatches = !!checkpoint && (checkpoint.key === key || (checkpoint.key === legacyKey && (!checkpoint.grade || checkpoint.grade === gradeKey))) && JSON.stringify({ unitTitles: checkpoint.unitTitles, contentTypes: checkpoint.contentTypes, withAudio: checkpoint.withAudio, coreCount: checkpoint.coreCount, extraCount: checkpoint.extraCount }) === JSON.stringify(config)
    if (!checkpointMatches) {
      checkpoint = { key, publisher: publisherForm.publisher.trim(), series: textbookForm.series.trim(), textbookName: textbookForm.textbookName.trim(), grade: gradeKey, ...config, completedTasks: [], lessonsByUnit: {}, updatedAt: Date.now() }
    }
    const activeCheckpoint = checkpoint as TextbookGenerationCheckpoint
    generationProgress.totalUnits = selectedUnits.length
    generationProgress.doneUnits = 0
    generationProgress.totalTasks = selectedUnits.length * selectedTypes.length
    generationProgress.doneTasks = activeCheckpoint.completedTasks.filter(task => selectedUnits.some(unit => selectedTypes.some(type => task === generationTaskKey(unit, type)))).length
    activeCheckpoint.status = 'running'
    activeCheckpoint.key = key
    activeCheckpoint.grade = gradeKey
    ;(window as unknown as { __lexitypeTextbookGenerationKey?: string }).__lexitypeTextbookGenerationKey = key
    persistGenerationCheckpoint(activeCheckpoint)

    await runWithConcurrency(selectedUnits, 2, async (unitTitle) => {
      generationProgress.currentUnit = unitTitle
      const lessons: Lesson[] = [...(activeCheckpoint.lessonsByUnit[unitTitle] || [])]
      // 教材分级标签：保留历史顺序（AI / Textbook / 出版社 / 系列 / 单元），
      // 追加显式分级标签，便于课程仓库按「教材 → 年级册 → 单元」稳定归组。
      const selectedTextbook = textbookOptions.value.find(tb => tb.name === textbookForm.textbookName)
      const gradeTag = textbookForm.grade.trim() || selectedTextbook?.grade || ''
      const semesterTag = selectedTextbook?.semester || ''
      const baseTags = [
        'AI',
        'Textbook',
        publisherForm.publisher,
        textbookForm.series,
        unitTitle,
        `Textbook:${textbookForm.textbookName}`,
        gradeTag ? `Grade:${gradeTag}` : '',
        semesterTag ? `Semester:${semesterTag}` : '',
      ].filter(Boolean)

      if (activeCheckpoint.completedTasks.includes(unitTitle)) {
        if (lessons.length > 0) courses.push({ title: textbookForm.textbookName + ' - ' + unitTitle, description: publisherForm.publisher + ' / ' + textbookForm.series, category: 'special', difficulty: 'intermediate', lessons, tags: baseTags })
        generationProgress.doneUnits += 1
        return
      }
      const existingTypes = getExistingTypes(getExistingCourseForUnit(unitTitle))
      for (const type of selectedTypes) {
        if (existingTypes.includes(type)) markCheckpointTask(activeCheckpoint, unitTitle, type, lessons)
      }
      let wordsForPhonics: WordEntry[] = []

      if (selectedTypes.includes('words') && !existingTypes.includes('words') && !activeCheckpoint.completedTasks.includes(generationTaskKey(unitTitle, 'words'))) {
        generationProgress.currentType = 'words'
        activeCheckpoint.currentUnit = unitTitle; activeCheckpoint.currentType = 'words'; persistGenerationCheckpoint(activeCheckpoint)
        const wordsContent = await ai.generateTextbookWordsContent(textbookForm.textbookName.trim(), unitTitle.trim(), {
          coreCount,
          extraCount,
        })

        const words: WordEntry[] = [...(wordsContent.core_words || []), ...(wordsContent.extra_words || [])].map((w) => ({
          word: w.word,
          phonetic: w.phonetic,
          partOfSpeech: w.pos,
          translation: w.zh,
          example: w.example,
        }))

        wordsForPhonics = words

        let items: LessonItem[] = words
          .map((w, idx) => {
            const english = String(w.word || '').trim()
            if (!english) return null
            return {
              id: createId('tb_word', now, unitTitle, idx),
              english,
              chinese: String(w.translation || '').trim(),
              phonetic: w.phonetic,
              partOfSpeech: w.partOfSpeech,
              examples: w.example ? [String(w.example)] : undefined,
            } as LessonItem
          })
          .filter((v): v is LessonItem => v !== null)
        if (!items.length) throw new Error('单词生成结果为空，已保留断点，请重试该内容类型')

        if (withAudio) {
          items = await withAudioForItems(items, 'word')
        }

        lessons.push({
          id: createId('tb_lesson', now, unitTitle, 'words'),
          title: `${unitTitle} - 单词`,
          description: '',
          contentShape: ContentShape.Word,
          items,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (selectedTypes.includes('words')) markCheckpointTask(activeCheckpoint, unitTitle, 'words', lessons)

      if (selectedTypes.includes('sentences') && !existingTypes.includes('sentences') && !activeCheckpoint.completedTasks.includes(generationTaskKey(unitTitle, 'sentences'))) {
        generationProgress.currentType = 'sentences'
        activeCheckpoint.currentUnit = unitTitle; activeCheckpoint.currentType = 'sentences'; persistGenerationCheckpoint(activeCheckpoint)
        const sentencesContent = await ai.generateTextbookSentencesContent(textbookForm.textbookName.trim(), unitTitle.trim())
        let items: LessonItem[] = (sentencesContent.sentences || [])
          .map((s, idx) => {
            const english = String(s.en || '').trim()
            if (!english) return null
            return {
              id: createId('tb_sentence', now, unitTitle, idx),
              english,
              chinese: String(s.zh || '').trim(),
            } as LessonItem
          })
          .filter((v): v is LessonItem => v !== null)
        if (!items.length) throw new Error('句子生成结果为空，已保留断点，请重试该内容类型')

        if (withAudio) {
          items = await withAudioForItems(items, 'sentence')
        }

        lessons.push({
          id: createId('tb_lesson', now, unitTitle, 'sentences'),
          title: `${unitTitle} - 句子`,
          description: sentencesContent.title || '',
          contentShape: ContentShape.Sentence,
          items,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (selectedTypes.includes('sentences')) markCheckpointTask(activeCheckpoint, unitTitle, 'sentences', lessons)

      if (selectedTypes.includes('passage') && !existingTypes.includes('passage') && !activeCheckpoint.completedTasks.includes(generationTaskKey(unitTitle, 'passage'))) {
        generationProgress.currentType = 'passage'
        activeCheckpoint.currentUnit = unitTitle; activeCheckpoint.currentType = 'passage'; persistGenerationCheckpoint(activeCheckpoint)
        const passageContent = await ai.generateTextbookPassageContent(textbookForm.textbookName.trim(), unitTitle.trim())
        let items: LessonItem[] = (passageContent.paragraphs || [])
          .map((p, idx) => {
            const english = String(p.en || '').trim()
            if (!english) return null
            return {
              id: createId('tb_passage', now, unitTitle, idx),
              english,
              chinese: String(p.zh || '').trim(),
            } as LessonItem
          })
          .filter((v): v is LessonItem => v !== null)
        if (!items.length) throw new Error('短文生成结果为空，已保留断点，请重试该内容类型')

        if (withAudio) {
          items = await withAudioForItems(items, 'passage')
        }

        lessons.push({
          id: createId('tb_lesson', now, unitTitle, 'passage'),
          title: `${unitTitle} - 短文`,
          description: passageContent.title || '',
          contentShape: ContentShape.Passage,
          items,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (selectedTypes.includes('passage')) markCheckpointTask(activeCheckpoint, unitTitle, 'passage', lessons)

      if (selectedTypes.includes('grammar') && !existingTypes.includes('grammar') && !activeCheckpoint.completedTasks.includes(generationTaskKey(unitTitle, 'grammar'))) {
        generationProgress.currentType = 'grammar'
        activeCheckpoint.currentUnit = unitTitle; activeCheckpoint.currentType = 'grammar'; persistGenerationCheckpoint(activeCheckpoint)
        const grammarContent = await ai.generateTextbookGrammarContent(textbookForm.textbookName.trim(), unitTitle.trim())
        const items: LessonItem[] = (grammarContent.points || [])
          .map((pt, idx) => {
            const name = String(pt.name || '').trim()
            if (!name) return null
            const examples = (pt.examples || [])
              .map((e) => {
                const en = String(e.en || '').trim()
                const zh = String(e.zh || '').trim()
                if (!en) return null
                return zh ? `${en} — ${zh}` : en
              })
              .filter((v): v is string => v !== null)

            return {
              id: createId('tb_grammar', now, unitTitle, idx),
              english: name,
              chinese: String(pt.explanation_zh || '').trim(),
              examples: examples.length ? examples : undefined,
            } as LessonItem
          })
          .filter((v): v is LessonItem => v !== null)
        if (!items.length) throw new Error('语法生成结果为空，已保留断点，请重试该内容类型')

        lessons.push({
          id: createId('tb_lesson', now, unitTitle, 'grammar'),
          title: `${unitTitle} - 语法`,
          description: '',
          contentShape: ContentShape.Sentence,
          items,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (selectedTypes.includes('grammar')) markCheckpointTask(activeCheckpoint, unitTitle, 'grammar', lessons)

      if (selectedTypes.includes('phonics') && !existingTypes.includes('phonics') && !activeCheckpoint.completedTasks.includes(generationTaskKey(unitTitle, 'phonics'))) {
        generationProgress.currentType = 'phonics'
        activeCheckpoint.currentUnit = unitTitle; activeCheckpoint.currentType = 'phonics'; persistGenerationCheckpoint(activeCheckpoint)
        const sampleWords = wordsForPhonics.slice(0, 8).map((w) => String(w.word || '').trim()).filter(Boolean).join(', ')
        const phonicsContent = await ai.generateTextbookPhonicsContent(textbookForm.textbookName.trim(), unitTitle.trim(), {
          sampleWords: sampleWords || 'apple, cat',
        })

        const items: LessonItem[] = (phonicsContent.phonics || [])
          .map((ph, idx) => {
            const target = String(ph.target_sound || '').trim()
            if (!target) return null
            const examples = (ph.examples || []).map((ex) => {
              const word = String(ex.word || '').trim()
              const breakdown = String(ex.phonetic_breakdown || '').trim()
              return breakdown ? `${word} ${breakdown}` : word
            })

            return {
              id: createId('tb_phonics', now, unitTitle, idx),
              english: target,
              chinese: String(ph.pronunciation || '').trim(),
              examples: examples.length ? examples : undefined,
            } as LessonItem
          })
          .filter((v): v is LessonItem => v !== null)
        if (!items.length) throw new Error('发音练习生成结果为空，已保留断点，请重试该内容类型')

        lessons.push({
          id: createId('tb_lesson', now, unitTitle, 'phonics'),
          title: `${unitTitle} - 发音/Phonics`,
          description: '',
          contentShape: ContentShape.Word,
          items,
          createdAt: now,
          updatedAt: now,
        })
      }
      if (selectedTypes.includes('phonics')) markCheckpointTask(activeCheckpoint, unitTitle, 'phonics', lessons)

      const courseTitle = `${textbookForm.textbookName} - ${unitTitle}`
      if (lessons.length > 0) courses.push({
        title: courseTitle,
        description: `${publisherForm.publisher} / ${textbookForm.series}`,
        category: 'special',
        difficulty: 'intermediate',
        lessons,
        tags: baseTags,
      })

      activeCheckpoint.lessonsByUnit[unitTitle] = [...lessons]
      if (!activeCheckpoint.completedTasks.includes(unitTitle)) activeCheckpoint.completedTasks.push(unitTitle)
      activeCheckpoint.status = 'running'
      persistGenerationCheckpoint(activeCheckpoint)
      generationProgress.doneUnits += 1
    })

    if (courses.length === 0) throw new Error('所选单元的内容类型均已存在或没有新内容，请选择尚未生成的类型。')
    activeCheckpoint.status = 'completed'
    persistGenerationCheckpoint(activeCheckpoint)
    pendingCourses.value = courses
    addDiagnosticLog('info', 'textbook-course-generation', '教材课程草稿生成成功', { courses: courses.length, lessons: courses.reduce((sum, course) => sum + course.lessons.length, 0) })
    step.value = 3
    ElMessage.success('课程已生成，可预览后批量保存')
  } catch (e) {
    const checkpoint = readGenerationCheckpoint()
    if (checkpoint) { checkpoint.status = 'paused'; persistGenerationCheckpoint(checkpoint) }
    error.value = e instanceof Error ? e.message : '生成课程失败'
    addDiagnosticLog('error', 'textbook-course-generation', '教材课程生成失败；已完成单元已保存，可断点继续', error.value)
    ElMessage.error(error.value)
  } finally {
    const runtime = window as unknown as { __lexitypeTextbookGenerationKey?: string }
    if (runtime.__lexitypeTextbookGenerationKey === makeGenerationKey(publisherForm.publisher, textbookForm.series, textbookForm.textbookName, selectedGradeKey())) {
      delete runtime.__lexitypeTextbookGenerationKey
    }
    loading.value = false
    generationProgress.active = false
    generationProgress.currentUnit = ''
    generationProgress.currentType = ''
  }
}

async function withAudioForItems(items: LessonItem[], kind: 'word' | 'sentence' | 'passage'): Promise<LessonItem[]> {
  const result: LessonItem[] = []
  // 小批量并发避免逐条串行等待，同时限制并发数，降低本地 TTS / 后端压力。
  for (let offset = 0; offset < items.length; offset += 3) {
    const batch = items.slice(offset, offset + 3)
    const completed = await Promise.all(batch.map(async item => {
      const text = String(item.english || '').trim()
      if (!text) return item
      try {
        const audioPath = await generateSpeech(text, 'en', {
          engine: settingsStore.ttsEngine,
          voice: settingsStore.ttsVoiceId,
          rate: settingsStore.ttsSpeed,
        })
        return { ...item, audioPath: audioPath || undefined }
      } catch (error) {
        addDiagnosticLog('warn', 'textbook-course-generation', '单条 TTS 失败，继续生成课程内容', {
          kind,
          text: text.slice(0, 80),
          error: error instanceof Error ? error.message : String(error),
        })
        return item
      }
    }))
    result.push(...completed)
  }
  return result
}
async function generateCoursesFromTextbook() {
  await generateCourseFromTextbook()
}

function mergeGeneratedLessons(existingLessons: Lesson[], incomingLessons: Lesson[]): Lesson[] {
  const merged = existingLessons.map(lesson => ({ ...lesson, items: [...(lesson.items || [])] }))
  for (const incoming of incomingLessons) {
    const existing = merged.find(lesson => lesson.title.trim().toLowerCase() === incoming.title.trim().toLowerCase())
    if (!existing) {
      merged.push(incoming)
      continue
    }
    const seen = new Set((existing.items || []).map(item => item.english.trim().toLowerCase()).filter(Boolean))
    const additions = (incoming.items || []).filter(item => {
      const key = item.english.trim().toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    existing.items = [...(existing.items || []), ...additions]
    existing.updatedAt = Date.now()
    if (!existing.description && incoming.description) existing.description = incoming.description
  }
  return merged
}

async function saveCourses() {
  error.value = ''
  savedIds.value = []
  if (!pendingCourses.value.length) {
    ElMessage.warning('没有可保存的课程')
    return
  }
  loading.value = true
  try {
    const ids = [...savedIds.value]
    await courseStore.loadCourses()
    addDiagnosticLog('info', 'textbook-course-generation', '开始批量保存教材课程（优先合并已有教材课程）', { count: pendingCourses.value.length })
    for (let index = 0; index < pendingCourses.value.length; index += 1) {
      if (ids[index]) continue
      const draft = pendingCourses.value[index]
      const textbookTag = draft.tags?.find(tag => tag.startsWith('Textbook:'))
      const unitTag = draft.tags?.find(tag => draft.title.endsWith(' - ' + tag))
      const existing = courseStore.courses.find(course =>
        course.title === draft.title ||
        (!!textbookTag && !!unitTag && course.tags?.includes(textbookTag) && course.tags.includes(unitTag))
      )
      let id: string
      if (existing) {
        const mergedLessons = mergeGeneratedLessons(existing.lessons || [], draft.lessons || [])
        await courseStore.updateCourse(existing.id, {
          lessons: mergedLessons,
          tags: [...new Set([...(existing.tags || []), ...(draft.tags || [])])],
          description: existing.description || draft.description,
        })
        id = existing.id
      } else {
        id = await courseStore.createCourse(draft)
      }
      ids[index] = id
      savedIds.value = [...ids]
    }
    savedIds.value = ids
    const checkpoint = readGenerationCheckpoint()
    if (checkpoint?.status === 'completed') {
      localStorage.removeItem(GENERATION_CHECKPOINT_KEY)
      checkpointStatus.value = ''
    }
    addDiagnosticLog('info', 'textbook-course-generation', '教材课程批量保存成功（已有内容已合并，新内容按类型追加）', { count: ids.filter(Boolean).length, courseIds: ids.filter(Boolean) })
    ElMessage.success('课程已保存到课程仓库')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '保存失败'
    addDiagnosticLog('error', 'textbook-course-generation', '教材课程批量保存失败；已成功保存的课程会在重试时跳过', { error: error.value, savedCount: savedIds.value.filter(Boolean).length })
    ElMessage.error(error.value)
  } finally {
    loading.value = false
  }
}

function resetAll() {
  step.value = 0
  loading.value = false
  error.value = ''
  savedIds.value = []
  pendingCourses.value = []

  publisherForm.publisher = ''
  seriesOptions.value = []
  textbookOptions.value = []
  unitOptions.value = []
  textbookForm.series = ''
  textbookForm.grade = ''
  textbookForm.textbookName = ''
  unitForm.unitTitles = []
  unitForm.contentTypes = ['words']
  unitForm.withAudio = false
  unitForm.coreCount = 12
  unitForm.extraCount = 8
}

const modeOptions = [
  { value: 'extract', label: '抽取模式', desc: '自动抽取关键词汇和句型' },
  { value: 'full', label: '完整模式', desc: '生成完整的练习题' },
  { value: 'context', label: '语境模式', desc: '保留语境进行深度学习' },
]

function goToPractice() {
  if (savedIds.value.length) router.push(`/courses/${encodeURIComponent(savedIds.value[0])}`)
  else router.push('/course-repository')
}

onMounted(async () => {
  const checkpoint = readGenerationCheckpoint()
  if (!checkpoint) return
  const runtime = window as unknown as { __lexitypeTextbookGenerationKey?: string }
  if (checkpoint.status === 'running' && runtime.__lexitypeTextbookGenerationKey === checkpoint.key) {
    checkpointStatus.value = '该教材正在后台生成，切换页面不会取消任务。'
    generationProgress.active = true
    generationProgress.totalUnits = checkpoint.unitTitles.length
    generationProgress.doneUnits = checkpoint.completedTasks.filter(task => checkpoint!.unitTitles.includes(task)).length
    generationProgress.totalTasks = checkpoint.unitTitles.length * checkpoint.contentTypes.length
    generationProgress.doneTasks = checkpoint.completedTasks.filter(task => checkpoint.unitTitles.some(unit => checkpoint.contentTypes.some(type => task === generationTaskKey(unit, type)))).length
    generationProgress.currentUnit = checkpoint.currentUnit || ''
    generationProgress.currentType = checkpoint.currentType || ''
    checkpointPollId = window.setInterval(() => {
      const latest = readGenerationCheckpoint()
      if (!latest) return
      generationProgress.totalUnits = latest.unitTitles.length
      generationProgress.doneUnits = latest.completedTasks.filter(task => latest.unitTitles.includes(task)).length
      generationProgress.totalTasks = latest.unitTitles.length * latest.contentTypes.length
      generationProgress.doneTasks = latest.completedTasks.filter(task => latest.unitTitles.some(unit => latest.contentTypes.some(type => task === generationTaskKey(unit, type)))).length
      generationProgress.currentUnit = latest.currentUnit || ''
      generationProgress.currentType = latest.currentType || ''
      if (latest.status === 'running') return
      if (checkpointPollId !== undefined) window.clearInterval(checkpointPollId)
      checkpointPollId = undefined
      generationProgress.active = false
      checkpointStatus.value = latest.status === 'completed'
        ? '后台生成已完成；已恢复预览，请检查并保存课程。'
        : '后台任务已暂停，可点击“批量生成课程”从最近完成的内容类型继续。'
      if (latest.status === 'completed') {
        const selectedTextbook = textbookOptions.value.find(tb => tb.name === latest.textbookName)
        const gradeTag = latest.grade || selectedTextbook?.grade || ''
        const semesterTag = selectedTextbook?.semester || ''
        pendingCourses.value = latest.unitTitles.map(unitTitle => ({
          title: latest.textbookName + ' - ' + unitTitle,
          description: latest.publisher + ' / ' + latest.series,
          category: 'special' as const,
          difficulty: 'intermediate' as const,
          lessons: latest.lessonsByUnit[unitTitle] || [],
          tags: ['AI', 'Textbook', latest.publisher, latest.series, unitTitle, `Textbook:${latest.textbookName}`, gradeTag ? `Grade:${gradeTag}` : '', semesterTag ? `Semester:${semesterTag}` : ''].filter(Boolean),
        })).filter(course => course.lessons.length > 0)
        if (pendingCourses.value.length) step.value = 3
      }
    }, 1200)
  } else if (checkpoint.status === 'running') {
    checkpoint.status = 'paused'
    persistGenerationCheckpoint(checkpoint)
    checkpointStatus.value = '检测到上次运行中断；已完成的内容类型已保存，可从断点继续。'
  }
  try {
    publisherForm.publisher = checkpoint.publisher
    await fetchSeries(false)
    textbookForm.series = checkpoint.series
    await fetchTextbooks(false)
    textbookForm.textbookName = checkpoint.textbookName
    textbookForm.grade = checkpoint.grade || textbookOptions.value.find(tb => tb.name === checkpoint.textbookName)?.grade || ''
    await parseUnits()
    // Rehydrate manually added units from the checkpoint so their labels remain selectable after navigation/reload.
    for (const title of checkpoint.unitTitles) {
      if (!unitOptions.value.some(unit => unit.title === title)) {
        const maxNumber = Math.max(0, ...unitOptions.value.map(unit => Number(unit.unit_num) || 0))
        unitOptions.value.push({ unit_num: maxNumber + 1, title, topics: [], generatedTypes: getExistingTypes(getExistingCourseForUnit(title)) })
      }
    }
    unitForm.unitTitles = checkpoint.unitTitles
    unitForm.contentTypes = checkpoint.contentTypes
    unitForm.withAudio = checkpoint.withAudio
    unitForm.coreCount = checkpoint.coreCount
    unitForm.extraCount = checkpoint.extraCount
    const latestCheckpoint = readGenerationCheckpoint() || checkpoint
    generationProgress.totalUnits = latestCheckpoint.unitTitles.length
    generationProgress.doneUnits = latestCheckpoint.completedTasks.filter(task => latestCheckpoint.unitTitles.includes(task)).length
    generationProgress.totalTasks = latestCheckpoint.unitTitles.length * latestCheckpoint.contentTypes.length
    generationProgress.doneTasks = latestCheckpoint.completedTasks.filter(task => latestCheckpoint.unitTitles.some(unit => latestCheckpoint.contentTypes.some(type => task === generationTaskKey(unit, type)))).length
    generationProgress.currentUnit = latestCheckpoint.currentUnit || ''
    generationProgress.currentType = latestCheckpoint.currentType || ''
    generationProgress.active = latestCheckpoint.status === 'running' && runtime.__lexitypeTextbookGenerationKey === latestCheckpoint.key
    if (latestCheckpoint.status === 'completed') {
      const selectedTextbook = textbookOptions.value.find(tb => tb.name === latestCheckpoint.textbookName)
      const gradeTag = latestCheckpoint.grade || selectedTextbook?.grade || ''
      const semesterTag = selectedTextbook?.semester || ''
      pendingCourses.value = latestCheckpoint.unitTitles.map(unitTitle => ({
        title: latestCheckpoint.textbookName + ' - ' + unitTitle,
        description: latestCheckpoint.publisher + ' / ' + latestCheckpoint.series,
        category: 'special' as const,
        difficulty: 'intermediate' as const,
        lessons: latestCheckpoint.lessonsByUnit[unitTitle] || [],
        tags: ['AI', 'Textbook', latestCheckpoint.publisher, latestCheckpoint.series, unitTitle, `Textbook:${latestCheckpoint.textbookName}`, gradeTag ? `Grade:${gradeTag}` : '', semesterTag ? `Semester:${semesterTag}` : ''].filter(Boolean),
      })).filter(course => course.lessons.length > 0)
      step.value = pendingCourses.value.length ? 3 : 2
      checkpointStatus.value = '后台生成已完成；已恢复预览，请检查并保存课程。'
    } else {
      step.value = 2
    }
    if (latestCheckpoint.status === 'completed') {
      checkpointStatus.value = '后台生成已完成；已恢复预览，请检查并保存课程。'
    } else if (latestCheckpoint.status === 'running' && runtime.__lexitypeTextbookGenerationKey === latestCheckpoint.key) {
      checkpointStatus.value = '该教材正在后台生成，切换页面不会取消任务。'
    } else {
      checkpointStatus.value = '发现教材生成断点；已完成的内容类型已保存，可点击“批量生成课程”继续。'
    }
  } catch (e) {
    console.warn('恢复教材生成任务上下文失败', e)
  }
})

onUnmounted(() => {
  if (checkpointPollId !== undefined) window.clearInterval(checkpointPollId)
})
</script>

<style lang="scss" scoped>
.textbook-import-panel {
  padding: 20px 0;
}
.import-steps {
  margin-bottom: 24px;

  :deep(.el-step__title) {
    font-weight: 500;
  }
}

.step-content {
  padding: 20px 0;
  min-height: 260px;

  h4 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
  }
}

.step-form {
  max-width: 800px;

  :deep(.el-form-item) {
    margin-bottom: 20px;
  }

  :deep(.el-form-item__label) {
    font-weight: 500;
    margin-bottom: 8px;
  }
}

.full-width {
  width: 100%;
}

.step-actions {
  display: flex;
  gap: 12px;
}

.generation-progress {
  margin: 12px 0 4px;

  .progress-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 12px;
    color: #606266;
  }

  .progress-detail {
    color: #909399;
  }
}

.form-hint {
  margin-left: 12px;
  font-size: 12px;
  color: #909399;
}

.preview-card {
  margin-bottom: 16px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
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

.error-alert {
  margin-top: 12px;
}

.empty-state {
  text-align: center;
  padding: 48px 20px;

  .empty-icon {
    font-size: 48px;
    margin-bottom: 12px;
  }

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
