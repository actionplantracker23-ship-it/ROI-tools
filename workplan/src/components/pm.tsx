/** Composants communs aux vues de gestion de projet : filtres partagés, priorité, échéance, en-tête de vue. */
import { useMemo } from 'react';
import { useApp } from '../AppContext';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { EMPTY_FILTER, matches, owners } from '../lib/wbs';
import { PRIORITY_LABEL, STATUS_LABEL, type Activity, type ActivityStatus, type Priority } from '../types';
import { inputCls } from './ui';

export function PriorityBadge({ p }: { p: Priority }) {
  const cls = { high: 'border-[#f3c2c8] bg-[#fdecee] text-[#8a1c2b]', medium: 'border-[#f7d27a] bg-[#fffaf0] text-[#7a5600]', low: 'border-ligne bg-white text-slate-500' }[p];
  return <span className={`inline-flex whitespace-nowrap rounded border px-1.5 py-px text-[11px] font-semibold ${cls}`}>{p === 'high' ? '▲' : p === 'low' ? '▽' : '◆'} {PRIORITY_LABEL[p]}</span>;
}

export const isOverdue = (t: Activity, now = today()) => t.status === 'late' || (t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled');

/** Échéance, en rouge si dépassée, en ambre si à moins de 14 jours. */
export function Due({ t }: { t: Activity }) {
  const now = today();
  const d = daysBetween(now, t.dueDate);
  const late = isOverdue(t, now);
  const soon = !late && t.status !== 'done' && d >= 0 && d <= 14;
  return (
    <span className={`whitespace-nowrap ${late ? 'font-semibold text-rag-red' : soon ? 'font-semibold text-[#9a4a00]' : ''}`} title={late ? 'Échéance dépassée' : soon ? `Dans ${d} jour(s)` : ''}>
      {t.milestone && <span className="mr-0.5 text-accent" title="Jalon">◆</span>}{fmtDate(t.dueDate)}
    </span>
  );
}

/** Tâches du plan qui passent le filtre partagé. */
export function useFilteredTasks(): Activity[] {
  const { view, filter } = useApp();
  return useMemo(() => (view ? view.activities.filter((t) => matches(t, filter, view, today())) : []), [view, filter]);
}

export const isFiltered = (f: typeof EMPTY_FILTER) => JSON.stringify(f) !== JSON.stringify(EMPTY_FILTER);

/** Barre de filtres commune (liste, Gantt, Kanban, échéancier). */
export function FilterBar({ extra }: { extra?: React.ReactNode }) {
  const { ws, view, filter: f, setFilter } = useApp();
  if (!view) return null;
  const set = (patch: Partial<typeof f>) => setFilter({ ...f, ...patch });
  return (
    <div className="no-print mb-3 rounded-lg border border-ligne bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-[1.4fr,1fr,1fr,1fr,1fr]">
        <input className={inputCls} placeholder="Rechercher une tâche, un responsable…" value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label="Rechercher" />
        <select className={inputCls} value={f.unit} onChange={(e) => set({ unit: e.target.value })} aria-label="Équipe ou pays">
          <option value="">Toutes les équipes et pays</option>
          <optgroup label="Équipes globales">{ws.units.filter((u) => u.type === 'department').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          <optgroup label="Pays">{ws.units.filter((u) => u.type === 'country').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
        </select>
        <select className={inputCls} value={f.owner} onChange={(e) => set({ owner: e.target.value })} aria-label="Responsable">
          <option value="">Tous les responsables</option>{owners(view).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <select className={inputCls} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Statut">
          <option value="">Tous les statuts</option>{(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select className={inputCls} value={f.priority} onChange={(e) => set({ priority: e.target.value })} aria-label="Priorité">
          <option value="">Toutes priorités</option>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
        </select>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-600">
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.overdue} onChange={(e) => set({ overdue: e.target.checked })} /> En retard</label>
        <label className="flex items-center gap-1.5"><input type="checkbox" checked={f.orphans} onChange={(e) => set({ orphans: e.target.checked })} /> Orphelines (non liées au global)</label>
        {isFiltered(f) && <button className="font-semibold text-brand-500 hover:text-accent" onClick={() => setFilter(EMPTY_FILTER)}>Effacer les filtres</button>}
        <span className="ml-auto flex flex-wrap items-center gap-2">{extra}</span>
      </div>
    </div>
  );
}

/** En-tête compact des vues de projet. */
export function ViewHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="font-titre text-[26px] font-semibold leading-tight text-brand-600">{title}</h2>
        {sub && <p className="text-sm text-slate-500">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
