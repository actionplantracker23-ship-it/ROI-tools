/** @type {import('tailwindcss').Config} */
// Charte : bleu marine, orange, bleu ciel ; police Garamond ; interface aérée.
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
