/** @type {import('tailwindcss').Config} */
// Charte reprise du tableau de bord « Big Wins » : bleu marine, orange, bleu ciel ; Oswald + Source Sans 3.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#e6f4fb', 100: '#bfe3f5', 300: '#4FB3E3', 500: '#004D84', 600: '#0b2e59', 700: '#071f3d', 900: '#071f3d' },
        accent: { DEFAULT: '#f28c28', 500: '#F7941D' },
        ligne: '#dfe3e8',
        fond: '#f4f5f7',
        rag: { green: '#2e9e4f', amber: '#f2b01e', red: '#d64545', grey: '#a7adb4' },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        titre: ['Oswald', '"Arial Narrow"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
