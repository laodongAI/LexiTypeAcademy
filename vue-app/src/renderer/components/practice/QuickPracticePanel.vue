<!-- 快速练习面板 -->
<template>
  <div class="quick-practice-panel">
    <el-row :gutter="20">
      <el-col v-for="mode in practiceModes" :key="mode" :xs="24" :sm="12" :md="6">
        <el-card class="mode-card" @click="selectMode(mode)">
          <div class="mode-icon">{{ getModeIcon(mode) }}</div>
          <div class="mode-name">{{ getModeLabel(mode) }}</div>
          <div class="mode-desc">{{ getModeDesc(mode) }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
type PracticeMode = 'dictation' | 'follow' | 'translation' | 'imitation'

defineProps<{
  practiceModes: PracticeMode[]
}>()

const emit = defineEmits<{
  select: [type: string]
}>()

function getModeIcon(mode: string): string {
  const icons: Record<string, string> = {
    dictation: '🎤',
    follow: '🗣️',
    translation: '📖',
    imitation: '🎵',
  }
  return icons[mode] || '📝'
}

function getModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    dictation: '听写模式',
    follow: '跟读模式',
    translation: '翻译模式',
    imitation: '模仿模式',
  }
  return labels[mode] || mode
}

function getModeDesc(mode: string): string {
  const desc: Record<string, string> = {
    dictation: '听音频，输入英文',
    follow: '跟随音频朗读',
    translation: '看中文，写英文',
    imitation: '模仿音频发音',
  }
  return desc[mode] || ''
}

function selectMode(mode: string) {
  emit('select', mode)
}
</script>

<style lang="scss" scoped>
.quick-practice-panel {
  padding: 20px 0;
}

.mode-card {
  cursor: pointer;
  text-align: center;
  transition: all 0.3s ease;
  height: 100%;

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .mode-icon {
    font-size: 48px;
    margin: 20px 0;
  }

  .mode-name {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 8px;
  }

  .mode-desc {
    font-size: 13px;
    color: #909399;
  }
}
</style>
