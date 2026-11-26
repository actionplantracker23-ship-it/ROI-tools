/** Tableau de bord projet : chiffres clés, statut des tâches, échéances, avancement par objectif et par équipe, risques. */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../AppContext';
import { Due, isOverdue } from '../components/pm';
import { Card, MiniProgress, NoPlan, PageHeader, ProgressBar, RagBadge, Stat, UnitChip } from '../components/ui';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { pct } from '../lib/format';
import { STATUS_LABEL, type ActivityStatus } from '../types';

const STATUS_HEX: Record<ActivityStatus, string> = { not_started: '#a7adb4', in_progress: '#2f6fb3', late: '#d64545', done: '#2e9e4f', cancelled: '#2f3640' };
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export default function Dashboard() {
  const { ws, plan, view, unit } = useApp();
  const now = today();
  const data = useMemo(() => {
    if (!view || !plan) return null;
    const live = view.activities.filter((t) => t.status !== 'cancelled');
    const late = live.filter((t) => isOverdue(t, now));
    const statusOf = (t: (typeof live)[number]): ActivityStatus => (t.status !== 'done' && isOverdue(t, now) ? 'late' : t.status);
    const counts = Object.fromEntries((Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => [s, view.activities.filter((t) => (t.status === 'cancelled' ? 'cancelled' : statusOf(t)) === s).length])) as Record<ActivityStatus, number>;
    const upcoming = live.filter((t) => t.status !== 'done' && !isOverdue(t, now) && daysBetween(now, t.dueDate) <= 30).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    const next = live.filter((t) => t.status !== 'done' && !isOverdue(t, now)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 8);
    const byMonth = MONTHS.map((m, i) => {
      const key = `${plan.year}-${String(i + 1).padStart(2, '0')}`;
      const list = live.filter((t) => t.dueDate.startsWith(key));
      return { mois: m, Terminées: list.filter((t) => t.status === 'done').length, 'En retard': list.filter((t) => t.status !== 'done' && isOverdue(t, now)).length, 'À venir / en cours': list.filter((t) => t.status !== 'done' && !isOverdue(t, now)).length };
    });
    const issues = ws.issues.filter((i) => i.planId === plan.id && i.status !== 'closed');
    return { live, late, counts, upcoming, next, byMonth, issues };
  }, [ws, view, plan, now]);
  if (!plan || !view || !data) return <><PageHeader title="Tableau de bord" /><NoPlan /></>;
  const { live, late, counts, upcoming, next, byMonth, issues } = data;
  const done = counts.done;
  const total = view.activities.length;

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<>{plan.name} · <span className="text-accent">au {fmtDate(now)}</span></>} title="Tableau de bord du projet"
        subtitle="Avancement des tâches des équipes globales et des pays, échéances, retards, risques et actions. Les tâches pays doivent être rattachées au plan global." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat label="Avancement" value={pct(view.plan.progress)} hint={`${view.objectives.length} objectifs · ${view.krs.length} projets`} />
        <Stat label="Tâches" value={total} hint={`${view.globalActs.length} globales · ${view.countryActs.length} pays`} color="#5bc0eb" />
        <Stat label="Terminées" value={<>{done}<small className="text-base font-normal text-slate-500"> / {live.length}</small></>} hint={pct(live.length ? (done / live.length) * 100 : null)} color="#2e9e4f" />
        <Stat label="En cours" value={counts.in_progress} color="#2f6fb3" />
        <Stat label="En retard" value={<span className={late.length ? 'text-rag-red' : ''}>{late.length}</span>} hint="statut ou échéance dépassée" color="#d64545" />
        <Stat label="Échéances ≤ 30 j" value={upcoming.length} color="#f28c28" />
        <Stat label="Risques ouverts" value={issues.length} hint={<Link to="/risques" className="text-brand-500 underline">voir le registre</Link>} color="#7c3aed" />
      </div>

      {view.orphans.length > 0 && (
        <Link to="/alignement" className="flex flex-wrap items-center gap-2 rounded-md border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-sm text-[#8a1c2b] hover:border-rag-red">
          <b>{view.orphans.length} tâche(s) pays orpheline(s), non liée(s) au plan global</b> : {view.orphans.map((o) => `${unit(o.unitId)?.name} ${view.krs.find((k) => k.id === o.krId)?.code ?? ''}`).join(' · ')} → rattacher
        </Link>
      )}

      <Card title="Statut des tâches">
        <div className="flex h-7 w-full overflow-hidden rounded">
          {(Object.keys(STATUS_LABEL) as ActivityStatus[]).filter((s) => counts[s]).map((s) => (
            <div key={s} className="flex items-center justify-center text-xs font-semibold text-white" style={{ width: `${(counts[s] / Math.max(1, total)) * 100}%`, background: STATUS_HEX[s] }} title={`${STATUS_LABEL[s]} : ${counts[s]}`}>{counts[s] / total > 0.05 ? counts[s] : ''}</div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
          {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: STATUS_HEX[s] }} />{STATUS_LABEL[s]} <b>{counts[s]}</b></span>)}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1.3fr,1fr]">
        <Card title="Échéances par mois">
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byMonth} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Terminées" stackId="a" fill="#2e9e4f" stroke="#fff" strokeWidth={1} maxBarSize={36} />
                <Bar dataKey="En retard" stackId="a" fill="#d64545" stroke="#fff" strokeWidth={1} maxBarSize={36} />
                <Bar dataKey="À venir / en cours" stackId="a" fill="#2f6fb3" stroke="#fff" strokeWidth={1} maxBarSize={36} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Prochaines échéances" action={<Link to="/echeancier" className="text-sm font-semibold text-brand-500 hover:text-accent">Échéancier →</Link>}>
          <ul className="divide-y divide-[#eef0f3]">
            {next.map((t) => (
              <li key={t.id} className="flex items-start gap-2 py-1.5 text-sm">
                <span className="w-24 shrink-0 text-xs"><Due t={t} /></span>
                <span className="min-w-0 flex-1"><span className="line-clamp-2">{t.title}</span><span className="text-[11px] text-slate-500">{unit(t.unitId)?.name} · {t.owner || 'sans responsable'}</span></span>
              </li>
            ))}
            {!next.length && <li className="py-2 text-sm text-slate-500">Aucune échéance à venir.</li>}
          </ul>
        </Card>
      </div>

      <section className="overflow-x-auto rounded-md border border-ligne bg-white px-5 py-5 sm:px-7">
        <h2 className="m-section font-serif">Avancement par objectif</h2>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead><tr className="text-xs text-[#6D6E71]">{['Objectif', 'Intitulé', 'Avancement', 'Projets', 'Tâches', 'En retard', 'Statut'].map((h, i) => <th key={h} className={`border-b-2 border-brand-500 px-2.5 py-2 font-normal ${i < 3 ? 'text-left' : 'text-right'} ${i === 2 ? 'w-[24%]' : ''}`}>{h}</th>)}</tr></thead>
          <tbody>
            {view.objectives.map((o) => {
              const sc = view.objective.get(o.id)!;
              const krIds = new Set(view.krs.filter((k) => k.objectiveId === o.id).map((k) => k.id));
              const tasks = view.activities.filter((t) => krIds.has(t.krId ?? ''));
              const td = 'border-b border-[#E1E6EC] px-2.5 py-2.5';
              return (
                <tr key={o.id}>
                  <td className={`${td} font-bold`} style={{ color: o.color }}>O{o.code}</td>
                  <td className={`${td} font-serif`}>{o.title}</td>
                  <td className={td}><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={sc.progress} rag={sc.rag} /></div><b className="w-12 text-right text-brand-500">{pct(sc.progress)}</b></div></td>
                  <td className={`${td} text-right font-bold`}>{krIds.size}</td>
                  <td className={`${td} text-right font-bold`}>{tasks.length}</td>
                  <td className={`${td} text-right font-bold ${tasks.some((t) => isOverdue(t, now)) ? 'text-rag-red' : 'text-slate-400'}`}>{tasks.filter((t) => isOverdue(t, now)).length}</td>
                  <td className={`${td} text-right`}><RagBadge rag={sc.rag} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['department', 'country'] as const).map((type) => (
          <Card key={type} title={type === 'department' ? 'Équipes globales' : 'Pays'}>
            <ul className="divide-y divide-[#eef0f3]">
              {ws.units.filter((u) => u.type === type && (view.actsByUnit.get(u.id) ?? []).length).map((u) => {
                const acts = view.actsByUnit.get(u.id)!;
                const l = acts.filter((t) => isOverdue(t, now)).length;
                const sc = view.unit.get(u.id)!;
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
                    <span className="w-32"><UnitChip name={u.name} type={u.type} /></span>
                    <span className="flex-1 text-xs text-slate-500">{acts.length} tâche(s) · {acts.filter((t) => t.status === 'done').length} terminée(s){l ? <b className="ml-1 text-rag-red">· {l} en retard</b> : null}</span>
                    <MiniProgress value={sc.progress} rag={sc.rag} />
                  </li>
                );
              })}
            </ul>
          </Card>
        ))}
      </div>

      <Card title={`Risques et actions ouverts (${issues.length})`} action={<Link to="/risques" className="text-sm font-semibold text-brand-500 hover:text-accent">Registre →</Link>}>
        <ul className="divide-y divide-[#eef0f3]">
          {issues.slice(0, 6).map((i) => {
            const a = i.activityId ? view.byId.get(i.activityId) : undefined;
            return (
              <li key={i.id} className="py-2 text-sm">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[11px] font-semibold ${i.kind === 'issue' ? 'bg-rag-red text-white' : 'bg-rag-amber text-[#2b2100]'}`}>{i.kind === 'issue' ? 'Problème' : 'Risque'}</span>
                {a && <b className="mr-1 text-brand-500">{unit(a.unitId)?.name} {view.krs.find((k) => k.id === a.krId)?.code}</b>}{i.title}
                {i.action && <div className="text-xs text-[#9a4a00]">Action : {i.action}</div>}
              </li>
            );
          })}
          {!issues.length && <li className="py-2 text-sm text-slate-500">Aucun risque ouvert.</li>}
        </ul>
      </Card>
    </div>
  );
}
