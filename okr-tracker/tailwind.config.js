/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef6f1', 100: '#d5eadd', 500: '#1f7a4d', 600: '#17633e', 700: '#114d30', 900: '#0a2e1d' },
        rag: { green: '#15803d', amber: '#d97706', red: '#dc2626', grey: '#9ca3af' },
      },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
