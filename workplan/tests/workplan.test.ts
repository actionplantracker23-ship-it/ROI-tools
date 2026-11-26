import { describe, expect, it } from 'vitest';
import { computePlan, planAlerts } from '../src/lib/calc';
import { countryColumns, guessMapping, readWorkbook, ALIGN_FIELDS, REGISTER_FIELDS, runImport } from '../src/lib/importer';
import { addIndicatorValue, createPlan, linkActivity, remove, suggestParents, updateActivityStatus, upsert } from '../src/lib/ops';
import { emptyWorkspace, type Workspace } from '../src/types';
import { alignmentWide, workbook } from './fixture';

function imported(wide = false): { ws: Workspace; planId: string; report: ReturnType<typeof runImport>['report'] } {
  const { ws: w0, planId } = createPlan(emptyWorkspace(), { year: 2027 });
  const sheets = readWorkbook(wide ? workbook(alignmentWide()) : workbook());
  const reg = sheets.find((s) => s.guess === 'register')!;
  const al = sheets.find((s) => s.guess === 'alignment')!;
  const cc = countryColumns(al.headers, w0.units).map((c) => ({ col: c.col, unitId: c.unit!.id }));
  const { ws, report } = runImport(w0, {
    planId, replace: false,
    register: { sheet: reg, mapping: guessMapping(reg.headers, REGISTER_FIELDS) },
    alignment: { sheet: al, mapping: guessMapping(al.headers, ALIGN_FIELDS), wide, countryCols: wide ? cc : [] },
  });
  return { ws, planId, report };
}

describe('lecture du classeur', () => {
  it('reconnaît les deux feuilles et leurs colonnes', () => {
    const sheets = readWorkbook(workbook());
    expect(sheets.map((s) => s.guess)).toEqual(['register', 'alignment']);
    const al = sheets[1];
    expect(al.headerRow).toBe(1);
    const m = guessMapping(al.headers, ALIGN_FIELDS);
    expect([m.ref, m.globalUnit, m.globalActivity, m.country, m.countryActivity, m.alignment, m.comment]).toEqual([0, 1, 2, 3, 4, 5, 6]);
    const r = guessMapping(sheets[0].headers, REGISTER_FIELDS);
    expect([r.ref, r.unit, r.role, r.unitKr, r.planRef]).toEqual([0, 2, 3, 5, 8]);
  });
});

describe('import registre + alignement (format long)', () => {
  const { ws, planId, report } = imported();
  const v = computePlan(ws, planId, 1);

  it('crée objectifs (titres des sections), KR et engagements', () => {
    expect(v.objectives.map((o) => o.title.slice(0, 26))).toEqual(['Embed and scale high perfo', 'Second test objective']);
    expect(v.krs.map((k) => k.code)).toEqual(['KR1.1', 'KR1.2', 'KR2.1']);
    expect(v.commitments).toHaveLength(5);
    expect(v.commitments.find((c) => c.unitId === 'dhgp')?.role).toBe('Lead');
    expect(v.commitments.find((c) => c.unitId === 'kenya')?.planRef).toBe('2 Kenya');
  });

  it('crée les activités globales et pays, avec les liens', () => {
    expect(report.globalActivities).toBe(3);
    expect(report.countryActivities).toBe(4);
    const g = v.globalActs.find((a) => a.title === 'Deploy eCHIS training package')!;
    expect(g.unitId).toBe('dhgp');
    expect(v.childrenOf.get(g.id)!.map((c) => c.unitId).sort()).toEqual(['burkina-faso', 'kenya']); // cellule fusionnée
    expect(v.countryActs.find((a) => a.unitId === 'burkina-faso')!.alignment).toBe('partial');
  });

  it('signale l’activité pays sans activité globale comme orpheline', () => {
    expect(v.orphans.map((a) => a.title)).toEqual(['Kenya-only data dashboard']);
    expect(v.alignment).toMatchObject({ countryActs: 4, aligned: 3, partial: 1, orphans: 1, rate: 75 });
    expect(planAlerts(ws, v).filter((a) => a.kind === 'orphan')).toHaveLength(1);
  });

  it('une activité globale sans pays est normale (pas d’alerte orpheline)', () => {
    const g = v.globalActs.find((a) => a.title === 'Smart supervision rollout')!;
    expect(v.childrenOf.get(g.id)).toBeUndefined();
  });

  it('rattacher une orpheline la retire de la liste', () => {
    const o = v.orphans[0];
    const sugg = suggestParents(ws, o);
    expect(sugg.length).toBeGreaterThan(0);
    const ws2 = linkActivity(ws, o.id, v.globalActs[0].id, 'partial');
    expect(computePlan(ws2, planId, 1).orphans).toHaveLength(0);
  });

  it('réimport sans « remplacer » : pas de doublon', () => {
    const sheets = readWorkbook(workbook());
    const again = runImport(ws, { planId, replace: false, alignment: { sheet: sheets[1], mapping: guessMapping(sheets[1].headers, ALIGN_FIELDS), wide: false, countryCols: [] } });
    expect(again.report.globalActivities + again.report.countryActivities).toBe(0);
  });
});

describe('import alignement (format large : une colonne par pays)', () => {
  const { ws, planId } = imported(true);
  const v = computePlan(ws, planId, 1);
  it('une colonne par pays, plusieurs activités par cellule, N/A ignoré', () => {
    expect(v.countryActs.map((a) => a.title).sort()).toEqual(['Former les ASC', 'Suivi mensuel eCHIS', 'Train CHAs on eCHIS']);
    expect(v.orphans).toHaveLength(0);
  });
});

describe('consolidation et indicateurs', () => {
  it('pays → activité globale → KR → objectif → plan', () => {
    let { ws, planId } = imported();
    let v = computePlan(ws, planId, 1);
    const g = v.globalActs.find((a) => a.title === 'Deploy eCHIS training package')!;
    const [k1, k2] = v.childrenOf.get(g.id)!;
    ws = updateActivityStatus(ws, g.id, { status: 'in_progress', progress: 40, comment: '' });
    ws = updateActivityStatus(ws, k1.id, { status: 'done', progress: 0, comment: 'ok' });
    ws = updateActivityStatus(ws, k2.id, { status: 'in_progress', progress: 60, comment: '' });
    v = computePlan(ws, planId, 1);
    expect(v.activity.get(g.id)!.children).toBe(80);
    expect(v.activity.get(g.id)!.progress).toBe(60); // moyenne(40, 80)
    expect(ws.activityUpdates).toHaveLength(3);
    // indicateur de KR : baseline 10, cible 50, valeur 30 → 50 %
    const kr = v.krs[0];
    const ind = { id: 'i1', planId, targetType: 'kr' as const, targetId: kr.id, name: '% CHAs', kind: 'percent' as const, unit: '%', baseline: 10, quarterTargets: [20, 30, 40, 50], target: 50, source: '', order: 0 };
    ws = upsert(ws, 'indicators', ind);
    ws = addIndicatorValue(ws, 'i1', 1, 30);
    v = computePlan(ws, planId, 1);
    expect(v.indicator.get('i1')).toMatchObject({ progress: 50, onTrack: true, quarterTarget: 20 });
    expect(v.plan.progress).not.toBeNull();
  });

  it('échéance dépassée → en retard', () => {
    const { ws, planId } = imported();
    const a = computePlan(ws, planId, 1).globalActs[0];
    const ws2 = upsert(ws, 'activities', { ...a, endQ: 1 });
    expect(computePlan(ws2, planId, 2).activity.get(a.id)!.rag).toBe('red');
  });
});

describe('plans annuels', () => {
  it('nouveau plan à partir de l’année précédente : même structure, liens remappés, suivi remis à zéro', () => {
    let { ws, planId } = imported();
    const v = computePlan(ws, planId, 1);
    ws = updateActivityStatus(ws, v.countryActs[0].id, { status: 'done', progress: 100, comment: '' });
    ws = upsert(ws, 'indicators', { id: 'i1', planId, targetType: 'kr', targetId: v.krs[0].id, name: 'x', kind: 'number', unit: '', baseline: 5, quarterTargets: [null, null, null, null], target: 20, source: '', order: 0 });
    ws = addIndicatorValue(ws, 'i1', 4, 17);
    const r = createPlan(ws, { year: 2028, sourcePlanId: planId, copyActivities: true, copyIndicators: true, copyCommitments: true, carryBaselines: true });
    const n = computePlan(r.ws, r.planId, 1);
    expect(n.objectives).toHaveLength(2);
    expect(n.krs).toHaveLength(3);
    expect(n.globalActs).toHaveLength(3);
    expect(n.orphans).toHaveLength(1); // l'orpheline reste orpheline
    expect(n.countryActs.every((a) => a.status === 'not_started')).toBe(true);
    expect(n.countryActs.filter((a) => a.parentId).every((a) => n.byId.get(a.parentId!)?.planId === r.planId)).toBe(true);
    expect(n.indicators[0].baseline).toBe(17);
    expect(r.ws.plans.map((p) => p.year)).toEqual([2027, 2028]);
    // l'ancien plan est intact
    expect(computePlan(r.ws, planId, 1).countryActs.some((a) => a.status === 'done')).toBe(true);
  });

  it('supprimer une activité globale rend ses activités pays orphelines', () => {
    const { ws, planId } = imported();
    const v = computePlan(ws, planId, 1);
    const g = v.globalActs.find((a) => a.title === 'Deploy eCHIS training package')!;
    expect(computePlan(remove(ws, 'activities', g.id), planId, 1).orphans).toHaveLength(3);
  });

  it('performance : 3 000 activités et 2 000 indicateurs en moins de 100 ms', () => {
    let { ws, planId } = imported();
    const g = computePlan(ws, planId, 1).globalActs[0];
    const acts = Array.from({ length: 3000 }, (_, n) => ({ ...g, id: `p${n}`, level: 'country' as const, unitId: 'kenya', parentId: n % 3 ? g.id : null }));
    const inds = Array.from({ length: 2000 }, (_, n) => ({ id: `pi${n}`, planId, targetType: 'activity' as const, targetId: `p${n}`, name: 'x', kind: 'number' as const, unit: '', baseline: 0, quarterTargets: [null, null, null, null], target: 10, source: '', order: 0 }));
    ws = { ...ws, activities: [...ws.activities, ...acts], indicators: [...ws.indicators, ...inds] };
    const t = performance.now();
    const v = computePlan(ws, planId, 2);
    planAlerts(ws, v);
    expect(performance.now() - t).toBeLessThan(100);
    expect(v.orphans.length).toBe(1000 + 1);
  });
});

describe('lignes de suite dans l’analyse d’alignement', () => {
  const rows = [
    ['Ref', 'Département', 'Activité globale', 'Pays', 'Activité pays', 'Alignement'],
    ['KR1.1', 'DHGP', 'Global A', 'Kenya', 'Kenya A', 'Aligné'],
    ['', '', '', 'Uganda', 'Uganda A', 'Aligné'], // suite de Global A (cellule vide, non fusionnée)
    ['KR1.1', '', '', 'Benin', 'Benin local', 'Non aligné'], // orpheline
    ['KR1.2', '', '', 'Zambia', 'Zambia local', ''], // Ref renseignée sans activité globale → orpheline
  ];
  const run = (continuation: boolean) => {
    const { ws: w0, planId } = createPlan(emptyWorkspace(), { year: 2027 });
    const al = readWorkbook(workbook(rows))[1];
    const { ws } = runImport(w0, { planId, replace: false, alignment: { sheet: al, mapping: guessMapping(al.headers, ALIGN_FIELDS), wide: false, countryCols: [], continuation } });
    return computePlan(ws, planId, 1);
  };
  it('une cellule vide reprend l’activité du dessus ; les vraies orphelines restent orphelines', () => {
    expect(run(true).orphans.map((a) => a.title).sort()).toEqual(['Benin local', 'Zambia local']);
  });
  it('option désactivée : toute ligne sans activité globale est orpheline', () => {
    expect(run(false).orphans.map((a) => a.title).sort()).toEqual(['Benin local', 'Uganda A', 'Zambia local']);
  });
});
