<!--
  课程编辑器页面
  
  用途：新建或编辑课程基本信息与课时内容
  功能：课程信息编辑、课时管理、内容编辑、预览保存
-->

<template>
  <div class="course-editor-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">{{ isNewCourse ? '新建课程' : '编辑课程' }}</h2>
        <p class="page-subtitle">编辑课程基本信息与课时内容。</p>
      </div>

      <div class="header-actions">
        <el-button @click="handleBack">取消</el-button>
        <el-button type="primary" @click="handleSave" :loading="saving">
          <el-icon><Check /></el-icon>
          保存课程
        </el-button>
      </div>
    </header>

    <div class="editor-container">
      <!-- 左侧：课程基本信息 -->
      <el-card class="basic-info-card">
        <template #header>
          <span>课程基本信息</span>
        </template>

        <el-form :model="courseForm" label-width="80px" :rules="rules" ref="formRef">
          <el-form-item label="课程标题" prop="title">
            <el-input
              v-model="courseForm.title"
              placeholder="请输入课程标题"
              clearable
            />
          </el-form-item>

          <el-form-item label="课程描述" prop="description">
            <el-input
              v-model="courseForm.description"
              type="textarea"
              :rows="3"
              placeholder="请输入课程描述"
            />
          </el-form-item>

          <el-form-item label="课程类型" prop="type">
            <el-radio-group v-model="courseForm.type">
              <el-radio value="text">文本课程</el-radio>
              <el-radio value="words">词汇课程</el-radio>
              <el-radio value="dialogue">对话课程</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="难度等级" prop="difficulty">
            <el-select v-model="courseForm.difficulty" placeholder="请选择难度">
              <el-option label="A1 - 入门" value="A1" />
              <el-option label="A2 - 初级" value="A2" />
              <el-option label="B1 - 中级" value="B1" />
              <el-option label="B2 - 中高级" value="B2" />
              <el-option label="C1 - 高级" value="C1" />
              <el-option label="自定义" value="custom" />
            </el-select>
          </el-form-item>

          <el-form-item label="课程分类" prop="category">
            <el-select v-model="courseForm.category" placeholder="请选择分类">
              <el-option label="日常对话" value="daily" />
              <el-option label="商务英语" value="business" />
              <el-option label="旅游英语" value="travel" />
              <el-option label="学术英语" value="academic" />
              <el-option label="考试备考" value="exam" />
              <el-option label="兴趣爱好" value="hobby" />
              <el-option label="其他" value="other" />
            </el-select>
          </el-form-item>

          <el-form-item label="课程标签">
            <el-tag
              v-for="tag in courseForm.tags"
              :key="tag"
              closable
              @close="removeTag(tag)"
              class="tag-item"
            >
              {{ tag }}
            </el-tag>
            <el-input
              v-if="tagInputVisible"
              ref="tagInputRef"
              v-model="tagInputValue"
              size="small"
              @keyup.enter="addTag"
              @blur="addTag"
              class="tag-input"
            />
            <el-button v-else size="small" @click="showTagInput">
              <el-icon><Plus /></el-icon>
              添加标签
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 右侧：课时管理 -->
      <el-card class="lessons-card">
        <template #header>
          <div class="lessons-header">
            <span>课时管理 ({{ lessons.length }})</span>
            <el-button size="small" type="primary" @click="addLesson">
              <el-icon><Plus /></el-icon>
              添加课时
            </el-button>
          </div>
        </template>

        <el-empty v-if="lessons.length === 0" description="还没有课时，点击添加课时按钮开始">
          <el-button type="primary" @click="addLesson">添加第一个课时</el-button>
        </el-empty>

        <el-tabs
          v-else
          v-model="activeLesson"
          type="card"
          editable
          @edit="handleLessonEdit"
          @tab-change="handleLessonChange"
        >
          <el-tab-pane
            v-for="(lesson, index) in lessons"
            :key="lesson.id"
            :label="`课时 ${index + 1}`"
            :name="lesson.id"
          >
            <!-- 课时内容编辑 -->
            <div class="lesson-content">
              <el-form label-width="80px">
                <el-form-item label="课时标题">
                  <el-input
                    v-model="lesson.title"
                    placeholder="请输入课时标题"
                  />
                </el-form-item>

                <el-form-item label="课时描述">
                  <el-input
                    v-model="lesson.description"
                    type="textarea"
                    :rows="2"
                    placeholder="请输入课时描述（可选）"
                  />
                </el-form-item>

                <el-form-item label="内容类型">
                  <el-radio-group v-model="lesson.contentShape">
                    <el-radio value="Word">单词</el-radio>
                    <el-radio value="Phrase">短语</el-radio>
                    <el-radio value="Sentence">句子</el-radio>
                    <el-radio value="Passage">段落</el-radio>
                    <el-radio value="Dialog">对话</el-radio>
                  </el-radio-group>
                </el-form-item>

                <el-form-item label="课时内容">
                  <el-input
                    v-model="lesson.content"
                    type="textarea"
                    :rows="10"
                    placeholder="请输入课时内容（每行一个单词/句子，或粘贴整段文本）"
                    @change="parseContent(lesson)"
                  />
                  <div class="content-actions">
                    <el-button size="small" @click="parseContent(lesson)">
                      <el-icon><MagicStick /></el-icon>
                      解析内容
                    </el-button>
                    <el-button 
                      size="small" 
                      @click="translateContent(lesson)"
                      :loading="translating"
                    >
                      <el-icon><Document /></el-icon>
                      AI翻译
                    </el-button>
                    <el-button 
                      size="small" 
                      @click="generateAudio(lesson)"
                      :loading="generatingAudio"
                    >
                      <el-icon><Microphone /></el-icon>
                      生成音频
                    </el-button>
                    <el-button 
                      v-if="lesson.items && lesson.items.length > 0"
                      size="small" 
                      type="primary"
                      @click="showItemsEditor(lesson)"
                    >
                      <el-icon><EditPen /></el-icon>
                      编辑详情 ({{ lesson.items.length }})
                    </el-button>
                  </div>
                  
                  <!-- 音频生成进度 -->
                  <div v-if="audioProgress.visible" class="audio-progress">
                    <div class="progress-header">
                      <span>正在生成音频...</span>
                      <el-button size="small" text @click="cancelAudioGeneration">取消</el-button>
                    </div>
                    <el-progress 
                      :percentage="audioProgress.percent" 
                      :status="audioProgress.status"
                    >
                      <span>{{ audioProgress.completed }} / {{ audioProgress.total }}</span>
                    </el-progress>
                  </div>
                </el-form-item>

                <!-- 解析结果 -->
                <el-form-item v-if="lesson.items && lesson.items.length > 0" label="解析结果">
                  <div class="items-list">
                    <el-alert
                      :title="`已解析 ${lesson.items.length} 个条目`"
                      type="success"
                      :closable="false"
                      show-icon
                    />
                    <div class="items-preview">
                      <el-tag
                        v-for="(item, idx) in lesson.items.slice(0, 10)"
                        :key="idx"
                        size="small"
                        class="item-tag"
                      >
                        {{ item.english }}
                      </el-tag>
                      <span v-if="lesson.items.length > 10" class="more-text">
                        等 {{ lesson.items.length }} 个
                      </span>
                    </div>
                  </div>
                </el-form-item>

                <el-form-item label="练习模式">
                  <el-checkbox-group v-model="lesson.practiceMode">
                    <el-checkbox label="Dictation">听写</el-checkbox>
                    <el-checkbox label="FollowRead">跟读</el-checkbox>
                    <el-checkbox label="Translation">翻译</el-checkbox>
                    <el-checkbox label="Imitation">模仿</el-checkbox>
                  </el-checkbox-group>
                </el-form-item>
              </el-form>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

    <!-- 项目编辑器对话框 -->
    <el-dialog 
      v-model="itemsEditorVisible" 
      title="编辑课时内容"
      width="90%"
      :close-on-click-modal="false"
    >
      <div v-if="editingLesson" class="items-editor">
        <el-table :data="editingLesson.items" border style="width: 100%">
          <el-table-column type="index" label="#" width="60" />
          
          <el-table-column label="英文" width="200">
            <template #default="{ row }">
              <el-input v-model="row.english" placeholder="输入英文" />
            </template>
          </el-table-column>
          
          <el-table-column label="中文" width="200">
            <template #default="{ row }">
              <el-input v-model="row.chinese" placeholder="输入中文" />
            </template>
          </el-table-column>
          
          <el-table-column label="音标" width="150">
            <template #default="{ row }">
              <el-input v-model="row.phonetic" placeholder="音标（选填）" />
            </template>
          </el-table-column>
          
          <el-table-column label="词性" width="120">
            <template #default="{ row }">
              <el-select v-model="row.partOfSpeech" placeholder="选择">
                <el-option label="名词" value="noun" />
                <el-option label="动词" value="verb" />
                <el-option label="形容词" value="adjective" />
                <el-option label="副词" value="adverb" />
                <el-option label="其他" value="other" />
              </el-select>
            </template>
          </el-table-column>
          
          <el-table-column label="音频" width="100">
            <template #default="{ row }">
              <el-tag :type="row.audioPath ? 'success' : 'info'" size="small">
                {{ row.audioPath ? '已生成' : '未生成' }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ $index }">
              <el-button 
                type="danger" 
                size="small" 
                text
                @click="deleteItem(editingLesson, $index)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        
        <div class="editor-actions">
          <el-button @click="addNewItem(editingLesson)">
            <el-icon><Plus /></el-icon>
            添加项目
          </el-button>
        </div>
      </div>
      
      <template #footer>
        <el-button @click="itemsEditorVisible = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Check,
  Plus,
  MagicStick,
  Document,
  Microphone,
  EditPen,
  Delete,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import type { Course, Lesson, LessonItem, ContentShape, PracticeMode } from '../../shared/types/course'

const route = useRoute()
const router = useRouter()
const courseStore = useCourseStore()

function applyEntryActionAfterLoad() {
  const requestedLessonId = typeof route.query.lessonId === 'string' ? route.query.lessonId : ''
  const shouldAddLesson = route.query.addLesson === '1'

  if (requestedLessonId) {
    const exists = lessons.value.some((l) => l.id === requestedLessonId)
    if (exists) {
      activeLesson.value = requestedLessonId
      return
    }
  }

  if (shouldAddLesson) {
    addLesson()
  }
}

// 表单引用
const formRef = ref<FormInstance>()
const tagInputRef = ref<HTMLInputElement>()

// 是否为新建课程
const isNewCourse = computed(() => !route.params.courseId)
const saving = ref(false)
const translating = ref(false)
const generatingAudio = ref(false)

// 音频生成进度
const audioProgress = reactive({
  visible: false,
  percent: 0,
  completed: 0,
  total: 0,
  status: '' as '' | 'success' | 'exception'
})

// 项目编辑器
const itemsEditorVisible = ref(false)
const editingLesson = ref<EditorLesson | null>(null)

// 课程表单数据
const courseForm = reactive({
  title: '',
  description: '',
  type: 'text' as 'text' | 'words' | 'dialogue',
  difficulty: 'B1' as Course['difficulty'],
  category: 'daily' as Course['category'],
  tags: [] as string[],
})

// 标签输入
const tagInputVisible = ref(false)
const tagInputValue = ref('')

// 课时列表
interface EditorLesson extends Omit<Lesson, 'practiceMode' | 'contentShape'> {
  content: string
  practiceMode: string[]
  contentShape: string
}

const lessons = ref<EditorLesson[]>([])
const activeLesson = ref<string>('')

// 表单验证规则
const rules = {
  title: [
    { required: true, message: '请输入课程标题', trigger: 'blur' },
    { min: 2, max: 100, message: '标题长度在 2 到 100 个字符', trigger: 'blur' },
  ],
  description: [
    { max: 500, message: '描述不能超过 500 个字符', trigger: 'blur' },
  ],
}

// 添加课时
function addLesson() {
  const newLesson: EditorLesson = {
    id: `lesson_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    title: `课时 ${lessons.value.length + 1}`,
    description: '',
    content: '',
    contentShape: 'Sentence',
    items: [],
    practiceMode: ['Dictation', 'FollowRead', 'Translation'],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  
  lessons.value.push(newLesson)
  activeLesson.value = newLesson.id
}

// 处理课时编辑（删除）
function handleLessonEdit(targetName: string | number | undefined, action: 'remove' | 'add') {
  if (action === 'remove') {
    if (targetName === undefined) return
    ElMessageBox.confirm('确定要删除这个课时吗？', '确认删除', {
      type: 'warning',
    }).then(() => {
      const index = lessons.value.findIndex(l => l.id === targetName)
      if (index !== -1) {
        lessons.value.splice(index, 1)
        if (lessons.value.length > 0) {
          activeLesson.value = lessons.value[Math.max(0, index - 1)].id
        } else {
          activeLesson.value = ''
        }
        ElMessage.success('课时已删除')
      }
    }).catch(() => {
      // 取消删除
    })
  } else if (action === 'add') {
    addLesson()
  }
}

// 课时切换
function handleLessonChange(name: string | number) {
  activeLesson.value = name as string
}

// 解析课时内容
function parseContent(lesson: EditorLesson) {
  if (!lesson.content.trim()) {
    ElMessage.warning('请先输入课时内容')
    return
  }
  
  try {
    // 按行分割内容
    const lines = lesson.content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
    
    // 转换为 LessonItem 格式
    const items: LessonItem[] = lines.map((line, index) => ({
      id: `item_${Date.now()}_${index}`,
      english: line,
      chinese: '', // 待翻译
      audioPath: undefined,
      phonetic: undefined,
      partOfSpeech: undefined,
      examples: undefined,
    }))
    
    lesson.items = items
    lesson.updatedAt = Date.now()
    
    ElMessage.success(`成功解析 ${items.length} 个条目`)
  } catch (error) {
    console.error('解析内容失败:', error)
    ElMessage.error('解析内容失败')
  }
}

// AI翻译
async function translateContent(lesson: EditorLesson) {
  if (!lesson.items || lesson.items.length === 0) {
    ElMessage.warning('请先解析课时内容')
    return
  }
  
  translating.value = true
  try {
    const batchSize = 20
    let translatedCount = 0
    
    for (let i = 0; i < lesson.items.length; i += batchSize) {
      const batch = lesson.items.slice(i, i + batchSize)
      const textsToTranslate = batch.filter(item => !item.chinese).map(item => item.english)
      
      if (textsToTranslate.length > 0) {
        // 调用翻译API（模拟）
        const translations = await mockTranslateAPI(textsToTranslate)
        
        let translationIndex = 0
        for (const item of batch) {
          if (!item.chinese && translationIndex < translations.length) {
            item.chinese = translations[translationIndex]
            translationIndex++
            translatedCount++
          }
        }
      }
      
      ElMessage.success(`已翻译 ${Math.min(i + batchSize, lesson.items.length)} / ${lesson.items.length}`)
    }
    
    ElMessage.success(`翻译完成！共翻译 ${translatedCount} 条`)
  } catch (error) {
    console.error('翻译失败:', error)
    ElMessage.error('翻译失败，请重试')
  } finally {
    translating.value = false
  }
}

// 模拟翻译API
async function mockTranslateAPI(texts: string[]): Promise<string[]> {
  await new Promise(resolve => setTimeout(resolve, 500))
  
  const simpleDict: Record<string, string> = {
    'hello': '你好',
    'world': '世界',
    'good': '好的',
    'morning': '早上',
    'evening': '晚上',
    'thank you': '谢谢',
    'welcome': '欢迎',
    'goodbye': '再见',
  }
  
  return texts.map(text => {
    const lower = text.toLowerCase()
    return simpleDict[lower] || `【${text}】的翻译`
  })
}

// 生成音频
async function generateAudio(lesson: EditorLesson) {
  if (!lesson.items || lesson.items.length === 0) {
    ElMessage.warning('请先解析课时内容')
    return
  }
  
  generatingAudio.value = true
  audioProgress.visible = true
  audioProgress.percent = 0
  audioProgress.completed = 0
  audioProgress.total = lesson.items.length
  audioProgress.status = ''
  
  try {
    for (let i = 0; i < lesson.items.length; i++) {
      const item = lesson.items[i]
      
      // 如果已有音频，跳过
      if (item.audioPath) {
        audioProgress.completed++
        audioProgress.percent = Math.floor((audioProgress.completed / audioProgress.total) * 100)
        continue
      }
      
      // 调用TTS API生成音频（模拟）
      await new Promise(resolve => setTimeout(resolve, 200))
      item.audioPath = `/data/tts-cache/${item.id}.mp3`
      
      // 更新进度
      audioProgress.completed++
      audioProgress.percent = Math.floor((audioProgress.completed / audioProgress.total) * 100)
    }
    
    audioProgress.status = 'success'
    ElMessage.success(`音频生成完成！共生成 ${audioProgress.completed} 个音频文件`)
    
    setTimeout(() => {
      audioProgress.visible = false
    }, 2000)
  } catch (error) {
    console.error('音频生成失败:', error)
    audioProgress.status = 'exception'
    ElMessage.error('音频生成失败，请重试')
  } finally {
    generatingAudio.value = false
  }
}

// 取消音频生成
function cancelAudioGeneration() {
  generatingAudio.value = false
  audioProgress.visible = false
  ElMessage.info('已取消音频生成')
}

// 显示项目编辑器
function showItemsEditor(lesson: EditorLesson) {
  if (!lesson.items || lesson.items.length === 0) {
    ElMessage.warning('暂无内容项')
    return
  }
  editingLesson.value = lesson
  itemsEditorVisible.value = true
}

// 删除项目
function deleteItem(lesson: EditorLesson, index: number) {
  ElMessageBox.confirm('确定删除这个项目吗？', '确认删除', {
    type: 'warning',
  }).then(() => {
    lesson.items.splice(index, 1)
    ElMessage.success('删除成功')
  }).catch(() => {})
}

// 添加新项目
function addNewItem(lesson: EditorLesson) {
  lesson.items.push({
    id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    english: '',
    chinese: '',
    audioPath: undefined,
  })
}

// 添加标签
function addTag() {
  if (tagInputValue.value) {
    if (!courseForm.tags.includes(tagInputValue.value)) {
      courseForm.tags.push(tagInputValue.value)
    }
    tagInputValue.value = ''
    tagInputVisible.value = false
  }
}

// 移除标签
function removeTag(tag: string) {
  const index = courseForm.tags.indexOf(tag)
  if (index !== -1) {
    courseForm.tags.splice(index, 1)
  }
}

// 显示标签输入
function showTagInput() {
  tagInputVisible.value = true
  nextTick(() => {
    tagInputRef.value?.focus()
  })
}

// 保存课程
async function handleSave() {
  if (!formRef.value) return
  
  try {
    await formRef.value.validate()
    
    if (lessons.value.length === 0) {
      ElMessage.warning('请至少添加一个课时')
      return
    }
    
    saving.value = true
    
    // 转换课时数据格式
    const courseLessons: Lesson[] = lessons.value.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      description: lesson.description || undefined,
      contentShape: lesson.contentShape as ContentShape,
      items: lesson.items || [],
      createdAt: lesson.createdAt,
      updatedAt: lesson.updatedAt,
    }))
    
    // 构建课程数据
    const courseData: Partial<Course> = {
      title: courseForm.title,
      description: courseForm.description,
      category: courseForm.category,
      difficulty: courseForm.difficulty,
      lessons: courseLessons,
      lessonCount: courseLessons.length,
      tags: courseForm.tags.length > 0 ? courseForm.tags : undefined,
      updatedAt: Date.now(),
    }
    
    if (isNewCourse.value) {
      courseData.createdAt = Date.now()
      await courseStore.createCourse(courseData as any)
      ElMessage.success('课程创建成功')
    } else {
      await courseStore.updateCourse(route.params.courseId as string, courseData as any)
      ElMessage.success('课程更新成功')
    }
    
    // 跳转到课程仓库
    router.push('/course-repository')
  } catch (error) {
    console.error('保存课程失败:', error)
    ElMessage.error('保存课程失败')
  } finally {
    saving.value = false
  }
}

// 返回
function handleBack() {
  if (lessons.value.length > 0 || courseForm.title) {
    ElMessageBox.confirm('确定要放弃编辑吗？未保存的内容将丢失。', '确认返回', {
      type: 'warning',
    }).then(() => {
      router.back()
    }).catch(() => {
      // 取消返回
    })
  } else {
    router.back()
  }
}

// 如果是编辑模式，加载课程数据
if (!isNewCourse.value) {
  courseStore.loadCourseById(route.params.courseId as string).then(() => {
    const course = courseStore.currentCourse as Course | null
    if (!course) return

    const loadedCourse = course as Course

    courseForm.title = loadedCourse.title
    courseForm.description = loadedCourse.description || ''
    courseForm.category = loadedCourse.category
    courseForm.difficulty = loadedCourse.difficulty
    courseForm.tags = loadedCourse.tags || []

    // 转换课时数据
    lessons.value = (loadedCourse.lessons || []).map((lesson: Lesson): EditorLesson => ({
      ...lesson,
      content: lesson.items?.map((item: LessonItem) => item.english).join('\n') || '',
      contentShape: lesson.contentShape || 'Sentence',
      practiceMode: ['Dictation', 'FollowRead', 'Translation'],
    }))

    if (lessons.value.length > 0) {
      activeLesson.value = lessons.value[0].id
    }

    applyEntryActionAfterLoad()
  })
}
</script>

<style lang="scss" scoped>
.course-editor-page {
  padding: 0;
  max-width: 1280px;

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 20px;
  }

  .page-title {
    margin: 0 0 8px;
    font-size: 32px;
    font-weight: 300;
    letter-spacing: -0.02em;
    color: var(--text-color);
  }

  .page-subtitle {
    margin: 0;
    font-size: 16px;
    font-weight: 300;
    color: var(--text-color-secondary);
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }
  
  .editor-container {
    display: grid;
    grid-template-columns: 400px 1fr;
    gap: 20px;
    
    @media (max-width: 1200px) {
      grid-template-columns: 1fr;
    }
  }
  
  .basic-info-card {
    height: fit-content;
    
    .tag-item {
      margin-right: 8px;
      margin-bottom: 8px;
    }
    
    .tag-input {
      width: 100px;
      vertical-align: middle;
    }
  }
  
  .lessons-card {
    .lessons-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .lesson-content {
      padding: 20px 0;
      
      .content-actions {
        margin-top: 12px;
        display: flex;
        gap: 8px;
      }
      
      .audio-progress {
        margin-top: 16px;
        padding: 16px;
        background: var(--el-fill-color-light);
        border-radius: 8px;
        
        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          font-size: 14px;
          color: var(--el-text-color-regular);
        }
      }
      
      .items-list {
        .items-preview {
          margin-top: 12px;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          
          .item-tag {
            max-width: 200px;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          
          .more-text {
            color: #909399;
            font-size: 14px;
          }
        }
      }
    }
  }
}

.items-editor {
  .editor-actions {
    margin-top: 16px;
    text-align: center;
  }
}

.chinese-text {
  margin-left: 8px;
  color: #909399;
  font-size: 12px;
}
</style>

