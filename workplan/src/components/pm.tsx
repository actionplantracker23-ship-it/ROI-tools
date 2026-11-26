/** Composants communs aux vues de gestion de projet : filtres partagés, priorité, échéance, en-tête de vue. */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { EMPTY_FILTER, matches, owners } from '../lib/wbs';
import { PRIORITY_LABEL, STATUS_LABEL, type Activity, type ActivityStatus, type Priority } from '../types';
import { inputCls } from './ui';
import { t as tr } from '../i18n';

export function PriorityBadge({ p }: { p: Priority }) {
  const cls = { high: 'text-[#a23434]', medium: 'text-[#8a5a00]', low: 'text-[#6D6E71]' }[p];
  return <span className={`inline-flex whitespace-nowrap text-[14px] ${cls}`} title={tr("Priorité {0}", { 0: PRIORITY_LABEL[p].toLowerCase() })}>{p === 'high' ? '▲' : p === 'low' ? '▽' : '◆'}&nbsp;{PRIORITY_LABEL[p]}</span>;
}

export const isOverdue = (t: Activity, now = today()) => t.status === 'late' || (t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled');

/** Échéance, en rouge si dépassée, en ambre si à moins de 14 jours. */
export function Due({ t }: { t: Activity }) {
  const now = today();
  const d = daysBetween(now, t.dueDate);
  const late = isOverdue(t, now);
  const soon = !late && t.status !== 'done' && d >= 0 && d <= 14;
  return (
    <span className={`whitespace-nowrap ${late ? 'font-semibold text-rag-red' : soon ? 'font-semibold text-[#9a4a00]' : ''}`} title={late ? tr("Échéance dépassée") : soon ? tr("Dans {0} jour(s)", { 0: d }) : ''}>
      {t.milestone && <span className="mr-0.5 text-accent" title={tr("Jalon")}>◆</span>}{fmtDate(t.dueDate)}
    </span>
  );
}

/** Tâches du plan qui passent le filtre partagé. */
export function useFilteredTasks(): Activity[] {
  const { view, filter } = useApp();
  return useMemo(() => (view ? view.activities.filter((t) => matches(t, filter, view, today())) : []), [view, filter]);
}

export const isFiltered = (f: typeof EMPTY_FILTER) => JSON.stringify(f) !== JSON.stringify(EMPTY_FILTER);

/** Barre de filtres commune (plan, Gantt, Kanban, échéancier) : recherche visible, autres filtres repliables. */
export function FilterBar({ extra }: { extra?: React.ReactNode }) {
  const { ws, view, filter: f, setFilter } = useApp();
  const [open, setOpen] = useState(false);
  if (!view) return null;
  const set = (patch: Partial<typeof f>) => setFilter({ ...f, ...patch });
  const n = [f.unit, f.owner, f.status, f.priority, f.overdue, f.orphans].filter(Boolean).length;
  return (
    <div className="no-print mb-5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]" aria-hidden>⌕</span>
          <input className={`${inputCls} !rounded-full pl-9`} placeholder={tr("Rechercher une tâche, une personne…")} value={f.q} onChange={(e) => set({ q: e.target.value })} aria-label={tr("Rechercher")} />
        </div>
        <button onClick={() => setOpen(!open)} aria-expanded={open}
          className={`min-h-[42px] rounded-full border px-4 text-[16px] ${n ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#d5dbe1] bg-white hover:border-brand-500'}`}>
          {tr("Filtres")}{n ? ` · ${n}` : ''} {open ? '▴' : '▾'}
        </button>
        {isFiltered(f) && <button className="text-[15px] text-brand-500 underline-offset-2 hover:underline" onClick={() => setFilter(EMPTY_FILTER)}>{tr("Effacer")}</button>}
        {extra && <span className="ml-auto flex flex-wrap items-center gap-2">{extra}</span>}
      </div>
      {open && (
        <div className="mt-3 grid gap-2 rounded-2xl border border-[#e5e8ec] bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputCls} value={f.unit} onChange={(e) => set({ unit: e.target.value })} aria-label={tr("Équipe ou pays")}>
            <option value="">{tr("Toutes les équipes et pays")}</option>
            <optgroup label={tr("Équipes globales")}>{ws.units.filter((u) => u.type === 'department').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
            <optgroup label={tr("Pays")}>{ws.units.filter((u) => u.type === 'country').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
          <select className={inputCls} value={f.owner} onChange={(e) => set({ owner: e.target.value })} aria-label={tr("Responsable")}>
            <option value="">{tr("Tous les responsables")}</option>{owners(view).map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select className={inputCls} value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label={tr("Statut")}>
            <option value="">{tr("Tous les statuts")}</option>{(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className={inputCls} value={f.priority} onChange={(e) => set({ priority: e.target.value })} aria-label={tr("Priorité")}>
            <option value="">{tr("Toutes priorités")}</option>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
          </select>
          <label className="flex items-center gap-2 text-[16px]"><input type="checkbox" checked={f.overdue} onChange={(e) => set({ overdue: e.target.checked })} /> {tr("Seulement les tâches en retard")}</label>
          <label className="flex items-center gap-2 text-[16px]"><input type="checkbox" checked={f.orphans} onChange={(e) => set({ orphans: e.target.checked })} /> {tr("Seulement les orphelines")}</label>
        </div>
      )}
    </div>
  );
}

/** En-tête des vues (même style que les pages). */
export function ViewHeader({ title, sub, actions }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode }) {
  const { plan } = useApp();
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0 max-w-3xl">
        <div className="mb-1 text-[14px] uppercase tracking-[.14em] text-accent">{plan?.name ?? tr("Plan de travail")}</div>
        <h1 className="text-[34px] font-semibold leading-tight text-brand-600 sm:text-[38px]">{title}</h1>
        {sub && <p className="mt-1.5 text-[17px] italic text-[#6D6E71]">{sub}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
