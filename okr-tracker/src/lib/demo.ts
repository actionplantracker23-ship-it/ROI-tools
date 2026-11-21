/**
 * Statuts FICTIFS pour Q1, afin de montrer le tableau de bord sur la structure réelle du fichier.
 * Tirage déterministe (même résultat à chaque fois) : ~45 % atteints, 35 % en cours,
 * 10 % non démarrés, 7 % en retard, 3 % annulés. Chaque statut est tracé « Démo (fictif) ».
 */
import type { Dataset, MilestoneStatus, MilestoneUpdate } from '../types';
import { hash } from './import/normalize';

export function applyDemoQ1(ds: Dataset): Dataset {
  const at = '2027-04-05T09:00:00.000Z';
  const updates: MilestoneUpdate[] = [];
  const milestones = ds.milestones.map((m) => {
    if (m.quarter !== 1) return m;
    const r = (parseInt(hash(m.id), 36) % 100) / 100;
    const status: MilestoneStatus = r < 0.45 ? 'achieved' : r < 0.8 ? 'in_progress' : r < 0.9 ? 'not_started' : r < 0.97 ? 'late' : 'cancelled';
    const comment = '[DÉMO] Statut fictif généré pour la démonstration.';
    updates.push({ id: `demo-${m.id}`, milestoneId: m.id, status, actualValue: null, evidenceUrl: '', comment, at, by: 'Démo (fictif)' });
    return { ...m, status, comment, updatedAt: at, updatedBy: 'Démo (fictif)' };
  });
  return { ...ds, milestones, updates: [...ds.updates.filter((u) => !u.id.startsWith('demo-')), ...updates] };
}
