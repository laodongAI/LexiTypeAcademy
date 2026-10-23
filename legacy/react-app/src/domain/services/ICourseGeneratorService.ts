/**
 * 课程生成服务接口
 * 
 * 职责：管理 AI Lab 课程生成的工作流，包括音频处理、转写、翻译等
 * 实现者：使用 LLM API 和音频处理引擎实现
 */

import { AILabTaskAggregate } from '../aggregates/AILabTaskAggregate';

export interface GeneratedLesson {
  title: string;
  text: string;
  translation: string;
  audioUri: string;
  vocabulary: Array<{
    word: string;
    pronunciation: string;
    meaning: string;
    level: string;
  }>;
  metadata: Record<string, any>;
}

export interface GeneratedCourse {
  title: string;
  description: string;
  difficulty: string;
  lessons: GeneratedLesson[];
  estimatedDuration: number;
  tags: string[];
  metadata: Record<string, any>;
}

export interface ICourseGeneratorService {
  /**
   * 从音频文件生成课程
   * 流程：分句 → 原音切片 → 转写 → 翻译 → TTS 生成 → 质量检查
   */
  generateCourseFromAudio(
    audioFilePath: string,
    options?: {
      language?: string;
      difficulty?: string;
      maxSentences?: number;
    }
  ): Promise<GeneratedCourse>;

  /**
   * 从文本生成课程
   */
  generateCourseFromText(
    text: string,
    options?: {
      language?: string;
      difficulty?: string;
    }
  ): Promise<GeneratedCourse>;

  /**
   * 监控生成任务的进度
   */
  monitorTaskProgress(task: AILabTaskAggregate): Promise<{
    progress: number;
    currentStep: string;
    eta: number;
  }>;

  /**
   * 取消正在进行的任务
   */
  cancelTask(taskId: string): Promise<void>;
}
