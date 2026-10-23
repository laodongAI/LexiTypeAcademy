# 音频服务快速启动指南

## 🚀 5 分钟快速开始

本指南帮助您快速启动并测试 TTS/ASR 音频服务集成。

---

## 📋 前置要求

- ✅ Node.js 18+ 已安装
- ✅ 后端 API 服务已准备（node-server-tts-asr 项目）
- ✅ 前端项目已安装依赖

---

## 🔧 Step 1: 启动后端 API 服务

### 方式 1: 如果后端已准备

```bash
# 在后端项目目录
cd /path/to/node-server-tts-asr
npm install
npm start
```

**验证**: 浏览器访问 http://127.0.0.1:3000，应该看到 API 文档或欢迎页面

### 方式 2: 如果后端未实现（临时方案）

创建一个简单的 Mock Server：

```bash
# 创建临时目录
mkdir mock-audio-api
cd mock-audio-api
npm init -y
npm install express cors
```

创建 `server.js`：

```javascript
const express = require('express')
const cors = require('cors')
const app = express()

app.use(cors())
app.use(express.json())

// Mock TTS API
app.post('/api/tts/generate', (req, res) => {
  console.log('TTS 请求:', req.body)
  
  // 返回 mock 数据
  res.json({
    success: true,
    audio: 'base64_mock_audio_data',
    duration: 2.5
  })
})

// Mock ASR API
app.post('/api/asr/recognize', (req, res) => {
  console.log('ASR 请求')
  
  // 返回 mock 评分
  res.json({
    success: true,
    text: "Hello world",
    confidence: 0.95,
    score: {
      overall: 85,
      accuracy: 90,
      fluency: 82,
      completeness: 88,
      pronunciation: 83
    }
  })
})

app.listen(3000, () => {
  console.log('Mock API 运行在 http://127.0.0.1:3000')
})
```

启动 Mock Server：

```bash
node server.js
```

---

## 🎨 Step 2: 启动前端应用

```bash
# 在项目根目录
cd vue-app
npm install
npm run dev
```

**预期输出**:
```
VITE v6.0.0  ready in 500 ms
➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## ✅ Step 3: 快速测试

### 测试 1: 听写模式（TTS 播放）

1. 打开浏览器访问 http://localhost:5173
2. 导航到 **课程学习** 页面
3. 选择任意课程和章节
4. 进入 **听写模式**
5. 点击 **播放音频** 按钮
6. 🎧 应该能听到语音（如果 Mock Server 则无实际音频）

**验证成功标志**:
- ✅ 按钮状态切换（播放/暂停）
- ✅ Console 显示: `[TTS] 正在生成语音...`
- ✅ Network 显示请求到 `/api/tts/generate`

### 测试 2: 跟读模式（录音 + 评分）

1. 切换到 **跟读模式**
2. 点击 **录音** 按钮（允许麦克风权限）
3. 说 "Hello world"
4. 点击 **停止录音**
5. 点击 **提交录音**
6. 📊 查看评分结果

**验证成功标志**:
- ✅ 录音指示器显示
- ✅ 提交后显示加载状态
- ✅ 显示评分（0-100）
- ✅ Console 显示: `[ASR] 识别结果...`

### 测试 3: 模仿模式（详细评分）

1. 切换到 **模仿模式**
2. 播放标准音频
3. 录制自己的发音
4. 提交评分
5. 📈 查看详细评分（准确度、流畅度、完整度）

**验证成功标志**:
- ✅ 三项评分显示
- ✅ 总分显示
- ✅ 评分不是随机数（如果使用 Mock 则是固定值）

---

## 🐛 常见问题

### Q1: 端口 3000 被占用

**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决**:
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -ti:3000 | xargs kill -9
```

### Q2: 麦克风权限被拒绝

**错误**: `NotAllowedError: Permission denied`

**解决**:
1. 点击浏览器地址栏的麦克风图标
2. 选择 "始终允许此网站访问麦克风"
3. 刷新页面

### Q3: 音频无法播放

**症状**: 点击播放无反应

**排查**:
```bash
# 测试 API 是否运行
curl http://127.0.0.1:3000/api/tts/generate

# 检查前端配置
cat vue-app/.env.development
```

### Q4: CORS 错误

**错误**: `Access-Control-Allow-Origin`

**解决**: 在后端添加 CORS 头：
```javascript
app.use(cors())
```

---

## 📊 开发者工具检查

打开浏览器开发者工具 (F12)：

### Network 标签
应该看到以下请求：
- `POST /api/tts/generate` - 状态 200
- `POST /api/asr/recognize` - 状态 200

### Console 标签
应该看到以下日志：
```
[TTS] 正在生成语音...
[TTS] 生成成功，时长: 2.5s
[ASR] 正在识别...
[ASR] 评分完成: 85 分
```

---

## 🎯 下一步

测试通过后，可以：

1. **查看集成文档**: [TTS_ASR_INTEGRATION_GUIDE.md](./TTS_ASR_INTEGRATION_GUIDE.md)
2. **查看 API 规范**: [TTS_ASR_BACKEND_API_SPEC.md](./TTS_ASR_BACKEND_API_SPEC.md)
3. **查看评分算法**: [ASR_SCORING_ALGORITHM_IMPLEMENTATION.md](./ASR_SCORING_ALGORITHM_IMPLEMENTATION.md)
4. **执行完整测试**: [AUDIO_SERVICE_INTEGRATION_TEST_GUIDE.md](./AUDIO_SERVICE_INTEGRATION_TEST_GUIDE.md)

---

## 📞 需要帮助？

**遇到问题**:
1. 检查 Console 日志
2. 检查 Network 请求
3. 查看 `docs/` 目录下的详细文档
4. 联系开发团队

**成功运行**:
🎉 恭喜！您已成功集成音频服务！

---

**版本**: v1.0  
**创建**: 2026-01-06  
**适用**: LexiType Academy 音频服务集成
