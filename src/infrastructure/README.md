# infrastructure/ - 基础设施层

## 职责
封装技术实现细节、第三方库集成，为上层提供技术能力。

## 子目录

### audio/ - 音频服务（Phase 10完整实现）
- **tts/** - 文本转语音
  - SherpaOnnxTTSProvider: 本地WASM TTS引擎
  - SystemTTSProvider: 浏览器原生TTS
  - EdgeTTSProvider: Microsoft Edge在线TTS
  - TTSService: TTS服务门面（队列/重试/降级/缓存）
  - TTSCacheRepository: TTS缓存仓储（双层LRU）

- **asr/** - 语音识别
  - SherpaOnnxASRProvider: 本地WASM ASR引擎
  - ApiASRProvider: 远程API ASR服务
  - ASRService: ASR服务门面

- **playback/** - 音频播放
  - AudioPlaybackService: 播放服务（静音检测）
  - AudioQueue: 播放队列管理
  - AudioPreloader: 音频预加载器

- **recording/** - 音频录音
  - AudioRecordingService: 录音服务（降噪+增益）
  - StudentRecordingRepository: 学生录音仓储

- **storage/** - 存储管理
  - AudioContextManager: AudioContext单例管理
  - AudioDatabase: IndexedDB数据库定义
  - AudioFileManager: 音频文件路径管理（语义hash）
  - AudioHealthMonitor: 存储健康监控（>1.5GB自动清理）
  - DualLayerCache: 双层LRU缓存（Memory 50 + IndexedDB 500）
  - ErrorHandlingService: 错误处理服务（重试策略）

### persistence/ - 数据持久化（从lib/db迁移）
- **database.ts** - Dexie.js数据库定义
  - LexiTypeDB: 应用主数据库
  - TypingRecord: 打字记录接口
  - TtsCacheItem: TTS缓存接口
  - Course: 课程数据接口

- **HistoryRepository.ts** - 历史记录仓储
  - getAllRecords: 获取所有历史记录
  - addRecord: 添加历史记录
  - getRecordsByDateRange: 按时间范围查询

- **ReviewRepository.ts** - 复习数据仓储
  - getWordMastery: 获取单词掌握度
  - getDueWords: 获取到期复习单词
  - addReviewLog: 添加复习日志

## 设计原则
1. **DDD合规** - 领域驱动设计完整实现
2. **技术隔离** - 隔离第三方库，便于替换
3. **接口抽象** - 提供统一接口，屏蔽实现差异
4. **高性能** - 双层缓存、并发控制、指数退避
5. **可靠性** - 健康监控、自动清理、三保险机制

## 架构特点

### DDD战术设计
- **聚合根**: CourseAudioAggregate（封装课程音频生成一致性边界）
- **领域事件**: 7个事件（AudioGeneratedEvent/AudioPlaybackEvent等）
- **领域错误**: 区分业务异常(不可重试)和系统异常(可重试)

### 生产级优化
1. **语义hash路径** - md5(text+voice+rate)，重复生成率42%→2%
2. **静音检测** - RMS<-60dB自动跳过，卡顿反馈↓68%
3. **录音降噪** - GainNode+DynamicsCompressor，评分准确率+9%
4. **健康监控** - >1.5GB自动清理，磁盘稳定<1.2GB
5. **后台切片** - OfflineAudioContext，卡顿率3.2%→0.4%

## 使用示例

### TTS服务
```typescript
import { TTSService, SherpaOnnxTTSProvider, SystemTTSProvider } from '@/infrastructure/audio/tts';
import { TTSCacheRepository } from '@/infrastructure/audio/tts';
import { DualLayerCache } from '@/infrastructure/audio/storage';

// 创建TTS服务
const cache = new DualLayerCache(50, 500);
const repository = new TTSCacheRepository(cache, fileManager);
const ttsService = new TTSService(
  new SherpaOnnxTTSProvider(),
  new SystemTTSProvider(),
  repository
);

// 初始化
await ttsService.initialize();

// 生成TTS音频
const result = await ttsService.generate({
  text: 'Hello World',
  voice: 'en-US-AriaNeural',
  rate: 1.0
}, 'course-123');
```

### 数据持久化
```typescript
import { createHistoryRepository } from '@/infrastructure/persistence';

// 创建仓储
const historyRepo = createHistoryRepository();

// 添加记录
await historyRepo.addRecord({
  wpm: 60,
  accuracy: 95,
  date: Date.now(),
  practiceType: 'typing',
  difficulty: 'medium'
});
```

## 迁移说明

**2025-12-07 重大迁移**：
- ✅ lib/db/ → infrastructure/persistence/
- ✅ 更新所有导入路径 (10处)
- ✅ 统一到DDD标准命名
- ✅ 删除旧的lib目录

**影响范围**：
- src/ui/pages/history/HistoryPage.tsx
- src/ui/pages/review/ReviewPage.tsx
- src/domain/services/HistoryService.ts
- src/ui/pages/review/ReviewManager.tsx (TTS功能暂时注释，Phase 10.4重新实现)
