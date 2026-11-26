/**
 * Stockage local (navigateur) avec sauvegarde automatique, plus sauvegarde / restauration JSON.
 * Les données ne quittent pas l'ordinateur. Pour un usage partagé, exporter / importer le fichier JSON,
 * ou brancher un backend (voir README).
 */
import { emptyWorkspace, OBJECTIVE_COLORS, type Workspace } from '../types';

const OLD_COLORS = ['#2563eb', '#0d9488', '#7c3aed', '#c2410c', '#0891b2', '#4f46e5'];

export const STORAGE_KEY = 'plan-de-travail.workspace';
const KEY = STORAGE_KEY;

declare global { interface Window { __SEED__?: Partial<Workspace> } }

/** Données intégrées au fichier HTML pré-rempli (npm run build:single -- --seed plan.json), utilisées au premier lancement. */
function seed(): Workspace {
  try { return window.__SEED__ ? normalize(window.__SEED__) : emptyWorkspace(); } catch { return emptyWorkspace(); }
}

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyWorkspace();
  }
}

export function saveWorkspace(ws: Workspace): string | null {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
    return null;
  } catch {
    return 'Enregistrement impossible dans ce navigateur (stockage plein ou bloqué). Exportez une sauvegarde JSON.';
  }
}

/** Complète un fichier ancien ou partiel avec les champs par défaut. */
export function normalize(data: Partial<Workspace>): Workspace {
  const base = emptyWorkspace();
  if (!data || typeof data !== 'object' || !Array.isArray(data.plans)) throw new Error('Fichier de sauvegarde invalide.');
  const y = (planId: string) => data.plans?.find((p) => p.id === planId)?.year ?? new Date().getFullYear();
  return {
    ...base, ...data, issues: data.issues ?? [],
    // anciennes couleurs d'objectif → palette Living Goods
    objectives: (data.objectives ?? []).map((o) => (OLD_COLORS.includes(o.color.toLowerCase()) ? { ...o, color: OBJECTIVE_COLORS[(Number(o.code) - 1 + OBJECTIVE_COLORS.length) % OBJECTIVE_COLORS.length] ?? OBJECTIVE_COLORS[0] } : o)),
    // anciennes sauvegardes : dates déduites des trimestres
    activities: (data.activities ?? []).map((a) => ({
      ...a,
      priority: a.priority ?? 'medium', milestone: a.milestone ?? false,
      startDate: a.startDate || `${y(a.planId)}-${String((a.startQ - 1) * 3 + 1).padStart(2, '0')}-01`,
      dueDate: a.dueDate || new Date(Date.UTC(y(a.planId), a.endQ * 3, 0)).toISOString().slice(0, 10),
    })),
    settings: { ...base.settings, ...(data.settings ?? {}) }, version: 2,
  } as Workspace;
}

export function downloadJson(ws: Workspace, name: string) {
  const blob = new Blob([JSON.stringify(ws)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
