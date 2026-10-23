<!--
  AI 工具页面
  
  整合 AI 课程生成、AI 助手、翻译工具和词汇解析
-->

<template>
  <div class="ai-tools-page">
    <el-page-header title="AI 工具" class="page-header">
      <template #content>
        <span class="text-gray-600">让 AI 帮助您学习</span>
      </template>
    </el-page-header>

    <!-- 标签页 -->
    <el-tabs v-model="activeTab" class="ai-tabs" @tab-change="handleTabChange">
      <el-tab-pane label="课程生成" name="generate">
        <AILabPage />
      </el-tab-pane>
      <el-tab-pane label="AI 助手" name="chat">
        <AIPage />
      </el-tab-pane>
      <el-tab-pane label="智能翻译" name="translate">
        <TranslateToolPage />
      </el-tab-pane>
      <el-tab-pane label="词汇解析" name="vocabulary">
        <VocabularyAnalyzerPage />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as AILabPageModule from './AILabPage.vue'
import * as AIPageModule from './AIPage.vue'
import * as TranslateToolPageModule from './TranslateToolPage.vue'
import * as VocabularyAnalyzerPageModule from './VocabularyAnalyzerPage.vue'

const AILabPage = (AILabPageModule as unknown as { default: Component }).default
const AIPage = (AIPageModule as unknown as { default: Component }).default
const TranslateToolPage = (TranslateToolPageModule as unknown as { default: Component }).default
const VocabularyAnalyzerPage = (VocabularyAnalyzerPageModule as unknown as { default: Component }).default

const route = useRoute()
const router = useRouter()
const activeTab = ref('generate')

// 标签页切换
function handleTabChange(tabName: string | number) {
  // 更新 URL 参数
  router.push({
    path: route.path,
    query: { tab: tabName as string },
  })
}

onMounted(() => {
  // 从URL参数读取标签页
  const tab = route.query.tab as string
  if (tab && ['generate', 'chat', 'translate', 'vocabulary'].includes(tab)) {
    activeTab.value = tab
  }
})
</script>

<style lang="scss" scoped>
.ai-tools-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 24px;
}

.ai-tabs {
  :deep(.el-tabs__content) {
    padding: 0;
  }
  
  :deep(.el-tabs__header) {
    margin-bottom: 20px;
  }
}
</style>
