/** Tableau Kanban : une colonne par statut ; glisser une carte change le statut (historisé). */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Due, FilterBar, isOverdue, PriorityBadge, useFilteredTasks, ViewHeader } from '../components/pm';
import { NoPlan, OrphanBadge, UnitChip } from '../components/ui';
import { today } from '../lib/dates';
import { updateActivityStatus } from '../lib/ops';
import { STATUS_LABEL, type Activity, type ActivityStatus } from '../types';

const COLS: { s: ActivityStatus; color: string }[] = [
  { s: 'not_started', color: '#a7adb4' }, { s: 'in_progress', color: '#2f6fb3' }, { s: 'late', color: '#d64545' }, { s: 'done', color: '#2e9e4f' }, { s: 'cancelled', color: '#2f3640' },
];
const PAGE = 40;

export default function Kanban() {
  const { plan, view, unit, update } = useApp();
  const tasks = useFilteredTasks();
  const [edit, setEdit] = useState<Activity | null>(null);
  const [over, setOver] = useState<ActivityStatus | null>(null);
  const [more, setMore] = useState<Record<string, number>>({});
  const [lanes, setLanes] = useState(false);
  const now = today();
  const byCol = useMemo(() => {
    const m = new Map<ActivityStatus, Activity[]>(COLS.map((c) => [c.s, []]));
    for (const t of [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
      // une tâche dont l'échéance est dépassée apparaît dans « En retard »
      const col = t.status !== 'done' && t.status !== 'cancelled' && isOverdue(t, now) ? 'late' : t.status;
      m.get(col)!.push(t);
    }
    return m;
  }, [tasks, now]);
  if (!plan || !view) return <><ViewHeader title="Kanban" /><NoPlan /></>;

  const move = (id: string, s: ActivityStatus) => {
    const t = view.byId.get(id);
    if (!t || t.status === s) return;
    update((w) => updateActivityStatus(w, id, { status: s, progress: s === 'done' ? 100 : s === 'in_progress' && !t.progress ? 10 : t.progress, comment: t.comment }), `« ${STATUS_LABEL[s]} »`);
  };
  const card = (t: Activity) => {
    const u = unit(t.unitId);
    const orphan = t.level === 'country' && !(view.parentsOf.get(t.id) ?? []).length;
    const p = t.status === 'done' ? 100 : t.progress;
    return (
      <div key={t.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', t.id)} onClick={() => setEdit(t)}
        className="cursor-grab rounded-xl bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,.06)] transition hover:shadow-md active:cursor-grabbing">
        <div className="mb-1 flex flex-wrap items-center gap-1">
          {u && <UnitChip name={u.name} type={u.type} />}
          <span className="text-[13.5px] font-semibold text-accent">{view.krs.find((k) => k.id === t.krId)?.code}</span>
          <span className="ml-auto"><PriorityBadge p={t.priority} /></span>
        </div>
        <p className="line-clamp-3 text-[15.5px] leading-snug text-[#1d2327]" title={t.title}>{t.title}</p>
        {orphan && <div className="mt-1"><OrphanBadge /></div>}
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-[#ebe9e3]"><div className="h-full rounded-full bg-brand-500" style={{ width: `${p}%` }} /></div>
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[13.5px] text-slate-500">
          <span className="truncate">{t.owner || 'sans responsable'}</span><Due t={t} />
        </div>
      </div>
    );
  };

  const column = (c: (typeof COLS)[number], list: Activity[], key: string) => {
    const n = more[key] ?? PAGE;
    return (
      <div key={key} onDragOver={(e) => { e.preventDefault(); setOver(c.s); }} onDragLeave={() => setOver(null)}
        onDrop={(e) => { e.preventDefault(); setOver(null); move(e.dataTransfer.getData('text/plain'), c.s); }}
        className={`flex min-w-[220px] flex-1 flex-col rounded-2xl bg-[#efede7] ${over === c.s ? 'ring-2 ring-accent' : ''}`}>
        <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-[16px] font-semibold text-brand-600">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} />{STATUS_LABEL[c.s]} <span className="ml-auto text-[15px] font-normal text-[#6b6f76]">{list.length}</span>
        </div>
        <div className="flex flex-col gap-2 p-2">
          {list.slice(0, n).map(card)}
          {list.length > n && <button className="text-xs font-semibold text-brand-500" onClick={() => setMore({ ...more, [key]: n + PAGE })}>+ {list.length - n} autre(s)</button>}
          {!list.length && <p className="py-4 text-center text-xs text-slate-400">Déposer une tâche ici</p>}
        </div>
      </div>
    );
  };

  const units = [...new Set(tasks.map((t) => t.unitId))];
  return (
    <div>
      <ViewHeader title="Tableau Kanban" sub="Glissez une carte d’une colonne à l’autre pour changer son statut. Les tâches dont l’échéance est dépassée apparaissent dans « En retard »." />
      <FilterBar extra={<label className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={lanes} onChange={(e) => setLanes(e.target.checked)} /> Une ligne par équipe / pays</label>} />
      {!lanes ? (
        <div className="flex gap-3 overflow-x-auto pb-3">{COLS.map((c) => column(c, byCol.get(c.s)!, c.s))}</div>
      ) : units.map((uid) => (
        <div key={uid} className="mb-4">
          <div className="mb-1.5 font-titre text-lg font-semibold text-brand-600">{unit(uid)?.name}</div>
          <div className="flex gap-3 overflow-x-auto pb-2">{COLS.map((c) => column(c, byCol.get(c.s)!.filter((t) => t.unitId === uid), `${uid}-${c.s}`))}</div>
        </div>
      ))}
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
