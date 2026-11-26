/**
 * Plan de travail : construction et lecture de l'arbre
 *   Objectif → KR global → activités globales (départements) → activités pays liées.
 * Chaque niveau a ses indicateurs de mesure. Les activités pays orphelines sont listées à part.
 */
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../AppContext';
import { ActivityEditor, IndicatorList } from '../components/Editors';
import { AlignBadge, Button, Card, Field, inputCls, MiniProgress, Modal, NoPlan, OrphanBadge, PageHeader, RagBadge, RoleBadge, StatusBadge, UnitChip } from '../components/ui';
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

function ActivityLine({ a, onEdit }: { a: Activity; onEdit: (a: Activity) => void }) {
  const { view, unit } = useApp();
  const v = view!;
  const sc = v.activity.get(a.id)!;
  const u = unit(a.unitId);
  const nInd = v.indByTarget.get(`activity:${a.id}`)?.length ?? 0;
  const parents = a.level === 'country' ? v.parentsOf.get(a.id) ?? [] : [];
  const kids = a.level === 'global' ? v.childrenOf.get(a.id) ?? [] : [];
  return (
    <button onClick={() => onEdit(a)} className="grid w-full grid-cols-[auto,1fr] items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-[#f5f8fb] md:grid-cols-[150px,1fr,auto,auto,auto] md:items-center">
      <span className="flex flex-wrap items-center gap-1">{u && <UnitChip name={u.name + (a.subTeam ? ` (${a.subTeam})` : '')} type={u.type} />}{a.role ? <RoleBadge role={a.role} /> : <span className="text-[11px] text-slate-500">Team KR</span>}</span>
      <span className="min-w-0 text-sm text-[#1d2327]">
        {a.title}
        <span className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
          {a.owner && <span>Lead : {a.owner} ·</span>}
          {a.level === 'country' && (parents.length
            ? <span>soutenu par {[...new Set(parents.map((p) => unit(p.unitId)?.name))].join(', ')}</span>
            : <OrphanBadge />)}
          {a.level === 'global' && <span>{kids.length ? `${kids.length} KR pays rattaché(s)` : 'aucun KR pays rattaché'}</span>}
          <span>· {nInd} indic.</span>
        </span>
      </span>
      <span className="col-start-2 md:col-start-auto"><AlignBadge status={a.alignment} /></span>
      <span className="col-start-2 md:col-start-auto"><StatusBadge status={a.status} /></span>
      <span className="col-start-2 md:col-start-auto"><MiniProgress value={sc.progress} rag={sc.rag} /></span>
    </button>
  );
}

function KrBlock({ kr, o, filter }: { kr: KeyResult; o: Objective; filter: string }) {
  const { ws, plan, view, update } = useApp();
  const [params] = useSearchParams();
  const [open, setOpen] = useState(params.get('kr') === kr.id || !filter);
  const [edit, setEdit] = useState<Activity | null>(null);
  const [editKr, setEditKr] = useState(false);
  const v = view!;
  const sc = v.kr.get(kr.id)!;
  const globals = v.globalActs.filter((g) => g.krId === kr.id && (!filter || g.unitId === filter));
  const countries = v.countryActs.filter((c) => c.krId === kr.id && (!filter || c.unitId === filter));
  if (filter && !globals.length && !countries.length) return null;
  const orph = countries.filter((c) => !(v.parentsOf.get(c.id) ?? []).length).length;
  const firstDept = ws.units.find((u) => u.type === 'department')?.id ?? '';
  const firstCountry = ws.units.find((u) => u.type === 'country')?.id ?? '';
  return (
    <article id={`kr-${kr.id}`} className="rounded-md border border-[#DCE3EA]">
      <header className="flex flex-wrap items-center gap-3 border-b border-[#DCE3EA] bg-[#f5f8fb] px-3 py-2.5">
        <button onClick={() => setOpen(!open)} className="text-slate-400" aria-label={open ? 'Replier' : 'Déplier'}>{open ? '▾' : '▸'}</button>
        <button onClick={() => setEditKr(true)} className="font-titre text-xl font-semibold text-accent hover:underline">{kr.code}</button>
        <span className="min-w-0 flex-1 text-[15px] font-semibold text-brand-500">{kr.title}</span>
        <span className="text-xs text-slate-500">{globals.length} KR équipes globales · {countries.length} KR pays{orph ? <b className="ml-1 text-rag-red">· {orph} orphelin(s)</b> : null}</span>
        <MiniProgress value={sc.progress} rag={sc.rag} />
      </header>
      {open && (
        <div className="space-y-3 px-3 py-3">
          {!kr.team && (
            <div>
              <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-500">Indicateurs du KR global</div>
              <IndicatorList type="kr" id={kr.id} compact />
            </div>
          )}
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-500">Équipes globales (plan global)</div>
            <ul className="divide-y divide-[#eef0f3]">{globals.map((g) => <li key={g.id}><ActivityLine a={g} onEdit={setEdit} /></li>)}</ul>
            {!globals.length && <p className="px-2 text-sm text-slate-500">Aucune équipe globale sur cette Ref.</p>}
            <button className="mt-1 text-sm font-semibold text-brand-500 hover:text-accent" onClick={() => setEdit(newActivity(ws, { planId: plan!.id, level: 'global', unitId: firstDept, krId: kr.id }))}>+ KR / activité d’équipe globale</button>
          </div>
          <div>
            <div className="mb-1 text-xs font-bold uppercase tracking-wide text-brand-500">Pays (doivent être soutenus par le global)</div>
            <ul className="divide-y divide-[#eef0f3]">{countries.map((c) => <li key={c.id}><ActivityLine a={c} onEdit={setEdit} /></li>)}</ul>
            {!countries.length && <p className="px-2 text-sm text-slate-500">Aucun KR pays sur cette Ref.</p>}
            <button className="mt-1 text-sm font-semibold text-brand-500 hover:text-accent" onClick={() => setEdit(newActivity(ws, { planId: plan!.id, level: 'country', unitId: firstCountry, krId: kr.id, parentIds: globals.map((g) => g.id) }))}>+ KR / activité pays</button>
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
        subtitle="Objectifs → KR globaux → KR / activités des équipes globales → KR / activités des pays, soutenus par le global. Cliquez sur un élément pour le modifier ; ajoutez des indicateurs de mesure à chaque niveau." />

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
