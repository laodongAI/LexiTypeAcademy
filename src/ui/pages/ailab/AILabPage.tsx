/**
 * AI 实验室页面
 * 
 * 功能:
 * - AI 课程生成器
 * - 弱词复习生成
 * - 自由写作模式(待实现)
 * - 任务历史(待实现)
 * - PEP文本导入(待实现)
 * 
 * 注意: 当前为简化版本,主要实现 UI 框架
 * AI 服务依赖将在 Phase 10-11 迁移后补全
 */

import React, { useState } from 'react';
import AudioImportPage from './AudioImportPage';
import AICourseGeneratorPage from './AICourseGeneratorPage';
import WeakVocabularyReviewPage from './WeakVocabularyReviewPage';
import FreeWritingPage from './FreeWritingPage';
import TaskHistoryPage from './TaskHistoryPage';
import PublisherImportPage from './PublisherImportPage';

/** 组件 Props */
interface AILabPageProps {
  /** 返回首页回调 */
  onBack: () => void;
}

/** 子视图类型 */
type SubView = 'menu' | 'audio-import' | 'ai-generator' | 'review' | 'freewrite' | 'history' | 'pep';

/** 功能卡片配置 */
interface FeatureCard {
  id: string;
  icon: string;
  title: string;
  description: string;
  cta: string;
  accent: 'indigo' | 'amber' | 'emerald' | 'blue' | 'fuchsia';
  available: boolean;
}

/**
 * AI 实验室页面组件
 */
const AILabPage: React.FC<AILabPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [subView, setSubView] = useState<SubView>('menu');

  // ========== 功能卡片配置 ==========
  const featureCards: FeatureCard[] = [
    {
      id: 'audio-import',
      icon: '🎧',
      title: '音频导入课程',
      description: '上传音频文件,自动完成转写、分句、词汇提取与课程生成',
      cta: '打开导入',
      accent: 'indigo',
      available: true
    },
    {
      id: 'ai-generator',
      icon: '⚡',
      title: 'AI 生成课程',
      description: '基于主题和难度生成定制化打字练习课程、词汇列表和故事内容',
      cta: '打开生成器',
      accent: 'emerald',
      available: true
    },
    {
      id: 'pep',
      icon: '📚',
      title: '教材体系导入',
      description: '选择出版社教材,AI 自动解析单元并生成词汇、句子、音标课程',
      cta: '打开导入',
      accent: 'fuchsia',
      available: true
    },
    {
      id: 'review',
      icon: '🔄',
      title: '弱词强化复习',
      description: '基于你的错误历史和薄弱词汇自动生成个性化复习课程',
      cta: '开始复习',
      accent: 'amber',
      available: true
    },
    {
      id: 'freewrite',
      icon: '✍️',
      title: '自由写作教练',
      description: '自由书写英文并获得 AI 即时反馈,包括语法、词汇和表达建议',
      cta: '开始写作',
      accent: 'blue',
      available: true
    },
    {
      id: 'history',
      icon: '📜',
      title: '任务历史',
      description: '查看所有 AI 生成任务的历史记录和结果',
      cta: '查看历史',
      accent: 'blue',
      available: true
    }
  ];

  // ========== 渲染: 功能卡片 ==========
  const renderFeatureCard = (card: FeatureCard, onClick: () => void) => {
    const accentColors = {
      indigo: 'from-indigo-100 to-indigo-50 dark:from-indigo-900/30 dark:to-indigo-800/20',
      amber: 'from-amber-100 to-amber-50 dark:from-amber-900/30 dark:to-amber-800/20',
      emerald: 'from-emerald-100 to-emerald-50 dark:from-emerald-900/30 dark:to-emerald-800/20',
      blue: 'from-blue-100 to-blue-50 dark:from-blue-900/30 dark:to-blue-800/20',
      fuchsia: 'from-fuchsia-100 to-fuchsia-50 dark:from-fuchsia-900/30 dark:to-fuchsia-800/20'
    };

    const borderColors = {
      indigo: 'border-indigo-200 dark:border-indigo-700',
      amber: 'border-amber-200 dark:border-amber-700',
      emerald: 'border-emerald-200 dark:border-emerald-700',
      blue: 'border-blue-200 dark:border-blue-700',
      fuchsia: 'border-fuchsia-200 dark:border-fuchsia-700'
    };

    return React.createElement('div', {
      key: card.id,
      className: `relative bg-gradient-to-br ${accentColors[card.accent]} p-6 rounded-2xl shadow-lg border ${borderColors[card.accent]} transition-all transform hover:scale-105 ${card.available ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`
    },
      // 不可用标签
      !card.available && React.createElement('div', {
        className: 'absolute top-2 right-2 px-2 py-1 bg-gray-500 text-white text-xs rounded-full'
      }, '开发中'),

      // 图标和标题
      React.createElement('div', { className: 'flex items-center gap-3 mb-3' },
        React.createElement('span', { className: 'text-4xl' }, card.icon),
        React.createElement('h3', { className: 'text-xl font-bold text-gray-800 dark:text-white' }, card.title)
      ),

      // 描述
      React.createElement('p', { className: 'text-gray-700 dark:text-gray-300 mb-4 text-sm leading-relaxed' }, card.description),

      // 按钮
      React.createElement('button', {
        onClick: onClick,
        disabled: !card.available,
        className: `w-full px-4 py-2 bg-white/80 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-white dark:hover:bg-gray-800 transition-colors text-sm font-medium ${!card.available ? 'cursor-not-allowed' : ''}`
      }, card.cta)
    );
  };

  // ========== 渲染: 主菜单 ==========
  const renderMenu = () => {
    return React.createElement('div', { className: 'max-w-6xl mx-auto p-6 pt-10 space-y-8' },
      // 页头
      React.createElement('div', { className: 'text-center mb-12' },
        React.createElement('div', { className: 'flex items-center justify-center gap-3 mb-4' },
          React.createElement('span', { className: 'text-5xl' }, '🤖'),
          React.createElement('h1', { className: 'text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400' }, 'AI 实验室')
        ),
        React.createElement('p', { className: 'text-xl text-gray-600 dark:text-gray-400' }, '利用 AI 技术生成个性化学习内容')
      ),

      // 功能卡片网格
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' },
        ...featureCards.map(card => {
          const handleCardClick = () => {
            setSubView(card.id as SubView);
          };
          
          return renderFeatureCard(card, handleCardClick);
        })
      ),

      // 提示信息
      React.createElement('div', { className: 'mt-12 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-6 text-center' },
        React.createElement('p', { className: 'text-green-800 dark:text-green-300 mb-2' }, '✅ AI 功能已就绪'),
        React.createElement('p', { className: 'text-green-600 dark:text-green-400 text-sm' }, 
          'Phase 11 服务迁移完成，所有 AI 功能均可正常使用'
        )
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', { className: 'min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800' },
    // 返回按钮(仅在菜单页显示)
    subView === 'menu' && React.createElement('div', { className: 'max-w-6xl mx-auto pt-6 px-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm'
      }, '← 返回首页')
    ),

    // 内容区域
    subView === 'menu' && renderMenu(),
    subView === 'audio-import' && React.createElement(AudioImportPage, { onBack: () => setSubView('menu') }),
    subView === 'ai-generator' && React.createElement(AICourseGeneratorPage, { onBack: () => setSubView('menu') }),
    subView === 'review' && React.createElement(WeakVocabularyReviewPage, { onBack: () => setSubView('menu') }),
    subView === 'freewrite' && React.createElement(FreeWritingPage, { onBack: () => setSubView('menu') }),
    subView === 'history' && React.createElement(TaskHistoryPage, { onBack: () => setSubView('menu') }),
    subView === 'pep' && React.createElement(PublisherImportPage, { onBack: () => setSubView('menu') })
  );
};

export default AILabPage;
