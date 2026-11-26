/**
 * Données FICTIVES pour Q1, afin de montrer le tableau de bord sur la structure réelle du fichier.
 * Tirage déterministe (même résultat à chaque fois) :
 *  - jalons Q1 : ~45 % atteints, 35 % en cours, 10 % non démarrés, 7 % en retard, 3 % annulés ;
 *  - indicateurs : une valeur Q1 entre la baseline et la cible Q1 (ou 20–60 % du chemin vers la cible).
 * Tout est tracé « Démo (fictif) » avec un commentaire [DÉMO].
 */
import type { Dataset, IndicatorValue, MilestoneStatus, MilestoneUpdate } from '../types';
import { hash } from './import/normalize';

const rnd = (id: string) => (parseInt(hash(id), 36) % 1000) / 1000;

export function applyDemoQ1(ds: Dataset): Dataset {
  // datées d'hier : toute saisie réelle faite ensuite les remplace
  const at = new Date(Date.now() - 86_400_000).toISOString();
  const by = 'Démo (fictif)';
  const comment = '[DÉMO] Valeur fictive générée pour la démonstration.';
  const updates: MilestoneUpdate[] = [];
  const milestones = ds.milestones.map((m) => {
    if (m.quarter !== 1) return m;
    const r = rnd(m.id);
    const status: MilestoneStatus = r < 0.45 ? 'achieved' : r < 0.8 ? 'in_progress' : r < 0.9 ? 'not_started' : r < 0.97 ? 'late' : 'cancelled';
    updates.push({ id: `demo-${m.id}`, milestoneId: m.id, status, evidenceUrl: '', comment, at, by });
    return { ...m, status, comment, updatedAt: at, updatedBy: by };
  });
  const values: IndicatorValue[] = [];
  for (const ind of ds.indicators) {
    const r = rnd(ind.id);
    let value: number | null = null;
    if (ind.metric === 'Yes/No') value = r < 0.4 ? 1 : 0;
    else if (ind.target !== null) {
      const base = ind.baseline ?? 0;
      value = Math.round((base + (ind.target - base) * (0.1 + r * 0.5)) * 10) / 10;
    }
    if (value === null || r > 0.85) continue; // ~15 % non renseignés, pour illustrer les alertes
    values.push({ id: `demo-${ind.id}`, indicatorId: ind.id, quarter: 1, value, evidenceUrl: '', comment, at, by });
  }
  return {
    ...ds, milestones,
    updates: [...ds.updates.filter((u) => !u.id.startsWith('demo-')), ...updates],
    indicatorValues: [...ds.indicatorValues.filter((v) => !v.id.startsWith('demo-')), ...values],
  };
}
