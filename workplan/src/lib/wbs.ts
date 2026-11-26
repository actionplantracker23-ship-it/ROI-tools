/**
 * Structure de découpage du projet (WBS) : 1 objectif → 1.1 projet (KR global) → 1.1.1 tâches.
 * Les tâches des équipes globales précèdent celles des pays ; une tâche pays dépend des tâches globales
 * qui la soutiennent (dépendances = numéros WBS).
 */
import type { PlanView } from './calc';
import type { Activity, KeyResult, Objective, Workspace } from '../types';

export interface WbsRow {
  kind: 'objective' | 'project' | 'task';
  wbs: string;
  depth: number;
  objective: Objective;
  kr?: KeyResult;
  task?: Activity;
  start: string;
  due: string;
}

export interface TaskFilter { q: string; unit: string; owner: string; status: string; priority: string; overdue: boolean; orphans: boolean }
export const EMPTY_FILTER: TaskFilter = { q: '', unit: '', owner: '', status: '', priority: '', overdue: false, orphans: false };

export function matches(t: Activity, f: TaskFilter, v: PlanView, todayIso: string): boolean {
  if (f.unit && t.unitId !== f.unit) return false;
  if (f.owner && t.owner !== f.owner) return false;
  if (f.status && t.status !== f.status) return false;
  if (f.priority && t.priority !== f.priority) return false;
  if (f.overdue && !(t.dueDate < todayIso && t.status !== 'done' && t.status !== 'cancelled') && t.status !== 'late') return false;
  if (f.orphans && !(t.level === 'country' && !(v.parentsOf.get(t.id) ?? []).length)) return false;
  if (f.q) {
    const q = f.q.toLowerCase();
    if (![t.title, t.owner, t.unitObjective, t.comment, t.code].some((x) => x?.toLowerCase().includes(q))) return false;
  }
  return true;
}

const min = (a: string[]) => a.filter(Boolean).sort()[0] ?? '';
const max = (a: string[]) => a.filter(Boolean).sort().at(-1) ?? '';

/** Lignes WBS du plan (les objectifs et projets sans tâche visible sont omis quand un filtre est actif). */
export function buildWbs(ws: Workspace, v: PlanView, keep: (t: Activity) => boolean, filtered: boolean): { rows: WbsRow[]; wbsOf: Map<string, string> } {
  const rows: WbsRow[] = [];
  const wbsOf = new Map<string, string>();
  const unitOrder = new Map(ws.units.map((u) => [u.id, u.order]));
  v.objectives.forEach((o, oi) => {
    const oCode = `${oi + 1}`;
    const objRows: WbsRow[] = [];
    v.krs.filter((k) => k.objectiveId === o.id).forEach((k, ki) => {
      const pCode = `${oCode}.${ki + 1}`;
      const tasks = v.activities.filter((a) => a.krId === k.id)
        .sort((a, b) => (a.level === b.level ? 0 : a.level === 'global' ? -1 : 1) || (unitOrder.get(a.unitId) ?? 0) - (unitOrder.get(b.unitId) ?? 0) || a.order - b.order);
      tasks.forEach((t, ti) => wbsOf.set(t.id, `${pCode}.${ti + 1}`));
      const shown = tasks.filter(keep);
      if (filtered && !shown.length) return;
      objRows.push({ kind: 'project', wbs: pCode, depth: 1, objective: o, kr: k, start: min(tasks.map((t) => t.startDate)), due: max(tasks.map((t) => t.dueDate)) });
      for (const t of shown) objRows.push({ kind: 'task', wbs: wbsOf.get(t.id)!, depth: 2, objective: o, kr: k, task: t, start: t.startDate, due: t.dueDate });
    });
    if (filtered && !objRows.length) return;
    const projs = objRows.filter((r) => r.kind === 'project');
    rows.push({ kind: 'objective', wbs: oCode, depth: 0, objective: o, start: min(projs.map((r) => r.start)), due: max(projs.map((r) => r.due)) }, ...objRows);
  });
  // tâches sans projet (KR)
  const loose = v.activities.filter((a) => !a.krId || !v.krs.some((k) => k.id === a.krId));
  loose.forEach((t, i) => wbsOf.set(t.id, `0.${i + 1}`));
  return { rows, wbsOf };
}

export const owners = (v: PlanView) => [...new Set(v.activities.map((a) => a.owner).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
