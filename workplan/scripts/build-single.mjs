/**
 * Produit un fichier HTML unique (JS et CSS intégrés) qui s'ouvre par double-clic, sans serveur.
 *   npm run build:single                                  → dist-single/plan-de-travail.html (vide)
 *   npm run build:single -- --seed plan.json --out nom    → dist-single/nom.html pré-rempli avec plan.json
 * Le fichier pré-rempli contient les données : ne pas le publier ni le versionner (dist-single est ignoré par git).
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const seedPath = arg('--seed');
const out = arg('--out') ?? 'plan-de-travail';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, SINGLE: '1' } });
const dir = 'dist-single/tmp';
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const esc = (s) => s.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');
if (seedPath) {
  const data = readFileSync(seedPath, 'utf8');
  html = html.replace('</head>', () => `<script>window.__SEED__ = ${esc(data)};</script>\n</head>`);
}
for (const f of readdirSync(join(dir, 'assets'))) {
  const code = readFileSync(join(dir, 'assets', f), 'utf8');
  const name = f.replace(/[.]/g, '\\.');
  if (f.endsWith('.js')) {
    html = html.replace(new RegExp(`<script type="module" crossorigin src="\\./assets/${name}"></script>`), '');
    html = html.replace('</body>', () => `<script type="module">${esc(code)}</script>\n</body>`);
  } else if (f.endsWith('.css')) {
    html = html.replace(new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${name}">`), () => `<style>${code}</style>`);
  }
}
writeFileSync(`dist-single/${out}.html`, html);
rmSync(dir, { recursive: true, force: true });
console.log(`→ dist-single/${out}.html${seedPath ? ' (pré-rempli)' : ''}`);
