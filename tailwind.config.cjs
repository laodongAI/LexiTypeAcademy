module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        success: '#10B981',
        warning: '#F59E0B',
        danger: '#EF4444',
        primary: {
          DEFAULT: '#4F46E5', // Indigo 600
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81',
        },
        secondary: {
          DEFAULT: '#10B981', // Emerald 500
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
        accent: {
          DEFAULT: '#F59E0B', // Amber 500
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
        },
        // Custom background colors matching the design
        bg: {
          light: '#F9FAFB', // Gray 50
          dark: '#111827',  // Gray 900
        }
      },
      fontFamily: {
        sans: [
          '"Nunito"', 
          '"Quicksand"', 
          '"Segoe UI"', 
          'system-ui', 
          '-apple-system', 
          'sans-serif'
        ],
      },
      borderRadius: {
        'card': '1rem',
        'button': '9999px',
        'xl': '1rem',
        '2xl': '1.5rem',
      },
      spacing: {
        'card': '1.5rem',
      }
    },
  },
  plugins: [],
};
