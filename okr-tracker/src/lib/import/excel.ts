/**
 * Import du classeur "2027 OKR Consolidated Plans_V2.xlsx" (SheetJS, côté client).
 *
 * Étapes :
 *  1. "Ref Global OKRs"        → 4 objectifs globaux et 20 KR globaux.
 *  2. Onglets de plan          → KR pays/équipe, objectifs d'entité, initiatives, jalons Q1–Q4.
 *     ("2 Kenya" … "4c Zambia", "5 Global Programs", "6 GSE" … "11 P&C")
 *     - les cellules fusionnées sont dépliées (!merges), puis les colonnes Ref / KR / objectif /
 *       KR Lead / Team-Unit sont propagées vers le bas : une cellule vide = initiative
 *       supplémentaire du KR situé au-dessus ;
 *     - les lignes "OBJECTIVE X · …" sont des en-têtes de section, pas des données.
 *  3. "1 OKR Register"         → liens KR global ↔ KR pays/équipe avec rôle Lead | Contributes.
 *  4. "Annex A …", "Annex B …" → tableaux de référence affichés tels quels.
 *  5. Rapport d'import : KR et initiatives par onglet, contrôles (20 KR globaux, ~100 KR d'entité).
 *
 * Le module ne dépend que de SheetJS : il tourne dans le navigateur, dans Node (scripts/) et dans les tests.
 */
import * as XLSX from 'xlsx';
import type {
  AnnexTable, Contribution, Dataset, Entity, EntityKR, EntityObjective, GlobalKR,
  ImportReport, Initiative, Quarter, Role, Scope, SheetReport,
} from '../../types';
import { emptyDataset } from '../../types';
import {
  clean, detectCountries, hash, isSectionHeader, key, KNOWN_ENTITIES, parseBudget,
  parseMetric, parseRefs, resolveEntity, slug, type EntityDef,
} from './normalize';

export const OBJECTIVE_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0891b2', '#4f46e5']; // validée (daltonisme, contraste)

type Grid = string[][];

// ------------------------------------------------------------------ lecture d'un onglet

/** Convertit un onglet en grille de textes, en recopiant la valeur des cellules fusionnées. */
export function sheetToGrid(ws: XLSX.WorkSheet): Grid {
  const merges = ws['!merges'] ?? [];
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '', raw: false, blankrows: true }) as unknown[][];
  // sheet_to_json commence à la première ligne de la plage utilisée : on recale les fusions dessus
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  const out: Grid = grid.map((r) => r.map(clean));
  for (const m of merges) {
    const top = out[m.s.r - range.s.r]?.[m.s.c - range.s.c] ?? '';
    for (let r = m.s.r; r <= m.e.r; r++) {
      const rr = r - range.s.r;
      while (out.length <= rr) out.push([]);
      for (let c = m.s.c; c <= m.e.c; c++) out[rr][c - range.s.c] = top;
    }
  }
  return out;
}

// ------------------------------------------------------------------ colonnes

type PlanField =
  | 'ref' | 'globalKr' | 'teamUnit' | 'objective' | 'kr' | 'krLead' | 'initiative' | 'initiativeLead'
  | 'baseline' | 'metric' | 'evidence' | 'q1' | 'q2' | 'q3' | 'q4' | 'budget';
type RegisterField = 'ref' | 'globalKr' | 'entity' | 'role' | 'objective' | 'kr' | 'krLead' | 'scope';

/** Ordre important : les intitulés les plus spécifiques sont réclamés en premier. */
const PLAN_ALIASES: [PlanField, string[]][] = [
  ['initiativeLead', ['initiative lead', 'initiative owner']],
  ['krLead', ['kr lead', 'key result lead', 'kr owner']],
  ['globalKr', ['global key result', 'global kr']],
  ['evidence', ['evidence source and rule', 'evidence source', 'evidence']],
  ['q1', ['q1 milestone', 'q1']],
  ['q2', ['q2 milestone', 'q2']],
  ['q3', ['q3 milestone', 'q3']],
  ['q4', ['q4 milestone', 'q4']],
  ['budget', ['indicative budget', 'budget']],
  ['baseline', ['current baseline', 'baseline']],
  ['metric', ['metric', 'metric type']],
  ['objective', ['country team objective', 'country objective', 'team objective', 'objective']],
  ['kr', ['country team key result', 'country key result', 'team key result', 'key result', 'kr']],
  ['initiative', ['initiative', 'initiatives']],
  ['teamUnit', ['team unit', 'team', 'unit', 'sub unit']],
  ['ref', ['ref', 'reference', 'ref global kr']],
];
const REGISTER_ALIASES: [RegisterField, string[]][] = [
  ['krLead', ['kr lead', 'key result lead']],
  ['globalKr', ['global key result', 'global kr']],
  ['objective', ['country team objective', 'country objective', 'team objective', 'objective']],
  ['kr', ['country team key result', 'country key result', 'team key result', 'key result']],
  ['entity', ['country team', 'country', 'team', 'entity']],
  ['role', ['role']],
  ['scope', ['scope']],
  ['ref', ['ref', 'reference']],
];

function mapColumns<F extends string>(header: string[], aliases: [F, string[]][]): Partial<Record<F, number>> {
  const keys = header.map(key);
  const claimed = new Set<number>();
  const map: Partial<Record<F, number>> = {};
  // 1er passage : correspondance exacte ; 2e passage : l'intitulé commence par l'alias ; 3e : le contient
  const tests: ((h: string, a: string) => boolean)[] = [
    (h, a) => h === a,
    (h, a) => h.startsWith(a + ' '),
    (h, a) => a.length > 3 && h.includes(a),
  ];
  for (const test of tests) {
    for (const [field, list] of aliases) {
      if (map[field] !== undefined) continue;
      for (const a of list) {
        const idx = keys.findIndex((h, i) => !claimed.has(i) && h && test(h, a));
        if (idx >= 0) {
          map[field] = idx;
          claimed.add(idx);
          break;
        }
      }
    }
  }
  return map;
}

/** Repère la ligne d'en-tête dans les 25 premières lignes (présence de "Ref" et d'un "Key Result"). */
function findHeaderRow(grid: Grid): number {
  for (let r = 0; r < Math.min(grid.length, 25); r++) {
    const keys = grid[r].map(key);
    if (keys.some((k) => k === 'ref' || k.startsWith('ref ')) && keys.some((k) => k.includes('key result'))) return r;
  }
  return -1;
}

const cell = <F extends string>(row: string[], map: Partial<Record<F, number>>, f: F): string =>
  map[f] === undefined ? '' : clean(row[map[f]!]);

// ------------------------------------------------------------------ objectifs et KR globaux

function parseGlobalRef(grid: Grid) {
  const objectives = new Map<number, string>();
  const krs = new Map<string, string>();
  for (const row of grid) {
    const cells = row.map(clean);
    cells.forEach((c, i) => {
      const nextText = () => cells.slice(i + 1).find((x) => x && !/^KR\s*\d/i.test(x) && !/^objective\s*\d/i.test(x)) ?? '';
      const o = c.match(/^(?:global\s+)?objective\s*(\d)\s*[:·.\-–—|]?\s*([\s\S]*)$/i);
      if (o && !objectives.has(Number(o[1]))) {
        const title = clean(o[2]) || nextText();
        if (title) objectives.set(Number(o[1]), title);
      }
      const k = c.match(/^KR\s*(\d{1,2})\s*\.\s*(\d{1,2})\s*[:·.\-–—|]?\s*([\s\S]*)$/i);
      if (k) {
        const id = `KR${Number(k[1])}.${Number(k[2])}`;
        const title = clean(k[3]) || nextText();
        if (title && !krs.has(id)) krs.set(id, title);
      }
    });
  }
  return { objectives, krs };
}

// ------------------------------------------------------------------ onglets de plan

interface PlanRow {
  sheet: string;
  entity: EntityDef;
  refs: string[];
  globalKr: string;
  teamUnit: string;
  objective: string;
  kr: string;
  krLead: string;
  initiative: string;
  initiativeLead: string;
  baseline: string;
  metric: string;
  evidence: string;
  q: [string, string, string, string];
  budget: string;
}

const CARRY: PlanField[] = ['ref', 'globalKr', 'teamUnit', 'objective', 'kr', 'krLead'];

/** Lit un onglet de plan et propage les cellules vides vers le bas. */
function parsePlanSheet(sheet: string, grid: Grid, defaultEntity: EntityDef | null, report: SheetReport, sectionTitles: Map<number, string>): PlanRow[] {
  const h = findHeaderRow(grid);
  if (h < 0) {
    report.warnings.push("Ligne d'en-tête introuvable (colonnes Ref / Key Result).");
    return [];
  }
  const map = mapColumns(grid[h], PLAN_ALIASES);
  for (const f of ['kr', 'initiative', 'q1'] as PlanField[]) {
    if (map[f] === undefined) report.warnings.push(`Colonne « ${f} » non trouvée.`);
  }
  const rows: PlanRow[] = [];
  let carry: Partial<Record<PlanField, string>> = {};
  for (let r = h + 1; r < grid.length; r++) {
    const row = grid[r];
    const nonEmpty = row.map(clean).filter(Boolean);
    if (nonEmpty.length === 0) continue;
    report.rows++;
    if (isSectionHeader(nonEmpty[0])) {
      report.sectionHeaders++;
      const m = nonEmpty[0].match(/OBJECTIVE\s*(\d+)\s*[·:.\-–—|]?\s*(.*)$/i);
      if (m && m[2] && !sectionTitles.has(Number(m[1]))) sectionTitles.set(Number(m[1]), clean(m[2]));
      carry = {}; // une nouvelle section ne prolonge pas le KR précédent
      continue;
    }
    const v = {} as Record<PlanField, string>;
    for (const [f] of PLAN_ALIASES) v[f] = cell(row, map, f);
    // Propagation vers le bas : une nouvelle valeur de KR réinitialise l'héritage des colonnes de détail
    for (const f of CARRY) {
      if (v[f]) carry[f] = v[f];
      else v[f] = carry[f] ?? '';
    }
    const hasDetail = v.initiative || v.q1 || v.q2 || v.q3 || v.q4;
    if (!v.kr) {
      if (hasDetail) report.warnings.push(`Ligne ${r + 1} : initiative sans KR au-dessus, ignorée.`);
      continue;
    }
    const entity = defaultEntity ?? resolveEntity(v.teamUnit) ?? resolveEntity(sheet.replace(/^\s*\d+[a-z]?\s+/i, ''));
    if (!entity) {
      report.warnings.push(`Ligne ${r + 1} : entité non reconnue (« ${v.teamUnit} »), ignorée.`);
      continue;
    }
    rows.push({
      sheet, entity, refs: parseRefs(v.ref), globalKr: v.globalKr, teamUnit: v.teamUnit, objective: v.objective,
      kr: v.kr, krLead: v.krLead, initiative: v.initiative, initiativeLead: v.initiativeLead, baseline: v.baseline,
      metric: v.metric, evidence: v.evidence, q: [v.q1, v.q2, v.q3, v.q4], budget: v.budget,
    });
  }
  return rows;
}

/** Rapprochement d'un KR du registre avec un KR d'onglet : identique, inclus, ou mots communs ≥ 60 %. */
function similar(a: string, b: string): number {
  const ka = key(a);
  const kb = key(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 1;
  if (ka.length > 20 && kb.length > 20 && (ka.includes(kb) || kb.includes(ka))) return 0.95;
  const ta = new Set(ka.split(' '));
  const tb = new Set(kb.split(' '));
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Les années (2024–2035) ne sont ni des baselines ni des cibles. */
function numberNotYear(text: string, last: boolean): number | null {
  const nums = (clean(text).replace(/(\d)[ ,](?=\d{3}\b)/g, '$1').match(/-?\d+(?:[.,]\d+)?/g) ?? [])
    .map((s) => Number(s.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && !(Number.isInteger(n) && n >= 2024 && n <= 2035));
  if (!nums.length) return null;
  return last ? nums[nums.length - 1] : nums[0];
}

// ------------------------------------------------------------------ point d'entrée

export interface ParseResult {
  dataset: Dataset;
  report: ImportReport;
}

export function parseWorkbook(wb: XLSX.WorkBook, fileName = 'classeur.xlsx'): ParseResult {
  const ds = emptyDataset();
  const warnings: string[] = [];
  const sheetReports: SheetReport[] = [];
  const names = wb.SheetNames;
  const find = (pred: (k: string) => boolean) => names.find((n) => pred(key(n)));
  const newReport = (sheet: string, found = true): SheetReport =>
    ({ sheet, found, rows: 0, sectionHeaders: 0, krs: 0, initiatives: 0, milestones: 0, warnings: [] });

  // 1. Référentiel global ------------------------------------------------------------------
  const refName = find((k) => k.includes('ref global') || k.includes('global okr'));
  const refReport = newReport(refName ?? 'Ref Global OKRs', !!refName);
  const ref = refName ? parseGlobalRef(sheetToGrid(wb.Sheets[refName])) : { objectives: new Map<number, string>(), krs: new Map<string, string>() };
  refReport.krs = ref.krs.size;
  if (!refName) refReport.warnings.push('Onglet « Ref Global OKRs » absent.');

  // 2. Onglets de plan -----------------------------------------------------------------------
  const registerName = find((k) => k.includes('register'));
  const sectionTitles = new Map<number, string>();
  const planRows: PlanRow[] = [];
  const planSheets = names.filter((n) => n !== refName && n !== registerName && !key(n).startsWith('annex'));
  for (const name of planSheets) {
    const grid = sheetToGrid(wb.Sheets[name]);
    if (findHeaderRow(grid) < 0) continue; // onglet sans tableau de plan (notes, sommaire…)
    const stripped = name.replace(/^\s*\d+[a-z]?\s+/i, '');
    const isGlobalPrograms = key(stripped).includes('global programs');
    const def = isGlobalPrograms ? null : resolveEntity(stripped);
    const rep = newReport(name);
    if (!def && !isGlobalPrograms) rep.warnings.push('Entité non reconnue depuis le nom de l’onglet : déduite de la colonne Team/Unit.');
    planRows.push(...parsePlanSheet(name, grid, def, rep, sectionTitles));
    sheetReports.push(rep);
  }
  for (const expected of ['Kenya', 'Burkina Faso', 'Uganda', 'Benin', 'Zambia', 'Global Programs', 'GSE', 'DHGP', 'BDAC', 'Finance', 'DT', 'P&C']) {
    if (!planSheets.some((n) => key(n).includes(key(expected)) || (expected === 'DT' && / dt$/.test(' ' + key(n))))) {
      warnings.push(`Onglet de plan attendu non trouvé : ${expected}.`);
    }
  }

  // Objectifs et KR globaux (fallback : titres des en-têtes de section "OBJECTIVE X · …")
  const objNums = new Set<number>([...ref.objectives.keys(), ...[...ref.krs.keys()].map((k) => Number(k.slice(2).split('.')[0]))]);
  for (const n of [...objNums].sort((a, b) => a - b)) {
    const title = ref.objectives.get(n) ?? sectionTitles.get(n) ?? `Objective ${n}`;
    ds.globalObjectives.push({ id: `O${n}`, code: `Objective ${n}`, title, color: OBJECTIVE_COLORS[(n - 1) % OBJECTIVE_COLORS.length] });
  }
  const krSort = (a: string, b: string) => {
    const [a1, a2] = a.slice(2).split('.').map(Number);
    const [b1, b2] = b.slice(2).split('.').map(Number);
    return a1 - b1 || a2 - b2;
  };
  for (const id of [...ref.krs.keys()].sort(krSort)) {
    ds.globalKrs.push({ id, objectiveId: `O${id.slice(2).split('.')[0]}`, title: ref.krs.get(id)! });
  }
  const globalKrIds = new Set(ds.globalKrs.map((k) => k.id));
  /** KR global à partir du texte quand la colonne Ref est vide. */
  const globalKrByText = (text: string): string | null => {
    let best: GlobalKR | null = null;
    let score = 0;
    for (const g of ds.globalKrs) {
      const s = similar(g.title, text);
      if (s > score) { score = s; best = g; }
    }
    return score >= 0.6 && best ? best.id : null;
  };

  // Entités, objectifs, KR, initiatives, jalons
  const entities = new Map<string, Entity>();
  const ensureEntity = (def: EntityDef, sheet?: string) => {
    if (!entities.has(def.id)) entities.set(def.id, { id: def.id, name: def.name, type: def.type, group: def.group, sheet });
    return entities.get(def.id)!;
  };
  const objectives = new Map<string, EntityObjective>();
  const ensureObjective = (entityId: string, title: string): string | null => {
    if (!title) return null;
    const id = `${entityId}-o-${hash(key(title))}`;
    if (!objectives.has(id)) objectives.set(id, { id, entityId, title });
    return id;
  };
  const krs = new Map<string, EntityKR>();
  const krRefs = new Map<string, Set<string>>(); // liens issus de la colonne Ref
  const initiatives = new Map<string, Initiative>();
  const initKeys = new Set<string>();
  const krId = (entityId: string, title: string) => `${entityId}-kr-${hash(key(title))}`;
  const repBySheet = new Map(sheetReports.map((r) => [r.sheet, r]));
  const krsBySheet = new Map<string, Set<string>>();

  for (const row of planRows) {
    const rep = repBySheet.get(row.sheet)!;
    const ent = ensureEntity(row.entity, row.sheet);
    const id = krId(ent.id, row.kr);
    if (!krs.has(id)) {
      krs.set(id, {
        id, entityId: ent.id, objectiveId: ensureObjective(ent.id, row.objective), title: row.kr, lead: row.krLead,
        teamUnit: row.teamUnit || undefined,
      });
    }
    if (!krsBySheet.has(row.sheet)) krsBySheet.set(row.sheet, new Set());
    krsBySheet.get(row.sheet)!.add(id);
    const refs = row.refs.length ? row.refs : [globalKrByText(row.globalKr)].filter((x): x is string => !!x);
    for (const r of refs) {
      if (!globalKrIds.has(r)) {
        rep.warnings.push(`Référence ${r} inconnue dans « Ref Global OKRs ».`);
        continue;
      }
      if (!krRefs.has(id)) krRefs.set(id, new Set());
      krRefs.get(id)!.add(r);
    }

    if (!(row.initiative || row.q.some(Boolean))) continue; // KR sans initiative sur cette ligne
    const dedupeKey = [id, key(row.initiative), ...row.q.map(key)].join('|');
    if (initKeys.has(dedupeKey)) {
      rep.warnings.push(`Initiative en double ignorée : « ${row.initiative.slice(0, 60)} ».`);
      continue;
    }
    initKeys.add(dedupeKey);
    let iid = `${id}-i-${hash(key(row.initiative))}`;
    for (let n = 2; initiatives.has(iid); n++) iid = `${id}-i-${hash(key(row.initiative))}-${n}`;
    const metric = parseMetric(row.metric);
    const numeric = metric === 'Numeric' || metric === 'Percentage';
    const order = [...initiatives.values()].filter((i) => i.entityKrId === id).length;
    const targetCountries = ent.type === 'GlobalTeam'
      ? detectCountries([row.teamUnit, row.kr, row.initiative, ...row.q].join(' \n '))
      : [];
    initiatives.set(iid, {
      id: iid, entityKrId: id, entityId: ent.id,
      title: row.initiative || `Initiative ${order + 1}`, lead: row.initiativeLead || row.krLead, teamUnit: row.teamUnit || undefined,
      baseline: row.baseline, baselineValue: numeric ? numberNotYear(row.baseline, false) : null,
      target: numeric ? numberNotYear(row.q[3], true) : null,
      metric, evidenceRule: row.evidence, budget: row.budget, budgetValue: parseBudget(row.budget),
      targetCountryIds: targetCountries, order,
    });
    rep.initiatives++;
    row.q.forEach((desc, qi) => {
      if (!desc) return;
      ds.milestones.push({
        id: `${iid}-q${qi + 1}`, initiativeId: iid, entityId: ent.id, quarter: (qi + 1) as Quarter, description: desc,
        status: 'not_started', actualValue: null, evidenceUrl: '', comment: '', updatedAt: null, updatedBy: null,
      });
      rep.milestones++;
    });
  }
  for (const rep of sheetReports) rep.krs = krsBySheet.get(rep.sheet)?.size ?? 0;

  // 3. Registre OKR ---------------------------------------------------------------------------
  const contributions = new Map<string, Contribution>();
  const regReport = newReport(registerName ?? '1 OKR Register', !!registerName);
  if (registerName) {
    const grid = sheetToGrid(wb.Sheets[registerName]);
    const h = findHeaderRow(grid);
    if (h < 0) regReport.warnings.push("Ligne d'en-tête introuvable.");
    else {
      const map = mapColumns(grid[h], REGISTER_ALIASES);
      const carry: Partial<Record<RegisterField, string>> = {};
      for (let r = h + 1; r < grid.length; r++) {
        const nonEmpty = grid[r].filter(Boolean);
        if (!nonEmpty.length) continue;
        regReport.rows++;
        if (isSectionHeader(nonEmpty[0])) { regReport.sectionHeaders++; continue; }
        const v = {} as Record<RegisterField, string>;
        for (const [f] of REGISTER_ALIASES) v[f] = cell(grid[r], map, f);
        for (const f of ['ref', 'globalKr', 'entity'] as RegisterField[]) {
          if (v[f]) carry[f] = v[f];
          else v[f] = carry[f] ?? '';
        }
        if (!v.kr) continue;
        const def = resolveEntity(v.entity);
        if (!def) { regReport.warnings.push(`Ligne ${r + 1} : pays/équipe « ${v.entity} » non reconnu.`); continue; }
        const ent = ensureEntity(def);
        const refs = parseRefs(v.ref).filter((x) => globalKrIds.has(x));
        if (!refs.length) {
          const g = globalKrByText(v.globalKr);
          if (g) refs.push(g);
          else { regReport.warnings.push(`Ligne ${r + 1} : KR global introuvable (« ${v.ref || v.globalKr} »).`); continue; }
        }
        // rapprochement avec un KR des onglets de plan, sinon KR « registre seul »
        let match: EntityKR | null = null;
        let best = 0;
        for (const k of krs.values()) {
          if (k.entityId !== ent.id) continue;
          const s = similar(k.title, v.kr);
          if (s > best) { best = s; match = k; }
        }
        if (!match || best < 0.6) {
          const id = krId(ent.id, v.kr);
          match = krs.get(id) ?? { id, entityId: ent.id, objectiveId: ensureObjective(ent.id, v.objective), title: v.kr, lead: v.krLead, registerOnly: true };
          krs.set(id, match);
        }
        if (!match.lead && v.krLead) match.lead = v.krLead;
        if (!match.objectiveId && v.objective) match.objectiveId = ensureObjective(ent.id, v.objective);
        const role: Role = key(v.role).startsWith('lead') ? 'Lead' : 'Contributes';
        const scope: Scope = v.scope ? (key(v.scope).includes('global') ? 'Global' : 'Pays') : ent.type === 'Country' ? 'Pays' : 'Global';
        for (const g of refs) {
          const cid = `${g}~${match.id}`;
          const prev = contributions.get(cid);
          if (!prev || (prev.role === 'Contributes' && role === 'Lead')) {
            contributions.set(cid, { id: cid, globalKrId: g, entityKrId: match.id, entityId: ent.id, role, weight: null, scope });
          }
        }
        regReport.krs++;
      }
    }
  } else regReport.warnings.push('Onglet « 1 OKR Register » absent : liens déduits de la colonne Ref.');

  // Liens présents dans la colonne Ref d'un onglet mais absents du registre
  let inferred = 0;
  for (const [kid, refs] of krRefs) {
    const k = krs.get(kid)!;
    const ent = entities.get(k.entityId)!;
    for (const g of refs) {
      const cid = `${g}~${kid}`;
      if (contributions.has(cid)) continue;
      contributions.set(cid, {
        id: cid, globalKrId: g, entityKrId: kid, entityId: k.entityId, role: 'Contributes', weight: null,
        scope: ent.type === 'Country' ? 'Pays' : 'Global', inferred: true,
      });
      inferred++;
    }
  }
  if (inferred) warnings.push(`${inferred} lien(s) KR global ↔ KR d'entité trouvés dans les onglets mais absents du registre : ajoutés en « Contributes ».`);

  // 4. Annexes ---------------------------------------------------------------------------------
  const annexes: AnnexTable[] = [];
  for (const n of names.filter((x) => key(x).startsWith('annex'))) {
    const grid = sheetToGrid(wb.Sheets[n]).filter((r) => r.some(Boolean));
    const width = Math.max(0, ...grid.map((r) => { let w = r.length; while (w > 0 && !r[w - 1]) w--; return w; }));
    annexes.push({ id: slug(n), sheet: n, rows: grid.slice(0, 1000).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? '')) });
  }

  // Assemblage ----------------------------------------------------------------------------------
  // les entités connues apparaissent toujours (même sans onglet), dans un ordre stable
  for (const def of KNOWN_ENTITIES) ensureEntity(def);
  const order = new Map(KNOWN_ENTITIES.map((e, i) => [e.id, i]));
  ds.entities = [...entities.values()].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99));
  ds.entityObjectives = [...objectives.values()];
  ds.entityKrs = [...krs.values()];
  ds.initiatives = [...initiatives.values()];
  ds.contributions = [...contributions.values()];
  ds.annexes = annexes;

  const totals = {
    globalObjectives: ds.globalObjectives.length, globalKrs: ds.globalKrs.length, entityKrs: ds.entityKrs.length,
    initiatives: ds.initiatives.length, milestones: ds.milestones.length, contributions: ds.contributions.length,
  };
  const leadless = ds.globalKrs.filter((g) => !ds.contributions.some((c) => c.globalKrId === g.id && c.role === 'Lead'));
  const registerOnly = ds.entityKrs.filter((k) => k.registerOnly);
  const report: ImportReport = {
    fileName,
    importedAt: new Date().toISOString(),
    sheets: [refReport, regReport, ...sheetReports, ...annexes.map((a) => ({ ...newReport(a.sheet), rows: a.rows.length }))],
    totals,
    checks: [
      { label: '4 objectifs globaux', ok: totals.globalObjectives === 4, detail: `${totals.globalObjectives} trouvé(s)` },
      { label: '20 KR globaux', ok: totals.globalKrs === 20, detail: `${totals.globalKrs} trouvé(s)` },
      { label: '≈ 100 KR pays/équipes', ok: totals.entityKrs >= 80 && totals.entityKrs <= 130, detail: `${totals.entityKrs} trouvé(s)` },
      { label: 'Chaque KR global a un Lead', ok: leadless.length === 0, detail: leadless.length ? `Sans Lead : ${leadless.map((g) => g.id).join(', ')}` : 'OK' },
      { label: 'KR du registre retrouvés dans les onglets', ok: registerOnly.length === 0, detail: registerOnly.length ? `${registerOnly.length} KR présents uniquement dans le registre` : 'OK' },
    ],
    warnings,
  };
  ds.lastImport = report;
  return { dataset: ds, report };
}

/** Lecture d'un fichier choisi dans le navigateur. */
export async function parseFile(file: File): Promise<ParseResult> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  return parseWorkbook(wb, file.name);
}

