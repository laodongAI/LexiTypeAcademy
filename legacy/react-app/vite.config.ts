import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react({
    jsxRuntime: 'automatic'
  })],
  base: './',
  // 定义全局变量，解决浏览器环境中process未定义的问题
  // 注意：不要mock 'module' 和 'require'，会干扰Rollup的模块解析
  define: {
    'process': JSON.stringify({
      env: {},
      platform: 'browser',
      arch: 'web',
      version: '18.0.0',
      title: '',
      argv: [],
      versions: {},
      stdout: {
        isTTY: false,
        hasColors: () => false,
        write: () => {},
        end: () => {},
        columns: 80,
        rows: 24
      },
      stderr: {
        isTTY: false,
        hasColors: () => false,
        write: () => {},
        end: () => {},
        columns: 80,
        rows: 24
      }
    }),
    // 模拟util模块，解决util.inherits is not a function问题
    'util': JSON.stringify({
      inherits: (ctor: any, superCtor: any) => {
        Object.setPrototypeOf(ctor.prototype, superCtor.prototype);
        ctor.__proto__ = superCtor;
      },
      inspect: () => '',
      debuglog: () => () => {},
      format: () => '',
      deprecate: () => {},
      promisify: () => {},
      callbackify: () => {}
    }),
    // 模拟os模块，解决os.EOL问题
    'os': JSON.stringify({
      EOL: '\n',
      hostname: () => 'browser',
      type: () => 'browser',
      platform: () => 'browser',
      arch: () => 'web',
      release: () => '1.0.0',
      uptime: () => 0,
      loadavg: () => [0, 0, 0],
      totalmem: () => 0,
      freemem: () => 0,
      cpus: () => [],
      networkInterfaces: () => {}
    }),
    // 模拟fs模块，解决fs.existsSync问题
    'fs': JSON.stringify({
      existsSync: () => false,
      readFileSync: () => '',
      writeFileSync: () => {},
      appendFileSync: () => {},
      mkdirSync: () => {},
      rmdirSync: () => {},
      unlinkSync: () => {},
      readdirSync: () => [],
      statSync: () => ({}),
      lstatSync: () => ({})
    }),
    // 模拟http和https模块
    'http': JSON.stringify({
      createServer: () => {},
      request: () => {}
    }),
    'https': JSON.stringify({
      createServer: () => {},
      request: () => {}
    }),
    // 模拟zlib模块
    'zlib': JSON.stringify({
      createGzip: () => {},
      createDeflate: () => {}
    }),
    // 注释掉module和require的mock，防止干扰Rollup模块解析
    // 'module': JSON.stringify({
    //   exports: {}
    // }),
    // 'require': JSON.stringify(() => ({})),
    'global': 'globalThis'
  },
  resolve: {
    alias: {
      // DDD分层路径别名
      '@': path.resolve(__dirname, './src'),
      '@app': path.resolve(__dirname, './src/app'),
      '@domain': path.resolve(__dirname, './src/domain'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@core': path.resolve(__dirname, './src/core'),
      '@shared': path.resolve(__dirname, './src/shared'),
      // 修复path-browserify别名配置
      path: 'path-browserify'
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
    esbuildOptions: {
      define: {
        global: 'globalThis'
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/node_modules/]
    },
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          charts: ['chart.js', 'react-chartjs-2'],
          utils: ['dexie', 'react-dropzone']
        }
      }
    }
  }
}));
