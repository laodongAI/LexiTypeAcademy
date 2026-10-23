/**
 * 学习热力图组件
 * 
 * 功能：
 * - 显示类似GitHub的贡献热力图
 * - 支持点击查看每日详情
 * - 显示学习强度和目标达成情况
 * 
 * 基于需求文档：english-learning-requirements-v0.4.0.md
 * 第 8.3 节 - 学习热力图验证与点击深入
 */

import React, { useState, useMemo } from 'react';
import type { HeatmapDataPoint, DayDetailData } from '@/domain/services/LearningProgressVisualizationService';

interface LearningHeatmapProps {
  /** 热力图数据 */
  data: HeatmapDataPoint[];
  /** 每日详情数据获取函数 */
  onDateClick?: (date: string) => DayDetailData | null;
  /** 每日目标时长（分钟） */
  dailyGoalMinutes?: number;
}

/**
 * 学习热力图组件
 */
export const LearningHeatmap: React.FC<LearningHeatmapProps> = ({
  data,
  onDateClick,
  dailyGoalMinutes = 15
}) => {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // 按周分组数据
  const weeklyData = useMemo(() => {
    const weeks: HeatmapDataPoint[][] = [];
    let currentWeek: HeatmapDataPoint[] = [];

    for (let i = 0; i < data.length; i++) {
      currentWeek.push(data[i]);
      
      if (currentWeek.length === 7) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [data]);

  // 获取强度对应的颜色
  const getIntensityColor = (intensity: HeatmapDataPoint['intensity']): string => {
    const colors = {
      none: 'bg-gray-100 dark:bg-gray-800',
      light: 'bg-green-200 dark:bg-green-900',
      medium: 'bg-green-400 dark:bg-green-700',
      heavy: 'bg-green-600 dark:bg-green-500'
    };
    return colors[intensity];
  };

  // 处理日期点击
  const handleDateClick = (dateData: HeatmapDataPoint) => {
    setSelectedDate(dateData.date);
    setShowDetail(true);
  };

  // 获取详情数据
  const detailData = useMemo(() => {
    if (!selectedDate || !onDateClick) return null;
    return onDateClick(selectedDate);
  }, [selectedDate, onDateClick]);

  return React.createElement('div', { className: 'bg-white dark:bg-gray-900 rounded-lg p-6 shadow-sm' },
    // 标题
    React.createElement('div', { className: 'mb-6' },
      React.createElement('h3', { className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2' }, 
        '学习活动热力图'
      ),
      React.createElement('p', { className: 'text-sm text-gray-600 dark:text-gray-400' },
        `每日目标：${dailyGoalMinutes}分钟 · 点击日期查看详情`
      )
    ),

    // 热力图主体
    React.createElement('div', { className: 'mb-6 overflow-x-auto' },
      React.createElement('div', { className: 'inline-flex flex-col gap-1' },
        // 星期标签
        React.createElement('div', { className: 'flex gap-1 mb-2 ml-12' },
          ['日', '一', '二', '三', '四', '五', '六'].map((day, i) =>
            React.createElement('div', {
              key: i,
              className: 'w-4 h-4 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-center'
            }, day)
          )
        ),

        // 热力图网格
        weeklyData.map((week, weekIndex) =>
          React.createElement('div', {
            key: weekIndex,
            className: 'flex gap-1'
          },
            // 周数标签
            React.createElement('div', {
              className: 'w-10 text-xs text-gray-500 dark:text-gray-400 flex items-center justify-end mr-2'
            }, `W${weekIndex + 1}`),

            // 本周的日期格子
            week.map((dayData) =>
              React.createElement('button', {
                key: dayData.date,
                onClick: () => handleDateClick(dayData),
                className: `w-4 h-4 rounded-sm transition-all hover:ring-2 hover:ring-blue-500 ${getIntensityColor(dayData.intensity)}`,
                title: `${dayData.date}\n练习 ${dayData.count} 次\n时长 ${Math.round(dayData.totalDuration)} 分钟\n平均分 ${Math.round(dayData.averageScore)}`
              })
            )
          )
        )
      )
    ),

    // 图例
    React.createElement('div', { className: 'flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400' },
      React.createElement('span', {}, '强度:'),
      React.createElement('div', { className: 'flex items-center gap-2' },
        ['无', '轻', '中', '重'].map((label, i) =>
          React.createElement('div', {
            key: i,
            className: 'flex items-center gap-1'
          },
            React.createElement('div', {
              className: `w-3 h-3 rounded-sm ${getIntensityColor(['none', 'light', 'medium', 'heavy'][i] as any)}`
            }),
            React.createElement('span', { className: 'text-xs' }, label)
          )
        )
      )
    ),

    // 详情模态框
    showDetail && detailData && React.createElement('div', {
      className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50',
      onClick: () => setShowDetail(false)
    },
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto',
        onClick: (e: React.MouseEvent) => e.stopPropagation()
      },
        // 详情标题
        React.createElement('div', { className: 'flex items-center justify-between mb-4' },
          React.createElement('h4', { className: 'text-xl font-semibold text-gray-900 dark:text-white' },
            `${selectedDate} 学习详情`
          ),
          React.createElement('button', {
            onClick: () => setShowDetail(false),
            className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
          }, '✕')
        ),

        // 统计卡片
        React.createElement('div', { className: 'grid grid-cols-3 gap-4 mb-6' },
          [
            { label: '总时长', value: `${Math.round(detailData.totalDuration)}分钟`, icon: '⏱️' },
            { label: '练习次数', value: detailData.practiceCount, icon: '📝' },
            { label: '平均分', value: Math.round(detailData.averageScore), icon: '⭐' }
          ].map((stat, i) =>
            React.createElement('div', {
              key: i,
              className: 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4'
            },
              React.createElement('div', { className: 'text-2xl mb-1' }, stat.icon),
              React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400' }, stat.label),
              React.createElement('div', { className: 'text-xl font-semibold text-gray-900 dark:text-white' }, stat.value)
            )
          )
        ),

        // 课程列表
        React.createElement('div', { className: 'mb-6' },
          React.createElement('h5', { className: 'text-lg font-semibold text-gray-900 dark:text-white mb-3' },
            '课程练习记录'
          ),
          React.createElement('div', { className: 'space-y-2' },
            detailData.courses.map((course, i) =>
              React.createElement('div', {
                key: i,
                className: 'flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3'
              },
                React.createElement('div', {},
                  React.createElement('div', { className: 'font-medium text-gray-900 dark:text-white' },
                    course.courseName
                  ),
                  React.createElement('div', { className: 'text-sm text-gray-600 dark:text-gray-400' },
                    `练习 ${course.practiceCount} 次`
                  )
                ),
                React.createElement('div', { className: 'text-lg font-semibold text-green-600 dark:text-green-400' },
                  `${Math.round(course.averageScore)}分`
                )
              )
            )
          )
        ),

        // 错误分布
        React.createElement('div', {},
          React.createElement('h5', { className: 'text-lg font-semibold text-gray-900 dark:text-white mb-3' },
            '错误类型分布'
          ),
          React.createElement('div', { className: 'grid grid-cols-2 gap-3' },
            Object.entries(detailData.errorDistribution).map(([type, count]) =>
              React.createElement('div', {
                key: type,
                className: 'flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3'
              },
                React.createElement('span', { className: 'text-sm text-gray-600 dark:text-gray-400 capitalize' },
                  type
                ),
                React.createElement('span', { className: 'text-lg font-semibold text-gray-900 dark:text-white' },
                  count
                )
              )
            )
          )
        )
      )
    )
  );
};

export default LearningHeatmap;
