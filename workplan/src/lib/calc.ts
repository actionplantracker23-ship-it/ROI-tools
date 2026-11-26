/**
 * Calculs d'un plan (purs, indexés, en temps linéaire).
 *
 * Avancement d'une activité = moyenne de [exécution, indicateurs de l'activité] (ce qui est disponible) :
 *   exécution : Non démarrée 0 (ou % saisi), En cours / En retard = % saisi, Réalisée 100, Annulée = exclue.
 * Activité globale consolidée = moyenne de [son avancement propre, moyenne des activités pays qui lui sont liées].
 * KR = moyenne de [activités globales consolidées, indicateurs du KR].
 * Objectif = moyenne de [KR, indicateurs de l'objectif]. Plan = moyenne des objectifs.
 * Indicateur : dernière valeur (≤ trimestre) → (valeur − baseline) / (cible − baseline), borné 0–100 % ;
 *   Oui/Non : 0 ou 100 %. Fonctionne aussi pour une cible à la baisse.
 * RAG : Vert ≥ 70 %, Ambre ≥ 40 %, Rouge en dessous OU activité en retard (statut, ou trimestre de fin dépassé).
 *
 * Alignement : une activité pays doit être liée à une activité globale du même plan.
 * Sinon elle est ORPHELINE (non liée au global). Une activité globale sans activité pays est normale.
 */
import type { Activity, Indicator, IndicatorValue, Quarter, Rag, Settings, Workspace } from '../types';
import { groupBy, mean } from './util';

export interface Score { progress: number | null; rag: Rag; late: boolean }
export interface IndicatorScore { value: number | null; valueQuarter: Quarter | null; progress: number | null; rag: Rag; quarterTarget: number | null; onTrack: boolean | null }
export interface ActivityScore extends Score { exec: number | null; indicators: number | null; children: number | null; overdue: boolean }

export interface PlanView {
  planId: string;
  quarter: Quarter;
  objectives: Workspace['objectives'];
  krs: Workspace['krs'];
  commitments: Workspace['commitments'];
  activities: Activity[];
  globalActs: Activity[];
  countryActs: Activity[];
  indicators: Indicator[];
  byId: Map<string, Activity>;
  childrenOf: Map<string, Activity[]>;
  actsByKr: Map<string, Activity[]>;
  actsByUnit: Map<string, Activity[]>;
  indByTarget: Map<string, Indicator[]>;
  valuesByInd: Map<string, IndicatorValue[]>;
  indicator: Map<string, IndicatorScore>;
  activity: Map<string, ActivityScore>;
  kr: Map<string, Score>;
  objective: Map<string, Score>;
  unit: Map<string, Score>;
  plan: Score;
  /** Activités pays orphelines (non liées à une activité globale du plan). */
  orphans: Activity[];
  alignment: { countryActs: number; aligned: number; partial: number; orphans: number; rate: number | null };
}

export function ragOf(p: number | null, late: boolean, s: Settings): Rag {
  if (late) return 'red';
  if (p === null) return 'none';
  return p >= s.rag.green ? 'green' : p >= s.rag.amber ? 'amber' : 'red';
}

export function latestValue(values: IndicatorValue[] | undefined, q: Quarter): IndicatorValue | null {
  let best: IndicatorValue | null = null;
  for (const v of values ?? []) {
    if (v.quarter > q || v.value === null) continue;
    if (!best || v.quarter > best.quarter || (v.quarter === best.quarter && v.at > best.at)) best = v;
  }
  return best;
}

export function indicatorProgress(ind: Indicator, value: number | null): number | null {
  if (value === null) return null;
  if (ind.kind === 'yesno') return value >= 1 ? 100 : 0;
  if (ind.target === null) return null;
  const base = ind.baseline ?? 0;
  if (ind.target === base) return value >= ind.target ? 100 : 0;
  return Math.max(0, Math.min(100, ((value - base) / (ind.target - base)) * 100));
}

export function execProgress(a: Activity): number | null {
  switch (a.status) {
    case 'cancelled': return null;
    case 'done': return 100;
    default: return Math.max(0, Math.min(100, a.progress || 0));
  }
}

export const targetKey = (type: string, id: string) => `${type}:${id}`;

export function computePlan(ws: Workspace, planId: string, quarter: Quarter = ws.settings.currentQuarter): PlanView {
  const s = ws.settings;
  const objectives = ws.objectives.filter((o) => o.planId === planId).sort((a, b) => a.order - b.order);
  const objOrder = new Map(objectives.map((o, n) => [o.id, n]));
  const krs = ws.krs.filter((k) => k.planId === planId)
    .sort((a, b) => (objOrder.get(a.objectiveId) ?? 99) - (objOrder.get(b.objectiveId) ?? 99) || a.order - b.order);
  const commitments = ws.commitments.filter((c) => c.planId === planId);
  const activities = ws.activities.filter((a) => a.planId === planId).sort((a, b) => a.order - b.order);
  const indicators = ws.indicators.filter((i) => i.planId === planId).sort((a, b) => a.order - b.order);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const globalActs = activities.filter((a) => a.level === 'global');
  const countryActs = activities.filter((a) => a.level === 'country');
  // un lien n'est valide que vers une activité GLOBALE du même plan
  const validParent = (a: Activity) => (a.parentId && byId.get(a.parentId)?.level === 'global' ? a.parentId : null);
  const childrenOf = groupBy(countryActs, validParent);
  const krOf = (a: Activity) => a.krId ?? (a.parentId ? byId.get(a.parentId)?.krId ?? null : null);
  const actsByKr = groupBy(globalActs, krOf);
  const actsByUnit = groupBy(activities, (a) => a.unitId);
  const indByTarget = groupBy(indicators, (i) => targetKey(i.targetType, i.targetId));
  const indIds = new Set(indicators.map((i) => i.id));
  const valuesByInd = groupBy(ws.indicatorValues.filter((v) => indIds.has(v.indicatorId)), (v) => v.indicatorId);

  const indicator = new Map<string, IndicatorScore>();
  for (const ind of indicators) {
    const v = latestValue(valuesByInd.get(ind.id), quarter);
    const progress = indicatorProgress(ind, v?.value ?? null);
    const qt = ind.quarterTargets[quarter - 1] ?? null;
    const up = ind.target === null || ind.target >= (ind.baseline ?? 0);
    const onTrack = v?.value == null || qt === null ? null : up ? v.value >= qt : v.value <= qt;
    indicator.set(ind.id, { value: v?.value ?? null, valueQuarter: v?.quarter ?? null, progress, rag: ragOf(progress, false, s), quarterTarget: qt, onTrack });
  }
  const indMean = (type: string, id: string) => mean((indByTarget.get(targetKey(type, id)) ?? []).map((i) => indicator.get(i.id)!.progress));

  const activity = new Map<string, ActivityScore>();
  const own = (a: Activity) => {
    const exec = execProgress(a);
    const ind = indMean('activity', a.id);
    const overdue = a.status !== 'done' && a.status !== 'cancelled' && a.endQ < quarter;
    return { exec, indicators: ind, p: a.status === 'cancelled' ? null : mean([exec, ind]), late: a.status === 'late' || overdue, overdue };
  };
  for (const a of countryActs) {
    const o = own(a);
    activity.set(a.id, { progress: o.p, rag: ragOf(o.p, o.late, s), late: o.late, exec: o.exec, indicators: o.indicators, children: null, overdue: o.overdue });
  }
  for (const a of globalActs) {
    const o = own(a);
    const kids = (childrenOf.get(a.id) ?? []).map((c) => activity.get(c.id)!);
    const children = mean(kids.map((k) => k.progress));
    const p = a.status === 'cancelled' ? null : mean([o.p, children]);
    const late = o.late || kids.some((k) => k.late);
    activity.set(a.id, { progress: p, rag: ragOf(p, late, s), late, exec: o.exec, indicators: o.indicators, children, overdue: o.overdue });
  }

  const kr = new Map<string, Score>();
  for (const k of krs) {
    const acts = (actsByKr.get(k.id) ?? []).map((a) => activity.get(a.id)!);
    const p = mean([mean(acts.map((x) => x.progress)), indMean('kr', k.id)]);
    const late = acts.some((x) => x.late);
    kr.set(k.id, { progress: p, rag: ragOf(p, late, s), late });
  }
  const objective = new Map<string, Score>();
  const krByObj = groupBy(krs, (k) => k.objectiveId);
  for (const o of objectives) {
    const ks = (krByObj.get(o.id) ?? []).map((k) => kr.get(k.id)!);
    const p = mean([mean(ks.map((x) => x.progress)), indMean('objective', o.id)]);
    const late = ks.some((x) => x.late);
    objective.set(o.id, { progress: p, rag: ragOf(p, late, s), late });
  }
  const unit = new Map<string, Score>();
  for (const u of ws.units) {
    const acts = (actsByUnit.get(u.id) ?? []).map((a) => activity.get(a.id)!);
    const p = mean(acts.map((x) => x.progress));
    const late = acts.some((x) => x.late);
    unit.set(u.id, { progress: p, rag: ragOf(p, late, s), late });
  }
  const pp = mean([...objective.values()].map((x) => x.progress));
  const planLate = [...objective.values()].some((x) => x.late);

  const live = countryActs.filter((a) => a.status !== 'cancelled');
  const orphans = live.filter((a) => !validParent(a));
  const aligned = live.length - orphans.length;
  const partial = live.filter((a) => validParent(a) && a.alignment === 'partial').length;

  return {
    planId, quarter, objectives, krs, commitments, activities, globalActs, countryActs, indicators,
    byId, childrenOf, actsByKr, actsByUnit, indByTarget, valuesByInd, indicator, activity, kr, objective, unit,
    plan: { progress: pp, rag: ragOf(pp, planLate, s), late: planLate },
    orphans,
    alignment: { countryActs: live.length, aligned, partial, orphans: orphans.length, rate: live.length ? (aligned / live.length) * 100 : null },
  };
}

// ------------------------------------------------------------------ alertes

export interface Alert { kind: 'orphan' | 'late' | 'no_indicator' | 'missing_value' | 'kr_without_activity' | 'activity_without_kr'; label: string; detail: string; link: string; unitId?: string }

export const ALERT_LABEL: Record<Alert['kind'], string> = {
  orphan: 'Activités pays orphelines', late: 'Activités en retard', missing_value: 'Indicateurs non renseignés',
  no_indicator: 'KR sans indicateur', kr_without_activity: 'KR sans activité globale', activity_without_kr: 'Activités globales sans KR',
};

export function planAlerts(ws: Workspace, v: PlanView): Alert[] {
  const unitName = new Map(ws.units.map((u) => [u.id, u.name]));
  const out: Alert[] = [];
  for (const a of v.orphans) {
    out.push({ kind: 'orphan', label: `Activité orpheline, non liée au global · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: `/alignement?act=${a.id}`, unitId: a.unitId });
  }
  for (const a of v.activities) {
    const sc = v.activity.get(a.id)!;
    if (a.status === 'late' || sc.overdue) {
      out.push({ kind: 'late', label: `${a.status === 'late' ? 'En retard' : `Échéance Q${a.endQ} dépassée`} · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: `/activites?act=${a.id}`, unitId: a.unitId });
    }
    if (a.level === 'global' && !a.krId) out.push({ kind: 'activity_without_kr', label: `Activité globale sans KR · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: `/activites?act=${a.id}`, unitId: a.unitId });
  }
  for (const k of v.krs) {
    if (!(v.indByTarget.get(targetKey('kr', k.id)) ?? []).length) out.push({ kind: 'no_indicator', label: `${k.code} sans indicateur de mesure`, detail: k.title, link: `/plan?kr=${k.id}` });
    if (!(v.actsByKr.get(k.id) ?? []).length) out.push({ kind: 'kr_without_activity', label: `${k.code} sans activité globale`, detail: k.title, link: `/plan?kr=${k.id}` });
  }
  for (const i of v.indicators) {
    if (v.indicator.get(i.id)?.valueQuarter !== v.quarter) out.push({ kind: 'missing_value', label: `Indicateur non renseigné au Q${v.quarter}`, detail: i.name, link: `/indicateurs?ind=${i.id}` });
  }
  return out;
}
