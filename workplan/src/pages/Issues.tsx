/**
 * Risques & actions : registre alimenté par l'analyse d'alignement (constats Partial / Conflict / Gap,
 * tâches orphelines) et par saisie. Chaque élément : type, constat, action, responsable, échéance, statut.
 */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { ViewHeader } from '../components/pm';
import { Button, Field, inputCls, Modal, NoPlan, Stat, UnitChip } from '../components/ui';
import { fmtDate, today } from '../lib/dates';
import { exportRows } from '../lib/export';
import { newIssue, remove, upsert } from '../lib/ops';
import { ISSUE_KIND_LABEL, ISSUE_STATUS_LABEL, type Activity, type Issue, type IssueKind, type IssueStatus } from '../types';
import { t as tr } from '../i18n';

function IssueEditor({ issue, onClose }: { issue: Issue; onClose: () => void }) {
  const { ws, view, update, unit } = useApp();
  const [x, setX] = useState(issue);
  const isNew = !ws.issues.some((i) => i.id === issue.id);
  return (
    <Modal title={isNew ? tr("Nouveau risque / problème") : ISSUE_KIND_LABEL[x.kind]} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-[150px,1fr]">
        <Field label={tr("Type")}><select className={inputCls} value={x.kind} onChange={(e) => setX({ ...x, kind: e.target.value as IssueKind })}>{(Object.keys(ISSUE_KIND_LABEL) as IssueKind[]).map((k) => <option key={k} value={k}>{ISSUE_KIND_LABEL[k]}</option>)}</select></Field>
        <Field label={tr("Tâche concernée")}><select className={inputCls} value={x.activityId ?? ''} onChange={(e) => setX({ ...x, activityId: e.target.value || null })}>
          <option value="">{tr("— aucune —")}</option>{view!.activities.map((a) => <option key={a.id} value={a.id}>{unit(a.unitId)?.name} · {view!.krs.find((k) => k.id === a.krId)?.code} · {a.title.slice(0, 70)}</option>)}</select></Field>
        <Field label={tr("Constat")} className="sm:col-span-2"><textarea rows={3} className={inputCls} value={x.title} onChange={(e) => setX({ ...x, title: e.target.value })} /></Field>
        <Field label={tr("Action")} className="sm:col-span-2"><textarea rows={2} className={inputCls} value={x.action} onChange={(e) => setX({ ...x, action: e.target.value })} /></Field>
        <Field label={tr("Responsable")}><input className={inputCls} value={x.owner} onChange={(e) => setX({ ...x, owner: e.target.value })} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Échéance")}><input type="date" className={inputCls} value={x.dueDate} onChange={(e) => setX({ ...x, dueDate: e.target.value })} /></Field>
          <Field label={tr("Statut")}><select className={inputCls} value={x.status} onChange={(e) => setX({ ...x, status: e.target.value as IssueStatus })}>{(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}</select></Field>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!x.title.trim()} onClick={() => { update((w) => upsert(w, 'issues', x), tr("Enregistré.")); onClose(); }}>{tr("Enregistrer")}</Button>
        <Button onClick={onClose}>{tr("Annuler")}</Button>
        {!isNew && <Button variant="danger" onClick={() => { update((w) => remove(w, 'issues', x.id), tr("Supprimé.")); onClose(); }}>{tr("Supprimer")}</Button>}
      </div>
    </Modal>
  );
}

export default function Issues() {
  const { ws, plan, view, unit, update } = useApp();
  const [f, setF] = useState({ status: 'active', kind: '', unit: '', q: '' });
  const [edit, setEdit] = useState<Issue | null>(null);
  const [task, setTask] = useState<Activity | null>(null);
  const issues = useMemo(() => (plan ? ws.issues.filter((i) => i.planId === plan.id) : []), [ws.issues, plan]);
  if (!plan || !view) return <><ViewHeader title={tr("Risques & actions")} /><NoPlan /></>;
  const now = today();
  const actOf = (i: Issue) => (i.activityId ? view.byId.get(i.activityId) : undefined);
  const list = issues.filter((i) => (f.status === 'active' ? i.status !== 'closed' : !f.status || i.status === f.status) && (!f.kind || i.kind === f.kind)
    && (!f.unit || actOf(i)?.unitId === f.unit) && (!f.q || `${i.title} ${i.action} ${i.owner}`.toLowerCase().includes(f.q.toLowerCase())));
  const count = (s: IssueStatus) => issues.filter((i) => i.status === s).length;
  const lateCount = issues.filter((i) => i.status !== 'closed' && i.dueDate && i.dueDate < now).length;
  const units = [...new Set(issues.map((i) => actOf(i)?.unitId).filter(Boolean))] as string[];
  const doExport = () => exportRows(list.map((i) => ({
    Type: ISSUE_KIND_LABEL[i.kind], Source: i.source, [tr("Équipe / pays")]: actOf(i) ? unit(actOf(i)!.unitId)?.name : '', Ref: view.krs.find((k) => k.id === actOf(i)?.krId)?.code ?? '',
    [tr("Tâche")]: actOf(i)?.title ?? '', [tr("Constat")]: i.title, [tr("Action")]: i.action, [tr("Responsable")]: i.owner, [tr("Échéance")]: i.dueDate, [tr("Statut")]: ISSUE_STATUS_LABEL[i.status],
  })), `risques-actions-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-4">
      <ViewHeader title={tr("Risques & actions")} sub={tr("Constats de l’analyse d’alignement (Partial, Conflict, Gap) et tâches orphelines, avec l’action recommandée. Attribuez un responsable et une échéance, puis suivez jusqu’à la clôture.")}
        actions={<><Button onClick={doExport}>{tr("Export Excel")}</Button><Button variant="primary" onClick={() => setEdit(newIssue(plan.id))}>{tr("+ Risque / problème")}</Button></>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label={tr("Ouverts")} value={count('open')} color="#d64545" />
        <Stat label={tr("En traitement")} value={count('in_progress')} color="#f2b01e" />
        <Stat label={tr("Clos")} value={count('closed')} color="#2e9e4f" />
        <Stat label={tr("Échéance dépassée")} value={<span className={lateCount ? 'text-rag-red' : ''}>{lateCount}</span>} color="#004D84" />
      </div>
      <div className="grid gap-2 rounded-lg border border-ligne bg-white p-3 sm:grid-cols-4">
        <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label={tr("Statut")}><option value="active">{tr("Ouverts et en traitement")}</option><option value="">{tr("Tous")}</option>{(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}</select>
        <select className={inputCls} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} aria-label={tr("Type")}><option value="">{tr("Risques et problèmes")}</option>{(Object.keys(ISSUE_KIND_LABEL) as IssueKind[]).map((k) => <option key={k} value={k}>{ISSUE_KIND_LABEL[k]}</option>)}</select>
        <select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label={tr("Équipe ou pays")}><option value="">{tr("Toutes les équipes et pays")}</option>{units.map((u) => <option key={u} value={u}>{unit(u)?.name}</option>)}</select>
        <input className={inputCls} placeholder={tr("Rechercher…")} value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1250px] text-sm">
          <thead><tr><th>{tr("Type")}</th><th>{tr("Équipe / pays · tâche")}</th><th className="w-[28%]">{tr("Constat")}</th><th className="w-[22%]">{tr("Action")}</th><th>{tr("Responsable")}</th><th>{tr("Échéance")}</th><th>{tr("Statut")}</th></tr></thead>
          <tbody>
            {list.map((i) => {
              const a = actOf(i);
              return (
                <tr key={i.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(i)}>
                  <td><span className={`rounded-full px-2.5 py-0.5 text-[14px] ${i.kind === 'issue' ? 'bg-[#fbeaea] text-[#a23434]' : 'bg-[#fdf5e3] text-[#8a5a00]'}`}>{ISSUE_KIND_LABEL[i.kind]}</span><div className="mt-1 text-[13.5px] text-slate-500">{i.source}</div></td>
                  <td className="max-w-[260px]">{a ? <>
                    <UnitChip name={unit(a.unitId)?.name ?? ''} type={unit(a.unitId)?.type ?? 'department'} /> <b className="text-accent">{view.krs.find((k) => k.id === a.krId)?.code}</b>
                    <button className="mt-0.5 block text-left text-xs text-slate-600 hover:text-accent" onClick={(e) => { e.stopPropagation(); setTask(a); }}><span className="line-clamp-2">{a.title}</span></button></> : '—'}</td>
                  <td>{i.title}</td>
                  <td className="text-[#9a4a00]">{i.action}</td>
                  <td className="text-xs">{i.owner || '—'}</td>
                  <td className={`whitespace-nowrap text-xs ${i.status !== 'closed' && i.dueDate && i.dueDate < now ? 'font-semibold text-rag-red' : ''}`}>{i.dueDate ? fmtDate(i.dueDate) : <span className="text-slate-400">{tr("à fixer")}</span>}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <select aria-label={tr("Statut")} className="rounded border border-[#c9ced4] px-1 py-0.5 text-xs" value={i.status} onChange={(e) => update((w) => upsert(w, 'issues', { ...i, status: e.target.value as IssueStatus }), tr("Statut mis à jour."))}>
                      {(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => <option key={s} value={s}>{ISSUE_STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                </tr>
              );
            })}
            {!list.length && <tr><td colSpan={7} className="py-6 text-center text-slate-500">{tr("Aucun élément.")}</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <IssueEditor issue={edit} onClose={() => setEdit(null)} />}
      {task && <ActivityEditor act={task} onClose={() => setTask(null)} />}
    </div>
  );
}
