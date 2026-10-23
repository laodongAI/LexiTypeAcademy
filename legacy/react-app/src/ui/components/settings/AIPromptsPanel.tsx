/**
 * AI Prompt 模板管理面板
 * 
 * 功能:
 * - 查看预设模板
 * - 创建自定义模板
 * - 编辑模板变量
 * - 模板使用统计
 * 
 * 集成服务: PromptTemplateService
 */

import React, { useState, useEffect } from 'react';
import { 
  getPromptTemplateService,
  type PromptTemplate,
  type PromptCategory
} from '@/infrastructure/services/PromptTemplateService';

/**
 * AI Prompt 面板组件
 */
export const AIPromptsPanel: React.FC = () => {
  // ========== 状态管理 ==========
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<PromptCategory | 'all'>('all');
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  
  // 服务实例
  const templateService = getPromptTemplateService();

  // ========== 生命周期 ==========
  useEffect(() => {
    loadTemplates();
  }, [selectedCategory]);

  const loadTemplates = () => {
    if (selectedCategory === 'all') {
      setTemplates(templateService.getAllTemplates());
    } else {
      setTemplates(templateService.getTemplatesByCategory(selectedCategory));
    }
  };

  // ========== 分类配置 ==========
  const categories: { id: PromptCategory | 'all'; name: string; icon: string }[] = [
    { id: 'all', name: '全部', icon: '📚' },
    { id: 'course-generation', name: '课程生成', icon: '⚡' },
    { id: 'writing-analysis', name: '写作分析', icon: '✍️' },
    { id: 'vocabulary', name: '词汇扩展', icon: '📖' },
    { id: 'dialogue', name: '对话生成', icon: '💬' },
    { id: 'translation', name: '翻译', icon: '🌐' },
    { id: 'custom', name: '自定义', icon: '🔧' }
  ];

  // ========== 渲染 ==========
  return React.createElement('div', { className: 'space-y-6' },
    // 分类过滤器
    React.createElement('div', null,
      React.createElement('label', {
        className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'
      }, '模板分类'),
      React.createElement('div', { className: 'flex flex-wrap gap-2' },
        categories.map(cat =>
          React.createElement('button', {
            key: cat.id,
            onClick: () => setSelectedCategory(cat.id),
            className: `
              px-4 py-2 rounded-full text-sm font-medium transition-all
              ${selectedCategory === cat.id
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}
            `
          }, `${cat.icon} ${cat.name}`)
        )
      )
    ),

    // 模板列表
    React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-4' },
      templates.map(template =>
        React.createElement('div', {
          key: template.id,
          onClick: () => {
            setSelectedTemplate(template);
            setEditContent(template.template);
          },
          className: `
            p-4 border rounded-lg cursor-pointer transition-all
            ${selectedTemplate?.id === template.id
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'}
          `
        },
          // 标题行
          React.createElement('div', { className: 'flex items-center justify-between mb-2' },
            React.createElement('h4', {
              className: 'font-medium text-gray-900 dark:text-white'
            }, template.name),
            template.isBuiltIn 
              ? React.createElement('span', {
                  className: 'text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full'
                }, '预设')
              : React.createElement('span', {
                  className: 'text-xs px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full'
                }, '自定义')
          ),
          
          // 描述
          React.createElement('p', {
            className: 'text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2'
          }, template.description),
          
          // 元数据
          React.createElement('div', { className: 'flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400' },
            React.createElement('span', null, `📊 变量: ${template.variables.length}`),
            template.usageCount !== undefined && 
              React.createElement('span', null, `📈 使用: ${template.usageCount}次`),
            template.successRate !== undefined &&
              React.createElement('span', null, `✅ 成功率: ${(template.successRate * 100).toFixed(0)}%`)
          )
        )
      )
    ),

    // 模板详情/编辑区
    selectedTemplate && React.createElement('div', {
      className: 'bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4'
    },
      // 标题
      React.createElement('div', { className: 'flex items-center justify-between' },
        React.createElement('h3', {
          className: 'text-lg font-semibold text-gray-900 dark:text-white'
        }, `📝 ${selectedTemplate.name}`),
        React.createElement('div', { className: 'flex gap-2' },
          !selectedTemplate.isBuiltIn && React.createElement('button', {
            onClick: () => setIsEditing(!isEditing),
            className: 'px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700'
          }, isEditing ? '取消' : '编辑'),
          React.createElement('button', {
            onClick: () => setSelectedTemplate(null),
            className: 'px-3 py-1 text-sm text-gray-500 hover:text-gray-700'
          }, '✕')
        )
      ),

      // 变量列表
      React.createElement('div', null,
        React.createElement('h4', {
          className: 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '📌 模板变量'),
        React.createElement('div', { className: 'flex flex-wrap gap-2' },
          selectedTemplate.variables.map(v =>
            React.createElement('span', {
              key: v.name,
              title: v.description,
              className: `
                px-3 py-1 rounded-full text-sm
                ${v.required 
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}
              `
            }, `{{${v.name}}}${v.required ? '*' : ''}`)
          )
        )
      ),

      // 模板内容
      React.createElement('div', null,
        React.createElement('h4', {
          className: 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
        }, '📜 模板内容'),
        isEditing
          ? React.createElement('textarea', {
              value: editContent,
              onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value),
              rows: 10,
              className: 'w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-indigo-500'
            })
          : React.createElement('pre', {
              className: 'w-full px-4 py-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg overflow-x-auto text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap'
            }, selectedTemplate.template)
      ),

      // 保存按钮（编辑模式）
      isEditing && !selectedTemplate.isBuiltIn && React.createElement('div', { className: 'flex justify-end' },
        React.createElement('button', {
          onClick: () => {
            // 保存更新的模板
            // TODO: 实现模板更新
            setIsEditing(false);
            alert('模板保存功能开发中');
          },
          className: 'px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700'
        }, '💾 保存更改')
      )
    ),

    // 创建新模板按钮
    React.createElement('div', { className: 'pt-4 border-t border-gray-200 dark:border-gray-700' },
      React.createElement('button', {
        onClick: () => {
          alert('创建自定义模板功能开发中');
        },
        className: 'w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-indigo-400 hover:text-indigo-600 transition-colors'
      }, '➕ 创建自定义模板')
    ),

    // 统计信息
    React.createElement('div', {
      className: 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4'
    },
      React.createElement('div', { className: 'flex items-center gap-2 mb-2' },
        React.createElement('span', { className: 'text-blue-600 dark:text-blue-400' }, 'ℹ️'),
        React.createElement('span', {
          className: 'font-medium text-blue-800 dark:text-blue-300'
        }, '模板统计')
      ),
      React.createElement('div', { className: 'grid grid-cols-3 gap-4 text-sm' },
        React.createElement('div', { className: 'text-center' },
          React.createElement('p', { className: 'text-2xl font-bold text-blue-600 dark:text-blue-400' },
            templates.filter(t => t.isBuiltIn).length
          ),
          React.createElement('p', { className: 'text-blue-700 dark:text-blue-300' }, '预设模板')
        ),
        React.createElement('div', { className: 'text-center' },
          React.createElement('p', { className: 'text-2xl font-bold text-green-600 dark:text-green-400' },
            templates.filter(t => !t.isBuiltIn).length
          ),
          React.createElement('p', { className: 'text-green-700 dark:text-green-300' }, '自定义模板')
        ),
        React.createElement('div', { className: 'text-center' },
          React.createElement('p', { className: 'text-2xl font-bold text-purple-600 dark:text-purple-400' },
            templates.reduce((sum, t) => sum + (t.usageCount || 0), 0)
          ),
          React.createElement('p', { className: 'text-purple-700 dark:text-purple-300' }, '总使用次数')
        )
      )
    )
  );
};

export default AIPromptsPanel;
