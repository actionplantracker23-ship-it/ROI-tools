/** Tableau de bord épuré : 5 chiffres clés, objectifs, prochaines échéances, équipes et pays. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Due, isOverdue } from '../components/pm';
import { Card, MiniProgress, NoPlan, PageHeader, ProgressBar, Stat, STATUS_HEX } from '../components/ui';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { pct } from '../lib/format';
import { STATUS_LABEL, type ActivityStatus } from '../types';


export default function Dashboard() {
  const { ws, plan, view, unit } = useApp();
  const [tab, setTab] = useState<'department' | 'country'>('country');
  const now = today();
  const d = useMemo(() => {
    if (!view || !plan) return null;
    const live = view.activities.filter((t) => t.status !== 'cancelled');
    const eff = (t: (typeof live)[number]): ActivityStatus => (t.status !== 'done' && isOverdue(t, now) ? 'late' : t.status);
    const counts = Object.fromEntries((Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => [s, view.activities.filter((t) => (t.status === 'cancelled' ? 'cancelled' : eff(t)) === s).length])) as Record<ActivityStatus, number>;
    const next = live.filter((t) => t.status !== 'done' && !isOverdue(t, now)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 6);
    const soon = live.filter((t) => t.status !== 'done' && !isOverdue(t, now) && daysBetween(now, t.dueDate) <= 30).length;
    const issues = ws.issues.filter((i) => i.planId === plan.id && i.status !== 'closed').length;
    return { live, counts, next, soon, issues };
  }, [ws, view, plan, now]);
  if (!plan || !view || !d) return <><PageHeader title="Tableau de bord" /><NoPlan /></>;
  const total = view.activities.length;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow={`${plan.name} · ${fmtDate(now)}`} title="Où en est le plan ?"
        subtitle="L’essentiel en un coup d’œil : avancement, retards, échéances et objectifs." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Avancement" value={pct(view.plan.progress)} hint={view.plan.progress === null ? 'suivi pas encore commencé' : `${view.objectives.length} objectifs`} />
        <Stat label="Terminées" value={<>{d.counts.done}<span className="text-[22px] text-[#9aa0a6]">/{d.live.length}</span></>} hint="tâches" color="#2e9e4f" />
        <Stat label="En retard" value={<span className={d.counts.late ? 'text-[#a23434]' : ''}>{d.counts.late}</span>} hint={<Link to="/echeancier" className="underline-offset-2 hover:underline">voir l’échéancier</Link>} color="#d64545" />
        <Stat label="Sous 30 jours" value={d.soon} hint="échéances" color="#F7941D" />
        <Stat label="Risques ouverts" value={d.issues} hint={<Link to="/risques" className="underline-offset-2 hover:underline">voir le registre</Link>} color="#7c3aed" />
      </div>

      <div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[#e8ecf0]">
          {(Object.keys(STATUS_LABEL) as ActivityStatus[]).filter((s) => d.counts[s]).map((s) => <div key={s} style={{ width: `${(d.counts[s] / Math.max(1, total)) * 100}%`, background: STATUS_HEX[s] }} title={`${STATUS_LABEL[s]} : ${d.counts[s]}`} />)}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[15px] text-[#6D6E71]">
          {(Object.keys(STATUS_LABEL) as ActivityStatus[]).filter((s) => d.counts[s]).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_HEX[s] }} />{STATUS_LABEL[s]} {d.counts[s]}</span>)}
        </div>
      </div>

      {view.orphans.length > 0 && (
        <Link to="/alignement" className="block rounded-2xl bg-[#E30613] px-5 py-3 text-[16.5px] text-white shadow-sm hover:bg-[#c00510]">
          <b>{view.orphans.length} tâche{view.orphans.length > 1 ? 's' : ''} pays non liée{view.orphans.length > 1 ? 's' : ''} au plan global</b>
          <span className="italic text-white/90"> — {view.orphans.map((o) => `${unit(o.unitId)?.name} ${view.krs.find((k) => k.id === o.krId)?.code ?? ''}`).join(', ')}</span> · rattacher →
        </Link>
      )}

      <section>
        <h2 className="mb-3 text-[24px] font-semibold text-brand-600">Objectifs</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {view.objectives.map((o) => {
            const s = view.objective.get(o.id)!;
            const n = view.krs.filter((k) => k.objectiveId === o.id).length;
            return (
              <Link key={o.id} to={`/plan?o=${o.id}`} className="group flex flex-col rounded-2xl border border-[#e5e8ec] bg-white p-5 transition hover:shadow-md">
                <span className="text-[44px] font-semibold leading-none" style={{ color: o.color }}>{o.code}</span>
                <span className="mt-2 line-clamp-3 min-h-[4.2em] text-[16.5px] leading-snug">{o.title}</span>
                <span className="mt-3"><ProgressBar value={s.progress} rag={s.rag} /></span>
                <span className="mt-1.5 flex justify-between text-[14.5px] text-[#6D6E71]"><span>{n} projets</span><span className="text-brand-500 group-hover:underline">{s.progress === null ? '' : `${pct(s.progress)} · `}ouvrir →</span></span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Prochaines échéances" action={<Link to="/echeancier" className="text-[15.5px] text-brand-500 hover:text-accent">Tout voir →</Link>}>
          <ul className="divide-y divide-[#eef1f4]">
            {d.next.map((t) => (
              <li key={t.id} className="flex items-baseline gap-4 py-2.5">
                <span className="w-28 shrink-0 text-[15px]"><Due t={t} /></span>
                <span className="min-w-0"><span className="line-clamp-2 text-[16px] leading-snug">{t.title}</span><span className="text-[14.5px] italic text-[#6D6E71]">{unit(t.unitId)?.name}{t.owner ? ` · ${t.owner}` : ''}</span></span>
              </li>
            ))}
            {!d.next.length && <li className="py-2 italic text-[#6D6E71]">Aucune échéance à venir.</li>}
          </ul>
        </Card>
        <Card title="Avancement" action={
          <div className="flex rounded-full bg-[#eef1f4] p-0.5 text-[15px]">
            {(['country', 'department'] as const).map((t) => <button key={t} onClick={() => setTab(t)} className={`rounded-full px-3 py-1 ${tab === t ? 'bg-white shadow-sm' : 'text-[#6D6E71]'}`}>{t === 'country' ? 'Pays' : 'Équipes globales'}</button>)}
          </div>}>
          <ul className="divide-y divide-[#eef1f4]">
            {ws.units.filter((u) => u.type === tab && (view.actsByUnit.get(u.id) ?? []).length).map((u) => {
              const acts = view.actsByUnit.get(u.id)!;
              const late = acts.filter((t) => isOverdue(t, now)).length;
              const s = view.unit.get(u.id)!;
              return (
                <li key={u.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-36 truncate text-[16.5px] text-brand-600">{u.name}</span>
                  <span className="flex-1 text-[14.5px] text-[#6D6E71]">{acts.length} tâches{late ? <span className="text-[#a23434]"> · {late} en retard</span> : null}</span>
                  <MiniProgress value={s.progress} rag={s.rag} />
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
