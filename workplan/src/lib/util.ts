/** Utilitaires : identifiants, normalisation de texte, regroupements. */

export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function clean(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** Clé de comparaison : minuscules, sans accents ni ponctuation. */
export function key(v: string): string {
  return clean(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function slug(s: string): string {
  return key(s).replace(/ /g, '-') || 'x';
}

export function groupBy<T>(list: T[], k: (x: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const kk = k(x);
    if (kk == null) continue;
    const arr = m.get(kk);
    if (arr) arr.push(x);
    else m.set(kk, [x]);
  }
  return m;
}

export function mean(values: (number | null | undefined)[]): number | null {
  let n = 0;
  let s = 0;
  for (const v of values) if (typeof v === 'number' && Number.isFinite(v)) { n++; s += v; }
  return n ? s / n : null;
}

/** Similarité de deux textes (mots communs), pour rapprocher des intitulés saisis différemment. */
export function similarity(a: string, b: string): number {
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  if (ka.length > 15 && kb.length > 15 && (ka.includes(kb) || kb.includes(ka))) return 0.95;
  const ta = new Set(ka.split(' '));
  const tb = new Set(kb.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Nombre dans un texte (« 45% », « 1 200 », « 12,5 »). */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = clean(v).toLowerCase();
  if (s === 'oui' || s === 'yes') return 1;
  if (s === 'non' || s === 'no') return 0;
  const m = s.replace(/(\d)[  ,](?=\d{3}\b)/g, '$1').match(/-?\d+(?:[.,]\d+)?/);
  return m ? Number(m[0].replace(',', '.')) : null;
}

export const refSort = (a: string, b: string) => {
  const pa = a.replace(/^\D+/, '').split('.').map(Number);
  const pb = b.replace(/^\D+/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return a.localeCompare(b);
};
