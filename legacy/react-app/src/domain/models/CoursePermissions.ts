/**
 * 课程权限规则配置
 * 
 * 定义不同来源课程的权限控制规则：
 * - system: 系统预设课程，只读
 * - ai_generated: AI生成课程，不可编辑但可删除
 * - user_created: 用户创建课程，完全可控
 * - imported: 导入课程，视为用户内容
 * - audio_import: 音频导入课程，不可编辑（保持音频同步）
 * - material_parsed: 教材解析课程，不可编辑（版权保护）
 */

import type { CourseSourceType, CoursePermissions } from './CourseModel';

// ========== 权限规则配置 ==========

/**
 * 权限规则配置对象
 */
interface PermissionRule extends CoursePermissions {
  /** 权限说明 */
  description: string;
}

/**
 * 各来源类型的权限规则矩阵
 */
export const PERMISSION_RULES: Record<CourseSourceType, PermissionRule> = {
  system: {
    editable: false,
    deletable: false,
    exportable: true,
    shareable: true,
    description: '系统预设课程，只读且不可删除'
  },
  ai_generated: {
    editable: false, // ⭐ AI生成内容不可编辑
    deletable: true,
    exportable: true,
    shareable: true,
    description: 'AI生成课程，可删除但不可编辑（保证AI内容完整性）'
  },
  user_created: {
    editable: true,
    deletable: true,
    exportable: true,
    shareable: true,
    description: '用户手动创建课程，拥有完全控制权'
  },
  imported: {
    editable: true, // 导入后视为用户内容
    deletable: true,
    exportable: true,
    shareable: true,
    description: '导入课程，视为用户内容可自由编辑'
  },
  audio_import: {
    editable: false, // 基于音频生成，编辑可能破坏音频对齐
    deletable: true,
    exportable: true,
    shareable: true,
    description: '音频导入课程，不可编辑（保持音频同步）'
  },
  material_parsed: {
    editable: false, // 教材解析内容，保持原版权完整性
    deletable: true,
    exportable: true,
    shareable: false, // 版权考虑
    description: '教材解析课程，不可编辑（版权保护）'
  }
};

// ========== 辅助函数 ==========

/**
 * 根据课程来源类型获取权限配置
 * @param sourceType 课程来源类型
 * @returns 权限配置对象
 */
export function getPermissions(sourceType: CourseSourceType): CoursePermissions {
  const rule = PERMISSION_RULES[sourceType];
  return {
    editable: rule.editable,
    deletable: rule.deletable,
    exportable: rule.exportable,
    shareable: rule.shareable
  };
}

/**
 * 检查课程是否可编辑
 * @param sourceType 课程来源类型
 * @returns 是否可编辑
 */
export function canEdit(sourceType: CourseSourceType): boolean {
  return PERMISSION_RULES[sourceType].editable;
}

/**
 * 检查课程是否可删除
 * @param sourceType 课程来源类型
 * @returns 是否可删除
 */
export function canDelete(sourceType: CourseSourceType): boolean {
  return PERMISSION_RULES[sourceType].deletable;
}

/**
 * 检查课程是否可导出
 * @param sourceType 课程来源类型
 * @returns 是否可导出
 */
export function canExport(sourceType: CourseSourceType): boolean {
  return PERMISSION_RULES[sourceType].exportable;
}

/**
 * 检查课程是否可分享
 * @param sourceType 课程来源类型
 * @returns 是否可分享
 */
export function canShare(sourceType: CourseSourceType): boolean {
  return PERMISSION_RULES[sourceType].shareable;
}

/**
 * 获取权限说明文本
 * @param sourceType 课程来源类型
 * @returns 权限说明
 */
export function getPermissionDescription(sourceType: CourseSourceType): string {
  return PERMISSION_RULES[sourceType].description;
}

/**
 * 获取用户友好的权限消息（用于UI显示）
 * @param sourceType 课程来源类型
 * @returns 权限提示消息
 */
export function getPermissionMessage(sourceType: CourseSourceType): string {
  const rule = PERMISSION_RULES[sourceType];
  
  if (rule.editable) {
    return '✅ 此课程可以自由编辑和修改';
  }
  
  // 不可编辑，说明原因
  switch (sourceType) {
    case 'system':
      return '🔒 系统预设课程，无法编辑或删除';
    case 'ai_generated':
      return '🔒 AI生成课程为只读，编辑可能破坏AI内容完整性。可删除或导出。';
    case 'audio_import':
      return '🔒 音频导入课程为只读，编辑可能破坏音频同步。可删除或导出。';
    case 'material_parsed':
      return '🔒 教材解析课程为只读，编辑可能违反版权。可删除或导出（不可分享）。';
    default:
      return '🔒 此课程为只读';
  }
}
