/**
 * 左侧导航栏组件
 * DDD设计：UI层通用组件
 * 支持收缩/展开，根据迁移进度动态显示可用功能
 */
import React, { useState } from 'react';

interface NavigationProps {
  current: string;
  onChange: (view: string) => void;
}

export function Navigation({ current, onChange }: NavigationProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 导航项配置（根据迁移进度动态显示）
  const navItems = [
    { 
      id: 'home', 
      label: '首页',
      icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
      enabled: true
    },
    { 
      id: 'courses', 
      label: '英语课程',
      icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
      enabled: true // Phase 11: 英语课程管理
    },
    { 
      id: 'typing', 
      label: '指法练习',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      enabled: true
    },
    { 
      id: 'pinyin', 
      label: '拼音练习',
      icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
      enabled: true
    },
    { 
      id: 'games', 
      label: '游戏中心',
      icon: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      enabled: true
    },
    { 
      id: 'review', 
      label: '复习系统',
      icon: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
      enabled: true // Phase 6 已完成迁移
    },
    { 
      id: 'history', 
      label: '历史记录',
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      enabled: true // Phase 7 已完成迁移
    },
    { 
      id: 'ai', 
      label: 'AI 实验室',
      icon: 'M13 10V3L4 14h7v7l9-11h-7z',
      enabled: true // Phase 8 已完成基础迁移
    },
    { 
      id: 'settings', 
      label: '设置',
      icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
      enabled: true // Phase 9 已完成基础迁移
    }
  ];

  return React.createElement('nav', {
    className: `${
      isCollapsed ? 'w-20' : 'w-64'
    } bg-white dark:bg-gray-800 shadow-lg h-screen flex flex-col flex-shrink-0 z-10 transition-all duration-300 ease-in-out relative`
  },
    // 收缩/展开按钮
    React.createElement('button', {
      onClick: () => setIsCollapsed(!isCollapsed),
      className: 'absolute -right-3 top-8 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-md hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors z-20'
    },
      React.createElement('svg', {
        className: `w-4 h-4 text-gray-600 dark:text-gray-300 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`,
        fill: 'none',
        stroke: 'currentColor',
        viewBox: '0 0 24 24'
      },
        React.createElement('path', {
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          strokeWidth: 2,
          d: 'M15 19l-7-7 7-7'
        })
      )
    ),

    // 顶部标题
    React.createElement('div', {
      className: `p-6 border-b dark:border-gray-700 flex items-center justify-center`
    },
      isCollapsed
        ? React.createElement('span', {
            className: 'text-2xl font-bold text-blue-600 dark:text-blue-400'
          }, 'L')
        : React.createElement('span', {
            className: 'text-2xl font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap'
          }, 'LexiType Academy')
    ),
    
    // 导航列表
    React.createElement('div', {
      className: 'flex-1 py-6 flex flex-col space-y-2 px-3 overflow-y-auto'
    }, navItems.map((item) =>
      React.createElement('button', {
        key: item.id,
        onClick: () => item.enabled && onChange(item.id),
        title: isCollapsed ? item.label : '',
        disabled: !item.enabled,
        className: `${
          current === item.id
            ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
            : item.enabled
            ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
            : 'text-gray-400 dark:text-gray-600 opacity-50 cursor-not-allowed'
        } group flex items-center ${isCollapsed ? 'justify-center px-2' : 'px-4'} py-3 text-base font-medium rounded-xl transition-all duration-200 w-full`
      },
        React.createElement('svg', {
          className: `w-6 h-6 ${current === item.id ? 'text-blue-600 dark:text-blue-400' : item.enabled ? 'text-gray-500 dark:text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300' : 'text-gray-400 dark:text-gray-600'}`,
          fill: 'none',
          stroke: 'currentColor',
          viewBox: '0 0 24 24'
        },
          React.createElement('path', {
            strokeLinecap: 'round',
            strokeLinejoin: 'round',
            strokeWidth: 2,
            d: item.icon
          })
        ),
        !isCollapsed && React.createElement('span', {
          className: 'ml-3 whitespace-nowrap overflow-hidden transition-opacity duration-200'
        }, item.label)
      )
    ))
  );
}

export default Navigation;

