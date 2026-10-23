# 英语AI学习系统 API 合约（初稿）

版本：v0.1
说明：REST 为主 + WebSocket 实时通道。所有时间戳使用 ISO8601，字段命名采用 camelCase。

## 1. 认证
POST /api/auth/token
Body: {"provider":"local","email":"string","password":"string"}
Response: {"accessToken":"jwt","expiresIn":3600}

## 2. 学生画像与级别
GET /api/students/{id}
Response: {"id":"S1001","englishName":"Lily","level":"basic","stats":{"grammarAcc":0.71,"phonemeAcc":0.63,"avgResponseLatency":4.2}}

PATCH /api/students/{id}/level
Body: {"level":"advanced"}
Response: 204

## 3. 错误记录（Errors）
GET /api/students/{id}/errors?since=2025-11-01&types=speak,grammar
Response: {"items":[{"id":"e123","type":"speak","word":"light","misheard":"night","phoneme":"n","freq":0.73,"last":"2025-11-20T10:00:00Z"}]}

POST /api/students/{id}/errors
Body: {"type":"grammar","wrong":"I go yesterday","correct":"I went yesterday","pattern":"past"}
Response: {"id":"e456"}

POST /api/errors/{errorId}/appeal
Body: {"reason":"model_misjudge"}
Response: 202

## 4. 专项课程（Remedial Courses）
GET /api/students/{id}/remedial-courses
Response: {"items":[{"courseId":"remedial_theta_001","name":"Phoneme /θ/ Intensive","level":"basic","prerequisite":{"tags":["phoneme_confusion_theta_s"],"minErrorRate":0.3},"status":"pending"}]}

POST /api/remedial-courses/generate
Body: {"studentId":"S1001","tags":["phoneme_confusion_theta_s"],"force":false}
Response: {"courseId":"remedial_theta_002"}

## 5. 课程包（General Courses）
GET /api/courses?level=basic&theme=environment
Response: {"items":[{"id":"env_L1_001","name":"Environment Basics","level":"basic","units":6}]}

POST /api/courses/import
Body: {"source":"file","format":"json","payload":{}}
Response: {"id":"custom_20251128_01"}

## 6. 对话实时服务（WebSocket）
URL: wss://server.example.com/ws/dialogue?token=XXX
客户端发送：
{
  "type":"audioChunk",
  "chunkId":"c1",
  "pcmBase64":"...",
  "seq":1
}
服务器回应（可能多条）：
{
  "type":"partialText","text":"I w"}
{
  "type":"diagnosis","errors":[{"kind":"phoneme","target":"θ","confused":"s"}]}
{
  "type":"coachReply","text":"Well great effort! Say 'went' instead of 'go'.","audioUrl":"https://cdn/.../reply_c1.mp3"}

关闭：服务器发送 {"type":"sessionEnd","stats":{"turns":12,"avgLatency":820}}

## 7. 游戏关卡
GET /api/games/catalog?mode=remedial&ability=speak
Response: {"items":[{"gameId":"sentence_agent","title":"句子特工康复","ability":"speak","difficulty":2}]}

POST /api/games/instantiate
Body: {"studentId":"S1001","gameId":"phoneme_catcher","injectErrors":true}
Response: {"sessionId":"g_sess_991"}

## 8. 统计与报表
GET /api/reports/students/{id}/weekly
Response: {"from":"2025-11-17","to":"2025-11-23","metrics":{"phonemeAccDelta":0.12,"grammarErrRate":0.31,"speakingTimeMinutes":42}}

## 9. 数据结构概要（TypeScript）
```ts
export interface ErrorRecord {
  id?: string;
  type: 'listen' | 'speak' | 'read' | 'write' | 'grammar';
  word?: string;
  wrong?: string;
  correct?: string;
  phoneme?: string;
  misheard?: string;
  pattern?: string; // grammar pattern like 'past'
  freq?: number; // occurrence frequency ratio
  last?: string; // ISO timestamp
}

export interface RemedialCourse {
  courseId: string;
  name: string;
  level: 'basic' | 'intermediate' | 'advanced';
  prerequisite: { tags: string[]; minErrorRate?: number };
  content: Array<{ type: string; name?: string; words?: string[]; rules?: string }>;
  status: 'pending' | 'active' | 'completed';
}

export interface DialogueTurn {
  turnId: string;
  role: 'student' | 'coach';
  text: string;
  audioUrl?: string;
  latencyMs?: number;
  injectedErrors?: ErrorRecord[];
}
```

## 10. 错误→课程生成逻辑（伪算法）
```pseudo
INPUT: recentErrors[ErrorRecord], thresholds
GROUP by tag (phoneme_confusion, past_tense, spelling)
FILTER where errorRate(tag) > thresholds[tag]
FOR EACH tag -> build RemedialCourse template
PERSIST course; enqueue push to student
```

## 11. Latency / SLA 目标
- ASR 初步转写：≤600ms 首响应，完整句子≤1200ms。
- 对话回复合成后推送：≤1500ms。
- 错误诊断聚合：批量窗口≤300ms。

## 12. 错误申诉工作流
POST appeal → 状态进入 pending → 自动规则复审（置信度<阈值直接通过）→ 人工抽样 → 结果写回并重新训练标签集。

## 13. 安全与速率限制
- Rate: 60 dialogue turns / minute / student；超限返回429并建议冷却。
- WebSocket 心跳：30s；失联自动回收会话并保存部分进度。

## 14. 后续扩展占位
- /api/dialogue/suggest-topics：根据历史错误+兴趣标签推荐3个低压力话题。
- /api/phoneme/drill：批量返回易混音最小对立对。

—— 完 ——
