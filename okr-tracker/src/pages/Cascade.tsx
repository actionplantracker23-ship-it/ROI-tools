/**
 * Plan de travail global (cascade) :
 *   Objectif global → KR global → départements globaux (Lead / Contributes)
 *                                → pays dont les KR concourent au KR global et répondent à un département.
 * En tête : matrice Départements × Pays (nombre de KR pays rattachés à chaque département et avancement moyen).
 */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../AppContext';
import { MiniProgress } from '../components/Okr';
import { Card, inputCls, NoData, PageHeader, ProgressBar, RAG_HEX, RagBadge, RoleBadge } from '../components/ui';
import { pct } from '../lib/format';
import { mean, ragOf } from '../lib/progress';
import type { Contribution } from '../types';

export default function Cascade() {
  const { ds, idx, computed, quarter } = useApp();
  const [dep, setDep] = useState('');
  const [obj, setObj] = useState('');
  const departments = ds.entities.filter((e) => e.type === 'GlobalTeam');
  const countries = ds.entities.filter((e) => e.type === 'Country');

  // matrice départements × pays
  const matrix = useMemo(() => departments.map((d) => ({
    d,
    cells: countries.map((c) => {
      const krs = (idx.krByDepartment.get(d.id) ?? []).filter((k) => k.entityId === c.id);
      const p = mean(krs.map((k) => computed.entityKr.get(k.id)?.progress));
      const late = krs.reduce((a, k) => a + (computed.entityKr.get(k.id)?.late ?? 0), 0);
      return { c, n: krs.length, p, rag: ragOf(p, late, ds.settings) };
    }),
  })), [departments, countries, idx, computed, ds.settings]);

  if (!ds.globalKrs.length) return <><PageHeader title="Plan global" /><NoData /></>;

  const keep = (c: Contribution) => {
    if (!dep) return true;
    const e = idx.entity.get(c.entityId);
    return e?.type === 'GlobalTeam' ? c.entityId === dep : idx.kr.get(c.entityKrId)?.departmentId === dep;
  };

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<>Plan de travail global · <span className="text-accent">Q{quarter}</span></>} title="Cascade : du global aux pays"
        subtitle="Les départements globaux portent le plan ; chaque équipe pays répond à un département, et ses KR concourent aux KR globaux. Cliquez sur un KR pour ouvrir son plan." />

      <Card title="Départements globaux × Pays" action={<span className="text-xs text-slate-500">nombre de KR pays rattachés · avancement moyen</span>}>
        <div className="-mx-5 overflow-x-auto px-5">
          <table className="w-full min-w-[640px] border-separate border-spacing-0.5 text-sm">
            <thead>
              <tr>
                <th className="rounded-l bg-brand-600 px-2 py-2.5 text-left font-normal text-white">Département</th>
                {countries.map((c) => <th key={c.id} className="bg-brand-600 px-2 py-2.5 font-normal text-white"><Link to={`/pays/${c.id}`} className="hover:text-accent">{c.name}</Link></th>)}
                <th className="rounded-r bg-brand-500 px-2 py-2.5 font-normal text-white">Département</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map(({ d, cells }) => {
                const own = computed.entity.get(d.id)!;
                return (
                  <tr key={d.id}>
                    <th className="whitespace-nowrap px-2 py-1.5 text-left">
                      <button onClick={() => setDep(dep === d.id ? '' : d.id)} className={`font-semibold hover:text-accent ${dep === d.id ? 'text-accent' : 'text-brand-500'}`}>{d.name}</button>
                      {d.group && <span className="ml-1 text-[11px] font-normal text-slate-400">{d.group}</span>}
                    </th>
                    {cells.map(({ c, n, p, rag }) => (
                      <td key={c.id} className="h-10 rounded text-center" style={{ background: n ? RAG_HEX[rag] : '#f4f5f7', color: n && rag !== 'none' && rag !== 'amber' ? '#fff' : '#1d2327' }}
                        title={`${c.name} → ${d.name} : ${n} KR · ${pct(p)}`}>
                        {n ? <><b>{n}</b> <span className="text-xs opacity-90">KR · {pct(p)}</span></> : <span className="text-slate-300">·</span>}
                      </td>
                    ))}
                    <td className="px-2 text-center"><RagBadge rag={own.rag} score={own.progress} compact /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="grid gap-2 sm:grid-cols-2">
          <select className={inputCls} value={dep} onChange={(e) => setDep(e.target.value)} aria-label="Département">
            <option value="">Tous les départements</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}{d.group ? ` (${d.group})` : ''}</option>)}
          </select>
          <select className={inputCls} value={obj} onChange={(e) => setObj(e.target.value)} aria-label="Objectif">
            <option value="">Tous les objectifs</option>
            {ds.globalObjectives.map((o) => <option key={o.id} value={o.id}>Objective {o.id.slice(1)} · {o.title.slice(0, 60)}</option>)}
          </select>
        </div>
      </Card>

      {ds.globalObjectives.filter((o) => !obj || o.id === obj).map((o) => {
        const os = computed.globalObjective.get(o.id)!;
        const gks = ds.globalKrs.filter((g) => g.objectiveId === o.id && (idx.linksByGlobal.get(g.id) ?? []).some(keep));
        if (!gks.length) return null;
        return (
          <section key={o.id} className="rounded-md border border-ligne bg-white px-4 py-5 sm:px-7">
            <div className="m-entete font-serif"><span>Objective {o.id.slice(1)}</span><span className="text-accent">{pct(os.progress)}</span></div>
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <div className="font-titre text-[52px] font-bold leading-none" style={{ color: o.color }}>{o.id}</div>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[21px] font-bold leading-tight text-brand-500">{o.title}</h2>
                <div className="mt-2 max-w-md"><ProgressBar value={os.progress} rag={os.rag} /></div>
              </div>
              <RagBadge rag={os.rag} />
            </div>
            <div className="space-y-4">
              {gks.map((g) => {
                const gs = computed.globalKr.get(g.id)!;
                const links = (idx.linksByGlobal.get(g.id) ?? []).filter(keep);
                const deptLinks = links.filter((c) => idx.entity.get(c.entityId)?.type === 'GlobalTeam');
                const countryLinks = links.filter((c) => idx.entity.get(c.entityId)?.type === 'Country');
                const line = (c: Contribution, country: boolean) => {
                  const k = idx.kr.get(c.entityKrId)!;
                  const e = idx.entity.get(c.entityId)!;
                  const s = computed.entityKr.get(k.id)!;
                  const nInd = idx.indByKr.get(k.id)?.length ?? 0;
                  const d = k.departmentId ? idx.entity.get(k.departmentId) : null;
                  return (
                    <li key={c.id} className="border-t border-[#4FB3E3]/50 py-2 first:border-t-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <b className="text-[#1d2327]">{e.name}</b><RoleBadge role={c.role} />
                        {country && <span className="text-xs text-slate-500">→ répond à <b className={d ? 'text-brand-500' : 'text-rag-red'}>{d?.name ?? 'à rattacher'}</b></span>}
                        <span className="ml-auto"><MiniProgress value={s.progress} rag={s.rag} /></span>
                      </div>
                      <Link to={`${country ? '/pays/' : '/equipe/'}${e.id}?kr=${encodeURIComponent(k.id)}`} className="mt-0.5 block text-sm text-slate-700 hover:text-accent">{k.title}</Link>
                      <div className="text-[11px] text-slate-500">KR Lead : {k.lead || '—'} · {nInd ? `${nInd} indicateur(s)` : <span className="font-semibold text-[#9a4a00]">aucun indicateur</span>}</div>
                    </li>
                  );
                };
                return (
                  <article key={g.id} className="rounded-md border border-[#DCE3EA]">
                    <header className="flex flex-wrap items-center gap-3 border-b border-[#DCE3EA] bg-[#f5f8fb] px-4 py-2.5">
                      <Link to={`/kr/${encodeURIComponent(g.id)}`} className="font-titre text-xl font-semibold text-accent hover:underline">{g.id}</Link>
                      <span className="min-w-0 flex-1 text-[15px] font-semibold text-brand-500">{g.title}</span>
                      <MiniProgress value={gs.progress} rag={gs.rag} />
                    </header>
                    <div className="grid gap-x-6 px-4 py-2 md:grid-cols-2">
                      <div>
                        <h4 className="mt-1 text-xs font-bold uppercase tracking-wide text-brand-500">Départements globaux</h4>
                        <ul>{deptLinks.length ? deptLinks.map((c) => line(c, false)) : <li className="py-2 text-sm text-slate-400">Aucun département lié</li>}</ul>
                      </div>
                      <div>
                        <h4 className="mt-1 text-xs font-bold uppercase tracking-wide text-brand-500">Pays qui concourent</h4>
                        <ul>{countryLinks.length ? countryLinks.map((c) => line(c, true)) : <li className="py-2 text-sm text-slate-400">Aucun pays lié</li>}</ul>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
