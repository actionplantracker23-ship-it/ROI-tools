export const pct = (x: number | null | undefined, digits = 0) =>
  x === null || x === undefined || !Number.isFinite(x) ? '—' : `${x.toFixed(digits)}\u00a0%`;

export const money = (x: number | null | undefined) =>
  x === null || x === undefined ? '—' : new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(x);

export const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '—';

export const entityPath = (e: { id: string; type: string }) => (e.type === 'Country' ? `/pays/${e.id}` : `/equipe/${e.id}`);
