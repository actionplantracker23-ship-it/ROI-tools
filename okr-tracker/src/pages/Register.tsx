import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { Button, Card, inputCls, NoData, PageHeader, RoleBadge } from '../components/ui';
import { exportRows } from '../lib/export';
import { entityPath } from '../lib/format';

type Col = 'objective' | 'ref' | 'globalKr' | 'entity' | 'role' | 'entityObjective' | 'entityKr' | 'lead' | 'scope';
const COLS: [Col, string][] = [
  ['objective', 'Objectif'], ['ref', 'Ref'], ['globalKr', 'KR global'], ['entity', 'Pays/Équipe'], ['role', 'Rôle'],
  ['entityObjective', 'Objectif pays/équipe'], ['entityKr', 'KR pays/équipe'], ['lead', 'KR Lead'], ['scope', 'Scope'],
];

/** Équivalent de l'onglet "1 OKR Register" : filtrable, triable, exportable. */
export default function Register() {
  const { ds } = useApp();
  const [f, setF] = useState({ objective: '', entity: '', role: '', scope: '', q: '' });
  const [sort, setSort] = useState<{ col: Col; asc: boolean }>({ col: 'ref', asc: true });

  const rows = useMemo(() => ds.contributions.map((c) => {
    const g = ds.globalKrs.find((x) => x.id === c.globalKrId)!;
    const o = ds.globalObjectives.find((x) => x.id === g?.objectiveId);
    const k = ds.entityKrs.find((x) => x.id === c.entityKrId)!;
    const e = ds.entities.find((x) => x.id === c.entityId)!;
    return {
      c, e, o,
      objective: o ? `${o.id} · ${o.title}` : '', ref: c.globalKrId, globalKr: g?.title ?? '', entity: e?.name ?? '', role: c.role,
      entityObjective: ds.entityObjectives.find((x) => x.id === k?.objectiveId)?.title ?? '', entityKr: k?.title ?? '', lead: k?.lead ?? '', scope: c.scope,
    };
  }), [ds]);

  const refKey = (r: string) => r.slice(2).split('.').map((n) => n.padStart(3, '0')).join('.');
  const filtered = rows.filter((r) =>
    (!f.objective || r.o?.id === f.objective) && (!f.entity || r.e?.id === f.entity) && (!f.role || r.role === f.role) && (!f.scope || r.scope === f.scope) &&
    (!f.q || [r.globalKr, r.entityKr, r.lead, r.entityObjective].some((t) => t.toLowerCase().includes(f.q.toLowerCase()))),
  ).sort((a, b) => {
    const va = sort.col === 'ref' ? refKey(a.ref) : String(a[sort.col]);
    const vb = sort.col === 'ref' ? refKey(b.ref) : String(b[sort.col]);
    return (sort.asc ? 1 : -1) * va.localeCompare(vb, 'fr');
  });

  const doExport = (format: 'xlsx' | 'csv') => exportRows(filtered.map((r) => Object.fromEntries(COLS.map(([k, label]) => [label, r[k]]))), 'OKR-Register-2027', format);
  if (!ds.globalKrs.length) return <><PageHeader title="Registre OKR" /><NoData /></>;

  return (
    <div className="space-y-4">
      <PageHeader title="Registre OKR" subtitle={`${filtered.length} lien(s) sur ${rows.length} · KR global ↔ KR pays/équipe`}
        actions={<><Button onClick={() => doExport('xlsx')}>Export Excel</Button><Button onClick={() => doExport('csv')}>Export CSV</Button></>} />
      <Card>
        <div className="grid gap-2 sm:grid-cols-5">
          <select className={inputCls} value={f.objective} onChange={(e) => setF({ ...f, objective: e.target.value })} aria-label="Objectif">
            <option value="">Tous les objectifs</option>
            {ds.globalObjectives.map((o) => <option key={o.id} value={o.id}>{o.id} · {o.title.slice(0, 50)}</option>)}
          </select>
          <select className={inputCls} value={f.entity} onChange={(e) => setF({ ...f, entity: e.target.value })} aria-label="Pays/Équipe">
            <option value="">Tous pays/équipes</option>
            {ds.entities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} aria-label="Rôle">
            <option value="">Lead et Contributes</option><option value="Lead">Lead</option><option value="Contributes">Contributes</option>
          </select>
          <select className={inputCls} value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} aria-label="Scope">
            <option value="">Pays et Global</option><option value="Pays">Pays</option><option value="Global">Global</option>
          </select>
          <input className={inputCls} placeholder="Rechercher…" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
        </div>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-[1000px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              {COLS.map(([k, label]) => (
                <th key={k} className="cursor-pointer select-none px-3 py-2 font-semibold" onClick={() => setSort({ col: k, asc: sort.col === k ? !sort.asc : true })}>
                  {label}{sort.col === k ? (sort.asc ? ' ↑' : ' ↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.c.id} className="align-top hover:bg-slate-50">
                <td className="px-3 py-2 text-xs"><span className="font-semibold" style={{ color: r.o?.color }}>{r.o?.id}</span></td>
                <td className="px-3 py-2 font-semibold"><Link className="hover:text-brand-700" to={`/kr/${encodeURIComponent(r.ref)}`}>{r.ref}</Link></td>
                <td className="max-w-xs px-3 py-2 text-slate-600">{r.globalKr}</td>
                <td className="px-3 py-2"><Link className="font-medium text-brand-700 hover:underline" to={entityPath(r.e)}>{r.entity}</Link></td>
                <td className="px-3 py-2"><RoleBadge role={r.c.role} />{r.c.inferred && <span className="ml-1 text-[10px] text-slate-400" title="Absent du registre, déduit de la colonne Ref de l'onglet">déduit</span>}</td>
                <td className="max-w-xs px-3 py-2 text-slate-600">{r.entityObjective}</td>
                <td className="max-w-sm px-3 py-2">{r.entityKr}</td>
                <td className="px-3 py-2 text-slate-600">{r.lead}</td>
                <td className="px-3 py-2 text-slate-600">{r.scope}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
