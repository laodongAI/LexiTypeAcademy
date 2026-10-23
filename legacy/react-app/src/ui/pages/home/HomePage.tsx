/**
 * 首页组件
 * 提供各功能模块的入口导航
 */
import React from 'react';

interface HomePageProps {
  onNavigate: (page: string) => void;
}

export function HomePage({ onNavigate }: HomePageProps) {
  const modules = [
    { id: 'typing', title: '指法练习', icon: '⌨️', description: '英文键盘打字练习' },
    { id: 'pinyin', title: '拼音练习', icon: '🔤', description: '汉语拼音和中文输入' },
    { id: 'games', title: '游戏中心', icon: '🎮', description: '在游戏中学习' },
    { id: 'ai', title: 'AI Lab', icon: '🤖', description: 'AI辅助学习工具' },
    { id: 'review', title: '复习管理', icon: '📚', description: '巩固学过的知识' },
    { id: 'history', title: '历史记录', icon: '📊', description: '查看学习统计' },
    { id: 'settings', title: '设置', icon: '⚙️', description: '个性化配置' },
  ];

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8'
  },
    // 标题
    React.createElement('div', {
      className: 'max-w-6xl mx-auto mb-12'
    },
      React.createElement('h1', {
        className: 'text-5xl font-bold text-center mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'
      }, 'LexiType Academy'),
      React.createElement('p', {
        className: 'text-center text-gray-600 dark:text-gray-400 text-lg'
      }, '智能英语学习平台 - 让学习更高效')
    ),
    
    // 功能卡片网格
    React.createElement('div', {
      className: 'max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
    },
      ...modules.map(module => 
        React.createElement('div', {
          key: module.id,
          className: 'bg-white dark:bg-gray-800 rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 p-6 cursor-pointer border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400',
          onClick: () => onNavigate(module.id)
        },
          React.createElement('div', {
            className: 'text-4xl mb-3'
          }, module.icon),
          React.createElement('h2', {
            className: 'text-2xl font-bold mb-2 text-gray-900 dark:text-white'
          }, module.title),
          React.createElement('p', {
            className: 'text-gray-600 dark:text-gray-400'
          }, module.description)
        )
      )
    )
  );
}

export default HomePage;
