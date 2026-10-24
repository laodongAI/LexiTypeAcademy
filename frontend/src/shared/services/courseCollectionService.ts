import { apiDelete, apiGet, apiPost, apiPut } from './apiClient'

export interface CourseCollection {
  id: string
  name: string
  parentId: string | null
  description: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  courseIds: string[]
}

interface CollectionListResponse {
  items: CourseCollection[]
  total: number
}

/** Persisted course collection API; collections are independent of legacy tags. */
export const courseCollectionService = {
  async list(): Promise<CourseCollection[]> {
    const response = await apiGet<CollectionListResponse>('/api/course-collections')
    return response.items
  },

  async create(input: { name: string; parentId?: string | null; description?: string; sortOrder?: number }): Promise<CourseCollection> {
    return apiPost<CourseCollection>('/api/course-collections', input)
  },

  async update(id: string, input: Partial<Pick<CourseCollection, 'name' | 'parentId' | 'description' | 'sortOrder'>>): Promise<CourseCollection> {
    return apiPut<CourseCollection>(`/api/course-collections/${encodeURIComponent(id)}`, input)
  },

  async remove(id: string): Promise<void> {
    await apiDelete<{ success: boolean }>(`/api/course-collections/${encodeURIComponent(id)}`)
  },

  async assignCourse(collectionId: string, courseId: string): Promise<void> {
    await apiPut<{ success: boolean }>(
      `/api/course-collections/${encodeURIComponent(collectionId)}/courses/${encodeURIComponent(courseId)}`,
      {},
    )
  },

  async unassignCourse(courseId: string): Promise<void> {
    await apiDelete<{ success: boolean }>(`/api/course-collections/courses/${encodeURIComponent(courseId)}`)
  },
}
