import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/import/excel';
import { parseRefs, resolveEntity, detectCountries, hasPlaceholder } from '../src/lib/import/normalize';
import { mergeDataset } from '../src/lib/merge';
import { buildFixture } from './fixture';

// relit le classeur depuis un buffer, comme le navigateur
const roundTrip = (wb: XLSX.WorkBook) => XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });

describe('normalisation', () => {
  it('lit les références de KR', () => {
    expect(parseRefs('KR 1.1 / kr2.3')).toEqual(['KR1.1', 'KR2.3']);
  });
  it('reconnaît les entités', () => {
    expect(resolveEntity('Global Programs – PEI')?.id).toBe('gp-pei');
    expect(resolveEntity('Bénin')?.id).toBe('benin');
    expect(resolveEntity('P&C')?.id).toBe('pc');
    expect(detectCountries('Mission to Burkina Faso and Ouganda')).toEqual(['burkina-faso', 'uganda']);
  });
  it('détecte les valeurs à compléter', () => {
    expect(hasPlaceholder('reach [X] households')).toBe(true);
    expect(hasPlaceholder('target TBC')).toBe(true);
    expect(hasPlaceholder('xx%')).toBe(true);
    expect(hasPlaceholder('Xpert MTB')).toBe(false);
  });
});

describe('import du classeur', () => {
  const { dataset: ds, report } = parseWorkbook(roundTrip(buildFixture()), 'fixture.xlsx');

  it('lit 4 objectifs et 20 KR globaux', () => {
    expect(ds.globalObjectives).toHaveLength(4);
    expect(ds.globalKrs).toHaveLength(20);
    expect(ds.globalObjectives[0].title).toBe('Test objective 1');
    expect(ds.globalKrs.find((k) => k.id === 'KR2.3')?.title).toBe('Test global key result 2.3');
  });

  it('propage les cellules vides et ignore les en-têtes de section', () => {
    const ke = report.sheets.find((s) => s.sheet === '2 Kenya')!;
    expect(ke.sectionHeaders).toBe(1);
    expect(ke.krs).toBe(2);
    expect(ke.initiatives).toBe(3);
    const alpha = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR alpha'))!;
    expect(ds.initiatives.filter((i) => i.entityKrId === alpha.id).map((i) => i.title)).toEqual(['Init 1', 'Init 2']);
    // objectif fusionné recopié sur le 2e KR
    const beta = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR beta'))!;
    expect(beta.objectiveId).toBe(alpha.objectiveId);
  });

  it('crée les indicateurs de mesure (baseline, cibles trimestrielles, source) et le budget', () => {
    const i1 = ds.initiatives.find((i) => i.title === 'Init 1')!;
    expect(i1.metric).toBe('Percentage');
    expect(i1.budgetValue).toBe(120000);
    const ind1 = ds.indicators.find((i) => i.initiativeId === i1.id)!;
    expect(ind1.unit).toBe('%');
    expect(ind1.baseline).toBe(50);
    expect(ind1.target).toBe(80); // l'année 2027 est ignorée
    expect(ind1.quarterTargets).toEqual([null, 60, 70, 80]);
    expect(ind1.source).toBe('DHIS2 report');
    const ind3 = ds.indicators.find((i) => i.name === 'Init 3')!;
    expect(ind3.baseline).toBe(1000);
    expect(ind3.target).toBe(2000);
    const yn = ds.indicators.find((i) => i.name === 'Init 2')!;
    expect([yn.metric, yn.baseline, yn.target]).toEqual(['Yes/No', 0, 1]);
    // pas de jalon pour une cellule vide
    const i2 = ds.initiatives.find((i) => i.title === 'Init 2')!;
    expect(ds.milestones.filter((m) => m.initiativeId === i2.id).map((m) => m.quarter)).toEqual([1, 3, 4]);
  });

  it('répartit Global Programs par sous-équipe et détecte les pays visés', () => {
    const pei = ds.initiatives.find((i) => i.entityId === 'gp-pei')!;
    expect(pei.targetCountryIds).toEqual(['kenya', 'uganda']);
    const inno = ds.initiatives.find((i) => i.entityId === 'gp-innovations')!;
    expect(inno.targetCountryIds).toHaveLength(5);
  });

  it('relie le registre aux KR des onglets', () => {
    const lead = ds.contributions.find((c) => c.globalKrId === 'KR1.1' && c.entityId === 'kenya')!;
    expect(lead.role).toBe('Lead');
    expect(lead.inferred).toBeFalsy();
    const pei = ds.contributions.find((c) => c.globalKrId === 'KR1.1' && c.entityId === 'gp-pei')!;
    expect(pei.role).toBe('Contributes'); // Ref fusionnée/vide propagée depuis la ligne du dessus
    expect(ds.entityKrs.find((k) => k.title === 'GSE KR only in register')?.registerOnly).toBe(true);
    // titre de l'objectif pris dans la ligne de section du registre
    expect(ds.globalObjectives[0].title).toBe('Test objective 1'); // la feuille Ref fait foi
  });

  it('rattache chaque KR pays à un département global (cascade)', () => {
    const alpha = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR alpha'))!;
    expect([alpha.departmentId, alpha.departmentSource]).toEqual(['dhgp', 'ref']); // DHGP Lead de KR1.1
    const beta = ds.entityKrs.find((k) => k.title.startsWith('Kenya KR beta'))!;
    expect([beta.departmentId, beta.departmentSource]).toEqual(['finance', 'unit']); // colonne Team/Unit
    expect(ds.entityKrs.find((k) => k.entityId === 'gp-pei')!.departmentId).toBeNull();
    // lien seulement dans l'onglet Global Programs → déduit
    expect(ds.contributions.find((c) => c.globalKrId === 'KR3.1')?.inferred).toBe(true);
  });

  it('produit un rapport et des annexes', () => {
    expect(report.checks.find((c) => c.label === '20 KR globaux')?.ok).toBe(true);
    expect(report.totals.indicators).toBe(ds.indicators.length);
    expect(ds.annexes[0].rows[1]).toEqual(['Uptime', '99%']);
  });

  it('conserve les check-ins lors d’un réimport', () => {
    const m = ds.milestones[0];
    const prev = { ...ds, milestones: ds.milestones.map((x) => (x.id === m.id ? { ...x, status: 'achieved' as const } : x)),
      updates: [{ id: 'u1', milestoneId: m.id, status: 'achieved' as const, actualValue: null, evidenceUrl: '', comment: '', at: '', by: '' }] };
    const again = parseWorkbook(roundTrip(buildFixture())).dataset;
    const merged = mergeDataset(prev, again);
    expect(merged.milestones.find((x) => x.id === m.id)?.status).toBe('achieved');
    expect(merged.updates).toHaveLength(1);
  });

  it('conserve indicateurs manuels, valeurs et rattachements lors d’un réimport', () => {
    const kr = ds.entityKrs[0];
    const manual = { ...ds.indicators[0], id: 'manual-1', name: 'Indicateur ajouté', origin: 'manual' as const, entityKrId: kr.id };
    const prev = {
      ...ds,
      indicators: [...ds.indicators.map((i, n) => (n === 0 ? { ...i, target: 999 } : i)), manual],
      indicatorValues: [{ id: 'v1', indicatorId: 'manual-1', quarter: 1 as const, value: 5, evidenceUrl: '', comment: '', at: '', by: '' }],
      entityKrs: ds.entityKrs.map((k) => (k.id === kr.id ? { ...k, departmentId: 'bdac', departmentSource: 'manual' as const } : k)),
    };
    const merged = mergeDataset(prev, parseWorkbook(roundTrip(buildFixture())).dataset);
    expect(merged.indicators.find((i) => i.id === 'manual-1')).toBeTruthy();
    expect(merged.indicators[0].target).toBe(999);
    expect(merged.indicatorValues).toHaveLength(1);
    expect(merged.entityKrs.find((k) => k.id === kr.id)?.departmentId).toBe('bdac');
  });
});
