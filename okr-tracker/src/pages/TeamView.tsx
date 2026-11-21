import { Link, useParams } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../AppContext';
import { KrBlock } from '../components/Okr';
import { Card, EmptyState, Gauge, NoData, PageHeader, RagBadge, RoleBadge, Stat } from '../components/ui';
import { money, pct } from '../lib/format';
import { milestoneStats } from '../lib/selectors';

export default function TeamView() {
  const { id = '' } = useParams();
  const { ds, computed, quarter } = useApp();
  const team = ds.entities.find((e) => e.id === id);
  if (!ds.globalKrs.length) return <NoData />;
  if (!team) return <EmptyState title="Équipe introuvable" />;

  const score = computed.entity.get(id)!;
  const krs = ds.entityKrs.filter((k) => k.entityId === id);
  const objectives = ds.entityObjectives.filter((o) => o.entityId === id);
  const inits = ds.initiatives.filter((i) => i.entityId === id);
  const links = ds.contributions.filter((c) => c.entityId === id);
  const globalIds = [...new Set(links.map((c) => c.globalKrId))];
  const budget = inits.reduce((a, i) => a + (i.budgetValue ?? 0), 0);
  const budgetMissing = inits.filter((i) => i.budgetValue === null).length;
  const countries = ds.entities.filter((e) => e.type === 'Country');
  const beneficiaries = countries.map((c) => ({ name: c.name, id: c.id, initiatives: inits.filter((i) => i.targetCountryIds.includes(c.id)).length }));
  const stats = milestoneStats(ds, quarter, id);

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={team.group ? `Équipe globale · ${team.group}` : 'Équipe globale'} title={team.name}
        subtitle="Fonction d’appui : contribue aux KR globaux et aux objectifs des pays." />

      <div className="grid gap-4 md:grid-cols-[auto,1fr]">
        <Card className="flex flex-col items-center justify-center gap-2 md:w-60">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Avancement de l’équipe</div>
          <Gauge score={score} size={160} />
          <RagBadge rag={score.rag} />
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="KR de l’équipe" value={krs.length} />
          <Stat label="Initiatives" value={inits.length} />
          <Stat label={`Jalons échus (≤ Q${quarter})`} value={stats.due} hint={`${stats.late} en retard`} />
          <Stat label="Budget indicatif" value={budget ? money(budget) : '—'} hint={budgetMissing ? `${budgetMissing} initiative(s) sans montant` : undefined} />
          <Card className="col-span-2 sm:col-span-4" title="KR globaux soutenus">
            <ul className="grid gap-2 sm:grid-cols-2">
              {globalIds.map((g) => {
                const gk = ds.globalKrs.find((x) => x.id === g)!;
                const lead = links.some((c) => c.globalKrId === g && c.role === 'Lead');
                const s = computed.globalKr.get(g)!;
                return (
                  <li key={g}>
                    <Link to={`/kr/${encodeURIComponent(g)}`} className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 text-sm hover:bg-slate-50">
                      <b>{g}</b><RoleBadge role={lead ? 'Lead' : 'Contributes'} />
                      <span className="min-w-0 flex-1 truncate text-slate-600" title={gk?.title}>{gk?.title}</span>
                      <span className="tabular-nums">{pct(s?.progress)}</span>
                    </Link>
                  </li>
                );
              })}
              {!globalIds.length && <li className="text-sm text-slate-500">Aucun lien dans le registre.</li>}
            </ul>
          </Card>
        </div>
      </div>

      <Card title="Pays bénéficiaires (initiatives qui les visent)">
        <div className="h-56">
          <ResponsiveContainer>
            <BarChart data={beneficiaries} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(v) => [v, 'Initiatives']} />
              <Bar dataKey="initiatives" fill="#17633e" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">Pays détectés dans le texte des initiatives et jalons ; l’admin peut corriger depuis la page Mise à jour.</p>
      </Card>

      {objectives.map((o) => (
        <section key={o.id} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">{o.title}</h2>
          {krs.filter((k) => k.objectiveId === o.id).map((k) => <KrBlock key={k.id} kr={k} />)}
        </section>
      ))}
      {krs.filter((k) => !k.objectiveId).map((k) => <KrBlock key={k.id} kr={k} />)}
    </div>
  );
}
