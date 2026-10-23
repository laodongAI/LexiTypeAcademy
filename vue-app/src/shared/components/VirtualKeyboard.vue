<template>
  <div class="virtual-keyboard">
    <div 
      v-for="(row, rowIndex) in keyboardLayout" 
      :key="rowIndex" 
      class="keyboard-row"
    >
      <div
        v-for="(key, keyIndex) in row"
        :key="`${rowIndex}-${keyIndex}`"
        :class="getKeyClass(key)"
        :style="getKeyStyle(key)"
        @click="handleKeyClick(key)"
      >
        {{ key }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  /** 高亮显示的目标按键 */
  highlightKey?: string
  /** 当前按下的按键 */
  pressedKey?: string
  /** 键盘布局类型 */
  layout?: 'qwerty' | 'dvorak'
}

const props = withDefaults(defineProps<Props>(), {
  highlightKey: '',
  pressedKey: '',
  layout: 'qwerty'
})

const emit = defineEmits<{
  keyClick: [key: string]
}>()

// QWERTY 键盘布局
const keyboardLayout = computed(() => {
  if (props.layout === 'qwerty') {
    return [
      ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
      ['Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
      ['Caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', '\'', 'Enter'],
      ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Shift'],
      ['Ctrl', 'Win', 'Alt', 'Space', 'Alt', 'Fn', 'Ctrl']
    ]
  }
  // 可以添加其他布局
  return []
})

// 获取按键样式类
function getKeyClass(key: string): string[] {
  const classes = ['key']
  
  // 高亮目标按键（黄色）
  if (props.highlightKey && 
      (key.toLowerCase() === props.highlightKey.toLowerCase() || 
       key === props.highlightKey)) {
    classes.push('key-highlight')
  }
  
  // 按下的按键（绿色）
  if (props.pressedKey && 
      (key.toLowerCase() === props.pressedKey.toLowerCase() || 
       key === props.pressedKey)) {
    classes.push('key-pressed')
  }
  
  // 特殊键样式
  if (['Backspace', 'Tab', 'Caps', 'Enter', 'Shift', 'Ctrl', 'Alt', 'Win', 'Fn'].includes(key)) {
    classes.push('key-special')
  }
  
  if (key === 'Space') {
    classes.push('key-space')
  }
  
  return classes
}

// 获取按键样式
function getKeyStyle(key: string): Record<string, string> {
  const style: Record<string, string> = {}
  
  // 特殊键宽度
  switch (key) {
    case 'Space':
      style.width = '400px'
      break
    case 'Backspace':
    case 'Tab':
    case 'Caps':
    case 'Enter':
      style.width = '90px'
      break
    case 'Shift':
      style.width = '110px'
      break
    case 'Ctrl':
    case 'Alt':
      style.width = '70px'
      break
    case 'Win':
    case 'Fn':
      style.width = '60px'
      break
  }
  
  return style
}

// 按键点击事件
function handleKeyClick(key: string) {
  emit('keyClick', key)
}
</script>

<style lang="scss" scoped>
.virtual-keyboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: visible;
  background: var(--bg-color-hover);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  user-select: none;
}

.keyboard-row {
  display: flex;
  gap: 6px;
  justify-content: center;
  min-width: max-content;
}

.key {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 50px;
  height: 50px;
  padding: 0 10px;
  background-color: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  cursor: pointer;
  transition: all 0.2s ease;
  
  &:hover {
    background-color: var(--bg-color-hover);
    transform: translateY(-1px);
  }
  
  &:active {
    transform: translateY(0);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }
}

.key-special {
  background-color: var(--el-fill-color-light);
  font-size: 12px;
  color: var(--text-color-secondary);
}

.key-space {
  font-size: 12px;
  color: var(--text-color-placeholder);
}

.key-highlight {
  background: var(--el-color-warning-light-8);
  border-color: var(--el-color-warning);
  color: var(--text-color);
  font-weight: 600;
  
  &:hover {
    background: var(--el-color-warning-light-7);
  }
}

.key-pressed {
  background: var(--el-color-success-light-7);
  border-color: var(--el-color-success);
  color: var(--el-color-success-dark-2);
  transform: scale(0.95);
}
</style>
