/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#ededed',
          100: '#e8747e',
          200: '#a9b0b8',
          300: '#c2c2c2',
          500: '#c2c2c2',
          600: '#bc0120',
          700: '#bc0120',
          800: '#1e40af',
          900: '#c2c2c2',
        },
      },
    },
  },
  plugins: [],
}