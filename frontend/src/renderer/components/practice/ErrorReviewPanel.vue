<!-- 错题复习面板 -->
<template>
  <div class="error-review-panel">
    <el-table :data="errorItems" stripe>
      <el-table-column prop="title" label="内容" min-width="200" />
      <el-table-column prop="errorType" label="错误类型" width="100" />
      <el-table-column prop="frequency" label="错误次数" width="80" />
      <el-table-column label="操作" width="120" align="center">
        <template #default="{ row }">
          <el-button type="primary" size="small" @click="startReview(row.id)">
            复习
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  errorItems: any[]
}>()

const emit = defineEmits<{
  'start-review': [itemId: string]
}>()

function startReview(itemId: string) {
  emit('start-review', itemId)
}
</script>

<style lang="scss" scoped>
.error-review-panel {
  padding: 20px 0;
}
</style>
