/**
 * Registre OKR au format de la source (généré à partir des KR / activités du plan) :
 *   Ref | Global Key Result | Country / Team | Role | Country/Team Objective | Country/Team Key Result | KR Lead | Scope | Go to plan
 * avec les lignes de section « OBJECTIVE X · … ». Cliquer une ligne ouvre la fiche ; export Excel au même format.
 */
import { Fragment, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { AlignBadge, Button, Card, inputCls, NoPlan, PageHeader, RoleBadge } from '../components/ui';
import { exportRows } from '../lib/export';
import type { Activity } from '../types';

export default function Register() {
  const { plan, view, unit } = useApp();
  const [edit, setEdit] = useState<Activity | null>(null);
  const [q, setQ] = useState('');
  if (!plan || !view) return <><PageHeader title="Registre OKR" /><NoPlan /></>;
  const krOrder = new Map(view.krs.map((k, n) => [k.id, n]));
  const label = (a: Activity) => {
    const u = unit(a.unitId);
    if (!u) return '';
    if (a.subTeam) return `${u.name} (${a.subTeam})`;
    return u.group ? `${u.group} (${u.name})` : u.name;
  };
  const rows = view.activities
    .filter((a) => !q || [a.title, a.unitObjective, a.owner, label(a)].some((t) => t.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (krOrder.get(a.krId ?? '') ?? 999) - (krOrder.get(b.krId ?? '') ?? 999) || a.order - b.order);
  const kr = (id: string | null) => view.krs.find((k) => k.id === id);
  const obj = (krId: string | null) => view.objectives.find((o) => o.id === kr(krId)?.objectiveId);
  const doExport = () => {
    const out: Record<string, string>[] = [];
    rows.forEach((a, n) => {
      const o = obj(a.krId);
      if (o?.id !== obj(rows[n - 1]?.krId ?? null)?.id) out.push({ Ref: `OBJECTIVE ${o?.code ?? ''}  ·  ${o?.title ?? ''}` });
      const k = kr(a.krId);
      out.push({
        Ref: k?.code ?? '', 'Global Key Result': k && !k.team ? `${k.code}\n${k.title}` : k?.title ?? '', 'Country / Team': label(a), Role: a.role ?? 'Team KR',
        'Country/Team Objective': a.unitObjective, 'Country/Team Key Result': a.title, 'KR Lead': a.owner, Scope: a.scope, 'Go to plan': unit(a.unitId)?.name ?? '',
      });
    });
    exportRows(out, `OKR-Register-${plan.year}`, 'xlsx');
  };

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={plan.name} title="Registre OKR" subtitle={`${view.activities.length} ligne(s) : KR des équipes globales et des pays, rattachés aux KR globaux.`}
        actions={<Button onClick={doExport}>Export Excel</Button>} />
      <Card><input className={inputCls} placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} /></Card>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1300px]">
          <thead><tr><th>Ref</th><th>Global Key Result</th><th>Country / Team</th><th>Role</th><th>Country/Team Objective</th><th>Country/Team Key Result</th><th>KR Lead</th><th>Scope</th><th>Alignement</th><th>Go to plan</th></tr></thead>
          <tbody>
            {rows.map((a, n) => {
              const o = obj(a.krId);
              const newObj = o?.id !== obj(rows[n - 1]?.krId ?? null)?.id;
              const newKr = a.krId !== rows[n - 1]?.krId;
              const k = kr(a.krId);
              return (
                <Fragment key={a.id}>
                  {newObj && o && <tr className="grp"><td colSpan={10} className="font-titre text-[15px] uppercase tracking-wide"><span style={{ color: o.color }}>■</span> Objective {o.code} <span className="mx-1 text-accent">·</span> <span className="normal-case">{o.title}</span></td></tr>}
                  <tr className={`cursor-pointer hover:bg-[#fafbfc] ${newKr && !newObj ? 'border-t-2 border-t-[#dce3ea]' : ''}`} onClick={() => setEdit(a)}>
                    <td className="whitespace-nowrap font-bold text-brand-500">{newKr ? k?.code : ''}</td>
                    <td className="max-w-[220px] text-slate-600">{newKr ? k?.title : ''}</td>
                    <td className="whitespace-nowrap font-semibold">{label(a)}</td>
                    <td>{a.role ? <RoleBadge role={a.role} /> : <span className="text-xs text-slate-500">Team KR</span>}</td>
                    <td className="max-w-[220px] text-slate-600">{a.unitObjective}</td>
                    <td className="max-w-[320px]">{a.title}</td>
                    <td className="text-slate-600">{a.owner}</td>
                    <td className="text-slate-600">{a.scope}</td>
                    <td><AlignBadge status={a.alignment} /></td>
                    <td onClick={(e) => e.stopPropagation()}><Link to={`/plan?kr=${a.krId}`} className="whitespace-nowrap font-semibold text-brand-500 hover:text-accent">Open ►</Link></td>
                  </tr>
                </Fragment>
              );
            })}
            {!rows.length && <tr><td colSpan={10} className="py-6 text-center text-slate-500">Registre vide : importez le fichier OKR (Import Excel) ou construisez le plan.</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
