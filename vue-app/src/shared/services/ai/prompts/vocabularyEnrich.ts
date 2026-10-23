/**
 * 词汇增强提示词模板
 */

import type { WordEntry } from '../aiTypes';

/**
 * 构建词汇增强提示词
 */
export function buildVocabularyEnrichPrompt(words: string[]): string {
  return `
Please enrich the following English words with detailed information:

**Words:** ${words.join(', ')}

For each word, provide:
1. **meaning**: Clear definition in English
2. **translation**: Chinese translation
3. **phonetic**: IPA phonetic transcription
4. **example**: A natural example sentence
5. **exampleTranslation**: Chinese translation of the example
6. **partOfSpeech**: Part of speech (noun, verb, adjective, etc.)

**Output Format (JSON):**
\`\`\`json
{
  "words": [
    {
      "word": "example",
      "meaning": "a thing characteristic of its kind or illustrating a general rule",
      "translation": "例子；榜样",
      "phonetic": "/ɪɡˈzæmpl/",
      "example": "This painting is a perfect example of the painter's early work.",
      "exampleTranslation": "这幅画是这位画家早期作品的完美典范。",
      "partOfSpeech": "noun"
    }
  ]
}
\`\`\`

Please ensure:
- Phonetics use standard IPA notation
- Examples are natural and contextually appropriate
- Translations are accurate
- All fields are complete

Return only the JSON data, no additional text.
`.trim();
}

/**
 * 构建单词例句生成提示词
 */
export function buildExampleSentencePrompt(word: string, meaning: string): string {
  return `
Generate a natural, contextually appropriate example sentence for the English word "${word}" (meaning: ${meaning}).

Also provide the Chinese translation of the example sentence.

**Output Format (JSON):**
\`\`\`json
{
  "example": "example sentence here",
  "exampleTranslation": "中文翻译"
}
\`\`\`

Return only the JSON data.
`.trim();
}

/**
 * 构建音标生成提示词
 */
export function buildPhoneticPrompt(words: string[]): string {
  return `
Provide IPA phonetic transcriptions for the following English words:

**Words:** ${words.join(', ')}

**Output Format (JSON):**
\`\`\`json
{
  "phonetics": [
    { "word": "example", "phonetic": "/ɪɡˈzæmpl/" }
  ]
}
\`\`\`

Return only the JSON data.
`.trim();
}

/**
 * 构建词汇复习句子生成提示词
 */
export function buildReviewSentencesPrompt(words: string[]): string {
  return `
Create review sentences that use the following English words. Try to use multiple words in each sentence when possible.

**Words:** ${words.join(', ')}

**Requirements:**
- Natural, engaging sentences
- Age-appropriate and educational
- Each sentence should use 1-3 of the target words
- Provide Chinese translations

**Output Format (JSON):**
\`\`\`json
{
  "sentences": [
    {
      "english": "The example demonstrates the principle clearly.",
      "chinese": "这个例子清楚地展示了这个原理。",
      "wordsUsed": ["example", "principle"]
    }
  ]
}
\`\`\`

Generate 5-10 sentences covering all the words.
`.trim();
}
