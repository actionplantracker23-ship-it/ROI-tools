/** KR / activités des équipes globales (par équipe) ou des pays (par pays) : filtres, statut d'alignement, export. */
import { Fragment, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { AlignBadge, Button, Card, inputCls, MiniProgress, NoPlan, OrphanBadge, PageHeader, RoleBadge, StatusBadge, UnitChip } from '../components/ui';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import { newActivity } from '../lib/ops';
import { ALIGN_LABEL, STATUS_LABEL, type Activity, type AlignStatus, type Level } from '../types';

export default function Activities({ level }: { level: Level }) {
  const { ws, plan, view, unit } = useApp();
  const [params] = useSearchParams();
  const [f, setF] = useState({ unit: '', kr: '', align: '', q: '', orphans: false });
  const [edit, setEdit] = useState<Activity | null>(() => (params.get('act') ? ws.activities.find((a) => a.id === params.get('act')) ?? null : null));
  const isGlobal = level === 'global';
  const units = ws.units.filter((u) => u.type === (isGlobal ? 'department' : 'country')).sort((a, b) => a.order - b.order);

  const list = useMemo(() => {
    if (!view) return [];
    const q = f.q.toLowerCase();
    const orphanIds = new Set(view.orphans.map((a) => a.id));
    return (isGlobal ? view.globalActs : view.countryActs).filter((a) =>
      (!f.unit || a.unitId === f.unit) && (!f.kr || a.krId === f.kr) && (!f.orphans || orphanIds.has(a.id))
      && (!f.align || (a.alignment ?? 'none') === f.align)
      && (!q || [a.title, a.owner, a.unitObjective, a.finding, a.action, a.subTeam].some((t) => t?.toLowerCase().includes(q))));
  }, [view, f, isGlobal]);

  if (!plan || !view) return <><PageHeader title={isGlobal ? 'Équipes globales' : 'Pays'} /><NoPlan /></>;
  const krCode = (a: Activity) => view.krs.find((k) => k.id === a.krId)?.code ?? '—';
  const byUnit = units.map((u) => ({ u, acts: list.filter((a) => a.unitId === u.id) })).filter((x) => x.acts.length);
  const names = (acts: Activity[]) => [...new Set(acts.map((x) => unit(x.unitId)?.name))].join(', ');

  const doExport = () => exportRows(list.map((a) => ({
    Ref: krCode(a), [isGlobal ? 'Global team' : 'Country']: unit(a.unitId)?.name ?? '', 'Sous-équipe': a.subTeam, Role: a.role ?? 'Team KR',
    'Country/Team Objective': a.unitObjective, 'Key Result / activité': a.title, 'KR Lead': a.owner, Scope: a.scope,
    [isGlobal ? 'Pays rattachés' : 'Soutenu par (équipes globales)']: isGlobal ? names(view.childrenOf.get(a.id) ?? []) : names(view.parentsOf.get(a.id) ?? []) || 'ORPHELIN (non lié au global)',
    'Statut alignement': a.alignment ? ALIGN_LABEL[a.alignment] : '', 'Finding / gap': a.finding, 'Recommended action': a.action,
    'Statut suivi': STATUS_LABEL[a.status], [`Avancement Q${view.quarter}`]: pct(view.activity.get(a.id)?.progress), Commentaire: a.comment,
  })), `${isGlobal ? 'equipes-globales' : 'pays'}-${plan.year}`, 'xlsx');

  return (
    <div className="space-y-4">
      <PageHeader eyebrow={plan.name} title={isGlobal ? 'KR et activités des équipes globales' : 'KR et activités des pays'}
        subtitle={isGlobal
          ? 'Plan global, par équipe (Global Programs, GSE, DHGP, BDAC, Finance, DT, P&C). Un KR d’équipe globale peut ne pas être décliné dans les pays (« Global only ») : c’est normal.'
          : 'Chaque KR / activité pays doit être soutenu par le plan global (une équipe globale avec un KR sous la même Ref). Sinon il est signalé « orphelin, non lié au global ».'}
        actions={<><Button onClick={doExport}>Export Excel</Button><Button variant="primary" onClick={() => setEdit(newActivity(ws, { planId: plan.id, level, unitId: f.unit || units[0]?.id || '' }))}>+ Ajouter</Button></>} />
      {!isGlobal && view.orphans.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#f3c2c8] bg-[#fdecee] px-4 py-3 text-sm text-[#8a1c2b]">
          <OrphanBadge /><b>{view.orphans.length} KR pays orphelin(s)</b> sur {view.alignment.countryActs}.
          <button className="font-semibold underline" onClick={() => setF({ ...f, orphans: !f.orphans })}>{f.orphans ? 'Tout afficher' : 'Afficher seulement les orphelins'}</button>
        </div>
      )}
      <Card>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={inputCls} value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} aria-label="Unité">
            <option value="">{isGlobal ? 'Toutes les équipes globales' : 'Tous les pays'}</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <select className={inputCls} value={f.kr} onChange={(e) => setF({ ...f, kr: e.target.value })} aria-label="Ref">
            <option value="">Toutes les Ref</option>
            {view.krs.map((k) => <option key={k.id} value={k.id}>{k.code} · {k.title.slice(0, 50)}</option>)}
          </select>
          <select className={inputCls} value={f.align} onChange={(e) => setF({ ...f, align: e.target.value })} aria-label="Alignement">
            <option value="">Tous les statuts d’alignement</option>
            {(Object.keys(ALIGN_LABEL) as AlignStatus[]).filter((x) => isGlobal || x !== 'global_only').map((s) => <option key={s} value={s}>{ALIGN_LABEL[s]}</option>)}
            <option value="none">Non analysé</option>
          </select>
          <input className={inputCls} placeholder="Rechercher (KR, Lead, constat…)" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
      </Card>
      <p className="text-sm text-slate-500">{list.length} élément(s)</p>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1200px]">
          <thead>
            <tr>
              <th>Ref</th><th>Role</th><th className="w-[34%]">Key Result / activité</th>
              <th>{isGlobal ? 'Pays rattachés' : 'Soutenu par'}</th>
              <th>Alignement</th><th>KR Lead</th><th>Suivi</th><th>Avancement</th>
            </tr>
          </thead>
          <tbody>
            {byUnit.map(({ u, acts }) => (
              <Fragment key={u.id}>
                <tr className="grp"><td colSpan={8}><b className="mr-2 text-base">{u.name}</b>{u.group && <small className="mr-2 text-[#4a6584]">{u.group}</small>}
                  <small className="text-[#4a6584]">{acts.length} élément(s) · avancement {pct(view.unit.get(u.id)?.progress)}</small></td></tr>
                {acts.map((a) => {
                  const sc = view.activity.get(a.id)!;
                  const rel = isGlobal ? view.childrenOf.get(a.id) ?? [] : view.parentsOf.get(a.id) ?? [];
                  return (
                    <tr key={a.id} className="cursor-pointer hover:bg-[#fafbfc]" onClick={() => setEdit(a)}>
                      <td className="whitespace-nowrap font-semibold text-brand-500">{krCode(a)}</td>
                      <td>{a.role ? <RoleBadge role={a.role} /> : <span className="text-xs text-slate-500">Team KR</span>}</td>
                      <td>
                        {a.subTeam && <div className="text-[11px] font-semibold uppercase text-slate-500">{a.subTeam}</div>}
                        {a.title}
                        {a.finding && <div className="mt-1 text-xs text-slate-600"><b>Constat :</b> {a.finding}</div>}
                        {a.action && <div className="text-xs text-[#9a4a00]"><b>Action :</b> {a.action}</div>}
                      </td>
                      <td className="max-w-[220px]">
                        {rel.length ? <span className="flex flex-wrap gap-1">{[...new Set(rel.map((r) => r.unitId))].map((id) => <UnitChip key={id} name={unit(id)?.name ?? id} type={isGlobal ? 'country' : 'department'} />)}</span>
                          : isGlobal ? <span className="text-xs text-slate-400">aucun pays</span> : <OrphanBadge />}
                      </td>
                      <td><AlignBadge status={a.alignment} /></td>
                      <td className="text-slate-600">{a.owner || '—'}</td>
                      <td><StatusBadge status={a.status} /></td>
                      <td><MiniProgress value={sc.progress} rag={sc.rag} /></td>
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
