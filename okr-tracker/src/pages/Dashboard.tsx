import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { entityPath, pct } from '../lib/format';
import { alerts, type Alert } from '../lib/progress';
import { heatCell, milestoneStats } from '../lib/selectors';
import { Card, Gauge, NoData, ObjectiveChip, PageHeader, ProgressBar, RAG_HEX, RAG_STYLE, RagBadge, Stat } from '../components/ui';

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
      <PageHeader title="Tableau de bord global" subtitle={`Avancement consolidé à fin Q${quarter} 2027 : jalons → initiatives → KR pays/équipes → KR globaux → objectifs.`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="KR globaux" value={ds.globalKrs.length} />
        <Stat label="KR pays/équipes" value={ds.entityKrs.length} />
        <Stat label="Initiatives" value={ds.initiatives.length} />
        <Stat label={`Jalons échus (≤ Q${quarter})`} value={stats.due} hint={`${stats.achieved} atteints · ${stats.inProgress} en cours`} />
        <Stat label="Jalons en retard" value={<span className={stats.late ? 'text-red-700' : ''}>{stats.late}</span>} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {ds.globalObjectives.map((o) => {
          const s = computed.globalObjective.get(o.id)!;
          const krs = ds.globalKrs.filter((k) => k.objectiveId === o.id);
          return (
            <Card key={o.id} className="border-t-4" style={{ borderTopColor: o.color }}>
              <ObjectiveChip o={o} short />
              <h3 className="mt-1 line-clamp-3 min-h-[3.75rem] text-sm font-semibold text-slate-800" title={o.title}>{o.title}</h3>
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
                          <span className="truncate text-slate-600 group-hover:text-brand-700" title={k.title}><b>{k.id}</b> {k.title}</span>
                          <span className="tabular-nums text-slate-700">{pct(ks.progress)}</span>
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
                <th className="sticky left-0 z-10 bg-white p-1 text-left font-semibold text-slate-500">KR global</th>
                {entities.map((e) => (
                  <th key={e.id} className="min-w-[44px] p-1 align-bottom font-semibold text-slate-600">
                    <Link to={entityPath(e)} className="hover:text-brand-700">{e.name}</Link>
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
                      <Link to={`/kr/${encodeURIComponent(k.id)}`} className="flex items-center gap-1.5 hover:text-brand-700" title={k.title}>
                        <span className="h-3 w-1 rounded-sm" style={{ background: o?.color }} />
                        <b>{k.id}</b><span className="truncate text-slate-500">{k.title}</span>
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
          <button onClick={() => setKind('all')} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === 'all' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>Toutes</button>
          {(Object.keys(ALERT_LABEL) as Alert['kind'][]).map((k) => (
            <button key={k} onClick={() => setKind(k)} className={`rounded-full px-3 py-1 text-xs font-medium ${kind === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>
              {ALERT_LABEL[k]} ({counts[k]})
            </button>
          ))}
        </div>
        {shown.length === 0 ? <p className="text-sm text-slate-500">Aucune alerte.</p> : (
          <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
            {shown.slice(0, 300).map((a, i) => (
              <li key={i} className="py-2">
                <Link to={a.link} className="block hover:bg-slate-50">
                  <div className={`text-sm font-medium ${a.kind === 'late' || a.kind === 'no_lead' ? 'text-red-700' : 'text-slate-800'}`}>{a.label}</div>
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
