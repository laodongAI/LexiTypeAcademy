/**
 * 课程生成提示词模板
 */

import type { CourseGenerationRequest } from '../aiTypes';

/**
 * 构建课程生成提示词
 */
export function buildCourseGenerationPrompt(request: CourseGenerationRequest): string {
  const { topic, level, lessonCount, wordsPerLesson, style, notes } = request;

  return `
Please generate an English typing practice course with the following requirements:

**Course Information:**
- Topic: ${topic}
- Difficulty Level: ${level}
- Number of Lessons: ${lessonCount}
- Words per Lesson: ${wordsPerLesson}
${style ? `- Teaching Style: ${style}` : ''}
${notes ? `- Additional Notes: ${notes}` : ''}

**Requirements:**
1. The course should focus on "${topic}" and be appropriate for ${level} learners
2. Each lesson should have exactly ${wordsPerLesson} words
3. Words should be progressive in difficulty within each lesson
4. Include word meanings, phonetics, and example sentences
5. Words should be relevant to the topic

**Output Format (JSON):**
\`\`\`json
{
  "courseName": "Course name",
  "description": "Brief course description",
  "lessons": [
    {
      "lessonName": "Lesson 1 name",
      "description": "Lesson description",
      "words": [
        {
          "word": "example",
          "meaning": "a thing characteristic of its kind",
          "translation": "例子",
          "phonetic": "/ɪɡˈzæmpl/",
          "example": "This is an example sentence.",
          "exampleTranslation": "这是一个例句。",
          "partOfSpeech": "noun"
        }
      ]
    }
  ]
}
\`\`\`

Please generate the complete course in the above JSON format.
`.trim();
}

/**
 * 构建简化版课程生成提示词（仅生成单词列表）
 */
export function buildSimpleCoursePrompt(topic: string, level: string, wordCount: number): string {
  return `
Generate a list of ${wordCount} English words related to "${topic}" suitable for ${level} learners.

Return in JSON format:
\`\`\`json
{
  "words": ["word1", "word2", "word3", ...]
}
\`\`\`
`.trim();
}

/**
 * 构建词汇课程生成提示词
 */
export function buildVocabularyCoursePrompt(words: string[], level: string): string {
  return `
I have a list of English words. Please create a structured vocabulary course with these words.

**Words:** ${words.join(', ')}
**Level:** ${level}

For each word, provide:
1. Word meaning (definition)
2. Chinese translation
3. Phonetic transcription (IPA)
4. Example sentence
5. Example sentence translation
6. Part of speech

**Output Format (JSON):**
\`\`\`json
{
  "words": [
    {
      "word": "example",
      "meaning": "a thing characteristic of its kind",
      "translation": "例子",
      "phonetic": "/ɪɡˈzæmpl/",
      "example": "This is an example sentence.",
      "exampleTranslation": "这是一个例句。",
      "partOfSpeech": "noun"
    }
  ]
}
\`\`\`

Please provide complete information for all words.
`.trim();
}
