/**
 * Réimport de l'Excel : le nouveau fichier fait foi pour la structure (KR, initiatives, jalons),
 * mais on conserve tout ce qui a été saisi dans l'application :
 *  - statut, valeur réelle, preuve et commentaire des jalons (identifiants stables) ;
 *  - historique des check-ins des jalons toujours présents ;
 *  - poids personnalisés des liens, cibles modifiées des initiatives, paramètres.
 */
import type { Dataset } from '../types';

export function mergeDataset(prev: Dataset, next: Dataset): Dataset {
  const oldMs = new Map(prev.milestones.map((m) => [m.id, m]));
  const oldContrib = new Map(prev.contributions.map((c) => [c.id, c]));
  const oldInit = new Map(prev.initiatives.map((i) => [i.id, i]));
  const milestones = next.milestones.map((m) => {
    const o = oldMs.get(m.id);
    return o ? { ...m, status: o.status, actualValue: o.actualValue, evidenceUrl: o.evidenceUrl, comment: o.comment, updatedAt: o.updatedAt, updatedBy: o.updatedBy } : m;
  });
  const ids = new Set(milestones.map((m) => m.id));
  return {
    ...next,
    milestones,
    contributions: next.contributions.map((c) => ({ ...c, weight: oldContrib.get(c.id)?.weight ?? c.weight })),
    initiatives: next.initiatives.map((i) => ({ ...i, target: oldInit.get(i.id)?.target ?? i.target })),
    updates: prev.updates.filter((u) => ids.has(u.milestoneId)),
    settings: prev.settings,
  };
}
