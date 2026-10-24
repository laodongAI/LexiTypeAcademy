/**
 * 课程教材分组工具
 *
 * 目的：
 *   - 把扁平课程列表整理成「教材系列 → 年级册 → 单元课程」三级结构；
 *   - 历史课程没有显式分级标签时，从标题/描述回退解析，保证兼容旧数据；
 *   - 纯函数实现，不依赖组件与仓库，便于单测与复用。
 */

import type { Course } from '../types/course'

/** 教材单元条目：叶子节点，对应一个课程 */
export interface TextbookUnitEntry<T extends Course = Course> {
  /** 单元唯一键（课程 ID，保证唯一） */
  key: string
  /** 单元展示名（去掉教材名前缀后的单元标题） */
  title: string
  /** 单元序号（解析不到时为 0） */
  unitNumber: number
  /** 原始课程对象（保留调用方的扩展字段，如 source/inLearningList） */
  course: T
  /** 课时数量（用于列表展示） */
  lessonCount: number
}

/** 年级册分组：同一本教材（年级 + 上下册）下的单元集合 */
export interface TextbookVolumeGroup<T extends Course = Course> {
  /** 年级册唯一键 */
  key: string
  /** 教材名称（可能包含年级与册次） */
  textbookName: string
  /** 年级（如“三年级”，未知时为空字符串） */
  grade: string
  /** 册次（“上” / “下”，未知时为空字符串） */
  semester: string
  /** 年级册展示标题（如“三年级 · 上册”） */
  label: string
  /** 单元课程列表 */
  units: TextbookUnitEntry<T>[]
}

/** 教材系列分组：出版社 + 系列 */
export interface TextbookSeriesGroup<T extends Course = Course> {
  /** 系列唯一键 */
  key: string
  /** 出版社（未知时为“未标注出版社”） */
  publisher: string
  /** 教材系列（未知时为“未标注系列”） */
  series: string
  /** 系列展示标题（如“人教版 · 七年级”） */
  label: string
  /** 系列内年级册列表 */
  volumes: TextbookVolumeGroup<T>[]
  /** 系列内课程总数 */
  courseCount: number
}

/** 教材分组结果 */
export interface TextbookGroupResult<T extends Course = Course> {
  /** 教材系列分组 */
  series: TextbookSeriesGroup<T>[]
  /** 非教材课程（保持原列表视图行为） */
  others: T[]
}

/** 年级排序表：按常见学段顺序排列，未命中时排在最后 */
const GRADE_ORDER: string[] = [
  '幼儿园', '学前', '小班', '中班', '大班',
  '一年级', '二年级', '三年级', '四年级', '五年级', '六年级',
  '七年级', '八年级', '九年级',
  '高一', '高二', '高三',
]

/** 年级正则：兼容中文年级与“Grade 3”形式 */
const GRADE_PATTERN = /(幼儿园|学前|小班|中班|大班|[一二三四五六七八九]年级|七[年级]|八[年级]|九[年级]|高[一二三]|Grade\s*\d+)/i

/**
 * 从标签中读取指定前缀的值
 * @param tags 课程标签
 * @param prefix 前缀（如 `Textbook:`）
 * @returns 去掉前缀后的值；不存在时返回空字符串
 */
function readTagValue(tags: string[], prefix: string): string {
  const hit = tags.find(tag => tag.startsWith(prefix))
  return hit ? hit.slice(prefix.length).trim() : ''
}

/**
 * 安全拆分字符串
 * @param value 原始字符串
 * @param separator 分隔符
 * @returns 去空白后的片段数组
 */
function splitTrim(value: string, separator: string): string[] {
  return String(value || '')
    .split(separator)
    .map(part => part.trim())
    .filter(Boolean)
}

/**
 * 解析年级册信息
 * @param textbookName 教材名（可能包含年级/册次）
 * @param gradeTag 显式年级标签
 * @param semesterTag 显式册次标签
 * @returns 年级与册次
 */
function parseGradeInfo(
  textbookName: string,
  gradeTag: string,
  semesterTag: string,
): { grade: string; semester: string } {
  // 显式标签优先，其次从教材名中提取
  const grade = gradeTag || textbookName.match(GRADE_PATTERN)?.[1] || ''
  const semester = semesterTag || textbookName.match(/(上|下)(册|学期)/)?.[1] || ''
  return { grade, semester }
}

/**
 * 解析单元序号
 * @param unitTitle 单元标题（如“Unit 3 My friends”）
 * @returns 序号；解析不到时返回 0
 */
function parseUnitNumber(unitTitle: string): number {
  const match = unitTitle.match(/Unit\s*(\d+)/i) || unitTitle.match(/第\s*(\d+)\s*单元/)
  return match ? Number(match[1]) || 0 : 0
}

/**
 * 年级排序权重
 * @param grade 年级字符串
 * @returns 排序值，越小越靠前
 */
function gradeWeight(grade: string): number {
  const index = GRADE_ORDER.indexOf(grade)
  return index >= 0 ? index : GRADE_ORDER.length
}

/**
 * 册次排序权重
 * @param semester 册次（上/下）
 * @returns 排序值，越小越靠前
 */
function semesterWeight(semester: string): number {
  if (semester === '上') return 0
  if (semester === '下') return 1
  return 2
}

/**
 * 判断课程是否为教材课程
 * @param tags 课程标签
 * @returns 是否教材课程
 */
function isTextbookCourse(tags: string[]): boolean {
  return tags.includes('Textbook') || Boolean(readTagValue(tags, 'Textbook:'))
}

/**
 * 解析单个教材课程的分级元数据
 * @param course 课程
 * @returns 分级元数据；非教材课程返回 null
 */
function parseTextbookMeta(course: Course): {
  publisher: string
  series: string
  textbookName: string
  unitTitle: string
  grade: string
  semester: string
} | null {
  const tags = (course.tags ?? []).map(tag => String(tag || '').trim())
  if (!isTextbookCourse(tags)) return null

  // 标题格式由生成端约定为「教材名 - 单元名」，额外保护教材名中可能出现的分隔符
  const titleParts = splitTrim(course.title, ' - ')
  const descriptionParts = splitTrim(course.description, '/')

  // 历史标签格式：AI / Textbook / 出版社 / 系列 / 单元
  const legacyPublisher = tags[2] || ''
  const legacySeries = tags[3] || ''
  const legacyUnit = tags[4] || ''

  const publisher = readTagValue(tags, 'Publisher:') || legacyPublisher || descriptionParts[0] || '未标注出版社'
  const series = readTagValue(tags, 'Series:') || legacySeries || descriptionParts[1] || '未标注系列'
  const textbookName = readTagValue(tags, 'Textbook:') || (titleParts.length > 1 ? titleParts[0] : '未标注教材')
  const unitFromTag = readTagValue(tags, 'Unit:')
  const unitTitle = unitFromTag || legacyUnit || (titleParts.length > 1 ? titleParts.slice(1).join(' - ') : course.title)

  const { grade, semester } = parseGradeInfo(
    textbookName,
    readTagValue(tags, 'Grade:'),
    readTagValue(tags, 'Semester:'),
  )

  return { publisher, series, textbookName, unitTitle, grade, semester }
}

/**
 * 构建教材三级分组
 * @param courses 扁平课程列表
 * @returns 分级结果（教材系列 + 其他课程）
 */
export function buildTextbookGroups<T extends Course>(courses: T[]): TextbookGroupResult<T> {
  /** 系列键 → 系列分组 */
  const seriesMap = new Map<string, TextbookSeriesGroup<T>>()
  /** 年级册键 → 年级册分组（按系列隔离） */
  const volumeMap = new Map<string, TextbookVolumeGroup<T>>()
  /** 非教材课程 */
  const others: T[] = []

  for (const course of courses) {
    const meta = parseTextbookMeta(course)
    if (!meta) {
      others.push(course)
      continue
    }

    // 系列键：出版社 + 系列，保证不同出版社同名系列不会混在一起
    const seriesKey = `${meta.publisher}|${meta.series}`
    let seriesGroup = seriesMap.get(seriesKey)
    if (!seriesGroup) {
      seriesGroup = {
        key: seriesKey,
        publisher: meta.publisher,
        series: meta.series,
        label: `${meta.publisher} · ${meta.series}`,
        volumes: [],
        courseCount: 0,
      }
      seriesMap.set(seriesKey, seriesGroup)
    }

    // 年级册键：系列 + 教材名 + 年级 + 册次
    const volumeKey = `${seriesKey}|${meta.textbookName}|${meta.grade}|${meta.semester}`
    let volumeGroup = volumeMap.get(volumeKey)
    if (!volumeGroup) {
      const gradeLabel = [meta.grade, meta.semester ? `${meta.semester}册` : '']
        .filter(Boolean)
        .join(' · ')
      volumeGroup = {
        key: volumeKey,
        textbookName: meta.textbookName,
        grade: meta.grade,
        semester: meta.semester,
        label: gradeLabel || meta.textbookName || '未标注年级',
        units: [],
      }
      volumeMap.set(volumeKey, volumeGroup)
      seriesGroup.volumes.push(volumeGroup)
    }

    volumeGroup.units.push({
      key: course.id,
      title: meta.unitTitle || course.title,
      unitNumber: parseUnitNumber(meta.unitTitle),
      course,
      lessonCount: course.lessons?.length ?? course.lessonCount ?? 0,
    })
    seriesGroup.courseCount += 1
  }

  /** 系列排序结果 */
  const series = Array.from(seriesMap.values())
    .map(group => {
      // 系列内年级册：按年级、册次、教材名排序
      group.volumes.sort((a, b) => {
        const gradeDiff = gradeWeight(a.grade) - gradeWeight(b.grade)
        if (gradeDiff !== 0) return gradeDiff
        const semesterDiff = semesterWeight(a.semester) - semesterWeight(b.semester)
        if (semesterDiff !== 0) return semesterDiff
        return a.textbookName.localeCompare(b.textbookName, 'zh-Hans-CN')
      })

      // 年级册内单元：先按单元序号，再按标题兜底
      group.volumes.forEach(volume => {
        volume.units.sort((a, b) => {
          const numberDiff = a.unitNumber - b.unitNumber
          if (numberDiff !== 0) return numberDiff
          return a.title.localeCompare(b.title, 'zh-Hans-CN')
        })
      })

      return group
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-Hans-CN'))

  return { series, others }
}
