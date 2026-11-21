import { useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { InitiativeRow, KrBlock } from '../components/Okr';
import { Button, Card, EmptyState, Gauge, NoData, PageHeader, ProgressBar, RagBadge, Stat } from '../components/ui';
import { exportPdf, exportRows } from '../lib/export';
import { pct } from '../lib/format';
import { milestoneStats, supportToCountry } from '../lib/selectors';
import { STATUS_LABEL } from '../types';

export default function CountryView() {
  const { id = '' } = useParams();
  const { ds, computed, quarter } = useApp();
  const ref = useRef<HTMLDivElement>(null);
  const country = ds.entities.find((e) => e.id === id);
  if (!ds.globalKrs.length) return <NoData />;
  if (!country) return <EmptyState title="Pays introuvable" />;

  const score = computed.entity.get(id)!;
  const objectives = ds.entityObjectives.filter((o) => o.entityId === id);
  const krs = ds.entityKrs.filter((k) => k.entityId === id);
  const orphan = krs.filter((k) => !k.objectiveId);
  const stats = milestoneStats(ds, quarter, id);
  const support = supportToCountry(ds, id);
  const supportTeams = [...new Set(support.map((i) => i.entityId))];

  const exportXlsx = () => {
    const rows = ds.initiatives.filter((i) => i.entityId === id).flatMap((i) => {
      const kr = krs.find((k) => k.id === i.entityKrId);
      return ds.milestones.filter((m) => m.initiativeId === i.id).map((m) => ({
        'Objectif pays': objectives.find((o) => o.id === kr?.objectiveId)?.title ?? '',
        'KR pays': kr?.title ?? '',
        'KR globaux': ds.contributions.filter((c) => c.entityKrId === kr?.id).map((c) => `${c.globalKrId} (${c.role})`).join(', '),
        Initiative: i.title, 'Initiative Lead': i.lead, Trimestre: `Q${m.quarter}`, Jalon: m.description,
        Statut: STATUS_LABEL[m.status], 'Valeur réelle': m.actualValue ?? '', Preuve: m.evidenceUrl, Commentaire: m.comment,
      }));
    });
    exportRows(rows, `OKR-2027-${country.name}`, 'xlsx');
  };

  return (
    <div ref={ref} className="space-y-5 bg-slate-50">
      <PageHeader eyebrow="Vue pays" title={country.name} subtitle={`Avancement à fin Q${quarter} 2027. Le pays porte la livraison ; les équipes globales sont en appui.`}
        actions={<>
          <Button onClick={exportXlsx}>Export Excel</Button>
          <Button onClick={() => ref.current && exportPdf(ref.current, `OKR-2027-${country.name}`)}>Export PDF</Button>
        </>} />

      <div className="grid gap-4 md:grid-cols-[auto,1fr]">
        <Card className="flex flex-col items-center justify-center gap-2 md:w-60">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Objectif pays</div>
          <Gauge score={score} size={160} />
          <RagBadge rag={score.rag} />
        </Card>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Objectifs pays" value={objectives.length} />
          <Stat label="KR pays" value={krs.length} />
          <Stat label={`Jalons échus (≤ Q${quarter})`} value={stats.due} hint={`${stats.achieved} atteints`} />
          <Stat label="En retard" value={<span className={stats.late ? 'text-red-700' : ''}>{stats.late}</span>} />
          <Card className="col-span-2 sm:col-span-4" title="Objectifs du pays">
            <ul className="space-y-2">
              {objectives.map((o) => {
                const s = computed.entityObjective.get(o.id)!;
                return (
                  <li key={o.id}>
                    <div className="flex justify-between gap-2 text-sm"><span className="text-slate-700">{o.title}</span><span className="tabular-nums font-medium">{pct(s.progress)}</span></div>
                    <ProgressBar value={s.progress} rag={s.rag} />
                  </li>
                );
              })}
              {!objectives.length && <li className="text-sm text-slate-500">Aucun objectif pays dans le fichier.</li>}
            </ul>
          </Card>
        </div>
      </div>

      {objectives.map((o) => (
        <section key={o.id} className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">{o.title}</h2>
          {krs.filter((k) => k.objectiveId === o.id).map((k) => <KrBlock key={k.id} kr={k} />)}
        </section>
      ))}
      {orphan.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-700">KR sans objectif pays</h2>
          {orphan.map((k) => <KrBlock key={k.id} kr={k} />)}
        </section>
      )}

      <Card title={`Appui des équipes globales à ce pays (${support.length} initiative(s))`}>
        <p className="mb-3 text-xs text-slate-500">
          Initiatives des équipes globales (GSE, PEI, PSE, DHGP…) qui mentionnent {country.name} ou « all countries ». Elles soutiennent le pays sans remplacer sa responsabilité.
        </p>
        {supportTeams.length === 0 ? <p className="text-sm text-slate-500">Aucune initiative d’appui identifiée.</p> : supportTeams.map((t) => {
          const team = ds.entities.find((e) => e.id === t)!;
          const list = support.filter((i) => i.entityId === t);
          const sc = computed.entity.get(t)!;
          return (
            <details key={t} className="border-t border-slate-100 py-2 first:border-t-0">
              <summary className="flex cursor-pointer items-center gap-2 text-sm">
                <Link to={`/equipe/${t}`} className="font-semibold text-brand-700 hover:underline">{team.name}</Link>
                <span className="text-xs text-slate-500">{list.length} initiative(s)</span>
                <span className="ml-auto"><RagBadge rag={sc.rag} score={sc.progress} compact /></span>
              </summary>
              <ul className="divide-y divide-slate-100 pl-2">{list.map((i) => <InitiativeRow key={i.id} i={i} />)}</ul>
            </details>
          );
        })}
      </Card>
    </div>
  );
}
