/**
 * Analyse d'alignement (feuille « alignement du OKR ») :
 *  - synthèse par statut (Aligned, Partial, Conflict, Gap, Global only) pour les KR pays et les KR des équipes globales ;
 *  - KR pays ORPHELINS (aucune équipe globale ne les soutient) avec rattachement en un clic ;
 *  - A · KR pays → soutenu par quelles équipes globales ? (constat, action recommandée) ;
 *  - B · KR des équipes globales → quels pays s'y engagent ? ;
 *  - matrice équipes globales × pays.
 */
import { Fragment, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { ALIGN_HEX, AlignBadge, Button, Card, inputCls, NoPlan, OrphanBadge, PageHeader, Stat, UnitChip } from '../components/ui';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import { addLink, suggestParents } from '../lib/ops';
import { ALIGN_HELP, ALIGN_LABEL, type Activity, type AlignStatus } from '../types';

const STATUSES: AlignStatus[] = ['aligned', 'partial', 'conflict', 'gap', 'global_only'];

export default function Alignment() {
  const { ws, plan, view, update, unit } = useApp();
  const [edit, setEdit] = useState<Activity | null>(null);
  const [fa, setFa] = useState({ unit: '', status: '' });
  const [fb, setFb] = useState({ unit: '', status: '' });
  const suggestions = useMemo(() => new Map((view?.orphans ?? []).map((o) => [o.id, suggestParents(ws, o, 3)])), [ws, view]);
  if (!plan || !view) return <><PageHeader title="Alignement" /><NoPlan /></>;

  const code = (a: Activity) => view.krs.find((k) => k.id === a.krId)?.code ?? '—';
  const obj = (a: Activity) => { const k = view.krs.find((x) => x.id === a.krId); return view.objectives.find((o) => o.id === k?.objectiveId)?.code ?? ''; };
  const names = (acts: Activity[]) => [...new Set(acts.map((x) => x.unitId))];
  const countries = ws.units.filter((u) => u.type === 'country' && view.countryActs.some((a) => a.unitId === u.id));
  const teams = ws.units.filter((u) => u.type === 'department' && view.globalActs.some((a) => a.unitId === u.id));
  const A = view.countryActs.filter((a) => (!fa.unit || a.unitId === fa.unit) && (!fa.status || (fa.status === 'orphan' ? !(view.parentsOf.get(a.id) ?? []).length : (a.alignment ?? 'none') === fa.status)));
  const B = view.globalActs.filter((a) => (!fb.unit || a.unitId === fb.unit) && (!fb.status || (a.alignment ?? 'none') === fb.status));
  const chart = countries.map((c) => {
    const acts = view.countryActs.filter((a) => a.unitId === c.id);
    return { name: c.name, ...Object.fromEntries(STATUSES.slice(0, 4).map((s) => [ALIGN_LABEL[s], acts.filter((a) => a.alignment === s).length])) };
  });

  const doExport = () => exportRows([
    ...view.countryActs.map((a) => ({
      Partie: 'A · KR pays', 'Country / Global team': unit(a.unitId)?.name, 'Obj.': `O${obj(a)}`, Ref: code(a), 'Key Result': a.title, 'KR Lead': a.owner,
      'Unités liées': names(view.parentsOf.get(a.id) ?? []).map((id) => unit(id)?.name).join(', ') || '— none — (ORPHELIN)',
      '#': (view.parentsOf.get(a.id) ?? []).length, Status: a.alignment ? ALIGN_LABEL[a.alignment] : '', 'Finding / gap': a.finding, 'Recommended action': a.action,
    })),
    ...view.globalActs.map((a) => ({
      Partie: 'B · KR équipe globale', 'Country / Global team': unit(a.unitId)?.name, 'Obj.': `O${obj(a)}`, Ref: code(a), 'Key Result': a.title, 'KR Lead': a.owner,
      'Unités liées': names(view.childrenOf.get(a.id) ?? []).map((id) => unit(id)?.name).join(', ') || '— none —',
      '#': (view.childrenOf.get(a.id) ?? []).length, Status: a.alignment ? ALIGN_LABEL[a.alignment] : '', 'Finding / gap': a.finding, 'Recommended action': a.action,
    })),
  ], `alignement-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={plan.name} title="Alignement KR pays ↔ KR des équipes globales"
        subtitle="Chaque KR / activité pays doit être soutenu par une équipe globale (KR sous la même Ref). Le plan global peut aller au-delà des pays (« Global only ») : c’est normal. Un KR pays sans équipe globale est orphelin."
        actions={<Button onClick={doExport}>Export Excel</Button>} />

      <div className="grid gap-4 lg:grid-cols-[1fr,1.2fr]">
        <Card title="Synthèse">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500"><th className="py-1.5">Statut</th><th className="text-right">KR pays</th><th className="text-right">KR équipes globales</th></tr></thead>
            <tbody>
              {STATUSES.map((s) => (
                <tr key={s} className="border-t border-[#eef0f3]" title={ALIGN_HELP[s]}>
                  <td className="py-1.5"><AlignBadge status={s} /></td>
                  <td className="text-right text-[17px] font-bold">{view.alignment.country[s]}</td>
                  <td className="text-right text-[17px] font-bold">{view.alignment.global[s]}</td>
                </tr>
              ))}
              {(view.alignment.country.none > 0 || view.alignment.global.none > 0) && (
                <tr className="border-t border-[#eef0f3]"><td className="py-1.5 text-xs text-slate-500">Non analysé</td><td className="text-right font-bold">{view.alignment.country.none}</td><td className="text-right font-bold">{view.alignment.global.none}</td></tr>
              )}
              <tr className="border-t-2 border-brand-500 font-bold text-brand-500"><td className="py-1.5">Total</td><td className="text-right">{view.countryActs.length}</td><td className="text-right">{view.globalActs.length}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Stat label="KR pays soutenus" value={pct(view.alignment.rate)} hint={`${view.alignment.linked} / ${view.alignment.countryActs}`} color="#2e9e4f" />
            <Stat label="Orphelins" value={<span className={view.orphans.length ? 'text-rag-red' : ''}>{view.orphans.length}</span>} hint="aucune équipe globale" color="#d64545" />
          </div>
        </Card>
        <Card title="KR pays par statut">
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {STATUSES.slice(0, 4).map((s, i) => <Bar key={s} dataKey={ALIGN_LABEL[s]} stackId="a" fill={ALIGN_HEX[s]} stroke="#fff" strokeWidth={2} maxBarSize={56} radius={i === 3 ? [4, 4, 0, 0] : undefined} />)}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card title={<span className="flex flex-wrap items-center gap-2">KR pays orphelins ({view.orphans.length}) {view.orphans.length > 0 && <OrphanBadge />}</span>}>
        {view.orphans.length === 0 ? <p className="text-sm text-rag-green">Tous les KR pays sont soutenus par au moins une équipe globale.</p> : (
          <div className="overflow-x-auto">
            <table className="suivi min-w-[900px]">
              <thead><tr><th>Pays</th><th>Ref</th><th>KR / activité orphelin</th><th>Rattacher à une équipe globale (suggestions)</th><th /></tr></thead>
              <tbody>
                {view.orphans.map((o) => (
                  <tr key={o.id}>
                    <td><UnitChip name={unit(o.unitId)?.name ?? ''} type="country" /></td>
                    <td className="font-semibold text-brand-500">{code(o)}</td>
                    <td className="max-w-[340px]">{o.title}{o.finding && <div className="mt-1 text-xs text-slate-600"><b>Constat :</b> {o.finding}</div>}{o.action && <div className="text-xs text-[#9a4a00]"><b>Action :</b> {o.action}</div>}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {(suggestions.get(o.id) ?? []).map(({ a }) => (
                          <button key={a.id} onClick={() => update((w) => addLink(w, o.id, a.id), 'Rattaché au plan global.')}
                            className="rounded-md border border-[#9ed8f2] bg-[#eaf7fd] px-2 py-1 text-left text-xs text-brand-500 hover:border-accent">
                            + <b>{unit(a.unitId)?.name} · {code(a)}</b> · {a.title.slice(0, 80)}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td><Button className="!min-h-[32px] !px-2.5 !py-1 text-sm" onClick={() => setEdit(o)}>Ouvrir…</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="A · KR pays → est-il soutenu par un KR d’équipe globale ?" action={
        <div className="flex flex-wrap gap-2">
          <select className={`${inputCls} !w-44`} value={fa.unit} onChange={(e) => setFa({ ...fa, unit: e.target.value })} aria-label="Pays"><option value="">Tous les pays</option>{countries.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className={`${inputCls} !w-44`} value={fa.status} onChange={(e) => setFa({ ...fa, status: e.target.value })} aria-label="Statut"><option value="">Tous les statuts</option>{STATUSES.slice(0, 4).map((s) => <option key={s} value={s}>{ALIGN_LABEL[s]}</option>)}<option value="orphan">Orphelins</option></select>
        </div>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="suivi min-w-[1250px]">
            <thead><tr><th>Country</th><th>Obj.</th><th>Ref</th><th className="w-[26%]">Country Key Result</th><th>KR Lead</th><th>Équipes globales (même Ref)</th><th>Status</th><th>Finding / gap</th><th>Recommended action</th></tr></thead>
            <tbody>
              {countries.filter((c) => A.some((a) => a.unitId === c.id)).map((c) => (
                <Fragment key={c.id}>
                  <tr className="grp"><td colSpan={9}><b>{c.name}</b></td></tr>
                  {A.filter((a) => a.unitId === c.id).map((a) => {
                    const ps = view.parentsOf.get(a.id) ?? [];
                    return (
                      <tr key={a.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(a)}>
                        <td className="whitespace-nowrap">{c.name}{a.subTeam && <div className="text-[13.5px] text-slate-500">{a.subTeam}</div>}</td>
                        <td>O{obj(a)}</td><td className="whitespace-nowrap font-semibold text-brand-500">{code(a)}</td>
                        <td>{a.title}</td><td className="text-slate-600">{a.owner}</td>
                        <td>{ps.length ? <span className="flex flex-wrap gap-1">{names(ps).map((id) => <UnitChip key={id} name={unit(id)?.name ?? ''} type="department" />)}<span className="text-xs text-slate-500">({ps.length})</span></span> : <OrphanBadge />}</td>
                        <td><AlignBadge status={a.alignment} /></td>
                        <td className="max-w-[240px] text-xs text-slate-600">{a.finding}</td>
                        <td className="max-w-[240px] text-xs text-[#9a4a00]">{a.action}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="B · KR d’équipe globale → les pays s’y engagent-ils ?" action={
        <div className="flex flex-wrap gap-2">
          <select className={`${inputCls} !w-52`} value={fb.unit} onChange={(e) => setFb({ ...fb, unit: e.target.value })} aria-label="Équipe"><option value="">Toutes les équipes</option>{teams.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <select className={`${inputCls} !w-44`} value={fb.status} onChange={(e) => setFb({ ...fb, status: e.target.value })} aria-label="Statut"><option value="">Tous les statuts</option>{STATUSES.map((s) => <option key={s} value={s}>{ALIGN_LABEL[s]}</option>)}</select>
        </div>}>
        <div className="-mx-5 overflow-x-auto">
          <table className="suivi min-w-[1250px]">
            <thead><tr><th>Global team</th><th>Obj.</th><th>Ref</th><th className="w-[26%]">Global team Key Result</th><th>Scope</th><th>Pays rattachés</th><th>Status</th><th>Finding / gap</th><th>Recommended action</th></tr></thead>
            <tbody>
              {teams.filter((t) => B.some((a) => a.unitId === t.id)).map((t) => (
                <Fragment key={t.id}>
                  <tr className="grp"><td colSpan={9}><b>{t.name}</b>{t.group && <small className="ml-2 text-[#4a6584]">{t.group}</small>}</td></tr>
                  {B.filter((a) => a.unitId === t.id).map((a) => {
                    const ks = view.childrenOf.get(a.id) ?? [];
                    return (
                      <tr key={a.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(a)}>
                        <td className="whitespace-nowrap">{t.name}</td><td>O{obj(a)}</td><td className="whitespace-nowrap font-semibold text-brand-500">{code(a)}</td>
                        <td>{a.title}</td><td className="text-slate-600">{a.scope}</td>
                        <td>{ks.length ? <span className="flex flex-wrap gap-1">{names(ks).map((id) => <UnitChip key={id} name={unit(id)?.name ?? ''} type="country" />)}</span> : <span className="text-xs text-slate-400">aucun</span>}</td>
                        <td><AlignBadge status={a.alignment} /></td>
                        <td className="max-w-[240px] text-xs text-slate-600">{a.finding}</td>
                        <td className="max-w-[240px] text-xs text-[#9a4a00]">{a.action}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Équipes globales × pays : nombre de KR pays soutenus">
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-sm">
            <thead><tr><th className="rounded-l bg-brand-600 px-2 py-2.5 text-left font-normal text-white">Équipe globale</th>{countries.map((c) => <th key={c.id} className="bg-brand-600 px-2 py-2.5 font-normal text-white last:rounded-r">{c.name}</th>)}</tr></thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.id}>
                  <th className="whitespace-nowrap px-2 py-1.5 text-left font-semibold text-brand-500">{t.name}</th>
                  {countries.map((c) => {
                    const n = view.countryActs.filter((a) => a.unitId === c.id && (view.parentsOf.get(a.id) ?? []).some((p) => p.unitId === t.id)).length;
                    return <td key={c.id} className="h-9 rounded text-center font-semibold" style={{ background: n ? '#2e9e4f' : '#f4f5f7', color: n ? '#fff' : '#cbd5e1' }} title={`${t.name} soutient ${n} KR de ${c.name}`}>{n || '·'}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
