/**
 * Consolidation de l'avancement, de bas en haut.
 *
 *  1. Jalon       : Non démarré 0 %, En cours 50 %, Atteint 100 %, En retard = signalé
 *                   (compté settings.lateScore, 0 par défaut), Annulé = exclu.
 *  2. Initiative  : moyenne des jalons échus au trimestre choisi (Q ≤ trimestre courant).
 *  3. KR d'entité : moyenne des initiatives. Si le KR est quantitatif, on calcule aussi
 *                   (réel − baseline) / (cible − baseline), affiché à côté.
 *  4. Objectif d'entité : moyenne de ses KR. Avancement pays/équipe = moyenne de ses objectifs.
 *  5. KR global   : moyenne pondérée des KR liés (Lead 2, Contributes 1, poids modifiable).
 *  6. Objectif global : moyenne de ses KR globaux.
 *
 * RAG : Vert ≥ 70 %, Ambre 40–69 %, Rouge < 40 % OU au moins un jalon en retard dans le périmètre.
 * Une valeur null signifie « pas de donnée » (aucun jalon échu) : elle est ignorée dans les moyennes.
 */
import type { Contribution, Dataset, Milestone, MilestoneStatus, Quarter, Rag, Settings } from '../types';
import { hasPlaceholder } from './import/normalize';

export interface Score {
  progress: number | null; // 0–100
  late: number; // jalons en retard dans le périmètre
  rag: Rag;
}

export interface KrScore extends Score {
  quant: number | null; // avancement quantitatif (0–100) si calculable
}

export interface Computed {
  quarter: Quarter;
  milestone: Map<string, number | null>;
  initiative: Map<string, Score & { quant: number | null; actual: number | null }>;
  entityKr: Map<string, KrScore>;
  entityObjective: Map<string, Score>;
  entity: Map<string, Score>;
  globalKr: Map<string, Score>;
  globalObjective: Map<string, Score>;
}

export function milestoneScore(status: MilestoneStatus, s: Settings): number | null {
  switch (status) {
    case 'not_started': return 0;
    case 'in_progress': return 50;
    case 'achieved': return 100;
    case 'late': return s.lateScore;
    case 'cancelled': return null;
  }
}

export function ragOf(progress: number | null, late: number, s: Settings): Rag {
  if (late > 0) return 'red';
  if (progress === null) return 'none';
  if (progress >= s.rag.green) return 'green';
  if (progress >= s.rag.amber) return 'amber';
  return 'red';
}

export function mean(values: (number | null | undefined)[]): number | null {
  const v = values.filter((x): x is number => typeof x === 'number' && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

export function weightedMean(pairs: [number | null, number][]): number | null {
  let sw = 0;
  let sx = 0;
  for (const [x, w] of pairs) {
    if (x === null || !Number.isFinite(x) || w <= 0) continue;
    sw += w;
    sx += x * w;
  }
  return sw ? sx / sw : null;
}

export const contributionWeight = (c: Contribution, s: Settings) => c.weight ?? s.weights[c.role];

const clamp = (x: number) => Math.max(0, Math.min(100, x));

export function compute(ds: Dataset, quarter: Quarter = ds.settings.currentQuarter): Computed {
  const s = ds.settings;
  const score = (progress: number | null, late: number): Score => ({ progress, late, rag: ragOf(progress, late, s) });
  const msByInit = new Map<string, Milestone[]>();
  for (const m of ds.milestones) {
    if (!msByInit.has(m.initiativeId)) msByInit.set(m.initiativeId, []);
    msByInit.get(m.initiativeId)!.push(m);
  }

  const milestone = new Map<string, number | null>();
  for (const m of ds.milestones) milestone.set(m.id, milestoneScore(m.status, s));

  // 2. initiatives
  const initiative: Computed['initiative'] = new Map();
  for (const i of ds.initiatives) {
    const due = (msByInit.get(i.id) ?? []).filter((m) => m.quarter <= quarter && m.status !== 'cancelled');
    const late = due.filter((m) => m.status === 'late').length;
    // dernière valeur réelle saisie (jalon le plus récent qui en a une)
    const withActual = (msByInit.get(i.id) ?? []).filter((m) => m.actualValue !== null && m.quarter <= quarter).sort((a, b) => b.quarter - a.quarter);
    const actual = withActual[0]?.actualValue ?? null;
    let quant: number | null = null;
    if (actual !== null && i.target !== null) {
      const base = i.baselineValue ?? 0;
      if (i.target !== base) quant = clamp(((actual - base) / (i.target - base)) * 100);
    }
    initiative.set(i.id, { ...score(mean(due.map((m) => milestone.get(m.id))), late), quant, actual });
  }

  // 3. KR d'entité
  const entityKr: Computed['entityKr'] = new Map();
  for (const k of ds.entityKrs) {
    const inits = ds.initiatives.filter((i) => i.entityKrId === k.id).map((i) => initiative.get(i.id)!);
    const late = inits.reduce((a, b) => a + b.late, 0);
    entityKr.set(k.id, { ...score(mean(inits.map((x) => x.progress)), late), quant: mean(inits.map((x) => x.quant)) });
  }

  // 4. objectifs d'entité et entités
  const entityObjective: Computed['entityObjective'] = new Map();
  for (const o of ds.entityObjectives) {
    const ks = ds.entityKrs.filter((k) => k.objectiveId === o.id).map((k) => entityKr.get(k.id)!);
    entityObjective.set(o.id, score(mean(ks.map((x) => x.progress)), ks.reduce((a, b) => a + b.late, 0)));
  }
  const entity: Computed['entity'] = new Map();
  for (const e of ds.entities) {
    const objs = ds.entityObjectives.filter((o) => o.entityId === e.id).map((o) => entityObjective.get(o.id)!);
    const orphanKrs = ds.entityKrs.filter((k) => k.entityId === e.id && !k.objectiveId).map((k) => entityKr.get(k.id)!);
    const parts = [...objs, ...orphanKrs];
    entity.set(e.id, score(mean(parts.map((x) => x.progress)), parts.reduce((a, b) => a + b.late, 0)));
  }

  // 5. KR globaux (moyenne pondérée)
  const globalKr: Computed['globalKr'] = new Map();
  for (const g of ds.globalKrs) {
    const links = ds.contributions.filter((c) => c.globalKrId === g.id);
    const parts = links.map((c) => [entityKr.get(c.entityKrId)?.progress ?? null, contributionWeight(c, s)] as [number | null, number]);
    const late = links.reduce((a, c) => a + (entityKr.get(c.entityKrId)?.late ?? 0), 0);
    globalKr.set(g.id, score(weightedMean(parts), late));
  }

  // 6. objectifs globaux
  const globalObjective: Computed['globalObjective'] = new Map();
  for (const o of ds.globalObjectives) {
    const ks = ds.globalKrs.filter((g) => g.objectiveId === o.id).map((g) => globalKr.get(g.id)!);
    globalObjective.set(o.id, score(mean(ks.map((x) => x.progress)), ks.reduce((a, b) => a + b.late, 0)));
  }

  return { quarter, milestone, initiative, entityKr, entityObjective, entity, globalKr, globalObjective };
}

// ------------------------------------------------------------------ alertes

export interface Alert {
  kind: 'late' | 'no_data' | 'placeholder' | 'no_lead' | 'no_initiative';
  label: string;
  detail: string;
  link: string;
  entityId?: string;
}

export function alerts(ds: Dataset, c: Computed): Alert[] {
  const out: Alert[] = [];
  const ent = new Map(ds.entities.map((e) => [e.id, e]));
  const init = new Map(ds.initiatives.map((i) => [i.id, i]));
  for (const g of ds.globalKrs) {
    if (!ds.contributions.some((x) => x.globalKrId === g.id && x.role === 'Lead')) {
      out.push({ kind: 'no_lead', label: `${g.id} sans pays/équipe Lead`, detail: g.title, link: `/kr/${encodeURIComponent(g.id)}` });
    }
  }
  for (const m of ds.milestones) {
    if (m.status === 'late' && m.quarter <= c.quarter) {
      const i = init.get(m.initiativeId);
      out.push({
        kind: 'late', label: `Jalon Q${m.quarter} en retard · ${ent.get(m.entityId)?.name ?? ''}`,
        detail: `${i?.title ?? ''} : ${m.description}`, link: `/check-in?initiative=${encodeURIComponent(m.initiativeId)}`, entityId: m.entityId,
      });
    }
  }
  for (const k of ds.entityKrs) {
    const e = ent.get(k.entityId);
    const link = e?.type === 'Country' ? `/pays/${k.entityId}` : `/equipe/${k.entityId}`;
    const inits = ds.initiatives.filter((i) => i.entityKrId === k.id);
    if (!inits.length) {
      out.push({ kind: 'no_initiative', label: `KR sans initiative · ${e?.name ?? ''}`, detail: k.title, link, entityId: k.entityId });
    } else if (c.entityKr.get(k.id)?.progress === null) {
      out.push({ kind: 'no_data', label: `KR sans données au Q${c.quarter} · ${e?.name ?? ''}`, detail: k.title, link, entityId: k.entityId });
    }
    const ms = ds.milestones.filter((m) => inits.some((i) => i.id === m.initiativeId));
    if (hasPlaceholder(k.title, ...inits.map((i) => i.baseline), ...ms.map((m) => m.description))) {
      out.push({ kind: 'placeholder', label: `Cible non définie ([X], TBC…) · ${e?.name ?? ''}`, detail: k.title, link, entityId: k.entityId });
    }
  }
  return out;
}

export function krHasPlaceholder(ds: Dataset, krId: string): boolean {
  const k = ds.entityKrs.find((x) => x.id === krId);
  if (!k) return false;
  const inits = ds.initiatives.filter((i) => i.entityKrId === krId);
  const ms = ds.milestones.filter((m) => inits.some((i) => i.id === m.initiativeId));
  return hasPlaceholder(k.title, ...inits.map((i) => i.baseline), ...ms.map((m) => m.description));
}
