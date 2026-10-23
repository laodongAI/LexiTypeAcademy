# 音频服务使用指南

## 音频播放服务 (audioPlayService)

### 基本用法

```typescript
import { getAudioPlayService, playAudio, playTTS } from '@/shared/services/audioPlayService'

// 方式 1: 使用服务实例
const audioService = getAudioPlayService()

await audioService.play({
  source: '/path/to/audio.mp3',
  type: 'file',
  volume: 0.8,
  rate: 1.0,
  onEnded: () => {
    console.log('播放完成')
  },
  onError: (error) => {
    console.error('播放失败:', error)
  }
})

// 方式 2: 使用便捷函数
await playAudio('/path/to/audio.mp3', 'file')
await playTTS('你好，世界') // 使用 TTS 播放文本
```

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { getAudioPlayService } from '@/shared/services/audioPlayService'
import { ElMessage } from 'element-plus'

const audioService = getAudioPlayService()
const isPlaying = ref(false)

async function playAudio() {
  if (isPlaying.value) {
    audioService.stop()
    isPlaying.value = false
    return
  }
  
  isPlaying.value = true
  
  try {
    await audioService.play({
      source: '/audio/lesson1.mp3',
      type: 'file',
      onEnded: () => {
        isPlaying.value = false
      },
      onError: (error) => {
        isPlaying.value = false
        ElMessage.error('音频播放失败')
        console.error(error)
      }
    })
  } catch (error) {
    isPlaying.value = false
    ElMessage.error('音频播放失败')
  }
}
</script>

<template>
  <el-button 
    :icon="isPlaying ? 'VideoPause' : 'VideoPlay'"
    @click="playAudio"
  >
    {{ isPlaying ? '停止' : '播放' }}
  </el-button>
</template>
```

## 录音服务 (audioRecordService)

### 基本用法

```typescript
import { getAudioRecordService, startRecording, stopRecording } from '@/shared/services/audioRecordService'

// 方式 1: 使用服务实例
const recordService = getAudioRecordService()

await recordService.startRecording({
  maxDuration: 30000, // 30秒
  onStart: () => {
    console.log('开始录音')
  },
  onStop: (blob) => {
    console.log('录音完成', blob)
  },
  onError: (error) => {
    console.error('录音失败:', error)
  }
})

const audioBlob = await recordService.stopRecording()

// 方式 2: 使用便捷函数
await startRecording({ maxDuration: 30000 })
const blob = await stopRecording()
```

### 在 Vue 组件中使用

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { getAudioRecordService, blobToBase64, saveBlobAsFile } from '@/shared/services/audioRecordService'
import { ElMessage } from 'element-plus'

const recordService = getAudioRecordService()
const isRecording = ref(false)
const recordedBlob = ref<Blob | null>(null)

async function toggleRecording() {
  if (isRecording.value) {
    // 停止录音
    try {
      recordedBlob.value = await recordService.stopRecording()
      isRecording.value = false
      ElMessage.success('录音完成')
    } catch (error) {
      isRecording.value = false
      ElMessage.error('录音失败')
      console.error(error)
    }
  } else {
    // 开始录音
    try {
      await recordService.startRecording({
        maxDuration: 30000,
        onStart: () => {
          isRecording.value = true
        },
        onError: (error) => {
          isRecording.value = false
          ElMessage.error('录音失败')
          console.error(error)
        }
      })
    } catch (error) {
      ElMessage.error('无法访问麦克风')
      console.error(error)
    }
  }
}

async function saveRecording() {
  if (recordedBlob.value) {
    saveBlobAsFile(recordedBlob.value, `recording-${Date.now()}.webm`)
  }
}
</script>

<template>
  <div>
    <el-button 
      :type="isRecording ? 'danger' : 'success'"
      :icon="isRecording ? 'Close' : 'Microphone'"
      @click="toggleRecording"
    >
      {{ isRecording ? '停止录音' : '开始录音' }}
    </el-button>
    
    <el-button 
      v-if="recordedBlob"
      @click="saveRecording"
    >
      保存录音
    </el-button>
  </div>
</template>
```

## 练习模式集成示例

### DictationMode 听写模式

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { getAudioPlayService } from '@/shared/services/audioPlayService'
import type { LessonItem } from '@/shared/types/course'

const props = defineProps<{ item: LessonItem }>()
const audioService = getAudioPlayService()
const isPlaying = ref(false)
const userAnswer = ref('')

async function playAudio() {
  if (isPlaying.value) {
    audioService.stop()
    isPlaying.value = false
    return
  }
  
  isPlaying.value = true
  
  const audioSource = props.item.audioUrl || props.item.english
  const audioType = props.item.audioUrl ? 'file' : 'tts'
  
  await audioService.play({
    source: audioSource,
    type: audioType,
    onEnded: () => { isPlaying.value = false },
    onError: () => { isPlaying.value = false }
  })
}
</script>
```

### FollowMode 跟读模式

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { getAudioPlayService } from '@/shared/services/audioPlayService'
import { getAudioRecordService } from '@/shared/services/audioRecordService'

const audioService = getAudioPlayService()
const recordService = getAudioRecordService()

const isRecording = ref(false)
const recordedBlob = ref<Blob | null>(null)

async function toggleRecording() {
  if (isRecording.value) {
    recordedBlob.value = await recordService.stopRecording()
    isRecording.value = false
    
    // TODO: 发送录音到服务器进行评分
    const score = await evaluatePronunciation(recordedBlob.value)
  } else {
    await recordService.startRecording({
      maxDuration: 30000,
      onStart: () => { isRecording.value = true }
    })
  }
}
</script>
```

## 注意事项

1. **浏览器兼容性**
   - 录音功能需要 HTTPS 或 localhost
   - 需要用户授权麦克风权限
   - TTS 功能依赖浏览器支持

2. **错误处理**
   - 始终处理 onError 回调
   - 捕获异步操作的异常
   - 提供用户友好的错误提示

3. **资源管理**
   - 组件卸载时停止播放/录音
   - 及时释放 Blob URL
   - 避免内存泄漏

4. **用户体验**
   - 显示加载状态
   - 提供明确的视觉反馈
   - 支持中断操作
