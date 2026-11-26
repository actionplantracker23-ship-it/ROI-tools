/** @type {import('tailwindcss').Config} */
// Palette Living Goods : bleu #004D84, orange #F7941D, bleu ciel #4FB3E3, gris #6D6E71 ; fond blanc ; police Garamond.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#e8f1f8', 100: '#cfe3f1', 300: '#4FB3E3', 500: '#004D84', 600: '#004D84', 700: '#003a63', 900: '#00294a' },
        accent: { DEFAULT: '#F7941D', 500: '#F7941D' },
        ligne: '#e5e8ec',
        fond: '#ffffff',
        rag: { green: '#2e9e4f', amber: '#f2b01e', red: '#d64545', grey: '#a7adb4' },
      },
      // Police Garamond sur toute l'application (EB Garamond, repli Garamond installée puis Georgia)
      fontFamily: {
        sans: ['"EB Garamond"', 'Garamond', '"Garamond Premier Pro"', 'Georgia', 'serif'],
        serif: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
        titre: ['"EB Garamond"', 'Garamond', 'Georgia', 'serif'],
      },
      // Garamond est plus petite à l'œil : tailles relevées
      fontSize: {
        xs: ['13px', '1.4'], sm: ['15px', '1.5'], base: ['17px', '1.55'], lg: ['19px', '1.45'], xl: ['22px', '1.35'],
      },
    },
  },
  plugins: [],
};
