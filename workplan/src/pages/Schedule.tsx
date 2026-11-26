/** Échéancier : tâches et jalons par mois d'échéance ; retards et échéances des 30 prochains jours en tête. */
import { useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Due, FilterBar, isOverdue, PriorityBadge, useFilteredTasks, ViewHeader } from '../components/pm';
import { MiniProgress, NoPlan, StatusBadge, UnitChip } from '../components/ui';
import { daysBetween, today } from '../lib/dates';
import type { Activity } from '../types';

export default function Schedule() {
  const { plan, view, unit } = useApp();
  const tasks = useFilteredTasks();
  const [edit, setEdit] = useState<Activity | null>(null);
  if (!plan || !view) return <><ViewHeader title="Échéancier" /><NoPlan /></>;
  const now = today();
  const open = tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled');
  const late = open.filter((t) => isOverdue(t, now));
  const soon = open.filter((t) => !isOverdue(t, now) && daysBetween(now, t.dueDate) <= 30);
  const months = [...new Set(tasks.map((t) => t.dueDate.slice(0, 7)))].sort();
  const row = (t: Activity) => {
    const u = unit(t.unitId);
    return (
      <tr key={t.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(t)}>
        <td className="w-32 text-sm"><Due t={t} /></td>
        <td>{u && <UnitChip name={u.name} type={u.type} />}</td>
        <td className="font-semibold text-accent">{view.krs.find((k) => k.id === t.krId)?.code}</td>
        <td className="max-w-[480px]"><span className="line-clamp-2">{t.title}</span></td>
        <td className="text-xs text-slate-600">{t.owner}</td>
        <td><PriorityBadge p={t.priority} /></td>
        <td><StatusBadge status={t.status} /></td>
        <td><MiniProgress value={t.status === 'done' ? 100 : t.progress} rag={view.activity.get(t.id)!.rag} /></td>
      </tr>
    );
  };
  const table = (list: Activity[]) => (
    <div className="overflow-x-auto"><table className="suivi min-w-[1000px] text-sm"><tbody>{list.map(row)}</tbody></table></div>
  );
  return (
    <div className="space-y-4">
      <ViewHeader title="Échéancier" sub="Échéances des tâches et jalons, mois par mois." />
      <FilterBar />
      {late.length > 0 && <section className="rounded-lg border border-[#f3c2c8] bg-white"><h3 className="rounded-t-lg bg-[#fdecee] px-4 py-2 font-semibold text-[#8a1c2b]">En retard ({late.length})</h3>{table(late)}</section>}
      <section className="rounded-lg border border-ligne bg-white"><h3 className="rounded-t-lg bg-brand-50 px-4 py-2 font-semibold text-brand-600">Dans les 30 prochains jours ({soon.length})</h3>{soon.length ? table(soon) : <p className="px-4 py-3 text-sm text-slate-500">Aucune échéance dans les 30 jours.</p>}</section>
      {months.map((m) => {
        const list = tasks.filter((t) => t.dueDate.startsWith(m)).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
        const label = new Date(`${m}-01T00:00:00`).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
        const done = list.filter((t) => t.status === 'done').length;
        return (
          <section key={m} className="rounded-lg border border-ligne bg-white">
            <h3 className="flex items-center gap-3 rounded-t-lg border-l-4 border-accent bg-[#f5f8fb] px-4 py-2 font-titre text-lg font-semibold capitalize text-brand-600">
              {label}<span className="font-sans text-xs font-normal normal-case text-slate-500">{list.length} échéance(s) · {done} terminée(s)</span>
            </h3>
            {table(list)}
          </section>
        );
      })}
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
