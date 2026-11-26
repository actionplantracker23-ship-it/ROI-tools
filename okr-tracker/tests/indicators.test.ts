import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { parseWorkbook } from '../src/lib/import/excel';
import { indicatorTemplateRows, parseIndicatorTemplate } from '../src/lib/indicatorsIO';
import { buildFixture } from './fixture';

const ds = parseWorkbook(XLSX.read(XLSX.write(buildFixture(), { type: 'array' }), { type: 'array' })).dataset;
const toWb = (rows: Record<string, unknown>[]) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Indicateurs');
  return XLSX.read(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }), { type: 'array' });
};

describe('modèle Excel des indicateurs', () => {
  const rows = indicatorTemplateRows(ds);

  it('exporte une ligne par indicateur et une ligne vide par KR sans indicateur', () => {
    expect(rows.filter((r) => r.Indicateur).length).toBe(ds.indicators.length);
    const without = ds.entityKrs.filter((k) => !ds.indicators.some((i) => i.entityKrId === k.id)).length;
    expect(rows.filter((r) => !r.Indicateur).length).toBe(without);
  });

  it('réimport : crée un indicateur, saisit des valeurs, ignore les lignes inchangées', () => {
    const edited = rows.map((r) => ({ ...r }));
    const empty = edited.find((r) => !r.Indicateur)!;
    Object.assign(empty, { Indicateur: 'Nouveau', Type: 'Percentage', Baseline: 10, 'Cible finale': 50, 'Valeur Q1': '20%' });
    const first = edited.find((r) => r.Indicateur === 'Init 1')!;
    first['Valeur Q1'] = 62;
    const res = parseIndicatorTemplate(toWb(edited), ds, 'test', () => true);
    expect(res.errors).toEqual([]);
    expect(res.indicators.map((i) => i.name)).toEqual(['Nouveau']);
    expect(res.indicators[0].unit).toBe('%');
    expect(res.values.map((v) => v.value).sort()).toEqual([20, 62]);
  });

  it('refuse les lignes hors du périmètre de l’utilisateur', () => {
    const edited = rows.map((r) => ({ ...r, 'Valeur Q1': r.Indicateur ? 1 : '' }));
    const res = parseIndicatorTemplate(toWb(edited), ds, 'lead', (e) => e === 'kenya');
    expect(res.values.every((v) => ds.indicators.find((i) => i.id === v.indicatorId)?.entityId === 'kenya')).toBe(true);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});
