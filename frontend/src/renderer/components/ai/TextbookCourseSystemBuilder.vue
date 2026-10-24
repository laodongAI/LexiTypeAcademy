<template>
  <div class="textbook-builder">
    <el-steps :active="activeStep" align-center>
      <el-step title="教材选择" />
      <el-step title="单元解析" />
      <el-step title="内容生成" />
      <el-step title="结果预览" />
    </el-steps>

    <el-alert
      v-if="errorText"
      type="error"
      :closable="true"
      show-icon
      class="error-alert"
      @close="errorText = ''"
    >
      {{ errorText }}
    </el-alert>

    <el-alert v-if="recoverableCheckpoint && !generating" type="warning" :closable="false" show-icon class="error-alert">
      检测到未完成的教材生成任务（{{ recoverableCheckpoint.textbookName }}，已完成 {{ recoverableCheckpoint.completedKeys.length }} 项，待重试 {{ recoverableCheckpoint.failedKeys.length }} 项）。
      <el-button size="small" type="primary" @click="() => startGenerate(recoverableCheckpoint)">继续/重试未完成任务</el-button>
    </el-alert>

    <div class="step-content">
      <div v-if="activeStep === 0" class="step-panel">
        <el-form label-width="100px">
          <el-form-item label="预设">
            <div class="preset-row">
              <el-select v-model="selectedPresetName" placeholder="选择预设" clearable style="min-width: 260px">
                <el-option v-for="p in presets" :key="p.name" :label="p.name" :value="p.name" />
              </el-select>
              <el-button :disabled="!selectedPresetName" @click="applyPreset">应用</el-button>
              <el-button plain @click="savePreset">保存为预设</el-button>
            </div>
          </el-form-item>

          <el-form-item label="出版社">
            <el-input v-model="publisher" placeholder="例如：人民教育出版社" />
          </el-form-item>

          <el-form-item label="学段">
            <el-input v-model="gradeLevel" placeholder="例如：小学（G1-G6）" />
          </el-form-item>

          <el-form-item label="教材系列">
            <div class="inline-row">
              <el-select v-model="series" filterable placeholder="自动获取/选择系列" style="width: 100%">
                <el-option v-for="s in availableSeries" :key="s" :label="s" :value="s" />
              </el-select>
              <el-button :loading="loading" @click="refreshSeries">刷新</el-button>
            </div>
          </el-form-item>

          <el-form-item label="教材">
            <div class="inline-row">
              <el-select v-model="selectedTextbookName" filterable placeholder="自动获取/选择教材" style="width: 100%">
                <el-option
                  v-for="tb in textbooks"
                  :key="tb.name"
                  :label="`${tb.grade} ${tb.semester} - ${tb.name}`"
                  :value="tb.name"
                />
              </el-select>
              <el-button :loading="loading" @click="refreshTextbooks" :disabled="!publisher || !series">
                刷新
              </el-button>
            </div>
          </el-form-item>

          <el-form-item>
            <el-button type="primary" :disabled="!selectedTextbookName" @click="goNext">
              下一步：解析单元
            </el-button>
          </el-form-item>
        </el-form>

        <el-divider content-position="left">缓存</el-divider>
        <div class="cache-row">
          <el-button size="small" @click="exportCache">导出缓存</el-button>
          <el-button size="small" @click="importCache">导入缓存</el-button>
          <el-button size="small" type="danger" plain @click="clearCache">清空缓存</el-button>
        </div>
      </div>

      <div v-else-if="activeStep === 1" class="step-panel">
        <div class="step-toolbar">
          <el-button type="primary" :loading="loading" @click="parseUnits(false)" :disabled="!selectedTextbookName">解析单元</el-button>
          <el-button :loading="loading" @click="parseUnits(true)" :disabled="!selectedTextbookName">强制刷新</el-button>
        </div>

        <el-table :data="units" stripe style="width: 100%">
          <el-table-column label="选择" width="70">
            <template #default="scope">
              <el-checkbox v-model="scope.row.selected" />
            </template>
          </el-table-column>
          <el-table-column prop="unit_num" label="#" width="60" />
          <el-table-column prop="title" label="单元标题" />
          <el-table-column label="话题">
            <template #default="scope">
              <span>{{ (scope.row.topics || []).join('、') }}</span>
            </template>
          </el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag v-if="scope.row.generated" type="success">已生成</el-tag>
              <el-tag v-else type="info">未生成</el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-alert v-if="units.length === 0" type="info" :closable="false" show-icon style="margin-top: 12px;">
          解析结果为空时，可尝试更换教材名称或系列。
        </el-alert>

        <div class="step-actions">
          <el-button @click="goPrev">上一步</el-button>
          <el-button type="primary" :disabled="selectedUnitsCount === 0" @click="goNext">下一步：生成内容</el-button>
        </div>
      </div>

      <div v-else-if="activeStep === 2" class="step-panel">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-card>
              <template #header>生成选项</template>

              <el-form label-width="120px">
                <el-form-item label="课程类型">
                  <el-checkbox-group v-model="selectedCourseTypes">
                    <el-checkbox label="words">单词（Words）</el-checkbox>
                    <el-checkbox label="sentences">句子/课文（Sentences）</el-checkbox>
                    <el-checkbox label="phonics">音标（Phonics）</el-checkbox>
                  </el-checkbox-group>
                </el-form-item>

                <el-form-item v-if="selectedCourseTypes.includes('words')" label="核心词汇数">
                  <el-input-number v-model="generationOptions.coreCount" :min="3" :max="30" />
                </el-form-item>

                <el-form-item v-if="selectedCourseTypes.includes('words')" label="拓展词汇数">
                  <el-input-number v-model="generationOptions.extraCount" :min="0" :max="30" />
                </el-form-item>

                <el-form-item v-if="selectedCourseTypes.includes('phonics')" label="示例单词">
                  <el-input v-model="generationOptions.sampleWords" placeholder="例如：apple, cat" />
                </el-form-item>

                <el-form-item>
                  <el-button
                    type="primary"
                    :loading="generating"
                    :disabled="selectedCourseTypes.length === 0 || selectedUnitsCount === 0"
                    @click="() => startGenerate()"
                  >
                    开始生成
                  </el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>

          <el-col :span="12">
            <el-card class="log-card">
              <template #header>生成日志</template>
              <div v-if="recoverableCheckpoint" class="generation-progress">
                <div class="progress-label"><span>{{ recoverableCheckpoint.current || (recoverableCheckpoint.status === 'failed' ? '等待重试' : '任务状态') }}</span><span>{{ generationProgress }}%</span></div>
                <el-progress :percentage="generationProgress" :status="recoverableCheckpoint.status === 'failed' ? 'exception' : undefined" />
                <div class="progress-meta">已完成 {{ recoverableCheckpoint.completedKeys.length }} / {{ recoverableCheckpoint.selectedUnits.length * recoverableCheckpoint.selectedTypes.length }} 项 · 最近更新 {{ new Date(recoverableCheckpoint.updatedAt).toLocaleTimeString() }}</div>
              </div>
              <div class="log-box">
                <div v-if="generationLogs.length === 0" class="log-empty">等待开始...</div>
                <div v-for="(l, idx) in generationLogs" :key="idx" class="log-line">{{ l }}</div>
              </div>
            </el-card>
          </el-col>
        </el-row>

        <div class="step-actions">
          <el-button :disabled="generating" @click="goPrev">上一步</el-button>
          <el-button type="primary" :disabled="!hasGenerated" @click="goNext">下一步：结果预览</el-button>
        </div>
      </div>

      <div v-else class="step-panel">
        <el-result
          icon="success"
          title="已生成预览"
          sub-title="已按老版流程逐层获取并生成内容，接下来可在页面下方保存为课程。"
        />

        <div class="step-actions">
          <el-button @click="activeStep = 2">返回修改生成选项</el-button>
          <el-button type="primary" @click="restart">重新开始</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { courseSystemStore, type TextbookMeta, type TextbookUnitMeta } from '../../../shared/services/courseSystemStore'
import { ContentShape } from '../../../shared/types/course'
import type { Course, Lesson, LessonItem } from '../../../shared/types/course'
import type { AIService } from '../../../shared/services/ai'
import { createStableId } from '../../../shared/utils/hash'

type PendingCourseData = Omit<Course, 'id' | 'createdAt' | 'updatedAt' | 'lessonCount'>

type CourseType = 'words' | 'sentences' | 'phonics'

const props = defineProps<{ aiService: AIService | null; isAIConfigured: boolean }>()
const emit = defineEmits<{
  (e: 'preview', course: PendingCourseData): void
  (e: 'require-config'): void
}>()

const activeStep = ref(0)
const loading = ref(false)
const generating = ref(false)
const errorText = ref('')

const publisher = ref('人民教育出版社')
const gradeLevel = ref('小学（G1-G6）')
const series = ref('')
const availableSeries = ref<string[]>([])

const textbooks = ref<TextbookMeta[]>([])
const selectedTextbookName = ref('')

type UnitRow = TextbookUnitMeta & { selected: boolean }
const units = ref<UnitRow[]>([])

const selectedCourseTypes = ref<CourseType[]>(['words'])
const generationOptions = ref({
  coreCount: 8,
  extraCount: 5,
  sampleWords: 'apple, cat'
})

const generationLogs = ref<string[]>([])
const hasGenerated = ref(false)

type Preset = { name: string; publisher: string; series: string; grade: string }
const presets = ref<Preset[]>([])
const selectedPresetName = ref<string>('')

const selectedUnitsCount = computed(() => units.value.filter(u => u.selected).length)
const generationProgress = computed(() => {
  const task = recoverableCheckpoint.value
  if (!task) return 0
  const total = Math.max(1, task.selectedUnits.length * task.selectedTypes.length)
  return Math.min(100, Math.round(task.completedKeys.length / total * 100))
})

// Deduplicate concurrent requests caused by overlapping reactive watchers.
const pendingCatalogRequests = new Map<string, Promise<unknown>>()
function sharedCatalogRequest<T>(key: string, request: () => Promise<T>): Promise<T> {
  const existing = pendingCatalogRequests.get(key)
  if (existing) return existing as Promise<T>
  const pending = request().finally(() => pendingCatalogRequests.delete(key))
  pendingCatalogRequests.set(key, pending)
  return pending
}

// Generate at most two units concurrently to reduce wall-clock time without flooding provider rate limits.
async function runWithConcurrency<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (true) {
      const index = nextIndex++
      if (index >= items.length) return
      await worker(items[index])
    }
  })
  await Promise.all(workers)
}

interface TextbookGenerationCheckpoint {
  id: string
  publisher: string
  series: string
  gradeLevel: string
  textbookName: string
  selectedUnits: TextbookUnitMeta[]
  selectedTypes: CourseType[]
  options: { coreCount: number; extraCount: number; sampleWords: string }
  lessons: Lesson[]
  completedKeys: string[]
  failedKeys: string[]
  status: 'running' | 'failed' | 'completed'
  current?: string
  startedAt: number
  updatedAt: number
  error?: string
}
const CHECKPOINT_KEY = 'textbook_course_system_builder_checkpoint_v1'
const runningGenerationTasks = new Set<string>()
const recoverableCheckpoint = ref<TextbookGenerationCheckpoint | null>(null)
function readCheckpoint(): TextbookGenerationCheckpoint | null {
  try {
    const raw = localStorage.getItem(CHECKPOINT_KEY)
    if (!raw) return null
    const task = JSON.parse(raw) as TextbookGenerationCheckpoint
    return task && Array.isArray(task.selectedUnits) && Array.isArray(task.lessons) ? task : null
  } catch { return null }
}
function saveCheckpoint(task: TextbookGenerationCheckpoint) {
  task.updatedAt = Date.now()
  try { localStorage.setItem(CHECKPOINT_KEY, JSON.stringify(task)) } catch (error) {
    console.warn('[textbook-generation] checkpoint save failed', error)
  }
  recoverableCheckpoint.value = task.status === 'completed' ? null : task
}

function readPreviousDraft(textbookName: string, publisherName: string, seriesName: string): PendingCourseData | null {
  try {
    const raw = localStorage.getItem('textbook_generation_completed_draft_v1')
    if (!raw) return null
    const draft = JSON.parse(raw) as PendingCourseData
    const expectedTitle = `${publisherName}${seriesName}《${textbookName}》`
    return draft?.title === expectedTitle && Array.isArray(draft.lessons) ? draft : null
  } catch { return null }
}

function getCompletedKeysFromDraft(draft: PendingCourseData | null, selected: TextbookUnitMeta[], types: CourseType[]): string[] {
  if (!draft) return []
  const keys: string[] = []
  for (const unit of selected) {
    for (const type of types) {
      const prefix = `Unit ${unit.unit_num} `
      const found = draft.lessons.some(lesson => {
        if (type === 'words') return lesson.title === `${prefix}词汇`
        if (type === 'sentences') return lesson.title === `${prefix}课文`
        return lesson.title.startsWith(`${prefix}音标 `)
      })
      if (found) keys.push(`${unit.unit_num}:${type}`)
    }
  }
  return keys
}

function getAIOrNull(): AIService | null {
  if (!props.isAIConfigured || !props.aiService) {
    emit('require-config')
    return null
  }
  return props.aiService
}

function addLog(message: string) {
  const ts = new Date().toLocaleTimeString()
  generationLogs.value.push(`[${ts}] ${message}`)
}

function loadPresets() {
  try {
    const raw = localStorage.getItem('course_builder_presets')
    presets.value = raw ? JSON.parse(raw) : []
  } catch {
    presets.value = []
  }
}

function savePresets() {
  try {
    localStorage.setItem('course_builder_presets', JSON.stringify(presets.value))
  } catch {
    // ignore
  }
}

function applyPreset() {
  const preset = presets.value.find(p => p.name === selectedPresetName.value)
  if (!preset) return
  publisher.value = preset.publisher
  gradeLevel.value = preset.grade
  series.value = preset.series
}

async function savePreset() {
  try {
    const name = await ElMessageBox.prompt('请输入组合名称（如：人教PEP小学）', '保存预设', {
      confirmButtonText: '保存',
      cancelButtonText: '取消'
    })
    const presetName = (name.value || '').trim()
    if (!presetName) return

    presets.value = [...presets.value, { name: presetName, publisher: publisher.value, series: series.value, grade: gradeLevel.value }]
    savePresets()
    selectedPresetName.value = presetName
    ElMessage.success('预设已保存')
  } catch {
    // canceled
  }
}

async function loadSeries(forceRefresh = false) {
  if (!publisher.value) return
  const aiService = getAIOrNull()
  if (!aiService) return

  loading.value = true
  errorText.value = ''
  try {
    if (!forceRefresh) {
      const cached = courseSystemStore.getSeries(publisher.value)
      if (cached && cached.length > 0) {
        availableSeries.value = cached
        if (!series.value) series.value = cached[0]
        return
      }
    } else {
      courseSystemStore.clearSeries(publisher.value)
    }

    const result = await sharedCatalogRequest(`series:${publisher.value}`, () => aiService.fetchSeriesList(publisher.value))
    const list = (result?.series || []).filter((s: any) => typeof s === 'string' && s.trim())
    availableSeries.value = list
    courseSystemStore.saveSeries(publisher.value, list)
    if (!series.value && list.length > 0) series.value = list[0]
  } catch (e: any) {
    errorText.value = e?.message || '获取系列失败'
  } finally {
    loading.value = false
  }
}

async function loadTextbooks(forceRefresh = false) {
  if (!publisher.value || !series.value) return
  const aiService = getAIOrNull()
  if (!aiService) return

  loading.value = true
  errorText.value = ''
  try {
    const cached = forceRefresh ? null : courseSystemStore.getTextbooks(publisher.value, series.value, gradeLevel.value)
    if (cached && cached.length > 0) {
      textbooks.value = cached
      if (!textbooks.value.some(item => item.name === selectedTextbookName.value)) selectedTextbookName.value = cached[0]?.name || ''
      return
    }

    if (forceRefresh) {
      courseSystemStore.clearTextbooks(publisher.value, series.value, gradeLevel.value)
    }

    const result = await sharedCatalogRequest(`textbooks:${publisher.value}|${series.value}|${gradeLevel.value}`, () => aiService.fetchTextbookList(publisher.value, series.value, gradeLevel.value))
    const list = (result?.textbooks || []).filter((t: any) => t && t.name)
    textbooks.value = list
    courseSystemStore.saveTextbooks(publisher.value, series.value, list, gradeLevel.value)
    if (!list.some(item => item.name === selectedTextbookName.value)) selectedTextbookName.value = list[0]?.name || ''
  } catch (e: any) {
    errorText.value = e?.message || '获取教材失败'
  } finally {
    loading.value = false
  }
}

async function parseUnits(forceRefresh: boolean) {
  if (!publisher.value || !series.value || !selectedTextbookName.value) {
    ElMessage.warning('请先选择教材')
    return
  }
  const aiService = getAIOrNull()
  if (!aiService) return

  loading.value = true
  errorText.value = ''
  try {
    const previousUnits = courseSystemStore.getUnits(publisher.value, series.value, selectedTextbookName.value, gradeLevel.value) || []
    const cached = forceRefresh ? null : previousUnits
    if (cached && cached.length > 0) {
      units.value = cached.map(u => ({ ...u, selected: false }))
      return
    }

    const result = await sharedCatalogRequest(`units:${publisher.value}|${series.value}|${gradeLevel.value}|${selectedTextbookName.value}`, () => aiService.parseTextbookUnits(publisher.value, series.value, selectedTextbookName.value))
    const list: TextbookUnitMeta[] = (result?.units || []).map((u: any) => {
      const unit_num = Number(u.unit_num) || 0
      const title = String(u.title || '').trim()
      const previous = previousUnits.find(old => old.title === title || (old.unit_num === unit_num && unit_num > 0))
      return {
        unit_num,
        title,
        topics: Array.isArray(u.topics) ? u.topics.map((t: any) => String(t)) : [],
        generated: previous?.generated ?? false,
        generatedTypes: previous?.generatedTypes ?? [],
      }
    }).filter((u: TextbookUnitMeta) => !!u.title)

    courseSystemStore.saveUnits(publisher.value, series.value, selectedTextbookName.value, list, gradeLevel.value)
    units.value = list.map(u => ({ ...u, selected: false }))
  } catch (e: any) {
    errorText.value = e?.message || '解析单元失败'
  } finally {
    loading.value = false
  }
}

function refreshSeries() {
  loadSeries(true)
}

function refreshTextbooks() {
  loadTextbooks(true)
}

function exportCache() {
  const data = courseSystemStore.exportData()
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `course-system-cache-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importCache() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = evt => {
      const content = String(evt.target?.result || '')
      if (courseSystemStore.importData(content)) {
        ElMessage.success('缓存导入成功')
        loadSeries(false)
        loadTextbooks(false)
      } else {
        ElMessage.error('缓存导入失败（格式错误）')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

async function clearCache() {
  try {
    await ElMessageBox.confirm('确定要清空教材导入缓存吗？', '确认', {
      confirmButtonText: '清空',
      cancelButtonText: '取消',
      type: 'warning'
    })
    courseSystemStore.clearAll()
    availableSeries.value = []
    textbooks.value = []
    units.value = []
    series.value = ''
    selectedTextbookName.value = ''
    ElMessage.success('缓存已清空')
  } catch {
    // canceled
  }
}

async function startGenerate(resumeTask: TextbookGenerationCheckpoint | null = null) {
  if (resumeTask && runningGenerationTasks.has(resumeTask.id)) {
    ElMessage.info('该任务仍在后台执行，返回此页面即可查看最新状态。')
    return
  }
  const aiService = getAIOrNull()
  if (!aiService) return
  if (!selectedTextbookName.value) {
    ElMessage.warning('请选择教材')
    return
  }

  const selectedUnits = resumeTask ? resumeTask.selectedUnits : units.value.filter(u => u.selected)
  if (selectedUnits.length === 0) {
    ElMessage.warning('请至少选择一个单元')
    return
  }

  const previousDraft = resumeTask ? null : readPreviousDraft(selectedTextbookName.value, publisher.value, series.value)
  const alreadyGenerated = resumeTask ? [] : selectedUnits.filter(u => u.generated && !(previousDraft && getCompletedKeysFromDraft(previousDraft, [u], selectedCourseTypes.value).length))
  if (alreadyGenerated.length > 0) {
    try {
      await ElMessageBox.confirm(
        `以下单元在缓存中标记为已生成：${alreadyGenerated.map(u => `Unit ${u.unit_num}`).join('、')}。仍要继续生成吗？`,
        '重复生成确认',
        { type: 'warning', confirmButtonText: '继续', cancelButtonText: '取消' }
      )
    } catch {
      return
    }
  }

  generating.value = true
  hasGenerated.value = false
  generationLogs.value = []

  const task: TextbookGenerationCheckpoint = resumeTask || {
    id: `textbook-${Date.now()}`,
    publisher: publisher.value, series: series.value, gradeLevel: gradeLevel.value,
    textbookName: selectedTextbookName.value,
    selectedUnits: selectedUnits.map(({ unit_num, title, topics, generated, generatedTypes }) => ({ unit_num, title, topics, generated, generatedTypes })),
    selectedTypes: [...selectedCourseTypes.value], options: { ...generationOptions.value },
    lessons: [...(previousDraft?.lessons || [])], completedKeys: getCompletedKeysFromDraft(previousDraft, selectedUnits, selectedCourseTypes.value), failedKeys: [], status: 'running', startedAt: Date.now(), updatedAt: Date.now()
  }
  if (resumeTask) {
    publisher.value = task.publisher; series.value = task.series; gradeLevel.value = task.gradeLevel
    selectedTextbookName.value = task.textbookName
    selectedCourseTypes.value = [...task.selectedTypes]
    generationOptions.value = { ...task.options }
  }
  task.status = 'running'; task.error = undefined; saveCheckpoint(task)
  runningGenerationTasks.add(task.id)
  const lessons: Lesson[] = [...task.lessons]
  const completed = new Set(task.completedKeys)
  task.failedKeys = []

  try {
    addLog(`开始生成内容：教材《${selectedTextbookName.value}》，单元数 ${selectedUnits.length}`)

    await runWithConcurrency(selectedUnits, 2, async (unit) => {
      const unitLabel = `Unit ${unit.unit_num}: ${unit.title}`
      addLog(`处理 ${unitLabel}`)

      for (const type of task.selectedTypes) {
        const taskKey = `${unit.unit_num}:${type}`
        if (completed.has(taskKey)) { addLog(`  ↷ ${type} 已完成，跳过`); continue }
        task.current = taskKey; saveCheckpoint(task)
        addLog(`  -> 生成 ${type}`)
        const startedAt = Date.now()
        const lessonCountBefore = lessons.length
        try {
          const now = Date.now()

          if (type === 'words') {
            const result = await aiService.generateTextbookCourseContent(
              selectedTextbookName.value,
              unitLabel,
              'words',
              { coreCount: generationOptions.value.coreCount, extraCount: generationOptions.value.extraCount }
            )

            const words = [...result.core_words, ...result.extra_words]
            const lessonId = createStableId('tb_lesson', publisher.value, series.value, gradeLevel.value, selectedTextbookName.value, unit.unit_num, 'words')

            const items: LessonItem[] = words
              .map((w, idx) => ({
                id: createStableId('tb_word', lessonId, idx, String(w.word || '').trim()),
                english: String(w.word || '').trim(),
                chinese: String(w.zh || '').trim(),
                phonetic: w.phonetic,
                partOfSpeech: w.pos,
                examples: w.example ? [String(w.example)] : undefined
              }))
              .filter((it) => !!it.english)

            lessons.push({
              id: lessonId,
              title: `Unit ${unit.unit_num} 词汇`,
              description: unit.title,
              contentShape: ContentShape.Word,
              items,
              createdAt: now,
              updatedAt: now
            })
          }

          if (type === 'sentences') {
            const result = await aiService.generateTextbookCourseContent(
              selectedTextbookName.value,
              unitLabel,
              'sentences'
            )

            const lessonId = createStableId('tb_lesson', publisher.value, series.value, gradeLevel.value, selectedTextbookName.value, unit.unit_num, 'sentences')
            const items: LessonItem[] = result.sentences
              .map((s, idx) => ({
                id: createStableId('tb_sentence', lessonId, idx, String(s.en || '').trim()),
                english: String(s.en || '').trim(),
                chinese: String(s.zh || '').trim(),
                examples: Array.isArray(s.keywords) ? s.keywords.map((k) => String(k)) : undefined
              }))
              .filter((it) => !!it.english)

            lessons.push({
              id: lessonId,
              title: `Unit ${unit.unit_num} 课文`,
              description: result.title ? String(result.title) : unit.title,
              contentShape: ContentShape.Sentence,
              items,
              createdAt: now,
              updatedAt: now
            })
          }

          if (type === 'phonics') {
            const result = await aiService.generateTextbookCourseContent(
              selectedTextbookName.value,
              unitLabel,
              'phonics',
              { sampleWords: generationOptions.value.sampleWords }
            )

            for (const p of result.phonics) {
              const minimalPairs = Array.isArray(p.minimal_pairs)
                ? p.minimal_pairs.map((mp) => `min-pair: ${mp.word1}/${mp.word2}${mp.explanation ? ` (${mp.explanation})` : ''}`)
                : []

              const lessonId = createStableId('tb_lesson', publisher.value, series.value, gradeLevel.value, selectedTextbookName.value, unit.unit_num, 'phonics', p.target_sound)
              const items: LessonItem[] = p.examples
                .map((ex, idx) => ({
                  id: createStableId('tb_phonics_word', lessonId, idx, String(ex.word || '').trim()),
                  english: String(ex.word || '').trim(),
                  chinese: p.pronunciation ? String(p.pronunciation) : '',
                  phonetic: ex.phonetic_breakdown,
                  examples: minimalPairs.length > 0 ? minimalPairs : undefined
                }))
                .filter((it) => !!it.english)

              lessons.push({
                id: lessonId,
                title: `Unit ${unit.unit_num} 音标 ${p.target_sound}`,
                description: String(p.pronunciation || ''),
                contentShape: ContentShape.Word,
                items,
                createdAt: now,
                updatedAt: now
              })
            }
          }

          if (lessons.length === lessonCountBefore) throw new Error('模型未返回可用内容，未将该类型标记为完成')
          completed.add(taskKey)
          task.completedKeys = [...completed]
          task.lessons = [...lessons]
          task.failedKeys = task.failedKeys.filter(key => key !== taskKey)
          courseSystemStore.markUnitTypeAsGenerated(task.publisher, task.series, task.textbookName, unit.title, type, task.gradeLevel)
          addLog(`  ✓ ${type} 生成成功（${((Date.now() - startedAt) / 1000).toFixed(1)} 秒）`)
          saveCheckpoint(task)
        } catch (e: any) {
          const message = e?.message || String(e)
          task.failedKeys = [...new Set([...task.failedKeys, taskKey])]
          task.error = message
          addLog(`  ✗ ${type} 生成失败（${((Date.now() - startedAt) / 1000).toFixed(1)} 秒）：${message}`)
          saveCheckpoint(task)
        }
      }

      const generatedTypes = [...new Set([...(unit.generatedTypes || []), ...task.selectedTypes.filter(type => completed.has(`${unit.unit_num}:${type}`))])]
      if (generatedTypes.length) courseSystemStore.saveUnits(task.publisher, task.series, task.textbookName,
        (courseSystemStore.getUnits(task.publisher, task.series, task.textbookName, task.gradeLevel) || []).map(u => u.title === unit.title ? { ...u, generatedTypes, generated: true } : u), task.gradeLevel)
      units.value = units.value.map(u => (u.title === unit.title ? { ...u, generatedTypes, generated: generatedTypes.length > 0 } : u))
    })

    task.lessons = [...lessons]
    task.completedKeys = [...completed]
    task.status = task.failedKeys.length ? 'failed' : 'completed'
    task.current = undefined
    saveCheckpoint(task)
    addLog(task.failedKeys.length ? `本轮结束：${task.completedKeys.length} 项完成，${task.failedKeys.length} 项失败，可继续重试` : `全部任务完成，共 ${task.completedKeys.length} 项，耗时 ${((Date.now() - task.startedAt) / 1000).toFixed(1)} 秒`)

    if (lessons.length === 0 && task.failedKeys.length > 0) {
      errorText.value = '本轮没有生成可用课程内容。任务检查点已保存，可点击“继续/重试未完成任务”。'
      activeStep.value = 2
      return
    }

    const pendingCourse: PendingCourseData = {
      title: `${publisher.value}${series.value}《${selectedTextbookName.value}》`,
      description: `教材导入生成（${gradeLevel.value}，单元数：${selectedUnits.length}，类型：${selectedCourseTypes.value.join(', ')}）`,
      category: 'special',
      difficulty: 'intermediate',
      lessons,
      tags: ['教材', publisher.value, series.value, gradeLevel.value, 'AI'].filter(Boolean)
    }

    try { localStorage.setItem('textbook_generation_completed_draft_v1', JSON.stringify(pendingCourse)) } catch { /* checkpoint remains available */ }
    emit('preview', pendingCourse)
    hasGenerated.value = true
    activeStep.value = 3
  } catch (e: any) {
    task.status = 'failed'; task.error = e?.message || String(e); saveCheckpoint(task)
    errorText.value = `任务中断，可继续执行：${task.error}`
    addLog(`任务中断，可继续执行：${task.error}`)
  } finally {
    runningGenerationTasks.delete(task.id)
    generating.value = false
  }
}

async function goNext() {
  if (activeStep.value === 0) {
    if (!selectedTextbookName.value) { ElMessage.warning('请先选择教材'); return }
    activeStep.value = 1
    await parseUnits(false)
    return
  }
  if (activeStep.value === 1) {
    if (units.value.length === 0) { ElMessage.warning('请先解析教材单元'); return }
    if (selectedUnitsCount.value === 0) { ElMessage.warning('请至少选择一个单元'); return }
    activeStep.value = 2
    return
  }
  if (activeStep.value === 2) {
    if (!hasGenerated.value) { ElMessage.warning('请先完成一次内容生成'); return }
    activeStep.value = 3
  }
}

function goPrev() {
  if (activeStep.value > 0) activeStep.value--
}

function restart() {
  activeStep.value = 0
  hasGenerated.value = false
  generationLogs.value = []
}

watch(publisher, async () => {
  availableSeries.value = []
  textbooks.value = []
  units.value = []
  series.value = ''
  selectedTextbookName.value = ''
  hasGenerated.value = false
  await loadSeries(false)
})

watch([publisher, series, gradeLevel], async () => {
  if (!publisher.value || !series.value) return
  await loadTextbooks(false)
})

watch(selectedTextbookName, async () => {
  if (!selectedTextbookName.value) return
  if (activeStep.value >= 1) {
    await parseUnits(false)
  }
})

onMounted(async () => {
  loadPresets()
  const saved = readCheckpoint()
  if (saved && saved.status !== 'completed') {
    recoverableCheckpoint.value = saved
    activeStep.value = 2
  }
  const completedDraft = localStorage.getItem('textbook_generation_completed_draft_v1')
  if (completedDraft) {
    try {
      const draft = JSON.parse(completedDraft) as PendingCourseData
      if (draft?.lessons?.length) {
        emit('preview', draft)
        if (saved?.status === 'completed') { hasGenerated.value = true; activeStep.value = 3 }
      }
    } catch { /* ignore invalid draft */ }
  }
  await loadSeries(false)
})
</script>

<style scoped lang="scss">
.textbook-builder {
  margin-top: 8px;
}

.error-alert {
  margin: 12px 0;
}

.step-content {
  margin-top: 16px;
}

.step-panel {
  padding: 8px 0;
}

.inline-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.preset-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.cache-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.step-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.step-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.log-card {
  height: 100%;
}

.log-box {
  height: 260px;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
  font-size: 12px;
}

.log-empty {
  color: var(--text-color-placeholder);
}

.log-line {
  white-space: pre-wrap;
}
</style>
