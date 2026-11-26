/**
 * Import du classeur OKR (format Living Goods), deux feuilles :
 *
 * 1. Registre (« OR register ») :
 *    Ref | Global Key Result | Country / Team | Role | Country/Team Objective | Country/Team Key Result | KR Lead | Scope | Go to plan
 *    - lignes « OBJECTIVE N · titre » → objectifs ;
 *    - Ref « KR1.1 » + Global Key Result (« KR1.1\nIntitulé », cellule fusionnée) → KR global ;
 *    - Ref « Team KR · O1 » → groupe des KR d'équipe sans KR global de l'objectif 1 ;
 *    - chaque ligne = un KR d'équipe globale (activité globale) ou un KR pays (activité pays) ;
 *      « Global Programs (PEI) » → équipe PEI ; « Kenya (Finance & Admin) » → Kenya, sous-équipe Finance & Admin ;
 *    - « No country/team plan yet » → KR global sans plan (signalé).
 *
 * 2. Analyse d'alignement (« alignement du OKR ») :
 *    A · Country | Obj. | Ref | Country Key Result | KR Lead | Global teams with a KR under the same Ref | # | Status | Finding / gap | Recommended action
 *    B · Global team | Obj. | Ref | Global team Key Result | Scope | Countries with a KR under the same Ref | # | Status | Finding / gap | Recommended action
 *    → liens KR pays ↔ KR des équipes globales (même Ref), statut (Aligned, Partial, Conflict, Gap, Global only),
 *      constat et action recommandée. KR pays sans équipe globale (« — none — ») = ORPHELIN.
 *
 * Réimport : les éléments déjà présents (même unité, même Ref, même intitulé) sont mis à jour en conservant
 * leur suivi (statut, avancement, indicateurs, historique).
 */
import * as XLSX from 'xlsx';
import type { Activity, AlignStatus, Issue, KeyResult, Objective, Unit, Workspace } from '../types';
import { ALIGN_LABEL, OBJECTIVE_COLORS } from '../types';
import { iso, parseDueDate } from './dates';
import { newActivity, newIssue, withDates } from './ops';
import { clean, key, similarity, uid } from './util';

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

type Cols = Record<string, number>;
/** Repère une ligne d'en-tête contenant tous les intitulés demandés ; renvoie la ligne et l'index des colonnes. */
function findHeader(grid: string[][], wanted: Record<string, string[]>, from = 0): { row: number; cols: Cols } | null {
  for (let r = from; r < grid.length; r++) {
    const keys = grid[r].map(key);
    const cols: Cols = {};
    let ok = true;
    for (const [f, aliases] of Object.entries(wanted)) {
      const i = keys.findIndex((k) => aliases.some((a) => k === a || k.startsWith(a)));
      if (i < 0) { ok = false; break; }
      cols[f] = i;
    }
    if (ok) return { row: r, cols };
  }
  return null;
}

const REGISTER_COLS = {
  ref: ['ref'], globalKr: ['global key result'], unit: ['country team'], role: ['role'], objective: ['country team objective'],
  kr: ['country team key result'], lead: ['kr lead'], scope: ['scope'],
};
const A_COLS = {
  country: ['country'], obj: ['obj'], ref: ['ref'], kr: ['country key result'], lead: ['kr lead'], teams: ['global teams with'],
  status: ['status'], finding: ['finding'], action: ['recommended action'],
};
const B_COLS = {
  team: ['global team'], obj: ['obj'], ref: ['ref'], kr: ['global team key result'], scope: ['scope'], countries: ['countries with'],
  status: ['status'], finding: ['finding'], action: ['recommended action'],
};

export interface RegRow { row: number; objective: number; code: string; team: boolean; krTitle: string; unit: string; role: string; objectiveText: string; kr: string; lead: string; scope: string }
export interface ARow { row: number; country: string; code: string; kr: string; lead: string; teams: string[]; status: AlignStatus | null; finding: string; action: string }
export interface BRow { row: number; team: string; code: string; kr: string; scope: string; countries: string[]; status: AlignStatus | null; finding: string; action: string }

export interface OkrFile {
  registerSheet: string | null;
  alignmentSheet: string | null;
  objectives: Map<number, string>;
  register: RegRow[];
  a: ARow[];
  b: BRow[];
  noPlan: string[]; // KR globaux sans plan pays/équipe
  warnings: string[];
}

const SECTION = /^\s*OBJECTIVE\s*(\d+)\s*[·:.\-–—|]?\s*([\s\S]*)$/i;

/** « KR1.1 » → KR1.1 ; « Team KR · O3 » ou (« Team KR », « O3 ») → « Team KR · O3 ». */
function refCode(ref: string, obj = ''): { code: string; objective: number; team: boolean } | null {
  const m = ref.match(/KR\s*(\d+)\s*\.\s*(\d+)/i);
  if (m) return { code: `KR${Number(m[1])}.${Number(m[2])}`, objective: Number(m[1]), team: false };
  if (/team\s*kr/i.test(ref)) {
    const o = (ref.match(/O\s*(\d+)/i) ?? obj.match(/O?\s*(\d+)/i));
    if (o) return { code: `Team KR · O${Number(o[1])}`, objective: Number(o[1]), team: true };
  }
  return null;
}

const statusOf = (s: string): AlignStatus | null => {
  const k = key(s);
  if (k.startsWith('align')) return 'aligned';
  if (k.startsWith('partial')) return 'partial';
  if (k.startsWith('conflict')) return 'conflict';
  if (k.startsWith('gap')) return 'gap';
  if (k.startsWith('global only')) return 'global_only';
  return null;
};
/** « Global Programs (PEI), DHGP » → [« Global Programs (PEI) », « DHGP »] ; « — none — » → []. */
const splitList = (s: string) => (key(s) === 'none' || !key(s) ? [] : s.split(/\s*,\s*/).map(clean).filter((x) => key(x) && key(x) !== 'none'));

export function readOkrWorkbook(wb: XLSX.WorkBook): OkrFile {
  const out: OkrFile = { registerSheet: null, alignmentSheet: null, objectives: new Map(), register: [], a: [], b: [], noPlan: [], warnings: [] };
  for (const name of wb.SheetNames) {
    const grid = sheetToGrid(wb.Sheets[name]);
    const reg = findHeader(grid, REGISTER_COLS);
    if (reg && !out.registerSheet) {
      out.registerSheet = name;
      const c = reg.cols;
      let objective = 0;
      let lastRef = '';
      let lastKrTitle = '';
      for (let r = reg.row + 1; r < grid.length; r++) {
        const row = grid[r];
        const first = row.find(Boolean) ?? '';
        if (!first) continue;
        const sec = first.match(SECTION);
        if (sec) { objective = Number(sec[1]); out.objectives.set(objective, clean(sec[2])); continue; }
        const ref = row[c.ref] || lastRef;
        const rc = refCode(ref);
        if (!rc) { out.warnings.push(`Registre, ligne ${r + 1} : Ref illisible (« ${row[c.ref]} »).`); continue; }
        if (ref !== lastRef) lastKrTitle = '';
        lastRef = ref;
        const g = row[c.globalKr];
        if (g) lastKrTitle = rc.team ? 'Team KRs (no Global KR)' : clean(g.replace(/^KR\s*\d+\s*\.\s*\d+\s*/i, ''));
        const kr = row[c.kr];
        const base = { row: r + 1, objective: rc.objective || objective, code: rc.code, team: rc.team, krTitle: lastKrTitle, unit: row[c.unit], role: row[c.role], objectiveText: row[c.objective], kr, lead: row[c.lead], scope: row[c.scope] };
        if (!kr || /no country.?team plan/i.test(kr)) { out.noPlan.push(`${rc.code}${row[c.unit] ? ` (${row[c.unit]})` : ''}`); out.register.push({ ...base, kr: '' }); continue; }
        out.register.push(base);
      }
    }
    const ha = findHeader(grid, A_COLS);
    const hb = findHeader(grid, B_COLS);
    if ((ha || hb) && !out.alignmentSheet) {
      out.alignmentSheet = name;
      const stopAt = (from: number) => { let r = from; while (r < grid.length && grid[r].some(Boolean) && !/^\s*[AB]\s*·/.test(grid[r][0])) r++; return r; };
      if (ha) {
        const c = ha.cols;
        for (let r = ha.row + 1, end = stopAt(ha.row + 1); r < end; r++) {
          const row = grid[r];
          const rc = refCode(row[c.ref], row[c.obj]);
          if (!rc || !row[c.kr]) continue;
          out.a.push({ row: r + 1, country: row[c.country], code: rc.code, kr: row[c.kr], lead: row[c.lead], teams: splitList(row[c.teams]), status: statusOf(row[c.status]), finding: row[c.finding], action: row[c.action] });
        }
      }
      if (hb) {
        const c = hb.cols;
        for (let r = hb.row + 1, end = stopAt(hb.row + 1); r < end; r++) {
          const row = grid[r];
          const rc = refCode(row[c.ref], row[c.obj]);
          if (!rc || !row[c.kr]) continue;
          out.b.push({ row: r + 1, team: row[c.team], code: rc.code, kr: row[c.kr], scope: row[c.scope], countries: splitList(row[c.countries]), status: statusOf(row[c.status]), finding: row[c.finding], action: row[c.action] });
        }
      }
    }
  }
  if (!out.registerSheet) out.warnings.push('Feuille du registre non trouvée (en-têtes Ref, Global Key Result, Country / Team, …).');
  if (!out.alignmentSheet) out.warnings.push('Feuille d’analyse d’alignement non trouvée (en-têtes Country, Ref, Country Key Result, Status, …).');
  return out;
}

// ------------------------------------------------------------------ unités

const COUNTRY_ALIASES: Record<string, string[]> = {
  kenya: ['kenya'], 'burkina-faso': ['burkina faso', 'burkina', 'bf'], uganda: ['uganda', 'ouganda'], benin: ['benin'], zambia: ['zambia', 'zambie'],
};

/** « Global Programs (PEI) » → { name: PEI, group: Global Programs } ; « Kenya (Finance & Admin) » → { name: Kenya, sub: Finance & Admin }. */
export function parseUnitLabel(label: string): { name: string; group?: string; sub: string } {
  const m = clean(label).match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return { name: clean(label), sub: '' };
  if (key(m[1]) === 'global programs') return { name: clean(m[2]), group: 'Global Programs', sub: '' };
  return { name: clean(m[1]), sub: clean(m[2]) };
}

export function findUnit(units: Unit[], name: string): Unit | null {
  const k = key(name);
  if (!k) return null;
  return units.find((u) => key(u.name) === k || u.id === k.replace(/ /g, '-') || (COUNTRY_ALIASES[u.id] ?? []).includes(k)) ?? null;
}

// ------------------------------------------------------------------ construction

export interface ImportReport {
  objectives: number; krs: number; globalActivities: number; countryActivities: number; updated: number;
  linked: number; orphans: number; orphanTitles: string[];
  countryStatus: Record<string, number>; globalStatus: Record<string, number>;
  unmatched: string[]; noPlan: string[]; unitsCreated: string[]; kept: number; warnings: string[];
  datesFound: number; issues: number;
}

export function importOkr(ws0: Workspace, planId: string, file: OkrFile, opts: { replace: boolean }): { ws: Workspace; report: ImportReport } {
  let ws = ws0;
  if (opts.replace) {
    const acts = new Set(ws.activities.filter((a) => a.planId === planId).map((a) => a.id));
    const inds = new Set(ws.indicators.filter((i) => i.planId === planId).map((i) => i.id));
    ws = {
      ...ws, objectives: ws.objectives.filter((x) => x.planId !== planId), krs: ws.krs.filter((x) => x.planId !== planId),
      activities: ws.activities.filter((x) => x.planId !== planId), activityUpdates: ws.activityUpdates.filter((u) => !acts.has(u.activityId)),
      indicators: ws.indicators.filter((x) => x.planId !== planId), indicatorValues: ws.indicatorValues.filter((v) => !inds.has(v.indicatorId)),
    };
  }
  const report: ImportReport = {
    objectives: 0, krs: 0, globalActivities: 0, countryActivities: 0, updated: 0, linked: 0, orphans: 0, orphanTitles: [],
    countryStatus: {}, globalStatus: {}, unmatched: [], noPlan: file.noPlan, unitsCreated: [], kept: 0, warnings: [...file.warnings],
    datesFound: 0, issues: 0,
  };
  const year = ws.plans.find((p) => p.id === planId)?.year ?? new Date().getFullYear();
  const units = [...ws.units];
  const objectives = new Map(ws.objectives.filter((o) => o.planId === planId).map((o) => [o.code, { ...o }]));
  const krs = new Map(ws.krs.filter((k) => k.planId === planId).map((k) => [k.code, { ...k }]));
  const existing = ws.activities.filter((a) => a.planId === planId);
  const touched = new Set<string>();

  const unitFor = (label: string, scope: string): { unit: Unit; sub: string } => {
    const p = parseUnitLabel(label);
    let u = findUnit(units, p.name);
    if (!u) {
      const isCountry = key(scope) === key(p.name) || Object.values(COUNTRY_ALIASES).some((a) => a.includes(key(p.name)));
      u = { id: uid('u-'), name: p.name, type: isCountry ? 'country' : 'department', group: p.group, order: units.length };
      units.push(u);
      report.unitsCreated.push(`${u.name} (${isCountry ? 'pays' : 'équipe globale'})`);
    }
    return { unit: u, sub: p.sub };
  };
  const objectiveFor = (n: number): Objective => {
    const code = String(n);
    let o = objectives.get(code);
    const title = file.objectives.get(n);
    if (!o) { o = { id: uid('o-'), planId, code, title: title || `Objective ${n}`, color: OBJECTIVE_COLORS[(n - 1) % OBJECTIVE_COLORS.length], order: n - 1 }; objectives.set(code, o); report.objectives++; }
    else if (title) o.title = title;
    return o;
  };
  const krFor = (code: string, objective: number, title: string, team: boolean): KeyResult => {
    let k = krs.get(code);
    const o = objectiveFor(objective);
    if (!k) {
      const parts = code.match(/(\d+)\.(\d+)/);
      k = { id: uid('kr-'), planId, objectiveId: o.id, code, title: title || code, order: parts ? Number(parts[2]) - 1 : 90, team };
      krs.set(code, k);
      report.krs++;
    } else if (title) k.title = title;
    return k;
  };
  for (const n of file.objectives.keys()) objectiveFor(n);

  // 1. registre → activités globales / pays
  const acts: Activity[] = [];
  const newIds = new Set<string>();
  const keyOf = (unitId: string, krId: string, title: string) => `${unitId}|${krId}|${key(title)}`;
  const existingByKey = new Map(existing.map((a) => [keyOf(a.unitId, a.krId ?? '', a.title), a]));
  file.register.forEach((r, n) => {
    const k = krFor(r.code, r.objective, r.krTitle, r.team);
    if (!r.kr) return;
    const { unit, sub } = unitFor(r.unit, r.scope);
    const role = key(r.role) === 'lead' ? 'Lead' : key(r.role).startsWith('contrib') ? 'Contributes' : null;
    const fields = { role, unitObjective: r.objectiveText, subTeam: sub, scope: r.scope, owner: r.lead, krId: k.id, order: n } as const;
    const prev = existingByKey.get(keyOf(unit.id, k.id, r.kr));
    if (prev) { acts.push({ ...prev, ...fields }); touched.add(prev.id); report.updated++; return; }
    // échéance écrite dans le KR (« By 31 March 2027 », « By Q2 2027 »…), sinon fin d'année
    const due = parseDueDate(r.kr, year);
    if (due) report.datesFound++;
    const a = withDates(newActivity(ws, { planId, level: unit.type === 'country' ? 'country' : 'global', unitId: unit.id, title: r.kr, ...fields }), iso(year, 1, 1), due ?? iso(year, 12, 31));
    newIds.add(a.id);
    acts.push(a);
  });
  const kept = existing.filter((a) => !touched.has(a.id)).map((a) => ({ ...a }));
  report.kept = kept.length;
  const all = [...acts, ...kept];
  const krIdOf = (code: string) => krs.get(code)?.id;

  /** Meilleure activité correspondant à une ligne de l'analyse (même unité, même Ref, texte le plus proche). */
  const match = (level: Activity['level'], unitLabel: string, code: string, text: string): Activity | null => {
    const p = parseUnitLabel(unitLabel);
    const u = findUnit(units, p.name);
    const kid = krIdOf(code);
    if (!u || !kid) return null;
    const cands = all.filter((a) => a.level === level && a.unitId === u.id && a.krId === kid);
    if (cands.length === 1) return cands[0];
    let best: Activity | null = null;
    let s = 0;
    for (const c of cands) { const x = similarity(c.title, text); if (x > s) { s = x; best = c; } }
    return s >= 0.3 ? best : null;
  };

  // 2. analyse A : KR pays → équipes globales qui le soutiennent
  const fromA = new Set<string>();
  for (const r of file.a) {
    const a = match('country', r.country, r.code, r.kr);
    if (!a) { report.unmatched.push(`Alignement A, ligne ${r.row} : ${r.country} ${r.code} « ${r.kr.slice(0, 60)} »`); continue; }
    const kid = krIdOf(r.code);
    const teamIds = new Set(r.teams.map((t) => findUnit(units, parseUnitLabel(t).name)?.id).filter(Boolean));
    a.parentIds = all.filter((g) => g.level === 'global' && g.krId === kid && teamIds.has(g.unitId)).map((g) => g.id);
    a.alignment = r.status; a.finding = r.finding; a.action = r.action;
    fromA.add(a.id);
  }
  // KR pays absents de la partie A : règle du fichier (équipes globales ayant un KR sous la même Ref)
  for (const a of all.filter((x) => x.level === 'country' && !fromA.has(x.id) && newIds.has(x.id))) {
    a.parentIds = all.filter((g) => g.level === 'global' && g.krId === a.krId).map((g) => g.id);
  }
  // 3. analyse B : KR des équipes globales → pays
  for (const r of file.b) {
    const g = match('global', r.team, r.code, r.kr);
    if (!g) { report.unmatched.push(`Alignement B, ligne ${r.row} : ${r.team} ${r.code} « ${r.kr.slice(0, 60)} »`); continue; }
    g.alignment = r.status; g.finding = r.finding; g.action = r.action;
  }

  const planActs = all;
  const country = planActs.filter((a) => a.level === 'country');
  const global = planActs.filter((a) => a.level === 'global');
  report.globalActivities = acts.filter((a) => a.level === 'global').length - global.filter((a) => touched.has(a.id)).length;
  report.countryActivities = acts.filter((a) => a.level === 'country').length - country.filter((a) => touched.has(a.id)).length;
  report.linked = country.filter((a) => a.parentIds.length).length;
  const orphans = country.filter((a) => !a.parentIds.length);
  report.orphans = orphans.length;
  report.orphanTitles = orphans.map((a) => `${units.find((u) => u.id === a.unitId)?.name} · ${[...krs.values()].find((k) => k.id === a.krId)?.code ?? ''} · ${a.title.slice(0, 90)}`);
  for (const a of country) report.countryStatus[a.alignment ?? 'none'] = (report.countryStatus[a.alignment ?? 'none'] ?? 0) + 1;
  for (const a of global) report.globalStatus[a.alignment ?? 'none'] = (report.globalStatus[a.alignment ?? 'none'] ?? 0) + 1;

  // 4. registre des risques et actions : constats de l'analyse (Partial, Conflict, Gap) et orphelins
  const prevIssues = ws.issues.filter((i) => i.planId === planId);
  const issueKey = (activityId: string | null, source: string, title: string) => `${activityId}|${source}|${title}`;
  const seen = new Set(prevIssues.map((i) => issueKey(i.activityId, i.source, i.title)));
  const newIssues: Issue[] = [];
  const addIssue = (a: Activity, kind: Issue['kind'], source: string, title: string) => {
    const k = issueKey(a.id, source, title);
    if (seen.has(k) || !title) return;
    seen.add(k);
    newIssues.push(newIssue(planId, { activityId: a.id, kind, title, action: a.action, owner: a.owner, dueDate: '', source }));
  };
  for (const a of planActs) {
    const unitName = units.find((u) => u.id === a.unitId)?.name ?? '';
    if (a.level === 'country' && !a.parentIds.length) {
      addIssue(a, 'issue', 'Orphelin · non lié au global', a.finding || `${unitName} : tâche pays sans tâche d’équipe globale sous la même Ref.`);
    } else if (a.alignment && ['partial', 'conflict', 'gap'].includes(a.alignment)) {
      addIssue(a, a.alignment === 'conflict' ? 'issue' : 'risk', `Analyse d’alignement · ${ALIGN_LABEL[a.alignment]}`, a.finding || `${unitName} : ${ALIGN_LABEL[a.alignment]}`);
    }
  }
  report.issues = newIssues.length;

  const objList = [...objectives.values()];
  const krList = [...krs.values()];
  ws = {
    ...ws, units,
    objectives: [...ws.objectives.filter((o) => o.planId !== planId), ...objList],
    krs: [...ws.krs.filter((k) => k.planId !== planId), ...krList],
    activities: [...ws.activities.filter((a) => a.planId !== planId), ...planActs],
    issues: [...ws.issues, ...newIssues],
  };
  return { ws, report };
}
