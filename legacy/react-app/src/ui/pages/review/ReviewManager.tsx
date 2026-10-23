import React, { useState, useEffect, useRef } from 'react';
import { createReviewService } from '@/domain/services/ReviewService';
import { createReviewRepository } from '@/infrastructure/persistence/ReviewRepository';
import { getTTSService } from '@/infrastructure/audio/tts';

// 创建ReviewService实例
const reviewService = createReviewService(createReviewRepository());

const ReviewManager: React.FC = () => {
  // 简单的文本映射（已移除多语言支持）
  const texts: Record<string, string> = {
    'review.title': '复习中心',
    'review.flashcard': '闪卡模式',
  };
  const t = (key: string) => texts[key] || key;
  const [stats, setStats] = useState<any>({ total: 0, mastered: 0, learning: 0, due: 0, bySource: {} });
  const [dueItems, setDueItems] = useState<{word: string, source: string}[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [input, setInput] = useState('');
  const [showFeedback, setShowFeedback] = useState<'correct' | 'incorrect' | null>(null);
  const [feedbackInfo, setFeedbackInfo] = useState<{ interval: number } | null>(null);
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // New state for Flashcard Mode
  const [flashcardMode, setFlashcardMode] = useState(false);
  const [isWordVisible, setIsWordVisible] = useState(true);

  useEffect(() => {
    refreshData();
  }, [selectedSource]);

  // Effect to handle flashcard visibility
  useEffect(() => {
    if (flashcardMode && dueItems.length > 0 && !showFeedback) {
      setIsWordVisible(true);
      const timer = setTimeout(() => {
        setIsWordVisible(false);
      }, 2000); // Show for 2 seconds
      return () => clearTimeout(timer);
    } else {
      setIsWordVisible(true);
    }
  }, [currentWordIndex, flashcardMode, dueItems, showFeedback]);

  const refreshData = async () => {
    setStats(await reviewService.getStats());
    const sourceFilter = selectedSource === 'all' ? undefined : selectedSource;
    setDueItems(await reviewService.getDueWords(20, sourceFilter));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (dueItems.length === 0) return;

    const currentItem = dueItems[currentWordIndex];
    const isCorrect = input.trim() === currentItem.word;

    const result = await reviewService.recordResult(currentItem.word, isCorrect, currentItem.source);
    
    setShowFeedback(isCorrect ? 'correct' : 'incorrect');
    setFeedbackInfo({ interval: result.interval });
    setIsWordVisible(true); // Show word on feedback

    if (isCorrect) {
      // 使用TTSService播放正确答案的语音
      try {
        const ttsService = getTTSService();
        const lang = currentItem.source === 'pinyin' ? 'zh-CN' : 'en-US';
        const result = await ttsService.generate({ text: currentItem.word, lang });
        // 播放生成的音频
        if (result.audioBlob) {
          const audioUrl = URL.createObjectURL(result.audioBlob);
          const audio = new Audio(audioUrl);
          audio.play().catch(console.error);
          // 播放完成后释放URL
          audio.onended = () => URL.revokeObjectURL(audioUrl);
        }
      } catch (error) {
        console.warn('[ReviewManager] TTS播放失败:', error);
      }
    }

    // Add history record for review session
    const api: any = (window as any).typingAPI;
    if (api?.addRecord) {
      api.addRecord({
        wpm: 0, // Not applicable for single word review
        accuracy: isCorrect ? 100 : 0,
        date: new Date().toISOString(),
        practiceType: 'review',
        difficulty: 'adaptive',
        word: currentItem.word,
        source: currentItem.source
      });
    }

    setTimeout(() => {
      setShowFeedback(null);
      setFeedbackInfo(null);
      setInput('');
      if (currentWordIndex < dueItems.length - 1) {
        setCurrentWordIndex(prev => prev + 1);
      } else {
        // Finished current batch
        refreshData();
        setCurrentWordIndex(0);
      }
      // 恢复输入焦点，避免用户每次需要重新点击
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      });
    }, 1500);
  };

  // Mock adding words for testing
  const addTestWords = () => {
    ['apple', 'banana', 'computer', 'algorithm', 'network'].forEach(w => reviewService.recordResult(w, false, 'english'));
    refreshData();
  };

  return (
    <div className="p-6 pt-10 max-w-4xl mx-auto min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">{t('review.title')}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">智能复习记忆曲线 · 支持闪卡/听写双模式</p>
        <label className="flex items-center cursor-pointer px-3 py-2 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm mt-2">
          <div className="relative">
            <input type="checkbox" className="sr-only" checked={flashcardMode} onChange={e => setFlashcardMode(e.target.checked)} />
            <div className={`block w-14 h-8 rounded-full transition-colors ${flashcardMode ? 'bg-indigo-600' : 'bg-gray-400'}`}></div>
            <div className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${flashcardMode ? 'translate-x-6' : ''}`}></div>
          </div>
          <div className="ml-3 font-medium text-gray-700 dark:text-gray-200">{t('review.flashcard')}</div>
        </label>
      </div>
      
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm text-center">
          <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
          <div className="text-sm text-gray-500">{t('review.total')}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm text-center">
          <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
          <div className="text-sm text-gray-500">{t('review.mastered')}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm text-center">
          <div className="text-2xl font-bold text-yellow-600">{stats.learning}</div>
          <div className="text-sm text-gray-500">{t('review.learning')}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm text-center">
          <div className="text-2xl font-bold text-red-600">{stats.due}</div>
          <div className="text-sm text-gray-500">{t('review.due')}</div>
        </div>
      </div>

      {/* Source Filter */}
      <div className="flex justify-center gap-2 mb-8">
        <button 
          onClick={() => setSelectedSource('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedSource === 'all' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
        >
          All Sources
        </button>
        {Object.keys(stats.bySource || {}).map(source => (
          <button 
            key={source}
            onClick={() => setSelectedSource(source)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedSource === source ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
          >
            {source.charAt(0).toUpperCase() + source.slice(1)} ({stats.bySource[source]})
          </button>
        ))}
      </div>

      {dueItems.length > 0 ? (
        <div className="bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-xl text-center max-w-2xl mx-auto transition-all">
          <div className="mb-4 text-gray-400 text-sm uppercase tracking-wide">
            {t('review.progress').replace('{current}', String(currentWordIndex + 1)).replace('{total}', String(dueItems.length))}
            <span className="ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs">
              {dueItems[currentWordIndex].source}
            </span>
          </div>
          
          <div className="h-32 flex items-center justify-center mb-8">
            {isWordVisible ? (
              <h2 className="text-5xl font-bold text-indigo-600 dark:text-indigo-400 animate-fade-in">
                {dueItems[currentWordIndex].word}
              </h2>
            ) : (
              <div className="text-6xl text-gray-300 dark:text-gray-600">? ? ?</div>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="max-w-md mx-auto">
            <input
              ref={inputRef}
              autoFocus
              type="text"
              value={input}
              onChange={e => !showFeedback && setInput(e.target.value)}
              className={`w-full text-center text-3xl bg-transparent border-b-4 focus:outline-none py-2 mb-6 transition-colors ${
                showFeedback === 'correct' ? 'border-green-500 text-green-600' :
                showFeedback === 'incorrect' ? 'border-red-500 text-red-600' :
                'border-gray-300 dark:border-gray-600 focus:border-indigo-500'
              } ${showFeedback ? 'opacity-70' : ''}`}
              placeholder={isWordVisible ? t('review.placeholder.visible') : t('review.placeholder.hidden')}
              autoComplete="off"
            />
          </form>
          
          <div className="h-8">
            {showFeedback === 'correct' && (
              <div className="text-green-600 font-bold text-xl animate-bounce">
                {t('review.correct')} 
                {feedbackInfo && (
                  <span className="text-sm ml-2 font-normal text-green-500">
                    {t('review.next_interval').replace('{days}', String(feedbackInfo.interval))}
                  </span>
                )}
              </div>
            )}
            {showFeedback === 'incorrect' && <div className="text-red-600 font-bold text-xl animate-shake">{t('review.incorrect').replace('{word}', dueItems[currentWordIndex].word)}</div>}
          </div>
        </div>
      ) : (
        <div className="text-center py-16 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
          <div className="text-6xl mb-4">🎉</div>
          <h3 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">{t('review.done.title')}</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-8">{t('review.done.desc')}</p>
          <button 
            onClick={addTestWords} 
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-full text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {t('review.debug.add')}
          </button>
        </div>
      )}
    </div>
  );
};

export default ReviewManager;







