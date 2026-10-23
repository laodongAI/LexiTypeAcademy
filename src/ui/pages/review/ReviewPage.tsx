/**
 * 复习系统页面
 * DDD设计：UI层 - 表现层组件
 * 
 * 职责：
 * - 提供用户界面，展示复习统计和待复习单词
 * - 处理用户交互（输入、提交、切换模式）
 * - 调用 Domain 层服务完成业务逻辑
 * - 显示实时反馈和学习进度
 * 
 * 功能特性：
 * - 双模式支持：听写模式（默认）和闪卡模式
 * - 间隔重复算法：智能安排复习计划
 * - 实时统计：总数、已掌握、学习中、到期
 * - 来源筛选：支持按学习来源过滤单词
 * - 自动聚焦：提交后自动聚焦输入框
 */

import React, { useState, useEffect, useRef } from 'react';
import { createReviewService } from '@/domain/services/ReviewService';
import { createReviewRepository } from '@/infrastructure/persistence/ReviewRepository';
import { getTTSService } from '@/infrastructure/audio/tts';
import type { ReviewStats, DueWord } from '@/domain/models/ReviewModels';

interface ReviewPageProps {
  /** 返回上一页的回调函数 */
  onBack: () => void;
}

/**
 * 复习页面组件
 */
export function ReviewPage({ onBack }: ReviewPageProps) {
  // ========== 状态管理 ==========
  
  /** 复习统计数据 */
  const [stats, setStats] = useState<ReviewStats>({
    total: 0,
    mastered: 0,
    learning: 0,
    due: 0,
    bySource: {}
  });
  
  /** 待复习单词列表 */
  const [dueItems, setDueItems] = useState<DueWord[]>([]);
  
  /** 当前单词索引 */
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  
  /** 用户输入内容 */
  const [input, setInput] = useState('');
  
  /** 反馈状态：正确、错误或无 */
  const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
  
  /** 反馈详细信息（下次复习间隔） */
  const [feedbackInfo, setFeedbackInfo] = useState<{ interval: number } | null>(null);
  
  /** 选中的来源筛选 */
  const [selectedSource, setSelectedSource] = useState<string>('all');
  
  /** 闪卡模式开关 */
  const [flashcardMode, setFlashcardMode] = useState(false);
  
  /** 单词可见性（仅在闪卡模式下使用） */
  const [isWordVisible, setIsWordVisible] = useState(true);
  
  /** 输入框引用（用于自动聚焦） */
  const inputRef = useRef<HTMLInputElement>(null);
  
  // ========== 服务实例 ==========
  
  /** 复习服务实例（单例） */
  const reviewService = useRef(createReviewService(createReviewRepository())).current;
  
  // ========== 生命周期和副作用 ==========
  
  /**
   * 初始化和来源切换时刷新数据
   */
  useEffect(() => {
    refreshData();
  }, [selectedSource]);
  
  /**
   * 闪卡模式：显示2秒后隐藏单词
   */
  useEffect(() => {
    if (flashcardMode && dueItems.length > 0 && !showFeedback) {
      setIsWordVisible(true);
      const timer = setTimeout(() => {
        setIsWordVisible(false);
      }, 2000);
      return () => clearTimeout(timer);
    } else {
      setIsWordVisible(true);
    }
  }, [currentWordIndex, flashcardMode, dueItems, showFeedback]);
  
  // ========== 业务逻辑方法 ==========
  
  /**
   * 刷新统计数据和待复习单词列表
   */
  const refreshData = async () => {
    try {
      // 获取统计数据
      const statsData = await reviewService.getStats();
      setStats(statsData);
      
      // 获取待复习单词（最多20个）
      const sourceFilter = selectedSource === 'all' ? undefined : selectedSource;
      const words = await reviewService.getDueWords(20, sourceFilter);
      setDueItems(words);
      setCurrentWordIndex(0);
    } catch (error) {
      console.error('刷新数据失败:', error);
    }
  };
  
  /**
   * 处理表单提交（用户完成输入）
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dueItems.length === 0 || showFeedback) return;
    
    const currentItem = dueItems[currentWordIndex];
    const userAnswer = input.trim();
    const isCorrect = userAnswer === currentItem.word;
    
    try {
      // 记录复习结果（调用 Domain 服务）
      const result = await reviewService.recordResult(
        currentItem.word,
        isCorrect,
        currentItem.source
      );
      
      // 显示反馈
      setShowFeedback(isCorrect ? 'correct' : 'incorrect');
      setFeedbackInfo({ interval: result.interval });
      setIsWordVisible(true); // 显示正确答案
      
      // 如果正确，播放TTS语音
      if (isCorrect) {
        try {
          const ttsService = getTTSService();
          const lang = currentItem.source === 'pinyin' ? 'zh-CN' : 'en-US';
          const ttsResult = await ttsService.generate({ text: currentItem.word, lang });
          if (ttsResult.audioBlob) {
            const audioUrl = URL.createObjectURL(ttsResult.audioBlob);
            const audio = new Audio(audioUrl);
            audio.play().catch(console.error);
            audio.onended = () => URL.revokeObjectURL(audioUrl);
          }
        } catch (ttsError) {
          console.warn('[ReviewPage] TTS播放失败:', ttsError);
        }
      }
      
      // 记录到历史记录
      const api: any = (window as any).typingAPI;
      if (api?.addRecord) {
        api.addRecord({
          wpm: 0,
          accuracy: isCorrect ? 100 : 0,
          date: new Date().toISOString(),
          practiceType: 'review',
          difficulty: 'adaptive',
          word: currentItem.word,
          source: currentItem.source
        });
      }
      
      // 1.5秒后切换到下一个单词
      setTimeout(() => {
        setShowFeedback(null);
        setFeedbackInfo(null);
        setInput('');
        
        if (currentWordIndex < dueItems.length - 1) {
          setCurrentWordIndex(prev => prev + 1);
        } else {
          // 完成当前批次，刷新数据
          refreshData();
        }
        
        // 恢复输入焦点
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }, 1500);
    } catch (error) {
      console.error('记录复习结果失败:', error);
    }
  };
  
  /**
   * 添加测试单词（调试功能）
   */
  const addTestWords = async () => {
    const testWords = ['apple', 'banana', 'computer', 'algorithm', 'network'];
    for (const word of testWords) {
      await reviewService.recordResult(word, false, 'english');
    }
    refreshData();
  };
  
  // ========== 渲染逻辑 ==========
  
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-8'
  },
    React.createElement('div', {
      className: 'max-w-4xl mx-auto'
    },
      // 页面标题和副标题
      React.createElement('div', {
        className: 'text-center mb-8'
      },
        React.createElement('div', {
          className: 'flex items-center justify-center gap-3 mb-4'
        },
          React.createElement('span', {
            className: 'text-5xl'
          }, '🧠'),
          React.createElement('h1', {
            className: 'text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400'
          }, '智能复习系统')
        ),
        React.createElement('p', {
          className: 'text-xl text-gray-600 dark:text-gray-400 mb-6'
        }, '间隔重复算法 · 科学记忆 · 支持闪卡/听写双模式'),
        
        // 闪卡模式切换开关
        React.createElement('label', {
          className: 'inline-flex items-center cursor-pointer px-4 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow'
        },
          React.createElement('div', {
            className: 'relative mr-3'
          },
            React.createElement('input', {
              type: 'checkbox',
              className: 'sr-only',
              checked: flashcardMode,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFlashcardMode(e.target.checked)
            }),
            React.createElement('div', {
              className: `block w-14 h-8 rounded-full transition-colors ${flashcardMode ? 'bg-indigo-600' : 'bg-gray-400'}`
            }),
            React.createElement('div', {
              className: `absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${flashcardMode ? 'translate-x-6' : ''}`
            })
          ),
          React.createElement('span', {
            className: 'font-medium text-gray-700 dark:text-gray-200'
          }, flashcardMode ? '🎴 闪卡模式' : '✍️ 听写模式')
        )
      ),
      
      // 统计卡片
      React.createElement('div', {
        className: 'grid grid-cols-4 gap-4 mb-8'
      },
        // 总单词数
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center border-2 border-transparent hover:border-blue-300 dark:hover:border-blue-700 transition-colors'
        },
          React.createElement('div', {
            className: 'text-3xl font-bold text-blue-600 dark:text-blue-400'
          }, stats.total),
          React.createElement('div', {
            className: 'text-sm text-gray-500 dark:text-gray-400 mt-1'
          }, '总单词数')
        ),
        
        // 已掌握
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center border-2 border-transparent hover:border-green-300 dark:hover:border-green-700 transition-colors'
        },
          React.createElement('div', {
            className: 'text-3xl font-bold text-green-600 dark:text-green-400'
          }, stats.mastered),
          React.createElement('div', {
            className: 'text-sm text-gray-500 dark:text-gray-400 mt-1'
          }, '已掌握')
        ),
        
        // 学习中
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center border-2 border-transparent hover:border-yellow-300 dark:hover:border-yellow-700 transition-colors'
        },
          React.createElement('div', {
            className: 'text-3xl font-bold text-yellow-600 dark:text-yellow-400'
          }, stats.learning),
          React.createElement('div', {
            className: 'text-sm text-gray-500 dark:text-gray-400 mt-1'
          }, '学习中')
        ),
        
        // 待复习
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 p-4 rounded-xl shadow-md text-center border-2 border-transparent hover:border-red-300 dark:hover:border-red-700 transition-colors'
        },
          React.createElement('div', {
            className: 'text-3xl font-bold text-red-600 dark:text-red-400'
          }, stats.due),
          React.createElement('div', {
            className: 'text-sm text-gray-500 dark:text-gray-400 mt-1'
          }, '待复习')
        )
      ),
      
      // 来源筛选按钮组
      React.createElement('div', {
        className: 'flex justify-center gap-2 mb-8 flex-wrap'
      },
        React.createElement('button', {
          onClick: () => setSelectedSource('all'),
          className: `px-4 py-2 rounded-full text-sm font-medium transition-all ${
            selectedSource === 'all'
              ? 'bg-indigo-600 text-white shadow-lg scale-105'
              : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
          }`
        }, '全部来源'),
        
        // 按来源显示筛选按钮
        ...Object.keys(stats.bySource || {}).map(source =>
          React.createElement('button', {
            key: source,
            onClick: () => setSelectedSource(source),
            className: `px-4 py-2 rounded-full text-sm font-medium transition-all ${
              selectedSource === source
                ? 'bg-indigo-600 text-white shadow-lg scale-105'
                : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 shadow-sm'
            }`
          }, `${source.charAt(0).toUpperCase()}${source.slice(1)} (${stats.bySource[source]})`)
        )
      ),
      
      // 主内容区域：待复习单词或完成提示
      dueItems.length > 0
        ? renderReviewCard()
        : renderEmptyState()
    )
  );
  
  /**
   * 渲染复习卡片
   */
  function renderReviewCard() {
    if (dueItems.length === 0) return null;
    const currentItem = dueItems[currentWordIndex];
    
    return React.createElement('div', {
      className: 'bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-xl text-center max-w-2xl mx-auto'
    },
      // 进度提示
      React.createElement('div', {
        className: 'mb-4 text-gray-400 dark:text-gray-500 text-sm uppercase tracking-wide'
      },
        `进度: ${currentWordIndex + 1} / ${dueItems.length}`,
        React.createElement('span', {
          className: 'ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs'
        }, currentItem.source)
      ),
      
      // 单词显示区域
      React.createElement('div', {
        className: 'h-32 flex items-center justify-center mb-8'
      },
        isWordVisible
          ? React.createElement('h2', {
              className: 'text-6xl font-bold text-indigo-600 dark:text-indigo-400 animate-fade-in'
            }, currentItem.word)
          : React.createElement('div', {
              className: 'text-6xl text-gray-300 dark:text-gray-600'
            }, '? ? ?')
      ),
      
      // 输入表单
      React.createElement('form', {
        onSubmit: handleSubmit,
        className: 'max-w-md mx-auto'
      },
        React.createElement('input', {
          ref: inputRef,
          autoFocus: true,
          type: 'text',
          value: input,
          onChange: (e: React.ChangeEvent<HTMLInputElement>) => !showFeedback && setInput(e.target.value),
          className: `w-full text-center text-3xl bg-transparent border-b-4 focus:outline-none py-2 mb-6 transition-colors ${
            showFeedback === 'correct' ? 'border-green-500 text-green-600' :
            showFeedback === 'incorrect' ? 'border-red-500 text-red-600' :
            'border-gray-300 dark:border-gray-600 focus:border-indigo-500'
          } ${showFeedback ? 'opacity-70' : ''}`,
          placeholder: isWordVisible ? '请输入单词...' : '根据记忆输入单词...',
          autoComplete: 'off',
          disabled: !!showFeedback
        })
      ),
      
      // 反馈信息
      React.createElement('div', {
        className: 'h-8 mt-4'
      },
        showFeedback === 'correct' && React.createElement('div', {
          className: 'text-green-600 dark:text-green-400 font-bold text-xl flex items-center justify-center gap-2'
        },
          React.createElement('span', null, '✅ 正确！'),
          feedbackInfo && React.createElement('span', {
            className: 'text-sm font-normal text-green-500'
          }, `${feedbackInfo.interval}天后复习`)
        ),
        
        showFeedback === 'incorrect' && React.createElement('div', {
          className: 'text-red-600 dark:text-red-400 font-bold text-xl'
        }, `❌ 错误！正确答案是: ${currentItem.word}`)
      )
    );
  }
  
  /**
   * 渲染空状态（无待复习单词）
   */
  function renderEmptyState() {
    return React.createElement('div', {
      className: 'text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg'
    },
      React.createElement('div', {
        className: 'text-6xl mb-4'
      }, '🎉'),
      React.createElement('h3', {
        className: 'text-2xl font-bold text-gray-800 dark:text-white mb-4'
      }, '太棒了！'),
      React.createElement('p', {
        className: 'text-gray-500 dark:text-gray-400 mb-8'
      }, '暂无需要复习的单词，继续保持！'),
      React.createElement('button', {
        onClick: addTestWords,
        className: 'px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-full text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors'
      }, '📝 添加测试单词（调试）')
    );
  }
}

export default ReviewPage;
