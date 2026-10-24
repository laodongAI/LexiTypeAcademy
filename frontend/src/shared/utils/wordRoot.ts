/**
 * 词根分组工具
 *
 * 目标：
 *   在不新增数据表的前提下，把课时词条按词根聚合成“词根组”。
 * 规则：
 *   1. 优先使用显式 rootGroupId；
 *   2. 否则用 root（小写、去连字符）作为组键；
 *   3. 无词根时按词性降级分组，保证页面始终可用；
 *   4. 组内词根词优先，其余按例句数量与词长排序。
 */

import type { LessonItem } from '../types/course'

/** 词根组结构 */
export interface WordRootGroup {
  /** 组唯一键 */
  key: string
  /** 组标题（词根或词性） */
  label: string
  /** 词根含义（可选） */
  meaning?: string
  /** 是否为降级分组（内容未标注词根） */
  inferred: boolean
  /** 组内词条 */
  items: LessonItem[]
}

/**
 * 归一化词根文本
 * @param root 原始词根
 * @returns 小写、去首尾空白与连字符的结果
 */
export function normalizeRoot(root?: string): string {
  return (root || '').trim().toLowerCase().replace(/^-+|-+$/g, '')
}

/**
 * 按词根对课时词条分组
 * @param items 课时词条
 * @returns 词根组数组；空输入返回空数组
 */
export function groupItemsByRoot(items: LessonItem[]): WordRootGroup[] {
  if (!items || items.length === 0) return []

  // 分组容器：key -> 组
  const groups = new Map<string, WordRootGroup>()

  items.forEach(item => {
    // 组键优先级：显式 rootGroupId > 归一化 root > 词性降级
    const explicitRoot = normalizeRoot(item.root)
    const groupId = (item.rootGroupId || '').trim()
    const key = groupId || (explicitRoot ? `root:${explicitRoot}` : `pos:${item.partOfSpeech || 'other'}`)
    const inferred = !groupId && !explicitRoot

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: inferred
          ? (item.partOfSpeech || '其他')
          : (item.root || explicitRoot),
        meaning: inferred ? undefined : item.rootMeaning,
        inferred,
        items: [],
      })
    }

    groups.get(key)!.items.push(item)
  })

  // 组内排序：词根词优先，其次例句多者优先，最后短词优先
  groups.forEach(group => {
    group.items.sort((a, b) => {
      const roleScore = (item: LessonItem) => (item.rootRole === 'root' ? 0 : 1)
      if (roleScore(a) !== roleScore(b)) return roleScore(a) - roleScore(b)
      const exampleDiff = (b.examples?.length || 0) - (a.examples?.length || 0)
      if (exampleDiff !== 0) return exampleDiff
      return a.english.length - b.english.length
    })
  })

  // 组间排序：真实词根组优先，组内词多者优先
  return Array.from(groups.values()).sort((a, b) => {
    if (a.inferred !== b.inferred) return a.inferred ? 1 : -1
    return b.items.length - a.items.length
  })
}
