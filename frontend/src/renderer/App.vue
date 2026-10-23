<script setup lang="ts">
/**
 * 应用根组件
 * 
 * 布局：左侧导航栏 + 右侧内容区
 */
import { watch, type Component } from 'vue';
import { useSettingsStore } from './stores/settings';
import * as MainLayoutModule from './layouts/MainLayout.vue';
// Element Plus 中文语言包
import zhCn from 'element-plus/es/locale/lang/zh-cn';

const MainLayout = (MainLayoutModule as unknown as { default: Component }).default;

// 初始化设置
const settingsStore = useSettingsStore();

// 监听主题变化，应用到 HTML 根元素
watch(
  () => settingsStore.theme,
  (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  },
  { immediate: true }
);
</script>

<template>
  <el-config-provider :locale="zhCn">
    <div class="app-container">
      <MainLayout />
    </div>
  </el-config-provider>
</template>

<style lang="scss">
.app-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}
</style>
