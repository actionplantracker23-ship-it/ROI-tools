import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { setLang } from './i18n';
import { computePlan, type PlanView } from './lib/calc';
import { loadWorkspace, saveWorkspace, STORAGE_KEY } from './lib/storage';
import { EMPTY_FILTER, type TaskFilter } from './lib/wbs';
import type { Plan, Quarter, Unit, Workspace } from './types';

interface Ctx {
  ws: Workspace;
  /** Applique une modification ; enregistrement automatique. */
  update: (fn: (ws: Workspace) => Workspace, message?: string) => void;
  replaceAll: (ws: Workspace) => void;
  plan: Plan | null;
  view: PlanView | null;
  quarter: Quarter;
  setQuarter: (q: Quarter) => void;
  unit: (id: string) => Unit | undefined;
  /** Filtre des tâches partagé par toutes les vues (liste, Gantt, Kanban…). */
  filter: TaskFilter;
  setFilter: (f: TaskFilter) => void;
  notice: string | null;
  notify: (m: string) => void;
  error: string | null;
  setError: (e: string | null) => void;
}

const C = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ws, setWs] = useState<Workspace>(() => loadWorkspace());
  const [quarter, setQuarter] = useState<Quarter>(ws.settings.currentQuarter);
  const [notice, setNotice] = useState<string | null>(null);
  const [filter, setFilter] = useState<TaskFilter>(EMPTY_FILTER);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number>();
  const dirty = useRef(false);

  // enregistrement différé (regroupe les saisies rapides), uniquement après une modification dans CET onglet
  useEffect(() => {
    if (!dirty.current) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { dirty.current = false; const e = saveWorkspace(ws); if (e) setError(e); }, 250);
    const flush = () => { if (dirty.current) { dirty.current = false; saveWorkspace(ws); } };
    window.addEventListener('beforeunload', flush);
    return () => { window.clearTimeout(timer.current); window.removeEventListener('beforeunload', flush); };
  }, [ws]);
  // plusieurs onglets ouverts : on recharge ce qu'un autre onglet vient d'enregistrer
  useEffect(() => {
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY && !dirty.current) setWs(loadWorkspace()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const notify = useCallback((m: string) => {
    setNotice(m);
    window.setTimeout(() => setNotice((n) => (n === m ? null : n)), 3000);
  }, []);
  const update = useCallback((fn: (w: Workspace) => Workspace, message?: string) => {
    dirty.current = true;
    setWs((w) => fn(w));
    if (message) notify(message);
  }, [notify]);

  // langue de l'interface : fixée avant le rendu des pages (voir i18n.ts)
  setLang(ws.settings.lang ?? 'fr');
  useEffect(() => { document.documentElement.lang = ws.settings.lang ?? 'fr'; }, [ws.settings.lang]);
  const plan = ws.plans.find((p) => p.id === ws.currentPlanId) ?? null;
  const view = useMemo(() => (plan ? computePlan(ws, plan.id, quarter) : null), [ws, plan, quarter, ws.settings.lang]); // eslint-disable-line react-hooks/exhaustive-deps
  const units = useMemo(() => new Map(ws.units.map((u) => [u.id, u])), [ws.units]);

  return (
    <C.Provider value={{
      ws, update, replaceAll: (w) => { dirty.current = true; setWs(w); setQuarter(w.settings.currentQuarter); }, plan, view, quarter, setQuarter,
      unit: (id) => units.get(id), filter, setFilter, notice, notify, error, setError,
    }}>
      {children}
    </C.Provider>
  );
}

export function useApp(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error('useApp hors AppProvider');
  return c;
}
