/**
 * 节奏键盘游戏页面
 * 
 * 游戏玩法:
 * - 音符从上方落下
 * - 在正确时机按下对应按键(A/S/D/F)
 * - 保持连击和生命值
 * 
 * 功能特性:
 * - 4 个音轨(A/S/D/F)
 * - 连击系统
 * - 生命值系统
 * - 动态难度
 */

import React, { useState, useEffect, useRef } from 'react';

/** 组件 Props */
interface RhythmKeyPageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 音符接口 */
interface Note {
  id: number;
  char: string;
  y: number; // 0 到 100%
  lane: number; // 0-3
  hit?: boolean;
}

/** 音轨按键 */
const LANES = ['A', 'S', 'D', 'F'];

/** 下落速度 */
const SPEED = 0.8; // % per frame

/**
 * 节奏键盘游戏页面组件
 */
const RhythmKeyPage: React.FC<RhythmKeyPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [isPlaying, setIsPlaying] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [health, setHealth] = useState(100);
  const [showHelp, setShowHelp] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  
  // ========== Refs ==========
  const requestRef = useRef<number>();
  const lastSpawnTime = useRef(0);

  // ========== 游戏循环 ==========
  useEffect(() => {
    if (isPlaying && !gameOver) {
      const loop = (time: number) => {
        // 生成音符
        if (time - lastSpawnTime.current > 800) { // BPM 控制
          const lane = Math.floor(Math.random() * 4);
          setNotes(prev => [...prev, {
            id: Date.now(),
            char: LANES[lane],
            y: -10,
            lane
          }]);
          lastSpawnTime.current = time;
        }

        // 移动音符 & 检查 Miss
        setNotes(prev => {
          const nextNotes = prev.map(n => ({ ...n, y: n.y + SPEED }));
          
          // 检查遗漏(超过底部)
          const missed = nextNotes.filter(n => n.y > 110 && !n.hit);
          if (missed.length > 0) {
            setCombo(0);
            setHealth(h => Math.max(0, h - (missed.length * 10)));
          }

          return nextNotes.filter(n => n.y <= 110);
        });

        // 游戏结束检测
        if (health <= 0) {
          setGameOver(true);
        } else {
          requestRef.current = requestAnimationFrame(loop);
        }
      };
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, gameOver, health]);

  // ========== 开始游戏 ==========
  const startGame = () => {
    setNotes([]);
    setScore(0);
    setCombo(0);
    setHealth(100);
    setGameOver(false);
    setIsPlaying(true);
  };

  // ========== 按键监听 ==========
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isPlaying || gameOver) return;
      
      const key = e.key.toUpperCase();
      const laneIndex = LANES.indexOf(key);
      
      if (laneIndex === -1) return; // 不是游戏按键

      // 查找命中区域的音符(80% - 95%)
      setNotes(prev => {
        const targetNote = prev.find(n => n.lane === laneIndex && n.y > 75 && n.y < 95 && !n.hit);
        
        if (targetNote) {
          // 命中!
          setScore(s => s + 100 + (combo * 10));
          setCombo(c => c + 1);
          setHealth(h => Math.min(100, h + 2));
          return prev.map(n => n.id === targetNote.id ? { ...n, hit: true, y: 120 } : n);
        }
        return prev;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver, combo]);

  // ========== 渲染: 开始界面 ==========
  const renderStartScreen = () => {
    return React.createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center bg-gray-900 rounded-xl text-white p-10 shadow-xl'
    },
      React.createElement('div', { className: 'text-6xl mb-6 animate-bounce' }, '🎹'),
      React.createElement('h1', { className: 'text-4xl font-bold mb-4' }, '节奏键盘'),
      React.createElement('p', { className: 'text-gray-400 mb-8' }, '按 A/S/D/F 击打音符！'),
      React.createElement('button', {
        onClick: startGame,
        className: 'px-10 py-4 bg-pink-600 text-white text-xl font-bold rounded-full hover:bg-pink-700 shadow-lg transition-transform hover:scale-105'
      }, '开始游戏')
    );
  };

  // ========== 渲染: 游戏界面 ==========
  const renderGameScreen = () => {
    return React.createElement('div', { className: 'flex-1 bg-gray-900 rounded-xl relative overflow-hidden flex justify-center' },
      // 分数 HUD
      React.createElement('div', { className: 'absolute top-4 left-4 text-white' },
        React.createElement('div', { className: 'text-sm text-gray-400' }, 'SCORE'),
        React.createElement('div', { className: 'text-2xl font-bold' }, score)
      ),
      
      // 生命值 HUD
      React.createElement('div', { className: 'absolute top-4 right-4 text-white text-right' },
        React.createElement('div', { className: 'text-sm text-gray-400' }, 'HEALTH'),
        React.createElement('div', { className: 'w-32 h-3 bg-gray-700 rounded-full mt-1' },
          React.createElement('div', {
            className: `h-full rounded-full transition-all ${health < 30 ? 'bg-red-500' : 'bg-green-500'}`,
            style: { width: `${health}%` }
          })
        )
      ),
      
      // 连击显示
      combo > 1 && React.createElement('div', {
        className: 'absolute top-20 left-1/2 transform -translate-x-1/2 text-center z-10'
      },
        React.createElement('div', { className: 'text-4xl font-black text-yellow-400 italic animate-pulse' }, `${combo} COMBO`)
      ),

      // 音轨
      React.createElement('div', { className: 'w-full max-w-md h-full flex relative border-l-2 border-r-2 border-gray-700' },
        ...LANES.map((key, i) =>
          React.createElement('div', {
            key: i,
            className: 'flex-1 border-r border-gray-800 relative bg-gray-900 bg-opacity-50'
          },
            // 目标线
            React.createElement('div', { className: 'absolute bottom-10 left-0 w-full h-1 bg-pink-500 opacity-50' }),
            React.createElement('div', { className: 'absolute bottom-2 left-0 w-full text-center text-gray-500 font-bold text-xl' }, key)
          )
        ),

        // 音符
        ...notes.filter(note => !note.hit).map(note =>
          React.createElement('div', {
            key: note.id,
            className: 'absolute w-1/4 flex justify-center items-center',
            style: { 
              left: `${note.lane * 25}%`, 
              top: `${note.y}%`,
              height: '60px'
            }
          },
            React.createElement('div', {
              className: 'w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-purple-600 shadow-lg flex items-center justify-center text-white font-bold border-2 border-white'
            }, note.char)
          )
        )
      ),

      // 游戏结束覆盖层
      gameOver && React.createElement('div', {
        className: 'absolute inset-0 bg-black bg-opacity-80 flex flex-col items-center justify-center z-20'
      },
        React.createElement('h2', { className: 'text-5xl font-bold text-red-500 mb-4' }, 'GAME OVER'),
        React.createElement('div', { className: 'text-2xl text-white mb-8' }, `最终分数: ${score}`),
        React.createElement('div', { className: 'flex gap-4' },
          React.createElement('button', {
            onClick: onBack,
            className: 'px-6 py-3 border border-gray-500 text-white rounded hover:bg-gray-800'
          }, '返回'),
          React.createElement('button', {
            onClick: startGame,
            className: 'px-8 py-3 bg-pink-600 text-white font-bold rounded hover:bg-pink-700'
          }, '重试')
        )
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
        className: 'bg-white p-8 rounded-xl max-w-md text-gray-800',
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      },
        React.createElement('h3', { className: 'text-2xl font-bold mb-4' }, '📖 游戏帮助'),
        React.createElement('div', { className: 'text-gray-600 mb-6 leading-relaxed space-y-2' },
          React.createElement('p', null, '🎵 音符从上方落下'),
          React.createElement('p', null, '⌨️ 在正确时机按下 A/S/D/F'),
          React.createElement('p', null, '🔥 保持连击获得更高分数'),
          React.createElement('p', null, '❤️ 生命值归零游戏结束')
        ),
        React.createElement('button', {
          onClick: () => setShowHelp(false),
          className: 'w-full py-3 bg-pink-600 text-white rounded-lg font-bold'
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
      React.createElement('h2', { className: 'text-3xl font-bold text-pink-600' }, '🎵 节奏键盘'),
      React.createElement('button', {
        onClick: () => setShowHelp(true),
        className: 'px-4 py-2 bg-pink-100 text-pink-600 rounded-full hover:bg-pink-200 text-sm font-bold'
      }, '? 帮助')
    ),

    // 游戏内容区域 - 根据状态渲染
    !isPlaying && !gameOver && renderStartScreen(),
    (isPlaying || gameOver) && renderGameScreen(),

    // 帮助弹窗
    renderHelpModal()
  );
};

export default RhythmKeyPage;
