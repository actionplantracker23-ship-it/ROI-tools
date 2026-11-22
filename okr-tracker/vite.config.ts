import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base relative : l'application fonctionne depuis n'importe quel sous-chemin (GitHub Pages, Netlify…)
// SINGLE=1 : un seul bundle JS (pas d'import dynamique) pour produire un fichier HTML autonome.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: process.env.SINGLE
    ? { outDir: 'dist-single/tmp', chunkSizeWarningLimit: 5000, rollupOptions: { output: { inlineDynamicImports: true } } }
    : {},
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
} as any);
