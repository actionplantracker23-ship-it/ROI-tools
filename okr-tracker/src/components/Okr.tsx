/** Blocs OKR réutilisés par les vues Pays, Département, KR global et Plan global. */
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { money, pct } from '../lib/format';

import { isAdmin } from '../lib/permissions';
import { STATUS_LABEL, type EntityKR, type Indicator, type Initiative, type MilestoneStatus, type Quarter } from '../types';
import { ObjectiveChip, ProgressBar, RAG_HEX, RagBadge, RoleBadge } from './ui';

// Bordure gauche à la couleur du statut (palette Big Wins)
const CELL: Record<MilestoneStatus, string> = {
  not_started: 'border-ligne border-l-4 border-l-rag-grey bg-white',
  in_progress: 'border-ligne border-l-4 border-l-rag-amber bg-[#fffaf0]',
  achieved: 'border-ligne border-l-4 border-l-rag-green bg-[#f2faf4]',
  late: 'border-ligne border-l-4 border-l-rag-red bg-[#fdf1f1]',
  cancelled: 'border-ligne border-l-4 border-l-[#2f3640] bg-slate-50 opacity-60',
};

export const fmtValue = (ind: Indicator, v: number | null | undefined) =>
  v === null || v === undefined ? '—' : ind.metric === 'Yes/No' ? (v >= 1 ? 'Oui' : 'Non') : `${new Intl.NumberFormat('fr-FR').format(v)}${ind.unit === '%' ? ' %' : ind.unit && ind.unit !== 'Date' ? ` ${ind.unit}` : ''}`;

/** Timeline Q1–Q4 d'une initiative. */
export function Timeline({ initiativeId }: { initiativeId: string }) {
  const { idx, quarter } = useApp();
  const ms = idx.msByInit.get(initiativeId) ?? [];
  return (
    <ol className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {[1, 2, 3, 4].map((q) => {
        const m = ms.find((x) => x.quarter === q);
        return (
          <li key={q} className={`rounded-md border p-2 text-xs ${m ? CELL[m.status] : 'border-dashed border-slate-200 bg-transparent'} ${q === quarter ? 'ring-2 ring-accent/60' : ''}`}>
            <div className="mb-0.5 flex items-center justify-between gap-1">
              <span className="font-semibold text-slate-700">Q{q}</span>
              {m && <span className="text-[11px] font-medium text-slate-600">{STATUS_LABEL[m.status]}</span>}
            </div>
            <p className="line-clamp-3 text-slate-600" title={m?.description}>{m?.description ?? '—'}</p>
            {m?.evidenceUrl && <a href={m.evidenceUrl} target="_blank" rel="noreferrer" className="mt-0.5 block truncate text-brand-500 underline">Preuve</a>}
          </li>
        );
      })}
    </ol>
  );
}

/** Tableau des indicateurs de mesure d'un KR : baseline, valeurs et cibles par trimestre, avancement. */
export function IndicatorTable({ krId, compact }: { krId: string; compact?: boolean }) {
  const { idx, computed, quarter } = useApp();
  const inds = idx.indByKr.get(krId) ?? [];
  if (!inds.length) {
    return (
      <p className="rounded-md bg-[#fff8ec] px-3 py-2 text-sm text-[#8a4b00]">
        Aucun indicateur de mesure pour ce KR. <Link className="font-semibold underline" to={`/check-in?kr=${encodeURIComponent(krId)}`}>Ajouter un indicateur</Link>
      </p>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="suivi min-w-[720px] text-sm">
        <thead>
          <tr>
            <th>Indicateur</th><th>Baseline</th>
            {[1, 2, 3, 4].map((q) => <th key={q} className={q === quarter ? '!bg-brand-500' : ''}>Q{q}</th>)}
            <th>Cible</th><th className="w-40">Avancement</th>
          </tr>
        </thead>
        <tbody>
          {inds.map((ind) => {
            const sc = computed.indicator.get(ind.id)!;
            const values = idx.valuesByInd.get(ind.id) ?? [];
            return (
              <tr key={ind.id}>
                <td>
                  <div className="font-medium text-[#1d2327]">{ind.name}</div>
                  {!compact && ind.source && <div className="text-xs text-slate-500">Source : {ind.source}</div>}
                  {ind.origin === 'manual' && <span className="text-[11px] text-slate-400">ajouté dans l’outil</span>}
                </td>
                <td className="whitespace-nowrap">{ind.baseline !== null ? fmtValue(ind, ind.baseline) : ind.baselineText || '—'}</td>
                {([1, 2, 3, 4] as Quarter[]).map((q) => {
                  const v = values.filter((x) => x.quarter === q).sort((a, b) => b.at.localeCompare(a.at))[0];
                  const t = ind.quarterTargets?.[q - 1];
                  const ok = v?.value == null || t == null ? null : (ind.target ?? 0) >= (ind.baseline ?? 0) ? v.value >= t : v.value <= t;
                  return (
                    <td key={q} className={`whitespace-nowrap ${q === quarter ? 'bg-[#f5f8fb]' : ''} ${q > quarter ? 'text-slate-400' : ''}`}>
                      <b className={ok === false ? 'text-rag-red' : ok ? 'text-rag-green' : ''}>{v ? fmtValue(ind, v.value) : '—'}</b>
                      {t != null && <div className="text-[11px] text-slate-500">cible {fmtValue(ind, t)}</div>}
                    </td>
                  );
                })}
                <td className="whitespace-nowrap font-semibold text-brand-500">{ind.target !== null ? fmtValue(ind, ind.target) : '—'}</td>
                <td>
                  <div className="flex items-center gap-2"><div className="flex-1"><ProgressBar value={sc.progress} rag={sc.rag} /></div><span className="w-12 text-right text-xs font-semibold">{pct(sc.progress)}</span></div>
                  {sc.value === null ? <div className="text-[11px] text-slate-400">non renseigné</div>
                    : sc.valueQuarter !== quarter && <div className="text-[11px] text-amber-700">dernière mesure : Q{sc.valueQuarter}</div>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Cascade : département global auquel répond un KR pays (modifiable par l'admin). */
export function DepartmentChip({ kr }: { kr: EntityKR }) {
  const { ds, idx, user, setKrDepartment } = useApp();
  const [edit, setEdit] = useState(false);
  const dep = kr.departmentId ? idx.entity.get(kr.departmentId) : null;
  const deps = ds.entities.filter((e) => e.type === 'GlobalTeam');
  if (edit) {
    return (
      <select autoFocus className="rounded-md border border-[#c9ced4] px-1.5 py-0.5 text-xs" value={kr.departmentId ?? ''}
        onChange={async (e) => { await setKrDepartment(kr.id, e.target.value || null); setEdit(false); }} onBlur={() => setEdit(false)}>
        <option value="">— aucun —</option>
        {deps.map((d) => <option key={d.id} value={d.id}>{d.name}{d.group ? ` (${d.group})` : ''}</option>)}
      </select>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#c9d6e2] bg-white px-2 py-px text-[12px] text-brand-500"
      title={kr.departmentSource === 'unit' ? 'D’après la colonne Team/Unit' : kr.departmentSource === 'ref' ? 'D’après le département Lead du même KR global' : 'Rattachement manuel'}>
      Répond à :{' '}
      {dep ? <Link to={`/equipe/${dep.id}`} className="font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>{dep.name}</Link> : <b className="text-rag-red">à rattacher</b>}
      {isAdmin(user) && <button type="button" className="ml-0.5 text-slate-400 hover:text-accent" aria-label="Modifier le département" onClick={(e) => { e.stopPropagation(); setEdit(true); }}>✎</button>}
    </span>
  );
}

export function InitiativeCard({ i, showEntity }: { i: Initiative; showEntity?: boolean }) {
  const { idx, computed } = useApp();
  const s = computed.initiative.get(i.id)!;
  const ent = idx.entity.get(i.entityId);
  return (
    <div className="rounded-md border border-ligne p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#1d2327]">{showEntity && ent && <span className="mr-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">{ent.name}</span>}{i.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Lead : {i.lead || '—'} · Métrique : {i.metric} · Baseline : {i.baseline || '—'} · Budget : {i.budget ? (i.budgetValue !== null ? money(i.budgetValue) : i.budget) : '—'}
          </p>
          {i.targetCountryIds.length > 0 && ent?.type === 'GlobalTeam' && (
            <p className="mt-0.5 text-xs text-slate-500">Pays visés : {i.targetCountryIds.map((c) => idx.entity.get(c)?.name ?? c).join(', ')}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <RagBadge rag={s.rag} score={s.progress} compact />
          <Link to={`/check-in?initiative=${encodeURIComponent(i.id)}`} className="no-print text-xs font-semibold text-brand-500 hover:text-accent">Check-in</Link>
        </div>
      </div>
      <div className="mt-2"><Timeline initiativeId={i.id} /></div>
    </div>
  );
}

/** KR pays/département : KR globaux soutenus, département de rattachement, indicateurs, activités. */
export function KrBlock({ kr, defaultOpen = false }: { kr: EntityKR; defaultOpen?: boolean }) {
  const { ds, idx, computed } = useApp();
  const [params] = useSearchParams();
  const focused = params.get('kr') === kr.id;
  const [open, setOpen] = useState(defaultOpen || focused);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focused) { setOpen(true); ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  }, [focused]);
  const s = computed.entityKr.get(kr.id)!;
  const links = idx.linksByKr.get(kr.id) ?? [];
  const inits = idx.initByKr.get(kr.id) ?? [];
  const inds = idx.indByKr.get(kr.id) ?? [];
  const isCountry = idx.entity.get(kr.entityId)?.type === 'Country';
  const placeholder = /\[\s*[A-Z]\s*\]|\bTBC\b|\bTBD\b|\bx{2,}\b/i.test(kr.title);
  return (
    <div ref={ref} id={`kr-${kr.id}`} className={`scroll-mt-32 rounded-lg border bg-white ${focused ? 'border-accent ring-2 ring-accent/30' : 'border-ligne'}`}>
      <div role="button" tabIndex={0} onClick={() => setOpen(!open)} onKeyDown={(e) => e.key === 'Enter' && setOpen(!open)} className="w-full cursor-pointer p-3 text-left" aria-expanded={open}>
        <div className="flex flex-wrap items-center gap-1.5">
          {links.map((c) => {
            const g = idx.globalKr.get(c.globalKrId);
            const o = ds.globalObjectives.find((x) => x.id === g?.objectiveId);
            return (
              <span key={c.id} className="inline-flex items-center gap-1 rounded-md bg-[#f5f8fb] px-1.5 py-0.5 ring-1 ring-[#dce3ea]" title={g?.title}>
                {o && <ObjectiveChip o={o} short />}<span className="text-xs font-semibold text-brand-500">{c.globalKrId}</span><RoleBadge role={c.role} />
              </span>
            );
          })}
          {links.length === 0 && <span className="text-xs text-slate-400">Non relié à un KR global</span>}
          {isCountry && <DepartmentChip kr={kr} />}
          {placeholder && <span className="rounded bg-[#fff3e6] px-1.5 py-0.5 text-[11px] font-medium text-[#9a4a00] ring-1 ring-[#f7c08b]">Cible à compléter</span>}
          {kr.registerOnly && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Registre seul</span>}
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="text-[15px] font-semibold text-[#1d2327]">{kr.title}</p>
          <div className="flex shrink-0 items-center gap-2">
            <RagBadge rag={s.rag} score={s.progress} compact />
            <span className="text-slate-400">{open ? '▾' : '▸'}</span>
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
          <span>KR Lead : {kr.lead || '—'}</span>
          <span>{inits.length} activité(s) · jalons {pct(s.milestones)}</span>
          <span className={inds.length ? '' : 'font-semibold text-[#9a4a00]'}>{inds.length} indicateur(s) · mesure {pct(s.indicators)}</span>
          {s.late > 0 && <span className="font-semibold text-rag-red">{s.late} jalon(s) en retard</span>}
        </div>
        <div className="mt-2"><ProgressBar value={s.progress} rag={s.rag} /></div>
      </div>
      {open && (
        <div className="space-y-3 border-t border-[#eef0f3] p-3">
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-brand-500">Indicateurs de mesure du résultat</h4>
            <IndicatorTable krId={kr.id} />
          </div>
          <div>
            <h4 className="mb-1.5 text-sm font-semibold text-brand-500">Activités et jalons</h4>
            <div className="space-y-2">
              {inits.length ? inits.map((i) => <InitiativeCard key={i.id} i={i} />) : <p className="text-sm text-slate-500">Aucune activité dans l’onglet de plan.</p>}
            </div>
          </div>
          <Link to={`/check-in?kr=${encodeURIComponent(kr.id)}`} className="no-print inline-block text-sm font-semibold text-brand-500 hover:text-accent">Mettre à jour ce KR →</Link>
        </div>
      )}
    </div>
  );
}

/** Ligne compacte dépliable (appui des équipes globales) : jalon du trimestre + timeline au clic. */
export function InitiativeRow({ i }: { i: Initiative }) {
  const { idx, computed, quarter } = useApp();
  const [open, setOpen] = useState(false);
  const s = computed.initiative.get(i.id)!;
  const m = (idx.msByInit.get(i.id) ?? []).find((x) => x.quarter === quarter);
  return (
    <li className="py-2">
      <button onClick={() => setOpen(!open)} className="flex w-full items-start gap-2 text-left" aria-expanded={open}>
        <span className="mt-0.5 text-slate-400">{open ? '▾' : '▸'}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-[#1d2327]">{i.title}</span>
          <span className="block truncate text-xs text-slate-500">Lead : {i.lead || '—'} · Q{quarter} : {m ? `${STATUS_LABEL[m.status]} · ${m.description}` : 'pas de jalon'}</span>
        </span>
        <RagBadge rag={s.rag} score={s.progress} compact />
      </button>
      {open && <div className="mt-2 pl-5"><InitiativeCard i={i} /></div>}
    </li>
  );
}

/** Mini-barre d'avancement avec pastille RAG (listes denses). */
export function MiniProgress({ value, rag }: { value: number | null; rag: keyof typeof RAG_HEX }) {
  return (
    <span className="inline-flex w-32 items-center gap-1.5">
      <span className="h-2 flex-1 overflow-hidden bg-[#EEF0F2]"><span className="block h-full" style={{ width: `${Math.max(0, Math.min(100, value ?? 0))}%`, background: RAG_HEX[rag] }} /></span>
      <span className="w-10 text-right text-xs font-semibold tabular-nums text-brand-500">{pct(value)}</span>
    </span>
  );
}

