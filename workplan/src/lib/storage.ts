/**
 * Stockage local (navigateur) avec sauvegarde automatique, plus sauvegarde / restauration JSON.
 * Les données ne quittent pas l'ordinateur. Pour un usage partagé, exporter / importer le fichier JSON,
 * ou brancher un backend (voir README).
 */
import { emptyWorkspace, type Workspace } from '../types';

export const STORAGE_KEY = 'plan-de-travail.workspace';
const KEY = STORAGE_KEY;

export function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyWorkspace();
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
  return { ...base, ...data, settings: { ...base.settings, ...(data.settings ?? {}) }, version: 2 } as Workspace;
}

export function downloadJson(ws: Workspace, name: string) {
  const blob = new Blob([JSON.stringify(ws)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
