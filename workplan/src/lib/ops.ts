/**
 * Opérations (pures) sur l'espace de travail. Chaque fonction renvoie un nouvel objet Workspace.
 */
import type {
  Activity, ActivityStatus, AlignStatus, Indicator, Issue, IndicatorValue, KeyResult, Objective, Plan, Quarter, Unit, Workspace,
} from '../types';
import { OBJECTIVE_COLORS } from '../types';
import { latestValue } from './calc';
import { addYears, iso, quarterOf } from './dates';
import { similarity, uid } from './util';

type Coll = 'objectives' | 'krs' | 'activities' | 'indicators' | 'units' | 'issues';
type Item<C extends Coll> = Workspace[C][number];

/** Ajoute ou remplace un élément (par id). */
export function upsert<C extends Coll>(ws: Workspace, coll: C, item: Item<C>): Workspace {
  const list = ws[coll] as Item<C>[];
  const exists = list.some((x) => x.id === item.id);
  return { ...ws, [coll]: exists ? list.map((x) => (x.id === item.id ? item : x)) : [...list, item] };
}

// ------------------------------------------------------------------ plans

export interface NewPlanOptions {
  year: number;
  name?: string;
  sourcePlanId?: string | null; // null = plan vierge
  copyActivities?: boolean; // activités globales et pays (avec leurs liens)
  copyIndicators?: boolean;
  carryBaselines?: boolean; // baseline = dernière valeur mesurée l'année précédente
}

export function createPlan(ws: Workspace, o: NewPlanOptions): { ws: Workspace; planId: string } {
  const planId = uid('plan-');
  const plan: Plan = {
    id: planId, year: o.year, name: o.name || `Plan de travail ${o.year}`, status: 'draft',
    createdAt: new Date().toISOString(), sourcePlanId: o.sourcePlanId ?? null, notes: '',
  };
  let next: Workspace = { ...ws, plans: [...ws.plans, plan], currentPlanId: planId };
  if (!o.sourcePlanId) return { ws: next, planId };

  // reprise de la structure : nouveaux identifiants, liens remappés, statuts et valeurs remis à zéro
  const src = o.sourcePlanId;
  const srcYear = ws.plans.find((p) => p.id === src)?.year ?? o.year - 1;
  const shift = (d: string) => (d ? addYears(d, o.year - srcYear) : d); // mêmes échéances, l'année suivante
  const map = new Map<string, string>();
  const nid = (old: string, p: string) => { const n = uid(p); map.set(old, n); return n; };
  const objectives = ws.objectives.filter((x) => x.planId === src).map((x) => ({ ...x, id: nid(x.id, 'o-'), planId }));
  const krs = ws.krs.filter((x) => x.planId === src).map((x) => ({ ...x, id: nid(x.id, 'kr-'), planId, objectiveId: map.get(x.objectiveId)! }));
  let activities: Activity[] = [];
  if (o.copyActivities) {
    const srcActs = ws.activities.filter((x) => x.planId === src);
    for (const a of srcActs) nid(a.id, 'a-');
    activities = srcActs.map((a) => ({
      ...a, id: map.get(a.id)!, planId, krId: a.krId ? map.get(a.krId) ?? null : null,
      parentIds: (a.parentIds ?? []).map((p) => map.get(p)).filter((p): p is string => !!p),
      startDate: shift(a.startDate), dueDate: shift(a.dueDate),
      status: 'not_started' as ActivityStatus, progress: 0, comment: '', updatedAt: null, updatedBy: null,
    }));
  }
  let indicators: Indicator[] = [];
  if (o.copyIndicators) {
    const valuesBy = new Map<string, IndicatorValue[]>();
    for (const v of ws.indicatorValues) { const l = valuesBy.get(v.indicatorId); if (l) l.push(v); else valuesBy.set(v.indicatorId, [v]); }
    indicators = ws.indicators.filter((i) => i.planId === src && map.has(i.targetId)).map((i) => {
      const last = o.carryBaselines ? latestValue(valuesBy.get(i.id), 4) : null;
      return { ...i, id: uid('i-'), planId, targetId: map.get(i.targetId)!, baseline: last?.value ?? i.baseline };
    });
  }
  next = {
    ...next,
    objectives: [...next.objectives, ...objectives], krs: [...next.krs, ...krs], activities: [...next.activities, ...activities],
    indicators: [...next.indicators, ...indicators],
  };
  return { ws: next, planId };
}

export function updatePlan(ws: Workspace, plan: Plan): Workspace {
  return { ...ws, plans: ws.plans.map((p) => (p.id === plan.id ? plan : p)) };
}

export function deletePlan(ws: Workspace, planId: string): Workspace {
  const actIds = new Set(ws.activities.filter((a) => a.planId === planId).map((a) => a.id));
  const indIds = new Set(ws.indicators.filter((i) => i.planId === planId).map((i) => i.id));
  const plans = ws.plans.filter((p) => p.id !== planId);
  return {
    ...ws, plans,
    currentPlanId: ws.currentPlanId === planId ? plans.sort((a, b) => b.year - a.year)[0]?.id ?? null : ws.currentPlanId,
    objectives: ws.objectives.filter((x) => x.planId !== planId), krs: ws.krs.filter((x) => x.planId !== planId),
    activities: ws.activities.filter((x) => x.planId !== planId),
    activityUpdates: ws.activityUpdates.filter((u) => !actIds.has(u.activityId)),
    issues: ws.issues.filter((x) => x.planId !== planId),
    indicators: ws.indicators.filter((x) => x.planId !== planId), indicatorValues: ws.indicatorValues.filter((v) => !indIds.has(v.indicatorId)),
  };
}

// ------------------------------------------------------------------ structure

export function newObjective(ws: Workspace, planId: string, title: string): Objective {
  const n = ws.objectives.filter((o) => o.planId === planId).length;
  return { id: uid('o-'), planId, code: String(n + 1), title, color: OBJECTIVE_COLORS[n % OBJECTIVE_COLORS.length], order: n };
}

export function newKr(ws: Workspace, planId: string, objective: Objective, title: string): KeyResult {
  const n = ws.krs.filter((k) => k.objectiveId === objective.id).length;
  return { id: uid('kr-'), planId, objectiveId: objective.id, code: `KR${objective.code}.${n + 1}`, title, order: n };
}

export function newActivity(ws: Workspace, base: Pick<Activity, 'planId' | 'level' | 'unitId'> & Partial<Activity>): Activity {
  const n = ws.activities.filter((a) => a.planId === base.planId && a.unitId === base.unitId).length;
  const y = ws.plans.find((p) => p.id === base.planId)?.year ?? new Date().getFullYear();
  return {
    startDate: iso(y, 1, 1), dueDate: iso(y, 12, 31), milestone: false, priority: 'medium',
    krId: null, parentIds: [], alignment: null, finding: '', action: '', role: null, unitObjective: '', subTeam: '', scope: '',
    code: '', title: '', owner: '', startQ: 1, endQ: 4, status: 'not_started', progress: 0,
    budget: null, comment: '', order: n, updatedAt: null, updatedBy: null, id: uid('a-'), ...base,
  };
}

export function newIndicator(ws: Workspace, planId: string, targetType: Indicator['targetType'], targetId: string): Indicator {
  const n = ws.indicators.filter((i) => i.targetId === targetId).length;
  return { id: uid('i-'), planId, targetType, targetId, name: '', kind: 'number', unit: '', baseline: null, quarterTargets: [null, null, null, null], target: null, source: '', order: n };
}

/** Suppression en cascade raisonnable : les activités pays d'une activité globale supprimée deviennent orphelines. */
export function remove(ws: Workspace, coll: Coll, id: string): Workspace {
  let next: Workspace = { ...ws, [coll]: (ws[coll] as { id: string }[]).filter((x) => x.id !== id) };
  if (coll === 'objectives') {
    for (const k of ws.krs.filter((x) => x.objectiveId === id)) next = remove(next, 'krs', k.id);
  }
  if (coll === 'krs') {
    next = { ...next, activities: next.activities.map((a) => (a.krId === id ? { ...a, krId: null } : a)) };
  }
  if (coll === 'activities') {
    next = { ...next, issues: next.issues.map((i) => (i.activityId === id ? { ...i, activityId: null } : i)), activities: next.activities.map((a) => ((a.parentIds ?? []).includes(id) ? { ...a, parentIds: a.parentIds.filter((p) => p !== id) } : a)), activityUpdates: next.activityUpdates.filter((u) => u.activityId !== id) };
  }
  if (coll === 'units') {
    for (const a of ws.activities.filter((x) => x.unitId === id)) next = remove(next, 'activities', a.id);
  }
  if (coll !== 'indicators' && coll !== 'units') {
    const gone = new Set(next.indicators.filter((i) => i.targetId === id).map((i) => i.id));
    next = { ...next, indicators: next.indicators.filter((i) => !gone.has(i.id)), indicatorValues: next.indicatorValues.filter((v) => !gone.has(v.indicatorId)) };
  }
  if (coll === 'indicators') next = { ...next, indicatorValues: next.indicatorValues.filter((v) => v.indicatorId !== id) };
  return next;
}

// ------------------------------------------------------------------ suivi

export function updateActivityStatus(ws: Workspace, activityId: string, patch: { status: ActivityStatus; progress: number; comment: string }): Workspace {
  const at = new Date().toISOString();
  const by = ws.settings.userName || 'Utilisateur';
  const progress = patch.status === 'done' ? 100 : Math.max(0, Math.min(100, patch.progress));
  return {
    ...ws,
    activities: ws.activities.map((a) => (a.id === activityId ? { ...a, status: patch.status, progress, comment: patch.comment, updatedAt: at, updatedBy: by } : a)),
    activityUpdates: [...ws.activityUpdates, { id: uid('u-'), activityId, status: patch.status, progress, comment: patch.comment, at, by }],
  };
}

export function addIndicatorValue(ws: Workspace, indicatorId: string, quarter: Quarter, value: number | null, comment = '', evidenceUrl = ''): Workspace {
  const v: IndicatorValue = { id: uid('v-'), indicatorId, quarter, value, comment, evidenceUrl, at: new Date().toISOString(), by: ws.settings.userName || 'Utilisateur' };
  return { ...ws, indicatorValues: [...ws.indicatorValues, v] };
}

/** Ajoute un lien activité pays → activité globale (statut facultatif). */
export function addLink(ws: Workspace, countryActId: string, parentId: string, alignment?: AlignStatus): Workspace {
  return {
    ...ws,
    activities: ws.activities.map((a) => (a.id === countryActId
      ? { ...a, parentIds: [...new Set([...(a.parentIds ?? []), parentId])], alignment: alignment ?? a.alignment }
      : a)),
  };
}

/** Propositions de rattachement d'une activité pays : activités globales du plan classées par proximité du texte. */
export function suggestParents(ws: Workspace, act: Activity, limit = 5): { a: Activity; score: number }[] {
  return ws.activities
    .filter((g) => g.planId === act.planId && g.level === 'global' && !(act.parentIds ?? []).includes(g.id))
    .map((g) => ({ a: g, score: similarity(g.title + ' ' + g.unitObjective, act.title + ' ' + act.unitObjective) + (act.krId && g.krId === act.krId ? 0.4 : 0) }))
    .filter((x) => x.score > 0.1)
    .sort((x, y) => y.score - x.score)
    .slice(0, limit);
}

export function addUnit(ws: Workspace, name: string, type: Unit['type'], group?: string): Workspace {
  const u: Unit = { id: uid('u-'), name, type, group, order: ws.units.length };
  return { ...ws, units: [...ws.units, u] };
}

/** Modifie les dates d'une tâche et recalcule ses trimestres de début et de fin. */
export function withDates<T extends Activity>(a: T, startDate: string, dueDate: string): T {
  const s = startDate || dueDate;
  const d = dueDate || startDate;
  return { ...a, startDate: s, dueDate: d, startQ: s ? quarterOf(s) : a.startQ, endQ: d ? quarterOf(d) : a.endQ };
}

export function newIssue(planId: string, base: Partial<Issue> = {}): Issue {
  return { id: uid('r-'), planId, activityId: null, kind: 'issue', title: '', action: '', owner: '', dueDate: '', status: 'open', source: 'Saisie', createdAt: new Date().toISOString(), ...base };
}
