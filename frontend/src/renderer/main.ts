/**
 * Vue 应用入口
 * 
 * 职责：
 * - 初始化 Vue 应用
 * - 注册全局插件（Router、Pinia、Element Plus）
 * - 初始化数据库
 * - 挂载应用到 DOM
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';

import App from './App.vue';
import router from './router';

// 样式导入
import './styles/index.scss';

// 数据库初始化
import { databaseReady, initDatabase } from '../shared/database';

// 异步初始化函数
async function bootstrap() {
  try {
    // 初始化数据库
    await initDatabase();
    if (import.meta.env.DEV) {
      console.log(databaseReady ? '✅ 数据库可用' : '⚠️ 数据库不可用（已降级继续启动）')
    }
    
    // 创建 Vue 应用实例
    const app = createApp(App);

    // 应用全局消息默认值补丁（必须在 app 创建后、组件挂载前执行）
    const { setupMessageDefaults } = await import('./plugins/messageDefaults');
    setupMessageDefaults();

    // 全局错误采集（仅开发模式）：定位类似 nextSibling/parentNode 的内部渲染错误
    if (import.meta.env.DEV) {
      app.config.errorHandler = (err, instance, info) => {
        const typeAny = (instance as any)?.type as any
        const componentName = typeAny?.name || typeAny?.__name || '(anonymous)'
        const componentFile = typeAny?.__file
        const routeInfo = (() => {
          try {
            const r = router.currentRoute.value
            return { name: r.name, path: r.path, fullPath: r.fullPath }
          } catch {
            return undefined
          }
        })()

        // 统一格式，方便你直接贴控制台输出
        console.groupCollapsed('[Vue errorHandler]', info)
        console.error(err)
        console.log('component:', { componentName, componentFile })
        console.log('route:', routeInfo)
        console.groupEnd()
      }

      window.addEventListener('error', (e) => {
        console.groupCollapsed('[window.error]')
        console.error(e.error || e.message)
        console.log('source:', (e as any).filename, (e as any).lineno, (e as any).colno)
        console.groupEnd()
      })

      window.addEventListener('unhandledrejection', (e) => {
        console.groupCollapsed('[unhandledrejection]')
        console.error(e.reason)
        console.groupEnd()
      })
    }
    
    // 注册 Pinia 状态管理
    const pinia = createPinia();
    app.use(pinia);
    
    // 注册 Vue Router
    app.use(router);
    
    // Element Plus 通过 unplugin-vue-components 自动按需引入
    // 无需在此手动注册
    
    // 挂载应用
    app.mount('#app');
    
    // 开发模式下的调试信息
    if (import.meta.env.DEV) {
      console.log('[Vue App] 应用已启动（开发模式）');
    }
  } catch (error) {
    console.error('❌ 应用初始化失败:', error);
    // 显示错误信息给用户
    document.body.innerHTML = `
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif;">
        <div style="text-align: center;">
          <h1 style="color: #f56c6c;">应用初始化失败</h1>
          <p style="color: #909399;">${error instanceof Error ? error.message : String(error)}</p>
          <p style="color: #909399;">请重新启动应用</p>
        </div>
      </div>
    `;
  }
}

// 启动应用
bootstrap();
