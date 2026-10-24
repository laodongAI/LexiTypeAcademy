/**
 * 拼音学习数据。作为旧拼音练习模块的静态教学素材，不参与英语学习进度统计。
 */
export interface PinyinExample {
  char: string
  pinyin: string
  word?: string
  meaning?: string
}

export interface PinyinItem {
  pinyin: string
  description: string
  examples: PinyinExample[]
  tips?: string
}

export interface PinyinTone {
  name: string
  symbol: string
  pitch: string
  description: string
  examples: Array<{ char: string; pinyin: string; meaning: string }>
}

const example = (char: string, pinyin: string, meaning: string): PinyinExample => ({
  char, pinyin, word: char, meaning,
})

export const singleVowels: PinyinItem[] = [
  { pinyin: 'a', description: '开口较大，舌位自然放平。', examples: [example('啊', 'ā', '语气词')], tips: '嘴巴自然张开，声音明亮。' },
  { pinyin: 'o', description: '双唇略圆，舌位靠后。', examples: [example('哦', 'ó', '表示明白')], tips: '嘴唇收圆，不要过度用力。' },
  { pinyin: 'e', description: '嘴形自然，舌面稍后。', examples: [example('饿', 'è', '饥饿')], tips: '不要把口形拉得太扁。' },
  { pinyin: 'i', description: '舌尖靠近下齿，嘴角略展开。', examples: [example('衣', 'yī', '衣服')], tips: '保持嘴角自然展开。' },
  { pinyin: 'u', description: '双唇收圆并向前突出。', examples: [example('乌', 'wū', '黑色')], tips: '双唇圆拢，舌位靠后。' },
  { pinyin: 'ü', description: '舌位接近 i，双唇像 u 一样收圆。', examples: [example('鱼', 'yú', '鱼类')], tips: '先发 i，再保持舌位并收圆嘴唇。' },
]

export const compoundVowels: PinyinItem[] = [
  { pinyin: 'ai', description: '由 a 滑向 i。', examples: [example('爱', 'ài', '喜爱')] },
  { pinyin: 'ei', description: '由 e 滑向 i。', examples: [example('杯', 'bēi', '杯子')] },
  { pinyin: 'ui', description: '由 u 滑向 ei，常见于 dui、gui 等音节。', examples: [example('对', 'duì', '正确；面对')] },
  { pinyin: 'ao', description: '由 a 滑向 o。', examples: [example('好', 'hǎo', '好')] },
  { pinyin: 'ou', description: '由 o 滑向 u。', examples: [example('口', 'kǒu', '嘴巴')] },
  { pinyin: 'iu', description: '由 i 滑向 ou，常见于 liu、jiu 等音节。', examples: [example('六', 'liù', '数字六')] },
  { pinyin: 'ie', description: '由 i 滑向 ê。', examples: [example('谢', 'xiè', '感谢')] },
  { pinyin: 'üe', description: '由 ü 滑向 ê。', examples: [example('月', 'yuè', '月亮')] },
]

export const nasalVowelsN: PinyinItem[] = [
  { pinyin: 'an', description: '以舌尖鼻音 n 收尾。', examples: [example('安', 'ān', '平安')] },
  { pinyin: 'en', description: '由 e 滑向鼻音 n。', examples: [example('恩', 'ēn', '恩情')] },
  { pinyin: 'in', description: '由 i 滑向鼻音 n。', examples: [example('音', 'yīn', '声音')] },
]

export const nasalVowelsNG: PinyinItem[] = [
  { pinyin: 'ang', description: '以舌根鼻音 ng 收尾。', examples: [example('方', 'fāng', '方向')] },
  { pinyin: 'eng', description: '由 e 滑向舌根鼻音 ng。', examples: [example('风', 'fēng', '风')] },
  { pinyin: 'ing', description: '由 i 滑向舌根鼻音 ng。', examples: [example('星', 'xīng', '星星')] },
]

const consonantData: Array<[string, string, string]> = [
  ['b', '八', '数字八'], ['p', '跑', '跑步'], ['m', '妈', '母亲'], ['f', '饭', '米饭'],
  ['d', '大', '大小'], ['t', '天', '天空'], ['n', '你', '你'], ['l', '来', '到来'],
  ['g', '高', '高低'], ['k', '看', '观看'], ['h', '好', '好坏'], ['j', '家', '家庭'],
  ['q', '去', '前往'], ['x', '学', '学习'], ['zh', '中', '中间'], ['ch', '吃', '进食'],
  ['sh', '是', '判断'], ['r', '人', '人类'], ['z', '字', '文字'], ['c', '菜', '蔬菜'],
  ['s', '三', '数字三'], ['y', '有', '拥有'], ['w', '我', '第一人称'],
]
export const consonants: PinyinItem[] = consonantData.map(([pinyin, char, meaning]) => ({
  pinyin,
  description: `声母 ${pinyin} 的基础发音与辨听练习。`,
  examples: [example(char, ({ b: 'bā', p: 'pǎo', m: 'mā', f: 'fàn', d: 'dà', t: 'tiān', n: 'nǐ', l: 'lái', g: 'gāo', k: 'kàn', h: 'hǎo', j: 'jiā', q: 'qù', x: 'xué', zh: 'zhōng', ch: 'chī', sh: 'shì', r: 'rén', z: 'zì', c: 'cài', s: 'sān', y: 'yǒu', w: 'wǒ' } as Record<string, string>)[pinyin], meaning)],
  tips: '注意声母起始位置，和韵母连读时保持自然。',
}))

export const wholeSyllables: PinyinItem[] = [
  ['zhi', '知', 'zhī'], ['chi', '吃', 'chī'], ['shi', '诗', 'shī'], ['ri', '日', 'rì'],
  ['zi', '字', 'zì'], ['ci', '词', 'cí'], ['si', '思', 'sī'], ['yi', '衣', 'yī'],
  ['wu', '乌', 'wū'], ['yu', '鱼', 'yú'], ['ye', '也', 'yě'], ['yue', '月', 'yuè'],
  ['yuan', '元', 'yuán'], ['yin', '音', 'yīn'], ['yun', '云', 'yún'], ['ying', '英', 'yīng'],
].map(([pinyin, char, tonePinyin]) => ({
  pinyin,
  description: `整体认读音节 ${pinyin}，直接整体辨认。`,
  examples: [example(char, tonePinyin, char)],
}))

export const tones: PinyinTone[] = [
  { name: '第一声', symbol: 'ˉ', pitch: '高而平', description: '音高保持平稳。', examples: [{ char: '妈', pinyin: 'mā', meaning: '母亲' }] },
  { name: '第二声', symbol: 'ˊ', pitch: '由低向高', description: '音高自然上扬。', examples: [{ char: '麻', pinyin: 'má', meaning: '麻木；麻类' }] },
  { name: '第三声', symbol: 'ˇ', pitch: '先降后升', description: '单独读时先降后升。', examples: [{ char: '马', pinyin: 'mǎ', meaning: '动物马' }] },
  { name: '第四声', symbol: 'ˋ', pitch: '由高向低', description: '音高明显下降。', examples: [{ char: '骂', pinyin: 'mà', meaning: '责备' }] },
  { name: '轻声', symbol: '·', pitch: '轻短自然', description: '轻声短而轻，不标独立声调符号。', examples: [{ char: '吗', pinyin: 'ma', meaning: '疑问语气词' }] },
]

export const learningPaths = [
  { title: '单韵母', description: '先练习基础口形与舌位。' },
  { title: '复韵母', description: '练习韵母内部的滑动变化。' },
  { title: '鼻韵母', description: '辨别 n 与 ng 的收尾位置。' },
  { title: '声母', description: '练习声母起始发音。' },
  { title: '整体认读', description: '把常用音节作为整体记忆。' },
]
