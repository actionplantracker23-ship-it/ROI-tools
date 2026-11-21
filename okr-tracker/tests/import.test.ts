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

  it('extrait baseline, cible et budget', () => {
    const i1 = ds.initiatives.find((i) => i.title === 'Init 1')!;
    expect(i1.metric).toBe('Percentage');
    expect(i1.baselineValue).toBe(50);
    expect(i1.target).toBe(80); // l'année 2027 est ignorée
    expect(i1.budgetValue).toBe(120000);
    const i3 = ds.initiatives.find((i) => i.title === 'Init 3')!;
    expect(i3.baselineValue).toBe(1000);
    expect(i3.target).toBe(2000);
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
    // lien seulement dans l'onglet Global Programs → déduit
    expect(ds.contributions.find((c) => c.globalKrId === 'KR3.1')?.inferred).toBe(true);
  });

  it('produit un rapport et des annexes', () => {
    expect(report.checks.find((c) => c.label === '20 KR globaux')?.ok).toBe(true);
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
});
