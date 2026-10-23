/**
 * 练习文本配置
 * 包含指法练习和拼音练习的各难度文本
 */

export const practiceTexts = {
  fingerPractice: {
    beginner: [
      // Stage 1: Index fingers (F, J)
      'fff jjj fff jjj fjf jfj',
      'fff jjj fjf jfj jf jf',
      // Stage 2: Middle fingers (D, K)
      'ddd kkk ddd kkk dkd kdk',
      'dfjk dfjk kdfj kdfj',
      // Stage 3: Ring fingers (S, L)
      'sss lll sss lll sls lsl',
      'sdf jkl sdf jkl',
      // Stage 4: Pinky fingers (A, ;)
      'aaa ;;; aaa ;;; a;a ;a;',
      'asdf jkl; asdf jkl;',
      // Stage 5: Home row words
      'dad sad lad fad',
      'ask all add fall',
      'flask salad alfalfa',
      'half glass falls',
    ],
    intermediate: [
      // Stage 1: Index reaches (R, U, T, Y, G, H, V, M, B, N)
      'frf juj ftf jyj fgf jhj',
      'fvf jmj fbf jnj',
      'rug tug hug bug mug',
      // Stage 2: Middle reaches (E, I, C, ,)
      'ded kik dcd k,k',
      'red kid ice deck',
      // Stage 3: Ring reaches (W, O, X, .)
      'sws lol sxs l.l',
      'wow so low slow',
      // Stage 4: Pinky reaches (Q, P, Z, /)
      'qaq ;p; zaz ;/; qzq ;/;',
      'zip pop quiz zap',
      // Stage 5: Common words
      'the and for are but not you all',
      'here there where were',
      'quick brown fox jumps',
    ],
    advanced: [
      // Pangrams (Sentences using all letters)
      'The quick brown fox jumps over the lazy dog.',
      'Pack my box with five dozen liquor jugs.',
      'Jackdaws love my big sphinx of quartz.',
      'How vexingly quick daft zebras jump!',
      'Bright vixens jump; dozy fowl quack.',
      'Five quacking zephyrs jolt my wax bed.',
      'A wizard\'s job is to vex chumps quickly in fog.',
      // Capitalization and Punctuation
      'Hello, World! This is a test.',
      'Date: 2023-10-27; Time: 10:00 AM.',
      'Email: user@example.com',
      'Price: $19.99 (20% off)',
    ],
  },
  typingPractice: {
    beginner: [
      // --- Pinyin Basics (拼音基础) ---
      // Initials (声母)
      'b p m f d t n l g k h',
      'j q x zh ch sh r z c s y w',
      // Simple Finals (单韵母)
      'a o e i u v',
      // Compound & Nasal Finals (复韵母与鼻韵母)
      'ai ei ui ao ou iu ie ve er',
      'an en in un vn ang eng ing ong',
      // Whole Syllables (整体认读音节)
      'zhi chi shi ri zi ci si',
      'yi wu yu ye yue yuan yin yun ying',
      // Syllables (音节练习)
      'ba bo bi bu pa po pi pu',
      'ma mo me mi mu fa fo fu',
      'ji jia jie jiao jiu ju jue jun',
      'qi qia qie qiao qiu qu que qun',
      'xi xia xie xiao xiu xu xue xun',
      
      // --- Grade 1-2 (一二年级：识字与古诗) ---
      '天地人，你我他。一二三四五，金木水火土。',
      '鹅鹅鹅，曲项向天歌。白毛浮绿水，红掌拨清波。', // 咏鹅
      '远看山有色，近听水无声。春去花还在，人来鸟不惊。', // 画
      '床前明月光，疑是地上霜。举头望明月，低头思故乡。', // 静夜思
      '草长莺飞二月天，拂堤杨柳醉春烟。儿童散学归来早，忙趁东风放纸鸢。', // 村居
      '碧玉妆成一树高，万条垂下绿丝绦。不知细叶谁裁出，二月春风似剪刀。', // 咏柳
    ],
    intermediate: [
      // --- Grade 3 (三年级：词汇与句子) ---
      '早晨，从山坡上，从坪坝里，从一条条开着绒球花和太阳花的小路上，走来了许多小学生。', // 大青树下的小学
      '湿润的东风走过荒野，在竹林中吹着口笛。', // 花的学校
      '停车坐爱枫林晚，霜叶红于二月花。', // 山行
      '水光潋滟晴方好，山色空蒙雨亦奇。欲把西湖比西子，淡妆浓抹总相宜。', // 饮湖上初晴后雨
      '群儿戏于庭，一儿登瓮，足跌没水中。众皆弃去，光持石击瓮破之，水迸，儿得活。', // 司马光

      // --- Grade 4 (四年级：写景与叙事) ---
      '浪潮越来越近，犹如千万匹白色战马齐头并进，浩浩荡荡地飞奔而来。', // 观潮
      '细细的溪水，流着山草和野花的香味，流着月光。', // 走月亮
      '横看成岭侧成峰，远近高低各不同。不识庐山真面目，只缘身在此山中。', // 题西林壁
      '一道残阳铺水中，半江瑟瑟半江红。可怜九月初三夜，露似真珠月似弓。', // 暮江吟
      '劝君更尽一杯酒，西出阳关无故人。', // 送元二使安西
    ],
    advanced: [
      // --- Grade 5 (五年级：散文与爱国诗) ---
      '白鹭是一首精巧的诗。色素的配合，身段的大小，一切都很适宜。', // 白鹭
      '人要做有用的人，不要做只讲体面，而对别人没有好处的人。', // 落花生
      '死去元知万事空，但悲不见九州同。王师北定中原日，家祭无忘告乃翁。', // 示儿
      '山一程，水一程，身向榆关那畔行，夜深千帐灯。', // 长相思
      '我劝天公重抖擞，不拘一格降人才。', // 己亥杂诗

      // --- Grade 6 (六年级：名家名篇) ---
      '这次，我看到了草原。那里的天比别处的更可爱，空气是那么清鲜，天空是那么明朗。', // 草原
      '金黄的圆月，碧绿的西瓜，项带银圈的少年，飞在空中的钢叉。', // 少年闰土
      '燕子去了，有再来的时候；杨柳枯了，有再青的时候；桃花谢了，有再开的时候。', // 匆匆
      '千磨万击还坚劲，任尔东西南北风。', // 竹石
      '粉骨碎身浑不怕，要留清白在人间。', // 石灰吟
    ],
  },
};

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';
export type PracticeType = 'fingerPractice' | 'typingPractice';

export const difficultyLabels: Record<Difficulty, string> = {
  beginner: '初级',
  intermediate: '中级',
  advanced: '高级',
};
