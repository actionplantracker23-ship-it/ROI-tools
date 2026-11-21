import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { entityPath, pct } from '../lib/format';
import { alerts, type Alert } from '../lib/progress';
import { heatCell, milestoneStats } from '../lib/selectors';
import { Card, Gauge, NoData, PageHeader, ProgressBar, RAG_HEX, RAG_STYLE, RagBadge, Stat } from '../components/ui';

const ALERT_LABEL: Record<Alert['kind'], string> = {
  late: 'Jalons en retard', no_data: 'KR sans données', placeholder: 'Cibles non définies', no_lead: 'KR globaux sans Lead', no_initiative: 'KR sans initiative',
};

export default function Dashboard() {
  const { ds, computed, quarter } = useApp();
  const [kind, setKind] = useState<Alert['kind'] | 'all'>('all');
  const allAlerts = useMemo(() => alerts(ds, computed), [ds, computed]);
  if (!ds.globalKrs.length) return <><PageHeader title="Tableau de bord global" /><NoData /></>;

  const stats = milestoneStats(ds, quarter);
  const entities = ds.entities.filter((e) => ds.contributions.some((c) => c.entityId === e.id));
  const shown = kind === 'all' ? allAlerts : allAlerts.filter((a) => a.kind === kind);
  const counts = Object.fromEntries(Object.keys(ALERT_LABEL).map((k) => [k, allAlerts.filter((a) => a.kind === k).length]));

  return (
    <div className="space-y-6">
      <PageHeader eyebrow={<>OKR 2027 · Vue d’ensemble<span className="ml-3 text-accent">Q{quarter}</span></>}
        title={`Avancement des OKR 2027 à fin Q${quarter}`}
        subtitle="Consolidation de bas en haut : jalons → initiatives → KR pays/équipes → KR globaux → objectifs. Les pays portent la livraison ; les équipes globales sont en appui." />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="KR globaux" value={ds.globalKrs.length} hint={`${ds.globalObjectives.length} objectifs`} />
        <Stat label="KR pays/équipes" value={ds.entityKrs.length} color="#5bc0eb" />
        <Stat label="Initiatives" value={ds.initiatives.length} color="#f28c28" />
        <Stat label={`Jalons atteints (≤ Q${quarter})`} value={<>{stats.achieved}<small className="text-base font-normal text-slate-500"> / {stats.due}</small></>} hint={`${stats.inProgress} en cours`} color="#2e9e4f" />
        <Stat label="Jalons en retard" value={<span className={stats.late ? 'text-rag-red' : ''}>{stats.late}</span>} color="#d64545" />
      </div>

      <section className="overflow-x-auto rounded-md border border-ligne bg-white px-5 py-5 font-serif sm:px-8">
        <h2 className="m-section">Vue d’ensemble par objectif</h2>
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr className="text-[12.5px] text-[#6D6E71]">
              <th className="border-b-2 border-brand-500 px-2.5 py-2 text-left font-normal">Objectif</th>
              <th className="border-b-2 border-brand-500 px-2.5 py-2 text-left font-normal">Intitulé</th>
              <th className="w-[28%] border-b-2 border-brand-500 px-2.5 py-2 text-left font-normal">Avancement</th>
              <th className="border-b-2 border-brand-500 px-2.5 py-2 text-right font-normal">KR globaux</th>
              <th className="border-b-2 border-brand-500 px-2.5 py-2 text-right font-normal">Statut</th>
            </tr>
          </thead>
          <tbody>
            {ds.globalObjectives.map((o) => {
              const sc = computed.globalObjective.get(o.id)!;
              return (
                <tr key={o.id}>
                  <td className="whitespace-nowrap border-b border-[#E1E6EC] px-2.5 py-3 text-[15px] font-bold" style={{ color: o.color }}>{o.id}</td>
                  <td className="border-b border-[#E1E6EC] px-2.5 py-3 text-[15px]">{o.title}</td>
                  <td className="border-b border-[#E1E6EC] px-2.5 py-3">
                    <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={sc.progress} rag={sc.rag} /></div><b className="w-14 text-right text-brand-500">{pct(sc.progress)}</b></div>
                  </td>
                  <td className="border-b border-[#E1E6EC] px-2.5 py-3 text-right text-[17px] font-bold">{ds.globalKrs.filter((k) => k.objectiveId === o.id).length}</td>
                  <td className="border-b border-[#E1E6EC] px-2.5 py-3 text-right font-sans"><RagBadge rag={sc.rag} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ds.globalObjectives.map((o) => {
          const s = computed.globalObjective.get(o.id)!;
          const krs = ds.globalKrs.filter((k) => k.objectiveId === o.id);
          return (
            <Card key={o.id} className="border-t-4" style={{ borderTopColor: o.color }}>
              <div className="font-titre text-[44px] font-bold leading-none" style={{ color: o.color }}>{o.id}</div>
              <h3 className="mt-1.5 line-clamp-3 min-h-[3.9rem] font-serif text-[15.5px] font-bold leading-snug text-brand-500" title={o.title}>{o.title}</h3>
              <div className="my-3 flex items-center justify-between">
                <Gauge score={s} />
                <RagBadge rag={s.rag} />
              </div>
              <ul className="space-y-2">
                {krs.map((k) => {
                  const ks = computed.globalKr.get(k.id)!;
                  return (
                    <li key={k.id}>
                      <Link to={`/kr/${encodeURIComponent(k.id)}`} className="group block">
                        <div className="flex justify-between gap-2 text-xs">
                          <span className="truncate text-slate-600 group-hover:text-brand-600" title={k.title}><b className="text-brand-500">{k.id}</b> {k.title}</span>
                          <span className="whitespace-nowrap font-bold tabular-nums text-brand-500">{pct(ks.progress)}</span>
                        </div>
                        <ProgressBar value={ks.progress} rag={ks.rag} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          );
        })}
      </div>

      <Card title="KR globaux × Pays / Équipes" action={
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
          {(['green', 'amber', 'red', 'none'] as const).map((r) => (
            <span key={r} className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ background: RAG_HEX[r] }} />{RAG_STYLE[r].label}</span>
          ))}
          <span><b>L</b> = Lead · <b>C</b> = Contributes</span>
        </div>
      }>
        <div className="-mx-4 overflow-x-auto px-4">
          <table className="w-full border-separate border-spacing-0.5 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 rounded-l bg-brand-600 px-2 py-2.5 text-left font-normal text-white">KR global</th>
                {entities.map((e) => (
                  <th key={e.id} className="min-w-[44px] bg-brand-600 px-1 py-2.5 align-bottom font-normal text-white last:rounded-r">
                    <Link to={entityPath(e)} className="hover:text-accent">{e.name}</Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ds.globalKrs.map((k) => {
                const o = ds.globalObjectives.find((x) => x.id === k.objectiveId);
                const noLead = !ds.contributions.some((c) => c.globalKrId === k.id && c.role === 'Lead');
                return (
                  <tr key={k.id}>
                    <th className="sticky left-0 z-10 max-w-[220px] bg-white p-1 text-left font-normal">
                      <Link to={`/kr/${encodeURIComponent(k.id)}`} className="flex items-center gap-1.5 hover:text-brand-500" title={k.title}>
                        <span className="h-3 w-1 rounded-sm" style={{ background: o?.color }} />
                        <b className="text-brand-500">{k.id}</b><span className="truncate text-slate-500">{k.title}</span>
                        {noLead && <span className="rounded bg-red-50 px-1 text-[10px] font-semibold text-red-700" title="Aucun Lead">!</span>}
                      </Link>
                    </th>
                    {entities.map((e) => {
                      const cell = heatCell(ds, computed, k.id, e.id);
                      if (!cell) return <td key={e.id} className="h-8 rounded bg-slate-50" />;
                      const dark = cell.rag !== 'none';
                      return (
                        <td key={e.id} className="h-8 rounded p-0 text-center">
                          <Link to={entityPath(e)} title={`${k.id} · ${e.name}\nRôle : ${cell.role}\nAvancement : ${pct(cell.progress)}${cell.late ? `\n${cell.late} jalon(s) en retard` : ''}`}
                            className={`flex h-8 items-center justify-center rounded font-bold hover:ring-2 hover:ring-slate-400 ${dark ? 'text-white' : 'text-slate-600'}`}
                            style={{ background: RAG_HEX[cell.rag], outline: cell.role === 'Lead' ? '2px solid #0f172a' : undefined, outlineOffset: -2 }}>
                            {cell.role === 'Lead' ? 'L' : 'C'}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Alertes (${allAlerts.length})`}>
        <div className="mb-3 flex flex-wrap gap-2">
          <button onClick={() => setKind('all')} className={`rounded-full border px-3 py-1 text-[13px] ${kind === 'all' ? 'border-brand-600 bg-brand-600 text-white' : 'border-ligne bg-white text-slate-600'}`}>Toutes</button>
          {(Object.keys(ALERT_LABEL) as Alert['kind'][]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-[13px] ${kind === k ? 'border-brand-600 bg-brand-600 text-white' : 'border-ligne bg-white text-slate-600'}`}>
              {ALERT_LABEL[k]} ({counts[k]})
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className="text-sm text-slate-500">Aucune alerte.</p> : (
          <ul className="max-h-96 divide-y divide-[#eef0f3] overflow-y-auto">
            {shown.slice(0, 300).map((a, i) => (
              <li key={i} className="py-2">
                <Link to={a.link} className="block hover:bg-slate-50">
                  <div className={`text-[14.5px] font-semibold ${a.kind === 'late' || a.kind === 'no_lead' ? 'text-rag-red' : 'text-brand-500'}`}>{a.label}</div>
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
