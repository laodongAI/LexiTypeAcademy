# 英语AI对话与错误驱动学习系统 产品需求与技术方案（综合版）

版本：v1.0（2025-11-28）
适用范围：纯英语学习场景（K12为主，兼顾成人基础提升）

## 一、产品目标与核心原则

- 目标：让学生敢开口、有话可说、越说越准；将“错误”转化为个性化课程与游戏关卡，形成“AI对话 → 实时纠错 → 错题课程 → 游戏化巩固”的闭环。
- 原则：
  - 引导性优先：AI主导节奏，分层提示，降低开口门槛。
  - 启发性分层：动态识别学生级别（基础/进阶/高级）与当前状态（响应时长、语法准确率），即时调整难度与提示力度。
  - 情感化自然：回复中融入语气词（Well…, Hmm…, Uh…），温柔纠错（三明治反馈法），频繁使用学生英文名增强亲和力。
  - 低成本高实时：端到端延迟≤1.2s；优先采用云API与本地缓存的混合策略。

## 二、核心模块与功能需求

### 2.1 AI对话系统（主导式教练）

- 学生英文名亲和交互：开场、鼓励、纠错、结算等关键节点重复唤名；语音情感参数随场景变化（鼓励↑、纠错↓）。
- 分层引导逻辑：
  - 沉默≤5s：轻提示（“Take your time, [Name]!”）。
  - 超过5s：句型框架提示（“You can say: I like ____.” 有可选词汇泡泡）。
  - 超过8s：词汇+发音示范（播放“big dog”示范音频/文字高亮）。
  - 超过12s：影子跟读（AI分步带读：“I saw… a big dog!”）。
- 话题降维：将抽象话题转化为可选择/填空/图片指引（如环保→A/B选择原因）。
- 语气词动态注入：每句含1-2个语气词（占比≥5%，位置概率：句首30%/句中50%/句尾20%），与情感语调联动（停顿0.3-0.5s）。
- 历史错误融合：
  - 在对话中强制复用高频错误词/句型（如“pollution”拼写错误）。
  - 触发专项微练（最小对立对：light/night；时态填空：I ____ yesterday）。
- 实时纠错：
  - 语法：三明治反馈（肯定→纠正→鼓励），例：“Great effort, [Name]! Say ‘went’ instead of ‘go’.”
  - 发音：音素偏差提示（“Your ‘light’ sounds like ‘night’—tongue lower.”）+ 对比音频。

### 2.2 错误识别与错题课程生成

- 错误维度：听/说/读/写+综合（句子结构）。
- 识别格式（示例）：
  - 听：{type:"listen", phoneme:"θ", confused:"s", word:"think", ts:1.02}
  - 说：{type:"speak", word:"light", misheard:"night", phoneme:"n", score:0.62}
  - 读：{type:"read", word:"pollution", acc:0.71}
  - 写：{type:"write", wrong:"resycle", correct:"recycle"}
  - 句：{type:"grammar", pattern:"past", wrong:"I go yesterday", correct:"I went yesterday"}
- 课程生成规则：
  - 阈值触发：错误率超过阈值（听>30%、说>25%、读>20%、写>35%）自动生成专项课程。
  - 包含内容：
    - 游戏关卡（错误加权出现）
    - 微课视频（口型/要点讲解，音频版可选）
    - 练习任务（听写/朗读/仿写/对话）
  - 推送策略：每日0点生成“错题补救课程包”，进入“专项训练”栏目；支持离线下载。

### 2.3 游戏化学习（听说读写四维）

- 听：音标捕手（纠错版：错误音标掉落概率↑、连击触发微课）。
- 说：句子特工（康复模式：错误句型优先、失败触发发音示范与语法提示）。
- 读：词汇迷宫（错词设为钥匙词，朗读正确率<80%路径重置）。
- 写：拼写方块（错字歼灭：错误词块透明度↓、连续正确送吸附加速）。
- 绘本共创：说对词汇解锁元素；连续正确触发彩蛋（“Monster dances!”）。
- 成就系统：音标征服者/句子大师/错题清零员；支持关卡分享与班级榜单。

### 2.4 课程体系与分级

- 三级进阶（基础/进阶/高阶）与考试映射（KET/PET/FCE）：
  - 基础：44音标+CVC词+简单句型。
  - 进阶：字母组合、词性转换、段落朗读。
  - 高阶：词根词缀、同义替换、论证表达。
- 单元包结构：音标突破→核心词库→应用任务→错题补救→游戏巩固。

### 2.5 数据看板与家长/教师端

- 学生端：错误热力图、游戏进度地图、周报（音素准确率、语法达成）。
- 家长/教师端：错题课程完成报告、时长-成效关联分析、薄弱点建议。

## 三、用户流程（40分钟课例）

- 诊断测试（10分钟）：听/说/读/写小测，生成当日错误标签与级别。
- 主课程（20分钟）：主题学习与操练，系统记录新错误并注入对话/游戏。
- 游戏化（8-10分钟）：至少1个补救模式关卡+1-2个常规关卡。
- 结算（2分钟）：徽章与鼓励语音；生成家庭复习包与下载入口。

## 四、技术方案（极简、低成本、纯英语）

### 4.1 架构与链路

- 音频输入 → ASR（语音识别） → 文本 → 对话引擎（含提示词工程+历史错误融合） → 回复文本 → TTS（情感语音） → 音频输出
- 错误诊断：WhisperX（词级时间戳+音素偏差）与规则引擎联合。
- 数据：MongoDB（错误库、学生画像、课程包）、Redis（提示语与模板缓存）。

### 4.2 模型选型

- ASR：讯飞星火（实时）或 Whisper/WhisperX（批转+对齐）。
- 对话生成：豆包 Pro（英语口语化+低延迟，API）或 Qwen-7B（本地微调，学术文本强）。
- TTS：豆包语音合成2.0（情感参数≥23，语气词自然）。
- 发音诊断：WhisperX small（实时）/ large（高精度），可混合：简单用small，疑难片段large。

### 4.3 Whisper vs WhisperX 与 small/large 对比（英语场景）

- Whisper v4：高精度通用ASR；不含词级时间戳与说话人分离。
- WhisperX：工具链增强（词级时间戳、对齐、分离），适合教学纠错。
- small：延迟低、资源友好（实时反馈场景优先）。
- large：准确率高、抗噪好（考试/复杂口音分析优先）。
- 推荐混合：small初筛+large疑难；或 v4转录 + X对齐增强。

### 4.4 提示词工程（英语、语气词、分层引导）

- 角色设定（样例）：“You are a kind English speaking coach. Use casual fillers (‘Well…’, ‘Hmm…’, ‘Uh…’) and sandwich feedback (praise → correction → encouragement). Adapt sentence length to level (basic ≤8 words, advanced ≤15). Mention the student’s English name often.”
- 动态注入：将学生历史错误（最小对立对、时态、错拼）写入prompt上下文；根据沉默时长切换引导等级。
- 缓存：高频鼓励与纠错模板本地JSON；中频场景模板Redis；低频动态生成走API。

### 4.5 延迟与成本目标

- 端到端延迟：≤1.2s（缓存命中≤500ms）。
- 成本：千次对话≤0.8元（豆包链路）；混合本地推理进一步下降40%。

## 五、数据结构与接口（示例）

### 5.1 错误库（MongoDB）

```json
{
  "student_id": "S1001",
  "errors": [
    {"type": "speak", "word": "light", "misheard": "night", "phoneme": "n", "freq": 0.73, "last": "2025-11-20"},
    {"type": "grammar", "pattern": "past", "wrong": "I go yesterday", "correct": "I went yesterday", "freq": 0.61}
  ],
  "level": "basic"
}
```

### 5.2 课程包（JSON）

```json
{
  "course_id": "remedial_theta_001",
  "name": "Phoneme /θ/ Intensive",
  "level": "basic",
  "content": [
    {"type": "game", "name": "Phoneme Catcher", "rules": "error_weight=1.5"},
    {"type": "practice", "mode": "dictation", "words": ["think", "this", "three"]},
    {"type": "audio", "name": "Mouth Tips for /θ/"}
  ],
  "prerequisite": {"tags": ["phoneme_confusion_theta_s"], "min_error_rate": 0.3}
}
```

### 5.3 对话生成伪代码

```python
def dialogue_flow(user_audio, student_id):
    text = asr(user_audio)  # iflytek/whisperx
    errors = diagnose(text) # whisperx + rules
    level = get_level(student_id)
    prompt = build_prompt(text, errors, level) # include fillers, name, sandwich
    reply = llm_generate(prompt) # doubao/qwen
    audio = tts(reply, emotion="encouraging")
    return audio
```

## 六、非功能性与容错设计

- 网络异常：离线关卡与提示语缓存（IndexedDB）；恢复后自动同步。
- 误判申诉：长按错误标记→“Mark as correct”，进入复核队列（24h反馈）。
- 隐私安全：语音与文本加密传输与存储；遵循COPPA/GDPR。
- 性能：游戏加载≤2s（弱网≤5s）；对话API失败降级至本地模板回复。

## 七、里程碑与KPI

- 4周MVP：ASR-TTS链路、基础对话、错误库、1款补救游戏。
- 8周V1.0：分层引导全覆盖、课程自动生成、绘本模式、徽章系统。
- KPI：
  - 开口时长：≥8分钟/课（提升≥3倍）。
  - 语法错误率：下降≥30%。
  - 发音错误复发率：下降≥50%。
  - 满意度：≥4.5/5。

## 八、选型对比与建议（英语场景）

- 豆包：低延迟、语气词自然、性价比高（推荐对话+TTS）。
- Qwen：文本质量与可微调性强（可用于学术/离线备用）。
- Whisper v4：高精度ASR（无词级对齐）。
- WhisperX：教学场景增强（词级时间戳、发音诊断、分离）。
- 结论：采用“豆包对话+TTS（主链路） + 讯飞/WhisperX（诊断）”的混合方案；ASR与诊断small/large按实时性与精度动态切换。

—— 完 ——
