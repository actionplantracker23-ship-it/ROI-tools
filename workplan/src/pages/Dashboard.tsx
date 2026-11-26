/** Tableau de bord du plan : chiffres clés, objectifs, départements et pays, alertes. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Card, MiniProgress, NoPlan, PageHeader, ProgressBar, RagBadge, Stat } from '../components/ui';
import { ALERT_LABEL, planAlerts, type Alert } from '../lib/calc';
import { pct } from '../lib/format';

export default function Dashboard() {
  const { ws, plan, view } = useApp();
  const [kind, setKind] = useState<Alert['kind'] | 'all'>('all');
  const alerts = useMemo(() => (view ? planAlerts(ws, view) : []), [ws, view]);
  if (!plan || !view) return <><PageHeader title="Tableau de bord" /><NoPlan /></>;
  const q = view.quarter;
  const filled = view.indicators.filter((i) => view.indicator.get(i.id)?.valueQuarter === q).length;
  const late = view.activities.filter((a) => view.activity.get(a.id)?.late).length;
  const done = view.activities.filter((a) => a.status === 'done').length;
  const shown = kind === 'all' ? alerts : alerts.filter((a) => a.kind === kind);
  const unitsOf = (type: 'department' | 'country') => ws.units.filter((u) => u.type === type && (view.actsByUnit.get(u.id) ?? []).length).sort((a, b) => a.order - b.order);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<>{plan.name} · <span className="text-accent">Q{q}</span></>} title={`Avancement du plan de travail ${plan.year}`}
        subtitle="Consolidation : activités pays → activités globales des départements → KR → objectifs. Chaque niveau combine l’exécution des activités et ses indicateurs de mesure." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Avancement du plan" value={pct(view.plan.progress)} hint={`${view.objectives.length} objectifs · ${view.krs.length} KR`} />
        <Stat label="Activités globales" value={view.globalActs.length} hint={`${ws.units.filter((u) => u.type === 'department' && view.globalActs.some((a) => a.unitId === u.id)).length} départements`} color="#5bc0eb" />
        <Stat label="Activités pays" value={view.countryActs.length} hint={`${done} activités réalisées au total`} color="#f28c28" />
        <Stat label="Alignement" value={pct(view.alignment.rate)} hint={<span className={view.orphans.length ? 'font-semibold text-rag-red' : ''}>{view.orphans.length} orpheline(s)</span>} color="#2e9e4f" />
        <Stat label={`Indicateurs Q${q}`} value={<>{filled}<small className="text-base font-normal text-slate-500"> / {view.indicators.length}</small></>} hint="renseignés" color="#0b2e59" />
        <Stat label="En retard" value={<span className={late ? 'text-rag-red' : ''}>{late}</span>} hint="statut ou échéance dépassée" color="#d64545" />
      </div>

      <section className="overflow-x-auto rounded-md border border-ligne bg-white px-5 py-5 font-serif sm:px-8">
        <h2 className="m-section">Vue d’ensemble par objectif</h2>
        {!view.objectives.length ? <p className="font-sans text-sm text-slate-500">Aucun objectif. <Link className="font-semibold text-brand-500 underline" to="/plan">Construire le plan</Link> ou <Link className="font-semibold text-brand-500 underline" to="/import">importer le fichier Excel</Link>.</p> : (
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="text-[12.5px] text-[#6D6E71]">
                {['Objectif', 'Intitulé', 'Avancement', 'KR', 'Act. globales', 'Act. pays', 'Statut'].map((h, i) => <th key={h} className={`border-b-2 border-brand-500 px-2.5 py-2 font-normal ${i < 3 ? 'text-left' : 'text-right'} ${i === 2 ? 'w-[26%]' : ''}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {view.objectives.map((o) => {
                const sc = view.objective.get(o.id)!;
                const krs = view.krs.filter((k) => k.objectiveId === o.id);
                const g = krs.flatMap((k) => view.actsByKr.get(k.id) ?? []);
                const c = g.flatMap((x) => view.childrenOf.get(x.id) ?? []);
                const td = 'border-b border-[#E1E6EC] px-2.5 py-3';
                return (
                  <tr key={o.id}>
                    <td className={`${td} whitespace-nowrap text-[15px] font-bold`} style={{ color: o.color }}>O{o.code}</td>
                    <td className={`${td} text-[15px]`}>{o.title}</td>
                    <td className={td}><div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={sc.progress} rag={sc.rag} /></div><b className="w-14 text-right text-brand-500">{pct(sc.progress)}</b></div></td>
                    <td className={`${td} text-right text-[17px] font-bold`}>{krs.length}</td>
                    <td className={`${td} text-right text-[17px] font-bold`}>{g.length}</td>
                    <td className={`${td} text-right text-[17px] font-bold`}>{c.length}</td>
                    <td className={`${td} text-right font-sans`}><RagBadge rag={sc.rag} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {(['department', 'country'] as const).map((t) => (
          <Card key={t} title={t === 'department' ? 'Départements globaux' : 'Pays'}>
            <ul className="divide-y divide-[#eef0f3]">
              {unitsOf(t).map((u) => {
                const sc = view.unit.get(u.id)!;
                const acts = view.actsByUnit.get(u.id) ?? [];
                const orph = t === 'country' ? view.orphans.filter((o) => o.unitId === u.id).length : 0;
                return (
                  <li key={u.id} className="flex flex-wrap items-center gap-2 py-2">
                    <Link to={t === 'department' ? '/globales' : '/pays'} className="w-28 font-semibold text-brand-500 hover:text-accent">{u.name}</Link>
                    <span className="flex-1 text-xs text-slate-500">{acts.length} activité(s){orph ? <b className="ml-1 text-rag-red">· {orph} orpheline(s)</b> : null}{sc.late ? <b className="ml-1 text-rag-red">· retard</b> : null}</span>
                    <MiniProgress value={sc.progress} rag={sc.rag} />
                  </li>
                );
              })}
              {!unitsOf(t).length && <li className="py-2 text-sm text-slate-500">Aucune activité.</li>}
            </ul>
          </Card>
        ))}
      </div>

      <Card title={`Alertes (${alerts.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          {(['all', ...Object.keys(ALERT_LABEL)] as (Alert['kind'] | 'all')[]).map((k) => {
            const n = k === 'all' ? alerts.length : alerts.filter((a) => a.kind === k).length;
            return (
              <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[13px] ${kind === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ligne bg-white text-slate-600'}`}>
                {k === 'all' ? 'Toutes' : ALERT_LABEL[k]} ({n})
              </button>
            );
          })}
        </div>
        {shown.length === 0 ? <p className="text-sm text-slate-500">Aucune alerte.</p> : (
          <ul className="max-h-96 divide-y divide-[#eef0f3] overflow-y-auto">
            {shown.slice(0, 300).map((a, i) => (
              <li key={i} className="py-2">
                <Link to={a.link} className="block hover:bg-slate-50">
                  <div className={`text-[14.5px] font-semibold ${a.kind === 'orphan' || a.kind === 'late' ? 'text-rag-red' : 'text-brand-500'}`}>{a.label}</div>
                  <div className="truncate text-xs text-slate-500">{a.detail}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
