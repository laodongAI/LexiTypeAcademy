import { ref, type InjectionKey } from 'vue'
import { getAIService, type TeachingFeedbackRequest, type TeachingFeedbackResponse } from '../../shared/services/ai'

export interface UseTeachingFeedbackState {
  feedback: ReturnType<typeof ref<TeachingFeedbackResponse | null>>
  loading: ReturnType<typeof ref<boolean>>
  error: ReturnType<typeof ref<string>>
  reset: () => void
  generate: (request: TeachingFeedbackRequest) => Promise<TeachingFeedbackResponse | null>
}

export const teachingFeedbackKey: InjectionKey<UseTeachingFeedbackState> = Symbol('teachingFeedback')

export function useTeachingFeedback(): UseTeachingFeedbackState {
  const feedback = ref<TeachingFeedbackResponse | null>(null)
  const loading = ref(false)
  const error = ref('')

  function reset() {
    feedback.value = null
    loading.value = false
    error.value = ''
  }

  async function generate(request: TeachingFeedbackRequest) {
    reset()

    const ai = getAIService()
    if (!ai.isConfigured()) return null

    loading.value = true
    try {
      const res = await ai.generateTeachingFeedback(request)
      feedback.value = res
      return res
    } catch (e) {
      error.value = e instanceof Error ? e.message : '教学反馈生成失败'
      return null
    } finally {
      loading.value = false
    }
  }

  return {
    feedback,
    loading,
    error,
    reset,
    generate,
  }
}
