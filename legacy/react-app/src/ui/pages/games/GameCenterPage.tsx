/**
 * 游戏中心页面
 * DDD设计：UI层展示组件，提供游戏列表入口
 * 全部7个游戏已迁移完成
 */
import React, { useState } from 'react';
import WordChallengePage from './WordChallengePage';
import TypingRacerPage from './TypingRacerPage';
import WordFarmPage from './WordFarmPage';
import RhythmKeyPage from './RhythmKeyPage';
import ComboGamePage from './ComboGamePage';
import FlightGamePage from './FlightGamePage';
import DungeonTyperPage from './DungeonTyperPage';

interface GameCenterPageProps {
  onBack: () => void;
}

export function GameCenterPage({ onBack }: GameCenterPageProps) {
  const [selectedGame, setSelectedGame] = useState<string | null>(null);

  // 如果选择了游戏，渲染对应游戏页面
  if (selectedGame === 'word-challenge') {
    return React.createElement(WordChallengePage, {
      onExit: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'typing-racer') {
    return React.createElement(TypingRacerPage, {
      onBack: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'word-farm') {
    return React.createElement(WordFarmPage, {
      onBack: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'rhythm-key') {
    return React.createElement(RhythmKeyPage, {
      onBack: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'combo-game') {
    return React.createElement(ComboGamePage, {
      onBack: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'flight-game') {
    return React.createElement(FlightGamePage, {
      onBack: () => setSelectedGame(null)
    });
  }
  if (selectedGame === 'dungeon-typer') {
    return React.createElement(DungeonTyperPage, {
      onBack: () => setSelectedGame(null)
    });
  }
  // 游戏列表配置（简化版本，硬编码）
  const games = [
    {
      id: 'word-challenge',
      title: '单词挑战',
      icon: '⚡',
      description: '60秒内正确输入尽可能多的单词',
      color: 'bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30',
      status: '可玩'
    },
    {
      id: 'typing-racer',
      title: '打字赛车',
      icon: '🏎️',
      description: '与对手竞速，快速输入前进',
      color: 'bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30',
      status: '可玩'
    },
    {
      id: 'word-farm',
      title: '单词农场',
      icon: '🌾',
      description: '种植单词，收获金币',
      color: 'bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30',
      status: '可玩'
    },
    {
      id: 'rhythm-key',
      title: '节奏按键',
      icon: '🎵',
      description: '按A/S/D/F击打音符',
      color: 'bg-gradient-to-br from-pink-100 to-purple-100 dark:from-pink-900/30 dark:to-purple-900/30',
      status: '可玩'
    },
    {
      id: 'combo-game',
      title: '连击大师',
      icon: '🔥',
      description: '快速连续输入，打造最高连击',
      color: 'bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30',
      status: '可玩'
    },
    {
      id: 'flight-game',
      title: '飞行射击',
      icon: '✈️',
      description: '输入单词击落敌机',
      color: 'bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30',
      status: '可玩'
    },
    {
      id: 'dungeon-typer',
      title: '地牢探险',
      icon: '⚔️',
      description: '输入咒语击败怪物',
      color: 'bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30',
      status: '可玩'
    }
  ];

  const handleGameClick = (gameId: string) => {
    // 所有7个游戏都已迁移完成
    setSelectedGame(gameId);
  };

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800 p-8'
  },
    // 主内容
    React.createElement('div', {
      className: 'max-w-6xl mx-auto'
    },
      // 标题
      React.createElement('div', {
        className: 'text-center mb-12'
      },
        React.createElement('h1', {
          className: 'text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600 dark:from-purple-400 dark:to-pink-400'
        }, '🎮 游戏中心'),
        React.createElement('p', {
          className: 'text-xl text-gray-600 dark:text-gray-400'
        }, '在游戏中学习，寓教于乐')
      ),

      // 游戏网格
      React.createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
      }, games.map((game) =>
        React.createElement('div', {
          key: game.id,
          onClick: () => handleGameClick(game.id),
          className: `${game.color} p-6 rounded-2xl shadow-lg cursor-pointer transition-all transform hover:scale-105 hover:shadow-xl border border-white/50 dark:border-gray-700/50`
        },
          // 游戏图标和标题
          React.createElement('div', {
            className: 'flex items-center gap-3 mb-3'
          },
            React.createElement('span', {
              className: 'text-4xl'
            }, game.icon),
            React.createElement('h3', {
              className: 'text-xl font-bold text-gray-800 dark:text-white'
            }, game.title)
          ),

          // 游戏描述
          React.createElement('p', {
            className: 'text-gray-700 dark:text-gray-300 mb-4'
          }, game.description),

          // 状态标签
          React.createElement('div', {
            className: 'flex items-center justify-between'
          },
            React.createElement('span', {
              className: 'inline-block px-3 py-1 bg-white/60 dark:bg-gray-800/60 text-gray-600 dark:text-gray-400 text-sm rounded-full'
            }, game.status),
            React.createElement('span', {
              className: 'text-gray-500 dark:text-gray-400 text-sm'
            }, '点击体验 →')
          )
        )
      )),

      // 返回按钮
      React.createElement('div', {
        className: 'mt-12 text-center'
      },
        React.createElement('button', {
          onClick: onBack,
          className: 'px-8 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-md'
        }, '← 返回首页')
      )
    )
  );
}

export default GameCenterPage;
