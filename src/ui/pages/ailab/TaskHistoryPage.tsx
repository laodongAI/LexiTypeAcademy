/**
 * 任务历史页面
 * Phase 11 实现：展示所有 AI Lab 学习任务的历史记录
 * 
 * 集成服务: AILabTaskCenter
 */

import React, { useState, useEffect } from 'react';
import { 
  getAILabTaskCenter,
  TaskStatus,
  type AILabTask
} from '@/infrastructure/services/AILabTaskCenter';

interface TaskHistoryPageProps {
  onBack: () => void;
}

/**
 * 任务历史页面
 */
export const TaskHistoryPage: React.FC<TaskHistoryPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [tasks, setTasks] = useState<AILabTask[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'pending' | 'completed' | 'failed'>('all');
  const [selectedTask, setSelectedTask] = useState<AILabTask | null>(null);
  
  // 服务实例
  const taskCenter = getAILabTaskCenter();

  // ========== 生命周期 ==========
  useEffect(() => {
    loadTasks();
    // 定时刷新任务状态
    const interval = setInterval(loadTasks, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadTasks = () => {
    const allTasks = taskCenter.getAllTasks();
    setTasks(allTasks);
  };

  // ========== 过滤逻辑 ==========
  const filteredTasks = tasks.filter(task => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'pending') {
      return task.status === TaskStatus.QUEUED || task.status === TaskStatus.IN_PROGRESS;
    }
    if (selectedFilter === 'completed') return task.status === TaskStatus.COMPLETED;
    if (selectedFilter === 'failed') return task.status === TaskStatus.FAILED;
    return true;
  });

  // ========== 任务操作 ==========
  const handlePauseTask = async (taskId: string) => {
    await taskCenter.pauseTask(taskId);
    loadTasks();
  };

  const handleResumeTask = async (taskId: string) => {
    await taskCenter.resumeTask(taskId);
    loadTasks();
  };

  const handleCancelTask = async (taskId: string) => {
    if (confirm('确定要取消这个任务吗？')) {
      await taskCenter.cancelTask(taskId);
      loadTasks();
    }
  };

  // ========== 状态显示 ==========
  const getStatusBadge = (status: TaskStatus) => {
    const configs: Record<TaskStatus, { text: string; class: string; icon: string }> = {
      [TaskStatus.QUEUED]: { text: '排队中', class: 'bg-gray-100 text-gray-700', icon: '⏳' },
      [TaskStatus.IN_PROGRESS]: { text: '执行中', class: 'bg-blue-100 text-blue-700', icon: '🔄' },
      [TaskStatus.PAUSED]: { text: '已暂停', class: 'bg-yellow-100 text-yellow-700', icon: '⏸️' },
      [TaskStatus.COMPLETED]: { text: '已完成', class: 'bg-green-100 text-green-700', icon: '✅' },
      [TaskStatus.FAILED]: { text: '失败', class: 'bg-red-100 text-red-700', icon: '❌' },
      [TaskStatus.CANCELLED]: { text: '已取消', class: 'bg-gray-100 text-gray-500', icon: '🚫' }
    };
    const config = configs[status];
    return React.createElement('span', {
      className: `px-2 py-1 rounded-full text-xs font-medium ${config.class}`
    }, `${config.icon} ${config.text}`);
  };

  const getTaskTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'COURSE_GENERATION': '📚 课程生成',
      'AUDIO_TO_COURSE': '🎵 音频建课',
      'TEXTBOOK_IMPORT': '📖 教材导入',
      'WRITING_ANALYSIS': '✍️ 写作分析'
    };
    return labels[type] || type;
  };

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800'
  },
    // 返回按钮
    React.createElement('div', { className: 'max-w-6xl mx-auto pt-6 px-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm'
      }, '← 返回')
    ),

    // 主内容
    React.createElement('div', { className: 'max-w-6xl mx-auto p-6 space-y-6' },
      // 标题
      React.createElement('div', { className: 'text-center mb-8' },
        React.createElement('h1', { className: 'text-4xl font-bold text-gray-900 dark:text-white mb-2' }, '📋 任务历史'),
        React.createElement('p', { className: 'text-gray-600 dark:text-gray-400 text-lg' }, '查看所有 AI Lab 任务的执行历史和结果')
      ),

      // 统计卡片
      React.createElement('div', { className: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6' },
        [
          { label: '全部任务', value: tasks.length, color: 'bg-gray-100 text-gray-700' },
          { label: '进行中', value: tasks.filter(t => t.status === TaskStatus.IN_PROGRESS || t.status === TaskStatus.QUEUED).length, color: 'bg-blue-100 text-blue-700' },
          { label: '已完成', value: tasks.filter(t => t.status === TaskStatus.COMPLETED).length, color: 'bg-green-100 text-green-700' },
          { label: '失败', value: tasks.filter(t => t.status === TaskStatus.FAILED).length, color: 'bg-red-100 text-red-700' }
        ].map((stat, idx) =>
          React.createElement('div', {
            key: idx,
            className: `${stat.color} rounded-xl p-4 text-center`
          },
            React.createElement('p', { className: 'text-3xl font-bold' }, stat.value),
            React.createElement('p', { className: 'text-sm mt-1' }, stat.label)
          )
        )
      ),

      // 筛选栏
      React.createElement('div', { className: 'flex gap-3 mb-6 flex-wrap' },
        [
          { label: '全部', value: 'all' },
          { label: '进行中', value: 'pending' },
          { label: '已完成', value: 'completed' },
          { label: '已失败', value: 'failed' }
        ].map((filter) =>
          React.createElement('button', {
            key: filter.value,
            onClick: () => setSelectedFilter(filter.value as any),
            className: `px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedFilter === filter.value
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`
          }, filter.label)
        )
      ),

      // 任务列表
      filteredTasks.length > 0 
        ? React.createElement('div', { className: 'space-y-4' },
            filteredTasks.map(task =>
              React.createElement('div', {
                key: task.id,
                className: 'bg-white dark:bg-gray-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow'
              },
                // 任务头部
                React.createElement('div', { className: 'flex items-center justify-between mb-3' },
                  React.createElement('div', { className: 'flex items-center gap-3' },
                    React.createElement('span', { className: 'text-2xl' }, 
                      task.taskType === 'COURSE_GENERATION' ? '📚' :
                      task.taskType === 'AUDIO_TO_COURSE' ? '🎵' :
                      task.taskType === 'TEXTBOOK_IMPORT' ? '📖' : '✍️'
                    ),
                    React.createElement('div', null,
                      React.createElement('h4', { className: 'font-semibold text-gray-900 dark:text-white' },
                        getTaskTypeLabel(task.taskType)
                      ),
                      React.createElement('p', { className: 'text-xs text-gray-500' },
                        `ID: ${task.id.slice(0, 12)}...`
                      )
                    )
                  ),
                  getStatusBadge(task.status)
                ),
                
                // 进度条
                (task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.QUEUED) &&
                  React.createElement('div', { className: 'mb-3' },
                    React.createElement('div', { className: 'flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1' },
                      React.createElement('span', null, '进度'),
                      React.createElement('span', null, `${task.progress}%`)
                    ),
                    React.createElement('div', { className: 'h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden' },
                      React.createElement('div', {
                        className: 'h-full bg-blue-600 transition-all duration-300',
                        style: { width: `${task.progress}%` }
                      })
                    )
                  ),

                // 任务元数据
                React.createElement('div', { className: 'flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3' },
                  React.createElement('span', null, `⏱️ 创建: ${new Date(task.createdAt).toLocaleString()}`),
                  task.startedAt && React.createElement('span', null, `▶️ 开始: ${new Date(task.startedAt).toLocaleString()}`),
                  task.completedAt && React.createElement('span', null, `✅ 完成: ${new Date(task.completedAt).toLocaleString()}`)
                ),

                // 操作按钮
                React.createElement('div', { className: 'flex gap-2 pt-3 border-t border-gray-100 dark:border-gray-700' },
                  task.status === TaskStatus.IN_PROGRESS &&
                    React.createElement('button', {
                      onClick: () => handlePauseTask(task.id),
                      className: 'px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200'
                    }, '⏸️ 暂停'),
                  task.status === TaskStatus.PAUSED &&
                    React.createElement('button', {
                      onClick: () => handleResumeTask(task.id),
                      className: 'px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200'
                    }, '▶️ 继续'),
                  (task.status === TaskStatus.QUEUED || task.status === TaskStatus.IN_PROGRESS || task.status === TaskStatus.PAUSED) &&
                    React.createElement('button', {
                      onClick: () => handleCancelTask(task.id),
                      className: 'px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200'
                    }, '❌ 取消'),
                  React.createElement('button', {
                    onClick: () => setSelectedTask(task),
                    className: 'px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200'
                  }, '📋 详情')
                )
              )
            )
          )
        : // 空状态
          React.createElement('div', { className: 'bg-white dark:bg-gray-800 rounded-xl p-12 border border-gray-200 dark:border-gray-700 text-center' },
            React.createElement('div', { className: 'text-5xl mb-4' }, '📭'),
            React.createElement('h3', { className: 'text-2xl font-semibold text-gray-900 dark:text-white mb-2' }, '暂无任务'),
            React.createElement('p', { className: 'text-gray-600 dark:text-gray-400 mb-6' }, 
              selectedFilter === 'all' 
                ? '开始创建 AI 任务来查看历史记录'
                : `没有${selectedFilter === 'pending' ? '进行中的' : selectedFilter === 'completed' ? '已完成的' : '失败的'}任务`
            ),
            React.createElement('button', {
              onClick: onBack,
              className: 'px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
            }, '返回创建任务')
          ),

      // 任务详情模态框
      selectedTask && React.createElement('div', {
        className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4',
        onClick: () => setSelectedTask(null)
      },
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto',
          onClick: (e: React.MouseEvent) => e.stopPropagation()
        },
          React.createElement('div', { className: 'flex items-center justify-between mb-6' },
            React.createElement('h2', { className: 'text-xl font-bold text-gray-900 dark:text-white' }, '任务详情'),
            React.createElement('button', {
              onClick: () => setSelectedTask(null),
              className: 'text-gray-500 hover:text-gray-700'
            }, '✕')
          ),
          React.createElement('div', { className: 'space-y-4' },
            React.createElement('div', { className: 'grid grid-cols-2 gap-4' },
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '任务ID'),
                React.createElement('p', { className: 'font-mono text-sm' }, selectedTask.id)
              ),
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '类型'),
                React.createElement('p', { className: 'font-medium' }, getTaskTypeLabel(selectedTask.taskType))
              ),
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '状态'),
                getStatusBadge(selectedTask.status)
              ),
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '进度'),
                React.createElement('p', { className: 'font-medium' }, `${selectedTask.progress}%`)
              ),
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '错误次数'),
                React.createElement('p', { className: 'font-medium' }, selectedTask.error?.retryCount ?? 0)
              ),
              React.createElement('div', null,
                React.createElement('p', { className: 'text-sm text-gray-500' }, '优先级'),
                React.createElement('p', { className: 'font-medium capitalize' }, selectedTask.priority)
              )
            ),
            selectedTask.error && React.createElement('div', { className: 'p-4 bg-red-50 dark:bg-red-900/20 rounded-lg' },
              React.createElement('p', { className: 'text-sm text-red-800 dark:text-red-300' }, '错误信息:'),
              React.createElement('p', { className: 'font-mono text-sm text-red-600 dark:text-red-400 mt-1' }, selectedTask.error.message)
            ),
            selectedTask.output && React.createElement('div', { className: 'p-4 bg-green-50 dark:bg-green-900/20 rounded-lg' },
              React.createElement('p', { className: 'text-sm text-green-800 dark:text-green-300' }, '任务结果:'),
              React.createElement('pre', { className: 'font-mono text-xs text-green-600 dark:text-green-400 mt-1 overflow-x-auto' }, 
                JSON.stringify(selectedTask.output, null, 2)
              )
            )
          )
        )
      )
    )
  );
};

export default TaskHistoryPage;
