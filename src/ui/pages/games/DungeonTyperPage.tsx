/**
 * 地牢打字游戏页面
 * 
 * 游戏玩法:
 * - 输入单词施放魔法攻击怪物
 * - 怪物会反击
 * - 保持生命值存活
 * 
 * 功能特性:
 * - 5 种怪物类型
 * - 等级系统
 * - 战斗日志
 * - 攻击动画
 */

import React, { useState } from 'react';

/** 组件 Props */
interface DungeonTyperPageProps {
  /** 返回游戏中心回调 */
  onBack: () => void;
}

/** 怪物接口 */
interface Monster {
  name: string;
  emoji: string;
  hp: number;
  maxHp: number;
  attack: number;
  word: string;
}

/** 怪物模板 */
const MONSTERS = [
  { name: '史莱姆', emoji: '💧', hp: 30, attack: 5 },
  { name: '哥布林', emoji: '👺', hp: 50, attack: 8 },
  { name: '骷髅', emoji: '💀', hp: 40, attack: 10 },
  { name: '幽灵', emoji: '👻', hp: 35, attack: 12 },
  { name: '龙', emoji: '🐉', hp: 100, attack: 20 },
];

/** 魔法单词列表 */
const WORDS = ['magic', 'sword', 'shield', 'potion', 'fire', 'ice', 'thunder', 'heal', 'power', 'light', 'dark', 'quest', 'hero', 'brave', 'fight'];

/** 游戏状态 */
type GameStatus = 'start' | 'playing' | 'lost';

/**
 * 地牢打字游戏页面组件
 */
const DungeonTyperPage: React.FC<DungeonTyperPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [playerHp, setPlayerHp] = useState(100);
  const maxPlayerHp = 100;
  const [level, setLevel] = useState(1);
  const [monster, setMonster] = useState<Monster | null>(null);
  const [input, setInput] = useState('');
  const [gameStatus, setGameStatus] = useState<GameStatus>('start');
  const [log, setLog] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [attackAnim, setAttackAnim] = useState<'player' | 'monster' | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  // ========== 添加日志 ==========
  const addLog = (msg: string) => {
    setLog(prev => [msg, ...prev].slice(0, 5));
  };

  // ========== 生成怪物 ==========
  const spawnMonster = () => {
    const template = MONSTERS[Math.floor(Math.random() * MONSTERS.length)];
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    setMonster({
      ...template,
      maxHp: template.hp + (level * 10),
      hp: template.hp + (level * 10),
      attack: template.attack + level,
      word
    });
    addLog(`野生的 ${template.name} 出现了!`);
  };

  // ========== 开始游戏 ==========
  const startGame = () => {
    setPlayerHp(100);
    setLevel(1);
    setGameStatus('playing');
    setLog([]);
    spawnMonster();
  };

  // ========== 输入处理 ==========
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gameStatus !== 'playing' || !monster) return;
    const val = e.target.value;
    setInput(val);

    if (val === monster.word) {
      // 玩家攻击
      setAttackAnim('player');
      setTimeout(() => setAttackAnim(null), 500);
      
      const damage = 20 + Math.floor(Math.random() * 10);
      const newHp = monster.hp - damage;
      addLog(`你施放了 "${val}"! 造成 ${damage} 伤害。`);
      
      if (newHp <= 0) {
        // 怪物被击败
        addLog(`${monster.name} 被击败了!`);
        setMonster(null);
        setInput('');
        setLevel(l => l + 1);
        // 略微恢复玩家生命
        setPlayerHp(h => Math.min(maxPlayerHp, h + 10));
        setTimeout(spawnMonster, 1000);
      } else {
        setMonster({ ...monster, hp: newHp, word: WORDS[Math.floor(Math.random() * WORDS.length)] });
        setInput('');
        
        // 怪物反击
        setTimeout(() => {
          if (gameStatus === 'playing') {
            setAttackAnim('monster');
            setShake(true);
            setTimeout(() => { setShake(false); setAttackAnim(null); }, 500);
            const dmg = monster.attack;
            setPlayerHp(h => {
              const nh = h - dmg;
              if (nh <= 0) {
                setGameStatus('lost');
              }
              return nh;
            });
            addLog(`${monster.name} 攻击! 你受到 ${dmg} 伤害。`);
          }
        }, 500);
      }
    }
  };

  // ========== 渲染: 开始界面 ==========
  const renderStartScreen = () => {
    return React.createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center bg-gray-900 rounded-xl text-white p-10'
    },
      React.createElement('div', { className: 'text-6xl mb-6' }, '🏰'),
      React.createElement('h1', { className: 'text-4xl font-bold mb-4' }, '地牢打字'),
      React.createElement('p', { className: 'text-gray-400 mb-8 text-center max-w-md' }, '输入魔法单词击败怪物！'),
      React.createElement('button', {
        onClick: startGame,
        className: 'px-8 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-lg transition-transform hover:scale-105'
      }, '开始冒险')
    );
  };

  // ========== 渲染: 战斗界面 ==========
  const renderBattleScreen = () => {
    if (!monster) return null;

    return React.createElement('div', {
      className: `flex-1 bg-gray-800 rounded-xl p-8 flex flex-col relative overflow-hidden ${shake ? 'animate-shake' : ''}`
    },
      // 战斗场景
      React.createElement('div', { className: 'flex-1 flex justify-between items-center px-10' },
        // 玩家
        React.createElement('div', {
          className: `text-center transition-transform ${attackAnim === 'player' ? 'translate-x-20' : ''}`
        },
          React.createElement('div', { className: 'text-6xl mb-4' }, '🧙‍♂️'),
          React.createElement('div', { className: 'w-32 h-4 bg-gray-700 rounded-full overflow-hidden mx-auto mb-2' },
            React.createElement('div', {
              className: 'h-full bg-green-500 transition-all',
              style: { width: `${(playerHp / maxPlayerHp) * 100}%` }
            })
          ),
          React.createElement('div', { className: 'text-white font-bold' }, `HP: ${playerHp}/${maxPlayerHp}`)
        ),

        // VS
        React.createElement('div', { className: 'text-gray-600 font-black text-4xl italic' }, 'VS'),

        // 怪物
        React.createElement('div', {
          className: `text-center transition-transform ${attackAnim === 'monster' ? '-translate-x-20' : ''}`
        },
          React.createElement('div', { className: 'text-8xl mb-4 animate-bounce-slow' }, monster.emoji),
          React.createElement('div', { className: 'w-32 h-4 bg-gray-700 rounded-full overflow-hidden mx-auto mb-2' },
            React.createElement('div', {
              className: 'h-full bg-red-500 transition-all',
              style: { width: `${(monster.hp / monster.maxHp) * 100}%` }
            })
          ),
          React.createElement('div', { className: 'text-white font-bold' }, monster.name),
          React.createElement('div', { className: 'text-red-400 text-sm' }, `ATK: ${monster.attack}`)
        )
      ),

      // 输入区域
      React.createElement('div', { className: 'mt-8 flex flex-col items-center z-10' },
        React.createElement('div', { className: 'text-yellow-400 text-sm mb-2 uppercase tracking-widest' }, '输入施法'),
        React.createElement('div', { className: 'bg-black bg-opacity-50 px-6 py-2 rounded-t-lg text-gray-400 font-mono text-xl' },
          monster.word
        ),
        React.createElement('input', {
          autoFocus: true,
          type: 'text',
          value: input,
          onChange: handleInput,
          className: 'w-full max-w-md px-6 py-4 text-center text-2xl bg-gray-700 text-white border-2 border-purple-500 rounded-lg focus:outline-none focus:border-purple-400 font-mono shadow-lg',
          placeholder: '施放魔法...'
        })
      ),

      // 战斗日志
      React.createElement('div', { className: 'absolute bottom-4 left-4 text-sm text-gray-400 font-mono space-y-1 pointer-events-none' },
        ...log.map((l, i) =>
          React.createElement('div', { key: i, className: 'opacity-70' }, l)
        )
      )
    );
  };

  // ========== 渲染: 失败界面 ==========
  const renderLostScreen = () => {
    return React.createElement('div', {
      className: 'flex-1 flex flex-col items-center justify-center bg-gray-900 rounded-xl text-white p-10'
    },
      React.createElement('div', { className: 'text-6xl mb-6' }, '💀'),
      React.createElement('h2', { className: 'text-4xl font-bold text-red-500 mb-4' }, '你死了'),
      React.createElement('p', { className: 'text-gray-400 mb-8' }, `你到达了等级 ${level}`),
      React.createElement('div', { className: 'flex gap-4' },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-6 py-2 border border-gray-600 rounded hover:bg-gray-800'
        }, '返回'),
        React.createElement('button', {
          onClick: startGame,
          className: 'px-6 py-2 bg-purple-600 rounded hover:bg-purple-500 font-bold'
        }, '重试')
      )
    );
  };

  // ========== 渲染: 帮助弹窗 ==========
  const renderHelpModal = () => {
    if (!showHelp) return null;

    return React.createElement('div', {
      className: 'fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50'
    },
      React.createElement('div', {
        className: 'bg-gray-800 p-8 rounded-xl max-w-md text-white border border-purple-500 shadow-2xl'
      },
        React.createElement('h2', { className: 'text-2xl font-bold mb-4 text-purple-400' }, '游戏帮助'),
        React.createElement('div', { className: 'space-y-3 text-gray-300 mb-6' },
          React.createElement('p', null, '⚔️ 输入单词攻击怪物'),
          React.createElement('p', null, '💀 击败怪物升级'),
          React.createElement('p', null, '❤️ 保持生命值存活'),
          React.createElement('p', null, '🐉 怪物会越来越强')
        ),
        React.createElement('button', {
          onClick: () => setShowHelp(false),
          className: 'w-full py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold transition-colors'
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
      React.createElement('h2', { className: 'text-3xl font-bold text-purple-800' }, '⚔️ 地牢打字'),
      React.createElement('div', { className: 'text-xl font-bold text-purple-600' }, `等级 ${level}`)
    ),

    // 根据状态渲染内容
    gameStatus === 'start' && renderStartScreen(),
    gameStatus === 'playing' && renderBattleScreen(),
    gameStatus === 'lost' && renderLostScreen(),

    // 帮助按钮
    gameStatus === 'playing' && React.createElement('button', {
      onClick: () => setShowHelp(true),
      className: 'fixed bottom-8 right-8 px-4 py-2 bg-purple-100 text-purple-600 rounded-full hover:bg-purple-200 text-sm font-bold shadow-lg'
    }, '? 帮助'),

    // 帮助弹窗
    renderHelpModal()
  );
};

export default DungeonTyperPage;
