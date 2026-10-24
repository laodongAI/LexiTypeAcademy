<!--
  设置页面（分页壳）

  职责：
  - 左侧分类导航 + 右侧内容区，共 6 个分页
  - 通过 /settings?tab=xxx 支持深链与刷新保持
  - 大模型分页存在未保存修改时，切换分页或离开页面需二次确认
  说明：
  - 通用/语音/学习/练习分页即改即存
  - 大模型分页显式“保存并应用”，密钥只写不读
-->

<template>
  <div class="settings-page">
    <header class="page-header">
      <h2 class="page-title">设置</h2>
      <p class="page-subtitle">管理外观、语音、大模型与学习偏好。</p>
    </header>

    <div class="settings-body">
      <!-- 左侧分类导航：使用原生按钮保证 active 状态完全可控 -->
      <nav class="settings-nav">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="nav-item"
          :class="{ active: activeTab === tab.key }"
          type="button"
          @click="handleTabChange(tab.key)"
        >
          <span class="nav-label">{{ tab.label }}</span>
          <span class="nav-desc">{{ tab.desc }}</span>
        </button>
      </nav>

      <!-- 右侧内容区：每个分页独立组件 -->
      <main class="settings-content">
        <GeneralSettingsTab v-if="activeTab === 'general'" />
        <SpeechSettingsTab v-else-if="activeTab === 'speech'" />
        <ModelSettingsTab v-else-if="activeTab === 'models'" @dirty="handleModelDirty" />
        <LearningSettingsTab v-else-if="activeTab === 'learning'" />
        <PracticeSettingsTab v-else-if="activeTab === 'practice'" />
        <AboutSettingsTab v-else-if="activeTab === 'about'" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import GeneralSettingsTab from '../components/settings/GeneralSettingsTab.vue'
import SpeechSettingsTab from '../components/settings/SpeechSettingsTab.vue'
import ModelSettingsTab from '../components/settings/ModelSettingsTab.vue'
import LearningSettingsTab from '../components/settings/LearningSettingsTab.vue'
import PracticeSettingsTab from '../components/settings/PracticeSettingsTab.vue'
import AboutSettingsTab from '../components/settings/AboutSettingsTab.vue'

/** 分页标识联合类型 */
type TabKey = 'general' | 'speech' | 'models' | 'learning' | 'practice' | 'about'

/** 分页导航条目 */
interface TabItem {
  key: TabKey
  label: string
  desc: string
}

// 分页定义：顺序即展示顺序
const tabs: TabItem[] = [
  { key: 'general', label: '通用', desc: '主题与语言' },
  { key: 'speech', label: '语音模型', desc: '引擎、音色与克隆' },
  { key: 'models', label: '大模型', desc: '服务商与密钥' },
  { key: 'learning', label: '学习', desc: '目标与自动播放' },
  { key: 'practice', label: '练习', desc: '打字与音效' },
  { key: 'about', label: '数据与关于', desc: '导入导出与版本' },
]

// 旧链接兼容：历史入口使用 ai / tts / migration
const TAB_ALIASES: Record<string, TabKey> = {
  ai: 'models',
  tts: 'speech',
  speech: 'speech',
  migration: 'about',
  data: 'about',
}

// 路由与当前激活分页
const route = useRoute()
const router = useRouter()
const activeTab = ref<TabKey>('general')

// 大模型分页是否有未保存修改
const modelDirty = ref(false)

/**
 * 解析 tab 查询参数
 * @param raw 原始参数值
 * @returns 合法的分页标识，非法值回退 general
 */
function resolveTab(raw: unknown): TabKey {
  const value = Array.isArray(raw) ? raw[0] : raw
  const text = String(value || '').trim()
  const key = (TAB_ALIASES[text] || text) as TabKey
  return tabs.some((item) => item.key === key) ? key : 'general'
}

/**
 * 同步分页到 URL
 * @param key 分页标识
 */
function syncTabToUrl(key: TabKey): void {
  if (resolveTab(route.query.tab) === key) return
  void router.replace({ path: '/settings', query: { ...route.query, tab: key } })
}

/**
 * 切换分页
 * @param key 目标分页
 */
async function handleTabChange(key: TabKey): Promise<void> {
  if (key === activeTab.value) return

  // 离开大模型分页且有未保存修改时，先确认
  if (modelDirty.value && activeTab.value === 'models') {
    try {
      await ElMessageBox.confirm(
        '大模型配置尚未保存，离开将丢失当前修改。是否继续？',
        '未保存的修改',
        { confirmButtonText: '仍然离开', cancelButtonText: '留在本页', type: 'warning' },
      )
    } catch {
      return
    }
    modelDirty.value = false
  }

  activeTab.value = key
  syncTabToUrl(key)
}

/**
 * 接收大模型分页的 dirty 状态
 * @param value 是否脏
 */
function handleModelDirty(value: boolean): void {
  modelDirty.value = value
}

// 监听 URL 变化（外部跳转、浏览器前进后退）
watch(
  () => route.query.tab,
  (value) => {
    activeTab.value = resolveTab(value)
  },
)

// 页面离开拦截：有未保存修改时二次确认
onBeforeRouteLeave(async () => {
  if (!modelDirty.value) return true
  try {
    await ElMessageBox.confirm(
      '大模型配置尚未保存，离开将丢失当前修改。是否继续？',
      '未保存的修改',
      { confirmButtonText: '仍然离开', cancelButtonText: '留在本页', type: 'warning' },
    )
    return true
  } catch {
    return false
  }
})

// 首次进入按 URL 初始化
onMounted(() => {
  activeTab.value = resolveTab(route.query.tab)
  // 保证 URL 始终带合法 tab，便于刷新与分享
  syncTabToUrl(activeTab.value)
})
</script>

<style lang="scss" scoped>
.settings-page {
  max-width: 1120px;
  padding: 32px 40px 48px;
}

.page-header {
  margin-bottom: 24px;
}

.page-title {
  margin: 0 0 8px;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-color);
}

.page-subtitle {
  margin: 0;
  color: var(--text-color-secondary);
  font-size: 14px;
}

.settings-body {
  display: flex;
  gap: 32px;
  align-items: flex-start;
}

/* 左侧导航：窄列 + 选中态左侧色条 */
.settings-nav {
  flex: 0 0 168px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: sticky;
  top: 24px;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 10px 12px;
  text-align: left;
  background: transparent;
  border: none;
  border-left: 2px solid transparent;
  cursor: pointer;
  color: var(--text-color-secondary);
  transition: color 0.2s, border-color 0.2s, background-color 0.2s;

  &:hover {
    color: var(--text-color);
    background: rgba(64, 158, 255, 0.04);
  }

  &.active {
    color: var(--primary-color);
    border-left-color: var(--primary-color);
    background: rgba(64, 158, 255, 0.06);
  }
}

.nav-label {
  font-size: 14px;
  font-weight: 600;
}

.nav-desc {
  font-size: 11px;
  color: var(--text-color-placeholder);
}

.settings-content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 860px) {
  .settings-page {
    padding: 20px 16px 32px;
  }

  .settings-body {
    flex-direction: column;
    gap: 16px;
  }

  /* 窄屏时导航转为横向滚动，避免挤压内容 */
  .settings-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 8px;
  }

  .nav-item {
    border-left: none;
    border-bottom: 2px solid transparent;

    &.active {
      border-left-color: transparent;
      border-bottom-color: var(--primary-color);
    }
  }

  .nav-desc {
    display: none;
  }
}
</style>
