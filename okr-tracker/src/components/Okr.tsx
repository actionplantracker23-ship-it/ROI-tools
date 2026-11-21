/** Blocs OKR réutilisés par les vues Pays, Équipe et KR global. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { money, pct } from '../lib/format';
import { krHasPlaceholder } from '../lib/progress';
import { STATUS_LABEL, type EntityKR, type Initiative, type MilestoneStatus } from '../types';
import { ObjectiveChip, ProgressBar, RagBadge, RoleBadge } from './ui';

// Bordure gauche à la couleur du statut (palette Big Wins)
const CELL: Record<MilestoneStatus, string> = {
  not_started: 'border-ligne border-l-4 border-l-rag-grey bg-white',
  in_progress: 'border-ligne border-l-4 border-l-rag-amber bg-[#fffaf0]',
  achieved: 'border-ligne border-l-4 border-l-rag-green bg-[#f2faf4]',
  late: 'border-ligne border-l-4 border-l-rag-red bg-[#fdf1f1]',
  cancelled: 'border-ligne border-l-4 border-l-[#2f3640] bg-slate-50 opacity-60',
};

/** Timeline Q1–Q4 d'une initiative. */
export function Timeline({ initiativeId }: { initiativeId: string }) {
  const { ds, quarter } = useApp();
  const ms = ds.milestones.filter((m) => m.initiativeId === initiativeId);
  return (
    <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {[1, 2, 3, 4].map((q) => {
        const m = ms.find((x) => x.quarter === q);
        return (
          <li key={q} className={`rounded-md border p-2 text-xs ${m ? CELL[m.status] : 'border-dashed border-ligne bg-transparent'} ${q === quarter ? 'ring-2 ring-accent/60' : ''}`}>
            <div className="mb-0.5 flex items-center justify-between gap-1">
              <span className="font-semibold text-slate-700">Q{q}</span>
              {m && <span className="text-[11px] font-medium text-slate-600">{STATUS_LABEL[m.status]}</span>}
            </div>
            <p className="line-clamp-3 text-slate-600" title={m?.description}>{m?.description ?? '—'}</p>
            {m?.actualValue !== null && m?.actualValue !== undefined && <p className="mt-0.5 font-medium text-slate-800">Réel : {m.actualValue}</p>}
            {m?.evidenceUrl && <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-brand-500 underline">Preuve</a>}
          </li>
        );
      })}
    </ol>
  );
}

export function InitiativeCard({ i, showEntity }: { i: Initiative; showEntity?: boolean }) {
  const { ds, computed } = useApp();
  const s = computed.initiative.get(i.id)!;
  const ent = ds.entities.find((e) => e.id === i.entityId);
  return (
    <div className="rounded-lg border border-ligne p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">{showEntity && ent && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ent.name}</span>}{i.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Lead : {i.lead || '—'} · Métrique : {i.metric} · Baseline : {i.baseline || '—'}
            {i.target !== null && <> · Cible : {i.target}</>} · Budget : {i.budget ? (i.budgetValue !== null ? money(i.budgetValue) : i.budget) : '—'}
          </p>
          {i.targetCountryIds.length > 0 && ent?.type === 'GlobalTeam' && (
            <p className="mt-0.5 text-xs text-slate-500">Pays visés : {i.targetCountryIds.map((c) => ds.entities.find((e) => e.id === c)?.name ?? c).join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {s.quant !== null && <span className="text-xs text-slate-500" title="(réel − baseline) / (cible − baseline)">Quantitatif {pct(s.quant)}</span>}
          <RagBadge rag={s.rag} score={s.progress} compact />
          <Link to={`/check-in?initiative=${encodeURIComponent(i.id)}`} className="no-print text-xs font-medium text-brand-500 hover:underline">Check-in</Link>
        </div>
      </div>
      <div className="mt-2"><Timeline initiativeId={i.id} /></div>
    </div>
  );
}

/** KR pays/équipe : KR globaux soutenus, avancement, initiatives dépliables. */
export function KrBlock({ kr, defaultOpen = false }: { kr: EntityKR; defaultOpen?: boolean }) {
  const { ds, computed } = useApp();
  const [open, setOpen] = useState(defaultOpen);
  const s = computed.entityKr.get(kr.id)!;
  const links = ds.contributions.filter((c) => c.entityKrId === kr.id);
  const inits = ds.initiatives.filter((i) => i.entityKrId === kr.id).sort((a, b) => a.order - b.order);
  const placeholder = krHasPlaceholder(ds, kr.id);
  return (
    <div className="rounded-lg border border-ligne bg-white">
      <button onClick={() => setOpen(!open)} className="w-full p-3 text-left" aria-expanded={open}>
        <div className="flex flex-wrap items-center gap-1.5">
          {links.map((c) => {
            const g = ds.globalKrs.find((x) => x.id === c.globalKrId);
            const o = ds.globalObjectives.find((x) => x.id === g?.objectiveId);
            return (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-1.5 py-0.5 ring-1 ring-slate-200" title={g?.title}>
                {o && <ObjectiveChip o={o} short />}<span className="text-xs font-semibold">{c.globalKrId}</span><RoleBadge role={c.role} />
              </span>
            );
          })}
          {links.length === 0 && <span className="text-xs text-slate-400">Non relié à un KR global</span>}
          {placeholder && <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-800 ring-1 ring-amber-200">Cible à compléter</span>}
          {kr.registerOnly && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Registre seul</span>}
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-slate-900">{kr.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <RagBadge rag={s.rag} score={s.progress} compact />
            <span className="text-slate-400">{open ? '▾' : '▸'}</span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500">
          <span>KR Lead : {kr.lead || '—'}</span>
          <span>{inits.length} initiative(s)</span>
          {s.quant !== null && <span>Quantitatif : {pct(s.quant)}</span>}
          {s.late > 0 && <span className="font-medium text-red-700">{s.late} jalon(s) en retard</span>}
        </div>
        <div className="mt-2"><ProgressBar value={s.progress} rag={s.rag} /></div>
      </button>
      {open && (
        <div className="space-y-2 border-t border-slate-100 p-3">
          {inits.length ? inits.map((i) => <InitiativeCard key={i.id} i={i} />) : <p className="text-sm text-slate-500">Aucune initiative dans l’onglet de plan.</p>}
        </div>
      )}
    </div>
  );
}

/** Ligne compacte dépliable (appui des équipes globales) : jalon du trimestre + timeline au clic. */
export function InitiativeRow({ i }: { i: Initiative }) {
  const { ds, computed, quarter } = useApp();
  const [open, setOpen] = useState(false);
  const s = computed.initiative.get(i.id)!;
  const m = ds.milestones.find((x) => x.initiativeId === i.id && x.quarter === quarter);
  return (
    <li className="py-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 text-left" aria-expanded={open}>
        <span className="mt-0.5 text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-800">{i.title}</span>
          <span className="block truncate text-xs text-slate-500">Lead : {i.lead || '—'} · Q{quarter} : {m ? `${STATUS_LABEL[m.status]} · ${m.description}` : 'pas de jalon'}</span>
        </span>
        <RagBadge rag={s.rag} score={s.progress} compact />
      </button>
      {open && <div className="mt-2 pl-5"><InitiativeCard i={i} /></div>}
    </li>
  );
}
