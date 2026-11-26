/** Diagramme de Gantt : objectifs, projets (KR) et tâches sur l'année ; jalons, aujourd'hui, retards, avancement. */
import { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { FilterBar, isFiltered, isOverdue, useFilteredTasks, ViewHeader } from '../components/pm';
import { Flag } from '../components/Flag';
import { NoPlan, STATUS_HEX } from '../components/ui';
import { fmtDate, iso, today } from '../lib/dates';
import { pct } from '../lib/format';
import { buildWbs } from '../lib/wbs';
import { STATUS_LABEL, type Activity } from '../types';
import { getLang, t as tr } from '../i18n';

const ZOOM = { semaine: 9, mois: 3, trimestre: 1.6 } as const;
const MONTHS_FR = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONTHS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const BAR: Record<string, string> = STATUS_HEX;
const LEFT = 400;

export default function Gantt() {
  const { ws, plan, view, filter, unit } = useApp();
  const tasks = useFilteredTasks();
  const [zoom, setZoom] = useState<keyof typeof ZOOM>('mois');
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<Activity | null>(null);
  const shown = useMemo(() => new Set(tasks.map((t) => t.id)), [tasks]);
  const wbs = useMemo(() => (view ? buildWbs(ws, view, (t) => shown.has(t.id), isFiltered(filter)) : null), [ws, view, shown, filter]);
  if (!plan || !view || !wbs) return <><ViewHeader title={tr("Gantt")} /><NoPlan /></>;

  const dates = view.activities.flatMap((a) => [a.startDate, a.dueDate]).filter(Boolean).sort();
  const start = [iso(plan.year, 1, 1), dates[0] ?? ''].filter(Boolean).sort()[0];
  const end = [iso(plan.year, 12, 31), dates.at(-1) ?? ''].sort().at(-1)!;
  const day = (d: string) => (Date.parse(d) - Date.parse(start)) / 86_400_000;
  const px = ZOOM[zoom];
  const MONTHS = getLang() === 'en' ? MONTHS_EN : MONTHS_FR;
  const width = Math.ceil((day(end) + 1) * px);
  const months: { label: string; x: number; w: number }[] = [];
  for (let y = Number(start.slice(0, 4)), m = Number(start.slice(5, 7)); iso(y, m, 1) <= end; m === 12 ? (y++, m = 1) : m++) {
    const s = iso(y, m, 1);
    const e = m === 12 ? iso(y + 1, 1, 1) : iso(y, m + 1, 1);
    months.push({ label: `${MONTHS[m - 1]}${m === 1 || !months.length ? ` ${y}` : ''}`, x: Math.max(0, day(s)) * px, w: (day(e) - Math.max(0, day(s))) * px });
  }
  const now = today();
  const todayX = now >= start && now <= end ? day(now) * px : null;
  const toggle = (k: string) => setClosed((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const hidden = (c: string) => [...closed].some((x) => c.startsWith(x + '.'));

  return (
    <div>
      <ViewHeader title={tr("Diagramme de Gantt")} sub={tr("Plan {0} · {1} tâche(s) · cliquez une barre pour modifier dates, statut et avancement", { 0: plan.year, 1: tasks.length })} />
      <FilterBar extra={<>
        <span className="text-xs text-slate-500">{tr("Échelle :")}</span>
        {(Object.keys(ZOOM) as (keyof typeof ZOOM)[]).map((z) => (
          <button key={z} onClick={() => setZoom(z)} className={`rounded-md border px-2.5 py-1 text-xs ${zoom === z ? 'border-brand-600 bg-brand-600 text-white' : 'border-[#c9ced4] bg-white'}`}>{z}</button>
        ))}
      </>} />
      <div className="mb-2 flex flex-wrap gap-3 text-xs text-slate-600">
        {Object.entries(BAR).map(([k, c]) => <span key={k} className="inline-flex items-center gap-1"><span className="h-3 w-5 rounded-sm" style={{ background: c }} />{STATUS_LABEL[k as Activity['status']]}</span>)}
        <span className="inline-flex items-center gap-1"><span className="text-accent">◆</span> {tr("Jalon")}</span>
        <span className="inline-flex items-center gap-1"><span className="h-3 w-0.5 bg-accent" /> {tr("Aujourd’hui")}</span>
        <span>{tr("Partie foncée de la barre = % réalisé")}</span>
      </div>
      <div className="max-h-[75vh] overflow-auto rounded-2xl border border-[#e5e8ec] bg-white">
        <div style={{ width: LEFT + width }} className="relative">
          {/* en-tête des mois */}
          <div className="sticky top-0 z-20 flex border-b border-[#e5e8ec] bg-[#f7f9fb] text-[14px] uppercase tracking-[.06em] text-[#6D6E71]">
            <div className="sticky left-0 z-30 shrink-0 bg-[#f7f9fb] px-3 py-2 font-semibold" style={{ width: LEFT }}>{tr("Tâche")}</div>
            <div className="relative h-8" style={{ width }}>
              {months.map((m) => <div key={m.x} className="absolute top-0 h-full border-l border-[#e5e8ec] px-1.5 pt-2" style={{ left: m.x, width: m.w }}>{m.w > 30 ? m.label : ''}</div>)}
            </div>
          </div>
          {wbs.rows.map((r) => {
            if (hidden(r.wbs)) return null;
            const t = r.task;
            const s = r.start || start;
            const e = r.due || s;
            const x = Math.max(0, day(s)) * px;
            const w = Math.max(px, (day(e) - Math.max(0, day(s)) + 1) * px);
            const summary = r.kind !== 'task';
            const prog = t ? (t.status === 'done' ? 100 : t.progress) : summary ? (r.kind === 'objective' ? view.objective.get(r.objective.id)?.progress : view.kr.get(r.kr!.id)?.progress) ?? 0 : 0;
            const milestone = t && (t.milestone || t.startDate === t.dueDate);
            const late = t && isOverdue(t, now);
            const label = r.kind === 'objective' ? tr("Objectif {0} · {1}", { 0: r.objective.code, 1: r.objective.title }) : r.kind === 'project' ? `${r.kr!.code} · ${r.kr!.title}` : t!.title;
            return (
              <div key={r.wbs} className={`flex border-b border-[#eef1f4] ${r.kind === 'objective' ? 'bg-[#ffffff]' : r.kind === 'project' ? 'bg-[#f7f9fb]' : 'bg-white hover:bg-[#f7f9fb]'}`} style={{ height: r.kind === 'task' ? 34 : 30 }}>
                <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 overflow-hidden border-r border-ligne bg-inherit px-2 text-xs" style={{ width: LEFT, paddingLeft: 8 + r.depth * 14, background: 'inherit' }}>
                  {summary && <button onClick={() => toggle(r.wbs)} className="text-slate-400" aria-label={tr("Replier ou déplier")}>{closed.has(r.wbs) ? '▸' : '▾'}</button>}
                  <span className="shrink-0 text-slate-400">{r.wbs}</span>
                  {t && (unit(t.unitId)?.type === 'country' ? <Flag country={t.unitId} size={18} /> : <span className="shrink-0 rounded bg-slate-100 px-1 text-[13.5px] font-semibold text-slate-600">{unit(t.unitId)?.name}</span>)}
                  <button className={`truncate text-left ${summary ? 'font-semibold text-brand-600' : 'text-[#1d2327] hover:text-accent'}`} title={label} onClick={() => t && setEdit(t)}>{label}</button>
                </div>
                <div className="relative" style={{ width }}>
                  {months.map((m) => <div key={m.x} className="absolute top-0 h-full border-l border-[#eef0f3]" style={{ left: m.x }} />)}
                  {todayX !== null && <div className="absolute top-0 z-[5] h-full w-0.5 bg-accent/80" style={{ left: todayX }} />}
                  {summary ? (
                    <div className="absolute top-[11px] h-2 rounded-sm bg-brand-600" style={{ left: x, width: w }} title={`${fmtDate(s)} → ${fmtDate(e)} · ${pct(prog)}`}>
                      <div className="h-full rounded-sm bg-accent" style={{ width: `${Math.max(0, Math.min(100, prog ?? 0))}%` }} />
                    </div>
                  ) : milestone ? (
                    <button onClick={() => setEdit(t!)} className="absolute top-[7px] z-[6] h-4 w-4 rotate-45 border-2 border-white shadow" style={{ left: x + w - 8, background: late ? '#d64545' : t!.status === 'done' ? '#2e9e4f' : '#F7941D' }}
                      title={tr("Jalon · {0} · {1}\n{2}", { 0: fmtDate(e), 1: STATUS_LABEL[t!.status], 2: t!.title })} aria-label={tr("Jalon {0}", { 0: t!.title })} />
                  ) : (
                    <button onClick={() => setEdit(t!)} className={`absolute top-[8px] h-[18px] overflow-hidden rounded ${late ? 'ring-2 ring-rag-red' : ''}`}
                      style={{ left: x, width: w, background: `${BAR[t!.status]}66` }}
                      title={`${t!.title}\n${unit(t!.unitId)?.name} · ${t!.owner || tr("sans responsable")}\n${fmtDate(s)} → ${fmtDate(e)} · ${STATUS_LABEL[t!.status]} · ${prog} %${late ? tr("\nÉCHÉANCE DÉPASSÉE") : ''}`}>
                      <span className="block h-full" style={{ width: `${prog}%`, background: BAR[t!.status] }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
