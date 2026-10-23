/**
 * 跟读练习页面（增强版）
 * 
 * 功能流程（基于需求文档 v0.4.0 - 第3.3.3节）：
 * 1. 显示句子（英文+音标+翻译隐藏）
 * 2. 播放示范音频（标准发音）
 * 3. 示范音播完后自动开始录音（无需点击）
 * 4. 自动判断录音结束（3秒无声自动停止）
 * 5. 检查有效性：
 *    - 有效声音 → 进入评测
 *    - 无声或极低音量 → 触发重试（最多3次）
 * 6. 评估中（loading 动画）
 * 7. 结果反馈（得分、错误高亮）
 * 8. 自动推进下一句或提示重试
 * 
 * 新增特性：
 * - 自动录音开始/停止
 * - 无声检测与重试机制
 * - 实时音量显示
 * - 错误自动生成补救课程
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecordingService } from '@/domain/services/AudioRecordingService';
import { RemediationCourseService, ErrorType, type ErrorRecord } from '@/domain/services/RemediationCourseService';
import { useFollowAlongRecordingPlayback } from '@/app/hooks/useFollowAlongRecordingPlayback';

interface FollowAlongPracticePageProps {
  courseId: string;
  onBack: () => void;
}

interface Sentence {
  id: string;
  text: string;
  phonetic?: string;
  translation?: string;
  audioUrl?: string;
}

interface EvaluationResult {
  score: number;
  accuracy: number;
  fluency: number;
  pronunciation: number;
  errorWords: string[];
  feedback: string;
}

/**
 * 跟读练习页面组件
 */
const FollowAlongPracticePage: React.FC<FollowAlongPracticePageProps> = ({ courseId, onBack }) => {
  // ========== 状态管理 ==========
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showTranslation, setShowTranslation] = useState(false);
  const [isPlayingReference, setIsPlayingReference] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentSentence = sentences[currentIndex];

  // ========== 模拟 ASR 评测 ==========
  const mockEvaluateAudio = async (audioBlob: Blob): Promise<void> => {
    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 模拟评测结果
    const mockScore = Math.floor(Math.random() * 30) + 70; // 70-100
    const mockResult: EvaluationResult = {
      score: mockScore,
      accuracy: mockScore + Math.floor(Math.random() * 10) - 5,
      fluency: mockScore + Math.floor(Math.random() * 10) - 5,
      pronunciation: mockScore + Math.floor(Math.random() * 10) - 5,
      errorWords: mockScore < 85 ? ['example', 'word'] : [],
      feedback: mockScore >= 90 ? '发音非常棒！' :
                mockScore >= 80 ? '发音不错，继续加油！' :
                '需要多加练习哦~'
    };

    setEvaluationResult(mockResult);
  };

  // ========== 使用跟读录音回放 Hook ==========
  const recordingPlayback = useFollowAlongRecordingPlayback({
    autoPlayAfterRecording: true,
    onEvaluationRequired: mockEvaluateAudio,
    onRecordingComplete: (blob) => {
      console.log('[FollowAlong] 录音完成，大小:', blob.size);
    },
    onError: (error) => {
      console.error('[FollowAlong] 错误:', error);
      alert('发生错误: ' + error.message);
    }
  });

  // ========== 加载课程数据 ==========
  useEffect(() => {
    const loadCourse = async () => {
      try {
        // 从数据库加载真实课程数据
        const { LexiTypeDB } = await import('@/infrastructure/versioning/db');
        const db = new LexiTypeDB();
        const course = await db.courses.get(courseId);
        
        if (!course) {
          console.error('[FollowAlong] 课程不存在:', courseId);
          alert('课程不存在');
          onBack();
          return;
        }

        console.log('[FollowAlong] 加载课程:', course.title, '课时数:', course.lessons?.length);

        // 将课程的 lessons 转换为 Sentence 格式
        if (course.lessons && course.lessons.length > 0) {
          const sentenceList: Sentence[] = course.lessons.map((lesson: any) => ({
            id: lesson.id || Math.random().toString(36).slice(2),
            text: lesson.content || '',
            phonetic: lesson.phonetic,
            translation: lesson.contentTranslation || lesson.translation,
            audioUrl: lesson.audioUrl
          }));

          console.log('[FollowAlong] 转换后的句子列表:', sentenceList.length, '条');
          setSentences(sentenceList);
        } else {
          console.warn('[FollowAlong] 课程没有课时数据');
          alert('该课程暂无练习内容');
          onBack();
          return;
        }

        setIsLoading(false);
      } catch (error) {
        console.error('[FollowAlong] 加载课程失败:', error);
        alert('加载课程失败: ' + (error as Error).message);
        setIsLoading(false);
      }
    };

    loadCourse();
  }, [courseId, onBack]);

  // ========== 播放示范音频 ==========
  const playReferenceAudio = useCallback(() => {
    if (!currentSentence) return;

    setIsPlayingReference(true);

    // TODO: 播放真实的 TTS 音频
    // 模拟播放
    setTimeout(() => {
      setIsPlayingReference(false);
    }, 2000);
  }, [currentSentence]);

  // ========== 下一句 ==========
  const handleNext = useCallback(() => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setEvaluationResult(null);
      setShowTranslation(false);
    } else {
      // 完成所有句子
      alert('恭喜完成所有练习！');
      onBack();
    }
  }, [currentIndex, sentences.length, onBack]);

  // ========== 重试 ==========
  const handleRetry = useCallback(() => {
    setEvaluationResult(null);
  }, []);

  // ========== 跳过回放直接评测 ==========
  const handleSkipPlayback = useCallback(() => {
    if (recordingPlayback.state.audioBlob) {
      recordingPlayback.skipPlayback();
    }
  }, [recordingPlayback]);

  // ========== 渲染: Loading ==========
  if (isLoading) {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center'
    },
      React.createElement('div', {
        className: 'text-center'
      },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-12 w-12 border-4 border-indigo-600 border-t-transparent mx-auto mb-4'
        }),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '加载课程中...')
      )
    );
  }

  if (sentences.length === 0) {
    return React.createElement('div', {
      className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center'
    },
      React.createElement('div', {
        className: 'text-center'
      },
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400 mb-4'
        }, '没有找到练习内容'),
        React.createElement('button', {
          onClick: onBack,
          className: 'px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
        }, '返回')
      )
    );
  }

  // ========== 主界面渲染 ==========
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800'
  },
    // 顶部导航栏
    React.createElement('div', {
      className: 'bg-white dark:bg-gray-800 shadow-sm border-b dark:border-gray-700'
    },
      React.createElement('div', {
        className: 'max-w-4xl mx-auto px-6 py-4 flex items-center justify-between'
      },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors'
        }, '← 返回'),
        React.createElement('h1', {
          className: 'text-lg font-semibold text-gray-900 dark:text-white'
        }, '🎯 跟读练习'),
        React.createElement('div', {
          className: 'text-sm text-gray-600 dark:text-gray-400'
        }, `${currentIndex + 1} / ${sentences.length}`)
      )
    ),

    // 主内容区
    React.createElement('div', {
      className: 'max-w-4xl mx-auto px-6 py-8'
    },
      // 进度条
      React.createElement('div', {
        className: 'mb-8'
      },
        React.createElement('div', {
          className: 'h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'
        },
          React.createElement('div', {
            className: 'h-full bg-indigo-600 transition-all duration-300',
            style: { width: `${((currentIndex + 1) / sentences.length) * 100}%` }
          })
        )
      ),

      // 句子卡片
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 mb-6'
      },
        // 英文句子
        React.createElement('div', {
          className: 'text-center mb-6'
        },
          React.createElement('p', {
            className: 'text-3xl font-semibold text-gray-900 dark:text-white mb-4'
          }, currentSentence.text),
          currentSentence.phonetic && React.createElement('p', {
            className: 'text-lg text-indigo-600 dark:text-indigo-400 font-mono'
          }, currentSentence.phonetic)
        ),

        // 翻译（可切换）
        React.createElement('div', {
          className: 'text-center mb-6'
        },
          React.createElement('button', {
            onClick: () => setShowTranslation(!showTranslation),
            className: 'text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
          }, showTranslation ? '隐藏翻译' : '显示翻译'),
          showTranslation && React.createElement('p', {
            className: 'mt-2 text-lg text-gray-600 dark:text-gray-300'
          }, currentSentence.translation)
        ),

        // 播放示范音频按钮
        React.createElement('div', {
          className: 'flex justify-center mb-6'
        },
          React.createElement('button', {
            onClick: playReferenceAudio,
            disabled: isPlayingReference || recordingPlayback.state.isRecording,
            className: 'px-8 py-4 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-xl font-medium hover:bg-indigo-200 dark:hover:bg-indigo-900/50 disabled:opacity-50 transition-colors'
          },
            isPlayingReference ? '🔊 播放中...' : '🔊 听示范音'
          )
        ),

        // 录音状态显示
        recordingPlayback.state.phase !== 'idle' && React.createElement('div', {
          className: 'mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl'
        },
          // 录音中
          recordingPlayback.state.phase === 'recording' && React.createElement('div', {
            className: 'text-center'
          },
            React.createElement('div', {
              className: 'flex items-center justify-center gap-2 mb-2'
            },
              React.createElement('div', {
                className: 'w-3 h-3 bg-red-500 rounded-full animate-pulse'
              }),
              React.createElement('span', {
                className: 'text-red-600 dark:text-red-400 font-medium'
              }, '正在录音...')
            ),
            React.createElement('p', {
              className: 'text-sm text-gray-600 dark:text-gray-400'
            }, `已录 ${recordingPlayback.state.recordingDuration.toFixed(1)} 秒`)
          ),

          // 回放用户录音
          recordingPlayback.state.phase === 'playback' && React.createElement('div', {
            className: 'text-center'
          },
            React.createElement('div', {
              className: 'mb-2'
            },
              React.createElement('span', {
                className: 'text-blue-600 dark:text-blue-400 font-medium'
              }, '🎧 回放你的录音...')
            ),
            React.createElement('div', {
              className: 'w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2'
            },
              React.createElement('div', {
                className: 'bg-blue-600 h-2 rounded-full transition-all',
                style: { width: `${recordingPlayback.state.playbackProgress}%` }
              })
            ),
            React.createElement('div', {
              className: 'flex gap-2 justify-center mt-3'
            },
              recordingPlayback.state.canReplayUserRecording && React.createElement('button', {
                onClick: recordingPlayback.replayUserRecording,
                className: 'px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500'
              }, '🔁 重新听'),
              recordingPlayback.state.canSkipPlayback && React.createElement('button', {
                onClick: handleSkipPlayback,
                className: 'px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500'
              }, '⏭️ 不需要回放')
            )
          ),

          // 评测中
          recordingPlayback.state.phase === 'evaluating' && React.createElement('div', {
            className: 'text-center'
          },
            React.createElement('div', {
              className: 'animate-spin rounded-full h-8 w-8 border-4 border-indigo-600 border-t-transparent mx-auto mb-2'
            }),
            React.createElement('p', {
              className: 'text-indigo-600 dark:text-indigo-400 font-medium'
            }, '🤖 AI 正在评估中...')
          )
        ),

        // 评测结果
        evaluationResult && React.createElement('div', {
          className: 'mb-6 p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl border border-green-200 dark:border-green-800'
        },
          React.createElement('div', {
            className: 'text-center mb-4'
          },
            React.createElement('div', {
              className: 'text-5xl font-bold text-green-600 dark:text-green-400 mb-2'
            }, evaluationResult.score),
            React.createElement('p', {
              className: 'text-green-700 dark:text-green-300 font-medium'
            }, evaluationResult.feedback)
          ),
          React.createElement('div', {
            className: 'grid grid-cols-3 gap-4 text-center'
          },
            React.createElement('div', {},
              React.createElement('div', {
                className: 'text-2xl font-semibold text-gray-700 dark:text-gray-300'
              }, evaluationResult.accuracy),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '准确度')
            ),
            React.createElement('div', {},
              React.createElement('div', {
                className: 'text-2xl font-semibold text-gray-700 dark:text-gray-300'
              }, evaluationResult.fluency),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '流利度')
            ),
            React.createElement('div', {},
              React.createElement('div', {
                className: 'text-2xl font-semibold text-gray-700 dark:text-gray-300'
              }, evaluationResult.pronunciation),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '发音')
            )
          )
        ),

        // 操作按钮
        React.createElement('div', {
          className: 'flex gap-3 justify-center'
        },
          !evaluationResult && !recordingPlayback.state.isRecording && !isPlayingReference && (
            recordingPlayback.state.phase === 'idle' || recordingPlayback.state.phase === 'playback'
          ) && React.createElement('button', {
            onClick: recordingPlayback.startRecording,
            className: 'px-8 py-4 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors shadow-lg'
          }, '🎤 开始录音'),

          recordingPlayback.state.isRecording && React.createElement('button', {
            onClick: recordingPlayback.stopRecording,
            className: 'px-8 py-4 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 transition-colors'
          }, '⏹️ 停止录音'),

          evaluationResult && React.createElement(React.Fragment, null,
            evaluationResult.score < 80 && React.createElement('button', {
              onClick: handleRetry,
              className: 'px-6 py-3 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors'
            }, '🔄 再试一次'),
            React.createElement('button', {
              onClick: handleNext,
              className: 'px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors'
            }, currentIndex < sentences.length - 1 ? '下一句 →' : '完成练习')
          )
        )
      ),

      // 错误提示
      recordingPlayback.state.error && React.createElement('div', {
        className: 'p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg'
      }, recordingPlayback.state.error)
    )
  );
};

export default FollowAlongPracticePage;
