# ui/ - 表现层

## 职责
用户界面展示、用户交互处理、页面组件组织。

## 子目录

### pages/ - 页面组件
按功能模块组织：

- **home/** - 首页模块
  - `HomePage.tsx` - 主页面

- **typing/** - 打字练习模块
  - `TypingGame.tsx` - 打字游戏

- **pinyin/** - 拼音练习模块
  - `PinyinPractice.tsx` - 拼音练习

- **games/** - 游戏中心模块
  - `GameCenter.tsx` - 游戏中心
  - `FlightGame.tsx` - 飞行游戏

- **ai/** - AI功能模块
  - `AILab.tsx` - AI实验室
  - `AITaskHistory.tsx` - 任务历史
  - `FreeWritingMode.tsx` - 自由写作

- **review/** - 复习管理模块
  - `ReviewManager.tsx` - 复习管理器

- **history/** - 历史记录模块
  - `HistoryPage.tsx` - 历史记录页
  - `HistoryCharts.tsx` - 历史图表

- **settings/** - 设置面板模块
  - `SettingsPanel.tsx` - 设置面板
  - `PromptSoundSettings.tsx` - 提示音设置
  - `TaskDashboard.tsx` - 任务看板

### components/ - 通用UI组件
可复用的展示组件：
- `Button.tsx`
- `Modal.tsx`
- `ErrorBoundary.tsx`
- `Navigation.tsx`

## 设计原则
1. **单一职责**：每个组件只负责一个功能
2. **可复用性**：通用组件放在components/
3. **props明确**：接口清晰，类型完整
4. **样式隔离**：使用Tailwind CSS，避免全局污染

## 组件示例

```typescript
// pages/home/HomePage.tsx
interface HomePageProps {
  onNavigate: (page: string) => void;
}

export const HomePage: React.FC<HomePageProps> = ({ onNavigate }) => {
  return <div>...</div>;
};
```
