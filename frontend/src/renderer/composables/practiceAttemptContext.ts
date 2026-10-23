import type { ComputedRef, InjectionKey } from 'vue'

export interface PracticeAttemptContext {
  courseId: ComputedRef<string>
  lessonId: ComputedRef<string>
}

export const practiceAttemptContextKey: InjectionKey<PracticeAttemptContext> = Symbol('practiceAttemptContext')
