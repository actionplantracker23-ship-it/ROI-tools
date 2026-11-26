/** Vue Liste (WBS) : objectifs → projets (KR globaux) → tâches, numérotés, repliables, modifiables dans la liste. */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { Due, FilterBar, isFiltered, PriorityBadge, useFilteredTasks, ViewHeader } from '../components/pm';
import { AlignBadge, Button, MiniProgress, NoPlan, OrphanBadge, UnitChip } from '../components/ui';
import { daysBetween, fmtDate, today } from '../lib/dates';
import { exportRows } from '../lib/export';
import { pct } from '../lib/format';
import { newActivity, newKr, newObjective, updateActivityStatus, upsert } from '../lib/ops';
import { buildWbs } from '../lib/wbs';
import { ALIGN_LABEL, PRIORITY_LABEL, STATUS_LABEL, type Activity, type ActivityStatus } from '../types';
import { t as tr } from '../i18n';

function InlineStatus({ t }: { t: Activity }) {
  const { update } = useApp();
  return (
    <select aria-label={tr("Statut")} value={t.status} onClick={(e) => e.stopPropagation()}
      onChange={(e) => update((w) => updateActivityStatus(w, t.id, { status: e.target.value as ActivityStatus, progress: t.progress, comment: t.comment }), tr("Statut mis à jour."))}
      className="rounded border border-[#c9ced4] bg-white px-1 py-0.5 text-xs">
      {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
    </select>
  );
}

function InlineProgress({ t }: { t: Activity }) {
  const { update } = useApp();
  const [v, setV] = useState(String(t.status === 'done' ? 100 : t.progress));
  const commit = () => {
    const n = Math.max(0, Math.min(100, Number(v) || 0));
    if (n !== t.progress) update((w) => updateActivityStatus(w, t.id, { status: n === 100 ? 'done' : n > 0 && t.status === 'not_started' ? 'in_progress' : t.status, progress: n, comment: t.comment }), tr("Avancement mis à jour."));
  };
  return <input aria-label={tr("Avancement %")} type="number" min={0} max={100} value={v} onClick={(e) => e.stopPropagation()} onChange={(e) => setV(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && commit()} className="w-14 rounded border border-[#c9ced4] px-1 py-0.5 text-right text-xs" />;
}

export default function TaskList() {
  const { ws, plan, view, filter, unit, update } = useApp();
  const tasks = useFilteredTasks();
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Activity | null>(null);
  const shownIds = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const wbs = useMemo(() => (view ? buildWbs(ws, view, (t) => shownIds.has(t.id), isFiltered(filter)) : null), [ws, view, shownIds, filter]);
  if (!plan || !view || !wbs) return <><ViewHeader title={tr("Liste des tâches")} /><NoPlan /></>;
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const hidden = (wbsCode: string) => [...closed].some((c) => wbsCode.startsWith(c + '.'));
  const now = today();

  const doExport = () => exportRows(wbs.rows.map((r) => {
    const t = r.task;
    const deps = t ? (view.parentsOf.get(t.id) ?? []).map((p) => wbs.wbsOf.get(p.id)).join(', ') : '';
    return {
      WBS: r.wbs, [tr("Niveau")]: r.kind === 'objective' ? tr("Objectif") : r.kind === 'project' ? tr("Projet") : tr("Tâche"),
      [tr("Nom")]: r.kind === 'objective' ? r.objective.title : r.kind === 'project' ? `${r.kr!.code} · ${r.kr!.title}` : t!.title,
      [tr("Équipe / pays")]: t ? `${unit(t.unitId)?.name ?? ''}${t.subTeam ? ` (${t.subTeam})` : ''}` : '', [tr("Responsable")]: t?.owner ?? '', [tr("Début")]: r.start, [tr("Échéance")]: r.due,
      [tr("Durée (j)")]: r.start && r.due ? daysBetween(r.start, r.due) + 1 : '', [tr("Statut")]: t ? STATUS_LABEL[t.status] : '', '%': t ? (t.status === 'done' ? 100 : t.progress) : '',
      [tr("Priorité")]: t ? PRIORITY_LABEL[t.priority] : '', [tr("Dépend de")]: t?.level === 'country' ? deps || 'ORPHELINE' : '', [tr("Jalon")]: t?.milestone ? tr("Oui") : '',
      [tr("Alignement")]: t?.alignment ? ALIGN_LABEL[t.alignment] : '', [tr("Avancement consolidé Q{0}", { 0: view.quarter })]: pct(r.kind === 'objective' ? view.objective.get(r.objective.id)?.progress : r.kind === 'project' ? view.kr.get(r.kr!.id)?.progress : view.activity.get(t!.id)?.progress),
    };
  }), `taches-${plan.year}`, 'xlsx');

  return (
    <div>
      <ViewHeader title={tr("Liste des tâches (WBS)")} sub={tr("{0} tâche(s) · objectifs → projets (KR globaux) → tâches des équipes globales puis des pays", { 0: tasks.length })}
        actions={<>
          <Button onClick={() => setClosed(new Set(wbs.rows.filter((r) => r.kind === 'project').map((r) => r.wbs)))}>{tr("Tout replier")}</Button>
          <Button onClick={() => setClosed(new Set())}>{tr("Tout déplier")}</Button>
          <Button onClick={doExport}>{tr("Export Excel")}</Button>
          <Button variant="primary" onClick={() => update((w) => upsert(w, 'objectives', newObjective(w, plan.id, tr("Nouvel objectif"))), tr("Objectif ajouté."))}>{tr("+ Objectif")}</Button>
        </>} />
      <FilterBar />
      <div className="overflow-x-auto rounded-lg border border-ligne bg-white">
        <table className="suivi min-w-[1500px] text-sm">
          <thead>
            <tr>
              <th className="w-16">{tr("WBS")}</th><th className="min-w-[380px]">{tr("Nom")}</th><th>{tr("Équipe / pays")}</th><th>{tr("Responsable")}</th><th>{tr("Début")}</th><th>{tr("Échéance")}</th><th className="text-right">{tr("Jours")}</th>
              <th>{tr("Statut")}</th><th className="text-right">%</th><th>{tr("Priorité")}</th><th>{tr("Dépend de")}</th><th>{tr("Alignement")}</th>
            </tr>
          </thead>
          <tbody>
            {wbs.rows.map((r) => {
              if (hidden(r.wbs)) return null;
              const dur = r.start && r.due ? daysBetween(r.start, r.due) + 1 : null;
              if (r.kind !== 'task') {
                const sc = r.kind === 'objective' ? view.objective.get(r.objective.id)! : view.kr.get(r.kr!.id)!;
                const isObj = r.kind === 'objective';
                return (
                  <tr key={r.wbs} className={isObj ? 'bg-brand-50' : 'bg-[#f7f9fb]'}>
                    <td className="font-semibold text-brand-500">{r.wbs}</td>
                    <td colSpan={2} className="min-w-[380px]" style={{ paddingLeft: 12 + r.depth * 16 }} title={isObj ? r.objective.title : r.kr!.title}>
                      <button className="mr-1.5 text-slate-400" onClick={() => toggle(r.wbs)} aria-label={closed.has(r.wbs) ? tr("Déplier") : tr("Replier")}>{closed.has(r.wbs) ? '▸' : '▾'}</button>
                      {isObj ? <b className="inline text-[16px]" style={{ color: r.objective.color }}>{tr("Objectif")} {r.objective.code} · <span className="text-brand-600">{r.objective.title}</span></b>
                        : <b className="inline text-brand-600"><span className="text-accent">{r.kr!.code}</span> · {r.kr!.title}</b>}
                    </td>
                    <td />
                    <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(r.start)}</td>
                    <td className="whitespace-nowrap text-xs font-semibold">{fmtDate(r.due)}</td>
                    <td className="text-right text-xs text-slate-500">{dur ?? ''}</td>
                    <td colSpan={3}><MiniProgress value={sc.progress} rag={sc.rag} /></td>
                    <td colSpan={2}>
                      {r.kind === 'project' && <button className="text-xs font-semibold text-brand-500 hover:text-accent" onClick={() => setEdit(newActivity(ws, { planId: plan.id, level: 'global', unitId: ws.units.find((u) => u.type === 'department')?.id ?? '', krId: r.kr!.id }))}>{tr("+ tâche")}</button>}
                      {isObj && <button className="text-xs font-semibold text-brand-500 hover:text-accent" onClick={() => update((w) => upsert(w, 'krs', newKr(w, plan.id, r.objective, tr("Nouveau projet"))), tr("Projet ajouté."))}>{tr("+ projet")}</button>}
                    </td>
                  </tr>
                );
              }
              const t = r.task!;
              const u = unit(t.unitId);
              const deps = view.parentsOf.get(t.id) ?? [];
              const late = t.status === 'late' || (t.dueDate < now && t.status !== 'done' && t.status !== 'cancelled');
              return (
                <tr key={t.id} className={`cursor-pointer hover:bg-[#fafbfc] ${late ? 'bg-[#fff7f7]' : ''}`} onClick={() => setEdit(t)}>
                  <td className="text-xs text-slate-500">{r.wbs}</td>
                  <td className="min-w-[380px]" style={{ paddingLeft: 12 + r.depth * 16 }}><span className="leading-snug">{t.title}</span></td>
                  <td>{u && <UnitChip name={u.name + (t.subTeam ? ` (${t.subTeam})` : '')} type={u.type} />}</td>
                  <td className="text-xs text-slate-600">{t.owner || '—'}</td>
                  <td className="whitespace-nowrap text-xs text-slate-500">{fmtDate(t.startDate)}</td>
                  <td className="text-xs"><Due t={t} /></td>
                  <td className="text-right text-xs text-slate-500">{dur}</td>
                  <td><InlineStatus t={t} /></td>
                  <td className="text-right"><InlineProgress key={`${t.id}-${t.progress}-${t.status}`} t={t} /></td>
                  <td><PriorityBadge p={t.priority} /></td>
                  <td className="text-xs">{t.level === 'country' ? (deps.length ? <span title={deps.map((d) => `${wbs.wbsOf.get(d.id)} ${unit(d.unitId)?.name}`).join('\n')}>{deps.map((d) => wbs.wbsOf.get(d.id)).join(', ')}</span> : <OrphanBadge />) : <span className="text-slate-400">—</span>}</td>
                  <td><AlignBadge status={t.alignment} /></td>
                </tr>
              );
            })}
            {!wbs.rows.length && <tr><td colSpan={12} className="py-8 text-center text-slate-500">{tr("Aucune tâche. Ajoutez un objectif, ou importez le fichier OKR (Import Excel).")}</td></tr>}
          </tbody>
        </table>
      </div>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
