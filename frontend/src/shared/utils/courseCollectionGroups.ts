/**
 * 通用课程集合分组（过渡实现）。
 *
 * 集合名通过课程 tags 中的 Collection: 前缀持久化，避免当前阶段新增数据库迁移。
 * 这不是独立的集合实体；后续如需集合排序、移动/归档和父子节点管理，应升级为正式 CourseCollection 表。
 */
import type { Course } from '../types/course'

export interface CourseCollectionGroup<T extends Course = Course> {
  key: string
  title: string
  courses: T[]
  isUncategorized: boolean
}

export function readCourseCollection(tags: string[] = []): string {
  const tag = tags.find((item) => String(item || '').startsWith('Collection:'))
  return tag ? tag.slice('Collection:'.length).trim() : ''
}

export function buildCourseCollectionGroups<T extends Course>(courses: T[]): CourseCollectionGroup<T>[] {
  const groups = new Map<string, CourseCollectionGroup<T>>()
  for (const course of courses) {
    const tags = course.tags ?? []
    const isTextbook = tags.includes('Textbook') || tags.some((tag) => String(tag || '').startsWith('Textbook:'))
    const title = readCourseCollection(tags) || (isTextbook ? '教材课程（切换教材视图查看层级）' : '')
    const key = title || '__uncategorized__'
    let group = groups.get(key)
    if (!group) {
      group = { key, title: title || '未归类课程', courses: [], isUncategorized: !title }
      groups.set(key, group)
    }
    group.courses.push(course)
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      courses: [...group.courses].sort((a, b) => a.title.localeCompare(b.title, 'zh-Hans-CN')),
    }))
    .sort((a, b) => {
      if (a.isUncategorized !== b.isUncategorized) return a.isUncategorized ? 1 : -1
      return a.title.localeCompare(b.title, 'zh-Hans-CN')
    })
}
