/** Dates du plan : échéance déduite du texte d'un KR, trimestres, formats. */
import { locale } from '../i18n';
import type { Quarter } from '../types';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, janvier: 1, feb: 2, february: 2, fevrier: 2, février: 2, mar: 3, march: 3, mars: 3, apr: 4, april: 4, avril: 4,
  may: 5, mai: 5, jun: 6, june: 6, juin: 6, jul: 7, july: 7, juillet: 7, aug: 8, august: 8, aout: 8, août: 8, sep: 9, sept: 9, september: 9, septembre: 9,
  oct: 10, october: 10, octobre: 10, nov: 11, november: 11, novembre: 11, dec: 12, december: 12, decembre: 12, décembre: 12,
};
const pad = (n: number) => String(n).padStart(2, '0');
export const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/**
 * Échéance écrite dans un intitulé : « By 31 March 2027 », « By December 2027 », « By Q2 2027 », « by end of Q3 »,
 * « (Q2) », « By 30 June », « by Dec 2027 ». Renvoie null si rien n'est trouvé. L'année par défaut est celle du plan.
 */
export function parseDueDate(text: string, year: number): string | null {
  const t = text.toLowerCase();
  // jour + mois (+ année)
  let m = t.match(/\b(\d{1,2})\s+(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\b\.?\s*(\d{4})?/);
  if (m) { const mo = MONTHS[m[2]] ?? MONTHS[m[2].slice(0, 3)]; const y = m[3] ? Number(m[3]) : year; return iso(y, mo, Math.min(Number(m[1]), lastDay(y, mo))); }
  // mois + année
  m = t.match(/\b(?:by|end of|before|d'ici|fin)\s+(?:the\s+end\s+of\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?\s*(\d{4})?/);
  if (m) { const mo = MONTHS[m[1]] ?? MONTHS[m[1].slice(0, 3)]; const y = m[2] ? Number(m[2]) : year; return iso(y, mo, lastDay(y, mo)); }
  // trimestre
  m = t.match(/\bq([1-4])\b\s*(\d{4})?/);
  if (m) { const q = Number(m[1]); const y = m[2] ? Number(m[2]) : year; return iso(y, q * 3, lastDay(y, q * 3)); }
  return null;
}

export const quarterOf = (date: string): Quarter => (Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1) as Quarter;
export const quarterStart = (y: number, q: number) => iso(y, (q - 1) * 3 + 1, 1);
export const quarterEnd = (y: number, q: number) => iso(y, q * 3, lastDay(y, q * 3));
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00`).toLocaleDateString(locale(), { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);
export const addYears = (d: string, n: number) => (d ? `${Number(d.slice(0, 4)) + n}${d.slice(4)}` : d);
