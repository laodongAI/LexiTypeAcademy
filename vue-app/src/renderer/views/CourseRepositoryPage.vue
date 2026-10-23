<!--
  课程仓库页面
  
  展示所有课程，支持筛选、搜索、批量操作
-->

<template>
  <div class="course-repository-page">
    <header class="page-header">
      <div>
        <h2 class="page-title">课程仓库</h2>
        <p class="page-subtitle">浏览与管理你创建或导入的课程。</p>
      </div>

      <div class="header-actions">
        <el-button type="primary" @click="showImportDialog = true">
          <el-icon><Upload /></el-icon>
          导入
        </el-button>
        <el-button @click="createNewCourse">
          <el-icon><Plus /></el-icon>
          新建
        </el-button>
      </div>
    </header>

    <div class="toolbar-row">
      <el-input
        v-model="searchQuery"
        placeholder="搜索课程..."
        clearable
        @input="handleSearch"
      >
        <template #prefix>
          <el-icon><Search /></el-icon>
        </template>
      </el-input>

      <div class="toolbar-actions">
        <el-button :type="showFilter ? 'primary' : ''" @click="showFilter = !showFilter">
          <el-icon><Filter /></el-icon>
          筛选
        </el-button>

        <template v-if="selectedCourses.length > 0">
          <el-divider direction="vertical" />
          <el-button type="primary" plain @click="handleBatchAction('add-to-learning')">
            <el-icon><Plus /></el-icon>
            加入学习
          </el-button>
          <el-button @click="handleBatchAction('export')">
            <el-icon><Download /></el-icon>
            导出
          </el-button>
          <el-button type="danger" plain @click="handleBatchAction('delete')">
            <el-icon><Delete /></el-icon>
            删除
          </el-button>
          <el-divider direction="vertical" />
          <el-button text @click="selectAll">
            <el-icon><Select /></el-icon>
            全选
          </el-button>
          <el-button text @click="invertSelection">
            <el-icon><RefreshRight /></el-icon>
            反选
          </el-button>
          <el-button text @click="clearSelection">
            <el-icon><Close /></el-icon>
            清空
          </el-button>
          <span class="selection-info">已选 <strong>{{ selectedCourses.length }}</strong> 个</span>
        </template>
      </div>
    </div>

    <!-- 筛选面板 -->
    <el-collapse-transition>
      <div v-show="showFilter" class="filter-panel">
        <el-form :model="filters" label-width="80px" size="small">
          <el-row :gutter="16">
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="来源">
                <el-select v-model="filters.source" placeholder="全部" clearable>
                  <el-option label="全部" value="" />
                  <el-option label="AI生成" value="ai_generated" />
                  <el-option label="用户创建" value="user_created" />
                  <el-option label="导入" value="imported" />
                  <el-option label="音频导入" value="audio_import" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="类型">
                <el-select v-model="filters.type" placeholder="全部" clearable>
                  <el-option label="全部" value="" />
                  <el-option label="句子课程" value="text" />
                  <el-option label="单词课程" value="words" />
                  <el-option label="混合课程" value="mixed" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="难度">
                <el-select v-model="filters.difficulty" placeholder="全部" clearable>
                  <el-option label="全部" value="" />
                  <el-option label="初级" value="beginner" />
                  <el-option label="中级" value="intermediate" />
                  <el-option label="高级" value="advanced" />
                  <el-option label="自定义" value="custom" />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12" :md="6">
              <el-form-item label="状态">
                <el-select v-model="filters.inLearningList" placeholder="全部" clearable>
                  <el-option label="全部" value="" />
                  <el-option label="在学习列表" :value="true" />
                  <el-option label="不在学习列表" :value="false" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>
        </el-form>
      </div>
    </el-collapse-transition>

    <!-- 课程列表 -->
    <el-card class="courses-card">
      <template #header>
        <div class="card-header">
          <span>共 {{ total }} 个课程</span>
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="grid">
              <el-icon><Grid /></el-icon>
            </el-radio-button>
            <el-radio-button value="list">
              <el-icon><List /></el-icon>
            </el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 空状态 -->
      <el-empty v-if="displayCourses.length === 0" description="没有找到课程">
        <el-button type="primary" @click="createNewCourse">
          新建课程
        </el-button>
      </el-empty>

      <!-- 卡片视图 -->
      <div v-else-if="viewMode === 'grid'" class="courses-grid">
        <el-card
          v-for="course in displayCourses"
          :key="course.id"
          class="course-card"
          :class="{ selected: selectedCourses.includes(course.id) }"
          shadow="hover"
        >
          <div class="card-header-row">
            <el-checkbox
              :model-value="selectedCourses.includes(course.id)"
              @change="toggleSelection(course.id)"
            />
            <el-tag
              v-if="course.source"
              :type="getSourceType(course.source)"
              size="small"
            >
              {{ getSourceText(course.source) }}
            </el-tag>
            <el-tag v-if="course.inLearningList" type="success" size="small">
              学习中
            </el-tag>
          </div>

          <h3 class="course-title" @click="goToCourse(course)">
            {{ course.title }}
          </h3>
          
          <p class="course-description">{{ course.description || '暂无描述' }}</p>
          
          <div class="course-meta">
            <el-tag size="small">{{ getDifficultyText(course.difficulty) }}</el-tag>
            <span><el-icon><Document /></el-icon> {{ course.lessons?.length || 0 }} 课时</span>
            <span><el-icon><Clock /></el-icon> {{ formatDate(course.createdAt) }}</span>
          </div>
          
          <div class="course-actions">
            <el-button
              v-if="!course.inLearningList"
              type="primary"
              size="small"
              @click="addToLearning(course)"
            >
              加入学习
            </el-button>
            <el-button
              v-else
              type="success"
              size="small"
              @click="goToCourse(course)"
            >
              继续学习
            </el-button>
            <el-dropdown @command="(cmd) => handleCourseAction(cmd, course)">
              <el-button size="small" text>
                <el-icon><MoreFilled /></el-icon>
              </el-button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="view">查看详情</el-dropdown-item>
                  <el-dropdown-item command="edit">编辑</el-dropdown-item>
                  <el-dropdown-item command="export">导出</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-card>
      </div>

      <!-- 列表视图 -->
      <el-table
        v-else
        :data="displayCourses"
        @selection-change="handleSelectionChange"
      >
        <el-table-column type="selection" width="55" />
        <el-table-column prop="title" label="课程名称" min-width="200" />
        <el-table-column label="来源" width="100">
          <template #default="{ row }">
            <el-tag :type="getSourceType(row.source)" size="small">
              {{ getSourceText(row.source) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="难度" width="80">
          <template #default="{ row }">
            {{ getDifficultyText(row.difficulty) }}
          </template>
        </el-table-column>
        <el-table-column label="课时数" width="80">
          <template #default="{ row }">
            {{ row.lessons?.length || 0 }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.inLearningList" type="success" size="small">
              学习中
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="120">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-space>
              <el-button
                v-if="!row.inLearningList"
                type="primary"
                size="small"
                @click="addToLearning(row)"
              >
                加入学习
              </el-button>
              <el-button size="small" @click="goToCourse(row)">
                查看
              </el-button>
              <el-dropdown @command="(cmd) => handleCourseAction(cmd, row)">
                <el-button size="small" text>
                  <el-icon><MoreFilled /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">编辑</el-dropdown-item>
                    <el-dropdown-item command="export">导出</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <!-- 分页 -->
      <el-pagination
        v-if="filteredTotal > pageSize"
        :current-page="currentPage"
        :page-size="pageSize"
        @update:current-page="handleUpdateCurrentPage"
        @update:page-size="handleUpdatePageSize"
        :total="filteredTotal"
        :page-sizes="[10, 20, 50, 100]"
        layout="total, sizes, prev, pager, next, jumper"
        class="pagination"
        @current-change="loadCourses"
        @size-change="loadCourses"
      />
    </el-card>

    <!-- 导入对话框 -->
    <el-dialog v-model="showImportDialog" title="导入课程" width="500px">
      <el-form>
        <el-form-item label="导入方式">
          <el-radio-group v-model="importMethod">
            <el-radio value="json">JSON文件</el-radio>
            <el-radio value="text">文本粘贴</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="importMethod === 'json'">
          <el-upload
            drag
            accept=".json"
            :auto-upload="false"
            :on-change="handleFileChange"
          >
            <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
            <div class="el-upload__text">
              将文件拖到此处，或<em>点击上传</em>
            </div>
          </el-upload>
        </el-form-item>
        <el-form-item v-else>
          <el-input
            v-model="importText"
            type="textarea"
            :rows="10"
            placeholder="粘贴课程JSON数据..."
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showImportDialog = false">取消</el-button>
        <el-button type="primary" @click="handleImport">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  Search,
  Filter,
  Upload,
  Plus,
  ArrowDown,
  Grid,
  List,
  Document,
  Clock,
  MoreFilled,
  UploadFilled,
  Download,
  Delete,
  Select,
  RefreshRight,
  Close,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import { useLearningStore } from '../stores/learningStore'
import type { Course } from '../../shared/types/course'

type CourseSource = string | { type: string }

type CourseListItem = Course & {
  source?: CourseSource
  type?: string
  inLearningList?: boolean
}

// 路由
const router = useRouter()

// Stores
const courseStore = useCourseStore()
const learningStore = useLearningStore()

// 搜索和筛选
const searchQuery = ref('')
const showFilter = ref(false)
const filters = ref({
  source: '',
  type: '',
  difficulty: '',
  inLearningList: '',
})

// 视图模式
const viewMode = ref<'grid' | 'list'>('grid')

// 选中的课程
const selectedCourses = ref<string[]>([])
// 用于跨分页记录选择状态
const allSelectedCourses = ref<Set<string>>(new Set())

// 分页
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)

// 课程列表 - 从 store 获取
const courses = computed<CourseListItem[]>(() => courseStore.courses as unknown as CourseListItem[])

// 显示的课程 - 应用筛选和搜索
const displayCourses = computed(() => {
  let filtered = courses.value

  // 应用搜索
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(c => 
      c.title.toLowerCase().includes(query) ||
      (c.description && c.description.toLowerCase().includes(query))
    )
  }

  // 应用来源筛选
  if (filters.value.source) {
    filtered = filtered.filter(c => {
      const source = typeof c.source === 'string' ? c.source : (c.source as any)?.type
      return source === filters.value.source
    })
  }

  // 应用类型筛选
  if (filters.value.type) {
    filtered = filtered.filter(c => c.type === filters.value.type)
  }

  // 应用难度筛选
  if (filters.value.difficulty) {
    filtered = filtered.filter(c => c.difficulty === filters.value.difficulty)
  }

  // 应用学习列表筛选
  if (filters.value.inLearningList !== '') {
    // TODO: 实现学习列表筛选
  }

  // 分页
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filtered.slice(start, end)
})

// 计算筛选后的总数
const filteredTotal = computed(() => {
  let count = courses.value.length

  // 应用筛选后的总数
  if (searchQuery.value || filters.value.source || filters.value.type || filters.value.difficulty) {
    let filtered = courses.value

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase()
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(query) ||
        (c.description && c.description.toLowerCase().includes(query))
      )
    }

    if (filters.value.source) {
      filtered = filtered.filter(c => {
        const source = typeof c.source === 'string' ? c.source : (c.source as any)?.type
        return source === filters.value.source
      })
    }

    if (filters.value.type) {
      filtered = filtered.filter(c => c.type === filters.value.type)
    }

    if (filters.value.difficulty) {
      filtered = filtered.filter(c => c.difficulty === filters.value.difficulty)
    }

    count = filtered.length
  }

  return count
})

// 导入对话框
const showImportDialog = ref(false)
const importMethod = ref<'json' | 'text'>('json')
const importText = ref('')

// 加载课程
async function loadCourses() {
  await courseStore.loadCourses()
}

function handleUpdateCurrentPage(page: number) {
  currentPage.value = page
}

function handleUpdatePageSize(size: number) {
  pageSize.value = size
}

// 搜索
function handleSearch() {
  currentPage.value = 1
}

// 监听筛选变化
watch(filters, () => {
  currentPage.value = 1
}, { deep: true })

// 切换选择
function toggleSelection(id: string) {
  const index = selectedCourses.value.indexOf(id)
  if (index > -1) {
    selectedCourses.value.splice(index, 1)
    allSelectedCourses.value.delete(id)
  } else {
    selectedCourses.value.push(id)
    allSelectedCourses.value.add(id)
  }
}

// 全选当前页
function selectAll() {
  displayCourses.value.forEach(course => {
    if (!selectedCourses.value.includes(course.id)) {
      selectedCourses.value.push(course.id)
      allSelectedCourses.value.add(course.id)
    }
  })
}

// 反选当前页
function invertSelection() {
  const currentIds = displayCourses.value.map(c => c.id)
  currentIds.forEach(id => {
    const index = selectedCourses.value.indexOf(id)
    if (index > -1) {
      selectedCourses.value.splice(index, 1)
      allSelectedCourses.value.delete(id)
    } else {
      selectedCourses.value.push(id)
      allSelectedCourses.value.add(id)
    }
  })
}

// 清空选择
function clearSelection() {
  selectedCourses.value = []
  allSelectedCourses.value.clear()
}

// 表格选择变化
function handleSelectionChange(selection: Course[]) {
  // 移除当前页的所有选择
  const currentPageIds = displayCourses.value.map(c => c.id)
  selectedCourses.value = selectedCourses.value.filter(id => !currentPageIds.includes(id))
  
  // 添加新选择的项
  selection.forEach(course => {
    if (!selectedCourses.value.includes(course.id)) {
      selectedCourses.value.push(course.id)
      allSelectedCourses.value.add(course.id)
    }
  })
}

// 监听分页变化，恢复选择状态
watch([currentPage, pageSize], () => {
  // 从全局选择中恢复当前页的选择
  selectedCourses.value = displayCourses.value
    .filter(c => allSelectedCourses.value.has(c.id))
    .map(c => c.id)
})

// 批量操作
async function handleBatchAction(command: string) {
  if (selectedCourses.value.length === 0) {
    ElMessage.warning('请先选择课程')
    return
  }

  switch (command) {
    case 'add-to-learning':
      await addMultipleToLearning()
      break
    case 'export':
      await exportSelectedCourses()
      break
    case 'delete':
      await deleteSelectedCourses()
      break
  }
}

// 批量加入学习列表
async function addMultipleToLearning() {
  try {
    const count = await learningStore.addMultipleToLearningList(selectedCourses.value)
    ElMessage.success(`已将 ${count} 个课程加入学习列表`)
    selectedCourses.value = []
  } catch (error) {
    console.error('批量加入学习列表失败:', error)
    ElMessage.error('加入学习列表失败')
  }
}

// 导出选中的课程
async function exportSelectedCourses() {
  try {
    const selectedCoursesData = courses.value.filter(c => 
      selectedCourses.value.includes(c.id)
    )
    
    const dataStr = JSON.stringify(selectedCoursesData, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `courses_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
    selectedCourses.value = []
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 导出单个课程
async function exportSingleCourse(course: Course) {
  try {
    const dataStr = JSON.stringify([course], null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${course.title}_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    
    ElMessage.success('导出成功')
  } catch (error) {
    console.error('导出失败:', error)
    ElMessage.error('导出失败')
  }
}

// 删除单个课程
async function deleteSingleCourse(course: Course) {
  try {
    await ElMessageBox.confirm(
      `确定要删除课程"${course.title}"吗？`, 
      '确认删除', 
      {
        type: 'warning',
      }
    )
    
    await courseStore.deleteCourse(course.id)
    ElMessage.success('删除成功')
    await loadCourses()
  } catch {
    // 取消删除
  }
}

// 删除选中的课程
async function deleteSelectedCourses() {
  try {
    await ElMessageBox.confirm(
      `确定要删除选中的 ${selectedCourses.value.length} 个课程吗？`, 
      '确认删除', 
      {
        type: 'warning',
      }
    )
    
    // 批量删除
    for (const id of selectedCourses.value) {
      await courseStore.deleteCourse(id)
    }
    
    ElMessage.success('删除成功')
    selectedCourses.value = []
    await loadCourses()
  } catch {
    // 取消删除
  }
}

// 单个课程操作
async function handleCourseAction(command: string, course: Course) {
  switch (command) {
    case 'add-to-learning':
      await addToLearning(course)
      break
    case 'edit':
      router.push(`/courses/${course.id}/edit`)
      break
    case 'export':
      await exportSingleCourse(course)
      break
    case 'delete':
      await deleteSingleCourse(course)
      break
  }
}

// 新建课程
function createNewCourse() {
  router.push('/courses/new')
}

// 跳转到课程详情
function goToCourse(course: Course) {
  router.push(`/courses/${course.id}`)
}

// 加入学习列表
async function addToLearning(course: Course) {
  try {
    await learningStore.addToLearningList(course.id)
    ElMessage.success(`已将"${course.title}"加入学习列表`)
  } catch (error) {
    console.error('加入学习列表失败:', error)
    ElMessage.error('加入学习列表失败')
  }
}

// 导入处理
function handleFileChange(file: any) {
  const reader = new FileReader()
  reader.onload = (e) => {
    importText.value = e.target?.result as string
  }
  reader.readAsText(file.raw)
}

async function handleImport() {
  if (!importText.value) {
    ElMessage.warning('请选择文件或粘贴内容')
    return
  }

  try {
    const data = JSON.parse(importText.value)
    
    // 验证数据格式
    if (!Array.isArray(data) && !data.title) {
      ElMessage.error('数据格式错误')
      return
    }
    
    // 处理单个课程或课程数组
    const coursesToImport = Array.isArray(data) ? data : [data]
    
    // 批量导入
    let successCount = 0
    for (const courseData of coursesToImport) {
      try {
        await courseStore.createCourse(courseData)
        successCount++
      } catch (error) {
        console.error('导入课程失败:', courseData.title, error)
      }
    }
    
    ElMessage.success(`成功导入 ${successCount} 个课程`)
    showImportDialog.value = false
    importText.value = ''
    await loadCourses()
  } catch (error) {
    console.error('解析导入数据失败:', error)
    ElMessage.error('数据格式错误')
  }
}

// 辅助函数
function getSourceType(source: any) {
  if (!source) return 'info'
  
  const sourceType = typeof source === 'string' ? source : source.type
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    ai_generated: 'info',
    user_created: 'success',
    imported: 'info',
    audio_import: 'warning',
    material_parsed: 'warning',
  }
  return types[sourceType] || 'info'
}

function getSourceText(source: any) {
  if (!source) return '未知'
  
  const sourceType = typeof source === 'string' ? source : source.type
  const texts: Record<string, string> = {
    ai_generated: 'AI生成',
    user_created: '用户创建',
    imported: '导入',
    audio_import: '音频导入',
    material_parsed: '教材解析',
  }
  return texts[sourceType] || sourceType
}

function getDifficultyText(difficulty: string) {
  const texts: Record<string, string> = {
    beginner: '初级',
    intermediate: '中级',
    advanced: '高级',
    custom: '自定义',
  }
  return texts[difficulty] || difficulty
}

function formatDate(date: string | Date | number) {
  if (!date) return '-'
  const d = new Date(date)
  return d.toLocaleDateString('zh-CN')
}

// 挂载时加载
onMounted(() => {
  loadCourses()
})
</script>

<style lang="scss" scoped>
.course-repository-page {
  padding: 0;
  max-width: 1280px;
}

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
}

.toolbar-row {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 12px;

  :deep(.el-input) {
    flex: 1;
  }
}

.toolbar-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;

  .selection-info {
    color: var(--text-color-secondary);
    font-size: 14px;
    margin-left: 8px;

    strong {
      color: var(--primary-color);
      font-size: 16px;
    }
  }
}

.filter-panel {
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color-light);
  border-radius: 16px;
  background-color: var(--bg-color-page);
}

.courses-card {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
}

.courses-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
  margin-bottom: 24px;
}

.course-card {
  position: relative;
  cursor: pointer;
  transition: all 0.2s;
  border-radius: 16px;
  border: 1px solid var(--border-color-light);
  
  &.selected {
    border-color: var(--primary-color);
  }
  
  &:hover {
    transform: translateY(-2px);
  }
  
  .card-header-row {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 12px;
  }
  
  .course-title {
    margin: 0 0 12px 0;
    font-size: 18px;
    font-weight: 600;
    cursor: pointer;
    
    &:hover {
      color: var(--el-color-primary);
    }
  }
  
  .course-description {
    color: var(--el-text-color-secondary);
    font-size: 14px;
    margin-bottom: 16px;
    display: -webkit-box;
    line-clamp: 2;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  
  .course-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 16px;
    font-size: 14px;
    color: var(--el-text-color-secondary);
    
    span {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
  
  .course-actions {
    display: flex;
    gap: 8px;
    justify-content: space-between;
  }
}

.pagination {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}
</style>
