/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        garden: {
          50: '#f3f7ef',
          100: '#e7efe2',
          200: '#cfdfc6',
          300: '#a8c3a0',
          400: '#7fa97a',
          500: '#5c8658',
          600: '#4a7047',
          700: '#3d5a3c',
          800: '#334a33',
          900: '#29382b',
        },
        flower: {
          pink: '#f472b6',
          red: '#ef4444',
          yellow: '#facc15',
          purple: '#a855f7',
          white: '#f8fafc',
          orange: '#fb923c',
        },
        rank: {
          black: '#374151',
          bronze: '#cd7f32',
          silver: '#c0c0c0',
          gold: '#ffd700',
          platinum: '#e5e4e2',
          diamond: '#b9f2ff',
          legend: '#ff6b6b',
        },
      },
      fontFamily: {
        sans: ['"PingFang SC"', '"Microsoft YaHei"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'grow': 'grow 0.5s ease-out',
      },
      keyframes: {
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        grow: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
