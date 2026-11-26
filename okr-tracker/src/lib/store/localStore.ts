/**
 * Mode local (version 1) : tout est dans le localStorage du navigateur.
 * Pas d'authentification réelle : on choisit un utilisateur simulé pour tester les droits.
 * Pour un usage partagé (plusieurs personnes, droits réels), utiliser le mode Supabase.
 */
import { emptyDataset, type AppUser, type Dataset } from '../../types';
import type { Store } from './types';

const K_DATA = 'okr2027.dataset';
const K_USERS = 'okr2027.users';
const K_ME = 'okr2027.me';

const DEFAULT_USERS: AppUser[] = [
  { id: 'admin', email: 'pmo@exemple.org', name: 'Admin Strategy/PMO', role: 'admin', entityIds: [] },
  { id: 'viewer', email: 'direction@exemple.org', name: 'Lecteur (direction)', role: 'viewer', entityIds: [] },
];

function read<T>(k: string, fallback: T): T {
  try {
    const v = localStorage.getItem(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(k: string, v: unknown) {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch (e) {
    throw new Error('Enregistrement impossible dans le navigateur (stockage plein ou bloqué).');
  }
}

export function createLocalStore(): Store {
  let ds: Dataset = read(K_DATA, emptyDataset());
  const save = () => write(K_DATA, ds);
  const users = () => read<AppUser[]>(K_USERS, DEFAULT_USERS);
  return {
    mode: 'local',
    async load() {
      const raw = read<Partial<Dataset>>(K_DATA, emptyDataset());
      const base = emptyDataset();
      // compatibilité avec une sauvegarde antérieure (sans indicateurs ni rattachement)
      ds = {
        ...base, ...raw,
        indicators: raw.indicators ?? [], indicatorValues: raw.indicatorValues ?? [],
        entityKrs: (raw.entityKrs ?? []).map((k) => ({ ...k, departmentId: k.departmentId ?? null })),
        settings: { ...base.settings, ...(raw.settings ?? {}) },
      } as Dataset;
      return ds;
    },
    async saveDataset(next) {
      ds = next;
      save();
    },
    async checkIn(u) {
      ds = {
        ...ds,
        updates: [...ds.updates, u],
        milestones: ds.milestones.map((m) => (m.id === u.milestoneId
          ? { ...m, status: u.status, evidenceUrl: u.evidenceUrl, comment: u.comment, updatedAt: u.at, updatedBy: u.by }
          : m)),
      };
      save();
    },
    async updateSettings(s) {
      ds = { ...ds, settings: s };
      save();
    },
    async updateContributionWeight(id, weight) {
      ds = { ...ds, contributions: ds.contributions.map((c) => (c.id === id ? { ...c, weight } : c)) };
      save();
    },
    async updateInitiative(id, patch) {
      ds = { ...ds, initiatives: ds.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)) };
      save();
    },
    async setKrDepartment(krId, departmentId) {
      ds = { ...ds, entityKrs: ds.entityKrs.map((k) => (k.id === krId ? { ...k, departmentId, departmentSource: 'manual' as const } : k)) };
      save();
    },
    async saveIndicator(ind) {
      const exists = ds.indicators.some((i) => i.id === ind.id);
      ds = { ...ds, indicators: exists ? ds.indicators.map((i) => (i.id === ind.id ? ind : i)) : [...ds.indicators, ind] };
      save();
    },
    async deleteIndicator(id) {
      ds = { ...ds, indicators: ds.indicators.filter((i) => i.id !== id), indicatorValues: ds.indicatorValues.filter((v) => v.indicatorId !== id) };
      save();
    },
    async addIndicatorValue(v) {
      ds = { ...ds, indicatorValues: [...ds.indicatorValues, v] };
      save();
    },
    async currentUser() {
      const id = read<string>(K_ME, 'admin');
      return users().find((u) => u.id === id) ?? users()[0] ?? null;
    },
    async signIn(id) {
      write(K_ME, id);
      return null;
    },
    async signOut() {
      write(K_ME, 'viewer');
    },
    async listUsers() {
      return users();
    },
    async saveUser(u) {
      const list = users();
      const i = list.findIndex((x) => x.id === u.id);
      if (i >= 0) list[i] = u;
      else list.push(u);
      write(K_USERS, list);
    },
    async deleteUser(id) {
      write(K_USERS, users().filter((u) => u.id !== id));
    },
  };
}
