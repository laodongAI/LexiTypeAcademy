/**
 * 飞行射击游戏页面
 * 
 * 游戏玩法:
 * - 输入单词击落飞行中的敌人
 * - 漏掉敌人会扣除燃料
 * - 燃料耗尽游戏结束
 * 
 * 功能特性:
 * - 3 个难度等级(字母/短词/长词)
 * - 燃料系统
 * - 等级提升
 * - 速度动态调整
 */

import React, { useState, useEffect, useRef } from 'react';

/** 组件 Props */
interface FlightGamePageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 飞行单词接口 */
interface FlyingWord {
  id: number;
  text: string;
  x: number;
  y: number;
  speed: number;
}

/** 游戏难度 */
type GameDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** 字母列表 */
const LETTERS = 'abcdefghijklmnopqrstuvwxyz'.split('');

/** 短词列表 */
const SHORT_WORDS = ['cat', 'dog', 'run', 'sky', 'blue', 'red', 'one', 'two', 'sun', 'moon', 'star', 'fish', 'bird', 'tree', 'leaf'];

/** 长词列表 */
const LONG_WORDS = ['banana', 'cherry', 'orange', 'monkey', 'rabbit', 'planet', 'galaxy', 'rocket', 'summer', 'winter', 'friend', 'school', 'garden', 'yellow', 'purple'];

/**
 * 飞行射击游戏页面组件
 */
const FlightGamePage: React.FC<FlightGamePageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [gameStarted, setGameStarted] = useState(false);
  const [difficulty, setDifficulty] = useState<GameDifficulty>('beginner');
  const [words, setWords] = useState<FlyingWord[]>([]);
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [fuel, setFuel] = useState(100);
  const [gameOver, setGameOver] = useState(false);

  // ========== Refs ==========
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>();
  const lastSpawnTime = useRef<number>(0);
  const speedMultiplier = useRef(1);

  // ========== 开始游戏 ==========
  const startGame = (diff: GameDifficulty) => {
    setDifficulty(diff);
    setGameStarted(true);
    setScore(0);
    setLevel(1);
    setFuel(100);
    setWords([]);
    setGameOver(false);
    speedMultiplier.current = 1;
  };

  // ========== 获取单词列表 ==========
  const getWordList = () => {
    switch (difficulty) {
      case 'beginner': return LETTERS;
      case 'intermediate': return SHORT_WORDS;
      case 'advanced': return LONG_WORDS;
      default: return LETTERS;
    }
  };

  // ========== 生成单词 ==========
  const spawnWord = () => {
    const list = getWordList();
    const text = list[Math.floor(Math.random() * list.length)];
    const containerHeight = containerRef.current?.clientHeight || 400;
    const y = Math.random() * (containerHeight - 60) + 30;
    
    let baseSpeed = 1;
    if (difficulty === 'intermediate') baseSpeed = 1.5;
    if (difficulty === 'advanced') baseSpeed = 2;

    const finalSpeed = (baseSpeed + Math.random() * 1.5) * speedMultiplier.current;

    setWords(prev => [...prev, {
      id: Date.now(),
      text,
      x: containerRef.current?.clientWidth || 800,
      y,
      speed: finalSpeed
    }]);
  };

  // ========== 游戏更新循环 ==========
  const updateGame = (time: number) => {
    if (gameOver || !gameStarted) return;

    // 生成逻辑
    const spawnInterval = Math.max(800, 2000 - (level * 100));
    if (time - lastSpawnTime.current > spawnInterval) {
      spawnWord();
      lastSpawnTime.current = time;
    }

    setWords(prev => {
      const newWords = prev.map(w => ({ ...w, x: w.x - w.speed }));
      
      // 检查漏掉的单词
      const missed = newWords.filter(w => w.x < -100);
      if (missed.length > 0) {
        setFuel(f => Math.max(0, f - (missed.length * 10)));
      }

      return newWords.filter(w => w.x > -150);
    });

    // 升级逻辑
    if (score > level * 500) {
      setLevel(l => l + 1);
      speedMultiplier.current += 0.2;
    }

    // 游戏结束逻辑
    if (fuel <= 0) {
      setGameOver(true);
    } else {
      requestRef.current = requestAnimationFrame(updateGame);
    }
  };

  useEffect(() => {
    if (gameStarted && !gameOver) {
      requestRef.current = requestAnimationFrame(updateGame);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameOver, fuel, level, score, gameStarted]);

  // ========== 输入处理 ==========
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    const matchedWord = words.find(w => w.text === val);
    if (matchedWord) {
      setScore(s => s + (matchedWord.text.length * 10));
      setFuel(f => Math.min(100, f + 2)); // 击中补充燃料
      setWords(prev => prev.filter(w => w.id !== matchedWord.id));
      setInput('');
    }
  };

  // ========== 渲染: 难度选择 ==========
  if (!gameStarted) {
    return React.createElement('div', { className: 'p-8 h-full flex flex-col items-center justify-center max-w-4xl mx-auto' },
      React.createElement('h2', { className: 'text-4xl font-bold text-indigo-600 mb-8' }, '✈️ 飞行射击'),
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6 w-full' },
        React.createElement('button', {
          onClick: () => startGame('beginner'),
          className: 'p-6 bg-green-100 hover:bg-green-200 rounded-xl border-2 border-green-400 transition-all hover:scale-105'
        },
          React.createElement('div', { className: 'text-4xl mb-4' }, '🥉'),
          React.createElement('h3', { className: 'text-xl font-bold text-green-800 mb-2' }, '初级'),
          React.createElement('p', { className: 'text-green-700 text-sm' }, '单个字母')
        ),
        React.createElement('button', {
          onClick: () => startGame('intermediate'),
          className: 'p-6 bg-yellow-100 hover:bg-yellow-200 rounded-xl border-2 border-yellow-400 transition-all hover:scale-105'
        },
          React.createElement('div', { className: 'text-4xl mb-4' }, '🥈'),
          React.createElement('h3', { className: 'text-xl font-bold text-yellow-800 mb-2' }, '中级'),
          React.createElement('p', { className: 'text-yellow-700 text-sm' }, '短单词')
        ),
        React.createElement('button', {
          onClick: () => startGame('advanced'),
          className: 'p-6 bg-red-100 hover:bg-red-200 rounded-xl border-2 border-red-400 transition-all hover:scale-105'
        },
          React.createElement('div', { className: 'text-4xl mb-4' }, '🥇'),
          React.createElement('h3', { className: 'text-xl font-bold text-red-800 mb-2' }, '高级'),
          React.createElement('p', { className: 'text-red-700 text-sm' }, '长单词')
        )
      ),
      React.createElement('button', {
        onClick: onBack,
        className: 'mt-12 text-gray-500 hover:text-gray-700 underline'
      }, '返回')
    );
  }

  // ========== 渲染: 游戏界面 ==========
  return React.createElement('div', { className: 'p-8 h-full flex flex-col max-w-6xl mx-auto' },
    // HUD
    React.createElement('div', { className: 'flex justify-between items-center mb-4 bg-white p-4 rounded-xl shadow-sm' },
      React.createElement('div', { className: 'flex items-center gap-4' },
        React.createElement('h2', { className: 'text-2xl font-bold text-indigo-600' }, '✈️ 飞行射击'),
        React.createElement('span', { className: 'px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-sm font-bold capitalize' },
          `${difficulty === 'beginner' ? '初级' : difficulty === 'intermediate' ? '中级' : '高级'} - 等级 ${level}`
        )
      ),
      React.createElement('div', { className: 'flex items-center gap-8' },
        React.createElement('div', { className: 'text-xl font-bold' }, 
          '分数: ', React.createElement('span', { className: 'text-indigo-600' }, score)
        ),
        React.createElement('div', { className: 'w-48' },
          React.createElement('div', { className: 'flex justify-between text-xs mb-1' },
            React.createElement('span', null, '燃料'),
            React.createElement('span', null, `${fuel}%`)
          ),
          React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2.5' },
            React.createElement('div', {
              className: `h-2.5 rounded-full transition-all duration-300 ${fuel < 30 ? 'bg-red-500' : 'bg-green-500'}`,
              style: { width: `${fuel}%` }
            })
          )
        )
      ),
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors'
      }, '退出')
    ),

    // 游戏区域
    React.createElement('div', {
      ref: containerRef,
      className: 'relative flex-1 bg-gradient-to-b from-sky-300 to-sky-100 rounded-xl overflow-hidden border-4 border-sky-200 shadow-inner',
      style: { minHeight: '400px' }
    },
      // 云朵装饰
      React.createElement('div', { className: 'absolute top-10 left-20 text-6xl opacity-30 animate-pulse' }, '☁️'),
      React.createElement('div', { className: 'absolute top-40 right-40 text-8xl opacity-20' }, '☁️'),
      React.createElement('div', { className: 'absolute bottom-20 left-1/3 text-5xl opacity-25' }, '☁️'),

      // 游戏结束覆盖层
      gameOver && React.createElement('div', {
        className: 'absolute inset-0 flex items-center justify-center bg-black bg-opacity-60 z-20 backdrop-blur-sm'
      },
        React.createElement('div', { className: 'bg-white p-8 rounded-2xl text-center shadow-2xl transform scale-110' },
          React.createElement('div', { className: 'text-6xl mb-4' }, '💥'),
          React.createElement('h3', { className: 'text-3xl font-bold text-gray-800 mb-2' }, '游戏结束'),
          React.createElement('p', { className: 'text-gray-500 mb-6' }, '燃料耗尽'),
          React.createElement('div', { className: 'text-4xl font-bold text-indigo-600 mb-8' }, score),
          React.createElement('div', { className: 'flex gap-4 justify-center' },
            React.createElement('button', {
              onClick: () => startGame(difficulty),
              className: 'px-8 py-3 bg-indigo-600 text-white font-bold rounded-full hover:bg-indigo-700 transition-transform hover:scale-105 shadow-lg'
            }, '重试'),
            React.createElement('button', {
              onClick: () => setGameStarted(false),
              className: 'px-8 py-3 bg-gray-200 text-gray-700 font-bold rounded-full hover:bg-gray-300 transition-colors'
            }, '改变难度')
          )
        )
      ),

      // 飞行单词
      ...words.map(word =>
        React.createElement('div', {
          key: word.id,
          className: 'absolute flex items-center gap-2 transition-transform',
          style: { left: word.x, top: word.y }
        },
          React.createElement('span', { className: 'text-3xl filter drop-shadow-lg' }, '🛩️'),
          React.createElement('span', {
            className: 'bg-white/90 px-3 py-1 rounded-lg shadow-md text-sm font-bold text-slate-800 border border-slate-200 whitespace-nowrap'
          }, word.text)
        )
      )
    ),

    // 输入区域
    React.createElement('div', { className: 'mt-6 flex justify-center relative' },
      React.createElement('div', { className: 'absolute -top-16 left-1/2 transform -translate-x-1/2' },
        React.createElement('span', { className: 'text-5xl filter drop-shadow-xl' }, '🔫')
      ),
      React.createElement('input', {
        autoFocus: true,
        type: 'text',
        value: input,
        onChange: handleInput,
        placeholder: '输入单词射击...',
        className: 'w-full max-w-xl px-6 py-4 border-4 border-indigo-200 rounded-full text-2xl text-center focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 shadow-lg transition-all',
        disabled: gameOver
      })
    )
  );
};

export default FlightGamePage;
