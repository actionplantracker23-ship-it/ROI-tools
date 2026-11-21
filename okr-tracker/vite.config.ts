import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : l'application fonctionne depuis n'importe quel sous-chemin (GitHub Pages, Netlify, Supabase Storage…)
export default defineConfig({
  plugins: [react()],
  base: './',
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
