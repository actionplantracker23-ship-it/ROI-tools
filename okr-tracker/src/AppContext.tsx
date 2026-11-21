import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { mergeDataset } from './lib/merge';
import { compute, type Computed } from './lib/progress';
import { createStore, type Store } from './lib/store';
import { emptyDataset, type AppUser, type Dataset, type Initiative, type MilestoneUpdate, type Quarter, type Settings } from './types';

interface Ctx {
  store: Store;
  ds: Dataset;
  computed: Computed;
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
  updateInitiative: (id: string, patch: Partial<Pick<Initiative, 'target' | 'targetCountryIds'>>) => Promise<void>;
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
    importDataset: async (next) => {
      const merged = mergeDataset(ds, next);
      await run(() => store.saveDataset(merged), () => merged, 'Import terminé.');
      if (store.mode === 'supabase') await reload();
    },
    checkIn: (u) => run(() => store.checkIn(u), (d) => ({
      ...d,
      updates: [...d.updates, u],
      milestones: d.milestones.map((m) => (m.id === u.milestoneId
        ? { ...m, status: u.status, actualValue: u.actualValue, evidenceUrl: u.evidenceUrl, comment: u.comment, updatedAt: u.at, updatedBy: u.by }
        : m)),
    }), 'Check-in enregistré.'),
    updateSettings: (s) => run(() => store.updateSettings(s), (d) => ({ ...d, settings: s }), 'Paramètres enregistrés.'),
    updateWeight: (id, w) => run(() => store.updateContributionWeight(id, w),
      (d) => ({ ...d, contributions: d.contributions.map((c) => (c.id === id ? { ...c, weight: w } : c)) })),
    updateInitiative: (id, patch) => run(() => store.updateInitiative(id, patch),
      (d) => ({ ...d, initiatives: d.initiatives.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const c = useContext(AppCtx);
  if (!c) throw new Error('useApp hors AppProvider');
  return c;
}
