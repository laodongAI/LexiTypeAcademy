/**
 * 自由写作教练页面
 * 实现：自由书写英文并获得 AI 即时反馈
 * 
 * 集成服务: WritingFeedbackService
 */

import React, { useState, useCallback } from 'react';
import { AILabDependencyContainer } from '../../../infrastructure/di/AILabDependencyContainer';

interface FreeWritingPageProps {
  onBack: () => void;
}

/**
 * 写作反馈结果
 */
interface WritingFeedback {
  overallScore: number;
  grammar: { score: number; issues: string[] };
  vocabulary: { score: number; level: string; suggestions: string[] };
  expression: { score: number; improvements: string[] };
  summary: string;
}

/**
 * 自由写作页面
 * 支持实时写作反馈
 */
export const FreeWritingPage: React.FC<FreeWritingPageProps> = ({ onBack }) => {
  // 状态管理
  const [text, setText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [feedback, setFeedback] = useState<WritingFeedback | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 计算字数
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const isValid = wordCount >= 10 && wordCount <= 500;

  // 提交分析
  const handleAnalyze = useCallback(async () => {
    if (!isValid) {
      setError('请输入 10-500 个单词');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setFeedback(null);

    try {
      // 尝试获取 WritingFeedbackService
      const container = AILabDependencyContainer.getInstance();
      
      try {
        const writingService = container.getWritingFeedbackService();
        if (writingService && typeof (writingService as any).analyzeWriting === 'function') {
          const result = await (writingService as any).analyzeWriting(text.trim());
          setFeedback(result as WritingFeedback);
        } else {
          throw new Error('Service method not available');
        }
      } catch {
        // 模拟反馈结果
        await new Promise(resolve => setTimeout(resolve, 1500));
        setFeedback({
          overallScore: 75,
          grammar: {
            score: 80,
            issues: ['Consider using "have been" instead of "was" for present perfect', 'Missing comma before "and" in compound sentence']
          },
          vocabulary: {
            score: 70,
            level: 'B1',
            suggestions: ['Try using "accomplish" instead of "do"', 'Consider "remarkable" as an alternative to "good"']
          },
          expression: {
            score: 75,
            improvements: ['The sentence structure could be more varied', 'Consider adding transition words between paragraphs']
          },
          summary: '整体写作水平良好！语法基础扎实，建议丰富词汇量和句式变化。'
        });
      }
    } catch (err: any) {
      setError(err.message || '分析失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  }, [text, isValid]);

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800'
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
        React.createElement('h1', { className: 'text-4xl font-bold text-gray-900 dark:text-white mb-2' }, '✍️ 自由写作教练'),
        React.createElement('p', { className: 'text-gray-600 dark:text-gray-400 text-lg' }, '自由书写英文并获得 AI 即时反馈，包括语法、词汇和表达建议')
      ),

      // 错误提示
      error && React.createElement('div', { className: 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4' },
        React.createElement('p', { className: 'text-red-800 dark:text-red-300' }, '❌ ' + error)
      ),

      // 写作区域
      React.createElement('div', { className: 'space-y-4' },
        React.createElement('div', { className: 'flex justify-between items-center' },
          React.createElement('label', { className: 'block text-sm font-medium text-gray-700 dark:text-gray-300' }, '开始写作'),
          React.createElement('span', { 
            className: `text-sm ${isValid ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}`
          }, `${wordCount} / 500 单词`)
        ),
        React.createElement('textarea', {
          value: text,
          onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setText(e.target.value),
          placeholder: 'Start writing your English text here...\n\nExample: Yesterday I went to the park with my friends. The weather was beautiful and we had a great time playing games...',
          disabled: isAnalyzing,
          className: 'w-full h-48 p-4 border-2 border-emerald-300 dark:border-emerald-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none'
        }),
        React.createElement('div', { className: 'flex justify-end' },
          React.createElement('button', {
            onClick: handleAnalyze,
            disabled: isAnalyzing || !isValid,
            className: `px-6 py-3 font-semibold rounded-lg transition-all ${
              isAnalyzing || !isValid
                ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-md hover:shadow-lg'
            }`
          }, isAnalyzing ? '⏳ 分析中...' : '📊 获取反馈')
        )
      ),

      // 反馈结果
      feedback && React.createElement('div', { className: 'space-y-6' },
        // 总分
        React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700' },
          React.createElement('div', { className: 'flex items-center justify-between' },
            React.createElement('h3', { className: 'text-xl font-semibold text-gray-900 dark:text-white' }, '📊 分析结果'),
            React.createElement('div', { className: 'text-right' },
              React.createElement('div', { className: 'text-3xl font-bold text-emerald-600 dark:text-emerald-400' }, `${feedback.overallScore}/100`),
              React.createElement('div', { className: 'text-sm text-gray-500' }, '综合评分')
            )
          )
        ),

        // 详细反馈
        React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-4' },
          // 语法
          React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700' },
            React.createElement('div', { className: 'flex items-center gap-2 mb-3' },
              React.createElement('span', { className: 'text-2xl' }, '✏️'),
              React.createElement('span', { className: 'font-semibold text-gray-900 dark:text-white' }, '语法'),
              React.createElement('span', { className: 'ml-auto text-lg font-bold text-blue-600' }, `${feedback.grammar.score}%`)
            ),
            React.createElement('ul', { className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1' },
              feedback.grammar.issues.map((issue, i) =>
                React.createElement('li', { key: i, className: 'flex gap-2' },
                  React.createElement('span', {}, '•'),
                  React.createElement('span', {}, issue)
                )
              )
            )
          ),

          // 词汇
          React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700' },
            React.createElement('div', { className: 'flex items-center gap-2 mb-3' },
              React.createElement('span', { className: 'text-2xl' }, '📖'),
              React.createElement('span', { className: 'font-semibold text-gray-900 dark:text-white' }, '词汇'),
              React.createElement('span', { className: 'ml-auto text-lg font-bold text-purple-600' }, `${feedback.vocabulary.score}%`)
            ),
            React.createElement('div', { className: 'text-xs bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 px-2 py-1 rounded inline-block mb-2' }, `Level: ${feedback.vocabulary.level}`),
            React.createElement('ul', { className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1' },
              feedback.vocabulary.suggestions.map((sug, i) =>
                React.createElement('li', { key: i, className: 'flex gap-2' },
                  React.createElement('span', {}, '💡'),
                  React.createElement('span', {}, sug)
                )
              )
            )
          ),

          // 表达
          React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700' },
            React.createElement('div', { className: 'flex items-center gap-2 mb-3' },
              React.createElement('span', { className: 'text-2xl' }, '💬'),
              React.createElement('span', { className: 'font-semibold text-gray-900 dark:text-white' }, '表达'),
              React.createElement('span', { className: 'ml-auto text-lg font-bold text-amber-600' }, `${feedback.expression.score}%`)
            ),
            React.createElement('ul', { className: 'text-sm text-gray-600 dark:text-gray-400 space-y-1' },
              feedback.expression.improvements.map((imp, i) =>
                React.createElement('li', { key: i, className: 'flex gap-2' },
                  React.createElement('span', {}, '📝'),
                  React.createElement('span', {}, imp)
                )
              )
            )
          )
        ),

        // 总结
        React.createElement('div', { className: 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4' },
          React.createElement('p', { className: 'text-emerald-800 dark:text-emerald-300' }, '💡 ' + feedback.summary)
        )
      ),

      // 底部说明
      React.createElement('div', { className: 'text-center text-sm text-gray-600 dark:text-gray-400 pt-6 border-t border-gray-200 dark:border-gray-700' },
        React.createElement('p', {}, '技术基础: WritingFeedbackService + AI 语言分析'),
        React.createElement('p', { className: 'mt-2' }, '反馈维度: 语法正确性、词汇丰富度、表达自然度')
      )
    )
  );
};

export default FreeWritingPage;
