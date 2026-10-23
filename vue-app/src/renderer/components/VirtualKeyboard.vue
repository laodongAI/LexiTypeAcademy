<!--
  虚拟键盘组件
  
  用于打字练习中展示键盘布局，支持按键高亮和按键反馈
  
  Props:
  - highlightKey: 需要高亮的按键（提示下一个按键）
  - pressedKey: 当前按下的按键（实时反馈）
  - showFingerHint: 是否显示手指区域颜色
  
  Events:
  - @key-click: 点击虚拟键盘按键时触发
-->

<template>
  <div class="virtual-keyboard" :class="{ 'show-finger-hints': showFingerHint }">
    <div 
      v-for="(row, rowIndex) in keyboardLayout" 
      :key="`row-${rowIndex}`"
      class="keyboard-row"
    >
      <div
        v-for="keyObj in row"
        :key="keyObj.id"
        class="key"
        :class="getKeyClass(keyObj)"
        :style="getKeyStyle(keyObj)"
        @click="handleKeyClick(keyObj.key)"
      >
        <span class="key-label">{{ getKeyLabel(keyObj.key) }}</span>
        <span v-if="keyObj.key === 'F' || keyObj.key === 'J'" class="home-indicator"></span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

/**
 * 键盘按键定义
 */
interface KeyDef {
  key: string
  id: string
  finger?: 'pinky' | 'ring' | 'middle' | 'index' | 'thumb'
  hand?: 'left' | 'right'
  width?: number  // 相对宽度倍数
}

/**
 * Props 定义
 */
interface Props {
  highlightKey?: string
  pressedKey?: string
  showFingerHint?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  highlightKey: '',
  pressedKey: '',
  showFingerHint: true
})

/**
 * Events 定义
 */
const emit = defineEmits<{
  (e: 'key-click', key: string): void
}>()

/**
 * 完整的QWERTY键盘布局
 * 包含手指分区信息
 */
const keyboardLayout: KeyDef[][] = [
  // 数字行
  [
    { key: '`', id: 'grave', finger: 'pinky', hand: 'left' },
    { key: '1', id: '1', finger: 'pinky', hand: 'left' },
    { key: '2', id: '2', finger: 'ring', hand: 'left' },
    { key: '3', id: '3', finger: 'middle', hand: 'left' },
    { key: '4', id: '4', finger: 'index', hand: 'left' },
    { key: '5', id: '5', finger: 'index', hand: 'left' },
    { key: '6', id: '6', finger: 'index', hand: 'right' },
    { key: '7', id: '7', finger: 'index', hand: 'right' },
    { key: '8', id: '8', finger: 'middle', hand: 'right' },
    { key: '9', id: '9', finger: 'ring', hand: 'right' },
    { key: '0', id: '0', finger: 'pinky', hand: 'right' },
    { key: '-', id: 'minus', finger: 'pinky', hand: 'right' },
    { key: '=', id: 'equal', finger: 'pinky', hand: 'right' },
    { key: 'Backspace', id: 'backspace', finger: 'pinky', hand: 'right', width: 2 },
  ],
  // QWERTY行
  [
    { key: 'Tab', id: 'tab', finger: 'pinky', hand: 'left', width: 1.5 },
    { key: 'Q', id: 'Q', finger: 'pinky', hand: 'left' },
    { key: 'W', id: 'W', finger: 'ring', hand: 'left' },
    { key: 'E', id: 'E', finger: 'middle', hand: 'left' },
    { key: 'R', id: 'R', finger: 'index', hand: 'left' },
    { key: 'T', id: 'T', finger: 'index', hand: 'left' },
    { key: 'Y', id: 'Y', finger: 'index', hand: 'right' },
    { key: 'U', id: 'U', finger: 'index', hand: 'right' },
    { key: 'I', id: 'I', finger: 'middle', hand: 'right' },
    { key: 'O', id: 'O', finger: 'ring', hand: 'right' },
    { key: 'P', id: 'P', finger: 'pinky', hand: 'right' },
    { key: '[', id: 'bracket-left', finger: 'pinky', hand: 'right' },
    { key: ']', id: 'bracket-right', finger: 'pinky', hand: 'right' },
    { key: '\\', id: 'backslash', finger: 'pinky', hand: 'right', width: 1.5 },
  ],
  // ASDF行 (基准行)
  [
    { key: 'Caps', id: 'caps', finger: 'pinky', hand: 'left', width: 1.8 },
    { key: 'A', id: 'A', finger: 'pinky', hand: 'left' },
    { key: 'S', id: 'S', finger: 'ring', hand: 'left' },
    { key: 'D', id: 'D', finger: 'middle', hand: 'left' },
    { key: 'F', id: 'F', finger: 'index', hand: 'left' },  // 基准键
    { key: 'G', id: 'G', finger: 'index', hand: 'left' },
    { key: 'H', id: 'H', finger: 'index', hand: 'right' },
    { key: 'J', id: 'J', finger: 'index', hand: 'right' }, // 基准键
    { key: 'K', id: 'K', finger: 'middle', hand: 'right' },
    { key: 'L', id: 'L', finger: 'ring', hand: 'right' },
    { key: ';', id: 'semicolon', finger: 'pinky', hand: 'right' },
    { key: "'", id: 'quote', finger: 'pinky', hand: 'right' },
    { key: 'Enter', id: 'enter', finger: 'pinky', hand: 'right', width: 2.2 },
  ],
  // ZXCV行
  [
    { key: 'Shift', id: 'shift-left', finger: 'pinky', hand: 'left', width: 2.3 },
    { key: 'Z', id: 'Z', finger: 'pinky', hand: 'left' },
    { key: 'X', id: 'X', finger: 'ring', hand: 'left' },
    { key: 'C', id: 'C', finger: 'middle', hand: 'left' },
    { key: 'V', id: 'V', finger: 'index', hand: 'left' },
    { key: 'B', id: 'B', finger: 'index', hand: 'left' },
    { key: 'N', id: 'N', finger: 'index', hand: 'right' },
    { key: 'M', id: 'M', finger: 'index', hand: 'right' },
    { key: ',', id: 'comma', finger: 'middle', hand: 'right' },
    { key: '.', id: 'period', finger: 'ring', hand: 'right' },
    { key: '/', id: 'slash', finger: 'pinky', hand: 'right' },
    { key: 'Shift', id: 'shift-right', finger: 'pinky', hand: 'right', width: 2.7 },
  ],
  // 空格行
  [
    { key: 'Ctrl', id: 'ctrl-left', finger: 'pinky', hand: 'left', width: 1.3 },
    { key: 'Win', id: 'win', finger: 'pinky', hand: 'left', width: 1.3 },
    { key: 'Alt', id: 'alt-left', finger: 'pinky', hand: 'left', width: 1.3 },
    { key: 'Space', id: 'space', finger: 'thumb', hand: 'left', width: 7 },
    { key: 'Alt', id: 'alt-right', finger: 'pinky', hand: 'right', width: 1.3 },
    { key: 'Fn', id: 'fn', finger: 'pinky', hand: 'right', width: 1.3 },
    { key: 'Ctrl', id: 'ctrl-right', finger: 'pinky', hand: 'right', width: 1.3 },
  ],
]

/**
 * 手指颜色映射
 */
const fingerColors = {
  'left-pinky': '#f87171',    // 红色
  'left-ring': '#fb923c',     // 橙色
  'left-middle': '#facc15',   // 黄色
  'left-index': '#4ade80',    // 绿色
  'right-index': '#60a5fa',   // 蓝色
  'right-middle': '#a78bfa',  // 紫色
  'right-ring': '#f472b6',    // 粉色
  'right-pinky': '#94a3b8',   // 灰色
  'thumb': '#67e8f9',         // 青色
}

/**
 * 获取按键的CSS类
 */
function getKeyClass(keyObj: KeyDef): string[] {
  const classes: string[] = []
  
  // 基础样式
  classes.push('key-base')
  
  // 高亮键（下一个要按的键）
  if (isHighlighted(keyObj.key)) {
    classes.push('key-highlight')
  }
  
  // 当前按下的键
  if (isPressed(keyObj.key)) {
    classes.push('key-pressed')
  }
  
  // 基准键
  if (keyObj.key === 'F' || keyObj.key === 'J') {
    classes.push('key-home')
  }
  
  // 功能键
  if (['Backspace', 'Tab', 'Caps', 'Enter', 'Shift', 'Ctrl', 'Alt', 'Win', 'Fn', 'Space'].includes(keyObj.key)) {
    classes.push('key-function')
  }
  
  // 手指分区
  if (props.showFingerHint && keyObj.finger && keyObj.hand) {
    classes.push(`finger-${keyObj.hand}-${keyObj.finger}`)
  }
  
  return classes
}

/**
 * 获取按键样式
 */
function getKeyStyle(keyObj: KeyDef): Record<string, string> {
  const style: Record<string, string> = {}
  
  if (keyObj.width) {
    style.flex = `${keyObj.width}`
  }
  
  // 手指颜色提示（半透明背景）
  if (props.showFingerHint && keyObj.finger && keyObj.hand) {
    const colorKey = keyObj.finger === 'thumb' 
      ? 'thumb' 
      : `${keyObj.hand}-${keyObj.finger}` as keyof typeof fingerColors
    style['--finger-color'] = fingerColors[colorKey] || '#ffffff'
  }
  
  return style
}

/**
 * 检查是否是高亮键
 */
function isHighlighted(key: string): boolean {
  if (!props.highlightKey) return false
  return key.toLowerCase() === props.highlightKey.toLowerCase()
}

/**
 * 检查是否是按下的键
 */
function isPressed(key: string): boolean {
  if (!props.pressedKey) return false
  
  // 处理特殊键名称映射
  const pressedNormalized = props.pressedKey.toLowerCase()
  const keyNormalized = key.toLowerCase()
  
  if (pressedNormalized === keyNormalized) return true
  if (pressedNormalized === ' ' && keyNormalized === 'space') return true
  if (pressedNormalized === 'control' && keyNormalized === 'ctrl') return true
  
  return false
}

/**
 * 获取按键显示标签
 */
function getKeyLabel(key: string): string {
  const labelMap: Record<string, string> = {
    'Backspace': '⌫',
    'Tab': '⇥',
    'Caps': '⇪',
    'Enter': '↵',
    'Shift': '⇧',
    'Ctrl': 'Ctrl',
    'Alt': 'Alt',
    'Win': '⊞',
    'Fn': 'Fn',
    'Space': '',
  }
  return labelMap[key] ?? key
}

/**
 * 处理虚拟键盘点击
 */
function handleKeyClick(key: string): void {
  emit('key-click', key)
}
</script>

<style lang="scss" scoped>
.virtual-keyboard {
  display: inline-flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  background: linear-gradient(145deg, #e6e6e6, #ffffff);
  border-radius: 16px;
  box-shadow: 
    0 4px 6px -1px rgba(0, 0, 0, 0.1),
    0 2px 4px -1px rgba(0, 0, 0, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
  user-select: none;
}

.keyboard-row {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.key {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 48px;
  height: 48px;
  padding: 0 12px;
  background: linear-gradient(180deg, #ffffff 0%, #f5f5f5 100%);
  border: 1px solid #d4d4d4;
  border-radius: 8px;
  font-family: 'SF Pro Text', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  transition: all 0.15s ease;
  box-shadow: 
    0 2px 0 #c4c4c4,
    0 3px 3px rgba(0, 0, 0, 0.1);
  
  &:hover {
    background: linear-gradient(180deg, #f5f5f5 0%, #ebebeb 100%);
  }
  
  &:active,
  &.key-pressed {
    transform: translateY(2px);
    box-shadow: 
      0 0 0 #c4c4c4,
      0 1px 2px rgba(0, 0, 0, 0.1);
    background: linear-gradient(180deg, #ebebeb 0%, #e0e0e0 100%);
  }
}

// 按键高亮（下一个要按的键）
.key-highlight {
  background: linear-gradient(180deg, #fef08a 0%, #fde047 100%) !important;
  border-color: #eab308 !important;
  box-shadow: 
    0 2px 0 #ca8a04,
    0 3px 3px rgba(0, 0, 0, 0.1),
    0 0 12px rgba(234, 179, 8, 0.4) !important;
  animation: pulse 1s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    box-shadow: 
      0 2px 0 #ca8a04,
      0 3px 3px rgba(0, 0, 0, 0.1),
      0 0 12px rgba(234, 179, 8, 0.4);
  }
  50% {
    box-shadow: 
      0 2px 0 #ca8a04,
      0 3px 3px rgba(0, 0, 0, 0.1),
      0 0 20px rgba(234, 179, 8, 0.6);
  }
}

// 按键按下状态
.key-pressed {
  background: linear-gradient(180deg, #bbf7d0 0%, #86efac 100%) !important;
  border-color: #22c55e !important;
}

// 基准键（F和J）
.key-home {
  .home-indicator {
    position: absolute;
    bottom: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: 16px;
    height: 3px;
    background: #888;
    border-radius: 2px;
  }
}

// 功能键
.key-function {
  font-size: 12px;
  color: #666;
  
  .key-label {
    font-size: 16px;
  }
}

// 空格键
.key[style*="flex: 7"] {
  min-width: 300px;
}

// 手指区域颜色提示
.show-finger-hints {
  .key {
    background: linear-gradient(
      180deg, 
      color-mix(in srgb, var(--finger-color, #ffffff) 30%, #ffffff) 0%, 
      color-mix(in srgb, var(--finger-color, #f5f5f5) 20%, #f5f5f5) 100%
    );
    
    &:hover {
      background: linear-gradient(
        180deg, 
        color-mix(in srgb, var(--finger-color, #f5f5f5) 40%, #f5f5f5) 0%, 
        color-mix(in srgb, var(--finger-color, #ebebeb) 30%, #ebebeb) 100%
      );
    }
  }
  
  // 确保高亮和按下状态优先
  .key-highlight,
  .key-pressed {
    --finger-color: transparent;
  }
}

// 手指区域具体颜色（fallback）
.finger-left-pinky { --finger-color: #f87171; }
.finger-left-ring { --finger-color: #fb923c; }
.finger-left-middle { --finger-color: #facc15; }
.finger-left-index { --finger-color: #4ade80; }
.finger-right-index { --finger-color: #60a5fa; }
.finger-right-middle { --finger-color: #a78bfa; }
.finger-right-ring { --finger-color: #f472b6; }
.finger-right-pinky { --finger-color: #94a3b8; }

// 暗色主题支持
:root[data-theme="dark"] & {
  background: linear-gradient(145deg, #2d2d2d, #3d3d3d);
  
  .key {
    background: linear-gradient(180deg, #4a4a4a 0%, #3d3d3d 100%);
    border-color: #555;
    color: #e5e5e5;
    box-shadow: 
      0 2px 0 #2a2a2a,
      0 3px 3px rgba(0, 0, 0, 0.3);
    
    &:hover {
      background: linear-gradient(180deg, #555 0%, #4a4a4a 100%);
    }
    
    &:active,
    &.key-pressed {
      background: linear-gradient(180deg, #3d3d3d 0%, #333 100%);
    }
  }
  
  .key-function {
    color: #aaa;
  }
  
  .key-home .home-indicator {
    background: #888;
  }
}
</style>
