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
            <el-option v-for="u in unitOptions" :key="u.title" :label="`Unit ${u.unit_num}: ${u.title}`" :value="u.title" />
          </el-select>
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
            <span>正在生成：{{ generationProgress.doneUnits }}/{{ generationProgress.totalUnits }}</span>
            <span v-if="generationProgress.currentUnit" class="progress-detail">
              {{ generationProgress.currentUnit }}<span v-if="generationProgress.currentType"> · {{ generationProgress.currentType }}</span>
            </span>
          </div>
          <el-progress :percentage="generationProgress.percentage" :status="loading ? undefined : 'success'" />
        </div>

        <div class="step-actions">
          <el-button :disabled="loading" @click="step = 1">← 上一步</el-button>
          <el-button type="primary" :loading="loading" @click="generateCoursesFromTextbook">
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
import { ref, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
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
const gradeOptions = ref<string[]>([])
const textbookOptions = ref<Array<{ grade: string; semester: string; name: string }>>([])
const unitOptions = ref<Array<{ unit_num: number; title: string; topics: string[] }>>([])

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
  currentUnit: '',
  currentType: '' as '' | 'words' | 'sentences' | 'passage' | 'grammar' | 'phonics',
  get percentage() {
    if (!this.totalUnits) return 0
    return Math.min(100, Math.round((this.doneUnits / this.totalUnits) * 100))
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
      const result = await ai.fetchSeriesList(publisher)
      series = [...new Set((result.series || []).map((value) => String(value).trim()).filter(Boolean))]
      if (!series.length) throw new Error('未获取到教材系列，请检查出版社名称后重试')
      courseSystemStore.saveSeries(publisher, series)
    }
    seriesOptions.value = series
    if (!seriesOptions.value.includes(textbookForm.series)) {
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

    const units = await ai.parseTextbookUnits(
      publisherForm.publisher.trim(),
      textbookForm.series.trim(),
      textbookForm.textbookName.trim()
    )
    unitOptions.value = units.units || []
    if (!unitOptions.value.length) {
      throw new Error('未解析到教材单元')
    }
    unitForm.unitTitles = [unitOptions.value[0].title]
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
    const result = await ai.fetchTextbookList(publisher, selectedSeries)
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

    generationProgress.totalUnits = selectedUnits.length

    for (const unitTitle of selectedUnits) {
      generationProgress.currentUnit = unitTitle
      const lessons: Lesson[] = []
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

      let wordsForPhonics: WordEntry[] = []

      if (selectedTypes.includes('words')) {
        generationProgress.currentType = 'words'
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

      if (selectedTypes.includes('sentences')) {
        generationProgress.currentType = 'sentences'
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

      if (selectedTypes.includes('passage')) {
        generationProgress.currentType = 'passage'
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

      if (selectedTypes.includes('grammar')) {
        generationProgress.currentType = 'grammar'
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

      if (selectedTypes.includes('phonics')) {
        generationProgress.currentType = 'phonics'
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

      const courseTitle = `${textbookForm.textbookName} - ${unitTitle}`
      courses.push({
        title: courseTitle,
        description: `${publisherForm.publisher} / ${textbookForm.series}`,
        category: 'special',
        difficulty: 'intermediate',
        lessons,
        tags: baseTags,
      })

      generationProgress.doneUnits += 1
    }

    pendingCourses.value = courses
    addDiagnosticLog('info', 'textbook-course-generation', '教材课程草稿生成成功', { courses: courses.length, lessons: courses.reduce((sum, course) => sum + course.lessons.length, 0) })
    step.value = 3
    ElMessage.success('课程已生成，可预览后批量保存')
  } catch (e) {
    error.value = e instanceof Error ? e.message : '生成课程失败'
    addDiagnosticLog('error', 'textbook-course-generation', '教材课程生成失败', error.value)
    ElMessage.error(error.value)
  } finally {
    loading.value = false
    generationProgress.active = false
    generationProgress.currentUnit = ''
    generationProgress.currentType = ''
  }
}

async function withAudioForItems(items: LessonItem[], kind: 'word' | 'sentence' | 'passage'): Promise<LessonItem[]> {
  const result: LessonItem[] = []
  for (const item of items) {
    const text = String(item.english || '').trim()
    if (!text) {
      result.push(item)
      continue
    }

    // 显式沿用设置页当前音色，保证“生成课程时听到的声音”和学习时一致
    const audioPath = await generateSpeech(text, 'en', {
      engine: settingsStore.ttsEngine,
      voice: settingsStore.ttsVoiceId,
      rate: settingsStore.ttsSpeed,
    })
    result.push({
      ...item,
      audioPath: audioPath || undefined,
    })
  }
  return result
}

async function generateCoursesFromTextbook() {
  await generateCourseFromTextbook()
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
    addDiagnosticLog('info', 'textbook-course-generation', '开始批量保存教材课程', { count: pendingCourses.value.length, alreadySaved: ids.filter(Boolean).length })
    for (let index = 0; index < pendingCourses.value.length; index += 1) {
      // 部分失败后重试时跳过已保存的课程，避免重复创建。
      if (ids[index]) continue
      const id = await courseStore.createCourse(pendingCourses.value[index])
      ids[index] = id
      savedIds.value = [...ids]
    }
    savedIds.value = ids
    addDiagnosticLog('info', 'textbook-course-generation', '教材课程批量保存成功', { count: ids.filter(Boolean).length, courseIds: ids.filter(Boolean) })
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
