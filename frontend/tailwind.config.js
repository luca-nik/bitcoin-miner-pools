/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Consolas', '"Courier New"', 'monospace'],
      },
      colors: {
        'term-bg':     '#0a0a0a',
        'term-fg':     '#33ff00',
        'term-amber':  '#ffb000',
        'term-red':    '#ff3333',
        'term-muted':  '#1f521f',
        'term-dim':    '#0d1a0d',
        'term-gray':   '#4a6741',
        'term-bright': '#b3ffb3',
      },
      borderRadius: {
        DEFAULT: '0px',
        sm: '0px',
        md: '0px',
        lg: '0px',
        xl: '0px',
        '2xl': '0px',
        '3xl': '0px',
        full: '0px',
      },
      boxShadow: {
        DEFAULT: 'none',
        sm: 'none',
        md: 'none',
        lg: 'none',
        xl: 'none',
      },
    },
  },
  plugins: [],
}
