import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Button, Card, EmptyState, inputCls, NoData, PageHeader, StatusBadge } from '../components/ui';
import { dateTime } from '../lib/format';
import { canEditEntity, isAdmin } from '../lib/permissions';
import { STATUS_LABEL, type Initiative, type Milestone, type MilestoneStatus, type Quarter } from '../types';

const STATUSES: MilestoneStatus[] = ['not_started', 'in_progress', 'achieved', 'late', 'cancelled'];

function MilestoneForm({ m, initiative, editable }: { m: Milestone; initiative: Initiative; editable: boolean }) {
  const { ds, user, checkIn } = useApp();
  const [status, setStatus] = useState<MilestoneStatus>(m.status);
  const [actual, setActual] = useState(m.actualValue?.toString() ?? '');
  const [evidence, setEvidence] = useState(m.evidenceUrl);
  const [comment, setComment] = useState(m.comment);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    setStatus(m.status); setActual(m.actualValue?.toString() ?? ''); setEvidence(m.evidenceUrl); setComment(m.comment);
  }, [m]);
  const history = ds.updates.filter((u) => u.milestoneId === m.id).sort((a, b) => b.at.localeCompare(a.at));
  const numeric = initiative.metric === 'Numeric' || initiative.metric === 'Percentage';
  const actualNum = actual.trim() === '' ? null : Number(actual.replace(',', '.'));
  const invalidActual = actualNum !== null && !Number.isFinite(actualNum);
  const needsEvidence = status === 'achieved' && !evidence.trim();
  const dirty = status !== m.status || actual !== (m.actualValue?.toString() ?? '') || evidence !== m.evidenceUrl || comment !== m.comment;

  const save = async () => {
    setSaving(true);
    try {
      await checkIn({
        id: crypto.randomUUID(), milestoneId: m.id, status, actualValue: actualNum, evidenceUrl: evidence.trim(), comment: comment.trim(),
        at: new Date().toISOString(), by: user?.name || user?.email || 'inconnu',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border border-ligne p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold">Jalon Q{m.quarter}</span>
        <StatusBadge status={m.status} />
      </div>
      <p className="mb-3 text-sm text-slate-700">{m.description}</p>
      {editable ? (
        <div className="space-y-3">
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-slate-600">Statut</legend>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-5">
              {STATUSES.map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`rounded-lg border px-2 py-2 text-xs font-medium ${status === s ? 'border-brand-600 bg-brand-50 text-brand-500' : 'border-ligne text-slate-600'}`}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-medium text-slate-600">
              Valeur réelle {numeric ? `(${initiative.metric === 'Percentage' ? '%' : 'nombre'})` : '(facultatif)'}
              <input inputMode="decimal" className={`${inputCls} mt-1`} value={actual} onChange={(e) => setActual(e.target.value)} placeholder={initiative.baseline ? `Baseline : ${initiative.baseline}` : ''} />
              {invalidActual && <span className="text-red-700">Saisir un nombre.</span>}
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Lien de preuve
              <input type="url" className={`${inputCls} mt-1`} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="https://…" />
              {needsEvidence && <span className="text-amber-700">Une preuve est attendue pour un jalon atteint.</span>}
            </label>
          </div>
          {initiative.evidenceRule && <p className="rounded bg-slate-50 px-2 py-1 text-xs text-slate-600"><b>Source et règle de preuve :</b> {initiative.evidenceRule}</p>}
          <label className="block text-xs font-medium text-slate-600">
            Commentaire
            <textarea rows={2} className={`${inputCls} mt-1`} value={comment} onChange={(e) => setComment(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={save} disabled={!dirty || saving || invalidActual}>{saving ? 'Enregistrement…' : 'Enregistrer le check-in'}</Button>
            {m.updatedAt && <span className="text-xs text-slate-500">Dernière mise à jour : {dateTime(m.updatedAt)} par {m.updatedBy}</span>}
          </div>
        </div>
      ) : (
        <div className="space-y-1 text-xs text-slate-600">
          {m.actualValue !== null && <p>Valeur réelle : {m.actualValue}</p>}
          {m.evidenceUrl && <p>Preuve : <a className="text-brand-500 underline" href={m.evidenceUrl} target="_blank" rel="noreferrer">{m.evidenceUrl}</a></p>}
          {m.comment && <p>Commentaire : {m.comment}</p>}
          <p className="italic text-slate-400">Consultation seule : vous n’êtes pas Lead de cette entité.</p>
        </div>
      )}
      {history.length > 0 && (
        <div className="mt-3 border-t border-slate-100 pt-2">
          <button className="text-xs font-medium text-slate-600 hover:text-brand-500" onClick={() => setShowHistory(!showHistory)}>
            {showHistory ? '▾' : '▸'} Historique ({history.length})
          </button>
          {showHistory && (
            <ol className="mt-2 space-y-1.5">
              {history.map((h) => (
                <li key={h.id} className="text-xs text-slate-600">
                  <span className="font-medium text-slate-800">{dateTime(h.at)}</span> · {h.by} · {STATUS_LABEL[h.status]}
                  {h.actualValue !== null && <> · réel {h.actualValue}</>}
                  {h.comment && <> · « {h.comment} »</>}
                  {h.evidenceUrl && <> · <a href={h.evidenceUrl} target="_blank" rel="noreferrer" className="text-brand-500 underline">preuve</a></>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function InitiativeSettings({ i }: { i: Initiative }) {
  const { ds, updateInitiative, notify } = useApp();
  const [target, setTarget] = useState(i.target?.toString() ?? '');
  const ent = ds.entities.find((e) => e.id === i.entityId);
  const countries = ds.entities.filter((e) => e.type === 'Country');
  const saveTarget = async () => {
    const v = target.trim() === '' ? null : Number(target.replace(',', '.'));
    if (v !== null && !Number.isFinite(v)) return;
    await updateInitiative(i.id, { target: v });
    notify('Cible enregistrée.');
  };
  return (
    <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-medium text-slate-600">Paramètres de l’initiative (cible, pays visés)</summary>
      <div className="mt-2 flex flex-wrap items-end gap-2">
        <label className="font-medium text-slate-600">Cible numérique
          <input inputMode="decimal" className={`${inputCls} mt-1 w-32`} value={target} onChange={(e) => setTarget(e.target.value)} />
        </label>
        <Button onClick={saveTarget}>Enregistrer</Button>
        <span className="text-slate-500">Baseline : {i.baselineValue ?? '—'} · utilisée pour (réel − baseline) / (cible − baseline)</span>
      </div>
      {ent?.type === 'GlobalTeam' && (
        <div className="mt-3">
          <div className="mb-1 font-medium text-slate-600">Pays visés par cette initiative d’appui</div>
          <div className="flex flex-wrap gap-2">
            {countries.map((c) => (
              <label key={c.id} className="inline-flex items-center gap-1">
                <input type="checkbox" checked={i.targetCountryIds.includes(c.id)}
                  onChange={(e) => updateInitiative(i.id, { targetCountryIds: e.target.checked ? [...i.targetCountryIds, c.id] : i.targetCountryIds.filter((x) => x !== c.id) })} />
                {c.name}
              </label>
            ))}
          </div>
        </div>
      )}
    </details>
  );
}

export default function CheckIn() {
  const { ds, user, quarter: globalQuarter } = useApp();
  const [params, setParams] = useSearchParams();
  const focus = params.get('initiative');
  const focused = ds.initiatives.find((i) => i.id === focus);
  const editableIds = ds.entities.filter((e) => canEditEntity(user, e.id)).map((e) => e.id);
  const [entityId, setEntityId] = useState<string>(focused?.entityId ?? (isAdmin(user) ? '' : editableIds[0] ?? ''));
  const [quarter, setQuarter] = useState<Quarter | 0>(focused ? 0 : globalQuarter);
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (focused) { setEntityId(focused.entityId); setQuarter(0); }
  }, [focused]);

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return ds.initiatives.filter((i) => {
      if (focus) return i.id === focus;
      if (entityId && i.entityId !== entityId) return false;
      if (!q) return true;
      const kr = ds.entityKrs.find((k) => k.id === i.entityKrId);
      return [i.title, i.lead, kr?.title, kr?.lead].some((t) => t?.toLowerCase().includes(q));
    });
  }, [ds, entityId, search, focus]);

  if (!ds.globalKrs.length) return <><PageHeader title="Mise à jour trimestrielle" /><NoData /></>;

  return (
    <div className="space-y-4">
      <PageHeader title="Mise à jour trimestrielle (check-in)"
        subtitle="Pour chaque jalon : statut, valeur réelle, lien de preuve selon la règle « Evidence Source and Rule », commentaire. Chaque enregistrement est conservé dans l’historique." />
      {user?.role === 'viewer' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">Profil Lecteur : consultation seule.</p>}
      <Card>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-medium text-slate-600">Pays / équipe
            <select className={`${inputCls} mt-1`} value={entityId} onChange={(e) => { setEntityId(e.target.value); setParams({}); }}>
              <option value="">Toutes les entités</option>
              {ds.entities.map((e) => <option key={e.id} value={e.id}>{e.name}{editableIds.includes(e.id) ? ' ✎' : ''}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">Trimestre
            <select className={`${inputCls} mt-1`} value={quarter} onChange={(e) => setQuarter(Number(e.target.value) as Quarter | 0)}>
              <option value={0}>Tous</option>
              {[1, 2, 3, 4].map((q) => <option key={q} value={q}>Q{q}</option>)}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">KR Lead / Initiative Lead / texte
            <input className={`${inputCls} mt-1`} value={search} onChange={(e) => { setSearch(e.target.value); setParams({}); }} placeholder="Nom ou mot-clé" />
          </label>
        </div>
        {focus && <button className="mt-2 text-xs font-medium text-brand-500" onClick={() => setParams({})}>← Voir toutes les initiatives</button>}
      </Card>

      {list.length === 0 && <EmptyState title="Aucune initiative ne correspond aux filtres." />}
      {list.slice(0, 60).map((i) => {
        const kr = ds.entityKrs.find((k) => k.id === i.entityKrId);
        const ent = ds.entities.find((e) => e.id === i.entityId);
        const ms = ds.milestones.filter((m) => m.initiativeId === i.id && (!quarter || m.quarter === quarter)).sort((a, b) => a.quarter - b.quarter);
        const editable = canEditEntity(user, i.entityId);
        return (
          <Card key={i.id}>
            <div className="mb-3">
              <div className="text-xs text-slate-500">{ent?.name} · KR : {kr?.title}</div>
              <h3 className="text-sm font-semibold text-slate-900">{i.title}</h3>
              <div className="text-xs text-slate-500">Initiative Lead : {i.lead || '—'} · KR Lead : {kr?.lead || '—'} · Métrique : {i.metric} · Baseline : {i.baseline || '—'}</div>
            </div>
            <div className="space-y-3">
              {ms.length ? ms.map((m) => <MilestoneForm key={m.id} m={m} initiative={i} editable={editable} />) : <p className="text-sm text-slate-500">Pas de jalon pour ce trimestre.</p>}
              {editable && <InitiativeSettings i={i} />}
            </div>
          </Card>
        );
      })}
      {list.length > 60 && <p className="text-sm text-slate-500">{list.length - 60} initiative(s) supplémentaire(s) : affinez les filtres.</p>}
    </div>
  );
}
