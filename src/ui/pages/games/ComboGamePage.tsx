/**
 * 连击打字游戏页面
 * 
 * 游戏玩法:
 * - 快速连续输入单词序列
 * - 保持连击获得更高分数
 * - 输入错误会打断连击
 * 
 * 功能特性:
 * - 基础和高级单词序列
 * - 连击倍数系统
 * - 60秒倒计时
 * - 错误震动效果
 */

import React, { useState, useEffect } from 'react';

/** 组件 Props */
interface ComboGamePageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 基础序列 */
const BASE_SEQUENCES = [
  'asdf', 'jkl;', 'qwer', 'uiop', 'zxcv', 'nm,.',
  'fdsa', ';lkj', 'rewq', 'poiu', 'vcxz', '.,mn'
];

/** 高级序列(连击 >10 时出现) */
const ADVANCED_SEQUENCES = [
  'asdf jkl;', 'qwer uiop', 'zxcv nm,.',
  'aqsw defr', 'gthy jujy', 'kiol p;[\'',
  '1234 5678', '!@#$ %^&*',
  'const let var', 'if else for', 'return true',
  'console.log', 'import React', 'export default'
];

/**
 * 连击打字游戏页面组件
 */
const ComboGamePage: React.FC<ComboGamePageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [target, setTarget] = useState('');
  const [input, setInput] = useState('');
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isActive, setIsActive] = useState(false);
  const [shake, setShake] = useState(false);

  // ========== 倒计时 ==========
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
    }
  }, [isActive, timeLeft]);

  // ========== 生成目标序列 ==========
  const generateTarget = (currentCombo: number) => {
    const pool = currentCombo > 10 
      ? [...BASE_SEQUENCES, ...ADVANCED_SEQUENCES] 
      : BASE_SEQUENCES;
    const next = pool[Math.floor(Math.random() * pool.length)];
    setTarget(next);
  };

  // ========== 开始游戏 ==========
  const startGame = () => {
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setTimeLeft(60);
    setIsActive(true);
    setInput('');
    generateTarget(0);
  };

  // ========== 输入处理 ==========
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);

    // 检查输入是否匹配目标的开头
    if (!target.startsWith(val)) {
      // 错误!
      setCombo(0);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setInput(''); // 清空输入强制重新开始
      return;
    }

    if (val === target) {
      // 成功!
      const newCombo = combo + 1;
      setCombo(newCombo);
      if (newCombo > maxCombo) setMaxCombo(newCombo);
      
      // 分数计算：基础 10 + 连击奖励
      setScore(s => s + 10 + newCombo * 2);
      
      setInput('');
      generateTarget(newCombo);
    }
  };

  // ========== 渲染: 介绍界面 ==========
  const renderIntroScreen = () => {
    return React.createElement('div', { className: 'bg-white p-10 rounded-xl shadow-lg' },
      React.createElement('p', { className: 'text-xl mb-6 text-gray-600' }, 
        '快速连续输入序列，保持连击！'
      ),
      React.createElement('div', { className: 'flex justify-center gap-4 mb-8' },
        React.createElement('div', { className: 'bg-orange-50 p-4 rounded-lg' },
          React.createElement('div', { className: 'font-bold text-orange-600' }, 'Combo x10'),
          React.createElement('div', { className: 'text-sm text-gray-500' }, '分数加成')
        ),
        React.createElement('div', { className: 'bg-red-50 p-4 rounded-lg' },
          React.createElement('div', { className: 'font-bold text-red-600' }, '不能出错'),
          React.createElement('div', { className: 'text-sm text-gray-500' }, '保持连击')
        )
      ),
      React.createElement('button', {
        onClick: startGame,
        className: 'px-10 py-4 bg-orange-500 text-white text-xl font-bold rounded-full hover:bg-orange-600 transition-transform hover:scale-105 shadow-lg'
      }, '开始游戏')
    );
  };

  // ========== 渲染: 游戏中 ==========
  const renderActiveScreen = () => {
    return React.createElement('div', { className: 'space-y-8' },
      // HUD
      React.createElement('div', { className: 'flex justify-between items-end px-12' },
        React.createElement('div', { className: 'text-center' },
          React.createElement('div', { className: 'text-sm text-gray-500' }, '分数'),
          React.createElement('div', { className: 'text-4xl font-bold text-gray-800' }, score)
        ),
        React.createElement('div', { className: 'text-center' },
          React.createElement('div', {
            className: 'text-6xl font-black text-orange-500 italic transform -skew-x-12 transition-all',
            style: { transform: `scale(${1 + Math.min(combo, 20)/20}) skewX(-12deg)` }
          }, `x${combo}`),
          React.createElement('div', { className: 'text-sm text-orange-400 font-bold tracking-widest uppercase' }, 'COMBO')
        ),
        React.createElement('div', { className: 'text-center' },
          React.createElement('div', { className: 'text-sm text-gray-500' }, '时间'),
          React.createElement('div', {
            className: `text-4xl font-bold ${timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`
          }, `${timeLeft}s`)
        )
      ),

      // 目标和输入
      React.createElement('div', { className: `py-16 relative ${shake ? 'animate-shake' : ''}` },
        React.createElement('div', { className: 'text-7xl font-mono font-bold text-gray-800 mb-8 tracking-wider' }, target),
        React.createElement('input', {
          autoFocus: true,
          type: 'text',
          value: input,
          onChange: handleInput,
          className: 'w-full max-w-lg px-6 py-4 text-center text-3xl border-b-4 border-orange-500 focus:outline-none bg-transparent font-mono',
          placeholder: '开始输入...'
        }),
        shake && React.createElement('div', {
          className: 'absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none'
        },
          React.createElement('span', { className: 'text-red-500 text-4xl font-bold animate-ping' }, '❌')
        )
      )
    );
  };

  // ========== 渲染: 结束界面 ==========
  const renderFinishScreen = () => {
    return React.createElement('div', { className: 'bg-white p-10 rounded-xl shadow-lg animate-fade-in' },
      React.createElement('h3', { className: 'text-4xl font-bold text-gray-800 mb-6' }, '时间到！'),
      
      React.createElement('div', { className: 'grid grid-cols-2 gap-6 mb-8 max-w-md mx-auto' },
        React.createElement('div', { className: 'bg-gray-50 p-4 rounded-lg' },
          React.createElement('div', { className: 'text-gray-500' }, '最终分数'),
          React.createElement('div', { className: 'text-3xl font-bold text-indigo-600' }, score)
        ),
        React.createElement('div', { className: 'bg-orange-50 p-4 rounded-lg' },
          React.createElement('div', { className: 'text-gray-500' }, '最大连击'),
          React.createElement('div', { className: 'text-3xl font-bold text-orange-600' }, maxCombo)
        )
      ),

      React.createElement('div', { className: 'flex justify-center gap-4' },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-6 py-3 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50'
        }, '返回'),
        React.createElement('button', {
          onClick: startGame,
          className: 'px-8 py-3 bg-indigo-600 text-white font-bold rounded-lg hover:bg-indigo-700'
        }, '再玩一次')
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', { className: 'p-8 max-w-3xl mx-auto text-center' },
    // 顶部导航栏
    React.createElement('div', { className: 'flex justify-between items-center mb-8' },
      React.createElement('button', {
        onClick: onBack,
        className: 'text-gray-500 hover:text-gray-700'
      }, '← 返回'),
      React.createElement('h2', { className: 'text-3xl font-bold' }, '🔥 连击打字'),
      React.createElement('div', { className: 'w-8' })
    ),

    // 根据状态渲染内容
    !isActive && timeLeft === 60 && renderIntroScreen(),
    isActive && renderActiveScreen(),
    !isActive && timeLeft === 0 && renderFinishScreen()
  );
};

export default ComboGamePage;
