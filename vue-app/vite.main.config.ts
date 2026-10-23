import { defineConfig } from 'vite';

// 主进程 Vite 配置
export default defineConfig({
  resolve: {
    // 主进程环境为 Node.js
    conditions: ['node'],
  },
  build: {
    rollupOptions: {
      external: [
        'electron',
        'electron-store',
        'path',
        'fs',
        'os',
        'url',
      ],
    },
  },
});
