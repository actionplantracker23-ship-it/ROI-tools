/**
 * Registre OKR, au format de l'onglet « 1 OKR Register » :
 *   Ref | Global Key Result | Country / Team | Role | Country/Team Objective | Country/Team Key Result | KR Lead | Scope | Go to plan
 * avec les lignes de section « OBJECTIVE X · … », suivies des colonnes de suivi
 * (département de rattachement, indicateurs, avancement du trimestre). Filtrable et exportable.
 */
import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { MiniProgress } from '../components/Okr';
import { Button, Card, inputCls, NoData, PageHeader, RagBadge, RoleBadge } from '../components/ui';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import type { Contribution, Entity, EntityKR, GlobalKR, GlobalObjective } from '../types';

interface Row {
  c: Contribution; e: Entity; k: EntityKR; g: GlobalKR; o: GlobalObjective | undefined;
  objective: string; dept: string; plan: string;
}

const refKey = (r: string) => r.slice(2).split('.').map((n) => n.padStart(3, '0')).join('.');

export default function Register() {
  const { ds, idx, computed, quarter } = useApp();
  const [f, setF] = useState({ objective: '', entity: '', type: '', role: '', scope: '', q: '' });

  const rows = useMemo<Row[]>(() => ds.contributions.map((c) => {
    const g = idx.globalKr.get(c.globalKrId)!;
    const k = idx.kr.get(c.entityKrId)!;
    const e = idx.entity.get(c.entityId)!;
    return {
      c, e, k, g, o: ds.globalObjectives.find((x) => x.id === g?.objectiveId),
      objective: ds.entityObjectives.find((x) => x.id === k?.objectiveId)?.title ?? '',
      dept: k?.departmentId ? idx.entity.get(k.departmentId)?.name ?? '' : '',
      plan: e?.sheet ?? e?.name ?? '',
    };
  }).filter((r) => r.g && r.k && r.e)
    // ordre du registre : KR global, puis Lead avant Contributes, départements avant pays
    .sort((a, b) => refKey(a.c.globalKrId).localeCompare(refKey(b.c.globalKrId))
      || (a.c.role === b.c.role ? 0 : a.c.role === 'Lead' ? -1 : 1)
      || (a.e.type === b.e.type ? 0 : a.e.type === 'GlobalTeam' ? -1 : 1)
      || a.e.name.localeCompare(b.e.name)), [ds, idx]);

  const q = f.q.toLowerCase();
  const filtered = rows.filter((r) =>
    (!f.objective || r.o?.id === f.objective) && (!f.entity || r.e.id === f.entity) && (!f.type || r.e.type === f.type)
    && (!f.role || r.c.role === f.role) && (!f.scope || r.c.scope === f.scope)
    && (!q || [r.g.title, r.k.title, r.k.lead, r.objective, r.dept].some((t) => t.toLowerCase().includes(q))));

  const doExport = (format: 'xlsx' | 'csv') => {
    const out: Record<string, unknown>[] = [];
    filtered.forEach((r, n) => {
      if (filtered[n - 1]?.o?.id !== r.o?.id) out.push({ Ref: `OBJECTIVE ${r.o?.id.slice(1)}  ·  ${r.o?.title ?? ''}` });
      const inds = idx.indByKr.get(r.k.id) ?? [];
      out.push({
        Ref: r.c.globalKrId, 'Global Key Result': r.g.title, 'Country / Team': r.e.name, Role: r.c.role,
        'Country/Team Objective': r.objective, 'Country/Team Key Result': r.k.title, 'KR Lead': r.k.lead, Scope: r.c.scope, 'Go to plan': r.plan,
        'Répond à (département)': r.dept, Indicateurs: inds.map((i) => i.name).join(' | '),
        [`Avancement Q${quarter}`]: pct(computed.entityKr.get(r.k.id)?.progress),
      });
    });
    exportRows(out, `OKR-Register-2027-Q${quarter}`, format);
  };

  if (!ds.globalKrs.length) return <><PageHeader title="Registre OKR" /><NoData /></>;
  const nCols = 12;

  return (
    <div className="space-y-4">
      <PageHeader eyebrow="1 OKR Register" title="Registre OKR 2027" subtitle={`${filtered.length} ligne(s) sur ${rows.length} · chaque ligne relie un KR global à un KR de département ou de pays`}
        actions={<><Button onClick={() => doExport('xlsx')}>Export Excel</Button><Button onClick={() => doExport('csv')}>Export CSV</Button></>} />
      <Card>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <select className={inputCls} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} aria-label="Objectif">
            <option value="">Tous les objectifs</option>
            {ds.globalObjectives.map((o) => <option key={o.id} value={o.id}>Objective {o.id.slice(1)} · {o.title.slice(0, 40)}</option>)}
          </select>
          <select className={inputCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value, entity: '' })} aria-label="Type">
            <option value="">Départements et pays</option><option value="GlobalTeam">Départements globaux</option><option value="Country">Pays</option>
          </select>
          <select className={inputCls} value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })} aria-label="Country / Team">
            <option value="">Tous (Country / Team)</option>
            {ds.entities.filter((e) => !f.type || e.type === f.type).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Role">
            <option value="">Lead et Contributes</option><option value="Lead">Lead</option><option value="Contributes">Contributes</option>
          </select>
          <select className={inputCls} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} aria-label="Scope">
            <option value="">Tous scopes</option><option value="Pays">Pays</option><option value="Global">Global</option>
          </select>
          <input className={inputCls} placeholder="Rechercher…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
      </Card>
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1400px]">
          <thead>
            <tr>
              <th>Ref</th><th>Global Key Result</th><th>Country / Team</th><th>Role</th><th>Country/Team Objective</th>
              <th>Country/Team Key Result</th><th>KR Lead</th><th>Scope</th><th>Go to plan</th>
              <th className="!bg-brand-500">Répond à</th><th className="!bg-brand-500">Indicateurs</th><th className="!bg-brand-500">Avancement Q{quarter}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, n) => {
              const s = computed.entityKr.get(r.k.id)!;
              const inds = idx.indByKr.get(r.k.id) ?? [];
              const filled = inds.filter((i) => computed.indicator.get(i.id)?.valueQuarter === quarter).length;
              const newObj = filtered[n - 1]?.o?.id !== r.o?.id;
              const newRef = filtered[n - 1]?.c.globalKrId !== r.c.globalKrId;
              const plan = `${r.e.type === 'Country' ? '/pays/' : '/equipe/'}${r.e.id}?kr=${encodeURIComponent(r.k.id)}`;
              return (
                <Fragment key={r.c.id}>
                  {newObj && r.o && (
                    <tr className="grp"><td colSpan={nCols} className="!py-2.5 font-titre text-[15px] uppercase tracking-wide">
                      <span style={{ color: r.o.color }}>■</span> Objective {r.o.id.slice(1)} <span className="mx-1 text-accent">·</span> <span className="normal-case">{r.o.title}</span>
                    </td></tr>
                  )}
                  <tr className={`hover:bg-[#fafbfc] ${newRef && !newObj ? 'border-t-2 border-t-[#dce3ea]' : ''}`}>
                    <td className="whitespace-nowrap font-bold text-brand-500">{newRef ? <Link to={`/kr/${encodeURIComponent(r.c.globalKrId)}`} className="hover:text-accent">{r.c.globalKrId}</Link> : ''}</td>
                    <td className="max-w-[240px] text-slate-600">{newRef ? r.g.title : ''}</td>
                    <td className="whitespace-nowrap font-semibold">{r.e.name}{r.e.group && <div className="text-[11px] font-normal text-slate-400">{r.e.group}</div>}</td>
                    <td><RoleBadge role={r.c.role} />{r.c.inferred && <div className="text-[10px] text-slate-400" title="Absent du registre, déduit de la colonne Ref de l'onglet">déduit</div>}</td>
                    <td className="max-w-[200px] text-slate-600">{r.objective}</td>
                    <td className="max-w-[280px]">{r.k.title}</td>
                    <td className="text-slate-600">{r.k.lead}</td>
                    <td className="text-slate-600">{r.c.scope}</td>
                    <td><Link to={plan} className="whitespace-nowrap font-semibold text-brand-500 hover:text-accent">{r.plan} →</Link></td>
                    <td className="whitespace-nowrap">{r.e.type === 'Country' ? (r.dept || <span className="text-rag-red">à rattacher</span>) : <span className="text-slate-400">—</span>}</td>
                    <td className="whitespace-nowrap text-xs">{inds.length ? <><b>{filled}</b>/{inds.length} saisis Q{quarter}</> : <span className="font-semibold text-[#9a4a00]">aucun</span>}</td>
                    <td className="whitespace-nowrap">{s.progress === null ? <RagBadge rag="none" /> : <MiniProgress value={s.progress} rag={s.rag} />}</td>
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
