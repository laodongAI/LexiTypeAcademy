/**
 * 技能雷达图组件
 * 
 * 功能：
 * - 显示五维技能评估（准确度/流畅度/完整度/稳定性/进步）
 * - 支持对比多个时间段的数据
 * 
 * 基于需求文档：english-learning-requirements-v0.4.0.md
 * 第 3.0.4 节 - 学习仪表盘可视化
 */

import React from 'react';
import type { SkillRadarData } from '@/domain/services/LearningProgressVisualizationService';

interface SkillRadarChartProps {
  /** 技能数据 */
  data: SkillRadarData;
  /** 尺寸 */
  size?: number;
  /** 是否显示标签 */
  showLabels?: boolean;
}

/**
 * 技能雷达图组件
 */
export const SkillRadarChart: React.FC<SkillRadarChartProps> = ({
  data,
  size = 300,
  showLabels = true
}) => {
  const center = size / 2;
  const maxRadius = center - 60;

  // 技能维度配置
  const dimensions = [
    { key: 'accuracy' as keyof SkillRadarData, label: '准确度', icon: '🎯' },
    { key: 'fluency' as keyof SkillRadarData, label: '流畅度', icon: '🌊' },
    { key: 'completeness' as keyof SkillRadarData, label: '完整度', icon: '✅' },
    { key: 'consistency' as keyof SkillRadarData, label: '稳定性', icon: '📊' },
    { key: 'improvement' as keyof SkillRadarData, label: '进步度', icon: '📈' }
  ];

  // 计算每个维度的坐标点
  const getPoint = (index: number, value: number): { x: number; y: number } => {
    const angle = (Math.PI * 2 * index) / dimensions.length - Math.PI / 2;
    const radius = (value / 100) * maxRadius;
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle)
    };
  };

  // 生成背景网格的路径
  const generateGridPath = (percentage: number): string => {
    const points = dimensions.map((_, i) => getPoint(i, percentage));
    return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
  };

  // 生成数据区域的路径
  const dataPath = dimensions
    .map((dim, i) => {
      const point = getPoint(i, data[dim.key]);
      return `${i === 0 ? 'M' : 'L'} ${point.x} ${point.y}`;
    })
    .join(' ') + ' Z';

  return React.createElement('div', { 
    className: 'bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm' 
  },
    // 标题
    React.createElement('h3', { 
      className: 'text-lg font-semibold text-gray-900 dark:text-white mb-4' 
    }, 
      '技能评估雷达图'
    ),

    // SVG 雷达图
    React.createElement('svg', {
      width: size,
      height: size,
      className: 'mx-auto'
    },
      // 定义渐变
      React.createElement('defs', {},
        React.createElement('linearGradient', {
          id: 'radarGradient',
          x1: '0%',
          y1: '0%',
          x2: '100%',
          y2: '100%'
        },
          React.createElement('stop', {
            offset: '0%',
            stopColor: '#60a5fa',
            stopOpacity: '0.8'
          }),
          React.createElement('stop', {
            offset: '100%',
            stopColor: '#3b82f6',
            stopOpacity: '0.4'
          })
        )
      ),

      // 背景网格（同心多边形）
      [20, 40, 60, 80, 100].map((percentage) =>
        React.createElement('path', {
          key: `grid-${percentage}`,
          d: generateGridPath(percentage),
          fill: 'none',
          stroke: percentage === 100 ? '#9ca3af' : '#e5e7eb',
          strokeWidth: percentage === 100 ? 2 : 1,
          className: 'dark:stroke-gray-700'
        })
      ),

      // 坐标轴线
      dimensions.map((_, i) => {
        const endPoint = getPoint(i, 100);
        return React.createElement('line', {
          key: `axis-${i}`,
          x1: center,
          y1: center,
          x2: endPoint.x,
          y2: endPoint.y,
          stroke: '#d1d5db',
          strokeWidth: 1,
          className: 'dark:stroke-gray-700'
        });
      }),

      // 数据区域
      React.createElement('path', {
        d: dataPath,
        fill: 'url(#radarGradient)',
        stroke: '#3b82f6',
        strokeWidth: 2
      }),

      // 数据点
      dimensions.map((dim, i) => {
        const point = getPoint(i, data[dim.key]);
        return React.createElement('circle', {
          key: `point-${i}`,
          cx: point.x,
          cy: point.y,
          r: 4,
          fill: '#3b82f6',
          stroke: '#fff',
          strokeWidth: 2
        });
      })
    ),

    // 标签和数值
    showLabels && React.createElement('div', { className: 'mt-6 grid grid-cols-2 gap-3' },
      dimensions.map((dim) =>
        React.createElement('div', {
          key: dim.key,
          className: 'flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg p-3'
        },
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement('span', { className: 'text-xl' }, dim.icon),
            React.createElement('span', { className: 'text-sm font-medium text-gray-700 dark:text-gray-300' },
              dim.label
            )
          ),
          React.createElement('div', { className: 'flex items-center gap-2' },
            React.createElement('div', {
              className: 'w-20 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'
            },
              React.createElement('div', {
                className: 'h-full bg-blue-500 rounded-full transition-all',
                style: { width: `${data[dim.key]}%` }
              })
            ),
            React.createElement('span', { className: 'text-sm font-semibold text-gray-900 dark:text-white w-8 text-right' },
              data[dim.key]
            )
          )
        )
      )
    ),

    // 总体评价
    React.createElement('div', { className: 'mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg' },
      React.createElement('div', { className: 'flex items-center gap-2 mb-2' },
        React.createElement('span', { className: 'text-xl' }, '💡'),
        React.createElement('span', { className: 'font-semibold text-gray-900 dark:text-white' },
          '综合评价'
        )
      ),
      React.createElement('p', { className: 'text-sm text-gray-700 dark:text-gray-300' },
        getOverallAssessment(data)
      )
    )
  );
};

/**
 * 根据数据生成综合评价
 */
function getOverallAssessment(data: SkillRadarData): string {
  const avg = (data.accuracy + data.fluency + data.completeness + data.consistency + data.improvement) / 5;
  
  if (avg >= 85) {
    return '太棒了！你的英语学习能力全面均衡，继续保持！';
  } else if (avg >= 70) {
    return '进步明显！建议重点关注得分较低的维度，全面提升。';
  } else if (avg >= 50) {
    return '基础扎实，但还有很大提升空间。建议每天坚持练习。';
  } else {
    return '加油！学习是一个持续的过程，坚持就能看到进步！';
  }
}

export default SkillRadarChart;
