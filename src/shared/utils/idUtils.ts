/**
 * ID 生成工具
 * 
 * 为各个聚合根生成唯一标识符
 */

/**
 * 生成唯一 ID
 * 使用 timestamp + random 的组合，确保在单一应用中唯一
 */
export function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const counter = Math.floor(Math.random() * 1000).toString(36);
  return `${timestamp}-${random}-${counter}`;
}

/**
 * 生成 UUID 格式的 ID（如需要更严格的唯一性）
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * 生成特定前缀的 ID
 */
export function generateIdWithPrefix(prefix: string): string {
  return `${prefix}_${generateId()}`;
}

/**
 * 生成任务 ID
 */
export function generateTaskId(): string {
  return generateIdWithPrefix('task');
}

/**
 * 生成课程 ID
 */
export function generateCourseId(): string {
  return generateIdWithPrefix('course');
}

/**
 * 生成课时 ID
 */
export function generateLessonId(): string {
  return generateIdWithPrefix('lesson');
}
