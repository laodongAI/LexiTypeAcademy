/**
 * 翻译提示词模板
 */

/**
 * 构建翻译提示词
 */
export function buildTranslationPrompt(
  text: string,
  sourceLang: string = 'auto',
  targetLang: string = 'zh'
): string {
  const langMap: Record<string, string> = {
    en: 'English',
    zh: 'Chinese',
    auto: 'automatically detected language'
  };

  const source = langMap[sourceLang] || sourceLang;
  const target = langMap[targetLang] || targetLang;

  return `
Translate the following text from ${source} to ${target}.

**Text to translate:**
${text}

**Requirements:**
- Provide accurate, natural translation
- Maintain the original meaning and tone
- Use appropriate formality level
- For technical terms, ensure precision

**Output Format (JSON):**
\`\`\`json
{
  "translation": "translated text here",
  "sourceLanguage": "detected or specified source language code",
  "targetLanguage": "target language code"
}
\`\`\`

Return only the JSON data, no additional text.
`.trim();
}

/**
 * 构建批量翻译提示词
 */
export function buildBatchTranslationPrompt(
  texts: string[],
  targetLang: string = 'zh'
): string {
  const langMap: Record<string, string> = {
    en: 'English',
    zh: 'Chinese'
  };

  const target = langMap[targetLang] || targetLang;

  return `
Translate the following texts to ${target}:

${texts.map((text, index) => `${index + 1}. ${text}`).join('\n')}

**Output Format (JSON):**
\`\`\`json
{
  "translations": [
    "translation 1",
    "translation 2",
    ...
  ]
}
\`\`\`

Return only the JSON data with all translations in order.
`.trim();
}

/**
 * 构建解释翻译提示词（带详细解释）
 */
export function buildExplainedTranslationPrompt(text: string): string {
  return `
Translate the following English text to Chinese and provide a detailed explanation.

**Text:**
${text}

**Output Format (JSON):**
\`\`\`json
{
  "translation": "中文翻译",
  "explanation": "detailed explanation of key points, idioms, or difficult parts",
  "keywords": [
    {
      "word": "keyword",
      "meaning": "meaning in context",
      "translation": "中文"
    }
  ]
}
\`\`\`

Return only the JSON data.
`.trim();
}
