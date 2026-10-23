/**
 * 单词农场游戏页面
 * 
 * 游戏玩法:
 * - 输入单词来种植、浇水、收获农作物
 * - 每个地块有不同的状态和操作
 * - 赚取金币来继续种植
 * 
 * 功能特性:
 * - 6 块地
 * - 4 种作物(apple, corn, carrot, grape)
 * - 自动生长进度条
 */

import React, { useState, useEffect } from 'react';

/** 组件 Props */
interface WordFarmPageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 地块状态类型 */
type PlotState = 'empty' | 'planted' | 'growing' | 'ripe';

/** 地块接口 */
interface Plot {
  id: number;
  state: PlotState;
  plantType?: string;
  progress: number; // 0-100
  word: string; // 当前需要输入的单词
}

/** 作物配置 */
const CROPS = [
  { name: 'apple', emoji: '🍎', price: 10, growTime: 5000 },
  { name: 'corn', emoji: '🌽', price: 5, growTime: 3000 },
  { name: 'carrot', emoji: '🥕', price: 8, growTime: 4000 },
  { name: 'grape', emoji: '🍇', price: 15, growTime: 6000 },
];

/**
 * 单词农场游戏页面组件
 */
const WordFarmPage: React.FC<WordFarmPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [money, setMoney] = useState(50);
  const [plots, setPlots] = useState<Plot[]>(
    Array(6).fill(null).map((_, i) => ({
      id: i,
      state: 'empty' as PlotState,
      progress: 0,
      word: 'plant' // 初始操作
    }))
  );
  const [input, setInput] = useState('');
  const [message, setMessage] = useState('欢迎来到单词农场！');
  const [showHelp, setShowHelp] = useState(false);

  // ========== 生长定时器 ==========
  useEffect(() => {
    const timer = setInterval(() => {
      setPlots(prev => prev.map(p => {
        if (p.state === 'growing') {
          const newProgress = p.progress + 10; // 模拟生长
          if (newProgress >= 100) {
            return { ...p, state: 'ripe', progress: 100, word: 'harvest' };
          }
          return { ...p, progress: newProgress };
        }
        return p;
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // ========== 输入处理 ==========
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase();
    setInput(val);

    // 检查是否匹配任何地块的单词
    const matchedPlot = plots.find(p => p.word === val);
    if (matchedPlot) {
      performAction(matchedPlot);
      setInput('');
    }
  };

  // ========== 执行操作 ==========
  const performAction = (plot: Plot) => {
    setPlots(prev => prev.map(p => {
      if (p.id !== plot.id) return p;

      if (p.state === 'empty' && p.word === 'plant') {
        // 种植随机作物
        const crop = CROPS[Math.floor(Math.random() * CROPS.length)];
        setMessage(`种植了 ${crop.name}!`);
        return { ...p, state: 'planted', plantType: crop.name, word: 'water', progress: 0 };
      }
      if (p.state === 'planted' && p.word === 'water') {
        setMessage('浇水了！正在生长...');
        return { ...p, state: 'growing', word: '...' }; // 生长中无操作
      }
      if (p.state === 'ripe' && p.word === 'harvest') {
        const crop = CROPS.find(c => c.name === p.plantType);
        const value = crop ? crop.price : 0;
        setMoney(m => m + value);
        setMessage(`收获了 ${crop?.emoji}! +$${value}`);
        return { ...p, state: 'empty', plantType: undefined, progress: 0, word: 'plant' };
      }
      return p;
    }));
  };

  // ========== 渲染: 地块 ==========
  const renderPlot = (plot: Plot) => {
    const crop = CROPS.find(c => c.name === plot.plantType);
    
    return React.createElement('div', {
      key: plot.id,
      className: 'bg-amber-100 border-4 border-amber-200 rounded-xl p-6 flex flex-col items-center justify-center h-48 relative'
    },
      // 作物图标
      React.createElement('div', { className: 'text-5xl mb-2' },
        plot.state === 'empty' && '🕳️',
        plot.state === 'planted' && '🌱',
        plot.state === 'growing' && '🌿',
        plot.state === 'ripe' && (crop?.emoji || '🍎')
      ),
      
      // 生长进度条
      plot.state === 'growing' && React.createElement('div', { className: 'w-full bg-gray-200 rounded-full h-2 mb-2' },
        React.createElement('div', {
          className: 'bg-green-500 h-2 rounded-full transition-all',
          style: { width: `${plot.progress}%` }
        })
      ),

      // 操作提示
      plot.word !== '...' && React.createElement('div', {
        className: 'bg-white px-3 py-1 rounded-full text-sm font-bold text-gray-700 border border-gray-300 shadow-sm'
      }, plot.word)
    );
  };

  // ========== 渲染: 帮助弹窗 ==========
  const renderHelpModal = () => {
    if (!showHelp) return null;

    return React.createElement('div', {
      className: 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'
    },
      React.createElement('div', {
        className: 'bg-white p-8 rounded-xl max-w-md text-gray-800 shadow-2xl border-4 border-green-400'
      },
        React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-green-600' }, '游戏帮助'),
        React.createElement('div', { className: 'space-y-3 text-gray-600 mb-6' },
          React.createElement('p', null, '🌱 输入 "plant" 种植作物'),
          React.createElement('p', null, '💧 输入 "water" 浇水'),
          React.createElement('p', null, '🌿 等待作物成熟'),
          React.createElement('p', null, '🍎 输入 "harvest" 收获')
        ),
        React.createElement('button', {
          onClick: () => setShowHelp(false),
          className: 'w-full py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-bold transition-colors'
        }, '关闭')
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', { className: 'p-8 max-w-4xl mx-auto h-full flex flex-col bg-green-50 rounded-xl' },
    // 顶部导航栏
    React.createElement('div', { className: 'flex justify-between items-center mb-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'text-gray-500 hover:text-gray-700'
      }, '← 返回'),
      React.createElement('h2', { className: 'text-3xl font-bold text-green-800' }, '🌾 单词农场'),
      React.createElement('div', { className: 'text-xl font-bold text-yellow-600 bg-white px-4 py-2 rounded-full shadow' },
        '💰 $', money
      )
    ),

    // 消息提示
    React.createElement('div', { className: 'bg-white p-4 rounded-lg shadow mb-6 text-center text-gray-600 italic' },
      message
    ),

    // 地块网格
    React.createElement('div', { className: 'grid grid-cols-3 gap-6 mb-8' },
      ...plots.map(plot => renderPlot(plot))
    ),

    // 输入框
    React.createElement('div', { className: 'mt-auto flex justify-center' },
      React.createElement('input', {
        autoFocus: true,
        type: 'text',
        value: input,
        onChange: handleInput,
        className: 'w-full max-w-md px-6 py-4 text-center text-2xl border-2 border-green-500 rounded-full focus:outline-none focus:ring-4 focus:ring-green-200 shadow-lg',
        placeholder: '输入操作单词...'
      })
    ),

    // 帮助按钮
    React.createElement('button', {
      onClick: () => setShowHelp(true),
      className: 'fixed bottom-8 right-8 px-4 py-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200 text-sm font-bold shadow-lg'
    }, '? 帮助'),

    // 帮助弹窗
    renderHelpModal()
  );
};

export default WordFarmPage;
