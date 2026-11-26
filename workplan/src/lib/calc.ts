/**
 * Calculs d'un plan (purs, indexés, en temps linéaire).
 *
 * Avancement d'une activité = moyenne de [exécution, indicateurs de l'activité] (ce qui est disponible) :
 *   exécution : Non démarrée 0 (ou % saisi), En cours / En retard = % saisi, Réalisée 100, Annulée = exclue ;
 *   une activité jamais mise à jour n'a pas encore de donnée (exclue des moyennes, affichée en gris).
 * Activité globale consolidée = moyenne de [son avancement propre, moyenne des activités pays qui s'y rattachent].
 * KR = moyenne de [activités globales consolidées, indicateurs du KR].
 * Objectif = moyenne de [KR, indicateurs de l'objectif]. Plan = moyenne des objectifs.
 * Indicateur : dernière valeur (≤ trimestre) → (valeur − baseline) / (cible − baseline), borné 0–100 % ;
 *   Oui/Non : 0 ou 100 %. Fonctionne aussi pour une cible à la baisse.
 * RAG : Vert ≥ 70 %, Ambre ≥ 40 %, Rouge en dessous OU tâche en retard (statut « En retard » ou échéance dépassée).
 *
 * Alignement : une activité (KR) pays doit être soutenue par au moins une activité (KR) d'équipe globale
 * du même plan. Sinon elle est ORPHELINE (non liée au global). Une activité globale sans pays est normale.
 * Le statut de l'analyse (Aligned, Partial, Conflict, Gap, Global only) est conservé tel quel.
 */
import type { Activity, AlignStatus, Indicator, IndicatorValue, Quarter, Rag, Settings, Workspace } from '../types';
import { groupBy, mean } from './util';

export interface Score { progress: number | null; rag: Rag; late: boolean }
export interface IndicatorScore { value: number | null; valueQuarter: Quarter | null; progress: number | null; rag: Rag; quarterTarget: number | null; onTrack: boolean | null }
export interface ActivityScore extends Score { exec: number | null; indicators: number | null; children: number | null; overdue: boolean }

export interface PlanView {
  planId: string;
  quarter: Quarter;
  objectives: Workspace['objectives'];
  krs: Workspace['krs'];
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
  /** Liens valides d'une activité pays (activités globales du même plan). */
  parentsOf: Map<string, Activity[]>;
  /** Activités pays orphelines (aucune activité globale ne les soutient). */
  orphans: Activity[];
  alignment: {
    countryActs: number; linked: number; orphans: number; rate: number | null;
    country: Record<AlignStatus | 'none', number>; global: Record<AlignStatus | 'none', number>;
  };
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
  // jamais mise à jour : pas encore de donnée de suivi (gris), plutôt que 0 % (rouge)
  if (a.status === 'not_started' && !a.updatedAt && !a.progress) return null;
  switch (a.status) {
    case 'cancelled': return null;
    case 'done': return 100;
    default: return Math.max(0, Math.min(100, a.progress || 0));
  }
}

export const targetKey = (type: string, id: string) => `${type}:${id}`;

export function computePlan(ws: Workspace, planId: string, quarter: Quarter = ws.settings.currentQuarter, todayIso = new Date().toISOString().slice(0, 10)): PlanView {
  const s = ws.settings;
  const objectives = ws.objectives.filter((o) => o.planId === planId).sort((a, b) => a.order - b.order);
  const objOrder = new Map(objectives.map((o, n) => [o.id, n]));
  const krs = ws.krs.filter((k) => k.planId === planId)
    .sort((a, b) => (objOrder.get(a.objectiveId) ?? 99) - (objOrder.get(b.objectiveId) ?? 99) || a.order - b.order);
  const activities = ws.activities.filter((a) => a.planId === planId).sort((a, b) => a.order - b.order);
  const indicators = ws.indicators.filter((i) => i.planId === planId).sort((a, b) => a.order - b.order);
  const byId = new Map(activities.map((a) => [a.id, a]));
  const globalActs = activities.filter((a) => a.level === 'global');
  const countryActs = activities.filter((a) => a.level === 'country');
  // un lien n'est valide que vers une activité GLOBALE du même plan
  const parentsOf = new Map<string, Activity[]>();
  const childrenOf = new Map<string, Activity[]>();
  for (const c of countryActs) {
    const ps = (c.parentIds ?? []).map((id) => byId.get(id)).filter((p): p is Activity => !!p && p.level === 'global');
    parentsOf.set(c.id, ps);
    for (const p of ps) { const l = childrenOf.get(p.id); if (l) l.push(c); else childrenOf.set(p.id, [c]); }
  }
  const actsByKr = groupBy(globalActs, (a) => a.krId);
  const countryByKr = groupBy(countryActs, (a) => a.krId);
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
    // échéance dépassée : date d'échéance passée (ou trimestre de fin antérieur au trimestre choisi)
    const overdue = a.status !== 'done' && a.status !== 'cancelled' && (a.dueDate ? a.dueDate < todayIso : false || a.endQ < quarter);
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
    // KR = activités globales consolidées ; s'il n'y en a pas, activités pays rattachées au KR
    const src = (actsByKr.get(k.id) ?? []).length ? actsByKr.get(k.id)! : countryByKr.get(k.id) ?? [];
    const acts = src.map((a) => activity.get(a.id)!);
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
  const orphans = live.filter((a) => !(parentsOf.get(a.id) ?? []).length);
  const tally = (list: Activity[]) => {
    const t: Record<AlignStatus | 'none', number> = { aligned: 0, partial: 0, conflict: 0, gap: 0, global_only: 0, none: 0 };
    for (const a of list) t[a.alignment ?? 'none']++;
    return t;
  };

  return {
    planId, quarter, objectives, krs, activities, parentsOf, globalActs, countryActs, indicators,
    byId, childrenOf, actsByKr, actsByUnit, indByTarget, valuesByInd, indicator, activity, kr, objective, unit,
    plan: { progress: pp, rag: ragOf(pp, planLate, s), late: planLate },
    orphans,
    alignment: {
      countryActs: live.length, linked: live.length - orphans.length, orphans: orphans.length,
      rate: live.length ? ((live.length - orphans.length) / live.length) * 100 : null,
      country: tally(live), global: tally(globalActs.filter((a) => a.status !== 'cancelled')),
    },
  };
}

// ------------------------------------------------------------------ alertes

export interface Alert { kind: 'orphan' | 'conflict' | 'late' | 'no_indicator' | 'missing_value' | 'kr_without_activity' | 'activity_without_kr'; label: string; detail: string; link: string; unitId?: string }

export const ALERT_LABEL: Record<Alert['kind'], string> = {
  orphan: 'KR pays orphelins (sans appui global)', conflict: 'Conflits d’alignement', late: 'Activités en retard', missing_value: 'Indicateurs non renseignés',
  no_indicator: 'KR globaux sans indicateur', kr_without_activity: 'KR globaux sans plan', activity_without_kr: 'Activités sans KR global',
};

export function planAlerts(ws: Workspace, v: PlanView): Alert[] {
  const unitName = new Map(ws.units.map((u) => [u.id, u.name]));
  const out: Alert[] = [];
  for (const a of v.orphans) {
    out.push({ kind: 'orphan', label: `Orphelin, non lié au global · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: `/alignement?act=${a.id}`, unitId: a.unitId });
  }
  for (const a of v.activities.filter((x) => x.alignment === 'conflict')) {
    out.push({ kind: 'conflict', label: `Conflit · ${unitName.get(a.unitId) ?? ''} · ${v.krs.find((k) => k.id === a.krId)?.code ?? ''}`, detail: a.finding || a.title, link: `/alignement?act=${a.id}`, unitId: a.unitId });
  }
  for (const a of v.activities) {
    const sc = v.activity.get(a.id)!;
    if (a.status === 'late' || sc.overdue) {
      out.push({ kind: 'late', label: `${a.status === 'late' ? 'En retard' : `Échéance dépassée`} · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: '/taches', unitId: a.unitId });
    }
    if (!a.krId) out.push({ kind: 'activity_without_kr', label: `Activité globale sans KR · ${unitName.get(a.unitId) ?? ''}`, detail: a.title, link: '/taches', unitId: a.unitId });
  }
  for (const k of v.krs.filter((x) => !x.team)) {
    if (!(v.indByTarget.get(targetKey('kr', k.id)) ?? []).length) out.push({ kind: 'no_indicator', label: `${k.code} sans indicateur de mesure`, detail: k.title, link: '/taches' });
    if (!(v.actsByKr.get(k.id) ?? []).length && !v.countryActs.some((a) => a.krId === k.id)) out.push({ kind: 'kr_without_activity', label: `${k.code} sans KR d’équipe ni de pays`, detail: k.title, link: '/taches' });
  }
  for (const i of v.indicators) {
    if (v.indicator.get(i.id)?.valueQuarter !== v.quarter) out.push({ kind: 'missing_value', label: `Indicateur non renseigné au Q${v.quarter}`, detail: i.name, link: `/indicateurs?ind=${i.id}` });
  }
  return out;
}
