<!--
  主布局组件
  
  包含：
  - 左侧导航栏（固定宽度）
  - 右侧内容区（router-view）
  - 顶部标题栏
-->

<template>
  <el-container class="main-layout">
    <!-- 左侧导航栏 -->
    <el-aside class="sidebar" :width="sidebarWidth">
      <div class="sidebar-header">
        <img 
          src="../assets/logo.svg" 
          alt="LexiType" 
          class="logo"
          @error="handleLogoError"
        />
        <span v-if="!isCollapsed" class="app-title">LexiType</span>
      </div>
      
      <el-scrollbar class="sidebar-scroll">
        <el-menu
          :default-active="currentRoute"
          class="sidebar-menu"
          :collapse="isCollapsed"
          :router="true"
          background-color="transparent"
          text-color="var(--text-color)"
          active-text-color="var(--primary-color)"
        >
          <!-- 主要功能 -->
          <div v-if="!isCollapsed" class="menu-group-title">主要功能</div>
          <el-menu-item 
            v-for="item in primaryMenuItems" 
            :key="item.path"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
          
          <!-- 学习工具 -->
          <div v-if="!isCollapsed" class="menu-group-title">学习工具</div>
          <el-menu-item 
            v-for="item in toolMenuItems" 
            :key="item.path"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
          
          <!-- 数据与设置 -->
          <div v-if="!isCollapsed" class="menu-group-title">数据与设置</div>
          <el-menu-item 
            v-for="item in settingsMenuItems" 
            :key="item.path"
            :index="item.path"
          >
            <el-icon>
              <component :is="item.icon" />
            </el-icon>
            <template #title>{{ item.title }}</template>
          </el-menu-item>
        </el-menu>
      </el-scrollbar>
      
      <!-- 底部折叠按钮 -->
      <div class="sidebar-footer">
        <el-button 
          :icon="isCollapsed ? 'Expand' : 'Fold'" 
          text
          @click="toggleSidebar"
        >
          <el-icon>
            <Expand v-if="isCollapsed" />
            <Fold v-else />
          </el-icon>
        </el-button>
      </div>
    </el-aside>
    
    <!-- 右侧内容区 -->
    <el-container class="main-container">
      <!-- 顶部标题栏 -->
      <el-header class="main-header">
        <div class="header-left">
          <el-button text @click="toggleSidebar" class="sidebar-toggle-btn">
            <el-icon>
              <Expand v-if="isCollapsed" />
              <Fold v-else />
            </el-icon>
          </el-button>
          <h1 class="page-title">{{ pageTitle }}</h1>
        </div>
        <div class="header-right">
          <!-- 主题切换 -->
          <el-dropdown @command="handleThemeChange">
            <el-button text>
              <el-icon><Sunny v-if="theme === 'light'" /><Moon v-else /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="blue">
                  <el-icon><ChromeFilled /></el-icon> 蓝色主题
                </el-dropdown-item>
                <el-dropdown-item command="light">
                  <el-icon><Sunny /></el-icon> 浅色主题
                </el-dropdown-item>
                <el-dropdown-item command="dark">
                  <el-icon><Moon /></el-icon> 暗黑主题
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
          
          <!-- 设置按钮 -->
          <el-button text @click="goToSettings">
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
      </el-header>
      
      <!-- 主内容区 -->
      <el-main class="main-content">
        <div class="content-container">
          <router-view v-slot="{ Component }">
            <transition name="fade" mode="out-in">
              <component :is="Component" />
            </transition>
          </router-view>
        </div>
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useSettingsStore, ThemeType } from '../stores'
import {
  House,
  User,
  Calendar,
  Folder,
  Edit,
  Trophy,
  RefreshRight,
  MagicStick,
  DataLine,
  Setting,
  Expand,
  Fold,
  Sunny,
  Moon,
  ChromeFilled,
} from '@element-plus/icons-vue'

// 路由实例
const route = useRoute()
const router = useRouter()

// 设置 store
const settingsStore = useSettingsStore()

// 侧边栏折叠状态
const isCollapsed = ref(false)

// 侧边栏宽度
const sidebarWidth = computed(() => isCollapsed.value ? '64px' : '256px')

// 当前路由
const currentRoute = computed(() => route.path)

// 页面标题
const pageTitle = computed(() => {
  const meta = route.meta
  return (meta?.title as string) || 'LexiType Academy'
})

// 当前主题
const theme = computed(() => settingsStore.theme)

// 菜单项 - 主要功能
const primaryMenuItems = [
  { path: '/', title: '首页', icon: House },
  { path: '/my-learning', title: '我的学习', icon: User },
  { path: '/plans', title: '学习计划', icon: Calendar },
  { path: '/course-repository', title: '课程仓库', icon: Folder },
]

// 菜单项 - 学习工具
const toolMenuItems = [
  { path: '/practice', title: '练习中心', icon: Edit },
  { path: '/games', title: '游戏中心', icon: Trophy },
  { path: '/review', title: '复习系统', icon: RefreshRight },
  { path: '/ai-tools', title: 'AI 工具', icon: MagicStick },
]

// 菜单项 - 数据与设置
const settingsMenuItems = [
  { path: '/statistics', title: '学习数据', icon: DataLine },
  { path: '/settings', title: '设置', icon: Setting },
]

// 切换侧边栏
function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

// 处理主题变化
function handleThemeChange(theme: ThemeType) {
  settingsStore.setTheme(theme)
}

// 跳转到设置页面
function goToSettings() {
  router.push('/settings')
}

// 处理 logo 加载失败
function handleLogoError(e: Event) {
  const target = e.target as HTMLImageElement
  target.style.display = 'none'
}
</script>

<style lang="scss" scoped>
.main-layout {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background-color: var(--bg-color-page);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
  border-right: 1px solid var(--border-color-light);
}

.sidebar-header {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
  border-bottom: 1px solid var(--border-color-light);
  
  .logo {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
  }
  
  .app-title {
    color: var(--text-color);
    font-size: 18px;
    font-weight: 600;
    white-space: nowrap;
  }
}

.sidebar-scroll {
  flex: 1;
  
  :deep(.el-scrollbar__view) {
    padding: 8px 0;
  }
}

.menu-group-title {
  padding: 16px 20px 8px;
  font-size: 12px;
  color: var(--text-color-secondary);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.sidebar-menu {
  border: none;
  
  :deep(.el-menu-item) {
    margin: 4px 8px;
    border-radius: 8px;
    transition: all 0.2s;
    
    &:hover {
      background-color: var(--bg-color-hover);
    }
    
    &.is-active {
      background-color: color-mix(in srgb, var(--primary-color) 12%, transparent);
      color: var(--primary-color) !important;
      font-weight: 600;
    }
    
    .el-icon {
      font-size: 18px;
    }
  }
}

.sidebar-footer {
  padding: 12px;
  border-top: 1px solid var(--border-color-light);
  display: flex;
  justify-content: center;
  
  .el-button {
    color: var(--text-color-secondary);
    
    &:hover {
      color: var(--text-color);
    }
  }
}

.main-container {
  display: flex;
  flex-direction: column;
  background-color: var(--bg-color);
  overflow: hidden;
}

.main-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  background-color: var(--bg-color-page);
  border-bottom: 1px solid var(--border-color-light);
  height: 60px;
  
  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
    
    .sidebar-toggle-btn {
      font-size: 18px;
      
      &:hover {
        background-color: var(--bg-color-hover);
      }
    }
    
    .page-title {
      font-size: 20px;
      font-weight: 600;
      color: var(--text-color);
      margin: 0;
    }
  }
  
  .header-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }
}

.main-content {
  flex: 1;
  padding: 0;
  overflow-y: auto;
  background-color: var(--bg-color);
}

.content-container {
  max-width: 1280px;
  margin: 0 auto;
  padding: 48px;
}

@media (max-width: 1024px) {
  .content-container {
    padding: 24px;
  }
}

// 页面切换动画
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
