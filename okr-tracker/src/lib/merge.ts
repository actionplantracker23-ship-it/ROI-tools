/**
 * Réimport de l'Excel : le nouveau fichier fait foi pour la structure (KR, initiatives, jalons,
 * indicateurs importés), mais on conserve tout ce qui a été saisi dans l'application :
 *  - statut, preuve et commentaire des jalons (identifiants stables) et leur historique ;
 *  - indicateurs ajoutés à la main, cibles modifiées, valeurs trimestrielles et historique ;
 *  - rattachements manuels KR pays → département, poids des liens, paramètres.
 */
import type { Dataset } from '../types';

export function mergeDataset(prev: Dataset, next: Dataset): Dataset {
  const oldMs = new Map(prev.milestones.map((m) => [m.id, m]));
  const oldContrib = new Map(prev.contributions.map((c) => [c.id, c]));
  const oldInit = new Map(prev.initiatives.map((i) => [i.id, i]));
  const oldKr = new Map(prev.entityKrs.map((k) => [k.id, k]));
  const oldInd = new Map((prev.indicators ?? []).map((i) => [i.id, i]));
  const milestones = next.milestones.map((m) => {
    const o = oldMs.get(m.id);
    return o ? { ...m, status: o.status, evidenceUrl: o.evidenceUrl, comment: o.comment, updatedAt: o.updatedAt, updatedBy: o.updatedBy } : m;
  });
  const krIds = new Set(next.entityKrs.map((k) => k.id));
  // indicateurs importés : définition du fichier, mais cibles / nom édités conservés ; indicateurs manuels gardés
  const indicators = [
    ...next.indicators.map((i) => {
      const o = oldInd.get(i.id);
      return o ? { ...i, name: o.name, unit: o.unit, baseline: o.baseline, target: o.target, quarterTargets: o.quarterTargets, source: o.source || i.source } : i;
    }),
    ...(prev.indicators ?? []).filter((i) => i.origin === 'manual' && krIds.has(i.entityKrId) && !next.indicators.some((n) => n.id === i.id)),
  ];
  const msIds = new Set(milestones.map((m) => m.id));
  const indIds = new Set(indicators.map((i) => i.id));
  return {
    ...next,
    milestones,
    indicators,
    entityKrs: next.entityKrs.map((k) => {
      const o = oldKr.get(k.id);
      return o?.departmentSource === 'manual' ? { ...k, departmentId: o.departmentId, departmentSource: 'manual' as const } : k;
    }),
    contributions: next.contributions.map((c) => ({ ...c, weight: oldContrib.get(c.id)?.weight ?? c.weight })),
    initiatives: next.initiatives.map((i) => ({ ...i, targetCountryIds: oldInit.get(i.id)?.targetCountryIds ?? i.targetCountryIds })),
    updates: prev.updates.filter((u) => msIds.has(u.milestoneId)),
    indicatorValues: (prev.indicatorValues ?? []).filter((v) => indIds.has(v.indicatorId)),
    settings: { ...next.settings, ...prev.settings, krMethod: prev.settings.krMethod ?? 'mix' },
  };
}
