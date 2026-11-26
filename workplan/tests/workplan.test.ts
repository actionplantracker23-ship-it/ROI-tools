import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { computePlan, planAlerts } from '../src/lib/calc';
import { importOkr, parseUnitLabel, readOkrWorkbook } from '../src/lib/importer';
import { addIndicatorValue, addLink, createPlan, remove, suggestParents, updateActivityStatus, upsert } from '../src/lib/ops';
import { emptyWorkspace, type Workspace } from '../src/types';
import { workbook } from './fixture';

function imported(): { ws: Workspace; planId: string; report: ReturnType<typeof importOkr>['report'] } {
  const { ws: w0, planId } = createPlan(emptyWorkspace(), { year: 2027 });
  const { ws, report } = importOkr(w0, planId, readOkrWorkbook(workbook()), { replace: true });
  return { ws, planId, report };
}
const byTitle = (ws: Workspace, t: string) => ws.activities.find((a) => a.title === t)!;

describe('lecture du classeur OKR', () => {
  const f = readOkrWorkbook(workbook());
  it('reconnaît le registre et les deux parties de l’analyse', () => {
    expect([f.registerSheet, f.alignmentSheet]).toEqual(['OR register', 'alignement du OKR']);
    expect(f.objectives.get(1)).toBe('Objective one title');
    expect(f.a).toHaveLength(3);
    expect(f.b).toHaveLength(3);
    expect(f.a[2].teams).toEqual([]); // « — none — »
    expect(f.noPlan).toEqual(['KR2.1 (CEO)']);
  });
  it('libellés d’unités', () => {
    expect(parseUnitLabel('Global Programs (PEI)')).toEqual({ name: 'PEI', group: 'Global Programs', sub: '' });
    expect(parseUnitLabel('Kenya (Finance & Admin)')).toEqual({ name: 'Kenya', sub: 'Finance & Admin' });
  });
});

describe('import', () => {
  const { ws, planId, report } = imported();
  const v = computePlan(ws, planId, 1);
  it('crée objectifs, Ref (dont Team KR), KR d’équipes globales et de pays', () => {
    expect(v.objectives.map((o) => o.title)).toEqual(['Objective one title', 'Objective two title']);
    expect(v.krs.map((k) => k.code)).toEqual(['KR1.1', 'KR1.2', 'Team KR · O1', 'KR2.1']);
    expect(v.krs.find((k) => k.code === 'KR1.1')?.title).toBe('Global KR one');
    expect(v.krs.find((k) => k.code === 'Team KR · O1')?.team).toBe(true);
    expect([report.globalActivities, report.countryActivities]).toEqual([3, 3]);
    const kf = byTitle(ws, 'Kenya finance KR');
    expect([kf.unitId, kf.subTeam, kf.role]).toEqual(['kenya', 'Finance & Admin', 'Contributes']);
    expect(byTitle(ws, 'PEI team KR').role).toBeNull();
  });
  it('liens multiples, statuts, constats et actions de l’analyse', () => {
    const k = byTitle(ws, 'Kenya KR a');
    expect(v.parentsOf.get(k.id)!.map((p) => p.unitId).sort()).toEqual(['dhgp', 'pei']);
    expect([k.alignment, k.finding, k.action]).toEqual(['aligned', 'Supported', 'None']);
    expect(v.parentsOf.get(byTitle(ws, 'Kenya finance KR').id)!.map((p) => p.unitId)).toEqual(['dhgp']);
    expect(byTitle(ws, 'DHGP KR a').alignment).toBe('conflict');
    expect(byTitle(ws, 'PEI team KR').alignment).toBe('global_only');
    expect(report.unmatched).toEqual([]);
  });
  it('KR pays sans équipe globale = orphelin ; KR global sans pays = normal', () => {
    expect(v.orphans.map((a) => a.title)).toEqual(['Burkina KR orphan']);
    expect(v.alignment.country).toMatchObject({ aligned: 1, partial: 1, gap: 1 });
    expect(v.alignment.global).toMatchObject({ aligned: 1, conflict: 1, global_only: 1 });
    expect(planAlerts(ws, v).filter((a) => a.kind === 'orphan')).toHaveLength(1);
    expect(planAlerts(ws, v).filter((a) => a.kind === 'conflict')).toHaveLength(1);
  });
  it('rattacher un orphelin', () => {
    const o = v.orphans[0];
    expect(suggestParents(ws, o).length).toBeGreaterThan(0);
    expect(computePlan(addLink(ws, o.id, v.globalActs[0].id), planId, 1).orphans).toHaveLength(0);
  });
  it('réimport : met à jour sans perdre le suivi', () => {
    const k = byTitle(ws, 'Kenya KR a');
    const tracked = updateActivityStatus(ws, k.id, { status: 'in_progress', progress: 40, comment: 'suivi' });
    const again = importOkr(tracked, planId, readOkrWorkbook(workbook()), { replace: false });
    const k2 = again.ws.activities.find((a) => a.id === k.id)!;
    expect([k2.status, k2.progress, k2.alignment]).toEqual(['in_progress', 40, 'aligned']);
    expect(again.report.updated).toBe(6);
    expect(again.ws.activities.filter((a) => a.planId === planId)).toHaveLength(6);
  });
});

describe('consolidation, indicateurs, plans annuels', () => {
  it('pays → équipe globale → KR → objectif', () => {
    let { ws, planId } = imported();
    const pei = byTitle(ws, 'PEI KR a');
    ws = updateActivityStatus(ws, pei.id, { status: 'in_progress', progress: 40, comment: '' });
    ws = updateActivityStatus(ws, byTitle(ws, 'Kenya KR a').id, { status: 'done', progress: 0, comment: '' });
    const v = computePlan(ws, planId, 1);
    expect(v.activity.get(pei.id)!.children).toBe(100);
    expect(v.activity.get(pei.id)!.progress).toBe(70);
    const ind = { id: 'i1', planId, targetType: 'kr' as const, targetId: v.krs[0].id, name: 'x', kind: 'percent' as const, unit: '%', baseline: 10, quarterTargets: [20, null, null, 50], target: 50, source: '', order: 0 };
    ws = addIndicatorValue(upsert(ws, 'indicators', ind), 'i1', 1, 30);
    expect(computePlan(ws, planId, 1).indicator.get('i1')).toMatchObject({ progress: 50, onTrack: true });
  });
  it('plan de l’année suivante : même structure, liens remappés, suivi remis à zéro', () => {
    let { ws, planId } = imported();
    ws = updateActivityStatus(ws, byTitle(ws, 'Kenya KR a').id, { status: 'done', progress: 100, comment: '' });
    const r = createPlan(ws, { year: 2028, sourcePlanId: planId, copyActivities: true, copyIndicators: true });
    const n = computePlan(r.ws, r.planId, 1);
    expect([n.objectives.length, n.krs.length, n.globalActs.length, n.countryActs.length, n.orphans.length]).toEqual([2, 4, 3, 3, 1]);
    expect(n.countryActs.every((a) => a.status === 'not_started')).toBe(true);
    expect(n.countryActs.flatMap((a) => a.parentIds).every((id) => n.byId.get(id)?.planId === r.planId)).toBe(true);
  });
  it('supprimer un KR d’équipe globale retire le lien', () => {
    const { ws, planId } = imported();
    const v = computePlan(remove(remove(ws, 'activities', byTitle(ws, 'DHGP KR a').id), 'activities', byTitle(ws, 'PEI KR a').id), planId, 1);
    expect(v.orphans).toHaveLength(3);
  });
  it('performance : 3 000 KR / activités en moins de 100 ms', () => {
    let { ws, planId } = imported();
    const g = computePlan(ws, planId, 1).globalActs[0];
    const acts = Array.from({ length: 3000 }, (_, n) => ({ ...g, id: `p${n}`, level: 'country' as const, unitId: 'kenya', parentIds: n % 3 ? [g.id] : [] }));
    ws = { ...ws, activities: [...ws.activities, ...acts] };
    const t = performance.now();
    planAlerts(ws, computePlan(ws, planId, 2));
    expect(performance.now() - t).toBeLessThan(100);
  });
});

// Contrôle sur le vrai fichier, en local uniquement (jamais versionné) : OKR_XLSX=/chemin/fichier.xlsx npm test
const REAL = process.env.OKR_XLSX;
describe.skipIf(!REAL || !existsSync(REAL ?? ''))('fichier OKR réel (local)', () => {
  it('reproduit la synthèse de l’analyse d’alignement', () => {
    const { ws: w0, planId } = createPlan(emptyWorkspace(), { year: 2027 });
    const { ws, report } = importOkr(w0, planId, readOkrWorkbook(XLSX.read(readFileSync(REAL!))), { replace: true });
    const v = computePlan(ws, planId, 1);
    expect(report.unmatched).toEqual([]);
    expect(v.countryActs).toHaveLength(48);
    expect(v.globalActs).toHaveLength(52);
    expect(v.alignment.country).toMatchObject({ aligned: 16, partial: 10, conflict: 5, gap: 17 });
    expect(v.alignment.global).toMatchObject({ aligned: 17, partial: 5, conflict: 6, gap: 10, global_only: 14 });
    expect(v.orphans).toHaveLength(4);
  });
});
