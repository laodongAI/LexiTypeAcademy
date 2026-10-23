/**
 * 拼音练习页面
 * 提供拼音练习的难度选择和练习配置
 * DDD设计：UI层的专用页面组件，复用底层 TypingGame 逻辑
 */
import React, { useState } from 'react';
import TypingGamePage from '@/ui/pages/typing/TypingGamePage';
import { Difficulty, difficultyLabels } from '@/shared/constants/texts';

interface PinyinPracticePageProps {
  onBack: () => void;
}

export function PinyinPracticePage({ onBack }: PinyinPracticePageProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('beginner');
  const [isStarted, setIsStarted] = useState(false);

  // 如果已开始练习，渲染 TypingGamePage
  if (isStarted) {
    return React.createElement(TypingGamePage, {
      onBack: () => setIsStarted(false),
      practiceType: 'typingPractice',
      difficulty: selectedDifficulty
    });
  }

  // 难度选择界面
  const difficulties: Difficulty[] = ['beginner', 'intermediate', 'advanced'];
  
  const difficultyDescriptions: Record<Difficulty, string> = {
    beginner: '拼音基础、一二年级古诗',
    intermediate: '三四年级词汇和句子',
    advanced: '五六年级散文和名篇'
  };

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-8'
  },
    // 主内容区域
    React.createElement('div', {
      className: 'max-w-4xl mx-auto'
    },
      // 标题
      React.createElement('div', {
        className: 'text-center mb-12'
      },
        React.createElement('h1', {
          className: 'text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'
        }, '🔤 拼音练习'),
        React.createElement('p', {
          className: 'text-xl text-gray-600 dark:text-gray-400'
        }, '通过打字练习掌握汉语拼音和中文输入')
      ),

      // 难度选择卡片
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-8'
      },
        React.createElement('h2', {
          className: 'text-2xl font-bold text-gray-800 dark:text-white mb-6'
        }, '选择难度'),
        
        React.createElement('div', {
          className: 'grid grid-cols-1 md:grid-cols-3 gap-4'
        }, difficulties.map((difficulty) => 
          React.createElement('button', {
            key: difficulty,
            onClick: () => setSelectedDifficulty(difficulty),
            className: `p-6 rounded-xl border-2 transition-all ${
              selectedDifficulty === difficulty
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 shadow-lg scale-105'
                : 'border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-md'
            }`
          },
            React.createElement('div', {
              className: 'text-center'
            },
              React.createElement('div', {
                className: 'text-3xl mb-2'
              }, difficulty === 'beginner' ? '🌱' : difficulty === 'intermediate' ? '🌿' : '🌳'),
              React.createElement('h3', {
                className: `text-xl font-bold mb-2 ${
                  selectedDifficulty === difficulty
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-800 dark:text-white'
                }`
              }, difficultyLabels[difficulty]),
              React.createElement('p', {
                className: 'text-sm text-gray-600 dark:text-gray-400'
              }, difficultyDescriptions[difficulty])
            )
          )
        ))
      ),

      // 练习说明
      React.createElement('div', {
        className: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6 mb-8'
      },
        React.createElement('h3', {
          className: 'text-lg font-bold text-blue-800 dark:text-blue-300 mb-3'
        }, '📋 练习说明'),
        React.createElement('ul', {
          className: 'space-y-2 text-gray-700 dark:text-gray-300'
        },
          React.createElement('li', {}, '• 根据屏幕显示的拼音或文字进行输入'),
          React.createElement('li', {}, '• 系统会实时统计您的速度（WPM）和准确率'),
          React.createElement('li', {}, '• 按 Enter 键可以跳到下一题'),
          React.createElement('li', {}, '• 输入正确时会有语音提示（中文发音）')
        )
      ),

      // 开始按钮
      React.createElement('div', {
        className: 'text-center'
      },
        React.createElement('button', {
          onClick: () => setIsStarted(true),
          className: 'px-12 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xl font-bold rounded-xl shadow-lg hover:shadow-xl transition-all transform hover:scale-105'
        }, '开始练习 →')
      )
    )
  );
}

export default PinyinPracticePage;
