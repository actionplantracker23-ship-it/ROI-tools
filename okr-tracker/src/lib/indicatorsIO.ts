/**
 * Modèle Excel des indicateurs : export (une ligne par indicateur, plus une ligne vide par KR sans indicateur)
 * puis réimport pour créer / mettre à jour les indicateurs et saisir les valeurs trimestrielles en masse.
 * Colonnes : ID KR | Pays / Département | Ref | KR | ID indicateur | Indicateur | Type | Unité | Baseline |
 *            Cible Q1..Q4 | Cible finale | Source | Valeur Q1..Q4
 */
import * as XLSX from 'xlsx';
import type { Dataset, Indicator, IndicatorValue, MetricType, Quarter } from '../types';
import { hash, key, parseMetric } from './import/normalize';
import { groupBy } from './progress';

const Q = [1, 2, 3, 4] as const;

export function indicatorTemplateRows(ds: Dataset): Record<string, string | number>[] {
  const ent = new Map(ds.entities.map((e) => [e.id, e.name]));
  const refs = groupBy(ds.contributions, (c) => c.entityKrId);
  const indByKr = groupBy(ds.indicators, (i) => i.entityKrId);
  const vals = groupBy(ds.indicatorValues, (v) => v.indicatorId);
  const rows: Record<string, string | number>[] = [];
  for (const k of ds.entityKrs) {
    const base = { 'ID KR': k.id, 'Pays / Département': ent.get(k.entityId) ?? '', Ref: (refs.get(k.id) ?? []).map((c) => c.globalKrId).join(', '), KR: k.title };
    const list = indByKr.get(k.id) ?? [];
    if (!list.length) rows.push({ ...base, 'ID indicateur': '', Indicateur: '', Type: 'Numeric', Unité: '', Baseline: '', 'Cible Q1': '', 'Cible Q2': '', 'Cible Q3': '', 'Cible Q4': '', 'Cible finale': '', Source: '', 'Valeur Q1': '', 'Valeur Q2': '', 'Valeur Q3': '', 'Valeur Q4': '' });
    for (const i of list) {
      const last = (q: number) => (vals.get(i.id) ?? []).filter((v) => v.quarter === q).sort((a, b) => b.at.localeCompare(a.at))[0]?.value ?? '';
      rows.push({
        ...base, 'ID indicateur': i.id, Indicateur: i.name, Type: i.metric, Unité: i.unit, Baseline: i.baseline ?? '',
        'Cible Q1': i.quarterTargets[0] ?? '', 'Cible Q2': i.quarterTargets[1] ?? '', 'Cible Q3': i.quarterTargets[2] ?? '', 'Cible Q4': i.quarterTargets[3] ?? '',
        'Cible finale': i.target ?? '', Source: i.source,
        'Valeur Q1': last(1), 'Valeur Q2': last(2), 'Valeur Q3': last(3), 'Valeur Q4': last(4),
      });
    }
  }
  return rows;
}

const num = (v: unknown): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim().toLowerCase();
  if (s === 'oui' || s === 'yes') return 1;
  if (s === 'non' || s === 'no') return 0;
  const n = Number(s.replace(/\s|%/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

export interface IndicatorImportResult {
  indicators: Indicator[]; // créés ou modifiés
  values: IndicatorValue[]; // nouvelles valeurs (différentes de la dernière saisie)
  errors: string[];
}

/** Lit le modèle rempli. Les droits sont vérifiés par l'appelant (canEdit sur l'entité du KR). */
export function parseIndicatorTemplate(wb: XLSX.WorkBook, ds: Dataset, by: string, canEdit: (entityId: string) => boolean): IndicatorImportResult {
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  const krs = new Map(ds.entityKrs.map((k) => [k.id, k]));
  const krByTitle = new Map(ds.entityKrs.map((k) => [`${k.entityId}|${key(k.title)}`, k]));
  const entByName = new Map(ds.entities.map((e) => [key(e.name), e.id]));
  const inds = new Map(ds.indicators.map((i) => [i.id, i]));
  const vals = groupBy(ds.indicatorValues, (v) => v.indicatorId);
  const out: IndicatorImportResult = { indicators: [], values: [], errors: [] };
  const at = new Date().toISOString();
  rows.forEach((r, n) => {
    const line = n + 2;
    const name = String(r['Indicateur'] ?? '').trim();
    if (!name) return; // ligne vide du modèle (KR sans indicateur)
    let kr = krs.get(String(r['ID KR'] ?? '').trim());
    if (!kr) kr = krByTitle.get(`${entByName.get(key(String(r['Pays / Département'] ?? ''))) ?? ''}|${key(String(r['KR'] ?? ''))}`);
    if (!kr) { out.errors.push(`Ligne ${line} : KR introuvable.`); return; }
    if (!canEdit(kr.entityId)) { out.errors.push(`Ligne ${line} : pas de droit de modification sur ce pays/département.`); return; }
    const metric: MetricType = parseMetric(String(r['Type'] ?? 'Numeric')) === 'Other' ? 'Numeric' : parseMetric(String(r['Type']));
    const yesNo = metric === 'Yes/No';
    const id = String(r['ID indicateur'] ?? '').trim() || `${kr.id}-ind-x${hash(key(name))}`;
    const prev = inds.get(id);
    const ind: Indicator = {
      id, entityKrId: kr.id, entityId: kr.entityId, initiativeId: prev?.initiativeId ?? null, name, metric,
      unit: yesNo ? 'Oui/Non' : metric === 'Percentage' ? '%' : String(r['Unité'] ?? '').trim(),
      baseline: yesNo ? 0 : num(r['Baseline']), baselineText: prev?.baselineText ?? String(r['Baseline'] ?? ''),
      target: yesNo ? 1 : num(r['Cible finale']), quarterTargets: yesNo ? [null, null, null, null] : Q.map((q) => num(r[`Cible Q${q}`])),
      source: String(r['Source'] ?? '').trim(), frequency: prev?.frequency ?? 'Trimestrielle', origin: prev?.origin ?? 'manual',
      order: prev?.order ?? 99,
    };
    const changed = !prev || JSON.stringify({ ...prev, baselineText: '' }) !== JSON.stringify({ ...ind, baselineText: '' });
    if (changed) out.indicators.push(ind);
    for (const q of Q) {
      const v = num(r[`Valeur Q${q}`]);
      if (v === null) continue;
      const last = (vals.get(id) ?? []).filter((x) => x.quarter === q).sort((a, b) => b.at.localeCompare(a.at))[0];
      if (last?.value === v) continue;
      out.values.push({ id: crypto.randomUUID(), indicatorId: id, quarter: q as Quarter, value: v, evidenceUrl: '', comment: 'Import du modèle Excel', at, by });
    }
  });
  return out;
}
