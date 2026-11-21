import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../AppContext';
import { Timeline } from '../components/Okr';
import { Card, EmptyState, Gauge, NoData, ObjectiveChip, PageHeader, RAG_HEX, RagBadge, RoleBadge } from '../components/ui';
import { entityPath, pct } from '../lib/format';
import { contributionWeight } from '../lib/progress';

export default function GlobalKRView() {
  const { id = '' } = useParams();
  const { ds, computed } = useApp();
  const [openInit, setOpenInit] = useState<string | null>(null);
  const kr = ds.globalKrs.find((k) => k.id === id);
  if (!ds.globalKrs.length) return <NoData />;
  if (!kr) return <EmptyState title="KR global introuvable" />;

  const o = ds.globalObjectives.find((x) => x.id === kr.objectiveId)!;
  const score = computed.globalKr.get(kr.id)!;
  const links = ds.contributions.filter((c) => c.globalKrId === kr.id)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'Lead' ? -1 : 1));
  const totalW = links.reduce((a, c) => a + contributionWeight(c, ds.settings), 0);
  const chart = links.map((c) => {
    const e = ds.entities.find((x) => x.id === c.entityId)!;
    const s = computed.entityKr.get(c.entityKrId)!;
    const w = contributionWeight(c, ds.settings);
    return {
      name: e.name, role: c.role, progress: s.progress, hasData: s.progress !== null, rag: s.rag,
      // part de l'entité dans l'avancement du KR global (points de %)
      share: totalW ? ((s.progress ?? 0) * w) / totalW : 0, weight: w,
    };
  });
  const idx = ds.globalKrs.findIndex((k) => k.id === kr.id);
  const prev = ds.globalKrs[idx - 1];
  const next = ds.globalKrs[idx + 1];

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<ObjectiveChip o={o} />} title={<><span className="text-slate-400">{kr.id}</span> {kr.title}</>}
        actions={<>
          {prev && <Link to={`/kr/${encodeURIComponent(prev.id)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">← {prev.id}</Link>}
          {next && <Link to={`/kr/${encodeURIComponent(next.id)}`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{next.id} →</Link>}
        </>} />

      <div className="grid gap-4 lg:grid-cols-[auto,1fr]">
        <Card className="flex flex-col items-center justify-center gap-2 lg:w-60">
          <Gauge score={score} size={160} />
          <RagBadge rag={score.rag} />
          <p className="text-center text-xs text-slate-500">Moyenne pondérée des KR liés (Lead × {ds.settings.weights.Lead}, Contributes × {ds.settings.weights.Contributes}).</p>
          {!links.some((c) => c.role === 'Lead') && <p className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Aucun pays/équipe Lead</p>}
        </Card>
        <Card title="Contribution par entité">
          {chart.length === 0 ? <p className="text-sm text-slate-500">Aucune entité liée.</p> : (
            <div style={{ height: Math.max(160, chart.length * 34 + 40) }}>
              <ResponsiveContainer>
                <BarChart data={chart} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 8 }} barCategoryGap={6}>
                  <CartesianGrid horizontal={false} stroke="#e2e8f0" />
                  <XAxis type="number" domain={[0, 100]} unit=" %" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis type="category" dataKey="name" width={96} tick={{ fontSize: 12, fill: '#334155' }} axisLine={false} tickLine={false} />
                  <Tooltip cursor={{ fill: '#f1f5f9' }} content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload as (typeof chart)[number];
                    return (
                      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
                        <div className="font-semibold">{d.name} · {d.role}</div>
                        <div>Avancement : {d.hasData ? pct(d.progress) : 'sans donnée'}</div>
                        <div>Poids : {d.weight} · Apport au KR global : {pct(d.share, 1)}</div>
                      </div>
                    );
                  }} />
                  <Bar dataKey="progress" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {chart.map((d, i) => <Cell key={i} fill={RAG_HEX[d.rag]} />)}
                    <LabelList dataKey="progress" position="right" style={{ fontSize: 11, fill: '#475569' }}
                      formatter={(v: number | null) => (v === null ? 'sans donnée' : pct(v))} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      <Card title="Arbre de contribution">
        <ul className="space-y-3">
          {links.map((c) => {
            const e = ds.entities.find((x) => x.id === c.entityId)!;
            const k = ds.entityKrs.find((x) => x.id === c.entityKrId)!;
            const s = computed.entityKr.get(k.id)!;
            const inits = ds.initiatives.filter((i) => i.entityKrId === k.id);
            return (
              <li key={c.id} className="rounded-lg border border-slate-200">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <RoleBadge role={c.role} />
                  <Link to={entityPath(e)} className="text-sm font-semibold text-brand-700 hover:underline">{e.name}</Link>
                  <span className="text-xs text-slate-500">{c.scope}{c.inferred ? ' · lien déduit de l’onglet' : ''} · poids {contributionWeight(c, ds.settings)}</span>
                  <span className="ml-auto"><RagBadge rag={s.rag} score={s.progress} compact /></span>
                </div>
                <div className="px-3 py-2">
                  <p className="text-sm text-slate-800">{k.title}</p>
                  <p className="text-xs text-slate-500">KR Lead : {k.lead || '—'}</p>
                  <ul className="mt-2 space-y-1 border-l-2 border-slate-200 pl-3">
                    {inits.map((i) => {
                      const is = computed.initiative.get(i.id)!;
                      return (
                        <li key={i.id}>
                          <button onClick={() => setOpenInit(openInit === i.id ? null : i.id)} className="flex w-full items-center gap-2 text-left text-sm hover:text-brand-700">
                            <span className="text-slate-400">{openInit === i.id ? '▾' : '▸'}</span>
                            <span className="flex-1">{i.title}</span>
                            <RagBadge rag={is.rag} score={is.progress} compact />
                          </button>
                          {openInit === i.id && <div className="my-2"><Timeline initiativeId={i.id} /></div>}
                        </li>
                      );
                    })}
                    {!inits.length && <li className="text-xs text-slate-400">Aucune initiative.</li>}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
