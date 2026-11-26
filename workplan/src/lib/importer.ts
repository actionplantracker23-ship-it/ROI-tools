/**
 * Import Excel à deux feuilles, avec correspondance de colonnes (proposée automatiquement, corrigeable) :
 *
 *  1. Registre OKR (« 1 OKR Register ») :
 *     Ref | Global Key Result | Country / Team | Role | Country/Team Objective | Country/Team Key Result | KR Lead | Scope | Go to plan
 *     + lignes de section « OBJECTIVE 1 · Embed and scale … » → objectifs du plan.
 *     → objectifs, KR globaux, engagements des unités (Lead / Contributes).
 *
 *  2. Analyse d'alignement activités globales ↔ activités pays, deux formats acceptés :
 *     - « long » : une ligne par lien (Ref, Département, Activité globale, Pays, Activité pays, Alignement…) ;
 *     - « large » : une ligne par activité globale et une colonne par pays contenant l'activité pays.
 *     → activités globales (par département), activités pays liées ; une activité pays sans activité
 *       globale (ou marquée non alignée) est ORPHELINE. Une activité globale sans pays est normale.
 *
 * Cellules fusionnées dépliées ; cellules vides des colonnes de regroupement (Ref, département, pays)
 * propagées vers le bas. La colonne « Activité globale » n'est PAS propagée : une ligne pays sans
 * activité globale (cellule non fusionnée vide) est donc bien une activité orpheline.
 */
import * as XLSX from 'xlsx';
import type { Activity, Commitment, Indicator, KeyResult, Objective, Unit, Workspace } from '../types';
import { OBJECTIVE_COLORS } from '../types';
import { newActivity, newIndicator } from './ops';
import { clean, key, uid } from './util';

export interface Field { id: string; label: string; aliases: string[]; required?: boolean; fill?: boolean; hint?: string }

export const REGISTER_FIELDS: Field[] = [
  { id: 'ref', label: 'Ref (KR global)', aliases: ['ref', 'reference', 'kr ref'], required: true, fill: true },
  { id: 'globalKr', label: 'Global Key Result', aliases: ['global key result', 'global kr', 'kr global', 'resultat cle global'], fill: true },
  { id: 'unit', label: 'Country / Team', aliases: ['country team', 'country', 'team', 'pays equipe', 'equipe', 'pays', 'unit'], required: true },
  { id: 'role', label: 'Role', aliases: ['role'] },
  { id: 'unitObjective', label: 'Country/Team Objective', aliases: ['country team objective', 'country objective', 'team objective', 'objectif pays'] },
  { id: 'unitKr', label: 'Country/Team Key Result', aliases: ['country team key result', 'country key result', 'team key result', 'kr pays'] },
  { id: 'krLead', label: 'KR Lead', aliases: ['kr lead', 'key result lead', 'responsable kr'] },
  { id: 'scope', label: 'Scope', aliases: ['scope', 'portee'] },
  { id: 'planRef', label: 'Go to plan', aliases: ['go to plan', 'plan', 'lien plan'] },
  { id: 'indicator', label: 'Indicateur du KR (facultatif)', aliases: ['indicator', 'indicateur', 'kpi', 'metric'] },
];

export const ALIGN_FIELDS: Field[] = [
  { id: 'ref', label: 'Ref (KR global)', aliases: ['ref', 'reference', 'kr', 'global kr ref'], fill: true },
  { id: 'globalUnit', label: 'Département global', aliases: ['global team', 'department', 'departement', 'global department', 'team', 'equipe globale', 'global unit'], fill: true },
  { id: 'globalActivity', label: 'Activité globale', aliases: ['global activity', 'global activities', 'activite globale', 'activites globales', 'global initiative', 'activite du global'], required: true },
  { id: 'country', label: 'Pays', aliases: ['country', 'pays'], fill: true },
  { id: 'countryActivity', label: 'Activité pays', aliases: ['country activity', 'country activities', 'activite pays', 'activites pays', 'country initiative', 'activite du pays'] },
  { id: 'alignment', label: 'Statut d’alignement', aliases: ['alignment', 'alignement', 'aligned', 'aligne', 'status', 'statut', 'link', 'lien'], hint: 'Aligné / Partiel / Non aligné (orphelin)' },
  { id: 'globalIndicator', label: 'Indicateur activité globale', aliases: ['global indicator', 'indicateur global', 'indicateur activite globale'] },
  { id: 'countryIndicator', label: 'Indicateur activité pays', aliases: ['country indicator', 'indicateur pays', 'indicateur activite pays'] },
  { id: 'comment', label: 'Commentaire', aliases: ['comment', 'comments', 'commentaire', 'commentaires', 'remarks', 'observation', 'gap', 'ecart'] },
];

export interface SheetInfo {
  name: string;
  headerRow: number; // index dans grid
  headers: string[];
  grid: string[][];
  guess: 'register' | 'alignment' | 'other';
}

export type Mapping = Record<string, number>; // id de champ → index de colonne (-1 = non utilisé)

// ------------------------------------------------------------------ lecture

export function sheetToGrid(ws: XLSX.WorkSheet): string[][] {
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const grid = (XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) as unknown[][]).map((r) => r.map(clean));
  for (const m of ws['!merges'] ?? []) {
    const top = grid[m.s.r - range.s.r]?.[m.s.c - range.s.c] ?? '';
    for (let r = m.s.r; r <= m.e.r; r++) {
      const rr = r - range.s.r;
      while (grid.length <= rr) grid.push([]);
      for (let c = m.s.c; c <= m.e.c; c++) grid[rr][c - range.s.c] = top;
    }
  }
  return grid;
}

const fieldHits = (headers: string[], fields: Field[]) => fields.filter((f) => headers.some((h) => f.aliases.some((a) => key(h) === a || key(h).startsWith(a + ' ')))).length;

export function readWorkbook(wb: XLSX.WorkBook): SheetInfo[] {
  return wb.SheetNames.map((name) => {
    const grid = sheetToGrid(wb.Sheets[name]);
    let headerRow = -1;
    let best = 0;
    let guess: SheetInfo['guess'] = 'other';
    for (let r = 0; r < Math.min(grid.length, 30); r++) {
      const row = grid[r];
      if (row.filter(Boolean).length < 2) continue;
      const reg = fieldHits(row, REGISTER_FIELDS);
      const ali = fieldHits(row, ALIGN_FIELDS) + (row.filter((h) => key(h).includes('activ')).length >= 2 ? 2 : 0);
      const score = Math.max(reg, ali);
      if (score > best) { best = score; headerRow = r; guess = ali > reg ? 'alignment' : 'register'; }
    }
    if (best < 2) { headerRow = grid.findIndex((r) => r.filter(Boolean).length >= 2); guess = 'other'; }
    const k = key(name);
    if (k.includes('register') || k.includes('registre')) guess = 'register';
    else if (k.includes('align') || k.includes('analys')) guess = 'alignment';
    return { name, headerRow, headers: headerRow >= 0 ? grid[headerRow] : [], grid, guess };
  });
}

/** Correspondance proposée : intitulé identique, puis commençant par, puis contenant l'alias. */
export function guessMapping(headers: string[], fields: Field[]): Mapping {
  const keys = headers.map(key);
  const used = new Set<number>();
  const map: Mapping = Object.fromEntries(fields.map((f) => [f.id, -1]));
  const tests: ((h: string, a: string) => boolean)[] = [(h, a) => h === a, (h, a) => h.startsWith(a + ' '), (h, a) => a.length > 4 && h.includes(a)];
  for (const t of tests) {
    for (const f of fields) {
      if (map[f.id] >= 0) continue;
      for (const a of f.aliases) {
        const i = keys.findIndex((h, n) => !used.has(n) && h && t(h, a));
        if (i >= 0) { map[f.id] = i; used.add(i); break; }
      }
    }
  }
  return map;
}

/** Colonnes dont l'intitulé est un pays connu → format « large » de l'analyse d'alignement. */
export function countryColumns(headers: string[], units: Unit[]): { col: number; unit: Unit | null; label: string }[] {
  const out: { col: number; unit: Unit | null; label: string }[] = [];
  headers.forEach((h, col) => {
    const u = resolveUnit(h, units, 'country');
    if (u && u.type === 'country') out.push({ col, unit: u, label: h });
  });
  return out;
}

// ------------------------------------------------------------------ unités

const UNIT_ALIASES: Record<string, string[]> = {
  'burkina-faso': ['burkina', 'bf'], uganda: ['ouganda', 'ug'], benin: ['bj'], zambia: ['zambie'], kenya: ['ke'],
  pc: ['p c', 'people culture', 'people and culture'], dt: ['digital technology', 'digital transformation'],
  innovations: ['innovation'],
};

export function resolveUnit(label: string, units: Unit[], prefer?: Unit['type']): Unit | null {
  const k = key(label);
  if (!k) return null;
  const cands: { u: Unit; len: number }[] = [];
  for (const u of units) {
    const names = [u.name, u.id.replace(/-/g, ' '), ...(UNIT_ALIASES[u.id] ?? [])].map(key).filter(Boolean);
    for (const n of names) {
      if (k === n) return u;
      if (n.length >= 2 && new RegExp(`(^| )${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(k)) cands.push({ u, len: n.length });
    }
  }
  cands.sort((a, b) => b.len - a.len || (prefer && a.u.type === prefer ? -1 : 0));
  return cands[0]?.u ?? null;
}

// ------------------------------------------------------------------ construction

export interface ImportRequest {
  planId: string;
  register?: { sheet: SheetInfo; mapping: Mapping };
  alignment?: {
    sheet: SheetInfo; mapping: Mapping; wide: boolean; countryCols: { col: number; unitId: string }[];
    /**
     * Lignes de suite (défaut : oui) : une cellule « Activité globale » vide reprend l'activité du dessus
     * si Ref et Département sont vides aussi et que la ligne n'est pas marquée non alignée.
     * Sinon la ligne pays est orpheline.
     */
    continuation?: boolean;
  };
  replace: boolean; // vider le plan avant import
}

export interface ImportReport {
  objectives: number; krs: number; commitments: number; globalActivities: number; countryActivities: number;
  aligned: number; partial: number; orphans: number; indicators: number; unitsCreated: string[]; warnings: string[];
}

const isSection = (s: string) => /^\s*OBJECTIVE\s*\d+/i.test(s);
const sectionMatch = (s: string) => s.match(/^\s*OBJECTIVE\s*(\d+)\s*[·:.\-–—|]?\s*([\s\S]*)$/i);
const parseRef = (s: string) => { const m = s.match(/(?:KR\s*)?(\d{1,2})\s*[.,]\s*(\d{1,2})/i); return m ? { o: Number(m[1]), code: `KR${Number(m[1])}.${Number(m[2])}` } : null; };
const alignmentOf = (s: string): 'full' | 'partial' | 'none' | null => {
  const k = key(s);
  if (!k) return null;
  if (/(non|not|no|pas|aucun|orphan|orphelin|missing|manque|unaligned)/.test(k) && !/partial|partiel/.test(k)) return 'none';
  if (/partial|partiel|partly|partiellement/.test(k)) return 'partial';
  return 'full';
};

/** Lignes de données (après l'en-tête) avec propagation vers le bas des colonnes de regroupement. */
function dataRows(sheet: SheetInfo, mapping: Mapping, fields: Field[], onSection: (n: number, title: string) => void) {
  const out: Record<string, string>[] = [];
  const carry: Record<string, string> = {};
  for (let r = sheet.headerRow + 1; r < sheet.grid.length; r++) {
    const row = sheet.grid[r];
    const first = row.find(Boolean) ?? '';
    if (!first) continue;
    if (isSection(first)) {
      const m = sectionMatch(first);
      if (m) onSection(Number(m[1]), clean(m[2]));
      for (const f of fields) if (f.fill) delete carry[f.id];
      continue;
    }
    const v: Record<string, string> = { __row: String(r + 1) };
    for (const f of fields) {
      const c = mapping[f.id];
      v[f.id] = c >= 0 ? clean(row[c]) : '';
      if (f.fill) { if (v[f.id]) carry[f.id] = v[f.id]; else v[f.id] = carry[f.id] ?? ''; }
    }
    v.__raw = JSON.stringify(row);
    out.push(v);
  }
  return out;
}

export function runImport(ws0: Workspace, req: ImportRequest): { ws: Workspace; report: ImportReport } {
  let ws = ws0;
  const planId = req.planId;
  const report: ImportReport = { objectives: 0, krs: 0, commitments: 0, globalActivities: 0, countryActivities: 0, aligned: 0, partial: 0, orphans: 0, indicators: 0, unitsCreated: [], warnings: [] };
  if (req.replace) {
    const acts = new Set(ws.activities.filter((a) => a.planId === planId).map((a) => a.id));
    const inds = new Set(ws.indicators.filter((i) => i.planId === planId).map((i) => i.id));
    ws = {
      ...ws, objectives: ws.objectives.filter((x) => x.planId !== planId), krs: ws.krs.filter((x) => x.planId !== planId),
      commitments: ws.commitments.filter((x) => x.planId !== planId), activities: ws.activities.filter((x) => x.planId !== planId),
      activityUpdates: ws.activityUpdates.filter((u) => !acts.has(u.activityId)), indicators: ws.indicators.filter((x) => x.planId !== planId),
      indicatorValues: ws.indicatorValues.filter((v) => !inds.has(v.indicatorId)),
    };
  }
  const objectives = ws.objectives.filter((o) => o.planId === planId);
  const krs = ws.krs.filter((k) => k.planId === planId);
  const acts = ws.activities.filter((a) => a.planId === planId);
  const units = [...ws.units];
  const newObjectives: Objective[] = [];
  const newKrs: KeyResult[] = [];
  const newCommitments: Commitment[] = [];
  const newActs: Activity[] = [];
  const newInds: Indicator[] = [];
  const sectionTitles = new Map<number, string>();

  const unitFor = (label: string, type: Unit['type'], row: string): Unit | null => {
    if (!label) return null;
    const u = resolveUnit(label, units, type);
    if (u) return u;
    const created: Unit = { id: uid('u-'), name: label.replace(/^global programs\s*[–-]\s*/i, ''), type, order: units.length };
    units.push(created);
    report.unitsCreated.push(`${created.name} (${type === 'country' ? 'pays' : 'département'}, ligne ${row})`);
    return created;
  };
  const objectiveFor = (n: number): Objective => {
    let o = [...objectives, ...newObjectives].find((x) => x.code === String(n));
    if (!o) {
      o = { id: uid('o-'), planId, code: String(n), title: sectionTitles.get(n) ?? `Objective ${n}`, color: OBJECTIVE_COLORS[(n - 1) % OBJECTIVE_COLORS.length], order: n - 1 };
      newObjectives.push(o);
    } else if (sectionTitles.get(n) && /^Objective \d+$/.test(o.title)) o.title = sectionTitles.get(n)!;
    return o;
  };
  const krFor = (refText: string, title: string): KeyResult | null => {
    const r = parseRef(refText);
    if (!r) return null;
    let k = [...krs, ...newKrs].find((x) => x.code === r.code);
    const o = objectiveFor(r.o);
    if (!k) {
      k = { id: uid('kr-'), planId, objectiveId: o.id, code: r.code, title: title || r.code, order: Number(r.code.split('.')[1]) - 1 };
      newKrs.push(k);
    } else if (title && (k.title === k.code || !k.title)) k.title = title;
    return k;
  };
  const addIndicator = (type: Indicator['targetType'], targetId: string, name: string) => {
    if (!name) return;
    const all = [...ws.indicators, ...newInds];
    if (all.some((i) => i.targetId === targetId && key(i.name) === key(name))) return;
    newInds.push({ ...newIndicator({ ...ws, indicators: all }, planId, type, targetId), name });
  };

  // 1. registre -------------------------------------------------------------------------------------
  if (req.register) {
    const rows = dataRows(req.register.sheet, req.register.mapping, REGISTER_FIELDS, (n, t) => { if (t) sectionTitles.set(n, t); });
    for (const [n, t] of sectionTitles) { const o = [...objectives, ...newObjectives].find((x) => x.code === String(n)); if (o && t) o.title = t; }
    for (const v of rows) {
      const k = krFor(v.ref, v.globalKr);
      if (!k) { if (v.unit || v.unitKr) report.warnings.push(`Registre, ligne ${v.__row} : référence de KR illisible (« ${v.ref} »).`); continue; }
      // unité connue (quel que soit son type) ; sinon créée : pays si le scope l'indique, département sinon
      const u = unitFor(v.unit, /pays|country/i.test(v.scope) ? 'country' : 'department', v.__row);
      if (!u) continue;
      const dup = [...ws.commitments, ...newCommitments].find((c) => c.planId === planId && c.krId === k.id && c.unitId === u.id && key(c.unitKr) === key(v.unitKr));
      if (dup) continue;
      newCommitments.push({
        id: uid('c-'), planId, krId: k.id, unitId: u.id, role: key(v.role).startsWith('lead') ? 'Lead' : 'Contributes',
        unitObjective: v.unitObjective, unitKr: v.unitKr, krLead: v.krLead, scope: v.scope, planRef: v.planRef,
      });
      addIndicator('kr', k.id, v.indicator);
    }
    // objectifs annoncés par une section sans KR
    for (const n of sectionTitles.keys()) objectiveFor(n);
  }

  // 2. analyse d'alignement -------------------------------------------------------------------------
  if (req.alignment) {
    const { sheet, mapping, wide, countryCols } = req.alignment;
    const rows = dataRows(sheet, mapping, ALIGN_FIELDS, (n, t) => { if (t && !sectionTitles.has(n)) sectionTitles.set(n, t); });
    const findAct = (level: Activity['level'], unitId: string, title: string) =>
      [...acts, ...newActs].find((a) => a.level === level && a.unitId === unitId && key(a.title) === key(title));
    const multiLinked = new Set<string>();
    let alignedWithoutGlobal = 0;
    let lastGlobal: Activity | null = null;
    const rawCell = (v: Record<string, string>, f: string) => (mapping[f] >= 0 ? clean(JSON.parse(v.__raw)[mapping[f]]) : '');
    for (const v of rows) {
      const k = v.ref ? krFor(v.ref, '') : null;
      let g: Activity | null = null;
      const isContinuation = req.alignment.continuation !== false && !v.globalActivity && !rawCell(v, 'ref') && !rawCell(v, 'globalUnit')
        && alignmentOf(v.alignment) !== 'none' && lastGlobal !== null;
      if (isContinuation) g = lastGlobal;
      if (v.globalActivity && !isSection(v.globalActivity)) {
        const gu = unitFor(v.globalUnit || 'Global', 'department', v.__row)!;
        g = findAct('global', gu.id, v.globalActivity) ?? null;
        if (!g) {
          g = newActivity({ ...ws, activities: [...ws.activities, ...newActs] }, { planId, level: 'global', unitId: gu.id, krId: k?.id ?? null, title: v.globalActivity });
          newActs.push(g);
        } else if (!g.krId && k) g.krId = k.id;
        addIndicator('activity', g.id, v.globalIndicator);
        lastGlobal = g;
      } else if (!isContinuation) lastGlobal = null;
      const pairs: { country: string; unitId?: string; text: string }[] = wide
        ? countryCols.map((c) => ({ country: '', unitId: c.unitId, text: clean(JSON.parse(v.__raw)[c.col]) })).filter((p) => p.text)
        : v.countryActivity ? [{ country: v.country, text: v.countryActivity }] : [];
      for (const p of pairs) {
        const cu = p.unitId ? units.find((u) => u.id === p.unitId)! : unitFor(p.country, 'country', v.__row);
        if (!cu) { report.warnings.push(`Alignement, ligne ${v.__row} : pays manquant pour « ${p.text.slice(0, 50)} ».`); continue; }
        // une même cellule peut lister plusieurs activités pays (une par ligne)
        for (const text of p.text.split(/\n+/).map((t) => t.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean)) {
          if (/^(n\/?a|na|-|none|aucune?|nil|0)$/i.test(text)) continue;
          const st = alignmentOf(v.alignment);
          if (!g && (st === 'full' || st === 'partial')) alignedWithoutGlobal++;
          const parent = st === 'none' ? null : g;
          let c = findAct('country', cu.id, text);
          if (!c) {
            c = newActivity({ ...ws, activities: [...ws.activities, ...newActs] }, {
              planId, level: 'country', unitId: cu.id, krId: k?.id ?? null, title: text,
              parentId: parent?.id ?? null, alignment: parent ? (st === 'partial' ? 'partial' : 'full') : null, comment: v.comment,
            });
            newActs.push(c);
          } else if (parent && c.parentId && c.parentId !== parent.id) multiLinked.add(c.id);
          else if (parent && !c.parentId) { c.parentId = parent.id; c.alignment = st === 'partial' ? 'partial' : 'full'; }
          addIndicator('activity', c.id, v.countryIndicator);
        }
      }
    }
    if (alignedWithoutGlobal) report.warnings.push(`${alignedWithoutGlobal} activité(s) pays marquée(s) alignée(s) mais sans activité globale sur la ligne : classées orphelines, à rattacher.`);
    if (multiLinked.size) report.warnings.push(`${multiLinked.size} activité(s) pays citée(s) pour plusieurs activités globales : rattachées à la première.`);
  }

  // titres d'objectifs connus après coup
  for (const o of [...objectives, ...newObjectives]) { const t = sectionTitles.get(Number(o.code)); if (t && /^Objective \d+$/.test(o.title)) o.title = t; }

  ws = {
    ...ws, units,
    objectives: [...ws.objectives.map((o) => objectives.find((x) => x.id === o.id) ?? o), ...newObjectives],
    krs: [...ws.krs.map((k) => krs.find((x) => x.id === k.id) ?? k), ...newKrs],
    commitments: [...ws.commitments, ...newCommitments],
    activities: [...ws.activities.map((a) => acts.find((x) => x.id === a.id) ?? a), ...newActs],
    indicators: [...ws.indicators, ...newInds],
  };
  const countryNew = newActs.filter((a) => a.level === 'country');
  Object.assign(report, {
    objectives: newObjectives.length, krs: newKrs.length, commitments: newCommitments.length,
    globalActivities: newActs.length - countryNew.length, countryActivities: countryNew.length,
    aligned: countryNew.filter((a) => a.parentId).length, partial: countryNew.filter((a) => a.alignment === 'partial').length,
    orphans: countryNew.filter((a) => !a.parentId).length, indicators: newInds.length,
  });
  return { ws, report };
}
