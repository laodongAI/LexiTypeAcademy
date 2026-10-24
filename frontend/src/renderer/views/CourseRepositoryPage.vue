<!--
  课程仓库页面
  
  展示所有课程，支持筛选、搜索、批量操作
-->

<template>
  <div class="course-repository-page">
    <header class="page-header">
      <div class="page-heading">
        <div class="page-kicker"><el-icon><Collection /></el-icon><span>LEARNING LIBRARY</span></div>
        <h2 class="page-title">课程仓库</h2>
        <p class="page-subtitle">整理教材与课程，让每一份学习资料都更容易找到。</p>
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
        placeholder="搜索课程名称、教材或描述…"
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
          <el-radio-group v-model="viewMode" class="view-switcher" size="default" aria-label="课程展示方式">
            <el-radio-button value="grid"><el-icon><Grid /></el-icon><span>卡片</span></el-radio-button>
            <el-radio-button value="list"><el-icon><List /></el-icon><span>列表</span></el-radio-button>
            <el-radio-button value="hierarchy"><el-icon><FolderOpened /></el-icon><span>集合</span></el-radio-button>
            <el-radio-button value="textbook"><el-icon><Collection /></el-icon><span>教材</span></el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 空状态 -->
      <el-empty v-if="filteredCourses.length === 0" description="没有找到课程">
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

      <!-- 通用课程层级：课程集合 → 课程 → 课时 -->
      <div v-else-if="viewMode === 'hierarchy'" class="collection-hierarchy">
        <div class="hierarchy-toolbar">
          <span>独立课程集合 · 支持父子层级与课程归属</span>
          <el-button type="primary" size="small" @click="showCreateCollectionForm = !showCreateCollectionForm">
            <el-icon><Plus /></el-icon>
            新建集合
          </el-button>
        </div>
        <el-card v-if="showCreateCollectionForm" shadow="never" class="create-collection-form">
          <el-form inline @submit.prevent="createCollection">
            <el-form-item label="集合名称" required>
              <el-input v-model="newCollectionName" placeholder="例如：商务英语" maxlength="256" />
            </el-form-item>
            <el-form-item label="父级集合">
              <el-select v-model="newCollectionParentId" clearable placeholder="顶层集合" style="width: 220px">
                <el-option v-for="option in persistedCollections" :key="option.id" :label="getCollectionPath(option)" :value="option.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="createCollection">保存集合</el-button>
            </el-form-item>
          </el-form>
        </el-card>
        <el-alert
          v-if="collectionLoadError"
          type="error"
          show-icon
          :closable="false"
          title="课程集合加载失败"
          class="hierarchy-hint"
        >
          <template #default>
            <p>{{ collectionLoadError }}</p>
            <el-button size="small" type="danger" plain @click="loadCollections">重试加载</el-button>
          </template>
        </el-alert>
        <div class="hierarchy-note">
          <span class="hierarchy-note-icon"><el-icon><FolderOpened /></el-icon></span>
          <div class="hierarchy-note-copy">
            <strong>按课程集合整理</strong>
            <p>集合归属独立保存；教材课程请切换到「教材」视图查看系列、年级册与单元。尚未归类的课程也会保留在列表中。</p>
          </div>
        </div>
        <el-collapse v-if="collectionGroups.length" class="collection-collapse">
          <el-collapse-item v-for="group in collectionGroups" :key="group.key" :name="group.key">
            <template #title>
              <div class="collection-heading">
                <el-icon><FolderOpened /></el-icon>
                <strong>{{ group.title }}</strong>
                <el-tag size="small" :type="group.isUncategorized ? 'info' : 'success'">{{ group.courses.length }} 门课程</el-tag>
                <span v-if="group.collection" class="collection-heading-actions" @click.stop>
                  <el-button size="small" text @click.stop="editCollection(group.collection)">重命名</el-button>
                  <el-button size="small" text type="danger" @click.stop="deleteCollection(group.collection)">删除集合</el-button>
                </span>
              </div>
            </template>
            <div class="collection-course-list">
              <div v-for="course in group.courses" :key="course.id" class="collection-course-row">
                <div class="collection-course-main">
                  <strong class="collection-course-title" @click="goToCourse(course)">{{ course.title }}</strong>
                  <p>{{ course.description || '暂无描述' }}</p>
                  <small>{{ course.lessons?.length || 0 }} 个课时 · {{ getDifficultyText(course.difficulty) }}</small>
                </div>
                <div class="collection-course-actions">
                  <el-select
                    :model-value="collectionByCourseId.get(course.id) || ''"
                    size="small"
                    placeholder="移动到集合"
                    clearable
                    style="width: 150px"
                    @change="assignCourseToCollection($event || '', course)"
                  >
                    <el-option v-for="option in persistedCollections" :key="option.id" :label="getCollectionPath(option)" :value="option.id" />
                  </el-select>
                  <el-button size="small" @click="goToCourse(course)">课程详情</el-button>
                  <el-button v-if="!course.inLearningList" size="small" type="primary" plain @click="addToLearning(course)">加入学习</el-button>
                  <el-button v-else size="small" type="success" plain @click="goToCourse(course)">继续学习</el-button>
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 教材分级视图：教材系列 → 年级册 → 单元课程 -->
      <div v-else-if="viewMode === 'textbook'" class="textbook-view">
        <section
          v-for="seriesGroup in textbookGroups.series"
          :key="seriesGroup.key"
          class="series-block"
        >
          <header class="series-head">
            <div class="series-title">
              <h3>{{ seriesGroup.label }}</h3>
              <span>{{ seriesGroup.courseCount }} 个单元课程 · {{ seriesGroup.volumes.length }} 个年级册</span>
            </div>
            <el-tag size="small" type="success">教材</el-tag>
          </header>

          <div class="volume-grid">
            <el-card
              v-for="volume in seriesGroup.volumes"
              :key="volume.key"
              shadow="hover"
              class="volume-card"
            >
              <template #header>
                <div class="volume-head">
                  <div>
                    <strong>{{ volume.label }}</strong>
                    <p v-if="volume.textbookName && volume.textbookName !== volume.label" class="volume-sub">
                      {{ volume.textbookName }}
                    </p>
                  </div>
                  <span class="volume-count">{{ volume.units.length }} 单元</span>
                </div>
              </template>

              <div class="unit-list">
                <button
                  v-for="unit in volume.units"
                  :key="unit.key"
                  type="button"
                  class="unit-row"
                  @click="goToCourse(unit.course)"
                >
                  <span class="unit-no">
                    {{ unit.unitNumber ? `Unit ${unit.unitNumber}` : '单元' }}
                  </span>
                  <span class="unit-info">
                    <strong>{{ unit.title }}</strong>
                    <small>
                      {{ unit.lessonCount }} 课时
                      <template v-if="unit.course.inLearningList"> · 学习中</template>
                    </small>
                  </span>
                  <el-icon class="unit-arrow"><ArrowRight /></el-icon>
                </button>
              </div>
            </el-card>
          </div>
        </section>

        <!-- 非教材课程：保持可点击列表，避免分级视图把它们藏起来 -->
        <section v-if="textbookGroups.others.length" class="series-block">
          <header class="series-head">
            <div class="series-title">
              <h3>其他课程</h3>
              <span>{{ textbookGroups.others.length }} 个课程</span>
            </div>
          </header>

          <div class="other-list">
            <button
              v-for="course in textbookGroups.others"
              :key="course.id"
              type="button"
              class="unit-row"
              @click="goToCourse(course)"
            >
              <span class="unit-no">课程</span>
              <span class="unit-info">
                <strong>{{ course.title }}</strong>
                <small>
                  {{ course.lessons?.length || 0 }} 课时
                  <template v-if="course.inLearningList"> · 学习中</template>
                </small>
              </span>
              <el-icon class="unit-arrow"><ArrowRight /></el-icon>
            </button>
          </div>
        </section>
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
                @click="addToLearning(row as Course)"
              >
                加入学习
              </el-button>
              <el-button size="small" @click="goToCourse(row as Course)">
                查看
              </el-button>
              <el-dropdown @command="(cmd) => handleCourseAction(cmd, row as Course)">
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

      <!-- 分页：教材分级视图一次性展示全部分组，不分页 -->
      <el-pagination
        v-if="viewMode !== 'textbook' && filteredTotal > pageSize"
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
  Collection,
  FolderOpened,
  ArrowRight,
} from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useCourseStore } from '../stores/courseStore'
import { useLearningStore } from '../stores/learningStore'
import type { Course } from '../../shared/types/course'
import { buildTextbookGroups } from '../../shared/utils/courseTaxonomy'
import { courseCollectionService, type CourseCollection } from '../../shared/services/courseCollectionService'

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

// 视图模式：卡片 / 列表 / 教材分级
const viewMode = ref<'grid' | 'list' | 'hierarchy' | 'textbook'>('hierarchy')

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

// 过滤后的课程（不含分页）：卡片、列表、教材视图共用同一套筛选规则
const filteredCourses = computed<CourseListItem[]>(() => {
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

  return filtered
})

// 显示的课程 - 在过滤结果上应用分页
const displayCourses = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredCourses.value.slice(start, end)
})

// 计算筛选后的总数
const filteredTotal = computed(() => filteredCourses.value.length)

// 教材三级分组：教材系列 → 年级册 → 单元课程
const textbookGroups = computed(() => buildTextbookGroups(filteredCourses.value))
const persistedCollections = ref<CourseCollection[]>([])
const collectionLoadError = ref('')
const showCreateCollectionForm = ref(false)
const newCollectionName = ref('')
const newCollectionParentId = ref('')
const collectionByCourseId = computed(() => {
  const map = new Map<string, string>()
  for (const collection of persistedCollections.value) {
    for (const courseId of collection.courseIds) map.set(courseId, collection.id)
  }
  return map
})
const collectionGroups = computed(() => {
  const assignedIds = new Set<string>()
  const groups: Array<{ key: string; title: string; courses: Course[]; isUncategorized: boolean; collection?: CourseCollection }> = persistedCollections.value.map((collection) => {
    const members = filteredCourses.value.filter((course) => collection.courseIds.includes(course.id))
    members.forEach((course) => assignedIds.add(course.id))
    return { key: collection.id, title: getCollectionPath(collection), courses: members, isUncategorized: false, collection }
  })
  const textbooks = filteredCourses.value.filter((course) => {
    const tags = course.tags ?? []
    return !assignedIds.has(course.id) && (tags.includes('Textbook') || tags.some((tag) => String(tag || '').startsWith('Textbook:')))
  })
  if (textbooks.length) {
    textbooks.forEach((course) => assignedIds.add(course.id))
    groups.push({ key: '__textbook__', title: '教材课程（切换教材视图查看层级）', courses: textbooks, isUncategorized: false })
  }
  const unassigned = filteredCourses.value.filter((course) => !assignedIds.has(course.id))
  if (unassigned.length) groups.push({ key: '__uncategorized__', title: '未归类课程', courses: unassigned, isUncategorized: true })
  return groups.sort((a, b) => a.isUncategorized === b.isUncategorized ? a.title.localeCompare(b.title, 'zh-Hans-CN') : (a.isUncategorized ? 1 : -1))
})

function getCollectionPath(collection: CourseCollection): string {
  const byId = new Map(persistedCollections.value.map((item) => [item.id, item]))
  const parts = [collection.name]
  let parentId = collection.parentId
  const visited = new Set<string>([collection.id])
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId)
    const parent = byId.get(parentId)
    if (!parent) break
    parts.unshift(parent.name)
    parentId = parent.parentId
  }
  return parts.join(' / ')
}

async function loadCollections() {
  collectionLoadError.value = ''
  try {
    // 迁移失败时不能继续把空结果呈现为正常状态；重试会再次执行幂等迁移。
    await courseCollectionService.migrateLegacyTags()
    persistedCollections.value = await courseCollectionService.list()
  } catch (error) {
    collectionLoadError.value = error instanceof Error ? error.message : '无法读取课程集合，请检查本地后端服务后重试。'
    ElMessage.error('课程集合加载失败：' + collectionLoadError.value)
  }
}

async function createCollection() {
  const name = newCollectionName.value.trim()
  if (!name) {
    ElMessage.warning('请输入课程集合名称')
    return
  }
  try {
    await courseCollectionService.create({
      name,
      parentId: newCollectionParentId.value || null,
    })
    newCollectionName.value = ''
    newCollectionParentId.value = ''
    showCreateCollectionForm.value = false
    await loadCollections()
    ElMessage.success('课程集合已创建')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建集合失败')
  }
}

async function assignCourseToCollection(collectionId: string, course: Course) {
  try {
    if (collectionId) await courseCollectionService.assignCourse(collectionId, course.id)
    else await courseCollectionService.unassignCourse(course.id)
    await loadCollections()
    ElMessage.success('课程归属已更新')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '更新课程归属失败')
    await loadCollections()
  }
}

async function editCollection(collection: CourseCollection) {
  try {
    const { value } = await ElMessageBox.prompt('请输入新的集合名称', '重命名课程集合', {
      inputValue: collection.name,
      inputValidator: (value: string) => value.trim().length > 0 || '集合名称不能为空',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    await courseCollectionService.update(collection.id, { name: value.trim() })
    await loadCollections()
    ElMessage.success('集合名称已更新')
  } catch (error) {
    // 用户取消弹窗不属于错误。
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '重命名集合失败')
    }
  }
}

async function deleteCollection(collection: CourseCollection) {
  try {
    await ElMessageBox.confirm(
      `确定删除集合“${getCollectionPath(collection)}”吗？仅允许删除没有子集合、没有课程归属的集合。`,
      '删除课程集合',
      { type: 'warning', confirmButtonText: '删除', cancelButtonText: '取消' },
    )
    await courseCollectionService.remove(collection.id)
    await loadCollections()
    ElMessage.success('集合已删除')
  } catch (error) {
    // 用户取消弹窗不属于错误。
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '删除集合失败')
    }
  }
}

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
onMounted(async () => {
  await Promise.all([loadCourses(), loadCollections()])
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

/* 教材分级视图 */
.hierarchy-hint { margin-bottom: 16px; }
.collection-collapse { border-top: 0; }
.collection-heading { display: flex; align-items: center; gap: 10px; width: 100%; padding-right: 12px; }
.collection-heading strong { font-size: 15px; }
.collection-heading-actions { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; }
.collection-course-list { display: flex; flex-direction: column; gap: 10px; }
.collection-course-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 16px; border: 1px solid var(--border-color-light); border-radius: 8px; }
.collection-course-main { min-width: 0; }
.collection-course-title { cursor: pointer; color: var(--text-color); }
.collection-course-title:hover { color: var(--primary-color); }
.collection-course-main p { margin: 6px 0; color: var(--text-color-secondary); overflow-wrap: anywhere; }
.collection-course-main small { color: var(--text-color-secondary); }
.collection-course-actions { display: flex; flex-wrap: wrap; gap: 8px; }
@media (max-width: 720px) {
  .collection-course-row { align-items: flex-start; flex-direction: column; }
  .collection-course-actions { width: 100%; }
}
.textbook-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 24px;
}

/* 教材系列分组 */
.series-block {
  padding: 18px;
  border-radius: 18px;
  border: 1px solid var(--border-color-light);
  background-color: var(--bg-color-page);
}

.series-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.series-title h3 {
  margin: 0 0 4px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-color);
}

.series-title span {
  font-size: 13px;
  color: var(--text-color-secondary);
}

/* 年级册卡片网格 */
.volume-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}

.volume-card {
  border-radius: 14px;
}

.volume-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.volume-head strong {
  font-size: 15px;
  color: var(--text-color);
}

.volume-sub {
  margin: 3px 0 0;
  font-size: 12px;
  color: var(--text-color-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.volume-count {
  flex: none;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  color: var(--primary-color);
  background-color: var(--el-color-primary-light-9);
}

/* 单元列表 */
.unit-list,
.other-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.unit-row {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid transparent;
  border-radius: 12px;
  background-color: transparent;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.16s ease, border-color 0.16s ease;
}

.unit-row:hover {
  border-color: var(--el-color-primary-light-7);
  background-color: var(--el-color-primary-light-9);
}

.unit-no {
  flex: none;
  min-width: 54px;
  padding: 2px 6px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 600;
  text-align: center;
  color: #b45309;
  background-color: #fef3c7;
}

.unit-info {
  display: flex;
  flex: 1;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.unit-info strong {
  font-size: 13.5px;
  font-weight: 600;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unit-info small {
  font-size: 11.5px;
  color: var(--text-color-secondary);
}

.unit-arrow {
  flex: none;
  color: var(--text-color-secondary);
}

/* 课程仓库页面视觉整理：沿用项目现有主题变量，不影响全局主题 */
.course-repository-page {
  width: 100%;
  max-width: 1360px;
  padding-bottom: 24px;
}

.page-header {
  align-items: center;
  padding: 22px 24px;
  margin-bottom: 18px;
  border: 1px solid var(--border-color-light);
  border-radius: 16px;
  background: var(--el-bg-color, #fff);
}

.page-heading { min-width: 0; }

.page-kicker {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 8px;
  color: var(--el-color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .12em;
}

.page-kicker :deep(.el-icon) { font-size: 14px; }

.page-title {
  margin-bottom: 6px;
  font-size: 28px;
  font-weight: 650;
  line-height: 1.25;
  letter-spacing: -.025em;
}

.page-subtitle {
  max-width: 620px;
  font-size: 14px;
  line-height: 1.65;
  font-weight: 400;
}

.header-actions { flex: none; gap: 10px; }

.header-actions :deep(.el-button) {
  min-height: 38px;
  padding: 0 16px;
  border-radius: 9px;
  font-weight: 600;
}

.toolbar-row {
  align-items: stretch;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px;
  border: 1px solid var(--border-color-light);
  border-radius: 14px;
  background: var(--el-bg-color, #fff);
}

.toolbar-row :deep(.el-input__wrapper) {
  min-height: 38px;
  border-radius: 9px;
  box-shadow: 0 0 0 1px var(--border-color-light) inset;
}

.toolbar-actions { gap: 6px; }

.toolbar-actions :deep(.el-button) { border-radius: 8px; }

.filter-panel {
  padding: 16px 18px 4px;
  margin-bottom: 14px;
  border-radius: 12px;
  background: var(--bg-color-page);
}

.courses-card {
  overflow: hidden;
  border-radius: 16px;
  border-color: var(--border-color-light);
}

.courses-card :deep(.el-card__header) {
  padding: 14px 18px;
  border-bottom-color: var(--border-color-light);
  background: var(--el-bg-color, #fff);
}

.courses-card :deep(.el-card__body) { padding: 18px; }

.courses-card .card-header {
  min-height: 34px;
  gap: 16px;
  flex-wrap: wrap;
}

.courses-card .card-header > span {
  color: var(--text-color-secondary);
  font-size: 13px;
  font-weight: 600;
}

.view-switcher :deep(.el-radio-button__inner) {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 34px;
  padding: 0 12px;
  font-weight: 500;
  box-shadow: none;
}

.view-switcher :deep(.el-radio-button:first-child .el-radio-button__inner) {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.view-switcher :deep(.el-radio-button:last-child .el-radio-button__inner) {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.course-card {
  overflow: hidden;
  border-radius: 14px;
  background: var(--el-bg-color, #fff);
}

.course-card :deep(.el-card__body) { padding: 18px; }

.course-card .course-title {
  line-height: 1.45;
  overflow-wrap: anywhere;
}

.course-card .course-description {
  min-height: 40px;
  line-height: 1.55;
}

.course-card .course-actions {
  align-items: center;
  padding-top: 12px;
  border-top: 1px solid var(--border-color-light);
}

.course-card .course-actions :deep(.el-button) { border-radius: 8px; }

.hierarchy-note {
  display: flex;
  align-items: flex-start;
  gap: 11px;
  padding: 13px 15px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color-light);
  border-radius: 12px;
  background: var(--bg-color-page);
}

.hierarchy-note-icon {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 9px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}

.hierarchy-note-copy { min-width: 0; }

.hierarchy-note-copy strong {
  display: block;
  margin: 1px 0 4px;
  color: var(--text-color);
  font-size: 13px;
  font-weight: 650;
}

.hierarchy-note-copy p {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 12px;
  line-height: 1.65;
}

.collection-collapse :deep(.el-collapse-item__header) {
  min-height: 54px;
  padding: 0 14px;
  border-radius: 10px;
}

.collection-collapse :deep(.el-collapse-item__wrap) { border-bottom: 0; }
.collection-collapse :deep(.el-collapse-item__content) { padding: 8px 12px 16px; }

.collection-course-row {
  padding: 15px 16px;
  border-radius: 12px;
  background: var(--el-bg-color, #fff);
  transition: border-color .18s ease, background-color .18s ease;
}

.collection-course-row:hover { border-color: var(--el-border-color); }

.series-block {
  padding: 20px;
  border-radius: 15px;
  background: var(--el-bg-color, #fff);
}

.series-head {
  align-items: center;
  padding-bottom: 14px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-color-light);
}

.series-title h3 { font-size: 17px; line-height: 1.4; }
.series-title span { display: inline-block; margin-top: 2px; }

.volume-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 330px), 1fr)); }
.volume-card { border-radius: 12px; }
.volume-card :deep(.el-card__header) { padding: 14px 15px; }
.volume-card :deep(.el-card__body) { padding: 10px; }
.volume-head strong { line-height: 1.45; }

.unit-row {
  min-height: 54px;
  padding: 10px 11px;
  border-color: transparent;
  border-radius: 9px;
}

.unit-row:focus-visible {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

.unit-no {
  min-width: 62px;
  padding: 5px 7px;
  border-radius: 7px;
}

.unit-info strong { font-size: 13px; line-height: 1.45; }
.unit-info small { line-height: 1.5; }

.pagination { padding-top: 16px; }

@media (max-width: 860px) {
  .page-header { align-items: flex-start; flex-direction: column; padding: 20px; }
  .header-actions { width: 100%; }
  .header-actions :deep(.el-button) { flex: 1; }
  .toolbar-row { flex-direction: column; }
  .toolbar-actions { justify-content: flex-start; }
}

@media (max-width: 560px) {
  .page-title { font-size: 24px; }
  .page-header { padding: 18px 16px; }
  .courses-card :deep(.el-card__body) { padding: 12px; }
  .courses-card :deep(.el-card__header) { padding: 12px; }
  .courses-card .card-header { align-items: flex-start; flex-direction: column; }
  .view-switcher { width: 100%; display: flex; }
  .view-switcher :deep(.el-radio-button) { flex: 1; }
  .view-switcher :deep(.el-radio-button__inner) { width: 100%; padding: 0 7px; }
  .series-block { padding: 14px; border-radius: 12px; }
  .series-head { align-items: flex-start; }
  .unit-row { gap: 8px; padding: 9px 7px; }
  .unit-no { min-width: 54px; }
}

</style>
