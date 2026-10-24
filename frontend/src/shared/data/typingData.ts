/**
 * 打字练习素材。文本分级用于练习，不作为已完成课程或掌握度的事实记录。
 */
export type PracticeCategory = 'fingerPractice' | 'typingPractice' | 'englishPractice'
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced'

type PracticeTextSet = Record<PracticeCategory, Record<DifficultyLevel, string[]>>

export const practiceTexts: PracticeTextSet = {
  fingerPractice: {
    beginner: ['asdf jkl;', 'fj fj dk dk sl sl', 'ask dad; fall sad.'],
    intermediate: ['asdf jkl; fdsa', 'qwer uiop qwer', 'zxcv nm,. zxcv'],
    advanced: ['Pack my box with five dozen liquor jugs.', 'The quick brown fox jumps over the lazy dog.'],
  },
  typingPractice: {
    beginner: ['hello world', 'good morning', 'thank you', 'nice to meet you'],
    intermediate: ['Practice a little English every day.', 'Small steps make steady progress.', 'Listen, speak, read, and write.'],
    advanced: [
      'Learning a language takes patience, repetition, and curiosity.',
      'A useful practice session combines clear goals with immediate feedback.',
      'The best way to improve is to return regularly and learn from each mistake.',
    ],
  },
  englishPractice: {
    beginner: ['apple', 'book', 'family', 'friend', 'school', 'water'],
    intermediate: ['Could you help me, please?', 'I would like to practice speaking English.', 'What did you learn today?'],
    advanced: [
      'Clear communication begins with listening carefully and responding thoughtfully.',
      'During an interview, explain your reasoning and support your answer with a concrete example.',
      'Consistent practice helps turn unfamiliar expressions into confident communication.',
    ],
  },
}
