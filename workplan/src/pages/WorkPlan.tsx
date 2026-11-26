/**
 * Plan de travail présenté par objectif : on choisit un objectif (cartes), ses projets (KR globaux)
 * s'affichent, chaque projet se déplie sur ses tâches — équipes globales d'abord, puis pays.
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Due, FilterBar, isFiltered, useFilteredTasks, ViewHeader } from '../components/pm';
import { Button, NoPlan, OrphanBadge, ProgressBar, STATUS_STYLE, UnitChip } from '../components/ui';
import { today } from '../lib/dates';
import { pct } from '../lib/format';
import { newActivity, newObjective, updateActivityStatus, upsert } from '../lib/ops';
import { STATUS_LABEL, type Activity, type ActivityStatus, type KeyResult } from '../types';

function StatusSelect({ t }: { t: Activity }) {
  const { update } = useApp();
  return (
    <select aria-label="Statut" value={t.status} onClick={(e) => e.stopPropagation()}
      onChange={(e) => update((w) => updateActivityStatus(w, t.id, { status: e.target.value as ActivityStatus, progress: t.progress, comment: t.comment }), 'Statut mis à jour.')}
      className={`cursor-pointer appearance-none rounded-full border-0 px-3 py-1 text-[14.5px] focus:ring-2 focus:ring-brand-100 ${STATUS_STYLE[t.status]}`}>
      {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

function TaskRow({ t, onOpen }: { t: Activity; onOpen: (t: Activity) => void }) {
  const { view, unit } = useApp();
  const u = unit(t.unitId);
  const deps = view!.parentsOf.get(t.id) ?? [];
  const p = t.status === 'done' ? 100 : t.progress;
  return (
    <li onClick={() => onOpen(t)} className="grid cursor-pointer grid-cols-[1fr,auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-3 hover:bg-[#f8f7f3] md:grid-cols-[130px,1fr,120px,130px,70px]">
      <span className="max-md:col-span-2">{u && <UnitChip name={u.name + (t.subTeam ? ` · ${t.subTeam}` : '')} type={u.type} />}</span>
      <span className="min-w-0 max-md:col-span-2">
        <span className="line-clamp-2 text-[16.5px] leading-snug text-[#1d2327]" title={t.title}>{t.title}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[14.5px] italic text-[#6b6f76]">
          {t.owner && <span>{t.owner}</span>}
          {t.level === 'country' && (deps.length
            ? <span>· soutenue par {[...new Set(deps.map((d) => unit(d.unitId)?.name))].join(', ')}</span>
            : <span className="not-italic"><OrphanBadge /></span>)}
        </span>
      </span>
      <span className="text-[15px]"><Due t={t} /></span>
      <span><StatusSelect t={t} /></span>
      <span className="text-right text-[15px] tabular-nums text-brand-600">{p}&nbsp;%</span>
    </li>
  );
}

function Project({ kr, tasks, open, onToggle, onOpen }: { kr: KeyResult; tasks: Activity[]; open: boolean; onToggle: () => void; onOpen: (t: Activity) => void }) {
  const { ws, plan, view } = useApp();
  const sc = view!.kr.get(kr.id)!;
  const now = today();
  const late = tasks.filter((t) => t.status === 'late' || (t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled')).length;
  const done = tasks.filter((t) => t.status === 'done').length;
  const globals = tasks.filter((t) => t.level === 'global');
  const countries = tasks.filter((t) => t.level === 'country');
  return (
    <article className="overflow-hidden rounded-2xl border border-[#e7e4dc] bg-white">
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[1fr,auto] items-center gap-4 px-6 py-4 text-left hover:bg-[#fbfaf7]">
        <span className="min-w-0">
          <span className="text-[14px] uppercase tracking-[.12em] text-accent">{kr.team ? 'KR d’équipe' : 'Projet'} · {kr.code}</span>
          <span className={`block text-[19px] leading-snug text-brand-600 ${open ? '' : 'line-clamp-2'}`}>{kr.title}</span>
        </span>
        <span className="flex items-center gap-5">
          <span className="hidden text-right text-[15px] text-[#6b6f76] sm:block">
            {done}/{tasks.length} terminée{done > 1 ? 's' : ''}{late ? <span className="block text-[#a23434]">{late} en retard</span> : null}
          </span>
          <span className="w-28"><ProgressBar value={sc.progress} rag={sc.rag} /><span className="mt-1 block text-right text-[15px] tabular-nums text-brand-600">{pct(sc.progress)}</span></span>
          <span className={`text-[#9a9ea5] transition ${open ? 'rotate-180' : ''}`} aria-hidden>▾</span>
        </span>
      </button>
      {open && (
        <div className="border-t border-[#efede7] px-3 pb-3 pt-2">
          {[['Équipes globales', globals], ['Pays', countries]].map(([label, list]) => (list as Activity[]).length ? (
            <section key={label as string} className="mt-1">
              <h4 className="px-3 pb-1 pt-2 text-[14px] uppercase tracking-[.12em] text-[#8b8f96]">{label as string}</h4>
              <ul className="divide-y divide-[#f1efea]">{(list as Activity[]).map((t) => <TaskRow key={t.id} t={t} onOpen={onOpen} />)}</ul>
            </section>
          ) : null)}
          {!tasks.length && <p className="px-3 py-3 italic text-[#6b6f76]">Aucune tâche pour ce projet.</p>}
          <button className="mt-2 px-3 text-[15.5px] text-brand-500 hover:text-accent" onClick={() => onOpen(newActivity(ws, { planId: plan!.id, level: 'global', unitId: ws.units.find((u) => u.type === 'department')?.id ?? '', krId: kr.id }))}>+ Ajouter une tâche</button>
        </div>
      )}
    </article>
  );
}

export default function WorkPlan() {
  const { plan, view, update, filter } = useApp();
  const tasks = useFilteredTasks();
  const [params, setParams] = useSearchParams();
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Activity | null>(null);
  const objId = params.get('o') ?? view?.objectives[0]?.id ?? '';
  const objective = view?.objectives.find((o) => o.id === objId) ?? view?.objectives[0];
  const byKr = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const t of tasks) if (t.krId) { const l = m.get(t.krId); if (l) l.push(t); else m.set(t.krId, [t]); }
    for (const l of m.values()) l.sort((a, b) => (a.level === b.level ? a.order - b.order : a.level === 'global' ? -1 : 1));
    return m;
  }, [tasks]);
  useEffect(() => setOpenIds(new Set()), [objId]);
  if (!plan || !view) return <><ViewHeader title="Plan de travail" /><NoPlan /></>;
  const now = today();
  // sans filtre : tous les projets de l'objectif ; avec filtre : seulement ceux qui ont des tâches correspondantes
  const krs = view.krs.filter((k) => k.objectiveId === objective?.id && (!isFiltered(filter) || byKr.get(k.id)?.length));
  const objTasks = krs.flatMap((k) => byKr.get(k.id) ?? []);
  const sc = objective ? view.objective.get(objective.id)! : null;

  return (
    <div>
      <ViewHeader title="Plan de travail" sub="Présenté par objectif : choisissez un objectif, puis dépliez un projet pour voir ses tâches."
        actions={<Button variant="primary" onClick={() => update((w) => upsert(w, 'objectives', newObjective(w, plan.id, 'Nouvel objectif')), 'Objectif ajouté.')}>+ Objectif</Button>} />
      <FilterBar />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {view.objectives.map((o) => {
          const s = view.objective.get(o.id)!;
          const ids = new Set(view.krs.filter((k) => k.objectiveId === o.id).map((k) => k.id));
          const ts = tasks.filter((t) => ids.has(t.krId ?? ''));
          const late = ts.filter((t) => t.status === 'late' || (t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled')).length;
          const sel = o.id === objective?.id;
          return (
            <button key={o.id} onClick={() => setParams({ o: o.id })} aria-pressed={sel}
              className={`flex flex-col rounded-2xl border bg-white p-5 text-left transition ${sel ? 'border-transparent shadow-lg ring-2' : 'border-[#e7e4dc] opacity-80 hover:opacity-100 hover:shadow-md'}`}
              style={sel ? { ['--tw-ring-color' as string]: o.color } : undefined}>
              <span className="flex items-baseline gap-3">
                <span className="text-[46px] font-semibold leading-none" style={{ color: o.color }}>{o.code}</span>
                <span className="text-[14px] uppercase tracking-[.12em] text-[#8b8f96]">Objectif</span>
              </span>
              <span className="mt-2 line-clamp-3 min-h-[4.2em] text-[16.5px] leading-snug text-[#1d2327]">{o.title}</span>
              <span className="mt-3"><ProgressBar value={s.progress} rag={s.rag} /></span>
              <span className="mt-1.5 flex justify-between text-[14.5px] text-[#6b6f76]">
                <span>{ids.size} projets · {ts.length} tâches</span>
                <span className={late ? 'text-[#a23434]' : ''}>{late ? `${late} en retard` : pct(s.progress)}</span>
              </span>
            </button>
          );
        })}
      </div>

      {objective && sc && (
        <section>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-4 border-b border-[#e7e4dc] pb-4">
            <div className="max-w-4xl">
              <div className="text-[14px] uppercase tracking-[.14em]" style={{ color: objective.color }}>Objectif {objective.code}</div>
              <h2 className="text-[28px] font-semibold leading-tight text-brand-600">{objective.title}</h2>
            </div>
            <div className="flex gap-6 text-right">
              <div><div className="text-[30px] font-semibold leading-none text-brand-600">{pct(sc.progress)}</div><div className="text-[14px] text-[#6b6f76]">avancement</div></div>
              <div><div className="text-[30px] font-semibold leading-none text-brand-600">{objTasks.filter((t) => t.status === 'done').length}<span className="text-[20px] text-[#9a9ea5]">/{objTasks.length}</span></div><div className="text-[14px] text-[#6b6f76]">tâches terminées</div></div>
            </div>
          </div>
          <div className="mb-3 flex justify-end gap-3 text-[15.5px]">
            <button className="text-brand-500 hover:text-accent" onClick={() => setOpenIds(new Set(krs.map((k) => k.id)))}>Tout déplier</button>
            <button className="text-brand-500 hover:text-accent" onClick={() => setOpenIds(new Set())}>Tout replier</button>
          </div>
          <div className="space-y-3">
            {krs.map((k) => (
              <Project key={k.id} kr={k} tasks={byKr.get(k.id) ?? []} open={openIds.has(k.id)} onOpen={setEdit}
                onToggle={() => setOpenIds((s) => { const n = new Set(s); if (n.has(k.id)) n.delete(k.id); else n.add(k.id); return n; })} />
            ))}
            {!krs.length && <p className="rounded-2xl border border-[#e7e4dc] bg-white p-8 text-center italic text-[#6b6f76]">Aucune tâche ne correspond aux filtres dans cet objectif.</p>}
          </div>
        </section>
      )}
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
