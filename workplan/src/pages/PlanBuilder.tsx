/**
 * Plan de travail : construction et lecture de l'arbre
 *   Objectif → KR global → activités globales (départements) → activités pays liées.
 * Chaque niveau a ses indicateurs de mesure. Les activités pays orphelines sont listées à part.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor, IndicatorList } from '../components/Editors';
import { Button, Card, Field, inputCls, MiniProgress, Modal, NoPlan, OrphanBadge, PageHeader, RagBadge, RoleBadge, StatusBadge, UnitChip } from '../components/ui';
import { pct } from '../lib/format';
import { newActivity, newKr, newObjective, remove, upsert } from '../lib/ops';
import { OBJECTIVE_COLORS, type Activity, type KeyResult, type Objective } from '../types';

function TitleEditor({ title, code, color, onSave, onDelete, onClose, label }: {
  title: string; code?: string; color?: string; label: string;
  onSave: (v: { title: string; code?: string; color?: string }) => void; onDelete?: () => void; onClose: () => void;
}) {
  const [t, setT] = useState(title);
  const [c, setC] = useState(code ?? '');
  const [col, setCol] = useState(color ?? '');
  return (
    <Modal title={label} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[110px,1fr]">
          {code !== undefined && <Field label="Code"><input className={inputCls} value={c} onChange={(e) => setC(e.target.value)} /></Field>}
          <Field label="Intitulé" className={code === undefined ? 'sm:col-span-2' : ''}><textarea autoFocus rows={3} className={inputCls} value={t} onChange={(e) => setT(e.target.value)} /></Field>
        </div>
        {color !== undefined && (
          <div className="flex gap-2">{OBJECTIVE_COLORS.map((x) => <button key={x} type="button" aria-label={`Couleur ${x}`} onClick={() => setCol(x)} className={`h-7 w-7 rounded ${col === x ? 'ring-2 ring-accent ring-offset-2' : ''}`} style={{ background: x }} />)}</div>
        )}
        <div className="flex gap-2">
          <Button variant="primary" disabled={!t.trim()} onClick={() => { onSave({ title: t.trim(), code: c.trim(), color: col }); onClose(); }}>Enregistrer</Button>
          <Button onClick={onClose}>Annuler</Button>
          {onDelete && <Button variant="danger" onClick={() => { onDelete(); onClose(); }}>Supprimer</Button>}
        </div>
      </div>
    </Modal>
  );
}

function ActivityLine({ a, onEdit, indent }: { a: Activity; onEdit: (a: Activity) => void; indent?: boolean }) {
  const { view, unit } = useApp();
  const sc = view!.activity.get(a.id)!;
  const u = unit(a.unitId);
  const nInd = view!.indByTarget.get(`activity:${a.id}`)?.length ?? 0;
  return (
    <button onClick={() => onEdit(a)} className={`grid w-full grid-cols-[auto,1fr] items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-[#f5f8fb] sm:grid-cols-[auto,1fr,auto,auto,auto] sm:items-center ${indent ? 'pl-6' : ''}`}>
      {u && <UnitChip name={u.name} type={u.type} />}
      <span className="min-w-0 text-sm text-[#1d2327]">
        {indent && <span className="mr-1 text-slate-400">↳</span>}{a.code && <b className="mr-1 text-brand-500">{a.code}</b>}{a.title}
        {a.alignment === 'partial' && <span className="ml-1.5 rounded bg-[#fff3e6] px-1.5 text-[11px] text-[#9a4a00]">lien partiel</span>}
        {a.owner && <span className="ml-1.5 text-xs text-slate-500">· {a.owner}</span>}
      </span>
      <span className="col-start-2 text-xs text-slate-500 sm:col-start-auto">Q{a.startQ}–Q{a.endQ} · {nInd} indic.</span>
      <span className="col-start-2 sm:col-start-auto"><StatusBadge status={a.status} /></span>
      <span className="col-start-2 sm:col-start-auto"><MiniProgress value={sc.progress} rag={sc.rag} /></span>
    </button>
  );
}

function KrBlock({ kr, o, filter }: { kr: KeyResult; o: Objective; filter: string }) {
  const { ws, plan, view, update, unit } = useApp();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get('kr') === kr.id || !filter);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [editKr, setEditKr] = useState(false);
  const v = view!;
  const sc = v.kr.get(kr.id)!;
  const globals = (v.actsByKr.get(kr.id) ?? []).filter((g) => !filter || g.unitId === filter || (v.childrenOf.get(g.id) ?? []).some((c) => c.unitId === filter));
  if (filter && !globals.length) return null;
  const commits = v.commitments.filter((c) => c.krId === kr.id);
  const firstDept = ws.units.find((u) => u.type === 'department')?.id ?? '';
  const firstCountry = ws.units.find((u) => u.type === 'country')?.id ?? '';
  return (
    <article id={`kr-${kr.id}`} className="rounded-md border border-[#DCE3EA]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#DCE3EA] bg-[#f5f8fb] px-3 py-2.5">
        <button onClick={() => setOpen(!open)} className="text-slate-400" aria-label={open ? 'Replier' : 'Déplier'}>{open ? '▾' : '▸'}</button>
        <button onClick={() => setEditKr(true)} className="font-titre text-xl font-semibold text-accent hover:underline">{kr.code}</button>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-brand-500">{kr.title}</span>
        <span className="text-xs text-slate-500">{globals.length} act. globale(s)</span>
        <MiniProgress value={sc.progress} rag={sc.rag} />
      </header>
      {open && (
        <div className="space-y-3 px-3 py-3">
          {commits.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500">Registre :</span>
              {commits.map((c) => <span key={c.id} className="inline-flex items-center gap-1" title={c.unitKr}>{unit(c.unitId)?.name}<RoleBadge role={c.role} /></span>)}
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-500">Indicateurs du KR</div>
            <IndicatorList type="kr" id={kr.id} compact />
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-500">Activités des départements globaux → activités pays</div>
            <ul className="divide-y divide-[#eef0f3]">
              {globals.map((g) => (
                <li key={g.id} className="py-1">
                  <ActivityLine a={g} onEdit={setEdit} />
                  {(v.childrenOf.get(g.id) ?? []).filter((c) => !filter || c.unitId === filter || g.unitId === filter).map((c) => <ActivityLine key={c.id} a={c} onEdit={setEdit} indent />)}
                  <button className="ml-6 text-xs font-semibold text-brand-500 hover:text-accent" onClick={() => setEdit(newActivity(ws, { planId: plan!.id, level: 'country', unitId: firstCountry, parentId: g.id, alignment: 'full', krId: kr.id }))}>+ activité pays liée</button>
                </li>
              ))}
            </ul>
            <button className="mt-1 text-sm font-semibold text-brand-500 hover:text-accent" onClick={() => setEdit(newActivity(ws, { planId: plan!.id, level: 'global', unitId: firstDept, krId: kr.id }))}>+ Activité globale</button>
          </div>
        </div>
      )}
      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
      {editKr && (
        <TitleEditor label={`KR ${kr.code} · objectif ${o.code}`} title={kr.title} code={kr.code} onClose={() => setEditKr(false)}
          onSave={(x) => update((w) => upsert(w, 'krs', { ...kr, title: x.title, code: x.code || kr.code }), 'KR enregistré.')}
          onDelete={() => confirm(`Supprimer ${kr.code} ? Ses activités restent dans le plan, sans KR.`) && update((w) => remove(w, 'krs', kr.id), 'KR supprimé.')} />
      )}
    </article>
  );
}

export default function PlanBuilder() {
  const { ws, plan, view, update } = useApp();
  const [newObj, setNewObj] = useState('');
  const [editObj, setEditObj] = useState<Objective | null>(null);
  const [addKrTo, setAddKrTo] = useState<Objective | null>(null);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [filter, setFilter] = useState('');
  if (!plan || !view) return <><PageHeader title="Plan de travail" /><NoPlan /></>;
  const noKr = view.globalActs.filter((a) => !a.krId || !view.krs.some((k) => k.id === a.krId));

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={<>{plan.name} · <span className="text-accent">avancement {pct(view.plan.progress)}</span></>} title="Plan de travail"
        subtitle="Objectifs → KR globaux → activités des départements globaux → activités pays liées. Cliquez sur un élément pour le modifier ; ajoutez des indicateurs de mesure à chaque niveau." />

      <Card>
        <div className="grid gap-2 sm:grid-cols-[1fr,auto,260px]">
          <input className={inputCls} value={newObj} onChange={(e) => setNewObj(e.target.value)} placeholder="Intitulé d’un nouvel objectif…" onKeyDown={(e) => { if (e.key === 'Enter' && newObj.trim()) { update((w) => upsert(w, 'objectives', newObjective(w, plan.id, newObj.trim())), 'Objectif ajouté.'); setNewObj(''); } }} />
          <Button variant="primary" disabled={!newObj.trim()} onClick={() => { update((w) => upsert(w, 'objectives', newObjective(w, plan.id, newObj.trim())), 'Objectif ajouté.'); setNewObj(''); }}>+ Objectif</Button>
          <select className={inputCls} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Filtrer">
            <option value="">Tous les départements et pays</option>
            <optgroup label="Départements globaux">{ws.units.filter((u) => u.type === 'department').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
            <optgroup label="Pays">{ws.units.filter((u) => u.type === 'country').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</optgroup>
          </select>
        </div>
      </Card>

      {!view.objectives.length && <Card><p className="text-sm text-slate-600">Le plan est vide. Ajoutez un premier objectif ci-dessus, ou importez votre fichier Excel (onglet <b>Import Excel</b>).</p></Card>}

      {view.objectives.map((o) => {
        const os = view.objective.get(o.id)!;
        const krs = view.krs.filter((k) => k.objectiveId === o.id);
        return (
          <section key={o.id} className="rounded-md border border-ligne bg-white px-4 py-5 sm:px-6">
            <div className="m-entete font-serif"><span>Objective {o.code}</span><span className="text-accent">{pct(os.progress)}</span></div>
            <div className="mb-4 flex flex-wrap items-start gap-4">
              <button onClick={() => setEditObj(o)} className="font-titre text-[52px] font-bold leading-none hover:opacity-80" style={{ color: o.color }}>O{o.code}</button>
              <div className="min-w-0 flex-1">
                <h2 className="font-serif text-[20px] font-bold leading-tight text-brand-500">{o.title}</h2>
                <div className="mt-2"><IndicatorList type="objective" id={o.id} compact /></div>
              </div>
              <RagBadge rag={os.rag} score={os.progress} />
            </div>
            <div className="space-y-3">
              {krs.map((k) => <KrBlock key={k.id} kr={k} o={o} filter={filter} />)}
              <button className="text-sm font-semibold text-brand-500 hover:text-accent" onClick={() => setAddKrTo(o)}>+ KR global</button>
            </div>
          </section>
        );
      })}

      {noKr.length > 0 && (
        <Card title={`Activités globales sans KR (${noKr.length})`}>
          <ul className="divide-y divide-[#eef0f3]">{noKr.map((a) => <li key={a.id}><ActivityLine a={a} onEdit={setEdit} /></li>)}</ul>
        </Card>
      )}
      {view.orphans.length > 0 && (
        <Card title={<span className="flex items-center gap-2">Activités pays orphelines ({view.orphans.length}) <OrphanBadge /></span>}>
          <p className="mb-2 text-sm text-slate-600">Ces activités pays ne sont liées à aucune activité du plan global. Cliquez pour les rattacher, ou utilisez la page Alignement (suggestions automatiques).</p>
          <ul className="divide-y divide-[#eef0f3]">{view.orphans.map((a) => <li key={a.id}><ActivityLine a={a} onEdit={setEdit} /></li>)}</ul>
        </Card>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setEdit(newActivity(ws, { planId: plan.id, level: 'global', unitId: ws.units.find((u) => u.type === 'department')?.id ?? '' }))}>+ Activité globale</Button>
        <Button onClick={() => setEdit(newActivity(ws, { planId: plan.id, level: 'country', unitId: ws.units.find((u) => u.type === 'country')?.id ?? '' }))}>+ Activité pays</Button>
      </div>

      {edit && <ActivityEditor act={edit} onClose={() => setEdit(null)} />}
      {editObj && (
        <TitleEditor label={`Objectif ${editObj.code}`} title={editObj.title} code={editObj.code} color={editObj.color} onClose={() => setEditObj(null)}
          onSave={(x) => update((w) => upsert(w, 'objectives', { ...editObj, title: x.title, code: x.code || editObj.code, color: x.color || editObj.color }), 'Objectif enregistré.')}
          onDelete={() => confirm('Supprimer cet objectif et ses KR ? Les activités restent, sans KR.') && update((w) => remove(w, 'objectives', editObj.id), 'Objectif supprimé.')} />
      )}
      {addKrTo && (
        <TitleEditor label={`Nouveau KR · objectif ${addKrTo.code}`} title="" code={newKr(ws, plan.id, addKrTo, '').code} onClose={() => setAddKrTo(null)}
          onSave={(x) => update((w) => upsert(w, 'krs', { ...newKr(w, plan.id, addKrTo, x.title), code: x.code || newKr(w, plan.id, addKrTo, '').code }), 'KR ajouté.')} />
      )}
    </div>
  );
}
