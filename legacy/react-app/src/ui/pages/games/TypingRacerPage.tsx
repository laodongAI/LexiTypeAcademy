/**
 * 打字赛车游戏页面
 * 
 * 游戏玩法:
 * - 玩家与电脑对手进行打字竞速
 * - 正确输入单词后车辆前进
 * - 先到达终点的获胜
 * 
 * 功能特性:
 * - 实时位置显示
 * - WPM 速度计算
 * - 随机难度对手
 */

import React, { useState, useEffect, useRef } from 'react';

/** 组件 Props */
interface TypingRacerPageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 游戏状态类型 */
type GameState = 'start' | 'racing' | 'finished';

/** 车辆 emoji 列表 */
const CARS = ['🏎️', '🚗', '🚕', '🚙', '🚓'];

/** 单词列表 */
const WORDS = [
  'speed', 'race', 'fast', 'turbo', 'drift', 
  'nitro', 'gear', 'motor', 'track', 'win', 
  'go', 'run', 'dash', 'zoom', 'rush'
];

/**
 * 打字赛车游戏页面组件
 */
const TypingRacerPage: React.FC<TypingRacerPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [gameState, setGameState] = useState<GameState>('start');
  const [playerPos, setPlayerPos] = useState(0); // 0 到 100%
  const [opponentPos, setOpponentPos] = useState(0);
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [wpm, setWpm] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [wordCount, setWordCount] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // ========== Refs ==========
  const requestRef = useRef<number>();
  const opponentSpeed = useRef(0.2); // % per frame

  // ========== 对手移动动画 ==========
  useEffect(() => {
    if (gameState === 'racing') {
      const loop = () => {
        setOpponentPos(prev => {
          const next = prev + opponentSpeed.current;
          if (next >= 100) {
            setGameState('finished');
            return 100;
          }
          return next;
        });
        requestRef.current = requestAnimationFrame(loop);
      };
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState]);

  // ========== 开始游戏 ==========
  const startGame = () => {
    setPlayerPos(0);
    setOpponentPos(0);
    setGameState('racing');
    setWordCount(0);
    setStartTime(Date.now());
    setCurrentWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
    setInput('');
    // 随机难度：对手速度
    opponentSpeed.current = 0.1 + Math.random() * 0.15;
  };

  // ========== 输入处理 ==========
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gameState !== 'racing') return;
    const val = e.target.value;
    setInput(val);

    if (val === currentWord) {
      // 正确输入 - 玩家前进
      setPlayerPos(prev => {
        const boost = 5 + (currentWord.length * 1.5); // 根据单词长度加速
        const next = prev + boost;
        if (next >= 100) {
          setGameState('finished');
          return 100;
        }
        return next;
      });
      setWordCount(c => c + 1);
      
      // 更新 WPM
      const minutes = (Date.now() - startTime) / 60000;
      if (minutes > 0) {
        setWpm(Math.round((wordCount + 1) / minutes));
      }

      // 下一个单词
      setCurrentWord(WORDS[Math.floor(Math.random() * WORDS.length)]);
      setInput('');
    }
  };

  // ========== 渲染: 开始界面 ==========
  const renderStartScreen = () => {
    return React.createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-lg p-10'
    },
      React.createElement('div', { className: 'text-6xl mb-6' }, '🏁'),
      React.createElement('h1', { className: 'text-4xl font-bold mb-4' }, '打字赛车'),
      React.createElement('p', { className: 'text-gray-600 mb-8' }, '与对手竞速，快速输入单词前进！'),
      React.createElement('button', {
        onClick: startGame,
        className: 'px-10 py-4 bg-blue-600 text-white text-xl font-bold rounded-full hover:bg-blue-700 shadow-lg transition-transform hover:scale-105'
      }, '开始游戏')
    );
  };

  // ========== 渲染: 比赛中 ==========
  const renderRacingScreen = () => {
    return React.createElement('div', { className: 'flex flex-col items-center' },
      React.createElement('div', { className: 'text-gray-500 mb-2 text-sm uppercase tracking-widest' }, '快速输入'),
      React.createElement('div', { className: 'text-5xl font-mono font-bold text-gray-800 mb-6' }, currentWord),
      React.createElement('input', {
        autoFocus: true,
        type: 'text',
        value: input,
        onChange: handleInput,
        className: 'w-full max-w-lg px-6 py-4 text-center text-3xl border-b-4 border-blue-500 focus:outline-none bg-transparent font-mono',
        placeholder: '开始输入...'
      }),
      React.createElement('div', { className: 'mt-8 text-xl font-bold text-gray-400' }, `${wpm} WPM`)
    );
  };

  // ========== 渲染: 结束界面 ==========
  const renderFinishedScreen = () => {
    const isWinner = playerPos >= 100 && playerPos > opponentPos;
    
    return React.createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center bg-white rounded-xl shadow-lg p-10 animate-fade-in'
    },
      React.createElement('div', { className: 'text-6xl mb-6' }, isWinner ? '🏆' : '🥈'),
      React.createElement('h2', { className: 'text-4xl font-bold mb-2' }, isWinner ? '你赢了！' : '你输了！'),
      React.createElement('div', { className: 'text-2xl text-gray-600 mb-8' }, `${wpm} WPM`),
      React.createElement('div', { className: 'flex gap-4' },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50'
        }, '返回'),
        React.createElement('button', {
          onClick: startGame,
          className: 'px-8 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700'
        }, '再玩一次')
      )
    );
  };

  // ========== 渲染: 帮助弹窗 ==========
  const renderHelpModal = () => {
    if (!showHelp) return null;

    return React.createElement('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50',
      onClick: () => setShowHelp(false)
    },
      React.createElement('div', {
        className: 'bg-white p-8 rounded-xl max-w-md',
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      },
        React.createElement('h3', { className: 'text-2xl font-bold mb-4' }, '📖 游戏帮助'),
        React.createElement('div', { className: 'text-gray-600 mb-6 leading-relaxed space-y-2' },
          React.createElement('p', null, '🏎️ 快速输入单词让你的车前进'),
          React.createElement('p', null, '🚓 与电脑对手竞速'),
          React.createElement('p', null, '🏁 先到达终点的获胜')
        ),
        React.createElement('button', {
          onClick: () => setShowHelp(false),
          className: 'w-full py-3 bg-blue-600 text-white rounded-lg font-bold'
        }, '关闭')
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', { className: 'p-8 max-w-4xl mx-auto h-full flex flex-col' },
    // 顶部导航栏
    React.createElement('div', { className: 'flex justify-between items-center mb-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'text-gray-500 hover:text-gray-700'
      }, '← 返回'),
      React.createElement('h2', { className: 'text-3xl font-bold text-blue-600' }, '🏎️ 打字赛车'),
      React.createElement('button', {
        onClick: () => setShowHelp(true),
        className: 'px-4 py-2 bg-blue-100 text-blue-600 rounded-full hover:bg-blue-200 text-sm font-bold'
      }, '? 帮助')
    ),

    // 赛道区域
    React.createElement('div', { className: 'bg-gray-800 rounded-xl p-8 mb-8 relative overflow-hidden' },
      // 终点线
      React.createElement('div', {
        className: 'absolute right-8 top-0 bottom-0 w-4 bg-white border-l-2 border-r-2 border-dashed border-gray-400 z-0 flex flex-col justify-center items-center opacity-50'
      },
        React.createElement('div', { className: 'text-xs text-gray-500 rotate-90 whitespace-nowrap' }, 'FINISH')
      ),

      // 玩家赛道
      React.createElement('div', { className: 'mb-8 relative h-16 border-b border-gray-600' },
        React.createElement('div', {
          className: 'absolute top-2 text-4xl transition-all duration-300 ease-out',
          style: { left: `calc(${playerPos}% - 2rem)` }
        },
          '🏎️',
          React.createElement('div', {
            className: 'absolute -top-6 left-0 text-xs text-white bg-blue-600 px-2 py-0.5 rounded whitespace-nowrap'
          }, `YOU ${Math.floor(playerPos)}%`)
        )
      ),

      // 对手赛道
      React.createElement('div', { className: 'relative h-16' },
        React.createElement('div', {
          className: 'absolute top-2 text-4xl transition-all duration-100 linear',
          style: { left: `calc(${opponentPos}% - 2rem)` }
        },
          '🚓',
          React.createElement('div', {
            className: 'absolute -top-6 left-0 text-xs text-gray-300 bg-gray-600 px-2 py-0.5 rounded whitespace-nowrap'
          }, `CPU ${Math.floor(opponentPos)}%`)
        )
      )
    ),

    // 游戏内容区域 - 根据状态渲染
    gameState === 'start' && renderStartScreen(),
    gameState === 'racing' && renderRacingScreen(),
    gameState === 'finished' && renderFinishedScreen(),

    // 帮助弹窗
    renderHelpModal()
  );
};

export default TypingRacerPage;
