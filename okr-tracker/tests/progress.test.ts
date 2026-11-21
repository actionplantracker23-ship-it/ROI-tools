import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/import/excel';
import { alerts, compute, ragOf, weightedMean } from '../src/lib/progress';
import { DEFAULT_SETTINGS, type Dataset, type MilestoneStatus } from '../src/types';
import { buildFixture } from './fixture';

const base = () => parseWorkbook(XLSX.read(XLSX.write(buildFixture(), { type: 'array' }), { type: 'array' })).dataset;
const setStatus = (ds: Dataset, initTitle: string, q: number, status: MilestoneStatus, actual: number | null = null) => {
  const i = ds.initiatives.find((x) => x.title === initTitle)!;
  const m = ds.milestones.find((x) => x.initiativeId === i.id && x.quarter === q)!;
  m.status = status;
  m.actualValue = actual;
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

  it('avancement quantitatif (réel − baseline) / (cible − baseline)', () => {
    const ds = base();
    setStatus(ds, 'Init 1', 1, 'in_progress', 65); // baseline 50, cible 80 → 50 %
    expect(compute(ds, 1).initiative.get(ds.initiatives.find((i) => i.title === 'Init 1')!.id)!.quant).toBe(50);
  });
});
