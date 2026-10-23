/**
 * AI 课程生成器页面
 * 
 * 功能：
 * - 基于主题生成课程内容
 * - 支持多种生成模式（文本/对话/故事/词汇）
 * - 可配置难度、词数、风格等参数
 * - 保存到课程列表
 * 
 * 参考：src_bak/AILab.tsx 中的课程生成功能
 */

import React, { useState } from 'react';
import { db } from '@/infrastructure/persistence/database';

interface AICourseGeneratorPageProps {
  onBack: () => void;
}

// ========== AI 配置 ==========
interface AIConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

const DEFAULT_AI_CONFIG: AIConfig = {
  apiKey: '93df0f81-97f7-40d0-8a84-c2e6a3298c0c',
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-251015'
};

const getAIConfig = (): AIConfig => {
  const saved = localStorage.getItem('ai_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.apiKey && parsed.apiKey.trim()) {
        return {
          apiKey: parsed.apiKey,
          endpoint: parsed.endpoint || DEFAULT_AI_CONFIG.endpoint,
          model: parsed.model || DEFAULT_AI_CONFIG.model
        };
      }
    } catch (e) {
      console.warn('解析 AI 配置失败');
    }
  }
  return DEFAULT_AI_CONFIG;
};

const callAI = async (prompt: string, systemPrompt: string = 'You are a helpful English writing tutor.'): Promise<string> => {
  const config = getAIConfig();
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `AI 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

const parseAIResponse = (content: string): any => {
  const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleanContent);
};

const generateId = (): string => {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

/**
 * AI 课程生成器页面组件
 */
const AICourseGeneratorPage: React.FC<AICourseGeneratorPageProps> = ({ onBack }) => {
  // ========== 状态管理 ==========
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState<'text' | 'vocabulary' | 'dialog' | 'story'>('text');
  const [difficulty, setDifficulty] = useState('B1');
  const [wordCount, setWordCount] = useState('12');
  const [style, setStyle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  // ========== 生成课程 ==========
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('请输入课程主题');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setLogs([]);

    addLog('========================================');
    addLog(`开始生成 ${mode} 类型课程...`);
    addLog(`主题: ${topic}`);
    addLog(`难度: ${difficulty}`);

    try {
      let prompt = '';
      
      if (mode === 'vocabulary') {
        prompt = `Create a vocabulary learning course about "${topic}".
Generate ${wordCount} words with:
- English word
- IPA phonetic transcription
- Part of speech
- Chinese translation
- Example sentence

Difficulty level: ${difficulty}
${style ? `Style: ${style}` : ''}

Return ONLY valid JSON:
{
  "title": "Course Title",
  "description": "Brief description",
  "vocabulary": [
    {
      "word": "example",
      "phonetic": "/ɪɡˈzɑːmpəl/",
      "pos": "n.",
      "translation": "例子",
      "example": "For example, this is a sentence."
    }
  ]
}`;
      } else if (mode === 'dialog') {
        prompt = `Create an English dialog/conversation about "${topic}".
Difficulty level: ${difficulty}
${style ? `Style: ${style}` : ''}

Requirements:
- Natural conversation with 6-10 exchanges
- Include common phrases
- Suitable for ${difficulty} level learners

Return ONLY valid JSON:
{
  "title": "Dialog Title",
  "description": "Brief description",
  "lines": [
    {
      "speaker": "Person A",
      "text": "Hello, how are you?",
      "translation": "你好，你怎么样？"
    }
  ]
}`;
      } else if (mode === 'story') {
        prompt = `Create an English short story about "${topic}".
Difficulty level: ${difficulty}
${style ? `Style: ${style}` : ''}

Requirements:
- 5-8 sentences
- Clear narrative
- Suitable for ${difficulty} level learners

Return ONLY valid JSON:
{
  "title": "Story Title",
  "description": "Brief description",
  "content": "The full story text here...",
  "translation": "故事的中文翻译..."
}`;
      } else {
        // text mode
        prompt = `Create a typing practice text about "${topic}".
Difficulty level: ${difficulty}
${style ? `Style: ${style}` : ''}

Requirements:
- 50-100 words
- Natural and fluent
- Suitable for ${difficulty} level learners

Return ONLY valid JSON:
{
  "title": "Text Title",
  "description": "Brief description",
  "content": "The practice text here...",
  "translation": "中文翻译..."
}`;
      }

      prompt += '\n\nDo not include markdown formatting. Just the raw JSON.';

      addLog('正在调用 AI 生成内容...');
      const content = await callAI(prompt, 'You are a helpful English learning course generator.');
      
      addLog('✓ AI 响应成功');
      addLog('正在解析结果...');
      
      const aiResult = parseAIResponse(content);
      setResult(aiResult);
      
      addLog('✓ 解析完成');
      addLog(`标题: ${aiResult.title || 'N/A'}`);
      addLog('========================================');
      
    } catch (err: any) {
      addLog(`✗ 生成失败: ${err.message}`);
      setError(err.message || 'AI 生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // ========== 保存课程 ==========
  const handleSave = async () => {
    if (!result) return;

    try {
      addLog('\n保存课程到数据库...');
      
      const courseId = generateId();
      const course = {
        id: courseId,
        title: result.title || `AI生成-${topic}`,
        description: result.description || `关于 ${topic} 的 ${mode} 课程`,
        type: mode === 'vocabulary' ? 'words' as const : 'text' as const,
        difficulty: difficulty,
        tags: ['AI生成', mode, topic, difficulty],
        source: 'AI Course Generator',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lessons: []
      };

      // 根据模式构建课程内容
      if (mode === 'vocabulary' && result.vocabulary) {
        course.lessons = [{
          id: generateId(),
          title: 'Vocabulary List',
          content: result.vocabulary.map((v: any) => v.word).join(' '),
          language: 'en',
          length: result.vocabulary.length * 10,
          words: result.vocabulary.map((v: any) => ({
            id: generateId(),
            word: v.word,
            phonetic: v.phonetic,
            partOfSpeech: v.pos,
            translation: v.translation,
            example: v.example,
            mastery: 0
          }))
        }];
      } else if (mode === 'dialog' && result.lines) {
        const fullText = result.lines.map((l: any) => `${l.speaker}: ${l.text}`).join(' ');
        const fullTranslation = result.lines.map((l: any) => `${l.speaker}: ${l.translation}`).join('\n');
        
        course.lessons = [{
          id: generateId(),
          title: result.title || 'Dialog',
          content: fullText,
          contentTranslation: fullTranslation,
          language: 'en',
          length: fullText.length
        }];
      } else {
        // text or story
        course.lessons = [{
          id: generateId(),
          title: result.title || 'Lesson 1',
          content: result.content || '',
          contentTranslation: result.translation || '',
          language: 'en',
          length: (result.content || '').length
        }];
      }

      await db.courses.put(course);
      
      addLog('✓ 课程已保存到数据库');
      addLog(`📚 课程 ID: ${courseId}`);
      addLog('========================================');
      addLog('🎉 课程已添加到"英语课程"列表！');
      
    } catch (err: any) {
      addLog(`✗ 保存失败: ${err.message}`);
      setError('保存课程失败: ' + err.message);
    }
  };

  // ========== 快速模板 ==========
  const templates = [
    { id: 'business', label: '商务邮件', topic: 'Business email etiquette tips', mode: 'text' as const, difficulty: 'B2' },
    { id: 'travel', label: '旅行对话', topic: 'Travel survival conversations', mode: 'dialog' as const, difficulty: 'B1' },
    { id: 'story', label: '童话故事', topic: 'Mystic forest adventure', mode: 'story' as const, difficulty: 'B2' },
    { id: 'tech', label: '科技词汇', topic: 'Tech startup vocabulary', mode: 'vocabulary' as const, difficulty: 'B2' }
  ];

  // ========== 渲染 ==========
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-gray-900 dark:to-gray-800'
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
        }, '⚡ AI 课程生成器'),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '输入主题，让 AI 为你生成个性化学习内容')
      ),

      // 内容卡片
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700'
      },
        // 错误提示
        error && React.createElement('div', {
          className: 'mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800'
        }, error),

        // 快速模板
        React.createElement('div', { className: 'mb-6' },
          React.createElement('h3', {
            className: 'text-sm font-medium text-gray-700 dark:text-gray-300 mb-3'
          }, '快速开始模板'),
          React.createElement('div', { className: 'flex flex-wrap gap-2' },
            templates.map(t =>
              React.createElement('button', {
                key: t.id,
                onClick: () => {
                  setTopic(t.topic);
                  setMode(t.mode);
                  setDifficulty(t.difficulty);
                },
                disabled: isGenerating,
                className: 'px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50'
              }, t.label)
            )
          )
        ),

        // 表单
        React.createElement('div', { className: 'space-y-6' },
          // 主题
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
            }, '课程主题 *'),
            React.createElement('input', {
              type: 'text',
              value: topic,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTopic(e.target.value),
              disabled: isGenerating,
              placeholder: '例如：Daily conversations at a coffee shop',
              className: 'w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            })
          ),

          // 模式和难度
          React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
            React.createElement('div', {},
              React.createElement('label', {
                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
              }, '生成模式'),
              React.createElement('select', {
                value: mode,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setMode(e.target.value as any),
                disabled: isGenerating,
                className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              },
                React.createElement('option', { value: 'text' }, '📝 文本练习'),
                React.createElement('option', { value: 'vocabulary' }, '📚 词汇列表'),
                React.createElement('option', { value: 'dialog' }, '💬 对话练习'),
                React.createElement('option', { value: 'story' }, '📖 故事阅读')
              )
            ),
            React.createElement('div', {},
              React.createElement('label', {
                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
              }, '难度等级'),
              React.createElement('select', {
                value: difficulty,
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setDifficulty(e.target.value),
                disabled: isGenerating,
                className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              },
                React.createElement('option', { value: 'A1' }, 'A1 - 入门'),
                React.createElement('option', { value: 'A2' }, 'A2 - 初级'),
                React.createElement('option', { value: 'B1' }, 'B1 - 中级'),
                React.createElement('option', { value: 'B2' }, 'B2 - 中高级'),
                React.createElement('option', { value: 'C1' }, 'C1 - 高级')
              )
            ),
            mode === 'vocabulary' && React.createElement('div', {},
              React.createElement('label', {
                className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
              }, '词汇数量'),
              React.createElement('input', {
                type: 'number',
                value: wordCount,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setWordCount(e.target.value),
                disabled: isGenerating,
                min: 5,
                max: 30,
                className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
              })
            )
          ),

          // 风格（可选）
          React.createElement('div', {},
            React.createElement('label', {
              className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
            }, '内容风格（可选）'),
            React.createElement('input', {
              type: 'text',
              value: style,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setStyle(e.target.value),
              disabled: isGenerating,
              placeholder: '例如：Friendly and casual / Professional / Humorous',
              className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
            })
          ),

          // 日志
          logs.length > 0 && React.createElement('div', {
            className: 'border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-60 overflow-y-auto font-mono text-xs'
          },
            React.createElement('h4', {
              className: 'font-medium text-gray-900 dark:text-white mb-2 sticky top-0 bg-gray-50 dark:bg-gray-900'
            }, '生成日志'),
            React.createElement('div', { className: 'space-y-1' },
              logs.map((log, idx) =>
                React.createElement('p', {
                  key: idx,
                  className: `${
                    log.includes('✓') ? 'text-green-600 dark:text-green-400' :
                    log.includes('✗') ? 'text-red-600 dark:text-red-400' :
                    log.includes('🎉') ? 'text-emerald-600 dark:text-emerald-400 font-bold' :
                    'text-gray-600 dark:text-gray-400'
                  }`
                }, log)
              )
            )
          ),

          // 结果预览
          result && React.createElement('div', {
            className: 'border dark:border-gray-700 rounded-lg p-6 bg-emerald-50 dark:bg-emerald-900/20'
          },
            React.createElement('h3', {
              className: 'text-lg font-bold text-gray-900 dark:text-white mb-2'
            }, '✨ 生成结果'),
            React.createElement('h4', {
              className: 'text-md font-semibold text-gray-800 dark:text-gray-200'
            }, result.title),
            React.createElement('p', {
              className: 'text-sm text-gray-600 dark:text-gray-400 mt-1'
            }, result.description),
            mode === 'vocabulary' && result.vocabulary && React.createElement('p', {
              className: 'text-sm text-emerald-600 dark:text-emerald-400 mt-2'
            }, `包含 ${result.vocabulary.length} 个词汇`)
          ),

          // 操作按钮
          React.createElement('div', { className: 'flex justify-between pt-4' },
            React.createElement('button', {
              onClick: () => {
                setResult(null);
                setLogs([]);
                setError(null);
              },
              disabled: isGenerating,
              className: 'px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50 transition-colors'
            }, '重置'),
            React.createElement('div', { className: 'flex gap-3' },
              result && React.createElement('button', {
                onClick: handleSave,
                disabled: isGenerating,
                className: 'px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors font-medium'
              }, '💾 保存课程'),
              React.createElement('button', {
                onClick: handleGenerate,
                disabled: !topic.trim() || isGenerating,
                className: 'px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
              }, isGenerating ? '生成中...' : '⚡ 开始生成')
            )
          )
        )
      )
    )
  );
};

export default AICourseGeneratorPage;
