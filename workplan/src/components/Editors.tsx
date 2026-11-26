/** Fenêtres d'édition : activité (globale ou pays), indicateur, et liste d'indicateurs d'un élément. */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { pct } from '../lib/format';
import { addIndicatorValue, newIndicator, remove, suggestParents, updateActivityStatus, upsert } from '../lib/ops';
import { targetKey } from '../lib/calc';
import { dateTime } from '../lib/format';
import { withDates } from '../lib/ops';
import { ALIGN_LABEL, KIND_LABEL, PRIORITY_LABEL, STATUS_LABEL, type Activity, type AlignStatus, type Priority, type ActivityStatus, type Indicator, type IndicatorKind, type Quarter, type TargetType } from '../types';
import { Button, Field, inputCls, Modal, OrphanBadge, ProgressBar, StatusBadge } from './ui';
import { t as tr } from '../i18n';

const num = (s: string): number | null => {
  const t = s.trim().replace(/\s/g, '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : NaN;
};
const str = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v));

export const fmt = (ind: Indicator, v: number | null | undefined) =>
  v === null || v === undefined ? '—' : ind.kind === 'yesno' ? (v >= 1 ? tr("Oui") : tr("Non")) : `${new Intl.NumberFormat('fr-FR').format(v)}${ind.kind === 'percent' ? ' %' : ind.unit ? ` ${ind.unit}` : ''}`;

// ------------------------------------------------------------------ indicateurs

export function IndicatorEditor({ ind, onClose }: { ind: Indicator; onClose: () => void }) {
  const { ws, update, quarter } = useApp();
  const isNew = !ws.indicators.some((i) => i.id === ind.id);
  const [f, setF] = useState({ name: ind.name, kind: ind.kind as IndicatorKind, unit: ind.unit, baseline: str(ind.baseline), target: str(ind.target), qt: ind.quarterTargets.map(str), source: ind.source });
  const [q, setQ] = useState<Quarter>(quarter);
  const [val, setVal] = useState('');
  const [comment, setComment] = useState('');
  const [evidence, setEvidence] = useState('');
  const nums = [f.baseline, f.target, ...f.qt].map(num);
  const bad = !f.name.trim() || nums.some((x) => Number.isNaN(x));
  const history = ws.indicatorValues.filter((v) => v.indicatorId === ind.id).sort((a, b) => b.at.localeCompare(a.at));
  const yes = f.kind === 'yesno';
  const save = () => {
    update((w) => upsert(w, 'indicators', {
      ...ind, name: f.name.trim(), kind: f.kind, unit: yes ? tr("Oui/Non") : f.kind === 'percent' ? '%' : f.unit.trim(),
      baseline: yes ? 0 : nums[0], target: yes ? 1 : nums[1], quarterTargets: yes ? [null, null, null, null] : (nums.slice(2) as (number | null)[]), source: f.source.trim(),
    }), tr("Indicateur enregistré."));
    onClose();
  };
  const v = yes ? (val === '' ? null : Number(val)) : num(val);
  return (
    <Modal title={isNew ? tr("Nouvel indicateur de mesure") : tr("Indicateur de mesure")} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr,150px,120px]">
          <Field label={tr("Intitulé de l’indicateur")}><input autoFocus className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder={tr("ex. % de CHAs utilisant eCHIS chaque mois")} /></Field>
          <Field label={tr("Type")}><select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as IndicatorKind })}>
            {(Object.keys(KIND_LABEL) as IndicatorKind[]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></Field>
          {f.kind === 'number' && <Field label={tr("Unité")}><input className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} placeholder={tr("CHAs, USD…")} /></Field>}
        </div>
        {!yes && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6">
            <Field label={tr("Baseline")}><input inputMode="decimal" className={inputCls} value={f.baseline} onChange={(e) => setF({ ...f, baseline: e.target.value })} /></Field>
            {[0, 1, 2, 3].map((n) => <Field key={n} label={tr("Cible Q{0}", { 0: n + 1 })}><input inputMode="decimal" className={inputCls} value={f.qt[n]} onChange={(e) => setF({ ...f, qt: f.qt.map((x, i) => (i === n ? e.target.value : x)) })} /></Field>)}
            <Field label={tr("Cible finale")}><input inputMode="decimal" className={inputCls} value={f.target} onChange={(e) => setF({ ...f, target: e.target.value })} /></Field>
          </div>
        )}
        <Field label={tr("Source de vérification / règle de preuve")}><input className={inputCls} value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} placeholder={tr("ex. rapport DHIS2 validé par le M&E")} /></Field>
        {nums.some((x) => Number.isNaN(x)) && <p className="text-xs text-rag-red">{tr("Baseline et cibles : nombres uniquement.")}</p>}
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={bad} onClick={save}>{tr("Enregistrer")}</Button>
          <Button onClick={onClose}>{tr("Fermer")}</Button>
          {!isNew && <Button variant="danger" onClick={() => { if (confirm(tr("Supprimer cet indicateur et ses valeurs ?"))) { update((w) => remove(w, 'indicators', ind.id), tr("Indicateur supprimé.")); onClose(); } }}>{tr("Supprimer")}</Button>}
        </div>
        {!isNew && (
          <div className="mt-2 rounded-md border border-ligne bg-[#f5f8fb] p-3">
            <div className="mb-2 text-sm font-semibold text-brand-500">{tr("Saisir une valeur")}</div>
            <div className="grid gap-2 sm:grid-cols-[100px,140px,1fr,1fr,auto]">
              <select className={inputCls} value={q} onChange={(e) => setQ(Number(e.target.value) as Quarter)} aria-label={tr("Trimestre")}>{[1, 2, 3, 4].map((x) => <option key={x} value={x}>{tr("Q")}{x}</option>)}</select>
              {yes ? <select className={inputCls} value={val} onChange={(e) => setVal(e.target.value)} aria-label={tr("Valeur")}><option value="">—</option><option value="1">{tr("Oui")}</option><option value="0">{tr("Non")}</option></select>
                : <input inputMode="decimal" className={inputCls} value={val} onChange={(e) => setVal(e.target.value)} placeholder={tr("Valeur")} aria-label={tr("Valeur")} />}
              <input className={inputCls} value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={tr("Lien de preuve")} aria-label={tr("Lien de preuve")} />
              <input className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr("Commentaire")} aria-label={tr("Commentaire")} />
              <Button variant="primary" disabled={v === null || Number.isNaN(v)} onClick={() => { update((w) => addIndicatorValue(w, ind.id, q, v as number, comment.trim(), evidence.trim()), tr("Valeur enregistrée.")); setVal(''); setComment(''); setEvidence(''); }}>{tr("Ajouter")}</Button>
            </div>
            {history.length > 0 && (
              <ol className="mt-3 space-y-1 text-xs text-slate-600">
                {history.map((h) => <li key={h.id}><b className="text-[#1d2327]">{tr("Q")}{h.quarter} · {fmt(ind, h.value)}</b> · {dateTime(h.at)} · {h.by}{h.comment && ` · « ${h.comment} »`}{h.evidenceUrl && <> · <a className="text-brand-500 underline" href={h.evidenceUrl} target="_blank" rel="noreferrer">{tr("preuve")}</a></>}</li>)}
              </ol>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Indicateurs d'un objectif, d'un KR ou d'une activité, avec ajout. */
export function IndicatorList({ type, id, compact }: { type: TargetType; id: string; compact?: boolean }) {
  const { ws, plan, view } = useApp();
  const [edit, setEdit] = useState<Indicator | null>(null);
  if (!plan || !view) return null;
  const list = view.indByTarget.get(targetKey(type, id)) ?? [];
  return (
    <div>
      {list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((i) => {
            const sc = view.indicator.get(i.id)!;
            return (
              <li key={i.id}>
                <button onClick={() => setEdit(i)} className="grid w-full grid-cols-[1fr,auto] items-center gap-2 rounded-md border border-[#dce3ea] bg-white px-2.5 py-1.5 text-left hover:border-accent">
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-[#1d2327]">{i.name}</span>
                    {!compact && <span className="text-[13.5px] text-slate-500">{tr("Baseline")} {fmt(i, i.baseline)} {tr("· cible Q")}{view.quarter} {fmt(i, sc.quarterTarget)} {tr("· finale")} {fmt(i, i.target)} {tr("· dernière valeur")} <b className={sc.onTrack === false ? 'text-rag-red' : sc.onTrack ? 'text-rag-green' : ''}>{fmt(i, sc.value)}</b>{sc.valueQuarter && sc.valueQuarter !== view.quarter ? ` (Q${sc.valueQuarter})` : ''}</span>}
                  </span>
                  <span className="w-28"><ProgressBar value={sc.progress} rag={sc.rag} /><span className="block text-right text-[13.5px] font-semibold text-brand-500">{pct(sc.progress)}</span></span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <button onClick={() => setEdit(newIndicator(ws, plan.id, type, id))} className="mt-1.5 text-sm font-semibold text-brand-500 hover:text-accent">{tr("+ Indicateur de mesure")}</button>
      {edit && <IndicatorEditor ind={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

// ------------------------------------------------------------------ activités

/** Activités (KR) globales qui soutiennent une activité pays : liste, retrait, suggestions, recherche. */
export function LinksEditor({ act, value, onChange }: { act: Activity; value: string[]; onChange: (ids: string[]) => void }) {
  const { ws, view, unit } = useApp();
  const [q, setQ] = useState('');
  const sugg = useMemo(() => suggestParents(ws, { ...act, parentIds: value }, 4), [ws, act, value]);
  if (!view) return null;
  const k = q.toLowerCase();
  const code = (id: string | null) => view.krs.find((x) => x.id === id)?.code ?? '';
  const list = view.globalActs.filter((g) => !value.includes(g.id) && (!k || `${g.title} ${unit(g.unitId)?.name} ${code(g.krId)}`.toLowerCase().includes(k)));
  return (
    <div className="space-y-2">
      {value.length ? (
        <ul className="space-y-1">
          {value.map((id) => {
            const g = view.byId.get(id);
            return (
              <li key={id} className="flex items-start gap-2 rounded-md bg-[#eaf7fd] px-2 py-1 text-sm">
                <b className="whitespace-nowrap text-brand-500">{g ? `${unit(g.unitId)?.name} · ${code(g.krId)}` : 'introuvable'}</b>
                <span className="flex-1">{g?.title}</span>
                <button type="button" className="text-slate-500 hover:text-rag-red" aria-label={tr("Retirer le lien")} onClick={() => onChange(value.filter((x) => x !== id))}>{tr("×")}</button>
              </li>
            );
          })}
        </ul>
      ) : <OrphanBadge />}
      {sugg.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">{tr("Suggestions :")}</span>
          {sugg.map(({ a }) => (
            <button key={a.id} type="button" onClick={() => onChange([...value, a.id])} className="rounded-full border border-[#9ed8f2] bg-white px-2 py-0.5 text-xs text-brand-500 hover:border-accent">
              + {unit(a.unitId)?.name} · {code(a.krId)} · {a.title.slice(0, 45)}
            </button>
          ))}
        </div>
      )}
      <input className={inputCls} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Rechercher un KR / une activité d’équipe globale à ajouter…")} />
      {q && (
        <ul className="max-h-48 overflow-y-auto rounded-md border border-ligne">
          {list.slice(0, 30).map((g) => (
            <li key={g.id}><button type="button" className="w-full px-2 py-1 text-left text-sm hover:bg-brand-50" onClick={() => { onChange([...value, g.id]); setQ(''); }}>
              <b className="text-brand-500">{unit(g.unitId)?.name} · {code(g.krId)}</b> {g.title}</button></li>
          ))}
          {!list.length && <li className="px-2 py-1 text-sm text-slate-500">{tr("Aucun résultat.")}</li>}
        </ul>
      )}
    </div>
  );
}

export function ActivityEditor({ act, onClose }: { act: Activity; onClose: () => void }) {
  const { ws, view, update, unit } = useApp();
  const isNew = !ws.activities.some((a) => a.id === act.id);
  const [a, setA] = useState<Activity>(act);
  if (!view) return null;
  const units = ws.units.filter((u) => u.type === (a.level === 'global' ? 'department' : 'country')).sort((x, y) => x.order - y.order);
  const history = ws.activityUpdates.filter((u) => u.activityId === a.id).sort((x, y) => y.at.localeCompare(x.at));
  const children = a.level === 'global' ? view.childrenOf.get(a.id) ?? [] : [];
  const save = () => {
    update((w) => upsert(w, 'activities', { ...a, title: a.title.trim(), progress: a.status === 'done' ? 100 : a.progress }), isNew ? tr("Activité créée.") : tr("Activité enregistrée."));
    onClose();
  };
  return (
    <Modal wide title={`${isNew ? tr("Nouvelle tâche") : tr("Tâche")} ${a.level === 'global' ? tr("d’équipe globale") : 'pays'}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr,200px]">
          <Field label={tr("Intitulé (Country/Team Key Result ou activité)")}><textarea autoFocus rows={3} className={inputCls} value={a.title} onChange={(e) => setA({ ...a, title: e.target.value })} /></Field>
          <Field label={a.level === 'global' ? tr("Équipe globale") : tr("Pays")}>
            <select className={inputCls} value={a.unitId} onChange={(e) => setA({ ...a, unitId: e.target.value })}>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.group ? ` (${u.group})` : ''}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr,130px,160px,160px]">
          <Field label={tr("Projet (KR global / Ref)")}>
            <select className={inputCls} value={a.krId ?? ''} onChange={(e) => setA({ ...a, krId: e.target.value || null })}>
              <option value="">{tr("— aucun —")}</option>
              {view.krs.map((k) => <option key={k.id} value={k.id}>{k.code} · {k.title.slice(0, 70)}</option>)}
            </select>
          </Field>
          <Field label={tr("Priorité")}><select className={inputCls} value={a.priority} onChange={(e) => setA({ ...a, priority: e.target.value as Priority })}>{(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}</select></Field>
          <Field label={tr("Début")}><input type="date" className={inputCls} value={a.startDate} onChange={(e) => setA(withDates(a, e.target.value, a.dueDate < e.target.value ? e.target.value : a.dueDate))} /></Field>
          <Field label={tr("Échéance")}><input type="date" className={inputCls} value={a.dueDate} min={a.startDate} onChange={(e) => setA(withDates(a, a.startDate > e.target.value ? e.target.value : a.startDate, e.target.value))} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr,150px,1fr,150px]">
          <Field label={tr("Country/Team Objective")}><input className={inputCls} value={a.unitObjective} onChange={(e) => setA({ ...a, unitObjective: e.target.value })} /></Field>
          <Field label={tr("Role")}><select className={inputCls} value={a.role ?? ''} onChange={(e) => setA({ ...a, role: (e.target.value || null) as Activity['role'] })}><option value="">{tr("Team KR")}</option><option>{tr("Lead")}</option><option>{tr("Contributes")}</option></select></Field>
          <Field label={tr("Sous-équipe")}><input className={inputCls} value={a.subTeam} onChange={(e) => setA({ ...a, subTeam: e.target.value })} placeholder={tr("ex. Finance & Admin")} /></Field>
          <Field label={tr("Scope")}><input className={inputCls} value={a.scope} onChange={(e) => setA({ ...a, scope: e.target.value })} /></Field>
        </div>
        {a.level === 'country' && (
          <div className="rounded-md border border-ligne p-3">
            <div className="mb-2 text-sm font-semibold text-brand-500">{tr("Dépendances : tâches des équipes globales qui soutiennent cette tâche pays")}</div>
            <LinksEditor act={a} value={a.parentIds} onChange={(ids) => setA({ ...a, parentIds: ids })} />
          </div>
        )}
        <div className="rounded-md border border-ligne p-3">
          <div className="mb-2 text-sm font-semibold text-brand-500">{tr("Analyse d’alignement")}</div>
          <div className="grid gap-3 sm:grid-cols-[170px,1fr,1fr]">
            <Field label={tr("Statut")}><select className={inputCls} value={a.alignment ?? ''} onChange={(e) => setA({ ...a, alignment: (e.target.value || null) as AlignStatus | null })}>
              <option value="">{tr("— non analysé —")}</option>{(Object.keys(ALIGN_LABEL) as AlignStatus[]).map((x) => <option key={x} value={x}>{ALIGN_LABEL[x]}</option>)}</select></Field>
            <Field label={tr("Finding / gap")}><textarea rows={2} className={inputCls} value={a.finding} onChange={(e) => setA({ ...a, finding: e.target.value })} /></Field>
            <Field label={tr("Recommended action")}><textarea rows={2} className={inputCls} value={a.action} onChange={(e) => setA({ ...a, action: e.target.value })} /></Field>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr,1fr,130px,140px]">
          <Field label={<span className="flex items-center justify-between">{tr("Responsable (KR Lead)")}<label className="flex items-center gap-1 font-normal"><input type="checkbox" checked={a.milestone} onChange={(e) => setA({ ...a, milestone: e.target.checked })} /> {tr("Jalon")}</label></span>}><input className={inputCls} value={a.owner} onChange={(e) => setA({ ...a, owner: e.target.value })} /></Field>
          <Field label={tr("Statut")}><select className={inputCls} value={a.status} onChange={(e) => setA({ ...a, status: e.target.value as ActivityStatus })}>{(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select></Field>
          <Field label={tr("Avancement (%)")}><input type="number" min={0} max={100} className={inputCls} value={a.progress} onChange={(e) => setA({ ...a, progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></Field>
          <Field label={tr("Budget (USD)")}><input inputMode="decimal" className={inputCls} value={str(a.budget)} onChange={(e) => { const n = num(e.target.value); setA({ ...a, budget: Number.isNaN(n) ? a.budget : n }); }} /></Field>
        </div>
        <Field label={tr("Commentaire")}><textarea rows={2} className={inputCls} value={a.comment} onChange={(e) => setA({ ...a, comment: e.target.value })} /></Field>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" disabled={!a.title.trim() || !a.unitId} onClick={save}>{tr("Enregistrer")}</Button>
          <Button onClick={onClose}>{tr("Annuler")}</Button>
          {!isNew && <Button variant="danger" onClick={() => {
            const msg = children.length ? tr("Supprimer cette activité ? Ses {0} activité(s) pays deviendront orphelines.", { 0: children.length }) : tr("Supprimer cette activité ?");
            if (confirm(msg)) { update((w) => remove(w, 'activities', a.id), tr("Activité supprimée.")); onClose(); }
          }}>{tr("Supprimer")}</Button>}
        </div>
        {!isNew && (
          <>
            <div className="border-t border-ligne pt-3">
              <div className="mb-1.5 text-sm font-semibold text-brand-500">{tr("Indicateurs de mesure du résultat")}</div>
              <IndicatorList type="activity" id={a.id} />
            </div>
            {a.level === 'global' && (
              <div className="border-t border-ligne pt-3">
                <div className="mb-1.5 text-sm font-semibold text-brand-500">{tr("KR / activités pays soutenus (")}{children.length})</div>
                {children.length ? (
                  <ul className="space-y-1 text-sm">{children.map((c) => <li key={c.id} className="flex items-center gap-2"><b>{unit(c.unitId)?.name}</b><span className="flex-1 truncate">{c.title}</span><StatusBadge status={c.status} /></li>)}</ul>
                ) : <p className="text-sm text-slate-500">{tr("Aucun KR pays rattaché (« Global only » : normal pour un KR purement global).")}</p>}
              </div>
            )}
            {history.length > 0 && (
              <details className="border-t border-ligne pt-3 text-xs text-slate-600">
                <summary className="cursor-pointer font-semibold">{tr("Historique (")}{history.length})</summary>
                <ol className="mt-1.5 space-y-1">{history.map((h) => <li key={h.id}><b className="text-[#1d2327]">{dateTime(h.at)}</b> · {h.by} · {STATUS_LABEL[h.status]} · {h.progress} %{h.comment && ` · « ${h.comment} »`}</li>)}</ol>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

/** Mise à jour rapide (statut, avancement, commentaire) avec historique : utilisée dans le suivi trimestriel. */
export function QuickUpdate({ act }: { act: Activity }) {
  const { update } = useApp();
  const [status, setStatus] = useState(act.status);
  const [progress, setProgress] = useState(act.progress);
  const [comment, setComment] = useState(act.comment);
  const dirty = status !== act.status || progress !== act.progress || comment !== act.comment;
  return (
    <div className="grid gap-2 sm:grid-cols-[150px,120px,1fr,auto]">
      <select aria-label={tr("Statut")} className={inputCls} value={status} onChange={(e) => setStatus(e.target.value as ActivityStatus)}>{(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}</select>
      <label className="flex items-center gap-1 text-sm"><input aria-label={tr("Avancement")} type="number" min={0} max={100} className={inputCls} value={status === 'done' ? 100 : progress} disabled={status === 'done'} onChange={(e) => setProgress(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} />%</label>
      <input aria-label={tr("Commentaire")} className={inputCls} value={comment} onChange={(e) => setComment(e.target.value)} placeholder={tr("Commentaire / ce qui a été fait")} />
      <Button variant="primary" disabled={!dirty} onClick={() => update((w) => updateActivityStatus(w, act.id, { status, progress, comment: comment.trim() }), tr("Mise à jour enregistrée."))}>{tr("Enregistrer")}</Button>
    </div>
  );
}

