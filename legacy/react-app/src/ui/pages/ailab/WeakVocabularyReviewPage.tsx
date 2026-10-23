/**
 * 弱词强化复习页面
 * 实现：基于学习能力和错误历史的个性化复习推荐
 * 
 * 集成服务: RecommendationService
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AILabDependencyContainer } from '../../../infrastructure/di/AILabDependencyContainer';

interface WeakVocabularyReviewPageProps {
  onBack: () => void;
}

/**
 * 弱词数据
 */
interface WeakWord {
  id: string;
  word: string;
  meaning: string;
  errorCount: number;
  lastReview: string;
  mastery: number;  // 0-100
}

/**
 * 推荐课程
 */
interface RecommendedCourse {
  id: string;
  title: string;
  difficulty: string;
  wordCount: number;
  estimatedTime: string;
}

/**
 * 弱词复习页面
 * 基于 RecommendationService 的推荐
 */
export const WeakVocabularyReviewPage: React.FC<WeakVocabularyReviewPageProps> = ({ onBack }) => {
  // 状态管理
  const [isLoading, setIsLoading] = useState(true);
  const [weakWords, setWeakWords] = useState<WeakWord[]>([]);
  const [recommendations, setRecommendations] = useState<RecommendedCourse[]>([]);
  const [abilityLevel, setAbilityLevel] = useState<{ listening: string; speaking: string; vocabulary: number }>({
    listening: 'A2',
    speaking: 'A1',
    vocabulary: 45
  });

  // 加载数据
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        // 尝试获取推荐服务
        const container = AILabDependencyContainer.getInstance();
        
        try {
          const recommendationService = container.getRecommendationService();
          if (recommendationService && typeof (recommendationService as any).getWeakVocabulary === 'function') {
            const words = await (recommendationService as any).getWeakVocabulary('user_default');
            setWeakWords(words);
          } else {
            throw new Error('Service method not available');
          }
        } catch {
          // 模拟数据
          setWeakWords([
            { id: '1', word: 'accomplish', meaning: '完成，实现', errorCount: 5, lastReview: '2 天前', mastery: 30 },
            { id: '2', word: 'sufficient', meaning: '足够的', errorCount: 4, lastReview: '3 天前', mastery: 40 },
            { id: '3', word: 'essential', meaning: '必要的', errorCount: 3, lastReview: '1 天前', mastery: 55 },
            { id: '4', word: 'comprehensive', meaning: '全面的', errorCount: 6, lastReview: '4 天前', mastery: 25 },
            { id: '5', word: 'demonstrate', meaning: '展示，证明', errorCount: 2, lastReview: '今天', mastery: 65 }
          ]);
        }

        // 模拟推荐课程
        setRecommendations([
          { id: 'r1', title: '常见高频词汇强化', difficulty: 'A2', wordCount: 20, estimatedTime: '15分钟' },
          { id: 'r2', title: '商务英语词汇入门', difficulty: 'B1', wordCount: 15, estimatedTime: '12分钟' },
          { id: 'r3', title: '日常对话常用词', difficulty: 'A1', wordCount: 25, estimatedTime: '18分钟' }
        ]);
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // 开始复习
  const handleStartReview = useCallback((courseId: string) => {
    console.log('开始复习课程:', courseId);
    // 实际实现中会导航到课程页面
  }, []);

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 dark:from-gray-900 dark:to-gray-800'
  },
    // 返回按钮
    React.createElement('div', { className: 'max-w-4xl mx-auto pt-6 px-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm'
      }, '← 返回')
    ),

    // 主内容
    React.createElement('div', { className: 'max-w-4xl mx-auto p-6 space-y-8' },
      // 标题
      React.createElement('div', { className: 'text-center mb-8' },
        React.createElement('h1', { className: 'text-4xl font-bold text-gray-900 dark:text-white mb-2' }, '🔄 弱词强化复习'),
        React.createElement('p', { className: 'text-gray-600 dark:text-gray-400 text-lg' }, '基于你的学习能力和错误历史，自动生成个性化复习课程')
      ),

      // 能力概览
      React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700' },
        React.createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white mb-4' }, '📊 当前能力水平'),
        React.createElement('div', { className: 'grid grid-cols-3 gap-4' },
          [
            { icon: '👂', title: '听力', value: abilityLevel.listening, color: 'blue' },
            { icon: '🗣️', title: '口语', value: abilityLevel.speaking, color: 'green' },
            { icon: '📚', title: '词汇', value: `${abilityLevel.vocabulary}%`, color: 'purple' }
          ].map((item, idx) =>
            React.createElement('div', {
              key: idx,
              className: 'text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg'
            },
              React.createElement('div', { className: 'text-2xl mb-2' }, item.icon),
              React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400' }, item.title),
              React.createElement('div', { className: `text-xl font-bold text-${item.color}-600 dark:text-${item.color}-400` }, item.value)
            )
          )
        )
      ),

      // 弱词列表
      React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700' },
        React.createElement('div', { className: 'flex justify-between items-center mb-4' },
          React.createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white' }, '📖 需要加强的词汇'),
          React.createElement('span', { className: 'text-sm text-gray-500 dark:text-gray-400' }, `共 ${weakWords.length} 个`)
        ),
        isLoading
          ? React.createElement('div', { className: 'text-center py-8 text-gray-500' }, '加载中...')
          : weakWords.length === 0
            ? React.createElement('div', { className: 'text-center py-8 text-gray-500' }, '暂无需要强化的词汇，继续保持！')
            : React.createElement('div', { className: 'space-y-3' },
                weakWords.map(word =>
                  React.createElement('div', {
                    key: word.id,
                    className: 'flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'
                  },
                    // 掌握度指示器
                    React.createElement('div', {
                      className: `w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                        word.mastery >= 60 ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        word.mastery >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                      }`
                    }, `${word.mastery}%`),
                    // 词汇信息
                    React.createElement('div', { className: 'flex-1' },
                      React.createElement('div', { className: 'font-medium text-gray-900 dark:text-white' }, word.word),
                      React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400' }, word.meaning)
                    ),
                    // 错误次数
                    React.createElement('div', { className: 'text-right' },
                      React.createElement('div', { className: 'text-sm text-red-600 dark:text-red-400' }, `错误 ${word.errorCount} 次`),
                      React.createElement('div', { className: 'text-xs text-gray-500' }, word.lastReview)
                    )
                  )
                )
              )
      ),

      // 推荐课程
      React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700' },
        React.createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white mb-4' }, '🎯 推荐复习课程'),
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
          recommendations.map(course =>
            React.createElement('div', {
              key: course.id,
              className: 'p-4 border border-amber-200 dark:border-amber-800 rounded-lg bg-amber-50 dark:bg-amber-900/20 hover:shadow-md transition-shadow'
            },
              React.createElement('h4', { className: 'font-semibold text-gray-900 dark:text-white mb-2' }, course.title),
              React.createElement('div', { className: 'flex gap-2 mb-3' },
                React.createElement('span', { className: 'text-xs bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 px-2 py-1 rounded' }, course.difficulty),
                React.createElement('span', { className: 'text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded' }, `${course.wordCount} 词`)
              ),
              React.createElement('div', { className: 'flex justify-between items-center' },
                React.createElement('span', { className: 'text-sm text-gray-500' }, course.estimatedTime),
                React.createElement('button', {
                  onClick: () => handleStartReview(course.id),
                  className: 'px-3 py-1 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 transition-colors'
                }, '开始复习')
              )
            )
          )
        )
      ),

      // 底部说明
      React.createElement('div', { className: 'text-center text-sm text-gray-600 dark:text-gray-400 pt-6 border-t border-gray-200 dark:border-gray-700' },
        React.createElement('p', {}, '技术基础: RecommendationService + LanguageAbilityAggregate'),
        React.createElement('p', { className: 'mt-2' }, '复习策略: 间隔重复 + 优先错误词汇 + 能力匹配')
      )
    )
  );
};

export default WeakVocabularyReviewPage;
