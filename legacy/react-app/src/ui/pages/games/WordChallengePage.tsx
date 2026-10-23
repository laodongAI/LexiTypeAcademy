/**
 * 单词挑战游戏
 * DDD设计：UI层游戏页面
 * 玩法：在限定时间内正确输入屏幕上显示的单词，得分越高越好
 * 
 * 教学功能：
 * - 显示单词音标
 * - 显示中文释义
 * - TTS发音播放
 * - 音效反馈
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getTTSService } from '@/infrastructure/audio/tts';
import { soundManager } from '@/shared/utils/SoundManager';

interface WordChallengePageProps {
  onExit: () => void;
}

/**
 * 单词条目接口
 * 包含单词、音标、释义等教学信息
 */
interface WordEntry {
  /** 单词 */
  word: string;
  /** 国际音标 */
  phonetic: string;
  /** 中文释义 */
  meaning: string;
  /** 词性 */
  partOfSpeech: string;
}

/**
 * 单词库 - 编程相关术语（含音标和释义）
 */
const WORD_DATABASE: WordEntry[] = [
  { word: 'react', phonetic: '/riˈækt/', meaning: '反应；React框架', partOfSpeech: 'v./n.' },
  { word: 'typescript', phonetic: '/ˈtaɪpskrɪpt/', meaning: 'TypeScript语言', partOfSpeech: 'n.' },
  { word: 'electron', phonetic: '/ɪˈlektrɒn/', meaning: '电子；Electron框架', partOfSpeech: 'n.' },
  { word: 'javascript', phonetic: '/ˈdʒɑːvəskrɪpt/', meaning: 'JavaScript语言', partOfSpeech: 'n.' },
  { word: 'component', phonetic: '/kəmˈpoʊnənt/', meaning: '组件；成分', partOfSpeech: 'n.' },
  { word: 'interface', phonetic: '/ˈɪntərfeɪs/', meaning: '接口；界面', partOfSpeech: 'n.' },
  { word: 'function', phonetic: '/ˈfʌŋkʃən/', meaning: '函数；功能', partOfSpeech: 'n.' },
  { word: 'variable', phonetic: '/ˈveriəbl/', meaning: '变量；可变的', partOfSpeech: 'n./adj.' },
  { word: 'array', phonetic: '/əˈreɪ/', meaning: '数组；排列', partOfSpeech: 'n.' },
  { word: 'object', phonetic: '/ˈɒbdʒekt/', meaning: '对象；物体', partOfSpeech: 'n.' },
  { word: 'class', phonetic: '/klæs/', meaning: '类；班级', partOfSpeech: 'n.' },
  { word: 'method', phonetic: '/ˈmeθəd/', meaning: '方法；方式', partOfSpeech: 'n.' },
  { word: 'parameter', phonetic: '/pəˈræmɪtər/', meaning: '参数；参量', partOfSpeech: 'n.' },
  { word: 'return', phonetic: '/rɪˈtɜːrn/', meaning: '返回；归还', partOfSpeech: 'v.' },
  { word: 'import', phonetic: '/ˈɪmpɔːrt/', meaning: '导入；进口', partOfSpeech: 'v.' },
  { word: 'export', phonetic: '/ˈekspɔːrt/', meaning: '导出；出口', partOfSpeech: 'v.' },
  { word: 'render', phonetic: '/ˈrendər/', meaning: '渲染；呈现', partOfSpeech: 'v.' },
  { word: 'state', phonetic: '/steɪt/', meaning: '状态；声明', partOfSpeech: 'n./v.' },
  { word: 'props', phonetic: '/prɒps/', meaning: '属性（React）', partOfSpeech: 'n.' },
  { word: 'hook', phonetic: '/hʊk/', meaning: '钩子；Hook', partOfSpeech: 'n.' },
  { word: 'async', phonetic: '/əˈsɪŋk/', meaning: '异步的', partOfSpeech: 'adj.' },
  { word: 'await', phonetic: '/əˈweɪt/', meaning: '等待', partOfSpeech: 'v.' },
  { word: 'promise', phonetic: '/ˈprɒmɪs/', meaning: 'Promise；承诺', partOfSpeech: 'n.' },
  { word: 'callback', phonetic: '/ˈkɔːlbæk/', meaning: '回调函数', partOfSpeech: 'n.' },
  { word: 'module', phonetic: '/ˈmɒdjuːl/', meaning: '模块', partOfSpeech: 'n.' },
  { word: 'package', phonetic: '/ˈpækɪdʒ/', meaning: '包；软件包', partOfSpeech: 'n.' },
  { word: 'debug', phonetic: '/diːˈbʌɡ/', meaning: '调试；除错', partOfSpeech: 'v.' },
  { word: 'compile', phonetic: '/kəmˈpaɪl/', meaning: '编译', partOfSpeech: 'v.' },
  { word: 'deploy', phonetic: '/dɪˈplɔɪ/', meaning: '部署；展开', partOfSpeech: 'v.' },
  { word: 'server', phonetic: '/ˈsɜːrvər/', meaning: '服务器', partOfSpeech: 'n.' }
];

export function WordChallengePage({ onExit }: WordChallengePageProps) {
  /** 当前单词条目 */
  const [currentEntry, setCurrentEntry] = useState<WordEntry | null>(null);
  /** 用户输入 */
  const [input, setInput] = useState('');
  /** 得分 */
  const [score, setScore] = useState(0);
  /** 剩余时间 */
  const [timeLeft, setTimeLeft] = useState(60);
  /** 游戏是否进行中 */
  const [isActive, setIsActive] = useState(false);
  /** 游戏是否结束 */
  const [isGameOver, setIsGameOver] = useState(false);
  /** 是否显示释义（默认隐藏，增加难度） */
  const [showMeaning, setShowMeaning] = useState(true);

  /**
   * 播放单词发音
   */
  const playPronunciation = useCallback(async (word: string) => {
    try {
      const ttsService = getTTSService();
      const result = await ttsService.generate({ text: word, lang: 'en-US' });
      if (result.audioBlob) {
        const audioUrl = URL.createObjectURL(result.audioBlob);
        const audio = new Audio(audioUrl);
        audio.play().catch(console.error);
        audio.onended = () => URL.revokeObjectURL(audioUrl);
      }
    } catch (error) {
      console.warn('[WordChallenge] TTS播放失败:', error);
    }
  }, []);

  /**
   * 随机选择下一个单词
   */
  const nextWord = useCallback(() => {
    const entry = WORD_DATABASE[Math.floor(Math.random() * WORD_DATABASE.length)];
    setCurrentEntry(entry);
    // 自动播放新单词发音
    playPronunciation(entry.word);
  }, [playPronunciation]);

  // 倒计时逻辑
  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => setTimeLeft(t => t - 1), 1000);
      return () => clearInterval(timer);
    } else if (timeLeft === 0 && isActive) {
      setIsActive(false);
      setIsGameOver(true);
      // 播放游戏结束音效
      soundManager.playGameOver();
    }
  }, [isActive, timeLeft]);

  /**
   * 开始游戏
   */
  const startGame = () => {
    // 播放开始音效
    soundManager.playShoot();
    setScore(0);
    setTimeLeft(60);
    setIsActive(true);
    setIsGameOver(false);
    nextWord();
    setInput('');
  };

  /**
   * 输入处理
   */
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInput(val);
    
    // 输入正确
    if (currentEntry && val === currentEntry.word) {
      // 播放成功音效
      soundManager.playSuccess();
      setScore(s => s + 1);
      setInput('');
      nextWord();
    }
  };

  /**
   * 手动播放当前单词发音
   */
  const handlePlaySound = () => {
    if (currentEntry) {
      playPronunciation(currentEntry.word);
    }
  };

  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 p-8'
  },
    React.createElement('div', {
      className: 'max-w-2xl mx-auto'
    },
      // 顶部导航栏
      React.createElement('div', {
        className: 'flex justify-between items-center mb-8'
      },
        React.createElement('button', {
          onClick: onExit,
          className: 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-lg'
        }, '← 返回'),
        React.createElement('h2', {
          className: 'text-3xl font-bold text-gray-800 dark:text-white'
        }, '⚡ 单词挑战'),
        React.createElement('div', {
          className: 'w-16'
        })
      ),

      // 游戏未开始时的欢迎界面
      !isActive && !isGameOver && React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-xl text-center'
      },
        React.createElement('div', {
          className: 'text-6xl mb-6'
        }, '⚡'),
        React.createElement('p', {
          className: 'text-xl text-gray-700 dark:text-gray-300 mb-8 leading-relaxed'
        }, '在60秒内尽可能多地输入正确的单词！提高你的打字速度和准确性。'),
        React.createElement('button', {
          onClick: startGame,
          className: 'px-12 py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xl font-bold rounded-full hover:from-indigo-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105'
        }, '开始挑战 →')
      ),

      // 游戏进行中
      isActive && React.createElement('div', {
        className: 'space-y-8'
      },
        // 分数和时间显示
        React.createElement('div', {
          className: 'flex justify-center gap-12 text-2xl font-bold'
        },
          React.createElement('div', {
            className: 'text-indigo-600 dark:text-indigo-400'
          }, `得分: ${score}`),
          React.createElement('div', {
            className: timeLeft < 10 ? 'text-red-500 animate-pulse' : 'text-gray-600 dark:text-gray-400'
          }, `剩余时间: ${timeLeft}秒`)
        ),

        // 显示释义开关
        React.createElement('div', {
          className: 'flex justify-center'
        },
          React.createElement('label', {
            className: 'flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer'
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: showMeaning,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setShowMeaning(e.target.checked),
              className: 'rounded'
            }),
            '显示释义（关闭可增加难度）'
          )
        ),

        // 单词显示和输入区域
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 p-8 md:p-12 rounded-2xl shadow-xl'
        },
          currentEntry && React.createElement('div', {
            className: 'text-center mb-8'
          },
            // 单词显示
            React.createElement('div', {
              className: 'text-5xl md:text-7xl font-mono font-bold text-gray-800 dark:text-white mb-4 tracking-wider'
            }, currentEntry.word),
            
            // 音标显示和发音按钮
            React.createElement('div', {
              className: 'flex items-center justify-center gap-3 mb-3'
            },
              React.createElement('span', {
                className: 'text-xl text-indigo-600 dark:text-indigo-400 font-serif'
              }, currentEntry.phonetic),
              React.createElement('button', {
                onClick: handlePlaySound,
                className: 'p-2 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900 transition-colors',
                title: '播放发音'
              }, '🔊')
            ),
            
            // 词性和释义
            showMeaning && React.createElement('div', {
              className: 'text-lg text-gray-600 dark:text-gray-400 mb-6'
            },
              React.createElement('span', {
                className: 'text-purple-600 dark:text-purple-400 mr-2'
              }, currentEntry.partOfSpeech),
              currentEntry.meaning
            ),
            
            // 输入框
            React.createElement('input', {
              autoFocus: true,
              type: 'text',
              value: input,
              onChange: handleInput,
              className: 'w-full max-w-md px-6 py-4 text-center text-2xl border-b-4 border-indigo-500 focus:outline-none focus:border-purple-500 bg-transparent text-gray-800 dark:text-white transition-colors',
              placeholder: '在此输入单词...'
            })
          )
        ),

        // 提示信息
        React.createElement('div', {
          className: 'text-center text-gray-500 dark:text-gray-400 space-y-1'
        }, 
          React.createElement('p', null, '💡 提示：输入完全匹配后会自动进入下一个单词'),
          React.createElement('p', null, '🔊 点击喇叭图标可重复播放发音')
        )
      ),

      // 游戏结束界面
      isGameOver && React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 p-12 rounded-2xl shadow-xl text-center'
      },
        React.createElement('div', {
          className: 'text-6xl mb-6'
        }, timeLeft === 0 ? '⏰' : '🎉'),
        React.createElement('h3', {
          className: 'text-4xl font-bold text-gray-800 dark:text-white mb-6'
        }, '时间到！'),
        React.createElement('p', {
          className: 'text-3xl mb-8'
        },
          '最终得分: ',
          React.createElement('span', {
            className: 'text-indigo-600 dark:text-indigo-400 font-bold'
          }, score)
        ),
        React.createElement('div', {
          className: 'flex justify-center gap-4'
        },
          React.createElement('button', {
            onClick: startGame,
            className: 'px-8 py-3 bg-indigo-600 text-white text-lg rounded-xl hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg'
          }, '🔄 再玩一次'),
          React.createElement('button', {
            onClick: onExit,
            className: 'px-8 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-lg rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors'
          }, '退出游戏')
        )
      )
    )
  );
}

export default WordChallengePage;
