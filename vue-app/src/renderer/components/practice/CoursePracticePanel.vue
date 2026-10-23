<!-- 课程练习面板 -->
<template>
  <div class="course-practice-panel">
    <el-empty description="课程练习功能开发中..." />
  </div>
</template>

<script setup lang="ts">
defineProps<{
  courses: any[]
}>()

defineEmits<{
  select: [courseId: string]
}>()
</script>

<style lang="scss" scoped>
.course-practice-panel {
  padding: 40px 20px;
}
</style>
