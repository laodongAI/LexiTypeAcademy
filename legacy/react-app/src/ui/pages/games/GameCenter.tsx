import React from 'react';

/**
 * 游戏中心（GameCenter）
 * - 负责展示所有可用的小游戏入口卡片，并支持点击选择进入具体游戏。
 * - 游戏列表目前使用硬编码中文配置（新版本不再支持国际化）。
 */

interface GameCenterProps {
  /** 当用户点击某个游戏卡片时触发，传入游戏的唯一 id */
  onSelectGame: (game: string) => void;
}

/** 游戏配置类型 */
interface GameConfig {
  id: string;
  icon: string;
  title: string;
  description: string;
  color: string;
}

/** 游戏列表配置 */
const GAME_LIST: GameConfig[] = [
  {
    id: 'word-challenge',
    icon: '💪',
    title: '单词挑战',
    description: '速度与准确性的极限挑战',
    color: 'bg-blue-100 hover:bg-blue-200'
  },
  {
    id: 'typing-racer',
    icon: '🏎️',
    title: '打字赛车',
    description: '与时间赛跑的打字游戏',
    color: 'bg-green-100 hover:bg-green-200'
  },
  {
    id: 'word-farm',
    icon: '🌾',
    title: '单词农场',
    description: '种植和收获你的词汇农场',
    color: 'bg-yellow-100 hover:bg-yellow-200'
  },
  {
    id: 'combo-game',
    icon: '⚡',
    title: '连击大师',
    description: '保持连击获取更高分数',
    color: 'bg-purple-100 hover:bg-purple-200'
  },
  {
    id: 'flight-game',
    icon: '✈️',
    title: '飞行射击',
    description: '在飞行中射击单词',
    color: 'bg-indigo-100 hover:bg-indigo-200'
  },
  {
    id: 'dungeon-typer',
    icon: '⚔️',
    title: '地牢打字师',
    description: '用打字魔法战胜怪物',
    color: 'bg-red-100 hover:bg-red-200'
  }
];

const GameCenter: React.FC<GameCenterProps> = ({ onSelectGame }) => {

  return (
    <div className="p-6 pt-10 max-w-6xl mx-auto">
      {/* 页面主标题：游戏中心 */}
      <h1 className="text-3xl font-bold mb-6">游戏中心</h1>

      {/* 使用响应式网格布局展示游戏卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {GAME_LIST.map((game) => (
          <div
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className={`${game.color} p-6 rounded-xl shadow-md cursor-pointer transition-all transform hover:scale-105`}
          >
            {/* 卡片标题包含图标与文本 */}
            <h2 className="text-2xl font-bold mb-2">{game.icon} {game.title}</h2>
            {/* 简要描述 */}
            <p className="text-gray-700">{game.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GameCenter;







