/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0B1220',
          900: '#111A2E',
          800: '#182545',
          700: '#22315B',
        },
        brass: {
          400: '#D9A441',
          500: '#C4922C',
          600: '#A87A1F',
        },
        paper: '#F6F4EF',
        sage: {
          500: '#4C7A6E',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(11,18,32,0.06), 0 8px 24px -8px rgba(11,18,32,0.12)',
      },
    },
  },
  plugins: [],
}
