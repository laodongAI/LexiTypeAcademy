/**
 * 英语课程页面
 * 
 * 功能:
 * - 课程列表展示与筛选
 * - 课程详情预览
 * - 开始练习入口
 * - 课程管理(删除、导出)
 * - 示例课程创建
 * 
 * 使用: DDD架构，从数据库读取课程数据
 */

import React, { useState, useEffect } from 'react';
import { LexiTypeDB } from '@/infrastructure/versioning/db';
import {
  type EnhancedCourse,
  canEditCourse,
  canDeleteCourse,
  getSourceTypeLabel,
  getCoursePermissions
} from '@/domain/models/CourseModel';
import {
  CourseSourceBadge,
  ReadOnlyBadge,
  PermissionInfo
} from '@/ui/components/CoursePermissionBadges';

/** 生成唯一ID */
const generateId = () => Math.random().toString(36).slice(2, 10);

/** 示例课程数据 */
const SAMPLE_COURSES = [
  {
    id: generateId(),
    title: '新概念英语 - 第一册基础',
    description: '经典英语入门教材，适合零基础学习者。包含日常对话、基础语法和核心词汇。',
    difficulty: 'beginner' as const,
    type: 'text' as const,
    tags: ['教材', '入门', '经典'],
    cefrLevel: 'A1',
    lessons: [
      { id: generateId(), content: 'Excuse me! Is this your handbag?', contentTranslation: '对不起！这是你的手提包吗？', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'Yes, it is. Thank you very much.', contentTranslation: '是的，是我的。非常感谢。', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'Is this your umbrella? No, it is not.', contentTranslation: '这是你的雨伞吗？不，不是。', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'My name is Sophie. Nice to meet you.', contentTranslation: '我叫索菲。很高兴认识你。', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'How are you today? I am fine, thank you.', contentTranslation: '你今天怎么样？我很好，谢谢。', language: 'en' as const, lessonType: 'sentence' as const }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: '示例课程',
    stats: { practiceCount: 0, avgAccuracy: 0, avgWpm: 0, completedLessons: [] }
  },
  {
    id: generateId(),
    title: '日常口语100句',
    description: '精选100句最实用的日常英语口语，覆盖问候、购物、餐厅、交通等场景。',
    difficulty: 'beginner' as const,
    type: 'text' as const,
    tags: ['口语', '日常', '实用'],
    cefrLevel: 'A2',
    lessons: [
      { id: generateId(), content: 'Good morning! How did you sleep?', contentTranslation: '早上好！你睡得怎么样？', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'Could you please repeat that?', contentTranslation: '你能重复一下吗？', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'Where is the nearest subway station?', contentTranslation: '最近的地铁站在哪里？', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'I would like to order a coffee, please.', contentTranslation: '请给我来一杯咖啡。', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'How much does this cost?', contentTranslation: '这个多少钱？', language: 'en' as const, lessonType: 'sentence' as const },
      { id: generateId(), content: 'Can I pay by credit card?', contentTranslation: '我可以用信用卡支付吗？', language: 'en' as const, lessonType: 'sentence' as const }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: '示例课程',
    stats: { practiceCount: 0, avgAccuracy: 0, avgWpm: 0, completedLessons: [] }
  },
  {
    id: generateId(),
    title: '商务英语核心词汇',
    description: '商务场景必备词汇，包含会议、邮件、谈判等高频词汇和短语。',
    difficulty: 'intermediate' as const,
    type: 'words' as const,
    tags: ['商务', '词汇', '职场'],
    cefrLevel: 'B1',
    lessons: [
      { id: generateId(), content: 'negotiate', contentTranslation: '谈判', language: 'en' as const, lessonType: 'word' as const, words: [{ word: 'negotiate', translation: '谈判', example: 'We need to negotiate the contract terms.' }] },
      { id: generateId(), content: 'deadline', contentTranslation: '截止日期', language: 'en' as const, lessonType: 'word' as const, words: [{ word: 'deadline', translation: '截止日期', example: 'The deadline for the project is next Friday.' }] },
      { id: generateId(), content: 'proposal', contentTranslation: '提案', language: 'en' as const, lessonType: 'word' as const, words: [{ word: 'proposal', translation: '提案', example: 'Please review the proposal before the meeting.' }] },
      { id: generateId(), content: 'collaborate', contentTranslation: '合作', language: 'en' as const, lessonType: 'word' as const, words: [{ word: 'collaborate', translation: '合作', example: 'Our teams will collaborate on this project.' }] }
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: '示例课程',
    stats: { practiceCount: 0, avgAccuracy: 0, avgWpm: 0, completedLessons: [] }
  }
];

/** 课程类型定义 */
interface Course {
  id: string;
  title: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  type: 'text' | 'words' | 'mixed';
  tags?: string[];
  lessons: Lesson[];
  createdAt: string;
  updatedAt: string;
  source?: string;
  cefrLevel?: string;
  stats?: {
    practiceCount?: number;
    avgAccuracy?: number;
    avgWpm?: number;
    completedLessons?: string[];
  };
}

/** 课时类型定义 */
interface Lesson {
  id: string;
  content: string;
  contentTranslation?: string;
  words?: any[];
  language?: 'en' | 'zh';
  length?: number;
  source?: string;
  lessonType?: 'word' | 'sentence';
}

/** 组件 Props */
interface CoursesPageProps {
  /** 返回首页回调 */
  onBack: () => void;
  /** 导航到指定页面 */
  onNavigate?: (page: string, data?: any) => void;
}

/** 筛选条件 */
interface FilterState {
  search: string;
  difficulty: 'all' | 'beginner' | 'intermediate' | 'advanced' | 'custom';
  type: 'all' | 'text' | 'words' | 'mixed';
}

/**
 * 英语课程页面组件
 */
const CoursesPage: React.FC<CoursesPageProps> = ({ onBack, onNavigate }) => {
  // ========== 状态管理 ==========
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [filter, setFilter] = useState<FilterState>({
    search: '',
    difficulty: 'all',
    type: 'all'
  });

  // ========== 数据加载 ==========
  useEffect(() => {
    loadCourses();
  }, []);

  /**
   * 从数据库加载课程列表
   */
  const loadCourses = async () => {
    setLoading(true);
    try {
      const db = new LexiTypeDB();
      const allCourses = await db.courses.toArray();
      setCourses(allCourses as Course[]);
    } catch (error) {
      console.error('[CoursesPage] 加载课程失败:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 删除课程
   */
  const handleDeleteCourse = async (courseId: string) => {
    // 检查权限
    const courseToDelete = courses.find(c => c.id === courseId) as EnhancedCourse | undefined;
    if (courseToDelete && !canDeleteCourse(courseToDelete)) {
      alert('该课程不允许删除');
      return;
    }
    
    if (!window.confirm('确定要删除这个课程吗？删除后无法恢复。')) {
      return;
    }

    try {
      const db = new LexiTypeDB();
      await db.courses.delete(courseId);
      
      // 刷新列表
      await loadCourses();
      
      // 如果删除的是当前选中的课程，清除选中
      if (selectedCourse?.id === courseId) {
        setSelectedCourse(null);
      }
    } catch (error) {
      console.error('[CoursesPage] 删除课程失败:', error);
      alert('删除课程失败，请重试');
    }
  };

  /**
   * 创建示例课程
   */
  const handleCreateSampleCourses = async () => {
    try {
      const db = new LexiTypeDB();
      
      // 为每个示例课程生成新的ID（避免重复）
      const coursesToAdd = SAMPLE_COURSES.map(course => ({
        ...course,
        id: generateId(),
        lessons: course.lessons.map(lesson => ({
          ...lesson,
          id: generateId()
        })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }));
      
      // 批量添加
      await db.courses.bulkPut(coursesToAdd);
      
      // 刷新列表
      await loadCourses();
      
      alert(`成功创建 ${coursesToAdd.length} 门示例课程！`);
    } catch (error) {
      console.error('[CoursesPage] 创建示例课程失败:', error);
      alert('创建示例课程失败，请重试');
    }
  };

  /**
   * 导出课程为 JSON
   */
  const handleExportCourse = (course: Course) => {
    const dataStr = JSON.stringify(course, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${course.title}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ========== 过滤逻辑 ==========
  const filteredCourses = courses.filter(course => {
    // 搜索过滤
    if (filter.search && !course.title.toLowerCase().includes(filter.search.toLowerCase())) {
      return false;
    }
    // 难度过滤
    if (filter.difficulty !== 'all' && course.difficulty !== filter.difficulty) {
      return false;
    }
    // 类型过滤
    if (filter.type !== 'all' && course.type !== filter.type) {
      return false;
    }
    return true;
  });

  // ========== 难度颜色映射 ==========
  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'intermediate': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'advanced': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return '初级';
      case 'intermediate': return '中级';
      case 'advanced': return '高级';
      case 'custom': return '自定义';
      default: return difficulty;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'text': return '文本课程';
      case 'words': return '词汇课程';
      case 'mixed': return '综合课程';
      default: return type;
    }
  };

  // ========== 渲染: 加载状态 ==========
  if (loading) {
    return React.createElement('div', {
      className: 'min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800'
    },
      React.createElement('div', { className: 'text-center' },
        React.createElement('div', {
          className: 'animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4'
        }),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '加载课程中...')
      )
    );
  }

  // ========== 渲染: 课程详情面板 ==========
  const renderCourseDetail = () => {
    if (!selectedCourse) return null;

    const progress = selectedCourse.stats?.completedLessons?.length || 0;
    const total = selectedCourse.lessons?.length || 0;
    const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
    
    // 权限检查
    const enhancedCourse = selectedCourse as unknown as EnhancedCourse;
    const isEditable = canEditCourse(enhancedCourse);
    const isDeletable = canDeleteCourse(enhancedCourse);
    
    // 提取 source type (兼容新旧格式)
    const sourceType = enhancedCourse.source && typeof enhancedCourse.source === 'object' 
      ? (enhancedCourse.source as any).type 
      : null;

    return React.createElement('div', {
      className: 'fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4'
    },
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto'
      },
        // 头部
        React.createElement('div', {
          className: 'p-6 border-b dark:border-gray-700'
        },
          React.createElement('div', { className: 'flex items-start justify-between' },
            React.createElement('div', null,
              React.createElement('h2', {
                className: 'text-2xl font-bold text-gray-900 dark:text-white mb-2'
              }, selectedCourse.title),
              React.createElement('div', { className: 'flex items-center gap-2 flex-wrap' },
                React.createElement('span', {
                  className: `px-2 py-1 text-xs rounded-full ${getDifficultyColor(selectedCourse.difficulty)}`
                }, getDifficultyLabel(selectedCourse.difficulty)),
                React.createElement('span', {
                  className: 'px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                }, getTypeLabel(selectedCourse.type)),
                selectedCourse.cefrLevel && React.createElement('span', {
                  className: 'px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                }, `CEFR ${selectedCourse.cefrLevel}`),
                // 权限徽章
                !isEditable && React.createElement('span', {
                  className: 'px-2 py-1 text-xs rounded-full bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 flex items-center gap-1'
                }, '🔒 只读'),
                // 来源标签
                enhancedCourse.source?.type && React.createElement('span', {
                  className: 'px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }, getSourceTypeLabel(enhancedCourse.source.type))
              )
            ),
            React.createElement('button', {
              onClick: () => setSelectedCourse(null),
              className: 'p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }, '✕')
          )
        ),

        // 内容
        React.createElement('div', { className: 'p-6 space-y-6' },
          // 权限信息（如果有 sourceType）
          sourceType && (() => {
            const permissions = getCoursePermissions(sourceType);
            return React.createElement('div', null,
              React.createElement(PermissionInfo, {
                editable: permissions.editable,
                deletable: permissions.deletable,
                exportable: permissions.exportable,
                shareable: permissions.shareable,
                sourceType: sourceType
              })
            );
          })(),
          
          // 描述
          selectedCourse.description && React.createElement('div', null,
            React.createElement('h3', {
              className: 'text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'
            }, '课程描述'),
            React.createElement('p', {
              className: 'text-gray-700 dark:text-gray-300'
            }, selectedCourse.description)
          ),

          // 进度
          React.createElement('div', null,
            React.createElement('h3', {
              className: 'text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'
            }, '学习进度'),
            React.createElement('div', { className: 'flex items-center gap-4' },
              React.createElement('div', {
                className: 'flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-3'
              },
                React.createElement('div', {
                  className: 'bg-indigo-600 h-3 rounded-full transition-all',
                  style: { width: `${progressPercent}%` }
                })
              ),
              React.createElement('span', {
                className: 'text-sm text-gray-600 dark:text-gray-400'
              }, `${progress}/${total} 课时 (${progressPercent}%)`)
            )
          ),

          // 统计信息
          selectedCourse.stats && React.createElement('div', {
            className: 'grid grid-cols-3 gap-4'
          },
            React.createElement('div', {
              className: 'text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl'
            },
              React.createElement('div', {
                className: 'text-2xl font-bold text-indigo-600 dark:text-indigo-400'
              }, selectedCourse.stats.practiceCount || 0),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '练习次数')
            ),
            React.createElement('div', {
              className: 'text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl'
            },
              React.createElement('div', {
                className: 'text-2xl font-bold text-green-600 dark:text-green-400'
              }, `${Math.round(selectedCourse.stats.avgAccuracy || 0)}%`),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '平均准确率')
            ),
            React.createElement('div', {
              className: 'text-center p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl'
            },
              React.createElement('div', {
                className: 'text-2xl font-bold text-blue-600 dark:text-blue-400'
              }, Math.round(selectedCourse.stats.avgWpm || 0)),
              React.createElement('div', {
                className: 'text-xs text-gray-500 dark:text-gray-400'
              }, '平均WPM')
            )
          ),

          // 课时列表
          React.createElement('div', null,
            React.createElement('h3', {
              className: 'text-sm font-medium text-gray-500 dark:text-gray-400 mb-2'
            }, `课时列表 (${selectedCourse.lessons?.length || 0})`),
            React.createElement('div', {
              className: 'space-y-2 max-h-60 overflow-y-auto'
            },
              selectedCourse.lessons?.slice(0, 10).map((lesson, index) => {
                const isCompleted = selectedCourse.stats?.completedLessons?.includes(lesson.id);
                return React.createElement('div', {
                  key: lesson.id,
                  className: `flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg ${isCompleted ? 'opacity-60' : ''}`
                },
                  React.createElement('span', {
                    className: `w-6 h-6 rounded-full flex items-center justify-center text-xs ${isCompleted ? 'bg-green-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'}`
                  }, isCompleted ? '✓' : index + 1),
                  React.createElement('span', {
                    className: 'flex-1 text-sm text-gray-700 dark:text-gray-300 truncate'
                  }, lesson.content?.substring(0, 50) || '(空内容)'),
                  lesson.lessonType && React.createElement('span', {
                    className: 'px-2 py-1 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded'
                  }, lesson.lessonType === 'word' ? '词汇' : '句子')
                );
              }),
              selectedCourse.lessons?.length > 10 && React.createElement('p', {
                className: 'text-center text-sm text-gray-500 dark:text-gray-400 py-2'
              }, `还有 ${selectedCourse.lessons.length - 10} 个课时...`)
            )
          ),

          // 来源信息
          selectedCourse.source && React.createElement('div', {
            className: 'text-sm text-gray-500 dark:text-gray-400'
          }, `来源: ${selectedCourse.source}`)
        ),

        // 底部操作
        React.createElement('div', {
          className: 'p-6 border-t dark:border-gray-700 flex gap-3'
        },
          React.createElement('button', {
            onClick: () => {
              if (onNavigate) {
                onNavigate('follow-along-practice', { courseId: selectedCourse.id });
              } else {
                alert('开始练习功能即将上线');
              }
            },
            className: 'flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium'
          }, '🎯 标准练习'),
          React.createElement('button', {
            onClick: () => {
              if (onNavigate) {
                onNavigate('enhanced-follow-along-practice', { courseId: selectedCourse.id });
              } else {
                alert('增强练习功能即将上线');
              }
            },
            className: 'flex-1 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-colors font-medium'
          }, '✨ 增强练习'),
          React.createElement('button', {
            onClick: () => handleExportCourse(selectedCourse),
            className: 'px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors'
          }, '📥'),
          React.createElement('button', {
            onClick: () => {
              handleDeleteCourse(selectedCourse.id);
              setSelectedCourse(null);
            },
            disabled: !isDeletable,
            title: !isDeletable ? '该课程不允许删除' : '删除课程',
            className: `px-4 py-3 rounded-xl transition-colors ${
              isDeletable
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50 cursor-pointer'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed opacity-50'
            }`
          }, '🗑️')
        )
      )
    );
  };

  // ========== 渲染: 空状态 ==========
  const renderEmptyState = () => {
    // 如果是筛选后无结果
    if (courses.length > 0) {
      return React.createElement('div', {
        className: 'text-center py-16'
      },
        React.createElement('div', { className: 'text-6xl mb-4' }, '🔍'),
        React.createElement('h3', {
          className: 'text-xl font-semibold text-gray-900 dark:text-white mb-2'
        }, '没有匹配的课程'),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400 mb-6'
        }, '尝试调整筛选条件或搜索关键词')
      );
    }

    // 没有任何课程时的引导
    return React.createElement('div', {
      className: 'max-w-2xl mx-auto'
    },
      // 主提示
      React.createElement('div', {
        className: 'text-center mb-12'
      },
        React.createElement('div', { className: 'text-6xl mb-4' }, '📚'),
        React.createElement('h3', {
          className: 'text-2xl font-semibold text-gray-900 dark:text-white mb-2'
        }, '欢迎使用英语课程'),
        React.createElement('p', {
          className: 'text-gray-600 dark:text-gray-400'
        }, '您还没有任何课程，选择以下方式开始您的学习之旅')
      ),

      // 选项卡片
      React.createElement('div', {
        className: 'grid grid-cols-1 md:grid-cols-2 gap-6'
      },
        // 选项1: 创建示例课程
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow'
        },
          React.createElement('div', { className: 'text-4xl mb-4' }, '✨'),
          React.createElement('h4', {
            className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2'
          }, '快速体验'),
          React.createElement('p', {
            className: 'text-sm text-gray-600 dark:text-gray-400 mb-4'
          }, '一键创建3门精选示例课程，包含新概念英语、日常口语、商务词汇'),
          React.createElement('button', {
            onClick: handleCreateSampleCourses,
            className: 'w-full px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-colors font-medium'
          }, '🚀 创建示例课程')
        ),

        // 选项2: 前往 AI 实验室
        React.createElement('div', {
          className: 'bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow'
        },
          React.createElement('div', { className: 'text-4xl mb-4' }, '🤖'),
          React.createElement('h4', {
            className: 'text-lg font-semibold text-gray-900 dark:text-white mb-2'
          }, 'AI 生成课程'),
          React.createElement('p', {
            className: 'text-sm text-gray-600 dark:text-gray-400 mb-4'
          }, '使用 AI 实验室根据主题、难度生成个性化课程内容'),
          React.createElement('button', {
            onClick: () => onNavigate ? onNavigate('ai') : onBack(),
            className: 'w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-colors font-medium'
          }, '🔬 前往 AI 实验室')
        )
      ),

      // 其他入口
      React.createElement('div', {
        className: 'mt-8 text-center'
      },
        React.createElement('p', {
          className: 'text-sm text-gray-500 dark:text-gray-400 mb-4'
        }, '或者'),
        React.createElement('div', {
          className: 'flex justify-center gap-4 flex-wrap'
        },
          React.createElement('button', {
            onClick: () => {
              // TODO: 实现导入功能
              alert('导入功能即将上线，敬请期待！');
            },
            className: 'px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm'
          }, '📥 导入课程'),
          React.createElement('button', {
            onClick: () => onNavigate ? onNavigate('ai') : onBack(),
            className: 'px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm'
          }, '📚 教材导入')
        )
      )
    );
  };

  // ========== 主渲染 ==========
  return React.createElement('div', {
    className: 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800'
  },
    // 顶部导航
    React.createElement('div', {
      className: 'max-w-7xl mx-auto px-6 py-6'
    },
      React.createElement('button', {
        onClick: onBack,
        className: 'px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors shadow-sm'
      }, '← 返回首页')
    ),

    // 页面标题
    React.createElement('div', {
      className: 'max-w-7xl mx-auto px-6 mb-8'
    },
      React.createElement('div', { className: 'text-center' },
        React.createElement('div', { className: 'flex items-center justify-center gap-3 mb-4' },
          React.createElement('span', { className: 'text-5xl' }, '📚'),
          React.createElement('h1', {
            className: 'text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400'
          }, '英语课程')
        ),
        React.createElement('p', {
          className: 'text-lg text-gray-600 dark:text-gray-400'
        }, `共 ${courses.length} 门课程，继续您的学习之旅`)
      )
    ),

    // 筛选栏
    React.createElement('div', {
      className: 'max-w-7xl mx-auto px-6 mb-6'
    },
      React.createElement('div', {
        className: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4'
      },
        React.createElement('div', {
          className: 'flex flex-wrap gap-4 items-center'
        },
          // 搜索框
          React.createElement('div', { className: 'flex-1 min-w-[200px]' },
            React.createElement('input', {
              type: 'text',
              placeholder: '搜索课程...',
              value: filter.search,
              onChange: (e: React.ChangeEvent<HTMLInputElement>) => setFilter({ ...filter, search: e.target.value }),
              className: 'w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none'
            })
          ),
          // 难度筛选
          React.createElement('select', {
            value: filter.difficulty,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFilter({ ...filter, difficulty: e.target.value as any }),
            className: 'px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none'
          },
            React.createElement('option', { value: 'all' }, '全部难度'),
            React.createElement('option', { value: 'beginner' }, '初级'),
            React.createElement('option', { value: 'intermediate' }, '中级'),
            React.createElement('option', { value: 'advanced' }, '高级'),
            React.createElement('option', { value: 'custom' }, '自定义')
          ),
          // 类型筛选
          React.createElement('select', {
            value: filter.type,
            onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setFilter({ ...filter, type: e.target.value as any }),
            className: 'px-4 py-2 border dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none'
          },
            React.createElement('option', { value: 'all' }, '全部类型'),
            React.createElement('option', { value: 'text' }, '文本课程'),
            React.createElement('option', { value: 'words' }, '词汇课程'),
            React.createElement('option', { value: 'mixed' }, '综合课程')
          ),
          // 统计信息
          React.createElement('span', {
            className: 'text-sm text-gray-500 dark:text-gray-400'
          }, `显示 ${filteredCourses.length} / ${courses.length} 门课程`)
        )
      )
    ),

    // 课程列表
    React.createElement('div', {
      className: 'max-w-7xl mx-auto px-6 pb-12'
    },
      filteredCourses.length === 0
        ? renderEmptyState()
        : React.createElement('div', {
            className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
          },
            filteredCourses.map(course => {
              const progress = course.stats?.completedLessons?.length || 0;
              const total = course.lessons?.length || 0;
              const progressPercent = total > 0 ? Math.round((progress / total) * 100) : 0;
              
              // 提取 source type (兼容新旧格式)
              const sourceType = course.source && typeof course.source === 'object' 
                ? (course.source as any).type 
                : null;

              return React.createElement('div', {
                key: course.id,
                onClick: () => setSelectedCourse(course),
                className: 'bg-white dark:bg-gray-800 rounded-xl shadow-sm hover:shadow-lg transition-all cursor-pointer overflow-hidden group'
              },
                // 卡片头部
                React.createElement('div', {
                  className: 'p-5'
                },
                  // 来源徽章（如果有 sourceType）
                  sourceType && React.createElement('div', { className: 'mb-2' },
                    React.createElement(CourseSourceBadge, { 
                      sourceType: sourceType 
                    })
                  ),
                  // 标题和标签
                  React.createElement('div', { className: 'flex items-start justify-between mb-3' },
                    React.createElement('h3', {
                      className: 'text-lg font-semibold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors line-clamp-2'
                    }, course.title),
                    React.createElement('span', {
                      className: `px-2 py-1 text-xs rounded-full ${getDifficultyColor(course.difficulty)} flex-shrink-0 ml-2`
                    }, getDifficultyLabel(course.difficulty))
                  ),

                  // 描述
                  course.description && React.createElement('p', {
                    className: 'text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-2'
                  }, course.description),

                  // 元信息
                  React.createElement('div', {
                    className: 'flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-3'
                  },
                    React.createElement('span', null, `${total} 课时`),
                    React.createElement('span', null, '·'),
                    React.createElement('span', null, getTypeLabel(course.type)),
                    course.cefrLevel && React.createElement('span', null, '·'),
                    course.cefrLevel && React.createElement('span', null, `CEFR ${course.cefrLevel}`)
                  ),

                  // 进度条
                  React.createElement('div', null,
                    React.createElement('div', {
                      className: 'flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 mb-1'
                    },
                      React.createElement('span', null, '学习进度'),
                      React.createElement('span', null, `${progressPercent}%`)
                    ),
                    React.createElement('div', {
                      className: 'h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden'
                    },
                      React.createElement('div', {
                        className: 'h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all',
                        style: { width: `${progressPercent}%` }
                      })
                    )
                  )
                ),

                // 卡片底部
                React.createElement('div', {
                  className: 'px-5 py-3 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between'
                },
                  React.createElement('span', {
                    className: 'text-xs text-gray-500 dark:text-gray-400'
                  }, `创建于 ${new Date(course.createdAt).toLocaleDateString()}`),
                  React.createElement('span', {
                    className: 'text-xs text-indigo-600 dark:text-indigo-400 group-hover:underline'
                  }, '查看详情 →')
                )
              );
            })
          )
    ),

    // 课程详情弹窗
    selectedCourse && renderCourseDetail()
  );
};

export default CoursesPage;
