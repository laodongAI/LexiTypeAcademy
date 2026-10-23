<!--
  AI 工具页面（优化版）
  
  改进内容：
  - 设计风格一致性
  - 简化用户流程
  - 增强教学功能
  - 响应式布局
-->

<template>
  <div class="ai-tools-page">
    <header class="page-header">
      <h2 class="page-title">AI 生成课程</h2>
      <p class="page-subtitle">选择一种生成方式开始创建课程内容。</p>
    </header>

    <section class="section">
      <div class="section-header">
        <h3 class="section-title">生成方式</h3>
      </div>

      <el-row :gutter="16" class="method-cards">
        <el-col :xs="24" :sm="12" :md="8" v-for="card in quickStartCards" :key="card.name">
          <button
            type="button"
            class="method-card"
            :class="{ active: activeTab === card.name }"
            @click="setActiveTab(card.name)"
          >
            <div class="method-title">{{ card.title }}</div>
            <div class="method-desc">{{ card.description }}</div>
          </button>
        </el-col>
      </el-row>
    </section>

    <section class="section section-last">
      <div class="flow-container">
        <component :is="activeFlowComponent" :key="activeTab" />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from 'vue'
import { useRoute } from 'vue-router'
import * as CourseGeneratorPanelModule from '../components/ai/CourseGeneratorPanel.vue'
import * as TextbookImportPanelModule from '../components/ai/TextbookImportPanel.vue'
import * as AudioImportPanelModule from '../components/ai/AudioImportPanel.vue'

const CourseGeneratorPanel = (CourseGeneratorPanelModule as unknown as { default: Component }).default
const TextbookImportPanel = (TextbookImportPanelModule as unknown as { default: Component }).default
const AudioImportPanel = (AudioImportPanelModule as unknown as { default: Component }).default

const route = useRoute()

// 状态
const activeTab = ref<'audio' | 'chinese' | 'publisher'>('audio')

// 快速开始卡片
type AITabName = 'audio' | 'chinese' | 'publisher'

const quickStartCards = [
  {
    name: 'audio',
    title: '语音导入生成课程',
    description: '识别音频字幕，提取词汇与句子，自动生成课程',
  },
  {
    name: 'chinese',
    title: '中文生成英文课程',
    description: '输入中文，生成英文文本并构建词汇课程',
  },
  {
    name: 'publisher',
    title: '出版社教材系列',
    description: '选择出版社与教材系列，让 AI 生成课程结构与内容',
  },
] as const satisfies ReadonlyArray<{
  name: AITabName
  title: string
  description: string
}>

function setActiveTab(tabName: string) {
  if (tabName === 'audio' || tabName === 'chinese' || tabName === 'publisher') {
    activeTab.value = tabName
  }
}

const activeFlowComponent = computed(() => {
  if (activeTab.value === 'audio') return AudioImportPanel
  if (activeTab.value === 'chinese') return CourseGeneratorPanel
  return TextbookImportPanel
})

onMounted(() => {
  const tab = route.query.tab
  if (typeof tab === 'string') {
    setActiveTab(tab)
  }
})
</script>

<style lang="scss" scoped>
.ai-tools-page {
  max-width: 1280px;
  margin: 0 auto;
}

.page-header {
  margin-bottom: 28px;
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

.section {
  padding: 0 0 28px;
  border-bottom: 1px solid var(--border-color-light);
  margin-bottom: 28px;
}

.section-last {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.section-header {
  padding-bottom: 12px;
}

.section-title {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-color-secondary);
}

.method-cards {
  margin: 0;
}

.method-card {
  width: 100%;
  text-align: left;
  border-radius: 16px;
  border: 1px solid var(--border-color-light);
  background: var(--card-bg);
  padding: 16px 16px;
  cursor: pointer;
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.method-card:hover {
  border-color: var(--border-color);
}

.method-card.active {
  border-color: var(--primary-color);
}

.method-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-color);
  margin-bottom: 6px;
}

.method-desc {
  font-size: 13px;
  color: var(--text-color-secondary);
  line-height: 1.5;
}

.flow-container {
  max-width: 920px;
  margin: 0 auto;
}

// 响应式
@media (max-width: 768px) {
  .page-header {
    margin-bottom: 24px;
  }
}
</style>
