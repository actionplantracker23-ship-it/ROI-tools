/**
 * Registre OKR, au format de la source :
 *   Ref | Global Key Result | Country / Team | Role | Country/Team Objective | Country/Team Key Result | KR Lead | Scope | Go to plan
 * avec les lignes de section « OBJECTIVE X · … ». Modifiable (ajout, rôle, suppression), exportable.
 */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Button, Card, Field, inputCls, Modal, NoPlan, PageHeader, RoleBadge } from '../components/ui';
import { exportRows } from '../lib/export';
import { remove, upsert } from '../lib/ops';
import { uid } from '../lib/util';
import type { Commitment } from '../types';

function CommitmentEditor({ c, onClose }: { c: Commitment; onClose: () => void }) {
  const { ws, view, update } = useApp();
  const [x, setX] = useState(c);
  const isNew = !ws.commitments.some((k) => k.id === c.id);
  return (
    <Modal title={isNew ? 'Nouvelle ligne du registre' : 'Ligne du registre'} onClose={onClose}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="KR global"><select className={inputCls} value={x.krId} onChange={(e) => setX({ ...x, krId: e.target.value })}>{view!.krs.map((k) => <option key={k.id} value={k.id}>{k.code} · {k.title.slice(0, 60)}</option>)}</select></Field>
        <Field label="Country / Team"><select className={inputCls} value={x.unitId} onChange={(e) => setX({ ...x, unitId: e.target.value })}>{ws.units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field>
        <Field label="Role"><select className={inputCls} value={x.role} onChange={(e) => setX({ ...x, role: e.target.value as Commitment['role'] })}><option>Lead</option><option>Contributes</option></select></Field>
        <Field label="Scope"><input className={inputCls} value={x.scope} onChange={(e) => setX({ ...x, scope: e.target.value })} /></Field>
        <Field label="Country/Team Objective" className="sm:col-span-2"><input className={inputCls} value={x.unitObjective} onChange={(e) => setX({ ...x, unitObjective: e.target.value })} /></Field>
        <Field label="Country/Team Key Result" className="sm:col-span-2"><textarea rows={2} className={inputCls} value={x.unitKr} onChange={(e) => setX({ ...x, unitKr: e.target.value })} /></Field>
        <Field label="KR Lead"><input className={inputCls} value={x.krLead} onChange={(e) => setX({ ...x, krLead: e.target.value })} /></Field>
        <Field label="Go to plan"><input className={inputCls} value={x.planRef} onChange={(e) => setX({ ...x, planRef: e.target.value })} /></Field>
      </div>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" disabled={!x.krId || !x.unitId} onClick={() => { update((w) => upsert(w, 'commitments', x), 'Registre enregistré.'); onClose(); }}>Enregistrer</Button>
        <Button onClick={onClose}>Annuler</Button>
        {!isNew && <Button variant="danger" onClick={() => { update((w) => remove(w, 'commitments', x.id), 'Ligne supprimée.'); onClose(); }}>Supprimer</Button>}
      </div>
    </Modal>
  );
}

export default function Register() {
  const { ws, plan, view, unit } = useApp();
  const [edit, setEdit] = useState<Commitment | null>(null);
  const [q, setQ] = useState('');
  if (!plan || !view) return <><PageHeader title="Registre OKR" /><NoPlan /></>;
  const krOrder = new Map(view.krs.map((k, n) => [k.id, n]));
  const rows = view.commitments
    .filter((c) => !q || [c.unitKr, c.unitObjective, c.krLead, unit(c.unitId)?.name].some((t) => t?.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (krOrder.get(a.krId) ?? 0) - (krOrder.get(b.krId) ?? 0) || (a.role === b.role ? 0 : a.role === 'Lead' ? -1 : 1));
  const kr = (id: string) => view.krs.find((k) => k.id === id);
  const obj = (krId: string) => view.objectives.find((o) => o.id === kr(krId)?.objectiveId);
  const doExport = () => {
    const out: Record<string, string>[] = [];
    rows.forEach((c, n) => {
      if (obj(c.krId)?.id !== obj(rows[n - 1]?.krId ?? '')?.id) out.push({ Ref: `OBJECTIVE ${obj(c.krId)?.code}  ·  ${obj(c.krId)?.title ?? ''}` });
      out.push({ Ref: kr(c.krId)?.code ?? '', 'Global Key Result': kr(c.krId)?.title ?? '', 'Country / Team': unit(c.unitId)?.name ?? '', Role: c.role,
        'Country/Team Objective': c.unitObjective, 'Country/Team Key Result': c.unitKr, 'KR Lead': c.krLead, Scope: c.scope, 'Go to plan': c.planRef });
    });
    exportRows(out, `OKR-Register-${plan.year}`, 'xlsx');
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={plan.name} title="Registre OKR" subtitle={`${view.commitments.length} engagement(s) des départements et pays sur les KR globaux.`}
        actions={<><Button onClick={doExport}>Export Excel</Button><Button variant="primary" disabled={!view.krs.length} onClick={() => setEdit({ id: uid('c-'), planId: plan.id, krId: view.krs[0]?.id ?? '', unitId: ws.units[0]?.id ?? '', role: 'Contributes', unitObjective: '', unitKr: '', krLead: '', scope: '', planRef: '' })}>+ Ligne</Button></>} />
      <Card><input className={inputCls} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} /></Card>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1200px]">
          <thead><tr><th>Ref</th><th>Global Key Result</th><th>Country / Team</th><th>Role</th><th>Country/Team Objective</th><th>Country/Team Key Result</th><th>KR Lead</th><th>Scope</th><th>Go to plan</th></tr></thead>
          <tbody>
            {rows.map((c, n) => {
              const o = obj(c.krId);
              const newObj = o?.id !== obj(rows[n - 1]?.krId ?? '')?.id;
              const newKr = c.krId !== rows[n - 1]?.krId;
              return (
                <Fragment key={c.id}>
                  {newObj && o && <tr className="grp"><td colSpan={9} className="font-titre text-[15px] uppercase tracking-wide"><span style={{ color: o.color }}>■</span> Objective {o.code} <span className="mx-1 text-accent">·</span> <span className="normal-case">{o.title}</span></td></tr>}
                  <tr className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(c)}>
                    <td className="whitespace-nowrap font-bold text-brand-500">{newKr ? kr(c.krId)?.code : ''}</td>
                    <td className="max-w-[220px] text-slate-600">{newKr ? kr(c.krId)?.title : ''}</td>
                    <td className="whitespace-nowrap font-semibold">{unit(c.unitId)?.name}</td>
                    <td><RoleBadge role={c.role} /></td>
                    <td className="max-w-[200px] text-slate-600">{c.unitObjective}</td>
                    <td className="max-w-[280px]">{c.unitKr}</td>
                    <td className="text-slate-600">{c.krLead}</td>
                    <td className="text-slate-600">{c.scope}</td>
                    <td onClick={(e) => e.stopPropagation()}><Link to={`/plan?kr=${c.krId}`} className="whitespace-nowrap font-semibold text-brand-500 hover:text-accent">{c.planRef || 'Plan'} →</Link></td>
                  </tr>
                </Fragment>
              );
            })}
            {!rows.length && <tr><td colSpan={9} className="py-6 text-center text-slate-500">Registre vide : importez la feuille « OKR Register » ou ajoutez des lignes.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <CommitmentEditor c={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
