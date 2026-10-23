/**
 * 课程权限和来源徽章组件
 * 用于显示课程的来源类型和权限状态
 */
import React from 'react';
import type { CourseSourceType } from '@/domain/models/CourseModel';

interface CourseSourceBadgeProps {
  sourceType: CourseSourceType;
  className?: string;
}

/**
 * 课程来源徽章
 */
export const CourseSourceBadge: React.FC<CourseSourceBadgeProps> = ({ sourceType, className = '' }) => {
  const config = {
    system: { label: '系统预设', icon: '⭐', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' },
    ai_generated: { label: 'AI生成', icon: '🤖', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    user_created: { label: '我的创作', icon: '✍️', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' },
    imported: { label: '导入课程', icon: '📥', color: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300' },
    audio_import: { label: '音频导入', icon: '🎵', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300' },
    material_parsed: { label: '教材解析', icon: '📖', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' }
  };

  const { label, icon, color } = config[sourceType] || config.user_created;

  return React.createElement('span', {
    className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${color} ${className}`,
    title: `来源: ${label}`
  },
    React.createElement('span', null, icon),
    React.createElement('span', null, label)
  );
};

interface ReadOnlyBadgeProps {
  className?: string;
}

/**
 * 只读徽章
 */
export const ReadOnlyBadge: React.FC<ReadOnlyBadgeProps> = ({ className = '' }) => {
  return React.createElement('span', {
    className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 ${className}`,
    title: '此课程为只读，不可编辑'
  },
    React.createElement('span', null, '🔒'),
    React.createElement('span', null, '只读')
  );
};

interface EditableBadgeProps {
  className?: string;
}

/**
 * 可编辑徽章
 */
export const EditableBadge: React.FC<EditableBadgeProps> = ({ className = '' }) => {
  return React.createElement('span', {
    className: `inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 ${className}`,
    title: '此课程可以编辑'
  },
    React.createElement('span', null, '✏️'),
    React.createElement('span', null, '可编辑')
  );
};

/**
 * 课程权限信息提示
 */
interface PermissionInfoProps {
  editable: boolean;
  deletable: boolean;
  exportable: boolean;
  shareable: boolean;
  sourceType: CourseSourceType;
}

export const PermissionInfo: React.FC<PermissionInfoProps> = ({
  editable,
  deletable,
  exportable,
  shareable,
  sourceType
}) => {
  const messages = {
    system: '系统预设课程，只读不可删除',
    ai_generated: 'AI生成课程，为保证内容完整性不可编辑，可删除和导出',
    audio_import: '音频导入课程，为保持音频同步不可编辑，可删除和导出',
    material_parsed: '教材解析课程，为保持版权完整性不可编辑，可删除',
    user_created: '用户创建课程，可自由编辑、删除、导出和分享',
    imported: '导入课程，可自由编辑、删除、导出和分享'
  };

  return React.createElement('div', {
    className: 'p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm'
  },
    React.createElement('div', {
      className: 'flex items-start gap-2'
    },
      React.createElement('span', {
        className: 'text-blue-600 dark:text-blue-400 text-lg'
      }, '💡'),
      React.createElement('div', {
        className: 'flex-1'
      },
        React.createElement('p', {
          className: 'text-blue-800 dark:text-blue-200 mb-2'
        }, messages[sourceType]),
        React.createElement('div', {
          className: 'flex flex-wrap gap-2 text-xs text-blue-700 dark:text-blue-300'
        },
          React.createElement('span', null, editable ? '✅ 可编辑' : '❌ 不可编辑'),
          React.createElement('span', null, deletable ? '✅ 可删除' : '❌ 不可删除'),
          React.createElement('span', null, exportable ? '✅ 可导出' : '❌ 不可导出'),
          React.createElement('span', null, shareable ? '✅ 可分享' : '❌ 不可分享')
        )
      )
    )
  );
};

export default {
  CourseSourceBadge,
  ReadOnlyBadge,
  EditableBadge,
  PermissionInfo
};
