/**
 * Produit dist-single/okr-tracker-2027.html : un fichier HTML unique (JS et CSS intégrés)
 * qui s'ouvre par double-clic, sans serveur ni publication. Mode local : les données restent
 * dans le navigateur de la personne qui l'ouvre.
 * Usage : npm run build:single
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, SINGLE: '1' } });
const dir = 'dist-single/tmp';
let html = readFileSync(join(dir, 'index.html'), 'utf8');
const assets = readdirSync(join(dir, 'assets'));
for (const f of assets) {
  const code = readFileSync(join(dir, 'assets', f), 'utf8');
  if (f.endsWith('.js')) {
    const re = new RegExp(`<script type="module" crossorigin src="\\./assets/${f.replace(/[.]/g, '\\.')}"></script>`);
    // le script est placé en fin de <body> (après #root) ; "</script" est échappé
    html = html.replace(re, '');
    html = html.replace('</body>', () => `<script type="module">${code.replace(/<\/script/gi, '<\\/script')}</script>\n</body>`);
  } else if (f.endsWith('.css')) {
    const re = new RegExp(`<link rel="stylesheet" crossorigin href="\\./assets/${f.replace(/[.]/g, '\\.')}">`);
    html = html.replace(re, () => `<style>${code}</style>`);
  }
}
writeFileSync('dist-single/okr-tracker-2027.html', html);
rmSync(dir, { recursive: true, force: true });
console.log('→ dist-single/okr-tracker-2027.html');
