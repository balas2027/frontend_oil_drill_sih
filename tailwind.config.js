/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        royal: {
          50: '#F4F7FE',
          100: '#E6EEFB',
          500: '#3B6FD8',
          600: '#1D4FB8',
          700: '#123C8F',
          900: '#0A2A66'
        },
        gold: {
          100: '#FBF3D6',
          500: '#C9A227'
        },
        ink: {
          600: '#475569',
          900: '#0F172A'
        },
        line: '#D6DFEE'
      }
    },
  },
  plugins: [],
}
