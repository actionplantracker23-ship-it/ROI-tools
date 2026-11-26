/** Responsables : charge de travail par personne (tâches, retards, prochaine échéance, avancement). */
import { Fragment, useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Due, FilterBar, isOverdue, useFilteredTasks, ViewHeader } from '../components/pm';
import { MiniProgress, NoPlan, StatusBadge, UnitChip } from '../components/ui';
import { fmtDate, today } from '../lib/dates';
import { ragOf } from '../lib/calc';
import { mean } from '../lib/util';
import type { Activity } from '../types';

export default function People() {
  const { ws, plan, view, unit, setFilter, filter } = useApp();
  const tasks = useFilteredTasks();
  const [open, setOpen] = useState<string | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  if (!plan || !view) return <><ViewHeader title="Responsables" /><NoPlan /></>;
  const now = today();
  const people = [...new Set(tasks.map((t) => t.owner || '— sans responsable —'))].map((p) => {
    const list = tasks.filter((t) => (t.owner || '— sans responsable —') === p);
    const live = list.filter((t) => t.status !== 'cancelled');
    const next = live.filter((t) => t.status !== 'done').sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const prog = mean(live.map((t) => (t.status === 'done' ? 100 : t.updatedAt || t.progress ? t.progress : null)));
    return { p, list, units: [...new Set(list.map((t) => t.unitId))], done: list.filter((t) => t.status === 'done').length, wip: list.filter((t) => t.status === 'in_progress').length, late: list.filter((t) => isOverdue(t, now)).length, next, prog };
  }).sort((a, b) => b.late - a.late || b.list.length - a.list.length);
  return (
    <div>
      <ViewHeader title="Responsables" sub={`${people.length} responsable(s) · charge de travail et retards. Cliquez un nom pour voir ses tâches.`} />
      <FilterBar />
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[960px] text-sm">
          <thead><tr><th>Responsable</th><th>Équipes / pays</th><th className="text-right">Tâches</th><th className="text-right">En cours</th><th className="text-right">Terminées</th><th className="text-right">En retard</th><th>Prochaine échéance</th><th>Avancement</th></tr></thead>
          <tbody>
            {people.map((x) => (
              <Fragment key={x.p}>
                <tr className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setOpen(open === x.p ? null : x.p)}>
                  <td className="font-semibold text-brand-600">{open === x.p ? '▾' : '▸'} {x.p}</td>
                  <td><span className="flex flex-wrap gap-1">{x.units.map((u) => <UnitChip key={u} name={unit(u)?.name ?? ''} type={unit(u)?.type ?? 'department'} />)}</span></td>
                  <td className="text-right font-bold">{x.list.length}</td>
                  <td className="text-right">{x.wip}</td>
                  <td className="text-right">{x.done}</td>
                  <td className={`text-right font-bold ${x.late ? 'text-rag-red' : 'text-slate-400'}`}>{x.late}</td>
                  <td className="text-xs">{x.next ? <>{fmtDate(x.next.dueDate)}<div className="max-w-[260px] truncate text-slate-500">{x.next.title}</div></> : '—'}</td>
                  <td><MiniProgress value={x.prog} rag={ragOf(x.prog, x.late > 0, ws.settings)} /></td>
                </tr>
                {open === x.p && x.list.map((t) => (
                  <tr key={t.id} className="cursor-pointer bg-[#fafbfc] hover:bg-brand-50" onClick={() => setEdit(t)}>
                    <td className="pl-8 text-xs text-accent">{view.krs.find((k) => k.id === t.krId)?.code}</td>
                    <td colSpan={4} className="text-xs">{unit(t.unitId)?.name} · {t.title}</td>
                    <td><StatusBadge status={t.status} /></td>
                    <td className="text-xs"><Due t={t} /></td>
                    <td><MiniProgress value={t.status === 'done' ? 100 : t.progress} rag={view.activity.get(t.id)!.rag} /></td>
                  </tr>
                ))}
                {open === x.p && <tr><td colSpan={8} className="bg-[#fafbfc] text-right"><button className="text-xs font-semibold text-brand-500" onClick={() => setFilter({ ...filter, owner: x.p.startsWith('—') ? '' : x.p })}>Filtrer toutes les vues sur {x.p}</button></td></tr>}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
