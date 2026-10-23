/**
 * 键盘可视化组件
 * DDD设计：UI层通用组件
 * 用于在打字练习中展示键盘布局，高亮提示下一个应按的键和当前按下的键
 */
import React from 'react';

interface KeyboardProps {
  /** 需要高亮的按键（例如 'A'、'Enter' 等），提示用户下一步应该按哪个键 */
  highlightKey?: string;
  /** 当前按下的按键，用于实时视觉反馈 */
  pressedKey?: string;
}

export function Keyboard({ highlightKey, pressedKey }: KeyboardProps) {
  // 美式键盘布局，按行划分
  const keyboardLayout = [
    [
      { key: '`', id: '`' },
      { key: '1', id: '1' },
      { key: '2', id: '2' },
      { key: '3', id: '3' },
      { key: '4', id: '4' },
      { key: '5', id: '5' },
      { key: '6', id: '6' },
      { key: '7', id: '7' },
      { key: '8', id: '8' },
      { key: '9', id: '9' },
      { key: '0', id: '0' },
      { key: '-', id: '-' },
      { key: '=', id: '=' },
      { key: 'Back', id: 'Backspace' },
    ],
    [
      { key: 'Tab', id: 'Tab' },
      { key: 'Q', id: 'Q' },
      { key: 'W', id: 'W' },
      { key: 'E', id: 'E' },
      { key: 'R', id: 'R' },
      { key: 'T', id: 'T' },
      { key: 'Y', id: 'Y' },
      { key: 'U', id: 'U' },
      { key: 'I', id: 'I' },
      { key: 'O', id: 'O' },
      { key: 'P', id: 'P' },
      { key: '[', id: '[' },
      { key: ']', id: ']' },
      { key: '\\', id: '\\' },
    ],
    [
      { key: 'Caps', id: 'Caps' },
      { key: 'A', id: 'A' },
      { key: 'S', id: 'S' },
      { key: 'D', id: 'D' },
      { key: 'F', id: 'F' },
      { key: 'G', id: 'G' },
      { key: 'H', id: 'H' },
      { key: 'J', id: 'J' },
      { key: 'K', id: 'K' },
      { key: 'L', id: 'L' },
      { key: ';', id: ';' },
      { key: '\'', id: '\'' },
      { key: 'Enter', id: 'Enter' },
    ],
    [
      { key: 'Shift', id: 'Shift_left' },
      { key: 'Z', id: 'Z' },
      { key: 'X', id: 'X' },
      { key: 'C', id: 'C' },
      { key: 'V', id: 'V' },
      { key: 'B', id: 'B' },
      { key: 'N', id: 'N' },
      { key: 'M', id: 'M' },
      { key: ',', id: ',' },
      { key: '.', id: '.' },
      { key: '/', id: '/' },
      { key: 'Shift', id: 'Shift_right' },
    ],
    [
      { key: 'Ctrl', id: 'Ctrl_left' },
      { key: 'Win', id: 'Win_left' },
      { key: 'Alt', id: 'Alt_left' },
      { key: 'Space', id: 'Space' },
      { key: 'Alt', id: 'Alt_right' },
      { key: 'Fn', id: 'Fn' },
      { key: 'Ctrl', id: 'Ctrl_right' },
    ],
  ];

  // 获取按键样式类名
  const getKeyClass = (key: string) => {
    const classes = ['border', 'rounded-lg', 'p-2', 'm-0.5', 'text-center', 'transition-all', 'duration-150'];
    
    // 按键宽度
    if (key === 'Space') {
      classes.push('w-[320px]');
    } else if (['Back', 'Tab', 'Caps', 'Shift', 'Enter'].includes(key)) {
      classes.push('min-w-[80px]');
    } else {
      classes.push('min-w-[50px]');
    }

    // 高亮状态（下一个应按的键）
    if (key.toLowerCase() === highlightKey?.toLowerCase()) {
      classes.push('bg-yellow-300', 'dark:bg-yellow-600', 'border-yellow-500', 'shadow-lg', 'scale-105');
    }
    // 按下状态
    else if (key.toLowerCase() === pressedKey?.toLowerCase()) {
      classes.push('bg-green-300', 'dark:bg-green-600', 'border-green-500', 'shadow-md');
    }
    // 默认状态
    else {
      classes.push('bg-white', 'dark:bg-gray-700', 'border-gray-300', 'dark:border-gray-600', 'shadow-sm', 'hover:shadow-md');
    }

    return classes.join(' ');
  };

  return React.createElement('div', {
    className: 'inline-block bg-gray-100 dark:bg-gray-800 p-4 rounded-xl shadow-md'
  },
    keyboardLayout.map((row, rowIndex) =>
      React.createElement('div', {
        key: `row-${rowIndex}`,
        className: 'flex justify-center mb-1'
      },
        row.map((keyObj) =>
          React.createElement('div', {
            key: keyObj.id,
            className: getKeyClass(keyObj.key)
          },
            React.createElement('span', {
              className: 'text-sm font-medium text-gray-800 dark:text-gray-200'
            }, keyObj.key)
          )
        )
      )
    )
  );
}

export default Keyboard;
