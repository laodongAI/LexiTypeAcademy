<!-- 课程练习面板：展示真实课程并允许用户进入对应课时练习 -->
<template>
  <div class="course-practice-panel">
    <el-empty v-if="courses.length === 0" description="暂时没有课程，请先到课程仓库创建或导入课程">
      <el-button type="primary" @click="openRepository">打开课程仓库</el-button>
    </el-empty>
    <el-row v-else :gutter="16">
      <el-col v-for="course in courses" :key="course.id" :xs="24" :sm="12" :md="8">
        <el-card class="course-card" shadow="hover">
          <h3>{{ course.title }}</h3>
          <p>{{ course.description || '暂无课程介绍' }}</p>
          <div class="course-meta">{{ course.lessons?.length ?? course.lessonCount ?? 0 }} 个课时</div>
          <el-button type="primary" @click="$emit('select', course.id)">开始课程练习</el-button>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'

interface PracticeCourse {
  id: string
  title: string
  description?: string
  lessonCount?: number
  lessons?: unknown[]
}

defineProps<{
  courses: PracticeCourse[]
}>()

defineEmits<{
  select: [courseId: string]
}>()

const router = useRouter()

function openRepository() {
  void router.push({ name: 'CourseRepository' })
}
</script>

<style lang="scss" scoped>
.course-practice-panel {
  padding: 20px 0;
}

.course-card {
  height: 100%;
  margin-bottom: 16px;

  h3 {
    margin: 0 0 10px;
    font-size: 16px;
  }

  p {
    min-height: 40px;
    color: var(--el-text-color-secondary);
  }

  .course-meta {
    margin: 12px 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
  }
}
</style>
