import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/import/excel';
import { alerts, compute, ragOf, weightedMean } from '../src/lib/progress';
import { DEFAULT_SETTINGS, type Dataset, type MilestoneStatus } from '../src/types';
import { buildFixture } from './fixture';

const base = () => {
  const d = parseWorkbook(XLSX.read(XLSX.write(buildFixture(), { type: 'array' }), { type: 'array' })).dataset;
  d.settings.krMethod = 'milestones'; // les tests de consolidation des jalons isolent la méthode
  return d;
};
const setStatus = (ds: Dataset, initTitle: string, q: number, status: MilestoneStatus) => {
  const i = ds.initiatives.find((x) => x.title === initTitle)!;
  const m = ds.milestones.find((x) => x.initiativeId === i.id && x.quarter === q)!;
  m.status = status;
};
const setValue = (ds: Dataset, indName: string, quarter: 1 | 2 | 3 | 4, value: number, at = '2027-04-01') => {
  const ind = ds.indicators.find((x) => x.name === indName)!;
  ds.indicatorValues.push({ id: `${ind.id}-${quarter}-${at}`, indicatorId: ind.id, quarter, value, evidenceUrl: '', comment: '', at, by: 't' });
  return ind;
};

describe('consolidation', () => {
  it('seuils RAG', () => {
    expect(ragOf(70, 0, DEFAULT_SETTINGS)).toBe('green');
    expect(ragOf(69.9, 0, DEFAULT_SETTINGS)).toBe('amber');
    expect(ragOf(39, 0, DEFAULT_SETTINGS)).toBe('red');
    expect(ragOf(100, 1, DEFAULT_SETTINGS)).toBe('red');
    expect(ragOf(null, 0, DEFAULT_SETTINGS)).toBe('none');
  });

  it('moyenne pondérée', () => {
    expect(weightedMean([[100, 2], [40, 1], [null, 1]])).toBe(80);
  });

  it('remonte jalons → initiatives → KR → objectif → KR global', () => {
    const ds = base();
    setStatus(ds, 'Init 1', 1, 'achieved'); // 100
    setStatus(ds, 'Init 2', 1, 'in_progress'); // 50
    setStatus(ds, 'Init 3', 1, 'cancelled'); // exclu
    setStatus(ds, 'TA to Kenya and Uganda', 1, 'not_started'); // 0
    const c = compute(ds, 1);
    const alpha = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR alpha'))!;
    const beta = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR beta'))!;
    expect(c.entityKr.get(alpha.id)!.progress).toBe(75);
    expect(c.entityKr.get(beta.id)!.progress).toBeNull(); // seul jalon annulé
    expect(c.entity.get('kenya')!.progress).toBe(75);
    // KR1.1 : Kenya Lead (75, poids 2) + PEI Contributes (0, poids 1) = 50
    expect(c.globalKr.get('KR1.1')!.progress).toBe(50);
    expect(c.globalKr.get('KR1.1')!.rag).toBe('amber');
    // Q2 : les jalons Q2 non démarrés entrent dans la moyenne
    expect(compute(ds, 2).entityKr.get(alpha.id)!.progress).toBeLessThan(75);
  });

  it('jalon en retard → rouge, et alerte', () => {
    const ds = base();
    setStatus(ds, 'Init 1', 1, 'late');
    const c = compute(ds, 1);
    expect(c.entity.get('kenya')!.rag).toBe('red');
    expect(alerts(ds, c).some((a) => a.kind === 'late')).toBe(true);
    expect(alerts(ds, c).some((a) => a.kind === 'placeholder')).toBe(true);
    expect(alerts(ds, c).filter((a) => a.kind === 'no_lead').length).toBeGreaterThan(0);
  });

  it('indicateur : (valeur − baseline) / (cible − baseline), dernière saisie, cible trimestrielle', () => {
    const ds = base();
    const ind = setValue(ds, 'Init 1', 1, 65); // baseline 50, cible 80 → 50 %
    let c = compute(ds, 1).indicator.get(ind.id)!;
    expect(c.progress).toBe(50);
    expect(c.quarterTarget).toBeNull();
    setValue(ds, 'Init 1', 2, 62, '2027-07-01'); // cible Q2 = 60 → en avance
    c = compute(ds, 2).indicator.get(ind.id)!;
    expect([c.value, c.onTrack]).toEqual([62, true]);
    setValue(ds, 'Init 1', 2, 55, '2027-07-15'); // correction plus récente
    expect(compute(ds, 2).indicator.get(ind.id)!.value).toBe(55);
    expect(compute(ds, 1).indicator.get(ind.id)!.value).toBe(65); // vue Q1 inchangée
  });

  it('indicateur à faire baisser et indicateur Oui/Non', () => {
    const ds = base();
    const ind = ds.indicators.find((x) => x.name === 'Init 1')!;
    ind.baseline = 30; ind.target = 10; // ex. taux d'abandon à réduire
    setValue(ds, 'Init 1', 1, 20);
    expect(compute(ds, 1).indicator.get(ind.id)!.progress).toBe(50);
    const yn = setValue(ds, 'Init 2', 1, 1);
    expect(compute(ds, 1).indicator.get(yn.id)!.progress).toBe(100);
  });

  it('méthode de calcul du KR : jalons, indicateurs ou moyenne', () => {
    const ds = base();
    setStatus(ds, 'Init 1', 1, 'achieved'); // initiative 100
    setStatus(ds, 'Init 2', 1, 'achieved'); // initiative 100
    setValue(ds, 'Init 1', 1, 56); // 20 %
    setValue(ds, 'Init 2', 1, 0); // 0 %
    const alpha = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR alpha'))!;
    ds.settings.krMethod = 'milestones';
    expect(compute(ds, 1).entityKr.get(alpha.id)!.progress).toBe(100);
    ds.settings.krMethod = 'indicators';
    expect(compute(ds, 1).entityKr.get(alpha.id)!.progress).toBeCloseTo(10);
    ds.settings.krMethod = 'mix';
    const k = compute(ds, 1).entityKr.get(alpha.id)!;
    expect(k.progress).toBeCloseTo(55);
    expect([k.milestones, k.indicators?.toFixed(0)]).toEqual([100, '10']);
  });

  it('alertes indicateurs et cascade', () => {
    const ds = base();
    const a = alerts(ds, compute(ds, 1));
    expect(a.some((x) => x.kind === 'indicator_missing')).toBe(true);
    expect(a.some((x) => x.kind === 'no_indicator')).toBe(true); // KR du registre seul
  });

  it('performance : 5 000 jalons et 2 000 indicateurs calculés en moins de 100 ms', () => {
    const ds = base();
    const i0 = ds.initiatives[0];
    for (let n = 0; n < 5000; n++) ds.milestones.push({ ...ds.milestones[0], id: `p${n}`, initiativeId: i0.id, status: 'achieved' });
    for (let n = 0; n < 2000; n++) ds.indicators.push({ ...ds.indicators[0], id: `pi${n}` });
    const t = performance.now();
    compute(ds, 4);
    expect(performance.now() - t).toBeLessThan(100);
  });
});
