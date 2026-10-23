import * as React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// import { PlaybackRateProvider } from '@/app/context/PlaybackRateContext';
import './tailwind.css';
import { waitForAppInitialization, cleanupApp } from '@/infrastructure/versioning';

// Polyfill setImmediate for browser environment (required by winston)
if (typeof (window as any).setImmediate === 'undefined') {
  (window as any).setImmediate = (cb: Function, ...args: any[]) => setTimeout(() => cb(...args), 0);
}

// Polyfill process for browser environment
if (typeof (window as any).process === 'undefined') {
  (window as any).process = {
    env: {},
    versions: {},
    platform: 'browser',
    nextTick: (cb: Function, ...args: any[]) => setTimeout(() => cb(...args), 0)
  };
} else {
  // If process exists (e.g. Electron), ensure nextTick exists
  if (!(window as any).process.nextTick) {
    (window as any).process.nextTick = (cb: Function, ...args: any[]) => setTimeout(() => cb(...args), 0);
  }
  // Hide node version to prevent libraries (like Emscripten) from detecting Node.js environment
  // This forces them to use Web APIs (like fetch/XHR) instead of Node APIs (like fs)
  if ((window as any).process.versions && (window as any).process.versions.node) {
    try {
      delete (window as any).process.versions.node;
    } catch (e) {
      console.warn('Failed to delete process.versions.node', e);
    }
  }
}

if (window.electron?.ensureRuntimeLayout) {
	window.electron.ensureRuntimeLayout().catch(() => {
		console.warn('Failed to ensure runtime directories at startup');
	});
}

window.addEventListener('unhandledrejection', (event) => {
	console.error('Unhandled rejection:', event.reason);
	// Prevent default behavior (which might be crashing the renderer in strict mode)
	event.preventDefault();
});

// 记录关键页面生命周期，定位白屏退出前的事件顺序
['visibilitychange', 'pagehide', 'pageshow', 'beforeunload', 'unload'].forEach((evt) => {
  window.addEventListener(evt, () => {
    const payload = { href: window.location.href, visibility: document.visibilityState, ts: new Date().toISOString() };
    console.info(`[Lifecycle] ${evt}`, payload);
    try {
      (window as any).electron?.log?.('info', `[Lifecycle] ${evt} ${JSON.stringify(payload)}`);
    } catch {}
  });
});

// 捕获未处理的同步异常，避免直接白屏并能在控制台日志看到堆栈
window.addEventListener('error', (event) => {
  try {
    console.error('Window error captured:', event.error || event.message, event.filename, event.lineno, event.colno);
    if ((window as any).electron?.log) {
      (window as any).electron.log('error', `Window error: ${event.message}\n${event.error?.stack || ''}`);
    }
  } catch {}
});

/**
 * 应用初始化和渲染
 * 等待数据库和版本检查完成后再渲染应用
 */
async function initializeAndRender() {
  try {
    console.log('🚀 [Main] 等待应用初始化...');
    await waitForAppInitialization();
    console.log('✅ [Main] 应用初始化完成，开始渲染...');
    
    createRoot(document.getElementById('root')!).render(
      // <PlaybackRateProvider>
        <App />
      // </PlaybackRateProvider>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '未知错误';
    console.error(`❌ [Main] 应用初始化失败: ${message}`);
    
    // 显示错误信息到用户
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML = `
        <div style="
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          font-family: system-ui;
          background: #f5f5f5;
        ">
          <div style="
            background: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 500px;
          ">
            <h1 style="color: #d32f2f; margin: 0 0 16px 0;">应用初始化失败</h1>
            <p style="color: #666; margin: 0 0 16px 0;">
              应用启动时出现错误，请刷新页面重试。
            </p>
            <pre style="
              background: #f5f5f5;
              padding: 12px;
              border-radius: 4px;
              color: #d32f2f;
              font-size: 12px;
              overflow-x: auto;
              margin: 16px 0;
            ">${message}</pre>
            <button onclick="location.reload()" style="
              padding: 10px 20px;
              background: #1976d2;
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
            ">
              刷新页面
            </button>
          </div>
        </div>
      `;
    }
  }
}

// 启动应用初始化
initializeAndRender();

// 应用卸载时清理资源
window.addEventListener('beforeunload', async () => {
  await cleanupApp();
});

