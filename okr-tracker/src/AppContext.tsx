import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { buildIndexes, type Indexes } from './lib/indexes';
import { mergeDataset } from './lib/merge';
import { compute, type Computed } from './lib/progress';
import { createStore, type Store } from './lib/store';
import { emptyDataset, type AppUser, type Dataset, type Indicator, type IndicatorValue, type Initiative, type MilestoneUpdate, type Quarter, type Settings } from './types';

interface Ctx {
  store: Store;
  ds: Dataset;
  computed: Computed;
  idx: Indexes;
  quarter: Quarter;
  setQuarter: (q: Quarter) => void;
  user: AppUser | null;
  loading: boolean;
  error: string | null;
  setError: (e: string | null) => void;
  notice: string | null;
  notify: (msg: string) => void;
  reload: () => Promise<void>;
  importDataset: (next: Dataset) => Promise<void>;
  checkIn: (u: MilestoneUpdate) => Promise<void>;
  updateSettings: (s: Settings) => Promise<void>;
  updateWeight: (contributionId: string, w: number | null) => Promise<void>;
  updateInitiative: (id: string, patch: Partial<Pick<Initiative, 'targetCountryIds'>>) => Promise<void>;
  setKrDepartment: (krId: string, departmentId: string | null) => Promise<void>;
  saveIndicator: (ind: Indicator) => Promise<void>;
  deleteIndicator: (id: string) => Promise<void>;
  addIndicatorValue: (v: IndicatorValue) => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => createStore(), []);
  const [ds, setDs] = useState<Dataset>(emptyDataset());
  const [quarter, setQuarter] = useState<Quarter>(1);
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice((n) => (n === msg ? null : n)), 3500);
  }, []);

  const refreshUser = useCallback(async () => setUser(await store.currentUser()), [store]);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await store.load();
      setDs(d);
      setQuarter(d.settings.currentQuarter);
      setUser(await store.currentUser());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Exécute une écriture puis recharge (mode Supabase) ou applique localement. */
  const run = useCallback(async (fn: () => Promise<void>, apply: (d: Dataset) => Dataset, ok?: string) => {
    try {
      await fn();
      setDs((d) => apply(d));
      if (ok) notify(ok);
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  }, [notify]);

  const value: Ctx = {
    store, ds, quarter, setQuarter, user, loading, error, setError, notice, notify, reload, refreshUser,
    computed: useMemo(() => compute(ds, quarter), [ds, quarter]),
    idx: useMemo(() => buildIndexes(ds), [ds]),
    importDataset: async (next) => {
      const merged = mergeDataset(ds, next);
      await run(() => store.saveDataset(merged), () => merged, 'Import terminé.');
      if (store.mode === 'supabase') await reload();
    },
    checkIn: (u) => run(() => store.checkIn(u), (d) => ({
      ...d,
      updates: [...d.updates, u],
      milestones: d.milestones.map((m) => (m.id === u.milestoneId
        ? { ...m, status: u.status, evidenceUrl: u.evidenceUrl, comment: u.comment, updatedAt: u.at, updatedBy: u.by }
        : m)),
    }), 'Check-in enregistré.'),
    updateSettings: (s) => run(() => store.updateSettings(s), (d) => ({ ...d, settings: s }), 'Paramètres enregistrés.'),
    updateWeight: (id, w) => run(() => store.updateContributionWeight(id, w),
      (d) => ({ ...d, contributions: d.contributions.map((c) => (c.id === id ? { ...c, weight: w } : c)) })),
    updateInitiative: (id, patch) => run(() => store.updateInitiative(id, patch),
      (d) => ({ ...d, initiatives: d.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
    setKrDepartment: (krId, dep) => run(() => store.setKrDepartment(krId, dep),
      (d) => ({ ...d, entityKrs: d.entityKrs.map((k) => (k.id === krId ? { ...k, departmentId: dep, departmentSource: 'manual' as const } : k)) }), 'Rattachement enregistré.'),
    saveIndicator: (ind) => run(() => store.saveIndicator(ind), (d) => ({
      ...d, indicators: d.indicators.some((i) => i.id === ind.id) ? d.indicators.map((i) => (i.id === ind.id ? ind : i)) : [...d.indicators, ind],
    }), 'Indicateur enregistré.'),
    deleteIndicator: (id) => run(() => store.deleteIndicator(id),
      (d) => ({ ...d, indicators: d.indicators.filter((i) => i.id !== id), indicatorValues: d.indicatorValues.filter((v) => v.indicatorId !== id) }), 'Indicateur supprimé.'),
    addIndicatorValue: (v) => run(() => store.addIndicatorValue(v), (d) => ({ ...d, indicatorValues: [...d.indicatorValues, v] }), 'Valeur enregistrée.'),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp hors AppProvider');
  return c;
}
