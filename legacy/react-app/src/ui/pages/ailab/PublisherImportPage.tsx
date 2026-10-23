/**
 * 教材体系导入页面 (Publisher Import Page)
 * 
 * 完全重构版本 - 基于 src_bak/CourseSystemBuilder.tsx
 * 
 * 四步向导流程:
 * - Step 1: 选择出版社 → AI 自动获取教材系列
 * - Step 2: 选择教材 → AI 自动解析单元结构
 * - Step 3: 选择课程类型 → 生成词汇/句子/音标课程
 * - Step 4: 查看生成日志和结果
 * 
 * AI 集成: 使用千问/豆包模型进行教材解析和内容生成
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '@/infrastructure/persistence/database';

// ========== AI 配置接口 ==========
interface AIConfig {
  apiKey: string;
  endpoint: string;
  model: string;
}

/** 教材信息 */
interface Textbook {
  grade: string;
  semester: string;
  name: string;
}

/** 单元信息 */
interface Unit {
  unit_num: number;
  title: string;
  topics: string[];
  selected: boolean;
  generated: boolean;
}

/** 生成选项 */
interface GenerationOptions {
  coreCount: number;    // 核心词数量
  extraCount: number;   // 拓展词数量
  sentenceCount: number; // 句子数量
}

/** 生成的课程数据 */
interface GeneratedCourse {
  id: string;
  title: string;
  description: string;
  type: 'words' | 'text' | 'phonics';
  lessons: any[];
  tags: string[];
  source: string;
  createdAt: number;
  updatedAt: number;
}

/** 步骤类型 */
type Step = 1 | 2 | 3 | 4;

interface PublisherImportPageProps {
  onBack: () => void;
}

// ========== AI 工具函数 ==========

// ========== AI 默认配置 ==========
const DEFAULT_AI_CONFIG: AIConfig = {
  apiKey: '93df0f81-97f7-40d0-8a84-c2e6a3298c0c',
  endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  model: 'doubao-seed-1-6-251015'
};

/**
 * 获取 AI 配置（从 localStorage，带默认值回退）
 */
const getAIConfig = (): AIConfig => {
  const saved = localStorage.getItem('ai_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // 如果保存的配置有 apiKey 且不为空，使用它；否则回退到默认配置
      if (parsed.apiKey && parsed.apiKey.trim()) {
        return {
          apiKey: parsed.apiKey,
          endpoint: parsed.endpoint || DEFAULT_AI_CONFIG.endpoint,
          model: parsed.model || DEFAULT_AI_CONFIG.model
        };
      }
    } catch (e) {
      console.warn('解析 AI 配置失败，使用默认配置');
    }
  }
  // 使用默认配置
  return DEFAULT_AI_CONFIG;
};

/**
 * 调用 AI 模型
 */
const callAI = async (prompt: string, systemPrompt: string = 'You are an educational expert.'): Promise<string> => {
  const config = getAIConfig();
  if (!config.apiKey) {
    throw new Error('请先在设置中配置 AI API Key');
  }

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
      temperature: 0.3
    })
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `AI 请求失败: ${response.status}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
};

/**
 * 解析 AI 响应为 JSON
 */
const parseAIResponse = (content: string): any => {
  // 清理 markdown 代码块
  const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
  return JSON.parse(cleanContent);
};

/**
 * 生成唯一 ID
 */
const generateId = (): string => {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
};

/**
 * 教材体系导入向导组件
 */
const PublisherImportPage: React.FC<PublisherImportPageProps> = ({ onBack }) => {
  // ========== 步骤状态 ==========
  const [currentStep, setCurrentStep] = useState<Step>(1);

  // ========== Step 1: 出版社选择状态 ==========
  const [publisher, setPublisher] = useState('人民教育出版社');
  const [series, setSeries] = useState('');
  const [availableSeries, setAvailableSeries] = useState<string[]>([]);
  const [gradeLevel, setGradeLevel] = useState('小学（G1-G6）');
  const [textbooks, setTextbooks] = useState<Textbook[]>([]);
  const [selectedTextbook, setSelectedTextbook] = useState<Textbook | null>(null);

  // ========== Step 2: 单元解析状态 ==========
  const [units, setUnits] = useState<Unit[]>([]);

  // ========== Step 3: 生成状态 ==========
  const [selectedCourseTypes, setSelectedCourseTypes] = useState<string[]>(['words']);
  const [generationOptions, setGenerationOptions] = useState<GenerationOptions>({
    coreCount: 8,
    extraCount: 5,
    sentenceCount: 5
  });

  // ========== 通用状态 ==========
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCoursesCount, setGeneratedCoursesCount] = useState(0);

  // ========== 出版社列表 ==========
  const publishers = [
    '人民教育出版社',
    '外语教学与研究出版社',
    '牛津大学出版社',
    '北京师范大学出版社',
    '译林出版社'
  ];

  // ========== 学段列表 ==========
  const gradeLevels = [
    '小学（G1-G6）',
    '初中（G7-G9）',
    '高中（G10-G12）'
  ];

  // ========== 添加日志 ==========
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  }, []);

  // ========== AI 调用: 获取系列列表 ==========
  const fetchSeriesList = useCallback(async (pub: string) => {
    setIsLoading(true);
    setError(null);
    addLog(`正在获取 ${pub} 的教材系列...`);

    try {
      const prompt = `请尽可能全面地列出${pub}出版的所有英语教材系列（涵盖K12阶段、小学、初中、高中）。
请注意区分不同的版本或子系列（例如：人教版可能有"PEP人教版"、"新起点"、"精通版"、"Go for it!"、"新目标"等）。
请返回一个包含所有系列名称的JSON对象。

JSON格式示例：
{
  "series": ["PEP人教版 (三年级起点)", "人教版新起点 (一年级起点)", "人教版精通版 (三年级起点)"]
}`;

      const content = await callAI(prompt, 'You are an educational expert specializing in Chinese English textbook editions.');
      const result = parseAIResponse(content);
      
      const seriesList: string[] = result.series || [];
      setAvailableSeries(seriesList);
      if (seriesList.length > 0) {
        setSeries(seriesList[0]);
      }
      addLog(`✓ 获取到 ${seriesList.length} 个教材系列`);
    } catch (err: any) {
      // 如果 AI 调用失败，使用预设数据
      console.error('AI 调用失败，使用预设数据:', err);
      let seriesList: string[] = [];
      if (pub === '人民教育出版社') {
        seriesList = ['PEP人教版 (三年级起点)', '人教版新起点 (一年级起点)', '人教版精通版', '人教版新目标 Go for it!', '人教版高中英语 (2019版)'];
      } else if (pub === '外语教学与研究出版社') {
        seriesList = ['外研版新标准 (三年级起点)', '外研版新标准 (一年级起点)', '外研版高中英语'];
      } else if (pub === '牛津大学出版社') {
        seriesList = ['牛津上海版', '牛津深圳版', '牛津译林版'];
      } else {
        seriesList = ['标准版', '实验版'];
      }

      setAvailableSeries(seriesList);
      if (seriesList.length > 0) {
        setSeries(seriesList[0]);
      }
      addLog(`⚠ AI 调用失败，使用预设数据 (${seriesList.length} 个系列)`);
      addLog(`  原因: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [addLog]);

  // ========== AI 调用: 获取教材列表 ==========
  const fetchTextbookList = useCallback(async () => {
    if (!publisher || !series) return;
    
    setIsLoading(true);
    setError(null);
    addLog(`正在获取 ${series} 的教材列表...`);

    try {
      const gradePrompt = gradeLevel ? `（适用学段：${gradeLevel}）` : '';
      const prompt = `请列出${publisher}${series}教材${gradePrompt}的完整目录结构，按年级和学期输出教材名称，JSON格式：
{
  "textbooks": [
    {"grade": "G1", "semester": "上册", "name": "英语一年级上册"},
    {"grade": "G1", "semester": "下册", "name": "英语一年级下册"}
  ]
}`;

      const content = await callAI(prompt, 'You are an educational expert.');
      const result = parseAIResponse(content);
      
      const textbookList: Textbook[] = result.textbooks || [];
      setTextbooks(textbookList);
      if (textbookList.length > 0) {
        setSelectedTextbook(textbookList[0]);
      }
      addLog(`✓ 获取到 ${textbookList.length} 本教材`);
    } catch (err: any) {
      // AI 调用失败，使用预设数据
      console.error('AI 调用失败，使用预设数据:', err);
      const mockTextbooks: Textbook[] = [];
      const grades = gradeLevel.includes('小学') ? ['G3', 'G4', 'G5', 'G6'] :
                     gradeLevel.includes('初中') ? ['G7', 'G8', 'G9'] :
                     ['G10', 'G11', 'G12'];
      
      for (const g of grades) {
        mockTextbooks.push({ grade: g, semester: '上册', name: `英语${g}上册` });
        mockTextbooks.push({ grade: g, semester: '下册', name: `英语${g}下册` });
      }

      setTextbooks(mockTextbooks);
      if (mockTextbooks.length > 0) {
        setSelectedTextbook(mockTextbooks[0]);
      }
      addLog(`⚠ AI 调用失败，使用预设数据 (${mockTextbooks.length} 本教材)`);
      addLog(`  原因: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [publisher, series, gradeLevel, addLog]);

  // ========== AI 调用: 解析单元结构 ==========
  const parseUnits = useCallback(async () => {
    if (!selectedTextbook) return;
    
    setIsLoading(true);
    setError(null);
    addLog(`正在解析《${selectedTextbook.name}》的单元结构...`);

    try {
      const prompt = `请作为资深教材专家，智能解析${publisher}${series}《${selectedTextbook.name}》的目录结构。

请按以下步骤思考（Chain of Thought）：
1. **精准定位教材**：
   - 分析出版社、系列和书名，锁定唯一的官方教材版本。
   - **智能纠错与推断**：如果书名与系列学段看似冲突，请结合中国学制习惯进行推断。请优先尝试匹配最可能的真实教材，而不是直接报错。

2. **解析目录层级**：
   - 识别教材的实际组织方式（Unit / Module / Lesson）。
   - 如果是 Module 下包含 Unit，请以 Unit 为基础条目。

3. **提取数据**：
   - 提取真实的单元序号、单元标题（Title）和核心话题（Topics）。

请返回标准JSON格式：
{
  "units": [
    {
      "unit_num": 1, 
      "title": "单元标题（请保留教材原文标题）", 
      "topics": ["核心话题1", "核心话题2"] 
    }
  ]
}`;

      const content = await callAI(prompt, 'You are an educational expert specializing in ESL textbooks.');
      const result = parseAIResponse(content);
      
      const unitList: Unit[] = (result.units || []).map((u: any) => ({
        ...u,
        selected: true,
        generated: false
      }));
      
      setUnits(unitList);
      addLog(`✓ 解析到 ${unitList.length} 个单元`);
    } catch (err: any) {
      // AI 调用失败，使用预设数据
      console.error('AI 调用失败，使用预设数据:', err);
      const mockUnits: Unit[] = [
        { unit_num: 1, title: 'Hello!', topics: ['问候', '自我介绍'], selected: true, generated: false },
        { unit_num: 2, title: 'My Family', topics: ['家庭成员', '亲属称谓'], selected: true, generated: false },
        { unit_num: 3, title: 'My School', topics: ['学校设施', '教室物品'], selected: true, generated: false },
        { unit_num: 4, title: 'My Classroom', topics: ['颜色', '形状'], selected: true, generated: false },
        { unit_num: 5, title: 'Let\'s Eat', topics: ['食物', '饮料'], selected: true, generated: false },
        { unit_num: 6, title: 'Happy Birthday', topics: ['生日', '礼物', '数字'], selected: true, generated: false }
      ];

      setUnits(mockUnits);
      addLog(`⚠ AI 调用失败，使用预设数据 (${mockUnits.length} 个单元)`);
      addLog(`  原因: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTextbook, publisher, series, addLog]);

  // ========== AI 调用: 生成教材课程内容 ==========
  const generateTextbookCourseContent = async (
    textbookName: string,
    unitTitle: string,
    type: 'words' | 'sentences' | 'phonics',
    options: GenerationOptions
  ): Promise<any> => {
    let prompt = '';
    
    if (type === 'words') {
      prompt = `基于《${textbookName}》${unitTitle}，生成：
1. 核心词汇表（${options.coreCount || 8}词）：英文单词、国际音标、词性、中文释义
2. 拓展词汇表（${options.extraCount || 5}词）：同主题关联词
3. 每词配1个教材例句
JSON格式：
{
  "core_words": [
    {
      "word": "单词",
      "phonetic": "音标",
      "pos": "词性",
      "zh": "中文",
      "example": "例句"
    }
  ],
  "extra_words": [
    {
      "word": "拓展词",
      "phonetic": "音标",
      "pos": "词性",
      "zh": "中文",
      "example": "例句"
    }
  ]
}`;
    } else if (type === 'sentences') {
      prompt = `请获取《${textbookName}》${unitTitle}的**主要课文或对话内容**。
1. 将课文按句子拆分。
2. 为每个句子提供中文翻译。
3. 提取该句中的1-2个核心关键词（keywords）。
JSON格式：
{
  "title": "课文标题",
  "sentences": [
    {
      "en": "英文原句",
      "zh": "中文翻译",
      "keywords": ["关键词1", "关键词2"]
    }
  ]
}`;
    } else if (type === 'phonics') {
      prompt = `针对《${textbookName}》${unitTitle}中的单词，生成音标练习：
1. 目标音标及发音要领
2. 3个例词及音标分解
3. 1组最小对立对辨音练习
JSON格式：
{
  "phonics": [
    {
      "target_sound": "目标音标",
      "pronunciation": "发音要领",
      "examples": [
        {
          "word": "例词",
          "phonetic_breakdown": "音标分解"
        }
      ],
      "minimal_pairs": [
        {
          "word1": "对比词1",
          "word2": "对比词2",
          "explanation": "辨音说明"
        }
      ]
    }
  ]
}`;
    }

    const content = await callAI(prompt, 'You are an educational expert.');
    return parseAIResponse(content);
  };

  // ========== 保存课程到数据库 ==========
  const saveCourseToDatabase = async (course: GeneratedCourse): Promise<void> => {
    try {
      await db.courses.put(course);
      addLog(`  💾 课程已保存到数据库: ${course.title}`);
    } catch (err: any) {
      addLog(`  ⚠ 保存课程失败: ${err.message}`);
      throw err;
    }
  };

  // ========== 生成课程内容 ==========
  const handleGenerateContent = useCallback(async () => {
    const selectedUnits = units.filter(u => u.selected);
    if (selectedUnits.length === 0 || selectedCourseTypes.length === 0) {
      setError('请至少选择一个单元和一种课程类型');
      return;
    }

    setIsGenerating(true);
    setError(null);
    const generatedCourses: GeneratedCourse[] = [];
    
    addLog('========================================');
    addLog(`开始生成课程，共 ${selectedUnits.length} 个单元，${selectedCourseTypes.length} 种类型`);
    addLog(`教材: ${selectedTextbook?.name || 'N/A'}`);
    addLog(`系列: ${series}`);
    addLog('========================================');

    try {
      for (const unit of selectedUnits) {
        addLog(`\n处理 Unit ${unit.unit_num}: ${unit.title}...`);
        
        for (const type of selectedCourseTypes as ('words' | 'sentences' | 'phonics')[]) {
          addLog(`  → 生成 ${type} 课程...`);
          
          try {
            // 调用 AI 生成内容
            const result = await generateTextbookCourseContent(
              selectedTextbook?.name || '',
              `Unit ${unit.unit_num}: ${unit.title}`,
              type,
              generationOptions
            );
            
            // 构建课程数据
            const courseId = generateId();
            const courseTitle = `[${series} ${selectedTextbook?.grade}${selectedTextbook?.semester}] U${unit.unit_num}-${type}`;
            
            const courseData: GeneratedCourse = {
              id: courseId,
              title: courseTitle,
              description: `${unit.title} - ${unit.topics.join(', ')}`,
              type: type === 'words' ? 'words' : type === 'sentences' ? 'text' : 'phonics',
              lessons: [],
              tags: [series, selectedTextbook?.grade || '', `Unit ${unit.unit_num}`, type],
              source: 'AI Course Builder - Publisher Import',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };

            // 根据类型构建课程内容
            if (type === 'words' && result.core_words) {
              const content = result.core_words.map((w: any) => w.word).join(' ');
              courseData.lessons = [{
                id: generateId(),
                title: 'Core Words',
                words: result.core_words.map((w: any) => ({
                  id: generateId(),
                  word: w.word,
                  phonetic: w.phonetic,
                  partOfSpeech: w.pos,
                  translation: w.zh,
                  example: w.example,
                  mastery: 0
                })),
                content: content,
                language: 'en',
                length: content.length
              }];
              
              // 如果有拓展词汇，添加第二个 lesson
              if (result.extra_words && result.extra_words.length > 0) {
                const extraContent = result.extra_words.map((w: any) => w.word).join(' ');
                courseData.lessons.push({
                  id: generateId(),
                  title: 'Extra Words',
                  words: result.extra_words.map((w: any) => ({
                    id: generateId(),
                    word: w.word,
                    phonetic: w.phonetic,
                    partOfSpeech: w.pos,
                    translation: w.zh,
                    example: w.example,
                    mastery: 0
                  })),
                  content: extraContent,
                  language: 'en',
                  length: extraContent.length
                });
              }
            } else if (type === 'sentences' && result.sentences) {
              // 如果 AI 返回了标题，使用它
              if (result.title) {
                courseData.title = `[${series} ${selectedTextbook?.grade}${selectedTextbook?.semester}] U${unit.unit_num}-${result.title}`;
              }
              
              const fullContent = result.sentences.map((s: any) => s.en).join(' ');
              const fullTranslation = result.sentences.map((s: any) => s.zh).join('\n');
              
              courseData.lessons = [{
                id: generateId(),
                title: result.title || 'Text',
                content: fullContent,
                contentTranslation: fullTranslation,
                language: 'en',
                length: fullContent.length,
                sentences: result.sentences.map((s: any) => ({
                  id: generateId(),
                  en: s.en,
                  zh: s.zh,
                  keywords: s.keywords ? s.keywords.map((k: string) => ({ word: k })) : []
                }))
              }];
            } else if (type === 'phonics' && result.phonics) {
              courseData.lessons = result.phonics.map((p: any) => {
                const content = p.examples.map((e: any) => e.word).join(' ');
                return {
                  id: generateId(),
                  title: `Sound ${p.target_sound}`,
                  content: content,
                  contentTranslation: `Sound: ${p.target_sound} - ${p.pronunciation}`,
                  language: 'en',
                  length: content.length,
                  words: p.examples.map((e: any) => ({
                    id: generateId(),
                    word: e.word,
                    phonetic: e.phonetic_breakdown,
                    mastery: 0
                  }))
                };
              });
            }

            // 保存到数据库
            await saveCourseToDatabase(courseData);
            generatedCourses.push(courseData);
            
            addLog(`  ✓ ${type} 课程生成成功`);
            
          } catch (err: any) {
            addLog(`  ✗ ${type} 生成失败: ${err.message}`);
          }
        }

        // 标记单元为已生成
        setUnits(prev => prev.map(u => 
          u.unit_num === unit.unit_num ? { ...u, generated: true } : u
        ));
      }

      addLog('\n========================================');
      addLog('🎉 所有课程生成完成！');
      addLog(`共生成 ${generatedCourses.length} 门课程`);
      addLog('========================================');
      
      // 保存生成的课程数量
      setGeneratedCoursesCount(generatedCourses.length);
      
      // 自动进入下一步
      setCurrentStep(4);
    } catch (err: any) {
      addLog(`\n✗ 生成失败: ${err.message}`);
      setError(err.message || '生成课程失败');
    } finally {
      setIsGenerating(false);
    }
  }, [units, selectedCourseTypes, selectedTextbook, series, generationOptions, addLog]);

  // ========== 当出版社改变时获取系列 ==========
  useEffect(() => {
    if (publisher) {
      fetchSeriesList(publisher);
    }
  }, [publisher, fetchSeriesList]);

  // ========== 当系列改变时获取教材 ==========
  useEffect(() => {
    if (series) {
      fetchTextbookList();
    }
  }, [series, gradeLevel, fetchTextbookList]);

  // ========== 当教材改变时解析单元 ==========
  useEffect(() => {
    if (selectedTextbook && currentStep >= 2) {
      parseUnits();
    }
  }, [selectedTextbook, currentStep, parseUnits]);

  // ========== 渲染: 进度条 ==========
  const renderProgressBar = () => {
    const steps = [
      { num: 1, title: '选择教材' },
      { num: 2, title: '单元解析' },
      { num: 3, title: '内容生成' },
      { num: 4, title: '完成' }
    ];

    return React.createElement('div', {
      className: 'flex items-center justify-between mb-8 px-4'
    },
      steps.map((step, idx) => 
        React.createElement('div', {
          key: step.num,
          className: `flex items-center ${idx < steps.length - 1 ? 'flex-1' : ''}`
        },
          React.createElement('div', {
            className: `flex items-center justify-center w-10 h-10 rounded-full font-semibold transition-colors ${
              currentStep >= step.num
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
            }`
          }, step.num),
          React.createElement('span', {
            className: `ml-2 text-sm font-medium ${
              currentStep >= step.num
                ? 'text-purple-600 dark:text-purple-400'
                : 'text-gray-500 dark:text-gray-400'
            }`
          }, step.title),
          idx < steps.length - 1 && React.createElement('div', {
            className: `flex-1 h-1 mx-4 rounded-full ${
              currentStep > step.num
                ? 'bg-purple-600'
                : 'bg-gray-200 dark:bg-gray-700'
            }`
          })
        )
      )
    );
  };

  // ========== 渲染: Step 1 - 选择教材体系 ==========
  const renderStep1 = () => {
    return React.createElement('div', { className: 'space-y-6' },
      React.createElement('h3', {
        className: 'text-xl font-bold text-gray-900 dark:text-white'
      }, 'Step 1: 选择教材体系'),

      // 错误提示
      error && React.createElement('div', {
        className: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 p-3 rounded-lg'
      }, error),

      // 表单网格
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
        // 出版社选择
        React.createElement('div', {},
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          }, '出版社'),
          React.createElement('select', {
            value: publisher,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setPublisher(e.target.value),
            className: 'w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none'
          },
            publishers.map(p => React.createElement('option', { key: p, value: p }, p))
          )
        ),

        // 系列选择
        React.createElement('div', {},
          React.createElement('div', { className: 'flex justify-between items-center mb-2' },
            React.createElement('label', {
              className: 'text-sm font-medium text-gray-700 dark:text-gray-300'
            }, '教材系列'),
            React.createElement('button', {
              onClick: () => fetchSeriesList(publisher),
              disabled: isLoading,
              className: 'text-xs text-purple-600 dark:text-purple-400 hover:underline disabled:opacity-50'
            }, '刷新')
          ),
          React.createElement('select', {
            value: series,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setSeries(e.target.value),
            disabled: isLoading || availableSeries.length === 0,
            className: 'w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50'
          },
            availableSeries.length === 0
              ? React.createElement('option', { value: '' }, isLoading ? '加载中...' : '无可用系列')
              : availableSeries.map(s => React.createElement('option', { key: s, value: s }, s))
          )
        ),

        // 学段选择
        React.createElement('div', {},
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          }, '适用学段'),
          React.createElement('select', {
            value: gradeLevel,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setGradeLevel(e.target.value),
            className: 'w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none'
          },
            gradeLevels.map(g => React.createElement('option', { key: g, value: g }, g))
          )
        ),

        // 教材选择
        React.createElement('div', {},
          React.createElement('label', {
            className: 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'
          }, '选择教材'),
          React.createElement('select', {
            value: selectedTextbook?.name || '',
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => {
              const tb = textbooks.find(t => t.name === e.target.value);
              setSelectedTextbook(tb || null);
            },
            disabled: isLoading || textbooks.length === 0,
            className: 'w-full px-4 py-3 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 outline-none disabled:opacity-50'
          },
            textbooks.length === 0
              ? React.createElement('option', { value: '' }, isLoading ? '加载中...' : '无可用教材')
              : textbooks.map(tb => React.createElement('option', { key: tb.name, value: tb.name }, `${tb.grade} ${tb.semester} - ${tb.name}`))
          )
        )
      ),

      // 加载指示器
      isLoading && React.createElement('div', {
        className: 'flex items-center gap-2 text-purple-600 dark:text-purple-400'
      },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent'
        }),
        React.createElement('span', {}, 'AI 正在获取数据...')
      ),

      // 底部按钮
      React.createElement('div', { className: 'flex justify-end pt-4' },
        React.createElement('button', {
          onClick: () => setCurrentStep(2),
          disabled: isLoading || textbooks.length === 0 || !selectedTextbook,
          className: 'px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
        }, '下一步：解析单元')
      )
    );
  };

  // ========== 渲染: Step 2 - 单元解析 ==========
  const renderStep2 = () => {
    return React.createElement('div', { className: 'space-y-6' },
      React.createElement('h3', {
        className: 'text-xl font-bold text-gray-900 dark:text-white'
      }, 'Step 2: 解析单元结构'),

      // 当前教材信息
      selectedTextbook && React.createElement('div', {
        className: 'bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800'
      },
        React.createElement('p', { className: 'text-purple-800 dark:text-purple-300' },
          `📚 ${publisher} - ${series} - ${selectedTextbook.grade} ${selectedTextbook.semester}`
        )
      ),

      // 两栏布局
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-3 gap-6' },
        // 左侧：教材列表
        React.createElement('div', {
          className: 'border dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto'
        },
          React.createElement('h4', {
            className: 'font-medium text-gray-900 dark:text-white mb-3'
          }, '教材列表'),
          React.createElement('div', { className: 'space-y-2' },
            textbooks.map(tb =>
              React.createElement('div', {
                key: tb.name,
                onClick: () => setSelectedTextbook(tb),
                className: `p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedTextbook?.name === tb.name
                    ? 'bg-purple-100 dark:bg-purple-900/30 border-2 border-purple-500'
                    : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              },
                React.createElement('p', { className: 'font-medium text-gray-900 dark:text-white text-sm' }, tb.name),
                React.createElement('p', { className: 'text-xs text-gray-500 dark:text-gray-400' }, `${tb.grade} - ${tb.semester}`)
              )
            )
          )
        ),

        // 右侧：单元列表
        React.createElement('div', {
          className: 'md:col-span-2 border dark:border-gray-700 rounded-lg p-4 max-h-96 overflow-y-auto'
        },
          React.createElement('div', { className: 'flex justify-between items-center mb-3' },
            React.createElement('h4', {
              className: 'font-medium text-gray-900 dark:text-white'
            }, '单元结构'),
            React.createElement('button', {
              onClick: parseUnits,
              disabled: isLoading,
              className: 'text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 disabled:opacity-50'
            }, isLoading ? '解析中...' : '重新解析')
          ),
          units.length === 0
            ? React.createElement('div', {
                className: 'text-center py-12 text-gray-500 dark:text-gray-400'
              }, isLoading ? 'AI 正在解析单元结构...' : '请选择教材后解析')
            : React.createElement('div', { className: 'space-y-2' },
                // 全选/取消全选
                React.createElement('div', { className: 'flex gap-2 mb-3' },
                  React.createElement('button', {
                    onClick: () => setUnits(prev => prev.map(u => ({ ...u, selected: true }))),
                    className: 'text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600'
                  }, '全选'),
                  React.createElement('button', {
                    onClick: () => setUnits(prev => prev.map(u => ({ ...u, selected: false }))),
                    className: 'text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600'
                  }, '取消全选')
                ),
                units.map(unit =>
                  React.createElement('div', {
                    key: unit.unit_num,
                    className: `border dark:border-gray-600 rounded-lg p-3 ${
                      unit.generated ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''
                    }`
                  },
                    React.createElement('div', { className: 'flex items-center justify-between' },
                      React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
                        React.createElement('input', {
                          type: 'checkbox',
                          checked: unit.selected,
                          onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                            setUnits(prev => prev.map(u =>
                              u.unit_num === unit.unit_num ? { ...u, selected: e.target.checked } : u
                            ));
                          },
                          className: 'w-4 h-4 text-purple-600 rounded focus:ring-purple-500'
                        }),
                        React.createElement('span', { className: 'font-medium text-gray-900 dark:text-white' },
                          `Unit ${unit.unit_num}: ${unit.title}`
                        )
                      ),
                      unit.generated && React.createElement('span', {
                        className: 'text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full'
                      }, '已生成')
                    ),
                    React.createElement('p', {
                      className: 'text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1'
                    }, `Topics: ${unit.topics.join(', ')}`)
                  )
                )
              )
        )
      ),

      // 底部按钮
      React.createElement('div', { className: 'flex justify-between pt-4' },
        React.createElement('button', {
          onClick: () => setCurrentStep(1),
          className: 'px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors'
        }, '← 上一步'),
        React.createElement('button', {
          onClick: () => setCurrentStep(3),
          disabled: units.filter(u => u.selected).length === 0,
          className: 'px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
        }, '下一步：生成内容')
      )
    );
  };

  // ========== 渲染: Step 3 - 内容生成 ==========
  const renderStep3 = () => {
    const selectedCount = units.filter(u => u.selected).length;

    return React.createElement('div', { className: 'space-y-6' },
      React.createElement('h3', {
        className: 'text-xl font-bold text-gray-900 dark:text-white'
      }, 'Step 3: 生成课程内容'),

      // 两栏布局
      React.createElement('div', { className: 'grid grid-cols-1 md:grid-cols-2 gap-6' },
        // 左侧：课程类型选择
        React.createElement('div', { className: 'space-y-4' },
          React.createElement('div', {
            className: 'border dark:border-gray-700 rounded-lg p-4'
          },
            React.createElement('h4', {
              className: 'font-medium text-gray-900 dark:text-white mb-4'
            }, '课程类型选择'),
            React.createElement('div', { className: 'space-y-4' },
              // 单词课程
              React.createElement('div', {},
                React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: selectedCourseTypes.includes('words'),
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedCourseTypes(prev => [...prev, 'words']);
                      } else {
                        setSelectedCourseTypes(prev => prev.filter(t => t !== 'words'));
                      }
                    },
                    className: 'w-4 h-4 text-purple-600 rounded focus:ring-purple-500'
                  }),
                  React.createElement('span', { className: 'text-gray-900 dark:text-white' }, '📝 单词课程 (Words)')
                ),
                selectedCourseTypes.includes('words') && React.createElement('div', {
                  className: 'ml-6 mt-2 space-y-2 text-sm'
                },
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'text-gray-600 dark:text-gray-400' }, '核心词数:'),
                    React.createElement('input', {
                      type: 'number',
                      value: generationOptions.coreCount,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setGenerationOptions(prev => ({ ...prev, coreCount: +e.target.value })),
                      className: 'w-16 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    })
                  ),
                  React.createElement('div', { className: 'flex items-center gap-2' },
                    React.createElement('span', { className: 'text-gray-600 dark:text-gray-400' }, '拓展词数:'),
                    React.createElement('input', {
                      type: 'number',
                      value: generationOptions.extraCount,
                      onChange: (e: React.ChangeEvent<HTMLInputElement>) => setGenerationOptions(prev => ({ ...prev, extraCount: +e.target.value })),
                      className: 'w-16 px-2 py-1 border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    })
                  )
                )
              ),

              // 句子课程
              React.createElement('div', {},
                React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: selectedCourseTypes.includes('sentences'),
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedCourseTypes(prev => [...prev, 'sentences']);
                      } else {
                        setSelectedCourseTypes(prev => prev.filter(t => t !== 'sentences'));
                      }
                    },
                    className: 'w-4 h-4 text-purple-600 rounded focus:ring-purple-500'
                  }),
                  React.createElement('span', { className: 'text-gray-900 dark:text-white' }, '📖 句子课程 (Sentences)')
                ),
                React.createElement('p', {
                  className: 'text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1'
                }, '获取完整课文并拆分为句子')
              ),

              // 音标课程
              React.createElement('div', {},
                React.createElement('label', { className: 'flex items-center gap-2 cursor-pointer' },
                  React.createElement('input', {
                    type: 'checkbox',
                    checked: selectedCourseTypes.includes('phonics'),
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
                      if (e.target.checked) {
                        setSelectedCourseTypes(prev => [...prev, 'phonics']);
                      } else {
                        setSelectedCourseTypes(prev => prev.filter(t => t !== 'phonics'));
                      }
                    },
                    className: 'w-4 h-4 text-purple-600 rounded focus:ring-purple-500'
                  }),
                  React.createElement('span', { className: 'text-gray-900 dark:text-white' }, '🔊 音标课程 (Phonics)')
                ),
                React.createElement('p', {
                  className: 'text-xs text-gray-500 dark:text-gray-400 ml-6 mt-1'
                }, '按音素分组学习发音规则')
              )
            )
          ),

          // 生成摘要
          React.createElement('div', {
            className: 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4'
          },
            React.createElement('p', { className: 'text-purple-800 dark:text-purple-300' },
              `将为 ${selectedCount} 个单元生成 ${selectedCourseTypes.length} 种类型课程`
            ),
            React.createElement('p', { className: 'text-sm text-purple-600 dark:text-purple-400 mt-1' },
              `预计生成 ${selectedCount * selectedCourseTypes.length} 门课程`
            )
          )
        ),

        // 右侧：生成日志
        React.createElement('div', {
          className: 'border dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800 h-80 overflow-y-auto font-mono text-sm'
        },
          React.createElement('h4', {
            className: 'font-medium text-gray-900 dark:text-white mb-3 sticky top-0 bg-gray-50 dark:bg-gray-800'
          }, '生成日志'),
          logs.length === 0
            ? React.createElement('p', { className: 'text-gray-500 dark:text-gray-400' }, '等待开始...')
            : React.createElement('div', { className: 'space-y-1' },
                logs.map((log, idx) =>
                  React.createElement('p', {
                    key: idx,
                    className: `whitespace-pre-wrap ${
                      log.includes('✓') ? 'text-green-600 dark:text-green-400' :
                      log.includes('✗') ? 'text-red-600 dark:text-red-400' :
                      log.includes('🎉') ? 'text-purple-600 dark:text-purple-400 font-bold' :
                      'text-gray-600 dark:text-gray-400'
                    }`
                  }, log)
                )
              )
        )
      ),

      // 底部按钮
      React.createElement('div', { className: 'flex justify-between pt-4' },
        React.createElement('button', {
          onClick: () => setCurrentStep(2),
          disabled: isGenerating,
          className: 'px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50'
        }, '← 上一步'),
        React.createElement('button', {
          onClick: handleGenerateContent,
          disabled: isGenerating || selectedCourseTypes.length === 0 || selectedCount === 0,
          className: 'px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium'
        }, isGenerating ? '生成中...' : '🚀 开始生成')
      )
    );
  };

  // ========== 渲染: Step 4 - 完成 ==========
  const renderStep4 = () => {
    const generatedUnitCount = units.filter(u => u.generated).length;

    return React.createElement('div', { className: 'space-y-6 text-center' },
      React.createElement('div', { className: 'text-6xl mb-4' }, '🎉'),
      React.createElement('h3', {
        className: 'text-2xl font-bold text-gray-900 dark:text-white'
      }, '课程生成完成！'),
      React.createElement('p', {
        className: 'text-gray-600 dark:text-gray-400'
      }, `成功为 ${generatedUnitCount} 个单元生成了 ${generatedCoursesCount} 门课程`),

      // 统计卡片
      React.createElement('div', { className: 'grid grid-cols-3 gap-4 max-w-md mx-auto mt-8' },
        React.createElement('div', {
          className: 'bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl'
        },
          React.createElement('p', { className: 'text-2xl font-bold text-purple-600 dark:text-purple-400' }, generatedUnitCount),
          React.createElement('p', { className: 'text-xs text-gray-600 dark:text-gray-400' }, '单元')
        ),
        React.createElement('div', {
          className: 'bg-green-50 dark:bg-green-900/20 p-4 rounded-xl'
        },
          React.createElement('p', { className: 'text-2xl font-bold text-green-600 dark:text-green-400' }, selectedCourseTypes.length),
          React.createElement('p', { className: 'text-xs text-gray-600 dark:text-gray-400' }, '课程类型')
        ),
        React.createElement('div', {
          className: 'bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl'
        },
          React.createElement('p', { className: 'text-2xl font-bold text-blue-600 dark:text-blue-400' }, generatedCoursesCount),
          React.createElement('p', { className: 'text-xs text-gray-600 dark:text-gray-400' }, '总课程数')
        )
      ),

      // 操作按钮
      React.createElement('div', { className: 'flex justify-center gap-4 mt-8' },
        React.createElement('button', {
          onClick: () => {
            setCurrentStep(1);
            setUnits([]);
            setLogs([]);
            setGeneratedCoursesCount(0);
          },
          className: 'px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
        }, '继续导入'),
        React.createElement('button', {
          onClick: onBack,
          className: 'px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors'
        }, '返回 AI 实验室')
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800'
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
        }, '📚 英语课程体系建设向导'),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '选择出版社教材，AI 自动解析单元并生成课程内容')
      ),

      // 进度条
      renderProgressBar(),

      // 内容卡片
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 border border-gray-200 dark:border-gray-700'
      },
        currentStep === 1 && renderStep1(),
        currentStep === 2 && renderStep2(),
        currentStep === 3 && renderStep3(),
        currentStep === 4 && renderStep4()
      )
    )
  );
};

export default PublisherImportPage;
