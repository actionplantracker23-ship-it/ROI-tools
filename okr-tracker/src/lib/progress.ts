/**
 * Consolidation de l'avancement, de bas en haut.
 *
 *  1. Jalon       : Non démarré 0 %, En cours 50 %, Atteint 100 %, En retard = signalé
 *                   (compté settings.lateScore, 0 par défaut), Annulé = exclu.
 *  2. Initiative  : moyenne des jalons échus au trimestre choisi (Q ≤ trimestre courant).
 *  3. Indicateur  : dernière valeur saisie (≤ trimestre) → (valeur − baseline) / (cible − baseline),
 *                   borné 0–100 % ; Oui/Non : 0 ou 100 %. Fonctionne aussi pour une cible à la baisse.
 *  4. KR d'entité : selon settings.krMethod
 *                   - 'mix' (défaut) : moyenne de [moyenne des initiatives, moyenne des indicateurs] ;
 *                   - 'milestones'   : moyenne des initiatives ;
 *                   - 'indicators'   : moyenne des indicateurs.
 *  5. Objectif d'entité : moyenne de ses KR. Avancement pays/département = moyenne de ses objectifs.
 *  6. KR global   : moyenne pondérée des KR liés (Lead 2, Contributes 1, poids modifiable).
 *  7. Objectif global : moyenne de ses KR globaux.
 *
 * RAG : Vert ≥ 70 %, Ambre 40–69 %, Rouge < 40 % OU au moins un jalon en retard dans le périmètre.
 * null = « pas de donnée » : ignoré dans les moyennes.
 * Tout est indexé (Map) : un recalcul complet est linéaire en nombre de lignes.
 */
import type { Contribution, Dataset, Indicator, IndicatorValue, Milestone, MilestoneStatus, Quarter, Rag, Settings } from '../types';
import { hasPlaceholder } from './import/normalize';

export interface Score {
  progress: number | null; // 0–100
  late: number; // jalons en retard dans le périmètre
  rag: Rag;
}

export interface KrScore extends Score {
  milestones: number | null; // avancement par les jalons des activités
  indicators: number | null; // avancement par les indicateurs
}

export interface IndicatorScore {
  value: number | null; // dernière valeur mesurée (≤ trimestre)
  valueQuarter: Quarter | null;
  progress: number | null;
  rag: Rag;
  /** Cible du trimestre choisi et écart (valeur − cible), si définie. */
  quarterTarget: number | null;
  onTrack: boolean | null;
}

export interface Computed {
  quarter: Quarter;
  milestone: Map<string, number | null>;
  initiative: Map<string, Score>;
  indicator: Map<string, IndicatorScore>;
  entityKr: Map<string, KrScore>;
  entityObjective: Map<string, Score>;
  entity: Map<string, Score>;
  globalKr: Map<string, Score>;
  globalObjective: Map<string, Score>;
}

export function milestoneScore(status: MilestoneStatus, s: Settings): number | null {
  switch (status) {
    case 'not_started': return 0;
    case 'in_progress': return 50;
    case 'achieved': return 100;
    case 'late': return s.lateScore;
    case 'cancelled': return null;
  }
}

export function ragOf(progress: number | null, late: number, s: Settings): Rag {
  if (late > 0) return 'red';
  if (progress === null) return 'none';
  if (progress >= s.rag.green) return 'green';
  if (progress >= s.rag.amber) return 'amber';
  return 'red';
}

export function mean(values: (number | null | undefined)[]): number | null {
  let n = 0;
  let sum = 0;
  for (const x of values) if (typeof x === 'number' && Number.isFinite(x)) { n++; sum += x; }
  return n ? sum / n : null;
}

export function weightedMean(pairs: [number | null, number][]): number | null {
  let sw = 0;
  let sx = 0;
  for (const [x, w] of pairs) {
    if (x === null || !Number.isFinite(x) || w <= 0) continue;
    sw += w;
    sx += x * w;
  }
  return sw ? sx / sw : null;
}

export const contributionWeight = (c: Contribution, s: Settings) => c.weight ?? s.weights[c.role];

const clamp = (x: number) => Math.max(0, Math.min(100, x));

/** Groupe une liste par clé (index O(n)). */
export function groupBy<T>(list: T[], k: (x: T) => string | null | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of list) {
    const key = k(x);
    if (key == null) continue;
    const arr = m.get(key);
    if (arr) arr.push(x);
    else m.set(key, [x]);
  }
  return m;
}

/** Dernière valeur d'un indicateur à la date du trimestre choisi (trimestre le plus récent, puis saisie la plus récente). */
export function latestValue(values: IndicatorValue[] | undefined, quarter: Quarter): IndicatorValue | null {
  let best: IndicatorValue | null = null;
  for (const v of values ?? []) {
    if (v.quarter > quarter || v.value === null) continue;
    if (!best || v.quarter > best.quarter || (v.quarter === best.quarter && v.at > best.at)) best = v;
  }
  return best;
}

export function indicatorProgress(ind: Indicator, value: number | null): number | null {
  if (value === null) return null;
  if (ind.metric === 'Yes/No') return value >= 1 ? 100 : 0;
  if (ind.target === null) return null;
  const base = ind.baseline ?? 0;
  if (ind.target === base) return value >= ind.target ? 100 : 0;
  return clamp(((value - base) / (ind.target - base)) * 100);
}

export function compute(ds: Dataset, quarter: Quarter = ds.settings.currentQuarter): Computed {
  const s = ds.settings;
  const method = s.krMethod ?? 'mix';
  const score = (progress: number | null, late: number): Score => ({ progress, late, rag: ragOf(progress, late, s) });
  const msByInit = groupBy<Milestone>(ds.milestones, (m) => m.initiativeId);
  const initByKr = groupBy(ds.initiatives, (i) => i.entityKrId);
  const indByKr = groupBy(ds.indicators ?? [], (i) => i.entityKrId);
  const valByInd = groupBy(ds.indicatorValues ?? [], (v) => v.indicatorId);
  const krByObj = groupBy(ds.entityKrs, (k) => k.objectiveId);
  const krByEntity = groupBy(ds.entityKrs, (k) => k.entityId);
  const objByEntity = groupBy(ds.entityObjectives, (o) => o.entityId);
  const linksByGlobal = groupBy(ds.contributions, (c) => c.globalKrId);
  const gkByObj = groupBy(ds.globalKrs, (g) => g.objectiveId);

  // 1. jalons
  const milestone = new Map<string, number | null>();
  for (const m of ds.milestones) milestone.set(m.id, milestoneScore(m.status, s));

  // 2. initiatives
  const initiative: Computed['initiative'] = new Map();
  for (const i of ds.initiatives) {
    const due = (msByInit.get(i.id) ?? []).filter((m) => m.quarter <= quarter && m.status !== 'cancelled');
    const late = due.filter((m) => m.status === 'late').length;
    initiative.set(i.id, score(mean(due.map((m) => milestone.get(m.id))), late));
  }

  // 3. indicateurs
  const indicator: Computed['indicator'] = new Map();
  for (const ind of ds.indicators ?? []) {
    const v = latestValue(valByInd.get(ind.id), quarter);
    const progress = indicatorProgress(ind, v?.value ?? null);
    const qt = ind.quarterTargets?.[quarter - 1] ?? null;
    const base = ind.baseline ?? 0;
    const up = ind.target === null || ind.target >= base;
    const onTrack = v?.value == null || qt === null ? null : up ? v.value >= qt : v.value <= qt;
    indicator.set(ind.id, { value: v?.value ?? null, valueQuarter: v?.quarter ?? null, progress, rag: ragOf(progress, 0, s), quarterTarget: qt, onTrack });
  }

  // 4. KR d'entité
  const entityKr: Computed['entityKr'] = new Map();
  for (const k of ds.entityKrs) {
    const inits = (initByKr.get(k.id) ?? []).map((i) => initiative.get(i.id)!);
    const late = inits.reduce((a, b) => a + b.late, 0);
    const mP = mean(inits.map((x) => x.progress));
    const iP = mean((indByKr.get(k.id) ?? []).map((i) => indicator.get(i.id)!.progress));
    const p = method === 'milestones' ? mP : method === 'indicators' ? iP : mean([mP, iP]);
    entityKr.set(k.id, { ...score(p, late), milestones: mP, indicators: iP });
  }

  // 5. objectifs d'entité et entités
  const entityObjective: Computed['entityObjective'] = new Map();
  for (const o of ds.entityObjectives) {
    const ks = (krByObj.get(o.id) ?? []).map((k) => entityKr.get(k.id)!);
    entityObjective.set(o.id, score(mean(ks.map((x) => x.progress)), ks.reduce((a, b) => a + b.late, 0)));
  }
  const entity: Computed['entity'] = new Map();
  for (const e of ds.entities) {
    const objs = (objByEntity.get(e.id) ?? []).map((o) => entityObjective.get(o.id)!);
    const orphanKrs = (krByEntity.get(e.id) ?? []).filter((k) => !k.objectiveId).map((k) => entityKr.get(k.id)!);
    const parts = [...objs, ...orphanKrs];
    entity.set(e.id, score(mean(parts.map((x) => x.progress)), parts.reduce((a, b) => a + b.late, 0)));
  }

  // 6. KR globaux (moyenne pondérée)
  const globalKr: Computed['globalKr'] = new Map();
  for (const g of ds.globalKrs) {
    const links = linksByGlobal.get(g.id) ?? [];
    const parts = links.map((c) => [entityKr.get(c.entityKrId)?.progress ?? null, contributionWeight(c, s)] as [number | null, number]);
    const late = links.reduce((a, c) => a + (entityKr.get(c.entityKrId)?.late ?? 0), 0);
    globalKr.set(g.id, score(weightedMean(parts), late));
  }

  // 7. objectifs globaux
  const globalObjective: Computed['globalObjective'] = new Map();
  for (const o of ds.globalObjectives) {
    const ks = (gkByObj.get(o.id) ?? []).map((g) => globalKr.get(g.id)!);
    globalObjective.set(o.id, score(mean(ks.map((x) => x.progress)), ks.reduce((a, b) => a + b.late, 0)));
  }

  return { quarter, milestone, initiative, indicator, entityKr, entityObjective, entity, globalKr, globalObjective };
}

// ------------------------------------------------------------------ alertes

export interface Alert {
  kind: 'late' | 'no_data' | 'placeholder' | 'no_lead' | 'no_initiative' | 'no_indicator' | 'indicator_missing' | 'no_department';
  label: string;
  detail: string;
  link: string;
  entityId?: string;
}

export const krLink = (ds: Dataset, krId: string) => {
  const k = ds.entityKrs.find((x) => x.id === krId);
  const e = ds.entities.find((x) => x.id === k?.entityId);
  return `${e?.type === 'Country' ? '/pays/' : '/equipe/'}${k?.entityId ?? ''}?kr=${encodeURIComponent(krId)}`;
};

export function alerts(ds: Dataset, c: Computed): Alert[] {
  const out: Alert[] = [];
  const ent = new Map(ds.entities.map((e) => [e.id, e]));
  const init = new Map(ds.initiatives.map((i) => [i.id, i]));
  const initByKr = groupBy(ds.initiatives, (i) => i.entityKrId);
  const msByInit = groupBy(ds.milestones, (m) => m.initiativeId);
  const indByKr = groupBy(ds.indicators ?? [], (i) => i.entityKrId);
  const leads = new Set(ds.contributions.filter((x) => x.role === 'Lead').map((x) => x.globalKrId));
  for (const g of ds.globalKrs) {
    if (!leads.has(g.id)) out.push({ kind: 'no_lead', label: `${g.id} sans pays/département Lead`, detail: g.title, link: `/kr/${encodeURIComponent(g.id)}` });
  }
  for (const m of ds.milestones) {
    if (m.status === 'late' && m.quarter <= c.quarter) {
      const i = init.get(m.initiativeId);
      out.push({
        kind: 'late', label: `Jalon Q${m.quarter} en retard · ${ent.get(m.entityId)?.name ?? ''}`,
        detail: `${i?.title ?? ''} : ${m.description}`, link: `/check-in?initiative=${encodeURIComponent(m.initiativeId)}`, entityId: m.entityId,
      });
    }
  }
  for (const k of ds.entityKrs) {
    const e = ent.get(k.entityId);
    const link = `${e?.type === 'Country' ? '/pays/' : '/equipe/'}${k.entityId}?kr=${encodeURIComponent(k.id)}`;
    const inits = initByKr.get(k.id) ?? [];
    const inds = indByKr.get(k.id) ?? [];
    const name = e?.name ?? '';
    if (!inits.length) out.push({ kind: 'no_initiative', label: `KR sans activité · ${name}`, detail: k.title, link, entityId: k.entityId });
    else if (c.entityKr.get(k.id)?.progress === null) out.push({ kind: 'no_data', label: `KR sans données au Q${c.quarter} · ${name}`, detail: k.title, link, entityId: k.entityId });
    if (!inds.length) out.push({ kind: 'no_indicator', label: `KR sans indicateur de mesure · ${name}`, detail: k.title, link, entityId: k.entityId });
    else {
      const missing = inds.filter((i) => c.indicator.get(i.id)?.valueQuarter !== c.quarter);
      if (missing.length) {
        out.push({ kind: 'indicator_missing', label: `${missing.length} indicateur(s) non renseigné(s) au Q${c.quarter} · ${name}`, detail: k.title, link: `/check-in?kr=${encodeURIComponent(k.id)}`, entityId: k.entityId });
      }
    }
    if (e?.type === 'Country' && !k.departmentId) out.push({ kind: 'no_department', label: `KR pays non rattaché à un département · ${name}`, detail: k.title, link, entityId: k.entityId });
    const ms = inits.flatMap((i) => msByInit.get(i.id) ?? []);
    if (hasPlaceholder(k.title, ...inits.map((i) => i.baseline), ...ms.map((m) => m.description), ...inds.map((i) => i.baselineText))) {
      out.push({ kind: 'placeholder', label: `Cible non définie ([X], TBC…) · ${name}`, detail: k.title, link, entityId: k.entityId });
    }
  }
  return out;
}

export function krHasPlaceholder(ds: Dataset, krId: string): boolean {
  const k = ds.entityKrs.find((x) => x.id === krId);
  if (!k) return false;
  const inits = ds.initiatives.filter((i) => i.entityKrId === krId);
  const ids = new Set(inits.map((i) => i.id));
  const ms = ds.milestones.filter((m) => ids.has(m.initiativeId));
  return hasPlaceholder(k.title, ...inits.map((i) => i.baseline), ...ms.map((m) => m.description));
}
