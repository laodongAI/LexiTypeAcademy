import { defineConfig } from 'vite';

// 预加载脚本 Vite 配置
// Electron Forge Vite 插件会自动处理输出路径和文件名
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
});
