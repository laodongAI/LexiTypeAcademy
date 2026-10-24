/**
 * Vue Router 路由配置
 * 
 * 定义应用的所有页面路由
 */

import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('../views/HomePage.vue'),
    meta: {
      title: '首页',
      icon: 'House',
    },
  },
  // 我的学习
  {
    path: '/my-learning',
    name: 'MyLearning',
    component: () => import('../views/MyLearningPage.vue'),
    meta: {
      title: '我的学习',
      icon: 'User',
      group: 'learning',
    },
  },
  // 课程仓库
  {
    path: '/course-repository',
    name: 'CourseRepository',
    component: () => import('../views/CourseRepositoryPage.vue'),
    meta: {
      title: '课程仓库',
      icon: 'Folder',
      group: 'learning',
    },
  },
    // 学习计划（计划、任务、打卡与看板通过后端 API 持久化）
    {
      path: '/plans',
      name: 'LearningPlans',
      component: () => import('../views/LearningPlansPage.vue'),
      meta: {
        title: '学习计划',
        icon: 'Calendar',
        group: 'learning',
      },
    },
  // 保留旧课程路由（兼容性）
  {
    path: '/courses',
    redirect: '/course-repository',
  },
  {
    path: '/courses/:courseId',
    name: 'CourseDetail',
    component: () => import('../views/CourseDetailPage.vue'),
    meta: {
      title: '课程详情',
    },
  },
  {
    path: '/courses/new',
    name: 'CourseEditorNew',
    component: () => import('../views/CourseEditorPage.vue'),
    meta: {
      title: '创建课程',
    },
  },
  {
    path: '/courses/:courseId/edit',
    name: 'CourseEditorEdit',
    component: () => import('../views/CourseEditorPage.vue'),
    meta: {
      title: '编辑课程',
    },
  },
  {
    path: '/lessons/:lessonId/practice',
    name: 'LessonPractice',
    component: () => import('../views/LessonPracticePage.vue'),
    meta: {
      title: '课时练习',
    },
  },
  // 沉浸式课堂（精读 / 燃尽 / 词根）
  {
    path: '/lessons/:lessonId/classroom',
    name: 'Classroom',
    component: () => import('../views/ClassroomPage.vue'),
    meta: {
      title: '课堂',
    },
  },
  // 练习中心（优化版 - 支持自适应推荐）
  {
    path: '/practice',
    name: 'Practice',
    component: () => import('../views/AdaptivePracticeCenterPage.vue'),
    meta: {
      title: '练习中心',
      icon: 'Edit',
      group: 'practice',
    },
  },
  // 保留旧版练习中心（备用）
  {
    path: '/practice-legacy',
    name: 'PracticeLegacy',
    component: () => import('../views/PracticeCenterPage.vue'),
    meta: {
      title: '练习中心（经典版）',
    },
  },
  // 保留旧路由（兼容性）
  {
    path: '/typing',
    redirect: '/practice?tab=typing',
  },
  {
    path: '/pinyin',
    redirect: '/practice?tab=pinyin',
  },
  {
    path: '/games',
    name: 'Games',
    component: () => import('../views/GameCenterPage.vue'),
    meta: {
      title: '游戏中心',
      icon: 'Trophy',
      group: 'entertainment',
    },
  },
  {
    path: '/review',
    name: 'Review',
    component: () => import('../views/ReviewPage.vue'),
    meta: {
      title: '复习系统',
      icon: 'RefreshRight',
      group: 'tools',
    },
  },
  // AI 工具
  {
    path: '/ai-tools',
    name: 'AITools',
    component: () => import('../views/AIToolsOptimizedPage.vue'),
    meta: {
      title: 'AI 工具',
      icon: 'MagicStick',
      group: 'tools',
    },
  },
  // 可恢复的 AI 教学与英语面试共享对话
  {
    path: '/conversation',
    name: 'Conversation',
    component: () => import('../views/ConversationPage.vue'),
    meta: {
      title: 'AI 英语对话',
      icon: 'ChatDotRound',
      group: 'learning',
    },
  },
  // 保留旧路由（兼容性）
  {
    path: '/ailab',
    redirect: '/ai-tools?tab=audio',
  },
  {
    path: '/ai',
    redirect: '/ai-tools?tab=audio',
  },
  // 学习数据
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('../views/StatisticsPage.vue'),
    meta: {
      title: '学习数据',
      icon: 'DataLine',
      group: 'data',
    },
  },
  // 设置
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('../views/SettingsPage.vue'),
    meta: {
      title: '设置',
      icon: 'Setting',
      group: 'system',
    },
  },
  // 保留旧路由（兼容性）
  {
    path: '/history',
    redirect: '/statistics',
  },
  // 数据迁移移到设置页面
  {
    path: '/migration',
    redirect: '/settings?tab=migration',
  },
  {
    path: '/diagnostics',
    name: 'Diagnostics',
    component: () => import('../views/DiagnosticsPage.vue'),
    meta: { title: '运行诊断', icon: 'DataLine', group: 'system' },
  },
  // 404 页面
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('../views/NotFoundPage.vue'),
    meta: {
      title: '页面未找到',
    },
  },
]

// 创建路由实例
const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// 路由守卫 - 设置页面标题
router.beforeEach((to, _from, next) => {
  const title = to.meta.title as string
  if (title) {
    document.title = `${title} - LexiType Academy`
  }
  next()
})

export default router

// 导出路由类型
export type { RouteRecordRaw }
