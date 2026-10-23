/**
 * Tailwind CSS 配置文件
 * 
 * 注意：禁用 preflight 以避免与 Element Plus 样式冲突
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}',
  ],
  
  // 禁用 preflight 以避免与 Element Plus 冲突
  corePlugins: {
    preflight: false,
  },
  
  // 暗黑模式使用 class 策略
  darkMode: 'class',
  
  theme: {
    extend: {
      // 自定义颜色，与 Element Plus 主题保持一致
      colors: {
        primary: {
          DEFAULT: 'var(--primary-color)',
          light: 'var(--primary-color-light)',
          lighter: 'var(--primary-color-lighter)',
          dark: 'var(--primary-color-dark)',
        },
        bg: {
          DEFAULT: 'var(--bg-color)',
          page: 'var(--bg-color-page)',
          sidebar: 'var(--bg-color-sidebar)',
          card: 'var(--bg-color-card)',
          hover: 'var(--bg-color-hover)',
        },
        text: {
          DEFAULT: 'var(--text-color)',
          secondary: 'var(--text-color-secondary)',
          placeholder: 'var(--text-color-placeholder)',
        },
        border: {
          DEFAULT: 'var(--border-color)',
          light: 'var(--border-color-light)',
        },
      },
      
      // 自定义阴影
      boxShadow: {
        'light': 'var(--shadow-light)',
        'medium': 'var(--shadow-medium)',
      },
      
      // 自定义字体
      fontFamily: {
        sans: [
          'PingFang SC',
          'Microsoft YaHei',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'Consolas',
          'Monaco',
          'Andale Mono',
          'monospace',
        ],
      },
      
      // 自定义间距
      spacing: {
        'sidebar': '220px',
        'sidebar-collapsed': '64px',
      },
      
      // 自定义过渡
      transitionDuration: {
        'theme': '300ms',
      },
      
      // 自定义圆角
      borderRadius: {
        'el': 'var(--el-border-radius-base, 4px)',
        'el-sm': 'var(--el-border-radius-small, 2px)',
        'el-round': 'var(--el-border-radius-round, 20px)',
      },
    },
  },
  
  plugins: [],
}
