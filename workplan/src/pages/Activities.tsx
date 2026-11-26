/** Activités globales (par département) ou activités pays (par pays), filtrables, exportables. */
import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Button, Card, inputCls, MiniProgress, NoPlan, OrphanBadge, PageHeader, StatusBadge, UnitChip } from '../components/ui';
import { exportRows } from '../lib/export';
import { money, pct } from '../lib/format';
import { newActivity } from '../lib/ops';
import { STATUS_LABEL, type Activity, type ActivityStatus, type Level } from '../types';

export default function Activities({ level }: { level: Level }) {
  const { ws, plan, view, unit } = useApp();
  const [params] = useSearchParams();
  const [f, setF] = useState({ unit: '', kr: '', status: '', q: '', orphans: false });
  const [edit, setEdit] = useState<Activity | null>(() => (params.get('act') ? ws.activities.find((a) => a.id === params.get('act')) ?? null : null));
  const isGlobal = level === 'global';
  const units = ws.units.filter((u) => u.type === (isGlobal ? 'department' : 'country')).sort((a, b) => a.order - b.order);

  const list = useMemo(() => {
    if (!view) return [];
    const q = f.q.toLowerCase();
    const orphanIds = new Set(view.orphans.map((a) => a.id));
    return (isGlobal ? view.globalActs : view.countryActs).filter((a) =>
      (!f.unit || a.unitId === f.unit) && (!f.status || a.status === f.status) && (!f.orphans || orphanIds.has(a.id))
      && (!f.kr || (a.krId ?? (a.parentId ? view.byId.get(a.parentId)?.krId : null)) === f.kr)
      && (!q || [a.title, a.owner, a.code, a.comment, a.parentId ? view.byId.get(a.parentId)?.title : ''].some((t) => t?.toLowerCase().includes(q))));
  }, [view, f, isGlobal]);

  if (!plan || !view) return <><PageHeader title={isGlobal ? 'Activités globales' : 'Activités pays'} /><NoPlan /></>;
  const krCode = (a: Activity) => view.krs.find((k) => k.id === (a.krId ?? (a.parentId ? view.byId.get(a.parentId)?.krId : null)))?.code ?? '—';
  const byUnit = units.map((u) => ({ u, acts: list.filter((a) => a.unitId === u.id) })).filter((x) => x.acts.length);

  const doExport = () => exportRows(list.map((a) => {
    const p = a.parentId ? view.byId.get(a.parentId) : null;
    const kids = view.childrenOf.get(a.id) ?? [];
    return {
      [isGlobal ? 'Département' : 'Pays']: unit(a.unitId)?.name ?? '', Code: a.code, Activité: a.title, KR: krCode(a),
      ...(isGlobal
        ? { 'Pays déclinés': [...new Set(kids.map((k) => unit(k.unitId)?.name))].join(', '), 'Nb activités pays': kids.length }
        : { 'Activité globale liée': p?.title ?? 'ORPHELINE (non liée au global)', 'Département': p ? unit(p.unitId)?.name ?? '' : '', Alignement: p ? (a.alignment === 'partial' ? 'Partiel' : 'Complet') : 'Orpheline' }),
      Responsable: a.owner, Début: `Q${a.startQ}`, Fin: `Q${a.endQ}`, Statut: STATUS_LABEL[a.status], 'Avancement exécution (%)': a.progress,
      [`Avancement consolidé Q${view.quarter}`]: pct(view.activity.get(a.id)?.progress), Budget: a.budget ?? '', Commentaire: a.comment,
    };
  }), `${isGlobal ? 'activites-globales' : 'activites-pays'}-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={plan.name} title={isGlobal ? 'Activités des départements globaux' : 'Activités des pays'}
        subtitle={isGlobal
          ? 'Activités du plan global, par département. Une activité globale peut ne pas être déclinée dans les pays : c’est normal.'
          : 'Chaque activité pays doit concourir à une activité du plan global. Une activité pays sans lien est signalée « orpheline, non liée au global ».'}
        actions={<><Button onClick={doExport}>Export Excel</Button><Button variant="primary" onClick={() => setEdit(newActivity(ws, { planId: plan.id, level, unitId: f.unit || units[0]?.id || '' }))}>+ Activité</Button></>} />
      {!isGlobal && view.orphans.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-sm text-[#8a1c2b]">
          <OrphanBadge /><b>{view.orphans.length} activité(s) pays orpheline(s)</b> sur {view.alignment.countryActs}.
          <button className="font-semibold underline" onClick={() => setF({ ...f, orphans: !f.orphans })}>{f.orphans ? 'Tout afficher' : 'Afficher seulement les orphelines'}</button>
        </div>
      )}
      <Card>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label="Unité">
            <option value="">{isGlobal ? 'Tous les départements' : 'Tous les pays'}</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className={inputCls} value={f.kr} onChange={(e) => setF({ ...f, kr: e.target.value })} aria-label="KR">
            <option value="">Tous les KR</option>
            {view.krs.map((k) => <option key={k.id} value={k.id}>{k.code} · {k.title.slice(0, 50)}</option>)}
          </select>
          <select className={inputCls} value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} aria-label="Statut">
            <option value="">Tous les statuts</option>
            {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <input className={inputCls} placeholder="Rechercher…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
      </Card>
      <p className="text-sm text-slate-500">{list.length} activité(s)</p>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1050px]">
          <thead>
            <tr>
              <th>KR</th><th>Activité</th>
              <th>{isGlobal ? 'Déclinaison pays' : 'Activité globale liée'}</th>
              <th>Responsable</th><th>Période</th><th>Statut</th><th>Avancement</th><th>Budget</th>
            </tr>
          </thead>
          <tbody>
            {byUnit.map(({ u, acts }) => (
              <Fragment key={u.id}>
                <tr className="grp"><td colSpan={8}><b className="mr-2 text-base">{u.name}</b>{u.group && <small className="mr-2 text-[#4a6584]">{u.group}</small>}
                  <small className="text-[#4a6584]">{acts.length} activité(s) · avancement {pct(view.unit.get(u.id)?.progress)}</small></td></tr>
                {acts.map((a) => {
                  const sc = view.activity.get(a.id)!;
                  const p = a.parentId ? view.byId.get(a.parentId) : null;
                  const kids = view.childrenOf.get(a.id) ?? [];
                  const countries = [...new Set(kids.map((k) => k.unitId))];
                  return (
                    <tr key={a.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(a)}>
                      <td className="whitespace-nowrap font-semibold text-brand-500">{krCode(a)}</td>
                      <td className="max-w-[320px]">{a.code && <b className="mr-1">{a.code}</b>}{a.title}{a.comment && <div className="mt-0.5 line-clamp-2 text-xs text-slate-500">{a.comment}</div>}</td>
                      <td className="max-w-[300px]">
                        {isGlobal
                          ? (countries.length ? <span className="flex flex-wrap gap-1">{countries.map((c) => <UnitChip key={c} name={unit(c)?.name ?? c} type="country" />)}<span className="text-xs text-slate-500">{kids.length} act.</span></span> : <span className="text-xs text-slate-400">Globale seule</span>)
                          : p ? <><UnitChip name={unit(p.unitId)?.name ?? ''} type="department" /> <span className="text-sm">{p.title}</span>{a.alignment === 'partial' && <span className="ml-1 rounded bg-[#fff3e6] px-1.5 text-[11px] text-[#9a4a00]">partiel</span>}</> : <OrphanBadge />}
                      </td>
                      <td className="text-slate-600">{a.owner || '—'}</td>
                      <td className="whitespace-nowrap">Q{a.startQ}–Q{a.endQ}{sc.overdue && <div className="text-[11px] font-semibold text-rag-red">échéance dépassée</div>}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td><MiniProgress value={sc.progress} rag={sc.rag} /></td>
                      <td className="whitespace-nowrap text-slate-600">{a.budget !== null ? money(a.budget) : '—'}</td>
                    </tr>
                  );
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
