/**
 * 应用主组件
 * 阶段性迁移:左侧导航栏 + 右侧内容区布局
 */
import React, { useState, useEffect } from 'react';
import Navigation from '@/ui/components/Navigation';
import HomePage from '@/ui/pages/home/HomePage';
import CoursesPage from '@/ui/pages/courses/CoursesPage';
import TypingGamePage from '@/ui/pages/typing/TypingGamePage';
import PinyinPracticePage from '@/ui/pages/pinyin/PinyinPracticePage';
import GameCenterPage from '@/ui/pages/games/GameCenterPage';
import ReviewPage from '@/ui/pages/review/ReviewPage';
import FollowAlongPracticePage from '@/ui/pages/courses/FollowAlongPracticePage';
import EnhancedFollowAlongPracticePage from '@/ui/pages/courses/EnhancedFollowAlongPracticePage';
import HistoryPage from '@/ui/pages/history/HistoryPage';
import AILabPage from '@/ui/pages/ailab/AILabPage';
import SettingsPage from '@/ui/pages/settings/SettingsPage';
import { MigrationPage } from '@/ui/pages/migration/MigrationPage';
import { getThemeManager } from '@/app/ThemeManager';
import { getAudioSettingsService } from '@/infrastructure/audio/settings';
import { initializePaths } from '@/app/PathManager';

function App() {
  const [currentPage, setCurrentPage] = useState<string>('home');
  const [pathsInitialized, setPathsInitialized] = useState<boolean>(false);
  const [practiceData, setPracticeData] = useState<{courseId: string} | null>(null);

  // 应用启动时初始化路径管理器和主题设置
  useEffect(() => {
    const initialize = async () => {
      // 1. 初始化路径管理器
      try {
        await initializePaths();
        console.log('[App] PathManager initialized');
        setPathsInitialized(true);
      } catch (error) {
        console.error('[App] Failed to initialize PathManager:', error);
        // 降级: 即使路径初始化失败,也允许应用继续运行
        setPathsInitialized(true);
      }

      // 2. 加载并应用主题设置
      const themeManager = getThemeManager();
      const settingsService = getAudioSettingsService();
      
      try {
        const generalConfig = settingsService.getGeneralConfig();
        themeManager.applyGeneralSettings(generalConfig);
        console.log('[App] Initial theme settings applied:', generalConfig);
      } catch (error) {
        console.error('[App] Failed to apply initial theme settings:', error);
      }
    };

    initialize();
  }, []);

  const handleNavigate = (page: string, data?: any) => {
    console.log('导航到:', page, data);
    setCurrentPage(page);
    if (data) {
      setPracticeData(data);
    }
  };

  // 路径初始化前显示加载状态
  if (!pathsInitialized) {
    return React.createElement('div', {
      className: 'h-screen flex items-center justify-center bg-white dark:bg-gray-900'
    },
      React.createElement('div', {
        className: 'text-center'
      },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4'
        }),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '正在初始化...')
      )
    );
  }

  // 渲染右侧内容区
  const renderContent = () => {
    switch (currentPage) {
      case 'home':
        return React.createElement(HomePage, { onNavigate: handleNavigate });
      
      case 'courses':
        return React.createElement(CoursesPage, { 
          onBack: () => handleNavigate('home'),
          onNavigate: handleNavigate
        });
      
      case 'typing':
        return React.createElement(TypingGamePage, { 
          onBack: () => handleNavigate('home'),
          practiceType: 'fingerPractice',
          difficulty: 'beginner'
        });
      
      case 'pinyin':
        return React.createElement(PinyinPracticePage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'follow-along-practice':
        return React.createElement(FollowAlongPracticePage, {
          courseId: practiceData?.courseId || '',
          onBack: () => handleNavigate('courses')
        });
      
      case 'enhanced-follow-along-practice':
        return React.createElement(EnhancedFollowAlongPracticePage, {
          courseId: practiceData?.courseId || '',
          onBack: () => handleNavigate('courses')
        });
      
      case 'games':
        return React.createElement(GameCenterPage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'review':
        return React.createElement(ReviewPage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'history':
        return React.createElement(HistoryPage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'ai':
        return React.createElement(AILabPage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'settings':
        return React.createElement(SettingsPage, { 
          onBack: () => handleNavigate('home')
        });
      
      case 'migration':
        return React.createElement(MigrationPage, {});
      
      default:
        // 未迁移的功能显示占位页面
        return React.createElement('div', {
            className: 'min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-8'
          },
            React.createElement('div', {
              className: 'text-center'
            },
              React.createElement('h1', {
                className: 'text-4xl font-bold mb-4 text-gray-900 dark:text-white'
              }, `${currentPage} 功能`),
              React.createElement('p', {
                className: 'text-gray-600 dark:text-gray-400 mb-6'
              }, '该功能正在迁移中...'),
              React.createElement('button', {
                className: 'px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors',
                onClick: () => handleNavigate('home')
              }, '返回首页')
            )
          );
    }
  };

  return React.createElement('div', {
    className: 'flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900'
  },
    // 左侧导航栏
    React.createElement(Navigation, {
      current: currentPage,
      onChange: handleNavigate
    }),
    
    // 右侧内容区
    React.createElement('div', {
      className: 'flex-1 overflow-y-auto'
    }, renderContent())
  );
}

export default App;

