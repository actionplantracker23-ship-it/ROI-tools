/**
 * Utilitaires de normalisation utilisés par l'import Excel :
 * identifiants stables, noms d'entités, références de KR, nombres, valeurs à compléter.
 */
import type { EntityType, MetricType } from '../../types';

/** Texte « propre » : espaces multiples, retours à la ligne et espaces insécables réduits. */
export function clean(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).replace(/ /g, ' ').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
}

/** Clé de comparaison : minuscules, sans accents ni ponctuation. Sert à la déduplication. */
export function key(v: string): string {
  return clean(v)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Hachage FNV-1a 32 bits, en base 36 : identifiants courts et stables d'un import à l'autre. */
export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export function slug(s: string): string {
  return key(s).replace(/ /g, '-') || 'x';
}

/**
 * Références de KR global : "KR1.1", "KR 1.1", "1.1", "KR1.1 / KR2.3"…
 * Renvoie une liste normalisée ["KR1.1", "KR2.3"].
 */
export function parseRefs(v: string): string[] {
  const out: string[] = [];
  const re = /(?:KR\s*)?(\d{1,2})\s*[.,]\s*(\d{1,2})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(v))) {
    const ref = `KR${Number(m[1])}.${Number(m[2])}`;
    if (!out.includes(ref)) out.push(ref);
  }
  return out;
}

/** Premier nombre d'un texte ("45%", "1 200", "12,5 k$" → 45, 1200, 12.5). */
export function firstNumber(v: string): number | null {
  const m = clean(v).replace(/(\d)[  ,](?=\d{3}\b)/g, '$1').match(/-?\d+(?:[.,]\d+)?/);
  if (!m) return null;
  const n = Number(m[0].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Dernier nombre d'un texte : une cible de jalon s'écrit souvent « … to reach 80% ». */
export function lastNumber(v: string): number | null {
  const all = clean(v).replace(/(\d)[  ,](?=\d{3}\b)/g, '$1').match(/-?\d+(?:[.,]\d+)?/g);
  if (!all) return null;
  const n = Number(all[all.length - 1].replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Montant de budget : gère "$120k", "1.2M", "USD 45,000". */
export function parseBudget(v: string): number | null {
  const s = clean(v).replace(/,(?=\d{3}\b)/g, '');
  const m = s.match(/(-?\d+(?:\.\d+)?)\s*([kKmM])?/);
  if (!m) return null;
  let n = Number(m[1]);
  if (m[2]?.toLowerCase() === 'k') n *= 1e3;
  if (m[2]?.toLowerCase() === 'm') n *= 1e6;
  return Number.isFinite(n) ? n : null;
}

export function parseMetric(v: string): MetricType {
  const k = key(v);
  if (!k) return 'Other';
  if (k.startsWith('num')) return 'Numeric';
  if (k.startsWith('perc') || k.includes('%') || k === 'pct') return 'Percentage';
  if (k.startsWith('yes') || k.includes('yes no') || k.startsWith('oui')) return 'Yes/No';
  if (k.startsWith('date')) return 'Date';
  return 'Other';
}

/** Valeurs encore à compléter dans la source : [X], [Y], TBC, TBD, xx. */
export const PLACEHOLDER_RE = /\[\s*[A-Z]\s*\]|\bTBC\b|\bTBD\b|\bx{2,}\b/i;
export function hasPlaceholder(...texts: (string | undefined)[]): boolean {
  return texts.some((t) => !!t && PLACEHOLDER_RE.test(t));
}

/** Ligne d'en-tête de section : "OBJECTIVE 2 · …" (pas une donnée). */
export function isSectionHeader(firstCell: string): boolean {
  return /^\s*OBJECTIVE\s*\d+\s*[·:.\-–—|]/.test(firstCell) || /^\s*OBJECTIVE\s*\d+\s*$/.test(firstCell);
}

// ------------------------------------------------------------------ entités

export interface EntityDef {
  id: string;
  name: string;
  type: EntityType;
  group?: string;
  aliases: string[];
}

/** Entités connues et leurs variantes d'écriture (anglais / français / abréviations). */
export const KNOWN_ENTITIES: EntityDef[] = [
  { id: 'kenya', name: 'Kenya', type: 'Country', aliases: ['kenya', 'ke', 'lg kenya'] },
  { id: 'burkina-faso', name: 'Burkina Faso', type: 'Country', aliases: ['burkina faso', 'burkina', 'bf'] },
  { id: 'uganda', name: 'Uganda', type: 'Country', aliases: ['uganda', 'ouganda', 'ug'] },
  { id: 'benin', name: 'Benin', type: 'Country', aliases: ['benin', 'bj'] },
  { id: 'zambia', name: 'Zambia', type: 'Country', aliases: ['zambia', 'zambie', 'zm'] },
  { id: 'gp-innovations', name: 'Innovations', type: 'GlobalTeam', group: 'Global Programs', aliases: ['innovations', 'innovation', 'global programs innovations', 'gp innovations'] },
  { id: 'gp-pei', name: 'PEI', type: 'GlobalTeam', group: 'Global Programs', aliases: ['pei', 'global programs pei', 'gp pei'] },
  { id: 'gp-pse', name: 'PSE', type: 'GlobalTeam', group: 'Global Programs', aliases: ['pse', 'global programs pse', 'gp pse'] },
  { id: 'gse', name: 'GSE', type: 'GlobalTeam', aliases: ['gse'] },
  { id: 'dhgp', name: 'DHGP', type: 'GlobalTeam', aliases: ['dhgp'] },
  { id: 'bdac', name: 'BDAC', type: 'GlobalTeam', aliases: ['bdac'] },
  { id: 'finance', name: 'Finance', type: 'GlobalTeam', aliases: ['finance'] },
  { id: 'dt', name: 'DT', type: 'GlobalTeam', aliases: ['dt', 'digital technology', 'digital transformation'] },
  { id: 'pc', name: 'P&C', type: 'GlobalTeam', aliases: ['p c', 'p&c', 'people culture', 'people and culture', 'people & culture'] },
];

const ALIAS_INDEX = new Map<string, EntityDef>();
for (const e of KNOWN_ENTITIES) for (const a of e.aliases) ALIAS_INDEX.set(key(a), e);

/** Retrouve l'entité à partir d'un libellé du registre ("Global Programs – PEI", "Bénin"…). */
export function resolveEntity(label: string): EntityDef | null {
  const k = key(label);
  if (!k) return null;
  if (ALIAS_INDEX.has(k)) return ALIAS_INDEX.get(k)!;
  // "Global Programs – PEI" → on cherche l'alias le plus spécifique contenu dans le libellé
  let best: EntityDef | null = null;
  let bestLen = 0;
  for (const [alias, e] of ALIAS_INDEX) {
    if (alias.length < 2) continue;
    if (new RegExp(`(^| )${alias}( |$)`).test(k) && alias.length > bestLen) {
      best = e;
      bestLen = alias.length;
    }
  }
  return best;
}

/** Pays mentionnés dans un texte (initiatives des équipes globales). "All countries" → tous. */
export function detectCountries(text: string): string[] {
  const k = ` ${key(text)} `;
  if (/ all (countries|markets|country programs|programs) | tous les pays | cross country /.test(k)) {
    return KNOWN_ENTITIES.filter((e) => e.type === 'Country').map((e) => e.id);
  }
  const out: string[] = [];
  for (const e of KNOWN_ENTITIES) {
    if (e.type !== 'Country') continue;
    // les abréviations de 2 lettres ne sont pas recherchées dans le texte libre (trop de faux positifs)
    if (e.aliases.some((a) => a.length > 2 && k.includes(` ${key(a)} `))) out.push(e.id);
  }
  return out;
}
