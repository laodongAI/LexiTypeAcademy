/**
 * 打字练习页面
 * 支持拼音练习和指法练习
 */
import React, { useState, useEffect, useRef } from 'react';
import { practiceTexts, Difficulty, PracticeType } from '@/shared/constants/texts';
import { Keyboard } from '@/ui/components/Keyboard';

interface TypingGamePageProps {
  onBack: () => void;
  practiceType?: PracticeType;
  difficulty?: Difficulty;
}

interface TypingRecord {
  wpm: number;
  accuracy: number;
  date: string;
  practiceType: string;
  difficulty: string;
}

export function TypingGamePage({
  onBack,
  practiceType = 'typingPractice',
  difficulty = 'beginner',
}: TypingGamePageProps) {
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [endTime, setEndTime] = useState<number | null>(null);
  const [wpm, setWpm] = useState(0);
  const [accuracy, setAccuracy] = useState(100);
  const [history, setHistory] = useState<TypingRecord[]>([]);
  const [currentKey, setCurrentKey] = useState('');
  const processedWordsRef = useRef<Set<number>>(new Set());

  const texts = practiceTexts[practiceType][difficulty];
  const safeIndex = currentTextIndex < texts.length ? currentTextIndex : 0;
  const text = texts[safeIndex];

  const statsRef = useRef({
    lastWpm: 0,
    lastAccuracy: 100,
    lastInput: '',
    lastStartTime: null as number | null,
  });

  // 初始加载历史
  useEffect(() => {
    const api: any = (window as any).typingAPI;
    if (api?.getHistory) {
      const current = api.getHistory();
      if (current.length === 0) {
        const legacy = localStorage.getItem('typingHistory');
        if (legacy) {
          try {
            const arr = JSON.parse(legacy);
            if (Array.isArray(arr)) {
              arr.forEach((r: any) => api.addRecord(r));
              localStorage.removeItem('typingHistory');
              setHistory(api.getHistory());
              return;
            }
          } catch {}
        }
      }
      setHistory(current);
    } else {
      const savedHistory = localStorage.getItem('typingHistory');
      if (savedHistory) setHistory(JSON.parse(savedHistory));
    }
  }, []);

  useEffect(() => {
    if (userInput === statsRef.current.lastInput) {
      return;
    }
    if (userInput.length === 1 && !startTime) {
      setStartTime(Date.now());
      return;
    }
    if (!startTime) {
      return;
    }
    const timeElapsed = ((endTime || Date.now()) - startTime) / 1000 / 60;
    const wordsTyped = userInput.trim().split(' ').length;
    const newWpm = Math.round(wordsTyped / timeElapsed);

    const correctChars = userInput.split('').filter((char, i) => char === text[i]).length;
    const newAccuracy = Math.round((correctChars / userInput.length) * 100) || 100;

    if (newWpm !== statsRef.current.lastWpm) {
      setWpm(newWpm);
      statsRef.current.lastWpm = newWpm;
    }
    if (newAccuracy !== statsRef.current.lastAccuracy) {
      setAccuracy(newAccuracy);
      statsRef.current.lastAccuracy = newAccuracy;
    }
    statsRef.current.lastInput = userInput;

    // TODO: 单词掌握度追踪和语音反馈（暂时禁用）
    // const isSpaceSeparated = text.includes(' ');
    // ... 复杂的单词追踪逻辑

    if (userInput.length === text.length && !endTime) {
      setEndTime(Date.now());
      // TODO: 播放成功音效
      const newRecord: TypingRecord = {
        wpm: newWpm,
        accuracy: newAccuracy,
        date: new Date().toLocaleString(),
        practiceType: practiceType,
        difficulty: difficulty,
      };
      const api: any = (window as any).typingAPI;
      if (api?.addRecord) {
        const updated = api.addRecord(newRecord);
        setHistory(updated);
      } else {
        const updatedHistory = [...history, newRecord];
        setHistory(updatedHistory);
      }
    }
  }, [userInput, startTime, endTime, text, history, practiceType, difficulty]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextText();
      return;
    }
    setCurrentKey(e.key);
    // TODO: 播放按键音效
  };

  const handleKeyUp = () => {
    setCurrentKey('');
  };

  const nextText = () => {
    setCurrentTextIndex((prev) => (prev + 1) % texts.length);
    setUserInput('');
    setStartTime(null);
    setEndTime(null);
    processedWordsRef.current.clear();
    statsRef.current = {
      lastWpm: 0,
      lastAccuracy: 100,
      lastInput: '',
      lastStartTime: null,
    };
  };

  if (!text) {
    return React.createElement('div', {
      className: 'text-center p-10'
    }, '该难度没有练习内容');
  }

  return React.createElement('div', {
    className: 'min-h-screen bg-gray-50 dark:bg-gray-900 p-6'
  },
    // 顶部标题
    React.createElement('div', {
      className: 'max-w-4xl mx-auto mb-6'
    },
      React.createElement('h1', {
        className: 'text-3xl font-bold text-gray-900 dark:text-white text-center'
      }, practiceType === 'typingPractice' ? '拼音练习' : '指法练习')
    ),

    // 主内容区域
    React.createElement('div', {
      className: 'max-w-4xl mx-auto space-y-6'
    },
      // 练习文本显示区
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
      },
        React.createElement('p', {
          className: 'text-xl font-mono leading-relaxed'
        }, text.split('').map((char: string, i: number) => {
          const userChar = userInput[i];
          const color = !userChar
            ? 'text-gray-400 dark:text-gray-500'
            : userChar === char
            ? 'text-green-600 dark:text-green-400'
            : 'text-red-600 dark:text-red-400';
          return React.createElement('span', {
            key: i,
            className: color
          }, char);
        }))
      ),

      // 输入区域
      React.createElement('textarea', {
        className: 'w-full p-4 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500',
        value: userInput,
        onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setUserInput(e.target.value),
        onKeyDown: handleKeyDown,
        onKeyUp: handleKeyUp,
        rows: 3,
        placeholder: '在此输入练习内容...'
      }),

      // 统计信息
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md'
      },
        React.createElement('div', {
          className: 'flex justify-around text-lg'
        },
          React.createElement('div', {
            className: 'text-center'
          },
            React.createElement('div', {
              className: 'text-gray-600 dark:text-gray-400 mb-1'
            }, '速度'),
            React.createElement('div', {
              className: 'text-2xl font-bold text-blue-600 dark:text-blue-400'
            }, `${wpm} WPM`)
          ),
          React.createElement('div', {
            className: 'text-center'
          },
            React.createElement('div', {
              className: 'text-gray-600 dark:text-gray-400 mb-1'
            }, '准确率'),
            React.createElement('div', {
              className: 'text-2xl font-bold text-green-600 dark:text-green-400'
            }, `${accuracy}%`)
          ),
          React.createElement('div', {
            className: 'text-center text-sm text-gray-500 dark:text-gray-400 self-center'
          }, '(按 Enter 下一题)')
        )
      ),

      // 键盘可视化
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex justify-center'
      },
        React.createElement(Keyboard, {
          highlightKey: text[userInput.length]?.toUpperCase(),
          pressedKey: currentKey
        })
      )
    )
  );
}

export default TypingGamePage;
