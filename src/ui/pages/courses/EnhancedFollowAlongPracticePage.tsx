/**
 * 增强版跟读练习页面
 * 
 * 实现需求文档 v0.4.0 第3.3.3节的完整跟读流程：
 * - 自动录音开始/停止
 * - 无声检测与重试机制（最多3次）
 * - 实时音量显示
 * - 错误记录与补救课程生成
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AudioRecordingService, type RecordingResult } from '@/domain/services/AudioRecordingService';
import { RemediationCourseService, ErrorType, type ErrorRecord } from '@/domain/services/RemediationCourseService';

interface EnhancedFollowAlongPracticePageProps {
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
  completeness: number;
  feedback: string;
  errorWords: string[];
}

type RecordingState = 'idle' | 'playing_reference' | 'recording' | 'evaluating' | 'showing_result';

/**
 * 增强版跟读练习页面组件
 */
export const EnhancedFollowAlongPracticePage: React.FC<EnhancedFollowAlongPracticePageProps> = ({
  courseId,
  onBack
}) => {
  // ========== 状态管理 ==========
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [currentVolume, setCurrentVolume] = useState(0);
  const [evaluationResult, setEvaluationResult] = useState<EvaluationResult | null>(null);
  const [showTranslation, setShowTranslation] = useState(false);
  const [retryPrompt, setRetryPrompt] = useState<string | null>(null);
  const [errorRecords, setErrorRecords] = useState<ErrorRecord[]>([]);
  
  const audioServiceRef = useRef<AudioRecordingService | null>(null);
  const volumeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const remediationServiceRef = useRef(new RemediationCourseService());

  const currentSentence = sentences[currentIndex];

  // ========== 初始化录音服务 ==========
  useEffect(() => {
    const initAudioService = async () => {
      try {
        const service = new AudioRecordingService();
        await service.initialize();
        audioServiceRef.current = service;
        console.log('[EnhancedFollowAlong] 录音服务初始化成功');
      } catch (error) {
        console.error('[EnhancedFollowAlong] 录音服务初始化失败:', error);
        alert('无法访问麦克风，请检查权限设置');
      }
    };

    initAudioService();

    return () => {
      if (audioServiceRef.current) {
        audioServiceRef.current.dispose();
      }
      if (volumeIntervalRef.current) {
        clearInterval(volumeIntervalRef.current);
      }
    };
  }, []);

  // ========== 加载课程数据 ==========
  useEffect(() => {
    // TODO: 从数据库加载真实课程数据
    const mockSentences: Sentence[] = [
      {
        id: '1',
        text: 'Hello, how are you today?',
        phonetic: '/həˈloʊ, haʊ ɑːr juː təˈdeɪ/',
        translation: '你好，你今天怎么样？'
      },
      {
        id: '2',
        text: 'I am doing great, thank you!',
        phonetic: '/aɪ æm ˈduːɪŋ ɡreɪt, θæŋk juː/',
        translation: '我很好，谢谢！'
      },
      {
        id: '3',
        text: 'The weather is beautiful.',
        phonetic: '/ðə ˈweðər ɪz ˈbjuːtɪfəl/',
        translation: '天气很美。'
      }
    ];
    
    setSentences(mockSentences);
  }, [courseId]);

  // ========== 开始练习流程 ==========
  const startPracticeFlow = useCallback(async () => {
    if (!currentSentence || !audioServiceRef.current) return;

    // 步骤1: 播放示范音频
    setRecordingState('playing_reference');
    console.log('[Flow] 播放示范音频...');
    
    // TODO: 播放真实TTS音频
    await new Promise(resolve => setTimeout(resolve, 2000)); // 模拟播放

    // 步骤2: 自动开始录音
    setRecordingState('recording');
    console.log('[Flow] 自动开始录音...');
    
    try {
      await audioServiceRef.current.startRecording();
      
      // 启动实时音量显示
      volumeIntervalRef.current = setInterval(() => {
        if (audioServiceRef.current) {
          const volume = audioServiceRef.current.getCurrentVolume();
          setCurrentVolume(volume);
        }
      }, 100);
      
    } catch (error) {
      console.error('[Flow] 录音失败:', error);
      setRecordingState('idle');
    }
  }, [currentSentence]);

  // ========== 录音完成处理 ==========
  const handleRecordingComplete = useCallback(async (result: RecordingResult) => {
    // 停止音量显示
    if (volumeIntervalRef.current) {
      clearInterval(volumeIntervalRef.current);
      volumeIntervalRef.current = null;
    }
    setCurrentVolume(0);

    console.log('[Flow] 录音完成:', result);

    // 步骤3: 检查有效性
    if (!result.isValid) {
      const service = audioServiceRef.current;
      if (!service) return;

      // 无声或无效音频
      if (service.canRetry()) {
        // 可以重试
        service.incrementRetry();
        setRetryPrompt(`${result.validityResult.reason}（重试 ${service['retryCount']}/3）`);
        
        // 播放提示音并重新开始
        setTimeout(() => {
          setRetryPrompt(null);
          startPracticeFlow();
        }, 2000);
      } else {
        // 超过重试次数，跳到下一句
        setRetryPrompt('无法完成录音，自动跳到下一句');
        setTimeout(() => {
          service.resetRetry();
          setRetryPrompt(null);
          handleNext();
        }, 2000);
      }
      return;
    }

    // 步骤4: 有效音频，进入评测
    setRecordingState('evaluating');
    
    try {
      const evaluation = await evaluateAudio(result.blob);
      setEvaluationResult(evaluation);
      setRecordingState('showing_result');
      
      // 重置重试计数
      if (audioServiceRef.current) {
        audioServiceRef.current.resetRetry();
      }

      // 记录错误（如果得分<80）
      if (evaluation.score < 80 && currentSentence) {
        const errorRecord: ErrorRecord = {
          lessonId: currentSentence.id,
          courseId,
          errorType: evaluation.accuracy < 60 ? ErrorType.PRONUNCIATION : ErrorType.FLUENCY,
          suggestedRemedialType: 'phoneme_training',
          timestamp: new Date(),
          details: {
            confidence: evaluation.accuracy / 100,
            text: currentSentence.text
          }
        };
        
        setErrorRecords(prev => [...prev, errorRecord]);
      }
    } catch (error) {
      console.error('[Flow] 评测失败:', error);
      setRecordingState('idle');
    }
  }, [courseId, currentSentence, startPracticeFlow]);

  // ========== 手动停止录音 ==========
  const handleStopRecording = useCallback(async () => {
    if (!audioServiceRef.current) return;
    
    try {
      const result = await audioServiceRef.current.stopRecording();
      await handleRecordingComplete(result);
    } catch (error) {
      console.error('[Flow] 停止录音失败:', error);
    }
  }, [handleRecordingComplete]);

  // ========== 模拟ASR评测 ==========
  const evaluateAudio = async (blob: Blob): Promise<EvaluationResult> => {
    // TODO: 调用真实ASR服务
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const score = Math.floor(Math.random() * 30) + 70;
    return {
      score,
      accuracy: score + Math.floor(Math.random() * 10) - 5,
      fluency: score + Math.floor(Math.random() * 10) - 5,
      completeness: score + Math.floor(Math.random() * 10) - 5,
      feedback: score >= 90 ? '太棒了！发音非常标准！' :
                score >= 80 ? '不错！继续保持！' :
                '还需要多练习哦~',
      errorWords: score < 85 ? ['example'] : []
    };
  };

  // ========== 下一句 ==========
  const handleNext = useCallback(async () => {
    if (currentIndex < sentences.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setEvaluationResult(null);
      setRecordingState('idle');
    } else {
      // 完成所有练习，检查是否生成补救课程
      const remediationService = remediationServiceRef.current;
      
      if (remediationService.shouldGenerateRemediation(errorRecords)) {
        try {
          const remediationCourse = await remediationService.generateRemediationCourse(
            errorRecords,
            'current_user_id' // TODO: 获取真实用户ID
          );
          
          alert(`已为你生成补救课程：${remediationCourse.title}\n共${remediationCourse.lessons.length}个练习`);
          // TODO: 保存补救课程到数据库
        } catch (error) {
          console.error('[Flow] 生成补救课程失败:', error);
        }
      }
      
      alert('恭喜完成所有练习！');
      onBack();
    }
  }, [currentIndex, sentences.length, errorRecords, onBack]);

  // ========== 重试当前句 ==========
  const handleRetry = useCallback(() => {
    setEvaluationResult(null);
    setRecordingState('idle');
  }, []);

  // ========== 渲染 ==========
  if (!currentSentence) {
    return React.createElement('div', {
      className: 'min-h-screen flex items-center justify-center'
    },
      React.createElement('p', {}, '加载中...')
    );
  }

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800 p-4'
  },
    // 顶部导航
    React.createElement('div', { className: 'max-w-4xl mx-auto mb-6' },
      React.createElement('div', { className: 'flex items-center justify-between' },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-4 py-2 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700'
        }, '← 返回'),
        React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400' },
          `${currentIndex + 1} / ${sentences.length}`
        )
      )
    ),

    // 主内容区
    React.createElement('div', { className: 'max-w-4xl mx-auto' },
      // 句子显示卡片
      React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 mb-6' },
        // 英文句子
        React.createElement('div', { className: 'text-3xl font-bold text-gray-900 dark:text-white mb-4 text-center' },
          currentSentence.text
        ),
        
        // 音标
        currentSentence.phonetic && React.createElement('div', {
          className: 'text-lg text-blue-600 dark:text-blue-400 mb-4 text-center font-mono'
        }, currentSentence.phonetic),
        
        // 翻译（可切换）
        React.createElement('div', { className: 'text-center' },
          React.createElement('button', {
            onClick: () => setShowTranslation(prev => !prev),
            className: 'text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }, showTranslation ? '隐藏翻译' : '显示翻译'),
          
          showTranslation && currentSentence.translation &&
            React.createElement('p', {
              className: 'mt-2 text-gray-700 dark:text-gray-300'
            }, currentSentence.translation)
        )
      ),

      // 录音状态显示
      recordingState !== 'idle' && React.createElement('div', { 
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6' 
      },
        // 状态指示
        React.createElement('div', { className: 'text-center mb-4' },
          recordingState === 'playing_reference' &&
            React.createElement('div', {},
              React.createElement('div', { className: 'text-2xl mb-2' }, '🔊'),
              React.createElement('p', { className: 'text-lg font-medium' }, '正在播放示范音频...')
            ),
          
          recordingState === 'recording' &&
            React.createElement('div', {},
              React.createElement('div', { className: 'text-2xl mb-2 animate-pulse' }, '🎤'),
              React.createElement('p', { className: 'text-lg font-medium' }, '正在录音...'),
              React.createElement('p', { className: 'text-sm text-gray-600 mt-1' }, '3秒无声自动停止')
            ),
          
          recordingState === 'evaluating' &&
            React.createElement('div', {},
              React.createElement('div', { className: 'text-2xl mb-2' }, '⏳'),
              React.createElement('p', { className: 'text-lg font-medium' }, '评估中...')
            )
        ),

        // 实时音量条
        recordingState === 'recording' && React.createElement('div', { className: 'mb-4' },
          React.createElement('div', { className: 'h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden' },
            React.createElement('div', {
              className: 'h-full bg-green-500 transition-all duration-100',
              style: { width: `${currentVolume}%` }
            })
          ),
          React.createElement('p', { className: 'text-xs text-gray-500 text-center mt-1' },
            `音量: ${Math.round(currentVolume)}%`
          )
        ),

        // 手动停止按钮
        recordingState === 'recording' && React.createElement('div', { className: 'text-center' },
          React.createElement('button', {
            onClick: handleStopRecording,
            className: 'px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600'
          }, '停止录音')
        )
      ),

      // 重试提示
      retryPrompt && React.createElement('div', {
        className: 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6'
      },
        React.createElement('div', { className: 'flex items-center gap-2' },
          React.createElement('span', { className: 'text-2xl' }, '⚠️'),
          React.createElement('p', { className: 'text-yellow-800 dark:text-yellow-200' }, retryPrompt)
        )
      ),

      // 评测结果
      evaluationResult && React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-6'
      },
        React.createElement('div', { className: 'text-center mb-6' },
          React.createElement('div', { className: 'text-6xl mb-2' },
            evaluationResult.score >= 90 ? '🎉' : evaluationResult.score >= 80 ? '👍' : '💪'
          ),
          React.createElement('div', { className: 'text-4xl font-bold text-gray-900 dark:text-white mb-2' },
            `${evaluationResult.score} 分`
          ),
          React.createElement('p', { className: 'text-gray-600 dark:text-gray-400' },
            evaluationResult.feedback
          )
        ),

        // 详细评分
        React.createElement('div', { className: 'grid grid-cols-3 gap-4 mb-6' },
          [
            { label: '准确度', value: evaluationResult.accuracy, icon: '🎯' },
            { label: '流畅度', value: evaluationResult.fluency, icon: '🌊' },
            { label: '完整度', value: evaluationResult.completeness, icon: '✅' }
          ].map((item, i) =>
            React.createElement('div', {
              key: i,
              className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-center'
            },
              React.createElement('div', { className: 'text-2xl mb-1' }, item.icon),
              React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400 mb-1' }, 
                item.label
              ),
              React.createElement('div', { className: 'text-xl font-semibold' }, item.value)
            )
          )
        ),

        // 操作按钮
        React.createElement('div', { className: 'flex gap-3 justify-center' },
          evaluationResult.score < 80 && React.createElement('button', {
            onClick: handleRetry,
            className: 'px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600'
          }, '重试'),
          
          React.createElement('button', {
            onClick: handleNext,
            className: 'px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600'
          }, currentIndex < sentences.length - 1 ? '下一句' : '完成')
        )
      ),

      // 开始练习按钮
      recordingState === 'idle' && !evaluationResult && React.createElement('div', {
        className: 'text-center'
      },
        React.createElement('button', {
          onClick: startPracticeFlow,
          className: 'px-8 py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg hover:bg-blue-600 shadow-lg'
        }, '开始练习')
      )
    )
  );
};

export default EnhancedFollowAlongPracticePage;
