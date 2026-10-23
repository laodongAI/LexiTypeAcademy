# Vue 版（vue-app）与老版本功能差异清单（可迁移点）

> 目的：明确“该在 vue-app 启动”和“老版本可借鉴/迁移哪些细节”。

## 1. 启动入口（已修正）

- 根目录默认 `npm run dev` 已代理到 `vue-app`。
- 老版本启动脚本已改为 `legacy:*`，避免误启动。

## 2. 游戏中心（差异最大，优先迁移）

### 老版本已有（React）

- 游戏注册/插件化：
  - src_bak/config/gamePlugins.ts
  - src_bak/services/pluginRegistry.ts（如存在）
- 7 个可玩游戏组件：
  - src_bak/components/games/FlightGame.tsx
  - src_bak/components/games/WordChallenge.tsx
  - src_bak/components/games/ComboGame.tsx
  - src_bak/components/games/DungeonTyper.tsx
  - src_bak/components/games/WordFarm.tsx
  - src_bak/components/games/TypingRacer.tsx
  - src_bak/components/games/RhythmKey.tsx

### vue-app 当前现状

- 入口页已有：vue-app/src/renderer/views/GamesPage.vue
- 已实现可玩的仅 2 个（之前已接入）：
  - KeyboardSpeedGame.vue
  - PinyinMatchGame.vue
- 其余卡片仍是“开发中”。

### 建议迁移顺序（按 ROI）

1) WordChallenge（60 秒单词挑战）
2) TypingRacer（竞速）
3) ComboGame（连击）
4) FlightGame / DungeonTyper / WordFarm / RhythmKey（后续）

## 3. 虚拟键盘（细节补齐）

### 老版本参考

- src_bak/components/Keyboard.tsx

### vue-app 当前

- vue-app/src/shared/components/VirtualKeyboard.vue（已迁移）
- 待对齐细节：
  - 指法/手指区域提示是否与老版一致
  - 特殊键位映射（Enter/Shift/Backspace/Space）统一
  - 组件在不同容器内的溢出/滚动策略（已部分处理）

## 4. AI 实验室（需对齐“核心链路”）

### 老版本参考

- src_bak/app/ai/
  - promptStrategy.ts
  - promptPipeline.ts
  - aiService.ts
  - aiDialogueService.ts

### vue-app 当前

- vue-app/src/renderer/views/AILabPage.vue（页面存在）

### 待确认/补齐

- 是否完整实现：prompt pipeline、参数化模板、失败重试、结果落库/导出
- 与课程系统的联动：生成课程 -> 写入课程库 -> 可在课程列表中使用

## 5. 复习系统（已修掉崩溃，但功能仍需对齐）

### 老版本参考

- i18n 文案/交互：src_bak/i18n/zh.json 中 review 相关 key

### vue-app 当前

- ReviewPage.vue 已从旧接口改为使用 reviewStore 的 dueWords/submitReview
- 已补齐：
  - 评分 1-4 → SM-2 quality(0-5) 映射（reviewService 增加 submitReviewWithQuality；ReviewPage 按 1-4 写入 quality）
  - 来源筛选（从 wordMasteryItems 的 source 索引去重得到来源列表）
  - 弱词列表 Top N UI（按掌握等级/连续正确排序）
- 仍待补齐：
  - 复习历史 UI（按单词或按天）

## 6. 课程练习模式（对齐老版的多模式）

- 老 README 描述了多种练习模式（听写/精抄/专注等）。
- vue-app 已有部分练习组件（practice/ 目录），但 typecheck 仍有缺口，需要对齐 AudioPlayer API。

---

## 下一步执行建议

- 优先：把 7 个游戏迁移到 vue-app（至少先做 1~2 个最有价值的）
- 已完成：AI Lab 生成预览 -> 手动保存为课程 -> 课程列表可见 -> 进入练习闭环（课程生成器 / 音频导入 / 教材文本导入 / 教材引导）
  - 教材引导（出版社→系列→教材→单元→生成）已迁移到 AILab 的“教材引导”Tab
  - 提示词：vue-app/src/shared/services/ai/prompts/textbookGuidance.ts
- 再补：复习系统的 1-4 评分与统计
