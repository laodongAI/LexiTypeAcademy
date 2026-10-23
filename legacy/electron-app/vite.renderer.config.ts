import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

// 渲染进程 Vite 配置
export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue、Vue Router、Pinia API
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/renderer/auto-imports.d.ts',
    }),
    // 自动导入组件（Element Plus 按需引入）
    Components({
      resolvers: [
        ElementPlusResolver({
          // 自动导入样式
          importStyle: 'sass',
        }),
      ],
      dts: 'src/renderer/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
      '@shared': resolve(__dirname, 'src/shared'),
      '@domain': resolve(__dirname, 'src/domain'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      '@application': resolve(__dirname, 'src/application'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Element Plus 主题变量覆盖
        additionalData: `@use "@/styles/element-variables.scss" as *;`,
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main_window: resolve(__dirname, 'index.html'),
      },
    },
  },
});
