# 音频服务集成测试指南

## 📋 测试目标

验证 TTS 和 ASR API 集成是否正常工作。

---

## 🔧 前置条件

### 1. 启动后端 API 服务

确保 TTS/ASR API 服务运行在 `http://127.0.0.1:3000`

```bash
# 在后端项目目录运行
npm start
# 或
node server.js
```

### 2. 检查环境配置

确认 `vue-app/.env.development` 配置正确：

```env
VITE_TTS_API_URL=http://127.0.0.1:3000
VITE_ASR_API_URL=http://127.0.0.1:3000
```

### 3. 启动前端应用

```bash
cd vue-app
npm run dev
```

---

## ✅ 测试清单

### 测试 1: DictationMode（听写模式）

**测试目标**: 验证 TTS API 播放功能

**步骤**:
1. 导航到课程学习页面
2. 选择一个课程和章节
3. 进入听写模式
4. 点击"播放音频"按钮
5. 检查是否播放语音

**预期结果**:
- ✅ 音频正常播放
- ✅ 播放按钮状态正确切换
- ✅ 控制台无错误信息

**如果失败**:
- 检查 TTS API 服务是否运行
- 打开浏览器开发者工具查看网络请求
- 检查 Console 是否有错误日志

---

### 测试 2: FollowMode（跟读模式）

**测试目标**: 验证 TTS 播放 + ASR 评分功能

**步骤**:
1. 导航到课程学习页面
2. 选择跟读模式
3. 点击"播放示范"听标准发音
4. 点击"录音"按钮开始录音
5. 朗读句子后点击"停止"
6. 点击"提交录音"进行评分
7. 查看评分结果

**预期结果**:
- ✅ 标准音频正常播放
- ✅ 录音功能正常（需要麦克风权限）
- ✅ 评分 API 返回结果
- ✅ 显示分数（0-100）
- ✅ 显示评分提示

**如果失败**:
- **音频播放失败**: 检查 TTS API
- **录音失败**: 检查麦克风权限
- **评分失败**: 检查 ASR API 和评分功能实现
- **分数显示异常**: 检查 Console 日志

---

### 测试 3: ImitationMode（模仿模式）

**测试目标**: 验证详细评分功能

**步骤**:
1. 导航到课程学习页面
2. 选择模仿模式
3. 播放标准音频
4. 录制自己的发音
5. 播放录音对比
6. 提交评分
7. 查看详细评分（准确度、流畅度、完整度）

**预期结果**:
- ✅ 标准音频播放正常
- ✅ 录音和回放正常
- ✅ 显示三项详细评分
- ✅ 显示总分
- ✅ 评分合理（不是随机数）

**如果失败**:
- 检查 ASR API 的 ScoreDetail 接口实现
- 确认后端返回了 accuracy、fluency、completeness 字段

---

## 🐛 常见问题排查

### 问题 1: 音频无法播放

**症状**: 点击播放按钮无反应

**排查步骤**:
1. 打开浏览器开发者工具 (F12)
2. 切换到 Network 标签
3. 点击播放按钮
4. 查看是否有请求发送到 `/api/tts/generate`

**可能原因**:
- API 服务未启动
- 端口号错误
- CORS 跨域问题

**解决方案**:
```javascript
// 在后端添加 CORS 配置
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.header('Access-Control-Allow-Headers', 'Content-Type')
  next()
})
```

---

### 问题 2: 录音失败

**症状**: 点击录音按钮后提示"无法启动录音"

**排查步骤**:
1. 检查浏览器地址栏是否有麦克风图标
2. 确认是否授予了麦克风权限

**解决方案**:
- Chrome: 设置 → 隐私和安全 → 网站设置 → 麦克风
- 确保当前网站有麦克风权限

---

### 问题 3: 评分返回 null 或错误

**症状**: 提交评分后显示"评分失败"

**排查步骤**:
1. 打开 Console 查看错误信息
2. 查看 Network 标签中的 `/api/asr/recognize` 请求
3. 检查请求参数和响应内容

**可能原因**:
- 后端未实现评分功能
- 返回的数据格式不匹配
- 音频格式不支持

**临时解决方案**:
系统已内置降级方案，如果 API 失败会使用默认分数（70分）

---

### 问题 4: 音频格式不支持

**症状**: 后端报错"不支持的音频格式"

**解决方案**:
确保后端支持 WebM 格式（浏览器录音默认格式）

```javascript
// 后端处理 WebM
const formidable = require('formidable')
const form = formidable({ multiples: false })
form.parse(req, (err, fields, files) => {
  const audioFile = files.audio
  // 处理 .webm 文件
})
```

---

## 📊 测试报告模板

完成测试后填写以下表格：

| 测试项 | 状态 | 备注 |
|-------|------|------|
| TTS API 连接 | ⏳ 待测试 | |
| TTS 音频播放 | ⏳ 待测试 | |
| 录音功能 | ⏳ 待测试 | |
| ASR API 连接 | ⏳ 待测试 | |
| 基础评分 | ⏳ 待测试 | |
| 详细评分 | ⏳ 待测试 | |
| 错误处理 | ⏳ 待测试 | |

**状态说明**:
- ✅ 通过
- ❌ 失败
- ⏳ 待测试
- ⚠️ 部分通过

---

## 🔍 调试技巧

### 1. 查看 API 请求

打开开发者工具 → Network → Filter by XHR/Fetch

检查以下请求:
- `/api/tts/generate` - TTS 请求
- `/api/asr/recognize` - ASR 请求

### 2. 查看 Console 日志

服务内部有详细日志输出：

```
[TTS] 正在生成语音...
[TTS] 生成成功，时长: 2.5s
[ASR] 正在识别...
[ASR] 识别结果: "Hello world", 置信度: 0.95
```

### 3. 检查缓存

TTS 有缓存机制，相同文本会复用：

```javascript
// 在 Console 中查看缓存状态
console.log(ttsApiService.getCacheInfo())
```

### 4. 手动测试 API

使用 curl 或 Postman 直接测试 API：

```bash
# 测试 TTS
curl -X POST http://127.0.0.1:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{"text":"Hello","language":"en"}'

# 测试 ASR
curl -X POST http://127.0.0.1:3000/api/asr/recognize \
  -F "audio=@recording.webm" \
  -F "language=en" \
  -F "referenceText=Hello world" \
  -F "enableScore=true"
```

---

## 📞 需要帮助？

如果测试过程中遇到问题：

1. **检查文档**: 参考 `docs/TTS_ASR_INTEGRATION_GUIDE.md`
2. **查看源码**: `vue-app/src/shared/services/`
3. **联系开发**: 前端团队 / 后端团队

---

**文档版本**: v1.0  
**创建日期**: 2026-01-06  
**最后更新**: 2026-01-06
