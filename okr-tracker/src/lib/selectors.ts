/** Sélecteurs partagés entre les pages (agrégats prêts à afficher). */
import type { Dataset, Role } from '../types';
import { contributionWeight, ragOf, weightedMean, type Computed, type Score } from './progress';

export interface Cell extends Score { role: Role; krIds: string[] }

/** Cellule de la heatmap KR global × entité : rôle le plus fort + avancement pondéré des KR liés. */
export function heatCell(ds: Dataset, c: Computed, globalKrId: string, entityId: string): Cell | null {
  const links = ds.contributions.filter((x) => x.globalKrId === globalKrId && x.entityId === entityId);
  if (!links.length) return null;
  const progress = weightedMean(links.map((l) => [c.entityKr.get(l.entityKrId)?.progress ?? null, contributionWeight(l, ds.settings)]));
  const late = links.reduce((a, l) => a + (c.entityKr.get(l.entityKrId)?.late ?? 0), 0);
  return { role: links.some((l) => l.role === 'Lead') ? 'Lead' : 'Contributes', progress, late, rag: ragOf(progress, late, ds.settings), krIds: links.map((l) => l.entityKrId) };
}

/** Jalons échus (≤ trimestre) d'une entité, par statut. */
export function milestoneStats(ds: Dataset, quarter: number, entityId?: string) {
  const ms = ds.milestones.filter((m) => m.quarter <= quarter && (!entityId || m.entityId === entityId));
  const by = (s: string) => ms.filter((m) => m.status === s).length;
  return { due: ms.length, achieved: by('achieved'), inProgress: by('in_progress'), late: by('late'), notStarted: by('not_started'), cancelled: by('cancelled') };
}

/** Initiatives des équipes globales qui visent un pays. */
export function supportToCountry(ds: Dataset, countryId: string) {
  const teams = new Set(ds.entities.filter((e) => e.type === 'GlobalTeam').map((e) => e.id));
  return ds.initiatives.filter((i) => teams.has(i.entityId) && i.targetCountryIds.includes(countryId));
}

export function globalKrsOfEntityKr(ds: Dataset, entityKrId: string) {
  return ds.contributions.filter((c) => c.entityKrId === entityKrId);
}
