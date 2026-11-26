import { describe, expect, it } from 'vitest';
import { computePlan } from '../src/lib/calc';
import { parseDueDate, quarterOf } from '../src/lib/dates';
import { importOkr, readOkrWorkbook } from '../src/lib/importer';
import { createPlan, withDates } from '../src/lib/ops';
import { buildWbs, EMPTY_FILTER, matches } from '../src/lib/wbs';
import { emptyWorkspace } from '../src/types';
import { workbook } from './fixture';

describe('échéances lues dans les intitulés', () => {
  it.each([
    ['By 31 March 2027, the MoH will approve…', '2027-03-31'],
    ['By December 2027, CHPs deliver…', '2027-12-31'],
    ['By June 2027, one standard', '2027-06-30'],
    ['By Q2 2027, the playbook is completed', '2027-06-30'],
    ['Supervisor dashboard established by Q3: dashboards', '2027-09-30'],
    ['By 30 September 2027, 100% of innovations', '2027-09-30'],
    ['By 31 December, at least 6 tests', '2027-12-31'],
    ['Deliver DHGP inputs to funding proposals on schedule', null],
  ])('%s → %s', (text, expected) => expect(parseDueDate(text, 2027)).toBe(expected));
  it('trimestre d’une date', () => expect([quarterOf('2027-03-31'), quarterOf('2027-04-01')]).toEqual([1, 2]));
});

describe('gestion de projet', () => {
  const { ws: w0, planId } = createPlan(emptyWorkspace(), { year: 2027 });
  const { ws, report } = importOkr(w0, planId, readOkrWorkbook(workbook()), { replace: true });
  const v = computePlan(ws, planId, 1, '2027-01-15');

  it('registre des risques et actions issu de l’analyse (Partial, Conflict, Gap, orphelins)', () => {
    expect(report.issues).toBe(3); // Kenya finance (Partial), DHGP (Conflict), Burkina (orphelin)
    expect(ws.issues.map((i) => i.kind).sort()).toEqual(['issue', 'issue', 'risk']);
    expect(ws.issues.find((i) => i.source.startsWith('Orphelin'))?.title).toBe('No global team KR');
    // réimport : pas de doublon
    expect(importOkr(ws, planId, readOkrWorkbook(workbook()), { replace: false }).report.issues).toBe(0);
  });

  it('structure WBS numérotée et dépendances', () => {
    const { rows, wbsOf } = buildWbs(ws, v, () => true, false);
    expect(rows.filter((r) => r.kind === 'objective').map((r) => r.wbs)).toEqual(['1', '2']);
    expect(rows.filter((r) => r.kind === 'project').map((r) => r.wbs)).toEqual(['1.1', '1.2', '1.3', '2.1']);
    const kenya = ws.activities.find((a) => a.title === 'Kenya KR a')!;
    const deps = v.parentsOf.get(kenya.id)!.map((p) => wbsOf.get(p.id));
    expect(deps.every((d) => d?.startsWith('1.1.'))).toBe(true); // tâches globales du même projet, numérotées avant les pays
  });

  it('échéance dépassée → en retard ; filtres', () => {
    const t = ws.activities.find((a) => a.title === 'Kenya KR a')!;
    const past = { ...ws, activities: ws.activities.map((a) => (a.id === t.id ? withDates(a, '2027-01-01', '2027-02-01') : a)) };
    const v2 = computePlan(past, planId, 1, '2027-03-01');
    expect(v2.activity.get(t.id)!.late).toBe(true);
    expect(matches(t, { ...EMPTY_FILTER, orphans: true }, v, '2027-01-15')).toBe(false);
    const orphan = v.orphans[0];
    expect(matches(orphan, { ...EMPTY_FILTER, orphans: true }, v, '2027-01-15')).toBe(true);
  });

  it('plan de l’année suivante : échéances décalées d’un an', () => {
    const r = createPlan(ws, { year: 2028, sourcePlanId: planId, copyActivities: true });
    expect(r.ws.activities.filter((a) => a.planId === r.planId).every((a) => a.dueDate.startsWith('2028'))).toBe(true);
  });
});
