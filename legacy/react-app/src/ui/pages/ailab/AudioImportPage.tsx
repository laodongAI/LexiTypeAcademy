/**
 * 音频导入课程页面
 * 
 * 功能：
 * - 上传音频文件（MP3/WAV/M4A等）
 * - 自动转写文本（ASR）
 * - 智能分句
 * - 自动翻译
 * - 词汇提取
 * - 生成可打字的课程
 * 
 * 参考：src_bak/AudioCourseWizard.tsx
 */

import React, { useState } from 'react';
import { db } from '@/infrastructure/persistence/database';

interface AudioImportPageProps {
  onBack: () => void;
}

/** 生成唯一 ID */
const generateId = (): string => {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

/**
 * 音频导入课程页面组件
 */
const AudioImportPage: React.FC<AudioImportPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<'en' | 'zh'>('en');
  const [courseTitle, setCourseTitle] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const MAX_SIZE_MB = 70;

  // ========== 添加日志 ==========
  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  // ========== 处理文件选择 ==========
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (!f) return;
    
    if (!f.type.startsWith('audio/')) {
      setError('请选择有效的音频文件');
      return;
    }
    
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`文件大小超过 ${MAX_SIZE_MB}MB，无法导入`);
      return;
    }
    
    setError(null);
    setFile(f);
    if (!courseTitle) {
      setCourseTitle(f.name.replace(/\.[^/.]+$/, ''));
    }
  };

  // ========== 开始处理 ==========
  const handleProcess = async () => {
    if (!file) {
      setError('请先选择音频文件');
      return;
    }

    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setLogs([]);
    
    addLog('========================================');
    addLog('开始处理音频文件...');
    addLog(`文件名: ${file.name}`);
    addLog(`文件大小: ${(file.size / 1024 / 1024).toFixed(2)} MB`);
    addLog(`目标语言: ${language === 'en' ? '英语' : '中文'}`);

    try {
      // Phase 1: 准备阶段
      setProgress(10);
      addLog('\n[阶段 1/5] 准备音频文件...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Phase 2: 音频转写 (ASR)
      setProgress(30);
      addLog('[阶段 2/5] 正在进行语音识别转写...');
      addLog('  ⚠ 注意: 实际部署需要集成 ASR 服务');
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // 模拟转写结果
      const mockText = language === 'en' 
        ? 'Hello everyone. Welcome to our English learning course. Today we are going to learn some basic vocabulary. First, let me introduce myself. My name is Teacher Wang.'
        : '大家好。欢迎来到我们的英语学习课程。今天我们将学习一些基础词汇。首先让我自我介绍一下。我叫王老师。';
      
      addLog('  ✓ 转写完成');
      
      // Phase 3: 智能分句
      setProgress(50);
      addLog('[阶段 3/5] 智能分句...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      const sentences = mockText.split(/\.\s+/).filter(s => s.trim());
      addLog(`  ✓ 分句完成，共 ${sentences.length} 个句子`);
      
      // Phase 4: 自动翻译
      setProgress(70);
      addLog('[阶段 4/5] 自动翻译句子...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      addLog('  ✓ 翻译完成');
      
      // Phase 5: 词汇提取
      setProgress(85);
      addLog('[阶段 5/5] 提取核心词汇...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // 模拟词汇提取
      const mockWords = [
        { word: 'welcome', phonetic: '/ˈwelkəm/', translation: '欢迎' },
        { word: 'course', phonetic: '/kɔːrs/', translation: '课程' },
        { word: 'vocabulary', phonetic: '/vəˈkæbjələri/', translation: '词汇' },
        { word: 'introduce', phonetic: '/ˌɪntrəˈdjuːs/', translation: '介绍' }
      ];
      
      addLog(`  ✓ 提取了 ${mockWords.length} 个核心词汇`);
      
      // Phase 6: 保存课程
      setProgress(95);
      addLog('\n[保存课程] 正在保存到数据库...');
      
      const courseId = generateId();
      const finalTitle = courseTitle || file.name.replace(/\.[^/.]+$/, '');
      
      const course = {
        id: courseId,
        title: `[音频导入] ${finalTitle}`,
        description: `从音频文件 ${file.name} 导入`,
        type: 'text' as const,
        difficulty: 'intermediate',
        tags: ['音频导入', language === 'en' ? '英语' : '中文', 'AI处理'],
        source: 'Audio Import',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lessons: [{
          id: generateId(),
          title: 'Lesson 1',
          content: sentences.join(' '),
          contentTranslation: language === 'en' ? '（翻译）' : mockText,
          language: language,
          length: mockText.length,
          words: mockWords.map(w => ({
            id: generateId(),
            word: w.word,
            phonetic: w.phonetic,
            translation: w.translation,
            mastery: 0
          }))
        }]
      };
      
      await db.courses.put(course);
      
      setProgress(100);
      addLog('  ✓ 课程已保存到数据库');
      addLog(`  📚 课程 ID: ${courseId}`);
      addLog('\n========================================');
      addLog('🎉 音频导入完成！');
      addLog(`课程已添加到"英语课程"列表，可以开始学习了。`);
      addLog('========================================');
      
    } catch (err: any) {
      addLog(`\n✗ 处理失败: ${err.message}`);
      setError(err.message || '音频处理失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // ========== 重置 ==========
  const handleReset = () => {
    setFile(null);
    setCourseTitle('');
    setProgress(0);
    setLogs([]);
    setError(null);
  };

  // ========== 渲染 ==========
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-gray-900 dark:to-gray-800'
  },
    // 返回按钮
    React.createElement('div', { className: 'max-w-5xl mx-auto pt-6 px-6' },
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm'
      }, '← 返回')
    ),

    // 主内容
    React.createElement('div', {
      className: 'max-w-5xl mx-auto p-6'
    },
      // 标题
      React.createElement('div', { className: 'text-center mb-8' },
        React.createElement('h1', {
          className: 'text-3xl font-bold text-gray-900 dark:text-white mb-2'
        }, '🎧 音频导入课程'),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '上传音频，自动转写、分句、翻译并生成课程')
      ),

      // 内容卡片
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700'
      },
        // 错误提示
        error && React.createElement('div', {
          className: 'mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800'
        }, error),

        // 表单区域
        React.createElement('div', { className: 'space-y-6' },
          // 文件选择
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
            }, '选择音频文件'),
            React.createElement('input', {
              type: 'file',
              accept: '.mp3,.wav,.m4a,.aac,.ogg,.flac,audio/*',
              onChange: handleFileChange,
              disabled: isProcessing,
              className: 'w-full text-sm text-gray-700 dark:text-gray-300'
            }),
            React.createElement('p', {
              className: 'text-xs text-gray-500 dark:text-gray-400 mt-2'
            }, `支持 MP3/WAV/M4A 等格式，最大 ${MAX_SIZE_MB}MB`),
            file && React.createElement('p', {
              className: 'text-xs text-green-600 dark:text-green-400 mt-1'
            }, `✓ 已选择: ${file.name}`)
          ),

          // 语言和标题
          React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
            React.createElement('div', {},
              React.createElement('label', {
                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
              }, '目标语言'),
              React.createElement('select', {
                value: language,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setLanguage(e.target.value as 'en' | 'zh'),
                disabled: isProcessing,
                className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              },
                React.createElement('option', { value: 'en' }, '英语'),
                React.createElement('option', { value: 'zh' }, '中文')
              )
            ),
            React.createElement('div', {},
              React.createElement('label', {
                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
              }, '课程标题（可选）'),
              React.createElement('input', {
                type: 'text',
                value: courseTitle,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setCourseTitle(e.target.value),
                disabled: isProcessing,
                placeholder: '默认使用文件名',
                className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              })
            )
          ),

          // 进度条
          isProcessing && React.createElement('div', { className: 'space-y-2' },
            React.createElement('div', { className: 'flex justify-between text-sm text-gray-600 dark:text-gray-400' },
              React.createElement('span', {}, '处理进度'),
              React.createElement('span', {}, `${progress}%`)
            ),
            React.createElement('div', {
              className: 'w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden'
            },
              React.createElement('div', {
                className: 'h-full bg-indigo-600 transition-all duration-300',
                style: { width: `${progress}%` }
              })
            )
          ),

          // 日志区域
          logs.length > 0 && React.createElement('div', {
            className: 'border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-80 overflow-y-auto font-mono text-xs'
          },
            React.createElement('h4', {
              className: 'font-medium text-gray-900 dark:text-white mb-2 sticky top-0 bg-gray-50 dark:bg-gray-900'
            }, '处理日志'),
            React.createElement('div', { className: 'space-y-1' },
              logs.map((log, idx) =>
                React.createElement('p', {
                  key: idx,
                  className: `${
                    log.includes('✓') ? 'text-green-600 dark:text-green-400' :
                    log.includes('✗') ? 'text-red-600 dark:text-red-400' :
                    log.includes('🎉') ? 'text-indigo-600 dark:text-indigo-400 font-bold' :
                    log.includes('⚠') ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-gray-600 dark:text-gray-400'
                  }`
                }, log)
              )
            )
          ),

          // 操作按钮
          React.createElement('div', { className: 'flex justify-between pt-4' },
            React.createElement('button', {
              onClick: handleReset,
              disabled: isProcessing,
              className: 'px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors'
            }, '重置'),
            React.createElement('button', {
              onClick: handleProcess,
              disabled: !file || isProcessing,
              className: 'px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
            }, isProcessing ? '处理中...' : '🚀 开始处理')
          )
        )
      ),

      // 提示信息
      React.createElement('div', {
        className: 'mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4'
      },
        React.createElement('p', { className: 'text-yellow-800 dark:text-yellow-300 text-sm' },
          '⚠ 注意：当前为演示版本，实际转写功能需要集成 ASR 服务（如 Whisper、Sherpa-ONNX 等）'
        )
      )
    )
  );
};

export default AudioImportPage;
