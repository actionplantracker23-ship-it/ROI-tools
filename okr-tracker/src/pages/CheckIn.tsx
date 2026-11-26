/**
 * Mise à jour trimestrielle (check-in), organisée par KR :
 *  1. indicateurs de mesure : valeur du trimestre, lien de preuve, commentaire (historique conservé) ;
 *     le Lead peut ajouter, modifier ou supprimer un indicateur ;
 *  2. activités : statut du jalon du trimestre, preuve selon « Evidence Source and Rule », commentaire.
 * Utilisable sur mobile (gros boutons, une colonne).
 */
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { DepartmentChip, fmtValue } from '../components/Okr';
import { Button, Card, EmptyState, inputCls, NoData, PageHeader, ProgressBar, StatusBadge } from '../components/ui';
import { dateTime, pct } from '../lib/format';
import { hash } from '../lib/import/normalize';
import { canEditEntity, isAdmin } from '../lib/permissions';
import { STATUS_LABEL, type EntityKR, type Indicator, type Initiative, type Milestone, type MilestoneStatus, type MetricType, type Quarter } from '../types';

const STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'achieved', 'late', 'cancelled'];
const parseNum = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};

// ------------------------------------------------------------------ indicateurs

function IndicatorValueForm({ ind, quarter, editable }: { ind: Indicator; quarter: Quarter; editable: boolean }) {
  const { idx, computed, user, addIndicatorValue, saveIndicator, deleteIndicator } = useApp();
  const history = (idx.valuesByInd.get(ind.id) ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const current = history.find((v) => v.quarter === quarter);
  const [value, setValue] = useState(current?.value?.toString() ?? '');
  const [evidence, setEvidence] = useState(current?.evidenceUrl ?? '');
  const [comment, setComment] = useState(current?.comment ?? '');
  const [showHistory, setShowHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setValue(current?.value?.toString() ?? ''); setEvidence(current?.evidenceUrl ?? ''); setComment(current?.comment ?? '');
  }, [current, quarter]);
  const sc = computed.indicator.get(ind.id);
  const qt = ind.quarterTargets?.[quarter - 1] ?? null;
  const yesNo = ind.metric === 'Yes/No';
  const n = yesNo ? (value === '' ? null : Number(value)) : parseNum(value);
  const invalid = Number.isNaN(n);
  const dirty = value !== (current?.value?.toString() ?? '') || evidence !== (current?.evidenceUrl ?? '') || comment !== (current?.comment ?? '');

  const save = () => addIndicatorValue({
    id: crypto.randomUUID(), indicatorId: ind.id, quarter, value: n as number | null, evidenceUrl: evidence.trim(), comment: comment.trim(),
    at: new Date().toISOString(), by: user?.name || user?.email || 'inconnu',
  });

  if (editing) return <IndicatorEditor kr={idx.kr.get(ind.entityKrId)!} ind={ind} onDone={() => setEditing(false)} onSave={saveIndicator} onDelete={() => deleteIndicator(ind.id)} />;

  return (
    <div className="rounded-md border border-ligne p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-semibold text-[#1d2327]">{ind.name}</div>
          <div className="text-xs text-slate-500">
            Baseline : {ind.baseline !== null ? fmtValue(ind, ind.baseline) : ind.baselineText || '—'} · Cible Q{quarter} : {qt !== null ? fmtValue(ind, qt) : '—'} · Cible finale : {ind.target !== null ? fmtValue(ind, ind.target) : '—'}
          </div>
          {ind.source && <div className="mt-0.5 text-xs text-slate-500"><b>Source / règle de preuve :</b> {ind.source}</div>}
        </div>
        <div className="w-40">
          <ProgressBar value={sc?.progress ?? null} rag={sc?.rag} />
          <div className="mt-0.5 text-right text-xs font-semibold text-brand-500">{pct(sc?.progress)}</div>
        </div>
      </div>
      {editable ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-[180px,1fr,1fr]">
          <label className="text-xs font-medium text-slate-600">Valeur Q{quarter} {ind.unit && !yesNo ? `(${ind.unit})` : ''}
            {yesNo ? (
              <select className={`${inputCls} mt-1`} value={value} onChange={(e) => setValue(e.target.value)}>
                <option value="">—</option><option value="1">Oui (atteint)</option><option value="0">Non</option>
              </select>
            ) : <input inputMode="decimal" className={`${inputCls} mt-1`} value={value} onChange={(e) => setValue(e.target.value)} placeholder="ex. 65" />}
            {invalid && <span className="text-rag-red">Saisir un nombre.</span>}
          </label>
          <label className="text-xs font-medium text-slate-600">Lien de preuve
            <input type="url" className={`${inputCls} mt-1`} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…" />
          </label>
          <label className="text-xs font-medium text-slate-600">Commentaire
            <input className={`${inputCls} mt-1`} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2 sm:col-span-3">
            <Button variant="primary" onClick={save} disabled={!dirty || invalid}>Enregistrer la valeur</Button>
            <Button variant="ghost" onClick={() => setEditing(true)}>Modifier l’indicateur</Button>
            {current && <span className="text-xs text-slate-500">Saisi le {dateTime(current.at)} par {current.by}</span>}
          </div>
        </div>
      ) : current && <p className="mt-2 text-sm">Valeur Q{quarter} : <b>{fmtValue(ind, current.value)}</b>{current.comment && ` · ${current.comment}`}</p>}
      {history.length > 0 && (
        <div className="mt-2 border-t border-[#eef0f3] pt-2">
          <button className="text-xs font-medium text-slate-600 hover:text-accent" onClick={() => setShowHistory(!showHistory)}>{showHistory ? '▾' : '▸'} Historique ({history.length})</button>
          {showHistory && (
            <ol className="mt-1.5 space-y-1 text-xs text-slate-600">
              {history.map((h) => (
                <li key={h.id}><b className="text-[#1d2327]">Q{h.quarter} · {fmtValue(ind, h.value)}</b> · {dateTime(h.at)} · {h.by}{h.comment && ` · « ${h.comment} »`}
                  {h.evidenceUrl && <> · <a className="text-brand-500 underline" href={h.evidenceUrl} target="_blank" rel="noreferrer">preuve</a></>}</li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

/** Création / modification d'un indicateur de mesure. */
function IndicatorEditor({ kr, ind, onSave, onDone, onDelete }: {
  kr: EntityKR; ind?: Indicator; onSave: (i: Indicator) => Promise<void>; onDone: () => void; onDelete?: () => Promise<void>;
}) {
  const { idx } = useApp();
  const [f, setF] = useState({
    name: ind?.name ?? '', metric: (ind?.metric ?? 'Numeric') as MetricType, unit: ind?.unit ?? '',
    baseline: ind?.baseline?.toString() ?? '', target: ind?.target?.toString() ?? '',
    qt: (ind?.quarterTargets ?? [null, null, null, null]).map((x) => x?.toString() ?? ''), source: ind?.source ?? '',
  });
  const nums = [f.baseline, f.target, ...f.qt].map(parseNum);
  const invalid = !f.name.trim() || nums.some((x) => Number.isNaN(x));
  const submit = async () => {
    const yesNo = f.metric === 'Yes/No';
    await onSave({
      id: ind?.id ?? `${kr.id}-ind-m${hash(f.name + Date.now())}`, entityKrId: kr.id, entityId: kr.entityId, initiativeId: ind?.initiativeId ?? null,
      name: f.name.trim(), metric: f.metric, unit: yesNo ? 'Oui/Non' : f.metric === 'Percentage' ? '%' : f.unit.trim(),
      baseline: yesNo ? 0 : nums[0], baselineText: ind?.baselineText ?? f.baseline, target: yesNo ? 1 : nums[1],
      quarterTargets: yesNo ? [null, null, null, null] : (nums.slice(2) as (number | null)[]), source: f.source.trim(),
      frequency: 'Trimestrielle', origin: ind?.origin ?? 'manual', order: ind?.order ?? (idx.indByKr.get(kr.id)?.length ?? 0),
    });
    onDone();
  };
  return (
    <div className="space-y-3 rounded-md border-2 border-accent/50 bg-[#fffaf4] p-3">
      <div className="text-sm font-semibold text-brand-500">{ind ? 'Modifier l’indicateur' : 'Nouvel indicateur de mesure'}</div>
      <div className="grid gap-3 sm:grid-cols-[1fr,160px,120px]">
        <label className="text-xs font-medium text-slate-600">Intitulé
          <input className={`${inputCls} mt-1`} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="ex. % de CHAs utilisant eCHIS chaque mois" />
        </label>
        <label className="text-xs font-medium text-slate-600">Type
          <select className={`${inputCls} mt-1`} value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value as MetricType })}>
            <option value="Numeric">Nombre</option><option value="Percentage">Pourcentage</option><option value="Yes/No">Oui / Non</option>
          </select>
        </label>
        {f.metric === 'Numeric' && (
          <label className="text-xs font-medium text-slate-600">Unité
            <input className={`${inputCls} mt-1`} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder="CHWs, USD…" />
          </label>
        )}
      </div>
      {f.metric !== 'Yes/No' && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
          <label className="text-xs font-medium text-slate-600">Baseline<input inputMode="decimal" className={`${inputCls} mt-1`} value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} /></label>
          {[0, 1, 2, 3].map((q) => (
            <label key={q} className="text-xs font-medium text-slate-600">Cible Q{q + 1}
              <input inputMode="decimal" className={`${inputCls} mt-1`} value={f.qt[q]} onChange={(e) => setF({ ...f, qt: f.qt.map((x, n) => (n === q ? e.target.value : x)) })} />
            </label>
          ))}
          <label className="text-xs font-medium text-slate-600">Cible finale<input inputMode="decimal" className={`${inputCls} mt-1`} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></label>
        </div>
      )}
      <label className="block text-xs font-medium text-slate-600">Source de vérification / règle de preuve
        <input className={`${inputCls} mt-1`} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder="ex. rapport DHIS2 mensuel validé par le M&E" />
      </label>
      {nums.some((x) => Number.isNaN(x)) && <p className="text-xs text-rag-red">Baseline et cibles : nombres uniquement.</p>}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={invalid} onClick={submit}>Enregistrer</Button>
        <Button onClick={onDone}>Annuler</Button>
        {onDelete && <Button variant="danger" onClick={async () => { if (confirm('Supprimer cet indicateur et ses valeurs ?')) { await onDelete(); onDone(); } }}>Supprimer</Button>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ jalons

function MilestoneForm({ m, initiative, editable }: { m: Milestone; initiative: Initiative; editable: boolean }) {
  const { idx, user, checkIn } = useApp();
  const [status, setStatus] = useState<MilestoneStatus>(m.status);
  const [evidence, setEvidence] = useState(m.evidenceUrl);
  const [comment, setComment] = useState(m.comment);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => { setStatus(m.status); setEvidence(m.evidenceUrl); setComment(m.comment); }, [m]);
  const history = (idx.updatesByMs.get(m.id) ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  const needsEvidence = status === 'achieved' && !evidence.trim();
  const dirty = status !== m.status || evidence !== m.evidenceUrl || comment !== m.comment;
  const save = async () => {
    setSaving(true);
    try {
      await checkIn({ id: crypto.randomUUID(), milestoneId: m.id, status, evidenceUrl: evidence.trim(), comment: comment.trim(), at: new Date().toISOString(), by: user?.name || user?.email || 'inconnu' });
    } finally { setSaving(false); }
  };
  return (
    <div className="rounded-md border border-ligne p-3">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">{initiative.title} · <span className="text-slate-500">jalon Q{m.quarter}</span></span>
        <StatusBadge status={m.status} />
      </div>
      <p className="mb-2 text-sm text-slate-700">{m.description}</p>
      {editable ? (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5" role="radiogroup" aria-label="Statut">
            {STATUSES.map((s) => (
              <button key={s} type="button" onClick={() => setStatus(s)} role="radio" aria-checked={status === s}
                className={`min-h-[40px] rounded-md border px-2 text-[13px] ${status === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-ligne text-slate-600'}`}>
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">Lien de preuve
              <input type="url" className={`${inputCls} mt-1`} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…" />
              {needsEvidence && <span className="text-[#9a4a00]">Une preuve est attendue pour un jalon atteint.</span>}
            </label>
            <label className="text-xs font-medium text-slate-600">Commentaire
              <input className={`${inputCls} mt-1`} value={comment} onChange={(e) => setComment(e.target.value)} />
            </label>
          </div>
          {initiative.evidenceRule && <p className="rounded bg-[#f5f8fb] px-2 py-1 text-xs text-slate-600"><b>Source et règle de preuve :</b> {initiative.evidenceRule}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Enregistrement…' : 'Enregistrer le jalon'}</Button>
            {m.updatedAt && <span className="text-xs text-slate-500">Dernière mise à jour : {dateTime(m.updatedAt)} par {m.updatedBy}</span>}
          </div>
        </div>
      ) : (m.comment || m.evidenceUrl) && <p className="text-xs text-slate-600">{m.comment}{m.evidenceUrl && <> · <a className="text-brand-500 underline" href={m.evidenceUrl} target="_blank" rel="noreferrer">preuve</a></>}</p>}
      {history.length > 0 && (
        <div className="mt-2 border-t border-[#eef0f3] pt-2">
          <button className="text-xs font-medium text-slate-600 hover:text-accent" onClick={() => setShowHistory(!showHistory)}>{showHistory ? '▾' : '▸'} Historique ({history.length})</button>
          {showHistory && (
            <ol className="mt-1.5 space-y-1 text-xs text-slate-600">
              {history.map((h) => <li key={h.id}><b className="text-[#1d2327]">{dateTime(h.at)}</b> · {h.by} · {STATUS_LABEL[h.status]}{h.comment && ` · « ${h.comment} »`}</li>)}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function CountriesEditor({ i }: { i: Initiative }) {
  const { ds, updateInitiative } = useApp();
  return (
    <details className="rounded-md bg-[#f5f8fb] px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-slate-600">Pays visés par « {i.title} »</summary>
      <div className="mt-2 flex flex-wrap gap-3">
        {ds.entities.filter((e) => e.type === 'Country').map((c) => (
          <label key={c.id} className="inline-flex items-center gap-1">
            <input type="checkbox" checked={i.targetCountryIds.includes(c.id)}
              onChange={(e) => updateInitiative(i.id, { targetCountryIds: e.target.checked ? [...i.targetCountryIds, c.id] : i.targetCountryIds.filter((x) => x !== c.id) })} />
            {c.name}
          </label>
        ))}
      </div>
    </details>
  );
}

// ------------------------------------------------------------------ page

function KrCheckIn({ kr, quarter }: { kr: EntityKR; quarter: Quarter }) {
  const { idx, computed, user, saveIndicator } = useApp();
  const [adding, setAdding] = useState(false);
  const ent = idx.entity.get(kr.entityId);
  const editable = canEditEntity(user, kr.entityId);
  const inds = idx.indByKr.get(kr.id) ?? [];
  const inits = idx.initByKr.get(kr.id) ?? [];
  const s = computed.entityKr.get(kr.id)!;
  const ms = inits.flatMap((i) => (idx.msByInit.get(i.id) ?? []).filter((m) => m.quarter === quarter).map((m) => ({ m, i })));
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-slate-500">{ent?.name} · {(idx.linksByKr.get(kr.id) ?? []).map((c) => c.globalKrId).join(', ')}</div>
          <h3 className="text-[16px] font-semibold text-brand-500">{kr.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">KR Lead : {kr.lead || '—'} {ent?.type === 'Country' && <DepartmentChip kr={kr} />}</div>
        </div>
        <div className="w-44 text-right text-xs text-slate-500">
          <ProgressBar value={s.progress} rag={s.rag} />
          <div className="mt-0.5"><b className="text-brand-500">{pct(s.progress)}</b> · jalons {pct(s.milestones)} · indic. {pct(s.indicators)}</div>
        </div>
      </div>
      <h4 className="mb-2 border-b-2 border-brand-500 pb-1 text-sm font-bold text-brand-500">Indicateurs de mesure</h4>
      <div className="space-y-2">
        {inds.map((ind) => <IndicatorValueForm key={ind.id} ind={ind} quarter={quarter} editable={editable} />)}
        {!inds.length && !adding && <p className="text-sm text-[#9a4a00]">Aucun indicateur : ajoutez au moins un indicateur pour mesurer ce KR.</p>}
        {adding ? <IndicatorEditor kr={kr} onSave={saveIndicator} onDone={() => setAdding(false)} />
          : editable && <Button onClick={() => setAdding(true)}>+ Ajouter un indicateur</Button>}
      </div>
      <h4 className="mb-2 mt-4 border-b-2 border-brand-500 pb-1 text-sm font-bold text-brand-500">Activités · jalons Q{quarter}</h4>
      <div className="space-y-2">
        {ms.length ? ms.map(({ m, i }) => <MilestoneForm key={m.id} m={m} initiative={i} editable={editable} />) : <p className="text-sm text-slate-500">Pas de jalon prévu ce trimestre.</p>}
        {editable && ent?.type === 'GlobalTeam' && inits.map((i) => <CountriesEditor key={i.id} i={i} />)}
      </div>
    </Card>
  );
}

const PAGE = 15;

export default function CheckIn() {
  const { ds, idx, user, quarter: globalQuarter } = useApp();
  const [params, setParams] = useSearchParams();
  const focusInit = params.get('initiative');
  const focusKr = params.get('kr') ?? (focusInit ? ds.initiatives.find((i) => i.id === focusInit)?.entityKrId ?? null : null);
  const editableIds = ds.entities.filter((e) => canEditEntity(user, e.id)).map((e) => e.id);
  const [entityId, setEntityId] = useState<string>(isAdmin(user) ? '' : editableIds[0] ?? '');
  const [quarter, setQuarter] = useState<Quarter>(globalQuarter);
  const [search, setSearch] = useState('');
  const [todo, setTodo] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [entityId, search, todo, quarter]);

  const list = useMemo(() => {
    if (focusKr) return ds.entityKrs.filter((k) => k.id === focusKr);
    const q = search.trim().toLowerCase();
    return ds.entityKrs.filter((k) => {
      if (entityId && k.entityId !== entityId) return false;
      if (todo) {
        // reste à saisir : indicateur sans valeur ce trimestre, ou jalon du trimestre non mis à jour
        const inds = idx.indByKr.get(k.id) ?? [];
        const indTodo = inds.length === 0 || inds.some((i) => !(idx.valuesByInd.get(i.id) ?? []).some((v) => v.quarter === quarter));
        const msTodo = (idx.initByKr.get(k.id) ?? []).some((i) => (idx.msByInit.get(i.id) ?? []).some((m) => m.quarter === quarter && !m.updatedAt));
        if (!indTodo && !msTodo) return false;
      }
      if (!q) return true;
      const inits = idx.initByKr.get(k.id) ?? [];
      return [k.title, k.lead, ...inits.map((i) => i.title), ...inits.map((i) => i.lead), ...(idx.indByKr.get(k.id) ?? []).map((i) => i.name)]
        .some((t) => t?.toLowerCase().includes(q));
    });
  }, [ds, idx, entityId, search, focusKr, todo, quarter]);

  if (!ds.globalKrs.length) return <><PageHeader title="Mise à jour trimestrielle" /><NoData /></>;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={<>Check-in · <span className="text-accent">Q{quarter} 2027</span></>} title="Mise à jour trimestrielle"
        subtitle="Pour chaque KR : la valeur de ses indicateurs de mesure, puis le statut des jalons des activités, avec lien de preuve et commentaire. Chaque saisie est conservée dans l’historique." />
      {user?.role === 'viewer' && <p className="rounded-md border border-[#bfe3f5] bg-brand-50 px-4 py-3 text-sm">Profil Lecteur : consultation seule.</p>}
      <Card>
        <div className="grid gap-3 sm:grid-cols-[1fr,140px,1fr,auto]">
          <label className="text-xs font-medium text-slate-600">Pays / département
            <select className={`${inputCls} mt-1`} value={entityId} onChange={(e) => { setEntityId(e.target.value); setParams({}); }}>
              <option value="">Tous</option>
              <optgroup label="Départements globaux">{ds.entities.filter((e) => e.type === 'GlobalTeam').map((e) => <option key={e.id} value={e.id}>{e.name}{editableIds.includes(e.id) ? ' ✎' : ''}</option>)}</optgroup>
              <optgroup label="Pays">{ds.entities.filter((e) => e.type === 'Country').map((e) => <option key={e.id} value={e.id}>{e.name}{editableIds.includes(e.id) ? ' ✎' : ''}</option>)}</optgroup>
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">Trimestre
            <select className={`${inputCls} mt-1`} value={quarter} onChange={(e) => setQuarter(Number(e.target.value) as Quarter)}>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">KR Lead / Initiative Lead / mot-clé
            <input className={`${inputCls} mt-1`} value={search} onChange={(e) => { setSearch(e.target.value); setParams({}); }} placeholder="Nom ou mot-clé" />
          </label>
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={todo} onChange={(e) => setTodo(e.target.checked)} /> Reste à saisir
          </label>
        </div>
        {focusKr && <button className="mt-2 text-sm font-semibold text-brand-500 hover:text-accent" onClick={() => setParams({})}>← Tous les KR</button>}
      </Card>
      <p className="text-sm text-slate-500">{list.length} KR</p>
      {list.length === 0 && <EmptyState title="Aucun KR ne correspond aux filtres." />}
      {list.slice(0, page * PAGE).map((k) => <KrCheckIn key={k.id} kr={k} quarter={quarter} />)}
      {list.length > page * PAGE && <div className="text-center"><Button onClick={() => setPage(page + 1)}>Afficher {Math.min(PAGE, list.length - page * PAGE)} KR de plus</Button></div>}
    </div>
  );
}
