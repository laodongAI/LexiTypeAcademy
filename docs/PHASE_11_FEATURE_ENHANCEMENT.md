# LexiType Academy - 功能增强产品设计文档
## Feature Enhancement Product Design - Phase 11

**文档版本**: v1.0  
**创建日期**: 2024-01-06  
**作者**: 产品经理 & 语文老师 (AI Agent)

---

## 📋 问题概述

根据用户反馈，当前产品存在以下问题：

| 问题 | 严重程度 | 现状 | 目标 |
|------|---------|------|------|
| 1. 虚拟键盘未迁移 | 🔴 高 | 只有占位符 | 完整迁移 |
| 2. 打字内容单薄 | 🔴 高 | 只有基础示例 | 指法+拼音+英文 |
| 3. 拼音学习单薄 | 🔴 高 | 只有6个韵母 | 完整拼音体系 |
| 4. 游戏未迁移 | 🔴 高 | 只有占位符 | 迁移7+游戏 |
| 5. 复习系统Review | ⚠️ 中 | 基本完整 | 验证优化 |
| 6. AI实验室Review | ⚠️ 中 | 框架完成 | 验证优化 |

---

## 🔍 Part 1: 产品Review - 复习系统

### 当前实现分析 (ReviewPage.vue)

**已实现功能** ✅:
1. 复习统计卡片
   - 待复习数量
   - 今日已复习
   - 正确率
   - 连续天数
2. 闪卡翻转界面
   - 正面显示汉字
   - 反面显示拼音和释义
3. 四级评分按钮
   - 忘记了 (1)
   - 有点难 (2)
   - 记住了 (3)
   - 很简单 (4)
4. 进度显示
5. 完成状态

**需要优化** ⚠️:
1. 连续天数计算是硬编码的 `streakDays = 7`
2. 缺少复习提醒功能
3. 缺少复习计划可视化
4. 缺少艾宾浩斯曲线展示
5. 缺少快捷键支持 (1-4 评分)

**改进建议**:
```
1. 实现真实的连续天数计算 (基于reviewLogs)
2. 添加键盘快捷键 (数字键1-4快速评分)
3. 添加空格键翻转卡片
4. 添加复习预览 (未来7天复习量)
```

**优先级**: ⚠️ P2 (功能完整，细节优化)

---

## 🔍 Part 2: 产品Review - AI实验室

### 当前实现分析 (AILabPage.vue, 1018行)

**已实现功能** ✅:
1. **课程生成器** (100%)
   - 主题、难度、课程数量配置
   - 附加说明
   - 生成按钮
   
2. **音频导入** (70%)
   - 三步向导 UI
   - 文件上传组件
   - 分段方式选择
   - ⚠️ 实际ASR功能未集成
   
3. **教材导入** (70%)
   - 文本导入
   - 文件上传
   - ⚠️ PDF/DOCX解析未实现
   
4. **写作助手** (80%)
   - 文本输入
   - AI优化按钮
   - 结果显示
   
5. **发音评测** (40%)
   - 目标文本显示
   - 录音按钮
   - 评分环形图
   - ⚠️ 实际评分功能未实现
   
6. **词汇推荐** (30%)
   - HSK等级选择
   - 词汇列表
   - ⚠️ 推荐逻辑未实现
   
7. **AI对话** (90%)
   - 消息列表
   - 输入发送
   - ⚠️ 依赖AI配置

**需要优化** ⚠️:
1. AI配置状态提示已添加 ✅
2. 音频导入需要集成ASR服务
3. 教材导入需要实现文件解析
4. 发音评测需要集成评分算法
5. 词汇推荐需要实现推荐逻辑

**优先级**: ⚠️ P2 (框架完整，核心逻辑待实现)

---

## 🎯 Part 3: 虚拟键盘组件设计

### 老系统实现分析 (Keyboard.tsx)

**功能特点**:
- 完整的美式QWERTY键盘布局
- 5行键盘 (数字行、QWERTY、ASDF、ZXCV、空格行)
- 特殊键支持 (Backspace, Tab, Caps, Shift, Enter, Ctrl, Alt, Space)
- 高亮功能 (`highlightKey`) - 黄色背景
- 按键反馈 (`pressedKey`) - 绿色背景
- 响应式宽度 (空格键400px, 功能键90px)

### Vue组件设计

```vue
// VirtualKeyboard.vue

Props:
- highlightKey: string   // 需要高亮的键 (提示下一个按键)
- pressedKey: string     // 当前按下的键 (实时反馈)
- showFingerHint: boolean // 是否显示手指提示
- layout: 'qwerty' | 'colemak' // 键盘布局

Events:
- @key-click(key: string) // 点击虚拟键盘按键

Features:
- 手指区域着色 (不同手指用不同颜色)
- 基准键高亮 (F和J有突起标识)
- 动画效果 (按键按下动画)
- 主题支持 (亮色/暗色)
```

---

## 📚 Part 4: 打字练习内容设计

### 设计目标

作为一个打字学习系统，需要满足以下学习阶段：

```
阶段1: 键盘熟悉 (Keyboard Familiarization)
├── 手指定位训练 (Finger Positioning)
├── 基准行训练 (Home Row: ASDF JKL;)
├── 上行训练 (Upper Row: QWERTY)
├── 下行训练 (Lower Row: ZXCV)
└── 数字行训练 (Number Row)

阶段2: 拼音输入实战 (Pinyin Input Practice)
├── 声母训练 (Initials: b p m f...)
├── 韵母训练 (Finals: a o e...)
├── 音节组合 (Syllables: ba bo bi bu...)
├── 词语输入 (Words: nihao, zaijian...)
└── 句子输入 (Sentences: 古诗、课文)

阶段3: 英文输入实战 (English Input Practice)
├── 常用单词 (Common Words)
├── 短句练习 (Short Sentences)
├── 全字母句 (Pangrams)
└── 文章练习 (Articles)
```

### 练习内容数据结构

```typescript
interface PracticeContent {
  id: string;
  type: 'finger' | 'pinyin' | 'english';
  stage: 'beginner' | 'intermediate' | 'advanced';
  category: string;  // 例如: 'home-row', 'initials', 'pangrams'
  title: string;
  content: string[];
  description: string;
  targetKeys?: string[];  // 本练习的目标按键
  expectedWPM?: number;   // 目标速度
}
```

### 老系统练习内容迁移

老系统 `practiceTexts` 包含丰富内容:

**指法练习 (fingerPractice)**:
- 初级: 基准行(ASDF JKL;)、中指(DK)、无名指(SL)
- 中级: 食指扩展(R U T Y G H)、中指扩展(E I)
- 高级: 全字母句(Pangrams)、标点符号

**拼音练习 (typingPractice)**:
- 初级: 声母、韵母、整体认读音节、一二年级古诗
- 中级: 三四年级课文
- 高级: 五六年级名篇

---

## 📖 Part 5: 拼音学习内容设计 (作为语文老师)

### 5.1 拼音学习体系设计

根据小学语文课程标准，拼音学习应包含以下内容：

#### 5.1.1 声母 (23个)

| 类别 | 声母 | 发音要点 | 例字 |
|------|------|---------|------|
| 唇音 | b p m f | 双唇音 | 爸 怕 妈 发 |
| 舌尖音 | d t n l | 舌尖中音 | 大 他 拿 拉 |
| 舌根音 | g k h | 舌根音 | 哥 渴 喝 |
| 舌面音 | j q x | 舌面音 | 机 七 西 |
| 翘舌音 | zh ch sh r | 舌尖后音 | 知 吃 是 日 |
| 平舌音 | z c s | 舌尖前音 | 字 次 思 |
| 零声母 | y w | 半元音 | 衣 屋 |

#### 5.1.2 韵母 (24个)

| 类别 | 韵母 | 发音要点 | 例字 |
|------|------|---------|------|
| **单韵母** (6个) | a o e i u ü | 基础元音 | 啊 哦 鹅 衣 乌 鱼 |
| **复韵母** (9个) | ai ei ao ou | 双元音 | 爱 诶 奥 欧 |
| | ia ie iu(iou) | i开头 | 呀 耶 优 |
| | ua uo üe | u/ü开头 | 蛙 窝 月 |
| **鼻韵母** (9个) | an en in un ün | 前鼻音 | 安 恩 因 温 云 |
| | ang eng ing ong | 后鼻音 | 昂 鞥 英 翁 |

#### 5.1.3 声调 (4个 + 轻声)

| 声调 | 符号 | 调值 | 发音特点 | 例字 |
|------|------|------|---------|------|
| 一声 | ˉ (ā) | 55 | 高平调 | 妈 (mā) |
| 二声 | ˊ (á) | 35 | 中升调 | 麻 (má) |
| 三声 | ˇ (ǎ) | 214 | 降升调 | 马 (mǎ) |
| 四声 | ˋ (à) | 51 | 全降调 | 骂 (mà) |
| 轻声 | (无) | - | 轻短音 | 妈妈 (māma) |

#### 5.1.4 拼读规则

1. **两拼音节**: 声母 + 韵母 (bā, pí, mǔ)
2. **三拼音节**: 声母 + 介母 + 韵母 (guā, xiān, zhuāng)
3. **整体认读音节**: 16个 (zhi chi shi ri zi ci si yi wu yu ye yue yuan yin yun ying)

#### 5.1.5 特殊拼写规则

```
1. ü 规则:
   - j q x 后面的 ü 写成 u (ju qu xu)
   - l n 后面的 ü 保留 (lü nü)

2. 标调规则:
   - 有 a 标 a
   - 无 a 找 o e
   - i u 并列标在后

3. 隔音符号:
   - a o e 开头的音节连接时，用隔音符号 (西安 xī'ān)
```

### 5.2 拼音学习模式设计

#### 模式1: 认读模式 (Recognition)
- 展示拼音，学生识读
- 播放标准发音
- 显示对应汉字

#### 模式2: 听写模式 (Dictation)
- 播放发音，学生输入拼音
- 支持声调输入 (数字1-4或符号)

#### 模式3: 拼读模式 (Spelling)
- 展示汉字，学生拼写拼音
- 支持带调和不带调两种模式

#### 模式4: 声调训练 (Tone Training)
- 专项声调辨别训练
- 听音辨调
- 调值图形化展示

#### 模式5: 发音录制 (Pronunciation Recording)
- 学生录制发音
- AI 评分和反馈

---

## 🎮 Part 6: 游戏系统设计

### 6.1 老系统游戏清单

老系统 `src_bak/ui/components/components/games/` 包含7个游戏:

| 游戏 | 类型 | 学习目标 | 迁移优先级 |
|------|------|---------|-----------|
| TypingRacer | 打字速度 | 键盘熟练度 | 🔴 高 |
| WordChallenge | 限时挑战 | 词汇熟练 | 🔴 高 |
| ComboGame | 连击挑战 | 持续输入 | ⚠️ 中 |
| DungeonTyper | RPG打字 | 趣味学习 | ⚠️ 中 |
| FlightGame | 飞行打字 | 反应速度 | ⚠️ 中 |
| RhythmKey | 节奏打字 | 节奏感 | ⚠️ 中 |
| WordFarm | 单词农场 | 词汇记忆 | ⚠️ 中 |

### 6.2 新游戏设计

基于学习目标，设计以下新游戏类型:

#### 游戏1: 键盘打地鼠 (Keyboard Whack-a-Mole)
```
目标: 熟悉键盘布局
玩法:
- 虚拟键盘上随机出现"地鼠"
- 玩家按下对应按键击中
- 计时限制，统计命中率
难度:
- 初级: 只出现基准行 (ASDF JKL;)
- 中级: 全字母键
- 高级: 包含数字和符号
```

#### 游戏2: 拼音连连看 (Pinyin Match)
```
目标: 汉字与拼音对应
玩法:
- 展示多个汉字和拼音卡片
- 玩家匹配正确的汉字-拼音对
- 相同配对消除
难度:
- 初级: 6对卡片
- 中级: 12对卡片
- 高级: 20对卡片
```

#### 游戏3: 声调辨别 (Tone Recognizer)
```
目标: 区分四声
玩法:
- 播放一个拼音
- 选择正确的声调 (1/2/3/4)
- 连续正确加分
错误类型分析:
- 展示易混淆的声调组合
```

#### 游戏4: 单词雨 (Word Rain)
```
目标: 英文单词熟练度
玩法:
- 单词从屏幕上方下落
- 在落地前输入正确单词
- 输入正确消除单词
难度:
- 初级: 短单词，慢速
- 中级: 中等长度，中速
- 高级: 长单词，快速
```

#### 游戏5: 音标挑战 (Phonics Challenge)
```
目标: 英语音标学习
玩法:
- 展示音标，播放发音
- 选择对应的字母组合
- 或: 展示单词，选择正确音标
```

---

## 🛠️ 实施计划

### Phase 11A: 核心组件迁移 (Day 1-2)

#### Day 1: 虚拟键盘组件
```
任务:
1. 创建 VirtualKeyboard.vue 组件
   - 完整QWERTY布局
   - highlightKey / pressedKey 支持
   - 手指区域着色
   - 按键动画
2. 集成到 TypingPage.vue
   - 替换占位符
   - 实现键盘监听
3. 测试和优化
```

#### Day 2: 打字练习内容
```
任务:
1. 迁移 practiceTexts 数据
   - 指法练习内容
   - 拼音练习内容
2. 创建练习类型选择器
   - 指法练习
   - 拼音练习
   - 英文练习
3. 实现练习模式切换
```

### Phase 11B: 拼音系统完善 (Day 3-4)

#### Day 3: 拼音数据完善
```
任务:
1. 创建完整拼音数据
   - 23个声母
   - 24个韵母
   - 16个整体认读音节
2. 添加发音要点
3. 添加例字和组词
4. 添加声调训练数据
```

#### Day 4: 拼音页面增强
```
任务:
1. 实现声母/韵母完整展示
2. 添加声调专项训练
3. 添加拼读规则说明
4. 实现拼音听写模式
5. 集成TTS发音
```

### Phase 11C: 游戏系统 (Day 5-7)

#### Day 5: 游戏框架
```
任务:
1. 创建游戏组件框架
2. 实现游戏状态管理
3. 创建计分系统
```

#### Day 6: 迁移核心游戏
```
任务:
1. 迁移 TypingRacer (打字竞速)
2. 迁移 WordChallenge (单词挑战)
```

#### Day 7: 新增教育游戏
```
任务:
1. 实现键盘打地鼠
2. 实现拼音连连看
3. 实现声调辨别
```

### Phase 11D: 集成测试 (Day 8)
```
任务:
1. 端到端测试
2. Bug修复
3. 性能优化
4. 文档更新
```

---

## 📊 验收标准

### 虚拟键盘
- [ ] 完整QWERTY布局展示
- [ ] 高亮下一个目标键
- [ ] 实时显示按下的键
- [ ] 手指区域用不同颜色标识
- [ ] F和J键有突起标识
- [ ] 响应式布局

### 打字练习
- [ ] 支持指法练习模式
- [ ] 支持拼音输入练习
- [ ] 支持英文输入练习
- [ ] 显示实时WPM和准确率
- [ ] 错误字符红色标识
- [ ] 正确字符绿色标识

### 拼音学习
- [ ] 展示23个声母完整信息
- [ ] 展示24个韵母完整信息
- [ ] 展示4种声调规则
- [ ] 每个拼音有发音按钮
- [ ] 展示3+例字
- [ ] 声调训练模式

### 游戏系统
- [ ] 至少4个可玩游戏
- [ ] 游戏有计分系统
- [ ] 游戏有难度选择
- [ ] 游戏有操作说明
- [ ] 游戏分数保存

---

## 📎 附件：拼音完整数据

### 声母完整列表

```typescript
const initials = [
  { id: 'b', pinyin: 'b', name: '玻', type: 'labial', description: '双唇不送气清塞音', 
    examples: ['爸', '白', '抱', '北', '本'] },
  { id: 'p', pinyin: 'p', name: '坡', type: 'labial', description: '双唇送气清塞音',
    examples: ['怕', '胖', '跑', '朋', '皮'] },
  { id: 'm', pinyin: 'm', name: '摸', type: 'labial', description: '双唇鼻音',
    examples: ['妈', '忙', '毛', '没', '米'] },
  { id: 'f', pinyin: 'f', name: '佛', type: 'labiodental', description: '唇齿清擦音',
    examples: ['发', '方', '飞', '风', '父'] },
  { id: 'd', pinyin: 'd', name: '得', type: 'alveolar', description: '舌尖前不送气清塞音',
    examples: ['大', '到', '的', '地', '都'] },
  { id: 't', pinyin: 't', name: '特', type: 'alveolar', description: '舌尖前送气清塞音',
    examples: ['他', '太', '天', '头', '土'] },
  { id: 'n', pinyin: 'n', name: '讷', type: 'alveolar', description: '舌尖鼻音',
    examples: ['那', '南', '男', '女', '您'] },
  { id: 'l', pinyin: 'l', name: '勒', type: 'alveolar', description: '舌尖边音',
    examples: ['来', '老', '里', '六', '路'] },
  { id: 'g', pinyin: 'g', name: '哥', type: 'velar', description: '舌根不送气清塞音',
    examples: ['该', '高', '告', '给', '工'] },
  { id: 'k', pinyin: 'k', name: '科', type: 'velar', description: '舌根送气清塞音',
    examples: ['开', '看', '可', '口', '快'] },
  { id: 'h', pinyin: 'h', name: '喝', type: 'velar', description: '舌根清擦音',
    examples: ['还', '好', '和', '后', '花'] },
  { id: 'j', pinyin: 'j', name: '基', type: 'palatal', description: '舌面不送气清塞擦音',
    examples: ['家', '见', '叫', '就', '觉'] },
  { id: 'q', pinyin: 'q', name: '欺', type: 'palatal', description: '舌面送气清塞擦音',
    examples: ['七', '前', '请', '去', '全'] },
  { id: 'x', pinyin: 'x', name: '希', type: 'palatal', description: '舌面清擦音',
    examples: ['下', '先', '想', '小', '学'] },
  { id: 'zh', pinyin: 'zh', name: '知', type: 'retroflex', description: '舌尖后不送气清塞擦音',
    examples: ['这', '知', '中', '住', '着'] },
  { id: 'ch', pinyin: 'ch', name: '蚩', type: 'retroflex', description: '舌尖后送气清塞擦音',
    examples: ['吃', '出', '车', '长', '成'] },
  { id: 'sh', pinyin: 'sh', name: '诗', type: 'retroflex', description: '舌尖后清擦音',
    examples: ['是', '上', '说', '水', '师'] },
  { id: 'r', pinyin: 'r', name: '日', type: 'retroflex', description: '舌尖后浊擦音',
    examples: ['人', '如', '日', '让', '认'] },
  { id: 'z', pinyin: 'z', name: '资', type: 'dental', description: '舌尖前不送气清塞擦音',
    examples: ['在', '再', '子', '自', '走'] },
  { id: 'c', pinyin: 'c', name: '雌', type: 'dental', description: '舌尖前送气清塞擦音',
    examples: ['才', '从', '次', '词', '菜'] },
  { id: 's', pinyin: 's', name: '思', type: 'dental', description: '舌尖前清擦音',
    examples: ['三', '四', '思', '所', '送'] },
  { id: 'y', pinyin: 'y', name: '衣', type: 'semivowel', description: '舌面半元音',
    examples: ['一', '也', '要', '有', '用'] },
  { id: 'w', pinyin: 'w', name: '乌', type: 'semivowel', description: '唇半元音',
    examples: ['我', '为', '问', '五', '万'] },
];
```

### 韵母完整列表

```typescript
const finals = [
  // 单韵母 (6个)
  { id: 'a', pinyin: 'a', type: 'simple', description: '大开口，舌位最低',
    examples: ['啊', '大', '拉', '马', '他'] },
  { id: 'o', pinyin: 'o', type: 'simple', description: '圆唇半高元音',
    examples: ['哦', '波', '末', '佛', '摸'] },
  { id: 'e', pinyin: 'e', type: 'simple', description: '不圆唇半高元音',
    examples: ['鹅', '饿', '恶', '额', '讹'] },
  { id: 'i', pinyin: 'i', type: 'simple', description: '扁唇高元音',
    examples: ['衣', '一', '以', '已', '意'] },
  { id: 'u', pinyin: 'u', type: 'simple', description: '圆唇高元音',
    examples: ['乌', '五', '无', '物', '雾'] },
  { id: 'v', pinyin: 'ü', type: 'simple', description: '圆唇高前元音',
    examples: ['鱼', '雨', '语', '于', '玉'] },
  
  // 复韵母 (9个)
  { id: 'ai', pinyin: 'ai', type: 'compound', description: 'a向i滑动',
    examples: ['爱', '白', '开', '来', '太'] },
  { id: 'ei', pinyin: 'ei', type: 'compound', description: 'e向i滑动',
    examples: ['诶', '北', '飞', '给', '美'] },
  { id: 'ao', pinyin: 'ao', type: 'compound', description: 'a向o滑动',
    examples: ['奥', '好', '高', '老', '跑'] },
  { id: 'ou', pinyin: 'ou', type: 'compound', description: 'o向u滑动',
    examples: ['欧', '走', '头', '手', '口'] },
  { id: 'ia', pinyin: 'ia', type: 'compound', description: 'i向a滑动',
    examples: ['呀', '家', '下', '加', '牙'] },
  { id: 'ie', pinyin: 'ie', type: 'compound', description: 'i向e滑动',
    examples: ['耶', '写', '谢', '姐', '街'] },
  { id: 'iu', pinyin: 'iu(iou)', type: 'compound', description: 'i向ou滑动',
    examples: ['优', '六', '九', '有', '就'] },
  { id: 'ua', pinyin: 'ua', type: 'compound', description: 'u向a滑动',
    examples: ['蛙', '花', '挂', '瓜', '刷'] },
  { id: 'uo', pinyin: 'uo', type: 'compound', description: 'u向o滑动',
    examples: ['窝', '多', '国', '过', '说'] },
  
  // 特殊韵母
  { id: 've', pinyin: 'üe', type: 'compound', description: 'ü向e滑动',
    examples: ['月', '雪', '学', '约', '决'] },
  
  // 前鼻韵母 (5个)
  { id: 'an', pinyin: 'an', type: 'nasal-front', description: 'a加前鼻音n',
    examples: ['安', '三', '看', '蓝', '天'] },
  { id: 'en', pinyin: 'en', type: 'nasal-front', description: 'e加前鼻音n',
    examples: ['恩', '门', '人', '本', '分'] },
  { id: 'in', pinyin: 'in', type: 'nasal-front', description: 'i加前鼻音n',
    examples: ['因', '今', '心', '林', '信'] },
  { id: 'un', pinyin: 'un', type: 'nasal-front', description: 'u加前鼻音n',
    examples: ['温', '春', '村', '论', '问'] },
  { id: 'vn', pinyin: 'ün', type: 'nasal-front', description: 'ü加前鼻音n',
    examples: ['云', '运', '军', '群', '均'] },
  
  // 后鼻韵母 (4个)
  { id: 'ang', pinyin: 'ang', type: 'nasal-back', description: 'a加后鼻音ng',
    examples: ['昂', '方', '上', '光', '忙'] },
  { id: 'eng', pinyin: 'eng', type: 'nasal-back', description: 'e加后鼻音ng',
    examples: ['鞥', '风', '生', '能', '冷'] },
  { id: 'ing', pinyin: 'ing', type: 'nasal-back', description: 'i加后鼻音ng',
    examples: ['英', '行', '名', '听', '星'] },
  { id: 'ong', pinyin: 'ong', type: 'nasal-back', description: 'o加后鼻音ng',
    examples: ['翁', '中', '东', '红', '公'] },
];
```

### 整体认读音节 (16个)

```typescript
const wholeRecognition = [
  'zhi', 'chi', 'shi', 'ri',    // 翘舌音
  'zi', 'ci', 'si',              // 平舌音
  'yi', 'wu', 'yu',              // 零声母
  'ye', 'yue', 'yuan',           // 特殊
  'yin', 'yun', 'ying'           // 前后鼻音
];
```

---

**文档状态**: 已完成设计  
**下一步**: 开始实施 Phase 11A
