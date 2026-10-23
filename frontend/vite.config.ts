/**
 * LexiType Academy 前端 Vite 配置
 *
 * 说明：
 * - 由原 Electron 渲染进程配置（vite.renderer.config.ts）剥离而来
 * - 去掉 Electron 相关入口与产物路径，改为标准 Web 应用
 * - 保留 Element Plus 按需自动导入与 Tailwind/SCSS 主题变量
 * - 保留 @ 与 @shared 别名，确保迁移过来的源码相对引用与别名引用不失效
 */

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers';
import { resolve } from 'path';

/** 前端开发服务器端口（与后端 CORS 白名单保持一致，避开本机 5173 被其它项目占用） */
const DEV_SERVER_PORT = 5183;

/** 后端服务地址（本地单机部署，固定 127.0.0.1:8010） */
const BACKEND_ORIGIN = 'http://127.0.0.1:8010';

export default defineConfig({
  plugins: [
    vue(),
    // 自动导入 Vue、Vue Router、Pinia API，减少模板中的重复 import
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      resolvers: [ElementPlusResolver()],
      dts: 'src/renderer/auto-imports.d.ts',
    }),
    // 自动按需注册 Element Plus 组件
    Components({
      resolvers: [
        ElementPlusResolver({
          importStyle: 'sass',
        }),
      ],
      dts: 'src/renderer/components.d.ts',
    }),
  ],
  resolve: {
    alias: {
      // 页面与组件源码目录
      '@': resolve(__dirname, 'src/renderer'),
      // 跨层共享的类型、数据库与服务
      '@shared': resolve(__dirname, 'src/shared'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        // Element Plus 主题变量覆盖，所有 scss 文件自动注入
        additionalData: `@use "@/styles/element-variables.scss" as *;`,
      },
    },
  },
  // 后端接口固定指向本地 FastAPI，避免浏览器跨域配置漂移
  server: {
    port: DEV_SERVER_PORT,
    strictPort: true,
    // 开发期直接把 /api 代理到后端，前端代码无需关心端口
    proxy: {
      '/api': {
        target: BACKEND_ORIGIN,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 单机应用体积可控，关闭 sourcemap 以减小产物
    sourcemap: false,
  },
});
