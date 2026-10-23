<!-- 复习队列面板 -->
<template>
  <div class="review-queue-panel">
    <div v-if="queueItems.length === 0" class="empty-state">
      <el-empty description="暂无待复习内容" />
    </div>
    <div v-else>
      <el-statistic
        title="待复习项目"
        :value="queueStats.totalItems"
        suffix="个"
      />
      <el-statistic
        title="预计耗时"
        :value="queueStats.estimatedTime"
        suffix="分钟"
      />
      <el-button type="primary" @click="startReviewQueue">
        开始复习队列
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface QueueStats {
  totalItems: number
  estimatedTime: number
  nextReviewCount: number
}

defineProps<{
  queueItems: any[]
  queueStats: QueueStats
}>()

const emit = defineEmits<{
  'start-review': []
}>()

function startReviewQueue() {
  emit('start-review')
}
</script>

<style lang="scss" scoped>
.review-queue-panel {
  padding: 40px 20px;
  text-align: center;
}

.empty-state {
  padding: 40px 20px;
}
</style>
