/**
 * Tableau principal du plan de travail, présenté par objectif, au format « tableau de gestion du travail » :
 * un groupe par projet (KR), cellules Statut et Priorité pleines et modifiables, responsable (initiales),
 * échéance, échéancier, synthèse des statuts en pied de groupe. Palette Living Goods.
 */
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor } from '../components/Editors';
import { FilterBar, isFiltered, isOverdue, useFilteredTasks } from '../components/pm';
import { Flag } from '../components/Flag';
import { NoPlan, PRIORITY_HEX, STATUS_HEX } from '../components/ui';
import { fmtDate, today } from '../lib/dates';
import { pct } from '../lib/format';
import { newActivity, newObjective, updateActivityStatus, upsert } from '../lib/ops';
import { PRIORITY_LABEL, STATUS_LABEL, type Activity, type ActivityStatus, type KeyResult, type Priority } from '../types';

/** Couleurs des groupes (palette Living Goods). */
const GROUP = ['#004D84', '#F7941D', '#4FB3E3', '#6D6E71', '#2F80C0', '#C9700F'];
const COLS = 'grid-cols-[minmax(340px,1fr),96px,150px,150px,130px,124px,170px]';
const STATUS_ORDER: ActivityStatus[] = ['done', 'in_progress', 'late', 'not_started', 'cancelled'];
const AVATAR = ['#004D84', '#F7941D', '#4FB3E3', '#6D6E71', '#2F80C0', '#C9700F', '#3a8fb7', '#8a5a00'];

const initials = (name: string) => name.replace(/\[.*?\]|\(.*?\)/g, '').split(/[\s/&,]+/).filter((w) => /^[A-Za-zÀ-ÿ]/.test(w)).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
const colorOf = (name: string) => { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR[h % AVATAR.length]; };

function Avatar({ name }: { name: string }) {
  if (!name) return <span className="grid h-8 w-8 place-items-center rounded-full border border-dashed border-[#c5cbd2] text-[13px] text-[#9aa0a6]" title="Sans responsable">—</span>;
  return <span className="grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold text-white" style={{ background: colorOf(name) }} title={name}>{initials(name)}</span>;
}

/** Cellule pleine colorée, liste déroulante transparente par-dessus (comme les cellules Statut / Priorité). */
function ColorCell<T extends string>({ value, options, label, color, onChange }: { value: T; options: T[]; label: (v: T) => string; color: (v: T) => string; onChange: (v: T) => void }) {
  return (
    <span className="relative flex h-full items-center justify-center text-[15.5px] font-medium text-white" style={{ background: color(value) }}>
      {label(value)}
      <select aria-label={label(value)} value={value} onClick={(e) => e.stopPropagation()} onChange={(e) => onChange(e.target.value as T)} className="absolute inset-0 cursor-pointer opacity-0">
        {options.map((o) => <option key={o} value={o}>{label(o)}</option>)}
      </select>
    </span>
  );
}

function Row({ t, color, onOpen }: { t: Activity; color: string; onOpen: (t: Activity) => void }) {
  const { view, unit, update } = useApp();
  const now = today();
  const shown: ActivityStatus = t.status !== 'done' && t.status !== 'cancelled' && isOverdue(t, now) ? 'late' : t.status;
  const deps = view!.parentsOf.get(t.id) ?? [];
  const orphan = t.level === 'country' && !deps.length;
  const p = t.status === 'done' ? 100 : t.progress;
  const u = unit(t.unitId);
  return (
    <div className={`grid ${COLS} min-h-[46px] cursor-pointer gap-px bg-[#e9edf1] text-[15.5px]`} onClick={() => onOpen(t)}>
      <span className="flex min-w-0 items-center gap-2 bg-white pl-3 pr-2 hover:bg-[#f7f9fb]" style={{ boxShadow: `inset 5px 0 0 ${color}` }}>
        <span className="min-w-0 flex-1 py-2.5 pl-2 leading-snug">{t.title}</span>
        {orphan && <span className="shrink-0 text-[#D64545]" title="Orpheline : non liée au plan global">⚠</span>}
      </span>
      <span className="flex items-center justify-center bg-white"><Avatar name={t.owner} /></span>
      <span className="flex items-center justify-center gap-1.5 bg-white px-2 text-center text-[14.5px] leading-snug text-[#4a4c4f]" title={deps.length ? `Soutenue par ${[...new Set(deps.map((d) => unit(d.unitId)?.name))].join(', ')}` : undefined}>
        {u?.type === 'country' && <Flag country={u.id} size={22} />}<span>{u?.name}{t.subTeam ? <span className="block text-[13px] text-[#6D6E71]">{t.subTeam}</span> : null}</span>
      </span>
      <ColorCell value={shown} options={['not_started', 'in_progress', 'done', 'late', 'cancelled'] as ActivityStatus[]} label={(v) => STATUS_LABEL[v]} color={(v) => STATUS_HEX[v]}
        onChange={(v) => update((w) => updateActivityStatus(w, t.id, { status: v, progress: t.progress, comment: t.comment }), `« ${STATUS_LABEL[v]} »`)} />
      <ColorCell value={t.priority} options={['high', 'medium', 'low'] as Priority[]} label={(v) => PRIORITY_LABEL[v]} color={(v) => PRIORITY_HEX[v]}
        onChange={(v) => update((w) => upsert(w, 'activities', { ...t, priority: v }), `Priorité ${PRIORITY_LABEL[v].toLowerCase()}`)} />
      <span className={`flex items-center justify-center bg-white text-[15px] ${shown === 'late' ? 'font-semibold text-[#D64545]' : ''}`}>
        {t.milestone && <span className="mr-1 text-accent">◆</span>}{fmtDate(t.dueDate).replace(/ \d{4}$/, '')}
      </span>
      <span className="flex items-center bg-white px-3" title={`${fmtDate(t.startDate)} → ${fmtDate(t.dueDate)} · ${p} % réalisé`}>
        <span className="relative h-5 w-full overflow-hidden rounded-full bg-[#d9dee3]">
          <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${p}%`, background: color }} />
          <span className={`absolute inset-0 grid place-items-center text-[13px] ${p > 45 ? 'text-white' : 'text-[#4a4c4f]'}`}>{p} %</span>
        </span>
      </span>
    </div>
  );
}

function Group({ kr, tasks, color, onOpen }: { kr: KeyResult; tasks: Activity[]; color: string; onOpen: (t: Activity) => void }) {
  const { ws, plan, view } = useApp();
  const [open, setOpen] = useState(true);
  const now = today();
  const sc = view!.kr.get(kr.id)!;
  const counts = STATUS_ORDER.map((s) => ({ s, n: tasks.filter((t) => (t.status !== 'done' && t.status !== 'cancelled' && isOverdue(t, now) ? 'late' : t.status) === s).length })).filter((x) => x.n);
  return (
    <section className="mb-8">
      <button onClick={() => setOpen(!open)} className="mb-2 flex w-full items-start gap-2 text-left" aria-expanded={open}>
        <span className={`mt-1.5 text-[14px] transition ${open ? '' : '-rotate-90'}`} style={{ color }}>▼</span>
        <span className="min-w-0">
          <span className="text-[22px] font-semibold leading-snug" style={{ color }}>{kr.code}</span>
          <span className="ml-2 text-[19px] leading-snug" style={{ color }}>{kr.title}</span>
          <span className="ml-3 whitespace-nowrap text-[15px] text-[#6D6E71]">{tasks.length} tâche{tasks.length > 1 ? 's' : ''} · {pct(sc.progress)}</span>
        </span>
      </button>
      {open && (
        <div className="overflow-x-auto">
          <div className="min-w-[1120px] overflow-hidden rounded-lg border border-[#e5e8ec]">
            <div className={`grid ${COLS} gap-px bg-[#e9edf1] text-center text-[14.5px] text-[#6D6E71]`}>
              {['Tâche', 'Responsable', 'Équipe / pays', 'Statut', 'Priorité', 'Échéance', 'Échéancier'].map((h, i) => (
                <span key={h} className={`bg-white py-2 ${i === 0 ? 'pl-6 text-left' : ''}`} style={i === 0 ? { boxShadow: `inset 5px 0 0 ${color}` } : undefined}>{h}</span>
              ))}
            </div>
            {tasks.map((t) => <Row key={t.id} t={t} color={color} onOpen={onOpen} />)}
            <div className={`grid ${COLS} gap-px border-t border-[#e9edf1] bg-[#e9edf1]`}>
              <button className="bg-white py-2.5 pl-6 text-left text-[15px] text-[#6D6E71] hover:text-brand-600" style={{ boxShadow: `inset 5px 0 0 ${color}40` }}
                onClick={() => onOpen(newActivity(ws, { planId: plan!.id, level: 'global', unitId: ws.units.find((u) => u.type === 'department')?.id ?? '', krId: kr.id }))}>+ Ajouter une tâche</button>
              <span className="bg-white" /><span className="bg-white" />
              <span className="flex items-center bg-white px-2" title={counts.map((c) => `${STATUS_LABEL[c.s]} : ${c.n}`).join('\n')}>
                <span className="flex h-6 w-full overflow-hidden rounded">{counts.map((c) => <span key={c.s} style={{ width: `${(c.n / Math.max(1, tasks.length)) * 100}%`, background: STATUS_HEX[c.s] }} />)}</span>
              </span>
              <span className="bg-white" /><span className="bg-white" />
              <span className="flex items-center bg-white px-3 text-[14px] text-[#6D6E71]">{tasks.filter((t) => t.status === 'done').length}/{tasks.length} terminées</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function WorkPlan() {
  const { plan, view, update, filter } = useApp();
  const tasks = useFilteredTasks();
  const [params, setParams] = useSearchParams();
  const [edit, setEdit] = useState<Activity | null>(null);
  const byKr = useMemo(() => {
    const m = new Map<string, Activity[]>();
    for (const t of tasks) if (t.krId) { const l = m.get(t.krId); if (l) l.push(t); else m.set(t.krId, [t]); }
    for (const l of m.values()) l.sort((a, b) => (a.level === b.level ? a.order - b.order : a.level === 'global' ? -1 : 1));
    return m;
  }, [tasks]);
  if (!plan || !view) return <NoPlan />;
  const objId = params.get('o') ?? view.objectives[0]?.id ?? '';
  const objective = view.objectives.find((o) => o.id === objId) ?? view.objectives[0];
  const krs = view.krs.filter((k) => k.objectiveId === objective?.id && (!isFiltered(filter) || byKr.get(k.id)?.length));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[40px] font-semibold leading-tight text-[#1d2327]">Plan de travail {plan.year}</h1>
        <button className="rounded-full bg-brand-600 px-4 py-2 text-[16px] text-white hover:bg-brand-700" onClick={() => update((w) => upsert(w, 'objectives', newObjective(w, plan.id, 'Nouvel objectif')), 'Objectif ajouté.')}>+ Objectif</button>
      </div>
      <div className="mb-5 flex flex-wrap items-center gap-6 border-b border-[#e5e8ec] text-[16px]">
        <span className="-mb-px border-b-2 border-brand-600 pb-2 font-semibold text-brand-600">▦ Tableau principal</span>
        <Link to="/gantt" className="pb-2 text-[#4a4c4f] hover:text-brand-600">☰ Gantt</Link>
        <Link to="/kanban" className="pb-2 text-[#4a4c4f] hover:text-brand-600">▥ Kanban</Link>
      </div>

      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Objectifs">
        {view.objectives.map((o) => {
          const s = view.objective.get(o.id)!;
          const sel = o.id === objective?.id;
          return (
            <button key={o.id} onClick={() => setParams({ o: o.id })} aria-pressed={sel} title={o.title}
              className={`flex max-w-[300px] items-center gap-2 rounded-full border px-4 py-1.5 text-left text-[16px] transition ${sel ? 'border-transparent bg-brand-600 text-white' : 'border-[#d5dbe1] bg-white text-[#4a4c4f] hover:border-brand-500'}`}>
              <b className="whitespace-nowrap">Objectif {o.code}</b><span className={`truncate ${sel ? 'text-white/85' : 'text-[#6D6E71]'}`}>{o.title}</span>
              {s.progress !== null && <span className="text-[14px]">{pct(s.progress)}</span>}
            </button>
          );
        })}
      </nav>
      {objective && <p className="mb-5 max-w-5xl text-[19px] italic leading-snug text-[#4a4c4f]">{objective.title}</p>}

      <FilterBar />
      {krs.map((k, i) => <Group key={k.id} kr={k} tasks={byKr.get(k.id) ?? []} color={GROUP[i % GROUP.length]} onOpen={setEdit} />)}
      {!krs.length && <p className="rounded-2xl border border-[#e5e8ec] p-8 text-center italic text-[#6D6E71]">Aucune tâche ne correspond aux filtres dans cet objectif.</p>}
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
    </div>
  );
}
