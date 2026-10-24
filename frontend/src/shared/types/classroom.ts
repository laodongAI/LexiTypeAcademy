/**
 * 课堂相关类型定义
 *
 * 说明：
 *   入口弹窗、课堂页与课程详情共用这些类型，避免在各页面重复声明。
 */

/** 课堂模式标识 */
export type ClassroomMode = 'reader' | 'burn-sentence' | 'burn-word' | 'root' | 'classic'

/** 进入课堂时携带的偏好设置 */
export interface ClassroomOptions {
  /** 是否启用鼠标悬停自动朗读 */
  hoverEnabled: boolean
  /** 是否显示中文提示 */
  showChinese: boolean
}
