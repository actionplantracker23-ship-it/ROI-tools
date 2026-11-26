/**
 * Analyse d'alignement global ↔ pays :
 *  - taux d'alignement et répartition par pays (liées / partielles / orphelines) ;
 *  - activités pays ORPHELINES (non liées au global) avec suggestions de rattachement en un clic ;
 *  - matrice activités globales × pays (déclinaison). Une activité globale sans pays est normale.
 */
import { Fragment, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Button, Card, inputCls, NoPlan, OrphanBadge, PageHeader, Stat, UnitChip } from '../components/ui';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import { linkActivity, suggestParents } from '../lib/ops';
import type { Activity } from '../types';

export default function Alignment() {
  const { ws, plan, view, update, unit } = useApp();
  const [edit, setEdit] = useState<Activity | null>(null);
  const [dep, setDep] = useState('');
  const countries = ws.units.filter((u) => u.type === 'country').sort((a, b) => a.order - b.order);
  const suggestions = useMemo(() => new Map((view?.orphans ?? []).map((o) => [o.id, suggestParents(ws, o, 3)])), [ws, view]);
  if (!plan || !view) return <><PageHeader title="Alignement" /><NoPlan /></>;

  const live = view.countryActs.filter((a) => a.status !== 'cancelled');
  const orphanIds = new Set(view.orphans.map((a) => a.id));
  const chart = countries.map((c) => {
    const acts = live.filter((a) => a.unitId === c.id);
    const orph = acts.filter((a) => orphanIds.has(a.id)).length;
    const partial = acts.filter((a) => !orphanIds.has(a.id) && a.alignment === 'partial').length;
    return { name: c.name, 'Liées (complet)': acts.length - orph - partial, 'Liées (partiel)': partial, Orphelines: orph, total: acts.length };
  }).filter((x) => x.total);
  const declined = view.globalActs.filter((g) => (view.childrenOf.get(g.id) ?? []).length).length;
  const globals = view.globalActs.filter((g) => !dep || g.unitId === dep);
  const depts = ws.units.filter((u) => u.type === 'department' && view.globalActs.some((g) => g.unitId === u.id));

  const doExport = () => exportRows([
    ...view.countryActs.map((a) => {
      const p = a.parentId ? view.byId.get(a.parentId) : null;
      return {
        Pays: unit(a.unitId)?.name, 'Activité pays': a.title, Statut: orphanIds.has(a.id) ? 'ORPHELINE (non liée au global)' : a.alignment === 'partial' ? 'Liée (partiel)' : 'Liée',
        'Activité globale': p?.title ?? '', Département: p ? unit(p.unitId)?.name : '', KR: view.krs.find((k) => k.id === (a.krId ?? p?.krId))?.code ?? '',
      };
    }),
    ...view.globalActs.filter((g) => !(view.childrenOf.get(g.id) ?? []).length).map((g) => ({
      Pays: '', 'Activité pays': '', Statut: 'Globale seule (normal)', 'Activité globale': g.title, Département: unit(g.unitId)?.name, KR: view.krs.find((k) => k.id === g.krId)?.code ?? '',
    })),
  ], `alignement-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={plan.name} title="Alignement global ↔ pays"
        subtitle="Toute activité pays doit être liée à une activité du plan global. Les activités globales peuvent dépasser celles des pays : c’est normal. Les activités pays sans lien sont orphelines."
        actions={<Button onClick={doExport}>Export Excel</Button>} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Taux d’alignement" value={pct(view.alignment.rate)} hint={`${view.alignment.aligned} / ${view.alignment.countryActs} activités pays liées`} color="#2e9e4f" />
        <Stat label="Orphelines" value={<span className={view.orphans.length ? 'text-rag-red' : ''}>{view.orphans.length}</span>} hint="non liées au global" color="#d64545" />
        <Stat label="Liens partiels" value={view.alignment.partial} color="#f2b01e" />
        <Stat label="Act. globales déclinées" value={<>{declined}<small className="text-base font-normal text-slate-500"> / {view.globalActs.length}</small></>} hint="ont au moins une activité pays" color="#0b2e59" />
        <Stat label="Globales seules" value={view.globalActs.length - declined} hint="normal : pas de déclinaison pays" color="#5bc0eb" />
      </div>

      <Card title="Activités pays par statut d’alignement">
        {chart.length === 0 ? <p className="text-sm text-slate-500">Aucune activité pays.</p> : (
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Liées (complet)" stackId="a" fill="#2e9e4f" stroke="#fff" strokeWidth={2} maxBarSize={56} />
                <Bar dataKey="Liées (partiel)" stackId="a" fill="#f2b01e" stroke="#fff" strokeWidth={2} maxBarSize={56} />
                <Bar dataKey="Orphelines" stackId="a" fill="#d64545" stroke="#fff" strokeWidth={2} maxBarSize={56} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card title={<span className="flex flex-wrap items-center gap-2">Activités orphelines à rattacher ({view.orphans.length}) {view.orphans.length > 0 && <OrphanBadge />}</span>}>
        {view.orphans.length === 0 ? <p className="text-sm text-rag-green">Toutes les activités pays sont liées au plan global.</p> : (
          <div className="overflow-x-auto">
            <table className="suivi min-w-[860px]">
              <thead><tr><th>Pays</th><th>Activité pays orpheline</th><th>Rattacher à (suggestions)</th><th /></tr></thead>
              <tbody>
                {view.orphans.map((o) => (
                  <tr key={o.id}>
                    <td><UnitChip name={unit(o.unitId)?.name ?? ''} type="country" /></td>
                    <td className="max-w-[320px]">{o.title}{o.comment && <div className="text-xs text-slate-500">{o.comment}</div>}</td>
                    <td>
                      <div className="flex flex-col gap-1">
                        {(suggestions.get(o.id) ?? []).map(({ a, score }) => (
                          <button key={a.id} onClick={() => update((w) => linkActivity(w, o.id, a.id, 'full'), 'Activité rattachée au plan global.')}
                            className="rounded-md border border-[#9ed8f2] bg-[#eaf7fd] px-2 py-1 text-left text-xs text-brand-500 hover:border-accent">
                            <b>{unit(a.unitId)?.name}</b> · {a.title.slice(0, 80)} <span className="text-slate-400">({Math.round(Math.min(1, score) * 100)} %)</span>
                          </button>
                        ))}
                        {!(suggestions.get(o.id) ?? []).length && <span className="text-xs text-slate-400">Aucune activité globale proche.</span>}
                      </div>
                    </td>
                    <td><Button className="!min-h-[32px] !px-2.5 !py-1 text-sm" onClick={() => setEdit(o)}>Choisir…</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Matrice activités globales × pays" action={
        <select className={`${inputCls} !w-60`} value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Département">
          <option value="">Tous les départements</option>{depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>}>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[760px] border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th className="rounded-l bg-brand-600 px-2 py-2.5 text-left font-normal text-white">Activité globale</th>
                {countries.map((c) => <th key={c.id} className="bg-brand-600 px-2 py-2.5 font-normal text-white">{c.name}</th>)}
                <th className="rounded-r bg-brand-500 px-2 py-2.5 font-normal text-white">Total</th>
              </tr>
            </thead>
            <tbody>
              {ws.units.filter((u) => u.type === 'department' && globals.some((g) => g.unitId === u.id)).map((d) => (
                <Fragment key={d.id}>
                  <tr><td colSpan={countries.length + 2} className="border-l-4 border-accent bg-brand-50 px-2 py-1.5 font-semibold text-brand-700">{d.name}</td></tr>
                  {globals.filter((g) => g.unitId === d.id).map((g) => {
                    const kids = view.childrenOf.get(g.id) ?? [];
                    return (
                      <tr key={g.id}>
                        <td className="max-w-[360px] px-2 py-1.5"><button className="text-left hover:text-accent" onClick={() => setEdit(g)}>{g.title}</button></td>
                        {countries.map((c) => {
                          const n = kids.filter((k) => k.unitId === c.id);
                          const partial = n.some((k) => k.alignment === 'partial');
                          return (
                            <td key={c.id} className="h-9 rounded text-center font-semibold" title={n.map((k) => k.title).join('\n')}
                              style={{ background: n.length ? (partial ? '#f2b01e' : '#2e9e4f') : '#f4f5f7', color: n.length ? (partial ? '#2b2100' : '#fff') : '#cbd5e1' }}>
                              {n.length || '·'}
                            </td>
                          );
                        })}
                        <td className="text-center font-semibold text-brand-500">{kids.length || <span className="text-xs font-normal text-slate-400">globale seule</span>}</td>
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">Vert : activité(s) pays liée(s) · ambre : lien partiel · gris : pas de déclinaison dans ce pays. Survolez une case pour voir les activités.</p>
      </Card>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
